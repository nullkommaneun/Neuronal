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

// NEU: Zustandsvariablen für die Steuerung
let isRunning = false;
let startButton, pauseButton;

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

    // Backend initialisieren
    canvas = document.getElementById('simulationCanvas');
    ctx = canvas.getContext('2d');
    sofa = createSofa(1.0, 1.0);
    // NEU: Button-Referenzen holen
    startButton = document.getElementById('startButton');
    pauseButton = document.getElementById('pauseButton');
    updateBadge('badge-backend', true);
    await new Promise(resolve => setTimeout(resolve, 50));

    // KI-Modell erstellen
    Path.init(0.01);
    updateBadge('badge-ai', true);

    // NEU: Event-Listener für die Buttons einrichten
    setupControls();

    // HINWEIS: Die Simulation startet nicht mehr automatisch.
    // Sie wird durch den Klick auf den Start-Button ausgelöst.
    // Wir zeichnen einmal den initialen Zustand.
    draw();
}

/**
 * NEU: Richtet die Event-Listener für die Steuerung ein.
 */
function setupControls() {
    startButton.addEventListener('click', () => {
        if (!isRunning) {
            isRunning = true;
            startButton.disabled = true;
            pauseButton.disabled = false;
            // Starte die Schleife
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

/**
 * Die Hauptschleife der Anwendung.
 */
function simulationLoop() {
    // VERMERK: Fehlerüberwachung direkt am Anfang der Schleife.
    // Wenn der Zustand auf "Pause" gesetzt wurde, wird die Schleife hier beendet
    // und kein neuer Animations-Frame angefordert.
    if (!isRunning) {
        return;
    }

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

    document.getElementById('sofa-size').textContent = `Breite: ${sofa.width.toFixed(2)} m, Höhe: ${sofa.height.toFixed(2)} m`;
    document.getElementById('sofa-area').textContent = `Fläche: ${(sofa.width * sofa.height).toFixed(2)} m²`;
    document.getElementById('collision-loss').textContent = `Kollisionsverlust: ${currentLoss.toExponential(3)}`;
    document.getElementById('stable-frames').textContent = `Stabile Frames: ${stableFrames} / 100`;

    draw();

    // Fordere den nächsten Frame an, aber nur wenn die Simulation noch läuft.
    requestAnimationFrame(simulationLoop);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(20, 20);

    // 1. Zeichne den Korridor
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const w = Corridor.width * SCALE;
    const l = Corridor.armLength * SCALE;
    ctx.moveTo(0, l);
    ctx.lineTo(0, 0);
    ctx.lineTo(l, 0);
    ctx.lineTo(l, w);
    ctx.lineTo(w, w);
    ctx.lineTo(w, l);
    ctx.closePath();
    ctx.stroke();

    ctx.fillStyle = 'lightgreen';
    ctx.fillText('A', 0.5 * w - 5, 15);
    ctx.fillStyle = 'red';
    ctx.fillText('B', l - 15, 0.5 * w + 5);

    // Nur zeichnen, wenn das Modell schon initialisiert ist
    if (Path.pathAdjustments) {
        const waypoints = Path.getWaypoints();
        for (const wp of waypoints) {
            sofa.setPosition(wp.x, wp.y, wp.rotation);
            const corners = sofa.getCorners();
            const loss = Corridor.calculateCollisionLoss(sofa);

            ctx.beginPath();
            ctx.moveTo(corners[0].x * SCALE, corners[0].y * SCALE);
            for (let i = 1; i < corners.length; i++) {
                ctx.lineTo(corners[i].x * SCALE, corners[i].y * SCALE);
            }
            ctx.closePath();

            ctx.fillStyle = loss > 0.0001 ? 'rgba(255, 59, 48, 0.25)' : 'rgba(0, 123, 255, 0.15)';
            ctx.fill();
        }

        ctx.fillStyle = '#f1c40f';
        for (const wp of waypoints) {
            ctx.beginPath();
            ctx.arc(wp.x * SCALE, wp.y * SCALE, 3, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
    
    ctx.restore();
}
