# 打包说明

## 前提

安装 Node.js (v18+)，然后：

```bash
npm install
```

## 开发运行

```bash
npm run electron:dev
```

---

## 打包成 Windows 程序

### 方案一：便携版 EXE（默认，推荐）

```bash
npm run electron:build
```

生成 `dist-electron/蚀刻章设计工具-1.0.0-便携版.exe`，双击即可运行，无需安装。

### 方案二：免打包文件夹（最稳，绝不报错）

如果方案一报 `winCodeSign` / `Cannot create symbolic link` 错误：

```bash
npm run electron:build:dir
```

生成 `dist-electron/win-unpacked/` 文件夹，里面的 `蚀刻章设计工具.exe` 直接双击运行。
把整个文件夹复制到任何地方都能用。

---

## 关于 winCodeSign 报错

错误信息：`Cannot create symbolic link : A required privilege is not held by the client`

**原因**：electron-builder 下载的签名工具包里有 macOS 符号链接，Windows 默认无权限创建。

**解决办法**（任选其一）：

1. **用 dir 模式打包**（推荐）：`npm run electron:build:dir` —— 完全绕过签名工具
2. **开启开发者模式**：`Win + I` → 搜索「开发者模式」→ 打开 → 重新打包
3. **管理员运行终端**：右键终端 →「以管理员身份运行」→ 重新打包

我们的软件不需要代码签名，所以 dir 模式完全够用。

---

## 下载慢？

编辑 `.npmrc`，取消注释镜像地址：

```
ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
```

然后删除 node_modules 重新 `npm install`。
