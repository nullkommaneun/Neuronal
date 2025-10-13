// app.mjs (Finale Reparatur-Version)
import { Corridor } from './corridor.mjs';
import { Sofa } from './sofa.mjs';

// === Globale Variablen & UI-Elemente ===
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const debugOutput = document.getElementById('debug-output');
const phaseDisplay = document.getElementById('training-phase-display');
const collisionLossDisplay = document.getElementById('stats-collision-loss');
const areaRewardDisplay = document.getElementById('stats-area-reward');
let corridor, sofa;

// === UI-Helfer ===
function updateDiagStatus(id, status) {
    const statusEl = document.querySelector(`#${id} .status`);
    if (statusEl) statusEl.className = `status ${status}`;
}
function log(message, isError = false) {
    const color = isError ? '#ff6b6b' : '#f1f1f1';
    // Wir löschen die Konsole nicht mehr, sondern fügen hinzu
    debugOutput.innerHTML += `<div style="color: ${color};">> ${message}</div>`;
    debugOutput.scrollTop = debugOutput.scrollHeight; // Auto-scroll
}

// === SICHERE Game-Loop & Draw-Funktion ===
// Wir definieren die Funktionen hier, füllen sie aber noch nicht mit der KI-Logik.
let frameCount = 0;
function gameLoop() {
    try {
        // Test 1: Läuft die Schleife überhaupt?
        frameCount++;
        if (frameCount < 300) { // Logge nur die ersten 300 Frames, um die Konsole nicht zu fluten
            log(`Game Loop Tick #${frameCount}`);
        } else if (frameCount === 300) {
            log("...logging gestoppt, Schleife läuft aber weiter.");
        }
        
        // Test 2: Funktioniert das Zeichnen des Korridors?
        draw();

        // Nächsten Frame anfordern
        requestAnimationFrame(gameLoop);
    } catch (error) {
        log(`FATALER FEHLER in der Game-Loop: ${error.message}`, true);
    }
}

function draw() {
    // Zeichne NUR den Korridor. Noch kein Sofa.
    // Das testet, ob der Canvas-Kontext `ctx` noch gültig ist.
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (corridor) {
        corridor.draw(ctx);
    }
}

// === Haupt-Initialisierungsfunktion (bereits als funktionierend bewiesen) ===
async function main() {
    try {
        log("Stufe 1: Prüfe JS und Module...");
        updateDiagStatus('diag-js', 'success'); updateDiagStatus('diag-modules', 'success'); log("JS & Module OK.");
        log("Stufe 2: Suche TensorFlow.js...");
        if (typeof tf === 'undefined') throw new Error("Das 'tf'-Objekt wurde nicht gefunden.");
        updateDiagStatus('diag-tf', 'success'); log("TensorFlow.js Bibliothek OK.");
        log("Stufe 3: Initialisiere TF Backend...");
        await tf.setBackend('webgl'); await tf.ready();
        updateDiagStatus('diag-backend', 'success'); log(`TF Backend '${tf.getBackend()}' ist bereit.`);
        log("Stufe 4: Lade Anwendungsmodule...");
        corridor = new Corridor(800, 600); log("Corridor-Modul OK.");
        log("Stufe 5: Lade & initialisiere KI-Modul (Sofa)...");
        sofa = new Sofa();
        sofa.init();
        if (!sofa || !sofa.model) throw new Error("Sofa-Objekt oder dessen neuronales Netz konnte nicht erstellt werden.");
        updateDiagStatus('diag-ai', 'success'); log("KI-Modul (Sofa) OK.");
        log("<br><strong style='color: #28a745;'>Initialisierung komplett. Starte sichere Game-Loop...</strong>");
        
        // ANWENDUNG STARTEN
        gameLoop();

    } catch (error) {
        log(`FATALER FEHLER bei Initialisierung: ${error.message}`, true);
    }
}

main();
