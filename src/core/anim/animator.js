// @ts-check

import AnimeClip from "./animeClip";
import Vec2 from "../../algebra/vec2";

export default class Animator {
    constructor() {
        /**@type {Map<string, AnimeClip>} */
        this.animMap = new Map();
        this.currentKey = "";
    }

    /**
     * @return {Animator}
     */
    clone() {
        const animator = new Animator();
        this.animMap.forEach((animeClip, key) => {
            animator.addNewAnimeClip(key, animeClip.clone());
        });
        return animator;
    }

    /**
     *
     * @param {string} key
     * @param {AnimeClip} animeClip
     */
    addNewAnimeClip(key, animeClip) {
        this.animMap.set(key, animeClip);
    }

    /**
     *
     * @param {string} key
     */
    setAnimeKey(key) {
        if (key != this.currentKey && this.animMap.has(key)) {
            const animeClip = this.animMap.get(key);
            animeClip.reset();
            this.currentKey = key;
        }
    }

    /**
     * draw anime
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} dt
     * @param {Vec2} pos
     * @param {boolean} flip
     * @param {number} scale
     */
    draw(ctx, dt, pos, flip, scale = 1) {
        if (!this.animMap.has(this.currentKey)) {
            return;
        }
        const animeClip = this.animMap.get(this.currentKey);
        animeClip.draw(ctx, dt, flip, pos, scale);
    }
}
