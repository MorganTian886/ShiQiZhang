import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'

// 基础边长（300dpi，长边约为1418px）
const BASE = 1418

// 根据宽高比计算画布实际尺寸
function getCanvasSize(config) {
  const aw = config?.aspectW ?? 5.2
  const ah = config?.aspectH ?? 6.0
  if (aw >= ah) {
    return { cw: BASE, ch: Math.round(BASE * ah / aw) }
  } else {
    return { cw: Math.round(BASE * aw / ah), ch: BASE }
  }
}

// 正六边形外接圆半径R（尖顶朝上：宽=R√3，高=2R）
function getHexR(cw, ch) {
  const Rw = (cw * 0.9) / Math.sqrt(3)
  const Rh = (ch * 0.9) / 2
  return Math.min(Rw, Rh)
}

// 正六边形顶点（尖顶朝上，rot=-π/6）
function hexPoints(cx, cy, R, rot = -Math.PI / 6) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i + rot
    return [cx + R * Math.cos(a), cy + R * Math.sin(a)]
  })
}

function tracePath(ctx, pts) {
  ctx.beginPath()
  pts.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y))
  ctx.closePath()
}

const BadgeCanvas = forwardRef(function BadgeCanvas({ config, layers }, ref) {
  const canvasRef = useRef(null)

  useImperativeHandle(ref, () => ({
    exportPNG: () => canvasRef.current?.toDataURL('image/png') ?? null
  }))

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { cw: CW, ch: CH } = getCanvasSize(config)
    canvas.width = CW
    canvas.height = CH
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, CW, CH)

    const cx = CW / 2
    const cy = CH / 2
    const rot = -Math.PI / 6  // 尖顶朝上
    const R = getHexR(CW, CH)

    // 边框参数（单位px，SCALE已含在CW/CH里）
    const outerW   = (config.outerBorderWidth  ?? 18) * 2
    const gapW     = (config.gapWidth          ?? 14) * 2
    const innerW   = (config.innerBorderWidth   ?? 7)  * 2
    const innerLineW = (config.innerLineWidth   ?? 1.5) * 2

    // 各层半径
    const R0 = R                        // 最外框外边缘
    const R1 = R0 - outerW              // 最外框内边缘 = gap外边缘
    const R2 = R1 - gapW               // gap内边缘 = 金框外边缘
    const R3 = R2 - innerW             // 金框内边缘 = 内容区外边缘
    const R4 = R3 - innerLineW * 3     // 内细线

    const outerColor = config.outerBorderColor ?? '#1a1628'
    const gapColor   = config.gapColor         ?? '#e8e0d0'

    // ── 排序图层 ──
    const sorted = [...(layers || [])].sort((a, b) => a.zIndex - b.zIndex)

    // ── 1. 内容区（clip到R3，画背景+装饰）──
    ctx.save()
    tracePath(ctx, hexPoints(cx, cy, R3, rot))
    ctx.clip()
    for (const layer of sorted) {
      if (!layer.visible) continue
      if (layer.type === 'background')  drawBg(ctx, cx, cy, CW, CH, R3, rot, layer)
      if (layer.type === 'decoration')  drawDecor(ctx, cx, cy, R3, rot, layer)
    }
    ctx.restore()

    // ── 2. 人物（破框：不clip内容区）──
    for (const layer of sorted) {
      if (!layer.visible || layer.type !== 'character') continue
      drawCharacter(ctx, cx, cy, R3, layer)
    }

    // ── 3. 绘制边框（盖在人物破框部分上方）──

    // 最外框（深色）
    ctx.save()
    tracePath(ctx, hexPoints(cx, cy, R0, rot))
    ctx.fillStyle = outerColor
    ctx.fill()
    ctx.globalCompositeOperation = 'destination-out'
    tracePath(ctx, hexPoints(cx, cy, R1, rot))
    ctx.fill()
    ctx.restore()

    // gap带（白/浅色）
    ctx.save()
    tracePath(ctx, hexPoints(cx, cy, R1, rot))
    ctx.fillStyle = gapColor
    ctx.fill()
    ctx.globalCompositeOperation = 'destination-out'
    tracePath(ctx, hexPoints(cx, cy, R2, rot))
    ctx.fill()
    ctx.restore()

    // 内框（可配色，默认金色渐变）
    ctx.save()
    tracePath(ctx, hexPoints(cx, cy, R2, rot))
    const innerColor1 = config.innerBorderColor1 ?? '#f5e090'
    const innerColor2 = config.innerBorderColor2 ?? '#9a7235'
    const useGradient = !config.innerBorderSolid
    if (useGradient) {
      const goldGrad = ctx.createLinearGradient(cx - R2, cy - R2, cx + R2, cy + R2)
      goldGrad.addColorStop(0,    innerColor1)
      goldGrad.addColorStop(0.35, config.innerBorderColor1 ?? '#c8a96e')
      goldGrad.addColorStop(0.65, innerColor2)
      goldGrad.addColorStop(1,    innerColor1)
      ctx.fillStyle = goldGrad
    } else {
      ctx.fillStyle = innerColor1
    }
    ctx.fill()
    ctx.globalCompositeOperation = 'destination-out'
    tracePath(ctx, hexPoints(cx, cy, R3, rot))
    ctx.fill()
    ctx.restore()

    // 内细线
    ctx.save()
    tracePath(ctx, hexPoints(cx, cy, R4, rot))
    ctx.strokeStyle = config.innerLineColor ?? 'rgba(200,169,110,0.45)'
    ctx.lineWidth = innerLineW
    ctx.stroke()
    ctx.restore()



    // ── 4. 文字图层（最顶层）──
    for (const layer of sorted) {
      if (!layer.visible || layer.type !== 'text') continue
      drawText(ctx, cx, cy, R3, layer)
    }

  }, [config, layers])

  // ─────────────────── 背景渲染 ───────────────────
  function drawBg(ctx, cx, cy, cw, ch, R, rot, layer) {
    ctx.save()
    ctx.globalAlpha = layer.opacity ?? 1
    const c1 = layer.color1 ?? '#1a1a2e'
    const c2 = layer.color2 ?? '#0a0818'
    const c3 = layer.color3 ?? null
    const angle = ((layer.gradientAngle ?? 135) * Math.PI) / 180

    switch (layer.bgType) {
      case 'solid': {
        ctx.fillStyle = c1
        ctx.fillRect(0, 0, cw, ch)
        break
      }
      case 'linear_diagonal':
      case 'linear_h':
      case 'linear_v':
      case 'linear': {
        const a = layer.bgType === 'linear_h' ? 0
                : layer.bgType === 'linear_v' ? Math.PI / 2
                : angle
        const dx = Math.cos(a) * R, dy = Math.sin(a) * R
        const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy)
        if (c3) {
          g.addColorStop(0, c1); g.addColorStop(0.5, c3); g.addColorStop(1, c2)
        } else {
          g.addColorStop(0, c1); g.addColorStop(1, c2)
        }
        ctx.fillStyle = g
        ctx.fillRect(0, 0, cw, ch)
        break
      }
      case 'linear_hard': {
        // 硬边断层
        const split = (layer.hardSplit ?? 0.5)
        const g = ctx.createLinearGradient(cx, cy - R, cx, cy + R)
        g.addColorStop(0, c1)
        g.addColorStop(split - 0.001, c1)
        g.addColorStop(split, c2)
        g.addColorStop(1, c2)
        ctx.fillStyle = g
        ctx.fillRect(0, 0, cw, ch)
        break
      }
      case 'radial': {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R)
        g.addColorStop(0, c1); g.addColorStop(1, c2)
        ctx.fillStyle = g
        ctx.fillRect(0, 0, cw, ch)
        break
      }
      case 'radial_offcenter': {
        const ox = (layer.radialOX ?? 0) * R / 100
        const oy = (layer.radialOY ?? -40) * R / 100
        const g = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx, cy, R * 1.2)
        g.addColorStop(0, c1); g.addColorStop(1, c2)
        ctx.fillStyle = g
        ctx.fillRect(0, 0, cw, ch)
        break
      }
      case 'radial_hex': {
        // 六边形向心层叠
        ctx.fillStyle = c2
        ctx.fillRect(0, 0, cw, ch)
        const steps = 12
        for (let i = steps; i >= 0; i--) {
          const t = i / steps
          const r = R * t
          const alpha = 1 - t
          tracePath(ctx, hexPoints(cx, cy, r, rot))
          ctx.fillStyle = blendHex(c1, c2, 1 - t)
          ctx.fill()
        }
        break
      }
      case 'conical': {
        // 角度/雷达渐变（分段模拟）
        const steps = 360
        for (let i = 0; i < steps; i++) {
          const a1 = (Math.PI * 2 * i) / steps
          const a2 = (Math.PI * 2 * (i + 1)) / steps
          const t = i / steps
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.arc(cx, cy, R * 1.5, a1, a2)
          ctx.closePath()
          ctx.fillStyle = blendHex(c1, c2, t)
          ctx.fill()
        }
        break
      }
      case 'pattern_hex': {
        // 蜂巢网格色块
        ctx.fillStyle = c1
        ctx.fillRect(0, 0, cw, ch)
        const hs = (layer.patternSize ?? 16) * 2
        ctx.strokeStyle = c2
        ctx.lineWidth = 1.5
        for (let row = -2; row < ch / hs + 2; row++) {
          for (let col = -2; col < cw / (hs * 1.732) + 2; col++) {
            const hx = col * hs * 1.732 + (row % 2) * hs * 0.866
            const hy = row * hs * 1.5
            ctx.beginPath()
            for (let k = 0; k < 6; k++) {
              const ka = (Math.PI / 3) * k - Math.PI / 6
              k === 0 ? ctx.moveTo(hx + hs * Math.cos(ka), hy + hs * Math.sin(ka))
                      : ctx.lineTo(hx + hs * Math.cos(ka), hy + hs * Math.sin(ka))
            }
            ctx.closePath()
            ctx.stroke()
          }
        }
        break
      }
      case 'pattern_stripe': {
        ctx.fillStyle = c1
        ctx.fillRect(0, 0, cw, ch)
        const sz = (layer.patternSize ?? 12) * 2
        ctx.fillStyle = c2
        for (let x = -ch; x < cw + ch; x += sz * 2) {
          ctx.beginPath()
          ctx.moveTo(x, 0); ctx.lineTo(x + sz, 0)
          ctx.lineTo(x + sz - ch, ch); ctx.lineTo(x - ch, ch)
          ctx.closePath(); ctx.fill()
        }
        break
      }
      case 'stars': {
        ctx.fillStyle = c1
        ctx.fillRect(0, 0, cw, ch)
        const rng = mulberry32(42)
        for (let i = 0; i < 140; i++) {
          const x = rng() * cw, y = rng() * ch
          const r = rng() * 1.8 + 0.4
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255,255,255,${(rng() * 0.5 + 0.4).toFixed(2)})`
          ctx.fill()
        }
        break
      }
      case 'arknights': {
        const g = ctx.createRadialGradient(cx, cy * 0.75, 0, cx, cy, R * 1.1)
        g.addColorStop(0, '#1a2640'); g.addColorStop(0.6, '#0d1520'); g.addColorStop(1, '#060c14')
        ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch)
        ctx.strokeStyle = 'rgba(100,160,255,0.07)'; ctx.lineWidth = 1
        const hs = 20 * 2
        for (let row = -2; row < ch / hs + 2; row++) {
          for (let col = -2; col < cw / (hs * 1.732) + 2; col++) {
            const hx = col * hs * 1.732 + (row % 2) * hs * 0.866
            const hy = row * hs * 1.5
            ctx.beginPath()
            for (let k = 0; k < 6; k++) {
              const ka = (Math.PI / 3) * k - Math.PI / 6
              k === 0 ? ctx.moveTo(hx + hs * Math.cos(ka), hy + hs * Math.sin(ka))
                      : ctx.lineTo(hx + hs * Math.cos(ka), hy + hs * Math.sin(ka))
            }
            ctx.closePath(); ctx.stroke()
          }
        }
        const halo = ctx.createRadialGradient(cx, cy * 0.85, 0, cx, cy * 0.85, R * 0.6)
        halo.addColorStop(0, 'rgba(80,160,255,0.2)'); halo.addColorStop(1, 'rgba(80,160,255,0)')
        ctx.fillStyle = halo; ctx.fillRect(0, 0, cw, ch)
        break
      }
      case 'image': {
        if (layer.image) {
          const img = layer.image
          const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight)
          const iw = img.naturalWidth * scale, ih = img.naturalHeight * scale
          ctx.drawImage(img, (cw - iw) / 2, (ch - ih) / 2, iw, ih)
        }
        break
      }
    }
    ctx.restore()
  }

  // ─────────────────── 装饰渲染 ───────────────────
  function drawDecor(ctx, cx, cy, R, rot, layer) {
    ctx.save()
    ctx.globalAlpha = layer.opacity ?? 1
    const color = layer.color ?? 'rgba(200,169,110,0.4)'
    switch (layer.decorType) {
      case 'circle_lines': {
        ctx.strokeStyle = color; ctx.lineWidth = 1.5
        for (let r = R * 0.25; r < R * 0.92; r += R * 0.18) {
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
        }
        break
      }
      case 'cross_lines': {
        ctx.strokeStyle = color; ctx.lineWidth = 1.5
        for (let i = 0; i < 12; i++) {
          const a = (Math.PI / 6) * i
          ctx.beginPath(); ctx.moveTo(cx, cy)
          ctx.lineTo(cx + R * Math.cos(a), cy + R * Math.sin(a)); ctx.stroke()
        }
        break
      }
      case 'corner_marks': {
        ctx.strokeStyle = color; ctx.lineWidth = 2
        hexPoints(cx, cy, R * 0.92, rot).forEach(([x, y]) => {
          const dx = x - cx, dy = y - cy, len = Math.hypot(dx, dy)
          const nx = dx / len, ny = dy / len
          ctx.beginPath()
          ctx.moveTo(x - nx * 28, y - ny * 28)
          ctx.lineTo(x + nx * 8, y + ny * 8)
          ctx.stroke()
        })
        break
      }
      case 'hex_rings': {
        ctx.strokeStyle = color; ctx.lineWidth = 1.5
        for (let r = R * 0.3; r < R * 0.95; r += R * 0.2) {
          tracePath(ctx, hexPoints(cx, cy, r, rot)); ctx.stroke()
        }
        break
      }
    }
    ctx.restore()
  }

  // ─────────────────── 人物渲染 ───────────────────
  function drawCharacter(ctx, cx, cy, R, layer) {
    if (!layer.image) return
    ctx.save()
    ctx.globalAlpha = layer.opacity ?? 1
    const img = layer.image
    const scale = layer.scale ?? 1
    const ox = (layer.offsetX ?? 0) * 2
    const oy = (layer.offsetY ?? 0) * 2
    const fitH = CH * 0.88 * scale
    const fitW = (img.naturalWidth / img.naturalHeight) * fitH
    ctx.drawImage(img, cx - fitW / 2 + ox, cy - fitH / 2 + oy + CH * 0.03, fitW, fitH)
    ctx.restore()
  }

  // ─────────────────── 文字渲染 ───────────────────
  function drawText(ctx, cx, cy, R, layer) {
    if (!layer.text) return
    ctx.save()
    ctx.globalAlpha = layer.opacity ?? 1
    const ox = (layer.offsetX ?? 0) * 2
    const oy = (layer.offsetY ?? 0) * 2

    if (layer.position === 'badge' || layer.position === 'badge_top') {
      const by = layer.position === 'badge_top' ? cy - R * 0.85 : cy + R * 0.85
      const bx = cx + ox
      const bw = (layer.badgeWidth ?? 200) * 2
      const bh = 48
      const bg = ctx.createLinearGradient(bx - bw/2, by, bx + bw/2, by)
      bg.addColorStop(0, '#10101c'); bg.addColorStop(0.5, '#1c1830'); bg.addColorStop(1, '#10101c')
      ctx.fillStyle = bg
      roundRect(ctx, bx - bw/2, by - bh/2, bw, bh, 5); ctx.fill()
      ctx.strokeStyle = layer.borderColor ?? '#c8a96e'
      ctx.lineWidth = 2.5
      roundRect(ctx, bx - bw/2, by - bh/2, bw, bh, 5); ctx.stroke()
      const fs = Math.min(28, (bw - 30) / Math.max(layer.text.length, 1) * 1.5)
      ctx.font = `${layer.bold !== false ? 'bold' : ''} ${fs}px "Cinzel Decorative","Noto Serif SC",serif`
      ctx.fillStyle = layer.color ?? '#e8c97a'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(layer.text, bx, by)
    } else {
      const fs = (layer.fontSize ?? 18) * 2
      ctx.font = `${layer.bold ? 'bold' : ''} ${fs}px "Cinzel Decorative","Noto Serif SC",serif`
      ctx.fillStyle = layer.color ?? '#e8c97a'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(layer.text, cx + ox, cy + oy)
    }
    ctx.restore()
  }

  // ─────────────────── 工具函数 ───────────────────
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r)
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r); ctx.closePath()
  }

  function mulberry32(a) {
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
      const r = Math.round(r1 + (r2 - r1) * t)
      const g = Math.round(g1 + (g2 - g1) * t)
      const b = Math.round(b1 + (b2 - b1) * t)
      return `rgb(${r},${g},${b})`
    } catch { return c1 }
  }

  useEffect(() => { draw() }, [draw])

  const { cw: dispW, ch: dispH } = getCanvasSize(config)
  const maxDisplay = 390
  const dispScale = Math.min(maxDisplay / dispW, maxDisplay / dispH)

  return (
    <canvas
      ref={canvasRef}
      width={dispW}
      height={dispH}
      style={{
        width: dispW * dispScale,
        height: dispH * dispScale,
        filter: 'drop-shadow(0 12px 40px rgba(0,0,0,0.9))',
      }}
    />
  )
})

export default BadgeCanvas
export { getCanvasSize }
