import type { Vec3 } from "./vec3";
import { v3, v3Add, v3Cross, v3Dot, v3Len, v3Normalize, v3Scale, v3Sub } from "./vec3";

export type RigidBodyState = {
  position: Vec3;
  velocity: Vec3;
  acceleration: Vec3;
  mass: number;
  inverseMass: number;
  restitution: number;
  friction: number;
};

export type ContactConstraint = {
  bodyA: number;
  bodyB: number;
  contactPoint: Vec3;
  contactNormal: Vec3;
  penetration: number;
  friction: number;
  restitution: number;
};

export function applyImpulse(body: RigidBodyState, impulse: Vec3, contactPoint?: Vec3): void {
  body.velocity = v3Add(body.velocity, v3Scale(impulse, body.inverseMass));
}

export function applyForce(body: RigidBodyState, force: Vec3, dt: number): void {
  const acceleration = v3Scale(force, body.inverseMass);
  body.velocity = v3Add(body.velocity, v3Scale(acceleration, dt));
}

export function integrateVelocity(body: RigidBodyState, dt: number): void {
  body.position = v3Add(body.position, v3Scale(body.velocity, dt));
}

export function resolveCollision(
  bodyA: RigidBodyState,
  bodyB: RigidBodyState,
  normal: Vec3,
  penetration: number
): void {
  const relativeVelocity = v3Sub(bodyB.velocity, bodyA.velocity);
  const velocityAlongNormal = v3Dot(relativeVelocity, normal);

  if (velocityAlongNormal > 0) return;

  const restitution = Math.min(bodyA.restitution, bodyB.restitution);
  const impulseScalar = -(1 + restitution) * velocityAlongNormal;
  const totalInverseMass = bodyA.inverseMass + bodyB.inverseMass;

  if (totalInverseMass < 0.0001) return;

  const impulseMagnitude = impulseScalar / totalInverseMass;
  const impulse = v3Scale(normal, impulseMagnitude);

  bodyA.velocity = v3Sub(bodyA.velocity, v3Scale(impulse, bodyA.inverseMass));
  bodyB.velocity = v3Add(bodyB.velocity, v3Scale(impulse, bodyB.inverseMass));

  const correctionPercent = 0.8;
  const slop = 0.01;
  const correctionMagnitude = Math.max(penetration - slop, 0) * correctionPercent / totalInverseMass;
  const correction = v3Scale(normal, correctionMagnitude);

  bodyA.position = v3Sub(bodyA.position, v3Scale(correction, bodyA.inverseMass));
  bodyB.position = v3Add(bodyB.position, v3Scale(correction, bodyB.inverseMass));
}

export function applyFriction(
  bodyA: RigidBodyState,
  bodyB: RigidBodyState,
  normal: Vec3,
  impulseNormal: number
): void {
  const relativeVelocity = v3Sub(bodyB.velocity, bodyA.velocity);
  const tangent = v3Normalize(v3Sub(relativeVelocity, v3Scale(normal, v3Dot(relativeVelocity, normal))));

  if (v3Len(tangent) < 0.0001) return;

  const velocityAlongTangent = v3Dot(relativeVelocity, tangent);
  const friction = (bodyA.friction + bodyB.friction) * 0.5;

  let frictionImpulse = -velocityAlongTangent / (bodyA.inverseMass + bodyB.inverseMass);
  const maxFriction = Math.abs(impulseNormal * friction);

  frictionImpulse = Math.max(-maxFriction, Math.min(maxFriction, frictionImpulse));

  const frictionVector = v3Scale(tangent, frictionImpulse);

  bodyA.velocity = v3Sub(bodyA.velocity, v3Scale(frictionVector, bodyA.inverseMass));
  bodyB.velocity = v3Add(bodyB.velocity, v3Scale(frictionVector, bodyB.inverseMass));
}

export function calculateKineticEnergy(body: RigidBodyState): number {
  const speedSquared = v3Dot(body.velocity, body.velocity);
  return 0.5 * body.mass * speedSquared;
}

