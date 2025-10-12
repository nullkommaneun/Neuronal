// app.js

document.addEventListener('DOMContentLoaded', () => {
    // --- UI-Elemente und globale Variablen ---
    const canvas = document.getElementById('simulation-canvas');
    const ctx = canvas.getContext('2d');
    const startStopBtn = document.getElementById('start-stop-btn');
    const exportSvgBtn = document.getElementById('export-svg-btn');
    // ... weitere UI-Elemente ...
    const areaEl = document.getElementById('metric-area');
    const lossEl = document.getElementById('metric-loss');
    const iterationEl = document.getElementById('metric-iteration');
    const diagOverlay = document.getElementById('diag-overlay');
    const minimizeDiagBtn = document.getElementById('minimize-diag');
    const showDiagBtn = document.getElementById('show-diag-btn');
    const exportLogBtn = document.getElementById('export-log-btn');
    
    let logs = [];
    let isRunning = false;
    let iteration = 0;
    let CONFIG;

    const CONFIG_MODES = { /* ... unverändert ... */ 
        fast: { GRID_RESOLUTION: 32, RENDER_RESOLUTION: 64, COLLISION_STEPS: 15, TRAINING_STEPS_PER_FRAME: 5, LEARNING_RATE: 0.015, LAMBDA_COLLISION: 2.5 },
        quality: { GRID_RESOLUTION: 50, RENDER_RESOLUTION: 96, COLLISION_STEPS: 20, TRAINING_STEPS_PER_FRAME: 5, LEARNING_RATE: 0.015, LAMBDA_COLLISION: 2.5 }
    };
    
    const updateConfig = () => {
        const selectedMode = document.querySelector('input[name="performance"]:checked').value;
        CONFIG = CONFIG_MODES[selectedMode];
        log(`Performance mode set to: ${selectedMode}`);
        CONFIG.CANVAS_SIZE = Math.min(window.innerWidth * 0.9, window.innerHeight * 0.9, 500);
    };

    // --- Diagnose ---
    const log = (message, level = 'info') => { logs.push({ timestamp: new Date().toISOString(), level, message }); console.log(message); };
    const setBadgeStatus = (id, status, text) => { const badge = document.getElementById(id); badge.className = 'badge'; badge.classList.add(status); badge.textContent = text; };

    const runInitialDiagnostics = () => {
        setBadgeStatus('badge-js', 'success', 'JS OK');
        // Check für Corridor-Modul
        if (typeof Corridor?.calculateCollision !== 'function') { setBadgeStatus('badge-corridor', 'error', 'Korridor FEHLT'); return false; }
        setBadgeStatus('badge-corridor', 'success', 'Korridor OK');
        
        // ✅ NEUER CHECK für Sofa-Modul
        if (typeof Sofa?.init !== 'function' || typeof Sofa?.trainStep !== 'function') {
            setBadgeStatus('badge-sofa', 'error', 'Sofa FEHLT');
            return false;
        }
        setBadgeStatus('badge-sofa', 'success', 'Sofa OK');
        
        // Restliche Checks...
        if(typeof tf==='undefined'){setBadgeStatus('badge-tfjs','error','TF.js Failed');return false;}
        setBadgeStatus('badge-tfjs','warn','TF.js Geladen');
        if(!!document.createElement('canvas').getContext('webgl2')) setBadgeStatus('badge-webgl','success','WebGL2 OK'); else setBadgeStatus('badge-webgl','warn','WebGL2 N/A');
        if(typeof WebAssembly==="object") setBadgeStatus('badge-wasm','success','WASM OK'); else setBadgeStatus('badge-wasm','warn','WASM N/A');
        return true;
    };
    
    const initializeTFBackend = async () => { /* ... unverändert ... */ 
        try { setBadgeStatus('badge-backend','warn','Initialisiere...'); await tf.setBackend(!!document.createElement('canvas').getContext('webgl2')?'webgl':'wasm'); await tf.ready(); const backend=tf.getBackend(); setBadgeStatus('badge-backend','success',`Backend: ${backend.toUpperCase()}`); return true;} catch(e) { setBadgeStatus('badge-backend','error','Backend Failed'); return false;}
    };

    // --- UI-Events ---
    minimizeDiagBtn.addEventListener('click', () => { diagOverlay.classList.add('minimized'); showDiagBtn.classList.add('minimized'); });
    showDiagBtn.addEventListener('click', () => { diagOverlay.classList.remove('minimized'); showDiagBtn.classList.remove('minimized'); });
    exportLogBtn.addEventListener('click', () => { const data=btoa(JSON.stringify({userAgent:navigator.userAgent,backend:tf.getBackend(),logs:logs})); navigator.clipboard.writeText(`MSP-LOG:v1:${data}`).then(()=>alert('Log kopiert!')); });
    startStopBtn.addEventListener('click', () => { isRunning = !isRunning; startStopBtn.textContent = isRunning ? 'Stop' : 'Start'; if(isRunning) requestAnimationFrame(optimizationLoop); });
    exportSvgBtn.addEventListener('click', () => alert("SVG-Export ist nicht implementiert."));
    document.querySelectorAll('input[name="performance"]').forEach(radio => radio.addEventListener('change', updateConfig));

    // --- Haupt-Schleife (Orchestrator) ---
    const optimizationLoop = async () => {
        if (!isRunning) return;
        
        let totalLoss = 0, finalArea = 0;
        // Ruft das Training im Sofa-Modul auf
        for (let i = 0; i < CONFIG.TRAINING_STEPS_PER_FRAME; i++) {
            const { loss, area } = Sofa.trainStep(CONFIG); // ✅ SAUBERER AUFRUF
            totalLoss += loss;
            finalArea = area;
            iteration++;
        }

        // Aktualisiert die UI
        areaEl.textContent = finalArea.toFixed(4);
        lossEl.textContent = (totalLoss / CONFIG.TRAINING_STEPS_PER_FRAME).toFixed(4);
        iterationEl.textContent = iteration;
        
        draw(); // Zeichnet das Ergebnis
        
        await tf.nextFrame();
        requestAnimationFrame(optimizationLoop);
    };

    // --- Visualisierung ---
    const draw = () => {
        // Zeichne den Korridor (unverändert)
        const scale = CONFIG.CANVAS_SIZE / 2.5;
        const center = CONFIG.CANVAS_SIZE / 2;
        const halfW = (Corridor.width * scale) / 2;
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#000000';
        ctx.fillRect(center - halfW, 0, halfW * 2, center + halfW);
        ctx.fillRect(center - halfW, center - halfW, canvas.width, halfW * 2);

        // ✅ SAUBERER AUFRUF: Hol die Sofa-Form vom Sofa-Modul
        const shapeValues = Sofa.getShape(CONFIG.RENDER_RESOLUTION);
        if (!shapeValues) return; // Wenn das Modell noch nicht initialisiert ist

        // Zeichne das Sofa (unverändert)
        const imageData = ctx.createImageData(CONFIG.RENDER_RESOLUTION, CONFIG.RENDER_RESOLUTION);
        for (let i = 0; i < shapeValues.length; i++) {
            const a = shapeValues[i] * 255;
            imageData.data[i*4]=0; imageData.data[i*4+1]=123; imageData.data[i*4+2]=255; imageData.data[i*4+3]=a;
        }
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = CONFIG.RENDER_RESOLUTION; tempCanvas.height = CONFIG.RENDER_RESOLUTION;
        tempCanvas.getContext('2d').putImageData(imageData, 0, 0);
        ctx.save();
        ctx.translate(center, center); ctx.scale(scale, -scale); ctx.translate(-1.25, -1.25);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tempCanvas, 0, 0, 2.5, 2.5);
        ctx.restore();
    };

    // --- App Start ---
    const main = async () => {
        updateConfig();
        canvas.width = CONFIG.CANVAS_SIZE; canvas.height = CONFIG.CANVAS_SIZE;
        if (!runInitialDiagnostics()) { alert("Fehler beim Initialisieren der Module."); return; }
        
        setTimeout(async () => {
            const backendReady = await initializeTFBackend();
            if (!backendReady) { alert("KI-Backend konnte nicht starten."); startStopBtn.textContent="Fehler"; return; }
            
            // ✅ Initialisiere das Sofa-Modell
            Sofa.init(CONFIG.LEARNING_RATE);

            document.querySelector('#diag-content p').style.display = 'none';
            draw();
            startStopBtn.disabled = false; exportSvgBtn.disabled = false;
            startStopBtn.textContent = "Start";
            log('Application is ready.');
        }, 100);
    };

    main();
});
