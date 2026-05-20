import React from 'react'
import s from './BorderPanel.module.css'

export default function BorderPanel({ config, onChange }) {
  const set = (k, v) => onChange({ ...config, [k]: v })

  return (
    <div className={s.panel}>

      {/* 画布尺寸 */}
      <div className={s.section}>
        <div className={s.title}>画布尺寸（cm）</div>
        <Row label="宽度">
          <input type="range" min="2" max="20" step="0.1"
            value={config.canvasW ?? 5.2}
            onChange={e => set('canvasW', parseFloat(e.target.value))} />
          <span className={s.val}>{(config.canvasW ?? 5.2).toFixed(1)}</span>
        </Row>
        <Row label="高度">
          <input type="range" min="2" max="20" step="0.1"
            value={config.canvasH ?? 6.0}
            onChange={e => set('canvasH', parseFloat(e.target.value))} />
          <span className={s.val}>{(config.canvasH ?? 6.0).toFixed(1)}</span>
        </Row>
        <p className={s.hint}>导出PNG按300DPI输出，宽/高拉伸六边形</p>
      </div>

      {/* 外框 */}
      <div className={s.section}>
        <div className={s.title}>外框</div>
        <Row label="粗细">
          <input type="range" min="0.5" max="8" step="0.1"
            value={config.outerBorderWidth ?? 3}
            onChange={e => set('outerBorderWidth', +e.target.value)} />
          <span className={s.val}>{(config.outerBorderWidth ?? 3).toFixed(1)}</span>
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
          <input type="range" min="0" max="8" step="0.1"
            value={config.gapWidth ?? 2.5}
            onChange={e => set('gapWidth', +e.target.value)} />
          <span className={s.val}>{(config.gapWidth ?? 2.5).toFixed(1)}</span>
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
          <input type="range" min="0.2" max="5" step="0.1"
            value={config.innerBorderWidth ?? 1.2}
            onChange={e => set('innerBorderWidth', +e.target.value)} />
          <span className={s.val}>{(config.innerBorderWidth ?? 1.2).toFixed(1)}</span>
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
          <input type="range" min="0" max="2" step="0.1"
            value={config.innerLineWidth ?? 0.3}
            onChange={e => set('innerLineWidth', +e.target.value)} />
          <span className={s.val}>{(config.innerLineWidth ?? 0.3).toFixed(1)}</span>
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
      <span style={{ width:48, flexShrink:0, color:'var(--text-secondary)', fontSize:11 }}>{label}</span>
      <div style={{ flex:1, display:'flex', alignItems:'center', gap:6 }}>{children}</div>
    </div>
  )
}
