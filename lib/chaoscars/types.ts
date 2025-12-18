import type { Vec3 } from "./vec3";

export type PlayerId = string;

export type PlayerInfo = {
  id: PlayerId;
  name: string;
  color: string;
  rating: number;
  wins: number;
  losses: number;
  totalRaces: number;
  bestLapTime: number;
  achievements: string[];
  lastActive: number;
  preferences: {
    sensitivity: number;
    invertY: boolean;
    fov: number;
    graphics: "low" | "medium" | "high" | "ultra";
  };
};

export type CarInput = {
  t: number;
  throttle: number;
  steer: number;
  handbrake: boolean;
  boost: boolean;
  respawn: boolean;
};

export type CarState = {
  p: Vec3;
  v: Vec3;
  yaw: number;
  yawVel: number;
  pitch: number;
  roll: number;
  grounded: boolean;
  boostCd: number;
  lap: number;
  s: number;
  lastCp: number;
  finished: boolean;
  alive: boolean;
  lastHitAt: number;
  
  // Advanced physics
  angularVel: Vec3;
  engineRPM: number;
  engineHealth: number;
  transmissionGear: number;
  clutchEngaged: boolean;
  
  // Tire and surface interaction
  tireWear: { frontLeft: number; frontRight: number; rearLeft: number; rearRight: number };
  tireTemperature: { frontLeft: number; frontRight: number; rearLeft: number; rearRight: number };
  tireGrip: { frontLeft: number; frontRight: number; rearLeft: number; rearRight: number };
  tirePressure: { frontLeft: number; frontRight: number; rearLeft: number; rearRight: number };
  
  // Aerodynamics
  downforce: number;
  dragCoefficient: number;
  aerodynamicBalance: number; // -1 to 1 (rear-biased to front-biased)
  
  // Damage system
  bodyDamage: number; // 0-100
  frontDamage: number;
  rearDamage: number;
  leftSideDamage: number;
  rightSideDamage: number;
  suspensionDamage: { front: number; rear: number };
  
  // Performance effects
  enginePowerLoss: number; // 0-1 (0 = full power, 1 = no power)
  handlingLoss: number; // 0-1
  stabilityLoss: number; // 0-1
  
  // Fuel system
  fuelLevel: number; // 0-1
  fuelConsumption: number;
  
  // Advanced dynamics
  weightTransfer: Vec3;
  centerOfMassOffset: Vec3;
  rotationalInertia: number;
  
  // Environmental interaction
  surfaceType: "asphalt" | "concrete" | "grass" | "dirt" | "metal" | "wood";
  waterLevel: number; // 0-1 submersion level
  accumulatedWater: number; // for splash effects
  mudAccumulation: number; // 0-1
  
  // Visual and audio effects
  exhaustSmokeLevel: number;
  damageSmokeLevel: number;
  dustTrailLevel: number;
  
  // Telemetry and statistics
  lapTimes: number[];
  currentLapTime: number;
  bestLapTime: number;
  totalDistance: number;
  averageSpeed: number;
  topSpeed: number;
  
  // Input response
  inputLatency: number;
  steeringResponse: number;
  throttleResponse: number;
  brakeResponse: number;
  
  // Specialized states
  nitroActive: boolean;
  nitroTimeLeft: number;
  emsActive: boolean;
  emsTimeLeft: number;
  invincibleUntil: number;
  
  // Suspension system
  suspensionCompression: { frontLeft: number; frontRight: number; rearLeft: number; rearRight: number };
  suspensionVelocity: { frontLeft: number; frontRight: number; rearLeft: number; rearRight: number };
  rideHeight: { frontLeft: number; frontRight: number; rearLeft: number; rearRight: number };
  
  // Wheel physics
  wheelAngularVel: { frontLeft: number; frontRight: number; rearLeft: number; rearRight: number };
  wheelSlip: { frontLeft: number; frontRight: number; rearLeft: number; rearRight: number };
  brakeForce: { frontLeft: number; frontRight: number; rearLeft: number; rearRight: number };
  
  // Anti-lock braking system
  absActive: boolean;
  absLevel: number;
  
  // Traction control
  tcsActive: boolean;
  tcsLevel: number;
  tcsIntervention: number;
  
  // Stability control
  escActive: boolean;
  escIntervention: Vec3;
  yawStability: number;
  
  // Aero effects
  slipStream: { active: boolean; strength: number };
  draftingBonus: number;
  airDensity: number;
  windResistance: Vec3;
  
  // Track position and surface details
  trackPosition: {
    lat: number; // lateral position on track (-1 to 1)
    surfaceTemp: number;
    gripLevel: number;
    rollingResistance: number;
    sideForce: number;
  };
};

