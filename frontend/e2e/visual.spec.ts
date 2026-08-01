import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * Sci-fi Lab 视觉回归（Ticket 5 / SPEC Seam 2）
 *
 * 好测试 = 断言外部可见行为（截图一致、面板存在性），不断言实现细节。
 * 基线更新：npm run test:e2e:update
 */

/** 等工作区就绪：dock tab 渲染 + 稳帧 */
async function waitForWorkspace(page: Page) {
  await page.goto('/');
  await page.getByText('视口').first().waitFor({ state: 'visible' });
  await page.waitForTimeout(500);
}

/** FPS 计数器（动态文本，截图时遮挡） */
function fpsMask(page: Page): Locator[] {
  return [page.getByText(/\d+ FPS/)];
}

test.describe('Sci-fi Lab 视觉回归', () => {
  test('工作区默认布局全景', async ({ page }) => {
    await waitForWorkspace(page);

    await expect(page).toHaveScreenshot('workspace-default.png', {
      animations: 'disabled',
      mask: fpsMask(page),
      // 比全局阈值更严：token 级主题回归（如 --holo 改色）必须变红
      maxDiffPixelRatio: 0.005,
    });
  });

  test('3D 场景关键画面：星空 + 发光网格 + 全息实体', async ({ page }) => {
    await waitForWorkspace(page);

    // 快捷键 B 打开创建对话框并确认添加球体
    await page.keyboard.press('b');
    await page.getByRole('button', { name: '确认添加' }).click();
    await page.waitForTimeout(1000);

    // 只截视口面板区域（3D 场景，用 canvas 标记视口组）
    const viewport = page.locator('.dv-groupview').filter({ has: page.locator('canvas') }).first();
    await expect(viewport).toHaveScreenshot('scene-sphere.png', {
      animations: 'disabled',
      mask: fpsMask(page),
    });
  });

  test('创建对话框：玻璃拟态 + 全息青选中环', async ({ page }) => {
    await waitForWorkspace(page);

    await page.keyboard.press('b');
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible' });
    await page.waitForTimeout(300);

    await expect(dialog).toHaveScreenshot('creation-dialog.png', {
      animations: 'disabled',
    });
  });

  test('布局持久化：关闭实体列表 → 刷新后恢复', async ({ page }) => {
    await waitForWorkspace(page);

    // 关闭"实体列表"面板
    const entityListTab = page.locator('.dv-tab', { hasText: '实体列表' }).first();
    await entityListTab.hover();
    await entityListTab.locator('.dv-default-tab-action, button').first().click();
    await expect(page.locator('.dv-tab', { hasText: '实体列表' })).toHaveCount(0);

    // 等防抖 500ms 写入 localStorage
    await page.waitForTimeout(700);

    // 刷新后布局恢复：实体列表 tab 不存在，其余面板在
    await page.reload();
    await page.getByText('视口').first().waitFor({ state: 'visible' });
    await page.waitForTimeout(500);

    await expect(page.locator('.dv-tab', { hasText: '实体列表' })).toHaveCount(0);
    await expect(page.locator('.dv-tab', { hasText: '视口' }).first()).toBeVisible();
    await expect(page.locator('.dv-tab', { hasText: '实体属性' }).first()).toBeVisible();

    await expect(page).toHaveScreenshot('workspace-no-entitylist.png', {
      animations: 'disabled',
      mask: fpsMask(page),
    });
  });
});
