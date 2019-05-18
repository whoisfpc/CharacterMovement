// @ts-check

import Vec2 from "./algebra/vec2";
import Player from "./core/player";
import InputSystem from "./core/input/inputSystem";
import Client from "./core/client";
import Server from "./core/server";
import { Time, KeyStates } from "./core/globals";
import Animator from "./core/anim/animator";
import AnimeClip from "./core/anim/animeClip";

/** @type {HTMLCanvasElement} */
const canvas1 = (document.getElementById("canvas1"));
/** @type {HTMLCanvasElement} */
const canvas2 = (document.getElementById("canvas2"));
/** @type {HTMLCanvasElement} */
const canvas3 = (document.getElementById("canvas3"));

const walkAnimConfig = {
    imageSrcs: [
        "images/adventurer-run-00.png",
        "images/adventurer-run-01.png",
        "images/adventurer-run-02.png",
        "images/adventurer-run-03.png",
        "images/adventurer-run-04.png",
        "images/adventurer-run-05.png",
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
}
const walkAnimeClip = new AnimeClip(walkAnimConfig);
walkAnimeClip.loadImages();
const client1Animator = new Animator();
client1Animator.addNewAnimeClip("walking", walkAnimeClip);

// client 1
const client1Player = new Player(new Vec2(50, 200), "#FBE251", 0);
client1Player.animator = client1Animator;
const input1 = new InputSystem();
input1.setAxis("KeyW", "KeyS", "KeyD", "KeyA");
input1.setAction("jump", "Space");
const client1 = new Client(canvas1, client1Player, input1);
// client 2
const client2Player = new Player(new Vec2(400, 200), "#FEDFE1", 0);
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
