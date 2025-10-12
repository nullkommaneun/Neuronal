/**
 * @file app.js
 * @description Finale Version mit echter Physik-Engine.
 * Die `simulationLoop` prüft JEDEN Schritt auf Kollisionen und verhindert das Durchdringen.
 */
// ... (setupPage und initializeAndStartSimulation bleiben fast gleich) ...
window.addEventListener('DOMContentLoaded', setupPage);
let canvas, ctx, sofa, startButton, pauseButton, logContainer;
let isRunning = false, stableFrames = 0, currentWaypointIndex = 0;
const SCALE = 100;

// Die Logik für die Simulation wird jetzt in einem eigenen Objekt gekapselt
const Simulation = {
    sofa: null,
    path: null,
    history: [], // Speichert die Bewegungen für das Training
    
    // Führt einen einzelnen, physikalisch korrekten Schritt aus
    step: function() {
        const waypoints = Path.getWaypoints();
        
        if (currentWaypointIndex >= waypoints.length - 1) {
            // Episode beendet, neu starten
            currentWaypointIndex = 0;
            // Hier könnte man das Training für die gesamte Episode durchführen
        }

        const currentPos = waypoints[currentWaypointIndex];
        const nextPos = waypoints[currentWaypointIndex + 1];

        // Simuliere die Bewegung von current nach next
        const tempSofa = createSofa(this.sofa.width, this.sofa.height);
        tempSofa.setPosition(nextPos.x, nextPos.y, nextPos.rotation);
        
        // PHYSIK-CHECK: Ist der nächste Schritt legal?
        if (Corridor.calculateCollisionLoss(tempSofa) > 0.1) { // 0.1 als Schwelle für "tiefe Kollision"
            // BEWEGUNG VERWEIGERT. Das Sofa bleibt stehen.
            // Die KI muss lernen, dass dieser Pfad schlecht ist.
        } else {
            // Bewegung ist sicher, führe sie aus.
            this.sofa.setPosition(nextPos.x, nextPos.y, nextPos.rotation);
            currentWaypointIndex++;
        }
    }
};

function setupPage() { /* ... unverändert ... */ }
async function initializeAndStartSimulation() {
    // ... initialisiert alles wie bisher ...
    Simulation.sofa = createSofa(0.8, 0.4);
    // ...
    simulationLoop();
}

// Die neue, physik-basierte Simulationsschleife
function simulationLoop() {
    if (!isRunning) return;
    
    // 1. KI plant den GESAMTEN Pfad
    Path.trainStep(Simulation.sofa); 
    
    // 2. Physik-Engine führt den NÄCHSTEN sicheren Schritt aus
    Simulation.step();

    // 3. UI updaten und zeichnen
    updateUI(0); // Verlust wird jetzt anders berechnet
    draw();
    requestAnimationFrame(simulationLoop);
}

function draw() {
    // ... zeichnet jetzt Simulation.sofa ...
    sofa.setPosition(Simulation.sofa.x, Simulation.sofa.y, Simulation.sofa.rotation);
    // ... restliche Zeichenlogik ...
}