export type MatchMode = "race" | "checkpointChaos" | "elimination" | "circuitChampionship" | "timeAttack" | "drift" | "destruction" | "sprint" | "endurance";

export type WeatherCondition = {
  type: "clear" | "rain" | "snow" | "fog" | "storm" | "hail" | "tornado" | "night";
  intensity: number; // 0-1
  visibility: number; // 0-1
  trackGrip: number; // 0-1
  airDensity: number; // affects aerodynamics
  windSpeed: number;
  windDirection: number; // radians
  precipitation: number; // 0-1
  temperature: number; // celsius
  humidity: number; // 0-1
};

export type MatchSettings = {
  mode: MatchMode;
  laps: number;
  checkpointCount: number;
  durationMs: number;
  
  // Advanced settings
  weather: WeatherCondition;
  timeOfDay: number; // 0-24 hours
  trackLength: number;
  difficulty: "easy" | "normal" | "hard" | "expert" | "nightmare";
  
  // Gameplay modifiers
  damageMultiplier: number; // 0-3
  fuelConsumption: number; // 0.5-2.0
  tireWearRate: number; // 0.5-2.0
  boostMultiplier: number; // 0.5-2.0
  
  // Advanced race modes
  pitStopsRequired: number;
  tireStrategy: "fixed" | "adaptive" | "playerChoice";
  fuelStrategy: "fixed" | "adaptive" | "playerChoice";
  
  // Environmental modifiers
  gravity: number; // affects jump distance
  airResistance: number; // affects top speed
  surfaceGrip: number; // base grip multiplier
  roadDamage: number; // how track degrades over time
  
  // Tournament settings
  pointsSystem: "standard" | "f1" | "rally" | "circuit";
  championshipRounds: number;
  qualifyingSession: boolean;
  practiceSession: boolean;
  
  // Power-ups and items
  powerUps: string[]; // available power-ups
  itemFrequency: number; // 0-1 spawn rate
  powerUpStrength: number; // 0.5-2.0
  
  // AI and assistance
  aiDifficulty: number; // 0-1
  assists: {
    abs: boolean;
    tcs: boolean;
    esc: boolean;
    autoClutch: boolean;
    autoBrake: boolean;
    autoSteer: boolean;
    pitAssist: boolean;
  };
};

