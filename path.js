/**
 * @file path.js
 * @description Finale, stabile KI. Gradient Clipping verhindert "panische"
 * Sprünge und sorgt für einen stabilen, schrittweisen Lernprozess.
 */
const Path = {
    optimizer: null,
    numWaypoints: 15,
    pathDeltas: null,

    init: function(learningRate) {
        if (this.pathDeltas) tf.dispose(this.pathDeltas);
        const initialDeltas = [];
        for (let i = 0; i < this.numWaypoints - 1; i++) {
            initialDeltas.push(0, -0.2, 0);
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
        // Wir verwenden die explizite Gradienten-Berechnung, um Clipping anwenden zu können.
        const lossFunction = () => {
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

            const COLLISION_WEIGHT = 50.0;
            const GOAL_WEIGHT = 1.0;
            const finalLoss = collisionLossTensor.mul(COLLISION_WEIGHT).add(distanceToGoal.mul(GOAL_WEIGHT));
            
            const dummyLoss = this.pathDeltas.sum().mul(0);
            return finalLoss.add(dummyLoss);
        };

        // Schritt 1: Berechne die Gradienten (die "panische" Reaktion der KI)
        const grads = tf.grad(lossFunction)(this.pathDeltas);
        
        // NEU: DER "FAHRLEHRER" (GRADIENT CLIPPING)
        // Wir begrenzen die Stärke der Reaktion auf einen vernünftigen Maximalwert.
        // Das verhindert die Explosion.
        const clippedGrads = tf.clipByValue(grads, -0.1, 0.1);

        // Schritt 3: Wende die kontrollierte, "abgebremste" Reaktion an.
        this.optimizer.applyGradients({[this.pathDeltas.name]: clippedGrads});
    }
};
/**
 * @file path.js
 * @description Finale, physikalisch korrekte KI.
 * Der Pfad ist eine "unzerbrechliche Kette", die immer bei A startet.
 * Springen ist unmöglich.
 */
const Path = {
    optimizer: null,
    numWaypoints: 15,
    // GEÄNDERT: Speichert jetzt relative Bewegungen (dx, dy, dRotation) für jeden Schritt.
    pathDeltas: null,

    init: function(learningRate) {
        if (this.pathDeltas) tf.dispose(this.pathDeltas);
        
        // Die KI lernt 14 Bewegungen (da der erste Punkt fix ist).
        // Wir initialisieren sie mit kleinen Vorwärtsbewegungen als Starthilfe.
        const initialDeltas = [];
        for (let i = 0; i < this.numWaypoints - 1; i++) {
            // [dx, dy, dRotation]
            initialDeltas.push(0, -0.2, 0); // Starte mit kleinen Schritten nach oben
        }
        this.pathDeltas = tf.variable(tf.tensor(initialDeltas, [this.numWaypoints - 1, 3]));
        
        this.optimizer = tf.train.adam(learningRate);
    },

    /**
     * NEUE LOGIK: Baut den Pfad schrittweise auf.
     */
    getWaypoints: function() {
        return tf.tidy(() => {
            const deltas = this.pathDeltas.arraySync();
            const waypoints = [];

            // GESETZ 1: Der Start ist heilig.
            const startPoint = { x: 0.5, y: Corridor.armLength - 0.5, rotation: 0 };
            waypoints.push(startPoint);

            // GESETZ 2: Baue die Kette auf.
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
            
            // Die Verlustberechnung ist jetzt viel einfacher.
            // Die "Pfadlängen"-Strafe ist nicht mehr nötig, da Sprünge unmöglich sind.
            let totalCollisionLoss = 0;
            const waypoints = this.getWaypoints(); // Baut den Pfad basierend auf den Deltas
            
            for (const wp of waypoints) {
                sofa.setPosition(wp.x, wp.y, wp.rotation);
                totalCollisionLoss += Corridor.calculateCollisionLoss(sofa);
            }
            const collisionLossTensor = tf.scalar(totalCollisionLoss / waypoints.length);

            // Die "Karotte": Nähe des letzten Punktes zum Ziel.
            const lastWaypoint = waypoints[waypoints.length - 1];
            const goalPosition = { x: Corridor.armLength - 0.5, y: 0.5 };
            const dx = goalPosition.x - lastWaypoint.x;
            const dy = goalPosition.y - lastWaypoint.y;
            const distanceToGoal = tf.scalar(Math.sqrt(dx*dx + dy*dy));

            // Kombiniere Stock und Karotte
            const COLLISION_WEIGHT = 50.0; // Kollisionen sind EXTREM schlecht
            const GOAL_WEIGHT = 1.0;
            const finalLoss = collisionLossTensor.mul(COLLISION_WEIGHT).add(distanceToGoal.mul(GOAL_WEIGHT));
            
            // Dummy-Trick für die Gradienten-Verbindung
            const dummyLoss = this.pathDeltas.sum().mul(0);
            return finalLoss.add(dummyLoss);
            
        }, /* returnCost */ false, variables);
    }
};
