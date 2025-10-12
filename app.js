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

// Animation
let currentWaypointIndex = 0;
let frameCounter = 0;
const ANIMATION_SPEED = 4;

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
    sofa = createSofa(0.5, 0.5); // Start mit einem kleinen Sofa
    startButton = document.getElementById('startButton');
    pauseButton = document.getElementById('pauseButton');
    updateBadge('badge-backend', true);
    await new Promise(resolve => setTimeout(resolve, 50));
    Path.init(0.01);
    updateBadge('badge-ai', true);
    setupControls();
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
    if (!isRunning) return;
    Path.trainStep(sofa);
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
    frameCounter++;
    if (frameCounter >= ANIMATION_SPEED) {
        frameCounter = 0;
        currentWaypointIndex = (currentWaypointIndex + 1) % Path.numWaypoints;
    }
    document.getElementById('sofa-size').textContent = `Breite: ${sofa.width.toFixed(2)} m, Höhe: ${sofa.height.toFixed(2)} m`;
    document.getElementById('sofa-area').textContent = `Fläche: ${(sofa.width * sofa.height).toFixed(2)} m²`;
    document.getElementById('collision-loss').textContent = `Kollisionsverlust: ${currentLoss.toExponential(3)}`;
    document.getElementById('stable-frames').textContent = `Stabile Frames: ${stableFrames} / 100`;
    draw();
    requestAnimationFrame(simulationLoop);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(20, 20);

    // Korridor zeichnen
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const w = Corridor.width * SCALE;
    const l = Corridor.armLength * SCALE;
    ctx.moveTo(0, l); ctx.lineTo(0, 0); ctx.lineTo(l, 0); ctx.lineTo(l, w);
    ctx.lineTo(w, w); ctx.lineTo(w, l); ctx.closePath(); ctx.stroke();

    // GEÄNDERT: A/B-Markierungen an die neue Route anpassen
    ctx.fillStyle = 'lightgreen';
    ctx.fillText('A', 0.5 * w - 5, l - 5); // A ist jetzt UNTEN
    ctx.fillStyle = 'red';
    ctx.fillText('B', l - 15, 0.5 * w + 5); // B bleibt RECHTS

    if (Path.pathAdjustments) {
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
