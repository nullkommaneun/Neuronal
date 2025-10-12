/**
 * @file path.js
 * @description Finale, autonome KI mit "Karotte und Stock"-Belohnungssystem.
 * Die KI wird für die Nähe zum Ziel belohnt und für Kollisionen bestraft.
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
            const waypoints = this.getWaypoints();
            for (const wp of waypoints) {
                sofa.setPosition(wp.x, wp.y, wp.rotation);
                totalCollisionLoss += Corridor.calculateCollisionLoss(sofa);
            }
            const collisionLossTensor = tf.scalar(totalCollisionLoss / waypoints.length);

            // --- Teil 2: Die "Karotte" (Belohnung für Nähe zum Ziel) ---
            // Wir holen den letzten Wegpunkt direkt aus dem Tensor, um die Gradienten-Kette zu erhalten.
            const lastWaypoint = this.pathWaypoints.slice([this.numWaypoints - 1, 0], [1, 2]).squeeze(); // Nur x,y
            const goalPosition = tf.tensor1d([Corridor.armLength - 0.5, 0.5]); // Feste Koordinaten von Punkt B

            // Berechne die Distanz zum Ziel. Wir verwenden die Distanz selbst, nicht das Quadrat.
            const distanceToGoal = tf.sqrt(tf.sum(tf.square(goalPosition.sub(lastWaypoint))));

            // --- Teil 3: Kombiniere Stock und Karotte ---
            const COLLISION_WEIGHT = 20.0; // Der Stock ist 20x schmerzhafter als die Karotte süß ist.
            const GOAL_WEIGHT = 1.0;      // Die Karotte lockt die KI in die richtige Richtung.

            const finalLoss = collisionLossTensor.mul(COLLISION_WEIGHT).add(distanceToGoal.mul(GOAL_WEIGHT));
            
            // Der Trick, der die Verbindung für den Gradienten garantiert.
            const dummyLoss = this.pathWaypoints.sum().mul(0);
            return finalLoss.add(dummyLoss);
            
        }, /* returnCost */ false, variables);
    }
};
