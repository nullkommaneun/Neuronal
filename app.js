// app.js (Version with Detailed AI Loader)
document.addEventListener('DOMContentLoaded', () => {
    // UI-Elemente und globale Variablen (unverändert)
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
    
    // --- Diagnose mit detaillierterem Feedback ---
    const setBadge = (id, status, text) => { 
        const el = document.getElementById(id); 
        if(el) { el.className='badge'; el.classList.add(status); el.textContent=text; }
    };

    const runDiagnostics = () => {
        setBadge('badge-js','success','JS OK');
        if(typeof Corridor!=='object'){setBadge('badge-corridor','error','Korridor FEHLT');return false;} setBadge('badge-corridor','success','Korridor OK');
        if(typeof createSofa!=='function'){setBadge('badge-sofa','error','Sofa FEHLT');return false;} setBadge('badge-sofa','success','Sofa OK');
        if(typeof Path!=='object'){setBadge('badge-path','error','Pilot FEHLT');return false;} setBadge('badge-path','success','Pilot OK');
        if(typeof tf!=='object'){setBadge('badge-tfjs','error','TF.js FEHLT');return false;} setBadge('badge-tfjs','warn','TF.js Geladen');
        return true;
    };

    // --- Simulation & Visualisierung (unverändert) ---
    const simulationLoop = async () => { /* ... */ };
    const draw = () => { /* ... */ };

    // --- App Start mit schrittweisem KI-Lader ---
    const main = async () => {
        updateConfig();
        canvas.width = CONFIG.CANVAS_SIZE; canvas.height = CONFIG.CANVAS_SIZE;
        
        // Schritt 1: Grundlegende Modul-Checks (schnell)
        if (!runDiagnostics()) {
            alert("Fehler: Kritische Module konnten nicht geladen werden.");
            return;
        }
        
        // Gib dem Browser einen Moment Zeit, die ersten Badges zu rendern
        setTimeout(async () => {
            try {
                // ✅ Schritt 2: Initialisiere das TF.js Backend (potenziell langsam)
                setBadge('badge-backend', 'warn', 'Initialisiere...');
                await tf.setBackend(!!document.createElement('canvas').getContext('webgl2') ? 'webgl' : 'wasm');
                await tf.ready();
                setBadge('badge-backend', 'success', `Backend: ${tf.getBackend().toUpperCase()}`);
                
                // ✅ Schritt 3: Initialisiere das KI-Modell (potenziell langsam)
                setBadge('badge-ai-model', 'warn', 'Erstelle Netz...');
                sofa = createSofa(0.9, 0.9);
                Path.init(CONFIG.LEARNING_RATE); // Dieser Aufruf erstellt das neuronale Netz
                currentPath = Path.getWaypoints();
                setBadge('badge-ai-model', 'success', 'AI Bereit');

                // Schritt 4: Alles ist geladen, schalte die App frei
                document.querySelector('#diag-content p').style.display = 'none';
                draw();
                startStopBtn.disabled = false;
                startStopBtn.textContent = "Start";
                console.log("Application is ready.");

            } catch (error) {
                // Wenn einer der Schritte fehlschlägt, fange den Fehler ab
                console.error("Fehler während der KI-Initialisierung:", error);
                setBadge('badge-backend', 'error', 'FEHLER');
                setBadge('badge-ai-model', 'error', 'FEHLER');
                alert(`Ein Fehler ist beim Laden der KI aufgetreten: ${error.message}`);
            }
        }, 100); // Kurze Verzögerung, um das Einfrieren der UI zu verhindern
    };
    
    // UI-Events und Startpunkt (unverändert)
    startStopBtn.addEventListener('click', () => { /* ... */ });
    main();

    // Definitionen der nicht geänderten Funktionen für Vollständigkeit
    simulationLoop = async () => {
        if (!isRunning) return;
        const { path, collisionLoss } = Path.trainStep(sofa);
        currentPath = path;
        if (collisionLoss < 0.001) { stableCounter++; } else { stableCounter = 0; }
        if (stableCounter > 100) {
            phaseEl.textContent = "Erfolgreich! Vergrößere...";
            sofa.grow(); stableCounter = 0;
            Path.init(CONFIG.LEARNING_RATE);
        } else { phaseEl.textContent = "Lerne Pfad..."; }
        iteration++;
        lossEl.textContent = collisionLoss.toFixed(4);
        iterationEl.textContent = iteration;
        areaEl.textContent = (sofa.width * sofa.height).toFixed(4);
        draw();
        await tf.nextFrame();
        requestAnimationFrame(simulationLoop);
    };
    draw = () => {
        const worldSize=4.0, scale=CONFIG.CANVAS_SIZE/worldSize;
        ctx.fillStyle='#2a2a2a';ctx.fillRect(0,0,canvas.width,canvas.height);
        const cW=Corridor.width*scale, cL=Corridor.armLength*scale;
        ctx.fillStyle='#000000';ctx.fillRect(0,0,cW,cL);ctx.fillRect(0,cL-cW,cL,cW);
        ctx.fillStyle="white";ctx.font="bold 20px sans-serif";ctx.textAlign="center";
        ctx.fillText("A",cW/2,25);ctx.fillText("B",cL-20,cL-cW/2+8);
        if (currentPath && currentPath.length > 0) {
            for (let i = 0; i <= 10; i++) {
                const p = i / 10;
                const pos = Path._interpolatePath(currentPath, p);
                sofa.setPosition(pos.x, pos.y, pos.rotation);
                const loss = Corridor.calculateCollisionLoss(sofa);
                ctx.save();
                ctx.translate(sofa.x*scale,sofa.y*scale);ctx.rotate(sofa.rotation);
                ctx.fillStyle = loss > 0.001 ? "rgba(220, 53, 69, 0.6)" : "rgba(0, 123, 255, 0.5)";
                ctx.fillRect(-sofa.width/2*scale,-sofa.height/2*scale,sofa.width*scale,sofa.height*scale);
                ctx.restore();
            }
        }
    };
    startStopBtn.addEventListener('click', () => { isRunning = !isRunning; startStopBtn.textContent = isRunning ? 'Stop' : 'Start'; if (isRunning) simulationLoop(); });
});
