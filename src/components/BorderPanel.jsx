import React from 'react'
import s from './BorderPanel.module.css'
import BorderTemplates from './BorderTemplates'

export default function BorderPanel({ config, onChange, onApplyTemplate }) {
  const set = (k, v) => onChange({ ...config, [k]: v })

  return (
    <div className={s.panel}>

      {/* 边框模板 */}
      <div className={s.section}>
        <div className={s.title}>快速套用模板</div>
        <BorderTemplates onApply={onApplyTemplate} />
      </div>

      {/* 六边形尺寸 */}
      <div className={s.section}>
        <div className={s.title}>六边形尺寸（px，导出按此输出）</div>
        <Row label="宽度">
          <input type="range" min="200" max="2000" step="10"
            value={config.hexW ?? 1228}
            onChange={e => set('hexW', +e.target.value)} />
          <span className={s.val}>{config.hexW ?? 1228}</span>
        </Row>
        <Row label="高度">
          <input type="range" min="200" max="2000" step="10"
            value={config.hexH ?? 1417}
            onChange={e => set('hexH', +e.target.value)} />
          <span className={s.val}>{config.hexH ?? 1417}</span>
        </Row>
        <p className={s.hint}>拉宽=六边形变宽，拉高=六边形变高<br/>导出PNG为透明背景六边形</p>
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

      {/* 边框纹路 */}
      <div className={s.section}>
        <div className={s.title}>间距带纹路</div>
        <Row label="纹路">
          <select value={config.borderPattern ?? 'none'}
            onChange={e => set('borderPattern', e.target.value)}>
            <option value="none">无</option>
            <optgroup label="── 科幻 / 工业 ──">
              <option value="ticks">刻度线纹</option>
              <option value="circuit">电路板走线</option>
              <option value="knurling">滚花菱形纹</option>
              <option value="dashed">断点虚线纹</option>
            </optgroup>
            <optgroup label="── 神秘 / 古典 ──">
              <option value="greek_key">希腊回纹</option>
              <option value="rivets">铆钉纹</option>
              <option value="rope">绳纹</option>
              <option value="scrollwork">巴洛克卷草</option>
            </optgroup>
          </select>
        </Row>
        {config.borderPattern && config.borderPattern !== 'none' && <>
          <Row label="纹路色">
            <input type="color"
              value={config.borderPatternColor ?? '#000000'}
              onChange={e => set('borderPatternColor', e.target.value)} />
            <span className={s.hexLabel}>{config.borderPatternColor ?? '#000000'}</span>
          </Row>
          <Row label="透明度">
            <input type="range" min="0" max="1" step="0.05"
              value={config.borderPatternOpacity ?? 0.7}
              onChange={e => set('borderPatternOpacity', +e.target.value)} />
            <span className={s.val}>{Math.round((config.borderPatternOpacity ?? 0.7)*100)}%</span>
          </Row>
        </>}
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
