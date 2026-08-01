/**
 * 自定义轮廓库 — localStorage 持久化（W8 物体建造器）
 *
 * 创建过的自定义凸形轮廓可一键复用。存储键 physis.profile-library.v1。
 */

import type { ProfilePoint } from '../ecs/profileGeometry';

export interface ProfileLibraryEntry {
  id: string;
  name: string;
  profile: ProfilePoint[];
  mode: 'extrude' | 'revolve';
  thickness: number;
  savedAt: string;
}

const STORAGE_KEY = 'physis.profile-library.v1';
const MAX_ENTRIES = 50;

export function listProfiles(): ProfileLibraryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is ProfileLibraryEntry =>
        e && typeof e.id === 'string' && Array.isArray(e.profile) && (e.mode === 'extrude' || e.mode === 'revolve'),
    );
  } catch {
    return [];
  }
}

function persist(entries: ProfileLibraryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    // 配额满静默失败 — 不阻塞创建流程
  }
}

export function saveProfile(entry: Omit<ProfileLibraryEntry, 'id' | 'savedAt'>): ProfileLibraryEntry {
  const full: ProfileLibraryEntry = {
    ...entry,
    id: `profile-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    savedAt: new Date().toISOString(),
  };
  const entries = [full, ...listProfiles()];
  persist(entries);
  return full;
}

export function deleteProfile(id: string): void {
  persist(listProfiles().filter((e) => e.id !== id));
}

export function renameProfile(id: string, name: string): void {
  persist(listProfiles().map((e) => (e.id === id ? { ...e, name } : e)));
}
