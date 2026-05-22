# 蚀刻章设计工具

二次元风格六边形士气章设计桌面软件。支持图层系统、人物立绘破框、可拖拽文字和几何图形，导出300DPI印刷级PNG。

---

## 运行环境

- **Node.js** v18 或以上 → [下载地址](https://nodejs.org/)
- **Git**（可选，用于拉取更新）→ [下载地址](https://git-scm.com/)

安装好 Node.js 后，打开终端（Windows 用 PowerShell 或 Git Bash）验证：

```bash
node -v   # 应显示 v18.x.x 或更高
npm -v    # 应显示 9.x.x 或更高
```

---

## 第一次运行

### 1. 下载项目

```bash
git clone https://github.com/MorganTian886/ShiQiZhang.git
cd ShiQiZhang
```

或者直接下载 ZIP 解压到本地，进入文件夹。

### 2. 安装依赖

```bash
npm install
```

第一次执行会下载依赖包，需要等待 1～3 分钟（取决于网速）。

### 3. 开发预览（浏览器）

```bash
npm run dev
```

浏览器打开 `http://localhost:5173` 即可预览。

### 4. 桌面软件模式（推荐）

```bash
npm run electron:dev
```

会同时启动 Vite 开发服务器和 Electron 窗口。

---

## 打包成可执行文件

### Windows（在 Windows 上运行）

```bash
npm run pack:win
```

打包完成后在 `dist-pack/shiqizhang-win32-x64/` 里，双击 `shiqizhang.exe` 运行。

### macOS（在 Mac 上运行）

```bash
npm run pack:mac
```

打包完成后在 `dist-pack/蚀刻章设计工具-darwin-x64/` 里，双击 `蚀刻章设计工具.app` 运行。

> Mac 首次打开可能提示「无法验证开发者」，去「系统设置 → 隐私与安全性」点「仍要打开」即可。

---

### 如果遇到 winCodeSign 报错

错误信息：`Cannot create symbolic link : A required privilege is not held by the client`

这是 electron-builder 的已知问题，与代码无关。解决方案：

**方法 A：开启 Windows 开发者模式（推荐）**

1. 按 `Win + I` 打开设置
2. 搜索「开发者模式」
3. 打开开关
4. 重新运行 `npm run pack`

**方法 B：以管理员身份运行终端**

右键 PowerShell 或 Git Bash → 以管理员身份运行 → 重新运行命令

---

## 下载很慢？

编辑项目根目录的 `.npmrc` 文件，取消注释以下两行：

```
ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
```

然后删除 `node_modules` 文件夹，重新运行 `npm install`。

---

## 日常更新

```bash
git pull
npm install   # 如果 package.json 有变动
npm run pack  # 重新打包
```

---

## 功能说明

### 图层系统

左侧面板顶部可添加四种图层：

| 图层类型 | 用途 |
|----------|------|
| 背景 | 渐变、星空、纯色、自定义图片等15种背景 |
| 装饰 | 可拖拽的几何图形（圆、星、盾牌等13种） |
| 人物 | 导入立绘PNG，支持破框效果 |
| 文字 | 可拖拽文本框，多种花体字体 |

图层支持：显示/隐藏、上下排序、删除。

### 画布与边框

左侧「边框」标签页可调整：
- 六边形宽高（px）
- 外框、间距带、内框的粗细和颜色
- 内细线粗细和颜色

### 交互操作

文字框和几何图形都支持在预览区直接操作：

| 操作 | 方式 |
|------|------|
| 移动 | 点住拖动 |
| 缩放 | 拖动白色角点 |
| 旋转 | 拖动顶部金色圆点 |

### 导出

点击左上角「↓ 导出」，选择保存位置，输出透明背景 PNG（300DPI，可直接送厂印刷）。

### 自动保存

每次操作后 5 秒自动保存到 `桌面/auto-save/蚀刻章/`。

| 文件 | 说明 |
|------|------|
| `autosave_project.json` | 完整项目参数（图层配置、边框、颜色等） |
| `autosave_preview.png` | 最新预览截图 |
| `backups/` | 带时间戳历史备份，最多保留20个 |

下次打开软件会自动恢复上次的项目。

> ⚠️ 图片素材（立绘、背景图）无法写入 JSON，恢复后需重新上传，其他参数完整保留。

---

## 印刷规格

| 参数 | 默认值 |
|------|--------|
| 画布尺寸 | 5.2 × 6 cm |
| 分辨率 | 300 DPI |
| 格式 | PNG（透明背景） |
| 像素尺寸 | 约 1228 × 1417 px |

