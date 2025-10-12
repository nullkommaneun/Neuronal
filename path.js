// path.js (The AI Pilot)
const Path = {
    model: null,
    optimizer: null,
    numWaypoints: 15, // Der Pfad besteht aus 15 lernbaren Stützpunkten

    init: function(learningRate) {
        if (this.model) return;

        // Das Netz lernt eine Sequenz von (dx, dy, dRotation) Anpassungen
        // an einen geraden Basis-Pfad. Das hilft ihm, schneller zu lernen.
        this.model = tf.sequential();
        this.model.add(tf.layers.dense({ inputShape: [1], units: 32, activation: 'relu' }));
        this.model.add(tf.layers.dense({ units: this.numWaypoints * 3 })); // 3 Werte pro Wegpunkt

        this.optimizer = tf.train.adam(learningRate);
    },

    /**
     * Führt einen Trainingsschritt aus, um den Pfad zu verbessern.
     * @param {object} sofa - Das Sofa-Objekt, für das der Pfad gefunden werden soll.
     * @returns {{path: Array, collisionLoss: number}} - Der aktuell beste Pfad und der Kollisionsverlust.
     */
    trainStep: function(sofa) {
        return tf.tidy(() => {
            const { grads, value } = this.optimizer.computeGradients(() => {
                const waypoints = this.getWaypoints();
                let totalCollisionLoss = tf.scalar(0.0);

                // Prüfe den Pfad an 50 Zwischenschritten auf Kollisionen
                for (let i = 0; i <= 50; i++) {
                    const p = i / 50; // Fortschritt entlang des Pfades
                    const {x, y, rotation} = this._interpolatePath(waypoints, p);
                    
                    sofa.setPosition(x, y, rotation);
                    const corners = sofa.getCorners();
                    
                    // Berechne den Verlust für jede Ecke, die außerhalb ist
                    for (const corner of corners) {
                        // Wände links & oben
                        totalCollisionLoss = totalCollisionLoss.add(tf.relu(tf.neg(corner.x)));
                        totalCollisionLoss = totalCollisionLoss.add(tf.relu(tf.neg(corner.y)));
                        // Wände rechts & unten (komplexere Form)
                        if (corner.x > Corridor.width && corner.y > Corridor.width) {
                            const distToCornerX = corner.x - Corridor.width;
                            const distToCornerY = corner.y - Corridor.width;
                            totalCollisionLoss = totalCollisionLoss.add(tf.sqrt(distToCornerX.square().add(distToCornerY.square())));
                        }
                    }
                }
                return totalCollisionLoss;
            });

            this.optimizer.applyGradients(grads);
            return { path: this.getWaypoints(), collisionLoss: value.dataSync()[0] };
        });
    },

    /**
     * Berechnet die aktuellen Wegpunkte aus dem neuronalen Netz.
     * @returns {Array} - Array von {x, y, rotation} Objekten.
     */
    getWaypoints: function() {
        const adjustments = tf.tidy(() => this.model.predict(tf.tensor2d([[1]]))).reshape([this.numWaypoints, 3]);
        const adjustmentsData = adjustments.dataSync();
        adjustments.dispose();
        
        const waypoints = [];
        for (let i = 0; i < this.numWaypoints; i++) {
            const p = i / (this.numWaypoints - 1);
            
            // Ein einfacher Basis-Pfad, der von der KI angepasst wird
            const baseX = 0.5 + Math.max(0, p * 2 - 1) * 2.5;
            const baseY = Math.min(p * 2, 1) * 2.5;
            const baseRot = (Math.PI / 2) * Math.min(1, p * 2);

            waypoints.push({
                x: baseX + adjustmentsData[i * 3 + 0] * 0.5, // erlaube kleine seitliche Anpassung
                y: baseY + adjustmentsData[i * 3 + 1] * 0.5,
                rotation: baseRot + adjustmentsData[i * 3 + 2] * 0.5
            });
        }
        return waypoints;
    },

    // Interpoliert die Position zwischen zwei Wegpunkten
    _interpolatePath: function(waypoints, p) {
        const index = Math.min(Math.floor(p * (this.numWaypoints - 1)), this.numWaypoints - 2);
        const localP = (p * (this.numWaypoints - 1)) - index;
        const w1 = waypoints[index];
        const w2 = waypoints[index + 1];
        return {
            x: w1.x + (w2.x - w1.x) * localP,
            y: w1.y + (w2.y - w1.y) * localP,
            rotation: w1.rotation + (w2.rotation - w1.rotation) * localP,
        };
    }
};
