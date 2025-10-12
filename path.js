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
     * KORRIGIERTE VERSION: Generiert die Sequenz der Wegpunkte für das Sofa.
     * HINWEIS: Die ursprüngliche Logik war für einen "rechts, dann runter"-Korridor.
     * Wir haben die Logik korrigiert, um dem "runter, dann rechts"-Layout zu entsprechen.
     * @returns {Array<object>} Eine Liste von Wegpunkten, jeder mit {x, y, rotation}.
     */
    getWaypoints: function() {
        const adjustments = this.pathAdjustments.arraySync();
        const waypoints = [];
        
        // Konstanten für einen klareren Pfad
        const corridorWidth = Corridor.width;
        const centerX = corridorWidth / 2; // X-Position im vertikalen Arm
        const centerY = corridorWidth / 2; // Y-Position im horizontalen Arm
        
        for (let i = 0; i < this.numWaypoints; i++) {
            const t = i / (this.numWaypoints - 1); // Fortschritt von 0.0 bis 1.0

            let baseX, baseY, baseRotation;

            // Der Basispfad ist jetzt ein einfacher L-förmiger Weg durch die Mitte des Korridors.
            if (t < 0.5) {
                // Erste Hälfte: Bewegung nach UNTEN
                const t_segment = t * 2; // Fortschritt in diesem Segment (0-1)
                baseX = centerX;
                // Interpoliere von der Start-Y-Position zur Ecke
                baseY = centerX + t_segment * (Corridor.armLength - corridorWidth); 
                baseRotation = 0; // Vertikal ausgerichtet
            } else {
                // Zweite Hälfte: Bewegung nach RECHTS
                const t_segment = (t - 0.5) * 2; // Fortschritt in diesem Segment (0-1)
                // Interpoliere von der Ecke zur End-X-Position
                baseX = centerX + t_segment * (Corridor.armLength - corridorWidth);
                baseY = Corridor.armLength - centerX;
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
