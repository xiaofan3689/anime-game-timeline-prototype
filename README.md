# 二游活动时刻表（原型）

一个无需自有服务器的静态网页。GitHub Actions 定时读取活动来源，合并人工维护的 `data/manual.json`，生成供网页及未来 Android、Windows 客户端共用的 `data/events.json`。

## 已实现

> 协作者审批与访客邮件订阅的完整规划、准备事项、配置和验收步骤见本文后半部分“协作者与邮件提醒实施手册”。该部分明确区分现有功能和待开发功能；配置变量不会自动启用尚未编写的功能。

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

点击首页“活动管理”或直接访问 `/admin/` 进入后台，无需使用双击入口。后台可为已有游戏和来源活动保存人工覆盖，也可添加人工游戏、活动；这些编辑保存到 `data/manual.json`，自动来源仍由同步脚本维护。“跟随 SRA”控制对应游戏版本字段的来源行为。时间字段在编辑页按北京时间输入并保存为 `+08:00`。提交后写入 GitHub，并通过仓库事件触发 `Sync game events`；Cloudflare Pages 随后重新部署。公开仓库中的手工活动数据对所有人可读。

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

## 协作者与邮件提醒实施手册

文档整理日期：2026-11-17。当前以 Cloudflare 为主体，不包含 EdgeOne 迁移。中文控制台菜单名称可能随产品更新变化，括号内英文用于定位。

### 1. 先确认当前代码实际具备什么

| 功能 | 当前状态 | 实施位置 |
| --- | --- | --- |
| 管理员邮箱登录、编辑、直接写入仓库 | 已有；仅校验一个 `ADMIN_EMAIL` | `functions/api/admin/manual.js` |
| 固定邮箱 SMTP 提醒 | 已有；默认 24、6 小时阈值 | `scripts/remind.py`、`.github/workflows/remind.yml` |
| 协作者身份、个人草稿、提交审批、审批列表 | 待开发 | 后续扩展后台和 API |
| GitHub App、绑定个人 GitHub、Fork 提交 | 待开发 | 后续新增授权及仓库适配层 |
| 访客输入邮箱、选择游戏、48 小时提醒 | 待开发 | Pages Functions + D1 + 定时 Worker + Resend |
| 邮件用户跨设备同步完成状态 | 待开发；当前浏览器状态不能被定时任务直接读取 | 后续新增订阅账号与进度接口 |

下文中以“拟定”标注的变量、接口、表名是开发约定，不是当前可用接口。源码交付时需同时提供真实迁移 SQL、Worker 文件、配置模板及接口说明；本次仅更新说明文档，没有提供这些运行文件。不要凭空创建数据库表或粘贴示意接口当成可用程序。

### 2. 总体分工与身份区别

后台共用 `/admin/` 入口，Cloudflare Access 识别邮箱，服务端分配管理员或协作者角色。两类协作者均可编辑游戏属性、已有来源活动的人工覆盖、人工游戏和活动；均不能通过网站直接发布到 main。角色和权限必须在每个写入接口校验。

| 比较项 | 无 GitHub 账号 | 有 GitHub 账号并绑定 |
| --- | --- | --- |
| 网站登录 | 受邀邮箱通过 Access 登录 | 同左，再绑定 GitHub |
| GitHub 授权 | 不需要 | 本人授权 GitHub App |
| 修改存放位置 | App 在主仓库创建提案分支 | 推荐本人 Fork 中的提案分支 |
| PR 创建身份 | App 机器人，描述中注明网站提交人 | 本人用户授权身份 |
| 主仓库写权限 | 不给协作者 | Fork 模式也不需要 |
| 提交作者与实际操作人 | 按真实身份记录，不能冒充个人授权 | PR 作者是本人；Git commit 作者、提交者需另行正确设置 |
| 管理员审批 | 相同：校验、批准合并或拒绝关闭 | 相同 |
| 退回后 | 保留草稿和原因，修改后重新提交 | 同左，同时保留本人 PR 历史 |
| 首次准备 | 只需邮箱邀请 | 还需授权、Fork、安装 App |

