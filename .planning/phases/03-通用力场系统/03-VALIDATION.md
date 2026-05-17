---
phase: 3
slug: force-field-system
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-17
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vite.config.ts |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | FIELD-01 | T-03-01 / — | ForceFieldComponent schema valid | unit | `npm test` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | FIELD-01 | T-03-02 / — | RigidBody charge field serializes | unit | `npm test` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | FIELD-02 | T-03-03 / — | Uniform field force correct | unit | `npm test` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | FIELD-02 | T-03-04 / — | Gravity field 1/r^2 decay | unit | `npm test` | ❌ W0 | ⬜ pending |
| 03-02-03 | 02 | 1 | FIELD-02 | T-03-05 / — | Electric field Coulomb force | unit | `npm test` | ❌ W0 | ⬜ pending |
| 03-02-04 | 02 | 1 | FIELD-02 | T-03-06 / — | Magnetic field Lorentz force | unit | `npm test` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | FIELD-03 | T-03-07 / — | ForceFieldDialog renders | unit | `npm test` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03 | 2 | FIELD-03 | T-03-08 / — | Toolbox buttons create fields | unit | `npm test` | ❌ W0 | ⬜ pending |
| 03-03-03 | 03 | 2 | FIELD-03 | T-03-09 / — | PropertyPanel edits field params | unit | `npm test` | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 2 | FIELD-04 | T-03-10 / — | Arrow InstancedMesh renders | unit | `npm test` | ❌ W0 | ⬜ pending |
| 03-04-02 | 04 | 2 | FIELD-04 | T-03-11 / — | Transparent sphere renders | unit | `npm test` | ❌ W0 | ⬜ pending |
| 03-05-01 | 05 | 3 | FIELD-04 | T-03-12 / — | Force lines toggle works | unit | `npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/ecs/__tests__/forceField.test.ts` — force calculation tests
- [ ] `frontend/src/ecs/__tests__/entity.test.ts` — charge field serialization
- [ ] `frontend/src/components/__tests__/ForceFieldDialog.test.tsx` — dialog rendering

*Wave 0 covers all MISSING references.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Magnetic field circular motion | FIELD-02 | Visual trajectory verification | Launch charged particle perpendicular to B field, observe circular path |
| Force line density | FIELD-04 | Visual density judgment | Toggle force lines, verify density correlates with field strength |
| Transparency blending | FIELD-03 | Visual occlusion check | Verify field volumes don't fully occlude entities behind them |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
