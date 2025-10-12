// path.js (AI Pilot is back)
const Path = {
    model: null,
    optimizer: null,
    numWaypoints: 15, // Der Pfad besteht aus 15 lernbaren Stützpunkten

    init: function(learningRate) {
        // Wir erstellen das neuronale Netz nur einmal
        if (!this.model) {
            this.model = tf.sequential();
            this.model.add(tf.layers.dense({ inputShape: [1], units: 32, activation: 'relu' }));
            this.model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
            this.model.add(tf.layers.dense({ units: this.numWaypoints * 3 })); // 3 Werte pro Wegpunkt (dx, dy, dRot)
        }
        this.optimizer = tf.train.adam(learningRate);
    },

    trainStep: function(sofa) {
        return tf.tidy(() => {
            const { grads, value } = this.optimizer.computeGradients(() => {
                const waypoints = this.getWaypoints();
                let totalLoss = tf.scalar(0.0);

                // Prüfe den Pfad an vielen Zwischenschritten
                for (let i = 0; i <= 50; i++) {
                    const p = i / 50;
                    const pos = this._interpolatePath(waypoints, p);
                    
                    sofa.setPosition(pos.x, pos.y, pos.rotation);
                    const corners = sofa.getCorners();
                    
                    for (const corner of corners) {
                        const penetration = Corridor.getPenetrationDepth(corner.x, corner.y);
                        if (penetration > 0) {
                           totalLoss = totalLoss.add(penetration);
                        }
                    }
                }
                return totalLoss;
            });

            this.optimizer.applyGradients(grads);
            return { path: this.getWaypoints(), collisionLoss: value.dataSync()[0] };
        });
    },

    getWaypoints: function() {
        const adjustments = tf.tidy(() => this.model.predict(tf.tensor2d([[1]]))).reshape([this.numWaypoints, 3]);
        const adjustmentsData = adjustments.dataSync();
        adjustments.dispose();
        
        const waypoints = [];
        for (let i = 0; i < this.numWaypoints; i++) {
            const p = i / (this.numWaypoints - 1);
            
            // Ein einfacher Basis-Pfad, der von der KI angepasst wird
            const baseRot = (Math.PI / 2) * Math.min(1, p * 2);
            const baseX = 0.5 + Math.max(0, p * 2 - 1) * 2.5;
            const baseY = 0.5 + Math.min(p * 2, 1) * 2.0;

            waypoints.push({
                x: baseX + adjustmentsData[i * 3 + 0] * 0.5,
                y: baseY + adjustmentsData[i * 3 + 1] * 0.5,
                rotation: baseRot + adjustmentsData[i * 3 + 2] * 0.5
            });
        }
        return waypoints;
    },

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