App 是你创建的，不代表 App 操作显示成你本人。当前旧后台用 `GH_TOKEN`，其 API 操作身份取决于令牌所属账号；不能把提交消息里的作者文字当成真实授权证明。后台应同时保存提交人、GitHub PR 作者、审批人、执行合并的身份。

推荐允许有账号者自愿选择“本人 GitHub 提交”或“App 代提交”，每次提交明确显示所用模式；本人授权失效时不得静默切换机器人提交。

### 3. 实施顺序与责任划分

1. 你：备份仓库、记录正式部署提交，准备管理员及协作者邮箱。
2. 我：实现角色、草稿、字段差异、GitHub App 认证、个人授权、PR 审批，以及数据库迁移和配置模板。
3. 你：创建 App、安装到仓库、配置 D1 和后端机密。
4. 我：先在独立测试环境验证两类协作者和冲突处理。
5. 你：正式部署后开放协作者邮箱，不提前扩大现有管理员权限。
6. 我：实现访客订阅、邮箱验证、完成状态同步及提醒 Worker。
7. 你：配置发信域名、Resend、D1 绑定，先小范围测试，再开启正式定时提醒。

部署代码、绑定数据库、保存机密、启用定时器是不同操作，覆盖 GitHub 仓库不会替你完成 Cloudflare 侧配置。

### 4. 备份与隔离环境

1. GitHub 仓库首页 → Code → Download ZIP，下载源码；重要版本另外创建标签或 Release。
2. Cloudflare → Workers 和 Pages → 项目 → 部署，记录当前正式部署及 Git 提交。
3. 保存环境变量名称和用途，私钥等秘密只在安全位置保存，不写入 README、截图或仓库。
4. 准备测试邮箱、测试仓库或明确的测试提案。预览环境使用独立数据库，发送开关默认关闭。
5. 正式分支保持 main；提案分支和 Fork 不能自动成为正式站点。

### 5. GitHub App 创建与安装（管理员）

1. GitHub 头像 → Settings → Developer settings → GitHub Apps → New GitHub App。已创建 App 可直接修改。
2. 名称填写唯一名称，例如 `xiaofan-timeline-review`；Homepage URL 填正式网站地址。
3. Callback URL 填最终源码提供的完整地址，拟定为 `https://你的域名/api/auth/github/callback`。域名、路径、HTTPS 均需一致；不要使用任意预览域名或通配回调。
4. 用户授权采用网站“绑定 GitHub”按钮发起的 Web application flow。无需要求每次安装时自动 OAuth 授权；安装 App 与用户授权是两件事。
5. 第一版可关闭 Webhook，后台刷新时核对 GitHub 状态；以后接 Webhook 必须验证签名。
6. Repository permissions 设置 Contents、Pull requests 为 Read and write；Metadata 为只读。仅在实际使用 workflow_dispatch 时添加 Actions: Read and write。其余不开放。
7. 若支持协作者在自己账号安装到 Fork，安装范围选择 Any account。App 可被安装不代表安装者自动获得本网站编辑权限。
8. 创建后记录 App ID 和 Client ID；生成 Client secret；在 Private keys 中 Generate a private key，下载 PEM。
9. Install App → 你的账号 → Only select repositories → 只勾选主仓库。记录该主仓库安装 ID。
10. 权限修改后，如 GitHub 提示 Review request / Accept new permissions，需要在安装设置确认新权限。

App ID、Client ID、安装 ID 不能混用。无需让协作者提供个人 PAT、账号密码或私钥。用户令牌按 GitHub 当前过期/刷新规则处理；授权撤销后要求重新绑定。

### 6. Cloudflare 后台配置（协作者功能）

以下名称为拟定，最终以代码交付清单为准。现有代码只识别旧变量，不能删掉旧配置后期待新变量生效。

进入 Workers 和 Pages → Pages 项目 → 设置 → 变量和机密（Variables and Secrets）→ 添加；秘密选择加密/Secret。

