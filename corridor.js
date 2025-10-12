/**
 * @file corridor.js
 * @description Finale Physik-Engine, die zwischen "Anecken" (erlaubt)
 * und "Durchdringen" (unmöglich) unterscheidet.
 */

const Corridor = {
    width: 1.0,
    armLength: 3.0,
    
    init: function() {},

    /**
     * FINALE VERSION: Mit "Gipswand"-Physik.
     * @param {object} sofa - Das Sofa-Objekt.
     * @returns {number} - Der finale Kollisionsverlust.
     */
    calculateCollisionLoss: function(sofa) {
        const corners = sofa.getCorners();
        let totalLoss = 0;
        
        // DEFINITION DER "GIPSWAND":
        // Alles unter 0.5cm gilt als "Anecken".
        const TOUCH_THRESHOLD = 0.005; // 0.5 Zentimeter
        // Die Strafe für das Durchbrechen der Wand ist extrem hoch.
        const PENETRATION_FACTOR = 100.0;

        for (const corner of corners) {
            const x = corner.x;
            const y = corner.y;
            let penetration = 0;

            const inVerticalArm = (x >= 0 && x <= this.width && y >= 0 && y <= this.armLength);
            const inHorizontalArm = (x >= 0 && x <= this.armLength && y >= 0 && y <= this.width);

            if (!inVerticalArm && !inHorizontalArm) {
                let closestX = Math.max(0, Math.min(x, this.armLength));
                let closestY = Math.max(0, Math.min(y, this.armLength));

                if (closestX > this.width && closestY > this.width) {
                    if (Math.abs(x - this.width) < Math.abs(y - this.width)) {
                        closestX = this.width;
                    } else {
                        closestY = this.width;
                    }
                }
                penetration = Math.sqrt(Math.pow(x - closestX, 2) + Math.pow(y - closestY, 2));
            }

            // HIER IST DIE FINALE LOGIK:
            if (penetration > 0) {
                if (penetration < TOUCH_THRESHOLD) {
                    // Fall 1: "Anecken" - Die Farbschicht wird zerkratzt.
                    // Eine kleine, lineare Strafe.
                    totalLoss += penetration * 0.1; // Geringe Kosten für leichte Berührung
                } else {
                    // Fall 2: "Durchdringen" - Die Wand bricht.
                    // Eine massive, exponentielle Strafe.
                    const deepPenetration = penetration - TOUCH_THRESHOLD;
                    const exponentialPenalty = Math.exp(deepPenetration * PENETRATION_FACTOR) - 1;
                    totalLoss += exponentialPenalty;
                }
            }
        }
        
        return totalLoss;
    }
};

Corridor.init();
