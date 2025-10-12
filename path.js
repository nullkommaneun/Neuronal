/**
 * @file path.js
 * @description Finale, physikalisch korrekte KI.
 * Der Pfad ist eine "unzerbrechliche Kette", die immer bei A startet.
 * Springen ist unmöglich.
 */
const Path = {
    optimizer: null,
    numWaypoints: 15,
    pathDeltas: null,

    init: function(learningRate) {
        if (this.pathDeltas) tf.dispose(this.pathDeltas);
        const initialDeltas = [];
        for (let i = 0; i < this.numWaypoints - 1; i++) {
            initialDeltas.push(0, -0.02, 0); // Starte mit kleinen, vorsichtigen Schritten
        }
        this.pathDeltas = tf.variable(tf.tensor(initialDeltas, [this.numWaypoints - 1, 3]));
        this.optimizer = tf.train.adam(learningRate);
    },

    getWaypoints: function() {
        return tf.tidy(() => {
            const deltas = this.pathDeltas.arraySync();
            const waypoints = [];
            const startPoint = { x: 0.5, y: Corridor.armLength - 0.5, rotation: 0 };
            waypoints.push(startPoint);
            let currentPoint = startPoint;
            for (let i = 0; i < this.numWaypoints - 1; i++) {
                const delta = deltas[i];
                const nextPoint = {
                    x: currentPoint.x + delta[0],
                    y: currentPoint.y + delta[1],
                    rotation: currentPoint.rotation + delta[2]
                };
                waypoints.push(nextPoint);
                currentPoint = nextPoint;
            }
            return waypoints;
        });
    },

    trainStep: function(sofa) {
        const variables = [this.pathDeltas];
        this.optimizer.minimize(() => {
            let totalCollisionLoss = 0;
            const waypoints = this.getWaypoints();
            for (const wp of waypoints) {
                sofa.setPosition(wp.x, wp.y, wp.rotation);
                totalCollisionLoss += Corridor.calculateCollisionLoss(sofa);
            }
            const collisionLossTensor = tf.scalar(totalCollisionLoss / waypoints.length);
            const lastWaypoint = waypoints[waypoints.length - 1];
            const goalPosition = { x: Corridor.armLength - 0.5, y: 0.5 };
            const dx = goalPosition.x - lastWaypoint.x;
            const dy = goalPosition.y - lastWaypoint.y;
            const distanceToGoal = tf.scalar(Math.sqrt(dx*dx + dy*dy));
            const COLLISION_WEIGHT = 5000.0;
            const GOAL_WEIGHT = 1.0;
            const finalLoss = collisionLossTensor.mul(COLLISION_WEIGHT).add(distanceToGoal.mul(GOAL_WEIGHT));
            const dummyLoss = this.pathDeltas.sum().mul(0);
            return finalLoss.add(dummyLoss);
        }, false, variables);
    }
};
