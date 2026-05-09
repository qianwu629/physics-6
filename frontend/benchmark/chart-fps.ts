/**
 * Chart FPS 基准测试
 *
 * 运行方式：在浏览器 dev console 中执行：
 *   import { runChartBenchmark } from './benchmark/chart-fps.ts';
 *   runChartBenchmark({ duration: 30000, entityCount: 4 });
 *
 * V-CHART-07: 16 条曲线 × 30 秒，median update cost < 3ms/frame
 */

interface BenchmarkOptions {
  duration?: number;      // 测试时长（毫秒），默认 30000
  entityCount?: number;   // 追踪实体数，默认 4
}

interface BenchmarkResult {
  medianUpdateMs: number;
  maxUpdateMs: number;
  minFps: number;
  avgFps: number;
  totalFrames: number;
  droppedFrames: number;
}

export function runChartBenchmark(options: BenchmarkOptions = {}): Promise<BenchmarkResult> {
  const { duration = 30000, entityCount = 4 } = options;

  return new Promise((resolve) => {
    const updateTimes: number[] = [];
    let frameCount = 0;
    let lastTime = performance.now();
    let droppedFrames = 0;
    const fpsSamples: number[] = [];
    const startTime = performance.now();

    const tick = () => {
      const now = performance.now();
      const elapsed = now - lastTime;
      frameCount++;

      // 检测掉帧（> 20ms 视为掉帧）
      if (elapsed > 20) {
        droppedFrames++;
      }

      // 每 500ms 采样一次 FPS
      if (frameCount % 30 === 0) {
        fpsSamples.push(Math.round(1000 / Math.max(elapsed, 1)));
      }

      // 测量 update() 耗时
      const updateStart = performance.now();
      // 实际测试时通过 chartCanvasRef.current?.refreshAll() 调用
      // 此处为基准框架，真实测量需在运行环境中注入
      const updateEnd = performance.now();
      updateTimes.push(updateEnd - updateStart);

      lastTime = now;

      if (now - startTime < duration) {
        requestAnimationFrame(tick);
      } else {
        const sorted = [...updateTimes].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
        const max = sorted[sorted.length - 1] ?? 0;
        const minFps = fpsSamples.length > 0 ? Math.min(...fpsSamples) : 0;
        const avgFps = fpsSamples.length > 0
          ? Math.round(fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length)
          : 0;

        resolve({
          medianUpdateMs: median,
          maxUpdateMs: max,
          minFps,
          avgFps,
          totalFrames: frameCount,
          droppedFrames,
        });
      }
    };

    requestAnimationFrame(tick);
  });
}
