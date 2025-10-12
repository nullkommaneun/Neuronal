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
        GRID_RESOLUTION: 50, // Reduziert für bessere Performance auf mobilen Geräten
        RENDER_RESOLUTION: 96, // Reduziert für bessere Performance
        CORRIDOR_WIDTH: 1.0,
        LEARNING_RATE: 0.015,
        LAMBDA_COLLISION: 2.5,
        // NEU: Wie viele Trainingsschritte pro sichtbarem Frame?
        TRAINING_STEPS_PER_FRAME: 5 
    };

    // --- Diagnose & Initialisierung (Unverändert) ---
    
    const setBadgeStatus = (id, status, text) => {
        const badge = document.getElementById(id);
        badge.className = 'badge';
        badge.classList.add(status);
        badge.textContent = text;
    };
    
    const runInitialDiagnostics = () => {
        setBadgeStatus('badge-js', 'success', 'JS OK');
        log('JavaScript engine started.');
        if (typeof tf === 'undefined') { setBadgeStatus('badge-tfjs', 'error', 'TF.js Failed'); return false; }
        setBadgeStatus('badge-tfjs', 'warn', 'TF.js Geladen');
        log(`TensorFlow.js version: ${tf.version.tfjs}`);
        if (!!document.createElement('canvas').getContext('webgl2')) setBadgeStatus('badge-webgl', 'success', 'WebGL2 OK'); else setBadgeStatus('badge-webgl', 'warn', 'WebGL2 N/A');
        if (typeof WebAssembly === "object") setBadgeStatus('badge-wasm', 'success', 'WASM OK'); else setBadgeStatus('badge-wasm', 'warn', 'WASM N/A');
        return true;
    };
    
    const initializeTFBackend = async () => {
        try {
            setBadgeStatus('badge-backend', 'warn', 'Initialisiere...');
            log('Attempting to set TensorFlow.js backend...');
            await tf.setBackend(!!document.createElement('canvas').getContext('webgl2') ? 'webgl' : 'wasm');
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

    // --- UI-Events (Unverändert) ---
    minimizeDiagBtn.addEventListener('click', () => { diagOverlay.classList.add('minimized'); showDiagBtn.classList.add('minimized'); });
    showDiagBtn.addEventListener('click', () => { diagOverlay.classList.remove('minimized'); showDiagBtn.classList.remove('minimized'); });
    exportLogBtn.addEventListener('click', () => {
        const logData = { userAgent: navigator.userAgent, backend: tf.getBackend(), logs: logs };
        const encoded = btoa(JSON.stringify(logData));
        navigator.clipboard.writeText(`MSP-LOG:v1:${encoded}`).then(() => alert('Log in die Zwischenablage kopiert!'));
    });
    startStopBtn.addEventListener('click', () => {
        isRunning = !isRunning;
        startStopBtn.textContent = isRunning ? 'Stop' : 'Start';
        if (isRunning) requestAnimationFrame(optimizationLoop);
    });
    exportSvgBtn.addEventListener('click', () => alert("SVG-Export ist in diesem Beispiel nicht implementiert."));

    // --- Modell & Simulation (Unverändert) ---

    const createModel = () => {
        const model = tf.sequential();
        model.add(tf.layers.dense({ inputShape: [2], units: 16, activation: 'tanh' }));
        model.add(tf.layers.dense({ units: 16, activation: 'tanh' }));
        model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));
        return model;
    };

    const trainStep = () => {
        const { loss, area } = tf.tidy(() => {
            const { grads, value } = optimizer.computeGradients(() => {
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
                return tf.sub(tf.mul(area, -1), collisionLoss);
            });
            optimizer.applyGradients(grads);
            tf.dispose(grads);
            
            // Berechne Metriken erneut für die Anzeige
            const grid = createGrid(CONFIG.GRID_RESOLUTION, 2.5);
            const shape = model.predict(grid).squeeze();
            const currentArea = tf.sum(shape).div(CONFIG.GRID_RESOLUTION**2);
            return { loss: value, area: currentArea };
        });
        return { loss: loss.dataSync()[0], area: area.dataSync()[0] };
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

    const createGrid = (resolution, scale) => tf.tidy(() => {
        const linspace = tf.linspace(-scale / 2, scale / 2, resolution);
        const grid = tf.stack(tf.meshgrid(linspace, linspace), 2);
        return grid.reshape([-1, 2]);
    });

    // --- Visualisierung (Unverändert) ---

    const draw = () => {
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
                const alpha = shapeValues[i] * 255;
                imageData.data[i * 4] = 0; imageData.data[i * 4 + 1] = 123; imageData.data[i * 4 + 2] = 255; imageData.data[i * 4 + 3] = alpha;
            }
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = CONFIG.RENDER_RESOLUTION; tempCanvas.height = CONFIG.RENDER_RESOLUTION;
            tempCanvas.getContext('2d').putImageData(imageData, 0, 0);
            ctx.save();
            ctx.translate(center, center); ctx.scale(scale, -scale); ctx.translate(-1.25, -1.25);
            ctx.drawImage(tempCanvas, 0, 0, 2.5, 2.5);
            ctx.restore();
        });
    };

    // --- NEUER, PERFORMANTER Optimierungs-Loop ---

    const optimizationLoop = async () => {
        if (!isRunning) return;

        let totalLoss = 0;
        let finalArea = 0;
        
        // Führe mehrere Trainingsschritte ohne UI-Update durch
        for (let i = 0; i < CONFIG.TRAINING_STEPS_PER_FRAME; i++) {
            const { loss, area } = trainStep();
            totalLoss += loss;
            finalArea = area; // Nimm den letzten Wert
            iteration++;
        }

        // Aktualisiere die UI nur einmal am Ende des Batches
        areaEl.textContent = finalArea.toFixed(4);
        lossEl.textContent = (totalLoss / CONFIG.TRAINING_STEPS_PER_FRAME).toFixed(4);
        iterationEl.textContent = iteration;

        // Zeichne das Ergebnis
        draw();
        
        // WICHTIG: Gib dem Browser Zeit für andere Aufgaben, bevor der nächste Frame beginnt
        await tf.nextFrame();
        requestAnimationFrame(optimizationLoop);
    };

    // --- App Start (Unverändert) ---
    const main = async () => {
        canvas.width = CONFIG.CANVAS_SIZE;
        canvas.height = CONFIG.CANVAS_SIZE;
        if (!runInitialDiagnostics()) {
            alert("Kritischer Fehler: Grundlegende Web-Technologien nicht verfügbar."); return;
        }

        setTimeout(async () => {
            const backendReady = await initializeTFBackend();
            if (!backendReady) {
                alert("Anwendung konnte KI-Backend nicht initialisieren.");
                startStopBtn.textContent = "Fehler";
                return;
            }
            model = createModel();
            optimizer = tf.train.adam(CONFIG.LEARNING_RATE);
            document.querySelector('#diag-content p').style.display = 'none';
            draw();
            startStopBtn.disabled = false; exportSvgBtn.disabled = false;
            startStopBtn.textContent = "Start";
            log('Application is ready.');
        }, 100);
    };

    main();
});
