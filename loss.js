const tf = window.tf;
import {softInside} from './shape.js';
export function lossBatch({fGrid, area, hallMask, tPoints, tau, wA,wC,wR,wP, smoothPenalty}){
  return tf.tidy(()=> {
    let coll = tf.scalar(0);
    for(const TP of tPoints){
      const inside = softInside(TP.fBody, tau);
      const outside = tf.scalar(1).sub(hallMask);
      coll = coll.add( inside.mul(outside).mean() );
    }
    const L = coll.mul(wC).add(smoothPenalty.mul(wR)).add(area.neg().mul(wA));
    return {L, coll};
  });
}