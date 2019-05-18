// @ts-check

import Vec2 from "../../algebra/vec2";

/**
 * @typedef {Object} Frame
 * @property {number} idx
 * @property {number} duration
 * @property {Vec2} pivot
 *
 * @typedef {Object} AnimConfig
 * @property {string[]} imageSrcs
 * @property {Frame[]} frames
 */

export default class AnimeClip {
    /**
     *
     * @param {AnimConfig} config
     */
    constructor(config) {
        /** @type {HTMLImageElement[]} */
        this.images = [];
        this.config = config;
        this.frames = config.frames;
        this.currentFrameIdx = 0;
        this.currentDuration = 0;
    }

    /**
     * @return {AnimeClip}
     */
    clone() {
        const animeClip = new AnimeClip(this.config);
        animeClip.images = this.images;
        return animeClip;
    }

    loadImages() {
        for (let src of this.config.imageSrcs) {
            const image = new Image();
            this.images.push(image)
            image.src = src;
        }
    }

    reset() {
        this.currentFrameIdx = 0;
        this.currentDuration = 0;
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} dt
     * @param {boolean} flip
     * @param {Vec2} pos
     * @param {number} scale
     */
    draw(ctx, dt, flip, pos, scale = 1) {
        const frame = this.frames[this.currentFrameIdx];
        const image = this.images[frame.idx];
        ctx.save()
        // to get sharp pixel
        ctx.imageSmoothingEnabled = false;
        const w = image.width * scale;
        const h = image.height * scale;
        const p = frame.pivot.mul(scale);
        ctx.translate(pos.x, pos.y);
        if (flip) {
            ctx.scale(-1, 1)
        }
        ctx.drawImage(image, -p.x, -p.y, w, h);
        ctx.restore();
        this.currentDuration += dt;
        let currentMaxDuration = frame.duration;
        while (this.currentDuration >= currentMaxDuration) {
            this.currentDuration -= currentMaxDuration;
            this.currentFrameIdx = (this.currentFrameIdx + 1) % this.frames.length;
            currentMaxDuration = this.frames[this.currentFrameIdx].duration;
        }
    }
}
