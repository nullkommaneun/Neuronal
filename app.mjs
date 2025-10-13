// app.mjs (Angepasst für Asynchronität, Optimiert und Stabil)
import { Corridor } from './corridor.mjs';
import { Sofa } from './sofa.mjs';

// === Globale Variablen & UI-Elemente ===
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const debugOutput = document.getElementById('debug-output');
const phaseDisplay = document.getElementById('training-phase-display');
const collisionLossDisplay = document.getElementById('stats-collision-loss');
const areaRewardDisplay = document.getElementById('stats-area-reward');
const startStopButton = document.getElementById('start-stop-button');

let corridor, sofa;
let trainingPhase = 1;
const collisionLossHistory = [];
const STABILITY_PERIOD = 100;
let animationT = 0;
let isSimulationRunning = false; // Steuer-Variable für die Animation

// NEU: Sicherstellen, dass immer gültige Statistiken vorhanden sind.
// Behebt den Fehler "Cannot read properties of undefined (reading 'toFixed')".
let latestStats = {
    collisionLoss: 0,
    areaReward: 0
};

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

// NEU: Hilfsfunktion zum Aktualisieren der UI aus den latestStats.
function updateUI() {
    // Die Anzeige ist nun sicher, da latestStats initialisiert ist.
    collisionLossDisplay.innerText = `Kollisionsverlust: ${latestStats.collisionLoss.toFixed(5)}`;
    areaRewardDisplay.innerText = `Flächen-Belohnung: ${latestStats.areaReward.toFixed(5)}`;
}

// === Haupt-Animations- und Trainingsschleife ===
// KORREKTUR: Muss 'async' sein, um 'await' nutzen zu können.
async function gameLoop() {
    // Die Schleife stoppt sich selbst, wenn die Steuerungsvariable 'false' ist.
    if (!isSimulationRunning) return;

    try {
        let lambdaCollision, lambdaArea;
        if (trainingPhase === 1) {
            // Phase 1: Kollision stark bestrafen.
            lambdaCollision = 10.0;
            lambdaArea = 1.0;
        } else {
            // Phase 2: Fokus auf Flächenmaximierung, Kollision weiterhin vermeiden.
            lambdaCollision = 2.0;
            lambdaArea = 5.0;
        }

        // KORREKTUR: 'trainStep' ist async. Wir müssen auf das Ergebnis warten (await).
        const stats = await sofa.trainStep(corridor, lambdaCollision, lambdaArea);

        // Defensive Programmierung: Sicherstellen, dass das Ergebnis gültig ist.
        if (stats && typeof stats.collisionLoss === 'number' && typeof stats.areaReward === 'number') {
            latestStats = stats;
        } else {
            console.warn("Ungültige Statistiken erhalten:", stats);
            // Nutze die vorherigen Stats, falls die neuen ungültig sind.
        }

        // UI aktualisieren.
        updateUI();

        // Phasenmanagement (nutzt latestStats, da diese validiert wurden)
        if (trainingPhase === 1) {
            collisionLossHistory.push(latestStats.collisionLoss);
            if (collisionLossHistory.length > STABILITY_PERIOD) {
                collisionLossHistory.shift();
                const avgLoss = collisionLossHistory.reduce((a, b) => a + b, 0) / STABILITY_PERIOD;
                // Wenn die Kollision nahe Null ist, wechsle die Phase.
                if (avgLoss < 0.01) {
                    trainingPhase = 2;
                    phaseDisplay.innerText = "Phase 2: Fläche maximieren";
                    log("WECHSLE ZU PHASE 2! (Kollision stabilisiert)");
                }
            }
        }

        // Zeichnen (muss awaited werden, da es ebenfalls async ist).
        await draw();

        // Nächsten Frame anfordern.
        requestAnimationFrame(gameLoop);

    } catch (error) {
        // Fängt Fehler im gesamten async Ablauf ab.
        log(`FATALER FEHLER in der Game-Loop: ${error.message}`, true);
        console.error(error); // Detaillierter Stacktrace in der Konsole
        isSimulationRunning = false; // Stoppe die Simulation bei einem Fehler
        startStopButton.innerText = "Fehler - Neu laden";
        startStopButton.disabled = true;
        startStopButton.classList.remove('running');
    }
}

