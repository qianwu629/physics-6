import { describe, it, expect, afterEach } from 'vitest';
import { ChartDataBuffer, MAX_POINTS, METRICS_PER_ENTITY, chartBuffers, getOrCreateBuffer, clearAllBuffers } from '../chartBuffer';

describe('ChartDataBuffer', () => {
  afterEach(() => {
    clearAllBuffers();
  });

  describe('initial state', () => {
    it('has count === 0 after creation', () => {
      const buf = new ChartDataBuffer();
      expect(buf.getCount()).toBe(0);
    });
  });

  describe('basic push', () => {
    it('push once => count === 1', () => {
      const buf = new ChartDataBuffer();
      const metrics = new Float64Array(METRICS_PER_ENTITY);
      metrics[0] = 1.0; // x
      buf.push(1.0, metrics);
      expect(buf.getCount()).toBe(1);
    });

    it('getSeriesData returns correct data after one push', () => {
      const buf = new ChartDataBuffer();
      const metrics = new Float64Array(METRICS_PER_ENTITY);
      metrics[0] = 3.14;
      metrics[1] = 2.71;
      buf.push(1.0, metrics);

      const xData = buf.getSeriesData(0, 0, 2);
      expect(xData).toHaveLength(1);
      expect(xData[0].time).toBe(1.0);
      expect(xData[0].value).toBe(3.14);

      const yData = buf.getSeriesData(1, 0, 2);
      expect(yData[0].value).toBe(2.71);
    });
  });

  describe('MAX_POINTS limit', () => {
    it('does not exceed MAX_POINTS after many pushes', () => {
      const buf = new ChartDataBuffer();
      const metrics = new Float64Array(METRICS_PER_ENTITY);
      for (let i = 0; i < MAX_POINTS + 1; i++) {
        metrics[0] = i;
        buf.push(i * 0.1, metrics);
      }
      expect(buf.getCount()).toBe(MAX_POINTS);
    });

    it('overwrites oldest data after MAX_POINTS', () => {
      const buf = new ChartDataBuffer();
      const metrics = new Float64Array(METRICS_PER_ENTITY);

      // Fill buffer
      for (let i = 0; i < MAX_POINTS; i++) {
        metrics[0] = i;
        buf.push(i, metrics);
      }

      // Push one more — should overwrite index 0
      metrics[0] = 999999;
      buf.push(MAX_POINTS, metrics);

      // Oldest data should now be at index 1 (value = 1)
      const allData = buf.getAllSeriesData(0);
      expect(allData[0].value).toBe(1);
      expect(allData[MAX_POINTS - 1].value).toBe(999999);
    });
  });

  describe('clear', () => {
    it('resets count to 0', () => {
      const buf = new ChartDataBuffer();
      const metrics = new Float64Array(METRICS_PER_ENTITY);
      buf.push(1.0, metrics);
      buf.push(2.0, metrics);
      expect(buf.getCount()).toBe(2);

      buf.clear();
      expect(buf.getCount()).toBe(0);
    });

    it('allows push from index 0 after clear', () => {
      const buf = new ChartDataBuffer();
      const metrics = new Float64Array(METRICS_PER_ENTITY);

      buf.push(1.0, metrics);
      buf.clear();

      metrics[0] = 42;
      buf.push(3.0, metrics);
      const data = buf.getAllSeriesData(0);
      expect(data).toHaveLength(1);
      expect(data[0].value).toBe(42);
    });
  });

  describe('time window filtering', () => {
    it('getSeriesData returns only data within time range', () => {
      const buf = new ChartDataBuffer();
      const metrics = new Float64Array(METRICS_PER_ENTITY);

      for (let i = 0; i < 10; i++) {
        metrics[0] = i;
        buf.push(i, metrics);
      }

      const filtered = buf.getSeriesData(0, 3, 6);
      expect(filtered).toHaveLength(4); // 3,4,5,6
      expect(filtered[0].time).toBe(3);
      expect(filtered[3].time).toBe(6);
    });

    it('getSeriesData does not modify underlying buffer', () => {
      const buf = new ChartDataBuffer();
      const metrics = new Float64Array(METRICS_PER_ENTITY);
      metrics[0] = 100;
      buf.push(1.0, metrics);

      const before = buf.getCount();
      buf.getSeriesData(0, 0, 2);
      expect(buf.getCount()).toBe(before);

      const allData = buf.getAllSeriesData(0);
      expect(allData[0].value).toBe(100);
    });
  });

  describe('15 metrics per entity', () => {
    it('stores and retrieves all 15 metrics correctly', () => {
      const buf = new ChartDataBuffer();
      const metrics = new Float64Array(METRICS_PER_ENTITY);
      for (let i = 0; i < METRICS_PER_ENTITY; i++) {
        metrics[i] = i * 1.1;
      }
      buf.push(1.0, metrics);

      for (let i = 0; i < METRICS_PER_ENTITY; i++) {
        const data = buf.getSeriesData(i, 0, 2);
        expect(data).toHaveLength(1);
        expect(data[0].value).toBeCloseTo(i * 1.1, 5);
      }
    });

    it('throws on wrong metrics length', () => {
      const buf = new ChartDataBuffer();
      const badMetrics = new Float64Array(5);
      expect(() => buf.push(1.0, badMetrics)).toThrow('metrics length must be 15');
    });
  });

  describe('time unit', () => {
    it('expects writer to consistently use seconds since some monotonic origin (currently Date.now()/1000); buffer makes no assumption about the origin', () => {
      const buf = new ChartDataBuffer();
      const metrics = new Float64Array(METRICS_PER_ENTITY);
      buf.push(12.345, metrics);

      const data = buf.getAllSeriesData(0);
      expect(data[0].time).toBe(12.345);
    });
  });

  describe('module-level helpers', () => {
    it('getOrCreateBuffer creates new buffer for new entity', () => {
      const buf = getOrCreateBuffer('entity-1');
      expect(buf).toBeInstanceOf(ChartDataBuffer);
      expect(buf.getCount()).toBe(0);
    });

    it('getOrCreateBuffer returns same buffer for same entity', () => {
      const buf1 = getOrCreateBuffer('entity-2');
      const buf2 = getOrCreateBuffer('entity-2');
      expect(buf1).toBe(buf2);
    });

    it('clearAllBuffers clears all tracked buffers', () => {
      const buf1 = getOrCreateBuffer('e1');
      const buf2 = getOrCreateBuffer('e2');
      const metrics = new Float64Array(METRICS_PER_ENTITY);
      buf1.push(1.0, metrics);
      buf2.push(2.0, metrics);

      clearAllBuffers();
      expect(buf1.getCount()).toBe(0);
      expect(buf2.getCount()).toBe(0);
      expect(chartBuffers.size).toBe(0);
    });
  });

  describe('wrap-around ordering', () => {
    it('returns data in chronological order after wrap-around', () => {
      const buf = new ChartDataBuffer();
      const metrics = new Float64Array(METRICS_PER_ENTITY);
      const fillCount = 100;

      for (let i = 0; i < fillCount; i++) {
        metrics[0] = i;
        buf.push(i, metrics);
      }

      const allData = buf.getAllSeriesData(0);
      expect(allData).toHaveLength(fillCount);
      for (let i = 0; i < fillCount; i++) {
        expect(allData[i].time).toBe(i);
        expect(allData[i].value).toBe(i);
      }
    });
  });
});
