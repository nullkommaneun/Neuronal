import * as tf from '@tensorflow/tfjs';
export function hallMaskSoft(gridXY, width=1.0, soften=0.02){
  return tf.tidy(()=> {
    const x = gridXY.slice([0,0],[gridXY.shape[0],1]);
    const y = gridXY.slice([0,1],[gridXY.shape[0],1]);
    const inStripX = tf.lessEqual(tf.abs(y), width/2).logicalAnd(tf.lessEqual(x, tf.scalar(0)));
    const inStripY = tf.lessEqual(tf.abs(x), width/2).logicalAnd(tf.greaterEqual(y, tf.scalar(0)));
    const softX = tf.sigmoid(tf.mul(-1/soften,
      tf.maximum(tf.abs(y).sub(width/2), tf.minimum(x, tf.scalar(0)).neg())));
    const softY = tf.sigmoid(tf.mul(-1/soften,
      tf.maximum(tf.abs(x).sub(width/2), tf.minimum(y.neg(), tf.scalar(0)))));
    return tf.maximum(softX, softY).reshape([gridXY.shape[0],1]);
  });
}