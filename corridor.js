/**
 * @file corridor.js
 * @description Definiert die physische Umgebung und eine strengere Kollisionslogik.
 */

const Corridor = {
    width: 1.0,
    armLength: 3.0,
    
    // ... init() bleibt unverändert ...
    init: function() {},

    /**
     * KORRIGIERTE VERSION: Mit strengerer Bestrafung.
     * Jede noch so kleine Berührung wird jetzt explizit bestraft.
     * @param {object} sofa - Das Sofa-Objekt mit einer getCorners()-Methode.
     * @returns {number} - Die Summe der Kollisionsverluste.
     */
    calculateCollisionLoss: function(sofa) {
        const corners = sofa.getCorners();
        let totalLoss = 0;
        
        // NEU: Eine Konstante, die als Strafe für JEDE Berührung dient.
        // Das zwingt die KI, einen echten Sicherheitsabstand zu halten.
        const TOUCH_PENALTY = 0.01; 

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

            // HIER IST DIE ÄNDERUNG:
            if (penetration > 0) {
                // Wenn es eine Kollision gibt, addiere die quadratische Eindringtiefe
                // PLUS die fixe Strafe für die bloße Berührung.
                totalLoss += (penetration * penetration) + TOUCH_PENALTY;
            }
        }
        
        return totalLoss;
    }
};

Corridor.init();
