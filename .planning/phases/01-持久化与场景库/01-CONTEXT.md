---
phase: 1
phase_name: 持久化与场景库
milestone: v2.0 力场与多维模拟
date_created: "2026-05-04"
status: Locked (9/9 decisions confirmed)
---

# Phase 1 上下文 — 持久化与场景库

## 上游参考

- ROADMAP: `.planning/ROADMAP.md` (v2.0 路线图)
- REQUIREMENTS: `.planning/REQUIREMENTS.md` — 需求编号 PERSIST-01..PERSIST-04 + DEBT-04
- DEBT: `.planning/DEBT.md` — DEBT-04 (Scene3D 测试修复 + Phase 4 验证文档)
- Milestone 状态: `.planning/STATE.md`

## 本阶段目标

交付场景导出/导入、快照系统、预设场景库三大功能。修复遗留技术债务 DEBT-04。

---

## 已锁定决策

### D-01-01 — JSON Schema 保存范围：最小集

**Decision:** 只保存核心仿真数据，不保存可视化/UI/摄像机状态。

Schema 结构：
```json
{
  "schemaVersion": "1.0",
  "savedAt": "2026-05-04T...",
  "simulation": {
    "environment": { "gravity", "frictionScale", "restitutionScale", "drag" },
    "entities": [...],
    "constraints": [...]
  }
}
```

**不保存的项：** visualization toggles（trail/vector 全局开关）、metadata（name/description）、camera 位置、UI panel 折叠状态、运行时 trail/vector 数据。

**Why:** 仿真数据与 UI 状态分离，保证导出文件跨会话/跨设备可复现，同时避免 Schema 膨胀导致版本兼容问题。

**How to apply:** 序列化函数只遍历 simulationStore 中的仿真状态；反序列化时摄像机始终重置为自适应 bounding box 的默认视角。

---

### D-01-02 — schemaVersion 不匹配：尝试加载 + 警告

**Decision:** 遇到不匹配的 `schemaVersion` 不直接拒绝，采用宽容加载模式：顶部显示黄色 banner 警告，未知字段忽略，缺失字段用默认值。

**Why:** 用户可能在不同版本间共享场景文件，严格拒绝会导致用户数据"被锁死"。宽容模式最大化场景可恢复性，同时通过 banner 明确告知降级行为。

**How to apply:** 加载器入口先校验 `schemaVersion`，不匹配时记录 warningFlags，继续走正常反序列化流程；缺失字段使用引擎默认值填充；未知字段通过 Object.keys 过滤丢弃。UI 层读取 warningFlags 渲染 banner。

---

### D-01-03 — 加载前确认 + 强制暂停 + 清空 trail

**Decision:** 加载 JSON 时：弹出确认对话框 → 暂停仿真 → 重置时间 → 清空轨迹。

具体行为：
1. 加载前弹出确认：「加载将替换当前场景，继续？」
2. 加载后强制暂停（`isRunning = false`），仿真时间重置为 0
3. 调用 `trajectoryBuffer.reset()` 清空所有实体的 trail 缓冲
4. 摄像机回到默认 OrbitControls 位置（自适应新场景 bounding box）

**Why:** 场景替换是不可逆操作，需要用户显式确认；暂停+重置保证新场景从干净状态开始，避免旧仿真残留（trails、时间、动量）干扰。

**How to apply:** 在导入/预设加载/快照加载三个入口统一调用 `loadSceneWithConfirm()` 包装函数，内部顺序执行：确认弹窗 → store.reset() → trajectoryBuffer.reset() → 反序列化 → camera.fitToBoundingBox()。

---

### D-01-04 — 入口形态：顶部菜单栏 File 风格

**Decision:** 新增顶部 MenuBar，采用 [文件] [视图] [帮助] 下拉菜单结构。

菜单层级：
```
[文件 ▾] [视图 ▾] [帮助 ▾]
  ├ 导出场景      → 直接下载 physis-scene-{savedAt}.json
  ├ 导入场景      → 原生 <input type="file" accept=".json"> picker
  ├ ─────────
  ├ 快照管理...   → 打开右侧 Drawer
  └ 预设场景库... → 弹出场景卡片选择器
```

