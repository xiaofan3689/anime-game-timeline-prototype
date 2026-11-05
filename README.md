# 二游活动时刻表（原型）

一个无需自有服务器的静态网页。GitHub Actions 定时读取活动来源，合并人工维护的 `data/manual.json`，生成供网页及未来 Android、Windows 客户端共用的 `data/events.json`。

## 已实现

- 已接入 [SRA 公共 API](https://starrailassistant.top/reference/public-api/) 文档中的全部 18 个游戏及区服标识。数据由社区维护者从官方公告整理，并非官方实时 API。
- 类似 Paimon.moe 的横向活动时间线：日期横轴、精确到时刻的活动条、今日指示线、结束端 Banner 和剩余时间。桌面端可按住拖动或使用滚轮，触屏可横向滑动；活动名称随可见区域移动以保持可读。页面每 5 分钟重新读取同源 JSON。
- 首次进入弹出游戏多选，选择结果保存在浏览器 localStorage；以后自动恢复，也可随时点击“选择游戏”修改。
- 游戏图标只用于首次游戏选择界面。时间线活动条不显示图标或首字；右侧使用活动自己的横幅/封面图并向左渐隐，版本总封面不再误用为每个活动背景。
- 人工补录字段：游戏 ID、游戏名称、游戏图标 URL、活动名称、开始和结束时间（须带时区）、公告 URL。
- 上游读取失败时，保留上次成功抓取的内容；失效数据会显示原抓取时间。

## 本地运行

需要 Python 3。先在项目目录运行 `python scripts/sync.py`，随后运行 `python -m http.server 8000`，访问 `http://localhost:8000/`。首次同步需要访问外网；失败时页面会明确显示暂无活动。不可直接用 `file://` 打开，因为浏览器会限制读取 JSON。

## 部署

1. 新建公开 GitHub 仓库，上传此目录，保留 `.github/workflows/sync.yml`。
2. 在 Cloudflare Pages 连接该 GitHub 仓库，构建命令留空，输出目录填写 `/`。域名在 Cloudflare Pages 中绑定。
3. 到 GitHub Actions 手动运行一次 **Sync game events**。成功后任务会提交 `data/events.json`，Cloudflare Pages 会随着提交重新部署。若默认分支不是 `main`，需修改工作流中的分支及推送目标。

未来客户端共用 `https://你的域名/data/events.json`。所有端均以这个带版本号的 JSON 作为只读数据源。不要在网页或 App 中放 GitHub 写入令牌。人工录入通过提交 `data/manual.json` 完成，网站访客无权写入仓库。

## 同步边界

GitHub Actions 每 2 小时执行一次，另可手动触发；GitHub 的定时任务可能延迟或漏跑，Pages 发布和浏览器缓存也会增加延迟，因此这是**准实时**方案，不保证秒级同步。SRA 数据由社区维护者在公告后更新，来源更新速度是另一项限制。需要更快时，可提高定时频率（GitHub 最短 5 分钟）并监测失败，但仍不能保证严格实时。若将来需要官方公告直抓，可在 `scripts/sync.py` 中新增按游戏独立的采集器，并保留公告 URL、发布时间和人工复核。

## 管理页面部署

网站左上角的星形图标双击后进入 `/admin/`。页面只编辑 `data/manual.json` 中的人工游戏和人工活动；自动抓取的活动仍由同步脚本维护。时间字段在编辑页按北京时间输入并保存为 `+08:00`。提交后写入 GitHub，并通过仓库事件触发 `Sync game events`；Cloudflare Pages 随后重新部署。公开仓库中的手工活动数据对所有人可读。

1. 确认 Cloudflare Pages 使用 **Git 集成部署**，项目根目录包含 `functions/api/admin/manual.js` 和 `admin/index.html`。纯静态直传方式不会运行 Pages Functions。部署后先访问 `/api/admin/manual`：未登录时应返回 403 或 Access 登录页。
2. 在 Cloudflare Zero Trust 新建一个 Self-hosted Access 应用，为当前站点配置两个受保护路径：`/admin/*` 和 `/api/admin/*`。仅允许管理员邮箱登录；两个路径须属于**同一个 Access 应用**，以便共用 AUD。注意也保护 `/admin`（无尾斜杠）或将其重定向到 `/admin/`。Access 可用邮箱一次性验证码或已有身份提供商，项目不自行存储用户名密码。
3. 到 Cloudflare Pages → Settings → Variables and Secrets，设置 `ACCESS_TEAM_DOMAIN`（例如 `https://你的团队.cloudflareaccess.com`）、`ACCESS_AUD`（Access 应用的 Audience Tag）、`ADMIN_EMAIL`、`GH_OWNER`、`GH_REPO`，若默认分支不是 `main` 还需 `GH_BRANCH`。将 `GH_TOKEN` 设为**加密 Secret**。修改环境变量后重新部署。
4. GitHub Fine-grained Token 只授权此仓库，权限 `Contents: Read and write`，设置合理有效期。此方案用该权限更新 `data/manual.json` 并发送 `repository_dispatch`；无需把令牌放入网页或仓库。若工作流未自动启动，可到 Actions 手动运行 `Sync game events`。
5. 登录后用 `/admin/` 新增或编辑条目。先点“保存到草稿”，再点“提交到 GitHub”。提交成功只说明仓库已更新；活动出现在网站上仍需等待同步工作流和 Pages 部署。若提示文件版本冲突，刷新编辑页后重新修改。

## 管理员邮件提醒

`.github/workflows/remind.yml` 每小时第 23 分钟检查一次 `data/events.json`，默认在结束前 24 小时和 6 小时发信。已发记录写入 `data/reminders-sent.json`，同一活动、结束时间、阈值不会在后续运行中重复发送。邮件目标目前只有管理员自己的邮箱，没有公开访客订阅表单。

在 GitHub 仓库 Settings → Secrets and variables → Actions 中配置以下 Secrets：`ALERT_EMAIL`（收件邮箱）、`ALERT_FROM`（发件邮箱）、`SMTP_HOST`、`SMTP_PORT`（建议 SSL 465）、`SMTP_USER`、`SMTP_PASSWORD`。使用邮件服务商的 SMTP 授权码，**不要使用邮箱登录密码**。可选 Variables：`ALERT_HOURS`，例如 `24,6`；`ALERT_GAME_IDS`，例如 `ys,sr,nte`，留空表示全部游戏。配置完成后可在 Actions 手动运行 `Email ending event reminders` 验证。

提醒精度受每小时调度、GitHub Actions 排队及数据更新速度影响；首次启用时，所有已进入阈值窗口且尚未结束的活动都可能立即发一封提醒。邮件服务商可能限制 GitHub Runner 的 SMTP 连接或发信额度，运行失败时查看 Actions 日志。发送成功后如果记录提交失败，下一次可能重复发信；生产级严格去重需要独立持久存储或邮件服务商幂等支持。未配置 SMTP 时脚本安全跳过。若仓库默认分支不是 `main`，同步和提醒工作流中的推送目标都要改为实际分支。

## 数据契约

`data/events.json`：`schemaVersion`、`generatedAt`、`games[]`、`events[]`、`sources[]`。事件的 `startAt`、`endAt` 均为带偏移量的 ISO 8601 时间；`sourceType` 为 `community` 或 `manual`。同一事件的 `id` 跨同步保持稳定。人工补录示例如下。时间统一按来源的中国区时间解释；若活动属于其他区服，需要使用显式偏移量填写。

人工补录示例：在 `games` 数组加入 `{"id":"mygame","name":"示例游戏","iconUrl":"https://example.com/icon.png"}`，在 `events` 数组加入 `{"gameId":"mygame","title":"示例活动","startAt":"2026-11-05T10:00:00+08:00","endAt":"2026-11-12T04:00:00+08:00","sourceUrl":"https://example.com/notice"}`。保存并提交后，在 Actions 手动运行同步任务即可合并到公开数据。

## 来源与使用限制

SRA API 文档说明其资料来自各游戏官方公告，经社区维护者核对；详情、更新节奏和支持游戏以其[文档](https://starrailassistant.top/reference/public-api/)为准。《异环》的[官方活动公告页](https://nte.perfectworld.com/cn/article/news/gameevent/index.html)和《原神》的[官方网站](https://ys.mihoyo.com/main/)可用于人工核对。当前原型没有宣称直接接入官方 API，也不会把示例数据冒充实时活动。外部图片可能存在跨域、失效或使用许可问题，生产版宜使用获得授权的图标。
