// 预解压 winCodeSign 缓存，绕过 electron-builder 的符号链接问题
// 用法：node prepare-cache.js  然后再 npm run electron:build:dir
const fs = require('fs')
const path = require('path')
const os = require('os')
const https = require('https')
const { execSync } = require('child_process')

const cacheDir = path.join(os.homedir(), 'AppData', 'Local', 'electron-builder', 'Cache', 'winCodeSign')
const targetDir = path.join(cacheDir, 'winCodeSign-2.6.0')

if (fs.existsSync(targetDir) && fs.existsSync(path.join(targetDir, 'windows-10'))) {
  console.log('✓ winCodeSign 缓存已存在，无需处理')
  process.exit(0)
}

fs.mkdirSync(cacheDir, { recursive: true })
const url = 'https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-2.6.0/winCodeSign-2.6.0.7z'
const archivePath = path.join(cacheDir, 'winCodeSign-2.6.0.7z')

console.log('下载 winCodeSign...')

function download(url, dest, cb) {
  const file = fs.createWriteStream(dest)
  https.get(url, (res) => {
    if (res.statusCode === 302 || res.statusCode === 301) {
      return download(res.headers.location, dest, cb)
    }
    res.pipe(file)
    file.on('finish', () => file.close(cb))
  }).on('error', (err) => { fs.unlinkSync(dest); console.error(err) })
}

download(url, archivePath, () => {
  console.log('✓ 下载完成，正在解压（跳过符号链接）...')
  const sevenZip = path.join(__dirname, 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe')
  fs.mkdirSync(targetDir, { recursive: true })
  try {
    // 关键：解压时排除 darwin 的符号链接文件（mac签名工具，windows用不到）
    execSync(`"${sevenZip}" x -bd -y "-x!darwin" "${archivePath}" "-o${targetDir}"`, { stdio: 'inherit' })
    console.log('✓ 解压完成！现在可以运行 npm run electron:build:dir')
  } catch (e) {
    console.error('解压失败:', e.message)
  }
})
