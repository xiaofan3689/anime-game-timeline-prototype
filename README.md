# 二游活动时刻表（原型）

一个无需自有服务器的静态网页。GitHub Actions 定时读取活动来源，合并人工维护的 `data/manual.json`，生成供网页及未来 Android、Windows 客户端共用的 `data/events.json`。

## 已实现

- 《原神》《异环》及其他已配置游戏的活动数据适配；活动来源为 [SRA 公共 API](https://starrailassistant.top/reference/public-api/)，属于社区维护的官方公告整理数据，并非官方实时 API。
- 类似 Paimon.moe 的横向甘特时间线：日期横轴、跨日活动条、今日指示线、剩余时间和横向滚动；同时保留游戏筛选、搜索、状态筛选、来源链接与更新时间。页面每 5 分钟重新读取同源 JSON。
- 首次进入弹出游戏多选，选择结果保存在浏览器 localStorage；以后自动恢复，也可随时点击“选择游戏”修改。
- 游戏图标只用于首次游戏选择界面。时间线活动条不显示图标或首字；右侧使用活动自己的横幅/封面图并向左渐隐，版本总封面不再误用为每个活动背景。
- 人工补录字段：游戏 ID、游戏名称、游戏图标 URL、活动名称、开始和结束时间（须带时区）、公告 URL。
- 上游读取失败时，保留上次成功抓取的内容；失效数据会显示原抓取时间。

## 本地运行

需要 Python 3。先在项目目录运行 `python scripts/sync.py`，随后运行 `python -m http.server 8000`，访问 `http://localhost:8000/`。首次同步需要访问外网；失败时页面会明确显示暂无活动。不可直接用 `file://` 打开，因为浏览器会限制读取 JSON。

## 部署

1. 新建公开 GitHub 仓库，上传此目录，保留 `.github/workflows/sync.yml`。
2. 在仓库 Settings → Pages 的 Build and deployment 中选择 **GitHub Actions**。若默认分支不是 `main`，请同步修改工作流的 `git push origin HEAD:main`。
3. 到 Actions 手动运行一次 **Sync game events**。成功后任务会提交 `data/events.json`，并直接部署 GitHub Pages。
4. 可在 Pages 设置中绑定域名并按 GitHub 指引配置 DNS。HTTPS 与域名配置见 [GitHub Pages 文档](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)。

未来客户端共用 `https://你的域名/data/events.json`。所有端均以这个带版本号的 JSON 作为只读数据源。不要在网页或 App 中放 GitHub 写入令牌。人工录入通过提交 `data/manual.json` 完成，网站访客无权写入仓库。

## 同步边界

GitHub Actions 每 2 小时执行一次，另可手动触发；GitHub 的定时任务可能延迟或漏跑，Pages 发布和浏览器缓存也会增加延迟，因此这是**准实时**方案，不保证秒级同步。SRA 数据由社区维护者在公告后更新，来源更新速度是另一项限制。需要更快时，可提高定时频率（GitHub 最短 5 分钟）并监测失败，但仍不能保证严格实时。若将来需要官方公告直抓，可在 `scripts/sync.py` 中新增按游戏独立的采集器，并保留公告 URL、发布时间和人工复核。

## 数据契约

`data/events.json`：`schemaVersion`、`generatedAt`、`games[]`、`events[]`、`sources[]`。事件的 `startAt`、`endAt` 均为带偏移量的 ISO 8601 时间；`sourceType` 为 `community` 或 `manual`。同一事件的 `id` 跨同步保持稳定。人工补录示例如下。时间统一按来源的中国区时间解释；若活动属于其他区服，需要使用显式偏移量填写。

人工补录示例：在 `games` 数组加入 `{"id":"mygame","name":"示例游戏","iconUrl":"https://example.com/icon.png"}`，在 `events` 数组加入 `{"gameId":"mygame","title":"示例活动","startAt":"2026-11-05T10:00:00+08:00","endAt":"2026-11-12T04:00:00+08:00","sourceUrl":"https://example.com/notice"}`。保存并提交后，在 Actions 手动运行同步任务即可合并到公开数据。

## 来源与使用限制

SRA API 文档说明其资料来自各游戏官方公告，经社区维护者核对；详情、更新节奏和支持游戏以其[文档](https://starrailassistant.top/reference/public-api/)为准。《异环》的[官方活动公告页](https://nte.perfectworld.com/cn/article/news/gameevent/index.html)和《原神》的[官方网站](https://ys.mihoyo.com/main/)可用于人工核对。当前原型没有宣称直接接入官方 API，也不会把示例数据冒充实时活动。外部图片可能存在跨域、失效或使用许可问题，生产版宜使用获得授权的图标。
