# Resend 上线与 EdgeOne 迁移

本文使用 `example.com` 代表已备案域名。把示例域名替换成自己的实际域名。当前代码变更仅涉及邮件。EdgeOne 路由和域名切换按下文分阶段执行。

## 先上线 Resend

1. 在 Resend 的 Domains 添加自己控制的发信子域，例如 `notify.example.com`。在权威 DNS 服务商逐条添加 Resend 给出的 SPF、DKIM 和退信相关记录，等待 Resend 显示 Verified。发信用的记录按 Resend 提供的名称添加，保留现有邮箱的收信 MX。ICP备案与 Resend 域名验证是两个独立步骤。[Resend 域名文档](https://resend.com/docs/dashboard/domains/introduction)
2. 在 Resend 创建仅发信权限的 API Key。Cloudflare 控制台进入现有 Pages 项目，打开生产环境的变量及机密。将 `RESEND_API_KEY` 设为机密，`RESEND_FROM_EMAIL` 设为已验证发信子域下的纯地址，例如 `updates@notify.example.com`。
3. 设置业务收件人。协作者申请通知用 `APPLICATION_NOTIFY_EMAIL`，用户反馈通知用 `FEEDBACK_NOTIFY_EMAIL`，两项留空时分别回退到现有 `ADMIN_EMAIL`。`ADMIN_EMAIL` 还用于管理员鉴权，应继续匹配现有 Access 登录身份。业务收件人、用户订阅和协作者登录仍可使用 QQ 邮箱。
4. 部署 Pages 改动。确认现有 D1 的 `APPLICATION_DB` 绑定仍在。本次发信切换无需数据库迁移。依次测试邮件提醒验证码、协作者申请与审批邀请、反馈通知。查看 Resend 的发送状态和实际收件箱。接口成功代表 Resend 接受了请求，邮件是否投递应再查 Resend 状态。[Resend 发送 API](https://resend.com/docs/api-reference/emails/send-email)
5. 在现有定时提醒 Worker 上独立设置 `RESEND_FROM_EMAIL` 和 `RESEND_API_KEY`。保留同一个 D1 绑定和当前可访问的 `SITE_URL`。可以先设置机密，然后部署新 Worker。将发件地址通过 Cloudflare Worker 机密保存，或填入部署使用的本地 Wrangler 配置；若用 `[vars]` 管理该变量，只使用一种方式。以下命令会提示输入机密。

```powershell
npx wrangler secret put RESEND_API_KEY --config workers/reminders/wrangler.toml
npx wrangler secret put RESEND_FROM_EMAIL --config workers/reminders/wrangler.toml
npx wrangler deploy --config workers/reminders/wrangler.toml
npx wrangler tail --config workers/reminders/wrangler.toml
```

6. 验证下一次定时运行。用一个已验证订阅和一条未发过、未完成、48 小时内结束的活动核对收件情况。原有 D1 投递去重记录保留。活动数据超过六小时会暂停发送。Pages 和 Worker 均验证后，再清理旧 QQ SMTP 机密。需要回退时，在删除旧机密前回滚到上一已验证部署。
7. 可选的 GitHub Actions 单收件人提醒也已改用 Resend。若使用它，在仓库添加 `RESEND_FROM_EMAIL` 变量、`RESEND_API_KEY` 和 `ALERT_EMAIL` 机密，保留原有其他提醒变量。该旧工作流仍尝试把去重记录直接推送至 main；主分支禁止直推时保持这一工作流禁用，使用 Cloudflare 定时 Worker，否则账本提交可能失败。旧 QQ SMTP 指南只供历史参考。

## 再迁移访问入口

### 第一阶段，公开资源试跑

1. 保留现有 Cloudflare Pages 的域名、生产部署与后端。用 EdgeOne Pages 接入同一 GitHub 仓库，先用测试域名或平台预览地址。静态发布目录只放首页需要的 HTML、CSS、JS、图片以及公开的 `data/events.json` 和游戏目录基线文件。按首页引用保持原路径，排除服务端代码、SQL、环境变量、本地 Wrangler 缓存和备份。两边用同一提交的静态数据验证图片路径、游戏列表和活动版本；保证自动同步提交会触发 EdgeOne 更新。
2. 第一阶段让协作者入口、管理员后台、需要写入的申请／反馈／邮件订阅使用原 Cloudflare 完整页面。新入口应跳转至原站对应页面，或暂时只发布只读首页。当前这些功能用相对路径调用 `/api/`，原样部署到另一域名会请求 EdgeOne 自己。不要发布一个表面可操作、实际找不到接口的页面。
3. 在国内 PC 和手机上测首页、`/data/events.json` 和仓库静态图片。验证活动同步后的发布延迟。静态资源可缓存，活动数据应短缓存或可清除缓存；保留两个站点并行，确认后再接入备案域名。[EdgeOne Pages 构建输出](https://pages.edgeone.ai/document/building-output-configuration)

### 第二阶段，需要新域名直接操作时

1. 保留后台和 Access 在 Cloudflare 域名下。对公开的申请、反馈和邮件提醒选定明确转发路径，在 EdgeOne 边缘层透明转发同源 `/api/` 请求到 Cloudflare Pages，或为这些接口实现精确 CORS。先用测试域名验证 EdgeOne 产品和套餐可用的转发方式。边缘重写、浏览器跳转和跨域反代应分别验证，避免把重写语法直接当外部反代配置。[EdgeOne Middleware](https://pages.edgeone.ai/document/middleware)
2. 后端目前比较请求 `Origin` 和自身 URL。实现转发时，Cloudflare 接口要显式允许该备案前端来源，并保留方法、请求体、源校验和限流。跨域直连时还要处理 `OPTIONS`、精确的 `Access-Control-Allow-Origin` 以及必要的 `Vary: Origin`。此阶段无需公开转发后台接口。Access JWT 和 GitHub Webhook 签名继续在 Cloudflare 验证；不能用 CORS 替代鉴权。确认反代后限流所用的 IP 仍可靠，勿信任客户端任意提供的转发头。
3. 旧域名下的浏览器选项、申请凭证和订阅凭证不会随 DNS 搬过去。先在测试域名用真实流程验证一次，保留原入口。在新站让用户用同一邮箱重新验证，核对选中游戏、完结和签到状态是否成功关联现有 D1。管理员测试提醒依赖当前浏览器域名的订阅凭证，测试应始终在对应的原站完成。
4. 预览、源码版本检查和部分后台动作依赖 Pages 的 `env.ASSETS`。GitHub OAuth 还会校验回调域名与后台的 `SITE_URL` 一致。后台留在原域名就保留这些配置，GitHub Webhook 也继续指向原 Cloudflare 地址。需要修改邮件中的首页链接时，可独立调整定时 Worker 的 `SITE_URL`，前提是目标域名的活动文件与停止提醒流程已经验收。后台 OAuth 的 `SITE_URL` 不要随首页一起改。
5. 切换前备份，切换后验收登录、OAuth、预览、提交审批、Webhook、订阅、验证码和定时任务。如果公用 API 异常，先撤回新域名的路由或恢复原入口；两侧使用同一个生产 D1，可以保留切换期间的业务写入。

## D1 与长期维护

- 保留现有 D1。应用直接使用 `prepare().bind()`、`batch()` 和 SQLite SQL。D1 的 `batch()` 会在一批语句失败时回滚；邮件和 GitHub 调用不在数据库事务里。日后如需 PostgreSQL，要单独核对 SQL 方言、查询参数、毫秒时间戳宽度、唯一约束和事务边界。项目中多个主键本来就是文本 ID，无需替换成自增列。[D1 绑定 API](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- 切换前执行 `npx wrangler d1 export <数据库名> --remote --output <仓库外备份路径>`。备份放到私有、受控存储，定期导入隔离 D1 核对记录数和关键业务。Time Travel 用于意外写入后的恢复，整库回滚会覆盖恢复点之后的写入。[D1 导出](https://developers.cloudflare.com/d1/best-practices/import-export-data/) · [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)
- 缓存首页脚本、图片和公开数据。申请、账号、预览、带确认状态的公告和验证码接口维持私有或 `no-store`。先记录国内实测延迟，再决定是否合并热点 API；当前无需引入 GraphQL。
- 同一仓库保留前后端，CI 路径过滤要覆盖实际目录。EdgeOne 构建需要监听首页、静态资源和 `data/events.json`，Cloudflare 需要部署 `functions/`、`lib/` 及依赖的静态模板，提醒 Worker 另行部署。生产和测试隔离 D1、Access 配置和 Resend Key。新增 D1 结构变化继续以版本化 SQL 提交并登记，已有生产库先核对实际版本再补迁移。

