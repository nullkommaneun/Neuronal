// app.js

document.addEventListener('DOMContentLoaded', () => {
    // --- UI-Elemente ---
    const canvas = document.getElementById('simulation-canvas');
    const ctx = canvas.getContext('2d');
    const areaEl = document.getElementById('metric-area');
    const lossEl = document.getElementById('metric-loss');
    const iterationEl = document.getElementById('metric-iteration');
    const phaseEl = document.getElementById('metric-phase'); // ✅ Phasen-Anzeige
    const startStopBtn = document.getElementById('start-stop-btn');
    // ... restliche UI-Elemente ...

    // --- Globale Variablen ---
    let logs = [];
    let isRunning = false;
    let iteration = 0;
    let CONFIG;

    // ✅ NEU: Eigene Variable für den Trainings-Zustand
    let optimizationPhase = 'FEASIBILITY'; // Startet in Phase 1
    let stableCounter = 0; // Zählt, wie lange die Lösung schon stabil ist

    const CONFIG_MODES = {
        fast: { GRID_RESOLUTION: 32, RENDER_RESOLUTION: 64, COLLISION_STEPS: 15, TRAINING_STEPS_PER_FRAME: 5, LEARNING_RATE: 0.015 },
        quality: { GRID_RESOLUTION: 50, RENDER_RESOLUTION: 96, COLLISION_STEPS: 20, TRAINING_STEPS_PER_FRAME: 5, LEARNING_RATE: 0.015 }
    };

    const updateConfig = () => {
        const selectedMode = document.querySelector('input[name="performance"]:checked').value;
        CONFIG = CONFIG_MODES[selectedMode];
        // ✅ NEU: Setze die Gewichte basierend auf der aktuellen Phase
        setLambdasForPhase();
        CONFIG.CANVAS_SIZE = Math.min(window.innerWidth * 0.9, window.innerHeight * 0.9, 500);
        log(`Performance mode set to: ${selectedMode}, Phase: ${optimizationPhase}`);
    };

    // ✅ NEU: Funktion zum Setzen der Gewichte für das Curriculum
    const setLambdasForPhase = () => {
        if (optimizationPhase === 'FEASIBILITY') {
            // Phase 1: Kollisionen sind extrem "teuer", Fläche ist unwichtig
            CONFIG.LAMBDA_COLLISION = 10.0;
            CONFIG.LAMBDA_AREA = 0.1;
            phaseEl.textContent = "1 (Finde Lösung)";
        } else { // 'EXPANSION'
            // Phase 2: Kollisionen sind immer noch wichtig, aber jetzt wird Fläche stark belohnt
            CONFIG.LAMBDA_COLLISION = 2.5;
            CONFIG.LAMBDA_AREA = 1.0;
            phaseEl.textContent = "2 (Maximiere Fläche)";
        }
    };

    // --- Diagnose & UI-Events (unverändert) ---
    // ...
    const log = (message, level = 'info') => { logs.push({ timestamp: new Date().toISOString(), level, message }); console.log(message); };
    const setBadgeStatus = (id, status, text) => { const badge = document.getElementById(id); badge.className = 'badge'; badge.classList.add(status); badge.textContent = text; };
    const runInitialDiagnostics = () => { setBadgeStatus('badge-js', 'success', 'JS OK'); if(typeof Corridor?.calculateCollision !=='function'){setBadgeStatus('badge-corridor','error','Korridor FEHLT');return false;} setBadgeStatus('badge-corridor','success','Korridor OK'); if(typeof Sofa?.init !=='function'){setBadgeStatus('badge-sofa','error','Sofa FEHLT');return false;} setBadgeStatus('badge-sofa','success','Sofa OK'); if(typeof tf==='undefined'){setBadgeStatus('badge-tfjs','error','TF.js Failed');return false;} setBadgeStatus('badge-tfjs','warn','TF.js Geladen'); if(!!document.createElement('canvas').getContext('webgl2'))setBadgeStatus('badge-webgl','success','WebGL2 OK');else setBadgeStatus('badge-webgl','warn','WebGL2 N/A'); if(typeof WebAssembly==="object")setBadgeStatus('badge-wasm','success','WASM OK');else setBadgeStatus('badge-wasm','warn','WASM N/A'); return true; };
    const initializeTFBackend = async () => { try { setBadgeStatus('badge-backend','warn','Initialisiere...');await tf.setBackend(!!document.createElement('canvas').getContext('webgl2')?'webgl':'wasm');await tf.ready();const backend=tf.getBackend();setBadgeStatus('badge-backend','success',`Backend: ${backend.toUpperCase()}`);return true;}catch(e){setBadgeStatus('badge-backend','error','Backend Failed');return false;} };
    document.getElementById('minimize-diag').addEventListener('click',()=>{document.getElementById('diag-overlay').classList.add('minimized');document.getElementById('show-diag-btn').classList.add('minimized');});
    document.getElementById('show-diag-btn').addEventListener('click',()=>{document.getElementById('diag-overlay').classList.remove('minimized');document.getElementById('show-diag-btn').classList.remove('minimized');});
    startStopBtn.addEventListener('click', () => { isRunning = !isRunning; startStopBtn.textContent = isRunning ? 'Stop' : 'Start'; if(isRunning) requestAnimationFrame(optimizationLoop); });
    document.querySelectorAll('input[name="performance"]').forEach(radio => radio.addEventListener('change', updateConfig));
    // ...

    // --- Haupt-Schleife (Orchestrator) ---
    const optimizationLoop = async () => {
        if (!isRunning) return;
        
        let totalLoss = 0, finalArea = 0, lastCollisionLoss = 0;
        
        for (let i = 0; i < CONFIG.TRAINING_STEPS_PER_FRAME; i++) {
            // Wir müssen den Kollisionsverlust kennen, um die Phase zu wechseln
            const result = Sofa.trainStep(CONFIG);
            totalLoss += result.loss;
            finalArea = result.area;
            // Wir können den Kollisionsverlust nicht direkt aus trainStep bekommen,
            // aber wir können ihn aus der Differenz ableiten
            lastCollisionLoss = (result.loss - (-CONFIG.LAMBDA_AREA * finalArea * (CONFIG.GRID_RESOLUTION**2))) / CONFIG.LAMBDA_COLLISION;
            iteration++;
        }

        // ✅ NEU: Logik für den Phasenwechsel
        if (optimizationPhase === 'FEASIBILITY') {
            // Ist die Kollision quasi null?
            if (lastCollisionLoss < 0.001) {
                stableCounter++;
            } else {
                stableCounter = 0; // Reset, wenn es wieder Kollisionen gibt
            }
            // Wenn 50 Frames (ca. 1 Sekunde) stabil sind, wechsle die Phase
            if (stableCounter > 50) {
                optimizationPhase = 'EXPANSION';
                setLambdasForPhase(); // Wende die neuen Gewichte an
                log("Phase changed to EXPANSION.");
            }
        }

        // UI aktualisieren
        areaEl.textContent = finalArea.toFixed(4);
        lossEl.textContent = (totalLoss / CONFIG.TRAINING_STEPS_PER_FRAME).toFixed(4);
        iterationEl.textContent = iteration;
        
        draw();
        
        await tf.nextFrame();
        requestAnimationFrame(optimizationLoop);
    };

    // --- Visualisierung & App Start (unverändert) ---
    const draw = () => {
        const scale = CONFIG.CANVAS_SIZE/2.5; const center = CONFIG.CANVAS_SIZE/2; const halfW = (Corridor.width*scale)/2;
        ctx.fillStyle='#2a2a2a';ctx.fillRect(0,0,canvas.width,canvas.height); ctx.fillStyle='#000000'; ctx.fillRect(center-halfW,0,halfW*2,center+halfW);ctx.fillRect(center-halfW,center-halfW,canvas.width,halfW*2);
        const sofaShapeData=Sofa.getShape(CONFIG.RENDER_RESOLUTION); if(!sofaShapeData)return;
        const sofaBaseCanvas=document.createElement('canvas');sofaBaseCanvas.width=CONFIG.RENDER_RESOLUTION;sofaBaseCanvas.height=CONFIG.RENDER_RESOLUTION;const sofaBaseCtx=sofaBaseCanvas.getContext('2d');const imageData=sofaBaseCtx.createImageData(CONFIG.RENDER_RESOLUTION,CONFIG.RENDER_RESOLUTION);
        for(let i=0;i<sofaShapeData.length;i++){const a=sofaShapeData[i]*255;imageData.data[i*4]=0;imageData.data[i*4+1]=123;imageData.data[i*4+2]=255;imageData.data[i*4+3]=a;}
        sofaBaseCtx.putImageData(imageData,0,0);
        const visualizationSteps=5;
        for(let i=0;i<=visualizationSteps;i++){
            const t=i/visualizationSteps;const angle=-Math.PI/2*t;const offsetX=t<0.5?0:(t-0.5)*2;const offsetY=t>0.5?0:(0.5-t)*2;
            ctx.save();ctx.translate(center,center);ctx.scale(scale,-scale);ctx.translate(-1.25,-1.25);ctx.translate(offsetX,offsetY);ctx.rotate(angle);
            ctx.globalAlpha=0.3+(t*0.7/visualizationSteps);ctx.imageSmoothingEnabled=false;ctx.drawImage(sofaBaseCanvas,0,0,2.5,2.5);ctx.restore();
        }
    };
    const main = async () => {
        updateConfig();
        canvas.width=CONFIG.CANVAS_SIZE;canvas.height=CONFIG.CANVAS_SIZE;
        if(!runInitialDiagnostics()){alert("Fehler beim Initialisieren der Module.");return;}
        setTimeout(async()=>{
            const backendReady=await initializeTFBackend();
            if(!backendReady){alert("KI-Backend konnte nicht starten.");startStopBtn.textContent="Fehler";return;}
            Sofa.init(CONFIG);
            document.querySelector('#diag-content p').style.display='none';
            draw();
            startStopBtn.disabled=false;document.getElementById('export-svg-btn').disabled=false;startStopBtn.textContent="Start";log('Application is ready.');
        },100);
    };
    main();
});
