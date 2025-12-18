import type { Vec3 } from "./vec3";
import { v3, v3Add, v3Copy, v3Dot, v3Len, v3LenSq, v3Normalize, v3Scale, v3Sub } from "./vec3";

export type VehicleConfig = {
  mass: number;
  momentOfInertia: Vec3;
  centerOfMassHeight: number;
  wheelbase: number;
  trackWidth: number;
  
  suspensionStiffness: number;
  suspensionDamping: number;
  suspensionTravel: number;
  suspensionRestLength: number;
  
  enginePower: number;
  engineMaxRPM: number;
  engineIdleRPM: number;
  engineInertia: number;
  
  gearRatios: number[];
  finalDriveRatio: number;
  transmissionEfficiency: number;
  
  maxSteerAngle: number;
  steerSpeed: number;
  
  tireFrictionCoefficient: number;
  tireRollingResistance: number;
  tireLateralStiffness: number;
  tireLongitudinalStiffness: number;
  tireLoadSensitivity: number;
  
  brakeTorque: number;
  handbrakeTorque: number;
  
  dragCoefficient: number;
  frontalArea: number;
  downforceCoefficient: number;
  
  antiRollBarStiffness: number;
  differentialLockingFactor: number;
};

export type WheelState = {
  position: Vec3;
  velocity: Vec3;
  suspensionLength: number;
  suspensionVelocity: number;
  angularVelocity: number;
  slipRatio: number;
  slipAngle: number;
  load: number;
  groundContact: boolean;
  steerAngle: number;
};

export type VehicleState = {
  position: Vec3;
  velocity: Vec3;
  acceleration: Vec3;
  
  orientation: Quaternion;
  angularVelocity: Vec3;
  angularAcceleration: Vec3;
  
  wheels: [WheelState, WheelState, WheelState, WheelState];
  
  engineRPM: number;
  currentGear: number;
  throttleInput: number;
  brakeInput: number;
  steerInput: number;
  handbrakeInput: number;
  
  speed: number;
  forwardSpeed: number;
  lateralSpeed: number;
};

export type Quaternion = {
  x: number;
  y: number;
  z: number;
  w: number;
};

export class VehiclePhysics {
  private config: VehicleConfig;
  private state: VehicleState;
  private accumulatedTime: number;
  private readonly fixedDeltaTime: number = 1 / 120;
  
  constructor(config: VehicleConfig, initialPosition: Vec3, initialYaw: number) {
    this.config = config;
    this.accumulatedTime = 0;
    
    const initialOrientation = this.eulerToQuaternion(0, initialYaw, 0);
    
    this.state = {
      position: v3Copy(initialPosition),
      velocity: v3(0, 0, 0),
      acceleration: v3(0, 0, 0),
      
      orientation: initialOrientation,
      angularVelocity: v3(0, 0, 0),
      angularAcceleration: v3(0, 0, 0),
      
      wheels: [
        this.createWheel(-config.trackWidth * 0.5, config.wheelbase * 0.5),
        this.createWheel(config.trackWidth * 0.5, config.wheelbase * 0.5),
        this.createWheel(-config.trackWidth * 0.5, -config.wheelbase * 0.5),
        this.createWheel(config.trackWidth * 0.5, -config.wheelbase * 0.5),
      ],
      
      engineRPM: config.engineIdleRPM,
      currentGear: 1,
      throttleInput: 0,
      brakeInput: 0,
      steerInput: 0,
      handbrakeInput: 0,
      
      speed: 0,
      forwardSpeed: 0,
      lateralSpeed: 0,
    };
  }

  private createWheel(x: number, z: number): WheelState {
    return {
      position: v3(x, 0, z),
      velocity: v3(0, 0, 0),
      suspensionLength: this.config.suspensionRestLength,
      suspensionVelocity: 0,
      angularVelocity: 0,
      slipRatio: 0,
      slipAngle: 0,
      load: this.config.mass * 9.81 * 0.25,
      groundContact: false,
      steerAngle: 0,
    };
  }

  public step(dt: number, terrainHeightFn: (x: number, z: number) => number): void {
    this.accumulatedTime += dt;
    
    while (this.accumulatedTime >= this.fixedDeltaTime) {
      this.fixedStep(this.fixedDeltaTime, terrainHeightFn);
      this.accumulatedTime -= this.fixedDeltaTime;
    }
  }

