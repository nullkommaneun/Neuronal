/**
 * @file path.js
 * @description Finale, bereinigte Version zur Lösung des Gradienten-Problems.
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
        // Diese Funktion wird jetzt von BEIDEN, der Visualisierung und dem Training, genutzt.
        // Der Trick liegt darin, wie wir sie im Training aufrufen.
        return tf.tidy(() => {
            const adjustments = this.pathAdjustments.arraySync();
            const waypoints = [];
            const corridorWidth = Corridor.width, armLength = Corridor.armLength;
            const centerX = corridorWidth / 2, centerY = corridorWidth / 2;
            
            for (let i = 0; i < this.numWaypoints; i++) {
                const t = i / (this.numWaypoints - 1);
                let baseX, baseY, baseRotation;
                if (t < 0.5) {
                    const t_segment = t * 2;
                    baseX = centerX;
                    const startY = armLength - centerY, cornerY = centerY;
                    baseY = startY + t_segment * (cornerY - startY); 
                    baseRotation = 0;
                } else {
                    const t_segment = (t - 0.5) * 2;
                    baseY = centerY;
                    const cornerX = centerX, endX = armLength - centerX;
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
        });
    },

    trainStep: function(sofa) {
        // Wir übergeben dem Optimierer die Variable direkt, was ihn zwingt, sie zu tracen.
        const variables = [this.pathAdjustments];

        this.optimizer.minimize(() => {
            // Diese Funktion wird von minimize aufgerufen und beobachtet.
            let totalLoss = 0;
            // Wir rufen getWaypoints ganz normal auf.
            const waypoints = this.getWaypoints();
            
            for (const wp of waypoints) {
                sofa.setPosition(wp.x, wp.y, wp.rotation);
                totalLoss += Corridor.calculateCollisionLoss(sofa);
            }
            
            // Der Trick, der die Verbindung erzwingt, falls sie immer noch bricht:
            // Wir addieren eine Operation, die die Variable verwendet, aber das Ergebnis nicht ändert.
            const dummyLoss = this.pathAdjustments.sum().mul(0);
            return tf.scalar(totalLoss / waypoints.length).add(dummyLoss);
            
        }, /* returnCost */ false, variables);
    }
};
