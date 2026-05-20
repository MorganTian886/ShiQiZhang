import React, { useRef } from 'react'
import s from './LayerEditor.module.css'

const BG_TYPES = [
  { value: 'arknights',      label: '🌐 明日方舟' },
  { value: 'stars',          label: '⭐ 星空' },
  { value: 'solid',          label: '◼ 纯色' },
  { group: '── 线性渐变 ──' },
  { value: 'linear',         label: '↗ 自定义角度' },
  { value: 'linear_diagonal',label: '↗ 对角线' },
  { value: 'linear_h',       label: '→ 水平' },
  { value: 'linear_v',       label: '↓ 垂直' },
  { value: 'linear_hard',    label: '▌ 硬边断层' },
  { group: '── 径向渐变 ──' },
  { value: 'radial',         label: '◎ 中心径向' },
  { value: 'radial_offcenter',label: '◉ 偏心光晕' },
  { value: 'radial_hex',     label: '⬡ 六边形向心' },
  { group: '── 特殊模式 ──' },
  { value: 'conical',        label: '🌀 雷达/角度' },
  { value: 'pattern_hex',    label: '⬡ 蜂巢网格' },
  { value: 'pattern_stripe', label: '▧ 斜线条纹' },
  { value: 'image',          label: '🖼 自定义图片' },
]

const DECOR_TYPES = [
  { value: 'circle_lines',  label: '同心圆环' },
  { value: 'cross_lines',   label: '放射线条' },
  { value: 'corner_marks',  label: '六角标线' },
  { value: 'hex_rings',     label: '六边形环' },
]

