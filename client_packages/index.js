const KEYS = {
    menu: 0x31,      // 1
    noclip: 0x48,    // H
    waypoint: 0x4A   // J
};

const HEIGHTS = [1000, 800, 600, 450, 350, 250, 175, 120, 90, 70, 50, 35, 22, 12, 5, 0, -25, -60];

// снос ванильного лос-сантоса на входе
const HIDE_VANILLA_MAP = true;
const IPL_CHUNK = 200;

let browser = null;
let menuOpen = false;
let inputFocused = false;   // фокус в поле ввода cef
let chatOpen = false;
let noclip = false;
let ncSpeed = 0.6;
let hideHud = false;
let busyTeleport = false;
let mapHidden = false;
let iplBusy = false;

// утиль

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function toBrowser(code) {
    if (browser) browser.execute(code);
}

function toast(text, kind) {
    toBrowser("window.ui && ui.toast(" + JSON.stringify(String(text)) + "," + JSON.stringify(kind || "info") + ")");
}

function blocked() {
    return inputFocused || chatOpen || mp.game.ui.isPauseMenuActive();
}

function localEntity() {
    const p = mp.players.local;
    return p.vehicle || p;
}

function setCoords(entity, x, y, z) {
    entity.setCoordsNoOffset(x, y, z, false, false, false);
}

function modelHash(name) {
    const raw = String(name || "").trim();
    if (!raw.length) return 0;
    if (/^-?\d+$/.test(raw)) return parseInt(raw, 10) >>> 0;
    return mp.game.joaat(raw.toLowerCase());
}

// браузер

browser = mp.browsers.new("package://cef/index.html");

mp.events.add("mod:cef:ready", () => {
    pushState();
});

function pushState() {
    toBrowser("window.ui && ui.setState(" + JSON.stringify({
        open: menuOpen,
        noclip: noclip,
        speed: ncSpeed,
        hud: hideHud,
        map: !mapHidden
    }) + ")");
}

function setMenu(state) {
    menuOpen = state;
    mp.gui.cursor.show(state, state);
    if (!state) inputFocused = false;
    toBrowser("window.ui && ui.setOpen(" + (state ? "true" : "false") + ")");
}

mp.keys.bind(KEYS.menu, true, () => {
    if (inputFocused || chatOpen) return;
    setMenu(!menuOpen);
});

mp.events.add("mod:cef:focus", (state) => {
    inputFocused = !!state;
});

mp.events.add("mod:cef:close", () => setMenu(false));

// mp.keys срабатывает и когда открыт чат
mp.keys.bind(0x54, true, () => { if (!menuOpen && !inputFocused) chatOpen = true; });   // T
mp.keys.bind(0xBF, true, () => { if (!menuOpen && !inputFocused) chatOpen = true; });   // /
mp.keys.bind(0x0D, true, () => { chatOpen = false; });                                  // Enter
mp.keys.bind(0x1B, true, () => { chatOpen = false; if (menuOpen) setMenu(false); });     // Esc

// ноуклип

function setNoclip(state) {
    noclip = state;
    const p = mp.players.local;
    const ent = localEntity();

    ent.freezePosition(state);
    ent.setCollision(!state, !state);
    p.setInvincible(state);

    if (!state) {
        const pos = ent.position;
        let z = pos.z;
        try {
            const ground = mp.game.gameplay.getGroundZFor3dCoord(pos.x, pos.y, pos.z, 0.0, false);
            if (typeof ground === "number" && ground !== 0 && Math.abs(ground) < 2000) z = ground + 1.0;
        } catch (e) {}
        setCoords(ent, pos.x, pos.y, z);
    }

    toBrowser("window.ui && ui.setNoclip(" + (state ? "true" : "false") + ")");
    toast(state ? "Ноуклип включён" : "Ноуклип выключен", state ? "ok" : "info");
}

mp.keys.bind(KEYS.noclip, true, () => {
    if (blocked()) return;
    setNoclip(!noclip);
});

