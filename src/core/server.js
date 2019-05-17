// @ts-check

import Instance from "./instance";
import Player, { PlayerInfo } from "./player";
import Channel from "../network/channel";
import Client from "./client";

export default class Server extends Instance {
    /**
     * @param {HTMLCanvasElement} canvas
     */
    constructor(canvas) {
        super(canvas);
        /** @type {Channel[]} */
        this.sendChannels = [];
        /** @type {Channel[]} */
        this.recvChannels = [];
        /**@type {Map<number, number>} */
        this.idMap = new Map(); // id -> idx map

        this.alwaysSync = true;

        this.idSeed = 1;
    }

    /**
     * @return {number} new id
     */
    generateId() {
        const id = this.idSeed;
        this.idSeed++;
        return id;
    }

    /**
     * generate a new player with player info and specific id
     * @param {PlayerInfo} playerInfo
     * @param {number} id
     */
    generatePlayer(playerInfo, id) {
        const player = new Player(playerInfo.pos, playerInfo.color, id);
        return player;
    }

    /**
     * @param {Channel} clientChannel
     * @param {PlayerInfo} playerInfo
     * @return {{serverChannel: Channel, id: number, playerInfos: PlayerInfo[]}}
     */
    establish(clientChannel, playerInfo) {
        const id = this.generateId();
        const idx = this.players.length;
        this.idMap.set(id, idx);
        const newPlayer = this.generatePlayer(playerInfo, id);
        const newPlayerInfo = newPlayer.getPlayerInfo();
        const respPlayerInfos = [];
        for (let player of this.players) {
            respPlayerInfos.push(player.getPlayerInfo());
        }
        this.addNewPlayer(newPlayer);
        for (let sendChannel of this.sendChannels) {
            /**@type {Client} */
            const client = (sendChannel.receiver);
            client.addRemotePlayer(newPlayerInfo);
        }
        const serverChannel = new Channel(this, clientChannel.sender, clientChannel.lag, clientChannel.lagVariance, clientChannel.loss);
        this.sendChannels.push(serverChannel);
        this.recvChannels.push(clientChannel);
        return {
            serverChannel: serverChannel,
            id: id,
            playerInfos: respPlayerInfos,
        };
    }

    /**
     * @param {number} id
     */
    dismantle(id) {
        const idx = this.idMap.get(id);
        this.idMap.delete(id);
        this.sendChannels.splice(idx, 1);
        this.recvChannels.splice(idx, 1);
        this.players.splice(idx, 1);
        for (let i = 0; i < this.players.length; i++) {
            const remainId = this.players[i].id;
            const oldIdx = this.idMap.get(remainId);
            if (oldIdx > idx) {
                this.idMap.set(remainId, oldIdx - 1);
            }
        }
        for (let sendChannel of this.sendChannels) {
            /**@type {Client} */
            const client = (sendChannel.receiver);
            client.removeRemotePlayer(id);
        }
    }

    /**
      * @param {number} dt
      */
    update(dt) {
        super.update(dt);
    }

    /**
     * set instance update
     * @param {number} interval
     */
    setUpdate(interval) {
        super.setUpdate(interval);
        for (let channel of this.sendChannels) {
            /** @type {Client} */
            const remoteClient = (channel.receiver);
            remoteClient.serverInterval = interval;
        }
    }
}
