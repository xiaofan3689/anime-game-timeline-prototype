# 协作者权限维护说明

## 当前版本的“申请通过”意味着什么

v54 的同意按钮发送结果邮件，并把申请记为 approved。它没有创建协作者角色、修改 Cloudflare Access、邀请 GitHub 仓库成员或开放新的维护后台。申请表中填写邮箱和 GitHub 用户名不构成身份验证。

现有管理员接口仍只认 ADMIN_EMAIL，并使用 GH_TOKEN 直接写仓库。不要把协作者邮箱替换到 ADMIN_EMAIL，否则会更换管理员；也不要简单让所有 Access 登录者具有管理员权限。

## 能否自动授权

可以，但需要先开发实际的角色权限系统。目前没有可直接开启的自动授权开关。推荐同意申请之后分成“身份待验证 → 权限待开通 → 已开通”，每步单独记录，不用发信成功代替授权成功。

权限共分三层：

| 层级 | 控制内容 | 推荐方式 |
|---|---|---|
| 网站角色 | 可以编辑哪些游戏、提交提案、是否可审批 | 私有 D1 中的用户、角色、游戏范围；后端逐请求校验 |
| Cloudflare Access | 是否允许进入后台 | 白名单邮箱或身份提供商；进入页面不等于有写入权限 |
| GitHub | 用什么身份创建分支、PR、合并 | GitHub App 安装令牌或本人用户令牌 |

## 推荐的权限边界

协作者：可编辑允许的游戏属性和活动，可提交审批，不可直接写 main、审批自己、操作用户角色、清除全体申请或读取令牌。管理员：可处理提案、角色和正式发布。规则必须在 API 实施，隐藏前端按钮不够。

无 GitHub 账号：邮箱验证后绑定网站用户，App 代创建提案分支与 PR，记录真实网站提交人。无需向协作者暴露仓库令牌。

有 GitHub 账号：邮箱验证后通过 GitHub OAuth 绑定数字用户 ID；授权才证明该账号属于本人。公共仓库推荐 Fork 提交本人 PR，不必授予主仓库写权限。私有仓库需要另外核对 Fork 政策及权限。仅知道用户名不能自动代其本人创建 PR。

## 将来建议实现的自动开通流程

1. 管理员审核通过，发送包含限时激活链接的邮件。
2. 申请人验证邮箱，必要时本人绑定 GitHub；链接过期可重新申请激活，不自动给未验证邮箱授权。
3. 服务端创建 collaborator 角色和允许维护的游戏范围。
4. 根据部署方式将其加入 Access 允许名单，或使用已设计好的身份准入策略。使用 Cloudflare API 自动改策略时，应单独配置最小权限凭据，不能把账号全局密钥放网页。
5. 用户进入协作者后台，编辑仅保存草稿；提交创建 PR，管理员批准后合并。
6. 各步骤可重试且有审计，邮件失败、Access 配置失败、GitHub 授权失败分别显示，不能出现部分失败仍声称全部开通。

这套系统与当前申请审批不同，需要独立开发和验收；v54 不自动新增任何维护权限。

## 如果确实需要 GitHub 仓库成员权限

可以通过 GitHub API 创建仓库邀请，接口通常需要 Administration 写权限，受仓库归属和组织政策限制，邀请还可能需要用户接受。个人仓库成员写权限无法简单只限定一个 JSON 文件，因此不推荐作为普通网站协作者的默认开通方式。不要为了自动邀请而直接给现有发信接口添加仓库管理权限。

管理员可以手动：仓库 Settings → Collaborators（组织仓库可能为 Collaborators and teams）→ Add people → 选择已验证账号及必要权限。先保护 main，禁止绕过审核。此操作让对方在 GitHub 获得仓库访问，不会自动完成本站角色配置。

## 日常维护与撤权

- 名单至少显示身份、邮箱验证状态、GitHub ID、角色、游戏范围、开通时间及审批人。
- 邮箱变更需重新验证；GitHub 改名以数字 ID 关联。
- 离职/退出：禁用网站角色，撤销会话及授权令牌，移除 Access 准入，按需移除 GitHub 成员权限；检查未处理提案。
- 申请记录删除不等于撤销已经授予的权限；测试用清除申请按钮不能当撤权按钮。
- 删除拒绝申请用于允许重新申请，其他用户的限制不受影响；前端下次点击查询最新服务器状态，无需强制全站刷新。

## 官方参考

- GitHub 仓库协作者接口：https://docs.github.com/en/rest/collaborators/collaborators
- GitHub App 用户授权：https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-with-a-github-app-on-behalf-of-a-user
- Cloudflare Access 应用：https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/