| 拟定名称 | 类型 | 内容 |
| --- | --- | --- |
| `GH_APP_ID` | 普通变量 | App ID |
| `GH_CLIENT_ID` | 普通变量 | OAuth Client ID |
| `GH_CLIENT_SECRET` | 机密 | Client secret |
| `GH_APP_PRIVATE_KEY` | 机密 | 完整 PEM，包含头尾和换行 |
| `GH_APP_INSTALLATION_ID` | 普通变量 | 主仓库安装 ID |
| `GH_OWNER`、`GH_REPO`、`GH_BRANCH` | 普通变量 | 主仓库所属账号、名称、main |
| `SITE_URL` | 普通变量 | 固定正式 HTTPS 网站地址 |
| `TOKEN_ENCRYPTION_KEY` | 机密 | 按交付工具生成的令牌加密密钥 |
| `ACCESS_TEAM_DOMAIN`、`ACCESS_AUD` | 普通变量 | 现有 Access 团队地址与后台应用 AUD |
| `ADMIN_EMAIL` | 普通变量 | 初始管理员邮箱；后续角色迁移由代码明确处理 |
| `ADMIN_DB` | D1 绑定，不是文本变量 | 下述管理数据库 |

1. 存储和数据库 → D1 SQL 数据库 → 创建数据库，例如 `timeline-admin-prod`。
2. Pages 项目 → 设置 → 绑定 → 添加 D1 数据库，变量名按代码填 `ADMIN_DB`，选对应数据库。
3. 执行交付的管理数据库迁移；只按实际文件执行，不自行猜表结构。
4. 预览环境绑定 `timeline-admin-test`，不要绑定正式凭据库。
5. 保存配置后重新部署。仅保存变量不等于当前部署已经使用新值。
6. 新认证验证成功前保留旧 `GH_TOKEN`；切换后按交付说明撤销不再需要的个人令牌。

管理库拟保存角色、GitHub 数字用户 ID、草稿、提案映射、加密令牌、审批日志。长期密钥与数据库需一起制定恢复办法，不能丢失加密密钥后仍假定令牌可恢复。

### 7. Access 与协作者邀请

1. 源码的角色控制完成前，不把协作者加入 `ADMIN_EMAIL`，也不把旧鉴权改成“所有 Access 用户都是管理员”。
2. Cloudflare → Zero Trust / Cloudflare One → Access → 应用程序 → 当前自托管应用。
3. 允许策略中加入受邀管理员和协作者邮箱，保留现有验证码或身份提供商。
4. 同一后台 Access 应用保护 `/admin`、`/admin/*` 和 `/api/admin/*`。后续若增加其他协作者私有 API 路径，必须补上对应保护并由后端验证身份。
5. GitHub 绑定的发起和回调路由按最终实现配置 Access 策略；OAuth 回调必须额外验证 state、PKCE 和发起绑定的会话，不能只凭回调参数绑定身份。
6. 管理员在角色管理页邀请邮箱，分配 collaborator。绑定 GitHub 时存数字用户 ID，用户名改名不应丢失权限。
7. 注销协作者需同时撤销网站角色、会话及不再需要的授权凭据；不能只隐藏按钮。

公开访客邮件订阅 API 不加入仅管理员可访问的 Access 应用；它使用邮箱验证与自己的用户会话。

### 8. 无 GitHub 账号：首次使用与提交

1. 协作者通过统一入口，用受邀邮箱登录。
2. 在游戏属性或活动管理中编辑，点击保存个人草稿。
3. 提交审批前查看字段前后对比、填写说明，界面标明“由 App 代提交”。
4. 后端获取最新 main，检测同字段冲突，只应用本次变更。
5. App 创建 `proposal/唯一编号` 分支，提交允许的数据文件，创建目标为 main 的 PR。
6. 网站显示 PR 链接、待审批状态。PR 描述以网站用户编号/显示名注明实际提交人；公开仓库不默认暴露邮箱。
7. 被拒绝后查看原因，修改草稿，重新提交产生可追踪的新提案。

协作者不需要仓库邀请、GitHub 账号或写权限；App 只能接收结构化数据，不能让协作者指定任意仓库路径、分支、代码或工作流。

### 9. 有 GitHub 账号：首次使用与提交

