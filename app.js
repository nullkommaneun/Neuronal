// app.js (AI Trainer)
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('simulation-canvas'), ctx = canvas.getContext('2d');
    const areaEl = document.getElementById('metric-area'), lossEl = document.getElementById('metric-loss');
    const iterationEl = document.getElementById('metric-iteration'), phaseEl = document.getElementById('metric-phase');
    const startStopBtn = document.getElementById('start-stop-btn');
    
    let isRunning = false, iteration = 0, CONFIG;
    let sofa, currentPath = [], stableCounter = 0;

    const CONFIG_MODES = {
        fast: { LEARNING_RATE: 0.01 },
        quality: { LEARNING_RATE: 0.005 }
    };

    const updateConfig = () => { /* ... (unverändert) ... */ };
    
    const setBadge = (id,s,t) => { /* ... (unverändert) ... */};
    const runDiagnostics = () => {
        setBadge('badge-js','success','JS OK');
        if(typeof Corridor!=='object'){setBadge('badge-corridor','error','Korridor FEHLT');return false;} setBadge('badge-corridor','success','Korridor OK');
        if(typeof createSofa!=='function'){setBadge('badge-sofa','error','Sofa FEHLT');return false;} setBadge('badge-sofa','success','Sofa OK');
        if(typeof Path!=='object'){setBadge('badge-path','error','Pilot FEHLT');return false;} setBadge('badge-path','success','Pilot OK');
        if(typeof tf!=='object'){setBadge('badge-tfjs','error','TF.js FEHLT');return false;} setBadge('badge-tfjs','warn','TF.js Geladen');
        return true;
    };
    const initBackend = async () => { /* ... (unverändert) ... */};

    const simulationLoop = async () => {
        if (!isRunning) return;

        // Lass den Piloten einen Lernschritt machen
        const { path, collisionLoss } = Path.trainStep(sofa);
        currentPath = path;

        // Wenn der Verlust (Eindringtiefe) klein genug ist, ist der Pfad gültig
        if (collisionLoss < 0.001) {
            stableCounter++;
        } else {
            stableCounter = 0;
        }

        // Wenn der Pfad lange genug stabil war, ist der Versuch erfolgreich
        if (stableCounter > 100) {
            phaseEl.textContent = "Erfolgreich! Vergrößere...";
            sofa.grow();
            stableCounter = 0;
            Path.init(CONFIG.LEARNING_RATE); // Setze das Modell zurück, um eine neue, schwierigere Lösung zu finden
        } else {
            phaseEl.textContent = "Lerne Pfad...";
        }

        iteration++;
        lossEl.textContent = collisionLoss.toFixed(4);
        iterationEl.textContent = iteration;
        areaEl.textContent = (sofa.width * sofa.height).toFixed(4);
        
        draw();
        await tf.nextFrame();
        requestAnimationFrame(simulationLoop);
    };

    const draw = () => {
        const worldSize=4.0, scale=CONFIG.CANVAS_SIZE/worldSize;
        ctx.fillStyle='#2a2a2a';ctx.fillRect(0,0,canvas.width,canvas.height);
        const cW=Corridor.width*scale, cL=Corridor.armLength*scale;
        ctx.fillStyle='#000000';ctx.fillRect(0,0,cW,cL);ctx.fillRect(0,cL-cW,cL,cW);
        ctx.fillStyle="white";ctx.font="bold 20px sans-serif";ctx.textAlign="center";
        ctx.fillText("A",cW/2,25);ctx.fillText("B",cL-20,cL-cW/2+8);

        if (currentPath && currentPath.length > 0) {
            // Visualisiere den Pfad und das Sofa an mehreren Stellen
            for (let i = 0; i <= 10; i++) {
                const p = i / 10;
                const pos = Path._interpolatePath(currentPath, p);
                sofa.setPosition(pos.x, pos.y, pos.rotation);
                const loss = Corridor.calculateCollisionLoss(sofa);
                
                ctx.save();
                ctx.translate(sofa.x*scale,sofa.y*scale);ctx.rotate(sofa.rotation);
                // Färbe das Sofa rot, wenn es in der Wand steckt
                ctx.fillStyle = loss > 0.001 ? "rgba(220, 53, 69, 0.6)" : "rgba(0, 123, 255, 0.5)";
                ctx.fillRect(-sofa.width/2*scale,-sofa.height/2*scale,sofa.width*scale,sofa.height*scale);
                ctx.restore();
            }
        }
    };
    
    const main = async () => {
        updateConfig();
        canvas.width = CONFIG.CANVAS_SIZE; canvas.height = CONFIG.CANVAS_SIZE;
        if (!runDiagnostics()) { alert("Module konnten nicht geladen werden."); return; }
        
        setTimeout(async () => {
            await initBackend();
            sofa = createSofa(0.9, 0.9); // Starte mit einem Sofa, das fast passt
            Path.init(CONFIG.LEARNING_RATE);
            currentPath = Path.getWaypoints();
            draw();
            startStopBtn.disabled = false; startStopBtn.textContent = "Start";
        }, 100);
    };
    
    startStopBtn.addEventListener('click', () => { isRunning = !isRunning; startStopBtn.textContent = isRunning ? 'Stop' : 'Start'; if (isRunning) simulationLoop(); });
    main();
});
