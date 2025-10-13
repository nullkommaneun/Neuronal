// app.mjs (Optimiert: Cache Busting, Entkoppeltes Training/Rendering, Neue Strategie)

// WICHTIG: Keine statischen Imports mehr (für Cache Busting).

// === Globale Variablen & UI-Elemente ===
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const debugOutput = document.getElementById('debug-output');
const phaseDisplay = document.getElementById('training-phase-display');
const collisionLossDisplay = document.getElementById('stats-collision-loss');
const areaRewardDisplay = document.getElementById('stats-area-reward');
const startStopButton = document.getElementById('start-stop-button');

// Klassen-Referenzen und Instanzen
let Corridor, Sofa;
let corridor, sofa;

let trainingPhase = 1;
// (3) STRATEGIE: Nutze stabilityHistory, um das Wachstum zu messen.
const stabilityHistory = [];
const STABILITY_PERIOD = 100;
let animationT = 0;

// (2) ENTKOPPLUNG: Getrennte Steuerung für Rendering und Training
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

// === (2) Unabhängige Trainingsschleife (Läuft im Hintergrund) ===
async function trainingLoop() {
    if (!isTrainingRunning) return;

    try {
        let lambdaCollision, lambdaArea;

        // (3) NEUE TRAININGSPHASEN (Entscheidend für Sichtbarkeit):
        if (trainingPhase === 1) {
            // Phase 1: Wachstumsphase. Starker Anreiz zum Wachsen.
            lambdaCollision = 1.0;
            lambdaArea = 5.0;
            phaseDisplay.innerText = "Phase 1: Wachsen und Form finden";
        } else {
            // Phase 2: Verfeinerungsphase. Starke Kollisionsstrafe.
            lambdaCollision = 10.0;
            lambdaArea = 2.0;
            phaseDisplay.innerText = "Phase 2: Kollisionen eliminieren";
        }

        const stats = await sofa.trainStep(corridor, lambdaCollision, lambdaArea);

        if (stats && typeof stats.collisionLoss === 'number' && typeof stats.areaReward === 'number') {
            latestStats = stats;
        }

        updateUI();

        // (3) LOGIK FÜR PHASENWECHSEL: Basierend auf Stabilität der Fläche.
        if (trainingPhase === 1) {
            stabilityHistory.push(latestStats.areaReward);

            if (stabilityHistory.length > STABILITY_PERIOD) {
                stabilityHistory.shift();

                // Berechne Durchschnitt über den gesamten Zeitraum.
                const avgTotal = stabilityHistory.reduce((a, b) => a + b, 0) / STABILITY_PERIOD;
                // Berechne Durchschnitt der letzten 10 Schritte.
                const recentHistory = stabilityHistory.slice(-10);
                const avgRecent = recentHistory.reduce((a, b) => a + b, 0) / 10;

                // Wechsle, wenn das Wachstum stabil ist (geringe Abweichung) UND das Sofa eine Mindestgröße hat.
                if (Math.abs(avgRecent - avgTotal) < 0.0001 && avgTotal > 0.1) {
                    trainingPhase = 2;
                    log("WECHSLE ZU PHASE 2! (Wachstum stabilisiert)");
                }
            }
        }

        // OPTIMIERUNG: Plane den nächsten Schritt sofort (setTimeout erlaubt dem Browser zu atmen).
        setTimeout(trainingLoop, 0);

    } catch (error) {
        handleFatalError(error, "Training-Loop");
    }
}

// === (2) Unabhängige Rendering-Schleife (Läuft flüssig mit 60 FPS) ===
async function renderingLoop() {
    if (!isRenderingRunning) return;

    try {
        // Zeichne den aktuellen Zustand.
        await draw();
        // Plane den nächsten Frame für flüssige Animation.
        requestAnimationFrame(renderingLoop);
    } catch (error) {
        handleFatalError(error, "Rendering-Loop");
    }
}

// Hilfsfunktion für Fehlerbehandlung
function handleFatalError(error, loopName) {
    log(`FATALER FEHLER im ${loopName}: ${error.message}`, true);
    console.error(error);
    isTrainingRunning = false;
    isRenderingRunning = false;
    startStopButton.innerText = "Fehler - Neu laden";
    startStopButton.disabled = true;
    startStopButton.classList.remove('running');
}