推荐公共仓库使用本人 Fork；私有仓库先检查是否允许 Fork 及相关账号/组织策略。用户授权的权限不会超过用户本人和 App 各自具备的权限。

1. 完成邮箱邀请和网站登录。
2. 点击“绑定 GitHub”，跳转 GitHub 用本人账号授权，返回网站确认用户名。
3. 打开主仓库 → Fork → 在自己的账号创建副本。副本必须属于目标仓库网络，不能随意指定无关仓库。
4. 安装同一个 App 到自己的账号，Only select repositories 只选该 Fork。
5. 回到网站检查连接；后台记录本人 ID、Fork 与其安装信息，不覆盖主仓库安装 ID。
6. 编辑、保存草稿、查看差异，确认“以本人 GitHub 身份提交”。
7. 后端以最新主仓库 main 为基础，在 Fork 创建独立提案分支，不重置协作者已有工作；用本人用户令牌提交并创建到上游 main 的 PR。
8. 网站展示本人 PR 与审批状态。令牌过期刷新失败或被撤销时，提示重新绑定，不冒充本人也不静默改用 App 作者。

如果不能 Fork：可信成员可使用主仓库分支，但先设置 main 分支保护，再授予必要仓库权限。个人仓库授予写权限通常无法只限制到一个数据文件；若要求严格隔离，考虑组织仓库/独立贡献数据仓库，或改用 App 代提交。不应为了 PR 作者显示本人而随意开放主仓库写权限。

### 10. 审批、同步与并发处理

1. 管理员打开待审批，查看提交人、说明、数据差异、PR 和最新提交 SHA。
2. 批准时后端验证管理员、PR 所属仓库、允许路径、JSON 结构、来源分支、最新 SHA 及冲突。
3. 审阅后 PR 内容发生改变，必须重新审阅；仅有网站提案编号不足以批准任意新增内容。
4. 合并成功才移出待审批，显示“已批准，等待同步”；合并失败保留并说明原因。
5. 拒绝时填写原因，关闭 PR 成功后移入已拒绝；保留草稿与历史，不永久删除记录。
6. 第一版可由 App 合并并记录网站审批人；若要求 GitHub 原生 Review 和合并动作显示管理员本人，管理员也需绑定 GitHub，使用其用户令牌执行。必须遵守仓库实际分支保护，不承诺机器人绕过审核规则。
7. 明确触发同步任务，核对工作流运行 ID、main 提交与生成数据时间；不要把“PR 已合并”等同“网站已刷新”。
8. 同步失败显示单独状态，支持重试，不重复合并。GitHub Actions 使用 GITHUB_TOKEN 产生的事件有后续触发限制，应按所选事件与令牌设计显式调度。
9. main 的人工数据变更由同步脚本与 SRA 合并，再生成 events.json，Pages 发布后浏览器读取最新数据。
10. 不同字段可自动合并；同字段冲突需人工选择。提交需幂等，连点不能生成重复 PR。
11. 在 GitHub 外部关闭/合并 PR 后，后台刷新也应对账；已关闭不等于已合并。
12. 主仓库提案分支可成功处理后清理；Fork 分支只按已授权的清理约定处理，不删除整个 Fork。

PR 检查只校验允许的数据，不执行提案自带的脚本；不给未经批准的分支正式数据库或发信机密。PR 历史可能公开，拒绝意见中不要写个人秘密。

### 11. 访客邮件提醒的目标与数据规则（待开发）

架构：Pages 提供订阅界面与 API；D1 存邮箱、订阅、完成状态和发送记录；独立 Worker 每小时检查公开 events.json；Resend 通过 HTTPS 发信。Pages 继续承载现有站点，不要求迁移整个项目到 Worker。

