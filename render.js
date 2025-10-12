function marchingSquares(field, W, H, iso=0){
  const lines=[];
  const idx=(x,y)=> y*W + x;
  for(let y=0;y<H-1;y++){
    for(let x=0;x<W-1;x++){
      const v0=field[idx(x,y)]-iso;
      const v1=field[idx(x+1,y)]-iso;
      const v2=field[idx(x+1,y+1)]-iso;
      const v3=field[idx(x,y+1)]-iso;
      const caseId=((v0>0)<<0)|((v1>0)<<1)|((v2>0)<<2)|((v3>0)<<3);
      if(caseId===0||caseId===15) continue;
      const lerp=(a,b,va,vb)=> a + (0-va)/(vb-va)*(b-a);
      const x0=x, x1=x+1, y0=y, y1=y+1;
      const px = [lerp(x0,x1,v0,v1), x1, lerp(x0,x1,v3,v2), x0];
      const py = [y0, lerp(y0,y1,v1,v2), y1, lerp(y0,y1,v0,v3)];
      const table={
        1:[[3,0]],2:[[0,1]],3:[[3,1]],4:[[1,2]],5:[[3,0],[1,2]],6:[[0,2]],7:[[3,2]],
        8:[[2,3]],9:[[2,0]],10:[[0,1],[2,3]],11:[[1,3]],12:[[1,3]],13:[[0,2]],14:[[3,1]]
      };
      const segs=table[caseId]||[];
      for(const [a,b] of segs){ lines.push([[px[a],py[a]],[px[b],py[b]]]); }
    }
  }
  return lines;
}

export function drawFrame(ctx, {W,H,cw,ch, meters, fGridData, hallMaskData}){
  ctx.clearRect(0,0,cw,ch);
  ctx.fillStyle = '#0b0f14'; ctx.fillRect(0,0,cw,ch);

  const scaleX = cw/W, scaleY = ch/H;

  // Corridor outline (exact mapping): 1m Breite → H entspricht ~ (2/3)*W für Sichtfeld meters x (2/3*meters)
  // Wir zeichnen L-Form proportional zum sichtbaren Metermaß: je 1m Band.
  ctx.save();
  ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2;
  // Horizontaler Arm: Mitte vertikal
  const bandH = (1.0 / (meters/ (H))) * scaleY; // pixelhöhe für 1m (näherungsweise)
  const midY = ch/2;
  ctx.strokeRect(0, midY - bandH/2, cw/2, bandH);
  // Vertikaler Arm: Mitte horizontal
  const bandW = (1.0 / (meters/ (W))) * scaleX;
  const midX = cw/2;
  ctx.strokeRect(midX - bandW/2, midY, bandW, ch/2);
  ctx.restore();

  // Contour
  const lines = marchingSquares(fGridData, W, H, 0);
  ctx.save();
  ctx.strokeStyle = '#10b981'; ctx.lineWidth = 2.0; ctx.beginPath();
  for(const [[x0,y0],[x1,y1]] of lines){
    ctx.moveTo(x0*scaleX, y0*scaleY);
    ctx.lineTo(x1*scaleX, y1*scaleY);
  }
  ctx.stroke(); ctx.restore();

  // Collision tint
  let collisions = 0, insideCount=0;
  for(let i=0;i<fGridData.length;i++){
    const inside = fGridData[i] >= 0;
    if(inside){ insideCount++; if(hallMaskData[i] < 0.5) collisions++; }
  }
  const ratio = insideCount>0 ? collisions/insideCount : 0;
  if(ratio>0){ ctx.save(); ctx.fillStyle = 'rgba(239,68,68,0.18)'; ctx.fillRect(0,0,cw,ch); ctx.restore(); }
  ctx.save(); ctx.fillStyle = '#cbd5e1'; ctx.font = '12px ui-monospace, monospace'; ctx.fillText(`Collision ratio: ${(ratio*100).toFixed(1)}%`, 12, 18); ctx.restore();
}