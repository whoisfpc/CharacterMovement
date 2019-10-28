// @ts-check

import Vec2 from "../../algebra/vec2";
import * as Util from "./util";
import Scene from "../scene";

export { HitResult } from "./util";

export default class Capsule {
    /**
     * @param {Vec2} center
     * @param {number} halfHeight
     * @param {number} radius
     * @param {string} [color]
     */
    constructor(center, halfHeight, radius, color = "#FF00FF") {
        this._center = center.clone();
        this.a = center.sub(new Vec2(0, halfHeight));
        this.b = center.add(new Vec2(0, halfHeight));
        this.halfHeight = halfHeight;
        this.radius = radius;
        this.color = color;
    }

    /**
     * @return {Vec2} center of this capsule
     */
    get center() {
        return this._center.clone();
    }

    /**
     * @param {Vec2} center
     */
    set center(center) {
        this._center = center.clone();
        this.a = center.sub(new Vec2(0, this.halfHeight));
        this.b = center.add(new Vec2(0, this.halfHeight));
    }

    /**
     * draw this polygon
     * @param {CanvasRenderingContext2D} ctx
     * @param {string} [color] override color
     * @param {Vec2} [center] override center
     * @param {boolean} [drawFrame] is draw frame
     */
    draw(ctx, color, center, drawFrame) {
        const theColor = color || this.color;
        const theCenter = center || this.center;
        const a = theCenter.sub(new Vec2(0, this.halfHeight));
        const b = theCenter.add(new Vec2(0, this.halfHeight));

        ctx.beginPath();
        ctx.moveTo(a.x - this.radius, a.y);
        ctx.arcTo(a.x - this.radius, a.y - this.radius, a.x, a.y - this.radius, this.radius);
        ctx.arcTo(a.x + this.radius, a.y - this.radius, a.x + this.radius, a.y, this.radius);
        ctx.lineTo(b.x + this.radius, b.y);
        ctx.arcTo(b.x + this.radius, b.y + this.radius, b.x, b.y + this.radius, this.radius);
        ctx.arcTo(b.x - this.radius, b.y + this.radius, b.x - this.radius, b.y, this.radius);
        ctx.closePath();
        if (drawFrame == true) {
            ctx.strokeStyle = theColor;
            ctx.stroke();
        } else {
            ctx.fillStyle = theColor;
            ctx.fill();
        }
    }

    /**
     * @param {Scene} scene
     * @param {number} [tolerance]
     * @return {boolean}
     */
    overlayTest(scene, tolerance = 0.1) {
        let overlay = false;
        for (let polygon of scene.polygons) {
            polygon.eachSegment((p0, p1) => {
                if (overlay) {
                    return;
                }
                let result = Util.segmentShortestTest(this.a, this.b, p0, p1);
                overlay = result.dist < this.radius + tolerance;
            });
            if (overlay) {
                return overlay;
            }
        }
        return overlay;
    }

    /**
     * sweep test segment
     * @param {Vec2} dir sweep direction
     * @param {number} distance sweep max distance
     * @param {Vec2} p0 test segment first point
     * @param {Vec2} p1 test segment second point
     * @param {number} [tolerance] hit distance tolerance
     * @return {Util.HitResult} sweep result
     */
    sweep(dir, distance, p0, p1, tolerance = 0.1) {
        dir = dir.normalize();
        distance = Math.max(0, distance);
        let testA = this.a.clone();
        let testB = this.b.clone();
        const hitResult = new Util.HitResult();
        hitResult.distance = distance;
        hitResult.start = this.center;
        hitResult.end = this.center.add(dir.mul(distance));

        let result = Util.segmentShortestTest(testA, testB, p0, p1);
        if (result.dist < this.radius + tolerance) {
            hitResult.blockingHit = true;
            hitResult.startPenetrating = true;
            hitResult.time = 0;
            hitResult.distance = 0;
            hitResult.penetrationDepth = this.radius + tolerance - result.dist;
            hitResult.impactNormal = result.pa.sub(result.pb).normalize();
            if (hitResult.impactNormal.isZero()) {
                hitResult.impactNormal = this.center.sub(result.pb).normalize();
            }
            hitResult.location = this.center;
            return hitResult;
        }

        let lastGap = result.dist;
        let offset = 0;
        for (let i = 0; i < 5; i++) {
            offset += Math.max(0, (result.dist - this.radius) / dir.dot(result.pb.sub(result.pa).normalize()));
            offset = Math.min(distance, offset);
            testA = this.a.add(dir.mul(offset));
            testB = this.b.add(dir.mul(offset));
            result = Util.segmentShortestTest(testA, testB, p0, p1);
            if (result.dist <= this.radius + tolerance) {
                hitResult.time = offset / distance;
                hitResult.distance = offset;
                hitResult.blockingHit = true;
                hitResult.impactPoint = result.pb;
                const segmentDir = p1.sub(p0).normalize();
                hitResult.impactNormal = new Vec2(segmentDir.y, -segmentDir.x);
                hitResult.location = this.center.add(dir.mul(offset));
                hitResult.normal = hitResult.location.sub(hitResult.impactPoint).normalize();
                return hitResult;
            } else if (result.dist > lastGap) {
                break;
            }
            lastGap = result.dist;
        }

        return hitResult;
    }

    /**
     * sweep test segment
     * @param {Vec2} dir sweep direction
     * @param {number} distance sweep max distance
     * @param {Scene} scene the scene to been sweeped
     * @param {number} [tolerance] hit distance tolerance
     * @return {Util.HitResult} sweep result
     */
    sweepScene(dir, distance, scene, tolerance = 0.1) {
        let hitResult = new Util.HitResult();
        hitResult.start = this.center;
        hitResult.end = this.center.add(dir.mul(distance));
        hitResult.distance = distance;
        hitResult.time = 1;

        for (let polygon of scene.polygons) {
            polygon.eachSegment((p0, p1) => {
                const hit = this.sweep(dir, distance, p0, p1, tolerance);
                if (hit.blockingHit) {
                    if (hit.time < hitResult.time) {
                        hitResult = hit;
                    } else if (hit.time == hitResult.time) {
                        if (hit.impactNormal.dot(dir) < hitResult.impactNormal.dot(dir)) {
                            hitResult = hit;
                        }
                    }
                }
            });
        }

        return hitResult;
    }

    /**
     * sweep test segment
     * @param {Vec2} dir sweep direction
     * @param {number} distance sweep max distance
     * @param {Scene} scene the scene to been sweeped
     * @param {number} [tolerance] hit distance tolerance
     * @return {Util.HitResult[]} sweep result
     */
    sweepSceneMulti(dir, distance, scene, tolerance = 0.1) {
        const results = [];
        for (let polygon of scene.polygons) {
            polygon.eachSegment((p0, p1) => {
                const hit = this.sweep(dir, distance, p0, p1, tolerance);
                if (hit.blockingHit) {
                    results.push(hit);
                }
            })
        }
        return results;
    }
}
