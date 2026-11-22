# 次元时刻

聚合多款游戏的活动、版本大事件和兑换码。首页提供横向时间线、活动筛选、日签与完成记录。项目还包含管理员后台、协作者后台、反馈和邮件提醒。

## 本地预览

在项目根目录执行 `python -m http.server 8000`，打开 `http://localhost:8000/`。首页可以直接读取随附的数据快照。需要更新快照时运行 `python -u scripts/sync.py`，同步需要访问外部数据源。后台接口、邮件和审批在 Cloudflare 环境运行。

## 部署到 Cloudflare Pages

1. 将压缩包解包后的项目内容上传到 GitHub 仓库根目录。Pages 连接到仓库的 `main`，使用静态站点配置，输出目录为项目根目录。仓库根目录的 `functions/` 提供 API。
2. 创建或使用已有 D1 数据库，在 Pages 的生产环境添加 D1 绑定 `APPLICATION_DB`。新数据库按下方顺序执行 SQL。已有数据库只执行尚未应用的迁移，`email-checkins-v120.sql` 添加列，只执行一次。
3. 在 Cloudflare Access 分别保护 `/admin`、`/admin/*`、`/api/admin/*`，以及 `/collaborator`、`/collaborator/*`、`/api/collaborator/*`。两组使用各自的应用受众标识。保留公开的 `/api/collaborator` 申请、`/api/feedback`、`/api/email-reminders` 和带签名校验的 `/api/github/webhook`。
4. 在 Pages 生产环境填写变量与机密，然后重新部署。真实配置保存在服务平台。若延用旧 D1 中已加密的 GitHub 绑定，保留对应的 `TOKEN_ENCRYPTION_KEY`。

### Pages 配置

| 功能 | 变量或绑定 | 机密 |
| --- | --- | --- |
| Access | `ACCESS_TEAM_DOMAIN`、`ACCESS_AUD`、`COLLABORATOR_ACCESS_AUD`、`ADMIN_EMAIL` |  |
| GitHub 数据维护 | `GH_OWNER`、`GH_REPO`、`GH_BRANCH`（默认 `main`） | `GH_TOKEN` |
| GitHub App | `GITHUB_APP_ID`、`GITHUB_APP_SLUG`、`GITHUB_MAIN_INSTALLATION_ID`、`GITHUB_CLIENT_ID`、`SITE_URL` | `GITHUB_APP_PRIVATE_KEY`、`GITHUB_CLIENT_SECRET`、`TOKEN_ENCRYPTION_KEY`、`GITHUB_WEBHOOK_SECRET` |
| 发信 | `QQ_SMTP_USER`、`APPLICATION_NOTIFY_EMAIL`（可选）、`FEEDBACK_NOTIFY_EMAIL`（可选） | `QQ_SMTP_AUTH_CODE` |
| Pages 部署状态查询（可选） | `CF_ACCOUNT_ID`、`CF_PAGES_PROJECT` | `CF_PAGES_READ_TOKEN` |

- 两项通知收件邮箱可省略，默认使用 `ADMIN_EMAIL`。协作者申请和用户反馈仍分别从原有入口提交。
- GitHub App 安装到目标仓库，配置 Contents 和 Pull requests 的写权限。OAuth 回调为正式站的 `/api/collaborator/oauth/callback`，使用可过期用户令牌。Webhook 地址为正式站的 `/api/github/webhook`，两端使用同一签名机密。
- `TOKEN_ENCRYPTION_KEY` 为 64 位十六进制字符串。GitHub 的公开 PR 和提交会展示相应 GitHub 身份及 noreply 署名。申请邮箱、反馈和订阅数据保存在 D1。

### 新 D1 执行顺序

依次执行 `scripts/` 下的文件。

1. `applications.sql`、`collaborators.sql`、`collaborators-v79.sql`、`collaborators-v81.sql`、`collaborators-v85.sql`、`collaborators-v100.sql`
2. `preview-v93.sql`、`feedback.sql`
3. `email-reminders.sql`、`email-sync-v59.sql`、`email-checkins-v120.sql`

### 自动同步和邮件

- GitHub Actions 的 `Sync game events` 会生成活动数据并创建同步 PR。配置仓库变量 `SYNC_REVIEW_APP_ID` 和仓库机密 `SYNC_REVIEW_APP_PRIVATE_KEY`，允许 Actions 创建 PR，并为审核 App 配置目标仓库的审批和合并权限。合并受仓库规则约束。
- 访客邮件由独立 Worker 定时处理。将 `workers/reminders/wrangler.toml` 复制成同目录的 `wrangler.local.toml`，在副本里填正式站 HTTPS 地址和 D1 名称、ID。Worker 与 Pages 必须绑定同一个 D1。在项目根目录使用 `npx wrangler deploy --config workers/reminders/wrangler.local.toml` 部署，并用 `npx wrangler secret put <变量名> --config workers/reminders/wrangler.local.toml` 分别设置 Worker 自己的 `QQ_SMTP_USER`、`QQ_SMTP_AUTH_CODE`。任务每 10 分钟执行，筛查 48 小时以内结束的活动。活动快照超过 6 小时会暂停发送。
- `remind.yml` 是站长单收件人提醒，使用独立的仓库变量 `SITE_URL`、`ALERT_HOURS`、`ALERT_GAME_IDS` 和仓库机密 `ALERT_EMAIL`、`ALERT_FROM`、`SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASSWORD`。它会尝试提交发送记录。在禁止直接推送 `main` 的仓库，保持该工作流禁用，使用独立 Worker 处理访客提醒。

## 活动数据与素材

活动快照与人工维护数据分别在 `data/events.json` 和 `data/manual.json`。外部资料来自 SRA、游戏公告及各数据源，源链接保留在数据中。通过后台隐藏的活动会从站点展示和邮件候选中排除。循环活动可通过日签达到目标后完成。

公开包保留活动与游戏记录、数据来源及远程媒体链接。本地第三方素材已从包中移除，相关图片字段已留空。添加素材时请使用获得再分发授权的图片。代码许可证见 `LICENSE`，第三方素材及服务条款适用各自权利人的许可。

## 检查

使用 Node.js 24 运行 `npm test`。原始项目中的两项协作者测试在本版本中仍失败，涉及草稿接口读取和旧式 Fork PR 流程的测试用例。发布到自己的部署环境后，验证 Access、D1、GitHub App、仓库工作流和邮件链路。


独立的管理员管理页面测试脚本在原项目中也存在 DOM 模拟缺项，当前仍无法通过。
