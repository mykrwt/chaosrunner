import type { CarInput, CarState, WeatherCondition, Track } from "./types";
import type { Vec3 } from "./vec3";
import { v3, v3Add, v3Sub, v3Scale, v3Dot, v3Len, v3Normalize, v3Cross } from "./vec3";

// Advanced physics constants
const PHYSICS_CONSTANTS = {
  GRAVITY: 9.81,
  AIR_DENSITY: 1.225, // kg/m³ at sea level
  BRAKE_PRESSURE: 8.0, // bar
  ENGINE_STICKING_PROB: 0.001, // per minute
  CLUTCH_TORQUE: 1500, // Nm
  GEAR_SHIFT_TIME: 0.15, // seconds
  TURBO_LAG: 0.4, // seconds
  SUSPENSION_TRAVEL: 0.15, // meters
  ROLL_CENTER_HEIGHT: 0.3, // meters
  CENTER_OF_MASS_HEIGHT: 0.55, // meters
  WHEELBASE: 2.7, // meters
  TRACK_WIDTH: 1.8, // meters
};

// Tire compound properties
const TIRE_COMPOUNDS = {
  "ultra-soft": {
    grip: 2.3,
    wear: 0.8,
    tempOptimal: 95,
    tempMin: 60,
    tempMax: 130,
    thermalTime: 45, // seconds to reach optimal temp
    pressureOptimal: 1.8, // bar
    rollingResistance: 0.012
  },
  "soft": {
    grip: 2.0,
    wear: 0.6,
    tempOptimal: 90,
    tempMin: 55,
    tempMax: 125,
    thermalTime: 50,
    pressureOptimal: 1.9,
    rollingResistance: 0.013
  },
  "medium": {
    grip: 1.7,
    wear: 0.4,
    tempOptimal: 85,
    tempMin: 50,
    tempMax: 120,
    thermalTime: 60,
    pressureOptimal: 2.0,
    rollingResistance: 0.014
  },
  "hard": {
    grip: 1.4,
    wear: 0.25,
    tempOptimal: 80,
    tempMin: 45,
    tempMax: 115,
    thermalTime: 75,
    pressureOptimal: 2.1,
    rollingResistance: 0.015
  },
  "intermediate": {
    grip: 1.5,
    wear: 0.35,
    tempOptimal: 82,
    tempMin: 47,
    tempMax: 118,
    thermalTime: 65,
    pressureOptimal: 2.0,
    rollingResistance: 0.0145
  },
  "wet": {
    grip: 0.8,
    wear: 0.2,
    tempOptimal: 70,
    tempMin: 40,
    tempMax: 100,
    thermalTime: 80,
    pressureOptimal: 2.2,
    rollingResistance: 0.016
  }
};

// Engine characteristics for different vehicle types
const ENGINE_TYPES = {
  "road": {
    maxPower: 180, // kW
    maxTorque: 320, // Nm
    maxRPM: 7000,
    idleRPM: 850,
    redlineRPM: 6500,
    efficiency: 0.35,
    fuelConsumptionBase: 0.012, // L/km
    reliability: 0.95,
    turboAvailable: false
  },
  "sport": {
    maxPower: 280,
    maxTorque: 450,
    maxRPM: 8000,
    idleRPM: 900,
    redlineRPM: 7500,
    efficiency: 0.32,
    fuelConsumptionBase: 0.015,
    reliability: 0.92,
    turboAvailable: true
  },
  "racing": {
    maxPower: 420,
    maxTorque: 580,
    maxRPM: 9000,
    idleRPM: 1200,
    redlineRPM: 8500,
    efficiency: 0.28,
    fuelConsumptionBase: 0.022,
    reliability: 0.85,
    turboAvailable: false
  },
  "turbo": {
    maxPower: 350,
    maxTorque: 600,
    maxRPM: 7500,
    idleRPM: 950,
    redlineRPM: 7000,
    efficiency: 0.30,
    fuelConsumptionBase: 0.018,
    reliability: 0.88,
    turboAvailable: true,
    boostPressure: 1.8 // bar
  }
};

