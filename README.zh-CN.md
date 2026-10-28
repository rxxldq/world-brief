# World Brief · 世界简报

ai简报系统很多，但这个会让你更客观一点，每周周评包含各个立场无论左翼右翼还是什么国籍，顺便尽量标出他们的资金来源，才能更好地知道他们为谁在讲话。也支持英文及更多语言的自动翻译，方便不同语言的读者对照原文、比较各方观点。

[![CI](https://github.com/rxxldq/world-brief/actions/workflows/ci.yml/badge.svg)](https://github.com/rxxldq/world-brief/actions/workflows/ci.yml) [![Website](https://github.com/rxxldq/world-brief/actions/workflows/pages.yml/badge.svg)](https://github.com/rxxldq/world-brief/actions/workflows/pages.yml)

[English](README.md) · [配置说明](docs/configuration.md) · [范围与验收](SPEC.md) · [隐私](docs/privacy.md)

[公开预览](https://rxxldq.club/world-brief/) · [GitHub 源码](https://github.com/rxxldq/world-brief)

[在线使用说明](https://rxxldq.club/world-brief/usage.zh.html) · [English guide](https://rxxldq.club/world-brief/usage.en.html)

公开页面只展示虚构示例。真实简报生成和直接 AI 问答在自己的电脑上运行。`npm run build:demo` 可在本机生成相同预览，输出到 `.world-brief/site/`。

需要 Windows、macOS 或 Linux 和 Node.js 22 以上版本。离线流程没有第三方运行依赖，无需模型账号、额度遥测或外部模型路由。

## 功能与实现

| 范围 | 实现 |
| --- | --- |
| 简报 | 每日日报与多视角周评，展开立场、依据、论证和反方问题 |
| 公开披露 | 可选的资金／所有权背景，保留引用，区分个人、机构及未知状态 |
| 阅读器 | 中英文原始界面、39 种翻译语言选项、搜索、目录、展开条目、原文链接与复制 AI 提示词 |
| 本地流程 | Node.js CLI、JSON 验证、可选本机问答服务及明确启用的通知 |
| 调度 | Windows、Linux、macOS 原生调度文件导出，日报默认每天 |
| 验证 | 自动测试、隐私扫描及三种系统、Node 22/24 的持续集成 |

本仓库公开可复用的工具代码；链接的网站展示虚构数据下的阅读器，不是托管的实时新闻或 AI 服务。

## 离线试用

在本目录运行，PowerShell、bash、zsh 使用相同命令：

```sh
npm ci --ignore-scripts
node bin/world-brief.mjs init --locale zh
node bin/world-brief.mjs run --input examples/daily.zh.json
node bin/world-brief.mjs run --kind weekly --input examples/weekly.zh.json
node bin/world-brief.mjs serve
```

打开终端输出的本机地址。Ctrl+C 停止服务。所有示例均为虚构，链接只是格式占位，不能当作新闻证据。

产物在配置中的 `outRoot` 下，默认 `.world-brief/briefs/日期-daily或weekly/`；首页是存档目录。同日已有产物不会被覆盖。相对路径以配置文件所在目录为基准。也可以直接打开 HTML 文件，使用搜索、目录和复制提示词；直接问答需要本地服务及已启用的模型。

## 多语言自动翻译

阅读器、存档和公开使用说明的翻译面板提供 39 种目标语言选项，包括英文、法文、西班牙文、日文、阿拉伯文等，也可选择浏览器语言。选择后点击“翻译”，支持的桌面浏览器通过内置 [Translator API](https://developer.chrome.com/docs/ai/translator-api) 在本机处理；首次使用某种语言组合可能需要下载由浏览器管理的模型。支持情况取决于浏览器、设备和语言组合，可随时“恢复原文”。保存的 JSON、来源链接、人名和标识不变。生成及原始界面的 `locale` 仍为 `en` 或 `zh`，与阅读时的翻译选择独立。

原地翻译不可用时，公开 HTTPS 页面提供单独的 [Google 网页翻译](https://support.google.com/translate/answer/2534559?hl=en)入口。只有主动打开后，Google 才会收到该公开网址并处理页面；本机、私人地址不会提供此入口。打开 World Brief 不会自动向翻译服务发送文字。本机翻译需要受支持的安全浏览器环境，直接打开文件可能不可用。自动翻译可能误解引语、未核实信息和资金关系，请结合原文与来源核对。

## 模型与配置

`config.json` 是本机配置，已加入忽略列表。`locale` 可用 `zh` 或 `en`，`timezone` 使用 IANA 时区。改变配置中的界面语言不会翻译旧文章；阅读器另外提供英文、浏览器语言及更多语言的自动翻译选项。

模型默认关闭。需要实时简报时，将 `provider.type` 改为 `command`，设置本机程序和参数。程序从标准输入接收一条 JSON 请求：`task=generate` 时输出单个简报 JSON，`task=ask` 时输出纯文本回答。模型需要自行提供搜索能力。详见[配置与 Claude CLI 示例](docs/configuration.md#provider-contract)。本工具不读取账号额度、不自动改换模型。

```sh
node bin/world-brief.mjs run --kind daily
node bin/world-brief.mjs validate 简报目录
node bin/world-brief.mjs render 简报目录 --locale zh
node bin/world-brief.mjs push 简报目录
```

每条新闻必须带 HTTP(S) 来源，每张图片必须带出处页和署名；本地图片只接受 `img/` 中通过检查的 PNG、JPEG、GIF、WebP。SVG 与第三方嵌入脚本不随公开版提供。验证只检查结构，不等于事实核实。

## 调度与推送

```sh
node bin/world-brief.mjs schedule --platform windows
node bin/world-brief.mjs schedule --platform linux
node bin/world-brief.mjs schedule --platform macos
```

这些命令仅导出调度文件，不安装任务。Windows 导出 PowerShell 注册脚本，Linux 导出 cron 片段，macOS 导出 LaunchAgent plist。请先检查，再自行安装；[英文说明](README.md#scheduling-and-notifications)列有安装与移除方式。触发时间使用操作系统本地时区；建议配置 `timezone` 与系统一致。日报默认 `dailyEveryDays: 1`，每天 07:30；旧版配置需自行把原来的 3 改为 1，更新源码不会覆盖私人配置。周评保留星期日 09:00，至少间隔七天。关闭机器时不会补齐历史各期。

ntfy 默认关闭。配置自己的频道和环境变量令牌后，只有 `push 简报目录 --send` 才真正发送。公共频道不应承载私人信息。调度任务默认不发送通知。

## 验证与限制

```sh
npm run check
npm test
npm run smoke
npm run privacy
```

测试使用虚构数据及本地假模型，不消耗真实模型额度，不发推送，不安装任务。跨平台 CI 已配置；本地实际验证范围见[构建报告](docs/build-report.md)。

公开副本不包含邮箱接入、私人频道、个人历史简报、账号额度数据、浏览器资料或机器路径。外部程序仍具有你的用户权限；空工作目录不是操作系统隔离。问答会发送选定新闻、问题及最多六条历史消息给配置的模型，本工具不保存对话正文。

来源真实性、可访问性、引语准确性和媒体立场仍需人工核对。第三方图片需要独立确认使用许可；远程图片在查看页面时会连接图片主机。

周评按原文支持情况展开每人的立场、依据、论证和反方问题，并可附公开资金背景、引用及核查日期。机构资金与个人关系分开显示；“未找到/未核查”不表示没有资助，也不能把机构捐助者写成作者为某条评论收款的证据。

项目介绍和使用说明放在本 GitHub 仓库，网站保留阅读器演示与在线说明。`content/introduction.json` 留空；使用说明单独维护在 `content/usage.json`。

MIT 许可。源码与虚构示例预览发布在 GitHub，未发布到软件包注册中心，也未提供托管模型服务。实际发布验收见[发布报告](docs/release-report.md)。