mp.events.add("mod:cef:noclip", (state) => setNoclip(!!state));

mp.events.add("mod:cef:speed", (value) => {
    ncSpeed = Math.max(0.05, Math.min(10, parseFloat(value) || 0.6));
});

mp.events.add("render", () => {
    if (hideHud) mp.game.ui.hideHudAndRadarThisFrame();
    if (!noclip || busyTeleport) return;
    if (chatOpen || inputFocused || mp.game.ui.isPauseMenuActive()) return;

    const ent = localEntity();
    const rot = mp.game.cam.getGameplayCamRot(2);
    const rz = rot.z * Math.PI / 180;
    const rx = rot.x * Math.PI / 180;
    const flat = Math.abs(Math.cos(rx));

    const fwd = { x: -Math.sin(rz) * flat, y: Math.cos(rz) * flat, z: Math.sin(rx) };
    const right = { x: Math.cos(rz), y: Math.sin(rz), z: 0 };

    let speed = ncSpeed;
    if (mp.game.controls.isControlPressed(0, 21)) speed *= 4;    // shift
    if (mp.game.controls.isControlPressed(0, 19)) speed *= 0.25; // alt

    // колесо мыши меняет базовую скорость
    if (mp.game.controls.isControlJustPressed(0, 241)) setSpeed(ncSpeed * 1.25);
    if (mp.game.controls.isControlJustPressed(0, 242)) setSpeed(ncSpeed * 0.8);

    let dx = 0, dy = 0, dz = 0;
    if (mp.game.controls.isControlPressed(0, 32)) { dx += fwd.x; dy += fwd.y; dz += fwd.z; }        // W
    if (mp.game.controls.isControlPressed(0, 33)) { dx -= fwd.x; dy -= fwd.y; dz -= fwd.z; }        // S
    if (mp.game.controls.isControlPressed(0, 34)) { dx -= right.x; dy -= right.y; }                 // A
    if (mp.game.controls.isControlPressed(0, 35)) { dx += right.x; dy += right.y; }                 // D
    if (mp.game.controls.isControlPressed(0, 22)) dz += 1;                                          // space
    if (mp.game.controls.isControlPressed(0, 36)) dz -= 1;                                          // ctrl

    if (dx === 0 && dy === 0 && dz === 0) return;

    const pos = ent.position;
    setCoords(ent, pos.x + dx * speed, pos.y + dy * speed, pos.z + dz * speed);
});

function setSpeed(value) {
    ncSpeed = Math.max(0.05, Math.min(10, Math.round(value * 100) / 100));
    toBrowser("window.ui && ui.setSpeed(" + ncSpeed + ")");
}

// телепорты

async function teleport(x, y, z) {
    if (busyTeleport) return;
    busyTeleport = true;

    const ent = localEntity();
    const wasFrozen = noclip;
    ent.freezePosition(true);

    try {
        if (z === null || z === undefined || isNaN(z)) {
            let found = null;
            for (const h of HEIGHTS) {
                setCoords(ent, x, y, h);
                mp.game.streaming.requestCollisionAtCoord(x, y, h);
                await wait(60);
                let ground = 0;
                try {
                    ground = mp.game.gameplay.getGroundZFor3dCoord(x, y, h, 0.0, false);
                } catch (e) { ground = 0; }
                if (typeof ground === "number" && ground !== 0 && Math.abs(ground) < 2000) {
                    found = ground + 1.0;
                    break;
                }
            }
            if (found === null) {
                z = 250;
                toast("Землю не нашёл, поставил на высоте 250", "warn");
            } else {
                z = found;
            }
        }

        setCoords(ent, x, y, z);
        mp.game.streaming.requestCollisionAtCoord(x, y, z);

        // ждём коллизию, но не вечно
        for (let i = 0; i < 40; i++) {
            if (mp.game.streaming.hasCollisionLoadedAroundEntity(ent.handle)) break;
            await wait(50);
        }
        setCoords(ent, x, y, z);
        toast("Телепорт: " + x.toFixed(2) + ", " + y.toFixed(2) + ", " + z.toFixed(2), "ok");
    } catch (e) {
        toast("Телепорт сорвался: " + e.message, "err");
    }

    ent.freezePosition(wasFrozen);
    busyTeleport = false;
}

