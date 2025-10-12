// app.js (Version 3 - Simulation Engine)
document.addEventListener('DOMContentLoaded', () => {
    // UI-Elemente
    const canvas = document.getElementById('simulation-canvas'), ctx = canvas.getContext('2d');
    const areaEl = document.getElementById('metric-area'), iterationEl = document.getElementById('metric-iteration');
    const phaseEl = document.getElementById('metric-phase');
    const startStopBtn = document.getElementById('start-stop-btn');

    // Globale Variablen
    let isRunning = false, iteration = 0, CONFIG;
    let sofa; // Hält unser physisches Sofa-Objekt

    const CONFIG_MODES = {
        fast: { RENDER_RESOLUTION: 64 }, // Konfig ist viel einfacher jetzt
        quality: { RENDER_RESOLUTION: 96 }
    };

    const updateConfig = () => {
        CONFIG = CONFIG_MODES[document.querySelector('input[name="performance"]:checked').value];
        CONFIG.CANVAS_SIZE = Math.min(window.innerWidth * 0.9, window.innerHeight * 0.9, 500);
    };

    // --- Ein einfacher, fester Pfad für die Demonstration ---
    const testPath = [];
    for (let i = 0; i <= 50; i++) { // 1. Teil: Geradeaus nach unten
        testPath.push({ x: 0.5, y: (i / 50) * 2.5, rotation: 0 });
    }
    for (let i = 0; i <= 50; i++) { // 2. Teil: Drehung in der Ecke
        testPath.push({ x: 0.5 + (i / 50) * 0.5, y: 2.5, rotation: (i / 50) * (Math.PI / 2) });
    }
    for (let i = 0; i <= 50; i++) { // 3. Teil: Geradeaus nach rechts
        testPath.push({ x: 1.0 + (i / 50) * 2.0, y: 2.5, rotation: Math.PI / 2 });
    }

    // --- Haupt-Schleife ---
    const simulationLoop = () => {
        if (!isRunning) return;

        // Bewege das Sofa entlang des Test-Pfades
        const pathStep = iteration % testPath.length;
        const currentMove = testPath[pathStep];
        sofa.setPosition(currentMove.x, currentMove.y, currentMove.rotation);
        
        const hasCollision = Corridor.checkCollision(sofa);

        iteration++;
        iterationEl.textContent = iteration;
        areaEl.textContent = (sofa.width * sofa.height).toFixed(4);

        // TODO: Spätere Logik
        // if (pathStep === testPath.length - 1) {
        //     if (!hasCollision) {
        //         console.log("SUCCESS! Path completed without collision.");
        //         sofa.grow(); // Belohnung: Wachsen
        //         iteration = 0; // Starte neuen Versuch
        //     } else {
        //         console.log("FAILURE! Collision detected.");
        //         isRunning = false; // Stoppe, da es nicht passt
        //     }
        // }
        
        draw(hasCollision);
        requestAnimationFrame(simulationLoop);
    };

    // --- Visualisierung ---
    const draw = (hasCollision) => {
        const worldSize = 4.0;
        const scale = CONFIG.CANVAS_SIZE / worldSize;
        
        // 1. Zeichne Korridor
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const corridorW = Corridor.width * scale, corridorL = Corridor.armLength * scale;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, corridorW, corridorL);
        ctx.fillRect(0, corridorL - corridorW, corridorL, corridorW);
        ctx.fillStyle = "white"; ctx.font = "bold 20px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("A", corridorW / 2, 25);
        ctx.fillText("B", corridorL - 20, corridorL - (corridorW / 2) + 8);

        // 2. Zeichne das Sofa
        ctx.save();
        // Verschiebe den Ursprung zur Sofa-Position
        ctx.translate(sofa.x * scale, sofa.y * scale);
        ctx.rotate(sofa.rotation);
        
        // Setze die Farbe basierend auf Kollision
        ctx.fillStyle = hasCollision ? "#dc3545" : "#007bff"; // Rot bei Kollision, sonst Blau
        
        // Zeichne das Rechteck um den (neuen) Ursprung
        ctx.fillRect(-sofa.width / 2 * scale, -sofa.height / 2 * scale, sofa.width * scale, sofa.height * scale);
        
        ctx.restore();
    };

    // --- App Start ---
    const main = () => {
        updateConfig();
        canvas.width = CONFIG.CANVAS_SIZE;
        canvas.height = CONFIG.CANVAS_SIZE;

        // Erstelle das Start-Sofa: Ein kleines Quadrat von 0.5 x 0.5 Metern
        sofa = new Sofa(0.5, 0.5);

        phaseEl.textContent = "Pfad-Test";
        document.getElementById('diag-content').querySelector('p').style.display = 'none';
        
        draw(false);
        startStopBtn.disabled = false;
        startStopBtn.textContent = "Start";
    };
    
    // UI-Events
    startStopBtn.addEventListener('click', () => {
        if (!isRunning) {
            iteration = 0; // Setze bei jedem Start zurück
        }
        isRunning = !isRunning;
        startStopBtn.textContent = isRunning ? 'Stop' : 'Start';
        if(isRunning) requestAnimationFrame(simulationLoop);
    });
    document.querySelectorAll('input[name="performance"]').forEach(radio => radio.addEventListener('change', updateConfig));
    main();
});
