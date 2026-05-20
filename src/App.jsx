import React, { useState, useRef, useCallback } from 'react'
import BadgeCanvas from './components/BadgeCanvas'
import LayerPanel from './components/LayerPanel'
import LayerEditor from './components/LayerEditor'
import BorderPanel from './components/BorderPanel'
import s from './App.module.css'

let nextId = 10

const defaultLayers = [
  { id: 1, type: 'background', name: '背景', visible: true, zIndex: 0, bgType: 'arknights', color1: '#1a2640', color2: '#060c14', opacity: 1 },
  { id: 2, type: 'decoration', name: '装饰线', visible: true, zIndex: 1, decorType: 'corner_marks', color: 'rgba(200,169,110,0.5)', opacity: 0.7 },
  { id: 3, type: 'text', name: 'STULTIFERA NAVIS', visible: true, zIndex: 5, text: 'STULTIFERA NAVIS', position: 'badge', color: '#e8c97a', bold: true, opacity: 1 },
]

const defaultConfig = {
  outerBorderWidth: 16,
  outerBorderColor: '#1a1628',
  gapWidth: 12,
  gapColor: '#e8e0d0',
  innerBorderWidth: 6,
  innerLineWidth: 2,
}

export default function App() {
  const [layers, setLayers] = useState(defaultLayers)
  const [selectedId, setSelectedId] = useState(1)
  const [config, setConfig] = useState(defaultConfig)
  const [toast, setToast] = useState(null)
  const [tab, setTab] = useState('layers') // 'layers' | 'border'
  const badgeRef = useRef(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  const addLayer = (type) => {
    const id = ++nextId
    const zIndex = Math.max(...layers.map(l => l.zIndex)) + 1
    const defaults = {
      background: { bgType: 'gradient', color1: '#1a1a2e', color2: '#0a0818' },
      decoration: { decorType: 'laurel', color: '#c8a96e' },
      character: { scale: 1, offsetX: 0, offsetY: 0 },
      text: { text: '文字', position: 'badge', color: '#e8c97a', fontSize: 18, bold: true },
    }
    setLayers(prev => [...prev, { id, type, name: '', visible: true, zIndex, opacity: 1, ...defaults[type] }])
    setSelectedId(id)
  }

  const deleteLayer = (id) => {
    setLayers(prev => prev.filter(l => l.id !== id))
    setSelectedId(null)
  }

  const changeLayer = (id, patch) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))
  }

  const reorderLayer = (id, newZ) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, zIndex: newZ } : l))
  }

  const selectedLayer = layers.find(l => l.id === selectedId) ?? null

  const handleExport = async () => {
    const dataUrl = badgeRef.current?.exportPNG()
    if (!dataUrl) return
    if (window.electronAPI) {
      const result = await window.electronAPI.saveImage({ dataUrl, defaultName: '士气章.png' })
      if (result.success) showToast(`已保存：${result.filePath}`)
    } else {
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `士气章_${Date.now()}.png`
      a.click()
      showToast('已导出PNG')
    }
  }

  return (
    <div className={s.app}>
      {/* 左侧面板 */}
      <aside className={s.sidebar}>
        <div className={s.sideHeader}>
          <span className={s.logo}>⬡</span>
          <h1>士气章</h1>
          <button className={s.exportBtn} onClick={handleExport}>↓ 导出</button>
        </div>

        <div className={s.tabs}>
          <button className={tab === 'layers' ? s.activeTab : ''} onClick={() => setTab('layers')}>图层</button>
          <button className={tab === 'border' ? s.activeTab : ''} onClick={() => setTab('border')}>边框</button>
        </div>

        <div className={s.sideContent}>
          {tab === 'layers' && (
            <>
              <LayerPanel
                layers={layers}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onChange={changeLayer}
                onAdd={addLayer}
                onDelete={deleteLayer}
                onReorder={reorderLayer}
              />
              <LayerEditor
                layer={selectedLayer}
                onChange={changeLayer}
              />
            </>
          )}
          {tab === 'border' && (
            <BorderPanel config={config} onChange={setConfig} />
          )}
        </div>

        <div className={s.sizeNote}>5.2 × 6 cm · 300 DPI · PNG</div>
      </aside>

      {/* 画布区 */}
      <main className={s.canvas}>
        <div className={s.canvasInner}>
          <BadgeCanvas ref={badgeRef} config={config} layers={layers} />
        </div>
      </main>

      {toast && <div className={`${s.toast} ${s[toast.type]}`}>{toast.msg}</div>}
    </div>
  )
}
