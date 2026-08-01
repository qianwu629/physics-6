/**
 * Phase 5 冒烟测试 — 运行时属性同步链路完整性 (REN-03 / Pitfall 5 闭环)
 *
 * 目的：在源代码层面静态验证 Rapier imperative API 调用存在，
 *      防止未来重构意外移除 useEffect 同步块导致 SC-3 回归。
 *
 * 这是回归保险，不替代 runtime-prop-sync.test.tsx 中的运行时单元测试。
 * 运行 < 100ms — 纯文件读取 + 正则匹配。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ENTITY_RENDERER = readFileSync(
  join(__dirname, '../../components/EntityRenderer.tsx'),
  'utf-8',
);

// 过滤注释行（防止注释中的 token 触发自我无效的 grep gate）
const codeOnly = ENTITY_RENDERER.split('\n')
  .filter((line) => {
    const t = line.trim();
    return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
  })
  .join('\n');

describe('Runtime prop sync chain (REN-03 / Phase 5 smoke)', () => {
  it('EntityRenderer 调用 RigidBody.setAdditionalMass 同步 mass', () => {
    expect(codeOnly).toMatch(/\.setAdditionalMass\s*\(/);
  });

  it('EntityRenderer 调用 Collider.setRestitution 同步 restitution', () => {
    // W3 多 collider（每面一个）循环同步：.collider(i) 任意索引形式均可
    const factored =
      /\.collider\s*\(\s*\w+\s*\)[\s\S]{0,400}?\.setRestitution\s*\(/;
    expect(factored.test(codeOnly)).toBe(true);
  });

  it('EntityRenderer 调用 Collider.setFriction 同步 friction', () => {
    const factored =
      /\.collider\s*\(\s*\w+\s*\)[\s\S]{0,400}?\.setFriction\s*\(/;
    expect(factored.test(codeOnly)).toBe(true);
  });

  it('EntityRenderer 调用 setLinearDamping 同步 drag', () => {
    expect(codeOnly).toMatch(/\.setLinearDamping\s*\(/);
  });

  it('W3: 摩擦合并规则统一为 Multiply（接触摩擦 = 两面系数相乘）', () => {
    expect(codeOnly).toMatch(/setFrictionCombineRule/);
    expect(codeOnly).toMatch(/CoefficientCombineRule\.Multiply/);
  });

  it('useEffect 依赖数组覆盖 mass/restitution/friction、restitutionScale 与面配置', () => {
    // W3 起全局 frictionScale 已移除（摩擦改为面级配置 collider.faces）
    expect(codeOnly).toMatch(/rigidBody[?.]\.?mass/);
    expect(codeOnly).toMatch(/rigidBody[?.]\.?restitution/);
    expect(codeOnly).toMatch(/rigidBody[?.]\.?friction/);
    expect(codeOnly).toMatch(/restitutionScale/);
    expect(codeOnly).toMatch(/collider\?\.faces/);
  });

  it('保留首次挂载的 RigidBody props（不破坏初始化）', () => {
    expect(codeOnly).toMatch(/mass\s*=\s*\{rigidBody\.mass\}/);
    expect(codeOnly).toMatch(/restitution\s*=\s*\{Math\.min\(rigidBody\.restitution/);
  });
});
