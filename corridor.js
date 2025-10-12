/**
 * @file corridor.js
 * @description Definiert die physische Umgebung (L-förmiger Korridor) und die Logik zur Kollisionserkennung.
 */

// VERMERK: Das Corridor-Objekt kapselt die gesamte Umgebungslogik.
// Die Dimensionen sind in Metern definiert und werden später für die Canvas-Visualisierung skaliert.
const Corridor = {
    // Definiert die Breite beider Arme des Korridors.
    width: 1.0, 
    // Definiert die Länge der äußeren Kante jedes Arms.
    armLength: 3.0, 

    // Die "Wände" werden als Liniensegmente definiert: [x1, y1, x2, y2].
    // Dies ermöglicht eine präzise, vektorbasierte Kollisionsberechnung.
    walls: [],

    /**
     * Initialisiert die Wandkoordinaten basierend auf den Korridor-Dimensionen.
     * Diese Methode wird einmal beim Start aufgerufen.
     */
    init: function() {
        const w = this.width;
        const l = this.armLength;
        
        // Die Wände des L-förmigen Korridors:
        // Ein vertikaler Arm von (0,0) bis (w,l) und ein horizontaler von (0,0) bis (l,w).
        this.walls = [
            // Vertikaler Arm
            [0, 0, 0, l],      // Linke Wand
            [w, 0, w, l - w],  // Rechte Innenwand
            // Horizontaler Arm
            [0, 0, l, 0],      // Obere Wand
            [0, w, l - w, w],  // Untere Innenwand
            // Äußere Ecken verbinden
            [l, 0, l, w],      // Rechte Außenwand
            [0, l, w, l]       // Untere Außenwand
        ];
    },

    /**
     * Berechnet den "Kollisionsverlust" für ein gegebenes Sofa-Objekt.
     * HINWEIS: Dies ist keine binäre (Ja/Nein) Kollision. Stattdessen wird die
     * kontinuierliche "Eindringtiefe" berechnet. Das ist entscheidend für das neuronale Netz,
     * da es einen Gradienten benötigt, um lernen zu können. Eine kleine Verbesserung
     * (weniger tief in der Wand) wird so belohnt.
     * @param {object} sofa - Das Sofa-Objekt mit einer getCorners()-Methode.
     * @returns {number} - Die Summe der quadratischen Eindringtiefen aller Ecken.
     */
    calculateCollisionLoss: function(sofa) {
        const corners = sofa.getCorners();
        let totalPenetration = 0;

        for (const corner of corners) {
            // Prüft, ob eine Ecke außerhalb der erlaubten Grenzen liegt.
            // Die Logik hier ist eine vereinfachte, aber effektive Annäherung für einen L-förmigen Korridor.
            const x = corner.x;
            const y = corner.y;
            let penetration = 0;

            // Ist die Ecke im vertikalen Arm?
            const isInVerticalArm = (x > 0 && x < this.width && y > 0);
            // Ist die Ecke im horizontalen Arm?
            const isInHorizontalArm = (y > 0 && y < this.width && x > 0);

            // Wenn die Ecke in keinem der beiden Arme ist, befindet sie sich außerhalb des Korridors.
            if (!isInVerticalArm && !isInHorizontalArm) {
                // Berechne die "Verletzung" der Grenzen.
                // Eindringtiefe in den vertikalen Arm (links/rechts)
                const px_vert = Math.max(0, -x, x - this.width); 
                // Eindringtiefe in den horizontalen Arm (oben/unten)
                const px_horz = Math.max(0, -y, y - this.width);

                // Wenn die Ecke im "verbotenen" Quadranten (unten rechts der Ecke) ist,
                // ist die Eindringtiefe der Abstand zum Eckpunkt des Korridors.
                if (x > this.width && y > this.width) {
                    penetration = Math.sqrt(Math.pow(x - this.width, 2) + Math.pow(y - this.width, 2));
                } else {
                    // Ansonsten ist es die minimale Eindringtiefe in einen der Arme.
                    penetration = Math.min(px_vert, px_horz);
                }
            }
            
            // Wir summieren die *quadratische* Eindringtiefe.
            // Dies bestraft größere Eindringtiefen überproportional stark und sorgt
            // für einen glatteren Gradienten nahe der Nulllinie.
            totalPenetration += penetration * penetration;
        }
        
        return totalPenetration;
    }
};

// Initialisiere die Korridorwände beim Laden des Skripts.
Corridor.init();
