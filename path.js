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
        if (this.pathAdjustments) {
            tf.dispose(this.pathAdjustments);
        }
        this.pathAdjustments = tf.variable(tf.randomNormal([this.numWaypoints, 3], 0, 0.01));
        this.optimizer = tf.train.adam(learningRate);
    },

    getWaypoints: function() {
        // Diese Funktion bleibt unverändert, da sie für die Visualisierung korrekt ist.
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
     * FINALE KORREKTUR: Verwendet einen expliziten, manuellen Gradienten-Ansatz.
     * Dies ist die robusteste Methode und löst den "Cannot find a connection"-Fehler endgültig.
     */
    trainStep: function(sofa) {
        // Schritt 1: Definiere die Funktion, die den Verlust berechnet.
        const lossFunction = () => {
            // tf.tidy sorgt dafür, dass alle Zwischentensoren nach der Berechnung gelöscht werden.
            return tf.tidy(() => {
                // WICHTIG: getWaypoints() wird INNERHALB dieser Funktion aufgerufen.
                // TensorFlow "beobachtet" diesen Aufruf und sieht, dass this.pathAdjustments
                // verwendet wird, um den finalen Verlust zu berechnen.
                const waypoints = this.getWaypoints();
                let totalLoss = 0;
                for (const wp of waypoints) {
                    sofa.setPosition(wp.x, wp.y, wp.rotation);
                    totalLoss += Corridor.calculateCollisionLoss(sofa);
                }
                // Die Funktion muss einen einzelnen Skalar-Tensor zurückgeben.
                return tf.scalar(totalLoss / waypoints.length);
            });
        };

        // Schritt 2: Berechne die Gradienten manuell.
        // Wir fragen TensorFlow: "Was ist die Ableitung der Verlustfunktion
        // in Bezug auf unsere lernbare Variable 'pathAdjustments'?"
        const grads = tf.grad(lossFunction)(this.pathAdjustments);
        
        // Schritt 3: Wende die Gradienten an, um die Variable zu aktualisieren.
        // Wir sagen dem Optimierer: "Nimm diese berechneten Gradienten und
        // aktualisiere damit die Variable."
        this.optimizer.applyGradients({[this.pathAdjustments.name]: grads});
    }
};
