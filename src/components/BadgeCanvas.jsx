import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'

const PADDING = 24

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

// 画环形：外六边形填色，然后用"evenodd"规则挖掉内六边形
function drawRing(ctx, cx, cy, outerRx, outerRy, innerRx, innerRy, rot, color) {
  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath()
  // 外圈（顺时针）
  hexPoints(cx, cy, outerRx, outerRy, rot).forEach(([x, y], i) =>
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  )
  ctx.closePath()
  // 内圈（逆时针，形成孔洞）
  const inner = hexPoints(cx, cy, innerRx, innerRy, rot)
  inner.reverse().forEach(([x, y], i) =>
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  )
  ctx.closePath()
  ctx.fill('evenodd')
  ctx.restore()
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y)
  ctx.arcTo(x+w,y,x+w,y+r,r); ctx.lineTo(x+w,y+h-r)
  ctx.arcTo(x+w,y+h,x+w-r,y+h,r); ctx.lineTo(x+r,y+h)
  ctx.arcTo(x,y+h,x,y+h-r,r); ctx.lineTo(x,y+r)
  ctx.arcTo(x,y,x+r,y,r); ctx.closePath()
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
    const [r1,g1,b1] = hexToRgb(c1), [r2,g2,b2] = hexToRgb(c2)
    return `rgb(${Math.round(r1+(r2-r1)*t)},${Math.round(g1+(g2-g1)*t)},${Math.round(b1+(b2-b1)*t)})`
  } catch { return c1 }
}

function getRxRy(hexW, hexH) {
  return {
    rx: safeR(hexW / Math.sqrt(3)),
    ry: safeR(hexH / 2)
  }
}

