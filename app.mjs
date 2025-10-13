// app.mjs (Finale, geprüfte Version)
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

// === Haupt-Animations- und Trainingsschleife ===
async function gameLoop() {
    // Die Schleife stoppt sich selbst, wenn die Steuerungsvariable 'false' ist.
    if (!isSimulationRunning) return;

    try {
        let lambdaCollision, lambdaArea;
        if (trainingPhase === 1) { lambdaCollision = 10.0; lambdaArea = 1.0; } 
        else { lambdaCollision = 2.0; lambdaArea = 5.0; }
        
        const losses = sofa.trainStep(corridor, lambdaCollision, lambdaArea);
        collisionLossDisplay.innerText = `Kollisionsverlust: ${losses.collisionLoss.toFixed(4)}`;
        areaRewardDisplay.innerText = `Flächen-Belohnung: ${losses.areaReward.toFixed(4)}`;
        
        if (trainingPhase === 1) {
            collisionLossHistory.push(losses.collisionLoss);
            if (collisionLossHistory.length > STABILITY_PERIOD) {
                collisionLossHistory.shift();
                const avgLoss = collisionLossHistory.reduce((a, b) => a + b, 0) / STABILITY_PERIOD;
                if (avgLoss < 0.01) {
                    trainingPhase = 2;
                    phaseDisplay.innerText = "Phase 2: Fläche maximieren";
                    log("WECHSLE ZU PHASE 2!");
                }
            }
        }
        await draw();
        requestAnimationFrame(gameLoop);
    } catch (error) {
        log(`FATALER FEHLER in der Game-Loop: ${error.message}`, true);
        isSimulationRunning = false; // Stoppe die Simulation bei einem Fehler
        startStopButton.innerText = "Fehler - Neu laden";
        startStopButton.disabled = true;
        startStopButton.classList.remove('running');
    }
}

// === Zeichenfunktion (unverändert) ===
async function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    corridor.draw(ctx);
    if (sofa && sofa.model) {
        animationT = (animationT + 0.005) % 1.0;
        const currentPos = sofa.getPointOnPath(corridor.path, animationT);
        const shapeValues = await sofa.getShapeForDrawing();
        const res = sofa.gridResolution;
        let maxDepth = 0;
        const shapePoints = sofa.getShapePoints();
        if (shapePoints.shape[0] > 0) {
            const transformedPoints = sofa.transformPoints(shapePoints, currentPos.x, currentPos.y, currentPos.angle);
            maxDepth = Math.max(0, ...transformedPoints.arraySync().map(p => corridor.getPenetrationDepth(p[0], p[1])));
            transformedPoints.dispose();
        }
        shapePoints.dispose();
        let sofaColor = 'rgba(46, 204, 113, 0.7)';
        if (maxDepth > 0.1) sofaColor = 'rgba(231, 76, 60, 0.7)';
        else if (maxDepth > 0) sofaColor = 'rgba(52, 152, 219, 0.7)';
        ctx.fillStyle = sofaColor;
        ctx.save();
        ctx.translate(currentPos.x, currentPos.y);
        ctx.rotate(currentPos.angle);
        const sofaScale = 150;
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
        log("Stufe 1: Lade JS/Module..."); updateDiagStatus('diag-js', 'success'); updateDiagStatus('diag-modules', 'success'); log("-> OK");
        log("Stufe 2: Lade TensorFlow.js..."); if (typeof tf === 'undefined') throw new Error("Das 'tf'-Objekt wurde nicht gefunden."); updateDiagStatus('diag-tf', 'success'); log("-> OK");
        log("Stufe 3: Init TF Backend..."); await tf.setBackend('webgl'); await tf.ready(); updateDiagStatus('diag-backend', 'success'); log("-> OK");
        log("Stufe 4: Lade Umgebung..."); corridor = new Corridor(800, 600); log("-> OK");
        log("Stufe 5: Init KI-Modell..."); sofa = new Sofa(); sofa.init(); if (!sofa || !sofa.model) throw new Error("Sofa-Objekt konnte nicht erstellt werden."); updateDiagStatus('diag-ai', 'success'); log("-> OK");
        
        // Zeichne den leeren Korridor einmal initial
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        corridor.draw(ctx);

        log("<strong style='color: #28a745;'>Init komplett. Bereit zum Start.</strong>");
        startStopButton.disabled = false; // Knopf aktivieren
        
    } catch (error) {
        log(`FATALER FEHLER bei Init: ${error.message}`, true);
        startStopButton.innerText = "Fehler - Neu laden";
        startStopButton.disabled = true;
    }
}

// === Event Listener für den Knopf ===
// Dieser Code wird erst nach der Definition der Funktionen ausgeführt.
startStopButton.disabled = true; // Knopf ist anfangs deaktiviert
startStopButton.addEventListener('click', () => {
    isSimulationRunning = !isSimulationRunning;
    if (isSimulationRunning) {
        startStopButton.innerText = "Simulation stoppen";
        startStopButton.classList.add('running');
        log("Simulation gestartet...");
        gameLoop(); // Starte die Schleife
    } else {
        startStopButton.innerText = "Simulation starten";
        startStopButton.classList.remove('running');
        log("Simulation gestoppt.");
    }
});

// Starte die Initialisierung
main();
