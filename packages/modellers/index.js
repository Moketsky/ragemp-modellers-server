const SPAWN = { x: 195.17, y: -933.77, z: 30.69, h: 145.0 };

const WEATHERS = [
    "EXTRASUNNY", "CLEAR", "CLOUDS", "SMOG", "FOGGY", "OVERCAST",
    "OVERCAST_DARK", "RAIN", "THUNDER", "CLEARING", "NEUTRAL",
    "SNOW", "BLIZZARD", "SNOWLIGHT", "XMAS", "HALLOWEEN"
];

// без этого freemode голый
function dressDefault(player) {
    player.setClothes(3, 15, 0, 2);   // торс
    player.setClothes(4, 21, 0, 2);   // ноги
    player.setClothes(6, 34, 0, 2);   // обувь
    player.setClothes(8, 15, 0, 2);   // майка
    player.setClothes(11, 15, 0, 2);  // верх
}

function hashOf(model) {
    const raw = String(model || "").trim();
    if (!raw.length) return 0;
    if (/^-?\d+$/.test(raw)) return parseInt(raw, 10) >>> 0;
    return mp.joaat(raw.toLowerCase());
}

function ownedVehicles(player) {
    if (!player.modVehicles) player.modVehicles = [];
    player.modVehicles = player.modVehicles.filter(v => v && mp.vehicles.exists(v));
    return player.modVehicles;
}

function destroyAll(player) {
    const list = ownedVehicles(player);
    let n = 0;
    for (const veh of list) { veh.destroy(); n++; }
    player.modVehicles = [];
    return n;
}

mp.events.add("playerJoin", (player) => {
    player.spawn(new mp.Vector3(SPAWN.x, SPAWN.y, SPAWN.z));
    player.model = mp.joaat("mp_m_freemode_01");
    player.heading = SPAWN.h;
    dressDefault(player);
    player.modVehicles = [];

    player.outputChatBox("!{#7ec8ff}Сервер для моделлеров.!{#ffffff} Меню — клавиша !{#7ec8ff}1!{#ffffff}, ноуклип — !{#7ec8ff}H!{#ffffff}, телепорт на метку — !{#7ec8ff}J");
    player.outputChatBox("Команды: /veh /dv /dvall /fix /skin /tpxyz /tp /time /weather /pos");
});

mp.events.add("playerDeath", (player) => {
    player.spawn(player.position);
    player.health = 100;
});

mp.events.add("playerQuit", (player) => {
    destroyAll(player);
});

// транспорт

function spawnVehicle(player, model, intoVehicle) {
    const hash = hashOf(model);
    if (!hash) return player.outputChatBox("!{#ff8080}Пустое имя модели.");

    const pos = player.position;
    const rad = player.heading * Math.PI / 180;
    const at = new mp.Vector3(pos.x - Math.sin(rad) * 4.5, pos.y + Math.cos(rad) * 4.5, pos.z);

    let veh;
    try {
        veh = mp.vehicles.new(hash, at, {
            heading: player.heading,
            numberPlate: "MODEL",
            dimension: player.dimension,
            engine: true,
            locked: false
        });
    } catch (e) {
        return player.outputChatBox("!{#ff8080}Не удалось создать: " + e.message);
    }

    ownedVehicles(player).push(veh);
    player.outputChatBox("Заспавнен !{#7ec8ff}" + model + "!{#ffffff} (hash " + hash + ")");
    if (intoVehicle) setTimeout(() => { if (mp.vehicles.exists(veh)) player.putIntoVehicle(veh, -1); }, 400);
}

mp.events.add("mod:spawnVeh", (player, model, into) => spawnVehicle(player, model, !!into));

mp.events.add("mod:deleteLast", (player) => {
    const list = ownedVehicles(player);
    const veh = list.pop();
    if (!veh) return player.outputChatBox("!{#ff8080}Нечего удалять.");
    veh.destroy();
    player.outputChatBox("Последняя машина удалена.");
});

mp.events.add("mod:deleteAll", (player) => {
    const n = destroyAll(player);
    player.outputChatBox("Удалено машин: " + n);
});

mp.events.add("mod:fix", (player) => {
    const list = ownedVehicles(player);
    const veh = player.vehicle || list[list.length - 1];
    if (!veh) return player.outputChatBox("!{#ff8080}Нет машины.");
    veh.repair();
    player.outputChatBox("Починено.");
});

mp.events.add("mod:vehColor", (player, r1, g1, b1, r2, g2, b2) => {
    const list = ownedVehicles(player);
    const veh = player.vehicle || list[list.length - 1];
    if (!veh) return player.outputChatBox("!{#ff8080}Нет машины.");
    veh.setColorRGB(r1, g1, b1, r2, g2, b2);
});

// игрок

mp.events.add("mod:skin", (player, model) => {
    const hash = hashOf(model);
    if (!hash) return player.outputChatBox("!{#ff8080}Пустое имя модели.");
    player.model = hash;
    if (hash === mp.joaat("mp_m_freemode_01") || hash === mp.joaat("mp_f_freemode_01")) dressDefault(player);
    player.outputChatBox("Скин: !{#7ec8ff}" + model);
});

mp.events.add("mod:skinReset", (player) => {
    player.model = mp.joaat("mp_m_freemode_01");
    dressDefault(player);
    player.outputChatBox("Скин сброшен.");
});

mp.events.add("mod:cloth", (player, comp, draw, tex) => {
    player.setClothes(parseInt(comp, 10), parseInt(draw, 10), parseInt(tex, 10), 2);
});

mp.events.add("mod:prop", (player, comp, draw, tex) => {
    const d = parseInt(draw, 10);
    if (d < 0) player.clearProp(parseInt(comp, 10));
    else player.setProp(parseInt(comp, 10), d, parseInt(tex, 10));
});

