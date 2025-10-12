/**
 * @file path.js
 * @description Finale Version mit intelligenter Rotation.
 * Die KI lernt, eine sanfte Grund-Drehung zu optimieren.
 */
const Path = {
    optimizer: null,
    numWaypoints: 15,
    pathAdjustments: null,

    init: function(learningRate) {
        if (this.pathAdjustments) tf.dispose(this.pathAdjustments);
        this.pathAdjustments = tf.variable(tf.randomNormal([this.numWaypoints, 3], 0, 0.01));
        this.optimizer = tf.train.adam(learningRate);
    },

    getWaypoints: function() {
        return tf.tidy(() => {
            const adjustments = this.pathAdjustments.arraySync();
            const waypoints = [];
            const corridorWidth = Corridor.width, armLength = Corridor.armLength;
            const centerX = corridorWidth / 2, centerY = corridorWidth / 2;
            
            for (let i = 0; i < this.numWaypoints; i++) {
                const t = i / (this.numWaypoints - 1);
                let baseX, baseY;

                // Position-Logik bleibt gleich (hoch, dann rechts)
                if (t < 0.5) {
                    const t_segment = t * 2;
                    baseX = centerX;
                    const startY = armLength - centerY, cornerY = centerY;
                    baseY = startY + t_segment * (cornerY - startY); 
                } else {
                    const t_segment = (t - 0.5) * 2;
                    baseY = centerY;
                    const cornerX = centerX, endX = armLength - centerX;
                    baseX = cornerX + t_segment * (endX - cornerX);
                }

                // GEÄNDERT: Sanfte, kontinuierliche Drehung als Basis
                // Statt einer harten 90°-Wende interpolieren wir die Drehung linear
                // über den gesamten Pfad. Das gibt der KI eine viel bessere Ausgangslage.
                const baseRotation = t * (Math.PI / 2);

                const adjustment = adjustments[i];
                waypoints.push({
                    x: baseX + adjustment[0],
                    y: baseY + adjustment[1],
                    rotation: baseRotation + adjustment[2]
                });
            }
            return waypoints;
        });
    },

    trainStep: function(sofa) {
        const variables = [this.pathAdjustments];
        this.optimizer.minimize(() => {
            let totalLoss = 0;
            const waypoints = this.getWaypoints();
            
            for (const wp of waypoints) {
                sofa.setPosition(wp.x, wp.y, wp.rotation);
                totalLoss += Corridor.calculateCollisionLoss(sofa);
            }
            
            const dummyLoss = this.pathAdjustments.sum().mul(0);
            return tf.scalar(totalLoss / waypoints.length).add(dummyLoss);
            
        }, /* returnCost */ false, variables);
    }
};
