import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle, useState } from 'react'

const PADDING = 24
const HANDLE_R = 7        // 控制点半径
const ROT_OFFSET = 28     // 旋转手柄距边框距离

function hexPoints(cx, cy, rx, ry, rot = -Math.PI / 6) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i + rot
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]
  })
}

function tracePath(ctx, pts) {
  ctx.beginPath()
  pts.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y))
  ctx.closePath()
}

function drawRing(ctx, cx, cy, oRx, oRy, iRx, iRy, rot, color) {
  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath()
  hexPoints(cx, cy, oRx, oRy, rot).forEach(([x,y],i)=> i===0?ctx.moveTo(x,y):ctx.lineTo(x,y))
  ctx.closePath()
  hexPoints(cx, cy, iRx, iRy, rot).slice().reverse().forEach(([x,y],i)=> i===0?ctx.moveTo(x,y):ctx.lineTo(x,y))
  ctx.closePath()
  ctx.fill('evenodd')
  ctx.restore()
}

function safeR(v) { return Math.max(2, v || 2) }

function mulberry32(seed) {
  let a = seed
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0
    let t = Math.imul(a ^ a >>> 15, 1 | a)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

function hexToRgb(hex) {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)]
}

function blendHex(c1, c2, t) {
  try {
    const [r1,g1,b1]=hexToRgb(c1),[r2,g2,b2]=hexToRgb(c2)
    return `rgb(${Math.round(r1+(r2-r1)*t)},${Math.round(g1+(g2-g1)*t)},${Math.round(b1+(b2-b1)*t)})`
  } catch { return c1 }
}

function getRxRy(hexW, hexH) {
  return { rx: safeR(hexW / Math.sqrt(3)), ry: safeR(hexH / 2) }
}

// 将屏幕坐标转为canvas渲染坐标（根据canvas实际显示尺寸和渲染尺寸的比例）
function canvasPt(e, canvas) {
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width  / rect.width
  const scaleY = canvas.height / rect.height
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top)  * scaleY,
  }
}

// 获取文字图层的变换矩阵控制点（在渲染坐标系）
function getTextHandles(layer, defaultX, defaultY) {
  const x   = layer.textX ?? defaultX
  const y   = layer.textY ?? defaultY
  const w   = layer.textW ?? 400
  const h   = layer.textH ?? 100
  const rot = layer.textRot ?? 0

  // 8个角/边点 + 1个旋转点，相对于文本框中心的局部坐标
  const half_w = w / 2, half_h = h / 2
  const localPts = [
    [-half_w, -half_h], [0, -half_h], [half_w, -half_h],
    [half_w,  0],
    [half_w,  half_h],  [0, half_h],  [-half_w, half_h],
    [-half_w, 0],
  ]
  const cos = Math.cos(rot), sin = Math.sin(rot)
  const rotate = ([lx, ly]) => [
    x + lx*cos - ly*sin,
    y + lx*sin + ly*cos,
  ]
  const handles = localPts.map(rotate)
  // 旋转手柄（在上边中点往外偏移）
  const rotHandle = rotate([0, -half_h - ROT_OFFSET])
  return { handles, rotHandle, cx: x, cy: y, w, h, rot }
}

function hitHandle(pt, handles, rotHandle) {
  for (let i = 0; i < handles.length; i++) {
    const [hx, hy] = handles[i]
    if (Math.hypot(pt.x - hx, pt.y - hy) < HANDLE_R + 4) return { type: 'scale', idx: i }
  }
  if (Math.hypot(pt.x - rotHandle[0], pt.y - rotHandle[1]) < HANDLE_R + 6)
    return { type: 'rotate' }
  return null
}

function ptInRect(pt, layer, defaultX, defaultY) {
  const x=layer.textX??defaultX, y=layer.textY??defaultY
  const w=layer.textW??400, h=layer.textH??100
  const rot=layer.textRot??0
  const cos=Math.cos(-rot), sin=Math.sin(-rot)
  const dx=pt.x-x, dy=pt.y-y
  const lx=dx*cos-dy*sin, ly=dx*sin+dy*cos
  return Math.abs(lx)<=w/2+4 && Math.abs(ly)<=h/2+4
}

