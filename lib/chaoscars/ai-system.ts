import type { CarInput, CarState, Track, WeatherCondition, BotProfile } from "./types";
import type { Vec3 } from "./vec3";
import { v3, v3Add, v3Sub, v3Scale, v3Dot, v3Len, v3Normalize, v3Cross } from "./vec3";

// AI Decision making system
export type AIDecision = {
  throttle: number;
  steering: number;
  brake: number;
  targetSpeed: number;
  cornerApproach: {
    brakePoint: Vec3;
    turnIn: Vec3;
    apex: Vec3;
    exit: Vec3;
  };
  overtake: {
    shouldAttempt: boolean;
    target: string | null;
    maneuver: "draft" | "outbrake" | "slipstream" | "divebomb" | "defend";
  };
  pitDecision: {
    shouldPit: boolean;
    pitWindow: number;
    tireStrategy: "ultra-soft" | "soft" | "medium" | "hard" | "intermediate" | "wet";
  };
  weather: {
    rainSetup: boolean;
    cautiousLevel: number;
    adaptive: boolean;
  };
};

// AI Sensory data
export type AISensory = {
  position: number;
  relativePositions: { playerId: string; distance: number; angle: number; speed: number }[];
  trackConditions: {
    grip: number;
    temperature: number;
    weather: WeatherCondition;
    debris: boolean;
  };
  vehicleState: {
    tireWear: number;
    fuel: number;
    damage: number;
    lapTime: number;
    consistency: number;
  };
  environment: {
    trackWidth: number;
    visibility: number;
    windSpeed: number;
    timeRemaining: number;
  };
};

// AI Memory system for learning and adaptation
export type AIMemory = {
  trackSegments: {
    index: number;
    difficulty: number;
    optimalLine: Vec3[];
    brakePoints: Vec3[];
    exitSpeeds: number[];
    gearUsage: number[];
  }[];
  opponentPatterns: Map<string, {
    aggression: number;
    preferredLines: Vec3[];
    overtakingStyle: string;
    defendingStyle: string;
    weaknessExploits: string[];
  }>;
  performanceHistory: {
    lapTimes: number[];
    consistency: number;
    improvement: number;
    adaptationRate: number;
  };
  weatherAdaptation: {
    rainExperience: number;
    lowGripConfidence: number;
    visibilityAdaptation: number;
  };
};

// Advanced AI Control System
export class AdvancedAIControlSystem {
  private bot: BotProfile;
  private memory: AIMemory;
  private currentDecision: AIDecision;
  private sensory: AISensory;
  private trackKnowledge: {
    bestLines: Map<number, Vec3[]>;
    brakingPoints: Map<number, Vec3>;
    apexes: Map<number, Vec3>;
    gearChanges: Map<number, number>;
    slipstreamZones: { start: Vec3; end: Vec3; quality: number }[];
  };
  
  constructor(bot: BotProfile) {
    this.bot = bot;
    this.memory = this.initializeMemory();
    this.currentDecision = this.initializeDecision();
    this.sensory = this.initializeSensory();
    this.trackKnowledge = this.initializeTrackKnowledge();
  }
  
  private initializeMemory(): AIMemory {
    return {
      trackSegments: [],
      opponentPatterns: new Map(),
      performanceHistory: {
        lapTimes: [],
        consistency: 0.8,
        improvement: 0,
        adaptationRate: 0.1
      },
      weatherAdaptation: {
        rainExperience: 0.5,
        lowGripConfidence: 0.6,
        visibilityAdaptation: 0.4
      }
    };
  }
  
  private initializeDecision(): AIDecision {
    return {
      throttle: 0,
      steering: 0,
      brake: 0,
      targetSpeed: 0,
      cornerApproach: {
        brakePoint: v3(0, 0, 0),
        turnIn: v3(0, 0, 0),
        apex: v3(0, 0, 0),
        exit: v3(0, 0, 0)
      },
      overtake: {
        shouldAttempt: false,
        target: null,
        maneuver: "draft"
      },
      pitDecision: {
        shouldPit: false,
        pitWindow: 0,
        tireStrategy: "medium"
      },
      weather: {
        rainSetup: false,
        cautiousLevel: 0.3,
        adaptive: true
      }
    };
  }
  
