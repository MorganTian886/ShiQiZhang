# 打包说明

## 前提

安装 Node.js (v18+) 和 npm，然后：

```bash
npm install
```

## 开发运行

```bash
npm run electron:dev
```

## 打包成 .exe（Windows）

```bash
npm run electron:build
```

打包完成后在 `dist-electron/` 目录里找 `.exe` 安装包。

## 如果下载 Electron 很慢

在 `.npmrc` 里取消注释那行镜像地址：

```
ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
```

然后删掉 `node_modules` 重新 `npm install`。

## 打包产物

- `dist-electron/蚀刻章设计工具 Setup x.x.x.exe` — Windows 安装包
- `dist-electron/蚀刻章设计工具-x.x.x.dmg` — macOS 安装包
