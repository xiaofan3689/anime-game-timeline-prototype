# v51 协作者申请安装（QQ SMTP 测试版）

仅新增申请与通知，不包含协作者维护后台。

1. 将包内文件覆盖仓库根目录。包含 v49 修复，保留线上 data 文件。
2. Cloudflare 存储和数据库 → D1 → 创建数据库 timeline-applications。进入控制台执行 scripts/applications.sql（可重复执行）。
3. Pages → 设置 → 绑定 → 添加 D1，变量名 APPLICATION_DB，选择上述库。
4. QQ邮箱网页版 → 设置 → 账号（或账号与安全）→ POP3/IMAP/SMTP 服务，开启支持 SMTP 的服务，完成安全验证并生成授权码。授权码不是 QQ 登录密码，不要发给任何人。Cloudflare Pages → 设置 → 变量和机密，添加：
   - 普通变量 `QQ_SMTP_USER`：填写用于发信的完整 QQ 邮箱，例如 `xiaofan3689@qq.com`。
   - 机密/加密变量 `QQ_SMTP_AUTH_CODE`：填写刚生成的 SMTP 授权码。
   - 无需填写服务器和端口，代码固定 smtp.qq.com、465、TLS。
   - 无需填写 RESEND_API_KEY 或 APPLICATION_FROM；旧值可以删除。无需增加 DNS 解析或使用新域名。
   - 本功能不读取邮箱，不使用 IMAP；开启 IMAP/SMTP 组合服务也可以，但只会使用 SMTP。

5. 保留现有 Access、ADMIN_EMAIL 配置，确保 /api/admin/* 受保护。公开 /api/collaborator 不应套用管理员 Access。重新部署。
6. 测试申请：提交显示提示，返回可修改，确认才入库发信。成功后再次点击提示已提交。管理员点清除按钮清除全体申请记录；已发送邮件不能撤回。正在处理的请求存在短暂并发窗口，清除测试时避免同时提交。

同一浏览器标识或相同回信邮箱不能重复；清除浏览器数据并更换邮箱可绕过，当前没有邮箱验证或反机器人挑战。邮件成功代表发送服务接受，不保证最终送达；失败可重试。极端情况下发信成功后数据库更新失败可能状态不确定，需查看服务商日志。

检查：JS 语法通过、SQLite 初始化通过。尝试四宽度浏览器验证但本地缺少 playwright，320/390/768/1440 及其他既有界面未实测，线上发信/Access/D1 未实测。部署后需测试再正式开放。

## v51 补充

覆盖升级包到仓库根目录并重新部署。已有 APPLICATION_DB 和表结构不变，旧申请记录不变；需重新测试时使用管理员清除按钮。若未安装 v50，可直接使用本完整增量包并按上述步骤配置 D1。

Cloudflare 的 TCP sockets 用于连接 QQ SMTP 465；不能使用被禁止的 25 端口。QQ 可能因海外出口、风控或频率限制拒绝请求，SMTP 接受邮件也不保证到达收件箱。授权失败应检查完整邮箱、SMTP 服务开关和授权码。此功能为小规模申请测试，不是向所有用户群发提醒。

本地测试：模拟 SMTP 多行响应、AUTH LOGIN、DATA 成功和 535 认证失败通过，JS 语法通过。未使用真实授权码、未真实发信、未部署 Cloudflare。界面未改动，本次未重测 320/390/768/1440。

参考：https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/
