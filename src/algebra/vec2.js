// @ts-check

export default class Vec2 {
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
