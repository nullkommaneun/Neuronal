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

  // Corridor outline (1 m L-Form)
  ctx.save();
  ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2;
  const bandHPx = (1.0 / (meters/(H))) * scaleY;
  const bandWPx = (1.0 / (meters/(W))) * scaleX;
  const midY = ch/2, midX = cw/2;
  ctx.strokeRect(0, midY - bandHPx/2, cw/2, bandHPx);
  ctx.strokeRect(midX - bandWPx/2, midY, bandWPx, ch/2);
  ctx.restore();

  // Filled interior: draw an offscreen image W×H with alpha for inside pixels
  const img = ctx.createImageData(W, H);
  for(let i=0;i<fGridData.length;i++){
    const inside = fGridData[i] >= 0;
    if(!inside) continue;
    const o = i*4;
    img.data[o+0] = 16;   // R
    img.data[o+1] = 185;  // G (grünlich)
    img.data[o+2] = 129;  // B
    img.data[o+3] = 50;   // Alpha ~ 0.2
  }
  // Draw scaled
  const off = document.createElement('canvas'); off.width=W; off.height=H;
  const octx = off.getContext('2d'); octx.putImageData(img,0,0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(off, 0, 0, cw, ch);

  // Contour
  const lines = marchingSquares(fGridData, W, H, 0);
  ctx.save();
  ctx.strokeStyle = '#22d3ee'; // kräftiger
  ctx.lineWidth = 4.0;
  ctx.beginPath();
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

  // HUD
  ctx.save(); ctx.fillStyle = '#cbd5e1'; ctx.font = '12px ui-monospace, monospace';
  ctx.fillText(`Collision ratio: ${(ratio*100).toFixed(1)}%`, 12, 18); ctx.restore();
}