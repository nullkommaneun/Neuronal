// app.mjs (Test für Schritt 2)
import { Corridor } from './corridor.mjs';

// === UI-Helfer ===
const debugOutput = document.getElementById('debug-output');

/**
 * Aktualisiert den Status eines Diagnose-Badges.
 * @param {string} id Die ID des Badge-Elements (z.B. 'diag-js').
 * @param {'success' | 'error'} status Der neue Status.
 */
function updateDiagStatus(id, status) {
    const statusEl = document.querySelector(`#${id} .status`);
    if (statusEl) {
        statusEl.className = `status ${status}`;
    }
}

/**
 * Schreibt eine Log-Nachricht in die On-Screen-Konsole.
 * @param {string} message Die Nachricht.
 * @param {boolean} isError Ob es eine Fehlermeldung ist.
 */
function log(message, isError = false) {
    const color = isError ? '#ff6b6b' : '#f1f1f1'; // Rot für Fehler, sonst weiß
    debugOutput.innerHTML += `<div style="color: ${color};">> ${message}</div>`;
}

// === Haupt-Initialisierungsfunktion ===
async function main() {
    try {
        // --- Stufe 1: Grundlegende Skripte ---
        log("Stufe 1: Prüfe JS und Module...");
        updateDiagStatus('diag-js', 'success');
        updateDiagStatus('diag-modules', 'success');
        log("JS & Module OK.");

        // --- Stufe 2: TensorFlow.js Bibliothek ---
        log("Stufe 2: Suche TensorFlow.js...");
        if (typeof tf === 'undefined') {
            throw new Error("Das 'tf'-Objekt wurde nicht gefunden. Das Skript in index.html fehlt oder wurde blockiert.");
        }
        updateDiagStatus('diag-tf', 'success');
        log("TensorFlow.js Bibliothek OK.");

        // --- Stufe 3: TensorFlow.js Backend ---
        log("Stufe 3: Initialisiere TF Backend...");
        await tf.setBackend('webgl');
        await tf.ready();
        updateDiagStatus('diag-backend', 'success');
        log(`TF Backend '${tf.getBackend()}' ist bereit.`);

        // --- Stufe 4: Anwendungsmodule ---
        log("Stufe 4: Lade Anwendungsmodule...");
        const corridor = new Corridor(800, 600);
        if (!corridor) throw new Error("Corridor-Objekt konnte nicht erstellt werden.");
        log("Corridor-Modul OK.");
        
        log("<br><strong style='color: #28a745;'>Alle Tests bis hierhin erfolgreich!</strong>");
        log("Nächster Schritt: Das Sofa-Modul.");

    } catch (error) {
        log(`FATALER FEHLER: ${error.message}`, true);
        // Färbe das verantwortliche Badge rot
        if (error.message.includes("'tf'-Objekt")) updateDiagStatus('diag-tf', 'error');
        else if (error.message.includes("Backend")) updateDiagStatus('diag-backend', 'error');
    }
}

// Starte den Ladevorgang
main();
