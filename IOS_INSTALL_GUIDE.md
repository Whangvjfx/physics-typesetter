# 📱 A4 物理排版 iOS App 安装与使用指南

本项目已全面升级为支持 **iOS 原生 App (Capacitor) + iPad 分屏/横屏 + PWA 离线应用** 的现代化高精度排版系统。

---

## 🌟 新增功能与特性速览

1. **复古未来感 (Retro-Futuristic Cyber-Vintage) HUD 控制台**：深色黑曜石磨砂玻璃质感、微发光边框与触感反馈。
2. **iPad 与横屏自适应双栏架构**：在 iPad 或大屏横屏下自动切换为「左侧控制台 + 右侧排版输出舱」双栏布局。
3. **`\\` 专用双反斜杠快捷插入按键**：一键在光标位置插入 `\\` 强制换行符，无需频繁切换键盘符号。
4. **一键直接保存全部至 iOS 系统相册**：点击「💾 一键保存到相册」，自动将所有生成的 A4 高清解答图写入相册。
5. **100% 保留核心排版算法**：`1 -> l` 替换、60px 网格对齐、KaTeX 公式高度整倍化锁定、防截断分页与 2x Retina 高清输出完全一致。
6. **全量离线化运行**：字体、KaTeX 与 html2canvas 全部内置本地，无网也能排版。

---

## 🚀 方式一：云端构建与真机安装 IPA（无需 Mac，免费自签）

### 步骤 1：推送代码到 GitHub 触发云端打包
将本地代码提交并推送到你的 GitHub 仓库：
```bash
git add .
git commit -m "feat: iOS app with retro-futuristic UI & album saving"
git push origin main
```

### 步骤 2：下载构建生成的 IPA
1. 打开你的 GitHub 仓库页面，点击顶部的 **Actions** 选项卡。
2. 点击最新的 **Build iOS IPA** 工作流运行记录。
3. 在页面底部的 **Artifacts** 区域，点击下载 `PhysicsTypesetter-iOS-IPA`（解压得到 `PhysicsTypesetter.ipa`）。

### 步骤 3：在 Windows 上将 IPA 刷入 iPhone / iPad
使用以下任一免费工具即可直接安装到你的设备：

- **工具 1：Sideloadly（推荐，简单快速）**
  1. 在 Windows 电脑上下载并打开 [Sideloadly](https://sideloadly.io/)。
  2. 用数据线将 iPhone/iPad 连接到电脑。
  3. 将 `PhysicsTypesetter.ipa` 拖入 Sideloadly。
  4. 输入你的普通 Apple ID 账号（免费账号即可自签 7 天），点击 **Start**。
  5. 安装完成后，在 iPhone 进入「设置」->「通用」->「VPN 与设备管理」中信任你的开发者证书即可打开。

- **工具 2：爱思助手（签名安装）**
  1. 打开爱思助手，连接 iPhone/iPad。
  2. 进入「应用游戏」->「导入安装」或「IPA 签名」，使用 Apple ID 签名后直接一键安装。

- **工具 3：TrollStore（若设备支持巨魔商店）**
  - 直接隔空投送或用微信/QQ发送 `PhysicsTypesetter.ipa` 到设备，点击使用 TrollStore 永久安装（无需每周重新签名）。

---

## 🌐 方式二：PWA 模式（零成本，Safari 1秒安装）

如果你不想连电脑装 IPA，可以直接使用 PWA 模式：
1. 使用 GitHub Pages / Vercel 部署本项目。
2. 在 iPhone / iPad 上使用 **Safari 浏览器** 打开网页。
3. 点击 Safari 底部（或 iPad 顶部）的 **分享按钮 (Share)**。
4. 选择 **「添加到主屏幕」 (Add to Home Screen)**。
5. 手机桌面将生成独立的「物理排版」App 图标，点击即全屏运行，支持离线排版与相册保存。

---

## 💻 本地开发与调试指令

```bash
# 启动本地开发预览服务器 (支持 PC / iPad 同局域网访问)
npm run dev

# 打包生产静态资源
npm run build

# 同步构建资源至 iOS 原生工程
npm run cap:sync
```
