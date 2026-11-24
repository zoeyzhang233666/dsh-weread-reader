# dsh-weread-reader

面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的**微信读书阅读 / 复制**插件。

在 DSH **右侧栏**打开书架与章节，正文可鼠标划选；支持**一键复制本章**、**勾选多章批量复制**，方便把内容交给 AI 分析。登录走**微信扫码**，不需要手动粘贴 Cookie。

> 插件安装器请搜索或粘贴完整包名：`dsh-weread-reader`

## 功能

- 右侧栏：书架 + 章节阅读
- **微信扫码登录**（登录态保存在当前 DSH profile，支持自动续期）
- 正文可鼠标划选；A- / A+ 调字号
- **复制本章** / 保存 Markdown
- 目录里勾选多章 → **复制选中** / **保存选中**（一次最多 40 章）
- 阅读时长心跳（Weread `/web/book/read`）

不含双语翻译。若需要对照翻译，请用 `dsh-weread-reader`。

## 环境

- DeepSeek Harness `0.2.x`（`>=0.2.1-rc.5 <0.3.0`）
- Node.js 24.9+
- 微信读书账号（扫码登录）

## 安装

### 从 GitHub 安装

```sh
dsh plugin --profile desktop add -w github:zoeyzhang233666/dsh-weread-reader
```

### 本地开发安装

```sh
cd /path/to/dsh-weread-reader
npm install
npm run build
dsh plugin --profile desktop add -w "/path/to/dsh-weread-reader"
```

安装后**完全退出并重启** DeepSeek Harness Desktop。

### 命令行（若已发布到 npm）

```sh
dsh plugin --profile desktop add -w dsh-weread-reader
```

## 使用

1. 右侧栏 guide 打开 **微信读书**。
2. 点 **生成二维码**，微信扫码确认。
3. 从书架打开书籍；正文可直接划选复制。
4. 工具栏 **复制本章**；或打开 **目录 / 多选** 勾选章节后 **复制选中**。
5. 粘贴到 DSH / Cursor 对话里交给 AI 分析。

## 风险说明

- 微信读书无公开官方 API，接口可能变更。
- 登录态等同 Cookie，勿提交到仓库。
- 阅读时长与官方 App 对齐为尽力而为。

## 开发

```sh
npm test
npm run build
```

## 许可

MIT。详见 `LICENSE` 与 `NOTICE`。
