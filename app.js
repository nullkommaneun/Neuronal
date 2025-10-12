// app.js
document.addEventListener('DOMContentLoaded', () => {
    // UI-Elemente
    const canvas = document.getElementById('simulation-canvas'), ctx = canvas.getContext('2d');
    const areaEl = document.getElementById('metric-area'), iterationEl = document.getElementById('metric-iteration');
    const phaseEl = document.getElementById('metric-phase');
    const startStopBtn = document.getElementById('start-stop-btn');
    
    // Globale Variablen
    let isRunning = false, iteration = 0, CONFIG;
    let sofa; // Hält unser Sofa-Objekt

    const CONFIG_MODES = {
        fast: {}, // Momentan keine speziellen Einstellungen nötig
        quality: {}
    };

    const updateConfig = () => {
        CONFIG = CONFIG_MODES[document.querySelector('input[name="performance"]:checked').value];
        CONFIG.CANVAS_SIZE = Math.min(window.innerWidth * 0.9, window.innerHeight * 0.9, 500);
    };
    
    // Diagnose
    const setBadge = (id, status, text) => { const el=document.getElementById(id); if(el){el.className='badge'; el.classList.add(status); el.textContent=text;} };
    const runDiagnostics = () => {
        setBadge('badge-js','success','JS OK');
        if(typeof Corridor !=='object'){setBadge('badge-corridor','error','Korridor FEHLT');return false;} setBadge('badge-corridor','success','Korridor OK');
        if(typeof createSofa !=='function'){setBadge('badge-sofa','error','Sofa FEHLT');return false;} setBadge('badge-sofa','success','Sofa OK');
        return true;
    };

    // Haupt-Schleife
    const simulationLoop = () => {
        if (!isRunning) return;

        // --- Dynamische Pfadberechnung ---
        // Dies ersetzt den alten, starren Pfad.
        const totalSteps = 150; // Gesamte Länge der Animation
        const step = iteration % (totalSteps + 1);
        const progress = step / totalSteps; // 0.0 -> 1.0

        // Berechne Position und Rotation basierend auf dem Fortschritt
        const rotation = (Math.PI / 2) * Math.min(1, progress * 2);
        const xPos = 0.5 + Math.max(0, progress * 2 - 1) * 2.5;
        const yPos = Math.min(progress * 2, 1) * 2.5;

        sofa.setPosition(xPos, yPos, rotation);
        const hasCollision = Corridor.checkCollision(sofa);
        
        // --- TODO: Wachstums-Logik ---
        if (step === totalSteps) { // Ende des Pfades erreicht
            if (hasCollision) {
                phaseEl.textContent = "Fehlgeschlagen!";
                isRunning = false; // Stopp
                startStopBtn.textContent = "Neustart";
            } else {
                phaseEl.textContent = "Erfolgreich!";
                sofa.grow();
                iteration = -1; // Beginnt nächste Runde bei 0
            }
        }
        
        draw(hasCollision);
        iteration++;
        iterationEl.textContent = iteration;
        areaEl.textContent = (sofa.width * sofa.height).toFixed(4);
        requestAnimationFrame(simulationLoop);
    };

    // Visualisierung
    const draw = (hasCollision) => {
        const worldSize=4.0, scale=CONFIG.CANVAS_SIZE/worldSize;
        ctx.fillStyle='#2a2a2a';ctx.fillRect(0,0,canvas.width,canvas.height);
        const corridorW=Corridor.width*scale, corridorL=Corridor.armLength*scale;
        ctx.fillStyle='#000000';ctx.fillRect(0,0,corridorW,corridorL);ctx.fillRect(0,corridorL-corridorW,corridorL,corridorW);
        ctx.fillStyle="white";ctx.font="bold 20px sans-serif";ctx.textAlign="center";
        ctx.fillText("A",corridorW/2,25);ctx.fillText("B",corridorL-20,corridorL-(corridorW/2)+8);

        ctx.save();
        ctx.translate(sofa.x*scale,sofa.y*scale);ctx.rotate(sofa.rotation);
        ctx.fillStyle = hasCollision?"#dc3545":"#007bff";
        ctx.fillRect(-sofa.width/2*scale,-sofa.height/2*scale,sofa.width*scale,sofa.height*scale);
        ctx.restore();
    };

    // App Start
    const main = () => {
        updateConfig();
        canvas.width = CONFIG.CANVAS_SIZE; canvas.height = CONFIG.CANVAS_SIZE;
        if (!runDiagnostics()) { alert("Module konnten nicht geladen werden."); return; }
        
        // Erstelle das Start-Sofa
        sofa = createSofa(0.5, 0.5);

        phaseEl.textContent = "Bereit";
        const diagP = document.querySelector('#diag-content p');
        if(diagP) diagP.style.display = 'none';

        draw(false);
        startStopBtn.disabled = false;
        startStopBtn.textContent = "Start";
    };
    
    // UI-Events
    startStopBtn.addEventListener('click', () => {
        if (startStopBtn.textContent === "Neustart") {
            sofa = createSofa(0.5, 0.5); // Setze das Sofa zurück
            iteration = 0;
            phaseEl.textContent = "Bereit";
        }
        isRunning = !isRunning;
        startStopBtn.textContent = isRunning?'Stop':'Start';
        if (isRunning) requestAnimationFrame(simulationLoop);
    });
    document.querySelectorAll('input[name="performance"]').forEach(radio => radio.addEventListener('change', updateConfig));
    main();
});

console.log("✅ app.js loaded");
