/**
 * MenuBar — 顶部菜单栏 [文件 ▾] [视图 ▾] [帮助 ▾]
 *
 * Plan 01-03 Task 2: 桌面应用标准 UI 范式（D-01-04），为所有持久化操作提供用户入口。
 *
 * [文件 ▾]: 导出场景 / 导入场景 / 快照管理 / 预设场景库
 * [视图 ▾]: 显示调试线框 / 显示 FPS / 工具箱 / 属性面板 / 环境面板
 * [帮助 ▾]: 快捷键列表 / 关于 Physis
 *
 * 导入场景: 使用隐藏 <input type="file" accept=".json"> + FileReader
 * 导出场景: 调用 exportSceneToFile() from SceneLoader
 */

import { useRef, useState } from 'react';
import {
  FileDown,
  FileUp,
  Album,
  LayoutGrid,
  Bug,
  Monitor,
  Wrench,
  Settings,
  Wind,
  Keyboard,
  Info,
} from 'lucide-react';
import { useSimulationStore } from '../store';
import {
  exportSceneToFile,
  importSceneFromFile,
  loadSceneWithConfirm,
  useSceneBanner,
} from './SceneLoader';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from './ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';

// ── Props ──

export interface MenuBarProps {
  /** 打开快照 Drawer 回调 (Plan 02) */
  onOpenSnapshots?: () => void;
  /** 打开预设选择器回调 (Plan 04) */
  onOpenPresets?: () => void;
}

// ── MenuBar Component ──