  private initializeSensory(): AISensory {
    return {
      position: 1,
      relativePositions: [],
      trackConditions: {
        grip: 1.0,
        temperature: 25,
        weather: {
          type: "clear",
          intensity: 0,
          visibility: 1,
          trackGrip: 1,
          airDensity: 1.225,
          windSpeed: 0,
          windDirection: 0,
          precipitation: 0,
          temperature: 25,
          humidity: 0.5
        },
        debris: false
      },
      vehicleState: {
        tireWear: 0,
        fuel: 1,
        damage: 0,
        lapTime: 0,
        consistency: 1
      },
      environment: {
        trackWidth: 15,
        visibility: 1,
        windSpeed: 0,
        timeRemaining: 0
      }
    };
  }
  
  private initializeTrackKnowledge() {
    return {
      bestLines: new Map(),
      brakingPoints: new Map(),
      apexes: new Map(),
      gearChanges: new Map(),
      slipstreamZones: []
    };
  }
  
  // Main AI decision making process
  public updateAI(
    carState: CarState,
    track: Track,
    opponents: Record<string, CarState>,
    weather: WeatherCondition,
    currentTime: number,
    dt: number
  ): CarInput {
    
    // Update sensory data
    this.updateSensoryData(carState, opponents, weather, track, currentTime);
    
    // Analyze track position and upcoming challenges
    this.analyzeTrackSituation(carState, track, currentTime);
    
    // Make tactical decisions
    this.makeTacticalDecisions(carState, opponents, currentTime);
    
    // Handle driving inputs
    this.handleDrivingInputs(carState, track, dt);
    
    // Adapt to conditions
    this.adaptToConditions(carState, weather, dt);
    
    // Learn from experience
    this.learnAndAdapt(carState, track, currentTime, dt);
    
    return {
      t: currentTime,
      throttle: this.clampInput(this.currentDecision.throttle),
      steer: this.clampInput(this.currentDecision.steering),
      handbrake: this.currentDecision.brake > 0.8,
      boost: false,
      respawn: false
    };
  }
  
  private updateSensoryData(
    carState: CarState,
    opponents: Record<string, CarState>,
    weather: WeatherCondition,
    track: Track,
    currentTime: number
  ): void {
    
    // Update relative position to all opponents
    this.sensory.relativePositions = [];
    const myPos = carState.p;
    
    Object.entries(opponents).forEach(([playerId, opponent]) => {
      const dx = opponent.p.x - myPos.x;
      const dz = opponent.p.z - myPos.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      const angle = Math.atan2(dz, dx) - carState.yaw;
      const speed = v3Len(opponent.v);
      
      this.sensory.relativePositions.push({
        playerId,
        distance,
        angle: this.normalizeAngle(angle),
        speed
      });
    });
    
    // Sort by distance for priority
    this.sensory.relativePositions.sort((a, b) => a.distance - b.distance);
    
    // Update vehicle state perception
    this.sensory.vehicleState = {
      tireWear: this.calculateTireWear(carState),
      fuel: carState.fuelLevel,
      damage: this.calculateTotalDamage(carState),
      lapTime: carState.currentLapTime,
      consistency: this.calculateConsistency(carState)
    };
    
    // Update track conditions
    const surfaceInfo = track.getSurfaceInfo(carState.p.x, carState.p.z);
    this.sensory.trackConditions = {
      grip: surfaceInfo.onRoad ? 1.0 : 0.7,
      temperature: 25 + Math.random() * 10, // Would be from weather system
      weather,
      debris: this.detectDebris(carState, track)
    };
    
    // Update environment
    this.sensory.environment = {
      trackWidth: track.roadWidth,
      visibility: weather.visibility,
      windSpeed: weather.windSpeed,
      timeRemaining: Math.max(0, 180000 - currentTime) // 3 minutes default
    };
  }
  
