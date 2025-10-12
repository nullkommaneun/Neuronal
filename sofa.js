// sofa.js

const Sofa = {
    // Eigenschaften, die nach der Initialisierung gefüllt werden
    model: null,
    optimizer: null,

    /**
     * Erstellt und initialisiert das neuronale Netz und den Optimizer.
     * Muss einmalig aufgerufen werden, bevor Training oder Visualisierung stattfinden.
     * @param {number} learningRate - Die Lernrate für den Adam-Optimizer.
     */
    init: function(learningRate) {
        // Schütze vor versehentlicher Neu-Initialisierung
        if (this.model) {
            console.warn("Sofa model is already initialized.");
            return;
        }

        // Definiere die Architektur des neuronalen Netzes
        this.model = tf.sequential();
        this.model.add(tf.layers.dense({ inputShape: [2], units: 16, activation: 'tanh' }));
        this.model.add(tf.layers.dense({ units: 16, activation: 'tanh' }));
        // Die Sigmoid-Aktivierung am Ende stellt sicher, dass der Output zwischen 0 und 1 liegt.
        this.model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));

        // Erstelle den Optimizer, der die Gewichte des Modells anpasst
        this.optimizer = tf.train.adam(learningRate);

        console.log("Sofa module initialized successfully.");
    },

    /**
     * Führt einen einzelnen Trainingsschritt aus.
     * Berechnet den Verlust (Fläche vs. Kollision) und passt die Gewichte des Modells an.
     * @param {object} config - Das Konfigurationsobjekt mit Parametern wie GRID_RESOLUTION etc.
     * @returns {{loss: number, area: number}} - Der berechnete Verlust und die Fläche für diesen Schritt.
     */
    trainStep: function(config) {
        if (!this.model) {
            throw new Error("Sofa not initialized. Call Sofa.init() first.");
        }

        // tf.tidy() sorgt automatisch für die Speicherbereinigung (entsorgt nicht mehr benötigte Tensoren)
        const { loss, area } = tf.tidy(() => {
            const { grads, value } = this.optimizer.computeGradients(() => {
                // Phase 1: Verlustberechnung
                const gridCoords = this._createGrid(config.GRID_RESOLUTION, 2.5);
                const shapeOutput = this.model.predict(gridCoords).squeeze();
                
                // Ziel 1: Maximierung der Fläche (daher negatives Vorzeichen im Verlust)
                const areaLoss = tf.mul(tf.sum(shapeOutput), -1);

                // Ziel 2: Minimierung von Kollisionen
                let totalCollision = tf.scalar(0.0);
                for (let i = 0; i <= config.COLLISION_STEPS; i++) {
                    const t = i / config.COLLISION_STEPS;
                    const angle = -Math.PI / 2 * t;
                    const offsetX = t < 0.5 ? 0 : (t - 0.5) * 2;
                    const offsetY = t > 0.5 ? 0 : (0.5 - t) * 2;
                    
                    const transformedCoords = this._transformPoints(gridCoords, angle, offsetX, offsetY);
                    // Rufe die Kollisionslogik aus dem Corridor-Modul auf
                    totalCollision = tf.add(totalCollision, Corridor.calculateCollision(transformedCoords, shapeOutput));
                }
                const collisionLoss = tf.mul(totalCollision, config.LAMBDA_COLLISION);
                
                // Kombinierter Verlust
                return tf.add(areaLoss, collisionLoss);
            });

            // Phase 2: Anwenden der Gradienten, um das Modell zu verbessern
            this.optimizer.applyGradients(grads);

            // Phase 3: Metriken für die UI berechnen
            // Wir berechnen die Fläche hier separat, um den reinen Flächenwert zu bekommen.
            const currentArea = tf.sum(this.model.predict(this._createGrid(config.GRID_RESOLUTION, 2.5))).div(config.GRID_RESOLUTION**2);
            
            return { loss: value, area: currentArea };
        });

        return { loss: loss.dataSync()[0], area: area.dataSync()[0] };
    },

    /**
     * Gibt die aktuelle Form des Sofas als Datenarray für die Visualisierung zurück.
     * @param {number} resolution - Die Auflösung des Rasters für die Darstellung.
     * @returns {Float32Array | null} - Ein Array mit den Werten (0-1) für jeden Punkt im Raster.
     */
    getShape: function(resolution) {
        if (!this.model) return null;
        return tf.tidy(() => {
            const grid = this._createGrid(resolution, 2.5);
            return this.model.predict(grid).dataSync();
        });
    },

    // --- Private Hilfsfunktionen ---

    _createGrid: (resolution, scale) => {
        const linspace = tf.linspace(-scale / 2, scale / 2, resolution);
        const grid = tf.stack(tf.meshgrid(linspace, linspace), 2);
        return grid.reshape([-1, 2]);
    },

    _transformPoints: (points, angle, dx, dy) => {
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const rotMatrix = tf.tensor2d([[cosA, -sinA], [sinA, cosA]]);
        return tf.matMul(points, rotMatrix).add(tf.tensor2d([[dx, dy]]));
    }
};
