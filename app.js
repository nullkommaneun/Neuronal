/**
 * @file app.js
 * @description Haupt-Anwendungslogik. Initialisiert die Simulation,
 * steuert den Trainingsprozess (KI-Lehrer) und die Visualisierung.
 */

window.addEventListener('DOMContentLoaded', main);

// Globale Variablen
let canvas, ctx;
let sofa;
const SCALE = 100;
let collisionLossHistory = [];
let stableFrames = 0;

// Steuerung
let isRunning = false;
let startButton, pauseButton;

// NEU: Zustandsvariablen für die Live-Animation
let currentWaypointIndex = 0; // Welcher Wegpunkt wird gerade angezeigt?
let frameCounter = 0;         // Zähler, um die Animationsgeschwindigkeit zu steuern
const ANIMATION_SPEED = 4;    // Alle 4 Frames wird zum nächsten Wegpunkt gewechselt

function updateBadge(id, success) {
    const badge = document.getElementById(id);
    if (success) {
        badge.classList.remove('pending');
        badge.classList.add('success');
    }
}

async function main() {
    updateBadge('badge-js', true);
    await new Promise(resolve => setTimeout(resolve, 50));

    const modulesLoaded = typeof Corridor !== 'undefined' && typeof createSofa !== 'undefined' && typeof Path !== 'undefined';
    updateBadge('badge-modules', modulesLoaded);
    if (!modulesLoaded) return;
    await new Promise(resolve => setTimeout(resolve, 50));

    const tfLoaded = typeof tf !== 'undefined';
    updateBadge('badge-tf', tfLoaded);
    if (!tfLoaded) return;
    await new Promise(resolve => setTimeout(resolve, 50));

    canvas = document.getElementById('simulationCanvas');
    ctx = canvas.getContext('2d');
    sofa = createSofa(0.5, 0.5);
    startButton = document.getElementById('startButton');
    pauseButton = document.getElementById('pauseButton');
    updateBadge('badge-backend', true);
    await new Promise(resolve => setTimeout(resolve, 50));

    Path.init(0.01);
    updateBadge('badge-ai', true);

    setupControls();
    
    // Initialen Zustand zeichnen (ohne Animation)
    draw();
}

function setupControls() {
    startButton.addEventListener('click', () => {
        if (!isRunning) {
            isRunning = true;
            startButton.disabled = true;
            pauseButton.disabled = false;
            simulationLoop();
        }
    });

    pauseButton.addEventListener('click', () => {
        if (isRunning) {
            isRunning = false;
            startButton.disabled = false;
            pauseButton.disabled = true;
        }
    });
}

function simulationLoop() {
    if (!isRunning) {
        return;
    }

    // 1. KI-Training (bleibt unverändert, trainiert immer den ganzen Pfad)
    Path.trainStep(sofa);

    // 2. Verlust-Überwachung und Curriculum Learning (bleibt unverändert)
    const waypoints = Path.getWaypoints();
    let currentLoss = 0;
    for (const wp of waypoints) {
        sofa.setPosition(wp.x, wp.y, wp.rotation);
        currentLoss += Corridor.calculateCollisionLoss(sofa);
    }
    currentLoss /= waypoints.length;

    if (currentLoss < 0.001) {
        stableFrames++;
    } else {
        stableFrames = 0;
    }

    if (stableFrames > 100) {
        sofa.grow();
        Path.init(0.01);
        stableFrames = 0;
    }

    // 3. NEU: Animationslogik
    // Zähle die Frames hoch, um die Geschwindigkeit zu drosseln.
    frameCounter++;
    if (frameCounter >= ANIMATION_SPEED) {
        frameCounter = 0;
        // Gehe zum nächsten Wegpunkt. Wenn das Ende erreicht ist, fange von vorne an.
        currentWaypointIndex = (currentWaypointIndex + 1) % Path.numWaypoints;
    }

    // 4. UI-Anzeigen aktualisieren (bleibt unverändert)
    document.getElementById('sofa-size').textContent = `Breite: ${sofa.width.toFixed(2)} m, Höhe: ${sofa.height.toFixed(2)} m`;
    document.getElementById('sofa-area').textContent = `Fläche: ${(sofa.width * sofa.height).toFixed(2)} m²`;
    document.getElementById('collision-loss').textContent = `Kollisionsverlust: ${currentLoss.toExponential(3)}`;
    document.getElementById('stable-frames').textContent = `Stabile Frames: ${stableFrames} / 100`;

    // 5. Zeichne den aktuellen Zustand
    draw();

    requestAnimationFrame(simulationLoop);
}


/**
 * GEÄNDERT: Zeichnet die Simulation mit einem einzigen, animierten Sofa.
 */
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(20, 20);

    // 1. Zeichne den Korridor (unverändert)
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const w = Corridor.width * SCALE;
    const l = Corridor.armLength * SCALE;
    ctx.moveTo(0, l); ctx.lineTo(0, 0); ctx.lineTo(l, 0); ctx.lineTo(l, w);
    ctx.lineTo(w, w); ctx.lineTo(w, l); ctx.closePath(); ctx.stroke();
    ctx.fillStyle = 'lightgreen'; ctx.fillText('A', 0.5 * w - 5, 15);
    ctx.fillStyle = 'red'; ctx.fillText('B', l - 15, 0.5 * w + 5);

    if (Path.pathAdjustments) {
        const waypoints = Path.getWaypoints();

        // 2. Zeichne alle Wegpunkte als gelbe Kreise (Kontext)
        ctx.fillStyle = '#f1c40f';
        for (const wp of waypoints) {
            ctx.beginPath();
            ctx.arc(wp.x * SCALE, wp.y * SCALE, 3, 0, 2 * Math.PI);
            ctx.fill();
        }

        // 3. GEÄNDERT: Zeichne nur das EINE "Live"-Sofa
        // Holen den aktuellen Wegpunkt basierend auf dem Animationsindex.
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

        // Verwende solide Farben, um das "Live"-Sofa hervorzuheben.
        ctx.fillStyle = loss > 0.0001 ? '#e74c3c' : '#3498db'; // Solides Rot / Blau
        ctx.fill();
        ctx.strokeStyle = '#ecf0f1'; // Heller Rand zur besseren Sichtbarkeit
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
    
    ctx.restore();
}