  private analyzeTrackSituation(carState: CarState, track: Track, currentTime: number): void {
    const surfaceInfo = track.getSurfaceInfo(carState.p.x, carState.p.z);
    const nextCheckpoint = (carState.lastCp + 1) % track.checkpoints.length;
    const targetCp = track.checkpoints[nextCheckpoint];
    
    // Calculate corner approach
    this.calculateCornerApproach(carState, targetCp, track);
    
    // Analyze upcoming track features
    this.analyzeTrackFeatures(carState, track, currentTime);
    
    // Calculate optimal racing line
    this.calculateOptimalLine(carState, track);
  }
  
  private calculateCornerApproach(carState: CarState, targetCp: any, track: Track): void {
    const myPos = carState.p;
    const distance = Math.sqrt(
      Math.pow(targetCp.p.x - myPos.x, 2) + Math.pow(targetCp.p.z - myPos.z, 2)
    );
    
    const approachSpeed = v3Len(carState.v);
    
    // Calculate braking distance based on grip and speed
    const gripLevel = this.sensory.trackConditions.grip * (1 - this.sensory.vehicleState.damage * 0.3);
    const brakingDistance = Math.max(
      targetCp.radius * 1.5,
      (approachSpeed * approachSpeed) / (2 * 15 * gripLevel) // Physics-based braking
    );
    
    // Braking point calculation
    const dx = targetCp.p.x - myPos.x;
    const dz = targetCp.p.z - myPos.z;
    const distanceToTarget = Math.sqrt(dx * dx + dz * dz);
    const brakeRatio = Math.min(1, brakingDistance / Math.max(1, distanceToTarget));
    
    const brakePoint = v3(
      myPos.x + dx * brakeRatio,
      myPos.y,
      myPos.z + dz * brakeRatio
    );
    
    // Turn-in point (typically 2/3 of the way to apex)
    const turnInRatio = 0.67;
    const turnIn = v3(
      myPos.x + dx * turnInRatio,
      myPos.y,
      myPos.z + dz * turnInRatio
    );
    
    // Apex point (closest point to the inside of the corner)
    const apexRatio = 0.4;
    const apex = v3(
      myPos.x + dx * apexRatio,
      myPos.y,
      myPos.z + dz * apexRatio
    );
    
    // Exit point (after apex, looking for maximum speed)
    const exitRatio = 1.3;
    const exit = v3(
      myPos.x + dx * exitRatio,
      myPos.y,
      myPos.z + dz * exitRatio
    );
    
    this.currentDecision.cornerApproach = {
      brakePoint,
      turnIn,
      apex,
      exit
    };
  }
  
  private analyzeTrackFeatures(carState: CarState, track: Track, currentTime: number): void {
    // Detect upcoming track hazards
    const hazardProbability = this.bot.behavior.aggression * 0.1;
    
    // Weather-specific adjustments
    if (this.sensory.trackConditions.weather.type === "rain") {
      this.currentDecision.weather.cautiousLevel = Math.max(
        0.3,
        this.bot.behavior.caution + 0.4
      );
    }
    
    // Traffic management
    const nearbyOpponents = this.sensory.relativePositions.filter(opp => opp.distance < 50);
    if (nearbyOpponents.length > 0) {
      const closest = nearbyOpponents[0];
      this.currentDecision.overtake.shouldAttempt = this.shouldAttemptOvertake(
        carState,
        closest,
        track
      );
      
      if (this.currentDecision.overtake.shouldAttempt) {
        this.currentDecision.overtake.target = closest.playerId;
        this.currentDecision.overtake.maneuver = this.selectOvertakeManeuver(
          carState,
          closest,
          track
        );
      }
    }
  }
  
