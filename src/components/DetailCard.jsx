import React, { useRef, useEffect } from 'react'

// 生成明日方舟风格详情卡片
export function drawDetailCard(badgeDataUrl, info) {
  const CW = 900, CH = 520
  const canvas = document.createElement('canvas')
  canvas.width = CW; canvas.height = CH
  const ctx = canvas.getContext('2d')

  // 深色背景
  ctx.fillStyle = '#0d0e12'
  ctx.fillRect(0, 0, CW, CH)

  // 斜切角装饰框
  ctx.strokeStyle = '#c8a96e'
  ctx.lineWidth = 1.5
  const m = 16, c = 18
  ctx.beginPath()
  ctx.moveTo(m+c, m); ctx.lineTo(CW-m-c, m)
  ctx.lineTo(CW-m, m+c); ctx.lineTo(CW-m, CH-m-c)
  ctx.lineTo(CW-m-c, CH-m); ctx.lineTo(m+c, CH-m)
  ctx.lineTo(m, CH-m-c); ctx.lineTo(m, m+c)
  ctx.closePath(); ctx.stroke()

  // 内边框细线
  ctx.strokeStyle = 'rgba(200,169,110,0.25)'
  ctx.lineWidth = 1
  const m2 = 22
  ctx.strokeRect(m2, m2, CW-m2*2, CH-m2*2)

  // 顶部标题栏
  ctx.fillStyle = 'rgba(200,169,110,0.08)'
  ctx.fillRect(m2, m2, CW-m2*2, 44)
  ctx.strokeStyle = 'rgba(200,169,110,0.3)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(m2, m2+44); ctx.lineTo(CW-m2, m2+44); ctx.stroke()

  // 徽章编号
  ctx.fillStyle = '#c8a96e'
  ctx.font = 'bold 13px "Cinzel Decorative", serif'
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  ctx.fillText(info.code || 'MD-001', m2+12, m2+22)

  // 右上角"蚀刻章"标签
  ctx.fillStyle = 'rgba(200,169,110,0.15)'
  const tagW = 64, tagH = 20, tagX = CW-m2-tagW-8, tagY = m2+12
  ctx.fillRect(tagX, tagY, tagW, tagH)
  ctx.fillStyle = '#c8a96e'
  ctx.font = '10px "Noto Serif SC", serif'
  ctx.textAlign = 'center'
  ctx.fillText('蚀刻章', tagX+tagW/2, tagY+10)

  // 左侧：章图片
  const badgeSize = 220
  const badgeX = m2+20, badgeY = m2+60
  if (badgeDataUrl) {
    const img = new Image()
    img.src = badgeDataUrl
    // 直接绘（同步，dataUrl已加载）
    try { ctx.drawImage(img, badgeX, badgeY, badgeSize, badgeSize) } catch(e) {}
  }

  // 分隔线
  const divX = m2+badgeSize+36
  ctx.strokeStyle = 'rgba(200,169,110,0.2)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(divX, m2+60); ctx.lineTo(divX, CH-m2-16); ctx.stroke()

  // 右侧内容区
  const tx = divX+20, tw = CW-m2-divX-36
  let ty = m2+70

  // 章名
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 22px "Noto Serif SC", serif'
  ctx.textAlign = 'left'; ctx.textBaseline = 'top'
  ctx.fillText(info.name || '无名之章', tx, ty)
  ty += 34

  // 金色细线
  ctx.strokeStyle = '#c8a96e'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx+tw*.6, ty); ctx.stroke()
  ty += 12

  // 获得条件标签
  ctx.fillStyle = '#c8a96e'
  ctx.font = '11px "Noto Serif SC", serif'
  ctx.fillText('获得条件', tx, ty); ty += 18
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.font = '12px "Noto Serif SC", serif'
  const condLines = wrapText(ctx, info.condition || '完成指定挑战', tw-10, 12)
  condLines.forEach(line => { ctx.fillText(line, tx, ty); ty += 17 })
  ty += 8

  // 分隔
  ctx.strokeStyle = 'rgba(200,169,110,0.15)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx+tw, ty); ctx.stroke()
  ty += 12

  // 背景故事标签
  ctx.fillStyle = '#c8a96e'
  ctx.font = '11px "Noto Serif SC", serif'
  ctx.fillText('背景故事', tx, ty); ty += 18
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = '11px "Noto Serif SC", serif'
  const loreLines = wrapText(ctx, info.lore || '这是一段关于这枚蚀刻章的故事。', tw-10, 11)
  loreLines.slice(0, 6).forEach(line => { ctx.fillText(line, tx, ty); ty += 16 })

  // 底部铆钉
  const nailY = CH-m2-10
  ;[m2+8, CW-m2-8].forEach(nx => {
    ;[m2+8, nailY].forEach(ny => {
      ctx.beginPath(); ctx.arc(nx, ny, 3, 0, Math.PI*2)
      ctx.fillStyle = '#c8a96e'; ctx.fill()
    })
  })

  return canvas.toDataURL('image/png')
}

function wrapText(ctx, text, maxW, fontSize) {
  const words = text.split('')
  const lines = []; let cur = ''
  for (const ch of words) {
    const test = cur + ch
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = ch }
    else cur = test
  }
  if (cur) lines.push(cur)
  return lines
}

export default function DetailCardEditor({ info, onChange }) {
  return (
    <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ fontSize: 10, color: 'var(--text-dim)' }}>导出时生成官方风格详情卡片</p>
      {[
        { key: 'code',      label: '编号',     placeholder: 'MD-001' },
        { key: 'name',      label: '章名',     placeholder: '无名之章' },
        { key: 'condition', label: '获得条件', placeholder: '完成指定挑战' },
        { key: 'lore',      label: '背景故事', placeholder: '这里写故事...' },
      ].map(({ key, label, placeholder }) => (
        <label key={key} style={{ display:'flex', flexDirection:'column', gap:3, fontSize:11, color:'var(--text-secondary)' }}>
          {label}
          {key === 'lore' ? (
            <textarea rows={3} placeholder={placeholder} value={info[key]||''} onChange={e=>onChange({...info,[key]:e.target.value})}
              style={{ background:'var(--bg-card)', border:'1px solid var(--border)', color:'var(--text-primary)', padding:'5px 8px', borderRadius:4, fontSize:11, fontFamily:'inherit', resize:'vertical' }}/>
          ) : (
            <input type="text" placeholder={placeholder} value={info[key]||''} onChange={e=>onChange({...info,[key]:e.target.value})}
              style={{ background:'var(--bg-card)', border:'1px solid var(--border)', color:'var(--text-primary)', padding:'5px 8px', borderRadius:4, fontSize:11, fontFamily:'inherit' }}/>
          )}
        </label>
      ))}
    </div>
  )
}