1. 用户输入邮箱，选择提醒游戏；可从当前游戏选择预填，但提交前允许单独调整。
2. 发验证邮件；用户确认后才激活提醒。再次登录/跨设备通过限时邮箱链接，不要求设置密码。
3. 激活后，将当前设备完成状态按用户确认的合并策略同步云端；以后完成/撤销操作先同步云端，Worker 才能据此过滤。
4. 未订阅者继续使用本地状态。仅 localStorage 中的游戏选择、完成状态，云端 Worker 无法自动获知。
5. 筛选尚未结束、未完成、属于订阅游戏且 `0 < 剩余时间 <= 48 小时` 的活动。首次激活时已在窗口内的活动也可能提醒。
6. 默认每个“用户 + 活动 ID + 结束时间 + 48h 策略版本”只提醒一次；多个活动合并成一封摘要，避免每个活动各发一封。
7. 活动结束时间被改动时，可能形成新提醒，应有延期提示和频率限制；已完成活动不能重新当作待办发送。
8. 每小时调度不保证恰好在结束前 48:00:00 发出；受数据源、缓存、运行和邮件投递延迟影响。
9. 邮件提供回到活动、管理订阅、退订入口。GET 链接不直接修改完成状态；用户打开确认页后再提交，避免邮箱扫描器误操作。退订需兼容服务商要求的一键退订机制并安全处理。
10. 验证/登录/退订凭据按用途隔离、限时且服务端保存摘要。验证接口限流，处理退信/投诉并停止向已抑制邮箱重复发送。

公开 GitHub 数据仅保存活动，不保存邮箱、用户完成记录或登录令牌。D1 是私有数据源，不能把订阅库导出到公开仓库。

### 12. 发信域名和 Resend 配置（你操作）

1. 准备可控制 DNS 的域名；网站可以仍用当前域名，发信可使用另一个自有域名的子域。
2. 注册并登录 Resend，进入 Domains → Add domain。
3. 建议添加专用子域，例如 `mail.example.com`。此处 example.com 必须换成自己的域名，不是公共邮箱域名。
4. 按 Resend 显示的记录逐条配置 DNS：类型、主机名、值、优先级都照实际面板填写，不能复制本文示例猜记录值。
5. DNS 在 Cloudflare 托管时：选对应域名 → DNS → 记录 → 添加记录。若权威 DNS 在其他商家，去该商家的 DNS 面板，不是在 Pages 添加。
6. 为邮件相关记录保持仅 DNS；不要给邮件主机使用 HTTP 代理。不要覆盖现有邮箱的根域 MX 或创建同一主机名的多个 SPF 策略；冲突时先核对既有邮件服务。
7. 添加要求的 DKIM、SPF/Return-Path 等记录，回 Resend 验证；按实际检查结果等待生效。DMARC 按现有域名策略配置，不随意放宽已有策略。
8. 发件人可拟定 `次元时刻 <notice@mail.example.com>`，须属于已验证的发信域。发送身份不等于可收信邮箱；需要接收回复时另外配置可用 Reply-To。
9. Resend → API Keys → 创建专用发信密钥，按面板能力限制为发送权限与对应域名；保存到 Cloudflare Secret，不放前端。
10. 检查当前账户额度、生产发送要求和域名状态，先向自己的 QQ、163、Gmail 等实际测试邮箱发测试邮件；不要假定国外邮件服务能对所有国内邮箱保证送达。

Cloudflare 在本方案中负责运行与存储，Resend 负责外发。无需为此先开启 Cloudflare Email Routing；入站邮件转发不能代替本方案面向访客的事务邮件发送。

### 13. 邮件 D1 数据库与 Pages 配置（源码交付后操作）

1. D1 → 创建 `timeline-mail-prod`；为测试另外创建 `timeline-mail-test`。
2. 执行交付的邮件数据库迁移。拟包含 users、subscriptions、progress、sessions/tokens、deliveries/outbox 等用途；这些不是当前已有表。
3. Pages 项目 → 设置 → 绑定 → 添加 D1，拟定绑定名 `MAIL_DB`，选择正式邮件库。
4. 正式和预览环境分别配置，预览只连接测试库，默认不发真实订阅邮件。
5. Pages → 设置 → 变量和机密，按下表填写，再重新部署。