  private shouldAttemptOvertake(
    carState: CarState,
    opponent: any,
    track: Track
  ): boolean {
    const relativeSpeed = carState.p.speed - opponent.speed;
    const distance = opponent.distance;
    const angleDiff = Math.abs(opponent.angle);
    
    // Conditions for overtaking
    const speedAdvantage = relativeSpeed > 5; // Must be faster
    const angleAdvantage = angleDiff < Math.PI / 3; // Not too much angle difference
    const distanceAdvantage = distance < 30; // Close enough
    
    // Bot personality modifiers
    const aggressionFactor = this.bot.behavior.aggression;
    const blockingFactor = 1 - this.bot.behavior.courtesy;
    
    return (
      speedAdvantage &&
      angleAdvantage &&
      distanceAdvantage &&
      Math.random() < (aggressionFactor + blockingFactor) * 0.3
    );
  }
  
  private selectOvertakeManeuver(
    carState: CarState,
    opponent: any,
    track: Track
  ): "draft" | "outbrake" | "slipstream" | "divebomb" | "defend" {
    const relativeSpeed = v3Len(carState.v) - opponent.speed;
    const distance = opponent.distance;
    
    if (relativeSpeed > 10 && distance < 15) {
      return "divebomb"; // High speed, close distance
    } else if (distance < 25 && opponent.speed > 80) {
      return "slipstream"; // Use draft behind faster car
    } else if (distance < 20 && opponent.speed < 60) {
      return "outbrake"; // Outbrake into corner
    } else if (distance < 30 && this.bot.behavior.aggression > 0.7) {
      return "draft"; // Aggressive drafting
    } else {
      return "defend"; // Default to defending position
    }
  }
  
  private calculateOptimalLine(carState: CarState, track: Track): void {
    const surfaceInfo = track.getSurfaceInfo(carState.p.x, carState.p.z);
    const myPos = carState.p;
    const forward = v3(Math.cos(carState.yaw), 0, Math.sin(carState.yaw));
    
    // Predictive line calculation based on vehicle speed and grip
    const lookaheadDistance = v3Len(carState.v) * 2 + 20;
    const lineQuality = this.calculateLineQuality(carState, track);
    
    // Adjust line based on conditions
    let adjustedLookahead = lookaheadDistance;
    if (this.sensory.trackConditions.weather.type === "rain") {
      adjustedLookahead *= 1.5; // Need more lookahead in poor visibility
    }
    
    if (this.sensory.vehicleState.tireWear > 0.6) {
      adjustedLookahead *= 1.2; // More lookahead with worn tires
    }
    
    this.currentDecision.targetSpeed = this.calculateTargetSpeed(
      carState,
      surfaceInfo,
      lineQuality
    );
  }
  
  private handleDrivingInputs(carState: CarState, track: Track, dt: number): void {
    const myPos = carState.p;
    const corner = this.currentDecision.cornerApproach;
    const mySpeed = v3Len(carState.v);
    
    // Steering logic
    this.currentDecision.steering = this.calculateSteeringInput(
      carState,
      corner,
      track,
      dt
    );
    
    // Throttle and brake logic
    if (this.currentDecision.overtake.shouldAttempt) {
      this.handleOvertaking(carState, dt);
    } else {
      this.handleNormalRacing(carState, track, dt);
    }
    
    // Adapt to grip conditions
    this.adaptToGrip(carState, track, dt);
  }
  
