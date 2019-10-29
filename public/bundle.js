(function () {
    'use strict';

    // @ts-check

    class Vec2 {
        /**
         * @param {number} [x]
         * @param {number} [y]
         */
        constructor(x = 0, y = 0) {
            this.x = x;
            this.y = y;
        }

        /**
         * @return {boolean} is zero vector
         */
        isZero() {
            return this.x == 0 && this.y == 0;
        }

        /**
         * @param {Vec2} other
         * @return {Vec2} result of this + other
         */
        add(other) {
            return new Vec2(this.x + other.x, this.y + other.y);
        }

        /**
         * @param {Vec2} other
         * @return {number} result of this cross other
         */
        cross(other) {
            return this.x * other.y - this.y * other.x;
        }

        /**
         * @param {Vec2} other
         * @return {number} result of this dot other
         */
        dot(other) {
            return this.x * other.x + this.y * other.y;
        }

        /**
         * @param {Vec2} other
         * @return {Vec2} result of this - other
         */
        sub(other) {
            return new Vec2(this.x - other.x, this.y - other.y);
        }

        /**
         * @param {number} scale
         * @return {Vec2} result of this * scale
         */
        mul(scale) {
            return new Vec2(this.x * scale, this.y * scale);
        }

        /**
         * @param {number} scale
         * @return {Vec2} result of this / scale
         */
        div(scale) {
            return new Vec2(this.x / scale, this.y / scale);
        }

        /**
         * project this vector to plane
         * @param {Vec2} normal plane normal
         * @return {Vec2} projected vector
         */
        planeProject(normal) {
            return this.sub(normal.mul(this.dot(normal)));
        }

        /**
         * @return {number} length of this vec2
         */
        length() {
            return Math.sqrt(this.sqrLength());
        }

        /**
         * @return {number} sqr length of this vec2
         */
        sqrLength() {
            return this.x * this.x + this.y * this.y;
        }

        /**
         * @return {Vec2} normalized vec2 of this vec2
         */
        normalize() {
            const length = this.length();
            if (length == 0) {
                return this.clone();
            }
            return this.div(this.length());
        }

        /**
         * @return {Vec2} clone of this vec2
         */
        clone() {
            return new Vec2(this.x, this.y);
        }
    }

    class Polygon {

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

    // @ts-check

    // Global time manager(milliseconds)
    const Time = {
        scale: 1,
        currentTime: 0,
        currentUnscaleTime: 0,
        lastUnscaleTime: 0,
    };

    // Global key states
    const KeyStates = {};

    // Global Debug flags
    const Debug = {
        showPos: false,
        showCapsule: false,
        showDebugDraw: false
    };

    // let `Time` and `Debug` be global variable
    window["Time"] = Time;
    window["Debug"] = Debug;

    // @ts-check

    class DebugDrawable {
        /**
         * @param {CanvasRenderingContext2D} ctx
         */
        draw(ctx) {

        }
    }

    class DebugPoint extends DebugDrawable {
        /**
         * @param {Vec2} pos
         * @param {string} [color]
         * @param {number} [size]
         */
        constructor(pos, color = "#ffffff", size = 4) {
            super();
            this.pos = pos.clone();
            this.color = color;
            this.size = size;
        }

        /**
         * @param {CanvasRenderingContext2D} ctx
         */
        draw(ctx) {
            ctx.fillStyle = this.color;
            ctx.fillRect(this.pos.x - this.size * 0.5, this.pos.y - this.size * 0.5, this.size, this.size);
        }
    }

    class DebugLine extends DebugDrawable {
        /**
         * @param {Vec2} a
         * @param {Vec2} b
         * @param {string} [color]
         */
        constructor(a, b, color = "#ffffff") {
            super();
            this.a = a.clone();
            this.b = b.clone();
            this.color = color;
        }

        /**
         * @param {CanvasRenderingContext2D} ctx
         */
        draw(ctx) {
            ctx.beginPath();
            ctx.moveTo(this.a.x, this.a.y);
            ctx.lineTo(this.b.x, this.b.y);
            ctx.strokeStyle = this.color;
            ctx.stroke();
        }
    }

    class DebugArrow extends DebugDrawable {
        /**
         * @param {Vec2} a
         * @param {Vec2} b
         * @param {string} [color]
         * @param {number} [arrowSize]
         */
        constructor(a, b, color = "#ffffff", arrowSize = 10) {
            super();
            this.a = a.clone();
            this.b = b.clone();
            this.color = color;
            const lineDir = this.b.sub(this.a).normalize();
            let cos = -0.70711;
            let sin = 0.70711;
            this.arrowEnd1 = new Vec2(cos * lineDir.x - sin * lineDir.y, sin * lineDir.x + cos * lineDir.y)
                .normalize().mul(arrowSize).add(b);
            sin = -sin;
            this.arrowEnd2 = new Vec2(cos * lineDir.x - sin * lineDir.y, sin * lineDir.x + cos * lineDir.y)
                .normalize().mul(arrowSize).add(b);

        }

        /**
         * @param {CanvasRenderingContext2D} ctx
         */
        draw(ctx) {
            ctx.beginPath();
            ctx.moveTo(this.a.x, this.a.y);
            ctx.lineTo(this.b.x, this.b.y);
            ctx.lineTo(this.arrowEnd1.x, this.arrowEnd1.y);
            ctx.moveTo(this.b.x, this.b.y);
            ctx.lineTo(this.arrowEnd2.x, this.arrowEnd2.y);
            ctx.strokeStyle = this.color;
            ctx.stroke();
        }
    }

    const DurationType = {
        oneFrame: 0,
        time: 1,
    };
    Object.freeze(DurationType);

    class DebugDrawableWrapper {

        /**
         * @param {number} durationType
         * @param {number} time
         */
        constructor(durationType, time = 0) {
            this.durationType = durationType;
            this.time = time;
            /** @type {DebugDrawable} */
            this.drawable = null;
            this.hasDrawed = false;
        }

        /**
         * @param {CanvasRenderingContext2D} ctx
         */
        draw(ctx) {
            this.hasDrawed = true;
            if (this.drawable) {
                this.drawable.draw(ctx);
            }
        }
    }

    class Scene {
        /**
         * @param {number} width
         * @param {number} height
         * @param {string} [backgroundColor]
         */
        constructor(width, height, backgroundColor = "#1E88A8") {
            this.width = width;
            this.height = height;
            this.backgroundColor = backgroundColor;

            // bound polygon (inverse segment order)
            const boundPoly = new Polygon([new Vec2(), new Vec2(0, height), new Vec2(width, height), new Vec2(width, 0)], this.backgroundColor);
            this.polygons = [boundPoly];

            /** @type {DebugDrawableWrapper[]} */
            this.timeDrawables = [];
            /** @type {DebugDrawableWrapper[]} */
            this.oneFrameDrawables = [];
        }


        /**
         * @param {Polygon} polygon
         */
        addPolygon(polygon) {
            this.polygons.push(polygon);
        }

        /**
         * @param {number} dt
         */
        update(dt) {
            if (this.oneFrameDrawables.length != 0) {
                const temp = [];
                for (let wrapper of this.oneFrameDrawables) {
                    if (!wrapper.hasDrawed) {
                        temp.push(wrapper);
                    }
                }
                this.oneFrameDrawables = temp;
            }
            if (this.timeDrawables.length != 0) {
                let cutIdx = -1;
                for (let i = this.timeDrawables.length - 1; i >= 0; i--) {
                    if (this.timeDrawables[i].time > 0) {
                        cutIdx = i;
                        break;
                    }
                }
                this.timeDrawables.length = cutIdx + 1;
                for (let wrapper of this.timeDrawables) {
                    wrapper.time -= dt;
                }
            }
            if (!Debug.showDebugDraw) {
                if (this.oneFrameDrawables.length != 0) {
                    this.oneFrameDrawables.length = 0;
                }
                if (this.timeDrawables.length != 0) {
                    this.timeDrawables.length = 0;
                }
            }
        }

        /**
         * draw scene
         * @param {CanvasRenderingContext2D} ctx
         */
        draw(ctx) {
            for (let polygon of this.polygons) {
                polygon.draw(ctx);
            }
        }

        /**
         * draw debug
         * @param {CanvasRenderingContext2D} ctx
         */
        drawDebug(ctx) {
            for (let wrapper of this.timeDrawables) {
                wrapper.draw(ctx);
            }
            for (let wrapper of this.oneFrameDrawables) {
                wrapper.draw(ctx);
            }
        }

        /**
         * insert wrapper by time sort(large to small)
         * @param {DebugDrawableWrapper} wrapper
         */
        insertToTimeDrawables(wrapper) {
            let insertIdx = 0;
            for (let i = this.timeDrawables.length - 1; i >=0; i--) {
                if (this.timeDrawables[i].time >= wrapper.time) {
                    insertIdx = i;
                    break;
                }
            }
            this.timeDrawables.splice(insertIdx, 0, wrapper);
        }

        /**
         * @param {DebugDrawableWrapper} wrapper
         */
        addDebugDrawableWrapper(wrapper) {
            if (!Debug.showDebugDraw) {
                return;
            }
            if (wrapper.durationType == DurationType.oneFrame) {
                this.oneFrameDrawables.push(wrapper);
            } else {
                this.insertToTimeDrawables(wrapper);
            }
        }

        /**
         * @param {number} durationType
         * @param {Vec2} pos
         * @param {number} [time]
         * @param {string} [color]
         * @param {number} [size]
         */
        debugDrawPoint(durationType, pos, time, color, size) {
            const wrapper = new DebugDrawableWrapper(durationType, time);
            wrapper.drawable = new DebugPoint(pos, color, size);
            this.addDebugDrawableWrapper(wrapper);
        }

        /**
         * @param {number} durationType
         * @param {Vec2} a
         * @param {Vec2} b
         * @param {number} [time]
         * @param {string} [color]
         */
        debugDrawLine(durationType, a, b, time, color) {
            const wrapper = new DebugDrawableWrapper(durationType, time);
            wrapper.drawable = new DebugLine(a, b, color);
            this.addDebugDrawableWrapper(wrapper);
        }

        /**
         * @param {number} durationType
         * @param {Vec2} a
         * @param {Vec2} b
         * @param {number} [time]
         * @param {string} [color]
         * @param {number} [arrowSize]
         */
        debugDrawArrow(durationType, a, b, time, color, arrowSize) {
            const wrapper = new DebugDrawableWrapper(durationType, time);
            wrapper.drawable = new DebugArrow(a, b, color, arrowSize);
            this.addDebugDrawableWrapper(wrapper);
        }
    }

    // @ts-check

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

    // @ts-check

    class Capsule {
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
                    let result = segmentShortestTest(this.a, this.b, p0, p1);
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
            const hitResult = new HitResult();
            hitResult.distance = distance;
            hitResult.start = this.center;
            hitResult.end = this.center.add(dir.mul(distance));

            let result = segmentShortestTest(testA, testB, p0, p1);
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
                result = segmentShortestTest(testA, testB, p0, p1);
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
            let hitResult = new HitResult();
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
                });
            }
            return results;
        }
    }

    // @ts-check

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

    class AnimeClip {
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
                this.images.push(image);
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
            ctx.save();
            // to get sharp pixel
            ctx.imageSmoothingEnabled = false;
            const w = image.width * scale;
            const h = image.height * scale;
            const p = frame.pivot.mul(scale);
            ctx.translate(pos.x, pos.y);
            if (flip) {
                ctx.scale(-1, 1);
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

    // @ts-check

    class Animator {
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

    // @ts-check

    const Role = {
        simulate: 0,
        authority: 1,
        autonomous: 2,
    };
    Object.freeze(Role);

    const MoveMode = {
        none: 0,
        walking: 1,
        falling: 2,
    };
    Object.freeze(MoveMode);
    const MOVE_AVOID_DIST = 0.5;
    const MAX_FLOOR_DIST = 2.4;
    const MIN_FLOOR_DIST = 1.9;
    const SWEEP_EDGE_REJECT_DISTANCE = 0.15;
    const KINDA_SMALL_NUMBER = 1e-4;
    const MAX_STEP_SIDE_Z = 0.08;

    class FloorResult {
        constructor() {
            this.blockingHit = false;
            this.walkableFloor = false;
            this.lineTrace = false;
            this.floorDist = 0;
            this.lineDist = 0;
            /** @type {HitResult} */
            this.hitResult = new HitResult();
        }

        /**
         * @param {HitResult} hitResult
         * @param {number} sweepFloorDist
         * @param {boolean} isWalkableFloor
         */
        setFromSweep(hitResult, sweepFloorDist, isWalkableFloor) {
            this.blockingHit = hitResult.isValidBlock();
            this.walkableFloor = isWalkableFloor;
            this.lineTrace = false;
            this.floorDist = sweepFloorDist;
            this.lineDist = 0;
            this.hitResult = hitResult;
        }

        /**
         * @param {HitResult} hitResult
         * @param {number} sweepFloorDist
         * @param {number} lineDist
         * @param {boolean} isWalkableFloor
         */
        setFromLineTrace(hitResult, sweepFloorDist, lineDist, isWalkableFloor) {
            if (this.hitResult.blockingHit && hitResult.blockingHit) {
                const oldHit = this.hitResult;
                this.hitResult = hitResult;
                this.hitResult.time = oldHit.time;
                this.hitResult.impactPoint = oldHit.impactPoint;
                this.hitResult.location = oldHit.location;
                this.hitResult.start = oldHit.start;
                this.hitResult.end = oldHit.end;

                this.lineTrace = true;
                this.floorDist = sweepFloorDist;
                this.lineDist = lineDist;
                this.walkableFloor = isWalkableFloor;
            }
        }

        /**
         * @return {boolean}
         */
        isWalkableFloor() {
            return this.blockingHit && this.walkableFloor;
        }
    }

    /**
     * @typedef {Object} PlayerInfo
     * @property {number} id - player id
     * @property {string} color - player color
     * @property {Vec2} pos - player position
     * @property {Animator} animator - animator of player
     * @property {boolean} flipAnime
     *
     * @typedef {Object} MoveMsg
     * @property {number} id
     * @property {number} sequence
     * @property {number} timestamp
     * @property {number} dt
     * @property {Vec2} pos
     * @property {Vec2} velocity
     * @property {number} moveMode
     * @property {Vec2} acceleration
     * @property {boolean} pressedJump
     */

    class Player {
        /**
         * @param {Vec2} pos
         * @param {string} color
         * @param {number} id
         * @param {boolean} [flipAnime]
         */
        constructor(pos, color, id, flipAnime = false) {
            this.displayPos = pos.clone();
            this.color = color;
            this.id = id;
            this.maxAcceleration = 800;
            this.maxSpeed = 300;
            this.capsule = new Capsule(pos, 15, 12, color);

            this.isMainPlayer = false;
            this.role = Role.authority;
            this.isNetMode = false;

            this.timestamp = 0;
            /** @type {any[]} */
            this.positionBuffer = [];
            this.hasUpdate = false;
            this.corrected = false; // server correct client pos and velocity
            /** @type {Scene}*/
            this.scene = null;
            /** @type {Vec2} */
            this.velocity = new Vec2(0, 0);
            this.acceleration = new Vec2(0, 0);
            this.visualSmooth = false;
            /**@type {Animator} */
            this.animator = null;
            this.flipAnime = flipAnime;
            this.lastMoveMode = MoveMode.none;
            this.jumpRemainTimer = 0;

            this.movementInfo = {
                input: new Vec2(),
                currentModeMode: 2,
                currentFloor: new FloorResult(),
                justTeleported: false,
                pressedJump: false,
                jumpHoldTime: 0,
            };

            this.movementConfig  = {
                walkableFloorRadian: Math.PI * 50 / 180,
                maxStepHeight: 20,
                horizontalMove: true,
                jumpVelocity: 300,
                holdJumpGravityScale: 0.3,
                airControl: 0.2,
                maxJumpHoldTime: 1,
            };

            this.sequence = 1;
            this.lastReceiveSequence = 0;
            this.lastReceiveTimestamp = 0;
            /**@type {MoveMsg} */
            this.pendingMoveMsg = null;
            /**@type {MoveMsg[]} */
            this.historyMoveMsgs = [];
            this.needReconciliation = false;
        }

        /**
         * @return {Vec2} position of this player
         */
        get pos() {
            return this.capsule.center.clone();
        }

        /**
         * @param {Vec2} pos
         */
        set pos(pos) {
            this.capsule.center = pos.clone();
            if (!this.visualSmooth) {
                this.displayPos.x = this.pos.x;
                this.displayPos.y = this.pos.y;
            }
        }

        /**
         * @return {PlayerInfo}
         */
        getPlayerInfo() {
            return {
                id: this.id,
                color: this.color,
                pos: this.pos,
                animator: this.animator.clone(),
                flipAnime: this.flipAnime,
            };
        }

        /**
         * @param {Vec2} delta
         * @return {HitResult}
         */
        move(delta) {
            let hit = this.safeMove(delta);
            if (hit.startPenetrating) {
                const pullbackDist = 0.125 + (hit.penetrationDepth > 0 ? hit.penetrationDepth : 0.125);
                const adjustment = hit.impactNormal.mul(pullbackDist);
                if (this.resolvePenetration(adjustment, hit)) {
                    hit = this.safeMove(delta);
                }
            }
            return hit;
        }

        /**
         * warning! used by move, do not direct call this
         * @param {Vec2} delta
         * @return {HitResult}
         */
        safeMove(delta) {
            let result = new HitResult();
            result.start = this.pos;
            result.end = this.pos.add(delta);

            const dir = delta.normalize();
            const length = delta.length();
            const hitResults = this.capsule.sweepSceneMulti(dir, length, this.scene);
            let noStartPenetration = true;
            let init = true;
            let maxPenetrationDepth = 0;
            for (let hitResult of hitResults) {
                if (hitResult.blockingHit) {
                    if (hitResult.time == 0) {
                        if (hitResult.penetrationDepth > maxPenetrationDepth) {
                            maxPenetrationDepth = hitResult.penetrationDepth;
                            noStartPenetration = false;
                            result = hitResult;
                        }
                    } else if (noStartPenetration) {
                        if (init || hitResult.time < result.time) {
                            result = hitResult;
                            init = false;
                        } else if (hitResult.time == result.time) {
                            if (hitResult.impactNormal.dot(dir) < result.impactNormal.dot(dir)) {
                                result = hitResult;
                            }
                        }
                    }
                }
            }

            if (!result.blockingHit) {
                this.pos = result.end;
            } else {
                const realMoveDist = Math.max(0, result.distance - MOVE_AVOID_DIST);
                this.pos = result.start.add(dir.mul(realMoveDist));
                result.time = Math.max(0, realMoveDist / result.end.sub(result.start).length());
            }
            return result;
        }

        /**
         * @param {Vec2} adjustment
         * @param {HitResult} hit
         * @return {boolean}
         */
        resolvePenetration(adjustment, hit) {
            const testCapsule = new Capsule(hit.start.add(adjustment), this.capsule.halfHeight, this.capsule.radius);
            if (!testCapsule.overlayTest(this.scene)) {
                this.pos = hit.start.add(adjustment);
                return true;
            } else {
                let hit = this.safeMove(adjustment);
                if (hit.startPenetrating) {
                    const pullbackDist = 0.125 + (hit.penetrationDepth > 0 ? hit.penetrationDepth : 0.125);
                    const secondMTD = hit.impactNormal.mul(pullbackDist);
                    hit = this.safeMove(secondMTD.add(adjustment));
                    if (hit.startPenetrating) {
                        hit = this.safeMove(adjustment.add(hit.end.sub(hit.start)));
                        return !hit.startPenetrating;
                    } else {
                        return true;
                    }
                } else {
                    return true;
                }
            }
        }

        /**
         * @param {Vec2} acceleration
         */
        setAcceleration(acceleration) {
            this.acceleration.x = acceleration.x;
            this.acceleration.y = acceleration.y;
        }

        /**
         * @param {Vec2} velocity
         */
        setVelocity(velocity) {
            this.velocity.x = velocity.x;
            this.velocity.y = velocity.y;
        }

        clearAcceleration() {
            this.acceleration.x = 0;
            this.acceleration.y = 0;
        }

        /**
         * @param {number} dt
         */
        update(dt) {
            this.timestamp += dt;
            if (this.isMainPlayer) {
                if (this.needReconciliation) {
                    this.reconciliation();
                }
                const input = this.consumeMovement();
                this.acceleration = input.mul(this.maxAcceleration);
                this.performMovement(dt);
                if (this.isNetMode) {
                    this.updateMoveMsg(dt);
                }
            }
            else if (this.role == Role.authority) {
                this.updateMoveMsg();
            }
            else if (this.role == Role.simulate) {
                this.simulateMove(dt);
            }

            if (Debug.showDebugDraw) {
                if (this.movementInfo.currentFloor.isWalkableFloor()) {
                    const hitResult = this.movementInfo.currentFloor.hitResult;
                    this.scene.debugDrawArrow(DurationType.oneFrame,
                        hitResult.impactPoint, hitResult.impactPoint.add(hitResult.impactNormal.mul(50)), 0, "#c00000");
                }
            }
        }

        /**
         * @param {number} min
         * @param {number} max
         * @param {number} value
         * @return {number} clamped value between min and max
         */
        clamp(min, max, value) {
            return Math.min(max, Math.max(value, min));
        }

        /**
         * @return {Player} clone this player, but only poisiton, color and id properties
         */
        clone() {
            return new Player(this.pos.clone(), this.color, this.id);
        }

        /**
         * draw this polygon
         * @param {CanvasRenderingContext2D} ctx
         * @param {number} dt
         */
        draw(ctx, dt) {
            if (Debug.showCapsule) {
                if (!this.visualSmooth) {
                    this.capsule.draw(ctx);
                } else {
                    this.capsule.draw(ctx, null, this.displayPos);
                }
            }
            if (this.animator) {
                let key = "";
                switch (this.movementInfo.currentModeMode) {
                    case MoveMode.walking:
                        if (this.velocity.x == 0) {
                            key = "idle";
                        } else {
                            key = "walking";
                        }
                        break;
                    case MoveMode.falling:
                        if (this.lastMoveMode == MoveMode.walking) {
                            key = "jump";
                            this.jumpRemainTimer = 0.18;// jump anime clip total duration
                            this.jumpRemainTimer -= dt;
                        } else if (this.jumpRemainTimer > 0) {
                            this.jumpRemainTimer -= dt;
                            key = "jump";
                        } else {
                            key = "falling";
                        }
                        break;
                    default:
                        break;
                }
                this.lastMoveMode = this.movementInfo.currentModeMode;
                if (this.velocity.x > 0) {
                    this.flipAnime = false;
                } else if (this.velocity.x < 0) {
                    this.flipAnime = true;
                }
                this.animator.setAnimeKey(key);
                this.animator.draw(ctx, dt, this.pos, this.flipAnime, 2);
            }
            if (Debug.showPos) {
                this.capsule.draw(ctx, "#C00000", null, true);
            }
        }

        /**
         * add movement
         * @param {Vec2} input
         */
        addMovement(input) {
            this.movementInfo.input = this.movementInfo.input.add(input);
        }

        /**
         * @return {Vec2} input
         */
        consumeMovement() {
            const input = this.movementInfo.input;
            this.movementInfo.input = new Vec2();
            return input;
        }

        jump() {
            // TODO: deal with double jump
            if (this.movementInfo.currentModeMode != MoveMode.falling) {
                this.movementInfo.pressedJump = true;
            }
        }

        stopJumping() {
            this.movementInfo.pressedJump = false;
        }

        checkJump() {
            if (this.movementInfo.currentModeMode == MoveMode.walking) {
                if (this.movementInfo.pressedJump == true) {
                    this.velocity.y = Math.min(this.velocity.y, -this.movementConfig.jumpVelocity);
                    this.movementInfo.jumpHoldTime = 0;
                    this.setMoveMode(MoveMode.falling);
                }
            }
        }

        /**
         * @param {number} dt
         */
        clearJump(dt) {
            if (this.movementInfo.pressedJump) {
                this.movementInfo.jumpHoldTime += dt;
                if (this.movementInfo.jumpHoldTime >= this.movementConfig.maxJumpHoldTime) {
                    this.movementInfo.pressedJump = false;
                }
            }
        }

        /**
         * @param {number} dt delta time
         */
        performMovement(dt) {
            this.checkJump();
            this.clearJump(dt);
            this.startNewPhysics(dt);
        }

        /**
         * @param {number} dt delta time
         */
        startNewPhysics(dt) {
            switch (this.movementInfo.currentModeMode) {
                case MoveMode.falling:
                    this.physFalling(dt);
                    break;
                case MoveMode.walking:
                    this.physWalking(dt);
                    break;
                default:
                    this.velocity = new Vec2();
                    break;
            }
        }


        /**
         * set new move mode
         * @param {number} moveMode
         */
        setMoveMode(moveMode) {
            if (moveMode != this.movementInfo.currentModeMode) {
                this.movementInfo.currentModeMode = moveMode;
                this.onMoveModeChange();
            }
        }

        /**
         * called when movemode change
         */
        onMoveModeChange() {
            if (this.movementInfo.currentModeMode == MoveMode.walking) {
                this.movementInfo.currentFloor = this.findFloor(this.capsule.center, null);
                this.adjustFloorHeight();
            }
        }

        /**
         * Test if hit location is walkable
         * @param {HitResult} hit
         * @return {boolean}
         */
        isWalkable(hit) {
            if (!hit.isValidBlock()) {
                return false;
            }
            if (-hit.impactNormal.y < KINDA_SMALL_NUMBER) {
                return false;
            }
            return -hit.impactNormal.y >= Math.cos(this.movementConfig.walkableFloorRadian);
        }

        /**
         *
         * @param {Vec2} capsuleCenter
         * @param {Vec2} impactPoint
         * @param {number} radius
         * @return {boolean}
         */
        isWithinEdgeTolerance(capsuleCenter, impactPoint, radius) {
            if (Math.abs(impactPoint.x - capsuleCenter.x) > Math.max(SWEEP_EDGE_REJECT_DISTANCE, radius - SWEEP_EDGE_REJECT_DISTANCE)) {
                return false;
            }
            return true;
        }

        /**
         * perform falling movement
         * @param {number} dt delta time
         */
        physFalling(dt) {
            /**
             * Test if hit location is a valid landing spot
             * @param {Vec2} capsuleCenter
             * @param {HitResult} hit
             * @return {boolean}
             */
            const isValidLandingSpot = (capsuleCenter, hit) => {
                if (!hit.blockingHit) {
                    return false;
                }
                if (!hit.startPenetrating) {
                    if (!this.isWalkable(hit)) {
                        return false;
                    }
                    if (hit.impactPoint.y <= capsuleCenter.y + this.capsule.radius) {
                        return false;
                    }
                    if (!this.isWithinEdgeTolerance(hit.location, hit.impactPoint, this.capsule.radius)) {
                        return false;
                    }
                } else {
                    if (-hit.normal.y < KINDA_SMALL_NUMBER) {
                        return false;
                    }
                }
                // TODO: FindFlooor
                const floorResult = this.findFloor(capsuleCenter, hit);
                if (floorResult.isWalkableFloor()) {
                    return true;
                }
                return false;
            };

            /**
             * compute slide vector
             * @param {Vec2} delta
             * @param {number} time
             * @param {Vec2} normal
             * @return {Vec2} slide vector
             */
            const computeSlideVector = (delta, time, normal) => {
                let result = delta.planeProject(normal).mul(time);
                if (result.y < 0) {
                    const slideResult = result.clone();
                    const yLimit = delta.y * time;
                    if (result.y - yLimit < -KINDA_SMALL_NUMBER) {
                        if (yLimit < 0) {
                            result = result.mul(yLimit / result.y);
                        } else {
                            result = new Vec2();
                        }

                        const remainderX = new Vec2(slideResult.sub(result).x, 0);
                        const normalX = new Vec2(Math.sign(normal.x), 0);
                        const adjust = remainderX.planeProject(normalX);
                        result = result.add(adjust);
                    }
                }
                return result;
            };

            const fallAcceleration = this.acceleration.clone();
            fallAcceleration.y = 0;
            fallAcceleration.x *= this.movementConfig.airControl;
            const gravity = new Vec2(0, 980);
            if (this.movementInfo.pressedJump) {
                gravity.y *= this.movementConfig.holdJumpGravityScale;
            }
            const oldVelocity = this.velocity.clone();
            this.velocity = this.velocity.add(gravity.add(fallAcceleration).mul(dt));
            let adjusted = oldVelocity.add(this.velocity).mul(0.5 * dt);
            let hit = this.move(adjusted);
            if (hit.blockingHit) {
                let remainTime = dt * (1 - hit.time);
                if (isValidLandingSpot(this.capsule.center, hit)) {
                    this.setMoveMode(MoveMode.walking);
                    this.startNewPhysics(remainTime);
                    return;
                } else {
                    adjusted = this.velocity.mul(dt);
                    // TODO: additional valid landing check
                    const oldHitNormal = hit.normal.clone();
                    const oldHitImpackNormal = hit.impactNormal.clone();
                    let slideDelta = computeSlideVector(adjusted, 1 - hit.time, oldHitImpackNormal);
                    this.velocity = slideDelta.div(remainTime);
                    if (remainTime > 0.0001 && slideDelta.dot(adjusted) > 0) {
                        hit = this.move(slideDelta);
                        if (hit.blockingHit) {
                            remainTime = remainTime * (1 - hit.time);
                            if (isValidLandingSpot(this.capsule.center, hit)) {
                                this.setMoveMode(MoveMode.walking);
                                this.startNewPhysics(remainTime);
                                return;
                            }
                            // TODO: TwoWallAdjust
                        }
                    }
                }
            }
        }

        /**
         * @param {Vec2} capsuleCenter
         * @param {HitResult} downSweepResult
         * @return {FloorResult}
         */
        findFloor(capsuleCenter, downSweepResult) {
            const floorResult = this.computeFloorDist(capsuleCenter, downSweepResult);
            if (floorResult && floorResult.blockingHit && !floorResult.lineTrace) {
                if (!this.isWithinEdgeTolerance(capsuleCenter, floorResult.hitResult.impactPoint, this.capsule.radius)) {
                    floorResult.walkableFloor = false;
                }
                if (floorResult.floorDist < 0) {
                    floorResult.walkableFloor = false;
                }
            }
            return floorResult;
        }

        /**
         * @param {Vec2} capsuleCenter
         * @param {HitResult} downSweepResult
         * @return {FloorResult}
         */
        computeFloorDist(capsuleCenter, downSweepResult) {
            const heightCheckAdjust = this.movementInfo.currentModeMode == MoveMode.walking ? -MAX_FLOOR_DIST - KINDA_SMALL_NUMBER : MAX_FLOOR_DIST;
            const sweepRadius = this.capsule.radius;
            const capsuleRadius = sweepRadius;
            const sweepTraceDist = Math.max(MAX_FLOOR_DIST, this.movementConfig.maxStepHeight + heightCheckAdjust);
            const lineTraceDist = sweepTraceDist;
            const floorResult = new FloorResult();

            let skipSweep = false;
            // compute floor dist
            if (downSweepResult && downSweepResult.isValidBlock()) {
                if (downSweepResult.start.y < downSweepResult.end.y && downSweepResult.distance > 0) {
                    if (this.isWithinEdgeTolerance(downSweepResult.location, downSweepResult.impactPoint, this.capsule.radius)) {
                        skipSweep = true;
                        const isWalkable = this.isWalkable(downSweepResult);
                        const floorDist = downSweepResult.location.y - capsuleCenter.y;
                        floorResult.setFromSweep(downSweepResult, floorDist, isWalkable);
                        if (isWalkable) {
                            return floorResult;
                        }
                    }
                }
            }

            if (!skipSweep && sweepTraceDist > 0 && sweepRadius > 0) {
                const shrinkScale = 0.9;
                const shrinkScaleOverlap = 0.1;
                let shrinkHeight = this.capsule.halfHeight * (1 - shrinkScale);
                let traceDist = sweepTraceDist + shrinkHeight;
                const sweepCapsule = new Capsule(capsuleCenter, this.capsule.halfHeight - shrinkHeight, capsuleRadius);
                let hit = sweepCapsule.sweepScene(new Vec2(0, 1), traceDist, this.scene);
                if (hit.blockingHit) {
                    if (hit.startPenetrating || !this.isWithinEdgeTolerance(capsuleCenter, hit.impactPoint, capsuleRadius)) {
                        sweepCapsule.radius = Math.max(0, capsuleRadius - SWEEP_EDGE_REJECT_DISTANCE - KINDA_SMALL_NUMBER);
                        if (sweepCapsule.radius > KINDA_SMALL_NUMBER) {
                            shrinkHeight = this.capsule.halfHeight * (1 - shrinkScaleOverlap);
                            traceDist = sweepTraceDist + shrinkHeight;
                            sweepCapsule.halfHeight = Math.max(0, this.capsule.halfHeight - shrinkHeight);
                            hit = sweepCapsule.sweepScene(new Vec2(0, 1), traceDist, this.scene);
                        }
                    }

                    const maxPenetrationAdjust = Math.max(MAX_FLOOR_DIST, capsuleRadius);
                    const sweepResultDist = Math.max(-maxPenetrationAdjust, hit.time * traceDist - shrinkHeight);
                    floorResult.setFromSweep(hit, sweepResultDist, false);
                    if (hit.isValidBlock() && this.isWalkable(hit)) {
                        floorResult.walkableFloor = true;
                        return floorResult;
                    }
                }
            }

            if (!floorResult.blockingHit && !floorResult.hitResult.startPenetrating) {
                floorResult.floorDist = sweepTraceDist;
                return floorResult;
            }

            if (lineTraceDist > 0) {
                const shrinkHeight = this.capsule.halfHeight + capsuleRadius;
                const lineStart = capsuleCenter.clone();
                const traceDist = lineTraceDist + shrinkHeight;
                const hit = lineSweep(lineStart, new Vec2(0, 1), traceDist, this.scene);
                if (hit.blockingHit && hit.time > 0) {
                    const maxPenetrationAdjust = Math.max(MAX_FLOOR_DIST, capsuleRadius);
                    const lineResultDist = Math.max(-maxPenetrationAdjust, hit.time * traceDist - shrinkHeight);
                    floorResult.blockingHit = true;
                    if (lineResultDist <= lineTraceDist && this.isWalkable(hit)) {
                        floorResult.setFromLineTrace(hit, floorResult.floorDist, lineResultDist, true);
                        return floorResult;
                    }
                }

            }

            floorResult.walkableFloor = false;
            floorResult.floorDist = sweepTraceDist;
            return floorResult;
        }

        /**
         * @param {Vec2} velocity
         * @param {number} dt
         * @return {FloorResult}
         */
        moveAlongFloor(velocity, dt) {
            /**
             * compute ground delta
             * @param {Vec2} delta
             * @param {HitResult} hit
             * @param {boolean} isLineTrace
             */
            const computeGroundMoveDelta = (delta, hit, isLineTrace) => {
                const floorNormal = hit.impactNormal;
                const contactNormal = hit.normal;
                if (-floorNormal.y < 1 - KINDA_SMALL_NUMBER && -floorNormal.y > KINDA_SMALL_NUMBER &&
                    -contactNormal.y > KINDA_SMALL_NUMBER && !isLineTrace && this.isWalkable(hit)) {
                    const floorDotDelta = floorNormal.dot(delta);
                    const rampDelta = new Vec2(delta.x, -floorDotDelta / floorNormal.y);
                    if (this.movementConfig.horizontalMove) {
                        return rampDelta;
                    } else {
                        return rampDelta.normalize().mul(delta.length());
                    }
                }
                return delta.clone();
            };

            if (!this.movementInfo.currentFloor.isWalkableFloor()) {
                return null;
            }
            const currentFloor = this.movementInfo.currentFloor;
            const delta = new Vec2(velocity.x, 0).mul(dt);
            let rampVector = computeGroundMoveDelta(delta, currentFloor.hitResult, currentFloor.lineTrace);
            let hit = this.move(rampVector);
            if (hit.startPenetrating) {
                console.warn("fuck! i dont know how to deal with it!");
            } else if (hit.isValidBlock()) {
                let percentTimeApplied = hit.time;
                // another ramp
                if (hit.time > 0 && -hit.normal.y > KINDA_SMALL_NUMBER && this.isWalkable(hit)) {
                    const initPercentRemain = 1 - percentTimeApplied;
                    rampVector = computeGroundMoveDelta(delta.mul(initPercentRemain), hit, false);
                    hit = this.move(rampVector);
                    const secondPercent = hit.time * initPercentRemain;
                    percentTimeApplied = Math.max(0, Math.min(1, percentTimeApplied + secondPercent));
                }
                // block by stairs
                if (hit.isValidBlock()) {
                    let floorResult = this.stepUp(delta.mul(1 - percentTimeApplied), hit);
                    if (floorResult != null) {
                        this.movementInfo.justTeleported = this.movementInfo.justTeleported
                            || !this.movementConfig.horizontalMove;
                        return floorResult;
                    }
                }
            }
            return null;
        }

        /**
         * try step up a stairs
         * @param {Vec2} delta
         * @param {HitResult} hit
         * @return {FloorResult}
         */
        stepUp(delta, hit) {
            const capsuleRadius = this.capsule.radius;
            const capsuleHalfHeight = this.capsule.halfHeight;
            const oldLocation = this.pos;
            const initImpactY = hit.impactPoint.y;
            // skip if top hemisphere hit
            if (initImpactY < oldLocation.y - capsuleHalfHeight) {
                return null;
            }
            const gravityDir = new Vec2(0, 1);
            let stepTravelUpHeight = this.movementConfig.maxStepHeight;
            let stepTravelDownHeight = stepTravelUpHeight;
            const stepSideY = -1 * hit.impactNormal.dot(gravityDir);
            let capsuleInitFloorBaseY = oldLocation.y + capsuleHalfHeight + capsuleRadius;
            let capsuleFloorPointY = capsuleInitFloorBaseY;
            const currentFloor = this.movementInfo.currentFloor;
            if (currentFloor.isWalkableFloor()) {
                const floorDist = Math.max(0, currentFloor.lineTrace ? currentFloor.lineDist : currentFloor.floorDist);
                capsuleInitFloorBaseY += floorDist;
                stepTravelUpHeight = Math.max(stepTravelUpHeight - floorDist, 0);
                stepTravelDownHeight = this.movementConfig.maxStepHeight + MAX_FLOOR_DIST * 2;
                const hitVerticalFace = !this.isWithinEdgeTolerance(hit.location, hit.impactPoint, capsuleRadius);
                if (!currentFloor.lineTrace && !hitVerticalFace) {
                    capsuleFloorPointY = currentFloor.hitResult.impactPoint.y;
                } else {
                    capsuleFloorPointY += currentFloor.floorDist;
                }
            }

            if (initImpactY >=capsuleInitFloorBaseY) {
                return null;
            }
            // try step up
            const savedPos = this.pos.clone();
            const sweepUpHit = this.move(gravityDir.mul(-stepTravelUpHeight));
            if (sweepUpHit.startPenetrating) {
                this.pos = savedPos;
                return null;
            }
            // try step forward
            const sweepForwardHit = this.move(delta.add(new Vec2(MOVE_AVOID_DIST * 4 * Math.sign(delta.x), 0)));
            if (sweepForwardHit.blockingHit) {
                if (sweepForwardHit.startPenetrating || sweepForwardHit.time == 0 || Math.abs(this.pos.x - savedPos.x) < Math.abs(delta.x)) {
                    this.pos = savedPos;
                    return null;
                }
                // TODO: slide along surface
            }
            // try step down
            const sweepDownHit = this.move(gravityDir.mul(stepTravelDownHeight));
            if (sweepDownHit.startPenetrating) {
                this.pos = savedPos;
                return null;
            }
            if (sweepDownHit.isValidBlock()) {
                const deltaY = sweepDownHit.impactPoint.y - capsuleFloorPointY;
                if (-deltaY > this.movementConfig.maxStepHeight) {
                    this.pos = savedPos;
                    return null;
                }
                if (!this.isWalkable(sweepDownHit)) {
                    // if (sweepDownHit.impactNormal.dot(delta) < 0) {
                    //     this.pos = savedPos;
                    //     return null;
                    // }
                    if (sweepDownHit.location.y > oldLocation.y) {
                        this.pos = savedPos;
                        return null;
                    }
                }
                if (!this.isWithinEdgeTolerance(sweepDownHit.location, sweepDownHit.impactPoint, capsuleRadius)) {
                    this.pos = savedPos;
                    return null;
                }
                const floorResult = this.findFloor(this.pos, sweepDownHit);
                if (sweepDownHit.location.y < oldLocation.y) {
                    if (!floorResult.blockingHit && stepSideY < MAX_STEP_SIDE_Z) {
                        this.pos = savedPos;
                        return null;
                    }
                }
                this.movementInfo.justTeleported = this.movementInfo.justTeleported
                    || !this.movementConfig.horizontalMove;
                return floorResult;
            }
            return null;
        }

        /**
         * perform walking movement
         * @param {number} dt delta time
         */
        physWalking(dt) {

            /**
             * @param {number} dt
             * @return {Vec2}
             */
            const calcVelocity = (dt) => {
                if (this.acceleration.x == 0) {
                    return new Vec2(0, this.velocity.y);
                }
                const result = new Vec2(dt * this.acceleration.x + this.velocity.x, this.velocity.y);
                if (Math.abs(result.x) > this.maxSpeed) {
                    result.x = Math.sign(result.x) * this.maxSpeed;
                }
                return result;
            };

            this.movementInfo.justTeleported = false;
            const oldLocation = this.pos.clone();
            this.maintainHorizontalVelocity();
            const oldVelocity = this.velocity.clone();
            this.acceleration.y = 0;
            this.velocity = calcVelocity(dt);
            const moveVelocity = this.velocity.clone();
            const delta = moveVelocity.mul(dt);
            if (delta.isZero()) {
                return;
            }
            let floorResult = this.moveAlongFloor(moveVelocity, dt);
            if (this.movementInfo.currentModeMode == MoveMode.falling) {
                const actualDist = Math.abs(this.pos.sub(oldLocation).x);
                const desiredDist = Math.abs(delta.x);
                this.startNewPhysics(dt * (1 - Math.min(1, actualDist / desiredDist)));
                return;
            }
            if (floorResult) {
                this.movementInfo.currentFloor = floorResult;
            } else {
                this.movementInfo.currentFloor = this.findFloor(this.capsule.center, null);
            }

            if (this.movementInfo.currentFloor.isWalkableFloor()) {
                this.adjustFloorHeight();
            } else if (this.movementInfo.currentFloor.hitResult.startPenetrating) {
                console.warn("shit! i dont know how to deal with penetrating");
            } else {
                this.setMoveMode(MoveMode.falling);
            }
            if (!this.movementInfo.justTeleported) {
                this.velocity = this.pos.sub(oldLocation).div(dt);
            }
            if (this.movementInfo.currentModeMode == MoveMode.falling) {
                this.pos = this.pos.add(this.velocity.normalize().mul(0.15));
            }
            this.maintainHorizontalVelocity();
        }

        /**
         * maintain horizontal velocity according to movement config `horizontalMove`
         */
        maintainHorizontalVelocity() {
            if (this.velocity.y != 0) {
                if (this.movementConfig.horizontalMove) {
                    this.velocity.y = 0;
                } else {
                    this.velocity.x = this.velocity.length();
                    this.velocity.y = 0;
                }
            }
        }

        adjustFloorHeight() {
            let oldFloorDist = this.movementInfo.currentFloor.floorDist;
            if (this.movementInfo.currentFloor.lineTrace) {
                oldFloorDist = this.movementInfo.currentFloor.lineDist;
            }
            if (oldFloorDist < MIN_FLOOR_DIST || oldFloorDist > MAX_FLOOR_DIST) {
                const initY = this.pos.y;
                const avgFloorDist = (MIN_FLOOR_DIST + MAX_FLOOR_DIST) * 0.5;
                const moveDist = -(avgFloorDist - oldFloorDist);
                const hit = this.move(new Vec2(0, moveDist));
                if (!hit.isValidBlock()) {
                    this.movementInfo.currentFloor.floorDist += moveDist;
                } else if (moveDist < 0) {
                    const currentY = this.pos.y;
                    this.movementInfo.currentFloor.floorDist += currentY - initY;
                } else {
                    const currentY = this.pos.y;
                    this.movementInfo.currentFloor.floorDist = currentY - hit.location.y;
                    if (this.isWalkable(hit)) {
                        this.movementInfo.currentFloor.setFromSweep(hit, this.movementInfo.currentFloor.floorDist, true);
                    }
                }
                this.movementInfo.justTeleported = this.movementInfo.justTeleported
                    || !this.movementConfig.horizontalMove || oldFloorDist < 0;
            }
        }

        clearNetState() {
            this.lastReceiveSequence = 0;
            this.historyMoveMsgs = [];
        }

        /**
         * @return {number}
         */
        generateSequence() {
            const newSequence = this.sequence;
            this.sequence++;
            return newSequence;
        }

        /**
         *
         * @param {number} dt
         */
        updateMoveMsg(dt = 0) {
            let newSequence;
            if (this.role == Role.authority) {
                newSequence = this.lastReceiveSequence;
            } else {
                newSequence = this.generateSequence();
            }
            this.pendingMoveMsg = {
                id: this.id,
                sequence: newSequence,
                timestamp: this.timestamp,
                dt: dt,
                pos: this.pos.clone(),
                velocity: this.velocity.clone(),
                moveMode: this.movementInfo.currentModeMode,
                acceleration: this.acceleration.clone(),
                pressedJump: this.movementInfo.pressedJump,
            };
            if (this.role == Role.autonomous) {
                this.historyMoveMsgs.push(this.pendingMoveMsg);
            }
        }

        /**
         * @return {MoveMsg}
         */
        consumeMoveMsg() {
            const moveMsg = this.pendingMoveMsg;
            this.pendingMoveMsg = null;
            return moveMsg;
        }

        /**
         *
         * @param {MoveMsg} moveMsg
         */
        onMainPlayerReceiveServerMove(moveMsg) {
            if (this.role != Role.autonomous) {
                console.warn("onMainPlayerReceiveServerMove should only call on autonomous players");
                return;
            }
            if (moveMsg.sequence <= this.lastReceiveSequence) {
                return;
            }
            this.lastReceiveSequence = moveMsg.sequence;
            const idx = this.historyMoveMsgs.findIndex(msg => msg.sequence == moveMsg.sequence);
            if (idx != -1) {
                const lastMsg = this.historyMoveMsgs[idx];
                this.historyMoveMsgs.splice(0, idx + 1);
                if (lastMsg.pos.sub(moveMsg.pos).length() > 20) {
                    this.pos = moveMsg.pos;
                    this.velocity = moveMsg.velocity;
                    this.movementInfo.currentModeMode = moveMsg.moveMode;
                    this.needReconciliation = true;
                }
            }
        }

        reconciliation() {
            this.needReconciliation = false;
            const savedPressedJump = this.movementInfo.pressedJump;
            for (let moveMsg of this.historyMoveMsgs) {
                this.acceleration = moveMsg.acceleration.clone();
                this.movementInfo.pressedJump = moveMsg.pressedJump;
                this.performMovement(moveMsg.dt);
                moveMsg.pos = this.pos.clone();
                moveMsg.velocity = this.velocity.clone();
                moveMsg.moveMode = this.movementInfo.currentModeMode;
            }
            this.movementInfo.pressedJump = savedPressedJump;
        }

        /**
         *
         * @param {MoveMsg} moveMsg
         */
        serverMove(moveMsg) {
            if (this.role != Role.authority) {
                console.warn("ServerMove should only call on authority players");
                return;
            }
            if (moveMsg.sequence <= this.lastReceiveSequence) {
                return;
            }
            let dt = moveMsg.dt;
            if (this.lastReceiveTimestamp != 0) {
                dt = moveMsg.timestamp - this.lastReceiveTimestamp;
            }
            this.lastReceiveSequence = moveMsg.sequence;
            this.lastReceiveTimestamp = moveMsg.timestamp;
            this.acceleration = moveMsg.acceleration.clone();
            this.movementInfo.pressedJump = moveMsg.pressedJump;
            this.performMovement(dt);
        }

        /**
         *
         * @param {MoveMsg} moveMsg
         */
        onReplicateMove(moveMsg) {
            if (this.role != Role.simulate) {
                console.warn("OnReplicateMove should only call on simulate players");
                return;
            }
            // discard delay or duplicate message
            if (moveMsg.sequence <= this.lastReceiveSequence) {
                return;
            }
            this.lastReceiveSequence = moveMsg.sequence;
            this.pos = moveMsg.pos.clone();
            this.velocity = moveMsg.velocity.clone();
            this.movementInfo.currentModeMode = moveMsg.moveMode;
        }

        /**
         *
         * @param {number} dt
         */
        simulateMove(dt) {
            //TODO: need more complex simulate
            this.move(this.velocity.mul(dt));
        }
    }

    // @ts-check

    class InputSystem {

        /**
         * @param {Object} [keyStates]
         */
        constructor(keyStates = KeyStates) {
            this.lastKeyStates = Object.assign({}, keyStates);
            this.currentKeyStates = Object.assign({}, keyStates);
            this.keyStates = keyStates;
            /** @type {Map<string, string>} */
            this.actionMap = new Map();

            /** @type {string} */
            this.forwardPositive = null;
            /** @type {string} */
            this.forwardNegative = null;
            /** @type {string} */
            this.rightPositive = null;
            /** @type {string} */
            this.rightNegative = null;
        }

        /**
         * update key state
         */
        updateState() {
            this.lastKeyStates = this.currentKeyStates;
            this.currentKeyStates = Object.assign({}, this.keyStates);
        }

        /**
         * @param {string} key
         * @return {boolean} is key down?
         */
        _getKeydown(key) {
            return !this.lastKeyStates[key] && this.currentKeyStates[key];
        }

        /**
         * @param {string} key
         * @return {boolean} is key up?
         */
        _getKeyup(key) {
            return this.lastKeyStates[key] && !this.currentKeyStates[key];
        }

        /**
         * @param {string} key
         * @return {boolean} is key pressed?
         */
        _getKey(key) {
            return this.currentKeyStates[key] && true; // convert to boolean
        }

        /**
         * set an action
         * @param {string} name
         * @param {string} key
         */
        setAction(name, key) {
            this.actionMap.set(name, key);
        }

        /**
         * @param {string} name
         * @return {boolean} is action down?
         */
        getActionDown(name) {
            const key = this.actionMap.get(name);
            return this._getKeydown(key);
        }

        /**
         * @param {string} name
         * @return {boolean} is action up?
         */
        getActionUp(name) {
            const key = this.actionMap.get(name);
            return this._getKeyup(key);
        }

        /**
         * set axis keys
         * @param {string} forwardPositive
         * @param {string} forwardNegative
         * @param {string} rightPositive
         * @param {string} rightNegative
         */
        setAxis(forwardPositive, forwardNegative, rightPositive, rightNegative) {
            this.forwardPositive = forwardPositive;
            this.forwardNegative = forwardNegative;
            this.rightPositive = rightPositive;
            this.rightNegative = rightNegative;
        }

        /**
         * @return {number} forward value
         */
        getForward() {
            let forward = 0.0;
            forward += this._getKey(this.forwardPositive) ? 1 : 0;
            forward -= this._getKey(this.forwardNegative) ? 1 : 0;
            return forward;
        }

        /**
         * @return {number} right value
         */
        getRight() {
            let right = 0.0;
            right += this._getKey(this.rightPositive) ? 1 : 0;
            right -= this._getKey(this.rightNegative) ? 1 : 0;
            return right;
        }

    }

    // @ts-check

    class Instance {
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
         * @param {number} dt
         */
        draw(dt) {
            this.scene.draw(this.ctx);
            for (let player of this.players) {
                player.draw(this.ctx, dt);
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
                    const dt = this.interval * 0.001 * Time.scale;
                    this.update(dt);
                    this.draw(dt);
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

    // @ts-check

    /**
     * @typedef {Object} ChannelPackege
     * @property {number} validTime - package valid dequeue time
     * @property {any} payload - package payload
     */

    class Channel {
        /**
         * @param {Instance} sender
         * @param {Instance} receiver
         * @param {number} lag
         * @param {number} lagVariance
         * @param {number} loss
         */
        constructor(sender, receiver, lag = 0, lagVariance = 0, loss = 0) {
            this.sender = sender;
            this.receiver = receiver;
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

    // @ts-check

    /**
     * @typedef {Object} ReplicateMoveMsg
     * @property {import("./player").MoveMsg[]} moveMsgs
     */

    class Server extends Instance {
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
         * @param {import("./player").PlayerInfo} playerInfo
         * @param {number} id
         */
        generatePlayer(playerInfo, id) {
            const player = new Player(playerInfo.pos, playerInfo.color, id, playerInfo.flipAnime);
            player.role = Role.authority;
            player.isNetMode = true;
            player.animator = playerInfo.animator;
            return player;
        }

        /**
         * @param {Channel} clientChannel
         * @param {import("./player").PlayerInfo} playerInfo
         * @return {{serverChannel: Channel, id: number, playerInfos: import("./player").PlayerInfo[]}}
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

        receiveNetMessage() {
            for (let recvChannel of this.recvChannels) {
                /**@type {import("./player").MoveMsg} */
                let moveMsg = recvChannel.fetch(this.currentTime);
                while (moveMsg != null) {
                    if (this.idMap.has(moveMsg.id)) {
                        const idx = this.idMap.get(moveMsg.id);
                        this.players[idx].serverMove(moveMsg);
                        moveMsg = recvChannel.fetch(this.currentTime);
                    }
                }
            }
        }

        /**
          * @param {number} dt
          */
        update(dt) {
            this.receiveNetMessage();
            super.update(dt);
            this.sendNetMessage();
        }

        sendNetMessage() {
            const moveMsgs = [];
            for (let player of this.players) {
                /**@type {import("./player").MoveMsg} */
                const moveMsg = player.consumeMoveMsg();
                if (moveMsg != null) {
                    moveMsgs.push(moveMsg);
                }
                /**@type {ReplicateMoveMsg} */
                const replicateMoveMsg = {
                    moveMsgs: moveMsgs,
                };
                for (let sendChannel of this.sendChannels) {
                    sendChannel.push(this.currentTime, replicateMoveMsg);
                }
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
                const remoteClient = (channel.receiver);
                remoteClient.serverInterval = interval;
            }
        }
    }

    // @ts-check

    /**
     * @typedef {Object} SavedMove
     * @property {number} sequence
     * @property {Vec2} velocity
     * @property {Vec2} acceleration
     * @property {number} dt
     */

    class Client extends Instance {
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
            const player = new Player(playerInfo.pos, playerInfo.color, playerInfo.id, playerInfo.flipAnime);
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

    // @ts-check

    /** @type {HTMLCanvasElement} */
    const canvas1 = (document.getElementById("canvas1"));
    /** @type {HTMLCanvasElement} */
    const canvas2 = (document.getElementById("canvas2"));
    /** @type {HTMLCanvasElement} */
    const canvas3 = (document.getElementById("canvas3"));

    const walkAnimConfig = {
        imageSrcs: [
            "public/images/adventurer-run-00.png",
            "public/images/adventurer-run-01.png",
            "public/images/adventurer-run-02.png",
            "public/images/adventurer-run-03.png",
            "public/images/adventurer-run-04.png",
            "public/images/adventurer-run-05.png",
        ],
        frames: [
            {
                idx: 0,
                duration: 0.1,
                pivot: new Vec2(30, 22),
            },
            {
                idx: 1,
                duration: 0.1,
                pivot: new Vec2(30, 22),
            },
            {
                idx: 2,
                duration: 0.1,
                pivot: new Vec2(30, 22),
            },
            {
                idx: 3,
                duration: 0.1,
                pivot: new Vec2(30, 22),
            },
            {
                idx: 4,
                duration: 0.1,
                pivot: new Vec2(30, 22),
            },
            {
                idx: 5,
                duration: 0.1,
                pivot: new Vec2(30, 22),
            }
        ]
    };
    const idleAnimConfig = {
        imageSrcs: [
            "public/images/adventurer-idle-00.png",
            "public/images/adventurer-idle-01.png",
            "public/images/adventurer-idle-02.png",
            "public/images/adventurer-idle-03.png",
        ],
        frames: [
            {
                idx: 0,
                duration: 0.2,
                pivot: new Vec2(25, 22),
            },
            {
                idx: 1,
                duration: 0.2,
                pivot: new Vec2(25, 22),
            },
            {
                idx: 2,
                duration: 0.2,
                pivot: new Vec2(25, 22),
            },
            {
                idx: 3,
                duration: 0.2,
                pivot: new Vec2(25, 22),
            },
        ]
    };
    const fallAnimConfig = {
        imageSrcs: [
            "public/images/adventurer-fall-00.png",
            "public/images/adventurer-fall-01.png",
        ],
        frames: [
            {
                idx: 0,
                duration: 0.1,
                pivot: new Vec2(28, 22),
            },
            {
                idx: 1,
                duration: 0.1,
                pivot: new Vec2(28, 22),
            },
        ]
    };
    const jumpAnimConfig = {
        imageSrcs: [
            "public/images/adventurer-jump-00.png",
            "public/images/adventurer-jump-01.png",
            "public/images/adventurer-jump-02.png",
            "public/images/adventurer-jump-03.png",
        ],
        frames: [
            {
                idx: 0,
                duration: 0.01,
                pivot: new Vec2(28, 22),
            },
            {
                idx: 1,
                duration: 0.01,
                pivot: new Vec2(28, 22),
            },
            {
                idx: 2,
                duration: 0.08,
                pivot: new Vec2(28, 22),
            },
            {
                idx: 3,
                duration: 0.08,
                pivot: new Vec2(28, 22),
            },
        ]
    };
    const walkAnimeClip = new AnimeClip(walkAnimConfig);
    walkAnimeClip.loadImages();
    const idleAnimClip = new AnimeClip(idleAnimConfig);
    idleAnimClip.loadImages();
    const fallAnimClip = new AnimeClip(fallAnimConfig);
    fallAnimClip.loadImages();
    const jumpAnimClip = new AnimeClip(jumpAnimConfig);
    jumpAnimClip.loadImages();

    const client1Animator = new Animator();
    client1Animator.addNewAnimeClip("walking", walkAnimeClip);
    client1Animator.addNewAnimeClip("idle", idleAnimClip);
    client1Animator.addNewAnimeClip("falling", fallAnimClip);
    client1Animator.addNewAnimeClip("jump", jumpAnimClip);

    // client 1
    const client1Player = new Player(new Vec2(50, 200), "#FBE251", 0);
    client1Player.animator = client1Animator;
    const input1 = new InputSystem();
    input1.setAxis("KeyW", "KeyS", "KeyD", "KeyA");
    input1.setAction("jump", "Space");
    const client1 = new Client(canvas1, client1Player, input1);
    // client 2
    const client2Player = new Player(new Vec2(400, 200), "#FEDFE1", 0);
    client2Player.animator = client1Animator.clone();
    const input2 = new InputSystem();
    input2.setAxis("ArrowUp", "ArrowDown", "ArrowRight", "ArrowLeft");
    input2.setAction("jump", "Numpad0");
    const client2 = new Client(canvas3, client2Player, input2);
    // server
    const server = new Server(canvas2);
    // instances
    const instances = [client1, client2, server];

    window["client1"] = client1;
    window["client2"] = client2;
    window["server"] = server;

    /**
     * lag settings
     * @param {Client} client
     * @param {string} id
     */
    const handleLag = (client, id) => {
        /** @type {HTMLInputElement} */
        const lagInput = (document.getElementById(id));
        lagInput.onchange = function(e) {
            /** @type {HTMLInputElement} */
            let target = (e.target);
            let lag = parseInt(target.value) || 0;
            target.value = lag.toString();
            client.setLag(lag);
        };
        lagInput.dispatchEvent(new Event("change"));
    };
    handleLag(client1, "client1_lag");
    handleLag(client2, "client2_lag");

    /**
     * lag variance settings
     * @param {Client} client
     * @param {string} id
     */
    const handleLagVariance = (client, id) => {
        /** @type {HTMLInputElement} */
        const lagVarInput = (document.getElementById(id));
        lagVarInput.onchange = function(e) {
            /** @type {HTMLInputElement} */
            let target = (e.target);
            let lag = parseInt(target.value) || 0;
            target.value = lag.toString();
            client.setLagVariance(lag);
        };
        lagVarInput.dispatchEvent(new Event("change"));
    };
    handleLagVariance(client1, "client1_lagVariance");
    handleLagVariance(client2, "client2_lagVariance");

    /**
     * loss settings
     * @param {Client} client
     * @param {string} id
     */
    const handleLoss = (client, id) => {
        /** @type {HTMLInputElement} */
        const lossInput = (document.getElementById(id));
        lossInput.onchange = function(e) {
            /** @type {HTMLInputElement} */
            let target = (e.target);
            let loss = parseFloat(target.value) || 0;
            if (loss < 0) {
                loss = 0;
            } else if (loss > 1) {
                loss = 1;
            }
            target.value = loss.toString();
            client.setLoss(loss);
        };
        lossInput.dispatchEvent(new Event("change"));
    };
    handleLoss(client1, "client1_loss");
    handleLoss(client2, "client2_loss");

    /**
     * fps settings
     * @param {Client | Server} instance
     * @param {string} id
     */
    const handleFps = (instance, id) => {
        /** @type {HTMLInputElement} */
        const fpsInput = (document.getElementById(id));
        fpsInput.onchange = function(e) {
            /** @type {HTMLInputElement} */
            let target = (e.target);
            let fps = parseInt(target.value) || 60;
            if (fps < 3) {
                fps = 3;
            } else if (fps > 60) {
                fps = 60;
            }
            target.value = fps.toString();
            instance.setUpdate(1000 / fps);
        };
        fpsInput.dispatchEvent(new Event("change"));
    };
    handleFps(client1, "client1_fps");
    handleFps(client2, "client2_fps");
    handleFps(server, "server_fps");

    /**
     * always sync settings
     * @param {Server} server
     * @param {string} id
     */
    const handleSync = (server, id) => {
        /** @type {HTMLInputElement} */
        const syncInput = (document.getElementById(id));
        syncInput.onchange = function(e) {
            /** @type {HTMLInputElement} */
            let target = (e.target);
            server.alwaysSync = target.checked;
        };
        syncInput.dispatchEvent(new Event("change"));
    };
    handleSync(server, "server_sync");

    /**
     * Connect
     * @param {Client} client
     * @param {string} id
     */
    const handleConnect = (client, id) => {
        /** @type {HTMLInputElement} */
        const connectInput = (document.getElementById(id));
        connectInput.onchange = function(e) {
            /** @type {HTMLInputElement} */
            let target = (e.target);
            if (target.checked) {
                client.connect(server);
            } else {
                client.disconnect(server);
            }
        };
        connectInput.dispatchEvent(new Event("change"));
    };
    handleConnect(client1, "client1_connect");
    handleConnect(client2, "client2_connect");

    /**
     * event handle
     * @param {KeyboardEvent} e
     */
    const keyHandler = (e) => {
        if (e.type === "keydown" || e.type === "keypress") {
            KeyStates[e.code] = 1;
        } else {
            KeyStates[e.code] = 0;
        }
    };
    document.body.onkeydown = keyHandler;
    document.body.onkeypress = keyHandler;
    document.body.onkeyup = keyHandler;

    /**
     * draw callback
     * @param {DOMHighResTimeStamp} timestamp
     */
    const draw = (timestamp) => {
        if (timestamp - Time.lastUnscaleTime > 300) {
            Time.lastUnscaleTime = timestamp;
        } else {
            Time.lastUnscaleTime = Time.currentUnscaleTime;
        }
        Time.currentUnscaleTime = timestamp;
        const unscaleDt = timestamp - Time.lastUnscaleTime;
        const dt = unscaleDt * Time.scale;
        Time.currentTime += dt;
        for (let instance of instances) {
            instance.tryUpdate();
        }

        requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);

}());
//# sourceMappingURL=bundle.js.map
