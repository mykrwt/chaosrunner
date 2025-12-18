import type { Vec3 } from "./vec3";
import { v3, v3Add, v3Copy, v3Cross, v3Dot, v3Len, v3Normalize, v3Scale, v3Sub } from "./vec3";
import type { TerrainSystem } from "./terrain";
import type { RoadSystem } from "./road";

export type VehicleConfig = {
  mass: number;
  inertia: number;
  wheelBase: number;
  trackWidth: number;
  centerOfMassHeight: number;
  dragCoefficient: number;
  rollingResistance: number;
  
  suspensionStiffness: number;
  suspensionDamping: number;
  suspensionTravel: number;
  suspensionRestLength: number;
  
  tireGripCoeff: number;
  tirePeakSlip: number;
  tireSlipFalloff: number;
  tireLoadSensitivity: number;
  
  enginePower: number;
  engineMaxRPM: number;
  brakeTorque: number;
  
  steerAngleMax: number;
  steerSpeed: number;
  steerReturnSpeed: number;
  
  antiRollStiffness: number;
};

export type WheelState = {
  position: Vec3;
  velocity: Vec3;
  compression: number;
  compressionVel: number;
  grounded: boolean;
  load: number;
  slipAngle: number;
  slipRatio: number;
  lateralForce: Vec3;
  longitudinalForce: Vec3;
};

export type VehicleState = {
  position: Vec3;
  velocity: Vec3;
  orientation: {
    forward: Vec3;
    right: Vec3;
    up: Vec3;
  };
  angularVelocity: Vec3;
  
  yaw: number;
  pitch: number;
  roll: number;
  
  steerAngle: number;
  throttle: number;
  brake: number;
  
  wheels: [WheelState, WheelState, WheelState, WheelState];
  
  grounded: boolean;
  speed: number;
  rpm: number;
};

export class VehiclePhysics {
  private config: VehicleConfig;
  private terrain: TerrainSystem | null;
  private road: RoadSystem | null;
  private state: VehicleState;
  private fixedTimeStep: number;
  private timeAccumulator: number;

  constructor(
    config: VehicleConfig,
    initialPosition: Vec3,
    initialYaw: number,
    terrain: TerrainSystem | null = null,
    road: RoadSystem | null = null
  ) {
    this.config = config;
    this.terrain = terrain;
    this.road = road;
    this.fixedTimeStep = 1 / 120;
    this.timeAccumulator = 0;

    const forward = {
      x: Math.cos(initialYaw),
      y: 0,
      z: Math.sin(initialYaw),
    };
    const up = { x: 0, y: 1, z: 0 };
    const right = v3Normalize(v3Cross(up, forward));

    this.state = {
      position: v3Copy(initialPosition),
      velocity: v3(0, 0, 0),
      orientation: {
        forward,
        right,
        up,
      },
      angularVelocity: v3(0, 0, 0),
      yaw: initialYaw,
      pitch: 0,
      roll: 0,
      steerAngle: 0,
      throttle: 0,
      brake: 0,
      wheels: [
        this.createWheelState(),
        this.createWheelState(),
        this.createWheelState(),
        this.createWheelState(),
      ],
      grounded: false,
      speed: 0,
      rpm: 0,
    };
  }

  public getState(): VehicleState {
    return this.state;
  }

  public update(dt: number, input: { throttle: number; steer: number; brake: number }): void {
    this.timeAccumulator += Math.min(dt, 0.1);

    while (this.timeAccumulator >= this.fixedTimeStep) {
      this.fixedUpdate(this.fixedTimeStep, input);
      this.timeAccumulator -= this.fixedTimeStep;
    }

    this.updateDerivedState();
  }

  private fixedUpdate(dt: number, input: { throttle: number; steer: number; brake: number }): void {
    this.updateInput(input, dt);
    this.updateWheels(dt);
    this.updateForces(dt);
    this.updateOrientation(dt);
    this.integrate(dt);
  }

  private updateInput(input: { throttle: number; steer: number; brake: number }, dt: number): void {
    this.state.throttle = this.clamp(input.throttle, -1, 1);
    this.state.brake = this.clamp(input.brake, 0, 1);

    const targetSteer = this.clamp(input.steer, -1, 1) * this.config.steerAngleMax;
    const steerDiff = targetSteer - this.state.steerAngle;
    
    const steerRate = Math.abs(steerDiff) > 0.01 
      ? this.config.steerSpeed 
      : this.config.steerReturnSpeed;
    
    const maxChange = steerRate * dt;
    this.state.steerAngle += this.clamp(steerDiff, -maxChange, maxChange);
  }

