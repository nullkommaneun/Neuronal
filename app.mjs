// app.mjs (Optimiertes Rendering, Verbesserte Reaktionsfähigkeit)

// (Keine statischen Imports für Cache Busting)

// === Globale Variablen & UI-Elemente ===
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const debugOutput = document.getElementById('debug-output');
const phaseDisplay = document.getElementById('training-phase-display');
const collisionLossDisplay = document.getElementById('stats-collision-loss');
const areaRewardDisplay = document.getElementById('stats-area-reward');
const startStopButton = document.getElementById('start-stop-button');

let Corridor, Sofa;
let corridor, sofa;

let trainingPhase = 1;
const stabilityHistory = [];
const STABILITY_PERIOD = 100;
let animationT = 0;

let isRenderingRunning = false;
let isTrainingRunning = false;

let latestStats = { collisionLoss: 0, areaReward: 0 };

// === UI-Helfer ===
function updateDiagStatus(id, status) {
    const statusEl = document.querySelector(`#${id} .status`);
    if (statusEl) statusEl.className = `status ${status}`;
}
function log(message, isError = false) {
    const color = isError ? '#ff6b6b' : '#f1f1f1';
    debugOutput.innerHTML += `<div style="color: ${color};">> ${message}</div>`;
    debugOutput.scrollTop = debugOutput.scrollHeight;
}
function updateUI() {
    collisionLossDisplay.innerText = `Kollisionsverlust: ${latestStats.collisionLoss.toFixed(5)}`;
    areaRewardDisplay.innerText = `Flächen-Belohnung: ${latestStats.areaReward.toFixed(5)}`;
}
function handleFatalError(error, loopName) {
    log(`FATALER FEHLER im ${loopName}: ${error.message}`, true);
    console.error(error);
    isTrainingRunning = false;
    isRenderingRunning = false;
    startStopButton.innerText = "Fehler - Neu laden";
    startStopButton.disabled = true;
    startStopButton.classList.remove('running');
}

// === Unabhängige Trainingsschleife ===
async function trainingLoop() {
    if (!isTrainingRunning) return;

    try {
        let lambdaCollision, lambdaArea;

        // TRAININGSPHASEN
        if (trainingPhase === 1) {
            // Phase 1: Wachsen priorisieren
            lambdaCollision = 1.0; lambdaArea = 5.0;
            phaseDisplay.innerText = "Phase 1: Wachsen und Form finden";
        } else {
            // Phase 2: Kollisionen stark bestrafen
            lambdaCollision = 10.0; lambdaArea = 2.0;
            phaseDisplay.innerText = "Phase 2: Kollisionen eliminieren";
        }

        const stats = await sofa.trainStep(corridor, lambdaCollision, lambdaArea);

        if (stats && typeof stats.collisionLoss === 'number' && typeof stats.areaReward === 'number') {
            latestStats = stats;
        }

        updateUI();

        // LOGIK FÜR PHASENWECHSEL (Basierend auf Stabilität des Wachstums)
        if (trainingPhase === 1) {
            stabilityHistory.push(latestStats.areaReward);

            if (stabilityHistory.length > STABILITY_PERIOD) {
                stabilityHistory.shift();

                const avgTotal = stabilityHistory.reduce((a, b) => a + b, 0) / STABILITY_PERIOD;
                const recentHistory = stabilityHistory.slice(-10);
                const avgRecent = recentHistory.reduce((a, b) => a + b, 0) / 10;

                // Wechsle, wenn das Wachstum stabil ist und eine Mindestgröße erreicht wurde.
                if (Math.abs(avgRecent - avgTotal) < 0.0001 && avgTotal > 0.1) {
                    trainingPhase = 2;
                    log("WECHSLE ZU PHASE 2! (Wachstum stabilisiert)");
                }
            }
        }

        // (REAKTIONSFÄHIGKEIT) Warten auf den nächsten Animationsframe (ersetzt setTimeout(0)).
        // Dies gibt dem Browser Zeit zum Rendern der UI, bevor der nächste Schritt beginnt.
        await tf.nextFrame();
        // Rekursiver Aufruf für den nächsten Schritt.
        trainingLoop();

    } catch (error) {
        handleFatalError(error, "Training-Loop");
    }
}

// === Unabhängige Rendering-Schleife ===
async function renderingLoop() {
    if (!isRenderingRunning) return;
    try {
        await draw();
        requestAnimationFrame(renderingLoop);
    } catch (error) {
        handleFatalError(error, "Rendering-Loop");
    }
}