// Transmission configurations
const TRANSMISSIONS = {
  "manual-5": {
    gears: 5,
    ratios: [3.5, 2.1, 1.4, 1.1, 0.9],
    finalDrive: 3.9,
    efficiency: 0.92
  },
  "manual-6": {
    gears: 6,
    ratios: [3.8, 2.3, 1.6, 1.2, 0.95, 0.78],
    finalDrive: 4.1,
    efficiency: 0.93
  },
  "dct-7": {
    gears: 7,
    ratios: [3.6, 2.2, 1.6, 1.3, 1.0, 0.82, 0.68],
    finalDrive: 3.8,
    efficiency: 0.94,
    shiftTime: 0.08
  },
  "dct-8": {
    gears: 8,
    ratios: [3.8, 2.4, 1.8, 1.4, 1.1, 0.9, 0.75, 0.62],
    finalDrive: 3.9,
    efficiency: 0.95,
    shiftTime: 0.06
  }
};

// Surface grip multipliers
const SURFACE_GRIP = {
  "asphalt": {
    grip: 1.0,
    rollingResistance: 0.012,
    lateralGrip: 1.0,
    longitudinalGrip: 1.0,
    temperatureEffect: 0.002 // per °C
  },
  "concrete": {
    grip: 0.95,
    rollingResistance: 0.014,
    lateralGrip: 0.95,
    longitudinalGrip: 0.95,
    temperatureEffect: 0.0015
  },
  "grass": {
    grip: 0.6,
    rollingResistance: 0.04,
    lateralGrip: 0.5,
    longitudinalGrip: 0.7,
    temperatureEffect: 0.003
  },
  "dirt": {
    grip: 0.7,
    rollingResistance: 0.035,
    lateralGrip: 0.6,
    longitudinalGrip: 0.8,
    temperatureEffect: 0.0025
  },
  "wet-asphalt": {
    grip: 0.85,
    rollingResistance: 0.016,
    lateralGrip: 0.7,
    longitudinalGrip: 0.75,
    temperatureEffect: 0.001
  },
  "wet-concrete": {
    grip: 0.82,
    rollingResistance: 0.018,
    lateralGrip: 0.68,
    longitudinalGrip: 0.72,
    temperatureEffect: 0.0008
  },
  "ice": {
    grip: 0.15,
    rollingResistance: 0.008,
    lateralGrip: 0.1,
    longitudinalGrip: 0.2,
    temperatureEffect: 0.005
  },
  "snow": {
    grip: 0.4,
    rollingResistance: 0.025,
    lateralGrip: 0.3,
    longitudinalGrip: 0.5,
    temperatureEffect: 0.002
  }
};

// Aerodynamic coefficients for different vehicles
const AERO_COEFFICIENTS = {
  "road": {
    dragCoefficient: 0.32,
    frontalArea: 2.2, // m²
    downforceCoefficient: 0.45,
    balance: 0.55, // 0 = rear-biased, 1 = front-biased
    yawEffectiveness: 0.3
  },
  "sport": {
    dragCoefficient: 0.28,
    frontalArea: 2.0,
    downforceCoefficient: 0.65,
    balance: 0.52,
    yawEffectiveness: 0.4
  },
  "racing": {
    dragCoefficient: 0.24,
    frontalArea: 1.8,
    downforceCoefficient: 1.2,
    balance: 0.48,
    yawEffectiveness: 0.5
  }
};

// Vehicle data structure
export interface VehicleConfig {
  type: keyof typeof ENGINE_TYPES;
  transmission: keyof typeof TRANSMISSIONS;
  aero: keyof typeof AERO_COEFFICIENTS;
  mass: number; // kg
  wheelbase: number; // m
  trackWidth: number; // m
  centerOfMassHeight: number; // m
  inertiaX: number; // kg·m²
  inertiaY: number; // kg·m²
  inertiaZ: number; // kg·m²
  tireCompound: keyof typeof TIRE_COMPOUNDS;
  brakeBias: number; // 0-1, front to rear
}

