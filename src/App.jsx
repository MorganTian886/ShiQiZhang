import React, { useState, useRef, useEffect, useCallback } from 'react'
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
      decoration:  { decorType: 'circle', shapeFill: '#c8a96e', shapeFilled: true, shapeLineW: 0, shapeStroke: 'transparent', shapeX: 638, shapeY: 732, shapeW: 200, shapeH: 200, shapeRot: 0 },
      character:   { scale: 1, offsetX: 0, offsetY: 0 },
      text:        { text: '输入文字', font: 'Cinzel Decorative', fontSize: 24, color: '#e8c97a', bold: false, textX: 638, textY: 732, textW: 400, textH: 100, textRot: 0 },
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

  // ── 自动保存 ──
  // 图片对象不能JSON序列化，保存时跳过，恢复时提示重新上传
  const serializeLayers = (layers) => layers.map(l => {
    const copy = { ...l }
    if (copy.image) { copy.image = '__IMAGE_PLACEHOLDER__'; copy._hasImage = true }
    return copy
  })

  const doAutoSave = useCallback(async () => {
    if (!window.electronAPI) return
    try {
      const projectJson = JSON.stringify({ layers: serializeLayers(layers), config }, null, 2)
      const previewDataUrl = badgeRef.current?.exportPNG?.() ?? null
      const result = await window.electronAPI.autoSave({ projectJson, previewDataUrl })
      if (result.success) {
        setAutoSaveStatus(`已自动保存 ${new Date().toLocaleTimeString()}`)
        setTimeout(() => setAutoSaveStatus(''), 3000)
      }
    } catch (e) { console.error('autosave failed', e) }
  }, [layers, config])

  const [autoSaveStatus, setAutoSaveStatus] = useState('')

  // 每 60 秒自动保存一次，有变化才触发
  useEffect(() => {
    const timer = setInterval(doAutoSave, 60000)
    return () => clearInterval(timer)
  }, [doAutoSave])

  // 内容变化后 5 秒防抖保存
  const debounceRef = useRef(null)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(doAutoSave, 5000)
    return () => clearTimeout(debounceRef.current)
  }, [layers, config])

  // 启动时尝试读取自动保存
  useEffect(() => {
    if (!window.electronAPI) return
    window.electronAPI.loadAutosave().then(result => {
      if (!result.success) return
      try {
        const { layers: savedLayers, config: savedConfig } = JSON.parse(result.data)
        // 过滤掉有图片占位符的图层（图片需重新上传）
        const restored = savedLayers.map(l => ({ ...l, image: undefined }))
        const hasImages = savedLayers.some(l => l._hasImage)
        setLayers(restored)
        if (savedConfig) setConfig(savedConfig)
        const msg = hasImages
          ? '已恢复上次保存（含图片的图层需重新上传图片）'
          : '已恢复上次保存'
        showToast(msg, 'success')
      } catch(e) { console.error('restore failed', e) }
    })
  }, [])

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
          <BadgeCanvas
              ref={badgeRef}
              config={config}
              layers={layers}
              selectedId={selectedId}
              onLayerChange={(action, id, patch) => {
                if (action === 'select') setSelectedId(id)
                if (action === 'update') changeLayer(id, patch)
              }}
            />
        </div>
      </main>

      {toast && <div className={`${s.toast} ${s[toast.type]}`}>{toast.msg}</div>}
      {autoSaveStatus && <div className={s.autoSaveStatus}>{autoSaveStatus}</div>}
    </div>
  )
}
