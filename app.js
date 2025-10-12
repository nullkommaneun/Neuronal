document.addEventListener('DOMContentLoaded', async () => {
    // --- Globale Variablen und Konfiguration ---
    const canvas = document.getElementById('simulation-canvas');
    const ctx = canvas.getContext('2d');
    const startStopBtn = document.getElementById('start-stop-btn');
    const exportSvgBtn = document.getElementById('export-svg-btn');
    
    // Metrik-Elemente
    const areaEl = document.getElementById('metric-area');
    const lossEl = document.getElementById('metric-loss');
    const iterationEl = document.getElementById('metric-iteration');

    // Diagnose-Overlay-Elemente
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
    let lastBestShape = { area: 0, contour: [] };

    const CONFIG = {
        CANVAS_SIZE: Math.min(window.innerWidth * 0.9, window.innerHeight * 0.9, 500),
        GRID_RESOLUTION: 64, // Auflösung für Flächen- und Kollisionsberechnung
        RENDER_RESOLUTION: 128, // Auflösung für die Visualisierung
        CORRIDOR_WIDTH: 1.0,
        LEARNING_RATE: 0.01,
        LAMBDA_COLLISION: 2.5 // Gewicht für Kollisionsverlust
    };

    // --- Initialisierung & Diagnose ---
    
    const setBadgeStatus = (id, status, text) => {
        const badge = document.getElementById(id);
        badge.classList.remove('success', 'error', 'warn');
        badge.classList.add(status);
        badge.textContent = text;
    };

    const runDiagnostics = async () => {
        // JS
        setBadgeStatus('badge-js', 'success', 'JS OK');
        log('JavaScript engine started.');

        // TF.js
        if (typeof tf === 'undefined') {
            setBadgeStatus('badge-tfjs', 'error', 'TF.js Failed');
            log('TensorFlow.js library not found.', 'error');
            return false;
        }
        setBadgeStatus('badge-tfjs', 'success', 'TF.js Loaded');
        log(`TensorFlow.js version: ${tf.version.tfjs}`);

        // WebGL2
        const canvasTest = document.createElement('canvas');
        const gl = canvasTest.getContext('webgl2');
        if (gl) {
            setBadgeStatus('badge-webgl', 'success', 'WebGL2 Supported');
            log('WebGL2 is supported.');
        } else {
            setBadgeStatus('badge-webgl', 'warn', 'WebGL2 N/A');
            log('WebGL2 not supported.', 'warn');
        }

        // WASM
        try {
            if (typeof WebAssembly === "object" && typeof WebAssembly.instantiate === "function") {
                const module = new WebAssembly.Module(Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00));
                if (module instanceof WebAssembly.Module) {
                     setBadgeStatus('badge-wasm', 'success', 'WASM Supported');
                     log('WebAssembly is supported.');
                } else { throw new Error(); }
            } else { throw new Error(); }
        } catch (e) {
            setBadgeStatus('badge-wasm', 'error', 'WASM N/A');
            log('WebAssembly not supported.', 'error');
        }

        // TF Backend
        try {
            if (gl) {
                await tf.setBackend('webgl');
            } else {
                await tf.setBackend('wasm');
            }
            await tf.ready();
            const backend = tf.getBackend();
            setBadgeStatus('badge-backend', 'success', `Backend: ${backend.toUpperCase()}`);
            log(`TensorFlow.js backend set to: ${backend}`);
        } catch (e) {
            setBadgeStatus('badge-backend', 'error', 'Backend Failed');
            log(`Failed to set TF.js backend: ${e.message}`, 'error');
            errorLogContainer.style.display = 'block';
            errorLogEl.textContent = e.stack;
            return false;
        }
        
        document.getElementById('diag-content').querySelector('p').style.display = 'none';
        return true;
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
        const logData = {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            config: CONFIG,
            backend: tf.getBackend(),
            logs: logs
        };
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

    // --- Modell & Simulation ---

    const createModel = () => {
        const model = tf.sequential();
        model.add(tf.layers.dense({ inputShape: [2], units: 16, activation: 'tanh' }));
        model.add(tf.layers.dense({ units: 16, activation: 'tanh' }));
        model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' })); // Sigmoid gibt Werte zwischen 0 und 1 aus
        return model;
    };

    const lossFunction = (model) => {
        return tf.tidy(() => {
            // 1. Grid für Berechnungen erstellen
            const gridCoords = createGrid(CONFIG.GRID_RESOLUTION, 2.5); // Größeres Feld für Form
            
            // 2. Form-Ausgabe des Modells berechnen
            const shapeOutput = model.predict(gridCoords).squeeze();
            
            // 3. Fläche berechnen (Summe der Aktivierungen)
            const area = tf.sum(shapeOutput);

            // 4. Kollisionen berechnen
            const steps = 20; // Anzahl der Schritte durch den Korridor
            let totalCollision = tf.scalar(0.0);

            for (let i = 0; i <= steps; i++) {
                const t = i / steps; // Fortschritt von 0 bis 1
                const angle = -Math.PI / 2 * t;
                const offsetX = t < 0.5 ? 0 : (t - 0.5) * 2;
                const offsetY = t > 0.5 ? 0 : (0.5 - t) * 2;
                
                // Transformiere Gitterpunkte
                const transformedCoords = transformPoints(gridCoords, angle, offsetX, offsetY);
                
                // Kollisionsberechnung für diesen Schritt
                const collision = calculateCollision(transformedCoords, shapeOutput);
                totalCollision = tf.add(totalCollision, collision);
            }

            // 5. Gesamtverlust
            const collisionLoss = tf.mul(totalCollision, CONFIG.LAMBDA_COLLISION);
            const loss = tf.sub(tf.mul(area, -1), collisionLoss); // -Area, um sie zu maximieren
            
            return { loss, area: area.div(CONFIG.GRID_RESOLUTION**2), collisionLoss };
        });
    };
    
    const transformPoints = (points, angle, dx, dy) => {
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const rotMatrix = tf.tensor2d([[cosA, -sinA], [sinA, cosA]]);
        let rotatedPoints = tf.matMul(points, rotMatrix);
        return rotatedPoints.add(tf.tensor2d([[dx, dy]]));
    };
    
    const calculateCollision = (points, shapeOutput) => {
        const x = points.slice([0, 0], [-1, 1]);
        const y = points.slice([0, 1], [-1, 1]);

        // Korridorgrenzen (Wände)
        const wall1 = tf.relu(y.sub(CONFIG.CORRIDOR_WIDTH / 2).mul(tf.cast(x.less(0), 'float32')));
        const wall2 = tf.relu(y.neg().sub(-CONFIG.CORRIDOR_WIDTH / 2).mul(tf.cast(x.less(0), 'float32')));
        const wall3 = tf.relu(x.sub(CONFIG.CORRIDOR_WIDTH / 2).mul(tf.cast(y.less(0), 'float32')));
        const wall4 = tf.relu(x.neg().sub(-CONFIG.CORRIDOR_WIDTH / 2).mul(tf.cast(y.less(0), 'float32')));
        
        const collisionPerPoint = wall1.add(wall2).add(wall3).add(wall4);
        return tf.sum(collisionPerPoint.mul(shapeOutput)); // Gewichte Kollision mit "Masse" des Sofas
    };

    const createGrid = (resolution, scale) => {
        const linspace = tf.linspace(-scale / 2, scale / 2, resolution);
        const grid = tf.stack(tf.meshgrid(linspace, linspace), 2);
        return grid.reshape([-1, 2]);
    };

    // --- Visualisierung ---

    const draw = async () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Korridor zeichnen
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

        // Sofa-Form zeichnen
        const renderGrid = createGrid(CONFIG.RENDER_RESOLUTION, 2.5);
        const shapeValues = await model.predict(renderGrid).data();
        renderGrid.dispose();
        
        const imageData = ctx.createImageData(CONFIG.RENDER_RESOLUTION, CONFIG.RENDER_RESOLUTION);
        const contourPoints = [];
        
        for (let i = 0; i < shapeValues.length; i++) {
            const alpha = shapeValues[i] * 255;
            imageData.data[i * 4] = 0;
            imageData.data[i * 4 + 1] = 123;
            imageData.data[i * 4 + 2] = 255;
            imageData.data[i * 4 + 3] = alpha;
        }

        // Marching Squares zur Konturfindung (vereinfacht)
        // Eine volle Marching-Squares-Implementierung ist komplex.
        // Hier zeichnen wir stattdessen die gefüllte Form.
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = CONFIG.RENDER_RESOLUTION;
        tempCanvas.height = CONFIG.RENDER_RESOLUTION;
        tempCanvas.getContext('2d').putImageData(imageData, 0, 0);
        
        ctx.save();
        ctx.translate(center, center);
        ctx.scale(scale, -scale); // y-Achse umkehren
        ctx.translate(-1.25, -1.25);
        ctx.drawImage(tempCanvas, 0, 0, 2.5, 2.5);
        ctx.restore();
    };

    // --- Optimierungs-Loop ---

    const optimizationLoop = async () => {
        if (!isRunning) return;

        const { loss, area, collisionLoss } = tf.tidy(() => {
            const { grads, value } = optimizer.computeGradients(() => lossFunction(model).loss);
            optimizer.applyGradients(grads);
            tf.dispose(grads);
            
            // Hole Werte für die Anzeige
            const { loss, area, collisionLoss } = lossFunction(model);
            return {
                loss: loss.dataSync()[0],
                area: area.dataSync()[0],
                collisionLoss: collisionLoss.dataSync()[0]
            };
        });
        
        areaEl.textContent = area.toFixed(4);
        lossEl.textContent = loss.toFixed(4);
        iterationEl.textContent = iteration++;

        if (collisionLoss < 0.001 && area > lastBestShape.area) {
            lastBestShape.area = area;
            // Hier würde die Kontur gespeichert, wenn Marching Squares implementiert ist
        }

        await draw();
        requestAnimationFrame(optimizationLoop);
    };

    // --- Export ---
    function exportSVG() {
        // Diese Funktion ist eine stark vereinfachte Version.
        // Eine echte Implementierung erfordert einen Marching Squares Algorithmus.
        alert("SVG-Export erfordert einen komplexen Marching-Squares-Algorithmus, der in diesem Beispiel nicht vollständig implementiert ist. Dies ist ein Platzhalter.");
        
        // Pseudocode für eine echte Implementierung:
        // 1. Führe Marching Squares auf dem `shapeValues`-Gitter aus.
        // 2. Erhalte eine Liste von Liniensegmenten für die Kontur.
        // 3. Konvertiere die Segmente in einen SVG-Pfadstring.
        // 4. Erstelle eine SVG-Datei und biete sie zum Download an.
        
        const svgContent = `<svg width="500" height="500" xmlns="http://www.w3.org/2000/svg">
            <path d="M100,100 L200,100 L200,200 Z" fill="#007bff" />
            <text x="50" y="50" fill="white">Platzhalter für beste Form</text>
        </svg>`;
        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sofa-shape.svg';
        a.click();
        URL.revokeObjectURL(url);
    }

    // --- App Start ---
    const main = async () => {
        canvas.width = CONFIG.CANVAS_SIZE;
        canvas.height = CONFIG.CANVAS_SIZE;

        const ready = await runDiagnostics();
        if (!ready) {
            alert("Die Anwendung konnte nicht initialisiert werden. Bitte prüfen Sie das Diagnose-Log.");
            return;
        }

        model = createModel();
        optimizer = tf.train.adam(CONFIG.LEARNING_RATE);

        await draw(); // Zeichne die initiale (zufällige) Form
    };

    main();
});
