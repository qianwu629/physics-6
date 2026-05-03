import { describe, it, expect, beforeEach } from 'vitest';
import { Vector3 } from 'three';
import { TrajectoryBuffer } from '../TrajectoryBuffer';

describe('TrajectoryBuffer', () => {
  let buffer: TrajectoryBuffer;
  const T0 = 100; // base timestamp in seconds

  beforeEach(() => {
    buffer = new TrajectoryBuffer();
  });

  it('starts with count 0', () => {
    expect(buffer.getCount()).toBe(0);
  });

  it('push adds a point and increments count', () => {
    buffer.push(new Vector3(1, 2, 3), T0);
    expect(buffer.getCount()).toBe(1);
  });

  it('getPoints returns points in insertion order (oldest first)', () => {
    buffer.push(new Vector3(1, 0, 0), T0);
    buffer.push(new Vector3(2, 0, 0), T0 + 0.1);
    buffer.push(new Vector3(3, 0, 0), T0 + 0.2);

    const { positions, count } = buffer.getPoints(T0 + 1);
    expect(count).toBe(3);
    expect(positions[0].x).toBe(1);
    expect(positions[1].x).toBe(2);
    expect(positions[2].x).toBe(3);
  });

  it('getPoints excludes points older than 5 seconds', () => {
    buffer.push(new Vector3(1, 0, 0), T0);       // old
    buffer.push(new Vector3(2, 0, 0), T0 + 3);   // still valid
    buffer.push(new Vector3(3, 0, 0), T0 + 4.9); // still valid

    // Query at T0 + 6: first point is 6s old, should be cut
    const { positions, count } = buffer.getPoints(T0 + 6);
    expect(count).toBe(2);
    expect(positions[0].x).toBe(2);
    expect(positions[1].x).toBe(3);
  });

  it('getPoints returns empty when all points are too old', () => {
    buffer.push(new Vector3(1, 0, 0), T0);
    buffer.push(new Vector3(2, 0, 0), T0 + 0.1);

    const { positions, count } = buffer.getPoints(T0 + 10);
    expect(count).toBe(0);
    expect(positions.length).toBe(0);
  });

  it('wraps around after 300 points (ring buffer behavior)', () => {
    // Fill buffer to capacity
    for (let i = 0; i < 300; i++) {
      buffer.push(new Vector3(i, 0, 0), T0 + i * 0.01);
    }
    expect(buffer.getCount()).toBe(300);

    // Push one more — should overwrite oldest
    buffer.push(new Vector3(999, 0, 0), T0 + 300 * 0.01);
    expect(buffer.getCount()).toBe(300);

    // The oldest point (x=0) should be gone, x=1 is now oldest
    const { positions, count } = buffer.getPoints(T0 + 300 * 0.01 + 1);
    expect(count).toBe(300);
    expect(positions[0].x).toBe(1);  // x=0 was overwritten
    expect(positions[298].x).toBe(299);
    expect(positions[299].x).toBe(999); // newest
  });

  it('clear resets count and head to 0', () => {
    buffer.push(new Vector3(1, 2, 3), T0);
    buffer.push(new Vector3(4, 5, 6), T0 + 1);
    expect(buffer.getCount()).toBe(2);

    buffer.clear();
    expect(buffer.getCount()).toBe(0);

    // After clear, can push again from start
    buffer.push(new Vector3(7, 8, 9), T0 + 2);
    const { positions, count } = buffer.getPoints(T0 + 3);
    expect(count).toBe(1);
    expect(positions[0].x).toBe(7);
  });

  it('handles mixed age points with wrap-around', () => {
    // Fill buffer and wrap several times
    for (let i = 0; i < 350; i++) {
      buffer.push(new Vector3(i, 0, 0), T0 + i * 0.01);
    }
    expect(buffer.getCount()).toBe(300); // capped at 300

    // Oldest in buffer should be x=50 (indices 0-49 overwritten)
    const { positions, count } = buffer.getPoints(T0 + 350 * 0.01 + 1);
    expect(count).toBe(300);
    expect(positions[0].x).toBe(50);
  });

  it('preserves Y and Z coordinates', () => {
    buffer.push(new Vector3(10, 20, 30), T0);
    const { positions } = buffer.getPoints(T0 + 1);
    expect(positions[0].x).toBe(10);
    expect(positions[0].y).toBe(20);
    expect(positions[0].z).toBe(30);
  });
});
