// sofa.js
function createSofa(width, height) {
    return {
        width: width,
        height: height,
        x: Corridor.width / 2,
        y: height / 2, // Starte mit der Kante auf der Linie
        rotation: 0,

        setPosition: function(x, y, rotation) {
            this.x = x;
            this.y = y;
            this.rotation = rotation;
        },

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

        grow: function() {
            this.width *= 1.05;
            this.height *= 1.05;
        }
    };
}
