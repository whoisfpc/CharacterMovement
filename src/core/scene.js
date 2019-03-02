// @ts-check

import Polygon from "./geom/polygon";
import Vec2 from "../algebra/vec2";
import { Debug } from "./globals";

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
        ctx.fillStyle = this.color
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
}
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

export default class Scene {
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
        this.oneFrameDrawables = []
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

export {
    DurationType,
}