  private handleOvertaking(carState: CarState, dt: number): void {
    const targetOpp = this.sensory.relativePositions.find(
      opp => opp.playerId === this.currentDecision.overtake.target
    );
    
    if (!targetOpp) return;
    
    const maneuver = this.currentDecision.overtake.maneuver;
    const mySpeed = v3Len(carState.v);
    
    switch (maneuver) {
      case "divebomb":
        this.currentDecision.throttle = 1.0;
        this.currentDecision.brake = 0;
        this.currentDecision.steering *= 1.2; // More aggressive steering
        break;
        
      case "slipstream":
        this.currentDecision.throttle = 0.8; // Maintain speed for drafting
        this.currentDecision.brake = 0;
        break;
        
      case "outbrake":
        const brakePoint = this.currentDecision.cornerApproach.brakePoint;
        const distToBrake = Math.sqrt(
          Math.pow(carState.p.x - brakePoint.x, 2) +
          Math.pow(carState.p.z - brakePoint.z, 2)
        );
        
        if (distToBrake < 20) {
          this.currentDecision.brake = 0.8; // Late braking
          this.currentDecision.throttle = 0.4;
        } else {
          this.currentDecision.brake = 0;
          this.currentDecision.throttle = 0.9;
        }
        break;
        
      default:
        this.handleNormalRacing(carState, null, dt);
    }
  }
  
  private handleNormalRacing(carState: CarState, track: Track | null, dt: number): void {
    const mySpeed = v3Len(carState.v);
    const targetSpeed = this.currentDecision.targetSpeed;
    const surfaceGrip = this.sensory.trackConditions.grip;
    
    // Speed control
    if (mySpeed > targetSpeed * 1.1) {
      this.currentDecision.brake = Math.min(1, (mySpeed - targetSpeed) / 50);
      this.currentDecision.throttle = 0;
    } else if (mySpeed < targetSpeed * 0.9) {
      this.currentDecision.throttle = Math.min(1, (targetSpeed - mySpeed) / 30);
      this.currentDecision.brake = 0;
    } else {
      this.currentDecision.throttle = 0.6; // Maintain speed
      this.currentDecision.brake = 0;
    }
    
    // Weather adjustments
    if (this.sensory.trackConditions.weather.type === "rain") {
      this.currentDecision.throttle *= 0.8; // Less aggressive throttle in rain
      this.currentDecision.brake *= 1.2; // More brake needed
    }
    
    // Tire wear adjustments
    if (this.sensory.vehicleState.tireWear > 0.5) {
      this.currentDecision.throttle *= 0.9;
      this.currentDecision.brake *= 1.1;
    }
  }
  
  private adaptToGrip(carState: CarState, track: Track, dt: number): void {
    const surfaceInfo = track.getSurfaceInfo(carState.p.x, carState.p.z);
    const gripLevel = surfaceInfo.onRoad ? 1.0 : 0.6;
    
    // Adjust steering based on available grip
    const maxSteeringRate = gripLevel * 2.5; // rad/s
    const currentYawRate = Math.abs(carState.yawVel);
    
    if (currentYawRate > maxSteeringRate) {
      this.currentDecision.steering *= maxSteeringRate / currentYawRate;
    }
    
    // Reduce throttle in low grip conditions
    if (gripLevel < 0.7) {
      this.currentDecision.throttle *= gripLevel;
    }
  }
  
  private adaptToConditions(carState: CarState, weather: WeatherCondition, dt: number): void {
    const adaptationRate = this.bot.behavior.learning ? this.bot.behavior.experience : 0.1;
    
    // Weather adaptation
    if (weather.type === "rain") {
      this.memory.weatherAdaptation.rainExperience = Math.min(
        1,
        this.memory.weatherAdaptation.rainExperience + adaptationRate * dt
      );
      this.currentDecision.weather.cautiousLevel = Math.max(
        0.3,
        0.8 - this.memory.weatherAdaptation.rainExperience * 0.5
      );
    }
    
    // Fuel management
    if (carState.fuelLevel < 0.15) {
      // Fuel saving mode
      this.currentDecision.throttle = Math.min(this.currentDecision.throttle, 0.7);
      this.currentDecision.pitDecision.shouldPit = true;
      this.currentDecision.pitDecision.pitWindow = 2; // Next 2 laps
    }
    
    // Tire wear management
    if (this.sensory.vehicleState.tireWear > 0.8) {
      this.currentDecision.pitDecision.shouldPit = true;
      this.currentDecision.pitDecision.tireStrategy = this.selectTireStrategy();
    }
  }
  
