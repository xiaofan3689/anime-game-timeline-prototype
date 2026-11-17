# v55 邮件提醒升级与使用说明

本包以本地 b95968a（v54）为基础，仅包含新增及需覆盖文件。未修改原对照仓库，未部署线上。不是完整源码备份。

## 功能

- 首页上方增加“邮件提醒”；弹窗可输入邮箱，已有订阅显示原邮箱、启用状态并允许修改。
- 点击发送验证码，收到邮件后输入6位验证码，提交并启用。修改邮箱时，验证成功才替换旧邮箱；验证前仍保留原有效订阅。
- 提交同时保存当前已选游戏和已完成活动 ID。后续选择游戏、标记完成、恢复已完成会自动同步，失败显示提示并重试。
- 独立 Cloudflare 定时 Worker 每10分钟运行一次，检查最后成功同步的选择及完成状态。活动结束时间满足“当前时间 < 结束时间 <= 当前时间+48小时”，未完成且属于已选游戏才提醒。
- 同次检查命中的活动合并一封邮件；同订阅凭证、同活动 ID 只发送一次。包括首次订阅时已进入48小时范围的活动；不补发已结束活动。
- 页面关闭后仍会提醒，不要求用户一直开网页。邮件中时间以北京时间展示。
- 点击停止提醒禁用订阅；重新启用需验证邮箱。

## 一、部署前备份

1. 备份 GitHub main 的 index.html、app.js、smart.js 和整个项目。
2. 导出 Cloudflare 当前 D1。新表与原申请表共存，不删除旧申请。
3. 对照包内文件路径：index.html、app.js、smart.js 为覆盖；其余为新增；lib/qq-smtp.js 与当前版本一致，供新增 Worker 共用。
4. 不覆盖 data/manual.json、data/events.json 或已有邮件发送记录。

## 二、初始化 D1

1. Cloudflare 控制台 → 存储和数据库 → D1，打开原协作者申请使用的数据库。
2. 控制台执行 scripts/email-reminders.sql 全文。SQL 可重复执行，增加三个表及索引，不清空数据。
3. 记下数据库名称与 Database ID，后面 Worker 必须绑定同一个库。

## 三、部署网站接口

1. 将本包文件按原有相对目录合并上传到 GitHub 仓库根目录，保留其他文件。
2. Cloudflare Pages → 项目 → 设置 → 绑定，确认 D1 绑定名 APPLICATION_DB 对应上述库。
3. Pages → 设置 → 变量和机密，保留 QQ_SMTP_USER（完整 QQ 发信邮箱）与 QQ_SMTP_AUTH_CODE（机密 SMTP 授权码）。不是 QQ 登录密码。
4. 重新部署正式环境。
5. 新接口为 /api/email-reminders。它是访客接口，不要套用管理员 Access 白名单；订阅用不可猜测浏览器凭证管理。
6. 首页脚本使用 v55 缓存标识；部署成功后检查顶部出现邮件提醒按钮。

## 四、单独部署定时 Worker（不能省略）

Pages Functions 不会因上传本包自动开始定时执行；定时任务需要另建 Worker。

1. 在本地解压后的项目根目录操作。先安装 Node.js；使用 Cloudflare 官方 Wrangler CLI：`npx wrangler login`，登录托管本站的账号。
2. 打开 workers/reminders/wrangler.toml：
   - SITE_URL 改为实际正式站 HTTPS 根地址。默认值是原测试站；不要填预览站或不存在的域名。
   - database_name 改成真实数据库名称。
   - database_id 将 REPLACE_WITH_YOUR_D1_DATABASE_ID 替换为 D1 Database ID。
3. 在项目根目录执行：

```powershell
npx wrangler deploy --config workers/reminders/wrangler.toml
npx wrangler secret put QQ_SMTP_USER --config workers/reminders/wrangler.toml
npx wrangler secret put QQ_SMTP_AUTH_CODE --config workers/reminders/wrangler.toml
```

每个 secret 命令会提示输入对应值。Worker 的机密不会自动继承 Pages，即使 Pages 已能发申请邮件，也必须给 Worker 单独设置。

4. Cloudflare → Workers 和 Pages → timeline-email-reminders，核对绑定 APPLICATION_DB、SITE_URL 与两个 QQ SMTP 机密。
5. 检查 Cron Trigger：`*/10 * * * *`。该任务以10分钟间隔检查，不保证活动刚进入48小时范围立即送达。
6. 在 Worker 日志检查定时调用。定时配置传播可能有延迟；不要只靠打开网站判断 Worker 正常。
7. Worker 读取正式站 /data/events.json；若 generatedAt 无效或超过6小时，暂停发送并在日志报错，避免用明显过期数据提醒。先修复 Sync game events 和正式部署。

