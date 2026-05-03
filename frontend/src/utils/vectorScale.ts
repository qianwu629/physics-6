const MIN_LENGTH = 0.3;
const MAX_LENGTH = 4.0;
const SCALE_FACTOR = 10;

export function scaleForceToLength(magnitude: number): number {
  if (magnitude <= 0) return MIN_LENGTH;
  const logValue = Math.log10(1 + magnitude / SCALE_FACTOR);
  const maxLog = Math.log10(1 + 1000 / SCALE_FACTOR);
  const normalized = Math.min(logValue / maxLog, 1);
  return MIN_LENGTH + normalized * (MAX_LENGTH - MIN_LENGTH);
}

export function scaleVelocityToLength(speed: number): number {
  const MAX_SPEED = 50;
  const normalized = Math.min(speed / MAX_SPEED, 1);
  return MIN_LENGTH + normalized * (MAX_LENGTH - MIN_LENGTH);
}
