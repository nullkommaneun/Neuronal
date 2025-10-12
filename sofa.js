/**
 * @file sofa.js
 * @description Definiert das physische Sofa-Objekt, seine Eigenschaften und Methoden.
 */

/**
 * Factory-Funktion zur Erstellung eines neuen Sofa-Objekts.
 * @param {number} width - Die Breite des Sofas in Metern.
 * @param {number} height - Die Höhe des Sofas in Metern.
 * @returns {object} Ein neues Sofa-Objekt.
 */
function createSofa(width, height) {
    return {
        width: width,
        height: height,
        // Die X-Position ist immer in der Mitte des vertikalen Arms.
        x: Corridor.width / 2, 
        
        // KORREKTUR: Die initiale y-Position wird jetzt an das untere Ende
        // des Korridors gesetzt, um eine Startkollision zu vermeiden.
        // `Corridor.armLength - height / 2` platziert den Mittelpunkt des Sofas
        // so, dass seine obere Kante die untere Korridorgrenze berührt.
        y: Corridor.armLength - height / 2, 
        
        rotation: 0, // Startrotation (vertikal).

        /**
         * Setzt die Position und Rotation des Sofas.
         * @param {number} x - Neue x-Position.
         * @param {number} y - Neue y-Position.
         * @param {number} rotation - Neue Rotation in Bogenmaß.
         */
        setPosition: function(x, y, rotation) {
            this.x = x;
            this.y = y;
            this.rotation = rotation;
        },

        /**
         * Berechnet und gibt die globalen Koordinaten der vier Ecken des Sofas zurück.
         * @returns {Array<object>} Ein Array von Objekten mit {x, y} für jede Ecke.
         */
        getCorners: function() {
            const w2 = this.width / 2;
            const h2 = this.height / 2;
            const cos_r = Math.cos(this.rotation);
            const sin_r = Math.sin(this.rotation);

            const corners_local = [
                { x: -w2, y: -h2 }, { x:  w2, y: -h2 },
                { x:  w2, y:  h2 }, { x: -w2, y:  h2 }
            ];

            return corners_local.map(corner => {
                const rotatedX = corner.x * cos_r - corner.y * sin_r;
                const rotatedY = corner.x * sin_r + corner.y * cos_r;
                return {
                    x: this.x + rotatedX,
                    y: this.y + rotatedY
                };
            });
        },

        /**
         * Vergrößert das Sofa um einen kleinen Prozentsatz.
         */
        grow: function() {
            const growthFactor = 1.02;
            this.width *= growthFactor;
            this.height *= growthFactor;
            // Nach dem Wachsen muss die Startposition nicht mehr angepasst werden,
            // da der KI-Pfad das Sofa neu positioniert.
        }
    };
}