function waypointCoords() {
    const blip = mp.game.ui.getFirstBlipInfoId(8);
    if (!blip || !mp.game.ui.doesBlipExist(blip)) return null;
    return mp.game.ui.getBlipInfoIdCoord(blip);
}

function teleportToWaypoint() {
    const coord = waypointCoords();
    if (!coord) return toast("Метка на карте не поставлена", "warn");
    teleport(coord.x, coord.y, null);
}

mp.keys.bind(KEYS.waypoint, true, () => {
    if (blocked()) return;
    teleportToWaypoint();
});

mp.events.add("mod:cef:waypoint", () => teleportToWaypoint());

mp.events.add("mod:cef:tp", (x, y, z) => {
    const px = parseFloat(x), py = parseFloat(y);
    if (isNaN(px) || isNaN(py)) return toast("Кривые координаты", "err");
    const pz = parseFloat(z);
    teleport(px, py, isNaN(pz) ? null : pz);
});

mp.events.add("mod:client:tpxyz", (x, y, z) => teleport(x, y, z === null ? null : z));

// позиция

function posString() {
    const p = mp.players.local;
    const pos = p.position;
    const heading = p.getHeading();
    return pos.x.toFixed(4) + ", " + pos.y.toFixed(4) + ", " + pos.z.toFixed(4) + ", " + heading.toFixed(2);
}

mp.events.add("mod:client:pos", () => {
    const text = posString();
    mp.gui.chat.push("!{#7ec8ff}Координаты:!{#ffffff} " + text);
    toBrowser("window.ui && ui.copy(" + JSON.stringify(text) + ")");
    toast("Координаты скопированы", "ok");
});

mp.events.add("mod:cef:copyPos", () => {
    const text = posString();
    toBrowser("window.ui && ui.copy(" + JSON.stringify(text) + ")");
    mp.gui.chat.push("!{#7ec8ff}Координаты:!{#ffffff} " + text);
    toast("Координаты скопированы", "ok");
});

setInterval(() => {
    if (!browser) return;
    const p = mp.players.local;
    const pos = p.position;
    toBrowser("window.ui && ui.pos(" + pos.x.toFixed(2) + "," + pos.y.toFixed(2) + "," + pos.z.toFixed(2) + "," + p.getHeading().toFixed(1) + ")");
}, 300);

// транспорт и мир

mp.events.add("mod:cef:spawnVeh", (model, into) => {
    const name = String(model || "").trim();
    if (!name.length) return toast("Впиши модель", "warn");

    const hash = modelHash(name);
    if (!mp.game.streaming.isModelInCdimage(hash) || !mp.game.streaming.isModelAVehicle(hash)) {
        return toast("Модель " + name + " не загружена — проверь dlc.rpf и строку в dlclist.xml", "err");
    }
    mp.events.callRemote("mod:spawnVeh", name, into ? 1 : 0);
});

mp.events.add("mod:cef:vehAction", (action) => {
    if (action === "delete") mp.events.callRemote("mod:deleteLast");
    else if (action === "deleteAll") mp.events.callRemote("mod:deleteAll");
    else if (action === "fix") mp.events.callRemote("mod:fix");
});

mp.events.add("mod:cef:vehColor", (r1, g1, b1, r2, g2, b2) => {
    mp.events.callRemote("mod:vehColor", r1, g1, b1, r2, g2, b2);
});

mp.events.add("mod:cef:skin", (model) => {
    const name = String(model || "").trim();
    if (!name.length) return toast("Впиши модель педа", "warn");
    const hash = modelHash(name);
    if (!mp.game.streaming.isModelInCdimage(hash)) {
        return toast("Модель " + name + " не загружена — проверь dlc.rpf и dlclist.xml", "err");
    }
    mp.events.callRemote("mod:skin", name);
});

