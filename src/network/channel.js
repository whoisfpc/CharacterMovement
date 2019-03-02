// @ts-check

import Instance from "../core/instance";

/**
 * @typedef {Object} ChannelPackege
 * @property {number} validTime - package valid dequeue time
 * @property {any} payload - package payload
 */

export default class Channel {
    /**
     * @param {Instance} remote
     * @param {number} lag
     * @param {number} lagVariance
     * @param {number} loss
     */
    constructor(remote, lag = 0, lagVariance = 0, loss = 0) {
        this.remote = remote;
        /** @type {ChannelPackege[]} */
        this.queue = [];
        this.lag = lag;
        this.lagVariance = lagVariance;
        this.loss = loss;
    }

    /**
     * @param {number} time
     * @param {any} message
     */
    push(time, message) {
        if (Math.random() >= this.loss) {
            this.queue.push({
                validTime: time + Math.max(0, this.lag + Math.random() * this.lagVariance * 2 - this.lagVariance),
                payload: message
            });
        }
    }

    /**
     * @param {number} now
     * @return {any} fetch latest message
     */
    fetch(now) {
        let idx = -1;
        let minTime = now;
        for (let i = 0; i < this.queue.length; i++) {
            const item = this.queue[i];
            if (item.validTime <= minTime) {
                minTime = item.validTime;
                idx = i;
            }
        }
        if (idx == -1) {
            return null;
        } else {
            const item = this.queue[idx];
            this.queue.splice(idx, 1);
            return item.payload;
        }
    }
}
