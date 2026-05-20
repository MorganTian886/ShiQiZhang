import React, { useState, useRef } from 'react'
import BadgeCanvas from './components/BadgeCanvas'
import LayerPanel from './components/LayerPanel'
import LayerEditor from './components/LayerEditor'
import BorderPanel from './components/BorderPanel'
import s from './App.module.css'

let nextId = 10

const defaultLayers = [
  { id: 1, type: 'background', name: '背景', visible: true, zIndex: 0,
    bgType: 'arknights', color1: '#1a2640', color2: '#060c14', opacity: 1 },
]

const defaultConfig = {
  outerBorderWidth: 18,
  outerBorderColor: '#1a1628',
  gapWidth: 14,
  gapColor: '#e8e0d0',
  innerBorderWidth: 7,
  innerLineWidth: 1.5,
}

export default function App() {
  const [layers, setLayers] = useState(defaultLayers)
  const [selectedId, setSelectedId] = useState(1)
  const [config, setConfig] = useState(defaultConfig)
  const [toast, setToast] = useState(null)
  const [tab, setTab] = useState('layers')
  const badgeRef = useRef(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  const addLayer = (type) => {
    const id = ++nextId
    const zIndex = Math.max(...layers.map(l => l.zIndex), 0) + 1
    const defaults = {
      background: { bgType: 'radial', color1: '#1a1a2e', color2: '#0a0818' },
      decoration:  { decorType: 'corner_marks', color: '#c8a96e' },
      character:   { scale: 1, offsetX: 0, offsetY: 0 },
      text:        { text: 'STULTIFERA NAVIS', position: 'badge', color: '#e8c97a', bold: true, badgeWidth: 200 },
    }
    setLayers(prev => [...prev, { id, type, name: '', visible: true, zIndex, opacity: 1, ...defaults[type] }])
    setSelectedId(id)
  }

  const deleteLayer = (id) => {
    setLayers(prev => prev.filter(l => l.id !== id))
    setSelectedId(null)
  }

  const changeLayer = (id, patch) => setLayers(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))
  const reorderLayer = (id, newZ) => setLayers(prev => prev.map(l => l.id === id ? { ...l, zIndex: newZ } : l))

  const handleExport = async () => {
    const dataUrl = badgeRef.current?.exportPNG()
    if (!dataUrl) return
    if (window.electronAPI) {
      const result = await window.electronAPI.saveImage({ dataUrl, defaultName: '士气章.png' })
      if (result.success) showToast(`已保存：${result.filePath}`)
    } else {
      const a = document.createElement('a')
      a.href = dataUrl; a.download = `士气章_${Date.now()}.png`; a.click()
      showToast('已导出PNG')
    }
  }

  const selectedLayer = layers.find(l => l.id === selectedId) ?? null

  return (
    <div className={s.app}>
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
          {tab === 'layers' && <>
            <LayerPanel layers={layers} selectedId={selectedId} onSelect={setSelectedId}
              onChange={changeLayer} onAdd={addLayer} onDelete={deleteLayer} onReorder={reorderLayer} />
            <LayerEditor layer={selectedLayer} onChange={changeLayer} />
          </>}
          {tab === 'border' && <BorderPanel config={config} onChange={setConfig} />}
        </div>
        <div className={s.sizeNote}>5.2 × 6 cm · 300 DPI · PNG</div>
      </aside>

      <main className={s.canvas}>
        <div className={s.canvasInner}>
          <BadgeCanvas ref={badgeRef} config={config} layers={layers} />
        </div>
      </main>

      {toast && <div className={`${s.toast} ${s[toast.type]}`}>{toast.msg}</div>}
    </div>
  )
}
