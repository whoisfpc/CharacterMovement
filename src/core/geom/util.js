// @ts-check

import Vec2 from "../../algebra/vec2";
import Scene from "../scene";

/**
 * point shortest distance to segment
 * @param {Vec2} p
 * @param {Vec2} a0
 * @param {Vec2} a1
 * @return {{dist: number, point: Vec2}} result of test
 */
function distToSegment(p, a0, a1) {
    let l2 = a0.sub(a1).sqrLength();
    if (l2 == 0) {
        let dist = p.sub(a0).length();
        return {
            dist: dist,
            point: a0.clone()
        };
    }
    let A = a1.sub(a0);
    let t = p.sub(a0).dot(A) / l2;
    t = Math.max(0, Math.min(1, t));
    let point = a0.add(A.mul(t));
    let dist = p.sub(point).length();
    return {
        dist: dist,
        point: point
    };
}

/**
 * test two segment shortest distance
 * @typedef {Object} Segment
 * @property {number} dist shortest distance
 * @property {Vec2} pa shortest point at segment a
 * @property {Vec2} pb shortest point at segment b
 *
 * @param {Vec2} a0 first point of segment a
 * @param {Vec2} a1 second point of segment a
 * @param {Vec2} b0 first point of segment b
 * @param {Vec2} b1 second point of segment b
 * @return {Segment} result of test
 */
function segmentShortestTest(a0, a1, b0, b1) {
    let A = a1.sub(a0);
    let B = b1.sub(b0);

    let axb = A.cross(B);
    let bxa = B.cross(A);
    let isLineCross = false;
    let crossPoint = new Vec2(0, 0);

    if (Math.abs(axb) > 0 || Math.abs(bxa) > 0) {
        let ta = ((b0.x - a0.x) * B.y - (b0.y - a0.y) * B.x) / axb;
        let tb = ((b0.x - a0.x) * A.y - (b0.y - a0.y) * A.x) / -bxa;
        if (ta >= 0 && ta <= 1 && tb >= 0 && tb <= 1) {
            crossPoint = a0.add(A.mul(ta));
            isLineCross = true;
        }
    }

    if (isLineCross) {
        return {
            dist: 0,
            pa: crossPoint.clone(),
            pb: crossPoint.clone()
        }
    }

    let result = {
        dist: Infinity,
        pa: new Vec2(0, 0),
        pb: new Vec2(0, 0)
    };

    /** @type {{dist: number, point: Vec2}} */
    let temp;

    temp = distToSegment(a0, b0, b1);
    if (temp.dist < result.dist) {
        result.dist = temp.dist;
        result.pa = a0.clone();
        result.pb = temp.point.clone();
    }
    temp = distToSegment(a1, b0, b1);
    if (temp.dist < result.dist) {
        result.dist = temp.dist;
        result.pa = a1.clone();
        result.pb = temp.point.clone();
    }
    temp = distToSegment(b0, a0, a1);
    if (temp.dist < result.dist) {
        result.dist = temp.dist;
        result.pa = b0.clone();
        result.pb = temp.point.clone();
    }
    temp = distToSegment(b1, a0, a1);
    if (temp.dist < result.dist) {
        result.dist = temp.dist;
        result.pa = b1.clone();
        result.pb = temp.point.clone();
    }

    return result;
}

class HitResult {
    constructor() {
        this.blockingHit = false;
        this.startPenetrating = false;
        this.time = 1;
        this.start = new Vec2();
        this.end = new Vec2();
        this.distance = 0;
        this.penetrationDepth = 0;
        this.impactPoint = new Vec2();
        this.impactNormal = new Vec2();
        this.location = new Vec2();
        this.normal = new Vec2();
    }

    /**
     * Return true if there was a blocking hit that was not caused by starting in penetration.
     * @return {boolean}
     */
    isValidBlock() {
        return this.blockingHit && !this.startPenetrating;
    }
}

/**
 * shot a ray to test scene, return first hit
 * @param {Vec2} start
 * @param {Vec2} dir
 * @param {number} distance
 * @param {Scene} scene
 * @return {HitResult}
 */
function lineSweep(start, dir, distance, scene) {
    const end = start.add(dir.mul(distance));

    let hitResult = new HitResult();
    hitResult.start = start.clone();
    hitResult.end = end.clone();
    hitResult.distance = distance;
    hitResult.time = 1;
    if (distance == 0) {
        return hitResult;
    }
    for (let polygon of scene.polygons) {
        polygon.eachSegment((p0, p1) => {
            const seg = segmentShortestTest(start, end, p0, p1);
            if (seg.dist == 0) {
                const cross = seg.pa;
                const d = cross.sub(start).length();
                if (d <= hitResult.distance) {
                    hitResult.blockingHit = true;
                    hitResult.distance = d;
                    hitResult.impactPoint = cross.clone();
                    const segmentDir = p1.sub(p0).normalize();
                    hitResult.impactNormal = new Vec2(segmentDir.y, -segmentDir.x);
                    hitResult.location = cross.clone();
                    hitResult.normal = new Vec2(segmentDir.y, -segmentDir.x);
                    hitResult.time = d / distance;
                    if (dir.dot(hitResult.impactNormal) > 0) {
                        hitResult.startPenetrating = true;
                        hitResult.penetrationDepth = d;
                    }
                }
            }
        });
    }

    return hitResult;
}

/**
 * shot a ray to test scene, return hits
 * @param {Vec2} start
 * @param {Vec2} dir
 * @param {number} distance
 * @param {Scene} scene
 * @return {HitResult[]}
 */
function lineSweepMulti(start, dir, distance, scene) {
    const hits = [];
    const end = start.add(dir.mul(distance));


    if (distance == 0) {
        return hits;
    }
    for (let polygon of scene.polygons) {
        polygon.eachSegment((p0, p1) => {
            const seg = segmentShortestTest(start, end, p0, p1);
            if (seg.dist == 0) {
                let hitResult = new HitResult();
                hitResult.start = start.clone();
                hitResult.end = end.clone();

                const cross = seg.pa;
                const d = cross.sub(start).length();
                hitResult.blockingHit = true;
                hitResult.distance = d;
                hitResult.impactPoint = cross.clone();
                const segmentDir = p1.sub(p0).normalize();
                hitResult.impactNormal = new Vec2(segmentDir.y, -segmentDir.x);
                hitResult.location = cross.clone();
                hitResult.normal = new Vec2(segmentDir.y, -segmentDir.x);
                hitResult.time = d / distance;
                if (dir.dot(hitResult.impactNormal) > 0) {
                    hitResult.startPenetrating = true;
                    hitResult.penetrationDepth = d;
                }
            }
        });
    }

    return hits;
}

export {
    distToSegment,
    segmentShortestTest,
    HitResult,
    lineSweep,
    lineSweepMulti
}
