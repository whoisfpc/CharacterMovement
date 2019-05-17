// @ts-check

import { Time } from "./globals";
import Player from "./player";
import Scene from "./scene";
import Polygon from "./geom/polygon";
import Vec2 from "../algebra/vec2";

export default class Instance {
    /**
     * @param {HTMLCanvasElement} canvas
     */
    constructor(canvas) {
        this.canvas = canvas;

        this.ctx = canvas.getContext("2d");
        this.width = canvas.width;
        this.height = canvas.height;
        this.scene = new Scene(this.width, this.height);
        this.scene.addPolygon(new Polygon([
            new Vec2(0, 350),new Vec2(50, 350), new Vec2(150, 450), new Vec2(300, 450), new Vec2(300, 440), new Vec2(350, 440), new Vec2(350, 430),
            new Vec2(400, 430),
            new Vec2(500, 400), new Vec2(500, 350), new Vec2(600, 350), new Vec2(600, 500), new Vec2(0, 500)
        ], "#994639"));
        this.lastTime = 0;
        this.currentTime = 0;
        /**@type {Player[]} */
        this.players = [];
    }

    /**
     * draw scene and players
     */
    draw() {
        this.scene.draw(this.ctx);
        for (let player of this.players) {
            player.draw(this.ctx);
        }
        this.scene.drawDebug(this.ctx);
    }

    /**
     * @param {number} dt
     */
    update(dt) {
        this.scene.update(dt);
        for (let player of this.players) {
            player.update(dt);
        }
    }

    /**
     * add a new player into secne
     * @param {Player} player
     */
    addNewPlayer(player) {
        player.scene = this.scene;
        this.players.push(player);
    }

    /**
     * set instance update
     * @param {number} interval
     */
    setUpdate(interval) {
        this.interval = interval;
    }

    tryUpdate() {
        if (Time.currentUnscaleTime != Time.lastUnscaleTime) {
            let unscaleDt = Time.currentUnscaleTime - this.lastTime;
            if (unscaleDt >= this.interval) {
                this.currentTime += this.interval * Time.scale;
                this.update(this.interval * 0.001 * Time.scale);
                this.lastTime = Time.currentUnscaleTime - unscaleDt + this.interval;
            }
        } else {
            this.lastTime = Time.currentUnscaleTime;
            this.currentTime = Time.currentTime;
        }
    }
}

Instance.showRecvPos = false;
Instance.showPos = false;