export type MatchRuntime = {
  running: boolean;
  settings: MatchSettings | null;
  seed: string;
  startTime: number;
  endTime: number;
  finishedOrder: PlayerId[];
  eliminated: PlayerId[];
  chaosTargetCp: number;
  scores: Record<PlayerId, number>;
  
  // Advanced race management
  currentLapTimes: Record<PlayerId, number>;
  lapCounts: Record<PlayerId, number>;
  pitStopCounts: Record<PlayerId, number>;
  penalties: Record<PlayerId, number>;
  
  // Weather and environment progression
  weatherTransition: {
    startTime: number;
    endTime: number;
    fromWeather: WeatherCondition;
    toWeather: WeatherCondition;
  } | null;
  
  // Championship standings
  championshipStandings: Record<PlayerId, {
    points: number;
    position: number;
    podiums: number;
    poles: number;
    fastestLaps: number;
    totalPoints: number;
  }>;
  
  // Session times
  qualifyingTime: Record<PlayerId, number>;
  practiceTime: Record<PlayerId, number>;
  polePosition: PlayerId | null;
  
  // Track condition
  trackState: {
    grip: number; // 0-1, changes with weather and wear
    surfaceTemp: number;
    rubber: number; // 0-1, accumulates from racing
    debris: number; // 0-1, obstacles on track
    oil: number; // 0-1, slippery spots
  };
  
  // Event management
  eventFlags: {
    yellowFlag: boolean;
    redFlag: boolean;
    blueFlag: boolean;
    blackFlag: PlayerId | null;
    whiteFlag: boolean;
    chequeredFlag: boolean;
  };
  
  // Timing and scoring
  fastestLap: {
    time: number;
    player: PlayerId;
    lap: number;
  } | null;
  
  // Special events
  events: Array<{
    type: "spin" | "collision" | "wall" | "offTrack" | "pitStop" | "powerup" | "overtake";
    time: number;
    players: PlayerId[];
    description: string;
  }>;
  
  // Track-specific features
  trackHazards: Array<{
    position: Vec3;
    type: "oil" | "gravel" | "debris" | "puddle" | "ice";
    radius: number;
    intensity: number;
    lifetime: number;
  }>;
  
  // Ghost racing
  ghostRaces: Record<PlayerId, {
    active: boolean;
    data: Array<{
      t: number;
      p: Vec3;
      yaw: number;
      pitch: number;
      roll: number;
    }>;
    currentIndex: number;
  }>;
};

export type Snapshot = {
  t: number;
  cars: Record<PlayerId, CarState>;
  match: MatchRuntime;
  
  // Advanced snapshot data
  physics: {
    frameId: number;
    deterministicSeed: number;
    frameLag: number;
    serverTime: number;
  };
  
  // Environmental state
  environment: {
    globalWind: Vec3;
    airDensity: number;
    visibility: number;
    precipitation: number;
    temperature: number;
    trackTemperature: number;
  };
  
  // Network optimization
  compressed: boolean;
  priority: "low" | "normal" | "high" | "critical";
  recipients: PlayerId[];
};

export type HostClaim = {
  term: number;
  hostId: PlayerId;
};

export type StartMatchMsg = {
  settings: MatchSettings;
  seed: string;
  startAt: number;
  
  // Advanced match starting
  qualifyingResults: Record<PlayerId, number>;
  gridPositions: PlayerId[];
  rules: {
    penaltyEnabled: boolean;
    collisionDamage: boolean;
    vehicleDamage: boolean;
    fuelDepletion: boolean;
    tireWear: boolean;
  };
  trackConditions: {
    grip: number;
    rubber: number;
    surfaceTemp: number;
    airTemp: number;
  };
};

export type EndMatchMsg = {
  finishedOrder: PlayerId[];
  eliminated: PlayerId[];
  
  // Comprehensive race results
  detailedResults: Record<PlayerId, {
    position: number;
    totalTime: number;
    bestLap: number;
    fastestLap: number;
    lapsCompleted: number;
    penalties: number;
    points: number;
    championshipPoints: number;
    lapTimes: number[];
    incidents: number;
    overtakeCount: number;
    averageSpeed: number;
    maxSpeed: number;
    energyUsed: number;
    efficiency: number;
  }>;
  
  // Race statistics
  raceStats: {
    totalDistance: number;
    fastestLap: number;
    averageLapTime: number;
    trackRecord: boolean;
    weather: WeatherCondition;
    conditions: {
      grip: number;
      temp: number;
      wind: number;
    };
  };
  
  // Achievement unlocks
  achievements: Record<PlayerId, string[]>;
  records: {
    trackRecord: {
      time: number;
      player: PlayerId;
      date: number;
    };
    fastestLap: {
      time: number;
      player: PlayerId;
      lap: number;
    };
    mostOvertakes: {
      count: number;
      player: PlayerId;
    };
  };
};