## 五、用户操作

1. 在首页选择正在玩的游戏，将已经做完的活动标记完成。
2. 点击邮件提醒，输入能正常收件的邮箱，点击发送验证码。
3. 查收验证码，10分钟内填入并提交。错误次数最多5次，超限重新获取。
4. 成功后弹窗显示原邮箱及提醒已开启，游戏与完成状态已同步。
5. 后续修改游戏或完成标记无需重新输入邮箱。按钮悬停提示及弹窗中的状态文字会显示最近同步结果。
6. 修改邮箱：打开弹窗，改邮箱，发送验证码，填写新邮箱收到的验证码，提交；旧邮箱被替换。历史已发送活动不因改邮箱重复发送。
7. 停止：点击停止提醒。已经被 SMTP 接受的邮件无法撤回。

## 六、验证顺序

1. 在测试环境放入三个有稳定 ID 的活动：24小时后结束的未完成活动、24小时后结束的已完成活动、49小时后结束的未完成活动。
2. 邮箱验证前不能收到活动提醒；验证后定时运行只应提醒第一个。
3. 同一活动再次执行定时检查不应重复；活动恰好48小时纳入，已经结束排除。
4. 取消选择游戏后检查服务器订阅 games；标记完成后检查 completed；恢复完成时对应 ID 应被移除。
5. 修改邮箱，验证前保持旧有效邮箱，验证后数据库 email 替换；只在新候选活动上验证新邮箱收件，不要求旧活动重发。
6. 停止提醒后 active 应为0，后续新活动不应发送。
7. 真实 QQ 邮箱发送、Cloudflare D1/Worker、手机和电脑弹窗都必须部署后验收。

## 七、限制与发送语义

- 凭证保存在当前浏览器 localStorage，仅摘要进 D1。不要分享浏览器凭证。清除浏览器数据、换浏览器或换设备不能恢复旧订阅管理；当前版本没有跨设备登录／邮箱恢复功能。清除前先停止提醒。重复建立订阅可能重复收件。
- 已选游戏和完成状态以该浏览器最后成功同步的数据为准。离线改动、失败同步、其他设备未同步的完成标记不能自动推断；发送与标记完成恰好并发时仍可能收到已在发送中的邮件。
- 多标签页检测到选择或完成状态改变会刷新其他页面，避免旧状态覆盖；不等于跨设备同步。
- SMTP 接受不代表最终送达。为优先避免重复，发送前占用唯一记录；发信异常记 uncertain，崩溃可能保留 sending。这两种情况不自动重发，应由管理员核对日志后决定。不能承诺恰好一次且绝不漏发。
- email_deliveries 以凭证和活动 ID 去重；改名／改时间造成上游新 ID 可能再次提醒。已提醒后再恢复未完成不重复提醒。
- 每次最多轮询50个订阅，按检查时间轮转；用户多时延迟增加。此版面向小规模测试，扩大规模前改队列和专用邮件服务。
- 验证码每凭证至少60秒间隔；每IP每小时10次、每目标邮箱每小时5次、全站每日100次。额度在数据库原子计数；发送失败也计入限制。默认日桶按 UTC，避免误认为北京时间零点重置。
- 目前邮件里提供原浏览器的停止提醒路径，尚未提供独立的一键退订／跨设备恢复。正式大规模公开订阅前应补齐这些能力及反机器人挑战。
- 邮箱、选择和完成状态存于私有 D1；不会写入公开 GitHub JSON。验证码邮件中不会附带管理凭证。

## 八、管理员检查与回滚

在 D1 可查询：

```sql
SELECT email, active, updated_at, checked_at FROM email_subscriptions;
SELECT status, COUNT(*) FROM email_deliveries GROUP BY status;
```

关闭全部提醒：先禁用 Worker Cron，再按需执行 `UPDATE email_subscriptions SET active=0;`。只删除网页按钮不会停止后台发送。回滚页面时恢复备份的三个旧文件并停止 Worker；保留新表便于审计，不删除原申请表。

旧 Email ending event reminders 工作流仍是原有预设邮箱提醒。它可能与新订阅同时发信；若用途已被新功能取代，在 GitHub Actions 中禁用旧工作流，避免重复通知，勿误停 Sync game events。

## 本地验证情况

JavaScript 全部语法检查、SQLite 重复迁移与唯一记录、48小时边界、游戏／完成筛选、重复活动、重复轮询、发送前版本变化及 SMTP 不确定结果模拟通过。未执行真实 QQ SMTP、线上 D1/Cron/Pages 部署，也未完成四种宽度的真实浏览器视觉验收。
