import React, { useState, useRef } from 'react'
import BadgeCanvas from './components/BadgeCanvas'
import ControlPanel from './components/ControlPanel'
import styles from './App.module.css'

const defaultConfig = {
  bgColor1: '#1a1a2e',
  bgColor2: '#0e0c18',
  showRays: true,
  characterImg: null,
  characterScale: 1,
  characterX: 0,
  characterY: 0,
  text1: 'Remarkable',
  textPosition: 'bottom',
  text2: '',
}

export default function App() {
  const [config, setConfig] = useState(defaultConfig)
  const [toast, setToast] = useState(null)
  const badgeRef = useRef(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  const handleExport = async () => {
    if (!badgeRef.current) return
    const dataUrl = badgeRef.current.exportPNG()
    if (!dataUrl) return

    // Electron环境
    if (window.electronAPI) {
      const result = await window.electronAPI.saveImage({
        dataUrl,
        defaultName: `士气章_${Date.now()}.png`
      })
      if (result.success) {
        showToast(`已保存至：${result.filePath}`)
      }
    } else {
      // 浏览器降级
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `士气章_${Date.now()}.png`
      a.click()
      showToast('已导出PNG')
    }
  }

  return (
    <div className={styles.app}>
      <ControlPanel
        config={config}
        onChange={setConfig}
        onExport={handleExport}
      />

      <main className={styles.canvas}>
        <div className={styles.canvasInner}>
          <div className={styles.badge}>
            <BadgeCanvas ref={badgeRef} config={config} />
          </div>
          <p className={styles.sizeNote}>实际印刷尺寸：5.2 × 6 cm @ 300DPI</p>
        </div>
      </main>

      {toast && (
        <div className={`${styles.toast} ${styles[toast.type]}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
