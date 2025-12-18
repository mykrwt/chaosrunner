export type Vec3 = { x: number; y: number; z: number };

export function v3(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z };
}

export function v3Copy(a: Vec3): Vec3 {
  return { x: a.x, y: a.y, z: a.z };
}

export function v3Add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function v3Sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function v3Scale(a: Vec3, s: number): Vec3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

export function v3Dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function v3LenSq(a: Vec3): number {
  return v3Dot(a, a);
}

export function v3Len(a: Vec3): number {
  return Math.sqrt(v3LenSq(a));
}

export function v3Normalize(a: Vec3): Vec3 {
  const l = v3Len(a);
  if (l < 1e-8) return { x: 0, y: 0, z: 0 };
  return v3Scale(a, 1 / l);
}

export function v3Lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

export function v3ClampLen2D(a: Vec3, maxLen: number): Vec3 {
  const l = Math.sqrt(a.x * a.x + a.z * a.z);
  if (l <= maxLen) return a;
  const s = maxLen / l;
  return { x: a.x * s, y: a.y, z: a.z * s };
}
