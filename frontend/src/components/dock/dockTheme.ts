import type { DockviewTheme } from 'dockview-react';

/**
 * Sci-fi Lab dockview 主题对象（Ticket 2）
 * 变量覆盖见 ./dockTheme.css（.dockview-theme-scifi）
 */
export const themeScifi: DockviewTheme = {
  name: 'scifi',
  className: 'dockview-theme-scifi',
  colorScheme: 'dark',
  dndTabIndicator: 'line',
  dndOverlayBorder: '1px solid var(--holo)',
  tabAnimation: 'smooth',
};