  private fixedStep(dt: number, terrainHeightFn: (x: number, z: number) => number): void {
    this.updateWheelPositions();
    this.updateWheelStates(terrainHeightFn);
    this.updateEngine(dt);
    this.applyForces(dt);
    this.integrate(dt);
    this.updateDerivedQuantities();
  }

  private updateWheelPositions(): void {
    const forward = this.getForwardVector();
    const right = this.getRightVector();
    
    const wheelOffsets = [
      { x: -this.config.trackWidth * 0.5, z: this.config.wheelbase * 0.5 },
      { x: this.config.trackWidth * 0.5, z: this.config.wheelbase * 0.5 },
      { x: -this.config.trackWidth * 0.5, z: -this.config.wheelbase * 0.5 },
      { x: this.config.trackWidth * 0.5, z: -this.config.wheelbase * 0.5 },
    ];
    
    for (let i = 0; i < 4; i++) {
      const offset = wheelOffsets[i];
      const localPos = v3Add(
        v3Scale(right, offset.x),
        v3Scale(forward, offset.z)
      );
      
      this.state.wheels[i].position = v3Add(this.state.position, localPos);
    }
  }

  private updateWheelStates(terrainHeightFn: (x: number, z: number) => number): void {
    for (let i = 0; i < 4; i++) {
      const wheel = this.state.wheels[i];
      const worldPos = wheel.position;
      
      const terrainHeight = terrainHeightFn(worldPos.x, worldPos.z);
      const suspensionTarget = this.state.position.y - this.config.centerOfMassHeight - this.config.suspensionRestLength;
      const compressionDistance = suspensionTarget - terrainHeight;
      
      if (compressionDistance > 0 && compressionDistance < this.config.suspensionTravel) {
        wheel.groundContact = true;
        wheel.suspensionLength = this.config.suspensionRestLength - compressionDistance;
      } else {
        wheel.groundContact = false;
        wheel.suspensionLength = this.config.suspensionRestLength;
      }
      
      if (i < 2) {
        const targetSteer = this.state.steerInput * this.config.maxSteerAngle;
        const steerDiff = targetSteer - wheel.steerAngle;
        wheel.steerAngle += steerDiff * this.config.steerSpeed;
      } else {
        wheel.steerAngle = 0;
      }
    }
  }

  private updateEngine(dt: number): void {
    const targetRPM = this.config.engineIdleRPM + 
                      this.state.throttleInput * (this.config.engineMaxRPM - this.config.engineIdleRPM);
    
    const rpmDiff = targetRPM - this.state.engineRPM;
    const rpmChangeRate = 3000;
    const rpmChange = Math.sign(rpmDiff) * Math.min(Math.abs(rpmDiff), rpmChangeRate * dt);
    
    this.state.engineRPM += rpmChange;
    this.state.engineRPM = Math.max(this.config.engineIdleRPM, Math.min(this.config.engineMaxRPM, this.state.engineRPM));
    
    const speedThreshold = 8;
    if (this.state.forwardSpeed > speedThreshold && this.state.throttleInput > 0.5) {
      if (this.state.currentGear < this.config.gearRatios.length - 1) {
        const currentRatio = this.config.gearRatios[this.state.currentGear];
        const nextRatio = this.config.gearRatios[this.state.currentGear + 1];
        const shiftRPM = this.config.engineMaxRPM * 0.85;
        
        if (this.state.engineRPM > shiftRPM) {
          this.state.currentGear++;
          this.state.engineRPM *= nextRatio / currentRatio;
        }
      }
    } else if (this.state.forwardSpeed < speedThreshold * 0.6) {
      if (this.state.currentGear > 0) {
        this.state.currentGear = 0;
      }
    }
  }

