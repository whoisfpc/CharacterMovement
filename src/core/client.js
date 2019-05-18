// @ts-check

import Instance from "./instance";
import Player, { Role } from "./player";
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
     * @param {Player} mainPlayer
     * @param {InputSystem} input
     */
    constructor(canvas, mainPlayer, input) {
        super(canvas);
        this.input = input;
        if (mainPlayer != null) {
            this.mainPlayer = mainPlayer;
            this.mainPlayer.isMainPlayer = true;
            this.mainPlayer.role = Role.autonomous;
            this.addNewPlayer(this.mainPlayer);
        }

        /** @type {Channel} */
        this.sendChannel = null;
        /** @type {Channel} */
        this.recvChannel = null;

        this.connected = false;
        this.lag = 0;
        this.lagVariance = 0;
        this.loss = 0;
        this.serverInterval = 0;
    }

    receiveNetMessage() {
        if (!this.connected) {
            return;
        }
        /**@type {import("./server").ReplicateMoveMsg} */
        let replicateMoveMsg = this.recvChannel.fetch(this.currentTime);
        while (replicateMoveMsg != null) {
            for (let moveMsg of replicateMoveMsg.moveMsgs) {
                if (moveMsg.id != this.mainPlayer.id) {
                    const findPlayer = this.players.find(player => player.id == moveMsg.id);
                    if (findPlayer) {
                        findPlayer.onReplicateMove(moveMsg);
                    }
                } else {
                    this.mainPlayer.onMainPlayerReceiveServerMove(moveMsg);
                }
            }
            replicateMoveMsg = this.recvChannel.fetch(this.currentTime);
        }
    }

    /**
     * @param {number} dt
     */
    update(dt) {
        this.receiveNetMessage();
        this.input.updateState();
        if (this.mainPlayer) {
            // handle mainPlayer move
            const forward = this.input.getForward();
            const right = this.input.getRight();
            const inputVec = new Vec2(right, -forward);
            if (this.input.getActionDown("jump")) {
                this.mainPlayer.jump();
            }
            if (this.input.getActionUp("jump")) {
                this.mainPlayer.stopJumping();
            }
            this.mainPlayer.addMovement(inputVec);
        }
        super.update(dt);
        this.sendNetMessage();
    }

    sendNetMessage() {
        if (!this.connected) {
            return;
        }
        const moveMsg = this.mainPlayer.consumeMoveMsg();
        if (moveMsg != null) {
            this.sendChannel.push(this.currentTime, moveMsg);
        }
    }

    /**
     * @param {Server} server
     */
    connect(server) {
        if (!this.mainPlayer) {
            return;
        }
        this.sendChannel = new Channel(this, server, this.lag, this.lagVariance, this.loss);
        const {serverChannel, id, playerInfos} = server.establish(this.sendChannel, this.mainPlayer.getPlayerInfo());
        this.recvChannel = serverChannel;
        this.mainPlayer.id = id;
        for (let playerInfo of playerInfos) {
            this.addRemotePlayer(playerInfo);
        }
        this.connected = true;
        this.mainPlayer.isNetMode = true;
    }

    /**
     * @param {Server} server
     */
    disconnect(server) {
        if (!this.mainPlayer) {
            return;
        }
        server.dismantle(this.mainPlayer.id);
        this.sendChannel = null;
        this.recvChannel = null;
        this.mainPlayer.id = 0;
        this.players.splice(1);
        this.connected = false;
        this.mainPlayer.isNetMode = false;
        this.mainPlayer.clearNetState();
    }

    /**
     * add new remote player
     * @param {import("./player").PlayerInfo} playerInfo
     */
    addRemotePlayer(playerInfo) {
        const player = new Player(playerInfo.pos, playerInfo.color, playerInfo.id);
        player.isNetMode = true;
        player.role = Role.simulate;
        player.animator = playerInfo.animator;
        this.addNewPlayer(player);
    }

    /**
     * @param {number} id
     */
    removeRemotePlayer(id) {
        const idx = this.players.findIndex(player => player.id == id);
        if (idx > 0) {
            this.players.splice(idx, 1);
        }
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
}
