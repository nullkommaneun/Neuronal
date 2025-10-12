/**
 * @file app.js
 * @description Haupt-Anwendungslogik. Initialisiert die Simulation,
 * steuert den Trainingsprozess (KI-Lehrer) und die Visualisierung.
 */

// Warten, bis das gesamte DOM geladen ist, bevor wir die Anwendung starten.
window.addEventListener('DOMContentLoaded', main);

// Globale Variablen für den Zustand der Simulation
let canvas, ctx;
let sofa;
const SCALE = 100; // 100 Pixel pro Meter
let collisionLossHistory = [];
let stableFrames = 0;

/**
 * Aktualisiert den Status eines Badges im Diagnose-Panel.
 * @param {string} id - Die ID des Badge-Elements.
 * @param {boolean} success - Ob der Status erfolgreich ist.
 */
function updateBadge(id, success) {
    const badge = document.getElementById(id);
    if (success) {
        badge.classList.remove('pending');
        badge.classList.add('success');
    }
}

/**
 * Asynchrone Hauptfunktion zur Initialisierung der Anwendung.
 * VERMERK: Die Verwendung von 'async' und 'await' mit 'setTimeout' ist eine
 * moderne Methode, um nicht blockierende Ladeanimationen zu erstellen.
 * Die UI bleibt reaktiv, während die Initialisierungsschritte nacheinander ablaufen.
 */
async function main() {
    // 1. Schritt: JS Entry Point
    updateBadge('badge-js', true);
    await new Promise(resolve => setTimeout(resolve, 50)); // Kurze Pause für den visuellen Effekt

    // 2. Schritt: Überprüfen, ob alle Module (Objekte) geladen sind.
    const modulesLoaded = typeof Corridor !== 'undefined' && typeof createSofa !== 'undefined' && typeof Path !== 'undefined';
    updateBadge('badge-modules', modulesLoaded);
    if (!modulesLoaded) return;
    await new Promise(resolve => setTimeout(resolve, 50));

    // 3. Schritt: Überprüfen, ob die TF.js-Bibliothek verfügbar ist.
    const tfLoaded = typeof tf !== 'undefined';
    updateBadge('badge-tf', tfLoaded);
    if (!tfLoaded) return;
    await new Promise(resolve => setTimeout(resolve, 50));

    // 4. Schritt: Backend initialisieren (Canvas, Sofa, etc.)
    canvas = document.getElementById('simulationCanvas');
    ctx = canvas.getContext('2d');
    sofa = createSofa(1.0, 1.0); // Start mit einem 1x1 Meter Sofa
    updateBadge('badge-backend', true);
    await new Promise(resolve => setTimeout(resolve, 50));

    // 5. Schritt: KI-Modell erstellen
    Path.init(0.01); // Lernrate von 0.01
    updateBadge('badge-ai', true);

    // Starte die Hauptschleife der Simulation.
    simulationLoop();
}

/**
 * Die Hauptschleife der Anwendung. Wird mit requestAnimationFrame kontinuierlich aufgerufen.
 */
function simulationLoop() {
    // 1. KI-Training: Führe einen Lernschritt durch.
    Path.trainStep(sofa);

    // 2. Verlust-Überwachung für Curriculum Learning
    const waypoints = Path.getWaypoints();
    let currentLoss = 0;
    for (const wp of waypoints) {
        sofa.setPosition(wp.x, wp.y, wp.rotation);
        currentLoss += Corridor.calculateCollisionLoss(sofa);
    }
    currentLoss /= waypoints.length;

    // HINWEIS: Dies ist die Curriculum-Learning-Logik.
    // Der "Lehrer" (app.js) bewertet die Leistung des "Schülers" (Path.js).
    if (currentLoss < 0.001) {
        stableFrames++;
    } else {
        stableFrames = 0; // Rückschlag, Zähler zurücksetzen.
    }

    // Wenn der Pfad für 100 Frames stabil und kollisionsfrei war...
    if (stableFrames > 100) {
        // ...erhöhe den Schwierigkeitsgrad.
        sofa.grow();
        // VERMERK: Das KI-Modell wird zurückgesetzt. Es ist oft einfacher,
        // das neue, schwierigere Problem von Grund auf zu lernen, als
        // eine alte Lösung anzupassen.
        Path.init(0.01);
        stableFrames = 0; // Zähler für die nächste Stufe zurücksetzen.
    }

    // 3. Aktualisiere die UI-Anzeigen.
    document.getElementById('sofa-size').textContent = `Breite: ${sofa.width.toFixed(2)} m, Höhe: ${sofa.height.toFixed(2)} m`;
    document.getElementById('sofa-area').textContent = `Fläche: ${(sofa.width * sofa.height).toFixed(2)} m²`;
    document.getElementById('collision-loss').textContent = `Kollisionsverlust: ${currentLoss.toExponential(3)}`;
    document.getElementById('stable-frames').textContent = `Stabile Frames: ${stableFrames} / 100`;

    // 4. Zeichne den aktuellen Zustand.
    draw();

    // Fordere den nächsten Frame an.
    requestAnimationFrame(simulationLoop);
}

/**
 * Zeichnet die gesamte Simulation auf den Canvas.
 */
function draw() {
    // Canvas leeren
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Setze den Ursprung in die obere linke Ecke des Korridors mit etwas Rand.
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

    // Start- und Endpunkte markieren
    ctx.fillStyle = 'lightgreen';
    ctx.fillText('A', 0.5 * w - 5, 15);
    ctx.fillStyle = 'red';
    ctx.fillText('B', l - 15, 0.5 * w + 5);

    // 2. Zeichne die "Geisterbilder" des Sofas entlang des Pfades.
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

        // Farbe basierend auf Kollision wählen.
        ctx.fillStyle = loss > 0.0001 ? 'rgba(255, 59, 48, 0.25)' : 'rgba(0, 123, 255, 0.15)';
        ctx.fill();
    }

    // 3. Zeichne die Wegpunkte als gelbe Kreise.
    ctx.fillStyle = '#f1c40f'; // Gelb
    for (const wp of waypoints) {
        ctx.beginPath();
        ctx.arc(wp.x * SCALE, wp.y * SCALE, 3, 0, 2 * Math.PI);
        ctx.fill();
    }

    ctx.restore();
}
