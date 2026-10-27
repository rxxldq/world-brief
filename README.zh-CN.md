# World Brief · 世界简报

本地优先的日报和多视角周评工具。支持中英文界面、目录、搜索、展开/折叠、字号调整、复制提示词、本地 AI 问答和可选 ntfy 推送。

[English](README.md) · [配置说明](docs/configuration.md) · [范围与验收](SPEC.md) · [隐私](docs/privacy.md)

[公开预览](https://rxxldq.club/world-brief/) · [GitHub 源码](https://github.com/rxxldq/world-brief)

公开页面只展示虚构示例。真实简报生成和直接 AI 问答在自己的电脑上运行。`npm run build:demo` 可在本机生成相同预览，输出到 `.world-brief/site/`。

需要 Windows、macOS 或 Linux 和 Node.js 22 以上版本。离线流程没有第三方运行依赖，无需模型账号、额度遥测或外部模型路由。

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

## 模型与配置

`config.json` 是本机配置，已加入忽略列表。`locale` 可用 `zh` 或 `en`，`timezone` 使用 IANA 时区。改变界面语言不会翻译旧文章。

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

这些命令仅导出调度文件，不安装任务。Windows 导出 PowerShell 注册脚本，Linux 导出 cron 片段，macOS 导出 LaunchAgent plist。请先检查，再自行安装；[英文说明](README.md#scheduling-and-notifications)列有安装与移除方式。触发时间使用操作系统本地时区；建议配置 `timezone` 与系统一致。日报每天触发检查，距上次成功日报满 `dailyEveryDays` 天才运行，默认三天；周评星期日触发，至少间隔七天。关闭机器时不会补齐历史各期。

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

MIT 许可。源码与虚构示例预览发布在 GitHub，未发布到软件包注册中心，也未提供托管模型服务。实际发布验收见[发布报告](docs/release-report.md)。
