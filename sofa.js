// sofa.js
function createSofa(width, height) {
    const sofa = {
        width: width,
        height: height,
        x: Corridor.width / 2,
        // ✅ KORREKTUR: Starte mit der Kante auf der Linie, nicht mit dem Zentrum.
        y: height / 2, 
        rotation: 0,

        // ... (Rest der Datei bleibt unverändert) ...
        setPosition: function(x, y, rotation) {
            this.x = x;
            this.y = y;
            this.rotation = rotation;
        },
        getCorners: function() { /* ... */ },
        grow: function() { /* ... */ }
    };
    return sofa;
}
