// sofa.mjs (Endgültiger, geprüfter Code mit erweiterter Diagnose)
export class Sofa {
    constructor() {
        this.model = null;
        this.optimizer = tf.train.adam(0.01);
        this.gridResolution = 50;
        this.grid = this.createSampleGrid();
    }

    init() {
        this.model = tf.sequential();
        this.model.add(tf.layers.dense({ inputShape: [2], units: 32, activation: 'relu' }));
        this.model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
        this.model.add(tf.layers.dense({
            units: 1,
            activation: 'tanh',
            // Milder Bias für einen sofort sichtbaren Start
            biasInitializer: tf.initializers.constant({ value: -1.0 })
        }));
    }

    createSampleGrid() {
        const linspace = tf.linspace(-0.5, 0.5, this.gridResolution);
        const [x, y] = tf.meshgrid(linspace, linspace);
        return tf.stack([x.flatten(), y.flatten()], 1);
    }

    trainStep(corridor, lambdaCollision, lambdaArea) {
        // Erweiterte Diagnose: Zeigt den "Herzschlag" der KI
        // console.log("--- TrainStep Start ---");

        return tf.tidy(() => {
            // **DIE ROBUSTE LÖSUNG**
            // Wir verwenden die optimizer.minimize-Funktion. Sie kombiniert die
            // Verlustberechnung und die Aktualisierung der Gewichte sicher in einem Schritt.
            this.optimizer.minimize(() => {
                const sofaPoints = this.getShapePoints();
                // Erweiterte Diagnose
                // console.log(`Sofa besteht aus ${sofaPoints.shape[0]} Punkten.`);

                if (sofaPoints.shape[0] === 0) {
                    const shapeValues = this.model.predict(this.grid);
                    const area = tf.relu(shapeValues).mean();
                    const loss = area.mul(-1).mul(lambdaArea);
                    // console.log(`Verlust (nur Fläche): ${loss.dataSync()[0]}`);
                    return loss;
                }

                // 1. Kollisionsverlust
                let totalPenetration = tf.tensor(0.0);
                const pathSamples = [0, 0.25, 0.5, 0.75, 1.0];
                for (const t of pathSamples) {
                    const pos = this.getPointOnPath(corridor.path, t);
                    const transformedPoints = this.transformPoints(sofaPoints, pos.x, pos.y, pos.angle);
                    const depths = transformedPoints.arraySync().map(p => corridor.getPenetrationDepth(p[0], p[1]));
                    totalPenetration = totalPenetration.add(depths.reduce((sum, d) => sum + d, 0));
                }
                const collisionLoss = totalPenetration.mul(lambdaCollision);

                // 2. Flächen-Belohnung (als negativer Verlust)
                const shapeValues = this.model.predict(this.grid);
                const area = tf.relu(shapeValues).mean();
                const areaLoss = area.mul(-1).mul(lambdaArea);

                const totalLoss = collisionLoss.add(areaLoss);
                // Erweiterte Diagnose
                // console.log(`Verlust (Kollision+Fläche): ${totalLoss.dataSync()[0]}`);
                return totalLoss;
            }, /* returnLoss */ false, this.model.trainableWeights);


            // Berechne die Verluste erneut nur für die Anzeige
            const sofaPointsForStats = this.get_shape_points_robust();
            let finalCollisionLoss = 0;
            if (sofaPointsForStats.shape[0] > 0) {
                for (const t of [0, 0.25, 0.5, 0.75, 1.0]) {
                    const pos = this.getPointOnPath(corridor.path, t);
                    const transformed = this.transformPoints(sofaPointsForStats, pos.x, pos.y, pos.angle);
                    finalCollisionLoss += transformed.arraySync().map(p => corridor.getPenetrationDepth(p[0], p[1])).reduce((s, d) => s + d, 0);
                }
            }
            const finalArea = tf.relu(this.model.predict(this.grid)).mean().dataSync()[0];
            return { collisionLoss: finalCollisionLoss, areaReward: finalArea };
        });
    }

    // Robuste Methode, die wir bereits verifiziert haben
    get_shape_points_robust() {
        return tf.tidy(() => {
            const predictions = this.model.predict(this.grid);
            const isInside = predictions.greater(0);
            const gridData = this.grid.arraySync();
            const isInsideData = isInside.dataSync();
            const points = [];
            for (let i = 0; i < isInsideData.length; i++) {
                if (isInsideData[i]) {
                    points.push(gridData[i]);
                }
            }
            if (points.length === 0) {
                return tf.tensor2d([], [0, 2]);
            }
            return tf.tensor2d(points);
        });
    }
    
    // Alias für die robuste Funktion
    getShapePoints() {
        return this.get_shape_points_robust();
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

    transformPoints(points, dx, dy, angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const sofaScale = 150;
        const pointArray = points.arraySync();
        const transformedArray = pointArray.map(p => [
            (p[0] * cos - p[1] * sin) * sofaScale + dx,
            (p[0] * sin + p[1] * cos) * sofaScale + dy
        ]);
        return tf.tensor2d(transformedArray);
    }
}
