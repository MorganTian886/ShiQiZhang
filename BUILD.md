# 打包说明

## 前提
安装 Node.js (v18+)，然后 `npm install`

## 开发运行
```bash
npm run electron:dev
```

---

## 打包成 Windows 程序

### ⭐ 推荐方案：electron-packager（绝不报 winCodeSign 错误）

electron-builder 有个老问题：即使不签名也会强行下载 winCodeSign 工具包，
而这个包在 Windows 上解压会因符号链接权限报错。

改用 electron-packager，它只复制文件、不签名、不下载额外东西：

```bash
npm install        # 安装新增的 @electron/packager
npm run pack
```

生成 `dist-pack/shiqizhang-win32-x64/` 文件夹，
里面的 `shiqizhang.exe` 双击即可运行。整个文件夹可复制到任何电脑使用。

---

### 备选方案（如果你想用 electron-builder 出安装包）

需要先解决 winCodeSign 符号链接问题，任选其一：

**A. 开启 Windows 开发者模式**
`Win + I` → 搜「开发者模式」→ 打开 → 重新 `npm run electron:build`

**B. 管理员运行终端**
右键终端 →「以管理员身份运行」→ `npm run electron:build`

**C. 预解压缓存（跳过符号链接）**
```bash
node prepare-cache.js
npm run electron:build:dir
```

---

## 下载慢？
编辑 `.npmrc` 取消注释镜像地址，删除 node_modules 重装。
