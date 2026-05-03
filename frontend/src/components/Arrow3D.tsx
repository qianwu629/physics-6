import { Vector3, Quaternion } from 'three';
import { Cone, Cylinder } from '@react-three/drei';

const DEFAULT_UP = new Vector3(0, 1, 0);

interface Arrow3DProps {
  origin: [number, number, number];
  direction: [number, number, number];
  length: number;
  color: string;
  headSize?: number;
  shaftRadius?: number;
  headRadius?: number;
}

export function Arrow3D({
  origin,
  direction,
  length,
  color,
  headSize = 0.25,
  shaftRadius = 0.015,
  headRadius = 0.045,
}: Arrow3DProps) {
  if (length < 0.001) return null;

  const dir = new Vector3(...direction).normalize();
  const quaternion = new Quaternion().setFromUnitVectors(DEFAULT_UP, dir);

  const shaftLength = length * (1 - headSize);
  const headLength = length * headSize;

  return (
    <group position={origin} quaternion={quaternion}>
      <Cylinder
        args={[shaftRadius, shaftRadius, shaftLength, 8]}
        position={[0, shaftLength / 2, 0]}
      >
        <meshBasicMaterial color={color} />
      </Cylinder>
      <Cone
        args={[headRadius, headLength, 8]}
        position={[0, shaftLength + headLength / 2, 0]}
      >
        <meshBasicMaterial color={color} />
      </Cone>
    </group>
  );
}
