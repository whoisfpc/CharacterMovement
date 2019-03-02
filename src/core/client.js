// @ts-check

import Instance from "./instance";
import Player from "./player";
import Channel from "../network/channel";
import Vec2 from "../algebra/vec2";
import Server from "./server";
import InputSystem from "./input/inputSystem";

/**
 * @typedef {Object} SavedMove
 * @property {number} sequence
 * @property {Vec2} velocity
 * @property {Vec2} acceleration
 * @property {number} dt
 */

export default class Client extends Instance {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {Player[]} players
     * @param {InputSystem} input
     */
    constructor(canvas, players, input) {
        super(canvas, players);
        this.input = input;
        for (let player of players) {
            if (player.isMainPlayer) {
                this.mainPlayer = player;
            }
        }
        /** @type {Channel} */
        this.sendChannel = null;
        /** @type {Channel} */
        this.recvChannel = null;

        this.connected = false;
        this.sequence = 0;
        /** @type {SavedMove[]} */
        this.pendingMoves = [];
        this.lag = 0;
        this.lagVariance = 0;
        this.loss = 0;
        this.prediction = false;
        this.reconciliation = false;
        this.jitterBuffer = false;
        this.serverInterval = 0;
        this.interpDelay = 100;
        this.autoCalcDelayTime = true;
        this.visualSmooth = false;
    }

    /**
     * @param {number} dt
     */
    update(dt) {
        super.update(dt);
        this.input.updateState();
        if (!this.mainPlayer) {
            return;
        }
        if (this.connected) {
            let message = null;
            let maxAck = 0;
            while (message = this.recvChannel.fetch(this.currentTime)) {
                for (let info of message.infos) {
                    const player = this.playerMap.get(info.id);
                    if (player && info.timestamp > player.updatedTimestamp) {
                        player.updatedTimestamp = info.timestamp;
                        if (player.isMainPlayer) {
                            if (message.ack > maxAck) {
                                player.recvPos = info.pos.clone();
                                player.recvVel = info.velocity.clone();
                                player.corrected = message.error;
                            }
                        } else if (!this.jitterBuffer) {
                            player.pos = info.pos;
                            player.setVelocity(info.velocity);
                            player.recvPos = info.pos.clone();
                        } else {

                            let localTime = 0;
                            if (player.positionBuffer.length == 0) {
                                localTime = this.currentTime;
                            } else {
                                const lastBuffer = player.positionBuffer[player.positionBuffer.length - 1];
                                localTime = lastBuffer.localTimestamp + (info.timestamp - lastBuffer.timestamp);
                            }
                            player.positionBuffer.push({
                                timestamp: player.updatedTimestamp,
                                localTimestamp: localTime,
                                pos: info.pos.clone(),
                                velocity: info.velocity.clone(),
                            });
                        }
                        player.hasUpdate = true;
                    }
                }
                if (message.ack > maxAck) {
                    maxAck = message.ack;
                }
            }
            // get position and velocity from jitter buffer
            if (this.jitterBuffer) {
                for (let player of this.playerMap.values()) {
                    if (player.isMainPlayer || player.positionBuffer.length == 0) {
                        continue;
                    }
                    let delay = 0;
                    if (this.autoCalcDelayTime) {
                        delay = this.serverInterval * 3.5;
                    } else {
                        delay = this.interpDelay;
                    }
                    const renderTime = this.currentTime - delay;
                    if (renderTime > player.positionBuffer[0].localTimestamp) {
                        const buffer = player.positionBuffer.shift();
                        player.pos = buffer.pos;
                        player.setVelocity(buffer.velocity);
                        player.recvPos = buffer.pos.clone();
                    }
                }
            } else {
                for (let player of this.playerMap.values()) {
                    player.positionBuffer.length = 0;
                    if (!player.isMainPlayer && player.hasUpdate) {
                        player.pos = player.recvPos;
                    }
                }
            }

            if (this.mainPlayer.corrected) {
                this.mainPlayer.setVelocity(this.mainPlayer.recvVel);
                this.mainPlayer.pos = this.mainPlayer.recvPos;
            }

            // main player replay pending moves
            if (this.pendingMoves.length > 0 && this.mainPlayer.hasUpdate) {
                for (let i = 0; i < this.pendingMoves.length; i++) {
                    if (this.pendingMoves[i].sequence == maxAck) {
                        this.pendingMoves.splice(0, i + 1);
                        break;
                    }
                }
                if (this.mainPlayer.corrected) {
                    for (let move of this.pendingMoves) {
                        this.mainPlayer.setAcceleration(move.acceleration);
                        this.mainPlayer.update(dt);
                        move.velocity = this.mainPlayer.velocity.clone();
                    }
                }
            }
        }

        if (this.prediction || !this.connected) {
            const forward = this.input.getForward();
            const right = this.input.getRight();
            const input = new Vec2(right, -forward);
            if (this.input.getActionDown("jump")) {
                this.mainPlayer.jump();
            }
            if (this.input.getActionUp("jump")) {
                this.mainPlayer.stopJumping();
            }
            this.mainPlayer.addMovement(input);
        }

        for (let player of this.playerMap.values()) {
            if (!player.isMainPlayer || this.prediction || !this.connected) {
                player.update(dt);
            }
            if (!player.isMainPlayer && this.visualSmooth) {
                const diff = player.pos.sub(player.displayPos);
                const diffLength = diff.length();
                if (diffLength < player.maxSpeed * dt * 1.2) {
                    player.displayPos = player.pos.clone();
                } else {
                    let blend = 0.05;
                    let smallLimit = 70;
                    let largeLimit = 200;
                    if (diffLength > smallLimit && diffLength < largeLimit) {
                        blend = (diffLength - smallLimit) / (largeLimit - smallLimit) * (0.15 - 0.05) + 0.05;
                    } else if (diffLength >= largeLimit) {
                        blend = 0.15;
                    }
                    player.displayPos = diff.mul(blend).add(player.displayPos);
                }
            }
        }

        if (this.connected) {
            this.sequence++;
            const message = {
                sequence: this.sequence,
                timestamp: this.currentTime,
                id: this.mainPlayer.id,
                acceleration: this.mainPlayer.acceleration.clone(),
                pos: this.mainPlayer.pos.clone(),
            };

            this.sendChannel.push(this.currentTime, message);
            if (this.reconciliation) {
                this.pendingMoves.push({
                    sequence: this.sequence,
                    velocity: this.mainPlayer.velocity.clone(),
                    acceleration: this.mainPlayer.acceleration.clone(),
                    dt: dt,
                });
            } else {
                this.pendingMoves.length = 0;
            }
        }
    }

