import React, { useRef } from 'react'
import s from './LayerEditor.module.css'

const BG_TYPES = [
  { value: 'stars',           label: '⭐ 星空' },
  { value: 'watercolor',      label: '🎨 水彩晕染' },
  { value: 'cyberpunk',       label: '🌆 赛博朋克霓虹' },
  { value: 'fog',             label: '🌫 云雾/烟雾' },
  { value: 'marble',          label: '🪨 大理石纹' },
  { value: 'glow',            label: '✨ 光晕 Glow' },
  { value: 'solid',           label: '◼ 纯色' },
  { group: '── 线性渐变 ──' },
  { value: 'linear',          label: '↗ 自定义角度' },
  { value: 'linear_diagonal', label: '↗ 对角线45°' },
  { value: 'linear_h',        label: '→ 水平' },
  { value: 'linear_v',        label: '↓ 垂直' },
  { value: 'linear_hard',     label: '▌ 硬边断层' },
  { group: '── 径向渐变 ──' },
  { value: 'radial',          label: '◎ 中心径向' },
  { value: 'radial_offcenter',label: '◉ 偏心光晕' },
  { value: 'radial_hex',      label: '⬡ 六边形向心' },
  { group: '── 特殊模式 ──' },
  { value: 'conical',         label: '🌀 雷达/角度' },
  { value: 'pattern_hex',     label: '⬡ 蜂巢网格' },
  { value: 'pattern_stripe',  label: '▧ 斜线条纹' },
  { value: 'image',           label: '🖼 自定义图片' },
]

const DECOR_TYPES = [
  { group: '── 基础形状 ──' },
  { value: 'circle',      label: '⭕ 圆形 / 椭圆' },
  { value: 'rect',        label: '▬ 矩形' },
  { value: 'round_rect',  label: '▢ 圆角矩形' },
  { value: 'triangle',    label: '△ 三角形' },
  { value: 'diamond',     label: '◇ 菱形' },
  { value: 'line',        label: '─ 直线' },
  { group: '── 装饰形状 ──' },
  { value: 'hexagon',     label: '⬡ 六边形' },
  { value: 'star5',       label: '★ 五角星' },
  { value: 'star6',       label: '✦ 六角星' },
  { value: 'cross',       label: '✚ 十字' },
  { value: 'arrow',       label: '➤ 箭头' },
  { value: 'shield',      label: '🛡 盾牌' },
  { value: 'moon',        label: '🌙 月牙' },
]

