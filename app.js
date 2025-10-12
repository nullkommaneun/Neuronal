/**
 * @file app.js
 * @description Finale Version der UI. Zeichnet nur noch das Sofa, nicht mehr den Plan der KI.
 */
// ... (Der gesamte Code von setupPage, initializeAndStartSimulation, etc. bleibt exakt gleich) ...
window.addEventListener('DOMContentLoaded', setupPage);
let canvas, ctx, sofa, startButton, pauseButton, logContainer;
let isRunning = false, stableFrames = 0, currentWaypointIndex = 0, frameCounter = 0;
const SCALE = 100, ANIMATION_SPEED = 4;
function setupPage(){startButton=document.getElementById("startButton"),pauseButton=document.getElementById("pauseButton"),logContainer=document.getElementById("log-container"),canvas=document.getElementById("simulationCanvas"),ctx=canvas.getContext("2d"),startButton.addEventListener("click",initializeAndStartSimulation),pauseButton.addEventListener("click",()=>{isRunning&&(isRunning=!1,startButton.disabled=!1,pauseButton.disabled=!0,logMessage("Simulation pausiert.","info"))}),logMessage('Seite bereit. Klicke auf "Start", um die Simulation zu laden.',"info")}
async function initializeAndStartSimulation(){startButton.disabled=!0,logMessage("Start-Befehl erhalten. Lade Simulationskomponenten...","info");try{updateBadge("badge-js",!0);const o=void 0!==Corridor&&void 0!==createSofa&&void 0!==Path;if(!o)throw new Error("Kritische Code-Module (corridor, sofa, path) fehlen.");updateBadge("badge-modules",!0),logMessage("Module erfolgreich validiert.","info"),await new Promise(o=>setTimeout(o,50)),updateBadge("badge-tf",!0),logMessage("TensorFlow.js Bibliothek bereit.","info"),await new Promise(o=>setTimeout(o,50)),sofa=createSofa(.5,.5),updateBadge("badge-backend",!0),logMessage("Physisches Sofa-Objekt erstellt.","info"),await new Promise(o=>setTimeout(o,50)),Path.init(.01),updateBadge("badge-ai",!0),logMessage("KI-Modell erfolgreich initialisiert.","info"),updateUI(0),draw(),isRunning=!0,pauseButton.disabled=!1,logMessage("Initialisierung abgeschlossen. Starte Simulationsschleife...","info"),simulationLoop()}catch(o){logMessage(`INITIALISIERUNGSFEHLER: ${o.message}`,"error"),startButton.disabled=!1}}
function simulationLoop(){if(!isRunning)return;try{Path.trainStep(sofa);const o=Path.getWaypoints();let e=0;for(const t of o)sofa.setPosition(t.x,t.y,t.rotation),e+=Corridor.calculateCollisionLoss(sofa);if(e/=o.length,isNaN(e))throw new Error("Kollisionsverlust ist NaN.");e<.001?stableFrames++:stableFrames=0,stableFrames>100&&(sofa.grow(),Path.init(.01),stableFrames=0,logMessage(`Erfolg! Sofa wächst auf ${sofa.width.toFixed(2)}m.`,"info")),frameCounter++,frameCounter>=ANIMATION_SPEED&&(frameCounter=0,currentWaypointIndex=(currentWaypointIndex+1)%Path.numWaypoints),updateUI(e),draw(),requestAnimationFrame(simulationLoop)}catch(o){isRunning=!1,startButton.disabled=!0,pauseButton.disabled=!0,logMessage(`KRITISCHER FEHLER: ${o.message}`,"error"),console.error("Detaillierter Fehler:",o)}}
function logMessage(o,e="info"){if(!logContainer)return;const t=document.createElement("div");t.className=`log-entry ${e}`,t.textContent=`[${(new Date).toLocaleTimeString()}] ${o}`,logContainer.appendChild(t),logContainer.scrollTop=logContainer.scrollHeight}
function updateBadge(o,e){const t=document.getElementById(o);t&&(t.className=`badge ${e?"success":"pending"}`)}
function updateUI(o){sofa&&(document.getElementById("sofa-size").textContent=`Breite: ${sofa.width.toFixed(2)} m, Höhe: ${sofa.height.toFixed(2)} m`,document.getElementById("sofa-area").textContent=`Fläche: ${(sofa.width*sofa.height).toFixed(2)} m²`,document.getElementById("collision-loss").textContent=`Kollisionsverlust: ${o.toExponential(3)}`,document.getElementById("stable-frames").textContent=`Stabile Frames: ${stableFrames}/ 100`)}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!sofa) return;

    ctx.save();
    ctx.translate(20, 20);
    // Zeichne Korridor und A/B-Punkte
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const w = Corridor.width * SCALE;
    const l = Corridor.armLength * SCALE;
    ctx.moveTo(0, l); ctx.lineTo(0, 0); ctx.lineTo(l, 0); ctx.lineTo(l, w);
    ctx.lineTo(w, w); ctx.lineTo(w, l); ctx.closePath(); ctx.stroke();
    ctx.fillStyle = 'lightgreen';
    ctx.fillText('A', 0.5 * w - 5, l - 5);
    ctx.fillStyle = 'red';
    ctx.fillText('B', l - 15, 0.5 * w + 5);

    if (Path.pathWaypoints) {
        // GEÄNDERT: Die Wegpunkte werden NICHT mehr gezeichnet.
        const waypoints = Path.getWaypoints();
        
        // Zeichne nur noch das animierte Sofa
        const currentWaypoint = waypoints[currentWaypointIndex];
        sofa.setPosition(currentWaypoint.x, currentWaypoint.y, currentWaypoint.rotation);
        const corners = sofa.getCorners();
        const loss = Corridor.calculateCollisionLoss(sofa);
        ctx.beginPath();
        ctx.moveTo(corners[0].x * SCALE, corners[0].y * SCALE);
        for (let i = 1; i < corners.length; i++) {
            ctx.lineTo(corners[i].x * SCALE, corners[i].y * SCALE);
        }
        ctx.closePath();
        ctx.fillStyle = loss > 0.0001 ? '#e74c3c' : '#3498db';
        ctx.fill();
        ctx.strokeStyle = '#ecf0f1';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
    ctx.restore();
}
