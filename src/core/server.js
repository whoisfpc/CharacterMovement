// @ts-check

import Instance from "./instance";
import Player from "./player";
import Channel from "../network/channel";
import Client from "./client";

export default class Server extends Instance {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {Player[]} players
     */
    constructor(canvas, players) {
        super(canvas, players);
        /** @type {Channel[]} */
        this.sendChannels = [];
        /** @type {Channel[]} */
        this.recvChannels = [];

        this.alwaysSync = false;

        this.idSeed = 1;
    }

    /**
     * @param {Client} client
     * @param {Channel} channel
     */
    establish(client, channel) {
        const newPlayer = client.mainPlayer.clone();
        newPlayer.id = this.idSeed;
        newPlayer.scene = this.scene;
        newPlayer.updatedTimestamp = client.currentTime;
        newPlayer.hasUpdate = true;
        this.idSeed++;
        let addedPlayers = [];
        for (let player of this.playerMap.values()) {
            addedPlayers.push(player.clone());
        }
        client.receiveConnectInfos(newPlayer.id, addedPlayers)
        for (let sendChannel of this.sendChannels) {
            /** @type {Client} */
            const remoteClient = (sendChannel.remote);
            remoteClient.receiveNewPlayerAdd(newPlayer.clone());
        }
        this.playerMap.set(newPlayer.id, newPlayer);
        this.recvChannels.push(channel);
        const sendChannel = new Channel(client, client.lag, client.lagVariance, client.loss);
        client.recvChannel = sendChannel;
        this.sendChannels.push(sendChannel);
        client.serverInterval = this.interval;
    }

    /**
     * @param {Client} client
     */
    dismantle(client) {
        this.playerMap.delete(client.mainPlayer.id);
        let channelIdx = 0;
        for (let channel of this.sendChannels) {
            if (channel.remote != client) {
                channelIdx++;
                /** @type {Client} */
                const remoteClient = (channel.remote);
                remoteClient.receivePlayerRemove(client.mainPlayer.id);
            }
        }
        this.sendChannels.splice(channelIdx, 1);
        this.recvChannels.splice(channelIdx, 1);
    }

    /**
      * @param {number} dt
      */
    update(dt) {
        super.update(dt);

        const acks = [];
        const errors = [];
        for (let channel of this.recvChannels) {
            let message = null;
            let ack = 0;
            let id = 0;
            let error = false;
            while (message = channel.fetch(this.currentTime)) {
                const player = this.playerMap.get(message.id);
                if (player && message.sequence > player.lastSequence) {
                    if (message.timestamp < player.updatedTimestamp) {
                        console.warn("message timestamp "+ message.timestamp +" < player updated timestamp " + player.updatedTimestamp);
                    }
                    player.lastSequence = message.sequence;
                    ack = message.sequence;
                    player.hasUpdate = true;
                    player.setAcceleration(message.acceleration);
                    player.recvPos = message.pos;
                    ack = message.sequence;

                    player.update((message.timestamp - player.updatedTimestamp) * 0.001);
                    const posDiff = player.pos.sub(player.recvPos).length();
                    if (posDiff > 15) {
                        error = true;
                    } else {
                        error = false;
                    }
                    player.updatedTimestamp = message.timestamp;
                }
            }
            acks.push(ack);
            errors.push(error);
        }

        const infos = [];
        for (let player of this.playerMap.values()) {
            if (!player.hasUpdate) {
                player.update(dt);
            }
            if (player.hasUpdate || this.alwaysSync) {
                infos.push({
                    timestamp: this.currentTime,
                    id: player.id,
                    pos: player.pos.clone(),
                    velocity: player.velocity.clone()
                });
            }
        }
        for (let i = 0; i < this.sendChannels.length; i++) {
            this.sendChannels[i].push(this.currentTime,
            {
                ack: acks[i],
                error: errors[i],
                infos: infos
            });
            // redundant package for against loss
            // this.sendChannels[i].push(this.currentTime,
            // {
            //     ack: acks[i],
            //     error: errors[i],
            //     infos: infos
            // });
        }
    }

    /**
     * set instance update
     * @param {number} interval
     */
    setUpdate(interval) {
        super.setUpdate(interval);
        for (let channel of this.sendChannels) {
            /** @type {Client} */
            const remoteClient = (channel.remote);
            remoteClient.serverInterval = interval;
        }
    }
}