// Initialize vehicle state with all advanced physics parameters
export function initializeAdvancedVehicleState(config: VehicleConfig, spawn: { p: Vec3; yaw: number }): CarState {
  const tireDefaults = TIRE_COMPOUNDS[config.tireCompound];
  
  return {
    // Basic physics state
    p: v3(spawn.p.x, spawn.p.y, spawn.p.z),
    v: v3(0, 0, 0),
    yaw: spawn.yaw,
    yawVel: 0,
    pitch: 0,
    roll: 0,
    grounded: true,
    boostCd: 0,
    lap: 0,
    s: 0,
    lastCp: 0,
    finished: false,
    alive: true,
    lastHitAt: 0,
    
    // Advanced physics
    angularVel: v3(0, 0, 0),
    engineRPM: ENGINE_TYPES[config.type].idleRPM,
    engineHealth: 1.0,
    transmissionGear: 1,
    clutchEngaged: false,
    
    // Tire properties
    tireWear: {
      frontLeft: 1.0,
      frontRight: 1.0,
      rearLeft: 1.0,
      rearRight: 1.0
    },
    tireTemperature: {
      frontLeft: tireDefaults.tempMin,
      frontRight: tireDefaults.tempMin,
      rearLeft: tireDefaults.tempMin,
      rearRight: tireDefaults.tempMin
    },
    tireGrip: {
      frontLeft: tireDefaults.grip,
      frontRight: tireDefaults.grip,
      rearLeft: tireDefaults.grip,
      rearRight: tireDefaults.grip
    },
    tirePressure: {
      frontLeft: tireDefaults.pressureOptimal,
      frontRight: tireDefaults.pressureOptimal,
      rearLeft: tireDefaults.pressureOptimal,
      rearRight: tireDefaults.pressureOptimal
    },
    
    // Aerodynamics
    downforce: 0,
    dragCoefficient: AERO_COEFFICIENTS[config.aero].dragCoefficient,
    aerodynamicBalance: AERO_COEFFICIENTS[config.aero].balance,
    
    // Damage system
    bodyDamage: 0,
    frontDamage: 0,
    rearDamage: 0,
    leftSideDamage: 0,
    rightSideDamage: 0,
    suspensionDamage: { front: 0, rear: 0 },
    
    // Performance effects
    enginePowerLoss: 0,
    handlingLoss: 0,
    stabilityLoss: 0,
    
    // Fuel system
    fuelLevel: 1.0,
    fuelConsumption: 0,
    
    // Advanced dynamics
    weightTransfer: v3(0, 0, 0),
    centerOfMassOffset: v3(0, 0, 0),
    rotationalInertia: config.inertiaZ,
    
    // Environmental interaction
    surfaceType: "asphalt",
    waterLevel: 0,
    accumulatedWater: 0,
    mudAccumulation: 0,
    
    // Visual effects
    exhaustSmokeLevel: 0,
    damageSmokeLevel: 0,
    dustTrailLevel: 0,
    
    // Telemetry
    lapTimes: [],
    currentLapTime: 0,
    bestLapTime: Infinity,
    totalDistance: 0,
    averageSpeed: 0,
    topSpeed: 0,
    
    // Input response
    inputLatency: 0,
    steeringResponse: 1.0,
    throttleResponse: 1.0,
    brakeResponse: 1.0,
    
    // Special states
    nitroActive: false,
    nitroTimeLeft: 0,
    emsActive: false,
    emsTimeLeft: 0,
    invincibleUntil: 0,
    
    // Suspension
    suspensionCompression: { frontLeft: 0, frontRight: 0, rearLeft: 0, rearRight: 0 },
    suspensionVelocity: { frontLeft: 0, frontRight: 0, rearLeft: 0, rearRight: 0 },
    rideHeight: { frontLeft: 0.2, frontRight: 0.2, rearLeft: 0.2, rearRight: 0.2 },
    
    // Wheel physics
    wheelAngularVel: { frontLeft: 0, frontRight: 0, rearLeft: 0, rearRight: 0 },
    wheelSlip: { frontLeft: 0, frontRight: 0, rearLeft: 0, rearRight: 0 },
    brakeForce: { frontLeft: 0, frontRight: 0, rearLeft: 0, rearRight: 0 },
    
    // Driver aids
    absActive: false,
    absLevel: 0,
    tcsActive: false,
    tcsLevel: 0,
    tcsIntervention: 0,
    escActive: false,
    escIntervention: v3(0, 0, 0),
    yawStability: 1.0,
    
    // Aero effects
    slipStream: { active: false, strength: 0 },
    draftingBonus: 0,
    airDensity: 1.225,
    windResistance: v3(0, 0, 0),
    
    // Track position
    trackPosition: {
      lat: 0,
      surfaceTemp: 25,
      gripLevel: 1.0,
      rollingResistance: 0.012,
      sideForce: 0
    }
  };
}

