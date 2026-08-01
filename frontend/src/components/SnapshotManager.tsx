import React, { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Save, Download, Pencil, Trash2, Clock, Box } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useSnapshotStore, type Snapshot } from '@/store/snapshotSlice';
import { useSimulationStore } from '@/store/index';

// ── Constants ──

const NAME_REGEX = /^[\w\s\-\.一-鿿]{1,30}$/;

// ── Props ──

interface SnapshotManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoadSnapshot?: (snapshot: Snapshot) => void;
}

// ── Name Validation Helpers ──

interface ValidationResult {
  valid: boolean;
  error?: string;
}

function validateName(name: string, existingNames: string[], excludeSlot?: number): ValidationResult {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: '名称不能为空' };
  }
  if (!NAME_REGEX.test(trimmed)) {
    return { valid: false, error: '名称仅支持中英文、数字、空格和 - _ . （1-30字）' };
  }
  // 检查重名（排除 excludeSlot 指定的槽位）
  const isDup = existingNames.some((n, i) => n !== null && n === trimmed && i !== excludeSlot);
  if (isDup) {
    return { valid: false, error: '名称已被使用' };
  }
  return { valid: true };
}

// ── Component ──

export function SnapshotManager({ open, onOpenChange, onLoadSnapshot }: SnapshotManagerProps) {
  const slots = useSnapshotStore((s) => s.slots);
  const saveSnapshot = useSnapshotStore((s) => s.saveSnapshot);
  const loadSnapshot = useSnapshotStore((s) => s.loadSnapshot);
  const renameSnapshot = useSnapshotStore((s) => s.renameSnapshot);
  const deleteSnapshot = useSnapshotStore((s) => s.deleteSnapshot);

  const [saveName, setSaveName] = useState('');
  const [saveError, setSaveError] = useState('');
  const [targetSlot, setTargetSlot] = useState<number | null>(null);

  // Overwrite confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    slotIndex: number;
    existingName: string;
  } | null>(null);

  // Delete confirmation dialog
  const [deleteDialog, setDeleteDialog] = useState<{
    slotIndex: number;
    slotName: string;
  } | null>(null);

  // Inline rename state
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // ── Collect existing slot names for validation ──
  const existingNames = slots.map((s) => (s ? s.name : null));

  // ── Save Handler ──
  const handleSave = useCallback(() => {
    setSaveError('');

    const result = validateName(saveName, existingNames.filter(Boolean) as string[]);
    if (!result.valid) {
      setSaveError(result.error!);
      return;
    }

    // Choose target slot: first empty, or ask for overwrite
    const emptyIndex = slots.findIndex((s) => s === null);
    if (emptyIndex !== -1) {
      const slotToUse = targetSlot ?? emptyIndex;
      // Check if slotToUse has existing data that would be overwritten
      if (slots[slotToUse] !== null) {
        setConfirmDialog({
          slotIndex: slotToUse,
          existingName: slots[slotToUse]!.name,
        });
        return;
      }
      doSave(slotToUse);
    } else {
      // All slots full — must specify a target slot to overwrite
      if (targetSlot === null) {
        setSaveError('所有槽位已满，请点击一个槽位进行覆盖');
        return;
      }
      const slotToUse = targetSlot;
      if (slots[slotToUse] !== null) {
        setConfirmDialog({
          slotIndex: slotToUse,
          existingName: slots[slotToUse]!.name,
        });
        return;
      }
      doSave(slotToUse);
    }
  }, [saveName, slots, targetSlot, existingNames]);

  const doSave = useCallback(
    (slotIndex: number) => {
      const store = useSimulationStore.getState();
      const result = saveSnapshot(slotIndex, saveName.trim(), store);

      if (result.success) {
        toast.success('快照已保存');
        setSaveName('');
        setSaveError('');
        setTargetSlot(null);
      } else if (result.error?.includes('存储空间不足')) {
        toast.error('存储空间不足，请删除旧快照后重试');
      } else {
        setSaveError(result.error ?? '保存失败');
      }
      setConfirmDialog(null);
    },
    [saveName, saveSnapshot, setSaveName, setSaveError, setTargetSlot]
  );

  // ── Load Handler ──
  const handleLoad = useCallback(
    (slotIndex: number) => {
      const snap = loadSnapshot(slotIndex);
      if (snap && onLoadSnapshot) {
        onLoadSnapshot(snap);
      }
    },
    [loadSnapshot, onLoadSnapshot]
  );

  // ── Rename Handlers ──
  const startRename = useCallback(
    (slotIndex: number) => {
      const slot = slots[slotIndex];
      if (!slot) return;
      setEditingSlot(slotIndex);
      setRenameValue(slot.name);
      setRenameError('');
      setTimeout(() => renameInputRef.current?.focus(), 0);
    },
    [slots]
  );

  const commitRename = useCallback(() => {
    if (editingSlot === null) return;

    const trimmed = renameValue.trim();
    const result = validateName(trimmed, existingNames.filter(Boolean) as string[], editingSlot);

    if (!result.valid) {
      setRenameError(result.error!);
      return;
    }

    const renameResult = renameSnapshot(editingSlot, trimmed);
    if (renameResult.success) {
      setEditingSlot(null);
      setRenameValue('');
      setRenameError('');
    } else {
      setRenameError(renameResult.error ?? '重命名失败');
    }
  }, [editingSlot, renameValue, renameSnapshot, existingNames]);

  const cancelRename = useCallback(() => {
    setEditingSlot(null);
    setRenameValue('');
    setRenameError('');
  }, []);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        commitRename();
      } else if (e.key === 'Escape') {
        cancelRename();
      }
    },
    [commitRename, cancelRename]
  );

  // ── Delete Handlers ──
  const confirmDelete = useCallback(
    (slotIndex: number) => {
      const slot = slots[slotIndex];
      if (!slot) return;
      setDeleteDialog({ slotIndex, slotName: slot.name });
    },
    [slots]
  );

  const handleDelete = useCallback(() => {
    if (deleteDialog === null) return;
    deleteSnapshot(deleteDialog.slotIndex);
    toast.success('快照已删除');
    setDeleteDialog(null);

    // Cancel inline edit if deleting the slot being edited
    if (editingSlot === deleteDialog.slotIndex) {
      setEditingSlot(null);
      setRenameValue('');
      setRenameError('');
    }
  }, [deleteDialog, deleteSnapshot, editingSlot]);

  // ── Format Helpers ──
  const formatDate = (iso: string): string => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  // ── Render ──
  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[400px] sm:max-w-[400px] bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)]">
          <SheetHeader>
            <SheetTitle className="text-[var(--foreground)]">快照管理</SheetTitle>
            <SheetDescription className="text-[var(--muted-foreground)]">
              保存/加载/重命名/删除场景快照（5 个槽位）
            </SheetDescription>
          </SheetHeader>

          {/* ── Save Area ── */}
          <div className="px-4 py-3 space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="输入快照名称"
                value={saveName}
                onChange={(e) => {
                  setSaveName(e.target.value);
                  setSaveError('');
                }}
                className="flex-1 bg-[var(--glass-border)] border-[var(--glass-border)] text-[var(--foreground)] placeholder:text-[var(--text-dim)]"
              />
              <Button
                onClick={handleSave}
                variant="default"
                size="sm"
                className="shrink-0"
              >
                <Save className="size-3.5" />
                保存
              </Button>
            </div>
            {saveError && (
              <p className="text-red-400 text-xs pl-1">{saveError}</p>
            )}
          </div>

          {/* ── Slot List ── */}
          <ScrollArea className="flex-1 px-4">
            <div className="space-y-2 pb-4">
              {slots.map((slot, index) => (
                <SlotCard
                  key={index}
                  index={index}
                  slot={slot}
                  isEditing={editingSlot === index}
                  renameValue={editingSlot === index ? renameValue : ''}
                  renameError={editingSlot === index ? renameError : ''}
                  onSaveToSlot={() => {
                    setTargetSlot(index);
                    // Trigger save flow
                    if (saveName.trim()) {
                      setSaveError('');
                      const result = validateName(
                        saveName.trim(),
                        existingNames.filter(Boolean) as string[],
                        index
                      );
                      if (!result.valid) {
                        setSaveError(result.error!);
                        return;
                      }
                      if (slot !== null) {
                        setConfirmDialog({
                          slotIndex: index,
                          existingName: slot.name,
                        });
                      } else {
                        doSave(index);
                      }
                    }
                  }}
                  onLoad={() => handleLoad(index)}
                  onStartRename={() => startRename(index)}
                  onRenameValueChange={setRenameValue}
                  onCommitRename={commitRename}
                  onCancelRename={cancelRename}
                  onRenameKeyDown={handleRenameKeyDown}
                  renameInputRef={editingSlot === index ? renameInputRef : undefined}
                  onDelete={() => confirmDelete(index)}
                  formatDate={formatDate}
                />
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* ── Overwrite Confirmation Dialog ── */}
      <Dialog
        open={confirmDialog !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDialog(null);
        }}
      >
        <DialogContent className="bg-[var(--glass-bg)] border-[var(--glass-border)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--foreground)]">覆盖确认</DialogTitle>
            <DialogDescription className="text-[var(--muted-foreground)]">
              槽位 &apos;{confirmDialog ? confirmDialog.slotIndex + 1 : ''}&apos; 已有快照
              &apos;{confirmDialog?.existingName}&apos;，覆盖后将丢失原数据。继续？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmDialog !== null) {
                  doSave(confirmDialog.slotIndex);
                }
              }}
            >
              确认覆盖
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog
        open={deleteDialog !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteDialog(null);
        }}
      >
        <DialogContent className="bg-[var(--glass-bg)] border-[var(--glass-border)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--foreground)]">删除确认</DialogTitle>
            <DialogDescription className="text-[var(--muted-foreground)]">
              确定要删除快照 &quot;{deleteDialog?.slotName}&quot; 吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Slot Card Sub-Component ──

