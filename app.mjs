// =======================================================
// ====== ON-SCREEN DEBUG KONSOLE - START ======
// =======================================================
const debugOutput = document.getElementById('debug-output');
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

function logToScreen(message, type = 'log-info') {
    if (debugOutput) {
        const line = document.createElement('div');
        line.className = type;
        if (typeof message === 'object') { message = JSON.stringify(message, null, 2); }
        line.textContent = `> ${message}`;
        debugOutput.appendChild(line);
        debugOutput.scrollTop = debugOutput.scrollHeight;
    }
}

console.log = function() {
    originalConsoleLog.apply(console, arguments);
    logToScreen(Array.from(arguments).join(' '), 'log-info');
};

console.error = function() {
    originalConsoleError.apply(console, arguments);
    logToScreen(`ERROR: ${Array.from(arguments).join(' ')}`, 'log-error');
};

window.onerror = function(message, source, lineno, colno, error) {
    console.error(`Uncaught Error: "${message}" in ${source} at line ${lineno}`);
    return true;
};
// =======================================================
// ====== ON-SCREEN DEBUG KONSOLE - ENDE ======
// =======================================================

// KORREKTUR: Importiert jetzt die .mjs Dateien
import { Corridor } from './corridor.mjs';
import { Sofa } from './sofa.mjs';

// --- Globale Variablen ---
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let corridor;
let sofa;

// UI-Elemente
const phaseDisplay = document.getElementById('training-phase-display');
const collisionLossDisplay = document.getElementById('stats-collision-loss');
const areaRewardDisplay = document.getElementById('stats-area-reward');

// Curriculum Learning & Animation
let trainingPhase = 1;
const collisionLossHistory = [];
const STABILITY_PERIOD = 100;
let animationT = 0;

// --- Diagnose-Funktion ---
function updateDiagStatus(id, success) {
    const statusEl = document.querySelector(`#${id} .status`);
    if (statusEl) {
        statusEl.className = `status ${success ? 'success' : 'error'}`;
    }
}

// --- Haupt-Schleife für Animation und Training ---
async function gameLoop() {
    let lambdaCollision, lambdaArea;
    if (trainingPhase === 1) {
        lambdaCollision = 10.0;
        lambdaArea = 1.0;
    } else {
        lambdaCollision = 2.0;
        lambdaArea = 5.0;
    }

    const losses = sofa.trainStep(corridor, lambdaCollision, lambdaArea);
    
    collisionLossDisplay.innerText = `Kollisionsverlust: ${losses.collisionLoss.toFixed(4)}`;
    areaRewardDisplay.innerText = `Flächen-Belohnung: ${losses.areaReward.toFixed(4)}`;
    
    if(trainingPhase === 1) {
        collisionLossHistory.push(losses.collisionLoss);
        if (collisionLossHistory.length > STABILITY_PERIOD) {
            collisionLossHistory.shift();
            const avgLoss = collisionLossHistory.reduce((a, b) => a + b, 0) / STABILITY_PERIOD;
            if (avgLoss < 0.01) {
                trainingPhase = 2;
                phaseDisplay.innerText = "Phase 2: Fläche maximieren";
                console.log("WECHSLE ZU PHASE 2: Fläche maximieren!");
            }
        }
    }

    await draw();
    requestAnimationFrame(gameLoop);
}

/**
 * Zeichnet die gesamte Szene.
 */
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
            const depths = transformedPoints.arraySync().map(p => corridor.getPenetrationDepth(p[0], p[1]));
            maxDepth = Math.max(0, ...depths);
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

/**
 * Die Hauptfunktion, die die Anwendung initialisiert.
 */
async function main() {
    try {
        console.log("Anwendung wird initialisiert...");
        updateDiagStatus('diag-js', true);
        console.log("JS/Module geladen.");
        updateDiagStatus('diag-modules', true);

        if (typeof tf === 'undefined') throw new Error("TensorFlow.js (tf) ist nicht definiert.");
        console.log("TensorFlow.js gefunden.");
        updateDiagStatus('diag-tf', true);
        
        await tf.setBackend('webgl');
        await tf.ready();
        console.log(`TF Backend (${tf.getBackend()}) ist bereit.`);
        updateDiagStatus('diag-backend', true);
        
        corridor = new Corridor(canvas.width, canvas.height);
        console.log("Korridor-Umgebung erstellt.");
        sofa = new Sofa();
        sofa.init();
        
        if (!sofa.model) throw new Error("KI-Modell konnte nicht erstellt werden.");
        console.log("KI-Sofa-Modell erfolgreich erstellt.");
        updateDiagStatus('diag-ai', true);

        console.log("Initialisierung abgeschlossen. Starte Game-Loop...");
        gameLoop();
    } catch (error) {
        console.error(error.message);
        if (error.message.includes("TensorFlow")) updateDiagStatus('diag-tf', false);
        else if (error.message.includes("Modell")) updateDiagStatus('diag-ai', false);
    }
}

main();