  private updateWheels(dt: number): void {
    const wheelPositions = this.getWheelPositions();

    for (let i = 0; i < 4; i++) {
      const wheel = this.state.wheels[i];
      const worldPos = wheelPositions[i];

      wheel.position = worldPos;

      const groundHeight = this.getGroundHeight(worldPos.x, worldPos.z);
      const rayStart = worldPos.y;
      const rayEnd = rayStart - this.config.suspensionRestLength - this.config.suspensionTravel;

      if (groundHeight > rayEnd && groundHeight < rayStart) {
        wheel.grounded = true;
        const compression = rayStart - groundHeight - this.config.suspensionRestLength;
        wheel.compressionVel = (compression - wheel.compression) / dt;
        wheel.compression = compression;
      } else {
        wheel.grounded = false;
        wheel.compression = 0;
        wheel.compressionVel = 0;
      }

      wheel.velocity = v3Add(
        this.state.velocity,
        v3Cross(this.state.angularVelocity, v3Sub(worldPos, this.state.position))
      );
    }

    this.state.grounded = this.state.wheels.some(w => w.grounded);
  }

  private updateForces(dt: number): void {
    const totalForce = v3(0, 0, 0);
    const totalTorque = v3(0, 0, 0);

    this.applyGravity(totalForce);
    this.applySuspensionForces(totalForce, totalTorque, dt);
    this.applyTireForces(totalForce, totalTorque, dt);
    this.applyDrag(totalForce, dt);
    this.applyAntiRoll(totalTorque, dt);

    const accel = v3Scale(totalForce, 1 / this.config.mass);
    this.state.velocity = v3Add(this.state.velocity, v3Scale(accel, dt));

    const angAccel = v3Scale(totalTorque, 1 / this.config.inertia);
    this.state.angularVelocity = v3Add(this.state.angularVelocity, v3Scale(angAccel, dt));

    const angDamping = Math.exp(-5.0 * dt);
    this.state.angularVelocity = v3Scale(this.state.angularVelocity, angDamping);
  }

  private applyGravity(force: Vec3): void {
    force.y -= this.config.mass * 28;
  }

  private applySuspensionForces(force: Vec3, torque: Vec3, dt: number): void {
    for (const wheel of this.state.wheels) {
      if (!wheel.grounded) continue;

      const springForce = wheel.compression * this.config.suspensionStiffness;
      const damperForce = wheel.compressionVel * this.config.suspensionDamping;
      const suspensionForce = springForce + damperForce;

      const forceVec = v3Scale(this.state.orientation.up, suspensionForce);
      force.x += forceVec.x;
      force.y += forceVec.y;
      force.z += forceVec.z;

      const r = v3Sub(wheel.position, this.state.position);
      const t = v3Cross(r, forceVec);
      torque.x += t.x;
      torque.y += t.y;
      torque.z += t.z;

      wheel.load = Math.max(0, suspensionForce);
    }
  }

  private applyTireForces(force: Vec3, torque: Vec3, dt: number): void {
    const frontLeft = this.state.wheels[0];
    const frontRight = this.state.wheels[1];
    const rearLeft = this.state.wheels[2];
    const rearRight = this.state.wheels[3];

    this.computeTireForce(frontLeft, true, dt);
    this.computeTireForce(frontRight, true, dt);
    this.computeTireForce(rearLeft, false, dt);
    this.computeTireForce(rearRight, false, dt);

    for (const wheel of this.state.wheels) {
      if (!wheel.grounded) continue;

      const totalTireForce = v3Add(wheel.lateralForce, wheel.longitudinalForce);
      
      force.x += totalTireForce.x;
      force.y += totalTireForce.y;
      force.z += totalTireForce.z;

      const r = v3Sub(wheel.position, this.state.position);
      const t = v3Cross(r, totalTireForce);
      torque.x += t.x;
      torque.y += t.y;
      torque.z += t.z;
    }
  }

