// sofa.js
const Sofa = {
    model: null,
    optimizer: null,
    init: function(config) {
        if (this.model) { return; }
        this.model = tf.sequential();
        this.model.add(tf.layers.dense({ inputShape: [2], units: 16, activation: 'tanh' }));
        this.model.add(tf.layers.dense({ units: 16, activation: 'tanh' }));
        this.model.add(tf.layers.dense({
            units: 1,
            activation: 'sigmoid',
            biasInitializer: tf.initializers.constant({ value: -2.5 })
        }));
        this.optimizer = tf.train.adam(config.LEARNING_RATE);
    },

    trainStep: function(config) {
        if (!this.model) throw new Error("Sofa not initialized.");

        return tf.tidy(() => {
            let collisionLossTensor;
            const { grads, value } = this.optimizer.computeGradients(() => {
                const gridCoords = this._createGrid(config.GRID_RESOLUTION, 4.0);
                const shapeOutput = this.model.predict(gridCoords).squeeze();
                const areaLoss = tf.mul(tf.sum(shapeOutput), -config.LAMBDA_AREA);
                
                let totalCollision = tf.scalar(0.0);
                for (let i = 0; i <= config.COLLISION_STEPS; i++) {
                    const t = i / config.COLLISION_STEPS;
                    const angle = -Math.PI / 2 * t;
                    const xPos = Math.max(0, t * 2 - 1) * 2;
                    const yPos = Math.min(t * 2, 1) * 2;
                    const transformedCoords = this._transformPoints(gridCoords, angle, xPos, yPos);
                    totalCollision = tf.add(totalCollision, Corridor.calculateCollision(transformedCoords, shapeOutput));
                }
                collisionLossTensor = tf.mul(totalCollision, config.LAMBDA_COLLISION);
                return tf.add(areaLoss, collisionLossTensor);
            });

            this.optimizer.applyGradients(grads);
            
            const currentArea = tf.sum(this.model.predict(this._createGrid(config.GRID_RESOLUTION, 4.0))).div(config.GRID_RESOLUTION**2);
            
            // ✅ Gibt alle benötigten Werte sauber zurück
            return {
                loss: value.dataSync()[0],
                area: currentArea.dataSync()[0],
                collisionLoss: collisionLossTensor.div(config.LAMBDA_COLLISION).dataSync()[0] // Unskalierter Kollisionswert
            };
        });
    },

    getShape: function(resolution) {
        if (!this.model) return null;
        return tf.tidy(() => this.model.predict(this._createGrid(resolution, 4.0)).dataSync());
    },

    _createGrid: (resolution, scale) => {
        const linspace = tf.linspace(-scale/2, scale/2, resolution);
        const grid = tf.stack(tf.meshgrid(linspace, linspace), 2);
        return grid.reshape([-1, 2]);
    },

    _transformPoints: (points, angle, dx, dy) => {
        const cosA = Math.cos(angle); const sinA = Math.sin(angle);
        const rotMatrix = tf.tensor2d([[cosA, -sinA], [sinA, cosA]]);
        return tf.matMul(points, rotMatrix).add(tf.tensor2d([[dx, dy]]));
    }
};
