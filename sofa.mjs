// sofa.mjs (Stabilisiert durch Architektur, Hyperparameter und Performance-Optimierung)

export class Sofa {
    constructor() {
        this.model = null;
        // (STABILITÄT) Lernrate auf 0.005 reduziert für stabilere Konvergenz.
        this.optimizer = tf.train.adam(0.005);
        this.gridResolution = 50; // Hohe Auflösung beibehalten dank Optimierungen
        this.grid = this.createSampleGrid();
        this.sofaScale = 150;
    }

    init() {
        this.model = tf.sequential();

        // (STABILITÄT) Architektur-Anpassung: Hinzufügen von LayerNormalization.

        // Input Layer
        this.model.add(tf.layers.dense({ inputShape: [2], units: 32 }));
        this.model.add(tf.layers.activation({ activation: 'relu' }));
        this.model.add(tf.layers.layerNormalization()); // Normalisiert die Aktivierungen

        // Hidden Layer
        this.model.add(tf.layers.dense({ units: 32 }));
        this.model.add(tf.layers.activation({ activation: 'relu' }));
        this.model.add(tf.layers.layerNormalization());

        // Output Layer
        this.model.add(tf.layers.dense({
            units: 1,
            activation: 'tanh',
            // Bias von -0.5 für einen sichtbaren Start, der zum Wachsen angeregt wird.
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

        // --- TEIL 1: Optimierungsschritt (GPU) ---

        const lossFunction = () => {
            return tf.tidy(() => {
                // WICHTIG: training=true ist notwendig für Normalisierungsschichten während des Trainings.
                const shapeValuesRaw = this.model.apply(this.grid, { training: true });
                const shapeValues = Array.isArray(shapeValuesRaw) ? shapeValuesRaw[0] : shapeValuesRaw;

                // Area Loss (Wachstum)
                const areaLoss = shapeValues.mean().mul(-1).mul(lambdaArea);

                // Collision Loss
                let collisionLoss = tf.scalar(0.0);
                const pathSamples = [0, 0.25, 0.5, 0.75, 1.0];
                const insideMask = tf.relu(shapeValues);

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

        // Synchronisation (Fence): Stellt sicher, dass das Training abgeschlossen ist.
        const lossTensor = this.optimizer.minimize(lossFunction, /* returnLoss */ true);
        if (lossTensor) {
            await lossTensor.data();
            lossTensor.dispose();
        }

        // --- TEIL 2: Statistik-Berechnung (Optimiert) ---

        // (PERFORMANCE) Überarbeitet, um GPU-Aufrufe zu minimieren und Berechnungen wiederzuverwenden.

        // 1. Führe predict() EINMAL aus (Inferenzmodus).
        const finalShapeValues = this.model.predict(this.grid);

        // 2. Berechne Fläche (GPU).
        const finalAreaTensor = tf.relu(finalShapeValues).mean();

        // 3. Finde Punkte im Inneren (GPU), nutze finalShapeValues erneut.
        const isInside = finalShapeValues.greater(0).flatten();
        const indices = await tf.whereAsync(isInside);

        // 4. Lade Fläche herunter (Async).
        const finalAreaData = await finalAreaTensor.data();
        const finalArea = finalAreaData[0];

        // 5. Berechne Kollisionsverlust.
        let finalCollisionLoss = 0;
        if (indices.shape[0] > 0 && typeof corridor.getPenetrationDepth === 'function') {
            // Extrahiere Punkte (GPU)
            const points = tf.gather(this.grid, indices.flatten());
            // Lade Punkte herunter (Async)
            const sofaPointsArray = await points.array();
            points.dispose();

            // Berechne Kollision (CPU)
            for (const t of [0, 0.25, 0.5, 0.75, 1.0]) {
                const pos = this.getPointOnPath(corridor.path, t);
                const transformed = this.transformPointsJS(sofaPointsArray, pos.x, pos.y, pos.angle);

                if (transformed.length > 0) {
                   finalCollisionLoss += transformed.map(p => corridor.getPenetrationDepth(p[0], p[1])).reduce((s, d) => s + d, 0);
                }
            }
        }

        // Speicherbereinigung
        finalShapeValues.dispose();
        finalAreaTensor.dispose();
        isInside.dispose();
        indices.dispose();

        return { collisionLoss: finalCollisionLoss, areaReward: finalArea };
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

    // (PERFORMANCE) Neue Funktion: Gibt Daten für Pixel UND Tensor für Kollision zurück.
    // Ersetzt die alte Logik in app.mjs und spart eine komplette predict()-Berechnung pro Frame.
    async getShapeForDrawing() {
        const predictions = this.model.predict(this.grid); // Inferenzmodus
        const data = await predictions.data();
        // Gibt beides zurück. Der Aufrufer (app.mjs) ist verantwortlich für das dispose() des Tensors.
        return { data: data, tensor: predictions };
    }

    getPointOnPath(path, t) {
        if (t <= 0) return path[0];
        if (t >= 1) return path[path.length - 1];
        const totalLength = path.length - 1;
        const segment = Math.floor(t * totalLength);
        const segmentT = (t * totalLength) % 1;
        const p1 = path[segment];
        const p2 = path[segment + 1];
        // Zusätzliche Sicherheit
        if (!p2) return p1;
        return {
            x: p1.x + (p2.x - p1.x) * segmentT,
            y: p1.y + (p2.y - p1.y) * segmentT,
            angle: p1.angle + (p2.angle - p1.angle) * segmentT
        };
    }
}