const FONTS = [
  { group: '── 自定义字体 ──' },
  { value: 'Bebas Neue Bold',   label: 'Bebas Neue Bold' },
  { value: 'Dubai',             label: 'Dubai Regular' },
  { value: 'Dubai Light',       label: 'Dubai Light' },
  { value: 'Dubai Medium',      label: 'Dubai Medium' },
  { value: 'Dubai Bold',        label: 'Dubai Bold' },
  { value: 'MiSans',            label: 'MiSans' },
  { group: '── 花体/装饰字体 ──' },
  { value: 'Cinzel Decorative', label: 'Cinzel Decorative' },
  { value: 'Cinzel',            label: 'Cinzel' },
  { value: 'UnifrakturMaguntia',label: '古典黑体 Fraktur' },
  { value: 'Almendra Display',  label: 'Almendra Display' },
  { value: 'Uncial Antiqua',    label: 'Uncial Antiqua' },
  { value: 'Pirata One',        label: 'Pirata One' },
  { group: '── 中文字体 ──' },
  { value: 'Noto Serif SC',     label: '宋体 Noto Serif SC' },
  { value: 'Ma Shan Zheng',     label: '马善政楷书' },
  { value: 'ZCOOL XiaoWei',     label: '站酷小薇体' },
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
  const needsC3 = ['linear','linear_diagonal','linear_h','linear_v'].includes(bgType)

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
            <input type="color" value={layer.color1 ?? '#1a1a2e'}
              onChange={e => set('color1', e.target.value)} />
            <span className={s.hexLabel}>{layer.color1 ?? '#1a1a2e'}</span>
          </Row>
        )}
        {needsC2 && (
          <Row label="颜色2">
            <input type="color" value={layer.color2 ?? '#0a0818'}
              onChange={e => set('color2', e.target.value)} />
            <span className={s.hexLabel}>{layer.color2 ?? '#0a0818'}</span>
          </Row>
        )}
        {needsC3 && (
          <Row label="中间色">
            <input type="checkbox" checked={!!layer.color3}
              onChange={e => set('color3', e.target.checked ? '#4a3060' : null)} />
            {layer.color3 && <>
              <input type="color" value={layer.color3}
                onChange={e => set('color3', e.target.value)} />
              <span className={s.hexLabel}>{layer.color3}</span>
            </>}
            {!layer.color3 && <span style={{fontSize:10,color:'var(--text-dim)'}}>开启3色渐变</span>}
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
        {bgType === 'radial_offcenter' && <>
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
        </>}
        {(bgType === 'pattern_hex' || bgType === 'pattern_stripe') && (
          <Row label="格子大小">
            <input type="range" min="6" max="60" step="1" value={layer.patternSize ?? 20}
              onChange={e => set('patternSize', +e.target.value)} />
            <span className={s.val}>{layer.patternSize ?? 20}</span>
          </Row>
        )}
      </>}

      {/* ── 装饰几何 ── */}
      {layer.type === 'decoration' && <>
        <p style={{fontSize:10,color:'var(--text-dim)',padding:'0 14px 4px'}}>
          📌 在预览区拖动 · 拖角点缩放 · 拖金色点旋转
        </p>
        <Row label="形状">
          <select value={layer.decorType ?? 'circle'}
            onChange={e => set('decorType', e.target.value)}>
            {DECOR_TYPES.map((t,i) =>
              t.group ? <option key={i} disabled>{t.group}</option>
                      : <option key={t.value} value={t.value}>{t.label}</option>
            )}
          </select>
        </Row>
        <Row label="填充色">
          <input type="color" value={layer.shapeFill ?? '#c8a96e'}
            onChange={e => set('shapeFill', e.target.value)} />
          <span className={s.hexLabel}>{layer.shapeFill ?? '#c8a96e'}</span>
        </Row>
        <Row label="仅描边">
          <label className={s.toggle}>
            <input type="checkbox" checked={layer.shapeFilled === false}
              onChange={e => set('shapeFilled', !e.target.checked)} />
            <span>空心</span>
          </label>
        </Row>
        {layer.shapeFilled === false && (
          <Row label="线宽">
            <input type="range" min="1" max="20" step="1" value={layer.shapeLineW ?? 3}
              onChange={e => set('shapeLineW', +e.target.value)} />
            <span className={s.val}>{layer.shapeLineW ?? 3}</span>
          </Row>
        )}
        {layer.shapeFilled !== false && (
          <Row label="描边色">
            <input type="color" value={layer.shapeStroke ?? '#ffffff'}
              onChange={e => set('shapeStroke', e.target.value)} />
            <Row label="描边宽">
              <input type="range" min="0" max="16" step="1" value={layer.shapeLineW ?? 0}
                onChange={e => set('shapeLineW', +e.target.value)} />
              <span className={s.val}>{layer.shapeLineW ?? 0}</span>
            </Row>
          </Row>
        )}
        <Row label="旋转">
          <input type="range" min="-3.14159" max="3.14159" step="0.01"
            value={layer.shapeRot ?? 0}
            onChange={e => set('shapeRot', +e.target.value)} />
          <span className={s.val}>{Math.round((layer.shapeRot??0)*180/Math.PI)}°</span>
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
        <div className={s.textareaRow}>
          <textarea
            value={layer.text ?? ''}
            placeholder="输入文字内容（Shift+Enter换行）"
            rows={3}
            onChange={e => set('text', e.target.value)}
          />
        </div>
        <p style={{fontSize:10,color:'var(--text-dim)',padding:'0 14px 4px'}}>
          📌 在预览区直接拖动文字框移动 · 拖角点缩放 · 拖金色点旋转
        </p>
        <Row label="字体">
          <select value={layer.font ?? 'Cinzel Decorative'}
            onChange={e => set('font', e.target.value)}>
            {FONTS.map((f, i) =>
              f.group
                ? <option key={i} disabled>{f.group}</option>
                : <option key={i} value={f.value}>{f.label}</option>
            )}
          </select>
        </Row>
        <Row label="字号">
          <input type="range" min="8" max="120" step="1" value={layer.fontSize ?? 24}
            onChange={e => set('fontSize', +e.target.value)} />
          <span className={s.val}>{layer.fontSize ?? 24}</span>
        </Row>
        <Row label="颜色">
          <input type="color" value={layer.color ?? '#e8c97a'}
            onChange={e => set('color', e.target.value)} />
          <span className={s.hexLabel}>{layer.color ?? '#e8c97a'}</span>
        </Row>
        <Row label="加粗">
          <label className={s.toggle}>
            <input type="checkbox" checked={!!layer.bold}
              onChange={e => set('bold', e.target.checked)} />
            <span>粗体</span>
          </label>
        </Row>
        <Row label="旋转">
          <input type="range" min="-3.14159" max="3.14159" step="0.01"
            value={layer.textRot ?? 0}
            onChange={e => set('textRot', +e.target.value)} />
          <span className={s.val}>{Math.round((layer.textRot??0)*180/Math.PI)}°</span>
        </Row>
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