  private computeTireForce(wheel: WheelState, isFront: boolean, dt: number): void {
    wheel.lateralForce = v3(0, 0, 0);
    wheel.longitudinalForce = v3(0, 0, 0);

    if (!wheel.grounded) return;

    const wheelDir = isFront
      ? this.rotateVector(this.state.orientation.forward, this.state.orientation.up, this.state.steerAngle)
      : this.state.orientation.forward;

    const wheelRight = v3Normalize(v3Cross(this.state.orientation.up, wheelDir));

    const velForward = v3Dot(wheel.velocity, wheelDir);
    const velLateral = v3Dot(wheel.velocity, wheelRight);

    wheel.slipAngle = Math.atan2(velLateral, Math.abs(velForward) + 0.1);

    const normalizedLoad = wheel.load / (this.config.mass * 28 / 4);
    const loadFactor = 1.0 - this.config.tireLoadSensitivity * (normalizedLoad - 1.0);

    const slipAngleDeg = Math.abs(wheel.slipAngle) * (180 / Math.PI);
    const lateralGrip = this.computeGripCurve(slipAngleDeg) * this.config.tireGripCoeff * loadFactor;

    const onRoad = this.road ? this.road.isOnRoad(wheel.position.x, wheel.position.z) : false;
    const surfaceGrip = onRoad ? 1.0 : 0.7;

    const lateralForce = -velLateral * lateralGrip * surfaceGrip * this.config.mass * 2;
    wheel.lateralForce = v3Scale(wheelRight, lateralForce);

    if (isFront || this.state.throttle === 0) {
      const brakeForce = this.state.brake * this.config.brakeTorque;
      const brakingForce = -Math.sign(velForward) * brakeForce;
      wheel.longitudinalForce = v3Scale(wheelDir, brakingForce);
    }

    if (!isFront && Math.abs(this.state.throttle) > 0) {
      const rpm = Math.abs(velForward) * 60 / (2 * Math.PI * 0.5);
      const rpmFactor = 1.0 - Math.min(1, rpm / this.config.engineMaxRPM);
      const driveForceMag = this.state.throttle * this.config.enginePower * rpmFactor * surfaceGrip;
      wheel.longitudinalForce = v3Add(wheel.longitudinalForce, v3Scale(wheelDir, driveForceMag));
    }
  }

  private computeGripCurve(slipAngleDeg: number): number {
    const peak = this.config.tirePeakSlip;
    
    if (slipAngleDeg < peak) {
      return slipAngleDeg / peak;
    } else {
      const excess = slipAngleDeg - peak;
      return Math.max(0, 1.0 - excess / this.config.tireSlipFalloff);
    }
  }

  private applyDrag(force: Vec3, dt: number): void {
    const speed = v3Len(this.state.velocity);
    const dragMag = this.config.dragCoefficient * speed * speed;
    
    if (speed > 0.01) {
      const dragDir = v3Scale(this.state.velocity, -1 / speed);
      const drag = v3Scale(dragDir, dragMag);
      force.x += drag.x;
      force.y += drag.y;
      force.z += drag.z;
    }

    if (this.state.grounded && speed > 0.01) {
      const rollingDrag = speed * this.config.rollingResistance * this.config.mass;
      const dragDir = v3Scale(this.state.velocity, -1 / speed);
      const rolling = v3Scale(dragDir, rollingDrag);
      force.x += rolling.x;
      force.y += rolling.y;
      force.z += rolling.z;
    }
  }

  private applyAntiRoll(torque: Vec3, dt: number): void {
    const leftCompression = (this.state.wheels[0].compression + this.state.wheels[2].compression) / 2;
    const rightCompression = (this.state.wheels[1].compression + this.state.wheels[3].compression) / 2;
    
    const compressionDiff = leftCompression - rightCompression;
    const antiRollTorque = compressionDiff * this.config.antiRollStiffness;
    
    const rollTorqueVec = v3Scale(this.state.orientation.forward, antiRollTorque);
    torque.x += rollTorqueVec.x;
    torque.y += rollTorqueVec.y;
    torque.z += rollTorqueVec.z;
  }

  private integrate(dt: number): void {
    this.state.position = v3Add(this.state.position, v3Scale(this.state.velocity, dt));

    const yawRate = this.state.angularVelocity.y;
    this.state.yaw += yawRate * dt;

    const pitchRate = this.state.angularVelocity.x;
    this.state.pitch += pitchRate * dt;
    this.state.pitch = this.clamp(this.state.pitch, -Math.PI / 3, Math.PI / 3);

    const rollRate = this.state.angularVelocity.z;
    this.state.roll += rollRate * dt;
    this.state.roll = this.clamp(this.state.roll, -Math.PI / 3, Math.PI / 3);
  }