**Why:** 桌面应用标准范式（Blender、Unity、Godot 均如此），用户零学习成本；导出/导入高频操作直接暴露，快照/预设低频操作放二级入口。

**How to apply:** 在 App.tsx 顶部渲染 MenuBar 组件，文件菜单项绑定对应 handler；导出触发浏览器 download，导入通过隐藏 `<input type="file">` 触发。

---

### D-01-05 — 快照面板：右侧滑出 Drawer

**Decision:** 快照管理用右侧 Drawer 抽屉，不用 Dialog 弹窗。

Drawer 内容：
- 顶部：「保存当前场景」输入区（名称输入 + 保存按钮）
- 主体：5 个槽位列表，每行显示 名称 / 创建时间 / 实体数 / [加载][重命名][删除]

**Why:** Dialog 会遮挡 3D 视图，用户无法边查看场景边管理快照；Drawer 侧滑保持仿真画面可见，符合"边看边操作"的交互直觉。

**How to apply:** 使用 shadcn/ui Sheet 组件（side="right"），内部渲染 SnapshotManager 子组件；快照数据持久化到 localStorage，键名 `physis-snapshot-{slotIndex}`。

---

### D-01-06 — 快照命名：用户输入 + 不允许重名 + 可重命名

**Decision:** 快照命名规则：保存时必须输入名称，校验规则为 1-30 字符，允许中英文/数字/空格/`-_.`；不允许重名；支持双击 inline 编辑重命名；覆盖前二次确认。

具体规则：
- 保存时名称非空，正则校验：`^[\w\s\-\.一-龥]{1,30}$`
- 创建时校验名称是否已存在于其他槽位，重复则拒绝并提示
- 双击槽位名称进入 inline 编辑，失去焦点或按 Enter 保存
- 向已有槽位保存时提示：「槽位 'XXX' 已有快照，覆盖？」

**Why:** 强制命名避免用户面对"快照 1/2/3"无法识别内容；重名校验防止混淆；覆盖确认防止误操作丢失数据。

**How to apply:** SnapshotManager 组件内维护名称校验函数和覆盖确认流程；localStorage 存储结构包含 `name`、`createdAt`、`data` 字段。

---

### D-01-07 — 内置预设场景：5 个 v1.0 能力 + 第 6 个推迟

**Decision:** Phase 1 交付 5 个预设场景，第 6 个推迟到 Phase 3。

交付列表：
1. **抛体运动** — 球体 + 初速度 (5, 8, 0)
2. **斜面滑块** — 30° 斜面 + 顶端盒块下滑
3. **自由落体堆叠** — 5 个球从不同高度落下
4. **弹簧振子** — 质量块 + 天花板锚点 + 弹簧
5. **双弹簧链** — 3 个质量块 + 4 根弹簧串联

推迟项：
- **点电荷力场示例** → Phase 3 力场系统实现后补上（需要 ForceField + Coulomb 力，v1.0 无此能力）

**Why:** 前 5 个场景完全基于 v1.0 已有能力（刚体、约束、弹簧），可立即实现；第 6 个依赖 Phase 3 的力场系统，提前做只能做 mock，无实际仿真价值。

**How to apply:** 5 个预设作为 JSON 文件打包到 `frontend/src/presets/*.json`，与导入流程共享同一加载器（DRY）；预设选择器为弹窗卡片网格，点击直接调用共享加载器；需求文档中记录第 6 项为 Phase 3 依赖项。

---

### D-01-08 — 错误处理：分级响应

**Decision:** 采用分级错误处理策略，与 D-01-02 的宽容模式一致。

| 错误类型 | 反馈方式 |
|---------|---------|
| JSON 语法错 / 文件 > 5MB | Modal 拒绝加载 |
| schemaVersion 不匹配 / Schema 校验失败 | 顶部黄色 banner 警告 + 尽力加载 |
| localStorage 配额满（QuotaExceededError）| 右上 Toast「存储空间不足，请删除旧快照」|
| 约束 entityId 引用失效 | 跳过该约束 + 提示「N 个约束已跳过」+ 继续加载其余 |
| localStorage 槽位损坏 | Modal「槽位 X 数据损坏，是否清除？」|

