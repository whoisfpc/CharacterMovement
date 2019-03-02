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
    showRecvPos: false,
    showDebugDraw: false
}

// let `Time` and `Debug` be global variable
window["Time"] = Time;
window["Debug"] = Debug;

export {
    Time,
    KeyStates,
    Debug
};
