// sofa.mjs (Vollständig überarbeiteter, optimierter und final korrigierter Code)

// WICHTIGE VORAUSSETZUNG:
// Nutzt die 'corridor.getPenetrationDepthTF(pointsTensor)' Methode für das Training.
export class Sofa {
    constructor() {
        this.model = null;
        this.optimizer = tf.train.adam(0.01); // Adam Optimizer ist eine gute Wahl.
        this.gridResolution = 50; // Auflösung (50x50 = 2500 Punkte)
        this.grid = this.createSampleGrid();
        this.sofaScale = 150; // Skalierungsfaktor zentral definieren
    }

    init() {
        this.model = tf.sequential();
        // Definition des Modells (Implizite Neuronale Repräsentation)
        this.model.add(tf.layers.dense({ inputShape: [2], units: 32, activation: 'relu' }));
        this.model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
        this.model.add(tf.layers.dense({
            units: 1,
            activation: 'tanh', // Output Bereich [-1, 1]. > 0 bedeutet im Sofa.

            // KORREKTUR DES FATALEN FEHLERS: tf.initializers.constant benötigt ein Config-Objekt { value: ... }.
            // Ein Bias von -1.0 sorgt dafür, dass das Sofa leer beginnt (da tanh(-1) nahe -1 ist) und wachsen muss.
            biasInitializer: tf.initializers.constant({ value: -1.0 })
        }));
    }

    createSampleGrid() {
        // Erstellt ein Gitter im Bereich [-0.5, 0.5] x [-0.5, 0.5]. (Effizient)
        const linspace = tf.linspace(-0.5, 0.5, this.gridResolution);
        const [x, y] = tf.meshgrid(linspace, linspace);
        return tf.stack([x.flatten(), y.flatten()], 1);
    }

    // Tensor-basierte Transformation (GPU).
    // Notwendig für differenzierbares Training.
    transformPointsTF(points, dx, dy, angle) {
        return tf.tidy(() => {
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            // Rotationsmatrix R für tf.matMul(points, R).
            // R = [ [cos, sin],
            //       [-sin, cos] ]
            const R = tf.tensor2d([
                [cos, sin],
                [-sin, cos]
            ]);

            // 1. Rotation, 2. Skalierung, 3. Translation
            const rotatedPoints = tf.matMul(points, R);
            const scaledPoints = rotatedPoints.mul(this.sofaScale);
            const translationVector = tf.tensor1d([dx, dy]);
            return scaledPoints.add(translationVector);
        });
    }