// === Zeichenfunktion (Optimiert für Performance) ===
async function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    corridor.draw(ctx);

    if (sofa && sofa.model) {
        animationT = (animationT + 0.005) % 1.0;
        const currentPos = sofa.getPointOnPath(corridor.path, animationT);

        // 1. Hole die Formdaten für das Zeichnen der Pixel (Async).
        const shapeValues = await sofa.getShapeForDrawing();

        // 2. Berechne Kollision für die Färbung (Optimiert).
        let maxDepth = 0;

        // KORREKTUR: Nutze die neue asynchrone Methode (ersetzt altes getShapePoints).
        const shapePointsTensor = await sofa.getShapePointsAsync();

        if (shapePointsTensor.shape[0] > 0) {
            // KORREKTUR: Daten asynchron auf CPU holen (ersetzt blockierendes .arraySync()).
            const shapePointsArray = await shapePointsTensor.array();

            // KORREKTUR: Nutze die effiziente JS-Transformation auf der CPU (ersetzt altes transformPoints).
            const transformedPoints = sofa.transformPointsJS(shapePointsArray, currentPos.x, currentPos.y, currentPos.angle);

            // Berechne die maximale Tiefe (CPU).
            maxDepth = Math.max(0, ...transformedPoints.map(p => corridor.getPenetrationDepth(p[0], p[1])));
        }
        // WICHTIG: Tensor freigeben, um Speicherlecks zu vermeiden (im Originalcode gab es hier Lecks).
        shapePointsTensor.dispose();

        // 3. Färbung basierend auf Kollision.
        let sofaColor = 'rgba(46, 204, 113, 0.7)'; // Grün (OK)
        if (maxDepth > 0.1) sofaColor = 'rgba(231, 76, 60, 0.7)'; // Rot (Starke Kollision)
        else if (maxDepth > 0) sofaColor = 'rgba(52, 152, 219, 0.7)'; // Blau (Leichte Berührung)

        // 4. Zeichne das Sofa.
        ctx.fillStyle = sofaColor;
        ctx.save();
        ctx.translate(currentPos.x, currentPos.y);
        ctx.rotate(currentPos.angle);

        const res = sofa.gridResolution;
        // WICHTIG: Nutze den zentral definierten Skalierungsfaktor aus der Sofa-Klasse.
        const sofaScale = sofa.sofaScale;
        const pixelSize = (1 / res) * sofaScale;

        for (let i = 0; i < res; i++) {
            for (let j = 0; j < res; j++) {
                const index = i * res + j;
                // Zeichne nur Punkte innerhalb des Sofas.
                if (shapeValues[index] > 0) {
                    // Berechne Koordinaten im lokalen Raum des Sofas.
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
        log("Stufe 1: Lade JS/Module..."); updateDiagStatus('diag-js', 'success'); updateDiagStatus('diag-modules', 'success'); log("-> OK");
        log("Stufe 2: Lade TensorFlow.js..."); if (typeof tf === 'undefined') throw new Error("Das 'tf'-Objekt wurde nicht gefunden."); updateDiagStatus('diag-tf', 'success'); log("-> OK");

        // WebGL ist essentiell für die Performance der neuen Tensor-Operationen.
        log("Stufe 3: Init TF Backend (WebGL)...");
        // Robuste Initialisierung mit Fallback auf CPU.
        await tf.setBackend('webgl').catch(() => {
            log("WARNUNG: WebGL nicht verfügbar. Nutze CPU-Backend (deutlich langsamer).", true);
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

        // Zeichne den leeren Korridor einmal initial
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        corridor.draw(ctx);
        updateUI(); // Initialisiere die UI-Anzeige mit Nullen

        log("<strong style='color: #28a745;'>Init komplett. Bereit zum Start.</strong>");
        startStopButton.disabled = false; // Knopf aktivieren

    } catch (error) {
        log(`FATALER FEHLER bei Init: ${error.message}`, true);
        console.error(error);
        startStopButton.innerText = "Fehler - Neu laden";
        startStopButton.disabled = true;
    }
}

// === Event Listener für den Knopf ===
startStopButton.disabled = true; // Knopf ist anfangs deaktiviert
startStopButton.addEventListener('click', () => {
    isSimulationRunning = !isSimulationRunning;
    if (isSimulationRunning) {
        startStopButton.innerText = "Simulation stoppen";
        startStopButton.classList.add('running');
        log("Simulation gestartet...");
        gameLoop(); // Starte die asynchrone Schleife
    } else {
        startStopButton.innerText = "Simulation starten";
        startStopButton.classList.remove('running');
        log("Simulation gestoppt.");
    }
});

// Starte die Initialisierung
main();