// Advanced tire physics simulation
export function simulateTirePhysics(
  wheelData: {
    position: Vec3;
    velocity: Vec3;
    angularVelocity: number;
    slip: number;
    slipAngle: number;
    temperature: number;
    wear: number;
    pressure: number;
    load: number;
  },
  surfaceProperties: {
    grip: number;
    lateralGrip: number;
    longitudinalGrip: number;
    rollingResistance: number;
  },
  tireCompound: keyof typeof TIRE_COMPOUNDS,
  inputForce: { longitudinal: number; lateral: number; normal: number },
  config: VehicleConfig
) {
  const compound = TIRE_COMPOUNDS[tireCompound];
  const speed = v3Len(wheelData.velocity);
  
  // Thermal effects
  const tempOptimal = compound.tempOptimal;
  const tempFactor = Math.max(0.3, 1 - Math.abs(wheelData.temperature - tempOptimal) * 0.008);
  
  // Load sensitivity (tires generate more grip under load up to a point)
  const loadFactor = Math.min(1.2, 0.8 + wheelData.load * 0.002);
  
  // Wear effects
  const wearFactor = 0.4 + 0.6 * wheelData.wear;
  
  // Pressure effects (optimal pressure = 2.0 bar typically)
  const pressureFactor = Math.max(0.6, 1 - Math.abs(wheelData.pressure - compound.pressureOptimal) * 0.3);
  
  // Combined grip calculation
  let grip = compound.grip * tempFactor * loadFactor * wearFactor * pressureFactor * surfaceProperties.grip;
  
  // Tire model - friction circle
  const frictionCircle = Math.sqrt(inputForce.longitudinal ** 2 + inputForce.lateral ** 2);
  const maxFrictionForce = grip * inputForce.normal;
  
  let longitudinalForce = inputForce.longitudinal;
  let lateralForce = inputForce.lateral;
  
  if (frictionCircle > maxFrictionForce) {
    const scale = maxFrictionForce / frictionCircle;
    longitudinalForce *= scale;
    lateralForce *= scale;
  }
  
  // Slip angle effects (progressive loss of grip)
  const slipAngleThreshold = 8 * Math.PI / 180; // 8 degrees
  if (Math.abs(wheelData.slipAngle) > slipAngleThreshold) {
    const slipFactor = Math.max(0.3, 1 - (Math.abs(wheelData.slipAngle) - slipAngleThreshold) * 0.15);
    lateralForce *= slipFactor;
  }
  
  // Rolling resistance
  const rollingResistance = compound.rollingResistance * inputForce.normal * Math.sign(speed);
  
  // Temperature increase from friction
  const heatGeneration = Math.abs(frictionCircle) * 0.0008;
  const cooling = speed > 10 ? Math.min(1.0, speed * 0.02) : 0;
  const newTemperature = Math.min(
    compound.tempMax,
    Math.max(
      compound.tempMin,
      wheelData.temperature + heatGeneration - cooling
    )
  );
  
  // Wear rate based on slip and load
  const wearRate = Math.abs(frictionCircle) * inputForce.normal * 0.000001 * compound.wear;
  const newWear = Math.max(0, wheelData.wear - wearRate);
  
  return {
    longitudinalForce: longitudinalForce - rollingResistance,
    lateralForce: lateralForce,
    normalForce: inputForce.normal,
    slipRatio: wheelData.slip,
    slipAngle: wheelData.slipAngle,
    temperature: newTemperature,
    wear: newWear,
    grip: grip,
    heatGeneration: heatGeneration,
    cooling: cooling
  };
}

