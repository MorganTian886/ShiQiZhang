import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'

const PADDING = 24
const HANDLE_R = 7
const ROT_OFFSET = 30

// ─── 工具函数 ───
function hexPoints(cx, cy, rx, ry, rot = -Math.PI / 6) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i + rot
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]
  })
}
function tracePath(ctx, pts) {
  ctx.beginPath()
  pts.forEach(([x,y],i) => i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y))
  ctx.closePath()
}
function drawRing(ctx, cx, cy, oRx, oRy, iRx, iRy, rot, color) {
  ctx.save(); ctx.fillStyle = color; ctx.beginPath()
  hexPoints(cx,cy,oRx,oRy,rot).forEach(([x,y],i)=>i===0?ctx.moveTo(x,y):ctx.lineTo(x,y)); ctx.closePath()
  hexPoints(cx,cy,iRx,iRy,rot).slice().reverse().forEach(([x,y],i)=>i===0?ctx.moveTo(x,y):ctx.lineTo(x,y)); ctx.closePath()
  ctx.fill('evenodd'); ctx.restore()
}
function safeR(v) { return Math.max(2, v||2) }
function mulberry32(seed) {
  let a=seed; return ()=>{ a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296 }
}
function hexToRgb(h){
  try{return[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]}
  catch{return[128,128,128]}
}
function hexToRgba(h,a){try{const[r,g,b]=hexToRgb(h);return`rgba(${r},${g},${b},${a})`}catch{return`rgba(128,128,128,${a})`}}
function blendHex(c1,c2,t){try{const[r1,g1,b1]=hexToRgb(c1),[r2,g2,b2]=hexToRgb(c2);return`rgb(${Math.round(r1+(r2-r1)*t)},${Math.round(g1+(g2-g1)*t)},${Math.round(b1+(b2-b1)*t)})`}catch{return c1}}
function getRxRy(hexW,hexH){return{rx:safeR(hexW/Math.sqrt(3)),ry:safeR(hexH/2)}}

function canvasPt(e, canvas) {
  const rect = canvas.getBoundingClientRect()
  return {
    x: (e.clientX - rect.left) * (canvas.width  / rect.width),
    y: (e.clientY - rect.top)  * (canvas.height / rect.height),
  }
}

// 通用：获取图层控制手柄（文字和装饰共用）
function getHandles(layer, defaultX, defaultY) {
  const x   = layer.shapeX ?? layer.textX ?? defaultX
  const y   = layer.shapeY ?? layer.textY ?? defaultY
  const w   = layer.shapeW ?? layer.textW ?? 200
  const h   = layer.shapeH ?? layer.textH ?? 200
  const rot = layer.shapeRot ?? layer.textRot ?? 0
  const hw=w/2, hh=h/2
  const cos=Math.cos(rot), sin=Math.sin(rot)
  const rotate=([lx,ly])=>[x+lx*cos-ly*sin, y+lx*sin+ly*cos]
  const handles=[[-hw,-hh],[0,-hh],[hw,-hh],[hw,0],[hw,hh],[0,hh],[-hw,hh],[-hw,0]].map(rotate)
  const rotHandle = rotate([0,-hh-ROT_OFFSET])
  return { handles, rotHandle, x, y, w, h, rot }
}

function hitHandle(pt, handles, rotHandle) {
  for(let i=0;i<handles.length;i++){
    const[hx,hy]=handles[i]
    if(Math.hypot(pt.x-hx,pt.y-hy)<HANDLE_R+5) return{type:'scale',idx:i}
  }
  if(Math.hypot(pt.x-rotHandle[0],pt.y-rotHandle[1])<HANDLE_R+6) return{type:'rotate'}
  return null
}

function ptInBox(pt, layer, defaultX, defaultY) {
  const x=layer.shapeX??layer.textX??defaultX, y=layer.shapeY??layer.textY??defaultY
  const w=layer.shapeW??layer.textW??200, h=layer.shapeH??layer.textH??200
  const rot=layer.shapeRot??layer.textRot??0
  const cos=Math.cos(-rot),sin=Math.sin(-rot)
  const dx=pt.x-x, dy=pt.y-y
  const lx=dx*cos-dy*sin, ly=dx*sin+dy*cos
  return Math.abs(lx)<=w/2+6 && Math.abs(ly)<=h/2+6
}

