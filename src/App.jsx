import React, { useState, useRef, useEffect, useCallback } from 'react'
import BadgeCanvas from './components/BadgeCanvas'
import IconLibrary from './components/IconLibrary'
import DetailCardEditor, { drawDetailCard } from './components/DetailCard'
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
  const [cardInfo, setCardInfo] = useState({ code:'MD-001', name:'', condition:'', lore:'' })
  const [showIconLib, setShowIconLib] = useState(false)
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

  const duplicateLayer = (id) => {
    const src = layers.find(l => l.id === id)
    if (!src) return
    nextId = Math.max(nextId, ...layers.map(l => l.id || 0))
    const newId = ++nextId
    const newZ = Math.max(...layers.map(l => l.zIndex), 0) + 1
    const copy = {
      ...src,
      id: newId,
      name: (() => {
        // 去掉已有的"副本 N"后缀，加新编号
        const baseName = (src.name || '').replace(/\s*副本\s*\d*$/, '').trim() || src.type
        const nums = layers
          .map(l => { const m = (l.name||'').match(new RegExp('^' + baseName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '\\s*副本\\s*(\\d*)$')); return m ? (parseInt(m[1])||1) : 0 })
          .filter(n => n > 0)
        const next = nums.length ? Math.max(...nums) + 1 : 1
        return `${baseName} 副本 ${next}`
      })(),
      zIndex: newZ,
      // 文字/装饰偏移一点，不完全重叠
      textX: src.textX != null ? src.textX + 20 : undefined,
      textY: src.textY != null ? src.textY + 20 : undefined,
      shapeX: src.shapeX != null ? src.shapeX + 20 : undefined,
      shapeY: src.shapeY != null ? src.shapeY + 20 : undefined,
    }
    setLayers(prev => [...prev, copy])
    setSelectedId(newId)
  }

  const changeLayer = (id, patch) => setLayers(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))
  const reorderLayer = (id, newZ) => setLayers(prev => prev.map(l => l.id === id ? { ...l, zIndex: newZ } : l))
  
  // 交换两个图层的zIndex（原子操作，一次setState）
  const swapLayers = (idA, idB) => setLayers(prev => {
    const a = prev.find(l => l.id === idA)
    const b = prev.find(l => l.id === idB)
    if (!a || !b) return prev
    return prev.map(l => {
      if (l.id === idA) return { ...l, zIndex: b.zIndex }
      if (l.id === idB) return { ...l, zIndex: a.zIndex }
      return l
    })
  })

  const applyTemplate = (tplConfig) => {
    setConfig(prev => ({ ...prev, ...tplConfig }))
    showToast('已套用边框模板')
  }

  const handleExportCard = async () => {
    const dataUrl = badgeRef.current?.exportPNG()
    if (!dataUrl) return
    // 先等图片加载再生成卡片
    const img = new Image()
    img.onload = async () => {
      const cardDataUrl = drawDetailCard(dataUrl, cardInfo)
      if (window.electronAPI) {
        const result = await window.electronAPI.saveImage({ dataUrl: cardDataUrl, defaultName: '详情卡片.png' })
        if (result.success) showToast('详情卡片已保存')
      } else {
        const a = document.createElement('a'); a.href = cardDataUrl; a.download = '详情卡片.png'; a.click()
        showToast('详情卡片已导出')
      }
    }
    img.src = dataUrl
  }

  const handleInsertIcon = (icon) => {
    nextId = Math.max(nextId, ...layers.map(l => l.id||0))
    const id = ++nextId
    const zIndex = Math.max(...layers.map(l => l.zIndex), 0) + 1
    setLayers(prev => [...prev, {
      id, type: 'decoration', name: icon.label, visible: true, zIndex, opacity: 1,
      decorType: 'image', image: icon.image,
      shapeX: 638, shapeY: 732, shapeW: 200, shapeH: 200, shapeRot: 0,
      shapeFill: '#c8a96e', shapeFilled: true, shapeLineW: 0
    }])
    setSelectedId(id)
    setShowIconLib(false)
    showToast(`已插入「${icon.label}」图标`)
  }

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
        // 恢复后更新 nextId，防止新图层 id 与已有图层冲突
        const maxId = Math.max(...restored.map(l => l.id || 0), 10)
        nextId = maxId
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
          <button className={tab === 'icons'  ? s.activeTab : ''} onClick={() => setTab('icons')}>图标</button>
          <button className={tab === 'card'   ? s.activeTab : ''} onClick={() => setTab('card')}>卡片</button>
        </div>
        <div className={s.sideContent}>
          {tab === 'layers' && <>
            <LayerPanel layers={layers} selectedId={selectedId} onSelect={setSelectedId}
              onChange={changeLayer} onAdd={addLayer} onDelete={deleteLayer} onReorder={reorderLayer} onSwap={swapLayers} onDuplicate={duplicateLayer} />
            <LayerEditor layer={selectedLayer} onChange={changeLayer} />
          </>}
          {tab === 'border' && <BorderPanel config={config} onChange={setConfig} onApplyTemplate={applyTemplate} />}
          {tab === 'icons'  && <IconLibrary onInsert={handleInsertIcon} />}
          {tab === 'card'   && <>
            <DetailCardEditor info={cardInfo} onChange={setCardInfo} />
            <div style={{padding:'0 14px 12px'}}>
              <button onClick={handleExportCard} style={{
                background:'linear-gradient(135deg,#c8a96e,#a07840)',border:'none',
                color:'#0a0a0c',padding:'10px',borderRadius:6,fontSize:13,
                fontWeight:700,width:'100%',cursor:'pointer'
              }}>↓ 导出详情卡片</button>
            </div>
          </>}
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