// Power-up and item system
export type PowerUp = {
  id: string;
  type: "boost" | "shield" | "missile" | "EMP" | "oil" | "mud" | "jump" | "nitro" | "repair" | "fuel";
  strength: number; // 0.5-2.0
  duration: number; // seconds
  cooldown: number; // seconds
  maxStack: number;
  visualEffect: string;
  soundEffect: string;
  description: string;
};

export type ItemUsage = {
  player: PlayerId;
  item: PowerUp;
  timestamp: number;
  target?: PlayerId;
  position?: Vec3;
};

// Achievement system
export type Achievement = {
  id: string;
  name: string;
  description: string;
  category: "speed" | "skill" | "endurance" | "social" | "special" | "hidden";
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";
  icon: string;
  requirement: {
    type: "wins" | "laps" | "time" | "speed" | "drift" | "overtakes" | "perfectLap" | "noDamage" | "consistency";
    value: number;
    mode?: MatchMode;
    conditions?: Record<string, any>;
  };
  rewards: {
    xp: number;
    currency: number;
    unlocks?: string[];
  };
};

// Tournament system
export type Tournament = {
  id: string;
  name: string;
  description: string;
  format: "singleElimination" | "doubleElimination" | "roundRobin" | "swiss" | "ladder";
  entryFee: number;
  prizePool: number;
  maxParticipants: number;
  currentParticipants: number;
  rounds: TournamentRound[];
  status: "registration" | "active" | "completed" | "cancelled";
  rules: {
    mode: MatchMode;
    track: string;
    laps: number;
    assists: boolean;
    damage: boolean;
    weather: WeatherCondition | null;
  };
};

export type TournamentRound = {
  round: number;
  matches: TournamentMatch[];
  status: "pending" | "active" | "completed";
};

export type TournamentMatch = {
  id: string;
  participants: PlayerId[];
  results: Record<PlayerId, {
    position: number;
    time: number;
    points: number;
  }>;
  winner: PlayerId | null;
  status: "scheduled" | "active" | "completed" | "forfeited";
  nextMatch?: string;
};

// AI and Bot system
export type AIBehavior = {
  aggression: number; // 0-1, how risky AI drives
  skill: number; // 0-1, driving ability
  consistency: number; // 0-1, how consistent lap times
  unpredictability: number; // 0-1, random behavior
  blocking: number; // 0-1, tendency to block others
  courtesy: number; // 0-1, fair play behavior
  learning: boolean; // whether AI adapts to player
  experience: number; // AI's familiarity with track
  confidence: number; // affects behavior under pressure
};

export type BotProfile = {
  id: string;
  name: string;
  behavior: AIBehavior;
  car: {
    setup: "aggressive" | "balanced" | "conservative" | "custom";
    parts: Record<string, number>; // performance values
    tuning: Record<string, number>; // technical settings
  };
  personality: {
    taunts: string[];
    celebrating: "minimal" | "normal" | "excessive";
    frustration: number; // 0-1, how easily they get frustrated
    loyalty: number; // 0-1, tendency to stick with decisions
  };
  stats: {
    races: number;
    wins: number;
    podiums: number;
    consistency: number;
    adaptability: number;
  };
};

// Telemetry and analytics
export type TelemetryData = {
  playerId: PlayerId;
  sessionId: string;
  timestamp: number;
  
  // Vehicle data
  speed: number;
  rpm: number;
  gear: number;
  throttle: number;
  brake: number;
  steering: number;
  energy: number;
  
  // Position data
  position: Vec3;
  velocity: Vec3;
  acceleration: Vec3;
  orientation: { yaw: number; pitch: number; roll: number };
  
  // Environment data
  trackPosition: number;
  surfaceType: string;
  weather: WeatherCondition;
  timeOfDay: number;
  
  // Performance data
  lapTime: number;
  bestLap: number;
  sector1: number;
  sector2: number;
  sector3: number;
  
  // System data
  inputLag: number;
  fps: number;
  ping: number;
  packetLoss: number;
};

