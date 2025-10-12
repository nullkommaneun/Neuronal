/**
 * @file app.js
 * @description Finale Version. Delegiert die Physik an die physics.js Engine.
 * Fungiert als Spielleiter und Kommentator.
 */
window.addEventListener('DOMContentLoaded', setupPage);

// Globale Variablen
let canvas, ctx, sofa, startButton, pauseButton, logContainer;
let isRunning = false, stableFrames = 0;
const SCALE = 100;

function setupPage() {
    startButton = document.getElementById('startButton');
    pauseButton = document.getElementById('pauseButton');
    logContainer = document.getElementById('log-container');
    canvas = document.getElementById('simulationCanvas');
    ctx = canvas.getContext('2d');
    startButton.addEventListener('click', initializeAndStartSimulation);
    pauseButton.addEventListener('click', () => {
        if (isRunning) {
            isRunning = false;
            startButton.disabled = false;
            pauseButton.disabled = true;
            logMessage('Simulation pausiert.', 'info');
        }
    });
    logMessage('Seite bereit. Klicke auf "Start", um die Simulation zu laden.', 'info');
}

async function initializeAndStartSimulation() {
    startButton.disabled = true;
    logMessage('Start-Befehl erhalten. Lade Simulationskomponenten...', 'info');
    try {
        updateBadge('badge-js', true);
        const modulesLoaded = typeof Corridor !== 'undefined' && typeof createSofa !== 'undefined' && typeof Path !== 'undefined' && typeof Physics !== 'undefined';
        if (!modulesLoaded) throw new Error('Ein oder mehrere Skript-Module fehlen.');
        updateBadge('badge-modules', true);
        logMessage('Module validiert.', 'info');
        
        if (typeof tf === 'undefined') throw new Error('TensorFlow.js nicht gefunden.');
        updateBadge('badge-tf', true);
        
        sofa = createSofa(0.8, 0.4);
        updateBadge('badge-backend', true);
        logMessage('Sofa-Objekt erstellt.', 'info');
        
        Physics.init(sofa);
        updateBadge('badge-physics', true);
        logMessage('Physik Engine initialisiert.', 'info');
        
        Path.init(0.01);
        updateBadge('badge-ai', true);
        logMessage('KI-Modell initialisiert.', 'info');

        isRunning = true;
        pauseButton.disabled = false;
        logMessage('Initialisierung abgeschlossen. Starte Simulation...', 'info');
        
        simulationLoop();

    } catch (error) {
        logMessage(`INITIALISIERUNGSFEHLER: ${error.message}`, 'error');
        startButton.disabled = false; // Erlaube einen neuen Versuch
    }
}

function simulationLoop() {
    if (!isRunning) return;
    
    try {
        // 1. Die KI verbessert ihren gesamten Plan basierend auf dem letzten Ergebnis.
        Path.trainStep(sofa);
        
        // 2. Die KI erstellt einen neuen, vollständigen Plan für diesen Frame.
        const waypoints = Path.getWaypoints();
        
        // 3. Die Physik-Engine führt den nächsten Schritt des Plans aus (falls legal).
        Physics.simulateStep(sofa, waypoints);

        // 4. Der "Lehrer" bewertet den *geplanten* Pfad der KI, nicht die aktuelle physische Position.
        let planLoss = 0;
        for(const wp of waypoints) {
            const tempSofa = createSofa(sofa.width, sofa.height);
            tempSofa.setPosition(wp.x, wp.y, wp.rotation);
            planLoss += Corridor.calculateCollisionLoss(tempSofa);
        }
        planLoss /= waypoints.length;
        
        const lastWaypoint = waypoints[waypoints.length - 1];
        const goalPosition = { x: Corridor.armLength - 0.5, y: 0.5 };
        const dx = goalPosition.x - lastWaypoint.x;
        const dy = goalPosition.y - lastWaypoint.y;
        const distanceToGoal = Math.sqrt(dx*dx + dy*dy);
        
        if (planLoss < 0.001 && distanceToGoal < 0.2) {
            stableFrames++;
        } else {
            stableFrames = 0;
        }

        if (stableFrames > 100) {
            sofa.grow();
            Physics.init(sofa); // Physik-Engine mit dem neuen, größeren Sofa neu starten
            Path.init(0.01);
            stableFrames = 0;
            logMessage(`MISSION ERFÜLLT! Sofa wächst auf ${sofa.width.toFixed(2)}m.`, 'info');
        }
        
        updateUI(planLoss);
        draw();
        
        requestAnimationFrame(simulationLoop);
    } catch (error) {
        logMessage(`KRITISCHER FEHLER: ${error.message}`, 'error');
        console.error("Detaillierter Fehler:", error);
        isRunning = false;
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!sofa) return;
    ctx.save();
    ctx.translate(20, 20);

    const w = Corridor.width * SCALE;
    const l = Corridor.armLength * SCALE;
    ctx.strokeStyle = '#888'; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(0, l); ctx.lineTo(0, 0); ctx.lineTo(l, 0); ctx.lineTo(l, w);
    ctx.lineTo(w, w); ctx.lineTo(w, l); ctx.closePath(); ctx.stroke();
    ctx.fillStyle = 'lightgreen'; ctx.fillText('A', 0.5 * w - 5, l - 5);
    ctx.fillStyle = 'red'; ctx.fillText('B', l - 15, 0.5 * w + 5);
    
    // WICHTIG: Wir zeichnen immer den physikalisch korrekten Zustand aus der Physics Engine.
    const currentState = Physics.sofaState;
    
    // Temporäres Sofa-Objekt nur für das Zeichnen erstellen, um den Zustand nicht zu verändern.
    const drawSofa = createSofa(sofa.width, sofa.height);
    drawSofa.setPosition(currentState.x, currentState.y, currentState.rotation);
    const currentLoss = Corridor.calculateCollisionLoss(drawSofa);
    const corners = drawSofa.getCorners();
    
    ctx.beginPath();
    ctx.moveTo(corners[0].x * SCALE, corners[0].y * SCALE);
    for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x * SCALE, corners[i].y * SCALE);
    ctx.closePath();
    ctx.fillStyle = currentLoss > 0.001 ? '#e74c3c' : '#3498db'; // Farbe basiert auf der echten Kollision
    ctx.fill();
    ctx.strokeStyle = '#ecf0f1';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    ctx.restore();
}

function logMessage(o, e = "info") { if (!logContainer) return; const t = document.createElement("div"); t.className = `log-entry ${e}`, t.textContent = `[${(new Date).toLocaleTimeString()}] ${o}`, logContainer.appendChild(t), logContainer.scrollTop = logContainer.scrollHeight }
function updateBadge(o, e) { const t = document.getElementById(o); t && (t.className = `badge ${e?"success":"pending"}`) }
function updateUI(o) { sofa && (document.getElementById("sofa-size").textContent = `Breite: ${sofa.width.toFixed(2)} m, Höhe: ${sofa.height.toFixed(2)} m`, document.getElementById("sofa-area").textContent = `Fläche: ${(sofa.width*sofa.height).toFixed(2)} m²`, document.getElementById("collision-loss").textContent = `Verlust (Plan): ${o.toExponential(3)}`, document.getElementById("stable-frames").textContent = `Stabile Frames: ${stableFrames}/ 100`) }