const BadgeCanvas = forwardRef(function BadgeCanvas({ config, layers }, ref) {
  const canvasRef = useRef(null)

  const hexW = config.hexW ?? 1228
  const hexH = config.hexH ?? 1417
  const { rx: baseRx, ry: baseRy } = getRxRy(hexW, hexH)
  const CW = Math.round(hexW + PADDING * 2)
  const CH = Math.round(hexH + PADDING * 2)
  const cx = CW / 2
  const cy = CH / 2
  const rot = -Math.PI / 6

  useImperativeHandle(ref, () => ({
    exportPNG: () => canvasRef.current?.toDataURL('image/png') ?? null
  }))

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = CW
    canvas.height = CH
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, CW, CH)

    const outerW     = safeR(config.outerBorderWidth  ?? 30)
    const gapW       = safeR(config.gapWidth          ?? 24)
    const innerW     = safeR(config.innerBorderWidth   ?? 12)
    const innerLineW = Math.max(0, config.innerLineWidth ?? 3)

    const R0 = { rx: baseRx,                      ry: baseRy }
    const R1 = { rx: safeR(R0.rx - outerW),       ry: safeR(R0.ry - outerW) }
    const R2 = { rx: safeR(R1.rx - gapW),         ry: safeR(R1.ry - gapW) }
    const R3 = { rx: safeR(R2.rx - innerW),       ry: safeR(R2.ry - innerW) }
    const R4 = { rx: safeR(R3.rx - innerLineW*2), ry: safeR(R3.ry - innerLineW*2) }

    const sorted = [...(layers || [])].sort((a, b) => a.zIndex - b.zIndex)

    // ── 1. 内容区背景（clip 到 R3 内容区）──
    ctx.save()
    tracePath(ctx, hexPoints(cx, cy, R3.rx, R3.ry, rot))
    ctx.clip()
    for (const layer of sorted) {
      if (!layer.visible || layer.type !== 'background') continue
      drawBg(ctx, cx, cy, CW, CH, R3, rot, layer)
    }
    ctx.restore()

    // ── 2. 装饰（clip 到 R3）──
    ctx.save()
    tracePath(ctx, hexPoints(cx, cy, R3.rx, R3.ry, rot))
    ctx.clip()
    for (const layer of sorted) {
      if (!layer.visible || layer.type !== 'decoration') continue
      drawDecor(ctx, cx, cy, R3, rot, layer)
    }
    ctx.restore()

    // ── 3. 人物（破框：clip 到 R0，但超出 R3 的部分可见）──
    ctx.save()
    tracePath(ctx, hexPoints(cx, cy, R0.rx, R0.ry, rot))
    ctx.clip()
    for (const layer of sorted) {
      if (!layer.visible || layer.type !== 'character') continue
      drawCharacter(ctx, cx, cy, R3, layer)
    }
    ctx.restore()

    // ── 4. 边框（用 evenodd 环形，不用 destination-out）──

    // 最外框环
    drawRing(ctx, cx, cy, R0.rx, R0.ry, R1.rx, R1.ry, rot,
      config.outerBorderColor ?? '#1a1628')

    // gap 带
    drawRing(ctx, cx, cy, R1.rx, R1.ry, R2.rx, R2.ry, rot,
      config.gapColor ?? '#e8e0d0')

    // 内框（渐变）
    ctx.save()
    // 先填内框区域
    ctx.beginPath()
    hexPoints(cx, cy, R2.rx, R2.ry, rot).forEach(([x,y],i)=> i===0?ctx.moveTo(x,y):ctx.lineTo(x,y))
    ctx.closePath()
    hexPoints(cx, cy, R3.rx, R3.ry, rot).reverse().forEach(([x,y],i)=> i===0?ctx.moveTo(x,y):ctx.lineTo(x,y))
    ctx.closePath()
    const ic1 = config.innerBorderColor1 ?? '#f5e090'
    const ic2 = config.innerBorderColor2 ?? '#9a7235'
    if (config.innerBorderSolid) {
      ctx.fillStyle = ic1
    } else {
      const g = ctx.createLinearGradient(cx-R2.rx, cy-R2.ry, cx+R2.rx, cy+R2.ry)
      g.addColorStop(0, ic1); g.addColorStop(0.4, ic2); g.addColorStop(1, ic1)
      ctx.fillStyle = g
    }
    ctx.fill('evenodd')
    ctx.restore()

    // 内细线
    if (innerLineW > 0 && R4.rx > 4) {
      ctx.save()
      tracePath(ctx, hexPoints(cx, cy, R4.rx, R4.ry, rot))
      ctx.strokeStyle = config.innerLineColor ?? 'rgba(200,169,110,0.5)'
      ctx.lineWidth = innerLineW
      ctx.stroke()
      ctx.restore()
    }

    // ── 5. 文字（最顶层，clip 到 R0 防止溢出画布外）──
    ctx.save()
    tracePath(ctx, hexPoints(cx, cy, R0.rx, R0.ry, rot))
    ctx.clip()
    for (const layer of sorted) {
      if (!layer.visible || layer.type !== 'text') continue
      drawText(ctx, cx, cy, R3, layer)
    }
    ctx.restore()

  }, [config, layers, CW, CH, cx, cy, baseRx, baseRy, rot])

  // ──────────── 背景 ────────────
  function drawBg(ctx, cx, cy, cw, ch, R, rot, layer) {
    ctx.save()
    ctx.globalAlpha = layer.opacity ?? 1
    const c1 = layer.color1 ?? '#1a1a2e'
    const c2 = layer.color2 ?? '#0a0818'
    const c3 = layer.color3 ?? null
    const angle = ((layer.gradientAngle ?? 135) * Math.PI) / 180
    const rx = safeR(R.rx), ry = safeR(R.ry)
    const fill = (style) => { ctx.fillStyle = style; ctx.fillRect(0, 0, cw, ch) }

    switch (layer.bgType ?? 'solid') {
      case 'solid':
        fill(c1); break

      case 'linear': case 'linear_diagonal': case 'linear_h': case 'linear_v': {
        const a = layer.bgType==='linear_h' ? 0 : layer.bgType==='linear_v' ? Math.PI/2 : angle
        const dx = Math.cos(a)*rx, dy = Math.sin(a)*ry
        const g = ctx.createLinearGradient(cx-dx, cy-dy, cx+dx, cy+dy)
        c3 ? (g.addColorStop(0,c1),g.addColorStop(.5,c3),g.addColorStop(1,c2))
           : (g.addColorStop(0,c1),g.addColorStop(1,c2))
        fill(g); break
      }
      case 'linear_hard': {
        const sp = layer.hardSplit ?? 0.5
        const g = ctx.createLinearGradient(cx, cy-ry, cx, cy+ry)
        g.addColorStop(0,c1); g.addColorStop(Math.max(0,sp-.001),c1)
        g.addColorStop(Math.min(1,sp),c2); g.addColorStop(1,c2)
        fill(g); break
      }
      case 'radial': {
        const g = ctx.createRadialGradient(cx,cy,0,cx,cy,safeR(Math.max(rx,ry)))
        g.addColorStop(0,c1); g.addColorStop(1,c2); fill(g); break
      }
      case 'radial_offcenter': {
        const ox=(layer.radialOX??0)*rx/100, oy=(layer.radialOY??-40)*ry/100
        const g = ctx.createRadialGradient(cx+ox,cy+oy,0,cx,cy,safeR(Math.max(rx,ry)*1.2))
        g.addColorStop(0,c1); g.addColorStop(1,c2); fill(g); break
      }
      case 'radial_hex': {
        fill(c2)
        for (let i=12; i>=0; i--) {
          const t = i/12
          tracePath(ctx, hexPoints(cx,cy,rx*t,ry*t,rot))
          ctx.fillStyle = blendHex(c1,c2,1-t); ctx.fill()
        }
        break
      }
      case 'conical': {
        for (let i=0; i<360; i++) {
          const a1=Math.PI*2*i/360, a2=Math.PI*2*(i+1)/360
          ctx.beginPath(); ctx.moveTo(cx,cy)
          ctx.arc(cx,cy,Math.max(rx,ry)*1.5,a1,a2); ctx.closePath()
          ctx.fillStyle=blendHex(c1,c2,i/360); ctx.fill()
        }
        break
      }
      case 'pattern_hex': {
        fill(c1)
        const hs = layer.patternSize ?? 20
        ctx.strokeStyle=c2; ctx.lineWidth=1.5
        for (let row=-2; row<ch/hs+2; row++) {
          for (let col=-2; col<cw/(hs*1.732)+2; col++) {
            const hx=col*hs*1.732+(row%2)*hs*.866, hy=row*hs*1.5
            ctx.beginPath()
            for (let k=0;k<6;k++) {
              const ka=(Math.PI/3)*k-Math.PI/6
              k===0?ctx.moveTo(hx+hs*Math.cos(ka),hy+hs*Math.sin(ka))
                   :ctx.lineTo(hx+hs*Math.cos(ka),hy+hs*Math.sin(ka))
            }
            ctx.closePath(); ctx.stroke()
          }
        }
        break
      }
      case 'pattern_stripe': {
        fill(c1)
        const sz = layer.patternSize ?? 20; ctx.fillStyle=c2
        for (let x=-ch; x<cw+ch; x+=sz*2) {
          ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x+sz,0)
          ctx.lineTo(x+sz-ch,ch); ctx.lineTo(x-ch,ch)
          ctx.closePath(); ctx.fill()
        }
        break
      }
      case 'stars': {
        fill(c1)
        const rng = mulberry32(42)
        for (let i=0; i<140; i++) {
          ctx.beginPath()
          ctx.arc(rng()*cw, rng()*ch, rng()*1.8+.4, 0, Math.PI*2)
          ctx.fillStyle=`rgba(255,255,255,${(rng()*.5+.4).toFixed(2)})`
          ctx.fill()
        }
        break
      }
      case 'arknights': {
        const g=ctx.createRadialGradient(cx,cy*.75,0,cx,cy,safeR(Math.max(rx,ry)*1.1))
        g.addColorStop(0,'#1a2640'); g.addColorStop(.6,'#0d1520'); g.addColorStop(1,'#060c14')
        fill(g)
        ctx.strokeStyle='rgba(100,160,255,0.07)'; ctx.lineWidth=1
        const hs=40
        for (let row=-2; row<ch/hs+2; row++) {
          for (let col=-2; col<cw/(hs*1.732)+2; col++) {
            const hx=col*hs*1.732+(row%2)*hs*.866, hy=row*hs*1.5
            ctx.beginPath()
            for (let k=0;k<6;k++) {
              const ka=(Math.PI/3)*k-Math.PI/6
              k===0?ctx.moveTo(hx+hs*Math.cos(ka),hy+hs*Math.sin(ka))
                   :ctx.lineTo(hx+hs*Math.cos(ka),hy+hs*Math.sin(ka))
            }
            ctx.closePath(); ctx.stroke()
          }
        }
        const halo=ctx.createRadialGradient(cx,cy*.85,0,cx,cy*.85,safeR(Math.max(rx,ry)*.6))
        halo.addColorStop(0,'rgba(80,160,255,0.2)'); halo.addColorStop(1,'rgba(80,160,255,0)')
        ctx.fillStyle=halo; ctx.fillRect(0,0,cw,ch)
        break
      }
      case 'image': {
        if (layer.image) {
          const img=layer.image
          const sc=Math.max(cw/img.naturalWidth, ch/img.naturalHeight)
          ctx.drawImage(img,(cw-img.naturalWidth*sc)/2,(ch-img.naturalHeight*sc)/2,
                        img.naturalWidth*sc,img.naturalHeight*sc)
        }
        break
      }
    }
    ctx.restore()
  }

  // ──────────── 装饰 ────────────
  function drawDecor(ctx, cx, cy, R, rot, layer) {
    ctx.save()
    ctx.globalAlpha = layer.opacity ?? 1
    const color = layer.color ?? '#c8a96e'
    const rx = R.rx, ry = R.ry

    if (layer.decorType === 'image' && layer.image) {
      const img=layer.image
      const sc=Math.max(rx*2/img.naturalWidth, ry*2/img.naturalHeight)
      ctx.drawImage(img, cx-img.naturalWidth*sc/2, cy-img.naturalHeight*sc/2,
                    img.naturalWidth*sc, img.naturalHeight*sc)
      ctx.restore(); return
    }

    ctx.strokeStyle = color
    switch (layer.decorType ?? 'circle_lines') {
      case 'circle_lines':
        ctx.lineWidth = 2
        for (let r=.25; r<.92; r+=.18) {
          ctx.beginPath(); ctx.ellipse(cx,cy,rx*r,ry*r,0,0,Math.PI*2); ctx.stroke()
        }
        break
      case 'cross_lines':
        ctx.lineWidth = 2
        for (let i=0; i<12; i++) {
          const a=(Math.PI/6)*i
          ctx.beginPath(); ctx.moveTo(cx,cy)
          ctx.lineTo(cx+rx*Math.cos(a), cy+ry*Math.sin(a)); ctx.stroke()
        }
        break
      case 'corner_marks':
        ctx.lineWidth = 3
        hexPoints(cx,cy,rx*.9,ry*.9,rot).forEach(([x,y]) => {
          const dx=x-cx, dy=y-cy, len=Math.hypot(dx,dy)
          const nx=dx/len, ny=dy/len
          ctx.beginPath(); ctx.moveTo(x-nx*28,y-ny*28); ctx.lineTo(x+nx*8,y+ny*8); ctx.stroke()
        })
        break
      case 'hex_rings':
        ctx.lineWidth = 2
        for (let r=.3; r<.95; r+=.2) {
          tracePath(ctx, hexPoints(cx,cy,rx*r,ry*r,rot)); ctx.stroke()
        }
        break
    }
    ctx.restore()
  }

  // ──────────── 人物 ────────────
  function drawCharacter(ctx, cx, cy, R3, layer) {
    if (!layer.image) return
    ctx.save()
    ctx.globalAlpha = layer.opacity ?? 1
    const img = layer.image
    const scale = layer.scale ?? 1
    const ox = (layer.offsetX ?? 0) * 2
    const oy = (layer.offsetY ?? 0) * 2
    const fitH = R3.ry * 2 * 1.15 * scale
    const fitW = (img.naturalWidth / img.naturalHeight) * fitH
    ctx.drawImage(img, cx-fitW/2+ox, cy-fitH/2+oy, fitW, fitH)
    ctx.restore()
  }

  // ──────────── 文字 ────────────
  function drawText(ctx, cx, cy, R, layer) {
    if (!layer.text) return
    ctx.save()
    ctx.globalAlpha = layer.opacity ?? 1
    const ox = (layer.offsetX ?? 0) * 2
    const oy = (layer.offsetY ?? 0) * 2
    const fs = (layer.fontSize ?? 24) * 2
    const fontName = layer.font ?? 'Cinzel Decorative'
    ctx.font = `${layer.bold ? 'bold' : ''} ${fs}px "${fontName}", "Noto Serif SC", serif`
    ctx.fillStyle = layer.color ?? '#e8c97a'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const lines = layer.text.split('\n')
    const lineH = fs * 1.3
    const totalH = lines.length * lineH
    lines.forEach((line, i) => {
      ctx.fillText(line, cx + ox, cy + oy - totalH/2 + lineH*i + lineH/2)
    })
    ctx.restore()
  }

  useEffect(() => { draw() }, [draw])

  const previewMax = 460
  const previewScale = Math.min(previewMax/CW, previewMax/CH)

  return (
    <canvas
      ref={canvasRef}
      width={CW}
      height={CH}
      style={{
        width:  CW * previewScale,
        height: CH * previewScale,
        filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.85))',
      }}
    />
  )
})

export default BadgeCanvas