export function calculateMomentum(body: RigidBodyState): Vec3 {
  return v3Scale(body.velocity, body.mass);
}

export function applyGravity(body: RigidBodyState, gravity: Vec3, dt: number): void {
  const force = v3Scale(gravity, body.mass);
  applyForce(body, force, dt);
}

export function applyDrag(body: RigidBodyState, dragCoefficient: number, dt: number): void {
  const speed = v3Len(body.velocity);
  if (speed < 0.001) return;

  const dragMagnitude = dragCoefficient * speed * speed;
  const dragDirection = v3Scale(v3Normalize(body.velocity), -1);
  const dragForce = v3Scale(dragDirection, dragMagnitude);

  applyForce(body, dragForce, dt);
}

export function clampVelocity(body: RigidBodyState, maxSpeed: number): void {
  const speed = v3Len(body.velocity);
  if (speed > maxSpeed) {
    body.velocity = v3Scale(v3Normalize(body.velocity), maxSpeed);
  }
}

export function dampVelocity(body: RigidBodyState, damping: number, dt: number): void {
  const dampingFactor = Math.pow(damping, dt);
  body.velocity = v3Scale(body.velocity, dampingFactor);
}

export function projectVelocityOnPlane(velocity: Vec3, planeNormal: Vec3): Vec3 {
  const dot = v3Dot(velocity, planeNormal);
  return v3Sub(velocity, v3Scale(planeNormal, dot));
}

export function reflectVelocity(velocity: Vec3, normal: Vec3, restitution: number = 1): Vec3 {
  const dot = v3Dot(velocity, normal);
  const reflection = v3Sub(velocity, v3Scale(normal, 2 * dot));
  return v3Scale(reflection, restitution);
}

export function calculateSpringForce(
  position: Vec3,
  targetPosition: Vec3,
  velocity: Vec3,
  stiffness: number,
  damping: number
): Vec3 {
  const displacement = v3Sub(targetPosition, position);
  const springForce = v3Scale(displacement, stiffness);
  const dampingForce = v3Scale(velocity, -damping);
  return v3Add(springForce, dampingForce);
}

export function verletIntegration(
  position: Vec3,
  previousPosition: Vec3,
  acceleration: Vec3,
  dt: number,
  damping: number = 1
): { newPosition: Vec3; newPreviousPosition: Vec3 } {
  const velocity = v3Scale(v3Sub(position, previousPosition), damping);
  const newPosition = v3Add(v3Add(position, velocity), v3Scale(acceleration, dt * dt));
  
  return {
    newPosition,
    newPreviousPosition: position,
  };
}

export function semiImplicitEuler(
  position: Vec3,
  velocity: Vec3,
  acceleration: Vec3,
  dt: number
): { newPosition: Vec3; newVelocity: Vec3 } {
  const newVelocity = v3Add(velocity, v3Scale(acceleration, dt));
  const newPosition = v3Add(position, v3Scale(newVelocity, dt));
  
  return { newPosition, newVelocity };
}

export function rungeKutta4(
  position: Vec3,
  velocity: Vec3,
  accelerationFn: (p: Vec3, v: Vec3, t: number) => Vec3,
  t: number,
  dt: number
): { newPosition: Vec3; newVelocity: Vec3 } {
  const k1v = accelerationFn(position, velocity, t);
  const k1p = velocity;

  const k2v = accelerationFn(
    v3Add(position, v3Scale(k1p, dt * 0.5)),
    v3Add(velocity, v3Scale(k1v, dt * 0.5)),
    t + dt * 0.5
  );
  const k2p = v3Add(velocity, v3Scale(k1v, dt * 0.5));

  const k3v = accelerationFn(
    v3Add(position, v3Scale(k2p, dt * 0.5)),
    v3Add(velocity, v3Scale(k2v, dt * 0.5)),
    t + dt * 0.5
  );
  const k3p = v3Add(velocity, v3Scale(k2v, dt * 0.5));

  const k4v = accelerationFn(
    v3Add(position, v3Scale(k3p, dt)),
    v3Add(velocity, v3Scale(k3v, dt)),
    t + dt
  );
  const k4p = v3Add(velocity, v3Scale(k3v, dt));

  const newVelocity = v3Add(
    velocity,
    v3Scale(
      v3Add(v3Add(k1v, v3Scale(k2v, 2)), v3Add(v3Scale(k3v, 2), k4v)),
      dt / 6
    )
  );

  const newPosition = v3Add(
    position,
    v3Scale(
      v3Add(v3Add(k1p, v3Scale(k2p, 2)), v3Add(v3Scale(k3p, 2), k4p)),
      dt / 6
    )
  );

  return { newPosition, newVelocity };
}

