/**
 * @file path.js
 * @description Finale, autonome KI. Eine neue "Pfadlängen"-Strafe
 * zwingt die KI zu einem echten, zusammenhängenden Pfad.
 */
const Path = {
    optimizer: null,
    numWaypoints: 15,
    pathWaypoints: null,

    init: function(learningRate) {
        if (this.pathWaypoints) tf.dispose(this.pathWaypoints);
        
        const initialPath = [];
        for (let i = 0; i < this.numWaypoints; i++) {
            const t = i / (this.numWaypoints - 1);
            const x = 0.5;
            const y = (Corridor.armLength - 0.5) - t * (Corridor.armLength - 1.0);
            const rotation = 0;
            initialPath.push(x, y, rotation);
        }
        this.pathWaypoints = tf.variable(tf.tensor(initialPath, [this.numWaypoints, 3]));
        this.optimizer = tf.train.adam(learningRate);
    },

    getWaypoints: function() {
        return tf.tidy(() => {
            const waypointsData = this.pathWaypoints.arraySync();
            return waypointsData.map(wp => ({ x: wp[0], y: wp[1], rotation: wp[2] }));
        });
    },

    trainStep: function(sofa) {
        const variables = [this.pathWaypoints];
        this.optimizer.minimize(() => {
            
            // --- Teil 1: Der "Stock" (Bestrafung für Kollisionen) ---
            let totalCollisionLoss = 0;
            const waypoints = this.getWaypoints(); // Brauchen wir für die JS-Physik
            for (const wp of waypoints) {
                sofa.setPosition(wp.x, wp.y, wp.rotation);
                totalCollisionLoss += Corridor.calculateCollisionLoss(sofa);
            }
            const collisionLossTensor = tf.scalar(totalCollisionLoss / waypoints.length);

            // --- Teil 2: Die "Karotte" (Belohnung für Nähe zum Ziel) ---
            const lastWaypoint = this.pathWaypoints.slice([this.numWaypoints - 1, 0], [1, 2]).squeeze();
            const goalPosition = tf.tensor1d([Corridor.armLength - 0.5, 0.5]);
            const distanceToGoal = tf.sqrt(tf.sum(tf.square(goalPosition.sub(lastWaypoint))));

            // --- NEU - Teil 3: Die "Kette" (Bestrafung für Sprünge/Faulheit) ---
            let pathLengthLoss = tf.scalar(0);
            for (let i = 0; i < this.numWaypoints - 1; i++) {
                const p1 = this.pathWaypoints.slice([i, 0], [1, 2]).squeeze();
                const p2 = this.pathWaypoints.slice([i + 1, 0], [1, 2]).squeeze();
                // Addiere die Distanz zwischen jedem Punktpaar zum Verlust
                pathLengthLoss = pathLengthLoss.add(tf.sqrt(tf.sum(tf.square(p2.sub(p1)))));
            }

            // --- Teil 4: Kombiniere alle drei Faktoren ---
            const COLLISION_WEIGHT = 20.0;  // Kollisionen sind sehr schlecht
            const GOAL_WEIGHT = 1.0;       // Das Ziel ist wichtig
            const PATH_LENGTH_WEIGHT = 0.5; // Faulheit ist moderat schlecht

            const finalLoss = collisionLossTensor.mul(COLLISION_WEIGHT)
                              .add(distanceToGoal.mul(GOAL_WEIGHT))
                              .add(pathLengthLoss.mul(PATH_LENGTH_WEIGHT));
            
            const dummyLoss = this.pathWaypoints.sum().mul(0);
            return finalLoss.add(dummyLoss);
            
        }, /* returnCost */ false, variables);
    }
};