// Advanced engine simulation
export function simulateEngine(
  rpm: number,
  throttleInput: number,
  engineConfig: keyof typeof ENGINE_TYPES,
  boostPressure: number = 1.0,
  fuelLevel: number = 1.0,
  engineHealth: number = 1.0,
  turboLag: number = 0
) {
  const config = ENGINE_TYPES[engineConfig];
  const rpmRatio = Math.min(1, Math.max(0, rpm / config.maxRPM));
  
  // Fuel injection and mixing
  const airFuelRatio = 14.7; // stoichiometric
  const throttleEfficiency = throttleInput > 0.8 ? (1 - (throttleInput - 0.8) * 2) : 1;
  const volumetricEfficiency = 0.7 + 0.3 * Math.sin(rpmRatio * Math.PI * 0.8);
  
  // Turbo boost effect
  const boostMultiplier = config.turboAvailable ? boostPressure * 0.6 : 1;
  
  // Engine temperature effect on power
  const optimalTemp = 85;
  const tempEffect = rpm < 4000 ? 0.95 : 1.0; // cold engine penalty
  
  // Fuel availability (running out reduces power dramatically)
  const fuelEffect = fuelLevel > 0.05 ? 1 : Math.max(0, fuelLevel * 10);
  
  // Health effect (engine damage reduces power)
  const healthEffect = 0.6 + 0.4 * engineHealth;
  
  // Calculate available torque (simplified torque curve)
  let torqueRatio;
  if (rpm < 1000) {
    torqueRatio = rpm / 1000; // Starting torque
  } else if (rpm < 3000) {
    torqueRatio = 0.6 + 0.4 * (rpm - 1000) / 2000; // Torque build-up
  } else if (rpm < config.redlineRPM) {
    torqueRatio = 1.0 - (rpm - 3000) / (config.maxRPM - 3000) * 0.6; // Torque drop-off
  } else {
    torqueRatio = 0.4; // Beyond redline, severe power loss
  }
  
  const baseTorque = config.maxTorque * torqueRatio;
  const boostedTorque = baseTorque * boostMultiplier;
  const effectiveTorque = boostedTorque * throttleEfficiency * volumetricEfficiency * tempEffect * fuelEffect * healthEffect;
  
  // Calculate power
  const power = (effectiveTorque * rpm * Math.PI) / (30 * 1000); // kW
  
  // Fuel consumption (simplified)
  const baseConsumption = config.fuelConsumptionBase;
  const rpmConsumption = rpm / config.maxRPM;
  const throttleConsumption = throttleInput * throttleInput;
  const actualConsumption = baseConsumption * rpmConsumption * throttleConsumption * 0.001; // L/s
  
  // Engine failure probability (reduced health increases failure chance)
  const failureProbability = (1 - engineHealth) * 0.001; // per second
  const failed = Math.random() < failureProbability;
  
  return {
    torque: failed ? 0 : effectiveTorque,
    power: failed ? 0 : power,
    rpm: failed ? config.idleRPM : Math.min(config.maxRPM, Math.max(config.idleRPM, rpm)),
    fuelConsumption: actualConsumption,
    efficiency: config.efficiency * throttleEfficiency * volumetricEfficiency,
    temperature: 80 + rpmRatio * 25, // Simplified engine temp
    oilPressure: failed ? 0 : 3 + rpmRatio * 2, // bar
    boostPressure: boostMultiplier > 1 ? boostPressure : 0,
    turboHeat: config.turboAvailable ? boostMultiplier * 0.1 : 0,
    failure: failed,
    misfire: rpm > config.redlineRPM * 0.95 ? Math.random() < 0.1 : false
  };
}

// Aerodynamic simulation
export function simulateAerodynamics(
  speed: number,
  yawRate: number,
  airDensity: number,
  downforce: number,
  dragCoefficient: number,
  frontalArea: number,
  yawAngle: number,
  windVelocity: Vec3
) {
  const vSquared = speed * speed;
  
  // Drag force
  const dragForce = 0.5 * airDensity * dragCoefficient * frontalArea * vSquared;
  
  // Downforce (increases with speed)
  const downforceForce = downforce * vSquared * 0.001;
  
  // Side force due to yaw (simplified)
  const sideForce = yawRate * speed * 0.05;
  
  // Wind resistance
  const relativeWind = {
    x: -windVelocity.x,
    y: -windVelocity.y,
    z: -windVelocity.z
  };
  
  const windAngle = Math.atan2(relativeWind.z, relativeWind.x);
  const windForce = Math.abs(Math.sin(windAngle - yawAngle)) * 0.3 * vSquared * 0.001;
  
  return {
    drag: dragForce,
    downforce: downforceForce,
    sideForce: sideForce,
    windForce: windForce,
    lift: dragForce * 0.1, // simplified lift component
    totalResistance: dragForce + windForce
  };
}

