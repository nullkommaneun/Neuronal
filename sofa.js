/**
 * @file sofa.js
 * @description Definiert das physische Sofa-Objekt, seine Eigenschaften und Methoden.
 */

/**
 * Factory-Funktion zur Erstellung eines neuen Sofa-Objekts.
 * HINWEIS: Eine Factory ist nützlich, um die Objekterstellung zu kapseln und
 * Standardwerte oder komplexe Initialisierungslogik zu verwalten.
 * @param {number} width - Die Breite des Sofas in Metern.
 * @param {number} height - Die Höhe des Sofas in Metern.
 * @returns {object} Ein neues Sofa-Objekt.
 */
function createSofa(width, height) {
    return {
        width: width,
        height: height,
        x: 0.5, // Startposition in der Mitte des vertikalen Arms.
        // VERMERK: Die initiale y-Position ist height / 2. Dies platziert den Mittelpunkt
        // des Sofas so, dass seine untere Kante bei y=0 liegt. Dies ist eine kritische
        // Anforderung, um eine Kollision direkt beim Start zu verhindern.
        y: height / 2, 
        rotation: 0, // Startrotation in Bogenmaß (0 = vertikal ausgerichtet).

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
         * Die Berechnung berücksichtigt die aktuelle Position (x, y) und die Rotation.
         * Dies ist die entscheidende Schnittstelle zur Kollisionserkennung.
         * @returns {Array<object>} Ein Array von Objekten mit {x, y} für jede Ecke.
         */
        getCorners: function() {
            const w2 = this.width / 2;
            const h2 = this.height / 2;
            const cos_r = Math.cos(this.rotation);
            const sin_r = Math.sin(this.rotation);

            // Lokale Koordinaten der Ecken um den Mittelpunkt (0,0)
            const corners_local = [
                { x: -w2, y: -h2 }, // Oben links
                { x:  w2, y: -h2 }, // Oben rechts
                { x:  w2, y:  h2 }, // Unten rechts
                { x: -w2, y:  h2 }  // Unten links
            ];

            // Rotiere und verschiebe jede Ecke in die Weltkoordinaten.
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
         * VERMERK: Dies ist der Kern des "Curriculum Learning". Nach einem erfolgreichen
         * Durchgang wird das Problem durch Aufruf dieser Methode leicht erschwert.
         * Das Seitenverhältnis wird beibehalten, um die Form konsistent zu halten.
         */
        grow: function() {
            const growthFactor = 1.02; // Um 2% vergrößern
            this.width *= growthFactor;
            this.height *= growthFactor;
            // Nach dem Wachsen muss die y-Position angepasst werden, um eine Startkollision zu vermeiden.
            this.y = this.height / 2;
        }
    };
}
