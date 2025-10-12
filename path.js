/**
 * @file path.js
 * @description Implementiert den KI-Piloten, der lernt, einen Pfad zu finden.
 * Nutzt TensorFlow.js für das neuronale Netz und den Trainingsprozess.
 */

const Path = {
    // Das neuronale Netz-Modell von TensorFlow.js.
    model: null,
    // Der Optimierer, der die Gewichte des Modells anpasst.
    optimizer: null,
    // Anzahl der Wegpunkte, aus denen der Pfad besteht.
    numWaypoints: 15,
    // Die gelernten Anpassungen an den Basispfad.
    // Dies sind die "freien" Variablen, die das Modell optimiert.
    pathAdjustments: null,

    /**
     * Initialisiert das neuronale Netz und den Optimierer.
     * @param {number} learningRate - Die Lernrate für den Adam-Optimierer.
     */
    init: function(learningRate) {
        // VERMERK: tf.tidy() ist ein entscheidendes Speicherverwaltungswerkzeug in TensorFlow.js.
        // Alle Tensoren, die innerhalb dieser Funktion erstellt werden, werden automatisch
        // aus dem Speicher bereinigt, außer dem, der explizit zurückgegeben wird.
        // Hier stellen wir sicher, dass alte Modelle/Tensoren freigegeben werden, wenn wir neu initialisieren.
        tf.tidy(() => {
            // Das Modell ist bewusst einfach gehalten. Es nimmt einen konstanten Input (1)
            // und gibt eine Reihe von Werten aus, die als Pfadanpassungen interpretiert werden.
            // Die "Magie" passiert, weil wir die Gradienten nicht durch das Modell zurückpropagieren,
            // sondern direkt auf die 'pathAdjustments'-Variable anwenden.
            // Dieses Design macht 'pathAdjustments' zu den erlernbaren Gewichten.
            this.pathAdjustments = tf.variable(tf.randomNormal([this.numWaypoints, 3], 0, 0.01)); // [dx, dy, dRotation]
        });
        
        // Der Adam-Optimierer ist eine gute Allzweckwahl, die sich oft gut anpasst.
        this.optimizer = tf.train.adam(learningRate);
    },

    /**
     * Generiert die Sequenz der Wegpunkte für das Sofa.
     * @returns {Array<object>} Eine Liste von Wegpunkten, jeder mit {x, y, rotation}.
     */
    getWaypoints: function() {
        // HINWEIS: Das Modell lernt nicht den Pfad von Grund auf. Es lernt *Anpassungen*
        // zu einem einfachen, fest kodierten Basispfad. Dies macht das Lernproblem
        // viel einfacher und stabiler.
        const adjustments = this.pathAdjustments.arraySync(); // Hol die gelernten Werte als JS-Array
        const waypoints = [];
        
        for (let i = 0; i < this.numWaypoints; i++) {
            const t = i / (this.numWaypoints - 1); // Fortschritt von 0.0 bis 1.0

            // 1. Definiere den Basispfad: Ein einfacher Weg in die Ecke und dann nach unten.
            let baseX, baseY, baseRotation;
            if (t < 0.5) { // Erste Hälfte: Bewegung nach rechts
                const t_segment = t * 2;
                baseX = 0.5 + t_segment * (Corridor.armLength - 1.0);
                baseY = 0.5;
                baseRotation = 0; // Vertikal
            } else { // Zweite Hälfte: Bewegung nach unten
                const t_segment = (t - 0.5) * 2;
                baseX = Corridor.armLength - 0.5;
                baseY = 0.5 + t_segment * (Corridor.armLength - 1.0);
                baseRotation = Math.PI / 2; // Horizontal
            }

            // 2. Wende die gelernten Anpassungen des neuronalen Netzes an.
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
     * Führt einen einzelnen Trainingsschritt durch.
     * @param {object} sofa - Das zu testende Sofa-Objekt.
     */
    trainStep: function(sofa) {
        // VERMERK: optimizer.minimize() ist eine bequeme Funktion, die drei Dinge tut:
        // 1. Sie führt die übergebene Funktion (f) aus.
        // 2. Sie berechnet den Gradienten der Ausgabe von f (dem Verlust) in Bezug auf eine Liste von Variablen.
        // 3. Sie wendet diese Gradienten an, um die Variablen zu aktualisieren.
        this.optimizer.minimize(() => {
            // Diese anonyme Funktion berechnet den Gesamtverlust für den aktuellen Pfad.
            // Sie muss innerhalb von minimize() definiert sein, damit TF.js den "computation graph" verfolgen kann.
            let totalLoss = tf.scalar(0);
            const waypoints = this.getWaypoints();

            for (const wp of waypoints) {
                sofa.setPosition(wp.x, wp.y, wp.rotation);
                const loss = Corridor.calculateCollisionLoss(sofa);
                totalLoss = totalLoss.add(tf.scalar(loss));
            }
            
            // HINWEIS: Wir müssen den Verlust durch die Anzahl der Wegpunkte teilen,
            // um einen durchschnittlichen Verlust zu erhalten. Das verhindert, dass die Gradienten
            // explodieren, wenn wir die Anzahl der Wegpunkte ändern würden.
            return totalLoss.div(tf.scalar(this.numWaypoints));
        });
    }
};