// Suspension and weight transfer
export function simulateSuspension(
  vehicleVelocity: Vec3,
  rollRate: number,
  pitchRate: number,
  acceleration: { x: number; y: number; z: number },
  suspensionConfig: {
    stiffness: { front: number; rear: number };
    damping: { compression: number; rebound: number };
    antiRoll: { front: number; rear: number };
    rideHeight: { front: number; rear: number };
  },
  mass: number,
  wheelbase: number,
  trackWidth: number,
  cornerStiffness: { front: number; rear: number }
) {
  const wheelbaseForce = acceleration.z * mass * (wheelbase / 2) / wheelbase;
  const lateralForce = acceleration.x * mass * (trackWidth / 2) / trackWidth;
  
  // Front suspension
  const frontLoadTransfer = {
    left: (wheelbaseForce - lateralForce) * suspensionConfig.antiRoll.front,
    right: (wheelbaseForce + lateralForce) * suspensionConfig.antiRoll.front
  };
  
  // Rear suspension
  const rearLoadTransfer = {
    left: (-wheelbaseForce - lateralForce) * suspensionConfig.antiRoll.rear,
    right: (-wheelbaseForce + lateralForce) * suspensionConfig.antiRoll.rear
  };
  
  // Suspension compression
  const frontCompression = {
    left: Math.max(0, -frontLoadTransfer.left / suspensionConfig.stiffness.front),
    right: Math.max(0, -frontLoadTransfer.right / suspensionConfig.stiffness.front)
  };
  
  const rearCompression = {
    left: Math.max(0, -rearLoadTransfer.left / suspensionConfig.stiffness.rear),
    right: Math.max(0, -rearLoadTransfer.right / suspensionConfig.stiffness.rear)
  };
  
  return {
    frontCompression,
    rearCompression,
    weightTransfer: {
      longitudinal: wheelbaseForce,
      lateral: lateralForce
    },
    rollAngle: rollRate * 0.02,
    pitchAngle: pitchRate * 0.015
  };
}

// Weather effects on vehicle performance
export function applyWeatherEffects(
  weather: WeatherCondition,
  airDensity: number,
  trackTemperature: number
): {
  gripModifier: number;
  visibilityModifier: number;
  handlingModifier: number;
  visibilityRange: number;
  gripBySurface: Record<string, number>;
} {
  const gripModifier = weather.trackGrip;
  const visibilityModifier = weather.visibility;
  
  // Temperature effects on grip
  const tempFactor = trackTemperature > 40 ? 0.85 : trackTemperature < 10 ? 0.75 : 1.0;
  
  // Precipitation effects
  let precipitationModifier = 1.0;
  if (weather.precipitation > 0) {
    const intensity = weather.precipitation;
    precipitationModifier = Math.max(0.5, 1 - intensity * 0.6);
  }
  
  // Wind effects on handling
  const windHandling = Math.max(0.7, 1 - weather.windSpeed * 0.005);
  
  // Surface-specific grip
  const gripBySurface: Record<string, number> = {};
  Object.keys(SURFACE_GRIP).forEach(surface => {
    const surfaceProps = SURFACE_GRIP[surface as keyof typeof SURFACE_GRIP];
    let surfaceGrip = surfaceProps.grip;
    
    // Apply weather modifications
    if (weather.type === "rain") {
      if (surface.includes("wet")) {
        surfaceGrip *= 1.2; // Wet surfaces actually better when raining
      } else if (surface === "asphalt" || surface === "concrete") {
        surfaceGrip *= 0.85; // Dry surfaces become slippery when wet
      }
    } else if (weather.type === "snow") {
      surfaceGrip *= 0.4; // Snow dramatically reduces grip
    } else if (weather.type === "ice") {
      surfaceGrip *= 0.15; // Ice is extremely slippery
    }
    
    gripBySurface[surface] = surfaceGrip * precipitationModifier * tempFactor;
  });
  
  return {
    gripModifier: gripModifier * precipitationModifier * tempFactor,
    visibilityModifier: visibilityModifier,
    handlingModifier: windHandling,
    visibilityRange: 200 * visibilityModifier + 100,
    gripBySurface
  };
}

