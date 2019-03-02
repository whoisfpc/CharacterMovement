import Vec2 from "../../algebra/vec2";

export default class Polygon {

    /**
     * construct a polygon from a set of points
     * segments are clockwise order
     * @param {Vec2[]} points
     * @param {string} [color]
     */
    constructor(points, color = "#FF00FF") {
        this.color = color;
        if (points.length < 3) {
            this.isValid = false;
            return;
        }
        this.isValid = true;
        /** @type {Vec2[]} */
        this.points = [];
        for (let point of points) {
            this.points.push(point.clone());
        }
    }

    /**
     * iterate over all segment
     * @param {(p0: Vec2, p1: Vec2) => void} callback
     */
    eachSegment(callback) {
        if (!this.isValid) {
            return;
        }
        for (let i = 0; i < this.points.length; i++) {
            const j = (i + 1) % this.points.length;
            callback(this.points[i].clone(), this.points[j].clone());
        }
    }

    /**
     * draw this polygon
     * @param {CanvasRenderingContext2D} ctx
     */
    draw(ctx) {
        if (!this.isValid) {
            return;
        }
        ctx.beginPath();
        for (let i = 0; i < this.points.length; i++) {
            ctx.lineTo(this.points[i].x, this.points[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();
    }
}
