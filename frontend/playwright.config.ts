import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright 视觉回归配置（Ticket 5）
 *
 * - headless Chromium 走 SwiftShader 软渲染 WebGL，R3F/bloom 可截图
 * - webServer 自动起 vite dev（5199 固定端口）
 * - 基线截图：e2e/__screenshots__/，更新命令 npm run test:e2e:update
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5199',
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
  },
  expect: {
    toHaveScreenshot: {
      // 抗星空漂移 / SwiftShader 渲染噪声
      maxDiffPixelRatio: 0.02,
    },
  },
  projects: [
    {
      name: 'chromium',
      // 使用系统 Chrome（本机无外网下载渠道时的兜底；基线截图同样本机生成）
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
  webServer: {
    command: 'npx vite --port 5199 --strictPort',
    url: 'http://localhost:5199',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