export function calculateCentripetalAcceleration(velocity: Vec3, radius: number, center: Vec3, position: Vec3): Vec3 {
  const speed = v3Len(velocity);
  const speedSquared = speed * speed;
  
  if (radius < 0.001) return v3(0, 0, 0);

  const direction = v3Normalize(v3Sub(center, position));
  return v3Scale(direction, speedSquared / radius);
}

export function calculateCoriolisForce(velocity: Vec3, angularVelocity: Vec3, mass: number): Vec3 {
  const crossProduct = v3Cross(angularVelocity, velocity);
  return v3Scale(crossProduct, -2 * mass);
}

export function calculateTorque(force: Vec3, leverArm: Vec3): Vec3 {
  return v3Cross(leverArm, force);
}

export function calculateAngularVelocityChange(torque: Vec3, momentOfInertia: Vec3, dt: number): Vec3 {
  return v3(
    (torque.x / momentOfInertia.x) * dt,
    (torque.y / momentOfInertia.y) * dt,
    (torque.z / momentOfInertia.z) * dt
  );
}

export function stabilizeNumericalError(value: number, threshold: number = 0.0001): number {
  return Math.abs(value) < threshold ? 0 : value;
}

export function stabilizeVec3(vec: Vec3, threshold: number = 0.0001): Vec3 {
  return v3(
    stabilizeNumericalError(vec.x, threshold),
    stabilizeNumericalError(vec.y, threshold),
    stabilizeNumericalError(vec.z, threshold)
  );
}

export function calculateTerminalVelocity(mass: number, dragCoefficient: number, gravity: number): number {
  return Math.sqrt((2 * mass * gravity) / dragCoefficient);
}

export function calculateEscapeVelocity(mass: number, radius: number, gravitationalConstant: number = 6.67430e-11): number {
  return Math.sqrt((2 * gravitationalConstant * mass) / radius);
}

export function projectileMotion(
  initialPosition: Vec3,
  initialVelocity: Vec3,
  gravity: number,
  time: number
): { position: Vec3; velocity: Vec3 } {
  const position = v3(
    initialPosition.x + initialVelocity.x * time,
    initialPosition.y + initialVelocity.y * time - 0.5 * gravity * time * time,
    initialPosition.z + initialVelocity.z * time
  );

  const velocity = v3(
    initialVelocity.x,
    initialVelocity.y - gravity * time,
    initialVelocity.z
  );

  return { position, velocity };
}

export function calculateTrajectoryApex(initialVelocity: Vec3, gravity: number): { time: number; height: number } {
  const time = initialVelocity.y / gravity;
  const height = (initialVelocity.y * initialVelocity.y) / (2 * gravity);
  
  return { time, height };
}

export function calculateLaunchAngleForTarget(
  startPos: Vec3,
  targetPos: Vec3,
  launchSpeed: number,
  gravity: number
): number | null {
  const dx = Math.sqrt((targetPos.x - startPos.x) ** 2 + (targetPos.z - startPos.z) ** 2);
  const dy = targetPos.y - startPos.y;
  
  const g = gravity;
  const v = launchSpeed;
  
  const discriminant = v ** 4 - g * (g * dx * dx + 2 * dy * v * v);
  
  if (discriminant < 0) return null;
  
  const angle1 = Math.atan((v * v + Math.sqrt(discriminant)) / (g * dx));
  const angle2 = Math.atan((v * v - Math.sqrt(discriminant)) / (g * dx));
  
  return angle1;
}
