// sofa.js

/**
 * Kapselt das neuronale Netz, das die implizite Form des Sofas lernt.
 */
export class Sofa {
    constructor() {
        this.model = null;
        this.optimizer = tf.train.adam(0.01);
        // Abtastgitter für Visualisierung und Flächenberechnung
        this.gridResolution = 50; // 50x50 Gitter
        this.grid = this.createSampleGrid(); // Lokale Koordinaten [-0.5, 0.5]
    }

    /**
     * Erstellt das neuronale Netz.
     * WICHTIG: Der negative Bias in der letzten Schicht sorgt dafür, dass
     * das Netz anfangs für alle Eingaben einen negativen Wert ausgibt (f(x,y) < 0).
     * Das entspricht einer leeren/sehr kleinen Form, die dann von innen nach außen wachsen kann.
     * Dies verhindert einen Start mit einer großen, kollidierenden Form und stabilisiert das Training.
     */
    init() {
        this.model = tf.sequential();
        this.model.add(tf.layers.dense({ inputShape: [2], units: 32, activation: 'relu' }));
        this.model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
        this.model.add(tf.layers.dense({
            units: 1,
            activation: 'tanh', // tanh skaliert die Ausgabe zwischen -1 und 1
            biasInitializer: tf.initializers.constant({ value: -2.5 })
        }));
    }

    /**
     * Erstellt ein Gitter von Punkten (x,y) zur Abfrage des Modells.
     * @returns {tf.Tensor2D} Ein Tensor mit den Koordinaten im Bereich [-0.5, 0.5].
     */
    createSampleGrid() {
        const linspace = tf.linspace(-0.5, 0.5, this.gridResolution);
        const [x, y] = tf.meshgrid(linspace, linspace);
        return tf.stack([x.flatten(), y.flatten()], 1);
    }

    /**
     * Führt einen Trainingsschritt aus.
     * @param {Corridor} corridor - Das Umgebungsobjekt für Kollisionsprüfungen.
     * @param {number} lambdaCollision - Gewicht für den Kollisionsverlust.
     * @param {number} lambdaArea - Gewicht für die Flächenbelohnung.
     * @returns {{collisionLoss: tf.Tensor, areaReward: tf.Tensor}} Die berechneten Verluste für die Statistik.
     */
    trainStep(corridor, lambdaCollision, lambdaArea) {
        // tf.tidy() räumt den Speicher von Zwischen-Tensoren automatisch auf.
        return tf.tidy(() => {
            const lossFunction = () => {
                // Holt alle Punkte, die laut Netz aktuell zum Sofa gehören (f(x,y) > 0)
                const sofaPoints = this.getShapePoints();
                if (sofaPoints.shape[0] === 0) {
                    // Wenn die Form leer ist, gibt es keine Kollision, nur Flächenverlust
                    const shapeValues = this.model.predict(this.grid);
                    const area = tf.relu(shapeValues).mean();
                    const areaLoss = area.mul(-1).mul(lambdaArea);
                    return areaLoss;
                }

                // 1. Kollisionsverlust: Bestrafe das Eindringen in Wände.
                let totalPenetration = tf.tensor(0.0);
                const pathSamples = [0, 0.25, 0.5, 0.75, 1.0]; // Prüfe an 5 diskreten Punkten des Pfades.
                
                for (const t of pathSamples) {
                    const pos = this.getPointOnPath(corridor.path, t);
                    const transformedPoints = this.transformPoints(sofaPoints, pos.x, pos.y, pos.angle);
                    
                    const depths = transformedPoints.arraySync().map(p => corridor.getPenetrationDepth(p[0], p[1]));
                    const penetrationSum = depths.reduce((sum, d) => sum + d, 0);
                    totalPenetration = totalPenetration.add(penetrationSum);
                }
                const collisionLoss = totalPenetration.mul(lambdaCollision);

                // 2. Flächen-Belohnung (negativer Verlust)
                const shapeValues = this.model.predict(this.grid);
                const area = tf.relu(shapeValues).mean();
                const areaReward = area.mul(lambdaArea);
                const areaLoss = areaReward.mul(-1); // Wir minimieren (-Belohnung)

                const totalLoss = collisionLoss.add(areaLoss);
                return totalLoss;
            };

            const {value, grads} = tf.variableGrads(lossFunction);
            this.optimizer.applyGradients(grads);
            
            // Berechne Verluste erneut außerhalb der Gradientenberechnung für die Statistik
            const shapePoints = this.getShapePoints();
            let finalCollisionLoss = 0;
            if (shapePoints.shape[0] > 0) {
                 for (const t of [0, 0.25, 0.5, 0.75, 1.0]) {
                    const pos = this.getPointOnPath(corridor.path, t);
                    const transformed = this.transformPoints(shapePoints, pos.x, pos.y, pos.angle);
                    finalCollisionLoss += transformed.arraySync().map(p => corridor.getPenetrationDepth(p[0], p[1])).reduce((s, d) => s + d, 0);
                }
            }
            const finalArea = tf.relu(this.model.predict(this.grid)).mean().dataSync()[0];

            return { collisionLoss: finalCollisionLoss, areaReward: finalArea };
        });
    }

    /**
     * Gibt die Punkte zurück, die aktuell die Form des Sofas definieren (f(x,y) > 0).
     * @returns {tf.Tensor2D}
     */
    getShapePoints() {
        return tf.tidy(() => {
            const predictions = this.model.predict(this.grid);
            const isInside = predictions.greater(0).as1D();
            return tf.booleanMask(this.grid, isInside);
        });
    }

    /**
     * Gibt die Form als Gitter von Werten für die Visualisierung zurück.
     * @returns {Promise<Float32Array>} Die vorhergesagten Werte für das Gitter.
     */
    async getShapeForDrawing() {
        const predictions = this.model.predict(this.grid);
        const data = await predictions.data();
        predictions.dispose();
        return data;
    }

    // Hilfsfunktionen zur Transformation des Sofas im Weltraum
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
        const sofaScale = 150; // Skalierungsfaktor von lokalen zu Welt-Koordinaten
        
        const pointArray = points.arraySync();
        const transformedArray = pointArray.map(p => [
            (p[0] * cos - p[1] * sin) * sofaScale + dx,
            (p[0] * sin + p[1] * cos) * sofaScale + dy
        ]);
        return tf.tensor2d(transformedArray);
    }
}
