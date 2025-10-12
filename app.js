// app.js
import { Corridor } from './corridor.js';

// Globaler Status und Objekte
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let corridor;

/**
 * Aktualisiert den Status eines Diagnose-Badges.
 * @param {string} id - Die ID des Badge-Elements.
 * @param {boolean} success - Ob der Ladeschritt erfolgreich war.
 */
function updateDiagStatus(id, success) {
    const statusEl = document.querySelector(`#${id} .status`);
    if (statusEl) {
        statusEl.className = `status ${success ? 'success' : 'error'}`;
    }
}

/**
 * Zeichnet die Szene auf dem Canvas.
 */
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (corridor) {
        corridor.draw(ctx);
    }
    // Später: Sofa hier zeichnen
}

/**
 * Die Hauptfunktion, die die Anwendung initialisiert.
 */
async function main() {
    try {
        // Schritt 1: JS und Module laden
        await new Promise(resolve => setTimeout(resolve, 100)); // Simuliert Ladezeit
        updateDiagStatus('diag-js', true);
        updateDiagStatus('diag-modules', true);

        // Schritt 2: TensorFlow.js initialisieren
        await new Promise(resolve => setTimeout(resolve, 100));
        if (typeof tf !== 'undefined') {
            updateDiagStatus('diag-tf', true);
            await tf.setBackend('webgl');
            await tf.ready();
            updateDiagStatus('diag-backend', true);
        } else {
            throw new Error("TensorFlow.js nicht gefunden.");
        }
        
        // Schritt 3: Umgebung (Korridor) initialisieren
        corridor = new Corridor(canvas.width, canvas.height);

        // Schritt 4: KI-Modell initialisieren (Platzhalter)
        // ... kommt in Befehl 2
        updateDiagStatus('diag-ai', false); // Noch nicht geladen

        // Starte die Hauptschleife
        requestAnimationFrame(draw);

    } catch (error) {
        console.error("Initialisierung fehlgeschlagen:", error);
        // Fehler im UI anzeigen
    }
}

// Starte die Anwendung
main();
