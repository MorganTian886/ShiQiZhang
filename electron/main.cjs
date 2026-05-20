const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// 自动保存目录：桌面/Rhoxane/蚀刻章
function getAutoSaveDir() {
  const desktop = path.join(os.homedir(), 'Desktop')
  const dir = path.join(desktop, 'Rhoxane', '蚀刻章')
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
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })

// ── 手动导出PNG ──
ipcMain.handle('save-image', async (event, { dataUrl, defaultName }) => {
  const { filePath } = await dialog.showSaveDialog({
    title: '导出士气章',
    defaultPath: defaultName || '士气章.png',
    filters: [{ name: 'PNG图片', extensions: ['png'] }],
  })
  if (filePath) {
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
    fs.writeFileSync(filePath, base64, 'base64')
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

    // 保存预览PNG（最新一张）
    if (previewDataUrl) {
      const pngPath = path.join(dir, 'autosave_preview.png')
      const base64 = previewDataUrl.replace(/^data:image\/png;base64,/, '')
      fs.writeFileSync(pngPath, base64, 'base64')
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
