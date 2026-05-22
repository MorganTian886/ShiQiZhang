import React, { useState } from 'react'
import s from './IconLibrary.module.css'

// 职业图标（对应 public/icons/jobs/xxx.png）
const JOB_ICONS = [
  { id: 'vanguard',   label: '先锋', file: 'vanguard.png'  },
  { id: 'guard',      label: '近卫', file: 'guard.png'     },
  { id: 'defender',   label: '重装', file: 'defender.png'  },
  { id: 'sniper',     label: '狙击', file: 'sniper.png'    },
  { id: 'caster',     label: '术师', file: 'caster.png'    },
  { id: 'medic',      label: '医疗', file: 'medic.png'     },
  { id: 'supporter',  label: '辅助', file: 'supporter.png' },
  { id: 'specialist', label: '特种', file: 'specialist.png'},
]

// 阵营Logo（对应 public/icons/factions/xxx.png）
const FACTION_ICONS = [
  { id: 'rhodes',      label: '罗德岛',   file: 'rhodes.png'      },
  { id: 'lungmen',     label: '龙门',     file: 'lungmen.png'     },
  { id: 'victoria',    label: '维多利亚', file: 'victoria.png'    },
  { id: 'yan',         label: '炎国',     file: 'yan.png'         },
  { id: 'ursus',       label: '乌萨斯',   file: 'ursus.png'       },
  { id: 'kazimierz',   label: '卡西米尔', file: 'kazimierz.png'   },
  { id: 'leithanien',  label: '莱塔尼亚', file: 'leithanien.png'  },
  { id: 'laterano',    label: '拉特兰',   file: 'laterano.png'    },
  { id: 'columbia',    label: '哥伦比亚', file: 'columbia.png'    },
  { id: 'sami',        label: '萨米',     file: 'sami.png'        },
  { id: 'deepcolors',  label: '深海猎人', file: 'deepcolors.png'  },
]

const TABS = {
  '职业': { icons: JOB_ICONS, dir: 'jobs' },
  '阵营': { icons: FACTION_ICONS, dir: 'factions' },
}

export default function IconLibrary({ onInsert }) {
  const [tab, setTab] = useState('职业')
  const { icons, dir } = TABS[tab]

  const handleInsert = (icon) => {
    const src = `/icons/${dir}/${icon.file}`
    const img = new Image()
    img.onload = () => onInsert({ ...icon, image: img })
    img.onerror = () => {
      // 文件不存在时提示
      alert(`找不到图标文件：public/icons/${dir}/${icon.file}\n请先从 PRTS Wiki 下载图标放入对应目录。`)
    }
    img.src = src
  }

  return (
    <div className={s.library}>
      <p className={s.tip}>图标来自 PRTS Wiki，需手动下载放入<br/><code>public/icons/jobs/</code> 和 <code>public/icons/factions/</code></p>
      <div className={s.tabs}>
        {Object.keys(TABS).map(t => (
          <button key={t} className={tab === t ? s.active : ''} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      <div className={s.grid}>
        {icons.map(icon => (
          <button key={icon.id} className={s.iconBtn} title={icon.label} onClick={() => handleInsert(icon)}>
            <img
              src={`/icons/${dir}/${icon.file}`}
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
