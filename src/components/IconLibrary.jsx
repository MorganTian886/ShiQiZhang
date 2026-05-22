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
  { id: 'rhodes',          label: '罗德岛',      file: 'rhodes.png',          dir: 'factions' },
  { id: 'rhodes_elite',    label: '罗德岛精英',  file: 'rhodes_elite.png',    dir: 'factions' },
  { id: 'lgd',             label: '龙门近卫局',  file: 'lgd.png',             dir: 'factions' },
  { id: 'victoria',        label: '维多利亚',    file: 'victoria.png',        dir: 'factions' },
  { id: 'yan',             label: '大炎',        file: 'yan.png',             dir: 'factions' },
  { id: 'kazimierz',       label: '卡西米尔',    file: 'kazimierz.png',       dir: 'factions' },
  { id: 'laterano',        label: '拉特兰',      file: 'laterano.png',        dir: 'factions' },
  { id: 'rhine_lab',       label: '莱茵生命',    file: 'rhine_lab.png',       dir: 'factions' },
  { id: 'blacksteel',      label: '黑钢国际',    file: 'blacksteel.png',      dir: 'factions' },
  { id: 'karlan',          label: 'Karlan',      file: 'karlan.png',          dir: 'factions' },
  { id: 'karlan_old',      label: 'Karlan(旧)',  file: 'karlan_old.png',      dir: 'factions' },
  { id: 'reunion',         label: '整合运动',    file: 'reunion.png',         dir: 'factions' },
  { id: 'reunion_alt',     label: '整合(旧)',    file: 'reunion_alt.png',     dir: 'factions' },
  { id: 'babel',           label: '巴别塔',      file: 'babel.png',           dir: 'factions' },
  { id: 'glasgow',         label: 'Glasgow',     file: 'glasgow.png',         dir: 'factions' },
  { id: 'glasgow_alt',     label: 'Glasgow(旧)', file: 'glasgow_alt.png',     dir: 'factions' },
  { id: 'penguin',         label: '企鹅物流',    file: 'penguin.png',         dir: 'factions' },
  { id: 'penguin_eagle',   label: '企鹅(鹰)',    file: 'penguin_eagle.png',   dir: 'factions' },
  { id: 'penguin_round',   label: '企鹅(圆)',    file: 'penguin_round.png',   dir: 'factions' },
  { id: 'abyssal_hunters', label: '深海猎人',    file: 'abyssal_hunters.png', dir: 'factions' },
  { id: 'aegir',           label: 'Aegir',       file: 'aegir.png',           dir: 'factions' },
  { id: 'rim_billiton',    label: '雷姆必拓',    file: 'rim_billiton.png',    dir: 'factions' },
  { id: 'sweep',           label: 'S.W.E.E.P.', file: 'sweep.png',           dir: 'factions' },
  { id: 'alpha',           label: 'Alpha',       file: 'alpha.png',           dir: 'factions' },
  { id: 'medical',         label: '医疗纹章',    file: 'medical.png',         dir: 'factions' },
]

const TABS = {
  '职业(透明)': { icons: JOB_ICONS_TRANS },
  '职业(黑底)': { icons: JOB_ICONS_BLACK },
  '阵营':       { icons: FACTION_ICONS },
}

export default function IconLibrary({ onInsert }) {
  const [tab, setTab] = useState('职业(透明)')
  const { icons } = TABS[tab] || TABS['职业(透明)']

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