// === Zeichenfunktion ===
async function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    corridor.draw(ctx);

    if (sofa && sofa.model) {
        // Animationsposition aktualisieren (sorgt für Bewegung)
        animationT = (animationT + 0.005) % 1.0;
        const currentPos = sofa.getPointOnPath(corridor.path, animationT);

        const shapeValues = await sofa.getShapeForDrawing();

        // Kollisionsberechnung für Färbung.
        let maxDepth = 0;
        const shapePointsTensor = await sofa.getShapePointsAsync();

        if (shapePointsTensor.shape[0] > 0) {
            const shapePointsArray = await shapePointsTensor.array();
            const transformedPoints = sofa.transformPointsJS(shapePointsArray, currentPos.x, currentPos.y, currentPos.angle);
             if (transformedPoints && transformedPoints.length > 0) {
                maxDepth = Math.max(0, ...transformedPoints.map(p => corridor.getPenetrationDepth(p[0], p[1])));
            }
        }
        shapePointsTensor.dispose();

        // Färbung.
        let sofaColor = 'rgba(46, 204, 113, 0.7)'; // Grün
        if (maxDepth > 0.1) sofaColor = 'rgba(231, 76, 60, 0.7)'; // Rot
        else if (maxDepth > 0) sofaColor = 'rgba(52, 152, 219, 0.7)'; // Blau

        // Zeichnen.
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
                if (shapeValues[index] > 0) {
                    const x = (j / res - 0.5) * sofaScale;
                    const y = (i / res - 0.5) * sofaScale;
                    ctx.fillRect(x, y, pixelSize, pixelSize);
                }
            }
        }
        ctx.restore();
    }
}

// === Haupt-Initialisierungsfunktion ===
async function main() {
    try {
        log("Stufe 1: Lade JS/Module...");

        // (4) CACHE BUSTING IMPLEMENTIERUNG
        // Fügt einen Zeitstempel hinzu, um das Neuladen zu erzwingen.
        const version = Date.now();
        const CorridorModule = await import(`./corridor.mjs?v=${version}`);
        const SofaModule = await import(`./sofa.mjs?v=${version}`);
        Corridor = CorridorModule.Corridor;
        Sofa = SofaModule.Sofa;

        updateDiagStatus('diag-js', 'success'); updateDiagStatus('diag-modules', 'success'); log("-> OK (Cache Busting aktiv)");

        log("Stufe 2: Lade TensorFlow.js..."); if (typeof tf === 'undefined') throw new Error("Das 'tf'-Objekt wurde nicht gefunden."); updateDiagStatus('diag-tf', 'success'); log("-> OK");

        log("Stufe 3: Init TF Backend (WebGL)...");
        await tf.setBackend('webgl').catch(() => {
            log("WARNUNG: WebGL nicht verfügbar. Nutze CPU-Backend.", true);
            return tf.setBackend('cpu');
        });
        await tf.ready();
        updateDiagStatus('diag-backend', 'success');
        log(`-> OK (Backend: ${tf.getBackend()})`);

        log("Stufe 4: Lade Umgebung...");
        corridor = new Corridor(800, 600);
        log("-> OK");

        log("Stufe 5: Init KI-Modell (INR)...");
        sofa = new Sofa();
        sofa.init();
        if (!sofa || !sofa.model) throw new Error("Sofa-Objekt konnte nicht erstellt werden.");
        updateDiagStatus('diag-ai', 'success');
        log("-> OK");

        // Initiales Zeichnen
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        corridor.draw(ctx);
        updateUI();

        log("<strong style='color: #28a745;'>Init komplett. Bereit zum Start.</strong>");
        startStopButton.disabled = false;

    } catch (error) {
        handleFatalError(error, "Init");
    }
}

// === Event Listener für den Knopf ===
startStopButton.disabled = true;
startStopButton.addEventListener('click', () => {
    if (!Corridor || !Sofa) {
        log("Warte auf Module...", true);
        return;
    }

    const shouldRun = !isTrainingRunning;
    isTrainingRunning = shouldRun;
    isRenderingRunning = shouldRun;

    if (shouldRun) {
        startStopButton.innerText = "Simulation stoppen";
        startStopButton.classList.add('running');
        log("Simulation gestartet...");
        trainingLoop();  // Starte die unabhängige Trainingsschleife
        renderingLoop(); // Starte die unabhängige Rendering-Schleife
    } else {
        startStopButton.innerText = "Simulation starten";
        startStopButton.classList.remove('running');
        log("Simulation gestoppt.");
    }
});

// Starte die Initialisierung
main();
