// app.js (Version 4 - AI Pathfinding Engine)
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
    
    const setBadge = (id,s,t) => { const el=document.getElementById(id);if(el){el.className='badge';el.classList.add(s);el.textContent=t;}};
    const runDiagnostics = () => {
        setBadge('badge-js','success','JS OK');
        if(typeof Corridor!=='object'){setBadge('badge-corridor','error','Korridor FEHLT');return false;} setBadge('badge-corridor','success','Korridor OK');
        if(typeof createSofa!=='function'){setBadge('badge-sofa','error','Sofa FEHLT');return false;} setBadge('badge-sofa','success','Sofa OK');
        if(typeof Path!=='object'){setBadge('badge-path','error','Pilot FEHLT');return false;} setBadge('badge-path','success','Pilot OK');
        if(typeof tf!=='object'){setBadge('badge-tfjs','error','TF.js FEHLT');return false;} setBadge('badge-tfjs','warn','TF.js Geladen');
        return true;
    };
    const initBackend = async () => { /* ... (unverändert) ... */ };

    // --- Haupt-Schleife: Der KI-Lehrer ---
    const simulationLoop = () => {
        if (!isRunning) return;

        // Lass den Piloten einen Schritt lernen
        const { path, collisionLoss } = Path.trainStep(sofa);
        currentPath = path; // Merke dir den neuesten Pfad für die Visualisierung

        // Prüfe, ob der Pfad gut genug ist
        if (collisionLoss < 0.01) {
            stableCounter++;
        } else {
            stableCounter = 0;
        }

        // Wenn der Pfad 100 Frames lang stabil und kollisionsfrei war -> Erfolg!
        if (stableCounter > 100) {
            console.log(`SUCCESS! Path found for area ${(sofa.width * sofa.height).toFixed(3)}.`);
            phaseEl.textContent = "Erfolgreich! Vergrößere...";
            sofa.grow(); // Belohnung: Wachsen
            stableCounter = 0; // Setze Zähler zurück
            // Optional: Modell zurücksetzen für eine neue Herausforderung
            Path.init(CONFIG.LEARNING_RATE); 
        } else {
            phaseEl.textContent = "Lerne Pfad...";
        }

        iteration++;
        lossEl.textContent = collisionLoss.toFixed(4);
        iterationEl.textContent = iteration;
        areaEl.textContent = (sofa.width * sofa.height).toFixed(4);
        
        draw();
        requestAnimationFrame(simulationLoop);
    };

    // --- Visualisierung ---
    const draw = () => {
        const worldSize=4.0, scale=CONFIG.CANVAS_SIZE/worldSize;
        // 1. Zeichne Korridor...
        ctx.fillStyle='#2a2a2a';ctx.fillRect(0,0,canvas.width,canvas.height);
        const cW=Corridor.width*scale, cL=Corridor.armLength*scale;
        ctx.fillStyle='#000000';ctx.fillRect(0,0,cW,cL);ctx.fillRect(0,cL-cW,cL,cW);
        ctx.fillStyle="white";ctx.font="bold 20px sans-serif";ctx.textAlign="center";
        ctx.fillText("A",cW/2,25);ctx.fillText("B",cL-20,cL-cW/2+8);

        // 2. Zeichne den gelernten Pfad und das Sofa darauf
        if (currentPath && currentPath.length > 0) {
            // Zeichne die Wegpunkte als kleine Kreise
            ctx.fillStyle = "yellow";
            for (const point of currentPath) {
                ctx.beginPath();
                ctx.arc(point.x * scale, point.y * scale, 3, 0, 2 * Math.PI);
                ctx.fill();
            }

            // Zeichne das Sofa an mehreren Stellen entlang des Pfades
            for (let i = 0; i <= 5; i++) {
                const p = i / 5;
                const pos = Path._interpolatePath(currentPath, p);
                sofa.setPosition(pos.x, pos.y, pos.rotation);
                const hasCollision = Corridor.checkCollision(sofa);
                
                ctx.save();
                ctx.translate(sofa.x*scale,sofa.y*scale);ctx.rotate(sofa.rotation);
                ctx.fillStyle=hasCollision?"#dc3545":"rgba(0, 123, 255, 0.5)";
                ctx.fillRect(-sofa.width/2*scale,-sofa.height/2*scale,sofa.width*scale,sofa.height*scale);
                ctx.restore();
            }
        }
    };
    
    // --- App Start ---
    const main = async () => {
        updateConfig();
        canvas.width = CONFIG.CANVAS_SIZE; canvas.height = CONFIG.CANVAS_SIZE;
        if (!runDiagnostics()) { alert("Module konnten nicht geladen werden."); return; }
        
        // Initialisiere KI-Backend
        setTimeout(async () => {
            await initBackend();
            sofa = createSofa(0.8, 0.8); // Starte mit einem Sofa, das fast passt
            Path.init(CONFIG.LEARNING_RATE); // Initialisiere den Piloten
            currentPath = Path.getWaypoints(); // Hol den initialen (dummen) Pfad
            draw();
            startStopBtn.disabled = false; startStopBtn.textContent = "Start";
        }, 100);
    };
    
    // UI-Events...
    startStopBtn.addEventListener('click', () => { isRunning = !isRunning; startStopBtn.textContent = isRunning ? 'Stop' : 'Start'; if (isRunning) simulationLoop(); });
    main();
});