export default function LayerEditor({ layer, onChange }) {
  const imgRef = useRef(null)
  if (!layer) return <div className={s.empty}>选择图层进行编辑</div>

  const set = (key, val) => onChange(layer.id, { [key]: val })

  const handleImg = (e) => {
    const file = e.target.files[0]; if (!file) return
    const img = new Image()
    img.onload = () => set('image', img)
    img.src = URL.createObjectURL(file)
  }

  const bgType = layer.bgType ?? 'arknights'
  const needsC1 = bgType !== 'image'
  const needsC2 = !['solid', 'image', 'stars'].includes(bgType)
  const needsC3 = ['linear', 'linear_diagonal', 'linear_h', 'linear_v'].includes(bgType)

  return (
    <div className={s.editor}>
      <div className={s.layerTitle}>
        <input className={s.nameInput} value={layer.name || ''} placeholder="图层名称"
          onChange={e => set('name', e.target.value)} />
      </div>

      <Row label="透明度">
        <input type="range" min="0" max="1" step="0.01" value={layer.opacity ?? 1}
          onChange={e => set('opacity', parseFloat(e.target.value))} />
        <span className={s.val}>{Math.round((layer.opacity ?? 1) * 100)}%</span>
      </Row>

      {/* ── 背景 ── */}
      {layer.type === 'background' && <>
        <Row label="类型">
          <select value={bgType} onChange={e => set('bgType', e.target.value)}>
            {BG_TYPES.map((t, i) =>
              t.group
                ? <option key={i} disabled>{t.group}</option>
                : <option key={t.value} value={t.value}>{t.label}</option>
            )}
          </select>
        </Row>

        {bgType === 'image' && (
          <Row label="图片">
            <button className={s.uploadBtn} onClick={() => imgRef.current.click()}>
              {layer.image ? '✓ 已上传，替换' : '选择图片'}
            </button>
            <input ref={imgRef} type="file" accept="image/*" hidden onChange={handleImg} />
          </Row>
        )}

        {needsC1 && (
          <Row label={needsC2 ? '颜色1' : '颜色'}>
            <input type="color" value={layer.color1 ?? '#1a1a2e'} onChange={e => set('color1', e.target.value)} />
          </Row>
        )}
        {needsC2 && (
          <Row label="颜色2">
            <input type="color" value={layer.color2 ?? '#0a0818'} onChange={e => set('color2', e.target.value)} />
          </Row>
        )}
        {needsC3 && (
          <Row label="中间色">
            <input type="checkbox"
              checked={!!layer.color3}
              onChange={e => set('color3', e.target.checked ? '#4a3060' : null)}
            />
            {layer.color3 && (
              <input type="color" value={layer.color3} onChange={e => set('color3', e.target.value)} />
            )}
            <span style={{fontSize:10,color:'var(--text-dim)'}}>3色渐变</span>
          </Row>
        )}

        {bgType === 'linear' && (
          <Row label="角度">
            <input type="range" min="0" max="360" step="1" value={layer.gradientAngle ?? 135}
              onChange={e => set('gradientAngle', +e.target.value)} />
            <span className={s.val}>{layer.gradientAngle ?? 135}°</span>
          </Row>
        )}
        {bgType === 'linear_hard' && (
          <Row label="分割点">
            <input type="range" min="0.1" max="0.9" step="0.01" value={layer.hardSplit ?? 0.5}
              onChange={e => set('hardSplit', +e.target.value)} />
            <span className={s.val}>{Math.round((layer.hardSplit ?? 0.5) * 100)}%</span>
          </Row>
        )}
        {bgType === 'radial_offcenter' && (<>
          <Row label="光源X">
            <input type="range" min="-100" max="100" step="1" value={layer.radialOX ?? 0}
              onChange={e => set('radialOX', +e.target.value)} />
            <span className={s.val}>{layer.radialOX ?? 0}</span>
          </Row>
          <Row label="光源Y">
            <input type="range" min="-100" max="100" step="1" value={layer.radialOY ?? -40}
              onChange={e => set('radialOY', +e.target.value)} />
            <span className={s.val}>{layer.radialOY ?? -40}</span>
          </Row>
        </>)}
        {(bgType === 'pattern_hex' || bgType === 'pattern_stripe') && (
          <Row label="格子大小">
            <input type="range" min="6" max="40" step="1" value={layer.patternSize ?? 16}
              onChange={e => set('patternSize', +e.target.value)} />
            <span className={s.val}>{layer.patternSize ?? 16}</span>
          </Row>
        )}
      </>}

      {/* ── 装饰 ── */}
      {layer.type === 'decoration' && <>
        <Row label="类型">
          <select value={layer.decorType ?? 'corner_marks'} onChange={e => set('decorType', e.target.value)}>
            {DECOR_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Row>
        <Row label="颜色">
          <input type="color" value={layer.color?.startsWith('rgba') ? '#c8a96e' : (layer.color ?? '#c8a96e')}
            onChange={e => set('color', e.target.value)} />
        </Row>
      </>}

      {/* ── 人物 ── */}
      {layer.type === 'character' && <>
        <Row label="立绘">
          <button className={s.uploadBtn} onClick={() => imgRef.current.click()}>
            {layer.image ? '✓ 已上传，替换' : '+ 导入立绘 PNG'}
          </button>
          <input ref={imgRef} type="file" accept="image/*" hidden onChange={handleImg} />
        </Row>
        {layer.image && <>
          <Row label="大小">
            <input type="range" min="0.3" max="2.5" step="0.01" value={layer.scale ?? 1}
              onChange={e => set('scale', parseFloat(e.target.value))} />
            <span className={s.val}>{((layer.scale ?? 1) * 100).toFixed(0)}%</span>
          </Row>
          <Row label="左右">
            <input type="range" min="-300" max="300" step="1" value={layer.offsetX ?? 0}
              onChange={e => set('offsetX', +e.target.value)} />
            <span className={s.val}>{layer.offsetX ?? 0}</span>
          </Row>
          <Row label="上下">
            <input type="range" min="-300" max="300" step="1" value={layer.offsetY ?? 0}
              onChange={e => set('offsetY', +e.target.value)} />
            <span className={s.val}>{layer.offsetY ?? 0}</span>
          </Row>
        </>}
      </>}

      {/* ── 文字 ── */}
      {layer.type === 'text' && <>
        <Row label="内容">
          <input type="text" value={layer.text ?? ''} placeholder="输入文字"
            onChange={e => set('text', e.target.value)} />
        </Row>
        <Row label="样式">
          <select value={layer.position ?? 'badge'}
            onChange={e => set('position', e.target.value)}>
            <option value="badge">底部标牌</option>
            <option value="badge_top">顶部标牌</option>
            <option value="free">自由位置</option>
          </select>
        </Row>
        <Row label="颜色">
          <input type="color" value={layer.color ?? '#e8c97a'} onChange={e => set('color', e.target.value)} />
        </Row>
        <Row label="边框色">
          <input type="color" value={layer.borderColor ?? '#c8a96e'} onChange={e => set('borderColor', e.target.value)} />
        </Row>
        {layer.position === 'free' && <>
          <Row label="字号">
            <input type="range" min="8" max="60" step="1" value={layer.fontSize ?? 18}
              onChange={e => set('fontSize', +e.target.value)} />
            <span className={s.val}>{layer.fontSize ?? 18}</span>
          </Row>
          <Row label="加粗">
            <label className={s.toggle}>
              <input type="checkbox" checked={!!layer.bold} onChange={e => set('bold', e.target.checked)} />
              <span>粗体</span>
            </label>
          </Row>
          <Row label="左右">
            <input type="range" min="-300" max="300" step="1" value={layer.offsetX ?? 0}
              onChange={e => set('offsetX', +e.target.value)} />
            <span className={s.val}>{layer.offsetX ?? 0}</span>
          </Row>
          <Row label="上下">
            <input type="range" min="-350" max="350" step="1" value={layer.offsetY ?? 0}
              onChange={e => set('offsetY', +e.target.value)} />
            <span className={s.val}>{layer.offsetY ?? 0}</span>
          </Row>
        </>}
        {(layer.position === 'badge' || layer.position === 'badge_top') && (
          <Row label="标牌宽">
            <input type="range" min="80" max="320" step="1" value={layer.badgeWidth ?? 200}
              onChange={e => set('badgeWidth', +e.target.value)} />
            <span className={s.val}>{layer.badgeWidth ?? 200}</span>
          </Row>
        )}
      </>}
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 14px', fontSize:12 }}>
      <span style={{ width:52, flexShrink:0, color:'var(--text-secondary)', fontSize:11 }}>{label}</span>
      <div style={{ flex:1, display:'flex', alignItems:'center', gap:6 }}>{children}</div>
    </div>
  )
}
