// corridor.mjs (Aktualisierter Code mit hochoptimierter Tensor-Kollision)
export class Corridor {
    constructor(canvasWidth, canvasHeight) {
        const scale = 150;
        const wallThickness = 20;
        const offsetX = 100;
        const offsetY = 100;

        // Definition der Wände (CPU-basiert, für Zeichnung und Statistik)
        this.walls = [
            { x: offsetX, y: offsetY, width: 3 * scale, height: wallThickness },
            { x: offsetX, y: offsetY + wallThickness, width: wallThickness, height: 3 * scale },
            { x: offsetX + 3 * scale, y: offsetY + wallThickness, width: wallThickness, height: 3 * scale },
            { x: offsetX + wallThickness, y: offsetY + 3 * scale, width: 3 * scale - wallThickness, height: wallThickness },
            { x: offsetX + wallThickness, y: offsetY + 1 * scale, width: 2 * scale, height: wallThickness },
            { x: offsetX + 2 * scale, y: offsetY + 1 * scale, width: wallThickness, height: 2 * scale },
        ];

        // Pfaddefinition
        this.path = [
            { x: offsetX + 0.5 * scale, y: offsetY + 0.5 * scale, angle: 0 },
            { x: offsetX + 2.5 * scale, y: offsetY + 0.5 * scale, angle: 0 },
            // Die Kurve (Rotation um 90 Grad)
            { x: offsetX + 2.5 * scale, y: offsetY + 1.5 * scale, angle: Math.PI / 2 },
            { x: offsetX + 2.5 * scale, y: offsetY + 2.5 * scale, angle: Math.PI / 2 },
        ];

        // NEU: Initialisiere Tensoren für die GPU-Berechnung
        this.initTensors();
    }

    // NEU: Bereitet Wanddaten als Tensoren für das Broadcasting vor.
    initTensors() {
        const minX = [], maxX = [], minY = [], maxY = [];
        for (const wall of this.walls) {
            minX.push(wall.x);
            maxX.push(wall.x + wall.width);
            minY.push(wall.y);
            maxY.push(wall.y + wall.height);
        }

        // Erstelle 1D Tensoren und erweitere die Dimension auf [1, W] (W = Anzahl Wände).
        // Dies ist entscheidend für das Broadcasting gegen die Punkte, die das Shape [N, 1] haben werden.
        this.wallMinX = tf.tensor1d(minX).expandDims(0);
        this.wallMaxX = tf.tensor1d(maxX).expandDims(0);
        this.wallMinY = tf.tensor1d(minY).expandDims(0);
        this.wallMaxY = tf.tensor1d(maxY).expandDims(0);
    }

    // NEU / KRITISCH: Tensor-basierte, differenzierbare Kollisionsprüfung (GPU).
    // Diese Funktion ermöglicht das Training des Modells und ist vollständig vektorisiert.
    getPenetrationDepthTF(points) {
        // points shape: [N, 2] (N = Anzahl der Punkte)
        return tf.tidy(() => {
            // 1. Extrahiere X und Y Koordinaten. Shape: [N, 1]
            const x = points.slice([0, 0], [-1, 1]);
            const y = points.slice([0, 1], [-1, 1]);

            // 2. Berechne die Abstände zu allen 4 Kanten für alle Punkte gegen alle Wände gleichzeitig (Broadcasting).
            // Operation z.B.: [N, 1] - [1, W] => Ergebnis-Shape: [N, W].
            // Wenn der Wert positiv ist, ist der Punkt innerhalb der jeweiligen Grenze.
            const depthX1 = x.sub(this.wallMinX);
            const depthX2 = this.wallMaxX.sub(x);
            const depthY1 = y.sub(this.wallMinY);
            const depthY2 = this.wallMaxY.sub(y);

            // 3. Finde die minimale Eindringtiefe für jede Wand-Punkt-Kombination.
            // Stapeln entlang Achse 2 => Shape: [N, W, 4]
            const depths = tf.stack([depthX1, depthX2, depthY1, depthY2], 2);
            // Minimum entlang Achse 2 => Shape: [N, W]
            const minDepths = depths.min(2);

            // 4. Wende differenzierbares Masking mit tf.relu() an.
            // Ein Punkt ist nur dann in der Wand, wenn ALLE Abstände (depthX1...) positiv sind.
            // Wenn der Punkt außerhalb ist, ist mindestens ein Abstand negativ, und somit ist minDepths negativ.
            // tf.relu() klemmt negative Werte (keine Kollision) auf 0 und behält positive Werte (Kollisionstiefe).
            const penetrationDepths = tf.relu(minDepths); // Shape: [N, W]

            // 5. Finde die maximale Penetration über alle Wände (Achse 1) für jeden Punkt.
            const maxPenetration = penetrationDepths.max(1); // Shape: [N]

            // 6. Reshape für Konsistenz mit dem Modell-Output (insideMask in sofa.mjs). Shape: [N, 1]
            return maxPenetration.expandDims(1);
        });
    }


    // Bestehend: CPU-basierte Kollisionsprüfung.
    // Wird weiterhin für die genaue Statistik-Anzeige nach dem Training genutzt (aber nicht währenddessen).
    getPenetrationDepth(x, y) {
        let maxDepth = 0;
        for (const wall of this.walls) {
            if (x >= wall.x && x <= wall.x + wall.width && y >= wall.y && y <= wall.y + wall.height) {
                const depthX1 = x - wall.x;
                const depthX2 = (wall.x + wall.width) - x;
                const depthY1 = y - wall.y;
                const depthY2 = (wall.y + wall.height) - y;
                // Die kleinste Distanz ist die tatsächliche Eindringtiefe
                maxDepth = Math.max(maxDepth, Math.min(depthX1, depthX2, depthY1, depthY2));
            }
        }
        return maxDepth;
    }

    // Bestehend: Zeichenfunktion (Canvas API)
    draw(ctx) {
        ctx.fillStyle = "#34495e"; // Dunkelgrau/Blau für Wände
        this.walls.forEach(wall => ctx.fillRect(wall.x, wall.y, wall.width, wall.height));

        // Zeichne den Pfad
        ctx.strokeStyle = "#95a5a6"; // Hellgrau für den Pfad
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 10]); // Gestrichelte Linie
        ctx.beginPath();
        ctx.moveTo(this.path[0].x, this.path[0].y);
        for (let i = 1; i < this.path.length; i++) {
            ctx.lineTo(this.path[i].x, this.path[i].y);
        }
        ctx.stroke();
        ctx.setLineDash([]); // Linienstil zurücksetzen

        // Start- und Endpunkte markieren
        ctx.fillStyle = "#27ae60"; // Grün für Start
        ctx.font = "bold 20px Arial";
        ctx.fillText("A", this.path[0].x - 30, this.path[0].y + 5);
        ctx.fillStyle = "#c0392b"; // Rot für Ende
        ctx.fillText("B", this.path[this.path.length - 1].x + 10, this.path[this.path.length - 1].y + 5);
    }
}
