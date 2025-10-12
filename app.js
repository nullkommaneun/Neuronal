// app.js
document.addEventListener('DOMContentLoaded', () => {
    // UI-Elemente
    const canvas = document.getElementById('simulation-canvas'), ctx = canvas.getContext('2d');
    const areaEl = document.getElementById('metric-area'), lossEl = document.getElementById('metric-loss');
    const iterationEl = document.getElementById('metric-iteration'), phaseEl = document.getElementById('metric-phase');
    const startStopBtn = document.getElementById('start-stop-btn');
    
    // Globale Variablen
    let logs = [], isRunning = false, iteration = 0, CONFIG;
    let optimizationPhase = 'FEASIBILITY', stableCounter = 0;

    const CONFIG_MODES = {
        fast: { GRID_RESOLUTION: 32, RENDER_RESOLUTION: 64, COLLISION_STEPS: 15, TRAINING_STEPS_PER_FRAME: 5, LEARNING_RATE: 0.015 },
        quality: { GRID_RESOLUTION: 50, RENDER_RESOLUTION: 96, COLLISION_STEPS: 20, TRAINING_STEPS_PER_FRAME: 5, LEARNING_RATE: 0.015 }
    };

    const updateConfig = () => {
        CONFIG = CONFIG_MODES[document.querySelector('input[name="performance"]:checked').value];
        setLambdasForPhase();
        CONFIG.CANVAS_SIZE = Math.min(window.innerWidth * 0.9, window.innerHeight * 0.9, 500);
    };

    const setLambdasForPhase = () => {
        if (optimizationPhase === 'FEASIBILITY') {
            CONFIG.LAMBDA_COLLISION = 10.0; CONFIG.LAMBDA_AREA = 0.1;
            phaseEl.textContent = "1 (Finde Lösung)";
        } else {
            CONFIG.LAMBDA_COLLISION = 5.0; CONFIG.LAMBDA_AREA = 1.0;
            phaseEl.textContent = "2 (Maximiere Fläche)";
        }
    };

    // Diagnose
    const log = (msg) => { logs.push({ t: new Date().toISOString(), msg }); console.log(msg); };
    const setBadge = (id, status, text) => { const el=document.getElementById(id); el.className='badge'; el.classList.add(status); el.textContent=text; };
    const runDiagnostics = () => {
        setBadge('badge-js','success','JS OK');
        if(typeof Corridor!=='object'){setBadge('badge-corridor','error','Korridor FEHLT');return false;} setBadge('badge-corridor','success','Korridor OK');
        if(typeof Sofa!=='object'){setBadge('badge-sofa','error','Sofa FEHLT');return false;} setBadge('badge-sofa','success','Sofa OK');
        if(typeof tf!=='object'){setBadge('badge-tfjs','error','TF.js FEHLT');return false;} setBadge('badge-tfjs','warn','TF.js Geladen');
        if(!!document.createElement('canvas').getContext('webgl2')) setBadge('badge-webgl','success','WebGL2 OK'); else setBadge('badge-webgl','warn','WebGL2 N/A');
        if(typeof WebAssembly==="object") setBadge('badge-wasm','success','WASM OK'); else setBadge('badge-wasm','warn','WASM N/A');
        return true;
    };
    const initBackend = async () => { try { setBadge('badge-backend','warn','Initialisiere...');await tf.setBackend(!!document.createElement('canvas').getContext('webgl2')?'webgl':'wasm');await tf.ready();setBadge('badge-backend','success',`Backend: ${tf.getBackend().toUpperCase()}`);return true;} catch(e) { setBadge('badge-backend','error','Backend FEHLT');return false;}};

    // Haupt-Schleife
    const optimizationLoop = async () => {
        if (!isRunning) return;
        let totalLoss = 0, finalArea = 0, lastCollisionLoss = 0;
        
        for (let i = 0; i < CONFIG.TRAINING_STEPS_PER_FRAME; i++) {
            const result = Sofa.trainStep(CONFIG); // ✅ Direkter, sauberer Aufruf
            totalLoss += result.loss;
            finalArea = result.area;
            lastCollisionLoss = result.collisionLoss;
            iteration++;
        }

        if (optimizationPhase === 'FEASIBILITY') {
            if (lastCollisionLoss < 0.001) {
                stableCounter++;
            } else {
                stableCounter = 0;
            }
            if (stableCounter > 50) {
                optimizationPhase = 'EXPANSION';
                setLambdasForPhase();
                log("Phase changed to EXPANSION.");
            }
        }

        areaEl.textContent=finalArea.toFixed(4); lossEl.textContent=(totalLoss/CONFIG.TRAINING_STEPS_PER_FRAME).toFixed(4); iterationEl.textContent=iteration;
        draw();
        await tf.nextFrame();
        requestAnimationFrame(optimizationLoop);
    };

    // Visualisierung
    const draw = () => {
        const worldSize=4.0, scale=CONFIG.CANVAS_SIZE/worldSize;
        ctx.clearRect(0,0,canvas.width,canvas.height); ctx.fillStyle='#2a2a2a'; ctx.fillRect(0,0,canvas.width,canvas.height);
        const corridorW=1.0*scale, corridorL=3.0*scale;
        ctx.fillStyle='#000000'; ctx.fillRect(0,0,corridorW,corridorL); ctx.fillRect(0,corridorL-corridorW,corridorL,corridorW);
        ctx.fillStyle="white"; ctx.font="bold 20px sans-serif"; ctx.textAlign="center";
        ctx.fillText("A",corridorW/2,25); ctx.fillText("B",corridorL-20,corridorL-(corridorW/2)+8);

        const sofaShapeData = Sofa.getShape(CONFIG.RENDER_RESOLUTION);
        if (!sofaShapeData) return;
        const sofaCanvas=document.createElement('canvas'); sofaCanvas.width=CONFIG.RENDER_RESOLUTION; sofaCanvas.height=CONFIG.RENDER_RESOLUTION;
        const sofaCtx=sofaCanvas.getContext('2d'); const imgData=sofaCtx.createImageData(CONFIG.RENDER_RESOLUTION,CONFIG.RENDER_RESOLUTION);
        for(let i=0;i<sofaShapeData.length;i++){const a=sofaShapeData[i]*255;imgData.data[i*4]=0;imgData.data[i*4+1]=123;imgData.data[i*4+2]=255;imgData.data[i*4+3]=a;}
        sofaCtx.putImageData(imgData,0,0);

        for(let i=0;i<=5;i++){
            const t=i/5; const angle=-Math.PI/2*Math.min(1,t*2);
            const xPos=Math.max(0,t*2-1)*2; const yPos=Math.min(t*2,1)*2;
            ctx.save();
            ctx.translate(xPos*scale,yPos*scale); ctx.rotate(angle);
            ctx.translate(-worldSize/2*scale,-worldSize/2*scale);
            ctx.globalAlpha=0.4; ctx.imageSmoothingEnabled=false;
            ctx.drawImage(sofaCanvas,0,0,worldSize*scale,worldSize*scale);
            ctx.restore();
        }
    };

    // App Start
    const main = async () => {
        updateConfig();
        canvas.width=CONFIG.CANVAS_SIZE; canvas.height=CONFIG.CANVAS_SIZE;
        if (!runDiagnostics()) { alert("Module konnten nicht geladen werden."); return; }
        setTimeout(async () => {
            if (!await initBackend()) { alert("KI-Backend konnte nicht starten."); return; }
            Sofa.init(CONFIG);
            document.querySelector('#diag-content p').style.display='none';
            draw();
            startStopBtn.disabled=false; document.getElementById('export-svg-btn').disabled=false;
            startStopBtn.textContent = "Start";
            log('Application is ready.');
        }, 100);
    };
    
    // UI-Events
    document.getElementById('minimize-diag').addEventListener('click',()=>{document.getElementById('diag-overlay').classList.add('minimized');document.getElementById('show-diag-btn').classList.add('minimized');});
    document.getElementById('show-diag-btn').addEventListener('click',()=>{document.getElementById('diag-overlay').classList.remove('minimized');document.getElementById('show-diag-btn').classList.remove('minimized');});
    startStopBtn.addEventListener('click', () => { isRunning=!isRunning; startStopBtn.textContent=isRunning?'Stop':'Start'; if(isRunning)requestAnimationFrame(optimizationLoop);});
    document.querySelectorAll('input[name="performance"]').forEach(radio=>radio.addEventListener('change', updateConfig));

    main();
});
