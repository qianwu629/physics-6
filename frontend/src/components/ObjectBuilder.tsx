/**
 * ObjectBuilder — 物体建造器（W8：取代旧 CreationDialog）
 *
 * 三栏布局：
 * - 左栏：预设模型（球体/方块/圆柱/导线）+ 自定义凸形入口 + 自定义轮廓库（localStorage）
 * - 中栏：大 3D 预览（OrbitControls；预设直接渲染，自定义为 SketchBoard + 可点击 3D 预览）
 * - 右栏：尺寸/物理/初速度/位置/颜色 + 面摩擦与固定
 *
 * 面摩擦编辑：预览中点击某个面 → pickFace 定位逻辑面 → 右栏高亮并编辑该面 μ/固定。
 * 新实体默认挂 faces 配置（全部面 = 统一摩擦值），摩擦升级默认体现。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { Circle, Square, Database, Cable, Pentagon, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { useSimulationStore } from '../store';
import { computeHullPoints, getShapeFaces, type FaceDefinition } from '../ecs/faceGeometry';
import { pickFace } from '../ecs/pickFace';
import type { ProfilePoint } from '../ecs/profileGeometry';
import type { ColliderShape, ColliderParams } from '../ecs/types';
import { listProfiles, deleteProfile, type ProfileLibraryEntry } from '../store/profileLibrary';
import {
  deriveColliderShape,
  isStateValid,
  buildEntityFromState,
  type BuilderState,
  type PresetKind,
} from './objectFactory';
import { NumField, Vec3Field } from './builderFields';
import SketchBoard from './SketchBoard';

// ── 类型（BuilderState/PresetKind/derive/isValid 已移至 objectFactory 共享）──

const DEFAULT_STATE: BuilderState = {
  source: 'custom',
  radius: 1,
  halfWidth: 1,
  halfHeight: 1,
  halfDepth: 1,
  mass: 1,
  restitution: 0.5,
  friction: 0.3,
  charge: 0,
  currentMagnitude: 10,
  position: [0, 5, 0],
  velocity: [0, 0, 0],
  color: '#f4a261',
  profile: [],
  formMode: 'extrude',
  thickness: 1,
};

const PRESETS: { kind: PresetKind; label: string; Icon: typeof Circle }[] = [
  { kind: 'sphere', label: '球体', Icon: Circle },
  { kind: 'box', label: '方块', Icon: Square },
  { kind: 'cylinder', label: '圆柱', Icon: Database },
  { kind: 'wire', label: '导线', Icon: Cable },
];

const COLOR_PRESETS = ['#f4a261', '#2a9d8f', '#457b9d', '#9b5de5', '#e9c46a', '#e76f51', '#fafafa'];

// ── 预览 mesh（含面拾取） ──

interface PreviewMeshProps {
  state: BuilderState;
  shape: ColliderShape;
  params: ColliderParams;
  onPickFace: (faceId: string) => void;
}

function BuilderPreviewMesh({ state, shape, params, onPickFace }: PreviewMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const customGeometry = useMemo(() => {
    if (shape !== 'convexProfile') return null;
    if (!isStateValid(state).valid) return null;
    const raw = computeHullPoints('convexProfile', params);
    const vecs: THREE.Vector3[] = [];
    for (let i = 0; i < raw.length; i += 3) {
      vecs.push(new THREE.Vector3(raw[i], raw[i + 1], raw[i + 2]));
    }
    return new ConvexGeometry(vecs);
  }, [shape, params, state]);

  useEffect(() => {
    return () => customGeometry?.dispose();
  }, [customGeometry]);

  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.4;
  });

  const handlePointerDown = useCallback(
    (e: any) => {
      e.stopPropagation();
      if (!e.face) return;
      const n = e.face.normal;
      const faceId = pickFace(shape, params, [0, 0, 0], [n.x, n.y, n.z]);
      if (faceId) onPickFace(faceId);
    },
    [shape, params, onPickFace],
  );

  const material = (
    <meshStandardMaterial color={state.color} roughness={0.55} metalness={0.15} side={THREE.DoubleSide} />
  );

  if (shape === 'convexProfile') {
    if (!customGeometry) return null;
    return (
      <mesh ref={meshRef} geometry={customGeometry} onPointerDown={handlePointerDown}>
        {material}
      </mesh>
    );
  }

  return (
    <mesh ref={meshRef} onPointerDown={handlePointerDown}>
      {shape === 'sphere' && <sphereGeometry args={[state.radius, 32, 32]} />}
      {shape === 'cuboid' && <boxGeometry args={[state.halfWidth * 2, state.halfHeight * 2, state.halfDepth * 2]} />}
      {shape === 'cylinder' && <cylinderGeometry args={[state.radius, state.radius, state.halfHeight * 2, 32]} />}
      {material}
    </mesh>
  );
}

// ── 主组件 ──

export default function ObjectBuilder() {
  const open = useSimulationStore((s) => s.objectBuilderOpen);
  const closeBuilder = useSimulationStore((s) => s.closeObjectBuilder);
  const addEntity = useSimulationStore((s) => s.addEntity);
  const startPlacement = useSimulationStore((s) => s.startPlacement);

  const [state, setState] = useState<BuilderState>(DEFAULT_STATE);
  const [library, setLibrary] = useState<ProfileLibraryEntry[]>([]);
  const [faceOverrides, setFaceOverrides] = useState<Record<string, { friction: number; pinned: boolean }>>({});
  const [selectedFaceId, setSelectedFaceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const patch = useCallback(<K extends keyof BuilderState>(key: K, value: BuilderState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
  }, []);

  // 打开时重置并载入轮廓库；若存在虚影放置快照（Esc 取消回流），从中还原
  useEffect(() => {
    if (open) {
      const snap = useSimulationStore.getState().placement;
      if (snap) {
        setState(snap.state);
        setFaceOverrides(snap.faceOverrides);
        useSimulationStore.getState().cancelPlacement();
      } else {
        setState(DEFAULT_STATE);
        setFaceOverrides({});
      }
      setLibrary(listProfiles());
      setSelectedFaceId(null);
      setError(null);
    }
  }, [open]);

  const { shape, params } = useMemo(() => deriveColliderShape(state), [state]);
  const faceList: FaceDefinition[] = useMemo(() => getShapeFaces(shape, params), [shape, params]);
  const validity = useMemo(() => isStateValid(state), [state]);

  const handlePickFace = useCallback((faceId: string) => {
    setSelectedFaceId(faceId);
  }, []);

  const handleFaceChange = useCallback((faceId: string, patchFace: Partial<{ friction: number; pinned: boolean }>) => {
    setFaceOverrides((s) => ({
      ...s,
      [faceId]: { friction: s[faceId]?.friction ?? 0.3, pinned: s[faceId]?.pinned ?? false, ...patchFace },
    }));
  }, []);

  const handleUseLibraryEntry = useCallback((entry: ProfileLibraryEntry) => {
    setState((s) => ({
      ...s,
      source: 'custom',
      profile: entry.profile.map((p) => [...p] as ProfilePoint),
      formMode: entry.mode,
      thickness: entry.thickness,
    }));
  }, []);

  const handleDeleteLibraryEntry = useCallback((id: string) => {
    deleteProfile(id);
    setLibrary(listProfiles());
  }, []);

  const handleConfirm = useCallback(() => {
    if (!validity.valid) return;
    const entity = buildEntityFromState(state, faceOverrides, state.position);
    const success = addEntity(entity);
    if (!success) {
      setError('场景已达到最大实体数量 (50 个)');
      return;
    }
    closeBuilder();
  }, [state, validity, faceOverrides, addEntity, closeBuilder]);

  // F3: 虚影放置——关闭对话框，主场景中鼠标吸附放置（Esc 取消可回流还原）
  const handleStartPlacement = useCallback(() => {
    if (!validity.valid) return;
    startPlacement({ state, faceOverrides });
  }, [validity, state, faceOverrides, startPlacement]);

  const isCustom = state.source === 'custom';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeBuilder()}>
      <DialogContent
        className="sm:max-w-[960px] max-h-[88vh] overflow-hidden"
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid var(--glass-border)',
          borderRadius: '16px',
          boxShadow: '0 8px 40px rgba(0, 0, 0, 0.6)',
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-[var(--foreground)] text-lg">创建物体</DialogTitle>
          <DialogDescription className="text-[var(--muted-foreground)] text-xs">
            选择预设或绘制自定义凸形；在 3D 预览中点击某个面可编辑该面摩擦/固定
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3" style={{ height: '62vh' }}>
          {/* ── 左栏：预设 + 轮廓库 ── */}
          <div className="w-44 shrink-0 space-y-2 overflow-y-auto pr-1">
            <div className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">预设模型</div>
            <div className="grid grid-cols-2 gap-1.5">
              {PRESETS.map(({ kind, label, Icon }) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => patch('source', kind)}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-all"
                  style={{
                    borderColor: state.source === kind ? 'var(--holo)' : 'var(--glass-border)',
                    backgroundColor: state.source === kind ? 'var(--holo-a15)' : 'transparent',
                    color: state.source === kind ? 'var(--holo)' : 'var(--muted-foreground)',
                  }}
                >
                  <Icon size={18} />
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => patch('source', 'custom')}
              className="w-full flex items-center justify-center gap-1.5 p-2 rounded-lg border text-xs transition-all"
              style={{
                borderColor: isCustom ? 'var(--holo)' : 'var(--glass-border)',
                backgroundColor: isCustom ? 'var(--holo-a15)' : 'transparent',
                color: isCustom ? 'var(--holo)' : 'var(--muted-foreground)',
              }}
            >
              <Pentagon size={16} />
              自定义凸形
            </button>

            <div className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider pt-2">
              自定义轮廓库
            </div>
            {library.length === 0 && (
              <p className="text-[10px] text-[var(--text-dim)]">创建过的自定义轮廓会自动保存在这里</p>
            )}
            <div className="space-y-1">
              {library.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-1 px-1.5 py-1 rounded border border-[var(--glass-border)] text-xs"
                >
                  <button
                    type="button"
                    className="flex-1 text-left truncate hover:text-[var(--holo)] transition-colors"
                    style={{ color: 'var(--foreground)' }}
                    title={`${entry.mode === 'revolve' ? '车削' : '挤出'} · ${entry.profile.length} 顶点`}
                    onClick={() => handleUseLibraryEntry(entry)}
                  >
                    {entry.name}
                  </button>
                  <button
                    type="button"
                    aria-label="删除轮廓"
                    className="text-[var(--text-dim)] hover:text-[var(--destructive)] transition-colors"
                    onClick={() => handleDeleteLibraryEntry(entry.id)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* ── 中栏：3D 预览 / 草图 ── */}
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            {isCustom && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {(['extrude', 'revolve'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => patch('formMode', m)}
                      className="px-2 py-1 rounded-lg text-xs transition-all border"
                      style={{
                        borderColor: state.formMode === m ? 'var(--holo)' : 'var(--glass-border)',
                        backgroundColor: state.formMode === m ? 'var(--holo-a15)' : 'transparent',
                        color: state.formMode === m ? 'var(--holo)' : 'var(--muted-foreground)',
                      }}
                    >
                      {m === 'extrude' ? '挤出（棱柱）' : '车削（回转体）'}
                    </button>
                  ))}
                </div>
                <div className="flex-1 min-h-0">
                  <SketchBoard value={state.profile} onChange={(p) => patch('profile', p)} mode={state.formMode} />
                </div>
              </>
            )}
            <div
              className="relative rounded-lg overflow-hidden shrink-0"
              style={{
                height: isCustom ? 200 : '100%',
                border: '1px solid var(--glass-border)',
                background: 'rgba(5, 5, 17, 0.6)',
              }}
            >
              <Canvas camera={{ position: [4.5, 3.5, 4.5], fov: 42 }}>
                <ambientLight intensity={0.7} />
                <directionalLight position={[4, 6, 4]} intensity={1.2} />
                <BuilderPreviewMesh state={state} shape={shape} params={params} onPickFace={handlePickFace} />
                <OrbitControls makeDefault enablePan={false} />
              </Canvas>
              {selectedFaceId && (
                <div
                  className="absolute top-2 left-2 px-2 py-0.5 rounded text-xs"
                  style={{ background: 'var(--glass-bg)', color: 'var(--holo)', border: '1px solid var(--holo-a30)' }}
                >
                  当前面：{faceList.find((f) => f.id === selectedFaceId)?.label ?? selectedFaceId}
                </div>
              )}
              {!validity.valid && (
                <div
                  className="absolute inset-0 flex items-center justify-center text-xs"
                  style={{ color: 'var(--text-dim)' }}
                >
                  {validity.reason}
                </div>
              )}
            </div>
          </div>

          {/* ── 右栏：参数 + 面摩擦 ── */}
          <div className="w-56 shrink-0 space-y-2.5 overflow-y-auto pr-1">
            <div className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">尺寸</div>
            {(state.source === 'sphere' || state.source === 'cylinder' || state.source === 'wire') && (
              <NumField label="半径" value={state.radius} onChange={(v) => patch('radius', v)} min={0.1} max={5} unit="m" />
            )}
            {state.source === 'box' && (
              <>
                <NumField label="半尺寸 X" value={state.halfWidth} onChange={(v) => patch('halfWidth', v)} min={0.1} max={5} unit="m" />
                <NumField label="半尺寸 Y" value={state.halfHeight} onChange={(v) => patch('halfHeight', v)} min={0.1} max={5} unit="m" />
                <NumField label="半尺寸 Z" value={state.halfDepth} onChange={(v) => patch('halfDepth', v)} min={0.1} max={5} unit="m" />
              </>
            )}
            {(state.source === 'cylinder' || state.source === 'wire') && (
              <NumField label="半高" value={state.halfHeight} onChange={(v) => patch('halfHeight', v)} min={0.1} max={5} unit="m" />
            )}
            {isCustom && state.formMode === 'extrude' && (
              <NumField label="挤出厚度" value={state.thickness} onChange={(v) => patch('thickness', v)} min={0.1} max={5} unit="m" />
            )}
            {state.source === 'wire' && (
              <NumField label="电流" value={state.currentMagnitude} onChange={(v) => patch('currentMagnitude', v)} min={-100} max={100} step={0.5} unit="A" />
            )}

            <div className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider pt-1">物理参数</div>
            {state.source !== 'wire' && (
              <>
                <NumField label="质量" value={state.mass} onChange={(v) => patch('mass', v)} min={0.1} max={100} unit="kg" />
                <NumField label="弹性系数" value={state.restitution} onChange={(v) => patch('restitution', v)} min={0} max={1} step={0.01} />
                <NumField label="统一摩擦" value={state.friction} onChange={(v) => patch('friction', v)} min={0} max={2} step={0.05} />
                <NumField label="电荷量" value={state.charge} onChange={(v) => patch('charge', v)} min={-10} max={10} unit="C" />
              </>
            )}

            {state.source !== 'wire' && faceList.length > 0 && (
              <>
                <div className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider pt-1">
                  面摩擦与固定
                </div>
                <div className="space-y-1">
                  {faceList.map((def) => {
                    const v = faceOverrides[def.id] ?? { friction: state.friction, pinned: false };
                    const selected = selectedFaceId === def.id;
                    return (
                      <div
                        key={def.id}
                        className="flex items-center gap-1.5 px-1 py-0.5 rounded cursor-pointer transition-colors"
                        style={{
                          background: selected ? 'var(--holo-a15)' : 'transparent',
                          border: `1px solid ${selected ? 'var(--holo-a30)' : 'transparent'}`,
                        }}
                        onClick={() => setSelectedFaceId(def.id)}
                      >
                        <span className="text-[11px] w-12 shrink-0" style={{ color: selected ? 'var(--holo)' : 'var(--muted-foreground)' }}>
                          {def.label}
                        </span>
                        <Slider
                          value={[v.friction]}
                          min={0}
                          max={2}
                          step={0.05}
                          className="flex-1"
                          onValueChange={([x]) => handleFaceChange(def.id, { friction: x })}
                        />
                        <span className="text-[10px] font-mono w-7 text-right" style={{ color: 'var(--text-dim)' }}>
                          {v.friction.toFixed(2)}
                        </span>
                        <label
                          className="flex items-center gap-0.5 text-[10px] shrink-0 cursor-pointer"
                          style={{ color: v.pinned ? 'var(--holo)' : 'var(--muted-foreground)' }}
                          title="固定面：接触点不发生相对滑动"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={v.pinned}
                            onChange={(e) => handleFaceChange(def.id, { pinned: e.target.checked })}
                          />
                          固定
                        </label>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {state.source !== 'wire' && (
              <>
                <Vec3Field label="初始速度 (m/s)" value={state.velocity} onChange={(v) => patch('velocity', v)} />
                <Vec3Field label="初始位置 (m)" value={state.position} onChange={(v) => patch('position', v)} />
              </>
            )}
            {state.source === 'wire' && (
              <Vec3Field label="位置 (m)" value={state.position} onChange={(v) => patch('position', v)} />
            )}

            <div className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider pt-1">颜色</div>
            <div className="flex flex-wrap gap-1.5">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`选择颜色 ${c}`}
                  onClick={() => patch('color', c)}
                  className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: state.color === c ? 'var(--foreground)' : 'transparent',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── 底部：错误 + 确认 ── */}
        <div className="flex items-center justify-between pt-3 border-t border-[var(--glass-border)]">
          <div className="text-xs" style={{ color: 'var(--destructive)' }}>
            {error ?? (!validity.valid ? validity.reason : '')}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={closeBuilder} className="text-[var(--muted-foreground)]">
              取消
            </Button>
            <Button
              type="button"
              disabled={!validity.valid}
              onClick={handleStartPlacement}
              title="关闭对话框，在场景中移动鼠标吸附表面放置（滚轮调高度，Esc 取消）"
              style={{
                backgroundColor: 'transparent',
                border: '1px solid var(--holo)',
                color: validity.valid ? 'var(--holo)' : 'var(--text-dim)',
              }}
            >
              虚影放置
            </Button>
            <Button
              type="button"
              disabled={!validity.valid}
              onClick={handleConfirm}
              style={{
                backgroundColor: validity.valid ? 'var(--holo)' : 'var(--text-dim)',
                color: 'var(--primary-foreground)',
              }}
            >
              确认添加
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