| 拟定配置 | Pages | 定时 Worker | 说明 |
| --- | --- | --- | --- |
| `MAIL_DB` | D1 绑定 | 同一正式 D1 绑定 | 两个服务必须指向同一个邮件库 |
| `RESEND_API_KEY` | 机密 | 机密 | Pages 发验证/登录邮件；Worker 发提醒，可分别使用专用密钥 |
| `EMAIL_FROM` | 普通变量 | 普通变量 | 已验证域名的发件人 |
| `SITE_URL` | 普通变量 | 普通变量 | 固定 HTTPS 正式站点地址，用于生成链接 |
| `FEED_URL` | 按需 | 普通变量 | 正式 `/data/events.json` 的完整地址 |
| `EMAIL_ENABLED` | 普通变量 | 普通变量 | 测试先关闭，具体 true/false 解析由代码定义 |
| `REMINDER_HOURS` | 按需 | 普通变量 | 48；不是旧 SMTP 的 ALERT_HOURS |
| 会话/令牌所需密钥 | 机密 | 按实际需要 | 名称及格式随源码交付，不自行猜值 |

Pages 配置不会自动继承给独立 Worker。Access 邮箱登录与访客订阅验证也不是同一套用户系统，不能要求所有访客进入管理员 Access 应用。

### 14. 部署定时提醒 Worker（源码交付后操作）

1. Workers 和 Pages → 创建应用程序 → 创建 Worker，命名例如 `timeline-mail-reminder`。
2. 部署交付的 Worker 代码；必须包含 scheduled 定时处理器，不是只返回 Hello World。
3. Worker → 设置 → 绑定，添加 `MAIL_DB`，选择与正式 Pages 相同的 `timeline-mail-prod`。
4. Worker → 设置 → 变量和机密，单独添加上表要求的机密与变量。
5. 先保持发信关闭，通过测试/受管理员保护的诊断功能检查：能读库、能抓正式 feed、时间解析正确、选出的候选活动符合规则。不要公开可任意触发批量发信的 HTTP 接口。
6. 设置 → 触发事件/触发器（Triggers）→ Cron 触发器 → 添加。拟每小时一次：`0 * * * *`。
7. Cron 使用 UTC；这个表达式是每小时整点，不是每天 0 点。后台若有可视化编辑器可选择“每小时”。配置传播和执行有延迟，不保证秒级。
8. 每次运行先校验 feed 的结构、生成时间和来源失败状态，异常时保留订阅数据、报告错误，不能发送基于空数据或明显失效时间的提醒。
9. 代码需持久化待发/发送中/成功/失败状态，并用唯一键防并发重复；邮件请求重试结合服务商幂等键。不能简单先标记成功再发信，也不能因数据库记录失败无限重发。
10. 批量订阅需分页、分批处理并遵守运行及发信额度。超过单次 Worker 能力时再接 Queues 等队列，不承诺任意用户量都能靠单次定时任务完成。
11. 查看 Worker 日志及 Resend 发送日志，确认成功/失败状态。日志不输出完整令牌、邮箱列表或邮件内容。

Pages Functions 不直接承载 Cron，独立 Worker 是本方案必要的定时执行组件。无需给它分配新的用户访问域名，只要能读取 feed 并通过 HTTPS 调用发信服务。

### 15. 订阅实际操作与上线测试

用户最终操作：打开活动助手/邮件提醒 → 填邮箱 → 选择游戏 → 同意订阅 → 收到验证邮件 → 确认激活 → 在同一账号下同步完成状态。邮件订阅不授予后台管理权限。

上线前依次验证：

1. 测试环境开启仅测试收件人模式，创建约 47 小时后结束的测试活动。
2. 未验证邮箱不接收活动提醒；过期和重复使用的验证链接被拒绝。
3. 只接收所选游戏；超过 48 小时、已结束、已完成活动均不发送。
4. 同一次运行、重复运行、并发运行不会重复发同一提醒；错误重试不会丢失待发项。
5. 多活动合并摘要，单个活动完成后其他活动仍可提醒。
6. 另一设备登录后可看到云端完成状态；未登录本地状态不冒充已同步。
7. 退订后停止提醒；可管理选择、删除订阅与相应私人数据，保留必要最小发送审计需有明确策略。
8. 验证邮件登录链接被扫描不会直接标记完成；登录/验证凭据不得因静态资源或外链泄漏。
9. 实测国内邮箱收件箱、垃圾箱、链接打开及手机显示；记录无法送达的具体原因。
10. 正式切换前，GitHub Actions → Email ending event reminders → Disable workflow，避免旧 SMTP 和新系统同时向同一用户发送；仅在新系统完成测试后停用旧方案。
11. 打开正式 EMAIL_ENABLED，观察首轮 Cron 以及服务商日志；先小范围邀请订阅，不批量导入未验证地址。