// ─── 绘制几何图形 ───
function drawShape(ctx, layer, isSelected, defaultX=0, defaultY=0) {
  const x   = layer.shapeX ?? defaultX
  const y   = layer.shapeY ?? defaultY
  const w   = layer.shapeW ?? 200
  const h   = layer.shapeH ?? 200
  const rot = layer.shapeRot ?? 0
  const fill    = layer.shapeFill ?? '#c8a96e'
  const stroke  = layer.shapeStroke ?? 'transparent'
  const lw      = layer.shapeLineW ?? 2
  const filled  = layer.shapeFilled !== false

  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.globalAlpha = layer.opacity ?? 1

  const hw=w/2, hh=h/2

  // 图片类型单独处理
  if (layer.decorType === 'image' && layer.image) {
    const img = layer.image
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      const sc = Math.min(w / img.naturalWidth, h / img.naturalHeight)
      const iw = img.naturalWidth * sc, ih = img.naturalHeight * sc
      const ix = -iw / 2, iy = -ih / 2

      if (layer.iconColor && layer.iconColor !== 'original') {
        // 用 offscreen canvas 把图标染色（source-in 保留透明度轮廓+填色）
        const off = document.createElement('canvas')
        off.width = Math.ceil(iw); off.height = Math.ceil(ih)
        const oc = off.getContext('2d')
        // 先画原图
        oc.drawImage(img, 0, 0, iw, ih)
        // source-in：只保留有像素的地方，填成目标色
        oc.globalCompositeOperation = 'source-in'
        oc.fillStyle = layer.iconColor
        oc.globalAlpha = layer.iconColorOpacity ?? 1
        oc.fillRect(0, 0, iw, ih)
        ctx.drawImage(off, ix, iy, iw, ih)
      } else {
        // 原色直接画
        ctx.drawImage(img, ix, iy, iw, ih)
      }
    }
    if (isSelected) {
      ctx.strokeStyle='rgba(100,180,255,0.9)';ctx.lineWidth=2;ctx.setLineDash([5,4])
      ctx.strokeRect(-hw,-hh,w,h);ctx.setLineDash([])
      ctx.strokeStyle='rgba(100,180,255,0.6)';ctx.lineWidth=1.5
      ctx.beginPath();ctx.moveTo(0,-hh);ctx.lineTo(0,-hh-ROT_OFFSET);ctx.stroke()
      const dH=(lx,ly,isR)=>{ctx.beginPath();ctx.arc(lx,ly,HANDLE_R,0,Math.PI*2);ctx.fillStyle=isR?'#ffd700':'white';ctx.fill();ctx.strokeStyle=isR?'#c8a000':'rgba(100,180,255,0.9)';ctx.lineWidth=2;ctx.stroke()}
      ;[[-hw,-hh],[0,-hh],[hw,-hh],[hw,0],[hw,hh],[0,hh],[-hw,hh],[-hw,0]].forEach(([lx,ly])=>dH(lx,ly,false))
      dH(0,-hh-ROT_OFFSET,true)
    }
    ctx.restore()
    return
  }

  ctx.beginPath()
  switch(layer.decorType) {
    case 'rect':
      ctx.rect(-hw,-hh,w,h); break
    case 'round_rect':
      { const r=Math.min(hw,hh)*0.2
        ctx.moveTo(-hw+r,-hh); ctx.lineTo(hw-r,-hh)
        ctx.arcTo(hw,-hh,hw,-hh+r,r); ctx.lineTo(hw,hh-r)
        ctx.arcTo(hw,hh,hw-r,hh,r); ctx.lineTo(-hw+r,hh)
        ctx.arcTo(-hw,hh,-hw,hh-r,r); ctx.lineTo(-hw,-hh+r)
        ctx.arcTo(-hw,-hh,-hw+r,-hh,r); ctx.closePath()
      } break
    case 'circle':
      ctx.ellipse(0,0,hw,hh,0,0,Math.PI*2); break
    case 'triangle':
      ctx.moveTo(0,-hh); ctx.lineTo(hw,hh); ctx.lineTo(-hw,hh); ctx.closePath(); break
    case 'diamond':
      ctx.moveTo(0,-hh); ctx.lineTo(hw,0); ctx.lineTo(0,hh); ctx.lineTo(-hw,0); ctx.closePath(); break
    case 'hexagon':
      for(let i=0;i<6;i++){const a=(Math.PI/3)*i-Math.PI/6;i===0?ctx.moveTo(hw*Math.cos(a),hh*Math.sin(a)):ctx.lineTo(hw*Math.cos(a),hh*Math.sin(a))}
      ctx.closePath(); break
    case 'star5':
      { const or=Math.min(hw,hh), ir=or*0.42
        for(let i=0;i<10;i++){const a=Math.PI/5*i-Math.PI/2,r=i%2===0?or:ir;i===0?ctx.moveTo(r*Math.cos(a),r*Math.sin(a)):ctx.lineTo(r*Math.cos(a),r*Math.sin(a))}
        ctx.closePath()
      } break
    case 'star6':
      { const or=Math.min(hw,hh), ir=or*0.5
        for(let i=0;i<12;i++){const a=Math.PI/6*i-Math.PI/2,r=i%2===0?or:ir;i===0?ctx.moveTo(r*Math.cos(a),r*Math.sin(a)):ctx.lineTo(r*Math.cos(a),r*Math.sin(a))}
        ctx.closePath()
      } break
    case 'cross':
      { const t=Math.min(hw,hh)*0.35
        ctx.moveTo(-t,-hh);ctx.lineTo(t,-hh);ctx.lineTo(t,-t);ctx.lineTo(hw,-t);ctx.lineTo(hw,t)
        ctx.lineTo(t,t);ctx.lineTo(t,hh);ctx.lineTo(-t,hh);ctx.lineTo(-t,t);ctx.lineTo(-hw,t)
        ctx.lineTo(-hw,-t);ctx.lineTo(-t,-t);ctx.closePath()
      } break
    case 'arrow':
      { const aw=hw*0.5
        ctx.moveTo(-hw,hh*0.35);ctx.lineTo(-hw,-hh*0.35);ctx.lineTo(aw*0.5,-hh*0.35)
        ctx.lineTo(aw*0.5,-hh);ctx.lineTo(hw,0);ctx.lineTo(aw*0.5,hh)
        ctx.lineTo(aw*0.5,hh*0.35);ctx.closePath()
      } break
    case 'line':
      ctx.moveTo(-hw,0); ctx.lineTo(hw,0); break
    case 'shield':
      ctx.moveTo(0,-hh); ctx.lineTo(hw,-hh*0.5); ctx.lineTo(hw,hh*0.1)
      ctx.quadraticCurveTo(hw,hh,0,hh*1.0); ctx.quadraticCurveTo(-hw,hh,-hw,hh*0.1)
      ctx.lineTo(-hw,-hh*0.5); ctx.closePath(); break
    case 'moon':
      ctx.arc(0,0,Math.min(hw,hh),Math.PI*0.4,Math.PI*1.6)
      ctx.arc(-Math.min(hw,hh)*0.3,0,Math.min(hw,hh)*0.8,Math.PI*1.6,Math.PI*0.4,true)
      ctx.closePath(); break
    default:
      ctx.ellipse(0,0,hw,hh,0,0,Math.PI*2); break
  }

  if(layer.decorType==='line'){
    ctx.strokeStyle=fill; ctx.lineWidth=lw*2||4; ctx.stroke()
  } else {
    if(filled){ ctx.fillStyle=fill; ctx.fill() }
    if(stroke!=='transparent'){ ctx.strokeStyle=stroke; ctx.lineWidth=lw; ctx.stroke() }
    if(!filled){ ctx.strokeStyle=fill; ctx.lineWidth=lw||3; ctx.stroke() }
  }

  // 选中控制框
  if(isSelected){
    ctx.strokeStyle='rgba(100,180,255,0.9)'; ctx.lineWidth=2; ctx.setLineDash([5,4])
    ctx.strokeRect(-hw,-hh,w,h); ctx.setLineDash([])
    ctx.strokeStyle='rgba(100,180,255,0.6)'; ctx.lineWidth=1.5
    ctx.beginPath(); ctx.moveTo(0,-hh); ctx.lineTo(0,-hh-ROT_OFFSET); ctx.stroke()
    const drawH=(lx,ly,isRot)=>{
      ctx.beginPath(); ctx.arc(lx,ly,HANDLE_R,0,Math.PI*2)
      ctx.fillStyle=isRot?'#ffd700':'white'; ctx.fill()
      ctx.strokeStyle=isRot?'#c8a000':'rgba(100,180,255,0.9)'; ctx.lineWidth=2; ctx.stroke()
    }
    ;[[-hw,-hh],[0,-hh],[hw,-hh],[hw,0],[hw,hh],[0,hh],[-hw,hh],[-hw,0]].forEach(([lx,ly])=>drawH(lx,ly,false))
    drawH(0,-hh-ROT_OFFSET,true)
  }
  ctx.restore()
}

