# WebRTC Control Popup 控制台设计

## 目标

为扩展增加一个中文 popup 控制台，让用户点击浏览器插件图标后，可以直接查看当前页面状态，并完成常用操作。

popup 需要支持：

- 开启或关闭全局 WebRTC Control。
- 查看当前页面域名。
- 将当前域名加入白名单或移出白名单。
- 跳转到扩展选项页面。

## 非目标

本次不实现 WebRTC 阻断日志、最近站点记录、规则分组、导入导出或临时白名单。这些功能后续可以在 popup 基础上继续扩展。

## 用户体验

点击插件图标后显示 popup，而不是立即切换当前域名白名单。

popup 顶部显示全局状态：

- `ON`：绿色，表示 WebRTC Control 已开启。
- `OFF`：红色，表示 WebRTC Control 已关闭。

主体区域显示当前页面信息：

- 支持 http/https 页面时，显示归一化后的域名。
- 不支持域名规则的页面，例如 `chrome://`、扩展页面、空 URL，显示“当前页面不支持域名规则”。

主要操作：

- 全局开关按钮：根据当前状态显示“关闭保护”或“开启保护”。
- 当前域名按钮：根据白名单状态显示“加入白名单”或“移出白名单”。
- 不支持域名规则时，禁用当前域名按钮。
- 底部按钮“打开选项页面”，调用 `chrome.runtime.openOptionsPage()`。

## 架构

### manifest

`manifest.json` 的 action 增加 `default_popup`，指向 `popup/popup.html`。

### popup 文件

新增：

- `popup/popup.html`
- `popup/popup.css`
- `popup/popup.js`

popup 不直接读写 `chrome.storage.local`，只通过后台消息接口操作，避免状态逻辑散落在多个 UI 中。

### 后台控制器

`src/background-controller.js` 新增或扩展消息类型：

- `getPopupState`：返回 popup 所需状态。
- `updateSettings`：复用现有接口切换全局 enabled。
- `addDomain`、`removeDomain`：复用现有接口操作当前域名白名单。

建议新增 `getPopupState`，其返回值包含：

```json
{
  "ok": true,
  "enabled": true,
  "domain": "example.com",
  "supported": true,
  "whitelisted": false,
  "protect": true,
  "settings": {}
}
```

其中：

- `enabled` 表示全局 WebRTC Control 是否开启。
- `domain` 是当前页面归一化域名，不支持时为 `null`。
- `supported` 表示当前页面是否支持域名规则。
- `whitelisted` 表示当前域名是否在白名单中。
- `protect` 表示当前页面是否正在被保护。

### 工具栏点击行为

由于 action 增加 popup 后，点击插件图标会打开 popup，原来的 `chrome.action.onClicked` 通常不会触发。保留现有 `handleActionClick` 和测试作为兼容逻辑，但用户主路径改为 popup 操作。

## 数据流

1. popup 加载后查询当前活动标签页。
2. popup 发送 `getPopupState`，传入当前标签页 URL。
3. 后台读取设置并计算域名状态。
4. popup 渲染 ON/OFF、当前域名、白名单按钮和保护状态。
5. 用户切换全局开关时，popup 发送 `updateSettings`，只传入新的 `enabled` 值。
6. 后台保存设置，刷新当前活动页策略和插件徽标。
7. 用户切换当前域名白名单时，popup 根据当前状态调用 `addDomain` 或 `removeDomain`。
8. 后台保存设置，刷新当前活动页策略和插件徽标。
9. popup 根据返回状态重新渲染。

## 错误处理

- 无法获取当前标签页时，显示“无法读取当前页面”，禁用域名按钮。
- 后台消息失败时，显示中文错误状态，不关闭 popup。
- 当前页面 URL 不支持域名规则时，仍允许切换全局开关和打开选项页。
- 白名单域名无效时，显示“当前页面不支持域名规则”。

## 测试

新增或扩展测试覆盖：

- manifest action 配置了 `default_popup`。
- popup 文件存在，并包含中文关键文案。
- `getPopupState` 对受保护页面返回 enabled、domain、whitelisted、protect。
- `getPopupState` 对白名单页面返回 `protect: false`。
- `getPopupState` 对不支持 URL 返回 `supported: false`。
- popup 全局开关复用后台设置更新，并刷新策略和徽标。
- 当前域名加入/移出白名单后，返回的新状态正确。

## 完成标准

- 点击插件图标打开中文 popup。
- popup 能控制全局 WebRTC Control 开关。
- popup 能针对当前域名加入或移出白名单。
- popup 能打开选项页面。
- 不支持 URL 的页面有清晰中文状态。
- 现有选项页和后台测试继续通过。
