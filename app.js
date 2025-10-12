/**
 * @file app.js
 * @description Robuste, auf Klick initialisierende Anwendungslogik.
 */

window.addEventListener('DOMContentLoaded', setupPage);

// Globale Variablen
let canvas, ctx, sofa, startButton, pauseButton, logContainer;
let isRunning = false;
let stableFrames = 0;
let currentWaypointIndex = 0;
let frameCounter = 0;
const SCALE = 100;
const ANIMATION_SPEED = 4;

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
        const modulesLoaded = typeof Corridor !== 'undefined' && typeof createSofa !== 'undefined' && typeof Path !== 'undefined';
        if (!modulesLoaded) throw new Error('Kritische Code-Module (corridor, sofa, path) fehlen.');
        updateBadge('badge-modules', true);
        logMessage('Module erfolgreich validiert.', 'info');
        await new Promise(r => setTimeout(r, 50));
        if (typeof tf === 'undefined') throw new Error('TensorFlow.js Bibliothek nicht gefunden.');
        updateBadge('badge-tf', true);
        logMessage('TensorFlow.js Bibliothek bereit.', 'info');
        await new Promise(r => setTimeout(r, 50));
        sofa = createSofa(0.5, 0.5);
        updateBadge('badge-backend', true);
        logMessage('Physisches Sofa-Objekt erstellt.', 'info');
        await new Promise(r => setTimeout(r, 50));
        Path.init(0.01);
        updateBadge('badge-ai', true);
        logMessage('KI-Modell erfolgreich initialisiert.', 'info');
        updateUI(0);
        draw();
        isRunning = true;
        pauseButton.disabled = false;
        logMessage('Initialisierung abgeschlossen. Starte Simulationsschleife...', 'info');
        simulationLoop();
    } catch (error) {
        logMessage(`INITIALISIERUNGSFEHLER: ${error.message}`, 'error');
        startButton.disabled = false;
    }
}

function simulationLoop() {
    if (!isRunning) return;
    try {
        Path.trainStep(sofa);
        const waypoints = Path.getWaypoints();
        let currentLoss = 0;
        for (const wp of waypoints) {
            sofa.setPosition(wp.x, wp.y, wp.rotation);
            currentLoss += Corridor.calculateCollisionLoss(sofa);
        }
        currentLoss /= waypoints.length;
        if (isNaN(currentLoss)) throw new Error("Kollisionsverlust ist NaN.");
        if (currentLoss < 0.001) {
            stableFrames++;
        } else {
            stableFrames = 0;
        }
        if (stableFrames > 100) {
            sofa.grow();
            Path.init(0.01);
            stableFrames = 0;
            logMessage(`Erfolg! Sofa wächst auf ${sofa.width.toFixed(2)}m.`, 'info');
        }
        frameCounter++;
        if (frameCounter >= ANIMATION_SPEED) {
            frameCounter = 0;
            currentWaypointIndex = (currentWaypointIndex + 1) % Path.numWaypoints;
        }
        updateUI(currentLoss);
        draw();
        requestAnimationFrame(simulationLoop);
    } catch (error) {
        isRunning = false;
        startButton.disabled = true;
        pauseButton.disabled = true;
        logMessage(`KRITISCHER FEHLER: ${error.message}`, 'error');
        console.error("Detaillierter Fehler:", error);
    }
}

// --- Hilfsfunktionen ---

function logMessage(message, type = 'info') {
    if (!logContainer) return;
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

function updateBadge(id, success) {
    const badge = document.getElementById(id);
    if(badge) {
        badge.className = `badge ${success ? 'success' : 'pending'}`;
    }
}

function updateUI(loss) {
    if (!sofa) return;
    document.getElementById('sofa-size').textContent = `Breite: ${sofa.width.toFixed(2)} m, Höhe: ${sofa.height.toFixed(2)} m`;
    document.getElementById('sofa-area').textContent = `Fläche: ${(sofa.width * sofa.height).toFixed(2)} m²`;
    document.getElementById('collision-loss').textContent = `Kollisionsverlust: ${loss.toExponential(3)}`;
    document.getElementById('stable-frames').textContent = `Stabile Frames: ${stableFrames} / 100`;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!sofa) return;

    ctx.save();
    ctx.translate(20, 20);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const w = Corridor.width * SCALE;
    const l = Corridor.armLength * SCALE;
    ctx.moveTo(0, l); ctx.lineTo(0, 0); ctx.lineTo(l, 0); ctx.lineTo(l, w);
    ctx.lineTo(w, w); ctx.lineTo(w, l); ctx.closePath(); ctx.stroke();
    ctx.fillStyle = 'lightgreen';
    ctx.fillText('A', 0.5 * w - 5, l - 5);
    ctx.fillStyle = 'red';
    ctx.fillText('B', l - 15, 0.5 * w + 5);

    // HIER IST DIE KORREKTUR:
    // Wir prüfen jetzt auf die neue, korrekte Variable 'pathWaypoints'.
    if (Path.pathWaypoints) {
        const waypoints = Path.getWaypoints();
        ctx.fillStyle = '#f1c40f';
        for (const wp of waypoints) {
            ctx.beginPath();
            ctx.arc(wp.x * SCALE, wp.y * SCALE, 3, 0, 2 * Math.PI);
            ctx.fill();
        }
        const currentWaypoint = waypoints[currentWaypointIndex];
        sofa.setPosition(currentWaypoint.x, currentWaypoint.y, currentWaypoint.rotation);
        const corners = sofa.getCorners();
        const loss = Corridor.calculateCollisionLoss(sofa);
        ctx.beginPath();
        ctx.moveTo(corners[0].x * SCALE, corners[0].y * SCALE);
        for (let i = 1; i < corners.length; i++) {
            ctx.lineTo(corners[i].x * SCALE, corners[i].y * SCALE);
        }
        ctx.closePath();
        ctx.fillStyle = loss > 0.0001 ? '#e74c3c' : '#3498db';
        ctx.fill();
        ctx.strokeStyle = '#ecf0f1';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
    ctx.restore();
}
