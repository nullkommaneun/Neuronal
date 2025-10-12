/**
 * @file corridor.js
 * @description Definiert die physische Umgebung (L-förmiger Korridor) und die Logik zur Kollisionserkennung.
 */

const Corridor = {
    width: 1.0,
    armLength: 3.0,
    walls: [], // Behalten für potenzielle zukünftige, detailliertere Physik

    init: function() {
        // Die explizite Wanddefinition wird für die neue Logik nicht direkt verwendet,
        // bleibt aber für die Visualisierung oder andere Berechnungen erhalten.
        const w = this.width;
        const l = this.armLength;
        this.walls = [
            [0, 0, 0, l], [w, 0, w, l - w], [0, 0, l, 0],
            [0, w, l - w, w], [l, 0, l, w], [0, l, w, l]
        ];
    },

    /**
     * KORRIGIERTE VERSION: Berechnet den "Kollisionsverlust" für ein gegebenes Sofa-Objekt.
     * HINWEIS: Diese neue Logik ist wesentlich robuster. Sie prüft nicht nur die inneren
     * Grenzen, sondern auch, ob die Ecken die äußeren Enden des Korridors überschreiten.
     * Dies verhindert, dass das Sofa "entkommt" und sorgt für einen stabilen Trainingsprozess.
     * @param {object} sofa - Das Sofa-Objekt mit einer getCorners()-Methode.
     * @returns {number} - Die Summe der quadratischen Eindringtiefen aller Ecken.
     */
    calculateCollisionLoss: function(sofa) {
        const corners = sofa.getCorners();
        let totalPenetration = 0;

        for (const corner of corners) {
            const x = corner.x;
            const y = corner.y;
            let penetration = 0;

            // Prüfe, ob die Ecke innerhalb des vertikalen Arms liegt
            const inVerticalArm = (x >= 0 && x <= this.width && y >= 0 && y <= this.armLength);
            // Prüfe, ob die Ecke innerhalb des horizontalen Arms liegt
            const inHorizontalArm = (x >= 0 && x <= this.armLength && y >= 0 && y <= this.width);

            // Wenn die Ecke in keinem der beiden erlaubten Bereiche ist, berechne die Eindringtiefe.
            if (!inVerticalArm && !inHorizontalArm) {
                // KORREKTUR: Berechne die Distanz zum nächstgelegenen erlaubten Punkt im Korridor.
                // Dies ist eine präzisere Methode zur Bestimmung der "Verletzung".
                let closestX = Math.max(0, Math.min(x, this.armLength));
                let closestY = Math.max(0, Math.min(y, this.armLength));

                if (closestX > this.width && closestY > this.width) {
                    // Wenn der nächstgelegene Punkt im "verbotenen" Quadrant liegt,
                    // nimm den Punkt auf der L-Grenze.
                    if (Math.abs(x - this.width) < Math.abs(y - this.width)) {
                        closestX = this.width;
                    } else {
                        closestY = this.width;
                    }
                }
                
                // Die Eindringtiefe ist der euklidische Abstand zum nächstgelegenen Punkt.
                penetration = Math.sqrt(Math.pow(x - closestX, 2) + Math.pow(y - closestY, 2));
            }

            totalPenetration += penetration * penetration;
        }
        
        return totalPenetration;
    }
};

Corridor.init();
