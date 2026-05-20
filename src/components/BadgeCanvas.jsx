import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'

// 300dpi基准：1cm = 118px
const DPI_SCALE = 118

// 六边形顶点（rx/ry独立控制，实现拉伸）
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
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

function blendHex(c1, c2, t) {
  try {
    const [r1,g1,b1] = hexToRgb(c1), [r2,g2,b2] = hexToRgb(c2)
    return `rgb(${Math.round(r1+(r2-r1)*t)},${Math.round(g1+(g2-g1)*t)},${Math.round(b1+(b2-b1)*t)})`
  } catch { return c1 }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y)
  ctx.arcTo(x+w,y,x+w,y+r,r); ctx.lineTo(x+w,y+h-r)
  ctx.arcTo(x+w,y+h,x+w-r,y+h,r); ctx.lineTo(x+r,y+h)
  ctx.arcTo(x,y+h,x,y+h-r,r); ctx.lineTo(x,y+r)
  ctx.arcTo(x,y,x+r,y,r); ctx.closePath()
}

const BadgeCanvas = forwardRef(function BadgeCanvas({ config, layers }, ref) {
  const canvasRef = useRef(null)

  // 画布尺寸（cm → px @ 300dpi）
  const cmW = config.canvasW ?? 5.2
  const cmH = config.canvasH ?? 6.0
  const CW = Math.round(cmW * DPI_SCALE)
  const CH = Math.round(cmH * DPI_SCALE)

  useImperativeHandle(ref, () => ({
    exportPNG: () => canvasRef.current?.toDataURL('image/png') ?? null,
    getSize: () => ({ cw: CW, ch: CH })
  }))

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = CW
    canvas.height = CH
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, CW, CH)

    const cx = CW / 2
    const cy = CH / 2
    const rot = -Math.PI / 6  // 尖顶朝上

    // 六边形rx/ry独立——画布多宽六边形多宽，多高就多高
    const margin = 0.92
    const baseRx = CW * margin / 2
    const baseRy = CH * margin / 2

    // 边框参数（cm → px）
    const outerW    = (config.outerBorderWidth  ?? 3)  * DPI_SCALE / 10
    const gapW      = (config.gapWidth          ?? 2.5)* DPI_SCALE / 10
    const innerW    = (config.innerBorderWidth   ?? 1.2)* DPI_SCALE / 10
    const innerLineW= (config.innerLineWidth     ?? 0.3)* DPI_SCALE / 10

    // 各层rx/ry（等比缩进，最小值保护防止负数）
    const R0 = { rx: baseRx, ry: baseRy }
    const R1 = { rx: Math.max(1, R0.rx - outerW),    ry: Math.max(1, R0.ry - outerW) }
    const R2 = { rx: Math.max(1, R1.rx - gapW),      ry: Math.max(1, R1.ry - gapW) }
    const R3 = { rx: Math.max(1, R2.rx - innerW),    ry: Math.max(1, R2.ry - innerW) }
    const R4 = { rx: Math.max(1, R3.rx - innerLineW*3), ry: Math.max(1, R3.ry - innerLineW*3) }

    const outerColor = config.outerBorderColor  ?? '#1a1628'
    const gapColor   = config.gapColor          ?? '#e8e0d0'

    const sorted = [...(layers || [])].sort((a, b) => a.zIndex - b.zIndex)

    // ── 1. 内容区背景+装饰（clip到R3）──
    ctx.save()
    tracePath(ctx, hexPoints(cx, cy, R3.rx, R3.ry, rot))
    ctx.clip()
    for (const layer of sorted) {
      if (!layer.visible) continue
      if (layer.type === 'background') drawBg(ctx, cx, cy, CW, CH, R3, rot, layer)
      if (layer.type === 'decoration') drawDecor(ctx, cx, cy, R3, rot, layer)
    }
    ctx.restore()

    // ── 2. 人物（破框）──
    for (const layer of sorted) {
      if (!layer.visible || layer.type !== 'character') continue
      drawCharacter(ctx, cx, cy, R3, CW, CH, layer)
    }

    // ── 3. 边框（盖在破框人物上）──

    // 最外框
    ctx.save()
    tracePath(ctx, hexPoints(cx, cy, R0.rx, R0.ry, rot))
    ctx.fillStyle = outerColor; ctx.fill()
    ctx.globalCompositeOperation = 'destination-out'
    tracePath(ctx, hexPoints(cx, cy, R1.rx, R1.ry, rot))
    ctx.fill()
    ctx.restore()

    // gap带
    ctx.save()
    tracePath(ctx, hexPoints(cx, cy, R1.rx, R1.ry, rot))
    ctx.fillStyle = gapColor; ctx.fill()
    ctx.globalCompositeOperation = 'destination-out'
    tracePath(ctx, hexPoints(cx, cy, R2.rx, R2.ry, rot))
    ctx.fill()
    ctx.restore()

    // 内框
    ctx.save()
    tracePath(ctx, hexPoints(cx, cy, R2.rx, R2.ry, rot))
    const ic1 = config.innerBorderColor1 ?? '#f5e090'
    const ic2 = config.innerBorderColor2 ?? '#9a7235'
    if (config.innerBorderSolid) {
      ctx.fillStyle = ic1
    } else {
      const g = ctx.createLinearGradient(cx-R2.rx, cy-R2.ry, cx+R2.rx, cy+R2.ry)
      g.addColorStop(0, ic1); g.addColorStop(0.4, ic2); g.addColorStop(1, ic1)
      ctx.fillStyle = g
    }
    ctx.fill()
    ctx.globalCompositeOperation = 'destination-out'
    tracePath(ctx, hexPoints(cx, cy, R3.rx, R3.ry, rot))
    ctx.fill()
    ctx.restore()

    // 内细线
    if (innerLineW > 0) {
      ctx.save()
      tracePath(ctx, hexPoints(cx, cy, R4.rx, R4.ry, rot))
      ctx.strokeStyle = config.innerLineColor ?? 'rgba(200,169,110,0.45)'
      ctx.lineWidth = innerLineW
      ctx.stroke()
      ctx.restore()
    }

    // ── 4. 文字（最顶层）──
    for (const layer of sorted) {
      if (!layer.visible || layer.type !== 'text') continue
      drawText(ctx, cx, cy, R3, layer)
    }

  }, [config, layers, CW, CH])

  // ──────────── 背景渲染 ────────────
  function drawBg(ctx, cx, cy, cw, ch, R, rot, layer) {
    ctx.save()
    ctx.globalAlpha = layer.opacity ?? 1
    const c1 = layer.color1 ?? '#1a1a2e'
    const c2 = layer.color2 ?? '#0a0818'
    const c3 = layer.color3 ?? null
    const angle = ((layer.gradientAngle ?? 135) * Math.PI) / 180
    const rx = R.rx, ry = R.ry

    const fillGrad = (g) => { ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch) }

    switch (layer.bgType) {
      case 'solid':
        ctx.fillStyle = c1; ctx.fillRect(0, 0, cw, ch); break

      case 'linear': case 'linear_diagonal': case 'linear_h': case 'linear_v': {
        const a = layer.bgType === 'linear_h' ? 0
                : layer.bgType === 'linear_v' ? Math.PI/2 : angle
        const dx = Math.cos(a)*rx, dy = Math.sin(a)*ry
        const g = ctx.createLinearGradient(cx-dx, cy-dy, cx+dx, cy+dy)
        if (c3) { g.addColorStop(0,c1); g.addColorStop(0.5,c3); g.addColorStop(1,c2) }
        else { g.addColorStop(0,c1); g.addColorStop(1,c2) }
        fillGrad(g); break
      }
      case 'linear_hard': {
        const sp = layer.hardSplit ?? 0.5
        const g = ctx.createLinearGradient(cx, cy-ry, cx, cy+ry)
        g.addColorStop(0,c1); g.addColorStop(sp-0.001,c1)
        g.addColorStop(sp,c2); g.addColorStop(1,c2)
        fillGrad(g); break
      }
      case 'radial': {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, Math.max(rx,ry)))
        g.addColorStop(0,c1); g.addColorStop(1,c2); fillGrad(g); break
      }
      case 'radial_offcenter': {
        const ox = (layer.radialOX ?? 0)*rx/100
        const oy = (layer.radialOY ?? -40)*ry/100
        const g = ctx.createRadialGradient(cx+ox,cy+oy,0,cx,cy,Math.max(1, Math.max(rx,ry)*1.2))
        g.addColorStop(0,c1); g.addColorStop(1,c2); fillGrad(g); break
      }
      case 'radial_hex': {
        ctx.fillStyle = c2; ctx.fillRect(0,0,cw,ch)
        for (let i = 12; i >= 0; i--) {
          const t = i/12
          tracePath(ctx, hexPoints(cx, cy, rx*t, ry*t, rot))
          ctx.fillStyle = blendHex(c1, c2, 1-t); ctx.fill()
        }
        break
      }
      case 'conical': {
        const steps = 360
        for (let i = 0; i < steps; i++) {
          const a1 = Math.PI*2*i/steps, a2 = Math.PI*2*(i+1)/steps
          ctx.beginPath(); ctx.moveTo(cx,cy)
          ctx.arc(cx,cy,Math.max(rx,ry)*1.5,a1,a2); ctx.closePath()
          ctx.fillStyle = blendHex(c1,c2,i/steps); ctx.fill()
        }
        break
      }
      case 'pattern_hex': {
        ctx.fillStyle = c1; ctx.fillRect(0,0,cw,ch)
        const hs = (layer.patternSize ?? 16)
        ctx.strokeStyle = c2; ctx.lineWidth = 1.5
        for (let row=-2; row<ch/hs+2; row++) {
          for (let col=-2; col<cw/(hs*1.732)+2; col++) {
            const hx=col*hs*1.732+(row%2)*hs*0.866, hy=row*hs*1.5
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
        ctx.fillStyle = c1; ctx.fillRect(0,0,cw,ch)
        const sz = layer.patternSize ?? 12
        ctx.fillStyle = c2
        for (let x=-ch; x<cw+ch; x+=sz*2) {
          ctx.beginPath()
          ctx.moveTo(x,0); ctx.lineTo(x+sz,0)
          ctx.lineTo(x+sz-ch,ch); ctx.lineTo(x-ch,ch)
          ctx.closePath(); ctx.fill()
        }
        break
      }
      case 'stars': {
        ctx.fillStyle = c1; ctx.fillRect(0,0,cw,ch)
        const rng = mulberry32(42)
        for (let i=0; i<140; i++) {
          ctx.beginPath()
          ctx.arc(rng()*cw, rng()*ch, rng()*1.8+0.4, 0, Math.PI*2)
          ctx.fillStyle = `rgba(255,255,255,${(rng()*0.5+0.4).toFixed(2)})`
          ctx.fill()
        }
        break
      }
      case 'arknights': {
        const g = ctx.createRadialGradient(cx,cy*0.75,0,cx,cy,Math.max(1, Math.max(rx,ry)*1.1))
        g.addColorStop(0,'#1a2640'); g.addColorStop(0.6,'#0d1520'); g.addColorStop(1,'#060c14')
        ctx.fillStyle = g; ctx.fillRect(0,0,cw,ch)
        ctx.strokeStyle = 'rgba(100,160,255,0.07)'; ctx.lineWidth = 1
        const hs = 20
        for (let row=-2; row<ch/hs+2; row++) {
          for (let col=-2; col<cw/(hs*1.732)+2; col++) {
            const hx=col*hs*1.732+(row%2)*hs*0.866, hy=row*hs*1.5
            ctx.beginPath()
            for (let k=0;k<6;k++) {
              const ka=(Math.PI/3)*k-Math.PI/6
              k===0?ctx.moveTo(hx+hs*Math.cos(ka),hy+hs*Math.sin(ka))
                   :ctx.lineTo(hx+hs*Math.cos(ka),hy+hs*Math.sin(ka))
            }
            ctx.closePath(); ctx.stroke()
          }
        }
        const halo = ctx.createRadialGradient(cx,cy*0.85,0,cx,cy*0.85,Math.max(1, Math.max(rx,ry)*0.6))
        halo.addColorStop(0,'rgba(80,160,255,0.2)'); halo.addColorStop(1,'rgba(80,160,255,0)')
        ctx.fillStyle = halo; ctx.fillRect(0,0,cw,ch)
        break
      }
      case 'image': {
        if (layer.image) {
          const img = layer.image
          const s = Math.max(cw/img.naturalWidth, ch/img.naturalHeight)
          ctx.drawImage(img,(cw-img.naturalWidth*s)/2,(ch-img.naturalHeight*s)/2,img.naturalWidth*s,img.naturalHeight*s)
        }
        break
      }
    }
    ctx.restore()
  }

  // ──────────── 装饰渲染 ────────────
  function drawDecor(ctx, cx, cy, R, rot, layer) {
    ctx.save()
    ctx.globalAlpha = layer.opacity ?? 1
    const color = layer.color ?? 'rgba(200,169,110,0.4)'
    const rx = R.rx, ry = R.ry

    if (layer.decorType === 'image' && layer.image) {
      // 装饰图片：全图平铺在内容区，可调透明度
      const img = layer.image
      const s = Math.max(rx*2/img.naturalWidth, ry*2/img.naturalHeight)
      ctx.drawImage(img, cx-img.naturalWidth*s/2, cy-img.naturalHeight*s/2, img.naturalWidth*s, img.naturalHeight*s)
      ctx.restore(); return
    }

    switch (layer.decorType) {
      case 'circle_lines':
        ctx.strokeStyle = color; ctx.lineWidth = 1.5
        for (let r=0.25; r<0.92; r+=0.18) {
          ctx.beginPath(); ctx.ellipse(cx,cy,rx*r,ry*r,0,0,Math.PI*2); ctx.stroke()
        }
        break
      case 'cross_lines':
        ctx.strokeStyle = color; ctx.lineWidth = 1.5
        for (let i=0; i<12; i++) {
          const a=(Math.PI/6)*i
          ctx.beginPath(); ctx.moveTo(cx,cy)
          ctx.lineTo(cx+rx*Math.cos(a),cy+ry*Math.sin(a)); ctx.stroke()
        }
        break
      case 'corner_marks':
        ctx.strokeStyle = color; ctx.lineWidth = 2
        hexPoints(cx,cy,rx*0.92,ry*0.92,rot).forEach(([x,y])=>{
          const dx=x-cx,dy=y-cy,len=Math.hypot(dx,dy)
          const nx=dx/len,ny=dy/len
          ctx.beginPath()
          ctx.moveTo(x-nx*20,y-ny*20); ctx.lineTo(x+nx*8,y+ny*8); ctx.stroke()
        })
        break
      case 'hex_rings':
        ctx.strokeStyle = color; ctx.lineWidth = 1.5
        for (let r=0.3; r<0.95; r+=0.2) {
          tracePath(ctx, hexPoints(cx,cy,rx*r,ry*r,rot)); ctx.stroke()
        }
        break
    }
    ctx.restore()
  }

  // ──────────── 人物渲染 ────────────
  function drawCharacter(ctx, cx, cy, R, cw, ch, layer) {
    if (!layer.image) return
    ctx.save()
    ctx.globalAlpha = layer.opacity ?? 1
    const img = layer.image
    const scale = layer.scale ?? 1
    const ox = (layer.offsetX ?? 0) * (cw / 520)
    const oy = (layer.offsetY ?? 0) * (ch / 600)
    const fitH = ch * 0.88 * scale
    const fitW = (img.naturalWidth/img.naturalHeight) * fitH
    ctx.drawImage(img, cx-fitW/2+ox, cy-fitH/2+oy+ch*0.03, fitW, fitH)
    ctx.restore()
  }

  // ──────────── 文字渲染 ────────────
  function drawText(ctx, cx, cy, R, layer) {
    if (!layer.text) return
    ctx.save()
    ctx.globalAlpha = layer.opacity ?? 1
    const ox = (layer.offsetX ?? 0)
    const oy = (layer.offsetY ?? 0)
    const rx = R.rx, ry = R.ry

    if (layer.position === 'badge' || layer.position === 'badge_top') {
      const by = layer.position === 'badge_top' ? cy-ry*0.85 : cy+ry*0.85
      const bx = cx+ox
      const bw = (layer.badgeWidth ?? 160)
      const bh = 28
      const bg = ctx.createLinearGradient(bx-bw/2,by,bx+bw/2,by)
      bg.addColorStop(0,'#10101c'); bg.addColorStop(0.5,'#1c1830'); bg.addColorStop(1,'#10101c')
      ctx.fillStyle = bg
      roundRect(ctx,bx-bw/2,by-bh/2,bw,bh,4); ctx.fill()
      ctx.strokeStyle = layer.borderColor ?? '#c8a96e'; ctx.lineWidth = 1.5
      roundRect(ctx,bx-bw/2,by-bh/2,bw,bh,4); ctx.stroke()
      const fs = Math.min(14, (bw-20)/Math.max(layer.text.length,1)*1.5)
      ctx.font = `bold ${fs}px "Cinzel Decorative","Noto Serif SC",serif`
      ctx.fillStyle = layer.color ?? '#e8c97a'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(layer.text, bx, by)
    } else {
      const fs = layer.fontSize ?? 14
      ctx.font = `${layer.bold?'bold':''} ${fs}px "Cinzel Decorative","Noto Serif SC",serif`
      ctx.fillStyle = layer.color ?? '#e8c97a'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(layer.text, cx+ox, cy+oy)
    }
    ctx.restore()
  }

  useEffect(() => { draw() }, [draw])

  // 预览尺寸：最大500px
  const maxPreview = 500
  const previewScale = Math.min(maxPreview/CW, maxPreview/CH)

  return (
    <canvas
      ref={canvasRef}
      width={CW}
      height={CH}
      style={{
        width: CW * previewScale,
        height: CH * previewScale,
        filter: 'drop-shadow(0 12px 40px rgba(0,0,0,0.9))',
      }}
    />
  )
})

export default BadgeCanvas
export { DPI_SCALE }
