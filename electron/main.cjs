const path = require('path')
const fs = require('fs')
const os = require('os')

const { app, BrowserWindow, ipcMain, dialog } = require('electron')

// 判断是否开发模式：只有当 dist/index.html 不存在时才认为是开发模式
const distIndexPath = path.join(__dirname, '../dist/index.html')
const distExists = fs.existsSync(distIndexPath)
const isDev = !distExists && (process.env.NODE_ENV === 'development' || !app.isPackaged)

// 自动保存目录：桌面/Rhoxane/auto-save
function getAutoSaveDir() {
  const desktop = path.join(os.homedir(), 'Desktop')
  const dir = path.join(desktop, 'auto-save', '蚀刻章')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 680,
    backgroundColor: '#0d0d0f',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    // 生产模式：加载打包的 dist/index.html
    win.loadFile(distIndexPath).catch(err => {
      // 加载失败时显示错误信息，方便排查
      win.webContents.executeJavaScript(`
        document.body.innerHTML = '<div style="color:#fff;padding:40px;font-family:sans-serif">'
          + '<h2>加载失败</h2><p>路径: ${distIndexPath.replace(/\\\\/g, '/')}</p>'
          + '<p>错误: ${String(err).replace(/'/g, '')}</p></div>'
      `).catch(()=>{})
    })
  }
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })

// ── 向PNG注入300DPI的pHYs元数据 ──
function inject300dpi(pngBuffer) {
  // 300 DPI = 300 * 39.3701 pixels/meter ≈ 11811
  const ppm = Math.round(300 * 39.3701)  // pixels per meter
  // pHYs chunk: 4字节X密度 + 4字节Y密度 + 1字节单位(1=meter)
  const physData = Buffer.alloc(9)
  physData.writeUInt32BE(ppm, 0)
  physData.writeUInt32BE(ppm, 4)
  physData.writeUInt8(1, 8)

  // 计算CRC（chunk类型 + data）
  const crcLib = require('zlib')
  const chunkType = Buffer.from('pHYs')
  const crcInput = Buffer.concat([chunkType, physData])
  // Node.js zlib 没有直接暴露crc32，手动实现
  function crc32(buf) {
    let crc = 0xFFFFFFFF
    const table = (() => {
      const t = []
      for (let i = 0; i < 256; i++) {
        let c = i
        for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
        t.push(c)
      }
      return t
    })()
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
    return (crc ^ 0xFFFFFFFF) >>> 0
  }

  const crcVal = crc32(crcInput)
  const physChunk = Buffer.alloc(4 + 4 + 9 + 4)
  physChunk.writeUInt32BE(9, 0)           // chunk长度
  chunkType.copy(physChunk, 4)            // 'pHYs'
  physData.copy(physChunk, 8)             // 数据
  physChunk.writeUInt32BE(crcVal, 17)     // CRC

  // PNG结构：8字节签名 + IHDR chunk（固定25字节）+ 其他chunks
  // 在IHDR之后插入pHYs
  const PNG_SIG_LEN = 8
  const IHDR_LEN = 25  // 4(len)+4(type)+13(data)+4(crc)
  const insertPos = PNG_SIG_LEN + IHDR_LEN

  return Buffer.concat([
    pngBuffer.slice(0, insertPos),
    physChunk,
    pngBuffer.slice(insertPos)
  ])
}

// ── 手动导出PNG（含300DPI元数据）──
ipcMain.handle('save-image', async (event, { dataUrl, defaultName }) => {
  const { filePath } = await dialog.showSaveDialog({
    title: '导出士气章',
    defaultPath: defaultName || '士气章.png',
    filters: [{ name: 'PNG图片', extensions: ['png'] }],
  })
  if (filePath) {
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
    const raw = Buffer.from(base64, 'base64')
    const with300dpi = inject300dpi(raw)
    fs.writeFileSync(filePath, with300dpi)
    return { success: true, filePath }
  }
  return { success: false }
})

// ── 自动保存（项目JSON + 预览PNG）──
ipcMain.handle('auto-save', async (event, { projectJson, previewDataUrl }) => {
  try {
    const dir = getAutoSaveDir()
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

    // 保存项目JSON（可恢复）
    const jsonPath = path.join(dir, 'autosave_project.json')
    fs.writeFileSync(jsonPath, projectJson, 'utf-8')

    // 保存预览PNG（最新一张，含300DPI）
    if (previewDataUrl) {
      const pngPath = path.join(dir, 'autosave_preview.png')
      const base64 = previewDataUrl.replace(/^data:image\/png;base64,/, '')
      const raw = Buffer.from(base64, 'base64')
      fs.writeFileSync(pngPath, inject300dpi(raw))
    }

    // 每小时备份一个带时间戳的版本，防止误覆盖
    const backupDir = path.join(dir, 'backups')
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir)
    // 检查最近backup时间
    const backupJson = path.join(backupDir, `${ts}.json`)
    const backups = fs.readdirSync(backupDir).filter(f => f.endsWith('.json')).sort()
    // 只保留最近20个备份
    if (backups.length >= 20) {
      fs.unlinkSync(path.join(backupDir, backups[0]))
    }
    // 每次自动保存都写备份（控制在前端做间隔）
    fs.writeFileSync(backupJson, projectJson, 'utf-8')

    return { success: true, dir }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ── 读取自动保存 ──
ipcMain.handle('load-autosave', async () => {
  try {
    const dir = getAutoSaveDir()
    const jsonPath = path.join(dir, 'autosave_project.json')
    if (!fs.existsSync(jsonPath)) return { success: false }
    const data = fs.readFileSync(jsonPath, 'utf-8')
    return { success: true, data }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ── 获取保存目录路径 ──
ipcMain.handle('get-autosave-dir', () => {
  return getAutoSaveDir()
})
