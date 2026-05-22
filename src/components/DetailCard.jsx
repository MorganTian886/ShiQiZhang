import React, { useRef, useEffect } from 'react'

// 生成明日方舟风格详情卡片（对照游戏原版还原）
export function drawDetailCard(badgeDataUrl, info) {
  // 卡片尺寸：游戏内约 3:1 横版
  const CW = 960, CH = 280
  const canvas = document.createElement('canvas')
  canvas.width = CW; canvas.height = CH
  const ctx = canvas.getContext('2d')

  // ── 整体背景 ──
  ctx.fillStyle = '#1c1c1e'
  ctx.fillRect(0, 0, CW, CH)

  // 外边框
  ctx.strokeStyle = '#3a3a3c'
  ctx.lineWidth = 1.5
  ctx.strokeRect(0, 0, CW, CH)

  // ── 左侧章图区（深色底）──
  const leftW = 240
  ctx.fillStyle = '#141416'
  ctx.fillRect(0, 0, leftW, CH)

  // 左右分隔线
  ctx.strokeStyle = '#3a3a3c'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(leftW, 0); ctx.lineTo(leftW, CH); ctx.stroke()

  // 章图片居中
  if (badgeDataUrl) {
    const imgSize = 210
    const imgX = (leftW - imgSize) / 2
    const imgY = (CH - imgSize) / 2
    const img = new Image()
    img.src = badgeDataUrl
    try { ctx.drawImage(img, imgX, imgY, imgSize, imgSize) } catch(e) {}
  }

  // ── 右侧内容区 ──
  const rx = leftW  // 右侧起始X
  const rw = CW - leftW  // 右侧宽度

  // 顶部标题栏（可自定义渐变色）
  const titleH = 56
  const tc1 = info.titleColor1 || '#b8894a'
  const tc2 = info.titleColor2 || '#d4a55a'
  const tc3 = info.titleColor3 || '#8a6030'
  const titleGrad = ctx.createLinearGradient(rx, 0, CW, titleH)
  titleGrad.addColorStop(0,   tc1)
  titleGrad.addColorStop(0.4, tc2)
  titleGrad.addColorStop(1,   tc3)
  ctx.fillStyle = titleGrad
  ctx.fillRect(rx, 0, rw, titleH)

  // 标题栏底部细线
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(rx, titleH); ctx.lineTo(CW, titleH); ctx.stroke()

  // 章名（带引号，白色加粗）
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 20px "Noto Serif SC", serif'
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  const displayName = info.name ? `"${info.name}"` : '"无名之章"'
  ctx.fillText(displayName, rx + 16, titleH / 2)

  // 星级（右上角）
  const stars = parseInt(info.stars) || 3
  const starSize = 18, starPad = 4
  const starTotalW = stars * (starSize + starPad)
  let sx = CW - starTotalW - 12
  for (let i = 0; i < stars; i++) {
    drawStar(ctx, sx + starSize/2, titleH/2, starSize/2 * 0.9, starSize/2 * 0.42, '#f0c040')
    sx += starSize + starPad
  }

  // ── 正文区 ──
  let ty = titleH + 18
  const px = rx + 16, pw = rw - 32

  // 描述文本（斜体，灰白）
  if (info.lore) {
    ctx.fillStyle = '#cccccc'
    ctx.font = 'italic 13px "Noto Serif SC", serif'
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    const loreLines = wrapText(ctx, info.lore, pw, 13)
    loreLines.slice(0, 4).forEach(line => {
      ctx.fillText(line, px, ty); ty += 19
    })
  }

  // 分隔线
  ty += 6
  ctx.strokeStyle = '#3a3a3c'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(px, ty); ctx.lineTo(CW - 16, ty); ctx.stroke()
  ty += 10

  // 获得方式标签 + 内容（同一行）
  const labelText = '获得方式'
  ctx.font = 'bold 12px "Noto Serif SC", serif'
  const labelW = ctx.measureText(labelText).width + 20
  const labelH = 24

  // 标签背景（深灰圆角）
  ctx.fillStyle = '#2a2a2e'
  roundRect(ctx, px, ty, labelW, labelH, 4)
  ctx.fill()
  ctx.strokeStyle = '#4a4a50'
  ctx.lineWidth = 1
  roundRect(ctx, px, ty, labelW, labelH, 4)
  ctx.stroke()

  // 标签文字
  ctx.fillStyle = '#cccccc'
  ctx.font = 'bold 12px "Noto Serif SC", serif'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(labelText, px + labelW/2, ty + labelH/2)

  // 获得条件文字
  ctx.fillStyle = '#e0e0e0'
  ctx.font = '13px "Noto Serif SC", serif'
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  ctx.fillText(info.condition || '完成指定挑战', px + labelW + 12, ty + labelH/2)

  return canvas.toDataURL('image/png')
}

function drawStar(ctx, cx, cy, outerR, innerR, color) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR
    const a = (Math.PI / 5) * i - Math.PI / 2
    i === 0 ? ctx.moveTo(cx + r*Math.cos(a), cy + r*Math.sin(a))
             : ctx.lineTo(cx + r*Math.cos(a), cy + r*Math.sin(a))
  }
  ctx.closePath()
  ctx.fillStyle = color; ctx.fill()
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y)
  ctx.arcTo(x+w,y,x+w,y+r,r); ctx.lineTo(x+w,y+h-r)
  ctx.arcTo(x+w,y+h,x+w-r,y+h,r); ctx.lineTo(x+r,y+h)
  ctx.arcTo(x,y+h,x,y+h-r,r); ctx.lineTo(x,y+r)
  ctx.arcTo(x,y,x+r,y,r); ctx.closePath()
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
        { key: 'name',      label: '章名',      placeholder: '六年的求索与希冀' },
        { key: 'stars',     label: '星级(1-3)',  placeholder: '3' },
        { key: 'lore',      label: '描述文本',  placeholder: '颁发给您的2190日纪念蚀刻章。六年以来...' },
        { key: 'condition', label: '获得方式',  placeholder: '苏醒满2190天' },
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
      <div style={{padding:'4px 0 0'}}>
        <div style={{fontSize:11,color:'var(--text-secondary)',marginBottom:6}}>标题栏渐变色</div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {[
            {key:'titleColor1', label:'左', def:'#b8894a'},
            {key:'titleColor2', label:'中', def:'#d4a55a'},
            {key:'titleColor3', label:'右', def:'#8a6030'},
          ].map(({key,label,def})=>(
            <label key={key} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3,fontSize:10,color:'var(--text-dim)',cursor:'pointer'}}>
              {label}
              <input type="color" value={info[key]||def}
                onChange={e=>onChange({...info,[key]:e.target.value})}
                style={{width:36,height:24,border:'1px solid var(--border)',borderRadius:3,padding:1,background:'var(--bg-card)',cursor:'pointer'}}/>
            </label>
          ))}
          <button
            onClick={()=>onChange({...info,titleColor1:'#b8894a',titleColor2:'#d4a55a',titleColor3:'#8a6030'})}
            style={{marginLeft:'auto',fontSize:10,color:'var(--text-dim)',background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:4,padding:'3px 8px',cursor:'pointer'}}>
            重置
          </button>
        </div>
        <div style={{marginTop:6,height:16,borderRadius:3,background:`linear-gradient(to right,${info.titleColor1||'#b8894a'},${info.titleColor2||'#d4a55a'},${info.titleColor3||'#8a6030'})`}}/>
      </div>
    </div>
  )
}
