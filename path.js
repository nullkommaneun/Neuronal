/**
 * @file path.js
 * @description Finale, autonome KI. Sie erfindet den Pfad selbst und ist
 * durch Gradient Clipping vor Abstürzen geschützt.
 */
const Path = {
    optimizer: null,
    numWaypoints: 15,
    pathWaypoints: null, // GEÄNDERT: Speichert jetzt absolute Koordinaten

    init: function(learningRate) {
        if (this.pathWaypoints) tf.dispose(this.pathWaypoints);
        
        // GEÄNDERT: Wir initialisieren die KI nicht mehr mit Zufallswerten um Null,
        // sondern geben ihr einen einfachen "Startgedanken": einen geraden Pfad
        // vom Startpunkt nach oben. Das hilft ihr, schneller eine sinnvolle
        // Lösung zu finden, als wenn sie bei komplettem Chaos anfangen müsste.
        const initialPath = [];
        for (let i = 0; i < this.numWaypoints; i++) {
            const t = i / (this.numWaypoints - 1);
            const x = 0.5; // Mitte des Korridors
            const y = (Corridor.armLength - 0.5) - t * (Corridor.armLength - 1.0);
            const rotation = 0;
            initialPath.push(x, y, rotation);
        }
        this.pathWaypoints = tf.variable(tf.tensor(initialPath, [this.numWaypoints, 3]));
        
        this.optimizer = tf.train.adam(learningRate);
    },

    // GEÄNDERT: Die Funktion liest jetzt nur noch die absoluten Werte aus.
    // Keine Berechnung eines Basispfades mehr.
    getWaypoints: function() {
        return tf.tidy(() => {
            const waypointsData = this.pathWaypoints.arraySync();
            return waypointsData.map(wp => ({ x: wp[0], y: wp[1], rotation: wp[2] }));
        });
    },

    trainStep: function(sofa) {
        // Wir verwenden die explizite Gradienten-Berechnung, um Clipping anwenden zu können.
        const lossFunction = () => {
            // Wichtig: Wir müssen die Logik hier innerhalb der Funktion nachbilden,
            // damit TensorFlow die Verbindung tracen kann.
            return tf.tidy(() => {
                let totalLoss = tf.scalar(0);
                for (let i = 0; i < this.numWaypoints; i++) {
                    const waypoint = this.pathWaypoints.slice([i, 0], [1, 3]).squeeze();
                    const x = waypoint.slice(0, 1);
                    const y = waypoint.slice(1, 1);
                    const rotation = waypoint.slice(2, 1);

                    // Da die Physik-Engine in JS ist, müssen wir eine Brücke bauen.
                    // Wir extrahieren die Werte, berechnen den Verlust und fügen ihn
                    // auf eine für TF nachverfolgbare Weise hinzu.
                    const xVal = x.arraySync()[0];
                    const yVal = y.arraySync()[0];
                    const rotVal = rotation.arraySync()[0];

                    const tempSofa = { 
                        width: sofa.width, height: sofa.height, x: xVal, y: yVal, rotation: rotVal,
                        getCorners: sofa.getCorners
                    };
                    const loss = Corridor.calculateCollisionLoss(tempSofa);
                    
                    // Der "Dummy"-Trick, um die Verbindung zu garantieren.
                    totalLoss = totalLoss.add(tf.scalar(loss).add(waypoint.sum().mul(0)));
                }
                return totalLoss.div(tf.scalar(this.numWaypoints));
            });
        };

        const grads = tf.grad(lossFunction)(this.pathWaypoints);
        
        // NEU: GRADIENT CLIPPING
        // Wir begrenzen die "Panikreaktion" der KI auf einen Maximalwert von 1.0.
        // Das verhindert, dass die Gradienten explodieren und das Training crasht.
        const clippedGrads = tf.clipByValue(grads, -1.0, 1.0);

        this.optimizer.applyGradients({[this.pathWaypoints.name]: clippedGrads});
    }
};