    /**
     * @param {Server} server
     */
    connect(server) {
        if (!this.mainPlayer) {
            return;
        }
        this.sendChannel = new Channel(server, this.lag, this.lagVariance, this.loss);
        server.establish(this, this.sendChannel);
        this.connected = true;
    }

    /**
     * @param {Server} server
     */
    disconnect(server) {
        if (!this.mainPlayer) {
            return;
        }
        this.connected = false;
        server.dismantle(this);
        this.sendChannel = null;
        this.recvChannel = null;
        this.playerMap.clear();
        this.mainPlayer.id = 0;
        this.playerMap.set(this.mainPlayer.id, this.mainPlayer);
        this.pendingMoves.length = 0;
    }

    /**
     * @param {number} mainPlayerId
     * @param {Player[]} players
     */
    receiveConnectInfos(mainPlayerId, players) {
        this.playerMap.delete(this.mainPlayer.id);
        this.mainPlayer.id = mainPlayerId;
        this.playerMap.set(this.mainPlayer.id, this.mainPlayer);
        for (let player of players) {
            player.scene = this.scene;
            player.visualSmooth = this.visualSmooth;
            this.playerMap.set(player.id, player);
        }
    }

    /**
     * @param {Player} player
     */
    receiveNewPlayerAdd(player) {
        player.scene = this.scene;
        this.playerMap.set(player.id, player);
    }

    /**
     * @param {number} id
     */
    receivePlayerRemove(id) {
        this.playerMap.delete(id);
    }

    /**
     * @param {number} lag
     */
    setLag(lag) {
        this.lag = lag;
        if (this.sendChannel) {
            this.sendChannel.lag = lag;
            this.recvChannel.lag = lag;
        }
    }

    /**
     * @param {number} lagVariance
     */
    setLagVariance(lagVariance) {
        this.lagVariance = lagVariance;
        if (this.sendChannel) {
            this.sendChannel.lagVariance = lagVariance;
            this.recvChannel.lagVariance = lagVariance;
        }
    }

    /**
     * @param {number} loss
     */
    setLoss(loss) {
        this.loss = loss;
        if (this.sendChannel) {
            this.sendChannel.loss = loss;
            this.recvChannel.loss = loss;
        }
    }

    /**
     * @param {boolean} visualSmooth
     */
    setVisualSmooth(visualSmooth) {
        this.visualSmooth = visualSmooth;
        for (let player of this.playerMap.values()) {
            if (!player.isMainPlayer) {
                player.visualSmooth = visualSmooth;
            }
        }
    }
}
