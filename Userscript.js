// ==UserScript==
// @name         GeoFS OSM Airport Models (JSON Loader)
// @namespace    geofs-custom
// @version      Auto
// @description  Loads airport building models from an external JSON file with smart distance/altitude unloading
// @author       thegreen121 (GXRdev)
// @match        *://www.geo-fs.com/*
// @grant        none
// ==/UserScript==

(function () {
    "use strict";

    const JSON_URL = "https://raw.githubusercontent.com/greenairways/GeoFS-OSM-Airport-Models/refs/heads/main/airportdata.json";

    const MAX_ALTITUDE_FT = 18000; // feet
    const MAX_DISTANCE_NM = 30;    // nautical miles

    const loadedModels = [];

    // Wait for GeoFS + Cesium
    const checkInterval = setInterval(() => {
        if (typeof geofs !== "undefined" &&
            geofs.api &&
            geofs.api.viewer &&
            geofs.aircraft &&
            typeof Cesium !== "undefined") {

            clearInterval(checkInterval);
            setTimeout(loadAirportJSON, 1500);
            setInterval(updateModelVisibility, 2000);
        }
    }, 1500);

    // --- Load JSON ---
    function loadAirportJSON() {
        console.log("📡 Fetching airport model list from JSON…");

        fetch(JSON_URL)
            .then(r => r.json())
            .then(json => json.forEach(addModel))
            .catch(err => console.error("❌ JSON load failed:", err));
    }

    // --- Add model ---
    function addModel({ name, modelUrl, lat, lon, alt, heading, scale }) {

        if (geofs.api.viewer.entities.values.some(e => e.name === name)) return;

        const position = Cesium.Cartesian3.fromDegrees(lon, lat, alt);

        const orientation = Cesium.Transforms.headingPitchRollQuaternion(
            position,
            new Cesium.HeadingPitchRoll(
                Cesium.Math.toRadians(heading || 0), 0, 0
            )
        );

        const entity = geofs.api.viewer.entities.add({
            name,
            position,
            orientation,
            show: true,
            model: {
                uri: modelUrl,
                scale: scale || 1,
                minimumPixelSize: 128,
                maximumScale: 2000
            }
        });

        loadedModels.push({
            entity,
            lat,
            lon
        });

        console.log(`✅ Loaded model: ${name}`);
    }

    // --- Visibility logic ---
    function updateModelVisibility() {
        if (!geofs.aircraft.instance) return;

        const aircraft = geofs.aircraft.instance;
        const acLat = aircraft.llaLocation[0];
        const acLon = aircraft.llaLocation[1];
        const acAltFt = aircraft.llaLocation[2] * 3.28084;

        loadedModels.forEach(m => {
            const distanceNm = getDistanceNM(acLat, acLon, m.lat, m.lon);

            const shouldShow =
                acAltFt <= MAX_ALTITUDE_FT &&
                distanceNm <= MAX_DISTANCE_NM;

            if (m.entity.show !== shouldShow) {
                m.entity.show = shouldShow;
            }
        });
    }

    // --- Distance calc (NM) ---
    function getDistanceNM(lat1, lon1, lat2, lon2) {
        const R = 3440.065; // Earth radius NM
        const toRad = d => d * Math.PI / 180;

        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);

        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;

        return 2 * R * Math.asin(Math.sqrt(a));
    }

})();
