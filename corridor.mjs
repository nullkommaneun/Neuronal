// corridor.mjs (Vollständiger Code)

/**
 * Definiert die Physik und Geometrie der Umgebung.
 */
export class Corridor {
    constructor(canvasWidth, canvasHeight) {
        // Definiert die Wände des Korridors als Polygone.
        this.walls = [
            { x: 100, y: 100, width: 600, height: 20 },
            { x: 100, y: 480, width: 600, height: 20 },
            { x: 100, y: 120, width: 20, height: 180 },
            { x: 280, y: 300, width: 20, height: 180 },
            { x: 700, y: 120, width: 20, height: 360 },
            { x: 120, y: 300, width: 160, height: 20 },
        ];
        // Definiert den festen Pfad von A nach B
        this.path = [
            { x: 150, y: 210, angle: 0 },
            { x: 400, y: 210, angle: 0 },
            { x: 400, y: 400, angle: Math.PI / 2},
            { x: 650, y: 400, angle: 0 }
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
                const currentDepth = Math.min(depthX1, depthX2, depthY1, depthY2);
                if (currentDepth > maxDepth) {
                    maxDepth = currentDepth;
                }
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
        ctx.fillText("B", this.path[this.path.length - 1].x + 10, this.path[this.path.length - 1].y + 5);
    }
}
