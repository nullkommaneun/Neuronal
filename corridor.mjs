// corridor.mjs (Korrigierte Geometrie)
export class Corridor {
    constructor(canvasWidth, canvasHeight) {
        // Definiert die Wände des Korridors als Polygone.
        this.walls = [
            // Außenwände
            { x: 100, y: 100, width: 600, height: 20 }, // Obere Wand
            { x: 100, y: 500, width: 600, height: 20 }, // Untere Wand
            { x: 100, y: 120, width: 20, height: 200 }, // Linke obere Wand
            { x: 700, y: 120, width: 20, height: 380 }, // Rechte Wand
            
            // Innenwände der Ecke
            { x: 120, y: 300, width: 400, height: 20 },
            { x: 500, y: 320, width: 20, height: 180 },
        ];

        // Definiert den festen Pfad von A nach B
        this.path = [
            { x: 150, y: 200, angle: 0 },         // Start A
            { x: 400, y: 200, angle: 0 },         // Mitte, vor der Ecke
            { x: 600, y: 400, angle: -Math.PI / 2}, // Nach der Ecke
            { x: 300, y: 400, angle: -Math.PI},   // Ende B
        ];
    }

    getPenetrationDepth(x, y) {
        let maxDepth = 0;
        for (const wall of this.walls) {
            if (x >= wall.x && x <= wall.x + wall.width && y >= wall.y && y <= wall.y + wall.height) {
                const depthX1 = x - wall.x;
                const depthX2 = (wall.x + wall.width) - x;
                const depthY1 = y - wall.y;
                const depthY2 = (wall.y + wall.height) - y;
                maxDepth = Math.max(maxDepth, Math.min(depthX1, depthX2, depthY1, depthY2));
            }
        }
        return maxDepth;
    }

    draw(ctx) {
        ctx.fillStyle = "#34495e";
        this.walls.forEach(wall => ctx.fillRect(wall.x, wall.y, wall.width, wall.height));
        ctx.strokeStyle = "#95a5a6";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 10]);
        ctx.beginPath();
        ctx.moveTo(this.path[0].x, this.path[0].y);
        for (let i = 1; i < this.path.length; i++) {
            ctx.lineTo(this.path[i].x, this.path[i].y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#27ae60";
        ctx.font = "bold 20px Arial";
        ctx.fillText("A", this.path[0].x - 25, this.path[0].y + 5);
        ctx.fillStyle = "#c0392b";
        ctx.fillText("B", this.path[this.path.length - 1].x - 25, this.path[this.path.length - 1].y + 5);
    }
}