  private learnAndAdapt(carState: CarState, track: Track, currentTime: number, dt: number): void {
    // Update performance history
    if (carState.currentLapTime > 0) {
      this.memory.performanceHistory.lapTimes.push(carState.currentLapTime);
      
      // Keep only recent lap times
      if (this.memory.performanceHistory.lapTimes.length > 5) {
        this.memory.performanceHistory.lapTimes.shift();
      }
      
      // Calculate consistency
      this.memory.performanceHistory.consistency = this.calculateLapConsistency();
      
      // Learning from opponent behavior
      this.learnOpponentPatterns(carState, track);
    }
    
    // Adapt behavior based on performance
    this.adaptBehavior(carState, dt);
  }
  
  private learnOpponentPatterns(carState: CarState, track: Track): void {
    this.sensory.relativePositions.forEach(opponent => {
      let pattern = this.memory.opponentPatterns.get(opponent.playerId);
      
      if (!pattern) {
        pattern = {
          aggression: 0.5,
          preferredLines: [],
          overtakingStyle: "normal",
          defendingStyle: "normal",
          weaknessExploits: []
        };
      }
      
      // Update aggression based on observed behavior
      if (opponent.speed > v3Len(carState.v) + 10) {
        pattern.aggression += 0.01;
      } else if (opponent.speed < v3Len(carState.v) - 10) {
        pattern.aggression -= 0.01;
      }
      
      // Keep aggression within bounds
      pattern.aggression = Math.max(0, Math.min(1, pattern.aggression));
      
      this.memory.opponentPatterns.set(opponent.playerId, pattern);
    });
  }
  
  private adaptBehavior(carState: CarState, dt: number): void {
    const consistency = this.memory.performanceHistory.consistency;
    const experience = this.bot.behavior.experience;
    
    // Adapt aggression based on performance
    if (consistency > 0.8) {
      this.bot.behavior.aggression = Math.min(
        1,
        this.bot.behavior.aggression + 0.1 * dt * experience
      );
    } else if (consistency < 0.5) {
      this.bot.behavior.aggression = Math.max(
        0.3,
        this.bot.behavior.aggression - 0.1 * dt * experience
      );
    }
    
    // Adapt to track experience
    if (experience < 0.5) {
      // Less experienced bots are more cautious
      this.currentDecision.weather.cautiousLevel += 0.2 * (1 - experience) * dt;
    }
  }
  
  // Helper methods
  private calculateSteeringInput(
    carState: CarState,
    corner: any,
    track: Track,
    dt: number
  ): number {
    const myPos = carState.p;
    const myYaw = carState.yaw;
    const mySpeed = v3Len(carState.v);
    
    // Look-ahead steering based on speed
    const lookAheadDistance = Math.max(5, mySpeed * 0.5 + 10);
    
    // Calculate steering to follow optimal line
    const dx = corner.turnIn.x - myPos.x;
    const dz = corner.turnIn.z - myPos.z;
    const targetYaw = Math.atan2(dz, dx);
    
    let yawDiff = targetYaw - myYaw;
    while (yawDiff > Math.PI) yawDiff -= 2 * Math.PI;
    while (yawDiff < -Math.PI) yawDiff += 2 * Math.PI;
    
    // Steering sensitivity based on speed (less responsive at high speed)
    const steeringSensitivity = Math.max(0.3, 1 - mySpeed * 0.02);
    const steeringInput = yawDiff * steeringSensitivity;
    
    return Math.max(-1, Math.min(1, steeringInput));
  }
  
