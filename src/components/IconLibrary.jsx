import React, { useState } from 'react'
import s from './IconLibrary.module.css'

// 职业图标 SVG paths
const ICONS = {
  职业: [
    { id: 'vanguard',  label: '先锋', svg: '<path d="M12 2L4 7v10l8 5 8-5V7L12 2zm0 2.5L18 8v8l-6 3.5L6 16V8l6-3.5z" fill="currentColor"/><path d="M12 8l-4 2.5v5l4 2.5 4-2.5v-5L12 8zm0 2l2.5 1.5v3L12 16l-2.5-1.5v-3L12 10z" fill="currentColor"/>'},
    { id: 'guard',     label: '近卫', svg: '<path d="M12 2L3 6v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V6L12 2zm0 2.2l7 3.1V12c0 4.5-3.1 8.7-7 9.9-3.9-1.2-7-5.4-7-9.9V7.3l7-3.1z" fill="currentColor"/><rect x="8" y="10" width="8" height="2" rx="1" fill="currentColor"/><rect x="11" y="7" width="2" height="8" rx="1" fill="currentColor"/>'},
    { id: 'defender',  label: '重装', svg: '<path d="M12 2L3 7v5c0 5 3.6 9.7 9 11 5.4-1.3 9-6 9-11V7L12 2z" fill="currentColor"/><circle cx="12" cy="13" r="3" fill="white"/>'},
    { id: 'sniper',    label: '狙击', svg: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="12" cy="12" r="3" fill="currentColor"/><line x1="12" y1="3" x2="12" y2="7" stroke="currentColor" stroke-width="2"/><line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" stroke-width="2"/><line x1="3" y1="12" x2="7" y2="12" stroke="currentColor" stroke-width="2"/><line x1="17" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="2"/>'},
    { id: 'caster',    label: '术师', svg: '<path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7L12 2z" fill="currentColor"/>'},
    { id: 'medic',     label: '医疗', svg: '<rect x="10" y="3" width="4" height="18" rx="2" fill="currentColor"/><rect x="3" y="10" width="18" height="4" rx="2" fill="currentColor"/>'},
    { id: 'supporter', label: '辅助', svg: '<path d="M12 3C7 3 3 7 3 12s4 9 9 9 9-4 9-9-4-9-9-9zm-1 13v-4H7l5-8v4h4l-5 8z" fill="currentColor"/>'},
    { id: 'specialist', label: '特种', svg: '<path d="M12 2l3 4h4l-2 4 2 4h-4l-3 4-3-4H3l2-4-2-4h4L12 2z" fill="currentColor"/>'},
  ],
  阵营: [
    { id: 'rhodes',    label: '罗德岛', svg: '<path d="M12 2L4 6v12l8 4 8-4V6L12 2zm0 2.2l6 3V10h-3v4h3v.8l-6 3-6-3V14h3v-4H6V7.2l6-3z" fill="currentColor"/>'},
    { id: 'lungmen',   label: '龙门', svg: '<path d="M4 4h16v2H4V4zm2 3h12v10H6V7zm2 2v6h8V9H8zm2 2h4v2h-4v-2z" fill="currentColor"/>'},
    { id: 'ursus',     label: '乌萨斯', svg: '<path d="M6 4l6 3 6-3v7l-6 9-6-9V4zm6 5.5L8 8v5l4 6 4-6V8l-4 1.5z" fill="currentColor"/>'},
    { id: 'laterano',  label: '拉特兰', svg: '<path d="M12 2l1.5 4.5H18L14.5 9l1.5 4.5L12 11l-4 2.5L9.5 9 6 6.5h4.5L12 2z" fill="currentColor"/><circle cx="12" cy="16" r="3" fill="currentColor"/>'},
    { id: 'columbia',  label: '哥伦比亚', svg: '<path d="M3 12l4-8h10l4 8-4 8H7L3 12zm5-5l-3 5 3 5h8l3-5-3-5H8z" fill="currentColor"/>'},
    { id: 'kjerag',    label: '卡西米尔', svg: '<path d="M12 2L2 8v8l10 6 10-6V8L12 2zm0 2.3l8 4.7v6.7L12 20l-8-4.3V9l8-4.7z" fill="currentColor"/>'},
    { id: 'sami',      label: '萨米', svg: '<path d="M12 3l2.5 6.5H21l-5.5 4 2 6.5L12 16l-5.5 4 2-6.5L3 9.5h6.5L12 3z" fill="currentColor" opacity="0.5"/><path d="M12 6l1.5 4H18l-3.5 2.5 1.5 4L12 14l-4 2.5 1.5-4L6 10h4.5L12 6z" fill="currentColor"/>'},
    { id: 'rim',       label: '深海猎人', svg: '<path d="M12 3C7 3 3 7.5 3 12s4 9 9 9 9-4.5 9-9-4-9-9-9zm0 2c3.9 0 7 3.1 7 7s-3.1 7-7 7-7-3.1-7-7 3.1-7 7-7z" fill="currentColor"/><path d="M9 10l6 2-6 2V10z" fill="currentColor"/>'},
  ],
  装饰: [
    { id: 'star1',     label: '一星', svg: '<path d="M12 3l2 6h6l-5 3.5 2 6L12 15l-5 3.5 2-6L4 9h6L12 3z" fill="currentColor"/>'},
    { id: 'crown',     label: '王冠', svg: '<path d="M3 17h18v2H3v-2zm0-2l3-8 3.5 5L12 5l2.5 7L18 7l3 8H3z" fill="currentColor"/>'},
    { id: 'sword',     label: '剑', svg: '<path d="M14.5 3.5L20 9l-1.5 1.5-1-1-8 8 1 1L9 20l-5.5-5.5 1.5-1.5 1 1 8-8-1-1L14.5 3.5zm0 2.8L7 13.8l2.7 2.7 7.5-7.5-2.7-2.7z" fill="currentColor"/><path d="M3 18l3 3 1.5-1.5-3-3L3 18z" fill="currentColor"/>'},
    { id: 'shield2',   label: '盾', svg: '<path d="M12 2L4 5.5v5.7C4 16.1 7.4 20.8 12 22c4.6-1.2 8-5.9 8-10.8V5.5L12 2zm0 2.2l6 2.5v4.8c0 3.9-2.5 7.5-6 8.6-3.5-1.1-6-4.7-6-8.6V6.7l6-2.5z" fill="currentColor"/>'},
    { id: 'gem',       label: '宝石', svg: '<path d="M8 3h8l4 5-8 13L4 8l4-5zm1.5 2L6 8.5l6 9.5 6-9.5L15.5 5h-6z" fill="currentColor"/>'},
    { id: 'wings',     label: '翅膀', svg: '<path d="M12 12C8 8 3 9 2 14c3-1 5 0 6 2-2 0-4 1-4 3 2-1 4-1 5 1C10 18 10 15 12 12zm0 0c4-4 9-3 10 2-3-1-5 0-6 2 2 0 4 1 4 3-2-1-4-1-5 1 1-2 1-5-3-8z" fill="currentColor"/>'},
    { id: 'skull',     label: '骷髅', svg: '<path d="M12 3C8.7 3 6 5.7 6 9c0 2.1 1 3.9 2.6 5H7v2h1v2h8v-2h1v-2h-1.6C17 12.9 18 11.1 18 9c0-3.3-2.7-6-6-6zm0 2c2.2 0 4 1.8 4 4s-1.8 4-4 4-4-1.8-4-4 1.8-4 4-4zm-1.5 9.5h3v1h-3v-1z" fill="currentColor"/>'},
    { id: 'lightning', label: '闪电', svg: '<path d="M13 2L4 14h7l-2 8 9-12h-7l2-8z" fill="currentColor"/>'},
  ]
}

export default function IconLibrary({ onInsert }) {
  const [tab, setTab] = useState('职业')

  const handleInsert = (icon) => {
    // 把 SVG 渲染成 Image 对象
    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="400" height="400"><g color="white">${icon.svg}</g></svg>`
    const blob = new Blob([svgStr], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const img = new Image(400, 400)
    img.onload = () => {
      onInsert({ ...icon, image: img, _svgStr: svgStr })
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  return (
    <div className={s.library}>
      <div className={s.tabs}>
        {Object.keys(ICONS).map(t => (
          <button key={t} className={tab === t ? s.active : ''} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      <div className={s.grid}>
        {ICONS[tab].map(icon => (
          <button key={icon.id} className={s.iconBtn} title={icon.label} onClick={() => handleInsert(icon)}>
            <svg viewBox="0 0 24 24" width="28" height="28" dangerouslySetInnerHTML={{ __html: icon.svg }} style={{color:'var(--gold)'}}/>
            <span>{icon.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