    // Der Trainingsschritt ist 'async', um den Main-Thread nicht zu blockieren.
    async trainStep(corridor, lambdaCollision, lambdaArea) {

        const useTensorCollision = typeof corridor.getPenetrationDepthTF === 'function';
        if (!useTensorCollision) {
            console.error("FEHLER: corridor.getPenetrationDepthTF() fehlt.");
            return { collisionLoss: 0, areaReward: 0 };
        }

        // --- TEIL 1: Optimierungsschritt (Muss differenzierbar sein, läuft auf GPU) ---
        tf.tidy(() => {
            const lossFunction = () => {
                // 1. Vorhersage der Sofa-Form (Implizites Feld).
                const shapeValues = this.model.predict(this.grid);

                // 2. Area Loss (Flächenmaximierung).
                const area = tf.relu(shapeValues).mean();
                const areaLoss = area.mul(-1).mul(lambdaArea); // Verlust = negative Fläche

                // 3. Collision Loss (Kollisionsminimierung).
                let collisionLoss = tf.scalar(0.0);

                const pathSamples = [0, 0.25, 0.5, 0.75, 1.0];

                // Differenzierbarer Proxy für "Ist der Punkt im Sofa?" (Continuous Relaxation).
                const insideMask = tf.relu(shapeValues);

                for (const t of pathSamples) {
                    const pos = this.getPointOnPath(corridor.path, t);

                    // Transformiere das gesamte Grid (GPU-optimiert).
                    const transformedGrid = this.transformPointsTF(this.grid, pos.x, pos.y, pos.angle);

                    // Berechne Eindringtiefe (Tensor-basiert).
                    const depths = corridor.getPenetrationDepthTF(transformedGrid);

                    // Gewichtete Penetration: Kollision (depths) * "Stärke" im Sofa (insideMask).
                    const collisionAtT = depths.mul(insideMask).sum();
                    collisionLoss = collisionLoss.add(collisionAtT);
                }
                collisionLoss = collisionLoss.mul(lambdaCollision);

                // Gesamtverlust
                return areaLoss.add(collisionLoss);
            };

            // Führt die Optimierung durch und aktualisiert die Gewichte.
            this.optimizer.minimize(lossFunction, false, this.model.trainableWeights);
        });

        // --- TEIL 2: Statistik-Berechnung (Nach dem Training, für die Anzeige, Async) ---

        // OPTIMIERUNG: Sicherstellen, dass die GPU fertig ist.
        await tf.nextFrame();

        // Flächenberechnung (Async)
        const finalShapeValues = this.model.predict(this.grid);
        const finalAreaTensor = tf.relu(finalShapeValues).mean()
        // Nutze asynchrones .data() statt .dataSync().
        const finalAreaData = await finalAreaTensor.data();
        const finalArea = finalAreaData[0];
        finalShapeValues.dispose();
        finalAreaTensor.dispose();

        // Kollisionsberechnung (Effizienter und Async)
        const sofaPointsForStats = await this.getShapePointsAsync();
        let finalCollisionLoss = 0;

        if (sofaPointsForStats.shape[0] > 0 && typeof corridor.getPenetrationDepth === 'function') {
             // Daten einmalig auf die CPU herunterladen (Async)
             const sofaPointsArray = await sofaPointsForStats.array();

             for (const t of [0, 0.25, 0.5, 0.75, 1.0]) {
                const pos = this.getPointOnPath(corridor.path, t);
                // Nutze reine JavaScript-Transformation für Geschwindigkeit auf der CPU.
                const transformed = this.transformPointsJS(sofaPointsArray, pos.x, pos.y, pos.angle);

                // Nutze die originale (CPU-basierte) Kollisionsprüfung für genaue Statistik.
                finalCollisionLoss += transformed.map(p => corridor.getPenetrationDepth(p[0], p[1])).reduce((s, d) => s + d, 0);
            }
        }
        sofaPointsForStats.dispose(); // Tensor freigeben

        return { collisionLoss: finalCollisionLoss, areaReward: finalArea };
    }

    // Asynchrone und effiziente Extraktion von Punkten.
    async getShapePointsAsync() {
        const predictions = this.model.predict(this.grid);
        const isInside = predictions.greater(0).flatten();

        // tf.whereAsync findet Indizes asynchron auf der GPU.
        const indices = await tf.whereAsync(isInside);

        if (indices.shape[0] === 0) {
            predictions.dispose();
            isInside.dispose();
            indices.dispose();
            return tf.tensor2d([], [0, 2]);
        }

        // Extrahiert Punkte mittels Indizes (GPU).
        const points = tf.gather(this.grid, indices.flatten());

        // Speicherbereinigung
        predictions.dispose();
        isInside.dispose();
        indices.dispose();

        return points;
    }

    // Hilfsmethode für reine JavaScript-Transformation (CPU).
    transformPointsJS(pointArray, dx, dy, angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return pointArray.map(p => [
            (p[0] * cos - p[1] * sin) * this.sofaScale + dx,
            (p[0] * sin + p[1] * cos) * this.sofaScale + dy
        ]);
    }

    async getShapeForDrawing() {
        // Effizient für Visualisierung (Asynchron).
        const predictions = this.model.predict(this.grid);
        const data = await predictions.data();
        predictions.dispose();
        return data;
    }

    getPointOnPath(path, t) {
        // Hilfsfunktion zur Pfadinterpolation (CPU-basiert, OK).
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