  private applyForces(dt: number): void {
    const gravity = v3(0, -9.81 * this.config.mass, 0);
    let totalForce = v3Copy(gravity);
    let totalTorque = v3(0, 0, 0);
    
    const forward = this.getForwardVector();
    const right = this.getRightVector();
    const up = this.getUpVector();
    
    for (let i = 0; i < 4; i++) {
      const wheel = this.state.wheels[i];
      
      if (wheel.groundContact) {
        const suspensionCompression = this.config.suspensionRestLength - wheel.suspensionLength;
        const suspensionForce = suspensionCompression * this.config.suspensionStiffness;
        const dampingForce = wheel.suspensionVelocity * this.config.suspensionDamping;
        const totalSuspensionForce = Math.max(0, suspensionForce - dampingForce);
        
        wheel.load = totalSuspensionForce;
        
        const suspensionForceVec = v3Scale(up, totalSuspensionForce);
        totalForce = v3Add(totalForce, suspensionForceVec);
        
        const wheelToCenter = v3Sub(wheel.position, this.state.position);
        const suspensionTorque = this.cross(wheelToCenter, suspensionForceVec);
        totalTorque = v3Add(totalTorque, suspensionTorque);
        
        const wheelForward = this.rotateVector(forward, up, wheel.steerAngle);
        const wheelRight = this.rotateVector(right, up, wheel.steerAngle);
        
        const wheelVelocity = v3Add(
          this.state.velocity,
          this.cross(this.state.angularVelocity, wheelToCenter)
        );
        
        const wheelVelForward = v3Dot(wheelVelocity, wheelForward);
        const wheelVelLateral = v3Dot(wheelVelocity, wheelRight);
        
        const wheelRadius = 0.35;
        const wheelCircumferentialVel = wheel.angularVelocity * wheelRadius;
        
        if (Math.abs(wheelVelForward) > 0.1) {
          wheel.slipRatio = (wheelCircumferentialVel - wheelVelForward) / Math.abs(wheelVelForward);
        } else {
          wheel.slipRatio = 0;
        }
        
        if (Math.abs(wheelVelForward) > 0.1) {
          wheel.slipAngle = Math.atan2(wheelVelLateral, Math.abs(wheelVelForward));
        } else {
          wheel.slipAngle = 0;
        }
        
        let longitudinalForce = 0;
        
        if (i >= 2 || this.state.throttleInput > 0.1) {
          const gearRatio = this.config.gearRatios[this.state.currentGear];
          const wheelTorque = (this.state.engineRPM / this.config.engineMaxRPM) * 
                             this.config.enginePower * 
                             gearRatio * 
                             this.config.finalDriveRatio * 
                             this.config.transmissionEfficiency;
          
          longitudinalForce = (wheelTorque / wheelRadius) * this.state.throttleInput;
        }
        
        if (this.state.brakeInput > 0) {
          const brakeForce = this.config.brakeTorque / wheelRadius * this.state.brakeInput;
          longitudinalForce -= Math.sign(wheelVelForward) * brakeForce;
        }
        
        if (this.state.handbrakeInput > 0 && i >= 2) {
          const handbrakeForce = this.config.handbrakeTorque / wheelRadius * this.state.handbrakeInput;
          longitudinalForce -= Math.sign(wheelVelForward) * handbrakeForce;
        }
        
        const normalizedLoad = wheel.load / (this.config.mass * 9.81 * 0.25);
        const loadFactor = 1.0 - this.config.tireLoadSensitivity * (normalizedLoad - 1.0);
        
        const maxLongitudinalForce = wheel.load * this.config.tireFrictionCoefficient * loadFactor;
        longitudinalForce = Math.max(-maxLongitudinalForce, Math.min(maxLongitudinalForce, longitudinalForce));
        
        const pacejkaB = 10;
        const pacejkaC = 1.9;
        const pacejkaD = wheel.load * this.config.tireFrictionCoefficient * loadFactor;
        const pacejkaE = 0.97;
        
        const lateralSlip = wheel.slipAngle;
        const lateralForce = pacejkaD * Math.sin(
          pacejkaC * Math.atan(
            pacejkaB * lateralSlip - pacejkaE * (pacejkaB * lateralSlip - Math.atan(pacejkaB * lateralSlip))
          )
        );
        
        const combinedForceMagnitude = Math.sqrt(longitudinalForce * longitudinalForce + lateralForce * lateralForce);
        const maxCombinedForce = wheel.load * this.config.tireFrictionCoefficient * loadFactor;
        
        if (combinedForceMagnitude > maxCombinedForce) {
          const scale = maxCombinedForce / combinedForceMagnitude;
          longitudinalForce *= scale;
        }
        
        const rollingResistance = wheelVelForward * this.config.tireRollingResistance * wheel.load;
        longitudinalForce -= rollingResistance;
        
        const tireForceWorld = v3Add(
          v3Scale(wheelForward, longitudinalForce),
          v3Scale(wheelRight, lateralForce)
        );
        
        totalForce = v3Add(totalForce, tireForceWorld);
        
        const tireTorque = this.cross(wheelToCenter, tireForceWorld);
        totalTorque = v3Add(totalTorque, tireTorque);
        
        const wheelTorque = -longitudinalForce * wheelRadius;
        wheel.angularVelocity += wheelTorque / (this.config.mass * 0.1) * dt;
        wheel.angularVelocity *= 0.98;
      } else {
        wheel.angularVelocity *= 0.95;
        wheel.load = 0;
      }
    }
    
    const speedSq = v3LenSq(this.state.velocity);
    const dragForce = -0.5 * this.config.dragCoefficient * this.config.frontalArea * 1.225 * speedSq;
    const dragVec = v3Len(this.state.velocity) > 0.01 ? 
                    v3Scale(v3Normalize(this.state.velocity), dragForce) : 
                    v3(0, 0, 0);
    totalForce = v3Add(totalForce, dragVec);
    
    const downforce = -0.5 * this.config.downforceCoefficient * this.config.frontalArea * 1.225 * speedSq;
    const downforceVec = v3Scale(up, downforce);
    totalForce = v3Add(totalForce, downforceVec);
    
    const leftRoll = (this.state.wheels[0].suspensionLength + this.state.wheels[2].suspensionLength) * 0.5;
    const rightRoll = (this.state.wheels[1].suspensionLength + this.state.wheels[3].suspensionLength) * 0.5;
    const rollDifference = rightRoll - leftRoll;
    const antiRollTorque = rollDifference * this.config.antiRollBarStiffness;
    totalTorque = v3Add(totalTorque, v3Scale(forward, antiRollTorque));
    
    this.state.acceleration = v3Scale(totalForce, 1 / this.config.mass);
    
    const invInertia = v3(
      1 / this.config.momentOfInertia.x,
      1 / this.config.momentOfInertia.y,
      1 / this.config.momentOfInertia.z
    );
    
    this.state.angularAcceleration = v3(
      totalTorque.x * invInertia.x,
      totalTorque.y * invInertia.y,
      totalTorque.z * invInertia.z
    );
  }