// Main advanced physics step function
export function advancedPhysicsStep(
  state: CarState,
  input: CarInput,
  track: Track,
  config: VehicleConfig,
  weather: WeatherCondition,
  environment: { airDensity: number; windVelocity: Vec3; trackTemperature: number },
  dt: number
): CarState {
  const newState = { ...state };
  
  // Apply weather and environmental effects
  const weatherEffects = applyWeatherEffects(weather, environment.airDensity, environment.trackTemperature);
  
  // Get surface information
  const surfaceInfo = track.getSurfaceInfo(state.p.x, state.p.z);
  const surfaceProps = SURFACE_GRIP[state.surfaceType] || SURFACE_GRIP["asphalt"];
  
  // Calculate vehicle vectors
  const forward = v3(Math.cos(newState.yaw), 0, Math.sin(newState.yaw));
  const right = v3(-forward.z, 0, forward.x);
  const up = v3(0, 1, 0);
  
  // Calculate speeds in vehicle frame
  const longitudinalSpeed = v3Dot(newState.v, forward);
  const lateralSpeed = v3Dot(newState.v, right);
  const verticalSpeed = v3Dot(newState.v, up);
  
  // Engine simulation
  const engineResult = simulateEngine(
    newState.engineRPM,
    input.throttle,
    config.type,
    1.0,
    newState.fuelLevel,
    newState.engineHealth
  );
  
  // Transmission simulation
  const transmissionConfig = TRANSMISSIONS[config.transmission];
  let newGear = newState.transmissionGear;
  let clutchEngaged = newState.clutchEngaged;
  
  // Automatic transmission logic
  if (transmissionConfig.gears > 4) {
    const upshiftRPM = 5500;
    const downshiftRPM = 2000;
    
    if (engineResult.rpm > upshiftRPM && newGear < transmissionConfig.gears) {
      newGear = Math.min(transmissionConfig.gears, newGear + 1);
      clutchEngaged = false;
    } else if (engineResult.rpm < downshiftRPM && newGear > 1) {
      newGear = Math.max(1, newGear - 1);
      clutchEngaged = false;
    } else if (engineResult.rpm > 3000) {
      clutchEngaged = true;
    }
  }
  
  // Apply engine torque to wheels
  if (clutchEngaged && engineResult.torque > 0) {
    const gearRatio = transmissionConfig.ratios[newGear - 1];
    const finalDrive = transmissionConfig.finalDrive;
    const totalRatio = gearRatio * finalDrive;
    const wheelTorque = engineResult.torque * totalRatio * transmissionConfig.efficiency;
    
    // Apply torque to rear wheels (rear-wheel drive assumption)
    const torquePerWheel = wheelTorque / 2;
    
    // Calculate longitudinal force
    const wheelRadius = 0.33; // 33cm typical race tire
    const longitudinalForce = torquePerWheel / wheelRadius;
    
    // Apply force to vehicle acceleration
    const accelerationForce = v3Scale(forward, longitudinalForce / config.mass);
    newState.v = v3Add(newState.v, v3Scale(accelerationForce, dt));
  }
  
  // Tire simulation for each wheel
  const wheels = [
    { name: "frontLeft" as const, position: { x: -config.trackWidth/2, y: 0, z: 1.0 } },
    { name: "frontRight" as const, position: { x: config.trackWidth/2, y: 0, z: 1.0 } },
    { name: "rearLeft" as const, position: { x: -config.trackWidth/2, y: 0, z: -1.0 } },
    { name: "rearRight" as const, position: { x: config.trackWidth/2, y: 0, z: -1.0 } }
  ];
  
  wheels.forEach(wheel => {
    const wheelPos = v3Add(state.p, v3(
      forward.x * wheel.position.z + right.x * wheel.position.x,
      0,
      forward.z * wheel.position.z + right.z * wheel.position.x
    ));
    
    const wheelVelocity = v3Add(newState.v, v3(
      -state.angularVel.y * wheelPos.z,
      0,
      state.angularVel.y * wheelPos.x
    ));
    
    const wheelForwardSpeed = v3Dot(wheelVelocity, forward);
    const wheelLateralSpeed = v3Dot(wheelVelocity, right);
    
    const slip = wheelForwardSpeed > 0.1 ? 
      (newState.wheelAngularVel[wheel.name] * 0.33 - wheelForwardSpeed) / Math.max(0.1, Math.abs(wheelForwardSpeed)) :
      0;
    
    const slipAngle = Math.atan2(Math.abs(wheelLateralSpeed), Math.abs(wheelForwardSpeed));
    
    // Calculate wheel load (simplified)
    const staticLoad = config.mass * PHYSICS_CONSTANTS.GRAVITY / 4;
    const dynamicLoad = staticLoad + (newState.weightTransfer.x + newState.weightTransfer.z) / 4;
    
    const tireResult = simulateTirePhysics(
      {
        position: wheelPos,
        velocity: wheelVelocity,
        angularVelocity: newState.wheelAngularVel[wheel.name],
        slip: slip,
        slipAngle: slipAngle,
        temperature: newState.tireTemperature[wheel.name],
        wear: newState.tireWear[wheel.name],
        pressure: newState.tirePressure[wheel.name],
        load: dynamicLoad
      },
      surfaceProps,
      config.tireCompound,
      {
        longitudinal: 0, // Will be calculated based on driving forces
        lateral: 0,
        normal: dynamicLoad
      },
      config
    );
    
    // Update tire properties
    newState.tireTemperature[wheel.name] = tireResult.temperature;
    newState.tireWear[wheel.name] = tireResult.wear;
    newState.tireGrip[wheel.name] = tireResult.grip;
    
    // Apply tire forces to vehicle
    const tireForce = v3(
      forward.x * tireResult.longitudinalForce + right.x * tireResult.lateralForce,
      0,
      forward.z * tireResult.longitudinalForce + right.z * tireResult.lateralForce
    );
    
    newState.v = v3Add(newState.v, v3Scale(tireForce, dt / config.mass));
  });
  
  // Aerodynamic simulation
  const speed = v3Len(newState.v);
  const aeroResult = simulateAerodynamics(
    speed,
    newState.yawVel,
    environment.airDensity,
    newState.downforce,
    newState.dragCoefficient,
    2.0, // frontal area
    newState.yaw,
    environment.windVelocity
  );
  
  // Apply aerodynamic forces
  const dragForce = v3Scale(v3Normalize(newState.v), -aeroResult.drag);
  newState.v = v3Add(newState.v, v3Scale(dragForce, dt / config.mass));
  
  // Weight transfer calculation
  const weightTransfer = simulateSuspension(
    newState.v,
    newState.roll,
    newState.pitch,
    { x: newState.v.x, y: newState.v.y, z: newState.v.z },
    {
      stiffness: { front: 80000, rear: 90000 },
      damping: { compression: 8000, rebound: 9000 },
      antiRoll: { front: 15000, rear: 12000 },
      rideHeight: { front: 0.15, rear: 0.15 }
    },
    config.mass,
    config.wheelbase,
    config.trackWidth,
    { front: 180000, rear: 140000 }
  );
  
  newState.weightTransfer = v3(weightTransfer.weightTransfer.lateral, 0, weightTransfer.weightTransfer.longitudinal);
  
  // Apply gravity
  newState.v.y -= PHYSICS_CONSTANTS.GRAVITY * dt;
  
  // Update position
  newState.p = v3Add(newState.p, v3Scale(newState.v, dt));
  
  // Ground contact and suspension
  const groundHeight = surfaceInfo.height + 0.55; // ride height + wheel radius
  if (newState.p.y <= groundHeight) {
    newState.p.y = groundHeight;
    if (newState.v.y < -5) {
      newState.v.y = -newState.v.y * 0.3; // bounce
    } else {
      newState.v.y = 0;
    }
    newState.grounded = true;
  } else {
    newState.grounded = false;
  }
  
  // Update engine RPM based on speed and gear
  const gearRatio = transmissionConfig.ratios[newGear - 1];
  const finalDrive = transmissionConfig.finalDrive;
  const wheelRPM = (speed / 0.33) * 60 / (2 * Math.PI); // speed / circumference * gear ratio
  newState.engineRPM = wheelRPM * gearRatio * finalDrive * 0.95;
  
  // Update fuel level
  newState.fuelLevel = Math.max(0, newState.fuelLevel - engineResult.fuelConsumption * dt);
  
  // Update lap timing
  if (newState.grounded) {
    newState.currentLapTime += dt;
    if (newState.s < 0.1 && state.s > 0.8) {
      // Lap completed
      newState.lapTimes.push(newState.currentLapTime);
      newState.bestLapTime = Math.min(newState.bestLapTime, newState.currentLapTime);
      newState.currentLapTime = 0;
      newState.lap++;
    }
  }
  
  // Update telemetry
  newState.totalDistance += speed * dt;
  newState.topSpeed = Math.max(newState.topSpeed, speed);
  newState.averageSpeed = newState.totalDistance / (newState.lapTimes.length * 60 + newState.currentLapTime);
  
  return newState;
}