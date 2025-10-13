// sofa.mjs (Final korrigierte und optimierte Version)

export class Sofa {
    constructor() {
        this.model = null;
        this.optimizer = tf.train.adam(0.01);
        this.gridResolution = 50;
        this.grid = this.createSampleGrid();
        this.sofaScale = 150;
    }

    init() {
        this.model = tf.sequential();
        this.model.add(tf.layers.dense({ inputShape: [2], units: 32, activation: 'relu' }));
        this.model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
        this.model.add(tf.layers.dense({
            units: 1,
            activation: 'tanh',
            // Korrekte Initialisierung für einen leeren Start.
            biasInitializer: tf.initializers.constant({ value: -1.0 })
        }));
    }

    createSampleGrid() {
        const linspace = tf.linspace(-0.5, 0.5, this.gridResolution);
        const [x, y] = tf.meshgrid(linspace, linspace);
        return tf.stack([x.flatten(), y.flatten()], 1);
    }

    transformPointsTF(points, dx, dy, angle) {
        return tf.tidy(() => {
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const R = tf.tensor2d([
                [cos, sin],
                [-sin, cos]
            ]);
            const rotatedPoints = tf.matMul(points, R);
            const scaledPoints = rotatedPoints.mul(this.sofaScale);
            const translationVector = tf.tensor1d([dx, dy]);
            return scaledPoints.add(translationVector);
        });
    }

    // KORREKTUR: trainStep wurde grundlegend überarbeitet, um Gradient Tracking zu ermöglichen.
    async trainStep(corridor, lambdaCollision, lambdaArea) {

        const useTensorCollision = typeof corridor.getPenetrationDepthTF === 'function';
        if (!useTensorCollision) {
            console.error("FEHLER: corridor.getPenetrationDepthTF() fehlt.");
            return { collisionLoss: 0, areaReward: 0 };
        }

        // --- TEIL 1: Optimierungsschritt (GPU, Differenzierbar) ---

        // Die Definition der Verlustfunktion.
        const lossFunction = () => {
            // Wir nutzen tf.tidy() hier, um Zwischentensoren zu bereinigen, aber den Verlust selbst zurückzugeben.
            return tf.tidy(() => {
                // KRITISCHE KORREKTUR: Verwende this.model.apply() anstelle von this.model.predict().
                // apply() stellt sicher, dass Gradienten aufgezeichnet werden.
                const shapeValuesRaw = this.model.apply(this.grid);

                // apply() kann ein Array zurückgeben. Wir stellen sicher, dass wir den Tensor haben (für tf.sequential).
                const shapeValues = Array.isArray(shapeValuesRaw) ? shapeValuesRaw[0] : shapeValuesRaw;

                // 2. Area Loss (Flächenmaximierung).
                const area = tf.relu(shapeValues).mean();
                const areaLoss = area.mul(-1).mul(lambdaArea);

                // 3. Collision Loss (Kollisionsminimierung).
                let collisionLoss = tf.scalar(0.0);
                const pathSamples = [0, 0.25, 0.5, 0.75, 1.0];
                const insideMask = tf.relu(shapeValues); // Continuous Relaxation

                for (const t of pathSamples) {
                    const pos = this.getPointOnPath(corridor.path, t);
                    const transformedGrid = this.transformPointsTF(this.grid, pos.x, pos.y, pos.angle);
                    const depths = corridor.getPenetrationDepthTF(transformedGrid);

                    // Gewichtete Penetration.
                    const collisionAtT = depths.mul(insideMask).sum();
                    collisionLoss = collisionLoss.add(collisionAtT);
                }
                collisionLoss = collisionLoss.mul(lambdaCollision);

                // Gesamtverlust
                return areaLoss.add(collisionLoss);
            });
        };

        // Führt die Optimierung durch.
        // Wir lassen TF.js die Variablen automatisch erkennen (was nun dank apply() funktioniert).
        // Dies behebt den "varList"-Fehler robust.
        this.optimizer.minimize(lossFunction);

        // --- TEIL 2: Statistik-Berechnung (Async) ---

        await tf.nextFrame(); // Warten auf GPU.

        // Flächenberechnung (Async). Hier nutzen wir wieder predict() (Inferenz), da keine Gradienten benötigt werden.
        const finalShapeValues = this.model.predict(this.grid);
        const finalAreaTensor = tf.relu(finalShapeValues).mean()
        const finalAreaData = await finalAreaTensor.data();
        const finalArea = finalAreaData[0];
        finalShapeValues.dispose();
        finalAreaTensor.dispose();

        // Kollisionsberechnung (Async)
        const sofaPointsForStats = await this.getShapePointsAsync();
        let finalCollisionLoss = 0;

        if (sofaPointsForStats.shape[0] > 0 && typeof corridor.getPenetrationDepth === 'function') {
             const sofaPointsArray = await sofaPointsForStats.array();

             for (const t of [0, 0.25, 0.5, 0.75, 1.0]) {
                const pos = this.getPointOnPath(corridor.path, t);
                const transformed = this.transformPointsJS(sofaPointsArray, pos.x, pos.y, pos.angle);
                finalCollisionLoss += transformed.map(p => corridor.getPenetrationDepth(p[0], p[1])).reduce((s, d) => s + d, 0);
            }
        }
        sofaPointsForStats.dispose();

        return { collisionLoss: finalCollisionLoss, areaReward: finalArea };
    }

    // Asynchrone Extraktion von Punkten. Nutzt predict() für Effizienz.
    async getShapePointsAsync() {
        const predictions = this.model.predict(this.grid);
        const isInside = predictions.greater(0).flatten();

        const indices = await tf.whereAsync(isInside);

        if (indices.shape[0] === 0) {
            predictions.dispose();
            isInside.dispose();
            indices.dispose();
            return tf.tensor2d([], [0, 2]);
        }

        const points = tf.gather(this.grid, indices.flatten());

        predictions.dispose();
        isInside.dispose();
        indices.dispose();

        return points;
    }

    // Hilfsmethode für JavaScript-Transformation (CPU).
    transformPointsJS(pointArray, dx, dy, angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return pointArray.map(p => [
            (p[0] * cos - p[1] * sin) * this.sofaScale + dx,
            (p[0] * sin + p[1] * cos) * this.sofaScale + dy
        ]);
    }

    // Nutzt predict() für Effizienz bei der Visualisierung.
    async getShapeForDrawing() {
        const predictions = this.model.predict(this.grid);
        const data = await predictions.data();
        predictions.dispose();
        return data;
    }

    getPointOnPath(path, t) {
        if (t <= 0) return path[0];
        if (t >= 1) return path[path.length - 1];
        const totalLength = path.length - 1;
        const segment = Math.floor(t * totalLength);
        const segmentT = (t * totalLength) % 1;
        const p1 = path[segment];
        const p2 = path[segment + 1];
        return {
            x: p1.x + (p2.x - p1.x) * segmentT,
            y: p1.y + (p2.y - p1.y) * segmentT,
            angle: p1.angle + (p2.angle - p1.angle) * segmentT
        };
    }
}
