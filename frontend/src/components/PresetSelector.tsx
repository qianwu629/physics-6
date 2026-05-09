import React from 'react';
import { Target, Triangle, Layers, Waves, GitBranch } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { deserializeScene } from '@/utils/sceneSerializer';
import { loadSceneWithConfirm } from '@/components/SceneLoader';

interface PresetSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PresetDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
}

const PRESET_DEFINITIONS: PresetDefinition[] = [
  {
    id: 'projectile',
    title: '抛体运动',
    description: '球体以初速度斜向上发射，观察抛物线轨迹',
    icon: 'Target',
    color: '#3b82f6',
  },
  {
    id: 'inclined-plane',
    title: '斜面滑块',
    description: '盒块从 30° 斜面顶端滑下，观察重力分量与摩擦',
    icon: 'Triangle',
    color: '#f97316',
  },
  {
    id: 'free-fall-stack',
    title: '自由落体堆叠',
    description: '5 个不同颜色球从不同高度同时下落',
    icon: 'Layers',
    color: '#22c55e',
  },
  {
    id: 'spring-oscillator',
    title: '弹簧振子',
    description: '质量块通过弹簧悬挂在天花板锚点上',
    icon: 'Waves',
    color: '#8b5cf6',
  },
  {
    id: 'double-spring',
    title: '双弹簧链',
    description: '3 个质量块 + 4 根弹簧串联，多自由度振动',
    icon: 'GitBranch',
    color: '#ef4444',
  },
];

const ALLOWED_PRESETS = new Set(PRESET_DEFINITIONS.map(p => p.id));

const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  projectile: Target,
  'inclined-plane': Triangle,
  'free-fall-stack': Layers,
  'spring-oscillator': Waves,
  'double-spring': GitBranch,
};

/**
 * 将 hex 颜色转为 rgba 格式的 CSS 颜色字符串（15% 透明度用于图标背景）
 */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function PresetSelector({
  open,
  onOpenChange,
}: PresetSelectorProps) {
  const [loadingId, setLoadingId] = React.useState<string | null>(null);

  async function handlePresetClick(presetId: string) {
    if (!ALLOWED_PRESETS.has(presetId)) {
      console.error('Invalid preset ID:', presetId);
      return;
    }
    setLoadingId(presetId);
    try {
      // 动态导入 JSON 预设文件
      const presetModule = await import(`../presets/${presetId}.json`);
      const presetData = presetModule.default || presetModule;

      // 反序列化
      const result = deserializeScene(presetData);
      if (!result.success || !result.data) {
        alert(`预设加载失败: ${result.errors.join(', ')}`);
        return;
      }

      // 关闭选择器
      onOpenChange(false);

      // 通过确认 + 加载流程
      const loaded = await loadSceneWithConfirm(result.data);
      if (loaded) {
        // 加载成功 — SceneLoader 内部处理 toast/warnings
      }
    } catch (err) {
      console.error(`预设文件 "${presetId}" 加载失败`, err);
      alert(`预设文件 "${presetId}" 加载失败，请稍后重试。`);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>预设场景库</DialogTitle>
          <DialogDescription>
            选择一个预设场景一键加载（共 5 个）
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-4">
          {PRESET_DEFINITIONS.map((preset) => {
            const IconComponent = ICON_MAP[preset.id];
            const isLoading = loadingId === preset.id;
            const iconBgColor = hexToRgba(preset.color, 0.15);

            return (
              <div
                key={preset.id}
                onClick={() => !isLoading && handlePresetClick(preset.id)}
                role="button"
                tabIndex={0}
                aria-label={`加载预设场景: ${preset.title}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (!isLoading) handlePresetClick(preset.id);
                  }
                }}
                className={[
                  'bg-[rgba(255,255,255,0.04)]',
                  'border border-[rgba(255,255,255,0.06)]',
                  'rounded-lg',
                  'p-4',
                  'cursor-pointer',
                  'hover:bg-[rgba(59,130,246,0.08)]',
                  'hover:border-[rgba(59,130,246,0.3)]',
                  'transition-all duration-200',
                  isLoading ? 'opacity-50 pointer-events-none' : '',
                ].join(' ')}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                  style={{ backgroundColor: iconBgColor }}
                >
                  {IconComponent && (
                    <IconComponent size={20} style={{ color: preset.color }} />
                  )}
                </div>
                <div className="text-sm font-medium text-[#e0e0e0]">
                  {preset.title}
                </div>
                <div className="text-xs text-[#a0a0a0] mt-1 line-clamp-2">
                  {preset.description}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
