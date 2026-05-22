import React, { useState } from 'react'
import s from './IconLibrary.module.css'

// 职业图标 - 透明底
const JOB_ICONS_TRANS = [
  { id: 'vanguard_t',   label: '先锋', file: 'vanguard.png',   dir: 'jobs' },
  { id: 'guard_t',      label: '近卫', file: 'guard.png',      dir: 'jobs' },
  { id: 'defender_t',   label: '重装', file: 'defender.png',   dir: 'jobs' },
  { id: 'sniper_t',     label: '狙击', file: 'sniper.png',     dir: 'jobs' },
  { id: 'caster_t',     label: '术师', file: 'caster.png',     dir: 'jobs' },
  { id: 'medic_t',      label: '医疗', file: 'medic.png',      dir: 'jobs' },
  { id: 'supporter_t',  label: '辅助', file: 'supporter.png',  dir: 'jobs' },
  { id: 'specialist_t', label: '特种', file: 'specialist.png', dir: 'jobs' },
]

// 职业图标 - 黑底
const JOB_ICONS_BLACK = [
  { id: 'vanguard_b',   label: '先锋', file: 'vanguard.png',   dir: 'jobs_black' },
  { id: 'guard_b',      label: '近卫', file: 'guard.png',      dir: 'jobs_black' },
  { id: 'defender_b',   label: '重装', file: 'defender.png',   dir: 'jobs_black' },
  { id: 'sniper_b',     label: '狙击', file: 'sniper.png',     dir: 'jobs_black' },
  { id: 'caster_b',     label: '术师', file: 'caster.png',     dir: 'jobs_black' },
  { id: 'medic_b',      label: '医疗', file: 'medic.png',      dir: 'jobs_black' },
  { id: 'supporter_b',  label: '辅助', file: 'supporter.png',  dir: 'jobs_black' },
  { id: 'specialist_b', label: '特种', file: 'specialist.png', dir: 'jobs_black' },
]

// 阵营Logo（对应 public/icons/factions/xxx.png）
const FACTION_ICONS = [
  { id: 'rhodes',      label: '罗德岛',   file: 'rhodes.png',     dir: 'factions' },
  { id: 'lungmen',     label: '龙门',     file: 'lungmen.png',    dir: 'factions' },
  { id: 'victoria',    label: '维多利亚', file: 'victoria.png',   dir: 'factions' },
  { id: 'yan',         label: '炎国',     file: 'yan.png',        dir: 'factions' },
  { id: 'ursus',       label: '乌萨斯',   file: 'ursus.png',      dir: 'factions' },
  { id: 'kazimierz',   label: '卡西米尔', file: 'kazimierz.png',  dir: 'factions' },
  { id: 'leithanien',  label: '莱塔尼亚', file: 'leithanien.png', dir: 'factions' },
  { id: 'laterano',    label: '拉特兰',   file: 'laterano.png',   dir: 'factions' },
  { id: 'columbia',    label: '哥伦比亚', file: 'columbia.png',   dir: 'factions' },
  { id: 'sami',        label: '萨米',     file: 'sami.png',       dir: 'factions' },
  { id: 'deepcolors',  label: '深海猎人', file: 'deepcolors.png', dir: 'factions' },
]

const TABS = {
  '职业(透明)': { icons: JOB_ICONS_TRANS },
  '职业(黑底)': { icons: JOB_ICONS_BLACK },
  '阵营':       { icons: FACTION_ICONS },
}

export default function IconLibrary({ onInsert }) {
  const [tab, setTab] = useState('职业')
  const { icons } = TABS[tab]

  const handleInsert = (icon) => {
    const src = `/icons/${icon.dir}/${icon.file}`
    const img = new Image()
    img.onload = () => onInsert({ ...icon, image: img })
    img.onerror = () => {
      // 文件不存在时提示
      console.warn(`图标未找到: public/icons/${icon.dir}/${icon.file}`)
    }
    img.src = src
  }

  return (
    <div className={s.library}>
      <div className={s.tabs}>
        {Object.keys(TABS).map(t => (
          <button key={t} className={tab === t ? s.active : ''} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      <div className={s.grid}>
        {icons.map(icon => (
          <button key={icon.id} className={s.iconBtn} title={icon.label} onClick={() => handleInsert(icon)}>
            <img
              src={`/icons/${icon.dir}/${icon.file}`}
              alt={icon.label}
              width={32} height={32}
              style={{ objectFit:'contain', opacity:0.9 }}
              onError={e => { e.target.style.opacity='0.2'; e.target.title='缺少图标文件' }}
            />
            <span>{icon.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