**Why:** 不同严重程度的错误需要不同的阻断级别。语法错误/超大文件无法恢复，必须阻断；版本不匹配可降级恢复，不应阻断用户工作流；存储配额满是环境限制，给用户清理指引即可。

**How to apply:** 加载器内嵌 try/catch 分层捕获，返回 `{ success, data, warnings, errors }` 结构化结果；UI 层根据返回的 `errors` 数组决定渲染 Modal/Toast/Banner 的哪种组合。

---

### D-01-09 — DEBT-04 范围：修复 Scene3D 测试 + 补 Phase 4 验证文档

**Decision:** Phase 1 技术债务处理范围限定为两项：
1. 修复 `frontend/src/components/__tests__/Scene3D.test.tsx` 9 个 baseline 失败用例（three.js Vector3 mock 缺失）
2. 补回 Phase 4 缺失的 `VERIFICATION.md`，放到 `.planning/milestones/v1.0-phases/04-轨迹与矢量可视化/04-VERIFICATION.md`

不做全面 mock 体系重写，不扩展测试范围。

**Why:** 9 个失败用例阻塞了测试基线绿色，影响 Phase 1 的测试信心；Phase 4 验证文档缺失是 v1.0 收尾遗漏。两者工作量可控且与 Phase 1 无冲突。全面 mock 重写超出 Phase 1 主题。

**How to apply:** 为 Scene3D.test.tsx 补充 Vector3/Quaternion/Euler 的 vitest mock；基于 Phase 4 已交付代码反向推导验证点并撰写 VERIFICATION.md；两项工作作为 Phase 1 的独立 task 插入计划末尾。

---

## 衍生决策

- **Drawer 仅含快照管理**：导出/导入/预设场景库分别走独立菜单项，不打 Tab 拼盘（D-01-04 已涵盖）
- **预设场景实现方式**：作为 JSON 文件打包到 `frontend/src/presets/*.json`，与导入流程共享同一加载器（DRY）（D-01-07 已涵盖）

---

## 假设

1. localStorage 可用且容量 >= 5MB（5 槽位 x ~200KB 单场景）
2. 用户浏览器支持 `<a download>` 和 `<input type="file">` API（现代浏览器均支持）
3. 预设场景 JSON 的 schemaVersion 与导出/导入共用同一份 "1.0"
4. Phase 1 不依赖 Phase 2-6，可独立交付

---

## 已知风险

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| localStorage 配额超限 | 快照保存失败 | 单场景估算 < 200KB，5 槽位安全；超限提示用户清理 |
| schemaVersion 1.0 后续演进 | 旧文件兼容负担 | D-01-02 宽容模式 + banner 警告，预留版本迁移空间 |
| 预设场景 JSON 与导出不同步 | 预设加载失败 | 预设走同一加载器，CI 中增加预设 JSON 语法校验 |
| 导入恶意 JSON | 潜在安全问题 | 限制文件大小 < 5MB，仅解析已知字段，不执行任何代码 |

---

## 成功标准

1. [ ] 导出：点击「导出场景」下载合法 JSON，schemaVersion="1.0"
2. [ ] 导入：选择 JSON 文件后正确加载场景，弹确认 → 暂停 → 清空 trail → 自适应相机
3. [ ] 版本不匹配：加载旧版本 JSON 时显示黄色 banner，尽力加载成功
4. [ ] 快照：5 槽位 CRUD 完整，localStorage 持久化，重名校验，覆盖确认
5. [ ] 预设：5 个预设场景卡片可点击加载，与导入共享加载器
6. [ ] DEBT-04：Scene3D.test.tsx 全部通过（22 套件 / 185 测试 PASS）
7. [ ] DEBT-04：Phase 4 VERIFICATION.md 补写到正确位置

---

## 范围边界

**在范围内：**
- 导出/导入 JSON（文件下载 + 文件选择器）
- 快照系统（5 槽位，localStorage，Drawer UI）
- 预设场景库（5 个 JSON 预设 + 卡片选择器）
- MenuBar 新增 [文件] 菜单
- DEBT-04 修复

**不在范围内：**
- 自动保存 / 历史版本
- 云端同步
- 场景分享链接
- 摄像机/UI 状态持久化
- 点电荷力场预设（Phase 3 依赖）
- 全面 mock 体系重写
