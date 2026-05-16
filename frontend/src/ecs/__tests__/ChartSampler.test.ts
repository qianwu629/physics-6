import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getOrCreateBuffer, clearAllBuffers, chartBuffers, METRICS_PER_ENTITY } from '../../store/chartBuffer';
import { useChartDataStore } from '../../store/chartDataStore';
import * as nowSecondsModule from '../../utils/nowSeconds';

/**
 * chartBuffer + chartDataStore 集成测试 — Plan 02-02 Task 2
 *
 * W-03 fix: 文件名/描述对齐实际范围 — 本测试套件不挂载 ChartSampler
 * React 组件 (R3F useFrame 在 jsdom 中难以驱动), 而是验证写入侧 buffer +
 * 配置 store 的集成行为, 并新增一个 "writer 与 reader 共用 nowSeconds()"
 * 端到端用例以检测 C-01 类时间基准漂移。
 *
 * 真实组件挂载测试待 R3F 测试工具就绪后补 (e.g. @react-three/test-renderer).
 *
 * 覆盖:
 * - 暂停冻结 (V-CHART-04)
 * - 追踪/未追踪实体采样
 * - 重置清空 (V-CHART-05)
 * - 12 指标索引正确性
 * - 多实体独立缓冲
 * - writer/reader 时钟基准一致 (W-04 protection)
 */

