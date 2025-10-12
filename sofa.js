// sofa.js
function createSofa(width, height) {
    // Das ist unser Sofa-Objekt.
    const sofa = {
        width: width,
        height: height,
        x: Corridor.width / 2, // Startposition Mitte A
        y: 0,
        rotation: 0, // in Radiant

        // Setzt die Position und Rotation neu
        setPosition: function(x, y, rotation) {
            this.x = x;
            this.y = y;
            this.rotation = rotation;
        },

        // Berechnet die vier Ecken in der Welt
        getCorners: function() {
            const halfW = this.width / 2;
            const halfH = this.height / 2;
            const cosR = Math.cos(this.rotation);
            const sinR = Math.sin(this.rotation);

            const corners = [
                { x: -halfW, y: -halfH }, { x: halfW, y: -halfH },
                { x: halfW, y: halfH }, { x: -halfW, y: halfH }
            ];

            return corners.map(p => ({
                x: p.x * cosR - p.y * sinR + this.x,
                y: p.x * sinR + p.y * cosR + this.y
            }));
        },

        // Vergrößert das Sofa für den nächsten Versuch
        grow: function() {
            this.width *= 1.05;
            this.height *= 1.05;
        }
    };
    return sofa;
}

console.log("✅ sofa.js loaded");