  private calculateTargetSpeed(carState: CarState, surfaceInfo: any, lineQuality: number): number {
    const baseSpeed = 100; // km/h base
    
    // Adjust based on grip level
    const gripMultiplier = surfaceInfo.onRoad ? 1.0 : 0.7;
    
    // Adjust based on vehicle damage
    const damagePenalty = 1 - (this.sensory.vehicleState.damage * 0.3);
    
    // Adjust based on tire wear
    const tirePenalty = 1 - (this.sensory.vehicleState.tireWear * 0.2);
    
    // Weather adjustments
    let weatherPenalty = 1.0;
    if (this.sensory.trackConditions.weather.type === "rain") {
      weatherPenalty = 0.8;
    } else if (this.sensory.trackConditions.weather.type === "snow") {
      weatherPenalty = 0.6;
    }
    
    const targetSpeed = baseSpeed * gripMultiplier * damagePenalty * tirePenalty * weatherPenalty * lineQuality;
    
    return Math.max(30, targetSpeed); // Minimum speed
  }
  
  private calculateLineQuality(carState: CarState, track: Track): number {
    // Simple line quality calculation based on position relative to track center
    const surfaceInfo = track.getSurfaceInfo(carState.p.x, carState.p.z);
    const distanceFromCenter = surfaceInfo.distToCenter;
    const trackHalfWidth = track.roadWidth / 2;
    
    const centerPenalty = Math.max(0, distanceFromCenter / trackHalfWidth);
    const lineQuality = Math.max(0.3, 1 - centerPenalty);
    
    return lineQuality;
  }
  
  private calculateTireWear(carState: CarState): number {
    // Calculate average tire wear
    const tires = carState.tireWear;
    return (tires.frontLeft + tires.frontRight + tires.rearLeft + tires.rearRight) / 4;
  }
  
  private calculateTotalDamage(carState: CarState): number {
    return (
      carState.bodyDamage +
      carState.frontDamage +
      carState.rearDamage +
      carState.leftSideDamage +
      carState.rightSideDamage
    ) / 5;
  }
  
  private calculateConsistency(carState: CarState): number {
    // Calculate lap time consistency (would need historical data)
    const lapTimes = carState.lapTimes;
    if (lapTimes.length < 2) return 1.0;
    
    // Simple variance calculation
    const average = lapTimes.reduce((a, b) => a + b) / lapTimes.length;
    const variance = lapTimes.reduce((sum, time) => sum + Math.pow(time - average, 2), 0) / lapTimes.length;
    const stdDev = Math.sqrt(variance);
    
    // Convert to consistency score (1 = perfect consistency, 0 = highly inconsistent)
    const maxStdDev = 5.0; // 5 seconds variance threshold
    return Math.max(0, 1 - (stdDev / maxStdDev));
  }
  
  private calculateLapConsistency(): number {
    const lapTimes = this.memory.performanceHistory.lapTimes;
    if (lapTimes.length < 2) return 1.0;
    
    const average = lapTimes.reduce((a, b) => a + b) / lapTimes.length;
    const variance = lapTimes.reduce((sum, time) => sum + Math.pow(time - average, 2), 0) / lapTimes.length;
    const stdDev = Math.sqrt(variance);
    
    const maxStdDev = 3.0;
    return Math.max(0, 1 - (stdDev / maxStdDev));
  }
  
  private detectDebris(carState: CarState, track: Track): boolean {
    // Simple debris detection based on unexpected slip or position
    const surfaceInfo = track.getSurfaceInfo(carState.p.x, carState.p.z);
    const unexpectedSlip = !surfaceInfo.onRoad && carState.grounded;
    
    return unexpectedSlip;
  }
  
  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }
  
  private selectTireStrategy(): "ultra-soft" | "soft" | "medium" | "hard" | "intermediate" | "wet" {
    const weather = this.sensory.trackConditions.weather;
    
    if (weather.type === "rain" || weather.type === "storm") {
      return "wet";
    } else if (weather.type === "snow") {
      return "intermediate";
    } else if (carState.fuelLevel < 0.3) {
      return "hard"; // Longer lasting tire
    } else {
      return "medium"; // Balanced option
    }
  }
  
  private clampInput(value: number): number {
    return Math.max(-1, Math.min(1, value));
  }
  
  // Public methods for external access
  public getCurrentDecision(): AIDecision {
    return { ...this.currentDecision };
  }
  
  public getMemory(): AIMemory {
    return { ...this.memory };
  }
  
  public getBotProfile(): BotProfile {
    return { ...this.bot };
  }
  
  public updateBotProfile(newProfile: BotProfile): void {
    this.bot = { ...newProfile };
  }
}

