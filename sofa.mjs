// sofa.mjs (Final synchronisiert und optimiert)

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
            // STRATEGIE-ANPASSUNG: Ein Bias von -0.5 hilft dem Modell,
            // dank der neuen Wachstumsphase schneller sichtbar zu werden.
            biasInitializer: tf.initializers.constant({ value: -0.5 })
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
            // Erstellung der Rotationsmatrix R = [[cos, sin], [-sin, cos]]
            const R = tf.tensor2d([[cos, sin], [-sin, cos]]);
            const rotatedPoints = tf.matMul(points, R);
            const scaledPoints = rotatedPoints.mul(this.sofaScale);
            const translationVector = tf.tensor1d([dx, dy]);
            return scaledPoints.add(translationVector);
        });
    }

    async trainStep(corridor, lambdaCollision, lambdaArea) {

        if (typeof corridor.getPenetrationDepthTF !== 'function') {
            return { collisionLoss: 0, areaReward: 0 };
        }

        // --- TEIL 1: Optimierungsschritt (GPU, Differenzierbar) ---

        const lossFunction = () => {
            return tf.tidy(() => {
                // Nutze apply() für Gradient Tracking.
                const shapeValuesRaw = this.model.apply(this.grid);
                const shapeValues = Array.isArray(shapeValuesRaw) ? shapeValuesRaw[0] : shapeValuesRaw;

                // Area Loss: Negativer Durchschnitt der rohen Ausgabewerte (sorgt für Wachstum).
                const areaLoss = shapeValues.mean().mul(-1).mul(lambdaArea);

                // Collision Loss.
                let collisionLoss = tf.scalar(0.0);
                const pathSamples = [0, 0.25, 0.5, 0.75, 1.0];
                const insideMask = tf.relu(shapeValues); // Continuous Relaxation

                for (const t of pathSamples) {
                    const pos = this.getPointOnPath(corridor.path, t);
                    const transformedGrid = this.transformPointsTF(this.grid, pos.x, pos.y, pos.angle);
                    const depths = corridor.getPenetrationDepthTF(transformedGrid);

                    const collisionAtT = depths.mul(insideMask).sum();
                    collisionLoss = collisionLoss.add(collisionAtT);
                }
                collisionLoss = collisionLoss.mul(lambdaCollision);

                return areaLoss.add(collisionLoss);
            });
        };

        // KRITISCHE KORREKTUR: GPU/CPU Synchronisation.

        // 1. Führe die Optimierung durch und gib den Verlust zurück (returnLoss = true).
        const lossTensor = this.optimizer.minimize(lossFunction, /* returnLoss */ true);

        // 2. WICHTIG: Synchronisation (Fence). Lade den Verlustwert auf die CPU.
        // Dies stellt sicher, dass die Gewichte aktualisiert sind.
        if (lossTensor) {
            await lossTensor.data();
            lossTensor.dispose();
        }

        // --- TEIL 2: Statistik-Berechnung (Async, mit aktualisierten Gewichten) ---

        // Flächenberechnung für die Anzeige
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

                if (transformed.length > 0) {
                   finalCollisionLoss += transformed.map(p => corridor.getPenetrationDepth(p[0], p[1])).reduce((s, d) => s + d, 0);
                }
            }
        }
        sofaPointsForStats.dispose();

        return { collisionLoss: finalCollisionLoss, areaReward: finalArea };
    }

    // Asynchrone Extraktion von Punkten (Manuelles Speichermanagement).
    async getShapePointsAsync() {
        const predictions = this.model.predict(this.grid);
        const isInside = predictions.greater(0).flatten();
        const indices = await tf.whereAsync(isInside);
        if (indices.shape[0] === 0) {
            predictions.dispose(); isInside.dispose(); indices.dispose();
            return tf.tensor2d([], [0, 2]);
        }
        const points = tf.gather(this.grid, indices.flatten());
        predictions.dispose(); isInside.dispose(); indices.dispose();
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
 
