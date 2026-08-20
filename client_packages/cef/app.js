(function () {
    "use strict";

    var WEATHERS = [
        ["EXTRASUNNY", "Ясно+"],
        ["CLEAR", "Ясно"],
        ["CLOUDS", "Облака"],
        ["SMOG", "Смог"],
        ["FOGGY", "Туман"],
        ["OVERCAST", "Пасмурно"],
        ["OVERCAST_DARK", "Тучи"],
        ["CLEARING", "Проясн."],
        ["RAIN", "Дождь"],
        ["THUNDER", "Гроза"],
        ["NEUTRAL", "Нейтр."],
        ["SNOW", "Снег"],
        ["SNOWLIGHT", "Снежок"],
        ["BLIZZARD", "Метель"],
        ["XMAS", "Рождество"],
        ["HALLOWEEN", "Хэллоуин"]
    ];

    var GUNS = [
        ["weapon_pistol", "Пистолет"],
        ["weapon_combatpistol", "Combat"],
        ["weapon_pistol50", "Pistol .50"],
        ["weapon_smg", "ПП"],
        ["weapon_microsmg", "Micro SMG"],
        ["weapon_carbinerifle", "Карабин"],
        ["weapon_assaultrifle", "АК"],
        ["weapon_specialcarbine", "Special"],
        ["weapon_pumpshotgun", "Дробовик"],
        ["weapon_sniperrifle", "Снайперка"],
        ["weapon_rpg", "РПГ"],
        ["weapon_knife", "Нож"],
        ["weapon_bat", "Бита"],
        ["weapon_grenade", "Граната"],
        ["weapon_stungun", "Тазер"],
        ["weapon_flashlight", "Фонарь"]
    ];

    var HISTORY_KEY = "modellers.history";
    var TAB_KEY = "modellers.tab";
    var MAX_HISTORY = 12;

    var noclip = false;
    var hudHidden = false;
    var mapVisible = true;

    function $(id) { return document.getElementById(id); }

    // мост в клиент
    function send() {
        var args = Array.prototype.slice.call(arguments);
        if (typeof mp !== "undefined" && mp.trigger) mp.trigger.apply(mp, args);
        else console.log("trigger", args);
    }

    function focusBridge(el) {
        el.addEventListener("focus", function () { send("mod:cef:focus", true); });
        el.addEventListener("blur", function () { send("mod:cef:focus", false); });
    }

    // тосты

    function toast(text, kind) {
        var box = $("toasts");
        var el = document.createElement("div");
        el.className = "toast " + (kind || "info");
        el.textContent = text;
        box.appendChild(el);
        setTimeout(function () {
            el.className += " out";
            setTimeout(function () { if (el.parentNode) box.removeChild(el); }, 300);
        }, 3200);
        while (box.children.length > 4) box.removeChild(box.firstChild);
    }

    // navigator.clipboard в cef не работает
    function copyText(text) {
        var area = document.createElement("textarea");
        area.value = text;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        try { document.execCommand("copy"); } catch (e) {}
        document.body.removeChild(area);
    }

    // вкладки

    function setTab(name) {
        var tabs = document.querySelectorAll(".tab");
        var pages = document.querySelectorAll(".page");
        for (var i = 0; i < tabs.length; i++) {
            tabs[i].className = "tab" + (tabs[i].getAttribute("data-tab") === name ? " active" : "");
        }
        for (var j = 0; j < pages.length; j++) {
            pages[j].className = "page" + (pages[j].getAttribute("data-page") === name ? " active" : "");
        }
        try { localStorage.setItem(TAB_KEY, name); } catch (e) { }
    }

    var tabButtons = document.querySelectorAll(".tab");
    for (var t = 0; t < tabButtons.length; t++) {
        (function (btn) {
            btn.addEventListener("click", function () { setTab(btn.getAttribute("data-tab")); });
        })(tabButtons[t]);
    }

    // история моделей

    function history() {
        try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
        catch (e) { return []; }
    }

    function pushHistory(model) {
        var list = history().filter(function (m) { return m.toLowerCase() !== model.toLowerCase(); });
        list.unshift(model);
        list = list.slice(0, MAX_HISTORY);
        try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); } catch (e) { }
        renderHistory();
    }

    function renderHistory() {
        var box = $("history");
        var list = history();
        box.innerHTML = "";
        if (!list.length) {
            box.innerHTML = '<span class="empty">пусто</span>';
            return;
        }
        list.forEach(function (model) {
            var chip = document.createElement("button");
            chip.className = "chip";
            chip.textContent = model;
            chip.addEventListener("click", function () {
                $("vehModel").value = model;
                spawn(false);
            });
            box.appendChild(chip);
        });
    }

    // транспорт

    function spawn(into) {
        var model = $("vehModel").value.trim();
        if (!model) return toast("Впиши модель", "warn");
        pushHistory(model);
        send("mod:cef:spawnVeh", model, into ? 1 : 0);
    }

    $("btnSpawn").addEventListener("click", function () { spawn(false); });
    $("btnSpawnIn").addEventListener("click", function () { spawn(true); });
    $("btnFix").addEventListener("click", function () { send("mod:cef:vehAction", "fix"); });
    $("btnDel").addEventListener("click", function () { send("mod:cef:vehAction", "delete"); });
    $("btnDelAll").addEventListener("click", function () { send("mod:cef:vehAction", "deleteAll"); });

    $("vehModel").addEventListener("keydown", function (e) {
        if (e.keyCode === 13) spawn(false);
    });

    function hexToRgb(hex) {
        var v = hex.replace("#", "");
        return [
            parseInt(v.substring(0, 2), 16),
            parseInt(v.substring(2, 4), 16),
            parseInt(v.substring(4, 6), 16)
        ];
    }

    $("btnColor").addEventListener("click", function () {
        var a = hexToRgb($("col1").value);
        var b = hexToRgb($("col2").value);
        send("mod:cef:vehColor", a[0], a[1], a[2], b[0], b[1], b[2]);
        toast("Покрашено", "ok");
    });

    // время и погода

    function pad(n) { return (n < 10 ? "0" : "") + n; }

    function applyTime() {
        var h = parseInt($("timeHour").value, 10);
        var m = parseInt($("timeMin").value, 10);
        $("timeValue").textContent = pad(h) + ":" + pad(m);
        send("mod:cef:time", h, m);
    }

    $("timeHour").addEventListener("input", applyTime);
    $("timeMin").addEventListener("input", applyTime);

    var presets = $("timePresets").querySelectorAll(".chip");
    for (var p = 0; p < presets.length; p++) {
        (function (btn) {
            btn.addEventListener("click", function () {
                $("timeHour").value = btn.getAttribute("data-h");
                $("timeMin").value = 0;
                applyTime();
            });
        })(presets[p]);
    }

    (function buildWeathers() {
        var box = $("weathers");
        WEATHERS.forEach(function (item) {
            var btn = document.createElement("button");
            btn.className = "btn";
            btn.textContent = item[1];
            btn.title = item[0];
            btn.addEventListener("click", function () {
                var all = box.querySelectorAll(".btn");
                for (var i = 0; i < all.length; i++) all[i].className = "btn";
                btn.className = "btn on";
                send("mod:cef:weather", item[0]);
            });
            box.appendChild(btn);
        });
    })();

    // телепорт

    $("btnTp").addEventListener("click", function () {
        var x = $("tpX").value.trim().replace(",", ".");
        var y = $("tpY").value.trim().replace(",", ".");
        var z = $("tpZ").value.trim().replace(",", ".");
        if (!x || !y) return toast("Нужны хотя бы X и Y", "warn");
        send("mod:cef:tp", x, y, z);
    });

    $("btnTpWay").addEventListener("click", function () { send("mod:cef:waypoint"); });

    // "x, y, z" в поле X разносится по трём
    $("tpX").addEventListener("input", function () {
        var parts = $("tpX").value.split(/[,;\s]+/).filter(function (s) { return s.length; });
        if (parts.length >= 2) {
            $("tpX").value = parts[0];
            $("tpY").value = parts[1];
            if (parts[2]) $("tpZ").value = parts[2];
        }
    });

    // игрок

    $("btnSkin").addEventListener("click", function () {
        var model = $("skinModel").value.trim();
        if (!model) return toast("Впиши модель педа", "warn");
        send("mod:cef:skin", model);
    });

    $("btnSkinReset").addEventListener("click", function () { send("mod:cef:skinReset"); });

    $("btnCloth").addEventListener("click", function () {
        send("mod:cef:cloth", $("clComp").value.trim(), $("clDraw").value.trim(), $("clTex").value.trim());
    });

    $("btnProp").addEventListener("click", function () {
        send("mod:cef:prop", $("clComp").value.trim(), $("clDraw").value.trim(), $("clTex").value.trim());
    });

    $("btnNoclip").addEventListener("click", function () { send("mod:cef:noclip", !noclip); });

    $("speed").addEventListener("input", function () {
        var value = parseInt($("speed").value, 10) / 100;
        $("speedValue").textContent = value.toFixed(2);
        $("badgeSpeed").textContent = value.toFixed(2);
        send("mod:cef:speed", value);
    });

    $("btnHud").addEventListener("click", function () {
        hudHidden = !hudHidden;
        $("btnHud").className = "btn grow" + (hudHidden ? " on" : "");
        $("btnHud").textContent = hudHidden ? "Вернуть интерфейс игры" : "Скрыть интерфейс игры";
        send("mod:cef:hud", hudHidden);
    });

    // карта

    $("btnMap").addEventListener("click", function () {
        send("mod:cef:map", !mapVisible);
    });

    // оружие

    function giveGun(name) {
        var ammo = parseInt($("gunAmmo").value, 10) || 500;
        send("mod:cef:weapon", name, ammo);
    }

    $("btnGun").addEventListener("click", function () {
        var name = $("gunModel").value.trim();
        if (!name) return toast("Впиши оружие", "warn");
        giveGun(name);
    });

    $("gunModel").addEventListener("keydown", function (e) {
        if (e.keyCode === 13) $("btnGun").click();
    });

    $("btnGunPack").addEventListener("click", function () {
        send("mod:cef:weaponPack", parseInt($("gunAmmo").value, 10) || 500);
    });

    $("btnAmmo").addEventListener("click", function () {
        send("mod:cef:ammo", parseInt($("gunAmmo").value, 10) || 500);
    });

    $("btnGunClear").addEventListener("click", function () { send("mod:cef:weaponClear"); });

    (function buildGuns() {
        var box = $("gunPresets");
        GUNS.forEach(function (item) {
            var chip = document.createElement("button");
            chip.className = "chip";
            chip.textContent = item[1];
            chip.title = item[0];
            chip.addEventListener("click", function () {
                $("gunModel").value = item[0];
                giveGun(item[0]);
            });
            box.appendChild(chip);
        });
    })();

    $("btnCopyPos").addEventListener("click", function () { send("mod:cef:copyPos"); });
    $("btnClose").addEventListener("click", function () { send("mod:cef:close"); });

    var inputs = document.querySelectorAll('input[type="text"]');
    for (var i = 0; i < inputs.length; i++) focusBridge(inputs[i]);

    // api для клиента

    window.ui = {
        setOpen: function (state) {
            $("panel").className = "panel" + (state ? " open" : "");
            if (!state) {
                var active = document.activeElement;
                if (active && active.blur) active.blur();
                send("mod:cef:focus", false);
            }
        },
        setState: function (state) {
            window.ui.setOpen(!!state.open);
            window.ui.setNoclip(!!state.noclip);
            window.ui.setSpeed(state.speed || 0.6);
            window.ui.setMap(state.map !== false);
        },
        setMap: function (visible) {
            mapVisible = !!visible;
            $("btnMap").className = "btn grow" + (mapVisible ? "" : " on");
            $("btnMap").textContent = mapVisible ? "Убрать Лос-Сантос" : "Вернуть Лос-Сантос";
        },
        setNoclip: function (state) {
            noclip = !!state;
            $("badge").className = "badge" + (noclip ? "" : " hidden");
            $("btnNoclip").className = "btn grow" + (noclip ? " on" : "");
            $("btnNoclip").textContent = noclip ? "Выключить (H)" : "Включить (H)";
        },
        setSpeed: function (value) {
            $("speed").value = Math.round(value * 100);
            $("speedValue").textContent = value.toFixed(2);
            $("badgeSpeed").textContent = value.toFixed(2);
        },
        pos: function (x, y, z, h) {
            $("posText").textContent = x + ", " + y + ", " + z + "  ·  " + h + "°";
        },
        toast: toast,
        copy: copyText
    };

    // старт

    renderHistory();
    try {
        var saved = localStorage.getItem(TAB_KEY);
        if (saved) setTab(saved);
    } catch (e) { }

    send("mod:cef:ready");
})();
