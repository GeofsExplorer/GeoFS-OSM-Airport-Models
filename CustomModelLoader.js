// ==UserScript==
// @name         GeoFS Static Model Loader
// @namespace    geofs-custom
// @version      2
// @description  Loads static models in GeoFS with a GUI for real-time adjustments. Toggle button fixed at top-right GeoFS-style, always visible. Min altitude -5 for fine tuning.
// @author       thegreen121 (GXRdev)
// @match        *://www.geo-fs.com/*
// @grant        none
// ==/UserScript==

(function () {
    "use strict";

    /* ================= MODEL CONFIG ================= */
    /* Put the model URL in the modelUrl section, and approximate coordinates (right click on google maps in the location and insert the lat + lon here) */
    /* Keep altitude and heading as-is here as you will be able to fine tune all except scale, which you need to manually insert if it's greater than 5. */
    const MODELS = [
        {
            name: "Name",
            modelUrl: "URL",
            lat: 0,
            lon: 0,
            alt: 100,
            heading: 90,
            scale: 1,
            entity: null
        }
    ];

    /* ================= CORE LOGIC ================= */
    let viewer;
    let isDragging = false;
    let dragOffsetX, dragOffsetY;
    const initialConfig = JSON.parse(JSON.stringify(MODELS[0]));

    const wait = setInterval(() => {
        if (
            window.geofs &&
            geofs.api &&
            (viewer = geofs.api.viewer) &&
            typeof Cesium !== "undefined"
        ) {
            clearInterval(wait);
            setTimeout(init, 2000);
        }
    }, 1000);

    function init() {
        console.log("✅ GeoFS ready — loading static models and creating GUI");
        MODELS.forEach(cfg => loadModel(cfg));
        createGUI();
    }

    function loadModel(cfg) {
        const position = Cesium.Cartesian3.fromDegrees(cfg.lon, cfg.lat, cfg.alt);
        const orientation = Cesium.Transforms.headingPitchRollQuaternion(
            position,
            new Cesium.HeadingPitchRoll(
                Cesium.Math.toRadians(cfg.heading),
                0,
                0
            )
        );
        const entity = viewer.entities.add({
            name: cfg.name,
            position: new Cesium.ConstantPositionProperty(position),
            orientation: new Cesium.ConstantProperty(orientation),
            model: {
                uri: cfg.modelUrl,
                scale: cfg.scale,
                minimumPixelSize: 128,
                maximumScale: 5000
            }
        });
        cfg.entity = entity;
        console.log(`✅ Loaded model: ${cfg.name}`, entity);
    }

    function updateModel(cfg) {
        if (!cfg.entity) return;
        const newPosition = Cesium.Cartesian3.fromDegrees(cfg.lon, cfg.lat, cfg.alt);
        cfg.entity.position.setValue(newPosition);
        const newOrientation = Cesium.Transforms.headingPitchRollQuaternion(
            newPosition,
            new Cesium.HeadingPitchRoll(
                Cesium.Math.toRadians(cfg.heading),
                0,
                0
            )
        );
        cfg.entity.orientation.setValue(newOrientation);
        cfg.entity.model.scale = cfg.scale;
        console.log(`Updated ${cfg.name}: Lat ${cfg.lat.toFixed(4)}, Lon ${cfg.lon.toFixed(4)}, Alt ${cfg.alt.toFixed(2)}, Heading ${cfg.heading.toFixed(1)}, Scale ${cfg.scale.toFixed(2)}`);
    }

    /* ================= GUI LOGIC ================= */
    function createGUI() {
        const cfg = MODELS[0];
        const panelId = 'geofs-model-loader-gui';
        const toggleId = 'geofs-model-loader-toggle';

        // Panel
        const panel = document.createElement('div');
        panel.id = panelId;
        panel.style.cssText = `
            position: fixed;
            top: 60px;
            right: 10px;
            background: rgba(0,0,0,0.85);
            color: white;
            padding: 15px;
            font-family: Arial, sans-serif;
            z-index: 999999;
            width: 320px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            resize: none;
            display: none;
            cursor: grab;
        `;
        document.body.appendChild(panel);

        // Top-right GeoFS-style toggle button (with fallback styles)
        const btnInterval = setInterval(() => {
            if (!document.getElementById(toggleId)) {
                const toggleBtn = document.createElement('div');
                toggleBtn.id = toggleId;
                toggleBtn.textContent = '📐 MODEL CONFIG';
                toggleBtn.classList.add('geofs-autopilot-control'); // GeoFS style

                // Fallback visible styling
                toggleBtn.style.cssText = `
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    z-index: 999999;
                    cursor: pointer;
                    line-height: 25px;
                    text-align: center;
                    padding: 3px 8px;
                    background: rgba(50,50,50,0.8);
                    color: white;
                    border-radius: 12px;
                    font-weight: bold;
                `;

                toggleBtn.onclick = () => {
                    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
                    toggleBtn.classList.toggle('geofs-autopilot-control-active');
                };
                document.body.appendChild(toggleBtn);
                clearInterval(btnInterval);
            }
        }, 500);

        // Panel content
        panel.innerHTML = `
            <div style="cursor: move; margin-bottom: 10px; font-weight: bold; border-bottom: 1px solid #444;">${cfg.name} Controls</div>
            ${createSlider('Latitude', 'lat', cfg.lat, initialConfig.lat - 0.05, initialConfig.lat + 0.05, 0.00001)}
            ${createSlider('Longitude', 'lon', cfg.lon, initialConfig.lon - 0.05, initialConfig.lon + 0.05, 0.00001)}
            ${createSlider('Altitude (m)', 'alt', cfg.alt, -5, 10000, 0.01)}
            ${createSlider('Heading (°)', 'heading', cfg.heading, 0, 360, 0.1)}
            ${createSlider('Scale (x)', 'scale', cfg.scale, 0.1, 5, 0.001)}
            <div id="output-config" style="margin-top: 15px; padding: 10px; background: #333; border-radius: 4px; font-size: 11px;">
                Copy Config:<br>
                <textarea id="config-output-textarea" style="width:100%; height: 80px; background: #222; color: #ccf; border: none; padding: 5px; box-sizing: border-box;" readonly></textarea>
                <button id="copy-config-btn" style="width: 100%; margin-top: 5px; background: #007bff; color: white; border: none; padding: 5px; border-radius: 3px; cursor: pointer;">Copy to Clipboard</button>
            </div>
        `;

        // Slider events
        ['lat', 'lon', 'alt', 'heading', 'scale'].forEach(key => {
            const input = document.getElementById(`input-${key}`);
            const valueSpan = document.getElementById(`value-${key}`);
            if (input) {
                input.addEventListener('input', (e) => {
                    const value = parseFloat(e.target.value);
                    cfg[key] = value;
                    valueSpan.textContent = value.toFixed(key === 'lat' || key === 'lon' ? 5 : (key === 'alt' || key === 'scale' ? 2 : 1));
                    updateModel(cfg);
                    updateConfigOutput(cfg);
                });
                valueSpan.textContent = cfg[key].toFixed(key === 'lat' || key === 'lon' ? 5 : (key === 'alt' || key === 'scale' ? 2 : 1));
            }
        });

        // Copy config
        document.getElementById('copy-config-btn').addEventListener('click', () => {
            const textarea = document.getElementById('config-output-textarea');
            textarea.select();
            document.execCommand('copy');
            alert('New configuration copied to clipboard!');
        });

        updateConfigOutput(cfg);

        // Drag functionality
        panel.addEventListener('mousedown', startDrag);
        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('mousemove', drag);
        panel.querySelector('div').addEventListener('mousedown', startDrag);
    }

    function createSlider(label, key, value, min, max, step) {
        return `
            <div style="margin-bottom: 8px;">
                <label for="input-${key}" style="font-size: 13px;">${label}: <span id="value-${key}">${value.toFixed(key === 'lat' || key === 'lon' ? 5 : (key === 'alt' || key === 'scale' ? 2 : 1))}</span></label>
                <input type="range" id="input-${key}" min="${min}" max="${max}" value="${value}" step="${step}" style="width: 100%;"/>
            </div>
        `;
    }

    function updateConfigOutput(cfg) {
        const output = `
{
    name: "${cfg.name}",
    modelUrl: "${cfg.modelUrl}",
    lat: ${cfg.lat.toFixed(6)},
    lon: ${cfg.lon.toFixed(6)},
    alt: ${cfg.alt.toFixed(2)},
    heading: ${cfg.heading.toFixed(1)},
    scale: ${cfg.scale.toFixed(2)}
}
        `.trim();
        document.getElementById('config-output-textarea').value = output;
    }

    function startDrag(e) {
        if (['INPUT','BUTTON','TEXTAREA'].includes(e.target.tagName)) return;
        e.preventDefault();
        isDragging = true;
        const panel = document.getElementById('geofs-model-loader-gui');
        dragOffsetX = e.clientX - panel.getBoundingClientRect().left;
        dragOffsetY = e.clientY - panel.getBoundingClientRect().top;
        panel.style.cursor = 'grabbing';
    }

    function drag(e) {
        if (!isDragging) return;
        const panel = document.getElementById('geofs-model-loader-gui');
        panel.style.left = `${e.clientX - dragOffsetX}px`;
        panel.style.top = `${e.clientY - dragOffsetY}px`;
        panel.style.right = 'auto';
    }

    function stopDrag() {
        isDragging = false;
        const panel = document.getElementById('geofs-model-loader-gui');
        if (panel) panel.style.cursor = 'grab';
    }
})();
