/**
 * @file path.js
 * @description Implementiert den KI-Piloten, der lernt, einen Pfad zu finden.
 * Nutzt TensorFlow.js für das neuronale Netz und den Trainingsprozess.
 */

const Path = {
    model: null,
    optimizer: null,
    numWaypoints: 15,
    pathAdjustments: null,

    init: function(learningRate) {
        // Alte Tensoren bereinigen, falls die Funktion erneut aufgerufen wird
        if (this.pathAdjustments) {
            tf.dispose(this.pathAdjustments);
        }
        this.pathAdjustments = tf.variable(tf.randomNormal([this.numWaypoints, 3], 0, 0.01)); // [dx, dy, dRotation]
        this.optimizer = tf.train.adam(learningRate);
    },

    getWaypoints: function() {
        const adjustments = this.pathAdjustments.arraySync();
        const waypoints = [];
        
        const corridorWidth = Corridor.width;
        const armLength = Corridor.armLength;
        const centerX = corridorWidth / 2;
        const centerY = corridorWidth / 2;
        
        for (let i = 0; i < this.numWaypoints; i++) {
            const t = i / (this.numWaypoints - 1);

            let baseX, baseY, baseRotation;

            if (t < 0.5) {
                const t_segment = t * 2;
                baseX = centerX;
                const startY = armLength - centerY;
                const cornerY = centerY;
                baseY = startY + t_segment * (cornerY - startY); 
                baseRotation = 0;
            } else {
                const t_segment = (t - 0.5) * 2;
                baseY = centerY;
                const cornerX = centerX;
                const endX = armLength - centerX;
                baseX = cornerX + t_segment * (endX - cornerX);
                baseRotation = Math.PI / 2;
            }

            const adjustment = adjustments[i];
            waypoints.push({
                x: baseX + adjustment[0],
                y: baseY + adjustment[1],
                rotation: baseRotation + adjustment[2]
            });
        }
        return waypoints;
    },

    /**
     * FINALE KORREKTUR: Löst den "Cannot find a connection" Fehler.
     */
    trainStep: function(sofa) {
        // Die Funktion, die den zu minimierenden Verlust berechnet.
        const lossFunction = () => {
            // Da getWaypoints() die Variable this.pathAdjustments verwendet und
            // dieser Aufruf innerhalb der Funktion stattfindet, kann TensorFlow
            // die Verbindung zwischen der Variable und dem Ergebnis nachverfolgen.
            const waypoints = this.getWaypoints();
            let totalLoss = 0;
            for (const wp of waypoints) {
                sofa.setPosition(wp.x, wp.y, wp.rotation);
                totalLoss += Corridor.calculateCollisionLoss(sofa);
            }
            // Die Funktion muss einen einzelnen Skalar-Tensor zurückgeben.
            return tf.scalar(totalLoss / waypoints.length);
        };

        // HIER IST DIE MAGIE ✨: Wir rufen den Optimierer auf und übergeben ihm
        // nicht nur die Verlustfunktion, sondern auch explizit eine Liste
        // der Variablen, die er optimieren soll. Das löst den Fehler.
        this.optimizer.minimize(lossFunction, /* returnCost */ false, [this.pathAdjustments]);
    }
};
