// @ts-check
import Vec2 from "../algebra/vec2";
import Scene, { DurationType } from "./scene";
import { Debug } from "./globals";
import Capsule, { HitResult } from "./geom/capsule";
import { lineSweep } from "./geom/util";
import Animator from "./anim/animator";
import { debug } from "util";

const Role = {
    simulate: 0,
    authority: 1,
    autonomous: 2,
}
Object.freeze(Role);

const MoveMode = {
    none: 0,
    walking: 1,
    falling: 2,
}
Object.freeze(MoveMode);
const MOVE_AVOID_DIST = 0.5;
const MAX_FLOOR_DIST = 2.4;
const MIN_FLOOR_DIST = 1.9;
const SWEEP_EDGE_REJECT_DISTANCE = 0.15;
const SMALL_NUMBER = 1e-8;
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
        this.blockingHit = hitResult.isValidBlock()
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

export {
    Role,
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
 * @property {number} dt
 * @property {Vec2} pos
 * @property {Vec2} velocity
 * @property {number} moveMode
 * @property {Vec2} acceleration
 * @property {boolean} pressedJump
 */

export default class Player {
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

        this.updatedTimestamp = 0;
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
        }

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
        }

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
            dt: dt,
            pos: this.pos.clone(),
            velocity: this.velocity.clone(),
            moveMode: this.movementInfo.currentModeMode,
            acceleration: this.acceleration.clone(),
            pressedJump: this.movementInfo.pressedJump,
        }
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
        this.lastReceiveSequence = moveMsg.sequence;
        this.acceleration = moveMsg.acceleration.clone();
        this.movementInfo.pressedJump = moveMsg.pressedJump;
        this.performMovement(moveMsg.dt);
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
