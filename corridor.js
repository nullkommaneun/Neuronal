// corridor.js (Version 2 - Physical Collision)
const Corridor = {
    width: 1.0,
    armLength: 3.0,

    /**
     * Prüft, ob ein einzelner Punkt innerhalb der Korridorgrenzen liegt.
     * @param {number} x - Die x-Koordinate des Punktes.
     * @param {number} y - Die y-Koordinate des Punktes.
     * @returns {boolean} - True, wenn der Punkt im Korridor ist, sonst false.
     */
    isInside: function(x, y) {
        // Außerhalb der Gesamtgrenzen?
        if (x < 0 || y < 0 || x > this.armLength || y > this.armLength) {
            return false;
        }
        // Innerhalb der "verbotenen" Wand-Ecke?
        if (x > this.width && y > this.width) {
            return false;
        }
        return true;
    },

    /**
     * Prüft, ob ein Sofa-Objekt mit den Wänden kollidiert.
     * @param {object} sofa - Das Sofa-Objekt mit seinen Eckpunkten.
     * @returns {boolean} - True, wenn eine Kollision vorliegt, sonst false.
     */
    checkCollision: function(sofa) {
        const corners = sofa.getCorners();
        for (const corner of corners) {
            if (!this.isInside(corner.x, corner.y)) {
                return true; // Mindestens eine Ecke ist außerhalb -> Kollision!
            }
        }
        return false;
    }
};
