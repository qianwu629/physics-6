---
status: resolved
phase: 01-持久化与场景库
source:
  - 01-01-SUMMARY.md
  - 01-02-SUMMARY.md
  - 01-03-SUMMARY.md
  - 01-04-SUMMARY.md
  - 01-05-SUMMARY.md
  - 01-06-SUMMARY.md
started: "2026-05-05T05:00:00Z"
updated: "2026-05-05T06:06:00Z"
---

## Current Test

[testing complete]

## Tests

### 1. 顶部菜单栏显示
expected: 页面顶部显示菜单栏，包含 [文件]、[视图]、[帮助] 三个下拉菜单。点击每个菜单应展开对应的下拉选项。
result: pass

### 2. 快照管理面板
expected: 点击 [文件] > [快照管理] 或菜单栏中的快照入口，右侧应滑出 Drawer 面板，显示 5 个快照槽位（空槽显示占位状态）。
result: pass

### 3. 保存快照
expected: 在快照面板中输入快照名称，点击保存。快照应出现在某个槽位中，显示名称和实体数量。同名快照应弹出覆盖确认对话框。
result: pass

### 4. 加载快照
expected: 点击已保存的快照槽位，场景应恢复到保存时的状态（实体、环境参数等）。
result: pass

### 5. 快照重命名
expected: 双击快照名称进入编辑模式，修改后按 Enter 或失去焦点确认，名称应更新。
result: pass

### 6. 快照删除
expected: 点击快照槽位的删除按钮，应弹出确认对话框，确认后快照从槽位中移除。
result: pass

### 7. 场景导入
expected: 点击 [文件] > [导入场景]，选择有效的 JSON 场景文件，场景应加载到画布中。导入时若当前场景有实体，应先弹出确认对话框。
result: pass

### 8. 场景导出
expected: 点击 [文件] > [导出场景]，浏览器应下载一个 JSON 文件，内容包含当前场景的实体和环境参数。
result: pass

### 9. 预设场景选择器
expected: 点击 [文件] > [加载预设]，弹出 Dialog 显示 5 个预设场景卡片（抛体运动、斜面滑块、自由落体堆叠、弹簧振子、双弹簧链），每个卡片有图标、标题和描述。
result: pass

### 10. 加载预设场景
expected: 在预设选择器中点击任意预设卡片，Dialog 关闭，对应物理实验场景加载到画布中。
result: pass

### 11. 摄像机自适应
expected: 加载场景（导入、预设、快照）后，摄像机应自动调整视角，使所有实体都能被看到。空场景时摄像机回到默认视角。
result: pass

## Summary

total: 11
passed: 11
issues: 2
resolved: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "加载预设/快照/导入场景时确认对话框应正常弹出"
  status: fixed
  reason: "UAT 发现: ConfirmDialogRoot 组件未在 App.tsx 中渲染，导致 showConfirmDialog() 永远挂起"
  severity: blocker
  test: 4
  root_cause: "App.tsx 导入了 SceneBanner 但未导入/渲染 ConfirmDialogRoot。Plan 05 集成布线时遗漏了 ConfirmDialogRoot 组件。"
  artifacts:
    - path: "frontend/src/components/App.tsx"
      issue: "缺少 ConfirmDialogRoot 导入和 JSX 渲染"
  missing:
    - "在 App.tsx 中导入 ConfirmDialogRoot from ./SceneLoader"
    - "在 JSX 中渲染 <ConfirmDialogRoot />"
  debug_session: ""

- truth: "加载预设场景时不应导致页面崩溃"
  status: resolved
  reason: "加载「自由落体堆叠」预设时页面变白，控制台出现 9 个 TypeError: Cannot read properties of null (reading 'current') at jointRef.current (@react-three/rapier)"
  severity: blocker
  test: 10
  root_cause: "key={resetCounter} 触发 Physics 同步卸载/挂载。React 在同一个渲染帧内卸载旧 Physics 并挂载新 Physics 时，@react-three/rapier v2.2.0 内部 jointRef cleanup 未完成就被新实例同步渲染，导致 jointRef.current 读取 null。"
  artifacts:
    - path: "frontend/src/components/Scene3D.tsx:177-186"
      issue: "key={resetCounter} 同步触发 Physics 重挂载，无清理窗口"
  fix:
    - "useState(physicsKey) + useEffect setTimeout(100ms) 延迟 key 更新"
    - "给 rapier 内部 joint cleanup 足够时间完成后再挂载新 Physics"
  fix_commit: "35d1719"
  debug_session: ""