  private updateOrientation(dt: number): void {
    this.state.orientation.forward = {
      x: Math.cos(this.state.yaw) * Math.cos(this.state.pitch),
      y: Math.sin(this.state.pitch),
      z: Math.sin(this.state.yaw) * Math.cos(this.state.pitch),
    };

    const worldUp = { x: 0, y: 1, z: 0 };
    const baseRight = v3Normalize(v3Cross(worldUp, this.state.orientation.forward));
    
    this.state.orientation.right = {
      x: baseRight.x * Math.cos(this.state.roll) - worldUp.x * Math.sin(this.state.roll),
      y: baseRight.y * Math.cos(this.state.roll) - worldUp.y * Math.sin(this.state.roll),
      z: baseRight.z * Math.cos(this.state.roll) - worldUp.z * Math.sin(this.state.roll),
    };

    this.state.orientation.up = v3Normalize(
      v3Cross(this.state.orientation.right, this.state.orientation.forward)
    );
  }

  private updateDerivedState(): void {
    const velForward = v3Dot(this.state.velocity, this.state.orientation.forward);
    const velRight = v3Dot(this.state.velocity, this.state.orientation.right);
    this.state.speed = Math.sqrt(velForward * velForward + velRight * velRight);

    const wheelSpeed = Math.abs(velForward);
    this.state.rpm = (wheelSpeed * 60) / (2 * Math.PI * 0.5);
  }

  private getWheelPositions(): [Vec3, Vec3, Vec3, Vec3] {
    const halfWheelBase = this.config.wheelBase / 2;
    const halfTrack = this.config.trackWidth / 2;

    const forward = this.state.orientation.forward;
    const right = this.state.orientation.right;
    const up = this.state.orientation.up;

    const centerOfMass = v3Add(
      this.state.position,
      v3Scale(up, -this.config.centerOfMassHeight)
    );

    const frontOffset = v3Scale(forward, halfWheelBase);
    const rearOffset = v3Scale(forward, -halfWheelBase);
    const leftOffset = v3Scale(right, -halfTrack);
    const rightOffset = v3Scale(right, halfTrack);

    const frontLeft = v3Add(v3Add(centerOfMass, frontOffset), leftOffset);
    const frontRight = v3Add(v3Add(centerOfMass, frontOffset), rightOffset);
    const rearLeft = v3Add(v3Add(centerOfMass, rearOffset), leftOffset);
    const rearRight = v3Add(v3Add(centerOfMass, rearOffset), rightOffset);

    return [frontLeft, frontRight, rearLeft, rearRight];
  }

  private getGroundHeight(x: number, z: number): number {
    if (this.road) {
      const onRoad = this.road.isOnRoad(x, z);
      if (onRoad) {
        return this.road.getHeightAtPosition(x, z);
      }
    }

    if (this.terrain) {
      return this.terrain.getHeight(x, z);
    }

    return 0;
  }

  private rotateVector(v: Vec3, axis: Vec3, angle: number): Vec3 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const t = 1 - c;

    const x = v.x * (t * axis.x * axis.x + c) +
              v.y * (t * axis.x * axis.y - s * axis.z) +
              v.z * (t * axis.x * axis.z + s * axis.y);

    const y = v.x * (t * axis.x * axis.y + s * axis.z) +
              v.y * (t * axis.y * axis.y + c) +
              v.z * (t * axis.y * axis.z - s * axis.x);

    const z = v.x * (t * axis.x * axis.z - s * axis.y) +
              v.y * (t * axis.y * axis.z + s * axis.x) +
              v.z * (t * axis.z * axis.z + c);

    return { x, y, z };
  }

  private createWheelState(): WheelState {
    return {
      position: v3(0, 0, 0),
      velocity: v3(0, 0, 0),
      compression: 0,
      compressionVel: 0,
      grounded: false,
      load: 0,
      slipAngle: 0,
      slipRatio: 0,
      lateralForce: v3(0, 0, 0),
      longitudinalForce: v3(0, 0, 0),
    };
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}

export function createDefaultVehicleConfig(): VehicleConfig {
  return {
    mass: 1200,
    inertia: 1800,
    wheelBase: 2.8,
    trackWidth: 1.8,
    centerOfMassHeight: 0.5,
    dragCoefficient: 0.35,
    rollingResistance: 12,
    
    suspensionStiffness: 28000,
    suspensionDamping: 3500,
    suspensionTravel: 0.4,
    suspensionRestLength: 0.8,
    
    tireGripCoeff: 3.2,
    tirePeakSlip: 8.5,
    tireSlipFalloff: 35,
    tireLoadSensitivity: 0.12,
    
    enginePower: 5500,
    engineMaxRPM: 7000,
    brakeTorque: 4500,
    
    steerAngleMax: 0.52,
    steerSpeed: 4.5,
    steerReturnSpeed: 8.0,
    
    antiRollStiffness: 12000,
  };
}
