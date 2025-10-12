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
        tf.tidy(() => {
            this.pathAdjustments = tf.variable(tf.randomNormal([this.numWaypoints, 3], 0, 0.01)); // [dx, dy, dRotation]
        });
        this.optimizer = tf.train.adam(learningRate);
    },

    /**
     * KORRIGIERTE VERSION: Definiert den Pfad von UNTEN (A) nach RECHTS (B).
     * @returns {Array<object>} Eine Liste von Wegpunkten, jeder mit {x, y, rotation}.
     */
    getWaypoints: function() {
        const adjustments = this.pathAdjustments.arraySync();
        const waypoints = [];
        
        // Konstanten für einen klaren Pfad durch die Mitte des Korridors.
        const corridorWidth = Corridor.width;
        const armLength = Corridor.armLength;
        const centerX = corridorWidth / 2;
        const centerY = corridorWidth / 2;
        
        for (let i = 0; i < this.numWaypoints; i++) {
            const t = i / (this.numWaypoints - 1); // Fortschritt von 0.0 bis 1.0

            let baseX, baseY, baseRotation;

            // VERMERK: Die neue Pfadlogik "HOCH, dann RECHTS"
            if (t < 0.5) {
                // Erste Hälfte: Bewegung nach OBEN
                const t_segment = t * 2; // Fortschritt in diesem Segment (0-1)
                baseX = centerX;
                // Interpoliere von der Start-Y-Position (unten) zur Ecke (oben-links)
                const startY = armLength - centerY;
                const cornerY = centerY;
                baseY = startY + t_segment * (cornerY - startY); 
                baseRotation = 0; // Vertikal ausgerichtet
            } else {
                // Zweite Hälfte: Bewegung nach RECHTS
                const t_segment = (t - 0.5) * 2; // Fortschritt in diesem Segment (0-1)
                baseY = centerY;
                // Interpoliere von der Ecke zur End-X-Position (rechts)
                const cornerX = centerX;
                const endX = armLength - centerX;
                baseX = cornerX + t_segment * (endX - cornerX);
                baseRotation = Math.PI / 2; // Horizontal ausgerichtet
            }

            // Wende die gelernten Anpassungen des neuronalen Netzes an.
            const adjustment = adjustments[i];
            waypoints.push({
                x: baseX + adjustment[0],
                y: baseY + adjustment[1],
                rotation: baseRotation + adjustment[2]
            });
        }
        return waypoints;
    },

    trainStep: function(sofa) {
        this.optimizer.minimize(() => {
            let totalLoss = tf.scalar(0);
            const waypoints = this.getWaypoints();

            for (const wp of waypoints) {
                sofa.setPosition(wp.x, wp.y, wp.rotation);
                const loss = Corridor.calculateCollisionLoss(sofa);
                totalLoss = totalLoss.add(tf.scalar(loss));
            }
            
            return totalLoss.div(tf.scalar(this.numWaypoints));
        });
    }
};
