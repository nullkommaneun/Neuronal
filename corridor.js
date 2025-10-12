/**
 *// corridor.js

/**
 * Definiert die Physik und Geometrie der Umgebung.
 */
export class Corridor {
    constructor(canvasWidth, canvasHeight) {
        // Definiert die Wände des Korridors als Polygone.
        // Ein L-förmiger Korridor.
        this.walls = [
            // Äußere Wände
            { x: 100, y: 100, width: 600, height: 20 }, // Obere Wand
            { x: 100, y: 480, width: 600, height: 20 }, // Untere Wand
            { x: 100, y: 120, width: 20, height: 180 }, // Linke obere Wand
            { x: 280, y: 300, width: 20, height: 180 }, // Linke untere Wand (Ecke)
            { x: 700, y: 120, width: 20, height: 360 }, // Rechte Wand

            // Innere Ecke
            { x: 120, y: 300, width: 160, height: 20 }, // Obere Wand der Ecke
        ];

        // Definiert den festen Pfad von A nach B
        this.path = [
            { x: 150, y: 210, angle: 0 },         // Start A
            { x: 400, y: 210, angle: 0 },         // Vor der Ecke
            { x: 400, y: 400, angle: Math.PI / 2}, // Nach der Ecke
            { x: 650, y: 400, angle: 0 }          // Ende B
        ];
    }

    /**
     * Berechnet die Eindringtiefe eines Punktes in die Wände.
     * @param {number} x - Die x-Koordinate des Punktes.
     * @param {number} y - Die y-Koordinate des Punktes.
     * @returns {number} - Die Eindringtiefe. > 0 bedeutet Kollision, <= 0 ist frei.
     */
    getPenetrationDepth(x, y) {
        let maxDepth = 0;
        for (const wall of this.walls) {
            const dx = Math.max(wall.x - x, 0, x - (wall.x + wall.width));
            const dy = Math.max(wall.y - y, 0, y - (wall.y + wall.height));
            const distance = Math.sqrt(dx*dx + dy*dy);
            
            // Wenn der Punkt innerhalb des Rechtecks ist, ist die Tiefe die kleinste Distanz zur Kante.
            if (x >= wall.x && x <= wall.x + wall.width && y >= wall.y && y <= wall.y + wall.height) {
                const depthX = Math.min(x - wall.x, (wall.x + wall.width) - x);
                const depthY = Math.min(y - wall.y, (wall.y + wall.height) - y);
                maxDepth = Math.max(maxDepth, Math.min(depthX, depthY));
            }
        }
        return maxDepth;
    }

    /**
     * Zeichnet den Korridor und den Pfad.
     * @param {CanvasRenderingContext2D} ctx - Der 2D-Kontext des Canvas.
     */
    draw(ctx) {
        // Wände zeichnen
        ctx.fillStyle = "#34495e";
        this.walls.forEach(wall => {
            ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
        });

        // Pfad zeichnen (gestrichelt)
        ctx.strokeStyle = "#95a5a6";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 10]);
        ctx.beginPath();
        ctx.moveTo(this.path[0].x, this.path[0].y);
        for (let i = 1; i < this.path.length; i++) {
            ctx.lineTo(this.path[i].x, this.path[i].y);
        }
        ctx.stroke();
        ctx.setLineDash([]); // Reset

        // A und B beschriften
        ctx.fillStyle = "#27ae60";
        ctx.font = "bold 20px Arial";
        ctx.fillText("A", this.path[0].x - 25, this.path[0].y + 5);
        ctx.fillStyle = "#c0392b";
        ctx.fillText("B", this.path[this.path.length - 1].x + 10, this.path[this.path.length - 1].y + 5);
    }
}
 @file corridor.js
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
