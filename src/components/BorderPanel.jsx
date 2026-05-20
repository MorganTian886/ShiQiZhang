import React from 'react'
import s from './BorderPanel.module.css'

export default function BorderPanel({ config, onChange }) {
  const set = (k, v) => onChange({ ...config, [k]: v })

  return (
    <div className={s.panel}>
      <div className={s.title}>边框参数</div>
      <Row label="外框粗细">
        <input type="range" min="4" max="40" step="1" value={config.outerBorderWidth ?? 16}
          onChange={e => set('outerBorderWidth', +e.target.value)} />
        <span className={s.val}>{config.outerBorderWidth ?? 16}</span>
      </Row>
      <Row label="外框颜色">
        <input type="color" value={config.outerBorderColor ?? '#1a1628'}
          onChange={e => set('outerBorderColor', e.target.value)} />
      </Row>
      <Row label="间距宽度">
        <input type="range" min="4" max="40" step="1" value={config.gapWidth ?? 12}
          onChange={e => set('gapWidth', +e.target.value)} />
        <span className={s.val}>{config.gapWidth ?? 12}</span>
      </Row>
      <Row label="间距颜色">
        <input type="color" value={config.gapColor ?? '#e8e0d0'}
          onChange={e => set('gapColor', e.target.value)} />
      </Row>
      <Row label="内框粗细">
        <input type="range" min="2" max="24" step="1" value={config.innerBorderWidth ?? 6}
          onChange={e => set('innerBorderWidth', +e.target.value)} />
        <span className={s.val}>{config.innerBorderWidth ?? 6}</span>
      </Row>
      <Row label="内细线">
        <input type="range" min="0" max="6" step="0.5" value={config.innerLineWidth ?? 2}
          onChange={e => set('innerLineWidth', +e.target.value)} />
        <span className={s.val}>{config.innerLineWidth ?? 2}</span>
      </Row>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 14px', fontSize:12 }}>
      <span style={{ width:54, flexShrink:0, color:'var(--text-secondary)', fontSize:11 }}>{label}</span>
      <div style={{ flex:1, display:'flex', alignItems:'center', gap:6 }}>{children}</div>
    </div>
  )
}
