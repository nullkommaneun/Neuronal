// corridor.js (Version with Penetration Depth)
const Corridor = {
    width: 1.0,
    armLength: 3.0,

    /**
     * Berechnet, wie tief ein Punkt in einer Wand steckt.
     * @param {number} x - Die x-Koordinate des Punktes.
     * @param {number} y - Die y-Koordinate des Punktes.
     * @returns {number} - Die Eindringtiefe. > 0 bedeutet eine ungültige Kollision.
     */
    getPenetrationDepth: function(x, y) {
        let depth = 0;
        // Außerhalb der äußeren Grenzen
        if (x < 0) depth += -x;
        if (y < 0) depth += -y;
        if (x > this.armLength) depth += x - this.armLength;
        if (y > this.armLength) depth += y - this.armLength;
        
        // Innerhalb der "verbotenen" Ecke
        if (x > this.width && y > this.width) {
            const dx = x - this.width;
            const dy = y - this.width;
            depth += Math.sqrt(dx * dx + dy * dy); // Abstand zum inneren Eckpunkt
        }
        return depth;
    },

    /**
     * Berechnet den gesamten Kollisionsverlust für ein Sofa.
     * @param {object} sofa - Das Sofa-Objekt.
     * @returns {number} - Die Summe aller Eindringtiefen.
     */
    calculateCollisionLoss: function(sofa) {
        let totalLoss = 0;
        const corners = sofa.getCorners();
        for (const corner of corners) {
            totalLoss += this.getPenetrationDepth(corner.x, corner.y);
        }
        return totalLoss;
    }
};