const BadgeCanvas = forwardRef(function BadgeCanvas({ config, layers, selectedId, onLayerChange }, ref) {
  const canvasRef = useRef(null)
  const hexW = config.hexW ?? 1228
  const hexH = config.hexH ?? 1417
  const { rx: baseRx, ry: baseRy } = getRxRy(hexW, hexH)
  const CW = Math.round(hexW + PADDING * 2)
  const CH = Math.round(hexH + PADDING * 2)
  const cx = CW / 2, cy = CH / 2
  const hexRot = -Math.PI / 6

  const previewMax = 460
  const previewScale = Math.min(previewMax/CW, previewMax/CH)

  const drag = useRef(null)

  useImperativeHandle(ref, () => ({
    exportPNG: () => {
      const canvas = canvasRef.current
      if (!canvas) return null
      // 临时重绘，不显示控制框
      drawForExport()
      const dataUrl = canvas.toDataURL('image/png')
      // 恢复正常显示
      draw()
      return dataUrl
    }
  }))

  const drawForExport = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = CW; canvas.height = CH
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0,0,CW,CH)
    const outerW=safeR(config.outerBorderWidth??30),gapW=safeR(config.gapWidth??24),innerW=safeR(config.innerBorderWidth??12),innerLineW=Math.max(0,config.innerLineWidth??3)
    const R0={rx:baseRx,ry:baseRy},R1={rx:safeR(R0.rx-outerW),ry:safeR(R0.ry-outerW)},R2={rx:safeR(R1.rx-gapW),ry:safeR(R1.ry-gapW)},R3={rx:safeR(R2.rx-innerW),ry:safeR(R2.ry-innerW)},R4={rx:safeR(R3.rx-innerLineW*2),ry:safeR(R3.ry-innerLineW*2)}
    const sorted=[...(layers||[])].sort((a,b)=>a.zIndex-b.zIndex)
    // 按zIndex统一渲染（背景/装饰/人物/文字混合，边框固定盖在上方）
    for(const l of sorted){
      if(!l.visible) continue
      if(l.type==='background'){
        ctx.save();tracePath(ctx,hexPoints(cx,cy,R3.rx,R3.ry,hexRot));ctx.clip()
        drawBg(ctx,cx,cy,CW,CH,R3,hexRot,l);ctx.restore()
      }
      if(l.type==='decoration'){
        ctx.save();tracePath(ctx,hexPoints(cx,cy,R3.rx,R3.ry,hexRot));ctx.clip()
        drawShape(ctx,l,false,cx,cy);ctx.restore()
      }
      if(l.type==='character'){
        ctx.save();tracePath(ctx,hexPoints(cx,cy,R0.rx,R0.ry,hexRot));ctx.clip()
        drawCharacter(ctx,cx,cy,R3,l);ctx.restore()
      }
      if(l.type==='text'){
        ctx.save();tracePath(ctx,hexPoints(cx,cy,R0.rx,R0.ry,hexRot));ctx.clip()
        drawTextLayer(ctx,l);ctx.restore()
      }
    }
    // 边框
    drawRing(ctx,cx,cy,R0.rx,R0.ry,R1.rx,R1.ry,hexRot,config.outerBorderColor??'#1a1628')
    drawRing(ctx,cx,cy,R1.rx,R1.ry,R2.rx,R2.ry,hexRot,config.gapColor??'#e8e0d0')
    ctx.save();ctx.beginPath()
    hexPoints(cx,cy,R2.rx,R2.ry,hexRot).forEach(([x,y],i)=>i===0?ctx.moveTo(x,y):ctx.lineTo(x,y));ctx.closePath()
    hexPoints(cx,cy,R3.rx,R3.ry,hexRot).slice().reverse().forEach(([x,y],i)=>i===0?ctx.moveTo(x,y):ctx.lineTo(x,y));ctx.closePath()
    const ic1=config.innerBorderColor1??'#f5e090',ic2=config.innerBorderColor2??'#9a7235'
    if(config.innerBorderSolid){ctx.fillStyle=ic1}else{const g=ctx.createLinearGradient(cx-R2.rx,cy-R2.ry,cx+R2.rx,cy+R2.ry);g.addColorStop(0,ic1);g.addColorStop(.4,ic2);g.addColorStop(1,ic1);ctx.fillStyle=g}
    ctx.fill('evenodd');ctx.restore()
    if(innerLineW>0&&R4.rx>4){ctx.save();tracePath(ctx,hexPoints(cx,cy,R4.rx,R4.ry,hexRot));ctx.strokeStyle=config.innerLineColor??'rgba(200,169,110,0.5)';ctx.lineWidth=innerLineW;ctx.stroke();ctx.restore()}
  }, [config, layers, CW, CH, cx, cy, baseRx, baseRy])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = CW; canvas.height = CH
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0,0,CW,CH)

    const outerW=safeR(config.outerBorderWidth??30)
    const gapW=safeR(config.gapWidth??24)
    const innerW=safeR(config.innerBorderWidth??12)
    const innerLineW=Math.max(0,config.innerLineWidth??3)

    const R0={rx:baseRx,ry:baseRy}
    const R1={rx:safeR(R0.rx-outerW),ry:safeR(R0.ry-outerW)}
    const R2={rx:safeR(R1.rx-gapW),ry:safeR(R1.ry-gapW)}
    const R3={rx:safeR(R2.rx-innerW),ry:safeR(R2.ry-innerW)}
    const R4={rx:safeR(R3.rx-innerLineW*2),ry:safeR(R3.ry-innerLineW*2)}

    const sorted=[...(layers||[])].sort((a,b)=>a.zIndex-b.zIndex)

    // 按zIndex统一渲染（背景/装饰/人物/文字混合，边框固定盖在上方）
    for(const l of sorted){
      if(!l.visible) continue
      if(l.type==='background'){
        ctx.save();tracePath(ctx,hexPoints(cx,cy,R3.rx,R3.ry,hexRot));ctx.clip()
        drawBg(ctx,cx,cy,CW,CH,R3,hexRot,l);ctx.restore()
      }
      if(l.type==='decoration'){
        ctx.save();tracePath(ctx,hexPoints(cx,cy,R3.rx,R3.ry,hexRot));ctx.clip()
        drawShape(ctx,l,false,cx,cy);ctx.restore()
      }
      if(l.type==='character'){
        ctx.save();tracePath(ctx,hexPoints(cx,cy,R0.rx,R0.ry,hexRot));ctx.clip()
        drawCharacter(ctx,cx,cy,R3,l);ctx.restore()
      }
      if(l.type==='text'){
        ctx.save();tracePath(ctx,hexPoints(cx,cy,R0.rx,R0.ry,hexRot));ctx.clip()
        drawTextLayer(ctx,l);ctx.restore()
      }
    }
    // 选中框（始终在所有内容+边框之上）
    const selLayer=sorted.find(l=>l.id===selectedId&&l.type==='text')
    if(selLayer) drawSelectionBox(ctx,selLayer)
    // 装饰选中框
    const selDecor=sorted.find(l=>l.id===selectedId&&l.type==='decoration')
    if(selDecor) drawShape(ctx,selDecor,true,cx,cy)
    // 边框（固定盖在内容上方）
    drawRing(ctx,cx,cy,R0.rx,R0.ry,R1.rx,R1.ry,hexRot,config.outerBorderColor??'#1a1628')
    drawRing(ctx,cx,cy,R1.rx,R1.ry,R2.rx,R2.ry,hexRot,config.gapColor??'#e8e0d0')
    ctx.save(); ctx.beginPath()
    hexPoints(cx,cy,R2.rx,R2.ry,hexRot).forEach(([x,y],i)=>i===0?ctx.moveTo(x,y):ctx.lineTo(x,y)); ctx.closePath()
    hexPoints(cx,cy,R3.rx,R3.ry,hexRot).slice().reverse().forEach(([x,y],i)=>i===0?ctx.moveTo(x,y):ctx.lineTo(x,y)); ctx.closePath()
    const ic1=config.innerBorderColor1??'#f5e090',ic2=config.innerBorderColor2??'#9a7235'
    if(config.innerBorderSolid){ctx.fillStyle=ic1}else{
      const g=ctx.createLinearGradient(cx-R2.rx,cy-R2.ry,cx+R2.rx,cy+R2.ry)
      g.addColorStop(0,ic1);g.addColorStop(.4,ic2);g.addColorStop(1,ic1);ctx.fillStyle=g
    }
    ctx.fill('evenodd'); ctx.restore()
    if(innerLineW>0&&R4.rx>4){
      ctx.save();tracePath(ctx,hexPoints(cx,cy,R4.rx,R4.ry,hexRot))
      ctx.strokeStyle=config.innerLineColor??'rgba(200,169,110,0.5)';ctx.lineWidth=innerLineW;ctx.stroke();ctx.restore()
    }

  }, [config, layers, selectedId, CW, CH, cx, cy, baseRx, baseRy])

  // ─── 背景 ───
  function drawBg(ctx,cx,cy,cw,ch,R,rot,layer){
    ctx.save();ctx.globalAlpha=layer.opacity??1
    const c1=layer.color1??'#1a1a2e',c2=layer.color2??'#0a0818',c3=layer.color3??null
    const angle=((layer.gradientAngle??135)*Math.PI)/180
    const rx=safeR(R.rx),ry=safeR(R.ry)
    const fill=(s)=>{ctx.fillStyle=s;ctx.fillRect(0,0,cw,ch)}
    switch(layer.bgType??'solid'){
      case 'solid':fill(c1);break
      case 'linear':case 'linear_diagonal':case 'linear_h':case 'linear_v':{
        const a=layer.bgType==='linear_h'?0:layer.bgType==='linear_v'?Math.PI/2:angle
        const g=ctx.createLinearGradient(cx-Math.cos(a)*rx,cy-Math.sin(a)*ry,cx+Math.cos(a)*rx,cy+Math.sin(a)*ry)
        c3?(g.addColorStop(0,c1),g.addColorStop(.5,c3),g.addColorStop(1,c2)):(g.addColorStop(0,c1),g.addColorStop(1,c2));fill(g);break}
      case 'linear_hard':{const sp=layer.hardSplit??0.5;const g=ctx.createLinearGradient(cx,cy-ry,cx,cy+ry);g.addColorStop(0,c1);g.addColorStop(Math.max(0,sp-.001),c1);g.addColorStop(Math.min(1,sp),c2);g.addColorStop(1,c2);fill(g);break}
      case 'radial':{const g=ctx.createRadialGradient(cx,cy,0,cx,cy,safeR(Math.max(rx,ry)));g.addColorStop(0,c1);g.addColorStop(1,c2);fill(g);break}
      case 'radial_offcenter':{const ox=(layer.radialOX??0)*rx/100,oy=(layer.radialOY??-40)*ry/100;const g=ctx.createRadialGradient(cx+ox,cy+oy,0,cx,cy,safeR(Math.max(rx,ry)*1.2));g.addColorStop(0,c1);g.addColorStop(1,c2);fill(g);break}
      case 'radial_hex':fill(c2);for(let i=12;i>=0;i--){const t=i/12;tracePath(ctx,hexPoints(cx,cy,rx*t,ry*t,rot));ctx.fillStyle=blendHex(c1,c2,1-t);ctx.fill()};break
      case 'conical':for(let i=0;i<360;i++){ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,Math.max(rx,ry)*1.5,Math.PI*2*i/360,Math.PI*2*(i+1)/360);ctx.closePath();ctx.fillStyle=blendHex(c1,c2,i/360);ctx.fill()};break
      case 'pattern_hex':{fill(c1);const hs=layer.patternSize??20;ctx.strokeStyle=c2;ctx.lineWidth=1.5;for(let row=-2;row<ch/hs+2;row++){for(let col=-2;col<cw/(hs*1.732)+2;col++){const hx=col*hs*1.732+(row%2)*hs*.866,hy=row*hs*1.5;ctx.beginPath();for(let k=0;k<6;k++){const ka=(Math.PI/3)*k-Math.PI/6;k===0?ctx.moveTo(hx+hs*Math.cos(ka),hy+hs*Math.sin(ka)):ctx.lineTo(hx+hs*Math.cos(ka),hy+hs*Math.sin(ka))}ctx.closePath();ctx.stroke()}};break}
      case 'pattern_stripe':{fill(c1);const sz=layer.patternSize??20;ctx.fillStyle=c2;for(let x=-ch;x<cw+ch;x+=sz*2){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+sz,0);ctx.lineTo(x+sz-ch,ch);ctx.lineTo(x-ch,ch);ctx.closePath();ctx.fill()};break}
      case 'stars':{fill(c1);const rng=mulberry32(42);for(let i=0;i<140;i++){ctx.beginPath();ctx.arc(rng()*cw,rng()*ch,rng()*1.8+.4,0,Math.PI*2);ctx.fillStyle=`rgba(255,255,255,${(rng()*.5+.4).toFixed(2)})`;ctx.fill()};break}
      case 'watercolor':{
        // 水彩晕染：模拟湿画纸上颜料扩散
        fill(c1)
        const rng1=mulberry32(77)
        const [r1c,g1c,b1c]=hexToRgb(c1), [r2c,g2c,b2c]=hexToRgb(c2)
        // 大块底色晕染（模拟第一遍湿涂）
        for(let i=0;i<5;i++){
          const bx=cx+(rng1()-.5)*rx*1.2, by=cy+(rng1()-.5)*ry*1.2
          const br=safeR((rng1()*.4+.4)*Math.max(rx,ry))
          const t=rng1()
          const rc=Math.round(r1c+(r2c-r1c)*t), gc=Math.round(g1c+(g2c-g1c)*t), bc=Math.round(b1c+(b2c-b1c)*t)
          const wg=ctx.createRadialGradient(bx,by,0,bx,by,br)
          wg.addColorStop(0,`rgba(${rc},${gc},${bc},0.55)`)
          wg.addColorStop(0.6,`rgba(${rc},${gc},${bc},0.2)`)
          wg.addColorStop(1,'rgba(0,0,0,0)')
          ctx.fillStyle=wg; ctx.fillRect(0,0,cw,ch)
        }
        // 细小颜料点（模拟颜料积聚）
        for(let i=0;i<18;i++){
          const px=rng1()*cw, py=rng1()*ch
          const pr=safeR((rng1()*.12+.04)*Math.min(rx,ry))
          const t2=rng1()
          const rc2=Math.round(r1c+(r2c-r1c)*t2), gc2=Math.round(g1c+(g2c-g1c)*t2), bc2=Math.round(b1c+(b2c-b1c)*t2)
          const pg=ctx.createRadialGradient(px,py,0,px,py,pr)
          pg.addColorStop(0,`rgba(${rc2},${gc2},${bc2},0.7)`)
          pg.addColorStop(0.5,`rgba(${rc2},${gc2},${bc2},0.25)`)
          pg.addColorStop(1,'rgba(0,0,0,0)')
          ctx.fillStyle=pg; ctx.fillRect(0,0,cw,ch)
        }
        // 边缘水痕（水彩特有的边缘积色）
        for(let a=0;a<Math.PI*2;a+=Math.PI/8){
          const ex=cx+Math.cos(a)*(rx*.75+rng1()*rx*.2)
          const ey=cy+Math.sin(a)*(ry*.75+rng1()*ry*.2)
          const er=safeR((rng1()*.1+.06)*Math.min(rx,ry))
          const eg2=ctx.createRadialGradient(ex,ey,0,ex,ey,er)
          eg2.addColorStop(0,hexToRgba(c2,0.45)); eg2.addColorStop(1,'rgba(0,0,0,0)')
          ctx.fillStyle=eg2; ctx.fillRect(0,0,cw,ch)
        }
        break
      }
      case 'cyberpunk':{
        // 赛博朋克霓虹：深色底+霓虹扫光+网格线
        fill(c1||'#050510')
        // 网格
        ctx.strokeStyle='rgba(0,255,200,0.08)'; ctx.lineWidth=1
        const gs=30
        for(let x=0;x<cw;x+=gs){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,ch);ctx.stroke()}
        for(let y=0;y<ch;y+=gs){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(cw,y);ctx.stroke()}
        // 霓虹光带
        const nc1=c2||'#ff00aa', nc2=c1||'#00ffcc'
        const ng1=ctx.createLinearGradient(0,cy,cw,cy)
        ng1.addColorStop(0,'rgba(0,0,0,0)')
        ng1.addColorStop(0.3,hexToRgba(nc1,0.18))
        ng1.addColorStop(0.5,hexToRgba(nc2,0.28))
        ng1.addColorStop(0.7,hexToRgba(nc1,0.18))
        ng1.addColorStop(1,'rgba(0,0,0,0)')
        ctx.fillStyle=ng1; ctx.fillRect(0,0,cw,ch)
        // 顶部/底部扫光
        const ng2=ctx.createLinearGradient(cx,0,cx,ch)
        ng2.addColorStop(0,hexToRgba(nc2,0.15))
        ng2.addColorStop(0.4,'rgba(0,0,0,0)')
        ng2.addColorStop(0.6,'rgba(0,0,0,0)')
        ng2.addColorStop(1,hexToRgba(nc1,0.15))
        ctx.fillStyle=ng2; ctx.fillRect(0,0,cw,ch)
        // 中心光点
        const cg=ctx.createRadialGradient(cx,cy,0,cx,cy,safeR(Math.max(rx,ry)*.5))
        cg.addColorStop(0,hexToRgba(nc2,0.12)); cg.addColorStop(1,'rgba(0,0,0,0)')
        ctx.fillStyle=cg; ctx.fillRect(0,0,cw,ch)
        break
      }
      case 'fog':{
        // 云雾：用正弦波叠加模拟体积云
        fill(c1||'#1a2035')
        const fogColor=c2||'#99aace'
        // 横向云带（用正弦波生成有机云形）
        for(let band=0;band<8;band++){
          const seed=band*137.508
          const baseY=ch*(band/8)+(Math.sin(seed)*ch*.1)
          const bandH=ch*(0.18+Math.sin(seed*1.3)*.08)
          for(let x=0;x<=cw;x+=3){
            const wave1=Math.sin(x/cw*Math.PI*3+seed)*bandH*.35
            const wave2=Math.sin(x/cw*Math.PI*5.3+seed*1.7)*bandH*.2
            const wave3=Math.sin(x/cw*Math.PI*8.1+seed*2.3)*bandH*.1
            const top=baseY+wave1+wave2+wave3
            const bot=top+bandH+Math.sin(x/cw*Math.PI*4+seed*1.1)*bandH*.3
            const alpha=(0.06+Math.abs(Math.sin(seed+x/cw*2))*.08)
            const cg=ctx.createLinearGradient(x,top,x,bot)
            cg.addColorStop(0,`rgba(0,0,0,0)`)
            cg.addColorStop(0.3,hexToRgba(fogColor,alpha))
            cg.addColorStop(0.7,hexToRgba(fogColor,alpha*.6))
            cg.addColorStop(1,`rgba(0,0,0,0)`)
            ctx.fillStyle=cg; ctx.fillRect(x,top,3,bot-top+1)
          }
        }
        // 深景薄雾（全局）
        const mist=ctx.createLinearGradient(0,0,0,ch)
        mist.addColorStop(0,hexToRgba(fogColor,0.08))
        mist.addColorStop(0.5,hexToRgba(fogColor,0.04))
        mist.addColorStop(1,hexToRgba(fogColor,0.1))
        ctx.fillStyle=mist; ctx.fillRect(0,0,cw,ch)
        break
      }
      case 'marble':{
        // 大理石：多层正弦条纹叠加模拟纹理
        fill(c1||'#e8e4dc')
        const freq=(layer.patternSize??3)
        const lines=60
        for(let i=0;i<lines;i++){
          const t=i/lines
          // 用正弦函数生成弯曲条纹
          const yBase=t*ch
          const amp=ch*0.06
          ctx.beginPath()
          for(let x=0;x<=cw;x+=4){
            const wave=Math.sin(x/cw*freq*Math.PI+t*Math.PI*2.3)*amp
                      +Math.sin(x/cw*freq*1.7*Math.PI+t*4.1)*amp*.4
            const y=yBase+wave
            x===0?ctx.moveTo(x,y):ctx.lineTo(x,y)
          }
          const alpha=Math.abs(Math.sin(t*Math.PI*freq+0.5))*0.18+0.02
          ctx.strokeStyle=hexToRgba(c2||'#7a7570',alpha)
          ctx.lineWidth=1+Math.abs(Math.sin(t*5))*2
          ctx.stroke()
        }
        // 叠加渐变增加深度感
        const mg=ctx.createLinearGradient(0,0,cw,ch)
        mg.addColorStop(0,hexToRgba(c1||'#e8e4dc',0.3))
        mg.addColorStop(0.5,'rgba(255,255,255,0.1)')
        mg.addColorStop(1,hexToRgba(c2||'#7a7570',0.2))
        ctx.fillStyle=mg; ctx.fillRect(0,0,cw,ch)
        break
      }
      case 'granite':{
        // 花岗岩：随机斑点+底色
        fill(c1||'#888880')
        const rng3=mulberry32(123)
        const speckColors=[c2||'#333330','#ffffff','#cccccc',c1||'#888880']
        for(let i=0;i<cw*ch/60;i++){
          const sx=rng3()*cw, sy=rng3()*ch
          const sr=rng3()*3+0.5
          const sc=speckColors[Math.floor(rng3()*speckColors.length)]
          ctx.beginPath(); ctx.arc(sx,sy,sr,0,Math.PI*2)
          ctx.fillStyle=hexToRgba(sc, rng3()*.7+.3); ctx.fill()
        }
        // 整体色调统一
        const gtone=ctx.createRadialGradient(cx,cy,0,cx,cy,safeR(Math.max(rx,ry)))
        gtone.addColorStop(0,hexToRgba(c1||'#888880',0.15))
        gtone.addColorStop(1,hexToRgba(c2||'#333330',0.2))
        ctx.fillStyle=gtone; ctx.fillRect(0,0,cw,ch)
        break
      }
      case 'jade':{
        // 玉石：流动的绿色纹路
        fill(c1||'#2d6e4e')
        const jlines=40
        for(let i=0;i<jlines;i++){
          const t=i/jlines
          ctx.beginPath()
          ctx.moveTo(0, ch*t)
          for(let x=0;x<=cw;x+=6){
            const y=ch*t
              +Math.sin(x/cw*Math.PI*4+t*7)*ch*.06
              +Math.sin(x/cw*Math.PI*7+t*11)*ch*.025
              +Math.sin(x/cw*Math.PI*2.3+t*3.7)*ch*.04
            x===0?ctx.moveTo(x,y):ctx.lineTo(x,y)
          }
          const alpha=Math.abs(Math.sin(t*Math.PI*6))*.12+.02
          ctx.strokeStyle=hexToRgba(c2||'#a8d8b8',alpha)
          ctx.lineWidth=1+Math.abs(Math.sin(t*9))*3
          ctx.stroke()
        }
        // 半透明光泽
        const jg=ctx.createRadialGradient(cx*.7,cy*.6,0,cx,cy,safeR(Math.max(rx,ry)))
        jg.addColorStop(0,hexToRgba(c2||'#c8f0d8',0.22))
        jg.addColorStop(0.5,hexToRgba(c1||'#2d6e4e',0.05))
        jg.addColorStop(1,hexToRgba(c2||'#1a4030',0.15))
        ctx.fillStyle=jg; ctx.fillRect(0,0,cw,ch)
        break
      }
      case 'sandstone':{
        // 砂岩：水平分层条带
        fill(c1||'#c8a878')
        const slayers=30
        for(let i=0;i<slayers;i++){
          const t=i/slayers
          const y=t*ch
          const layerH=ch/slayers*(0.8+Math.sin(i*2.3)*.4)
          // 每层颜色略有差异
          const variation=Math.sin(i*1.7)*.15
          const [r1s,g1s,b1s]=hexToRgb(c1||'#c8a878')
          const [r2s,g2s,b2s]=hexToRgb(c2||'#8b6040')
          const mix=t+variation
          const rc=Math.round(r1s+(r2s-r1s)*Math.max(0,Math.min(1,mix)))
          const gc=Math.round(g1s+(g2s-g1s)*Math.max(0,Math.min(1,mix)))
          const bc=Math.round(b1s+(b2s-b1s)*Math.max(0,Math.min(1,mix)))
          ctx.fillStyle=`rgba(${rc},${gc},${bc},0.6)`
          ctx.fillRect(0,y,cw,layerH+1)
          // 层间裂缝线
          if(Math.sin(i*3.1)>0.3){
            ctx.beginPath()
            for(let x=0;x<=cw;x+=8){
              const yw=y+Math.sin(x/cw*Math.PI*6+i)*2
              x===0?ctx.moveTo(x,yw):ctx.lineTo(x,yw)
            }
            ctx.strokeStyle=hexToRgba(c2||'#8b6040',0.25)
            ctx.lineWidth=0.5; ctx.stroke()
          }
        }
        break
      }
      case 'obsidian':{
        // 黑曜石：深黑底+玻璃光泽+细纹
        fill(c1||'#0a0808')
        // 玻璃状高光（模拟光线折射）
        const og1=ctx.createLinearGradient(0,0,cw,ch)
        og1.addColorStop(0,hexToRgba(c2||'#3a3060',0.35))
        og1.addColorStop(0.3,'rgba(255,255,255,0.05)')
        og1.addColorStop(0.5,hexToRgba(c2||'#3a3060',0.08))
        og1.addColorStop(0.7,'rgba(255,255,255,0.03)')
        og1.addColorStop(1,hexToRgba(c2||'#1a0818',0.4))
        ctx.fillStyle=og1; ctx.fillRect(0,0,cw,ch)
        // 流动细纹
        for(let i=0;i<20;i++){
          const seed=i*73.1
          ctx.beginPath()
          const startX=Math.sin(seed)*cw*.5+cx
          const startY=Math.cos(seed)*ch*.5+cy
          ctx.moveTo(startX,startY)
          for(let s=0;s<60;s++){
            const angle=seed+s*.15+Math.sin(s*.3+seed)*0.8
            ctx.lineTo(
              startX+Math.cos(angle)*s*(rx/60),
              startY+Math.sin(angle)*s*(ry/60)
            )
          }
          ctx.strokeStyle=hexToRgba(c2||'#6050a0',Math.abs(Math.sin(seed))*.08+.02)
          ctx.lineWidth=0.5; ctx.stroke()
        }
        // 镜面反光斑
        const og2=ctx.createRadialGradient(cx*.4,cy*.35,0,cx*.4,cy*.35,safeR(Math.min(rx,ry)*.4))
        og2.addColorStop(0,'rgba(255,255,255,0.12)')
        og2.addColorStop(0.5,'rgba(255,255,255,0.03)')
        og2.addColorStop(1,'rgba(0,0,0,0)')
        ctx.fillStyle=og2; ctx.fillRect(0,0,cw,ch)
        break
      }
      case 'glow':{
        // 光晕：中心强光+多色光圈
        fill(c1||'#0a0818')
        // 主光晕
        const gg=ctx.createRadialGradient(cx,cy,0,cx,cy,safeR(Math.max(rx,ry)*.9))
        gg.addColorStop(0,hexToRgba(c2||'#ffffff',0.35))
        gg.addColorStop(0.3,hexToRgba(c2||'#ffffff',0.1))
        gg.addColorStop(0.6,hexToRgba(c2||'#ffffff',0.03))
        gg.addColorStop(1,'rgba(0,0,0,0)')
        ctx.fillStyle=gg; ctx.fillRect(0,0,cw,ch)
        // 光圈
        for(let i=1;i<=3;i++){
          const gr=safeR(Math.max(rx,ry)*i*.28)
          ctx.beginPath(); ctx.arc(cx,cy,gr,0,Math.PI*2)
          ctx.strokeStyle=hexToRgba(c2||'#ffffff', 0.12/i)
          ctx.lineWidth=i*3; ctx.stroke()
        }
        // 边缘暗角
        const vg=ctx.createRadialGradient(cx,cy,Math.min(rx,ry)*.5,cx,cy,Math.max(rx,ry)*1.2)
        vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,0.5)')
        ctx.fillStyle=vg; ctx.fillRect(0,0,cw,ch)
        break
      }
      case 'image':{if(layer.image){const img=layer.image;const sc=Math.max(cw/img.naturalWidth,ch/img.naturalHeight);ctx.drawImage(img,(cw-img.naturalWidth*sc)/2,(ch-img.naturalHeight*sc)/2,img.naturalWidth*sc,img.naturalHeight*sc)};break}
    }
    ctx.restore()
  }

  // ─── 人物（含镀层效果）───
  function drawCharacter(ctx,cx,cy,R3,layer){
    if(!layer.image)return
    ctx.save();ctx.globalAlpha=layer.opacity??1
    const img=layer.image,scale=layer.scale??1
    const ox=(layer.offsetX??0)*2,oy=(layer.offsetY??0)*2
    const fitH=R3.ry*2*1.15*scale,fitW=(img.naturalWidth/img.naturalHeight)*fitH
    const dx=cx-fitW/2+ox, dy=cy-fitH/2+oy

    ctx.drawImage(img,dx,dy,fitW,fitH)

    // 镀层效果
    if(layer.plating){
      ctx.save()
      // clip到人物图片区域（矩形近似）
      ctx.globalAlpha=(layer.opacity??1)*0.55
      ctx.globalCompositeOperation='source-atop'

      const platingColors={
        gold:    ['#ffe066','#c8860a','#ffe8a0','#b06000'],
        aurora:  ['#cc88ff','#4422cc','#88ffee','#aa44ff'],
        silver:  ['#ffffff','#8888aa','#ddddee','#6666aa'],
        crimson: ['#ff4422','#880000','#ffaa88','#cc2200'],
        void:    ['#9933ff','#330066','#cc66ff','#220044'],
      }
      const cols=platingColors[layer.platingType??'gold']

      // 拉丝纹理
      const stripeCount=Math.ceil(fitH/8)
      for(let i=0;i<stripeCount;i++){
        const t=i/stripeCount
        const sg=ctx.createLinearGradient(dx,dy+t*fitH,dx+fitW,dy+t*fitH)
        sg.addColorStop(0,cols[0]+'44')
        sg.addColorStop(0.3,cols[2]+'88')
        sg.addColorStop(0.7,cols[0]+'44')
        sg.addColorStop(1,cols[3]+'33')
        ctx.fillStyle=sg
        ctx.fillRect(dx,dy+t*fitH,fitW,fitH/stripeCount+1)
      }

      // 光泽扫光
      const sweepG=ctx.createLinearGradient(dx,dy,dx+fitW,dy+fitH)
      sweepG.addColorStop(0,'rgba(255,255,255,0)')
      sweepG.addColorStop(0.35,'rgba(255,255,255,0)')
      sweepG.addColorStop(0.45,cols[2]+'cc')
      sweepG.addColorStop(0.55,'rgba(255,255,255,0)')
      sweepG.addColorStop(1,'rgba(255,255,255,0)')
      ctx.fillStyle=sweepG
      ctx.fillRect(dx,dy,fitW,fitH)

      ctx.restore()

      // 边缘粒子
      ctx.save()
      ctx.globalAlpha=(layer.opacity??1)*0.7
      const rng=mulberry32(layer.id??42)
      for(let i=0;i<30;i++){
        const px=dx+rng()*fitW
        const py=dy+rng()*fitH
        const pr=rng()*3+1
        ctx.beginPath();ctx.arc(px,py,pr,0,Math.PI*2)
        ctx.fillStyle=cols[Math.floor(rng()*cols.length)]+'cc'
        ctx.fill()
      }
      ctx.restore()
    }

    ctx.restore()
  }

  // ─── 文字（只画文字内容，不画选中框）───
  function drawTextLayer(ctx,layer){
    if(!layer.text)return
    const x=layer.textX??cx, y=layer.textY??cy
    const w=layer.textW??400
    const r=layer.textRot??0
    ctx.save(); ctx.translate(x,y); ctx.rotate(r); ctx.globalAlpha=layer.opacity??1
    const fs=(layer.fontSize??24)*2
    const fontName=layer.font??'Cinzel Decorative'
    const dubaiWeightMap={'Dubai Light':'300 ','Dubai':'400 ','Dubai Medium':'500 ','Dubai Bold':'700 '}
    const fontWeight=dubaiWeightMap[fontName]?dubaiWeightMap[fontName]:(layer.bold?'bold ':'')
    const fontFamily=dubaiWeightMap[fontName]?'"Dubai"':`"${fontName}"`
    ctx.font=`${fontWeight}${fs}px ${fontFamily},"MiSans","Noto Serif SC",serif`
    ctx.fillStyle=layer.color??'#e8c97a'; ctx.textAlign='center'; ctx.textBaseline='middle'
    const lines=(layer.text||'').split('\n'), lineH=fs*1.3
    lines.forEach((line,i)=>ctx.fillText(line,0,(i-(lines.length-1)/2)*lineH,w*.95))
    ctx.restore()
  }

  // ─── 选中控制框（始终画在所有内容最顶层）───
  function drawSelectionBox(ctx,layer){
    const x=layer.textX??cx, y=layer.textY??cy
    const w=layer.textW??400, h=layer.textH??100
    const r=layer.textRot??0
    ctx.save(); ctx.translate(x,y); ctx.rotate(r)
    ctx.strokeStyle='rgba(100,180,255,0.9)';ctx.lineWidth=2;ctx.setLineDash([6,4])
    ctx.strokeRect(-w/2,-h/2,w,h);ctx.setLineDash([])
    ctx.strokeStyle='rgba(100,180,255,0.6)';ctx.lineWidth=1.5
    ctx.beginPath();ctx.moveTo(0,-h/2);ctx.lineTo(0,-h/2-ROT_OFFSET);ctx.stroke()
    const dH=(lx,ly,isR)=>{ctx.beginPath();ctx.arc(lx,ly,HANDLE_R,0,Math.PI*2);ctx.fillStyle=isR?'#ffd700':'white';ctx.fill();ctx.strokeStyle=isR?'#c8a000':'rgba(100,180,255,0.9)';ctx.lineWidth=2;ctx.stroke()}
    ;[[-w/2,-h/2],[0,-h/2],[w/2,-h/2],[w/2,0],[w/2,h/2],[0,h/2],[-w/2,h/2],[-w/2,0]].forEach(([lx,ly])=>dH(lx,ly,false))
    dH(0,-h/2-ROT_OFFSET,true)
    ctx.restore()
  }

  // ─── 交互（文字+装饰共用） ───
  const getInteractiveLayers = useCallback(() => {
    return (layers||[]).filter(l=>l.visible&&(l.type==='text'||l.type==='decoration'))
  }, [layers])

  const handleMouseDown = useCallback((e) => {
    if(e.button!==0) return
    const canvas=canvasRef.current
    const pt=canvasPt(e,canvas)
    const selected=layers?.find(l=>l.id===selectedId&&(l.type==='text'||l.type==='decoration'))

    // 先检测选中图层的控制手柄
    if(selected){
      const xKey=selected.type==='decoration'?'shapeX':'textX'
      const yKey=selected.type==='decoration'?'shapeY':'textY'
      const defX=selected[xKey]??cx, defY=selected[yKey]??cy
      const{handles,rotHandle}=getHandles(selected,defX,defY)
      const hit=hitHandle(pt,handles,rotHandle)
      if(hit){
        drag.current={type:hit.type,idx:hit.idx,layerId:selected.id,layerType:selected.type,startPt:pt,startLayer:{...selected}}
        e.preventDefault();return
      }
      if(ptInBox(pt,selected,defX,defY)){
        drag.current={type:'move',layerId:selected.id,layerType:selected.type,startPt:pt,startLayer:{...selected}}
        e.preventDefault();return
      }
    }

    // 点击其他可交互图层
    const interactive=getInteractiveLayers()
    for(let i=interactive.length-1;i>=0;i--){
      const l=interactive[i]
      const defX=(l.type==='decoration'?l.shapeX:l.textX)??cx
      const defY=(l.type==='decoration'?l.shapeY:l.textY)??cy
      if(ptInBox(pt,l,defX,defY)){
        onLayerChange&&onLayerChange('select',l.id)
        drag.current={type:'move',layerId:l.id,layerType:l.type,startPt:pt,startLayer:{...l}}
        e.preventDefault();return
      }
    }
  },[layers,selectedId,cx,cy,getInteractiveLayers,onLayerChange])

  const handleMouseMove = useCallback((e)=>{
    if(!drag.current)return
    const canvas=canvasRef.current
    const pt=canvasPt(e,canvas)
    const{type,layerId,layerType,startPt,startLayer,idx}=drag.current
    const dx=pt.x-startPt.x, dy=pt.y-startPt.y
    const xKey=layerType==='decoration'?'shapeX':'textX'
    const yKey=layerType==='decoration'?'shapeY':'textY'
    const wKey=layerType==='decoration'?'shapeW':'textW'
    const hKey=layerType==='decoration'?'shapeH':'textH'
    const rKey=layerType==='decoration'?'shapeRot':'textRot'

    if(type==='move'){
      onLayerChange&&onLayerChange('update',layerId,{
        [xKey]:(startLayer[xKey]??cx)+dx,
        [yKey]:(startLayer[yKey]??cy)+dy,
      })
    } else if(type==='rotate'){
      const sx=startLayer[xKey]??cx, sy=startLayer[yKey]??cy
      const a0=Math.atan2(startPt.y-sy,startPt.x-sx)
      const a1=Math.atan2(pt.y-sy,pt.x-sx)
      onLayerChange&&onLayerChange('update',layerId,{[rKey]:(startLayer[rKey]??0)+(a1-a0)})
    } else if(type==='scale'){
      const lrot=startLayer[rKey]??0
      const cos=Math.cos(-lrot),sin=Math.sin(-lrot)
      const ldx=dx*cos-dy*sin, ldy=dx*sin+dy*cos
      let nw=startLayer[wKey]??200, nh=startLayer[hKey]??200
      if([2,3,4].includes(idx)) nw=Math.max(20,nw+ldx*2)
      if([0,6,7].includes(idx)) nw=Math.max(20,nw-ldx*2)
      if([4,5,6].includes(idx)) nh=Math.max(20,nh+ldy*2)
      if([0,1,2].includes(idx)) nh=Math.max(20,nh-ldy*2)
      onLayerChange&&onLayerChange('update',layerId,{[wKey]:nw,[hKey]:nh})
    }
  },[cx,cy,onLayerChange])

  const handleMouseUp=useCallback(()=>{drag.current=null},[])

  const handleMouseMoveStyle=useCallback((e)=>{
    const canvas=canvasRef.current; if(!canvas) return
    const pt=canvasPt(e,canvas)
    const selected=layers?.find(l=>l.id===selectedId&&(l.type==='text'||l.type==='decoration'))
    if(selected){
      const defX=(selected.type==='decoration'?selected.shapeX:selected.textX)??cx
      const defY=(selected.type==='decoration'?selected.shapeY:selected.textY)??cy
      const{handles,rotHandle}=getHandles(selected,defX,defY)
      const hit=hitHandle(pt,handles,rotHandle)
      if(hit?.type==='rotate'){canvas.style.cursor='grab';return}
      if(hit?.type==='scale'){canvas.style.cursor='nwse-resize';return}
      if(ptInBox(pt,selected,defX,defY)){canvas.style.cursor='move';return}
    }
    const interactive=getInteractiveLayers()
    if(interactive.some(l=>ptInBox(pt,l,(l.type==='decoration'?l.shapeX:l.textX)??cx,(l.type==='decoration'?l.shapeY:l.textY)??cy))){canvas.style.cursor='move';return}
    canvas.style.cursor='default'
  },[layers,selectedId,cx,cy,getInteractiveLayers])

  useEffect(()=>{draw()},[draw])

  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas) return
    canvas.addEventListener('mousedown',handleMouseDown)
    window.addEventListener('mousemove',handleMouseMove)
    window.addEventListener('mouseup',handleMouseUp)
    canvas.addEventListener('mousemove',handleMouseMoveStyle)
    return()=>{
      canvas.removeEventListener('mousedown',handleMouseDown)
      window.removeEventListener('mousemove',handleMouseMove)
      window.removeEventListener('mouseup',handleMouseUp)
      canvas.removeEventListener('mousemove',handleMouseMoveStyle)
    }
  },[handleMouseDown,handleMouseMove,handleMouseUp,handleMouseMoveStyle])

  return (
    <canvas ref={canvasRef} width={CW} height={CH}
      style={{width:CW*previewScale,height:CH*previewScale,filter:'drop-shadow(0 8px 32px rgba(0,0,0,0.85))',cursor:'default'}}
    />
  )
})

export default BadgeCanvas