  private integrate(dt: number): void {
    this.state.velocity = v3Add(this.state.velocity, v3Scale(this.state.acceleration, dt));
    this.state.position = v3Add(this.state.position, v3Scale(this.state.velocity, dt));
    
    this.state.angularVelocity = v3Add(
      this.state.angularVelocity,
      v3Scale(this.state.angularAcceleration, dt)
    );
    
    const angularDamping = 0.98;
    this.state.angularVelocity = v3Scale(this.state.angularVelocity, angularDamping);
    
    const deltaQuat = this.angularVelocityToQuaternion(this.state.angularVelocity, dt);
    this.state.orientation = this.multiplyQuaternions(deltaQuat, this.state.orientation);
    this.state.orientation = this.normalizeQuaternion(this.state.orientation);
  }

  private updateDerivedQuantities(): void {
    this.state.speed = v3Len(this.state.velocity);
    
    const forward = this.getForwardVector();
    const right = this.getRightVector();
    
    this.state.forwardSpeed = v3Dot(this.state.velocity, forward);
    this.state.lateralSpeed = v3Dot(this.state.velocity, right);
  }

  public setInputs(throttle: number, brake: number, steer: number, handbrake: number): void {
    this.state.throttleInput = Math.max(0, Math.min(1, throttle));
    this.state.brakeInput = Math.max(0, Math.min(1, brake));
    this.state.steerInput = Math.max(-1, Math.min(1, steer));
    this.state.handbrakeInput = Math.max(0, Math.min(1, handbrake));
  }

  public getState(): VehicleState {
    return this.state;
  }

  public getForwardVector(): Vec3 {
    return this.rotateVectorByQuaternion(v3(0, 0, 1), this.state.orientation);
  }

  public getRightVector(): Vec3 {
    return this.rotateVectorByQuaternion(v3(1, 0, 0), this.state.orientation);
  }

  public getUpVector(): Vec3 {
    return this.rotateVectorByQuaternion(v3(0, 1, 0), this.state.orientation);
  }

  public getYaw(): number {
    const q = this.state.orientation;
    return Math.atan2(
      2 * (q.w * q.y + q.x * q.z),
      1 - 2 * (q.y * q.y + q.x * q.x)
    );
  }

  public getPitch(): number {
    const q = this.state.orientation;
    const sinp = 2 * (q.w * q.x - q.z * q.y);
    
    if (Math.abs(sinp) >= 1) {
      return Math.sign(sinp) * Math.PI / 2;
    }
    
    return Math.asin(sinp);
  }

