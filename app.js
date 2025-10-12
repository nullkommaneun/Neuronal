// app.js (erweiterte Version)
import { Corridor } from './corridor.js';
import { Sofa } from './sofa.js';

// --- Globale Variablen ---
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let corridor;
let sofa;

// Curriculum Learning & Animation
let trainingPhase = 1; // 1 = Finde Lösung, 2 = Maximiere Fläche
const collisionLossHistory = [];
const STABILITY_PERIOD = 100;
let animationT = 0; // Animationsfortschritt von 0 bis 1

// --- Diagnose-Funktion (unverändert) ---
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
        lambdaArea = 0.5;      // Geringe Belohnung für Fläche
        
        // Phasenwechsel prüfen
        // TODO: Echten Kollisionsverlust vom trainStep bekommen
        const currentCollisionLoss = 0; // Platzhalter
        collisionLossHistory.push(currentCollisionLoss);
        if (collisionLossHistory.length > STABILITY_PERIOD) {
            collisionLossHistory.shift();
            const avgLoss = collisionLossHistory.reduce((a, b) => a + b, 0) / STABILITY_PERIOD;
            if (avgLoss < 0.01) {
                trainingPhase = 2;
                document.getElementById('training-phase-display').innerText = "Phase 2: Fläche maximieren";
                console.log("WECHSLE ZU PHASE 2: Fläche maximieren!");
            }
        }

    } else { // Phase 2
        lambdaCollision = 2.0; // Moderate Strafe
        lambdaArea = 5.0;      // Aggressive Belohnung
    }

    // Führe einen Trainingsschritt aus
    sofa.trainStep(corridor, lambdaCollision, lambdaArea);

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
    
    // Korridor zeichnen
    corridor.draw(ctx);

    // Sofa zeichnen (animiert)
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
        if (shapePoints.shape[0] > 0) { // Nur prüfen, wenn Form existiert
            const transformedPoints = sofa.transformPoints(shapePoints, currentPos.x, currentPos.y, currentPos.angle);
            const depths = transformedPoints.arraySync().map(p => corridor.getPenetrationDepth(p[0], p[1]));
            maxDepth = Math.max(...depths);
        }
        
        // Farbe basierend auf Kollision setzen
        if (maxDepth > 0.1) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.7)'; // Rot bei Eindringen
        } else if (maxDepth > 0) {
            ctx.fillStyle = 'rgba(0, 150, 255, 0.7)'; // Blau bei Berührung
        } else {
            ctx.fillStyle = 'rgba(46, 204, 113, 0.7)'; // Grün, wenn frei
        }

        // Sofa-Form zeichnen (Pixel für Pixel)
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
        // Schritte 1 & 2 (unverändert)
        await new Promise(resolve => setTimeout(resolve, 100));
        updateDiagStatus('diag-js', true);
        updateDiagStatus('diag-modules', true);
        await new Promise(resolve => setTimeout(resolve, 100));
        if (typeof tf !== 'undefined') {
            updateDiagStatus('diag-tf', true);
            await tf.setBackend('webgl');
            await tf.ready();
            updateDiagStatus('diag-backend', true);
        } else { throw new Error("TensorFlow.js nicht gefunden."); }
        
        // Schritt 3: Umgebung initialisieren
        corridor = new Corridor(canvas.width, canvas.height);

        // Schritt 4: KI-Modell initialisieren
        sofa = new Sofa();
        sofa.init();
        if (sofa.model) {
            updateDiagStatus('diag-ai', true);
        } else { throw new Error("KI-Modell konnte nicht erstellt werden."); }

        // Starte die Hauptschleife
        gameLoop();

    } catch (error) {
        console.error("Initialisierung fehlgeschlagen:", error);
        // Fehler im UI anzeigen
    }
}

main();