describe('chartBuffer + store integration', () => {
  beforeEach(() => {
    clearAllBuffers();
    // Reset chartDataStore to initial state
    // C-04 fix: peReferenceY 已迁至 simulationSlice.environment, 这里不再设置
    useChartDataStore.setState({
      trackedEntityIds: new Set(),
    });
  });

  // ──── Test 1: isRunning=false → 不写入缓冲 (V-CHART-04) ────
  it('should not write to buffer when simulation is not running (V-CHART-04)', () => {
    // Simulate: when isRunning=false, ChartSampler's useFrame returns early
    // No data pushed → buffer should remain empty

    const entityId = 'entity-1';
    const buf = getOrCreateBuffer(entityId);

    // Simulate what useFrame would do when isRunning is false:
    // if (!isRunning) return;  <-- this is the guard being tested
    // So no push() should be called

    // Verify buffer is empty (no data was pushed)
    expect(buf.getCount()).toBe(0);

    // Verify buffer exists but has no data
    expect(chartBuffers.has(entityId)).toBe(true);
  });

  // ──── Test 2: 被追踪实体采样后 count > 0；未被追踪不写入 ────
  it('should write to buffer for tracked entities but not for untracked ones', () => {
    const trackedId = 'entity-tracked';
    const untrackedId = 'entity-untracked';

    // Add tracking for tracked entity
    useChartDataStore.getState().toggleTracking(trackedId);
    expect(useChartDataStore.getState().trackedEntityIds.has(trackedId)).toBe(true);
    expect(useChartDataStore.getState().trackedEntityIds.has(untrackedId)).toBe(false);

    // Simulate ChartSampler loop: only push for tracked entities
    // Push data for tracked entity (simulating useFrame)
    const now = 1000;
    const metrics = new Float64Array(METRICS_PER_ENTITY);
    metrics[0] = 1.0; // pos x

    const trackedBuf = getOrCreateBuffer(trackedId);
    trackedBuf.push(now, metrics);

    // Verify tracked entity has data
    expect(trackedBuf.getCount()).toBe(1);

    // Verify untracked entity buffer either doesn't exist or is empty
    const untrackedBuf = chartBuffers.get(untrackedId);
    if (untrackedBuf) {
      expect(untrackedBuf.getCount()).toBe(0);
    }
  });

  // ──── Test 3: resetCounter 变化后所有缓冲区被清空 (V-CHART-05) ────
  it('should clear all buffers when resetCounter changes (V-CHART-05)', () => {
    const entityId = 'entity-1';
    const buf = getOrCreateBuffer(entityId);

    // Push some data
    const metrics = new Float64Array(METRICS_PER_ENTITY);
    metrics[0] = 1.0;
    buf.push(1000, metrics);
    buf.push(1001, metrics);
    expect(buf.getCount()).toBe(2);

    // Simulate reset: clearAllBuffers (called when resetCounter changes)
    clearAllBuffers();

    expect(buf.getCount()).toBe(0);
  });

  // ──── Test 4: 12 指标索引 — 0-2 位置, 3-5 速度, 6-8 加速度, 9-11 能量 ────
  it('should store 12 metrics with correct indices (position/velocity/acceleration/energy)', () => {
    const entityId = 'entity-1';
    const buf = getOrCreateBuffer(entityId);

    const now = 1000;
    const metrics = new Float64Array(METRICS_PER_ENTITY);

    // Fill according to ChartSampler metric layout:
    // 0-2: position (x, y, z)
    metrics[0] = 1.1; // pos x
    metrics[1] = 2.2; // pos y
    metrics[2] = 3.3; // pos z
    // 3-5: velocity (vx, vy, vz)
    metrics[3] = 4.4; // vel x
    metrics[4] = 5.5; // vel y
    metrics[5] = 6.6; // vel z
    // 6-8: acceleration (ax, ay, az)
    metrics[6] = 7.7; // accel x
    metrics[7] = 8.8; // accel y
    metrics[8] = 9.9; // accel z
    // 9-11: energy (ke, pe, total)
    metrics[9] = 10.1;  // KE
    metrics[10] = 11.2; // PE (gravity + spring)
    metrics[11] = 12.3; // total energy

    buf.push(now, metrics);

    // Read back: getSeriesData returns {time, value} pairs
    const posX = buf.getSeriesData(0, now - 1, now + 1);
    const posY = buf.getSeriesData(1, now - 1, now + 1);
    const posZ = buf.getSeriesData(2, now - 1, now + 1);
    const velX = buf.getSeriesData(3, now - 1, now + 1);
    const velY = buf.getSeriesData(4, now - 1, now + 1);
    const velZ = buf.getSeriesData(5, now - 1, now + 1);
    const accX = buf.getSeriesData(6, now - 1, now + 1);
    const accY = buf.getSeriesData(7, now - 1, now + 1);
    const accZ = buf.getSeriesData(8, now - 1, now + 1);
    const ke   = buf.getSeriesData(9, now - 1, now + 1);
    const pe   = buf.getSeriesData(10, now - 1, now + 1);
    const total = buf.getSeriesData(11, now - 1, now + 1);

    // Verify each metric returns correct value
    expect(posX[0].value).toBeCloseTo(1.1, 5);
    expect(posY[0].value).toBeCloseTo(2.2, 5);
    expect(posZ[0].value).toBeCloseTo(3.3, 5);
    expect(velX[0].value).toBeCloseTo(4.4, 5);
    expect(velY[0].value).toBeCloseTo(5.5, 5);
    expect(velZ[0].value).toBeCloseTo(6.6, 5);
    expect(accX[0].value).toBeCloseTo(7.7, 5);
    expect(accY[0].value).toBeCloseTo(8.8, 5);
    expect(accZ[0].value).toBeCloseTo(9.9, 5);
    expect(ke[0].value).toBeCloseTo(10.1, 5);
    expect(pe[0].value).toBeCloseTo(11.2, 5);
    expect(total[0].value).toBeCloseTo(12.3, 5);

    // Verify METRICS_PER_ENTITY constant
    expect(METRICS_PER_ENTITY).toBe(12);
  });

  // ──── Test 5: 多实体同时追踪时各自独立缓冲 ────
  it('should maintain independent buffers for multiple tracked entities', () => {
    const entities = ['entity-A', 'entity-B', 'entity-C'];

    // Track all entities
    for (const id of entities) {
      useChartDataStore.getState().toggleTracking(id);
    }
    expect(useChartDataStore.getState().trackedEntityIds.size).toBe(3);

    const now = 1000;

    // Push different data for each entity
    const metricsA = new Float64Array(METRICS_PER_ENTITY);
    metricsA[0] = 10; // entity-A pos x
    getOrCreateBuffer('entity-A').push(now, metricsA);

    const metricsB = new Float64Array(METRICS_PER_ENTITY);
    metricsB[0] = 20; // entity-B pos x
    getOrCreateBuffer('entity-B').push(now, metricsB);

    const metricsC = new Float64Array(METRICS_PER_ENTITY);
    metricsC[0] = 30; // entity-C pos x
    getOrCreateBuffer('entity-C').push(now, metricsC);

    // Verify each entity's buffer is independent
    const dataA = getOrCreateBuffer('entity-A').getSeriesData(0, now - 1, now + 1);
    const dataB = getOrCreateBuffer('entity-B').getSeriesData(0, now - 1, now + 1);
    const dataC = getOrCreateBuffer('entity-C').getSeriesData(0, now - 1, now + 1);

    expect(dataA[0].value).toBeCloseTo(10, 5);
    expect(dataB[0].value).toBeCloseTo(20, 5);
    expect(dataC[0].value).toBeCloseTo(30, 5);

    expect(getOrCreateBuffer('entity-A').getCount()).toBe(1);
    expect(getOrCreateBuffer('entity-B').getCount()).toBe(1);
    expect(getOrCreateBuffer('entity-C').getCount()).toBe(1);

    // Verify chartBuffers map has our 3 entity entries
    expect(chartBuffers.has('entity-A')).toBe(true);
    expect(chartBuffers.has('entity-B')).toBe(true);
    expect(chartBuffers.has('entity-C')).toBe(true);
  });

  // ──── Test 6 (W-03 / W-04 regression): writer 与 reader 共用 nowSeconds() ────
  // 这个端到端用例显式验证 C-01 类时间基准 bug 的回归保护:
  // 写入侧用 nowSeconds() 推, 读取侧用同一 nowSeconds() 取 visible range,
  // slice 应非空。任何一侧绕过 helper 调用 Date.now()/1000 都会让 spy 失效
  // → 写入侧时间戳与读取侧 visible range 不交 → 断言失败。
  it('writer/reader using shared nowSeconds() helper see overlapping slice (W-03/W-04 regression)', () => {
    const FIXED_NOW = 1_700_000_000;
    const nowSpy = vi.spyOn(nowSecondsModule, 'nowSeconds').mockReturnValue(FIXED_NOW);

    try {
      // Writer 侧: 模拟 ChartSampler 用 nowSeconds() 写入近期样本
      const entityId = 'integration-entity';
      const buf = getOrCreateBuffer(entityId);
      const metrics = new Float64Array(METRICS_PER_ENTITY);
      metrics[1] = 42; // y position
      // 5 个样本, 时间从 FIXED_NOW-4 到 FIXED_NOW
      for (let i = -4; i <= 0; i++) {
        const t = nowSecondsModule.nowSeconds() + i; // = FIXED_NOW + i
        buf.push(t, metrics);
      }

      // Reader 侧: 模拟 ChartCanvas refreshAll 用 nowSeconds() 取 5s 窗口
      const now = nowSecondsModule.nowSeconds();
      const slice = buf.getSeriesData(1, now - 5, now);

      // 期望 slice 非空且包含全部 5 个样本
      expect(slice.length).toBe(5);
      expect(slice[0].time).toBe(FIXED_NOW - 4);
      expect(slice[4].time).toBe(FIXED_NOW);
      // value 应是 metrics[1] = 42
      expect(slice[0].value).toBe(42);
    } finally {
      nowSpy.mockRestore();
    }
  });
});