旧方案可临时改 GitHub Actions Variable `ALERT_HOURS=48` 来提醒固定管理员，但它不会自动变成访客订阅系统，也不会读取浏览器完成状态。旧脚本在多个阈值同时满足时可能分别发送；严格去重方案不能直接沿用其 JSON 记账方式。

### 16. 故障定位、回滚与验收记录

| 现象 | 先检查 |
| --- | --- |
| 协作者登录后 403 | Access 允许名单、受保护路径、JWT AUD、网站角色是否都配置 |
| GitHub 授权回调失败 | 固定回调地址、Client ID/secret、state/PKCE、浏览器会话 |
| Resource not accessible by token | 用户权限、App 权限、安装仓库范围、新权限是否被接受 |
| PR 作者仍为机器人 | 是否误用了 installation token；本人模式应使用用户令牌 |
| 提案提交后正式站立刻变化 | 是否错误写 main，或把提案分支配置为正式部署来源 |
| 合并失败 | main 保护、检查状态、最新提交变化、数据冲突，不能 force push 绕过 |
| 合并后网页数据没变 | Actions 是否运行成功、main 上 feed 更新时间、Pages 部署、浏览器缓存 |
| 验证邮件收不到 | 发信域验证、EMAIL_ENABLED、API Key、发件人、服务商错误/抑制、垃圾箱 |
| 没有定时提醒 | Worker 是否部署 scheduled、Cron 是否在 Worker 上、D1 是否同库、feed 是否有效 |
| 完成后仍提醒 | 完成状态是否同步云端且身份一致，提醒是否在完成前已进入发送流程 |
| 重复邮件 | 旧工作流是否还开着、唯一键/并发/重试、结束时间是否变化 |

故障回滚：先关闭新邮件发送和 Cron，再恢复上一正式部署；不要因回滚网页而删除 D1。数据库迁移需兼容回滚或提供恢复脚本，生产操作前备份；GitHub 已合并的数据应以新的可审阅提交恢复，不强推覆盖其他人的更新。人员移除或密钥泄漏需撤销授权/轮换密钥，不能仅回滚页面。

功能上线时必须记录：首页、游戏选择、背景设置、活动助手、管理后台在 320、390、768、1440 像素的验证结果；仅时间线内部允许横向滚动，入口不能依赖双击、悬停或鼠标拖动。新增草稿、授权、审批、邮件表单同样适用。未测试的项目应标记“未验证”，不能写“全部正常”。

本次文档更新仅核对了现有管理员 API、SMTP 脚本和工作流，未实现/部署协作者与访客邮件功能，未执行线上授权、真实发信或上述屏幕宽度测试；未修改网页界面。

### 17. 官方参考

- [GitHub App 注册与权限](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app)
- [GitHub App 代表用户操作的权限边界](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-with-a-github-app-on-behalf-of-a-user)
- [GitHub 用户授权、回调、PKCE 与用户令牌](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)
- [GitHub 创建 PR 的来源分支权限](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/creating-a-pull-request)
- [GitHub PR 接口](https://docs.github.com/en/rest/pulls/pulls)
- [GitHub Actions 后续工作流触发规则](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
- [Cloudflare Access 自托管应用](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/)
- [Pages D1 绑定、变量与机密](https://developers.cloudflare.com/pages/functions/bindings/)
- [Worker Cron 配置及 UTC 时间](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [Resend 发信域与子域](https://resend.com/docs/dashboard/domains/introduction)
- [Resend API Key 管理](https://resend.com/docs/dashboard/api-keys/introduction)
