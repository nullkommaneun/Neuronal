// corridor.js

// Wir definieren ein globales Objekt, damit es einfach in anderen Skripten gefunden werden kann.
const Corridor = {
    // Eigenschaften des Korridors
    width: 1.0,

    /**
     * Berechnet den Kollisionsverlust für eine gegebene Form an einer bestimmten Position.
     * @param {tf.Tensor} points - Ein Tensor von 2D-Punkten, die die Form repräsentieren.
     * @param {tf.Tensor} shapeOutput - Ein Tensor, der angibt, wie "sehr" jeder Punkt zur Form gehört.
     * @returns {tf.Tensor} - Ein Skalar-Tensor, der den gewichteten Kollisionsverlust darstellt.
     */
    calculateCollision: (points, shapeOutput) => {
        // Diese Funktion wird innerhalb eines tf.tidy() aufgerufen, daher müssen wir hier keine Tensoren manuell freigeben.
        const x = points.slice([0, 0], [-1, 1]);
        const y = points.slice([0, 1], [-1, 1]);
        const halfWidth = Corridor.width / 2;

        // Wand 1: Obere Wand im linken Teil (y > halfWidth, wenn x < 0)
        const wall1 = tf.relu(y.sub(halfWidth).mul(tf.cast(x.less(0), 'float32')));
        // Wand 2: Untere Wand im linken Teil (y < -halfWidth, wenn x < 0)
        const wall2 = tf.relu(y.neg().sub(halfWidth).mul(tf.cast(x.less(0), 'float32')));
        
        // Wand 3: Rechte Wand im unteren Teil (x > halfWidth, wenn y < 0)
        const wall3 = tf.relu(x.sub(halfWidth).mul(tf.cast(y.less(0), 'float32')));
        // Wand 4: Linke Wand im unteren Teil (x < -halfWidth, wenn y < 0)
        const wall4 = tf.relu(x.neg().sub(halfWidth).mul(tf.cast(y.less(0), 'float32')));

        // Addiere alle potenziellen Kollisionen und gewichte sie mit der "Masse" des Sofas an diesem Punkt.
        const totalCollision = wall1.add(wall2).add(wall3).add(wall4);
        return tf.sum(totalCollision.mul(shapeOutput));
    }
};