// оружие

const WEAPON_PACK = [
    "weapon_pistol",
    "weapon_smg",
    "weapon_carbinerifle",
    "weapon_pumpshotgun",
    "weapon_sniperrifle",
    "weapon_grenade"
];

function giveWeapon(player, name, ammo) {
    const hash = hashOf(name);
    if (!hash) return false;
    player.giveWeapon(hash, Math.max(1, Math.min(9999, parseInt(ammo, 10) || 500)));
    return true;
}

mp.events.add("mod:weapon", (player, name, ammo) => {
    if (!giveWeapon(player, name, ammo)) return player.outputChatBox("!{#ff8080}Пустое имя оружия.");
    player.outputChatBox("Выдано: !{#7ec8ff}" + name + "!{#ffffff}, патронов " + (parseInt(ammo, 10) || 500));
});

mp.events.add("mod:weaponPack", (player, ammo) => {
    for (const name of WEAPON_PACK) giveWeapon(player, name, ammo);
    player.outputChatBox("Выдан набор: " + WEAPON_PACK.length + " стволов.");
});

mp.events.add("mod:ammo", (player, ammo) => {
    const count = Math.max(1, Math.min(9999, parseInt(ammo, 10) || 500));
    const current = player.weapon;
    if (!current || current === mp.joaat("weapon_unarmed")) {
        return player.outputChatBox("!{#ff8080}В руках ничего нет.");
    }
    player.giveWeapon(current, count);
    player.outputChatBox("Патронов добавлено: " + count);
});

mp.events.add("mod:weaponClear", (player) => {
    player.removeAllWeapons();
    player.outputChatBox("Оружие убрано.");
});

// мир

mp.events.add("mod:time", (player, hour, minute) => {
    const h = Math.max(0, Math.min(23, parseInt(hour, 10) || 0));
    const m = Math.max(0, Math.min(59, parseInt(minute, 10) || 0));
    mp.world.time.set(h, m, 0);
    mp.players.broadcast("Время: " + ("0" + h).slice(-2) + ":" + ("0" + m).slice(-2) + " (" + player.name + ")");
});

mp.events.add("mod:weather", (player, weather) => {
    const w = String(weather).toUpperCase();
    if (WEATHERS.indexOf(w) === -1) return player.outputChatBox("!{#ff8080}Нет такой погоды.");
    mp.world.weather = w;
    mp.players.broadcast("Погода: " + w + " (" + player.name + ")");
});

// команды

mp.events.addCommand("veh", (player, _, model) => spawnVehicle(player, model, false));
mp.events.addCommand("vehin", (player, _, model) => spawnVehicle(player, model, true));
mp.events.addCommand("dv", (player) => mp.events.call("mod:deleteLast", player));
mp.events.addCommand("dvall", (player) => mp.events.call("mod:deleteAll", player));
mp.events.addCommand("fix", (player) => mp.events.call("mod:fix", player));
mp.events.addCommand("skin", (player, _, model) => mp.events.call("mod:skin", player, model));

mp.events.addCommand("weapon", (player, _, name, ammo) => {
    if (name === undefined) return player.outputChatBox("/weapon имя [патроны], например /weapon weapon_pistol 500");
    mp.events.call("mod:weapon", player, name, ammo || 500);
});

mp.events.addCommand("ammo", (player, _, count) => mp.events.call("mod:ammo", player, count || 500));
mp.events.addCommand("guns", (player, _, ammo) => mp.events.call("mod:weaponPack", player, ammo || 500));
mp.events.addCommand("delweapons", (player) => mp.events.call("mod:weaponClear", player));

mp.events.addCommand("time", (player, _, h, m) => {
    if (h === undefined) return player.outputChatBox("/time час [минуты]");
    mp.events.call("mod:time", player, h, m || 0);
});

mp.events.addCommand("weather", (player, _, w) => {
    if (w === undefined) return player.outputChatBox("Погоды: " + WEATHERS.join(", "));
    mp.events.call("mod:weather", player, w);
});

mp.events.addCommand("tpxyz", (player, _, x, y, z) => {
    if (x === undefined || y === undefined) return player.outputChatBox("/tpxyz x y z");
    const px = parseFloat(String(x).replace(",", "."));
    const py = parseFloat(String(y).replace(",", "."));
    const pz = z === undefined ? NaN : parseFloat(String(z).replace(",", "."));
    if (isNaN(px) || isNaN(py)) return player.outputChatBox("!{#ff8080}Кривые координаты.");
    player.call("mod:client:tpxyz", [px, py, isNaN(pz) ? null : pz]);
});

mp.events.addCommand("tp", (player, _, id) => {
    const target = mp.players.at(parseInt(id, 10));
    if (!target || target === player) return player.outputChatBox("!{#ff8080}Игрок не найден.");
    const p = target.position;
    player.position = new mp.Vector3(p.x + 1.5, p.y + 1.5, p.z);
    player.dimension = target.dimension;
    player.outputChatBox("Телепорт к " + target.name);
});

mp.events.addCommand("pos", (player) => player.call("mod:client:pos"));

mp.events.addCommand("dim", (player, _, id) => {
    const d = parseInt(id, 10) || 0;
    player.dimension = d;
    for (const veh of ownedVehicles(player)) veh.dimension = d;
    player.outputChatBox("Измерение: " + d);
});

mp.events.addCommand("help", (player) => {
    player.outputChatBox("Меню — 1, ноуклип — H, телепорт на метку — J");
    player.outputChatBox("/veh /vehin /dv /dvall /fix /skin /tpxyz /tp /dim /time /weather /pos");
});
