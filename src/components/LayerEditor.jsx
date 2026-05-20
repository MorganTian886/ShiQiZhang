import React, { useRef } from 'react'
import s from './LayerEditor.module.css'

const BG_TYPES = [
  { value: 'arknights', label: '明日方舟' },
  { value: 'stars', label: '星空' },
  { value: 'rays', label: '放射线' },
  { value: 'gradient', label: '径向渐变' },
  { value: 'linear', label: '线性渐变' },
  { value: 'grid', label: '科技网格' },
  { value: 'solid', label: '纯色' },
  { value: 'image', label: '自定义图片' },
]

const DECOR_TYPES = [
  { value: 'laurel', label: '月桂叶' },
  { value: 'circle_lines', label: '同心圆环' },
  { value: 'cross_lines', label: '放射线条' },
  { value: 'corner_marks', label: '六角标线' },
]

export default function LayerEditor({ layer, onChange }) {
  const imgRef = useRef(null)
  if (!layer) return <div className={s.empty}>选择一个图层进行编辑</div>

  const set = (key, val) => onChange(layer.id, { [key]: val })

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const img = new Image()
    img.onload = () => set('image', img)
    img.src = URL.createObjectURL(file)
  }

  return (
    <div className={s.editor}>
      <div className={s.layerTitle}>
        <input
          className={s.nameInput}
          value={layer.name || ''}
          placeholder="图层名称"
          onChange={e => set('name', e.target.value)}
        />
      </div>

      {/* 透明度 */}
      <Row label="透明度">
        <input type="range" min="0" max="1" step="0.01"
          value={layer.opacity ?? 1}
          onChange={e => set('opacity', parseFloat(e.target.value))} />
        <span className={s.val}>{Math.round((layer.opacity ?? 1) * 100)}%</span>
      </Row>

      {/* ── 背景图层 ── */}
      {layer.type === 'background' && <>
        <Row label="背景类型">
          <select value={layer.bgType ?? 'arknights'} onChange={e => set('bgType', e.target.value)}>
            {BG_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Row>
        {layer.bgType === 'image' && (
          <Row label="背景图">
            <button className={s.uploadBtn} onClick={() => imgRef.current.click()}>
              {layer.image ? '✓ 已上传' : '选择图片'}
            </button>
            <input ref={imgRef} type="file" accept="image/*" hidden onChange={handleImageUpload} />
          </Row>
        )}
        {layer.bgType !== 'image' && (
          <>
            <Row label="颜色1">
              <input type="color" value={layer.color1 ?? '#1a1a2e'} onChange={e => set('color1', e.target.value)} />
            </Row>
            {['gradient','linear','stars','grid','rays','arknights'].includes(layer.bgType) && (
              <Row label="颜色2">
                <input type="color" value={layer.color2 ?? '#0a0818'} onChange={e => set('color2', e.target.value)} />
              </Row>
            )}
          </>
        )}
      </>}

      {/* ── 装饰图层 ── */}
      {layer.type === 'decoration' && <>
        <Row label="装饰类型">
          <select value={layer.decorType ?? 'laurel'} onChange={e => set('decorType', e.target.value)}>
            {DECOR_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Row>
        <Row label="颜色">
          <input type="color" value={layer.color ?? '#c8a96e'} onChange={e => set('color', e.target.value)} />
        </Row>
      </>}

      {/* ── 人物图层 ── */}
      {layer.type === 'character' && <>
        <Row label="立绘图片">
          <button className={s.uploadBtn} onClick={() => imgRef.current.click()}>
            {layer.image ? '✓ 已上传，点击替换' : '+ 导入立绘 PNG'}
          </button>
          <input ref={imgRef} type="file" accept="image/*" hidden onChange={handleImageUpload} />
        </Row>
        {layer.image && <>
          <Row label="大小">
            <input type="range" min="0.3" max="2.5" step="0.01"
              value={layer.scale ?? 1} onChange={e => set('scale', parseFloat(e.target.value))} />
            <span className={s.val}>{((layer.scale ?? 1) * 100).toFixed(0)}%</span>
          </Row>
          <Row label="左右">
            <input type="range" min="-300" max="300" step="1"
              value={layer.offsetX ?? 0} onChange={e => set('offsetX', parseFloat(e.target.value))} />
            <span className={s.val}>{layer.offsetX ?? 0}</span>
          </Row>
          <Row label="上下">
            <input type="range" min="-300" max="300" step="1"
              value={layer.offsetY ?? 0} onChange={e => set('offsetY', parseFloat(e.target.value))} />
            <span className={s.val}>{layer.offsetY ?? 0}</span>
          </Row>
        </>}
      </>}

      {/* ── 文字图层 ── */}
      {layer.type === 'text' && <>
        <Row label="文字内容">
          <input type="text" value={layer.text ?? ''} placeholder="输入文字"
            onChange={e => set('text', e.target.value)} />
        </Row>
        <Row label="显示为标牌">
          <label className={s.toggle}>
            <input type="checkbox" checked={layer.position === 'badge' || layer.position === 'badge_top'}
              onChange={e => set('position', e.target.checked ? 'badge' : 'free')} />
            <span>标牌样式</span>
          </label>
        </Row>
        {(layer.position === 'badge' || layer.position === 'badge_top') && (
          <Row label="标牌位置">
            <select value={layer.position} onChange={e => set('position', e.target.value)}>
              <option value="badge">底部标牌</option>
              <option value="badge_top">顶部标牌</option>
            </select>
          </Row>
        )}
        <Row label="颜色">
          <input type="color" value={layer.color ?? '#e8c97a'} onChange={e => set('color', e.target.value)} />
        </Row>
        <Row label="字号">
          <input type="range" min="8" max="48" step="1"
            value={layer.fontSize ?? 18} onChange={e => set('fontSize', parseInt(e.target.value))} />
          <span className={s.val}>{layer.fontSize ?? 18}</span>
        </Row>
        <Row label="加粗">
          <label className={s.toggle}>
            <input type="checkbox" checked={!!layer.bold} onChange={e => set('bold', e.target.checked)} />
            <span>粗体</span>
          </label>
        </Row>
        <Row label="左右偏移">
          <input type="range" min="-300" max="300" step="1"
            value={layer.offsetX ?? 0} onChange={e => set('offsetX', parseFloat(e.target.value))} />
          <span className={s.val}>{layer.offsetX ?? 0}</span>
        </Row>
        <Row label="上下偏移">
          <input type="range" min="-350" max="350" step="1"
            value={layer.offsetY ?? 0} onChange={e => set('offsetY', parseFloat(e.target.value))} />
          <span className={s.val}>{layer.offsetY ?? 0}</span>
        </Row>
      </>}
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
