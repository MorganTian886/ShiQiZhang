import React from 'react'
import s from './BorderTemplates.module.css'

export const BORDER_TEMPLATES = [
  {
    id: 'classic',
    label: '经典金框',
    config: {
      outerBorderWidth: 30, outerBorderColor: '#1a1628',
      gapWidth: 20, gapColor: '#e8e0d0',
      innerBorderWidth: 12, innerBorderColor1: '#f5e090', innerBorderColor2: '#9a7235',
      innerBorderSolid: false, innerLineWidth: 3, innerLineColor: 'rgba(200,169,110,0.5)',
    }
  },
  {
    id: 'silver',
    label: '精制银框',
    config: {
      outerBorderWidth: 28, outerBorderColor: '#1a1a22',
      gapWidth: 18, gapColor: '#c8c8d0',
      innerBorderWidth: 10, innerBorderColor1: '#e8e8f0', innerBorderColor2: '#7a7a88',
      innerBorderSolid: false, innerLineWidth: 2, innerLineColor: 'rgba(180,180,200,0.5)',
    }
  },
  {
    id: 'blood_red',
    label: '血色战框',
    config: {
      outerBorderWidth: 32, outerBorderColor: '#1a0808',
      gapWidth: 14, gapColor: '#3a0a0a',
      innerBorderWidth: 14, innerBorderColor1: '#ff4422', innerBorderColor2: '#8a1a08',
      innerBorderSolid: false, innerLineWidth: 3, innerLineColor: 'rgba(255,80,40,0.4)',
    }
  },
  {
    id: 'deep_blue',
    label: '深蓝指挥',
    config: {
      outerBorderWidth: 30, outerBorderColor: '#050a1a',
      gapWidth: 16, gapColor: '#0a1a3a',
      innerBorderWidth: 12, innerBorderColor1: '#4488ff', innerBorderColor2: '#1a3a88',
      innerBorderSolid: false, innerLineWidth: 2, innerLineColor: 'rgba(80,150,255,0.4)',
    }
  },
  {
    id: 'emerald',
    label: '翠绿秘境',
    config: {
      outerBorderWidth: 28, outerBorderColor: '#050f08',
      gapWidth: 16, gapColor: '#0a2010',
      innerBorderWidth: 11, innerBorderColor1: '#44cc66', innerBorderColor2: '#1a6630',
      innerBorderSolid: false, innerLineWidth: 2, innerLineColor: 'rgba(60,200,100,0.4)',
    }
  },
  {
    id: 'aurora',
    label: '极光镀层',
    config: {
      outerBorderWidth: 32, outerBorderColor: '#08081a',
      gapWidth: 12, gapColor: '#101028',
      innerBorderWidth: 14, innerBorderColor1: '#cc88ff', innerBorderColor2: '#4422aa',
      innerBorderSolid: false, innerLineWidth: 3, innerLineColor: 'rgba(180,100,255,0.5)',
    }
  },
  {
    id: 'copper',
    label: '古铜战章',
    config: {
      outerBorderWidth: 34, outerBorderColor: '#120a04',
      gapWidth: 16, gapColor: '#2a1608',
      innerBorderWidth: 13, innerBorderColor1: '#cc8844', innerBorderColor2: '#6a3810',
      innerBorderSolid: false, innerLineWidth: 2, innerLineColor: 'rgba(180,120,50,0.4)',
    }
  },
  {
    id: 'thin_elegant',
    label: '纤细典雅',
    config: {
      outerBorderWidth: 18, outerBorderColor: '#1a1628',
      gapWidth: 8, gapColor: '#f0ece0',
      innerBorderWidth: 6, innerBorderColor1: '#e8c97a', innerBorderColor2: '#b09040',
      innerBorderSolid: true, innerLineWidth: 1.5, innerLineColor: 'rgba(200,169,110,0.4)',
    }
  },
]

// 预览色块
function TemplatePreview({ tpl }) {
  return (
    <div className={s.preview} style={{ background: tpl.config.outerBorderColor }}>
      <div className={s.previewGap} style={{ background: tpl.config.gapColor }}>
        <div className={s.previewInner} style={{
          background: `linear-gradient(135deg, ${tpl.config.innerBorderColor1}, ${tpl.config.innerBorderColor2})`
        }}/>
      </div>
    </div>
  )
}

export default function BorderTemplates({ onApply }) {
  return (
    <div className={s.wrap}>
      <p className={s.hint}>点击套用边框配色方案</p>
      <div className={s.grid}>
        {BORDER_TEMPLATES.map(tpl => (
          <button key={tpl.id} className={s.card} onClick={() => onApply(tpl.config)}>
            <TemplatePreview tpl={tpl} />
            <span>{tpl.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
