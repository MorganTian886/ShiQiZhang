import React, { useRef } from 'react'
import styles from './ControlPanel.module.css'

export default function ControlPanel({ config, onChange, onExport }) {
  const fileRef = useRef(null)
  const bgRef = useRef(null)

  const update = (key, value) => onChange({ ...config, [key]: value })

  const handleCharacterUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const img = new Image()
    img.onload = () => update('characterImg', img)
    img.src = URL.createObjectURL(file)
  }

  const handleBgColorUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const img = new Image()
    img.onload = () => update('bgImage', img)
    img.src = URL.createObjectURL(file)
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.logo}>⬡</span>
        <h1>士气章设计工具</h1>
      </div>

      {/* 人物立绘 */}
      <section className={styles.section}>
        <h2>人物立绘</h2>
        <button className={styles.uploadBtn} onClick={() => fileRef.current.click()}>
          {config.characterImg ? '✓ 已上传，点击替换' : '+ 导入立绘图片'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleCharacterUpload} />

        {config.characterImg && (
          <div className={styles.sliderGroup}>
            <label>
              <span>大小</span>
              <input type="range" min="0.4" max="2" step="0.01"
                value={config.characterScale || 1}
                onChange={e => update('characterScale', parseFloat(e.target.value))} />
              <span className={styles.val}>{((config.characterScale || 1) * 100).toFixed(0)}%</span>
            </label>
            <label>
              <span>左右位置</span>
              <input type="range" min="-200" max="200" step="1"
                value={config.characterX || 0}
                onChange={e => update('characterX', parseFloat(e.target.value))} />
            </label>
            <label>
              <span>上下位置</span>
              <input type="range" min="-200" max="200" step="1"
                value={config.characterY || 0}
                onChange={e => update('characterY', parseFloat(e.target.value))} />
            </label>
          </div>
        )}
      </section>

      {/* 背景 */}
      <section className={styles.section}>
        <h2>背景</h2>
        <div className={styles.colorRow}>
          <label>
            <span>内色</span>
            <input type="color" value={config.bgColor1 || '#1a1a2e'}
              onChange={e => update('bgColor1', e.target.value)} />
          </label>
          <label>
            <span>外色</span>
            <input type="color" value={config.bgColor2 || '#16213e'}
              onChange={e => update('bgColor2', e.target.value)} />
          </label>
        </div>
        <label className={styles.toggle}>
          <input type="checkbox" checked={config.showRays !== false}
            onChange={e => update('showRays', e.target.checked)} />
          <span>放射线背景</span>
        </label>
      </section>

      {/* 文字 */}
      <section className={styles.section}>
        <h2>文字</h2>
        <label className={styles.textLabel}>
          <span>主标牌文字</span>
          <input type="text" placeholder="例：Remarkable"
            value={config.text1 || ''}
            onChange={e => update('text1', e.target.value)} />
        </label>
        <label className={styles.textLabel}>
          <span>标牌位置</span>
          <select value={config.textPosition || 'bottom'}
            onChange={e => update('textPosition', e.target.value)}>
            <option value="bottom">底部</option>
            <option value="top">顶部</option>
            <option value="center">居中</option>
          </select>
        </label>
        <label className={styles.textLabel}>
          <span>副文字（弧形区域）</span>
          <input type="text" placeholder="留空则不显示"
            value={config.text2 || ''}
            onChange={e => update('text2', e.target.value)} />
        </label>
      </section>

      {/* 导出 */}
      <section className={styles.section}>
        <h2>导出</h2>
        <p className={styles.hint}>导出为 300DPI 印刷级PNG<br />尺寸：5.2×6cm</p>
        <button className={styles.exportBtn} onClick={onExport}>
          ↓ 导出高清PNG
        </button>
      </section>
    </div>
  )
}
