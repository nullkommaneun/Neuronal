// app.js
document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const canvas = document.getElementById('simulation-canvas'), ctx = canvas.getContext('2d');
    const areaEl = document.getElementById('metric-area'), iterationEl = document.getElementById('metric-iteration');
    const phaseEl = document.getElementById('metric-phase'), lossEl = document.getElementById('metric-loss');
    const startStopBtn = document.getElementById('start-stop-btn');
    
    // Global State
    let isRunning = false, iteration = 0, CONFIG;
    let sofa;

    const CONFIG_MODES = { fast: {}, quality: {} };

    const updateConfig = () => {
        CONFIG = CONFIG_MODES[document.querySelector('input[name="performance"]:checked').value];
        CONFIG.CANVAS_SIZE = Math.min(window.innerWidth * 0.9, window.innerHeight * 0.9, 500);
    };
    
    // Diagnostics
    const setBadge = (id,s,t) => { const el=document.getElementById(id); if(el){el.className='badge'; el.classList.add(s); el.textContent=t;}};
    const runDiagnostics = () => {
        setBadge('badge-js','success','JS OK');
        if(typeof Corridor!=='object'){setBadge('badge-corridor','error','Korridor FEHLT');return false;} setBadge('badge-corridor','success','Korridor OK');
        if(typeof createSofa!=='function'){setBadge('badge-sofa','error','Sofa FEHLT');return false;} setBadge('badge-sofa','success','Sofa OK');
        // Simplified diagnostics without TF.js
        if(typeof Path!=='object'){setBadge('badge-path','error','Pilot FEHLT');return false;} setBadge('badge-path','success','Pilot OK');
        setBadge('badge-tfjs','warn','TF.js Deaktiviert');
        return true;
    };

    // Main Simulation Loop
    const simulationLoop = () => {
        if (!isRunning) return;

        const totalSteps = 150;
        const step = iteration % (totalSteps + 1);
        const progress = step / totalSteps;

        const { x, y, rotation } = Path.getPointOnPath(progress);
        sofa.setPosition(x, y, rotation);
        const hasCollision = Corridor.checkCollision(sofa);
        
        // Growth Logic
        if (step === totalSteps) {
            if (hasCollision) {
                phaseEl.textContent = "Fehlgeschlagen!";
                isRunning = false;
                startStopBtn.textContent = "Neustart";
            } else {
                phaseEl.textContent = "Erfolgreich!";
                sofa.grow();
                iteration = -1; // Next round starts at 0
            }
        }
        
        draw(hasCollision);
        iteration++;
        iterationEl.textContent = iteration;
        areaEl.textContent = (sofa.width * sofa.height).toFixed(4);
        lossEl.textContent = hasCollision ? "1.000" : "0.000";
        requestAnimationFrame(simulationLoop);
    };

    // Visualization
    const draw = (hasCollision) => {
        const worldSize=4.0, scale=CONFIG.CANVAS_SIZE/worldSize;
        ctx.fillStyle='#2a2a2a';ctx.fillRect(0,0,canvas.width,canvas.height);
        const cW=Corridor.width*scale, cL=Corridor.armLength*scale;
        ctx.fillStyle='#000000';ctx.fillRect(0,0,cW,cL);ctx.fillRect(0,cL-cW,cL,cW);
        ctx.fillStyle="white";ctx.font="bold 20px sans-serif";ctx.textAlign="center";
        ctx.fillText("A",cW/2,25);ctx.fillText("B",cL-20,cL-cW/2+8);

        ctx.save();
        ctx.translate(sofa.x*scale,sofa.y*scale);ctx.rotate(sofa.rotation);
        ctx.fillStyle = hasCollision?"#dc3545":"#007bff";
        ctx.fillRect(-sofa.width/2*scale,-sofa.height/2*scale,sofa.width*scale,sofa.height*scale);
        ctx.restore();
    };

    // App Initialization
    const main = () => {
        updateConfig();
        canvas.width = CONFIG.CANVAS_SIZE; canvas.height = CONFIG.CANVAS_SIZE;
        if (!runDiagnostics()) { alert("Module konnten nicht geladen werden."); return; }
        
        sofa = createSofa(0.5, 0.5); // Start with a small sofa

        phaseEl.textContent = "Bereit";
        const diagP = document.querySelector('#diag-content p'); if(diagP) diagP.style.display = 'none';
        
        draw(false);
        startStopBtn.disabled = false;
        startStopBtn.textContent = "Start";
    };
    
    // Event Listeners
    startStopBtn.addEventListener('click', () => {
        if (startStopBtn.textContent === "Neustart") {
            sofa = createSofa(0.5, 0.5);
            iteration = 0;
            phaseEl.textContent = "Bereit";
        }
        isRunning = !isRunning;
        startStopBtn.textContent = isRunning?'Stop':'Start';
        if (isRunning) requestAnimationFrame(simulationLoop);
    });
    // Add other listeners for diag panel etc.
    document.querySelectorAll('input[name="performance"]').forEach(radio => radio.addEventListener('change', updateConfig));
    
    main();
});
