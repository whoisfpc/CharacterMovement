// @ts-check

import { KeyStates as GlobalKeyState } from "../globals";

export default class InputSystem {

    /**
     * @param {Object} [keyStates]
     */
    constructor(keyStates = GlobalKeyState) {
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
