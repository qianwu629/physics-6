---
phase: 1
slug: 持久化与场景库
status: draft
nyquist_compliant: true
wave_0_complete: false
created: "2026-05-04"
---

# Phase 1 — 持久化与场景库 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 + jsdom 29.1.1 + @testing-library/react 16.3.2 |
| **Config file** | `vite.config.ts` (test 字段) |
| **Quick run command** | `npx vitest run --reporter=dot` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=dot`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | PERSIST-01 | T-01-01 | 仅出序列化已知字段，不过滤恶意内容 | unit | `npx vitest run src/utils/__tests__/sceneSerializer.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | PERSIST-01, PERSIST-02 | T-01-02 | Zod safeParse 拒绝 JSON 语法错误 | unit | `npx vitest run src/utils/__tests__/sceneValidation.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 2 | PERSIST-03 | T-02-01 | localStorage 槽位损坏检测 + QuotaExceededError 捕获 | unit | `npx vitest run src/store/__tests__/snapshotSlice.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 2 | PERSIST-03 | T-02-03 | 快照名称正则校验 `^[\w\s\-\.一-龥]{1,30}$` | component | `npx vitest run src/components/__tests__/SnapshotManager.test.tsx` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 2 | PERSIST-01, PERSIST-02 | T-03-01 | 加载前确认对话框 + 版本不匹配 banner | component | `npx vitest run src/components/__tests__/SceneLoader.test.tsx` | ❌ W0 | ⬜ pending |
| 01-03-02 | 03 | 2 | PERSIST-01, PERSIST-02 | — | MenuBar 渲染 3 个菜单项 | component | `npx vitest run src/components/__tests__/MenuBar.test.tsx` | ❌ W0 | ⬜ pending |
| 01-04-01 | 04 | 2 | PERSIST-04 | — | 5 个预设 JSON 语法有效 | unit | `npx vitest run src/presets/__tests__/presets.test.ts` | ❌ W0 | ⬜ pending |
| 01-04-02 | 04 | 2 | PERSIST-04 | — | PresetSelector 渲染 5 个预设卡片 | component | `npx vitest run src/components/__tests__/PresetSelector.test.tsx` | ❌ W0 | ⬜ pending |
| 01-05-01 | 05 | 3 | PERSIST-01..04 | — | App.tsx 整合 MenuBar + Sheet + Dialog | integration | `npx tsc --noEmit`（无自动化测试） | — | ⬜ pending |
| 01-05-02 | 05 | 3 | PERSIST-01..03 | — | 摄像机自适应 bounding box | manual | 手动验证摄像机位置 | — | ⬜ pending |
| 01-06-01 | 06 | 1 | DEBT-04 | — | Scene3D.test.tsx 全部通过 | unit | `npx vitest run src/components/Scene3D.test.tsx` | ✅ 修复中 | ⬜ pending |
| 01-06-02 | 06 | 1 | DEBT-04 | — | Phase 4 VERIFICATION.md 存在 | manual | 文件系统检查 | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/utils/__tests__/sceneSerializer.test.ts` — 序列化/反序列化单元测试
- [ ] `src/utils/__tests__/sceneValidation.test.ts` — Zod Schema 校验测试
- [ ] `src/store/__tests__/snapshotSlice.test.ts` — 快照 CRUD + persist 测试
- [ ] `src/components/__tests__/SnapshotManager.test.tsx` — 快照面板渲染 + 交互测试
- [ ] `src/components/__tests__/MenuBar.test.tsx` — MenuBar 渲染测试
- [ ] `src/components/__tests__/SceneLoader.test.tsx` — SceneLoader 渲染测试
- [ ] `src/components/__tests__/PresetSelector.test.tsx` — PresetSelector 渲染测试
- [ ] `src/presets/__tests__/presets.test.ts` — 预设 JSON 有效性测试
- [ ] `frontend/src/components/Scene3D.test.tsx` — 修复 9 个失败用例（DEBT-04）
- [ ] `.planning/milestones/v1.0-phases/04-轨迹与矢量可视化/04-VERIFICATION.md` — 补写验证文档

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 摄像机自适应场景包围盒 | PERSIST-01, PERSIST-02 | 涉及 Three.js 3D 渲染结果，无法在 jsdom 中自动化 | 加载不同大小的场景 JSON，目视确认摄像机距离适配 |
| localStorage 损坏槽位 Modal 清除 | PERSIST-03 | 需手动篡改 localStorage 模拟损坏 | 浏览器 DevTools → Application → 修改 `physis-snapshots` 键值 → 刷新页面确认 Modal |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
