import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'

// 5.2cm x 6cm @ 300dpi => 614 x 709 px (print size)
// 我们在canvas上用2倍渲染，显示时缩小
const PRINT_W = 614
const PRINT_H = 709
const SCALE = 2 // retina
const CW = PRINT_W * SCALE
const CH = PRINT_H * SCALE

function hexPath(ctx, cx, cy, rx, ry, rotation = 0) {
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i + rotation
    const x = cx + rx * Math.cos(angle)
    const y = cy + ry * Math.sin(angle)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

const BadgeCanvas = forwardRef(function BadgeCanvas({ config }, ref) {
  const canvasRef = useRef(null)

  useImperativeHandle(ref, () => ({
    exportPNG: () => {
      const canvas = canvasRef.current
      return canvas ? canvas.toDataURL('image/png') : null
    }
  }))

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, CW, CH)

    const cx = CW / 2
    const cy = CH / 2
    // 六边形尖顶朝上 rotation = -π/6
    const rot = -Math.PI / 6

    // 外框尺寸
    const outerRX = CW * 0.47
    const outerRY = CH * 0.47
    // 内金框
    const innerRX = CW * 0.40
    const innerRY = CH * 0.40

    // ── 1. 背景填充 ──
    const bgColor1 = config.bgColor1 || '#1a1a2e'
    const bgColor2 = config.bgColor2 || '#16213e'
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, CW * 0.5)
    grad.addColorStop(0, bgColor1)
    grad.addColorStop(1, bgColor2)

    ctx.save()
    hexPath(ctx, cx, cy, innerRX - 6, innerRY - 6, rot)
    ctx.clip()
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, CW, CH)

    // ── 2. 放射线背景 ──
    if (config.showRays) {
      const rayCount = 24
      ctx.save()
      for (let i = 0; i < rayCount; i++) {
        const angle = (Math.PI * 2 / rayCount) * i
        const rayGrad = ctx.createLinearGradient(cx, cy, cx + Math.cos(angle) * CW, cy + Math.sin(angle) * CH)
        rayGrad.addColorStop(0, 'rgba(200,169,110,0.08)')
        rayGrad.addColorStop(1, 'rgba(200,169,110,0)')
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        const a1 = angle - Math.PI / rayCount
        const a2 = angle + Math.PI / rayCount
        ctx.arc(cx, cy, CW, a1, a2)
        ctx.closePath()
        ctx.fillStyle = rayGrad
        ctx.fill()
      }
      ctx.restore()
    }

    ctx.restore()

    // ── 3. 人物立绘（破框处理，先绘制，后被外框遮住部分靠层级实现）──
    if (config.characterImg) {
      ctx.save()
      // 人物不clip，让其能破框
      const img = config.characterImg
      const scale = config.characterScale || 1
      const offsetX = (config.characterX || 0) * SCALE
      const offsetY = (config.characterY || 0) * SCALE
      const imgW = img.naturalWidth || img.width
      const imgH = img.naturalHeight || img.height
      const fitH = CH * 0.85 * scale
      const fitW = (imgW / imgH) * fitH
      ctx.drawImage(img, cx - fitW / 2 + offsetX, cy - fitH / 2 + offsetY + CH * 0.05, fitW, fitH)
      ctx.restore()
    }

    // ── 4. 外层装饰边框（深色带厚度感）──
    // 最外边框
    ctx.save()
    hexPath(ctx, cx, cy, outerRX, outerRY, rot)
    ctx.lineWidth = 18
    const outerGrad = ctx.createLinearGradient(cx - outerRX, cy - outerRY, cx + outerRX, cy + outerRY)
    outerGrad.addColorStop(0, '#2a2438')
    outerGrad.addColorStop(0.5, '#3d3550')
    outerGrad.addColorStop(1, '#1a1628')
    ctx.strokeStyle = outerGrad
    ctx.stroke()
    ctx.restore()

    // 内金框（双线）
    ctx.save()
    hexPath(ctx, cx, cy, innerRX + 8, innerRY + 8, rot)
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(200,169,110,0.3)'
    ctx.stroke()
    ctx.restore()

    ctx.save()
    hexPath(ctx, cx, cy, innerRX, innerRY, rot)
    ctx.lineWidth = 8
    const goldGrad = ctx.createLinearGradient(cx - innerRX, cy - innerRY, cx + innerRX, cy + innerRY)
    goldGrad.addColorStop(0, '#e8c97a')
    goldGrad.addColorStop(0.3, '#c8a96e')
    goldGrad.addColorStop(0.5, '#f0d890')
    goldGrad.addColorStop(0.7, '#a07840')
    goldGrad.addColorStop(1, '#d4b060')
    ctx.strokeStyle = goldGrad
    ctx.stroke()
    ctx.restore()

    // 内框内细线
    ctx.save()
    hexPath(ctx, cx, cy, innerRX - 10, innerRY - 10, rot)
    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgba(200,169,110,0.4)'
    ctx.stroke()
    ctx.restore()

    // 外框和内框之间的深色填充带
    ctx.save()
    hexPath(ctx, cx, cy, outerRX - 5, outerRY - 5, rot)
    ctx.clip()
    hexPath(ctx, cx, cy, innerRX + 12, innerRY + 12, rot)
    // 反向clip（在外框内但在内框外）
    ctx.save()
    // 画深色装饰带
    const bandGrad = ctx.createRadialGradient(cx, cy, innerRX, cx, cy, outerRX)
    bandGrad.addColorStop(0, '#1e1a2a')
    bandGrad.addColorStop(1, '#0e0c18')
    ctx.fillStyle = bandGrad
    // 画整个外框面积然后挖内框
    ctx.beginPath()
    hexPath(ctx, cx, cy, outerRX - 5, outerRY - 5, rot)
    // 反绕内框
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i + rot
      const x = cx + (innerRX + 12) * Math.cos(angle)
      const y = cy + (innerRY + 12) * Math.sin(angle)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.restore()
    ctx.restore()

    // 装饰带简化：直接在带状区域画装饰点
    // 六个角落装饰圆点
    ctx.save()
    const dotR = (outerRX + innerRX) / 2
    const dotRY = (outerRY + innerRY) / 2
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i + rot
      const x = cx + dotR * Math.cos(angle)
      const y = cy + dotRY * Math.sin(angle)
      ctx.beginPath()
      ctx.arc(x, y, 7, 0, Math.PI * 2)
      ctx.fillStyle = '#c8a96e'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fillStyle = '#f0d890'
      ctx.fill()
    }
    ctx.restore()

    // ── 5. 文字标牌 ──
    if (config.text1) {
      drawTextBadge(ctx, cx, cy, innerRY, rot, config.text1, config.textPosition || 'bottom')
    }

    // ── 6. 底部署名/副标 ──
    if (config.text2) {
      ctx.save()
      ctx.font = `bold ${28 * SCALE / 2}px "Cinzel Decorative", serif`
      ctx.fillStyle = 'rgba(200,169,110,0.7)'
      ctx.textAlign = 'center'
      ctx.fillText(config.text2, cx, cy + innerRY * 0.75)
      ctx.restore()
    }

  }, [config])

  function drawTextBadge(ctx, cx, cy, innerRY, rot, text, position) {
    const badgeW = 200 * SCALE / 2
    const badgeH = 28 * SCALE / 2
    let bx = cx
    let by = cy + innerRY * 0.82

    if (position === 'top') by = cy - innerRY * 0.82
    if (position === 'center') by = cy

    ctx.save()
    // 标牌背景
    const bgrad = ctx.createLinearGradient(bx - badgeW, by - badgeH / 2, bx + badgeW, by + badgeH / 2)
    bgrad.addColorStop(0, '#1a1428')
    bgrad.addColorStop(0.5, '#2a2040')
    bgrad.addColorStop(1, '#1a1428')
    ctx.fillStyle = bgrad
    roundRect(ctx, bx - badgeW / 2, by - badgeH / 2, badgeW, badgeH, 4)
    ctx.fill()

    // 标牌边框
    ctx.strokeStyle = '#c8a96e'
    ctx.lineWidth = 1.5
    roundRect(ctx, bx - badgeW / 2, by - badgeH / 2, badgeW, badgeH, 4)
    ctx.stroke()

    // 标牌文字
    const fontSize = Math.min(18 * SCALE / 2, (badgeW - 20) / text.length * 1.5)
    ctx.font = `bold ${fontSize}px "Cinzel Decorative", "Noto Serif SC", serif`
    ctx.fillStyle = '#e8c97a'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, bx, by)
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

  useEffect(() => {
    draw()
  }, [draw])

  return (
    <canvas
      ref={canvasRef}
      width={CW}
      height={CH}
      style={{
        width: PRINT_W * 0.55,
        height: PRINT_H * 0.55,
        imageRendering: 'crisp-edges',
        filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.8))',
      }}
    />
  )
})

export default BadgeCanvas
export { PRINT_W, PRINT_H, CW, CH }
