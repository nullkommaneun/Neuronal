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
        this.grid = this.createSampleGrid();
    }

    /**
     * Erstellt das neuronale Netz.
     * WICHTIG: Der negative Bias in der letzten Schicht sorgt dafür, dass
     * das Netz anfangs für alle Eingaben einen negativen Wert ausgibt.
     * Das entspricht einer leeren/sehr kleinen Form, die dann wachsen kann.
     */
    init() {
        this.model = tf.sequential();
        this.model.add(tf.layers.dense({ inputShape: [2], units: 32, activation: 'relu' }));
        this.model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
        this.model.add(tf.layers.dense({
            units: 1,
            activation: 'tanh', // tanh skaliert die Ausgabe zwischen -1 und 1
            // Dies ist der entscheidende Parameter:
            biasInitializer: tf.initializers.constant({ value: -2.5 })
        }));
    }
    
    /**
     * Erstellt ein Gitter von Punkten (x,y) zur Abfrage des Modells.
     * @returns {tf.Tensor2D} Ein Tensor mit den Koordinaten [-0.5, 0.5].
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
     * @returns {object} Die berechneten Verluste.
     */
    trainStep(corridor, lambdaCollision, lambdaArea) {
        return tf.tidy(() => {
            const lossFunction = () => {
                const sofaPoints = this.getShapePoints();
                const shapeValues = this.model.predict(this.grid);

                // 1. Kollisionsverlust: Bestrafe das Eindringen in Wände.
                let totalPenetration = tf.tensor(0.0);
                // WICHTIG: Dieser Teil ist komplex, da er über den Pfad integrieren muss.
                // Vereinfachung hier: Prüfe an 5 diskreten Punkten des Pfades.
                const pathSamples = [0, 0.25, 0.5, 0.75, 1.0];
                for(const t of pathSamples) {
                    // Position und Winkel am Punkt t des Pfades holen (vereinfacht)
                    const pos = this.getPointOnPath(corridor.path, t);
                    
                    // Transformiere die Sofa-Punkte an diese Position
                    const transformedPoints = this.transformPoints(sofaPoints, pos.x, pos.y, pos.angle);
                    
                    // Berechne Eindringtiefe für jeden Punkt
                    const depths = transformedPoints.arraySync().map(p => corridor.getPenetrationDepth(p[0], p[1]));
                    const penetration = depths.reduce((sum, d) => sum + Math.max(0, d), 0); // Nur positive Tiefen zählen
                    totalPenetration = totalPenetration.add(penetration);
                }
                const collisionLoss = totalPenetration.mul(lambdaCollision);

                // 2. Flächen-Belohnung (negativer Verlust)
                // Wir belohnen positive Ausgaben des Netzes (f(x,y) > 0)
                const area = tf.relu(shapeValues).mean();
                const areaLoss = area.mul(-1).mul(lambdaArea); // Minimiere (-Area)

                // Gesamtverlust
                const totalLoss = collisionLoss.add(areaLoss);
                return totalLoss;
            };

            const grads = tf.grad(lossFunction)(this.model.trainableWeights);
            this.optimizer.applyGradients(grads.grads);

            // TODO: Verluste zurückgeben für die Anzeige
            return { collisionLoss: 0, areaReward: 0 }; // Platzhalter
        });
    }

    /**
     * Gibt die Punkte zurück, die aktuell die Form des Sofas definieren.
     * @returns {tf.Tensor2D}
     */
    getShapePoints() {
         // Vereinfacht: Nutze die Punkte des Gitters, die als "innen" klassifiziert werden.
         const predictions = this.model.predict(this.grid);
         const isInside = predictions.greater(0).as1D();
         return tf.booleanMask(this.grid, isInside);
    }
    
    /**
     * Gibt die Form als Gitter von Werten für die Visualisierung zurück.
     * @returns {Promise<Float32Array>} Die vorhergesagten Werte für das Gitter.
     */
    async getShapeForDrawing() {
        return await this.model.predict(this.grid).data();
    }
    
    // Hilfsfunktionen für die Transformation (vereinfacht)
    getPointOnPath(path, t) {
        if (t <= 0) return path[0];
        if (t >= 1) return path[path.length - 1];
        // Sehr einfache lineare Interpolation
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
        // Skalierung fehlt hier zur Vereinfachung, sollte hinzugefügt werden
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const sofaScale = 150; // Skalierungsfaktor von Sofa-Koordinaten zu Welt-Koordinaten
        
        return tf.tensor(points.arraySync().map(p => [
            (p[0] * cos - p[1] * sin) * sofaScale + dx,
            (p[0] * sin + p[1] * cos) * sofaScale + dy
        ]));
    }
}