interface SlotCardProps {
  index: number;
  slot: Snapshot | null;
  isEditing: boolean;
  renameValue: string;
  renameError: string;
  onSaveToSlot: () => void;
  onLoad: () => void;
  onStartRename: () => void;
  onRenameValueChange: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onRenameKeyDown: (e: React.KeyboardEvent) => void;
  renameInputRef?: React.RefObject<HTMLInputElement | null>;
  onDelete: () => void;
  formatDate: (iso: string) => string;
}

function SlotCard({
  index,
  slot,
  isEditing,
  renameValue,
  renameError,
  onSaveToSlot,
  onLoad,
  onStartRename,
  onRenameValueChange,
  onCommitRename,
  onCancelRename,
  onRenameKeyDown,
  renameInputRef,
  onDelete,
  formatDate,
}: SlotCardProps) {
  // Empty slot
  if (!slot) {
    return (
      <div
        className={cn(
          'rounded-lg border border-[var(--glass-border)] p-3',
          'bg-[rgba(255,255,255,0.02)]'
        )}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--text-dim)]">
            槽位 {index + 1} — 空
          </span>
          <Button
            variant="ghost"
            size="xs"
            onClick={onSaveToSlot}
            className="text-[var(--muted-foreground)] hover:bg-[var(--holo-a15)] hover:text-[var(--holo)]"
          >
            <Save className="size-3" />
            保存到此处
          </Button>
        </div>
      </div>
    );
  }

  // Occupied slot
  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--glass-border)] p-3',
        'bg-[rgba(255,255,255,0.04)]'
      )}
    >
      {/* Top row: Name + actions */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-1">
              <Input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => {
                  onRenameValueChange(e.target.value);
                }}
                onKeyDown={onRenameKeyDown}
                onBlur={onCommitRename}
                className="h-7 text-sm bg-[var(--glass-border)] border-[var(--glass-border)] text-[var(--foreground)]"
                autoFocus
              />
              {renameError && (
                <p className="text-red-400 text-xs">{renameError}</p>
              )}
            </div>
          ) : (
            <span
              className="text-sm font-medium text-[var(--foreground)] block truncate cursor-pointer select-none"
              onDoubleClick={onStartRename}
              title="双击重命名"
            >
              {slot.name}
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onLoad}
            className="text-[var(--muted-foreground)] hover:bg-[var(--holo-a15)] hover:text-[var(--holo)]"
            title="加载"
          >
            <Download className="size-3.5" />
          </Button>
          {!isEditing && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onStartRename}
              className="text-[var(--muted-foreground)] hover:bg-[var(--holo-a15)] hover:text-[var(--holo)]"
              title="重命名"
            >
              <Pencil className="size-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onDelete}
            className="text-[var(--muted-foreground)] hover:bg-[rgba(239,68,68,0.15)] hover:text-[var(--destructive)]"
            title="删除"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Bottom row: Metadata */}
      <div className="flex items-center gap-3 mt-2 text-xs text-[var(--text-dim)]">
        <span className="flex items-center gap-1">
          <Clock className="size-3" />
          {formatDate(slot.createdAt)}
        </span>
        <span className="flex items-center gap-1">
          <Box className="size-3" />
          {slot.entityCount} 实体
        </span>
      </div>
    </div>
  );
}

export default SnapshotManager;
