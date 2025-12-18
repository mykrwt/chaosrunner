import type { Vec3 } from "./vec3";
import { v3, v3Add, v3Dot, v3Len, v3Normalize, v3Scale, v3Sub } from "./vec3";

export type InterpolationMode = "linear" | "smoothstep" | "smootherstep" | "cosine" | "cubic";

export function interpolate(a: number, b: number, t: number, mode: InterpolationMode = "linear"): number {
  t = Math.max(0, Math.min(1, t));

  switch (mode) {
    case "linear":
      return a + (b - a) * t;
    
    case "smoothstep":
      t = t * t * (3 - 2 * t);
      return a + (b - a) * t;
    
    case "smootherstep":
      t = t * t * t * (t * (t * 6 - 15) + 10);
      return a + (b - a) * t;
    
    case "cosine":
      t = (1 - Math.cos(t * Math.PI)) * 0.5;
      return a + (b - a) * t;
    
    case "cubic": {
      const t2 = t * t;
      const t3 = t2 * t;
      return a + (b - a) * (3 * t2 - 2 * t3);
    }
    
    default:
      return a + (b - a) * t;
  }
}

export function interpolateVec3(a: Vec3, b: Vec3, t: number, mode: InterpolationMode = "linear"): Vec3 {
  return v3(
    interpolate(a.x, b.x, t, mode),
    interpolate(a.y, b.y, t, mode),
    interpolate(a.z, b.z, t, mode)
  );
}

export function hermiteInterpolate(p0: number, p1: number, t0: number, t1: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  
  return h00 * p0 + h10 * t0 + h01 * p1 + h11 * t1;
}

export function hermiteInterpolateVec3(p0: Vec3, p1: Vec3, t0: Vec3, t1: Vec3, t: number): Vec3 {
  return v3(
    hermiteInterpolate(p0.x, p1.x, t0.x, t1.x, t),
    hermiteInterpolate(p0.y, p1.y, t0.y, t1.y, t),
    hermiteInterpolate(p0.z, p1.z, t0.z, t1.z, t)
  );
}

export function bezierQuadratic(p0: number, p1: number, p2: number, t: number): number {
  const mt = 1 - t;
  return mt * mt * p0 + 2 * mt * t * p1 + t * t * p2;
}

export function bezierCubic(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  
  return mt2 * mt * p0 + 3 * mt2 * t * p1 + 3 * mt * t2 * p2 + t2 * t * p3;
}

export function bezierCubicVec3(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  return v3(
    bezierCubic(p0.x, p1.x, p2.x, p3.x, t),
    bezierCubic(p0.y, p1.y, p2.y, p3.y, t),
    bezierCubic(p0.z, p1.z, p2.z, p3.z, t)
  );
}

export function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  
  return 0.5 * (
    2 * p1 +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

export function catmullRomVec3(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  return v3(
    catmullRom(p0.x, p1.x, p2.x, p3.x, t),
    catmullRom(p0.y, p1.y, p2.y, p3.y, t),
    catmullRom(p0.z, p1.z, p2.z, p3.z, t)
  );
}

export function slerp(a: Vec3, b: Vec3, t: number): Vec3 {
  const na = v3Normalize(a);
  const nb = v3Normalize(b);
  
  let dot = v3Dot(na, nb);
  dot = Math.max(-1, Math.min(1, dot));
  
  const theta = Math.acos(dot) * t;
  
  const relative = v3Normalize(v3Sub(nb, v3Scale(na, dot)));
  
  return v3Add(
    v3Scale(na, Math.cos(theta)),
    v3Scale(relative, Math.sin(theta))
  );
}

export class SpringDamper {
  private position: number;
  private velocity: number;
  private stiffness: number;
  private damping: number;

  constructor(initialPosition: number, stiffness: number = 100, damping: number = 10) {
    this.position = initialPosition;
    this.velocity = 0;
    this.stiffness = stiffness;
    this.damping = damping;
  }

  public update(target: number, dt: number): number {
    const error = target - this.position;
    const force = error * this.stiffness - this.velocity * this.damping;
    
    this.velocity += force * dt;
    this.position += this.velocity * dt;
    
    return this.position;
  }

  public setPosition(position: number): void {
    this.position = position;
    this.velocity = 0;
  }

  public getPosition(): number {
    return this.position;
  }

  public getVelocity(): number {
    return this.velocity;
  }
}

export class SpringDamperVec3 {
  private position: Vec3;
  private velocity: Vec3;
  private stiffness: number;
  private damping: number;

  constructor(initialPosition: Vec3, stiffness: number = 100, damping: number = 10) {
    this.position = { ...initialPosition };
    this.velocity = v3(0, 0, 0);
    this.stiffness = stiffness;
    this.damping = damping;
  }

  public update(target: Vec3, dt: number): Vec3 {
    const error = v3Sub(target, this.position);
    const dampingForce = v3Scale(this.velocity, this.damping);
    const force = v3Sub(v3Scale(error, this.stiffness), dampingForce);
    
    this.velocity = v3Add(this.velocity, v3Scale(force, dt));
    this.position = v3Add(this.position, v3Scale(this.velocity, dt));
    
    return { ...this.position };
  }

  public setPosition(position: Vec3): void {
    this.position = { ...position };
    this.velocity = v3(0, 0, 0);
  }

  public getPosition(): Vec3 {
    return { ...this.position };
  }

  public getVelocity(): Vec3 {
    return { ...this.velocity };
  }
}

export function exponentialDecay(current: number, target: number, lambda: number, dt: number): number {
  return target + (current - target) * Math.exp(-lambda * dt);
}

export function exponentialDecayVec3(current: Vec3, target: Vec3, lambda: number, dt: number): Vec3 {
  const factor = Math.exp(-lambda * dt);
  return v3(
    target.x + (current.x - target.x) * factor,
    target.y + (current.y - target.y) * factor,
    target.z + (current.z - target.z) * factor
  );
}

export function easeInQuad(t: number): number {
  return t * t;
}

export function easeOutQuad(t: number): number {
  return t * (2 - t);
}

export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

export function easeInCubic(t: number): number {
  return t * t * t;
}

export function easeOutCubic(t: number): number {
  const t1 = t - 1;
  return t1 * t1 * t1 + 1;
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
}

export function easeInQuart(t: number): number {
  return t * t * t * t;
}

export function easeOutQuart(t: number): number {
  const t1 = t - 1;
  return 1 - t1 * t1 * t1 * t1;
}

export function easeInOutQuart(t: number): number {
  const t1 = t - 1;
  return t < 0.5 ? 8 * t * t * t * t : 1 - 8 * t1 * t1 * t1 * t1;
}

export function easeInExpo(t: number): number {
  return t === 0 ? 0 : Math.pow(2, 10 * (t - 1));
}

export function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function easeInOutExpo(t: number): number {
  if (t === 0) return 0;
  if (t === 1) return 1;
  if (t < 0.5) return Math.pow(2, 20 * t - 10) * 0.5;
  return (2 - Math.pow(2, -20 * t + 10)) * 0.5;
}

export function clampAngle(angle: number, min: number, max: number): number {
  while (angle < -Math.PI) angle += Math.PI * 2;
  while (angle > Math.PI) angle -= Math.PI * 2;
  return Math.max(min, Math.min(max, angle));
}

export function shortestAngleDifference(from: number, to: number): number {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

export function interpolateAngle(from: number, to: number, t: number): number {
  const diff = shortestAngleDifference(from, to);
  return from + diff * t;
}
