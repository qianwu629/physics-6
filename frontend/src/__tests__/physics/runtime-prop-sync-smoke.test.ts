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
    // 接受 inline 链式 (.collider(0).setRestitution) 或经局部变量 (const col = rb.collider(0); col.setRestitution)
    const inline = /\.collider\s*\(\s*0\s*\)\s*\.setRestitution/;
    const factored =
      /\.collider\s*\(\s*0\s*\)[\s\S]{0,200}?\.setRestitution\s*\(/;
    expect(inline.test(codeOnly) || factored.test(codeOnly)).toBe(true);
  });

  it('EntityRenderer 调用 Collider.setFriction 同步 friction', () => {
    const inline = /\.collider\s*\(\s*0\s*\)\s*\.setFriction/;
    const factored =
      /\.collider\s*\(\s*0\s*\)[\s\S]{0,400}?\.setFriction\s*\(/;
    expect(inline.test(codeOnly) || factored.test(codeOnly)).toBe(true);
  });

  it('EntityRenderer 调用 setLinearDamping 同步 drag', () => {
    expect(codeOnly).toMatch(/\.setLinearDamping\s*\(/);
  });

  it('useEffect 依赖数组包含 mass/restitution/friction 与 environment scales', () => {
    // 宽松断言：检查所有关键 token 都出现在代码中（不在注释里）
    expect(codeOnly).toMatch(/rigidBody[?.]\.?mass/);
    expect(codeOnly).toMatch(/rigidBody[?.]\.?restitution/);
    expect(codeOnly).toMatch(/rigidBody[?.]\.?friction/);
    expect(codeOnly).toMatch(/restitutionScale/);
    expect(codeOnly).toMatch(/frictionScale/);
  });

  it('保留首次挂载的 RigidBody props（不破坏初始化）', () => {
    expect(codeOnly).toMatch(/mass\s*=\s*\{rigidBody\.mass\}/);
    expect(codeOnly).toMatch(/restitution\s*=\s*\{Math\.min\(rigidBody\.restitution/);
  });
});