  public getRoll(): number {
    const q = this.state.orientation;
    return Math.atan2(
      2 * (q.w * q.z + q.x * q.y),
      1 - 2 * (q.x * q.x + q.z * q.z)
    );
  }

  private cross(a: Vec3, b: Vec3): Vec3 {
    return v3(
      a.y * b.z - a.z * b.y,
      a.z * b.x - a.x * b.z,
      a.x * b.y - a.y * b.x
    );
  }

  private rotateVector(vec: Vec3, axis: Vec3, angle: number): Vec3 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dot = v3Dot(axis, vec);
    
    return v3Add(
      v3Add(
        v3Scale(vec, cos),
        v3Scale(this.cross(axis, vec), sin)
      ),
      v3Scale(axis, dot * (1 - cos))
    );
  }

  private eulerToQuaternion(pitch: number, yaw: number, roll: number): Quaternion {
    const cy = Math.cos(yaw * 0.5);
    const sy = Math.sin(yaw * 0.5);
    const cp = Math.cos(pitch * 0.5);
    const sp = Math.sin(pitch * 0.5);
    const cr = Math.cos(roll * 0.5);
    const sr = Math.sin(roll * 0.5);

    return {
      w: cr * cp * cy + sr * sp * sy,
      x: sr * cp * cy - cr * sp * sy,
      y: cr * sp * cy + sr * cp * sy,
      z: cr * cp * sy - sr * sp * cy,
    };
  }

  private angularVelocityToQuaternion(omega: Vec3, dt: number): Quaternion {
    const angle = v3Len(omega) * dt;
    
    if (angle < 0.0001) {
      return { w: 1, x: 0, y: 0, z: 0 };
    }
    
    const axis = v3Normalize(omega);
    const halfAngle = angle * 0.5;
    const s = Math.sin(halfAngle);
    
    return {
      w: Math.cos(halfAngle),
      x: axis.x * s,
      y: axis.y * s,
      z: axis.z * s,
    };
  }

  private multiplyQuaternions(a: Quaternion, b: Quaternion): Quaternion {
    return {
      w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
      x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
      y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
      z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    };
  }

  private normalizeQuaternion(q: Quaternion): Quaternion {
    const len = Math.sqrt(q.w * q.w + q.x * q.x + q.y * q.y + q.z * q.z);
    
    if (len < 0.0001) {
      return { w: 1, x: 0, y: 0, z: 0 };
    }
    
    return {
      w: q.w / len,
      x: q.x / len,
      y: q.y / len,
      z: q.z / len,
    };
  }

  private rotateVectorByQuaternion(vec: Vec3, q: Quaternion): Vec3 {
    const qVec = { x: q.x, y: q.y, z: q.z };
    const cross1 = this.cross(qVec, vec);
    const cross2 = this.cross(qVec, cross1);
    
    return v3Add(
      v3Add(vec, v3Scale(cross1, 2 * q.w)),
      v3Scale(cross2, 2)
    );
  }
}

export function createDefaultVehicleConfig(): VehicleConfig {
  return {
    mass: 1200,
    momentOfInertia: v3(800, 1200, 600),
    centerOfMassHeight: 0.45,
    wheelbase: 2.6,
    trackWidth: 1.5,
    
    suspensionStiffness: 35000,
    suspensionDamping: 4500,
    suspensionTravel: 0.3,
    suspensionRestLength: 0.5,
    
    enginePower: 250,
    engineMaxRPM: 7000,
    engineIdleRPM: 1000,
    engineInertia: 0.3,
    
    gearRatios: [3.5, 2.2, 1.5, 1.0, 0.8],
    finalDriveRatio: 3.8,
    transmissionEfficiency: 0.85,
    
    maxSteerAngle: 0.52,
    steerSpeed: 0.18,
    
    tireFrictionCoefficient: 1.1,
    tireRollingResistance: 0.015,
    tireLateralStiffness: 85000,
    tireLongitudinalStiffness: 120000,
    tireLoadSensitivity: 0.08,
    
    brakeTorque: 3500,
    handbrakeTorque: 2500,
    
    dragCoefficient: 0.28,
    frontalArea: 2.2,
    downforceCoefficient: 0.15,
    
    antiRollBarStiffness: 12000,
    differentialLockingFactor: 0.3,
  };
}
