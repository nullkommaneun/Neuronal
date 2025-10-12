// corridor.js
const Corridor = {
    width: 1.0,
    calculateCollision: (points, shapeOutput) => {
        const x = points.slice([0, 0], [-1, 1]);
        const y = points.slice([0, 1], [-1, 1]);
        const halfWidth = Corridor.width / 2;
        const wall1 = tf.relu(y.sub(halfWidth).mul(tf.cast(x.less(0), 'float32')));
        const wall2 = tf.relu(y.neg().sub(halfWidth).mul(tf.cast(x.less(0), 'float32')));
        const wall3 = tf.relu(x.sub(halfWidth).mul(tf.cast(y.less(0), 'float32')));
        const wall4 = tf.relu(x.neg().sub(halfWidth).mul(tf.cast(y.less(0), 'float32')));
        const totalCollision = wall1.add(wall2).add(wall3).add(wall4);
        return tf.sum(totalCollision.mul(shapeOutput));
    }
};
