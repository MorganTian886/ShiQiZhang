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
function hexToRgb(h){return[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]}
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
    exportPNG: () => canvasRef.current?.toDataURL('image/png') ?? null
  }))

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

    // 背景（clip到R3）
    ctx.save(); tracePath(ctx,hexPoints(cx,cy,R3.rx,R3.ry,hexRot)); ctx.clip()
    for(const l of sorted){if(!l.visible||l.type!=='background') continue; drawBg(ctx,cx,cy,CW,CH,R3,hexRot,l)}
    ctx.restore()

    // 装饰几何（clip到R3）
    ctx.save(); tracePath(ctx,hexPoints(cx,cy,R3.rx,R3.ry,hexRot)); ctx.clip()
    for(const l of sorted){
      if(!l.visible||l.type!=='decoration') continue
      drawShape(ctx,l,!!(l.id===selectedId),cx,cy)
    }
    ctx.restore()

    // 人物（clip到R0）
    ctx.save(); tracePath(ctx,hexPoints(cx,cy,R0.rx,R0.ry,hexRot)); ctx.clip()
    for(const l of sorted){if(!l.visible||l.type!=='character') continue; drawCharacter(ctx,cx,cy,R3,l)}
    ctx.restore()

    // 边框
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

    // 文字（clip到R0）
    ctx.save(); tracePath(ctx,hexPoints(cx,cy,R0.rx,R0.ry,hexRot)); ctx.clip()
    for(const l of sorted){if(!l.visible||l.type!=='text') continue; drawTextLayer(ctx,l,l.id===selectedId)}
    ctx.restore()

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
      case 'arknights':{const g=ctx.createRadialGradient(cx,cy*.75,0,cx,cy,safeR(Math.max(rx,ry)*1.1));g.addColorStop(0,'#1a2640');g.addColorStop(.6,'#0d1520');g.addColorStop(1,'#060c14');fill(g);ctx.strokeStyle='rgba(100,160,255,0.07)';ctx.lineWidth=1;const hs=40;for(let row=-2;row<ch/hs+2;row++){for(let col=-2;col<cw/(hs*1.732)+2;col++){const hx=col*hs*1.732+(row%2)*hs*.866,hy=row*hs*1.5;ctx.beginPath();for(let k=0;k<6;k++){const ka=(Math.PI/3)*k-Math.PI/6;k===0?ctx.moveTo(hx+hs*Math.cos(ka),hy+hs*Math.sin(ka)):ctx.lineTo(hx+hs*Math.cos(ka),hy+hs*Math.sin(ka))}ctx.closePath();ctx.stroke()}};const halo=ctx.createRadialGradient(cx,cy*.85,0,cx,cy*.85,safeR(Math.max(rx,ry)*.6));halo.addColorStop(0,'rgba(80,160,255,0.2)');halo.addColorStop(1,'rgba(80,160,255,0)');ctx.fillStyle=halo;ctx.fillRect(0,0,cw,ch);break}
      case 'image':{if(layer.image){const img=layer.image;const sc=Math.max(cw/img.naturalWidth,ch/img.naturalHeight);ctx.drawImage(img,(cw-img.naturalWidth*sc)/2,(ch-img.naturalHeight*sc)/2,img.naturalWidth*sc,img.naturalHeight*sc)};break}
    }
    ctx.restore()
  }

  // ─── 人物 ───
  function drawCharacter(ctx,cx,cy,R3,layer){
    if(!layer.image)return
    ctx.save();ctx.globalAlpha=layer.opacity??1
    const img=layer.image,scale=layer.scale??1
    const ox=(layer.offsetX??0)*2,oy=(layer.offsetY??0)*2
    const fitH=R3.ry*2*1.15*scale,fitW=(img.naturalWidth/img.naturalHeight)*fitH
    ctx.drawImage(img,cx-fitW/2+ox,cy-fitH/2+oy,fitW,fitH)
    ctx.restore()
  }

  // ─── 文字 ───
  function drawTextLayer(ctx,layer,isSelected){
    if(!layer.text)return
    const x=layer.textX??cx, y=layer.textY??cy
    const w=layer.textW??400, h=layer.textH??100
    const r=layer.textRot??0
    ctx.save(); ctx.translate(x,y); ctx.rotate(r); ctx.globalAlpha=layer.opacity??1
    const fs=(layer.fontSize??24)*2
    ctx.font=`${layer.bold?'bold':''} ${fs}px "${layer.font??'Cinzel Decorative'}","Noto Serif SC",serif`
    ctx.fillStyle=layer.color??'#e8c97a'; ctx.textAlign='center'; ctx.textBaseline='middle'
    const lines=(layer.text||'').split('\n'), lineH=fs*1.3
    lines.forEach((line,i)=>ctx.fillText(line,0,(i-(lines.length-1)/2)*lineH,w*.95))
    if(isSelected){
      ctx.strokeStyle='rgba(100,180,255,0.9)';ctx.lineWidth=2;ctx.setLineDash([6,4])
      ctx.strokeRect(-w/2,-h/2,w,h);ctx.setLineDash([])
      ctx.strokeStyle='rgba(100,180,255,0.6)';ctx.lineWidth=1.5
      ctx.beginPath();ctx.moveTo(0,-h/2);ctx.lineTo(0,-h/2-ROT_OFFSET);ctx.stroke()
      const dH=(lx,ly,isR)=>{ctx.beginPath();ctx.arc(lx,ly,HANDLE_R,0,Math.PI*2);ctx.fillStyle=isR?'#ffd700':'white';ctx.fill();ctx.strokeStyle=isR?'#c8a000':'rgba(100,180,255,0.9)';ctx.lineWidth=2;ctx.stroke()}
      ;[[-w/2,-h/2],[0,-h/2],[w/2,-h/2],[w/2,0],[w/2,h/2],[0,h/2],[-w/2,h/2],[-w/2,0]].forEach(([lx,ly])=>dH(lx,ly,false))
      dH(0,-h/2-ROT_OFFSET,true)
    }
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