export type RaceAnalytics = {
  sessionId: string;
  playerId: PlayerId;
  matchId: string;
  
  summary: {
    position: number;
    totalTime: number;
    lapsCompleted: number;
    bestLap: number;
    averageLap: number;
    fastestLap: number;
    overtakeCount: number;
    overtakeReceived: number;
    incidents: number;
    penalties: number;
    consistency: number;
    efficiency: number;
  };
  
  perLap: Array<{
    lap: number;
    time: number;
    sector1: number;
    sector2: number;
    sector3: number;
    speed: number;
    fuel: number;
    tireWear: number;
    throttleUsage: number;
    brakeUsage: number;
    incidents: number[];
  }>;
  
  telemetry: TelemetryData[];
};

// Vehicle customization
export type VehicleSetup = {
  suspension: {
    rideHeight: { front: number; rear: number };
    stiffness: { front: number; rear: number };
    damping: { compression: number; rebound: number };
    antiRollBar: { front: number; rear: number };
    camber: { front: number; rear: number };
    toe: { front: number; rear: number };
  };
  
  engine: {
    power: number;
    torque: number;
    turbo: number;
    intercooler: number;
    exhaust: number;
    fuelMapping: number;
  };
  
  transmission: {
    gearRatios: number[];
    finalDrive: number;
    differential: number;
    clutchStrength: number;
    shiftSpeed: number;
  };
  
  aero: {
    downforce: { front: number; rear: number };
    drag: number;
    brakeDucts: number;
    gurney: number;
    wheelTurbos: number;
  };
  
  brakes: {
    bias: number;
    pressure: number;
    cooling: number;
    material: number;
  };
  
  tires: {
    compound: "ultra-soft" | "soft" | "medium" | "hard" | "intermediate" | "wet";
    pressure: { frontLeft: number; frontRight: number; rearLeft: number; rearRight: number };
    camber: { frontLeft: number; frontRight: number; rearLeft: number; rearRight: number };
    toe: { frontLeft: number; frontRight: number; rearLeft: number; rearRight: number };
  };
  
  weight: {
    ballast: number;
    distribution: { front: number; rear: number };
    reduction: number;
  };
};

export type VehicleUpgrade = {
  id: string;
  name: string;
  category: "engine" | "transmission" | "suspension" | "aero" | "brakes" | "tires" | "interior" | "exhaust";
  level: number; // 1-10
  cost: number;
  effects: Record<string, number>;
  prerequisites: string[];
  compatibility: string[];
};

export type PlayerProfile = {
  id: PlayerId;
  displayName: string;
  level: number;
  xp: number;
  
  vehicles: {
    owned: string[];
    active: string;
    setups: Record<string, VehicleSetup>;
  };
  
  upgrades: Record<string, number>;
  achievements: string[];
  records: Record<string, {
    time: number;
    date: number;
    vehicle: string;
  }>;
  
  stats: {
    races: number;
    wins: number;
    podiums: number;
    fastestLaps: number;
    polePositions: number;
    totalDistance: number;
    averageFinish: number;
    consistency: number;
    experience: number;
  };
  
  preferences: {
    assists: {
      abs: boolean;
      tcs: boolean;
      esc: boolean;
      autoClutch: boolean;
      autoBrake: boolean;
      lineAssist: boolean;
    };
    difficulty: "novice" | "amateur" | "pro" | "expert" | "legend";
    graphics: "low" | "medium" | "high" | "ultra";
    sound: number; // volume 0-100
    camera: "hood" | "bumper" | "cockpit" | "rear" | "drone";
    controls: "arcade" | "simulation" | "realistic";
  };
};
