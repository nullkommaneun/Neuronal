// corridor.mjs (Finaler Code)
export class Corridor {
    constructor(canvasWidth, canvasHeight) {
        const scale = 150;
        const wallThickness = 20;
        const offsetX = 100;
        const offsetY = 100;

        this.walls = [
            { x: offsetX, y: offsetY, width: 3 * scale, height: wallThickness },
            { x: offsetX, y: offsetY + wallThickness, width: wallThickness, height: 3 * scale },
            { x: offsetX + 3 * scale, y: offsetY + wallThickness, width: wallThickness, height: 3 * scale },
            { x: offsetX + wallThickness, y: offsetY + 3 * scale, width: 3 * scale - wallThickness, height: wallThickness },
            { x: offsetX + wallThickness, y: offsetY + 1 * scale, width: 2 * scale, height: wallThickness },
            { x: offsetX + 2 * scale, y: offsetY + 1 * scale, width: wallThickness, height: 2 * scale },
        ];

        this.path = [
            { x: offsetX + 0.5 * scale, y: offsetY + 0.5 * scale, angle: 0 },
            { x: offsetX + 2.5 * scale, y: offsetY + 0.5 * scale, angle: 0 },
            { x: offsetX + 2.5 * scale, y: offsetY + 1.5 * scale, angle: Math.PI / 2 },
            { x: offsetX + 2.5 * scale, y: offsetY + 2.5 * scale, angle: Math.PI / 2 },
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
        for (let i = 1; i < this.path.length; i++) { ctx.lineTo(this.path[i].x, this.path[i].y); }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#27ae60";
        ctx.font = "bold 20px Arial";
        ctx.fillText("A", this.path[0].x - 30, this.path[0].y + 5);
        ctx.fillStyle = "#c0392b";
        ctx.fillText("B", this.path[this.path.length - 1].x + 10, this.path[this.path.length - 1].y + 5);
    }
}
