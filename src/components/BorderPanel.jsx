import React from 'react'
import s from './BorderPanel.module.css'

export default function BorderPanel({ config, onChange }) {
  const set = (k, v) => onChange({ ...config, [k]: v })

  return (
    <div className={s.panel}>

      {/* 六边形尺寸 */}
      <div className={s.section}>
        <div className={s.title}>六边形尺寸（画布5.2×6cm）</div>
        <Row label="宽度%">
          <input type="range" min="20" max="98" step="1"
            value={config.hexW ?? 90}
            onChange={e => set('hexW', +e.target.value)} />
          <span className={s.val}>{config.hexW ?? 90}%</span>
        </Row>
        <Row label="高度%">
          <input type="range" min="20" max="98" step="1"
            value={config.hexH ?? 90}
            onChange={e => set('hexH', +e.target.value)} />
          <span className={s.val}>{config.hexH ?? 90}%</span>
        </Row>
        <p className={s.hint}>宽/高独立调节，超出部分自动截止于画布边缘</p>
      </div>

      {/* 外框 */}
      <div className={s.section}>
        <div className={s.title}>外框</div>
        <Row label="粗细">
          <input type="range" min="4" max="80" step="1"
            value={config.outerBorderWidth ?? 30}
            onChange={e => set('outerBorderWidth', +e.target.value)} />
          <span className={s.val}>{config.outerBorderWidth ?? 30}</span>
        </Row>
        <Row label="颜色">
          <input type="color" value={config.outerBorderColor ?? '#1a1628'}
            onChange={e => set('outerBorderColor', e.target.value)} />
        </Row>
      </div>

      {/* 间距带 */}
      <div className={s.section}>
        <div className={s.title}>间距带</div>
        <Row label="宽度">
          <input type="range" min="0" max="80" step="1"
            value={config.gapWidth ?? 24}
            onChange={e => set('gapWidth', +e.target.value)} />
          <span className={s.val}>{config.gapWidth ?? 24}</span>
        </Row>
        <Row label="颜色">
          <input type="color" value={config.gapColor ?? '#e8e0d0'}
            onChange={e => set('gapColor', e.target.value)} />
        </Row>
      </div>

      {/* 内框 */}
      <div className={s.section}>
        <div className={s.title}>内框</div>
        <Row label="粗细">
          <input type="range" min="2" max="50" step="1"
            value={config.innerBorderWidth ?? 12}
            onChange={e => set('innerBorderWidth', +e.target.value)} />
          <span className={s.val}>{config.innerBorderWidth ?? 12}</span>
        </Row>
        <Row label="纯色">
          <label className={s.toggle}>
            <input type="checkbox" checked={!!config.innerBorderSolid}
              onChange={e => set('innerBorderSolid', e.target.checked)} />
            <span>关闭渐变</span>
          </label>
        </Row>
        <Row label="颜色1">
          <input type="color" value={config.innerBorderColor1 ?? '#f5e090'}
            onChange={e => set('innerBorderColor1', e.target.value)} />
        </Row>
        {!config.innerBorderSolid && (
          <Row label="颜色2">
            <input type="color" value={config.innerBorderColor2 ?? '#9a7235'}
              onChange={e => set('innerBorderColor2', e.target.value)} />
          </Row>
        )}
      </div>

      {/* 内细线 */}
      <div className={s.section}>
        <div className={s.title}>内细线</div>
        <Row label="粗细">
          <input type="range" min="0" max="10" step="1"
            value={config.innerLineWidth ?? 3}
            onChange={e => set('innerLineWidth', +e.target.value)} />
          <span className={s.val}>{config.innerLineWidth ?? 3}</span>
        </Row>
        <Row label="颜色">
          <input type="color"
            value={config.innerLineColor?.startsWith('rgba') ? '#c8a96e' : (config.innerLineColor ?? '#c8a96e')}
            onChange={e => set('innerLineColor', e.target.value)} />
        </Row>
      </div>

    </div>
  )
}

function Row({ label, children }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 14px', fontSize:12 }}>
      <span style={{ width:52, flexShrink:0, color:'var(--text-secondary)', fontSize:11 }}>{label}</span>
      <div style={{ flex:1, display:'flex', alignItems:'center', gap:6 }}>{children}</div>
    </div>
  )
}
