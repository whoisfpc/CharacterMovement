// @ts-check

import Vec2 from "./algebra/vec2";
import Player from "./core/player";
import InputSystem from "./core/input/inputSystem";
import Client from "./core/client";
import Server from "./core/server";
import { Time, KeyStates } from "./core/globals";

/** @type {HTMLCanvasElement} */
const canvas1 = (document.getElementById("canvas1"));
/** @type {HTMLCanvasElement} */
const canvas2 = (document.getElementById("canvas2"));
/** @type {HTMLCanvasElement} */
const canvas3 = (document.getElementById("canvas3"));

// client 1
const client1Players = [new Player(new Vec2(50, 200), "#FBE251", 0)];
client1Players[0].isMainPlayer = true;
const input1 = new InputSystem();
input1.setAxis("KeyW", "KeyS", "KeyD", "KeyA");
input1.setAction("jump", "Space");
const client1 = new Client(canvas1, client1Players, input1);
// client 2
const client2Players = [];//[new Player(new Vec2(400, 200), "#FEDFE1", 0)];
//client2Players[0].isMainPlayer = true;
const input2 = new InputSystem();
input2.setAxis("ArrowUp", "ArrowDown", "ArrowRight", "ArrowLeft");
const client2 = new Client(canvas3, client2Players, input2);
// server
const server = new Server(canvas2, []);
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
    }
    lagInput.dispatchEvent(new Event("change"));
}
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
    }
    lagVarInput.dispatchEvent(new Event("change"));
}
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
    }
    lossInput.dispatchEvent(new Event("change"));
}
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
    }
    fpsInput.dispatchEvent(new Event("change"));
}
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
    }
    syncInput.dispatchEvent(new Event("change"));
}
handleSync(server, "server_sync");

/**
 * predicition settings
 * @param {Client} client
 * @param {string} id
 * @param {string} id2
 */
const handlePrediction = (client, id, id2) => {
    /** @type {HTMLInputElement} */
    const predictionInput = (document.getElementById(id));
    /** @type {HTMLInputElement} */
    const reconciliationInput = (document.getElementById(id2));
    predictionInput.onchange = function(e) {
        /** @type {HTMLInputElement} */
        let target = (e.target);
        client.prediction = target.checked;
        if (!target.checked && client.reconciliation) {
            reconciliationInput.checked = false;
            client.reconciliation = false;
        }
    }
    predictionInput.dispatchEvent(new Event("change"));
}
handlePrediction(client1, "client1_prediction", "client1_reconciliation");
handlePrediction(client2, "client2_prediction", "client2_reconciliation");

/**
 * reconciliation settings
 * @param {Client} client
 * @param {string} id
 * @param {string} id2
 */
const handleReconciliation = (client, id, id2) => {
    /** @type {HTMLInputElement} */
    const reconciliationInput = (document.getElementById(id));
    /** @type {HTMLInputElement} */
    const predictionInput = (document.getElementById(id2));
    reconciliationInput.onchange = function(e) {
        /** @type {HTMLInputElement} */
        let target = (e.target);
        client.reconciliation = target.checked;
        if (target.checked && !client.prediction) {
            predictionInput.checked = true;
            client.prediction = true;
        }
    }
    reconciliationInput.dispatchEvent(new Event("change"));
}
handleReconciliation(client1, "client1_reconciliation", "client1_prediction");
handleReconciliation(client2, "client2_reconciliation", "client2_prediction");

/**
 * jitter buffer
 * @param {Client} client
 * @param {string} id
 */
const handleJitterBuffer = (client, id) => {
    /** @type {HTMLInputElement} */
    const jitterBufferInput = (document.getElementById(id));
    jitterBufferInput.onchange = function(e) {
        /** @type {HTMLInputElement} */
        let target = (e.target);
        client.jitterBuffer = target.checked;
    }
    jitterBufferInput.dispatchEvent(new Event("change"));
}
handleJitterBuffer(client1, "client1_jitterBuffer");
handleJitterBuffer(client2, "client2_jitterBuffer");

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
    }
    connectInput.dispatchEvent(new Event("change"));
}
handleConnect(client1, "client1_connect");
handleConnect(client2, "client2_connect");

/**
 * visual smooth settings
 * @param {Client} client
 * @param {string} id
 */
const handleVisualSmooth = (client, id) => {
    /** @type {HTMLInputElement} */
    const visualSmoothInput = (document.getElementById(id));
    visualSmoothInput.onchange = function(e) {
        /** @type {HTMLInputElement} */
        let target = (e.target);
        client.setVisualSmooth(target.checked);
    }
    visualSmoothInput.dispatchEvent(new Event("change"));
}
handleVisualSmooth(client1, "client1_visualSmooth");
handleVisualSmooth(client2, "client2_visualSmooth");

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
        instance.draw();
    }

    requestAnimationFrame(draw);
};
requestAnimationFrame(draw);