const BadgeCanvas = forwardRef(function BadgeCanvas({ config, layers, selectedId, onLayerChange }, ref) {
  const canvasRef = useRef(null)
  const hexW = config.hexW ?? 1228
  const hexH = config.hexH ?? 1417
  const { rx: baseRx, ry: baseRy } = getRxRy(hexW, hexH)
  const CW = Math.round(hexW + PADDING * 2)
  const CH = Math.round(hexH + PADDING * 2)
  const cx = CW / 2, cy = CH / 2
  const rot = -Math.PI / 6

  const previewMax = 460
  const previewScale = Math.min(previewMax/CW, previewMax/CH)

  // 交互状态
  const drag = useRef(null)  // { type, layerId, startPt, startLayer, handles, rotHandle }

  useImperativeHandle(ref, () => ({
    exportPNG: () => {
      // 导出时不画控制框
      const canvas = canvasRef.current
      if (!canvas) return null
      return canvas.toDataURL('image/png')
    }
  }))

  // ── 主渲染 ──
  const draw = useCallback((activeId = selectedId, isExport = false) => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = CW
    canvas.height = CH
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, CW, CH)

    const outerW     = safeR(config.outerBorderWidth ?? 30)
    const gapW       = safeR(config.gapWidth         ?? 24)
    const innerW     = safeR(config.innerBorderWidth  ?? 12)
    const innerLineW = Math.max(0, config.innerLineWidth ?? 3)

    const R0 = { rx: baseRx,                      ry: baseRy }
    const R1 = { rx: safeR(R0.rx-outerW),         ry: safeR(R0.ry-outerW) }
    const R2 = { rx: safeR(R1.rx-gapW),           ry: safeR(R1.ry-gapW) }
    const R3 = { rx: safeR(R2.rx-innerW),         ry: safeR(R2.ry-innerW) }
    const R4 = { rx: safeR(R3.rx-innerLineW*2),   ry: safeR(R3.ry-innerLineW*2) }

    const sorted = [...(layers||[])].sort((a,b)=>a.zIndex-b.zIndex)

    // 背景
    ctx.save()
    tracePath(ctx, hexPoints(cx,cy,R3.rx,R3.ry,rot))
    ctx.clip()
    for (const l of sorted) {
      if (!l.visible||l.type!=='background') continue
      drawBg(ctx,cx,cy,CW,CH,R3,rot,l)
    }
    ctx.restore()

    // 装饰
    ctx.save()
    tracePath(ctx, hexPoints(cx,cy,R3.rx,R3.ry,rot))
    ctx.clip()
    for (const l of sorted) {
      if (!l.visible||l.type!=='decoration') continue
      drawDecor(ctx,cx,cy,R3,rot,l)
    }
    ctx.restore()

    // 人物
    ctx.save()
    tracePath(ctx, hexPoints(cx,cy,R0.rx,R0.ry,rot))
    ctx.clip()
    for (const l of sorted) {
      if (!l.visible||l.type!=='character') continue
      drawCharacter(ctx,cx,cy,R3,l)
    }
    ctx.restore()

    // 边框
    drawRing(ctx,cx,cy,R0.rx,R0.ry,R1.rx,R1.ry,rot, config.outerBorderColor??'#1a1628')
    drawRing(ctx,cx,cy,R1.rx,R1.ry,R2.rx,R2.ry,rot, config.gapColor??'#e8e0d0')

    // 内框
    ctx.save()
    ctx.beginPath()
    hexPoints(cx,cy,R2.rx,R2.ry,rot).forEach(([x,y],i)=>i===0?ctx.moveTo(x,y):ctx.lineTo(x,y))
    ctx.closePath()
    hexPoints(cx,cy,R3.rx,R3.ry,rot).slice().reverse().forEach(([x,y],i)=>i===0?ctx.moveTo(x,y):ctx.lineTo(x,y))
    ctx.closePath()
    const ic1=config.innerBorderColor1??'#f5e090', ic2=config.innerBorderColor2??'#9a7235'
    if (config.innerBorderSolid) { ctx.fillStyle=ic1 } else {
      const g=ctx.createLinearGradient(cx-R2.rx,cy-R2.ry,cx+R2.rx,cy+R2.ry)
      g.addColorStop(0,ic1); g.addColorStop(.4,ic2); g.addColorStop(1,ic1)
      ctx.fillStyle=g
    }
    ctx.fill('evenodd')
    ctx.restore()

    // 内细线
    if (innerLineW>0&&R4.rx>4) {
      ctx.save()
      tracePath(ctx,hexPoints(cx,cy,R4.rx,R4.ry,rot))
      ctx.strokeStyle=config.innerLineColor??'rgba(200,169,110,0.5)'
      ctx.lineWidth=innerLineW; ctx.stroke(); ctx.restore()
    }

    // 文字（含控制框）
    for (const l of sorted) {
      if (!l.visible||l.type!=='text') continue
      const isSelected = !isExport && l.id === activeId
      drawTextLayer(ctx, l, isSelected)
    }

  }, [config, layers, selectedId, CW, CH, cx, cy, baseRx, baseRy, rot])

  // ── 文字图层渲染 ──
  function drawTextLayer(ctx, layer, isSelected) {
    if (!layer.text) return
    const x   = layer.textX ?? cx
    const y   = layer.textY ?? cy
    const w   = layer.textW ?? 400
    const h   = layer.textH ?? 100
    const r   = layer.textRot ?? 0
    const fs  = layer.fontSize ?? 24
    const fontName = layer.font ?? 'Cinzel Decorative'

    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(r)
    ctx.globalAlpha = layer.opacity ?? 1

    // 文字
    ctx.font = `${layer.bold?'bold':''} ${fs*2}px "${fontName}","Noto Serif SC",serif`
    ctx.fillStyle = layer.color ?? '#e8c97a'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const lines = layer.text.split('\n')
    const lineH = fs * 2 * 1.3
    lines.forEach((line, i) => {
      ctx.fillText(line, 0, (i - (lines.length-1)/2) * lineH, w * 0.95)
    })

    // 控制框
    if (isSelected) {
      ctx.strokeStyle = 'rgba(100,180,255,0.9)'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 4])
      ctx.strokeRect(-w/2, -h/2, w, h)
      ctx.setLineDash([])

      // 旋转手柄连线
      ctx.strokeStyle = 'rgba(100,180,255,0.6)'
      ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(0, -h/2); ctx.lineTo(0, -h/2 - ROT_OFFSET); ctx.stroke()

      const drawHandle = (lx, ly, isRot) => {
        ctx.beginPath()
        ctx.arc(lx, ly, HANDLE_R, 0, Math.PI*2)
        ctx.fillStyle = isRot ? '#ffd700' : 'white'
        ctx.fill()
        ctx.strokeStyle = isRot ? '#c8a000' : 'rgba(100,180,255,0.9)'
        ctx.lineWidth = 2; ctx.stroke()
        if (isRot) {
          // 旋转图标
          ctx.beginPath()
          ctx.arc(lx, ly, 3.5, 0, Math.PI*1.5)
          ctx.strokeStyle = '#7a6000'; ctx.lineWidth = 2; ctx.stroke()
        }
      }

      // 8个缩放手柄
      const hw=w/2, hh=h/2
      ;[[-hw,-hh],[0,-hh],[hw,-hh],[hw,0],[hw,hh],[0,hh],[-hw,hh],[-hw,0]]
        .forEach(([lx,ly])=>drawHandle(lx,ly,false))
      // 旋转手柄
      drawHandle(0, -h/2 - ROT_OFFSET, true)
    }

    ctx.restore()
  }

  // ── 鼠标事件 ──
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    const canvas = canvasRef.current
    const pt = canvasPt(e, canvas)

    // 找选中的文字图层
    const textLayers = (layers||[]).filter(l=>l.type==='text'&&l.visible)
    const selected = layers?.find(l=>l.id===selectedId&&l.type==='text')

    // 优先检测当前选中图层的控制手柄
    if (selected) {
      const { handles, rotHandle, cx: lx, cy: ly, w, h, rot: lrot } = getTextHandles(selected, cx, cy)
      const hit = hitHandle(pt, handles, rotHandle)
      if (hit) {
        drag.current = {
          type: hit.type,
          idx: hit.idx,
          layerId: selected.id,
          startPt: pt,
          startLayer: { ...selected },
        }
        e.preventDefault(); return
      }
      // 检测是否在文本框内（拖移）
      if (ptInRect(pt, selected, cx, cy)) {
        drag.current = {
          type: 'move',
          layerId: selected.id,
          startPt: pt,
          startLayer: { ...selected },
        }
        e.preventDefault(); return
      }
    }

    // 点击其他文字图层进行选中
    for (let i = textLayers.length-1; i >= 0; i--) {
      const l = textLayers[i]
      if (ptInRect(pt, l, cx, cy)) {
        onLayerChange && onLayerChange('select', l.id)
        drag.current = {
          type: 'move',
          layerId: l.id,
          startPt: pt,
          startLayer: { ...l },
        }
        e.preventDefault(); return
      }
    }
  }, [layers, selectedId, previewScale, onLayerChange])

  const handleMouseMove = useCallback((e) => {
    if (!drag.current) return
    const canvas = canvasRef.current
    const pt = canvasPt(e, canvas)
    const { type, layerId, startPt, startLayer, idx } = drag.current
    const dx = pt.x - startPt.x, dy = pt.y - startPt.y

    if (type === 'move') {
      onLayerChange && onLayerChange('update', layerId, {
        textX: (startLayer.textX ?? cx) + dx,
        textY: (startLayer.textY ?? cy) + dy,
      })
    } else if (type === 'rotate') {
      const sx = startLayer.textX ?? cx, sy = startLayer.textY ?? cy
      const startAngle = Math.atan2(startPt.y - sy, startPt.x - sx)
      const curAngle = Math.atan2(pt.y - sy, pt.x - sx)
      const baseRot = startLayer.textRot ?? 0
      onLayerChange && onLayerChange('update', layerId, {
        textRot: baseRot + (curAngle - startAngle)
      })
    } else if (type === 'scale') {
      // 8个手柄：0=左上 1=上中 2=右上 3=右中 4=右下 5=下中 6=左下 7=左中
      const lrot = startLayer.textRot ?? 0
      const cos = Math.cos(-lrot), sin = Math.sin(-lrot)
      const ldx = dx*cos - dy*sin, ldy = dx*sin + dy*cos
      let newW = startLayer.textW ?? 300
      let newH = startLayer.textH ?? 80
      let newX = startLayer.textX ?? cx
      let newY = startLayer.textY ?? cy

      const affectsRight  = [2,3,4].includes(idx)
      const affectsLeft   = [0,6,7].includes(idx)
      const affectsBottom = [4,5,6].includes(idx)
      const affectsTop    = [0,1,2].includes(idx)

      if (affectsRight)  { newW = Math.max(60, newW + ldx*2) }
      if (affectsLeft)   { newW = Math.max(60, newW - ldx*2) }
      if (affectsBottom) { newH = Math.max(30, newH + ldy*2) }
      if (affectsTop)    { newH = Math.max(30, newH - ldy*2) }

      onLayerChange && onLayerChange('update', layerId, { textW: newW, textH: newH, textX: newX, textY: newY })
    }
  }, [previewScale, cx, cy, onLayerChange])

  const handleMouseUp = useCallback(() => {
    drag.current = null
  }, [])

  // 鼠标样式
  const handleMouseMoveStyle = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const pt = canvasPt(e, canvas)
    const selected = layers?.find(l=>l.id===selectedId&&l.type==='text')
    if (selected) {
      const { handles, rotHandle } = getTextHandles(selected, cx, cy)
      const hit = hitHandle(pt, handles, rotHandle)
      if (hit?.type==='rotate') { canvas.style.cursor='grab'; return }
      if (hit?.type==='scale')  { canvas.style.cursor='nwse-resize'; return }
      if (ptInRect(pt, selected, cx, cy)) { canvas.style.cursor='move'; return }
    }
    const textLayers=(layers||[]).filter(l=>l.type==='text'&&l.visible)
    if (textLayers.some(l=>ptInRect(pt,l,cx,cy))) { canvas.style.cursor='move'; return }
    canvas.style.cursor='default'
  }, [layers, selectedId, previewScale])

  useEffect(() => { draw() }, [draw])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('mousemove', handleMouseMoveStyle)
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      canvas.removeEventListener('mousemove', handleMouseMoveStyle)
    }
  }, [handleMouseDown, handleMouseMove, handleMouseUp, handleMouseMoveStyle])

  // ──────────── 背景渲染 ────────────
  function drawBg(ctx, cx, cy, cw, ch, R, rot, layer) {
    ctx.save(); ctx.globalAlpha = layer.opacity ?? 1
    const c1=layer.color1??'#1a1a2e', c2=layer.color2??'#0a0818', c3=layer.color3??null
    const angle=((layer.gradientAngle??135)*Math.PI)/180
    const rx=safeR(R.rx), ry=safeR(R.ry)
    const fill=(s)=>{ctx.fillStyle=s;ctx.fillRect(0,0,cw,ch)}
    switch(layer.bgType??'solid'){
      case 'solid': fill(c1); break
      case 'linear':case 'linear_diagonal':case 'linear_h':case 'linear_v':{
        const a=layer.bgType==='linear_h'?0:layer.bgType==='linear_v'?Math.PI/2:angle
        const g=ctx.createLinearGradient(cx-Math.cos(a)*rx,cy-Math.sin(a)*ry,cx+Math.cos(a)*rx,cy+Math.sin(a)*ry)
        c3?(g.addColorStop(0,c1),g.addColorStop(.5,c3),g.addColorStop(1,c2)):(g.addColorStop(0,c1),g.addColorStop(1,c2))
        fill(g); break
      }
      case 'linear_hard':{
        const sp=layer.hardSplit??0.5
        const g=ctx.createLinearGradient(cx,cy-ry,cx,cy+ry)
        g.addColorStop(0,c1);g.addColorStop(Math.max(0,sp-.001),c1);g.addColorStop(Math.min(1,sp),c2);g.addColorStop(1,c2)
        fill(g); break
      }
      case 'radial':{
        const g=ctx.createRadialGradient(cx,cy,0,cx,cy,safeR(Math.max(rx,ry)))
        g.addColorStop(0,c1);g.addColorStop(1,c2);fill(g); break
      }
      case 'radial_offcenter':{
        const ox=(layer.radialOX??0)*rx/100,oy=(layer.radialOY??-40)*ry/100
        const g=ctx.createRadialGradient(cx+ox,cy+oy,0,cx,cy,safeR(Math.max(rx,ry)*1.2))
        g.addColorStop(0,c1);g.addColorStop(1,c2);fill(g); break
      }
      case 'radial_hex':{
        fill(c2)
        for(let i=12;i>=0;i--){const t=i/12;tracePath(ctx,hexPoints(cx,cy,rx*t,ry*t,rot));ctx.fillStyle=blendHex(c1,c2,1-t);ctx.fill()}
        break
      }
      case 'conical':{
        for(let i=0;i<360;i++){
          ctx.beginPath();ctx.moveTo(cx,cy)
          ctx.arc(cx,cy,Math.max(rx,ry)*1.5,Math.PI*2*i/360,Math.PI*2*(i+1)/360);ctx.closePath()
          ctx.fillStyle=blendHex(c1,c2,i/360);ctx.fill()
        }
        break
      }
      case 'pattern_hex':{
        fill(c1);const hs=layer.patternSize??20;ctx.strokeStyle=c2;ctx.lineWidth=1.5
        for(let row=-2;row<ch/hs+2;row++){for(let col=-2;col<cw/(hs*1.732)+2;col++){
          const hx=col*hs*1.732+(row%2)*hs*.866,hy=row*hs*1.5
          ctx.beginPath()
          for(let k=0;k<6;k++){const ka=(Math.PI/3)*k-Math.PI/6;k===0?ctx.moveTo(hx+hs*Math.cos(ka),hy+hs*Math.sin(ka)):ctx.lineTo(hx+hs*Math.cos(ka),hy+hs*Math.sin(ka))}
          ctx.closePath();ctx.stroke()
        }}
        break
      }
      case 'pattern_stripe':{
        fill(c1);const sz=layer.patternSize??20;ctx.fillStyle=c2
        for(let x=-ch;x<cw+ch;x+=sz*2){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+sz,0);ctx.lineTo(x+sz-ch,ch);ctx.lineTo(x-ch,ch);ctx.closePath();ctx.fill()}
        break
      }
      case 'stars':{
        fill(c1);const rng=mulberry32(42)
        for(let i=0;i<140;i++){ctx.beginPath();ctx.arc(rng()*cw,rng()*ch,rng()*1.8+.4,0,Math.PI*2);ctx.fillStyle=`rgba(255,255,255,${(rng()*.5+.4).toFixed(2)})`;ctx.fill()}
        break
      }
      case 'arknights':{
        const g=ctx.createRadialGradient(cx,cy*.75,0,cx,cy,safeR(Math.max(rx,ry)*1.1))
        g.addColorStop(0,'#1a2640');g.addColorStop(.6,'#0d1520');g.addColorStop(1,'#060c14');fill(g)
        ctx.strokeStyle='rgba(100,160,255,0.07)';ctx.lineWidth=1
        const hs=40
        for(let row=-2;row<ch/hs+2;row++){for(let col=-2;col<cw/(hs*1.732)+2;col++){
          const hx=col*hs*1.732+(row%2)*hs*.866,hy=row*hs*1.5
          ctx.beginPath()
          for(let k=0;k<6;k++){const ka=(Math.PI/3)*k-Math.PI/6;k===0?ctx.moveTo(hx+hs*Math.cos(ka),hy+hs*Math.sin(ka)):ctx.lineTo(hx+hs*Math.cos(ka),hy+hs*Math.sin(ka))}
          ctx.closePath();ctx.stroke()
        }}
        const halo=ctx.createRadialGradient(cx,cy*.85,0,cx,cy*.85,safeR(Math.max(rx,ry)*.6))
        halo.addColorStop(0,'rgba(80,160,255,0.2)');halo.addColorStop(1,'rgba(80,160,255,0)')
        ctx.fillStyle=halo;ctx.fillRect(0,0,cw,ch);break
      }
      case 'image':{
        if(layer.image){const img=layer.image;const sc=Math.max(cw/img.naturalWidth,ch/img.naturalHeight)
          ctx.drawImage(img,(cw-img.naturalWidth*sc)/2,(ch-img.naturalHeight*sc)/2,img.naturalWidth*sc,img.naturalHeight*sc)}
        break
      }
    }
    ctx.restore()
  }

  function drawDecor(ctx, cx, cy, R, rot, layer) {
    ctx.save(); ctx.globalAlpha=layer.opacity??1
    const color=layer.color??'#c8a96e', rx=R.rx, ry=R.ry
    if(layer.decorType==='image'&&layer.image){
      const img=layer.image,sc=Math.max(rx*2/img.naturalWidth,ry*2/img.naturalHeight)
      ctx.drawImage(img,cx-img.naturalWidth*sc/2,cy-img.naturalHeight*sc/2,img.naturalWidth*sc,img.naturalHeight*sc)
      ctx.restore();return
    }
    ctx.strokeStyle=color
    switch(layer.decorType??'circle_lines'){
      case 'circle_lines':ctx.lineWidth=2;for(let r=.25;r<.92;r+=.18){ctx.beginPath();ctx.ellipse(cx,cy,rx*r,ry*r,0,0,Math.PI*2);ctx.stroke()};break
      case 'cross_lines':ctx.lineWidth=2;for(let i=0;i<12;i++){const a=(Math.PI/6)*i;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+rx*Math.cos(a),cy+ry*Math.sin(a));ctx.stroke()};break
      case 'corner_marks':ctx.lineWidth=3;hexPoints(cx,cy,rx*.9,ry*.9,rot).forEach(([x,y])=>{const dx=x-cx,dy=y-cy,len=Math.hypot(dx,dy),nx=dx/len,ny=dy/len;ctx.beginPath();ctx.moveTo(x-nx*28,y-ny*28);ctx.lineTo(x+nx*8,y+ny*8);ctx.stroke()});break
      case 'hex_rings':ctx.lineWidth=2;for(let r=.3;r<.95;r+=.2){tracePath(ctx,hexPoints(cx,cy,rx*r,ry*r,rot));ctx.stroke()};break
    }
    ctx.restore()
  }

  function drawCharacter(ctx, cx, cy, R3, layer) {
    if(!layer.image)return
    ctx.save();ctx.globalAlpha=layer.opacity??1
    const img=layer.image,scale=layer.scale??1
    const ox=(layer.offsetX??0)*2,oy=(layer.offsetY??0)*2
    const fitH=R3.ry*2*1.15*scale,fitW=(img.naturalWidth/img.naturalHeight)*fitH
    ctx.drawImage(img,cx-fitW/2+ox,cy-fitH/2+oy,fitW,fitH)
    ctx.restore()
  }

  useEffect(()=>{ draw() },[draw])

  return (
    <canvas
      ref={canvasRef}
      width={CW}
      height={CH}
      style={{
        width:  CW * previewScale,
        height: CH * previewScale,
        filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.85))',
        cursor: 'default',
      }}
    />
  )
})

export default BadgeCanvas
