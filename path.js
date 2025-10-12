/**
 * @file path.js
 * @description Finale KI. Gibt nur noch Bewegungsbefehle aus (vor, links, rechts).
 * Die eigentliche Physik wird von app.js übernommen.
 */
const Path = {
    model: null,
    optimizer: null,

    // Das Gehirn der KI: Ein einfaches neuronales Netz
    init: function(learningRate) {
        // Das Netz nimmt die Position und Rotation des Sofas sowie die Zielposition als Input
        // und gibt 3 Werte aus: die Wahrscheinlichkeit für "vorwärts", "links drehen", "rechts drehen".
        this.model = tf.sequential();
        this.model.add(tf.layers.dense({inputShape: [4], units: 16, activation: 'relu'}));
        this.model.add(tf.layers.dense({units: 3, activation: 'softmax'})); // 3 Aktionen

        this.optimizer = tf.train.adam(learningRate);
    },

    /**
     * Entscheidet die nächste Aktion basierend auf der aktuellen Situation.
     * @param {object} sofaState - {x, y, rotation, goalX, goalY}
     * @returns {number} - 0 (vor), 1 (links), 2 (rechts)
     */
    getAction: function(sofaState) {
        return tf.tidy(() => {
            const inputTensor = tf.tensor2d([Object.values(sofaState)]);
            const predictions = this.model.predict(inputTensor);
            // Wähle die Aktion mit der höchsten Wahrscheinlichkeit
            return tf.argMax(predictions, 1).dataSync()[0];
        });
    },

    /**
     * Lernt aus den Konsequenzen seiner Aktionen.
     * @param {Array} history - Eine Liste von Zuständen und den daraus resultierenden Belohnungen.
     */
    trainStep: function(history) {
        // HINWEIS: Dies ist eine vereinfachte Form des Reinforcement Learning.
        // Wir belohnen Aktionen, die zu einer Verringerung der Zieldistanz führten
        // und bestrafen Aktionen, die in einer Kollision endeten.

        const lossFunction = () => {
            return tf.tidy(() => {
                let totalLoss = tf.scalar(0);
                for (const step of history) {
                    const { state, action, reward } = step;
                    const inputTensor = tf.tensor2d([Object.values(state)]);
                    const predictedActionProbabilities = this.model.predict(inputTensor);
                    
                    // Wir wollen die Wahrscheinlichkeit der gewählten Aktion erhöhen, wenn die Belohnung positiv war,
                    // und sie verringern, wenn sie negativ war.
                    const targetActionTensor = tf.oneHot(tf.tensor1d([action], 'int32'), 3);
                    const loss = tf.losses.meanSquaredError(targetActionTensor.mul(reward), predictedActionProbabilities);
                    totalLoss = totalLoss.add(loss);
                }
                return totalLoss.div(history.length);
            });
        };

        const grads = tf.grad(lossFunction)(this.model.getWeights().map(w => w.val));
        this.optimizer.applyGradients(this.model.getWeights().map((w, i) => ({var: w.val, grad: grads[i]})));
    }
};
