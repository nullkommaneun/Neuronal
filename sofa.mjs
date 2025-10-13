// sofa.mjs (Vollständiger Code)
/**
 * Kapselt das neuronale Netz, das die implizite Form des Sofas lernt.
 */
export class Sofa {
    constructor() {
        this.model = null;
        this.optimizer = tf.train.adam(0.01);
        this.gridResolution = 50;
        this.grid = this.createSampleGrid();
    }

    /**
     * Erstellt das neuronale Netz mit negativem Bias.
     */
    init() {
        this.model = tf.sequential();
        this.model.add(tf.layers.dense({ inputShape: [2], units: 32, activation: 'relu' }));
        this.model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
        this.model.add(tf.layers.dense({
            units: 1,
            activation: 'tanh',
            biasInitializer: tf.initializers.constant({ value: -2.5 })
        }));
    }

    createSampleGrid() {
        const linspace = tf.linspace(-0.5, 0.5, this.gridResolution);
        const [x, y] = tf.meshgrid(linspace, linspace);
        return tf.stack([x.flatten(), y.flatten()], 1);
    }

    // Die trainStep und andere Funktionen lassen wir für den Test noch auskommentiert,
    // um sicherzustellen, dass das reine Erstellen des Modells funktioniert.
    // Wir fügen sie im nächsten Schritt wieder hinzu.
}
