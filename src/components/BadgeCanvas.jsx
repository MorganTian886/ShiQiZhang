import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'

// 5.2cm x 6cm @ 300dpi
const PRINT_W = 614
const PRINT_H = 709
const SCALE = 2
const CW = PRINT_W * SCALE
const CH = PRINT_H * SCALE

function hexPoints(cx, cy, rx, ry, rot = -Math.PI / 6) {
  const pts = []
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + rot
    pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)])
  }
  return pts
}

function drawHex(ctx, cx, cy, rx, ry, rot = -Math.PI / 6) {
  const pts = hexPoints(cx, cy, rx, ry, rot)
  ctx.beginPath()
  pts.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y))
  ctx.closePath()
}

function clipHex(ctx, cx, cy, rx, ry, rot) {
  drawHex(ctx, cx, cy, rx, ry, rot)
  ctx.clip()
}

const BadgeCanvas = forwardRef(function BadgeCanvas({ config, layers }, ref) {
  const canvasRef = useRef(null)

  useImperativeHandle(ref, () => ({
    exportPNG: () => canvasRef.current?.toDataURL('image/png') ?? null
  }))

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, CW, CH)

    const cx = CW / 2
    const cy = CH / 2
    const rot = -Math.PI / 6

    // 边框参数（全部可配置）
    const outerW = (config.outerBorderWidth ?? 16) * SCALE / 2
    const gapW = (config.gapWidth ?? 12) * SCALE / 2
    const innerW = (config.innerBorderWidth ?? 6) * SCALE / 2
    const innerLineW = (config.innerLineWidth ?? 2) * SCALE / 2

    // 从外到内的半径
    const outerRX = CW * 0.472
    const outerRY = CH * 0.472
    const gapStartRX = outerRX - outerW
    const gapStartRY = outerRY - outerW
    const innerBorderRX = gapStartRX - gapW
    const innerBorderRY = gapStartRY - gapW
    const contentRX = innerBorderRX - innerW
    const contentRY = innerBorderRY - innerW
    const innerLineRX = contentRX - 10
    const innerLineRY = contentRY - 10

    const outerColor = config.outerBorderColor ?? '#1a1628'
    const gapColor = config.gapColor ?? '#e8e0d0'
    const innerBorderColor = config.innerBorderColor ?? '#c8a96e'

    // ── 排序图层（按z-index）──
    const sortedLayers = [...(layers || [])].sort((a, b) => a.zIndex - b.zIndex)

    // ── 先画"内容区以下"的图层（背景、装饰等，被内框clip）──
    ctx.save()
    drawHex(ctx, cx, cy, contentRX, contentRY, rot)
    ctx.clip()

    for (const layer of sortedLayers) {
      if (!layer.visible) continue
      if (layer.type === 'background') drawBackgroundLayer(ctx, cx, cy, CW, CH, layer)
      if (layer.type === 'decoration') drawDecorationLayer(ctx, cx, cy, contentRX, contentRY, rot, layer)
      if (layer.type === 'text' && layer.insideFrame) drawTextLayer(ctx, cx, cy, contentRX, contentRY, layer)
    }
    ctx.restore()

    // ── 人物图层（破框：不clip内框，但后续外框会盖住边缘）──
    for (const layer of sortedLayers) {
      if (!layer.visible) continue
      if (layer.type === 'character') drawCharacterLayer(ctx, cx, cy, contentRX, contentRY, layer)
    }

    // ── 画边框（遮住人物破框的边缘部分）──

    // 1. 最外六边形深色框
    ctx.save()
    drawHex(ctx, cx, cy, outerRX, outerRY, rot)
    ctx.fillStyle = outerColor
    ctx.fill()
    // 挖空内部（gap区域开始）
    ctx.globalCompositeOperation = 'destination-out'
    drawHex(ctx, cx, cy, gapStartRX, gapStartRY, rot)
    ctx.fill()
    ctx.restore()

    // 2. gap区域（白色/浅色带）
    ctx.save()
    drawHex(ctx, cx, cy, gapStartRX, gapStartRY, rot)
    ctx.fillStyle = gapColor
    ctx.fill()
    ctx.globalCompositeOperation = 'destination-out'
    drawHex(ctx, cx, cy, innerBorderRX, innerBorderRY, rot)
    ctx.fill()
    ctx.restore()

    // 3. 内金框
    ctx.save()
    drawHex(ctx, cx, cy, innerBorderRX, innerBorderRY, rot)
    const goldGrad = ctx.createLinearGradient(cx - innerBorderRX, cy - innerBorderRY, cx + innerBorderRX, cy + innerBorderRY)
    goldGrad.addColorStop(0, '#f0d890')
    goldGrad.addColorStop(0.25, '#c8a96e')
    goldGrad.addColorStop(0.5, '#e8c97a')
    goldGrad.addColorStop(0.75, '#a07840')
    goldGrad.addColorStop(1, '#d4b060')
    ctx.fillStyle = goldGrad
    ctx.fill()
    ctx.globalCompositeOperation = 'destination-out'
    drawHex(ctx, cx, cy, contentRX, contentRY, rot)
    ctx.fill()
    ctx.restore()

    // 4. 内框内细线
    ctx.save()
    drawHex(ctx, cx, cy, innerLineRX, innerLineRY, rot)
    ctx.strokeStyle = 'rgba(200,169,110,0.5)'
    ctx.lineWidth = innerLineW
    ctx.stroke()
    ctx.restore()

    // 5. 角点装饰圆钉
    const dotRX = (gapStartRX + innerBorderRX) / 2
    const dotRY = (gapStartRY + innerBorderRY) / 2
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + rot
      const x = cx + dotRX * Math.cos(a)
      const y = cy + dotRY * Math.sin(a)
      ctx.save()
      ctx.beginPath()
      ctx.arc(x, y, 6, 0, Math.PI * 2)
      ctx.fillStyle = '#c8a96e'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x, y, 3.5, 0, Math.PI * 2)
      ctx.fillStyle = '#f0d890'
      ctx.fill()
      ctx.restore()
    }

    // ── 文字图层（在边框上方，不在内框内的）──
    for (const layer of sortedLayers) {
      if (!layer.visible) continue
      if (layer.type === 'text' && !layer.insideFrame) drawTextLayer(ctx, cx, cy, contentRX, contentRY, layer)
      if (layer.type === 'text' && layer.position === 'badge') drawBadgeText(ctx, cx, cy, contentRY, innerBorderRY, layer)
    }

  }, [config, layers])

  // ── 背景图层 ──
  function drawBackgroundLayer(ctx, cx, cy, cw, ch, layer) {
    ctx.save()
    ctx.globalAlpha = layer.opacity ?? 1
    switch (layer.bgType) {
      case 'gradient': {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, cw * 0.5)
        g.addColorStop(0, layer.color1 ?? '#2a1f4e')
        g.addColorStop(1, layer.color2 ?? '#0a0818')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, cw, ch)
        break
      }
      case 'linear': {
        const g = ctx.createLinearGradient(0, 0, cw, ch)
        g.addColorStop(0, layer.color1 ?? '#1a1a2e')
        g.addColorStop(1, layer.color2 ?? '#16213e')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, cw, ch)
        break
      }
      case 'solid': {
        ctx.fillStyle = layer.color1 ?? '#1a1a2e'
        ctx.fillRect(0, 0, cw, ch)
        break
      }
      case 'image': {
        if (layer.image) {
          const img = layer.image
          const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight)
          const iw = img.naturalWidth * scale
          const ih = img.naturalHeight * scale
          ctx.drawImage(img, (cw - iw) / 2, (ch - ih) / 2, iw, ih)
        }
        break
      }
      case 'stars': {
        ctx.fillStyle = layer.color1 ?? '#0a0818'
        ctx.fillRect(0, 0, cw, ch)
        // 星星
        const rng = mulberry32(42)
        for (let i = 0; i < 120; i++) {
          const x = rng() * cw
          const y = rng() * ch
          const r = rng() * 1.5 + 0.5
          const a = rng() * 0.6 + 0.4
          ctx.beginPath()
          ctx.arc(x, y, r, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255,255,255,${a})`
          ctx.fill()
        }
        break
      }
      case 'grid': {
        ctx.fillStyle = layer.color1 ?? '#0d1117'
        ctx.fillRect(0, 0, cw, ch)
        const gridSize = 28
        ctx.strokeStyle = layer.color2 ?? 'rgba(100,180,255,0.12)'
        ctx.lineWidth = 1
        for (let x = 0; x < cw; x += gridSize) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ch); ctx.stroke()
        }
        for (let y = 0; y < ch; y += gridSize) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke()
        }
        break
      }
      case 'rays': {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, cw * 0.5)
        g.addColorStop(0, layer.color1 ?? '#1e1040')
        g.addColorStop(1, layer.color2 ?? '#080612')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, cw, ch)
        const rCount = 20
        for (let i = 0; i < rCount; i++) {
          const a = (Math.PI * 2 / rCount) * i
          const rg = ctx.createLinearGradient(cx, cy, cx + Math.cos(a) * cw, cy + Math.sin(a) * ch)
          rg.addColorStop(0, 'rgba(200,169,110,0.12)')
          rg.addColorStop(1, 'rgba(200,169,110,0)')
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.arc(cx, cy, cw, a - Math.PI / rCount, a + Math.PI / rCount)
          ctx.closePath()
          ctx.fillStyle = rg
          ctx.fill()
        }
        break
      }
      case 'arknights': {
        // 明日方舟风格：深蓝黑+科技线
        const g = ctx.createRadialGradient(cx, cy * 0.7, 0, cx, cy, cw * 0.55)
        g.addColorStop(0, '#1a2640')
        g.addColorStop(0.5, '#0d1520')
        g.addColorStop(1, '#060c14')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, cw, ch)
        // 六边形蜂巢网格
        ctx.strokeStyle = 'rgba(100,160,255,0.07)'
        ctx.lineWidth = 1
        const hs = 20
        for (let row = -2; row < ch / hs + 2; row++) {
          for (let col = -2; col < cw / (hs * 1.732) + 2; col++) {
            const hx = col * hs * 1.732 + (row % 2) * hs * 0.866
            const hy = row * hs * 1.5
            ctx.beginPath()
            for (let k = 0; k < 6; k++) {
              const ka = (Math.PI / 3) * k - Math.PI / 6
              const kx = hx + hs * Math.cos(ka)
              const ky = hy + hs * Math.sin(ka)
              k === 0 ? ctx.moveTo(kx, ky) : ctx.lineTo(kx, ky)
            }
            ctx.closePath()
            ctx.stroke()
          }
        }
        // 中心光晕
        const halo = ctx.createRadialGradient(cx, cy * 0.85, 0, cx, cy * 0.85, cw * 0.35)
        halo.addColorStop(0, 'rgba(80,160,255,0.18)')
        halo.addColorStop(1, 'rgba(80,160,255,0)')
        ctx.fillStyle = halo
        ctx.fillRect(0, 0, cw, ch)
        break
      }
    }
    ctx.restore()
  }

  // ── 装饰图层 ──
  function drawDecorationLayer(ctx, cx, cy, rx, ry, rot, layer) {
    ctx.save()
    ctx.globalAlpha = layer.opacity ?? 1
    switch (layer.decorType) {
      case 'laurel': {
        // 月桂叶简化版
        drawLaurel(ctx, cx, cy, rx * 0.88, ry * 0.88, layer.color ?? '#c8a96e')
        break
      }
      case 'circle_lines': {
        ctx.strokeStyle = layer.color ?? 'rgba(200,169,110,0.3)'
        ctx.lineWidth = 1
        for (let r = rx * 0.3; r < rx * 0.85; r += 30) {
          ctx.beginPath()
          ctx.arc(cx, cy, r, 0, Math.PI * 2)
          ctx.stroke()
        }
        break
      }
      case 'cross_lines': {
        ctx.strokeStyle = layer.color ?? 'rgba(100,160,255,0.2)'
        ctx.lineWidth = 1
        for (let i = 0; i < 12; i++) {
          const a = (Math.PI / 6) * i
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.lineTo(cx + rx * Math.cos(a), cy + ry * Math.sin(a))
          ctx.stroke()
        }
        break
      }
      case 'corner_marks': {
        // 六角顶点装饰线
        ctx.strokeStyle = layer.color ?? 'rgba(200,169,110,0.5)'
        ctx.lineWidth = 2
        const pts = hexPoints(cx, cy, rx * 0.9, ry * 0.9, rot)
        pts.forEach(([x, y]) => {
          const dx = x - cx, dy = y - cy
          const len = Math.sqrt(dx * dx + dy * dy)
          const nx = dx / len, ny = dy / len
          ctx.beginPath()
          ctx.moveTo(x - nx * 20, y - ny * 20)
          ctx.lineTo(x + nx * 5, y + ny * 5)
          ctx.stroke()
        })
        break
      }
    }
    ctx.restore()
  }

  // ── 月桂叶 ──
  function drawLaurel(ctx, cx, cy, rx, ry, color) {
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    const leafCount = 8
    // 左侧
    for (let i = 0; i < leafCount; i++) {
      const t = (i / (leafCount - 1)) * Math.PI * 0.7 + Math.PI * 0.65
      const bx = cx + rx * Math.cos(t) * 0.55
      const by = cy + ry * Math.sin(t)
      ctx.save()
      ctx.translate(bx, by)
      ctx.rotate(t + Math.PI / 2)
      ctx.beginPath()
      ctx.ellipse(0, 0, 5, 12, 0, 0, Math.PI * 2)
      ctx.strokeStyle = color
      ctx.stroke()
      ctx.restore()
    }
    // 右侧
    for (let i = 0; i < leafCount; i++) {
      const t = (i / (leafCount - 1)) * Math.PI * 0.7 + Math.PI * 1.65
      const bx = cx + rx * Math.cos(t) * 0.55
      const by = cy + ry * Math.sin(t)
      ctx.save()
      ctx.translate(bx, by)
      ctx.rotate(t + Math.PI / 2)
      ctx.beginPath()
      ctx.ellipse(0, 0, 5, 12, 0, 0, Math.PI * 2)
      ctx.strokeStyle = color
      ctx.stroke()
      ctx.restore()
    }
  }

  // ── 人物图层 ──
  function drawCharacterLayer(ctx, cx, cy, rx, ry, layer) {
    if (!layer.image) return
    ctx.save()
    ctx.globalAlpha = layer.opacity ?? 1
    const img = layer.image
    const scale = layer.scale ?? 1
    const ox = (layer.offsetX ?? 0) * SCALE / 2
    const oy = (layer.offsetY ?? 0) * SCALE / 2
    const fitH = CH * 0.88 * scale
    const fitW = (img.naturalWidth / img.naturalHeight) * fitH
    ctx.drawImage(img, cx - fitW / 2 + ox, cy - fitH / 2 + oy + CH * 0.03, fitW, fitH)
    ctx.restore()
  }

  // ── 文字标牌图层 ──
  function drawBadgeText(ctx, cx, cy, contentRY, innerRY, layer) {
    if (!layer.text) return
    ctx.save()
    const badgeW = (layer.badgeWidth ?? 180) * SCALE / 2
    const badgeH = 26 * SCALE / 2
    let by = cy + contentRY * 0.84
    if (layer.position === 'badge_top') by = cy - contentRY * 0.84
    const bx = cx + (layer.offsetX ?? 0) * SCALE / 2

    // 标牌背景
    const bg = ctx.createLinearGradient(bx - badgeW / 2, by, bx + badgeW / 2, by)
    bg.addColorStop(0, '#12101e')
    bg.addColorStop(0.5, '#1e1a30')
    bg.addColorStop(1, '#12101e')
    ctx.fillStyle = bg
    roundRect(ctx, bx - badgeW / 2, by - badgeH / 2, badgeW, badgeH, 3)
    ctx.fill()
    ctx.strokeStyle = layer.borderColor ?? '#c8a96e'
    ctx.lineWidth = 1.5
    roundRect(ctx, bx - badgeW / 2, by - badgeH / 2, badgeW, badgeH, 3)
    ctx.stroke()

    // 标牌文字
    const fontSize = Math.min(16 * SCALE / 2, (badgeW - 24) / (layer.text.length || 1) * 1.6)
    ctx.font = `${layer.bold ? 'bold' : ''} ${fontSize}px "Cinzel Decorative", "Noto Serif SC", serif`
    ctx.fillStyle = layer.color ?? '#e8c97a'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(layer.text, bx, by)
    ctx.restore()
  }

  function drawTextLayer(ctx, cx, cy, rx, ry, layer) {
    if (!layer.text) return
    ctx.save()
    ctx.globalAlpha = layer.opacity ?? 1
    const fs = (layer.fontSize ?? 18) * SCALE / 2
    ctx.font = `${layer.bold ? 'bold' : ''} ${fs}px "${layer.font ?? 'Cinzel Decorative'}", "Noto Serif SC", serif`
    ctx.fillStyle = layer.color ?? '#e8c97a'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const ox = (layer.offsetX ?? 0) * SCALE / 2
    const oy = (layer.offsetY ?? 0) * SCALE / 2
    ctx.fillText(layer.text, cx + ox, cy + oy)
    ctx.restore()
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h - r)
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
    ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r)
    ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r)
    ctx.closePath()
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0
      let t = Math.imul(a ^ a >>> 15, 1 | a)
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
      return ((t ^ t >>> 14) >>> 0) / 4294967296
    }
  }

  useEffect(() => { draw() }, [draw])

  return (
    <canvas
      ref={canvasRef}
      width={CW}
      height={CH}
      style={{
        width: PRINT_W * 0.52,
        height: PRINT_H * 0.52,
        filter: 'drop-shadow(0 12px 40px rgba(0,0,0,0.9))',
      }}
    />
  )
})

export default BadgeCanvas
export { PRINT_W, PRINT_H }
