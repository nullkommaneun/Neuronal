// app.js (Version 6 - Stabilized Engine)
document.addEventListener('DOMContentLoaded', () => {
    // UI-Elemente
    const canvas = document.getElementById('simulation-canvas'), ctx = canvas.getContext('2d');
    const areaEl = document.getElementById('metric-area'), iterationEl = document.getElementById('metric-iteration');
    const phaseEl = document.getElementById('metric-phase'), lossEl = document.getElementById('metric-loss');
    const startStopBtn = document.getElementById('start-stop-btn');
    
    // Globale Variablen
    let isRunning = false, iteration = 0, CONFIG;
    let sofa;

    const CONFIG_MODES = { fast: {}, quality: {} };

    const updateConfig = () => {
        CONFIG = CONFIG_MODES[document.querySelector('input[name="performance"]:checked').value];
        CONFIG.CANVAS_SIZE = Math.min(window.innerWidth * 0.9, window.innerHeight * 0.9, 500);
    };
    
    // Diagnose
    const setBadge = (id,s,t) => { const el=document.getElementById(id); if(el){el.className='badge'; el.classList.add(s); el.textContent=t;}};
    const runDiagnostics = () => {
        setBadge('badge-js','success','JS OK');
        if(typeof Corridor !=='object'){setBadge('badge-corridor','error','Korridor FEHLT');return false;} setBadge('badge-corridor','success','Korridor OK');
        if(typeof createSofa !=='function'){setBadge('badge-sofa','error','Sofa FEHLT');return false;} setBadge('badge-sofa','success','Sofa OK');
        if(typeof Path !=='object'){setBadge('badge-path','error','Pilot FEHLT');return false;} setBadge('badge-path','success','Pilot OK');
        setBadge('badge-tfjs','warn','TF.js Deaktiviert');
        return true;
    };

    // Haupt-Schleife
    const simulationLoop = () => {
        if (!isRunning) return;

        const totalSteps = 150;
        const progress = iteration / totalSteps;

        const { x, y, rotation } = Path.getPointOnPath(progress, sofa);
        sofa.setPosition(x, y, rotation);
        const hasCollision = Corridor.checkCollision(sofa);
        
        if (hasCollision) {
            phaseEl.textContent = "Kollision!";
            isRunning = false;
            startStopBtn.textContent = "Neustart";
            draw(true);
            return;
        }
        
        if (iteration >= totalSteps) { // Pfad erfolgreich beendet
            phaseEl.textContent = "Erfolgreich!";
            sofa.grow();
            iteration = 0; // Setze für den nächsten Versuch zurück
            setTimeout(() => { // Kurze Pause zur Visualisierung
                if (isRunning) requestAnimationFrame(simulationLoop);
            }, 50);
            return;
        }
        
        draw(false);
        iteration++;
        iterationEl.textContent = iteration;
        areaEl.textContent = (sofa.width * sofa.height).toFixed(4);
        lossEl.textContent = "0.000";
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

    // App Start & UI-Events
    const resetSimulation = () => {
        sofa = createSofa(0.5, 0.5);
        iteration = 0;
        phaseEl.textContent = "Bereit";
        iterationEl.textContent = "0";
        areaEl.textContent = (sofa.width * sofa.height).toFixed(4);
        lossEl.textContent = "0.000";
        draw(false);
    };

    const main = () => {
        updateConfig();
        canvas.width = CONFIG.CANVAS_SIZE; canvas.height = CONFIG.CANVAS_SIZE;
        if (!runDiagnostics()) {
            alert("Fehler: Kritische Module konnten nicht geladen werden.");
            return;
        }
        
        resetSimulation();
        const diagP = document.querySelector('#diag-content p'); if(diagP) diagP.style.display = 'none';
        
        startStopBtn.disabled = false;
        startStopBtn.textContent = "Start";
    };
    
    startStopBtn.addEventListener('click', () => {
        if (startStopBtn.textContent === "Neustart") {
            resetSimulation();
        }
        isRunning = !isRunning;
        startStopBtn.textContent = isRunning?'Stop':'Start';
        if (isRunning) requestAnimationFrame(simulationLoop);
    });
    document.querySelectorAll('input[name="performance"]').forEach(radio => radio.addEventListener('change', updateConfig));
    main();
});
