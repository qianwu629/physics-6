---
phase: 02
slug: entity-component-system-property-editing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-01
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 + @testing-library/react 16.3.2 |
| **Config file** | vite.config.ts (inline test config) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose` (subset of related tests)
- **After every plan wave:** Run `npx vitest run` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 0 | DIF-01 | T-02-01 | shadcn/ui init verified by build passing | infra | `npx shadcn@latest --version` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | DIF-01 | — | ECS EntityNode+Component Map结构正确性 | unit | `npx vitest run src/ecs/Entity.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | DIF-01 | — | 组件组合——不同组件组合产生不同行为 | unit | `npx vitest run src/ecs/Entity.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | REN-03 | T-02-03 | 属性面板可编辑/只读切换 | unit | `npx vitest run src/components/PropertyPanel.test.tsx` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | REN-03 | T-02-04 | Slider值变化触发ECS组件更新 | integration | `npx vitest run src/components/PropertyPanel.test.tsx` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 1 | DIF-01 | T-02-02 | 工具箱按钮点击打开创建对话框 | unit | `npx vitest run src/components/Toolbox.test.tsx` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 1 | DIF-01 | T-02-02 | 创建对话框确认后实体出现在store中 | integration | `npx vitest run src/components/CreationDialog.test.tsx` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 1 | REN-03 | T-02-04 | 属性修改即时生效 | unit | `npx vitest run src/store/entitySlice.test.ts` | ❌ W0 | ⬜ pending |
| 02-04-02 | 04 | 1 | DIF-01 | — | ECS架构可扩展性——新组件类型可注册并查询 | unit | `npx vitest run src/ecs/Entity.test.ts` | ❌ W0 | ⬜ pending |
| 02-05-01 | 05 | 1 | REN-03 | — | 删除实体——确认对话框+ECS移除+selectedEntityId清除 | integration | `npx vitest run src/components/PropertyPanel.test.tsx` | ❌ W0 | ⬜ pending |
| 02-05-02 | 05 | 1 | DIF-01 | — | 重置键(R)——清空所有实体+resetCounter递增 | integration | `npx vitest run src/store/entitySlice.test.ts` | ❌ W0 | ⬜ pending |
| 02-05-03 | 05 | 1 | — | T-02-01 | 键盘快捷键(B/N/C/S/Delete/Backspace) | unit | `npx vitest run src/components/App.test.tsx` | Partial | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/ecs/Entity.test.ts` — ECS Entity创建、组件CRUD、组件查询
- [ ] `src/ecs/components/__tests__/` — 五种组件类型的接口一致性
- [ ] `src/store/entitySlice.test.ts` — Map增删改查操作的正确性
- [ ] `src/components/Toolbox.test.tsx` — 按钮渲染、点击事件、collapsed状态
- [ ] `src/components/CreationDialog.test.tsx` — 表单验证、提交流程、取消关闭
- [ ] `src/components/PropertyPanel.test.tsx` — 可编辑/只读状态、Slider交互、删除流程
- [ ] `src/components/EntityRenderer.test.tsx` — ECS数据→Rapier JSX映射
- [ ] `src/components/App.test.tsx` — 更新以覆盖新增键盘快捷键
- [ ] `src/components/Scene3D.test.tsx` — 更新以覆盖ECS驱动渲染和选中交互
- [ ] `src/test/setup.ts` — 现有配置已足够
- [ ] shadcn/ui init + 9组件安装 — `npx shadcn@latest init` + `npx shadcn@latest add button dialog slider input label tooltip scroll-area separator badge`
- [ ] react-hook-form + zod安装 — `npm install react-hook-form zod @hookform/resolvers`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 3D点击选中精度 | SC-2 | raycasting命中测试依赖WebGL渲染管线，无法在jsdom中精确模拟 | 打开应用，点击场景中不同位置，确认选择响应准确 |
| Outline高亮视觉效果 | SC-2 | 视觉效果需要在真实浏览器中验证 | 选中实体后目视确认outline粗细(1.5px)、颜色(#3b82f6)、screenspace模式 |
| 创建对话框表单可用性 | SC-1 | 表单UX需人工评估，自动化测试无法验证用户体验 | 逐个点击工具箱按钮打开对话框，确认表单控件可用、滑块响应及时 |
| Rapier restitution/friction运行时修改 | REN-03 | 需在真实WebGL环境中验证@react-three/rapier的prop动态响应 | 运行模拟→暂停→修改弹性系数→恢复运行，确认行为变化 |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
