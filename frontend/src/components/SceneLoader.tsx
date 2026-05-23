/**
 * SceneLoader — 统一加载流程 + 导出/导入 handler + schema 警告 banner
 *
 * Plan 01-03 Task 1: 封装 D-01-03 加载流程（确认 → 暂停 → 清空轨迹 → 反序列化 → 摄像机自适应）。
 *
 * 导出函数（非 React 组件）:
 *   - exportSceneToFile(): 导出当前场景为 JSON 文件下载
 *   - importSceneFromFile(file): 从文件读取并校验场景 JSON
 *   - loadSceneWithConfirm(sceneData): 确认后执行的完整加载流程
 *   - showConfirmDialog(message): Promise-based 确认对话框
 *
 * React 组件:
 *   - SceneBanner: 顶部黄色警告 banner（schemaVersion 不匹配等）
 *   - ConfirmDialogRoot: 全局确认对话框（渲染在 App 层）
 *
 * Hook:
 *   - useSceneBanner(): 暴露 { warnings, addWarning, clearWarnings, dismissWarning }
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { TriangleAlert, X } from 'lucide-react';
import { useSimulationStore } from '../store';
import { useChartDataStore } from '../store/chartDataStore';
import { clearAllBuffers } from '../store/chartBuffer';
import { serializeScene, deserializeScene } from '../utils/sceneSerializer';
import type { Entity } from '../ecs/types';
import type { EnvironmentState } from '../utils/sceneValidation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';

// ── Types ──

export interface SceneImportResult {
  success: boolean;
  data?: { entities: Map<string, Entity>; environment: EnvironmentState };
  warnings: string[];
  errors: string[];
}

// ── Module-Level Banner State ──

let _warnings: string[] = [];
let _bannerListeners: Array<() => void> = [];

function notifyBannerListeners() {
  for (const listener of _bannerListeners) {
    listener();
  }
}

// ── Module-Level Confirm Dialog State ──

type ConfirmResolver = (confirmed: boolean) => void;
let _confirmResolver: ConfirmResolver | null = null;
let _confirmMessage: string = '';
let _confirmListeners: Array<() => void> = [];

function notifyConfirmListeners() {
  for (const listener of _confirmListeners) {
    listener();
  }
}

// ── Export: useSceneBanner Hook ──

export function useSceneBanner() {
  const [warnings, setWarnings] = useState<string[]>(_warnings);

  useEffect(() => {
    const listener = () => setWarnings([..._warnings]);
    _bannerListeners.push(listener);
    return () => {
      _bannerListeners = _bannerListeners.filter((l) => l !== listener);
    };
  }, []);

  const addWarning = useCallback((warning: string) => {
    _warnings = [..._warnings, warning];
    notifyBannerListeners();
  }, []);

  const clearWarnings = useCallback(() => {
    _warnings = [];
    notifyBannerListeners();
  }, []);

  const dismissWarning = useCallback((index: number) => {
    _warnings = _warnings.filter((_, i) => i !== index);
    notifyBannerListeners();
  }, []);

  return { warnings, addWarning, clearWarnings, dismissWarning };
}

// ── Export: SceneBanner Component ──

export function SceneBanner() {
  const { warnings, dismissWarning } = useSceneBanner();

  if (warnings.length === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-600/90 text-yellow-50 px-4 py-2 text-sm flex items-start gap-2">
      <TriangleAlert size={16} className="shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        {warnings.map((warning, i) => (
          <div key={i} className="flex items-center gap-2 py-0.5">
            <span className="truncate">{warning}</span>
            <button
              type="button"
              onClick={() => dismissWarning(i)}
              className="shrink-0 hover:text-white opacity-70 hover:opacity-100 transition-opacity"
              aria-label="关闭警告"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Export: ConfirmDialogRoot Component ──

export function ConfirmDialogRoot() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const listener = () => forceUpdate((n) => n + 1);
    _confirmListeners.push(listener);
    return () => {
      _confirmListeners = _confirmListeners.filter((l) => l !== listener);
    };
  }, []);

  const isOpen = _confirmResolver !== null;

  const handleConfirm = () => {
    if (_confirmResolver) {
      _confirmResolver(true);
      _confirmResolver = null;
      _confirmMessage = '';
      notifyConfirmListeners();
    }
  };

  const handleCancel = () => {
    if (_confirmResolver) {
      _confirmResolver(false);
      _confirmResolver = null;
      _confirmMessage = '';
      notifyConfirmListeners();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleCancel(); }}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>确认操作</DialogTitle>
          <DialogDescription>{_confirmMessage}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>取消</Button>
          <Button onClick={handleConfirm}>确认</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Export: showConfirmDialog ──

export function showConfirmDialog(message: string): Promise<boolean> {
  // If there's already a pending dialog, ignore the new request
  if (_confirmResolver) {
    return Promise.resolve(false);
  }

  return new Promise<boolean>((resolve) => {
    _confirmResolver = resolve;
    _confirmMessage = message;
    notifyConfirmListeners();
  });
}

// ── Export: exportSceneToFile ──

export function exportSceneToFile(): void {
  const state = useSimulationStore.getState();
  const sceneData = serializeScene({
    entities: state.entities,
    environment: state.environment,
  });

  const jsonString = JSON.stringify(sceneData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  // 文件名格式: physis-scene-{YYYY-MM-DDTHH-mm-ss-SSSZ}.json
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-');
  const filename = `physis-scene-${timestamp}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Export: importSceneFromFile ──

export function importSceneFromFile(file: File): Promise<SceneImportResult> {
  return new Promise((resolve) => {
    // D-01-08: 文件大小 > 5MB 拒绝
    if (file.size > 5 * 1024 * 1024) {
      resolve({
        success: false,
        warnings: [],
        errors: ['文件大小超过 5MB 限制，无法导入'],
      });
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const json = JSON.parse(text);
        const validated = deserializeScene(json);
        resolve(validated);
      } catch (err) {
        resolve({
          success: false,
          warnings: [],
          errors: [`JSON 解析错误: ${(err as Error).message}`],
        });
      }
    };

    reader.onerror = () => {
      resolve({
        success: false,
        warnings: [],
        errors: ['文件读取失败，请检查文件是否损坏'],
      });
    };

    reader.readAsText(file);
  });
}

// ── Export: loadSceneWithConfirm ──

export async function loadSceneWithConfirm(sceneData: {
  entities: Map<string, Entity>;
  environment: EnvironmentState;
}): Promise<boolean> {
  // 1. 确认对话框
  const confirmed = await showConfirmDialog('加载将替换当前场景，继续？');
  if (!confirmed) return false;

  // 2. 获取 store 引用
  const store = useSimulationStore.getState();

  // 3. 按 D-01-03 顺序执行:
  //    a. 强制暂停
  store.pause();

  //    b. 清空现有实体
  store.resetEntities();

  //    b'. C-06 fix: 加载场景前显式清空 chart 状态,
  //        防止旧 entity id 残留在 trackedEntityIds 与 chartBuffers 中
  //        (每个 buffer ~52 MB Float64Array)。
  useChartDataStore.setState({ trackedEntityIds: new Set() });
  clearAllBuffers();

  //    c. 递增 resetCounter（触发 Physics 重挂载 + 相机重置 + 轨迹清空）
  store.reset();

  //    d. 加载环境参数
  store.setGravity([...sceneData.environment.gravity]);
  store.setFrictionScale(sceneData.environment.frictionScale);
  store.setRestitutionScale(sceneData.environment.restitutionScale);
  store.setDrag(sceneData.environment.drag);
  store.setPeReferenceY(sceneData.environment.peReferenceY);

  //    e. 遍历 entities，先加载非约束实体，再加载约束
  const nonConstraints: Entity[] = [];
  const constraints: Entity[] = [];

  for (const [, entity] of sceneData.entities) {
    if (entity.components.has('constraint')) {
      constraints.push(entity);
    } else {
      nonConstraints.push(entity);
    }
  }

  // 先添加非约束实体
  const addedEntityIds = new Set<string>();
  let allAdded = true;
  for (const entity of nonConstraints) {
    const added = store.addEntity(entity);
    if (added) {
      addedEntityIds.add(entity.id);
    } else {
      allAdded = false;
    }
  }

  // 再添加约束实体，检查引用
  let skippedConstraints = 0;
  for (const entity of constraints) {
    const constraintComp = entity.components.get('constraint');
    if (!constraintComp || !('entityAId' in constraintComp) || !('entityBId' in constraintComp)) {
      skippedConstraints++;
      continue;
    }

    const { entityAId, entityBId } = constraintComp as { entityAId: string; entityBId: string };

    // D-01-08: 约束引用失效检查
    if (!addedEntityIds.has(entityAId) || !addedEntityIds.has(entityBId)) {
      skippedConstraints++;
      // 通过 banner 通知用户
      _warnings = [
        ..._warnings,
        `约束 '${entity.id}' 引用失效（目标实体不存在），已跳过`,
      ];
      notifyBannerListeners();
      continue;
    }

    const added = store.addEntity(entity);
    if (added) {
      addedEntityIds.add(entity.id);
    } else {
      allAdded = false;
    }
  }

  if (skippedConstraints > 0) {
    _warnings = [
      ..._warnings,
      `${skippedConstraints} 个约束已跳过`,
    ];
    notifyBannerListeners();
  }

  return allAdded;
}