export default function MenuBar({ onOpenSnapshots, onOpenPresets }: MenuBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addWarning } = useSceneBanner();

  // Dialog states
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);

  // Store bindings
  const showDebug = useSimulationStore((s) => s.showDebug);
  const setShowDebug = useSimulationStore((s) => s.setShowDebug);
  const toolboxCollapsed = useSimulationStore((s) => s.toolboxCollapsed);
  const toggleToolbox = useSimulationStore((s) => s.toggleToolbox);
  const propertyPanelCollapsed = useSimulationStore((s) => s.propertyPanelCollapsed);
  const togglePropertyPanel = useSimulationStore((s) => s.togglePropertyPanel);
  const environmentPanelOpen = useSimulationStore((s) => s.environmentPanelOpen);
  const toggleEnvironmentPanel = useSimulationStore((s) => s.toggleEnvironmentPanel);

  // ── Import Handler ──

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = await importSceneFromFile(file);

    // Reset input so the same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    if (!result.success || !result.data) {
      // D-01-08: Modal 显示错误
      setErrorMessages(result.errors.length > 0 ? result.errors : ['场景加载失败']);
      setErrorDialogOpen(true);

      // 如果有 warnings，也通过 banner 显示
      if (result.warnings.length > 0) {
        for (const w of result.warnings) {
          addWarning(w);
        }
      }
      return;
    }

    // 显示 warnings via banner
    if (result.warnings.length > 0) {
      for (const w of result.warnings) {
        addWarning(w);
      }
    }

    // 执行加载流程
    await loadSceneWithConfirm(result.data);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  // ── Export Handler ──

  const handleExport = () => {
    exportSceneToFile();
  };

  // ── Menu Button Style ──

  const menuButtonClass =
    'px-3 py-1 text-sm text-[#a0a0a0] hover:bg-[rgba(59,130,246,0.12)] hover:text-[#e0e0e0] rounded transition-colors duration-150 cursor-default select-none';

  const menuItemIconClass = 'size-3.5 text-[#888]';

  // ── Render ──

  return (
    <>
      {/* Hidden file input for import */}
      <input
        type="file"
        accept=".json"
        ref={fileInputRef}
        onChange={handleFileSelected}
        style={{ display: 'none' }}
      />

      {/* Menu Bar */}
      <div
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-9 px-2"
        style={{
          background: 'rgba(26, 26, 26, 0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        {/* Left: Menu items */}
        <div className="flex items-center gap-0.5">
          {/* ── [文件 ▾] ── */}
          <DropdownMenu>
            <DropdownMenuTrigger className={menuButtonClass}>
              文件 &#9662;
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[180px]">
              <DropdownMenuItem onClick={handleExport}>
                <FileDown className={menuItemIconClass} />
                <span>导出场景</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleImportClick}>
                <FileUp className={menuItemIconClass} />
                <span>导入场景</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onOpenSnapshots?.()}>
                <Album className={menuItemIconClass} />
                <span>快照管理...</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onOpenPresets?.()}>
                <LayoutGrid className={menuItemIconClass} />
                <span>预设场景库...</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* ── [视图 ▾] ── */}
          <DropdownMenu>
            <DropdownMenuTrigger className={menuButtonClass}>
              视图 &#9662;
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[200px]">
              <DropdownMenuCheckboxItem
                checked={showDebug}
                onCheckedChange={(checked) => setShowDebug(checked)}
              >
                <Bug className={menuItemIconClass} />
                <span>显示调试线框</span>
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={false}
                disabled
              >
                <Monitor className={menuItemIconClass} />
                <span>显示 FPS</span>
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={!toolboxCollapsed}
                onCheckedChange={() => toggleToolbox()}
              >
                <Wrench className={menuItemIconClass} />
                <span>工具箱</span>
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={!propertyPanelCollapsed}
                onCheckedChange={() => togglePropertyPanel()}
              >
                <Settings className={menuItemIconClass} />
                <span>属性面板</span>
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={environmentPanelOpen}
                onCheckedChange={() => toggleEnvironmentPanel()}
              >
                <Wind className={menuItemIconClass} />
                <span>环境面板</span>
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* ── [帮助 ▾] ── */}
          <DropdownMenu>
            <DropdownMenuTrigger className={menuButtonClass}>
              帮助 &#9662;
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[160px]">
              <DropdownMenuItem onClick={() => setShortcutsOpen(true)}>
                <Keyboard className={menuItemIconClass} />
                <span>快捷键列表...</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAboutOpen(true)}>
                <Info className={menuItemIconClass} />
                <span>关于 Physis</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Right: App name */}
        <span className="text-xs text-[#666] select-none pr-2">Physis</span>
      </div>

      {/* ── 快捷键帮助 Dialog ── */}
      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent showCloseButton={true}>
          <DialogHeader>
            <DialogTitle>快捷键列表</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground space-y-1.5 py-2">
            <div className="flex justify-between">
              <span>播放 / 暂停</span>
              <kbd className="px-1.5 py-0.5 text-xs rounded bg-muted">Space</kbd>
            </div>
            <div className="flex justify-between">
              <span>重置场景</span>
              <kbd className="px-1.5 py-0.5 text-xs rounded bg-muted">R</kbd>
            </div>
            <div className="flex justify-between">
              <span>创建球体 / 方块 / 圆柱 / 斜面</span>
              <kbd className="px-1.5 py-0.5 text-xs rounded bg-muted">B / N / C / S</kbd>
            </div>
            <div className="flex justify-between">
              <span>弹簧模式</span>
              <kbd className="px-1.5 py-0.5 text-xs rounded bg-muted">K</kbd>
            </div>
            <div className="flex justify-between">
              <span>删除选中实体</span>
              <kbd className="px-1.5 py-0.5 text-xs rounded bg-muted">Delete</kbd>
            </div>
            <div className="flex justify-between">
              <span>取消弹簧模式</span>
              <kbd className="px-1.5 py-0.5 text-xs rounded bg-muted">Escape</kbd>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── 关于 Dialog ── */}
      <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
        <DialogContent showCloseButton={true}>
          <DialogHeader>
            <DialogTitle>Physis v2.0</DialogTitle>
            <DialogDescription>交互物理沙盒模拟器</DialogDescription>
          </DialogHeader>
          <div className="text-sm text-muted-foreground space-y-2 py-2">
            <p>
              基于组件化自由组合架构，允许用户搭建任意物理模拟场景。
              支持刚体、弹簧约束、力场、轨迹追踪和实时物理量分析。
            </p>
            <p className="text-xs text-[#666]">
              技术栈：React + Three.js + Rapier 物理引擎
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── 导入错误 Dialog ── */}
      <Dialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
        <DialogContent showCloseButton={true}>
          <DialogHeader>
            <DialogTitle>导入失败</DialogTitle>
            <DialogDescription>场景文件加载时遇到以下错误：</DialogDescription>
          </DialogHeader>
          <div className="text-sm text-destructive space-y-1 py-2">
            {errorMessages.map((msg, i) => (
              <p key={i}>{msg}</p>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setErrorDialogOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
