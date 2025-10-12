// sofa.js

const Sofa = {
    // Eigenschaften
    model: null,
    optimizer: null,

    /**
     * Initialisiert das neuronale Netz.
     * @param {object} config - Das Konfigurationsobjekt, das LEARNING_RATE enthält.
     */
    init: function(config) {
        if (this.model) {
            console.warn("Sofa model is already initialized.");
            return;
        }

        this.model = tf.sequential();
        this.model.add(tf.layers.dense({ inputShape: [2], units: 16, activation: 'tanh' }));
        this.model.add(tf.layers.dense({ units: 16, activation: 'tanh' }));
        
        // ✅ NEU: Der Bias wird auf -2.5 gesetzt. Das erzeugt einen kleinen,
        // sinnvollen "Blob" als Startform, anstatt bei Null zu beginnen.
        this.model.add(tf.layers.dense({
            units: 1,
            activation: 'sigmoid',
            biasInitializer: tf.initializers.constant({ value: -2.5 })
        }));

        this.optimizer = tf.train.adam(config.LEARNING_RATE);
        console.log("Sofa module initialized with a sensible starting bias.");
    },

    /**
     * Führt einen einzelnen Trainingsschritt aus.
     * @param {object} config - Das Konfigurationsobjekt mit allen Parametern.
     * @returns {{loss: number, area: number}} - Der berechnete Verlust und die Fläche.
     */
    trainStep: function(config) {
        if (!this.model) {
            throw new Error("Sofa not initialized. Call Sofa.init() first.");
        }

        const { loss, area } = tf.tidy(() => {
            const { grads, value } = this.optimizer.computeGradients(() => {
                const gridCoords = this._createGrid(config.GRID_RESOLUTION, 2.5);
                const shapeOutput = this.model.predict(gridCoords).squeeze();
                
                // ✅ NEU: Explizite Belohnung für Flächenwachstum
                // Der LAMBDA_AREA-Faktor (Standard: 1.0) steuert, wie stark das
                // Wachstum belohnt wird. Ein höherer Wert bedeutet mehr "Druck",
                // die Fläche zu vergrößern.
                const area = tf.sum(shapeOutput);
                const areaLoss = tf.mul(area, -config.LAMBDA_AREA); // Belohnung = negativer Verlust

                // Kollisionsverlust (unverändert)
                let totalCollision = tf.scalar(0.0);
                for (let i = 0; i <= config.COLLISION_STEPS; i++) {
                    const t = i / config.COLLISION_STEPS;
                    const angle = -Math.PI / 2 * t;
                    const offsetX = t < 0.5 ? 0 : (t - 0.5) * 2;
                    const offsetY = t > 0.5 ? 0 : (0.5 - t) * 2;
                    
                    const transformedCoords = this._transformPoints(gridCoords, angle, offsetX, offsetY);
                    totalCollision = tf.add(totalCollision, Corridor.calculateCollision(transformedCoords, shapeOutput));
                }
                const collisionLoss = tf.mul(totalCollision, config.LAMBDA_COLLISION);
                
                // Kombinierter Verlust
                return tf.add(areaLoss, collisionLoss);
            });

            this.optimizer.applyGradients(grads);

            // Metriken für die UI berechnen
            const currentArea = tf.tidy(() => 
                tf.sum(this.model.predict(this._createGrid(config.GRID_RESOLUTION, 2.5)))
                  .div(config.GRID_RESOLUTION**2)
            );
            
            return { loss: value, area: currentArea };
        });

        return { loss: loss.dataSync()[0], area: area.dataSync()[0] };
    },

    /**
     * Gibt die aktuelle Form des Sofas als Datenarray für die Visualisierung zurück.
     * @param {number} resolution - Die Auflösung des Rasters für die Darstellung.
     * @returns {Float32Array | null}
     */
    getShape: function(resolution) {
        if (!this.model) return null;
        return tf.tidy(() => this.model.predict(this._createGrid(resolution, 2.5)).dataSync());
    },

    // --- Private Hilfsfunktionen ---
    _createGrid: (resolution, scale) => {
        const linspace = tf.linspace(-scale / 2, scale / 2, resolution);
        const grid = tf.stack(tf.meshgrid(linspace, linspace), 2);
        return grid.reshape([-1, 2]);
    },
    _transformPoints: (points, angle, dx, dy) => {
        const cosA = Math.cos(angle); const sinA = Math.sin(angle);
        const rotMatrix = tf.tensor2d([[cosA, -sinA], [sinA, cosA]]);
        return tf.matMul(points, rotMatrix).add(tf.tensor2d([[dx, dy]]));
    }
};
