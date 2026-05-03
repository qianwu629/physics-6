import { Vector3 } from 'three';

interface ContactForceEntry {
  force: Vector3;
  timestamp: number;
}

export const contactForceMap = new Map<string, ContactForceEntry>();

export function setContactForce(entityId: string, force: Vector3) {
  contactForceMap.set(entityId, {
    force: force.clone(),
    timestamp: performance.now(),
  });
}

const MAX_AGE_MS = 500;

export function getRecentContactForce(entityId: string): Vector3 | null {
  const entry = contactForceMap.get(entityId);
  if (!entry) return null;
  if (performance.now() - entry.timestamp > MAX_AGE_MS) {
    contactForceMap.delete(entityId);
    return null;
  }
  return entry.force;
}