// Factory function to create AI controllers
export function createAIController(botProfile: BotProfile): AdvancedAIControlSystem {
  return new AdvancedAIControlSystem(botProfile);
}

// Predefined bot profiles for different difficulties and personalities
export const BOT_PROFILES: Record<string, BotProfile> = {
  beginner: {
    id: "beginner",
    name: "Rookie",
    behavior: {
      aggression: 0.3,
      skill: 0.4,
      consistency: 0.5,
      unpredictability: 0.3,
      blocking: 0.2,
      courtesy: 0.8,
      learning: true,
      experience: 0.2,
      confidence: 0.3
    },
    car: {
      setup: "conservative",
      parts: {},
      tuning: {}
    },
    personality: {
      taunts: ["I'm still learning!", "This is harder than it looks!"],
      celebrating: "minimal",
      frustration: 0.7,
      loyalty: 0.6
    },
    stats: {
      races: 10,
      wins: 1,
      podiums: 3,
      consistency: 0.5,
      adaptability: 0.4
    }
  },
  
  intermediate: {
    id: "intermediate", 
    name: "Competitor",
    behavior: {
      aggression: 0.6,
      skill: 0.7,
      consistency: 0.7,
      unpredictability: 0.5,
      blocking: 0.5,
      courtesy: 0.6,
      learning: true,
      experience: 0.6,
      confidence: 0.7
    },
    car: {
      setup: "balanced",
      parts: {},
      tuning: {}
    },
    personality: {
      taunts: ["Not bad!", "Let's see what you've got!"],
      celebrating: "normal",
      frustration: 0.4,
      loyalty: 0.7
    },
    stats: {
      races: 50,
      wins: 12,
      podiums: 25,
      consistency: 0.7,
      adaptability: 0.7
    }
  },
  
  expert: {
    id: "expert",
    name: "Veteran", 
    behavior: {
      aggression: 0.8,
      skill: 0.9,
      consistency: 0.9,
      unpredictability: 0.6,
      blocking: 0.7,
      courtesy: 0.4,
      learning: true,
      experience: 0.9,
      confidence: 0.9
    },
    car: {
      setup: "aggressive",
      parts: {},
      tuning: {}
    },
    personality: {
      taunts: ["Amateur!", "Too slow!", "Keep up!"],
      celebrating: "excessive",
      frustration: 0.2,
      loyalty: 0.8
    },
    stats: {
      races: 200,
      wins: 85,
      podiums: 150,
      consistency: 0.9,
      adaptability: 0.9
    }
  },
  
  champion: {
    id: "champion",
    name: "World Champion",
    behavior: {
      aggression: 0.9,
      skill: 0.95,
      consistency: 0.95,
      unpredictability: 0.8,
      blocking: 0.8,
      courtesy: 0.3,
      learning: true,
      experience: 1.0,
      confidence: 1.0
    },
    car: {
      setup: "custom",
      parts: {},
      tuning: {}
    },
    personality: {
      taunts: ["Pathetic!", "Is that all?", "I've seen faster snails!"],
      celebrating: "excessive",
      frustration: 0.1,
      loyalty: 0.9
    },
    stats: {
      races: 500,
      wins: 300,
      podiums: 420,
      consistency: 0.95,
      adaptability: 1.0
    }
  }
};