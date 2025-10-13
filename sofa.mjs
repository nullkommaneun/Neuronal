// sofa.mjs (Endgültiger, geprüfter Code)
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
            biasInitializer: tf.initializers.constant({ value: -2.5 })
        }));
    }

    createSampleGrid() {
        const linspace = tf.linspace(-0.5, 0.5, this.gridResolution);
        const [x, y] = tf.meshgrid(linspace, linspace);
        return tf.stack([x.flatten(), y.flatten()], 1);
    }

    trainStep(corridor, lambdaCollision, lambdaArea) {
        return tf.tidy(() => {
            const lossFunction = () => {
                const sofaPoints = this.getShapePoints();
                if (sofaPoints.shape[0] === 0) {
                    const shapeValues = this.model.predict(this.grid);
                    const area = tf.relu(shapeValues).mean();
                    return area.mul(-1).mul(lambdaArea);
                }

                let totalPenetration = tf.tensor(0.0);
                const pathSamples = [0, 0.25, 0.5, 0.75, 1.0];
                for (const t of pathSamples) {
                    const pos = this.getPointOnPath(corridor.path, t);
                    const transformedPoints = this.transformPoints(sofaPoints, pos.x, pos.y, pos.angle);
                    const depths = transformedPoints.arraySync().map(p => corridor.getPenetrationDepth(p[0], p[1]));
                    totalPenetration = totalPenetration.add(depths.reduce((sum, d) => sum + d, 0));
                }
                const collisionLoss = totalPenetration.mul(lambdaCollision);

                const shapeValues = this.model.predict(this.grid);
                const area = tf.relu(shapeValues).mean();
                const areaLoss = area.mul(-1).mul(lambdaArea);

                return collisionLoss.add(areaLoss);
            };

            // **DIE ENDGÜLTIGE KORREKTUR**
            // Wir verwenden die variableGrads-Funktion, aber übergeben ihr
            // explizit die Liste der Gewichte, die sie ändern soll.
            const grads = tf.variableGrads(lossFunction, this.model.trainableWeights);
            this.optimizer.applyGradients(grads.grads);

            // Berechne die Verluste erneut nur für die Anzeige
            const sofaPoints = this.getShapePoints();
            let finalCollisionLoss = 0;
            if (sofaPoints.shape[0] > 0) {
                for (const t of [0, 0.25, 0.5, 0.75, 1.0]) {
                    const pos = this.getPointOnPath(corridor.path, t);
                    const transformed = this.transformPoints(sofaPoints, pos.x, pos.y, pos.angle);
                    finalCollisionLoss += transformed.arraySync().map(p => corridor.getPenetrationDepth(p[0], p[1])).reduce((s, d) => s + d, 0);
                }
            }
            const finalArea = tf.relu(this.model.predict(this.grid)).mean().dataSync()[0];
            return { collisionLoss: finalCollisionLoss, areaReward: finalArea };
        });
    }

    getShapePoints() {
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
