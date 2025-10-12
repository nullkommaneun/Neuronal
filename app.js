// app.js (finale Version)
import { Corridor } from './corridor.js';
import { Sofa } from './sofa.js';

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
let trainingPhase = 1; // 1 = Finde Lösung, 2 = Maximiere Fläche
const collisionLossHistory = [];
const STABILITY_PERIOD = 100; // Anzahl der Frames für stabile Periode
let animationT = 0; // Animationsfortschritt von 0 bis 1

// --- Diagnose-Funktion ---
function updateDiagStatus(id, success) {
    const statusEl = document.querySelector(`#${id} .status`);
    if (statusEl) {
        statusEl.className = `status ${success ? 'success' : 'error'}`;
    }
}

// --- Haupt-Schleife für Animation und Training ---
async function gameLoop() {
    // 1. Training (Curriculum Learning)
    let lambdaCollision, lambdaArea;
    if (trainingPhase === 1) {
        lambdaCollision = 10.0; // Hohe Strafe für Kollisionen
        lambdaArea = 1.0;       // Geringe Belohnung für Fläche
    } else { // Phase 2
        lambdaCollision = 2.0;  // Moderate Strafe, um Form beizubehalten
        lambdaArea = 5.0;       // Aggressive Belohnung für Wachstum
    }

    // Führe einen Trainingsschritt aus und erhalte die Verluste
    const losses = sofa.trainStep(corridor, lambdaCollision, lambdaArea);
    
    // Statistiken aktualisieren und Phasenwechsel prüfen
    collisionLossDisplay.innerText = `Kollisionsverlust: ${losses.collisionLoss.toFixed(4)}`;
    areaRewardDisplay.innerText = `Flächen-Belohnung: ${losses.areaReward.toFixed(4)}`;
    
    if(trainingPhase === 1) {
        collisionLossHistory.push(losses.collisionLoss);
        if (collisionLossHistory.length > STABILITY_PERIOD) {
            collisionLossHistory.shift();
            const avgLoss = collisionLossHistory.reduce((a, b) => a + b, 0) / STABILITY_PERIOD;
            // Wechsle, wenn der durchschnittliche Verlust über die Periode sehr klein ist
            if (avgLoss < 0.01) {
                trainingPhase = 2;
                phaseDisplay.innerText = "Phase 2: Fläche maximieren";
                console.log("WECHSLE ZU PHASE 2: Fläche maximieren!");
            }
        }
    }

    // 2. Visualisierung
    await draw();
    
    // Nächsten Frame anfordern
    requestAnimationFrame(gameLoop);
}


/**
 * Zeichnet die gesamte Szene.
 */
async function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    corridor.draw(ctx);

    if (sofa && sofa.model) {
        // Animationsschleife für die Position
        animationT = (animationT + 0.005) % 1.0;
        const currentPos = sofa.getPointOnPath(corridor.path, animationT);
        
        // Formdaten vom Sofa-Modell holen
        const shapeValues = await sofa.getShapeForDrawing();
        const res = sofa.gridResolution;

        // Kollisionsstatus an aktueller Position prüfen für die Farbe
        let maxDepth = 0;
        const shapePoints = sofa.getShapePoints();
        if (shapePoints.shape[0] > 0) {
            const transformedPoints = sofa.transformPoints(shapePoints, currentPos.x, currentPos.y, currentPos.angle);
            const depths = transformedPoints.arraySync().map(p => corridor.getPenetrationDepth(p[0], p[1]));
            maxDepth = Math.max(0, ...depths);
            transformedPoints.dispose();
        }
        shapePoints.dispose();
        
        // Farbe basierend auf Eindringtiefe setzen
        let sofaColor = 'rgba(46, 204, 113, 0.7)'; // Grün (frei)
        if (maxDepth > 0.1) sofaColor = 'rgba(231, 76, 60, 0.7)'; // Rot (starke Kollision)
        else if (maxDepth > 0) sofaColor = 'rgba(52, 152, 219, 0.7)'; // Blau (Berührung)
        ctx.fillStyle = sofaColor;

        // Sofa-Form an aktueller Position zeichnen
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
        updateDiagStatus('diag-js', true);
        updateDiagStatus('diag-modules', true);

        if (typeof tf === 'undefined') throw new Error("TensorFlow.js nicht gefunden.");
        updateDiagStatus('diag-tf', true);
        await tf.setBackend('webgl');
        await tf.ready();
        updateDiagStatus('diag-backend', true);
        
        corridor = new Corridor(canvas.width, canvas.height);
        sofa = new Sofa();
        sofa.init();
        
        if (!sofa.model) throw new Error("KI-Modell konnte nicht erstellt werden.");
        updateDiagStatus('diag-ai', true);

        // Starte die Hauptschleife
        gameLoop();
    } catch (error) {
        console.error("Initialisierung fehlgeschlagen:", error);
        // Fehler im UI anzeigen
    }
}

main();
