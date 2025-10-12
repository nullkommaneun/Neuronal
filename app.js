document.addEventListener('DOMContentLoaded', () => {
    // --- Globale Variablen und Konfiguration ---
    const canvas = document.getElementById('simulation-canvas');
    const ctx = canvas.getContext('2d');
    const startStopBtn = document.getElementById('start-stop-btn');
    const exportSvgBtn = document.getElementById('export-svg-btn');
    
    const areaEl = document.getElementById('metric-area');
    const lossEl = document.getElementById('metric-loss');
    const iterationEl = document.getElementById('metric-iteration');

    const diagOverlay = document.getElementById('diag-overlay');
    const minimizeDiagBtn = document.getElementById('minimize-diag');
    const showDiagBtn = document.getElementById('show-diag-btn');
    const exportLogBtn = document.getElementById('export-log-btn');
    const errorLogContainer = document.getElementById('error-log-container');
    const errorLogEl = document.getElementById('error-log');
    
    let logs = [];
    const log = (message, level = 'info') => {
        console.log(message);
        logs.push({ timestamp: new Date().toISOString(), level, message });
    };

    let isRunning = false;
    let iteration = 0;
    let model, optimizer;

    const CONFIG = {
        CANVAS_SIZE: Math.min(window.innerWidth * 0.9, window.innerHeight * 0.9, 500),
        GRID_RESOLUTION: 64,
        RENDER_RESOLUTION: 128,
        CORRIDOR_WIDTH: 1.0,
        LEARNING_RATE: 0.01,
        LAMBDA_COLLISION: 2.5
    };

    // --- Diagnose & Initialisierung (Aufgeteilt in schnelle und langsame Schritte) ---
    
    const setBadgeStatus = (id, status, text) => {
        const badge = document.getElementById(id);
        badge.className = 'badge'; // Reset classes
        badge.classList.add(status);
        badge.textContent = text;
    };
    
    // Schritt 1: Schnelle Checks, die die UI nicht blockieren
    const runInitialDiagnostics = () => {
        setBadgeStatus('badge-js', 'success', 'JS OK');
        log('JavaScript engine started.');

        if (typeof tf === 'undefined') {
            setBadgeStatus('badge-tfjs', 'error', 'TF.js Failed');
            log('TensorFlow.js library not found.', 'error');
            return false;
        }
        setBadgeStatus('badge-tfjs', 'warn', 'TF.js Geladen');
        log(`TensorFlow.js version: ${tf.version.tfjs}`);

        const gl = document.createElement('canvas').getContext('webgl2');
        if (gl) {
            setBadgeStatus('badge-webgl', 'success', 'WebGL2 OK');
        } else {
            setBadgeStatus('badge-webgl', 'warn', 'WebGL2 N/A');
        }

        try {
            if (typeof WebAssembly === "object") {
                 setBadgeStatus('badge-wasm', 'success', 'WASM OK');
            } else { throw new Error(); }
        } catch (e) {
            setBadgeStatus('badge-wasm', 'warn', 'WASM N/A');
        }
        return true;
    };
    
    // Schritt 2: Langsame, rechenintensive Initialisierung des TF-Backends
    const initializeTFBackend = async () => {
        try {
            const hasWebGL2 = !!document.createElement('canvas').getContext('webgl2');
            setBadgeStatus('badge-backend', 'warn', 'Initialisiere...');
            log('Attempting to set TensorFlow.js backend...');

            if (hasWebGL2) {
                await tf.setBackend('webgl');
            } else {
                await tf.setBackend('wasm');
            }
            await tf.ready();
            
            const backend = tf.getBackend();
            setBadgeStatus('badge-backend', 'success', `Backend: ${backend.toUpperCase()}`);
            log(`TensorFlow.js backend is ready: ${backend}`);
            return true;
        } catch (e) {
            setBadgeStatus('badge-backend', 'error', 'Backend Failed');
            log(`Failed to set TF.js backend: ${e.message}`, 'error');
            errorLogContainer.style.display = 'block';
            errorLogEl.textContent = e.stack;
            return false;
        }
    };


    // --- UI-Events ---
    minimizeDiagBtn.addEventListener('click', () => {
        diagOverlay.classList.add('minimized');
        showDiagBtn.classList.add('minimized');
    });
    showDiagBtn.addEventListener('click', () => {
        diagOverlay.classList.remove('minimized');
        showDiagBtn.classList.remove('minimized');
    });
    exportLogBtn.addEventListener('click', () => {
        const logData = { userAgent: navigator.userAgent, backend: tf.getBackend(), logs: logs };
        const encoded = btoa(JSON.stringify(logData));
        const logString = `MSP-LOG:v1:${encoded}`;
        navigator.clipboard.writeText(logString).then(() => alert('Log in die Zwischenablage kopiert!'));
    });
    startStopBtn.addEventListener('click', () => {
        isRunning = !isRunning;
        startStopBtn.textContent = isRunning ? 'Stop' : 'Start';
        if (isRunning) requestAnimationFrame(optimizationLoop);
    });
    exportSvgBtn.addEventListener('click', exportSVG);

    // --- Modell & Simulation (Unverändert) ---

    const createModel = () => {
        const model = tf.sequential();
        model.add(tf.layers.dense({ inputShape: [2], units: 16, activation: 'tanh' }));
        model.add(tf.layers.dense({ units: 16, activation: 'tanh' }));
        model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));
        return model;
    };

    const lossFunction = (model) => {
        return tf.tidy(() => {
            const gridCoords = createGrid(CONFIG.GRID_RESOLUTION, 2.5);
            const shapeOutput = model.predict(gridCoords).squeeze();
            const area = tf.sum(shapeOutput);
            
            let totalCollision = tf.scalar(0.0);
            const steps = 20;
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const angle = -Math.PI / 2 * t;
                const offsetX = t < 0.5 ? 0 : (t - 0.5) * 2;
                const offsetY = t > 0.5 ? 0 : (0.5 - t) * 2;
                const transformedCoords = transformPoints(gridCoords, angle, offsetX, offsetY);
                totalCollision = tf.add(totalCollision, calculateCollision(transformedCoords, shapeOutput));
            }
            const collisionLoss = tf.mul(totalCollision, CONFIG.LAMBDA_COLLISION);
            const loss = tf.sub(tf.mul(area, -1), collisionLoss);
            return { loss, area: area.div(CONFIG.GRID_RESOLUTION**2), collisionLoss };
        });
    };
    
    const transformPoints = (points, angle, dx, dy) => {
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const rotMatrix = tf.tensor2d([[cosA, -sinA], [sinA, cosA]]);
        return tf.matMul(points, rotMatrix).add(tf.tensor2d([[dx, dy]]));
    };
    
    const calculateCollision = (points, shapeOutput) => {
        const x = points.slice([0, 0], [-1, 1]);
        const y = points.slice([0, 1], [-1, 1]);
        const W = CONFIG.CORRIDOR_WIDTH / 2;
        const wall1 = tf.relu(y.sub(W).mul(tf.cast(x.less(0), 'float32')));
        const wall2 = tf.relu(y.neg().sub(W).mul(tf.cast(x.less(0), 'float32')));
        const wall3 = tf.relu(x.sub(W).mul(tf.cast(y.less(0), 'float32')));
        const wall4 = tf.relu(x.neg().sub(W).mul(tf.cast(y.less(0), 'float32')));
        return tf.sum(wall1.add(wall2).add(wall3).add(wall4).mul(shapeOutput));
    };

    const createGrid = (resolution, scale) => {
        const linspace = tf.linspace(-scale / 2, scale / 2, resolution);
        const grid = tf.stack(tf.meshgrid(linspace, linspace), 2);
        return grid.reshape([-1, 2]);
    };

    // --- Visualisierung & Optimierung (Unverändert) ---

    const draw = async () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const scale = CONFIG.CANVAS_SIZE / 2.5;
        const center = CONFIG.CANVAS_SIZE / 2;
        const w = CONFIG.CORRIDOR_WIDTH * scale;
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(center + w / 2, center + w / 2);
        ctx.lineTo(center + w / 2, 0);
        ctx.moveTo(center - w / 2, 0);
        ctx.lineTo(center - w / 2, center - w / 2);
        ctx.lineTo(CONFIG.CANVAS_SIZE, center - w / 2);
        ctx.stroke();

        tf.tidy(() => {
            const renderGrid = createGrid(CONFIG.RENDER_RESOLUTION, 2.5);
            const shapeValues = model.predict(renderGrid).dataSync();
            const imageData = ctx.createImageData(CONFIG.RENDER_RESOLUTION, CONFIG.RENDER_RESOLUTION);
            for (let i = 0; i < shapeValues.length; i++) {
                imageData.data[i * 4] = 0;
                imageData.data[i * 4 + 1] = 123;
                imageData.data[i * 4 + 2] = 255;
                imageData.data[i * 4 + 3] = shapeValues[i] * 255;
            }
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = CONFIG.RENDER_RESOLUTION;
            tempCanvas.height = CONFIG.RENDER_RESOLUTION;
            tempCanvas.getContext('2d').putImageData(imageData, 0, 0);
            ctx.save();
            ctx.translate(center, center);
            ctx.scale(scale, -scale);
            ctx.translate(-1.25, -1.25);
            ctx.drawImage(tempCanvas, 0, 0, 2.5, 2.5);
            ctx.restore();
        });
    };

    const optimizationLoop = async () => {
        if (!isRunning) return;
        const { loss, area } = tf.tidy(() => {
            const { grads } = optimizer.computeGradients(() => lossFunction(model).loss);
            optimizer.applyGradients(grads);
            tf.dispose(grads);
            const { loss, area } = lossFunction(model);
            return { loss: loss.dataSync()[0], area: area.dataSync()[0] };
        });
        areaEl.textContent = area.toFixed(4);
        lossEl.textContent = loss.toFixed(4);
        iterationEl.textContent = iteration++;
        await draw();
        requestAnimationFrame(optimizationLoop);
    };

    function exportSVG() {
        alert("SVG-Export ist in diesem vereinfachten Beispiel nicht implementiert.");
    }

    // --- App Start ---
    const main = async () => {
        canvas.width = CONFIG.CANVAS_SIZE;
        canvas.height = CONFIG.CANVAS_SIZE;
        if (!runInitialDiagnostics()) {
            alert("Kritischer Fehler: Grundlegende Web-Technologien nicht verfügbar.");
            return;
        }

        // Starte die langsame Initialisierung NACHDEM die UI gezeichnet wurde.
        setTimeout(async () => {
            const backendReady = await initializeTFBackend();
            if (!backendReady) {
                alert("Anwendung konnte KI-Backend nicht initialisieren. Siehe Log für Details.");
                startStopBtn.textContent = "Fehler";
                return;
            }

            model = createModel();
            optimizer = tf.train.adam(CONFIG.LEARNING_RATE);
            document.querySelector('#diag-content p').style.display = 'none';
            await draw();
            startStopBtn.disabled = false;
            exportSvgBtn.disabled = false;
            startStopBtn.textContent = "Start";
            log('Application is ready.');
        }, 100);
    };

    main();
});
