// sofa.js (Version 2 - Physical Object)
class Sofa {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        
        // Startposition in der Mitte der Öffnung A
        this.x = Corridor.width / 2;
        this.y = 0;
        this.rotation = 0; // in Radiant
    }

    /**
     * Setzt die Position und Rotation des Sofas.
     * @param {number} x - Die x-Position des Mittelpunkts.
     * @param {number} y - Die y-Position des Mittelpunkts.
     * @param {number} rotation - Die Rotation in Radiant.
     */
    setPosition(x, y, rotation) {
        this.x = x;
        this.y = y;
        this.rotation = rotation;
    }

    /**
     * Berechnet die Welt-Koordinaten der vier Ecken des Sofas.
     * @returns {Array<{x: number, y: number}>} - Ein Array mit den vier Eckpunkten.
     */
    getCorners() {
        const halfW = this.width / 2;
        const halfH = this.height / 2;
        const cosR = Math.cos(this.rotation);
        const sinR = Math.sin(this.rotation);

        const corners = [
            { x: -halfW, y: -halfH }, // Oben links
            { x:  halfW, y: -halfH }, // Oben rechts
            { x:  halfW, y:  halfH }, // Unten rechts
            { x: -halfW, y:  halfH }  // Unten links
        ];

        // Rotiere und verschiebe jede Ecke
        return corners.map(p => ({
            x: p.x * cosR - p.y * sinR + this.x,
            y: p.x * sinR + p.y * cosR + this.y
        }));
    }

    /**
     * Vergrößert das Sofa proportional.
     */
    grow() {
        this.width *= 1.05; // Mache es 5% breiter
        this.height *= 1.05; // und 5% höher
    }
}