// === Zeichenfunktion (GRUNDLEGEND OPTIMIERT) ===
async function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (corridor) corridor.draw(ctx);

    if (sofa && sofa.model) {
        // Animationsposition aktualisieren
        animationT = (animationT + 0.005) % 1.0;
        const currentPos = sofa.getPointOnPath(corridor.path, animationT);

        // (PERFORMANCE) Hole Daten und Tensor gleichzeitig von der neuen Funktion.
        const shape = await sofa.getShapeForDrawing();
        const shapeValuesData = shape.data;   // CPU-Daten für Pixel
        const shapeValuesTensor = shape.tensor; // GPU-Tensor für Berechnung

        // --- Kollisionsberechnung für Färbung (Integriert und Optimiert) ---
        let maxDepth = 0;

        // 1. Finde Punkte im Inneren (GPU), nutze den Tensor.
        const isInside = shapeValuesTensor.greater(0).flatten();
        const indices = await tf.whereAsync(isInside);

        if (indices.shape[0] > 0) {
            // 2. Extrahiere Punkte (GPU).
            const points = tf.gather(sofa.grid, indices.flatten());
            // 3. Lade Punkte herunter (Async).
            const shapePointsArray = await points.array();
            points.dispose();

            // 4. Transformiere Punkte (CPU).
            const transformedPoints = sofa.transformPointsJS(shapePointsArray, currentPos.x, currentPos.y, currentPos.angle);

            // 5. Berechne Tiefe (CPU).
            if (transformedPoints && transformedPoints.length > 0) {
                maxDepth = Math.max(0, ...transformedPoints.map(p => corridor.getPenetrationDepth(p[0], p[1])));
            }
        }

        // WICHTIG: Speicherbereinigung der Tensoren.
        isInside.dispose();
        indices.dispose();
        shapeValuesTensor.dispose(); // Tensor aus getShapeForDrawing freigeben.

        // --- Färbung ---
        let sofaColor = 'rgba(46, 204, 113, 0.7)'; // Grün
        if (maxDepth > 0.1) sofaColor = 'rgba(231, 76, 60, 0.7)'; // Rot
        else if (maxDepth > 0) sofaColor = 'rgba(52, 152, 219, 0.7)'; // Blau

        // --- Zeichnen der Pixel ---
        ctx.fillStyle = sofaColor;
        ctx.save();
        ctx.translate(currentPos.x, currentPos.y);
        ctx.rotate(currentPos.angle);

        const res = sofa.gridResolution;
        const sofaScale = sofa.sofaScale;
        const pixelSize = (1 / res) * sofaScale;

        for (let i = 0; i < res; i++) {
            for (let j = 0; j < res; j++) {
                const index = i * res + j;
                // Nutze die heruntergeladenen Daten (shapeValuesData) für den Pixel-Check.
                if (shapeValuesData[index] > 0) {
                    const x = (j / res - 0.5) * sofaScale;
                    const y = (i / res - 0.5) * sofaScale;
                    ctx.fillRect(x, y, pixelSize, pixelSize);
                }
            }
        }
        ctx.restore();
    }
}

// === Haupt-Initialisierungsfunktion (Mit Cache Busting) ===
async function main() {
    try {
        log("Stufe 1: Lade JS/Module...");

        // CACHE BUSTING (Stellt sicher, dass das neue sofa.mjs geladen wird)
        const version = Date.now();
        // Nutze String-Verkettung für maximale Kompatibilität.
        const CorridorModule = await import('./corridor.mjs?v=' + version);
        const SofaModule = await import('./sofa.mjs?v=' + version);

        Corridor = CorridorModule.Corridor;
        Sofa = SofaModule.Sofa;

        updateDiagStatus('diag-js', 'success'); updateDiagStatus('diag-modules', 'success'); log("-> OK (Cache Busting aktiv)");

        log("Stufe 2: Lade TensorFlow.js..."); if (typeof tf === 'undefined') throw new Error("tf nicht gefunden."); updateDiagStatus('diag-tf', 'success'); log("-> OK");

        log("Stufe 3: Init TF Backend...");
        await tf.setBackend('webgl').catch(() => {
            log("WARNUNG: WebGL nicht verfügbar. Nutze CPU.", true);
            return tf.setBackend('cpu');
        });
        await tf.ready();
        updateDiagStatus('diag-backend', 'success');
        log(`-> OK (Backend: ${tf.getBackend()})`);

        log("Stufe 4: Lade Umgebung...");
        // Annahme: Corridor Konstruktor benötigt keine Argumente basierend auf vorherigem Code.
        corridor = new Corridor();
        log("-> OK");

        log("Stufe 5: Init KI-Modell...");
        sofa = new Sofa();
        sofa.init();
        updateDiagStatus('diag-ai', 'success');
        log("-> OK");

        // Initiales Zeichnen
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (corridor) corridor.draw(ctx);
        updateUI();

        log("<strong style='color: #28a745;'>Init komplett. Bereit zum Start.</strong>");
        startStopButton.disabled = false;

    } catch (error) {
        handleFatalError(error, "Init");
    }
}

// === Event Listener ===
startStopButton.disabled = true;
startStopButton.addEventListener('click', () => {
    if (!Corridor || !Sofa) return;

    const shouldRun = !isTrainingRunning;
    isTrainingRunning = shouldRun;
    isRenderingRunning = shouldRun;

    if (shouldRun) {
        startStopButton.innerText = "Simulation stoppen";
        startStopButton.classList.add('running');
        log("Simulation gestartet...");
        trainingLoop();
        renderingLoop();
    } else {
        startStopButton.innerText = "Simulation starten";
        startStopButton.classList.remove('running');
        log("Simulation gestoppt.");
    }
});

// Starte die Initialisierung
main();
