/**
 * @file sofa.js
 * @description Definiert das physische Sofa-Objekt, seine Eigenschaften und Methoden.
 */

function createSofa(width, height) {
    // Ein kleiner Sicherheitsabstand, um einen Crash bei der Initialisierung zu verhindern.
    const SAFETY_MARGIN = 0.01; // 1 cm

    return {
        width: width,
        height: height,
        x: Corridor.width / 2,
        
        // KORREKTUR: Positioniere das Sofa mit einem kleinen Sicherheitsabstand zur Wand.
        // Das verhindert einen sofortigen Absturz, wenn die KI eine anfängliche Rotation anwendet.
        y: Corridor.armLength - (height / 2) - SAFETY_MARGIN,
        
        rotation: 0,

        setPosition: function(x, y, rotation) {
            this.x = x;
            this.y = y;
            this.rotation = rotation;
        },

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

        grow: function() {
            const growthFactor = 1.02;
            this.width *= growthFactor;
            this.height *= growthFactor;
        }
    };
}