mp.events.add("mod:cef:skinReset", () => mp.events.callRemote("mod:skinReset"));

mp.events.add("mod:cef:cloth", (comp, draw, tex) => {
    mp.events.callRemote("mod:cloth", comp, draw, tex);
});

mp.events.add("mod:cef:prop", (comp, draw, tex) => {
    mp.events.callRemote("mod:prop", comp, draw, tex);
});

mp.events.add("mod:cef:time", (hour, minute) => {
    mp.events.callRemote("mod:time", hour, minute);
});

mp.events.add("mod:cef:weather", (weather) => {
    mp.events.callRemote("mod:weather", weather);
});

mp.events.add("mod:cef:hud", (state) => {
    hideHud = !!state;
    toast(hideHud ? "HUD скрыт" : "HUD включён", "info");
});

// ванильная карта

let iplCache = null;

// rage выполняет только index.js, остальное подключаем сами
function iplList() {
    if (iplCache && iplCache.length) return iplCache;

    const paths = ["./ipl_list.js", "./ipl_list", "ipl_list.js"];
    for (const path of paths) {
        try {
            const loaded = require(path);
            if (loaded && loaded.iplListDisable && loaded.iplListDisable.length) {
                iplCache = loaded.iplListDisable;
                break;
            }
        } catch (e) {
            mp.console.logWarning("[IPL] require(" + path + ") не сработал: " + e.message);
        }
    }

    if ((!iplCache || !iplCache.length) && typeof globalThis.iplListDisable !== "undefined") {
        iplCache = globalThis.iplListDisable;
    }

    return iplCache;
}

function applyIpl(remove) {
    const list = iplList();
    if (!list || !list.length) return toast("Список IPL не загрузился, проверь ipl_list.js", "err");
    if (iplBusy) return toast("Предыдущая пачка ещё идёт", "warn");

    iplBusy = true;
    let at = 0;

    // пачками: двадцать тысяч removeIpl за кадр роняют клиент
    const step = () => {
        const end = Math.min(at + IPL_CHUNK, list.length);
        for (; at < end; at++) {
            const ipl = list[at];
            if (!ipl) continue;
            try {
                if (remove) mp.game.streaming.removeIpl(ipl);
                else mp.game.streaming.requestIpl(ipl);
            } catch (e) {}
        }
        if (at < list.length) return setTimeout(step, 0);

        iplBusy = false;
        mapHidden = remove;
        toBrowser("window.ui && ui.setMap(" + (remove ? "false" : "true") + ")");
        toast(remove ? "Ванильная карта убрана" : "Ванильная карта возвращена", "ok");
    };

    step();
}

mp.events.add("mod:cef:map", (visible) => applyIpl(!visible));

mp.events.add("playerReady", () => {
    if (!HIDE_VANILLA_MAP) return;
    setTimeout(() => applyIpl(true), 2000);
});

// оружие

mp.events.add("mod:cef:weapon", (name, ammo) => {
    const raw = String(name || "").trim();
    if (!raw.length) return toast("Впиши оружие", "warn");
    const hash = modelHash(raw);
    let valid = true;
    try { valid = mp.game.weapon.isWeaponValid(hash); } catch (e) { valid = true; }
    if (!valid) return toast("Оружия " + raw + " в игре нет", "err");
    mp.events.callRemote("mod:weapon", raw, parseInt(ammo, 10) || 500);
});

mp.events.add("mod:cef:weaponPack", (ammo) => {
    mp.events.callRemote("mod:weaponPack", parseInt(ammo, 10) || 500);
});

mp.events.add("mod:cef:ammo", (ammo) => {
    mp.events.callRemote("mod:ammo", parseInt(ammo, 10) || 500);
});

mp.events.add("mod:cef:weaponClear", () => mp.events.callRemote("mod:weaponClear"));
