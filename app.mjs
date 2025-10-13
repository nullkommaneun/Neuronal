// app.mjs (Test für Schritt 1)
import { Corridor } from './corridor.mjs';

const debugOutput = document.getElementById('debug-output');

try {
    const testCorridor = new Corridor(800, 600);
    if (testCorridor && testCorridor.walls.length > 0) {
        debugOutput.innerHTML = "> Test 1 erfolgreich! app.mjs und corridor.mjs wurden geladen.";
        debugOutput.style.color = '#28a745'; // Grün
    } else {
        throw new Error("Corridor-Objekt ist fehlerhaft.");
    }
} catch (error) {
    debugOutput.innerHTML = `> FEHLER in Schritt 1: ${error.message}`;
    debugOutput.style.color = '#ff6b6b'; // Rot
}
