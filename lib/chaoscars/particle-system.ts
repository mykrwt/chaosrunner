import type { CarState, WeatherCondition } from "./types";
import type { Vec3 } from "./vec3";
import { v3, v3Add, v3Sub, v3Scale, v3Dot, v3Len, v3Normalize, v3Cross } from "./vec3";

// Advanced Particle System for comprehensive visual effects
export type ParticleType = 
  | "smoke" | "dust" | "sparks" | "debris" | "exhaust" | "tire_smoke" | "oil"
  | "water_splash" | "rain" | "snow" | "leaves" | "sand" | "mud"
  | "lightning" | "energy" | "fire" | "explosion" | "boost" | "trail"
  | "glass" | "metal" | "rubber" | "plastic" | "fabric" | "dirt"
  | "grass" | "asphalt" | "concrete" | "ice" | "steam" | "gas";

export interface Particle {
  id: string;
  type: ParticleType;
  position: Vec3;
  velocity: Vec3;
  acceleration: Vec3;
  
  // Visual properties
  size: number;
  sizeEnd: number;
  color: { r: number; g: number; b: number; a: number };
  colorEnd: { r: number; g: number; b: number; a: number };
  texture?: string;
  
  // Physics properties
  mass: number;
  drag: number;
  bounce: number;
  friction: number;
  gravity: number;
  lifetime: number;
  lifetimeMax: number;
  
  // Behavior
  behavior: {
    type: "linear" | "gravity" | "buoyant" | "explosive" | "spiral" | "attraction" | "repulsion";
    strength: number;
    target?: Vec3;
    force?: Vec3;
  };
  
  // Collision detection
  collisions: boolean;
  groundHeight: number;
  surfaceType: "asphalt" | "grass" | "dirt" | "water" | "concrete" | "metal" | "wood" | "ice";
  
  // Rendering
  renderOrder: number;
  depthWrite: boolean;
  additive: boolean;
  blending: "normal" | "additive" | "multiply" | "screen";
  
  // Metadata
  source?: {
    type: "car" | "collision" | "weather" | "environment" | "weapon" | "debris";
    id?: string;
    position: Vec3;
    direction: Vec3;
    intensity: number;
  };
}

export interface ParticleSystem {
  id: string;
  name: string;
  particles: Map<string, Particle>;
  emitters: Map<string, ParticleEmitter>;
  
  // System properties
  bounds: {
    min: Vec3;
    max: Vec3;
  };
  
  // Performance
  maxParticles: number;
  activeCount: number;
  
  // Environment
  gravity: number;
  wind: Vec3;
  temperature: number;
  humidity: number;
  
  // Visual settings
  quality: "low" | "medium" | "high" | "ultra";
  shadows: boolean;
  lighting: boolean;
  postProcessing: boolean;
}

export interface ParticleEmitter {
  id: string;
  type: "point" | "line" | "area" | "sphere" | "cone" | "box" | "mesh";
  
  // Position and transformation
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  
  // Emission properties
  emissionRate: number; // particles per second
  emissionBurst: number; // particles per burst
  emissionInterval: number; // seconds between bursts
  continuous: boolean;
  
  // Particle properties
  particleTypes: ParticleType[];
  particleProperties: {
    size: { min: number; max: number };
    lifetime: { min: number; max: number };
    velocity: { min: Vec3; max: Vec3 };
    color: { start: string; end: string };
    behavior: {
      type: Particle["behavior"]["type"];
      strength: number;
      attraction?: Vec3;
    };
  };
  
  // Timing
  active: boolean;
  duration: number; // -1 for infinite
  timeRemaining: number;
  
  // Conditions
  conditions: {
    weather?: WeatherCondition[];
    speed?: { min: number; max: number };
    position?: { area: Vec3; radius: number };
    player?: string; // specific player ID
  };
  
  // Effects
  onEmit?: (particle: Particle) => void;
  onUpdate?: (particle: Particle, dt: number) => void;
  onDeath?: (particle: Particle) => void;
}

// Advanced Particle Manager
export class AdvancedParticleSystem {
  private systems = new Map<string, ParticleSystem>();
  private activeEmitters = new Map<string, { emitter: ParticleEmitter; systemId: string; time: number }>();
  
  // Predefined particle presets for different effects
  private particlePresets = {
    // Car exhaust effects
    exhaust: {
      size: { start: 0.3, end: 1.5 },
      color: { start: "rgba(200,200,200,0.8)", end: "rgba(100,100,100,0)" },
      lifetime: { min: 1.0, max: 2.5 },
      behavior: { type: "gravity" as const, strength: 0.1 },
      gravity: 0.1,
      drag: 0.8
    },
    
    // Tire smoke
    tire_smoke: {
      size: { start: 0.5, end: 2.0 },
      color: { start: "rgba(150,150,150,0.7)", end: "rgba(100,100,100,0)" },
      lifetime: { min: 2.0, max: 4.0 },
      behavior: { type: "buoyant" as const, strength: 0.2 },
      gravity: -0.05,
      drag: 0.9
    },
    
    // Crash debris
    debris: {
      size: { start: 0.1, end: 0.05 },
      color: { start: "rgba(139,69,19,1)", end: "rgba(101,67,33,0)" },
      lifetime: { min: 3.0, max: 8.0 },
      behavior: { type: "gravity" as const, strength: 0.8 },
      gravity: 0.8,
      drag: 0.3
    },
    
    // Sparks from metal collision
    sparks: {
      size: { start: 0.02, end: 0.01 },
      color: { start: "rgba(255,255,100,1)", end: "rgba(255,100,0,0)" },
      lifetime: { min: 0.2, max: 0.8 },
      behavior: { type: "gravity" as const, strength: 0.5 },
      gravity: 0.5,
      drag: 0.1
    },
    
    // Water splash
    water_splash: {
      size: { start: 0.1, end: 0.05 },
      color: { start: "rgba(100,150,255,0.8)", end: "rgba(100,150,255,0)" },
      lifetime: { min: 1.0, max: 2.0 },
      behavior: { type: "gravity" as const, strength: 0.3 },
      gravity: 0.3,
      drag: 0.7
    },
    
    // Rain
    rain: {
      size: { start: 0.01, end: 0.008 },
      color: { start: "rgba(100,150,255,0.6)", end: "rgba(100,150,255,0.6)" },
      lifetime: { min: 2.0, max: 2.0 },
      behavior: { type: "gravity" as const, strength: 1.0 },
      gravity: 1.0,
      drag: 0.05
    },
    
    // Dust trail
    dust: {
      size: { start: 0.3, end: 1.2 },
      color: { start: "rgba(139,115,85,0.6)", end: "rgba(139,115,85,0)" },
      lifetime: { min: 3.0, max: 6.0 },
      behavior: { type: "buoyant" as const, strength: 0.1 },
      gravity: -0.02,
      drag: 0.8
    },
    
    // Oil slick
    oil: {
      size: { start: 0.5, end: 0.3 },
      color: { start: "rgba(0,0,0,0.8)", end: "rgba(0,0,0,0.4)" },
      lifetime: { min: 30.0, max: 60.0 },
      behavior: { type: "linear" as const, strength: 0.0 },
      gravity: 0.0,
      drag: 0.95
    },
    
    // Energy boost effect
    boost: {
      size: { start: 0.8, end: 0.2 },
      color: { start: "rgba(0,255,255,0.9)", end: "rgba(0,128,255,0)" },
      lifetime: { min: 0.5, max: 1.0 },
      behavior: { type: "explosive" as const, strength: 2.0 },
      gravity: 0.0,
      drag: 0.1
    },
    
    // Lightning flash
    lightning: {
      size: { start: 2.0, end: 1.0 },
      color: { start: "rgba(255,255,255,1)", end: "rgba(255,255,0,0)" },
      lifetime: { min: 0.1, max: 0.2 },
      behavior: { type: "linear" as const, strength: 0.0 },
      gravity: 0.0,
      drag: 0.0,
      additive: true
    }
  };
  
  constructor() {
    // Initialize with default systems
    this.createDefaultSystems();
  }
  
  private createDefaultSystems(): void {
    // Car effects system
    const carSystem: ParticleSystem = {
      id: "car-effects",
      name: "Car Effects",
      particles: new Map(),
      emitters: new Map(),
      bounds: { min: v3(-1000, -100, -1000), max: v3(1000, 100, 1000) },
      maxParticles: 1000,
      activeCount: 0,
      gravity: 9.81,
      wind: v3(0, 0, 0),
      temperature: 20,
      humidity: 0.5,
      quality: "high",
      shadows: true,
      lighting: true,
      postProcessing: true
    };
    this.systems.set(carSystem.id, carSystem);
    
    // Weather effects system
    const weatherSystem: ParticleSystem = {
      id: "weather-effects",
      name: "Weather Effects", 
      particles: new Map(),
      emitters: new Map(),
      bounds: { min: v3(-2000, -500, -2000), max: v3(2000, 500, 2000) },
      maxParticles: 5000,
      activeCount: 0,
      gravity: 9.81,
      wind: v3(0, 0, 0),
      temperature: 20,
      humidity: 0.5,
      quality: "medium",
      shadows: false,
      lighting: true,
      postProcessing: false
    };
    this.systems.set(weatherSystem.id, weatherSystem);
    
    // Crash effects system
    const crashSystem: ParticleSystem = {
      id: "crash-effects",
      name: "Crash Effects",
      particles: new Map(),
      emitters: new Map(),
      bounds: { min: v3(-500, -100, -500), max: v3(500, 100, 500) },
      maxParticles: 2000,
      activeCount: 0,
      gravity: 9.81,
      wind: v3(0, 0, 0),
      temperature: 20,
      humidity: 0.5,
      quality: "ultra",
      shadows: true,
      lighting: true,
      postProcessing: true
    };
    this.systems.set(crashSystem.id, crashSystem);
  }
  
  // Create particle from preset
  public createParticle(
    systemId: string,
    type: ParticleType,
    position: Vec3,
    velocity: Vec3,
    source?: Particle["source"]
  ): Particle | null {
    
    const system = this.systems.get(systemId);
    if (!system || system.activeCount >= system.maxParticles) {
      return null;
    }
    
    const preset = this.particlePresets[type];
    if (!preset) {
      console.warn(`No preset found for particle type: ${type}`);
      return null;
    }
    
    const id = `${systemId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const particle: Particle = {
      id,
      type,
      position: v3(position.x, position.y, position.z),
      velocity: v3(velocity.x, velocity.y, velocity.z),
      acceleration: v3(0, 0, 0),
      
      size: preset.size.start,
      sizeEnd: preset.size.end,
      color: this.parseColor(preset.color.start),
      colorEnd: this.parseColor(preset.color.end),
      
      mass: 0.1,
      drag: preset.drag,
      bounce: 0.3,
      friction: 0.8,
      gravity: preset.gravity,
      lifetime: 0,
      lifetimeMax: preset.lifetime.max,
      
      behavior: {
        type: preset.behavior.type,
        strength: preset.behavior.strength
      },
      
      collisions: true,
      groundHeight: 0,
      surfaceType: "asphalt",
      
      renderOrder: 0,
      depthWrite: true,
      additive: preset.additive || false,
      blending: preset.additive ? "additive" : "normal",
      
      source
    };
    
    // Randomize properties within ranges
    particle.lifetimeMax = preset.lifetime.min + Math.random() * (preset.lifetime.max - preset.lifetime.min);
    particle.size = preset.size.min + Math.random() * (preset.size.max - preset.size.min);
    
    system.particles.set(id, particle);
    system.activeCount++;
    
    return particle;
  }
  
  // Create emitter
  public createEmitter(
    systemId: string,
    emitter: Omit<ParticleEmitter, "id">
  ): string {
    
    const system = this.systems.get(systemId);
    if (!system) {
      throw new Error(`System not found: ${systemId}`);
    }
    
    const id = `${systemId}-emitter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newEmitter: ParticleEmitter = {
      ...emitter,
      id,
      timeRemaining: emitter.duration
    };
    
    system.emitters.set(id, newEmitter);
    
    if (emitter.active) {
      this.activeEmitters.set(id, {
        emitter: newEmitter,
        systemId,
        time: 0
      });
    }
    
    return id;
  }
  
  // Update all particle systems
  public update(dt: number, cars: Record<string, CarState>, weather: WeatherCondition): void {
    // Update emitters first
    this.updateEmitters(dt, cars, weather);
    
    // Update all systems
    this.systems.forEach(system => {
      this.updateSystem(system, dt, cars, weather);
    });
    
    // Clean up inactive particles
    this.cleanupParticles();
  }
  
  private updateEmitters(dt: number, cars: Record<string, CarState>, weather: WeatherCondition): void {
    const toRemove: string[] = [];
    
    this.activeEmitters.forEach((emitterData, emitterId) => {
      const { emitter, systemId } = emitterData;
      emitterData.time += dt;
      
      // Check duration
      if (emitter.duration > 0) {
        emitter.timeRemaining -= dt;
        if (emitter.timeRemaining <= 0) {
          emitter.active = false;
          toRemove.push(emitterId);
          return;
        }
      }
      
      // Check conditions
      if (!this.checkEmitterConditions(emitter, cars, weather)) {
        return;
      }
      
      // Emit particles
      if (emitter.continuous) {
        const particlesToEmit = emitter.emissionRate * dt;
        const intParticles = Math.floor(particlesToEmit);
        const fractional = particlesToEmit - intParticles;
        
        for (let i = 0; i < intParticles; i++) {
          this.emitParticle(emitter, systemId);
        }
        
        // Handle fractional emission
        if (Math.random() < fractional) {
          this.emitParticle(emitter, systemId);
        }
      }
    });
    
    // Remove inactive emitters
    toRemove.forEach(id => {
      this.activeEmitters.delete(id);
    });
  }
  
  private checkEmitterConditions(emitter: ParticleEmitter, cars: Record<string, CarState>, weather: WeatherCondition): boolean {
    const conditions = emitter.conditions;
    
    if (!conditions) return true;
    
    // Weather conditions
    if (conditions.weather && conditions.weather.length > 0) {
      const matchWeather = conditions.weather.some(w => 
        w.type === weather.type && w.intensity === weather.intensity
      );
      if (!matchWeather) return false;
    }
    
    // Player-specific conditions
    if (conditions.player && cars[conditions.player]) {
      const car = cars[conditions.player];
      // Additional player-specific checks can be added here
    }
    
    // Position-based conditions
    if (conditions.position) {
      const carPos = Object.values(cars)[0]?.p; // Simplified - would check all cars
      if (carPos) {
        const dist = Math.sqrt(
          Math.pow(carPos.x - conditions.position.area.x, 2) +
          Math.pow(carPos.z - conditions.position.area.z, 2)
        );
        if (dist > conditions.position.radius) return false;
      }
    }
    
    return true;
  }
  
  private emitParticle(emitter: ParticleEmitter, systemId: string): void {
    if (emitter.particleTypes.length === 0) return;
    
    const particleType = emitter.particleTypes[Math.floor(Math.random() * emitter.particleTypes.length)];
    
    // Calculate emission position based on emitter type
    let position = v3(0, 0, 0);
    let velocity = v3(0, 0, 0);
    
    switch (emitter.type) {
      case "point":
        position = emitter.position;
        velocity = this.randomInCone(v3(0, 1, 0), Math.PI / 4);
        break;
        
      case "cone":
        position = emitter.position;
        velocity = this.randomInCone(this.getForwardVector(emitter.rotation), Math.PI / 6);
        break;
        
      case "sphere":
        position = this.randomInSphere(emitter.position, emitter.scale.x);
        velocity = this.randomVector().normalize().scale(2);
        break;
        
      case "box":
        position = this.randomInBox(emitter.position, emitter.scale);
        velocity = this.randomInCone(v3(0, 1, 0), Math.PI);
        break;
    }
    
    // Apply particle properties
    const props = emitter.particleProperties;
    velocity = this.lerpVector(props.velocity.min, props.velocity.max, Math.random());
    
    const particle = this.createParticle(systemId, particleType, position, velocity, {
      type: "car",
      position,
      direction: velocity,
      intensity: 1.0
    });
    
    if (particle) {
      // Custom behavior
      if (props.behavior.attraction) {
        particle.behavior.target = props.behavior.attraction;
      }
      
      // Call onEmit callback
      if (emitter.onEmit) {
        emitter.onEmit(particle);
      }
    }
  }
  
  private updateSystem(system: ParticleSystem, dt: number, cars: Record<string, CarState>, weather: WeatherCondition): void {
    const particles = Array.from(system.particles.values());
    
    particles.forEach(particle => {
      this.updateParticle(particle, system, dt, cars, weather);
    });
  }
  
  private updateParticle(particle: Particle, system: ParticleSystem, dt: number, cars: Record<string, CarState>, weather: WeatherCondition): void {
    particle.lifetime += dt;
    
    if (particle.lifetime >= particle.lifetimeMax) {
      // Particle died
      this.removeParticle(system, particle.id);
      return;
    }
    
    // Apply gravity
    particle.acceleration.y -= particle.gravity * system.gravity;
    
    // Apply behavior forces
    this.applyBehaviorForce(particle, dt);
    
    // Apply environmental forces
    this.applyEnvironmentalForces(particle, system, dt);
    
    // Update velocity
    particle.velocity = v3Add(particle.velocity, v3Scale(particle.acceleration, dt));
    
    // Apply drag
    const dragFactor = Math.max(0, 1 - particle.drag * dt);
    particle.velocity = v3Scale(particle.velocity, dragFactor);
    
    // Update position
    particle.position = v3Add(particle.position, v3Scale(particle.velocity, dt));
    
    // Handle collisions
    if (particle.collisions) {
      this.handleCollisions(particle, dt);
    }
    
    // Update visual properties
    this.updateVisualProperties(particle, dt);
  }
  
  private applyBehaviorForce(particle: Particle, dt: number): void {
    const behavior = particle.behavior;
    const strength = behavior.strength;
    
    switch (behavior.type) {
      case "gravity":
        // Already applied via gravity property
        break;
        
      case "buoyant":
        particle.acceleration.y += strength * 0.5;
        break;
        
      case "explosive":
        const direction = particle.position;
        const distance = v3Len(direction);
        if (distance > 0) {
          const force = strength / Math.max(1, distance * distance);
          const normalizedDir = v3Normalize(direction);
          particle.acceleration = v3Add(particle.acceleration, v3Scale(normalizedDir, force));
        }
        break;
        
      case "spiral":
        // Apply spiral motion around Y-axis
        const spiralForce = strength * 0.5;
        const spiralDir = v3(-particle.velocity.z, 0, particle.velocity.x);
        particle.acceleration = v3Add(particle.acceleration, v3Scale(spiralDir, spiralForce));
        break;
        
      case "attraction":
        if (behavior.target) {
          const direction = v3Sub(behavior.target, particle.position);
          const distance = v3Len(direction);
          if (distance > 0) {
            const force = strength / Math.max(1, distance);
            const normalizedDir = v3Normalize(direction);
            particle.acceleration = v3Add(particle.acceleration, v3Scale(normalizedDir, force));
          }
        }
        break;
        
      case "repulsion":
        if (behavior.target) {
          const direction = v3Sub(particle.position, behavior.target);
          const distance = v3Len(direction);
          if (distance > 0) {
            const force = strength / Math.max(1, distance);
            const normalizedDir = v3Normalize(direction);
            particle.acceleration = v3Add(particle.acceleration, v3Scale(normalizedDir, force));
          }
        }
        break;
    }
  }
  
  private applyEnvironmentalForces(particle: Particle, system: ParticleSystem, dt: number): void {
    // Apply wind
    particle.velocity = v3Add(particle.velocity, v3Scale(system.wind, dt * 0.1));
    
    // Apply temperature effects (buoyancy for hot particles)
    if (system.temperature > 25 && particle.type === "steam") {
      particle.acceleration.y += 0.2;
    }
    
    // Apply humidity effects (particles fall faster in humid air)
    if (system.humidity > 0.8) {
      particle.acceleration.y -= 0.1;
    }
  }
  
  private handleCollisions(particle: Particle, dt: number): void {
    // Ground collision
    if (particle.position.y <= particle.groundHeight) {
      particle.position.y = particle.groundHeight;
      
      // Bounce
      if (particle.velocity.y < 0) {
        particle.velocity.y = -particle.velocity.y * particle.bounce;
        particle.velocity.x *= particle.friction;
        particle.velocity.z *= particle.friction;
      }
      
      // Surface-specific effects
      this.applySurfaceEffects(particle);
    }
    
    // Boundary collision
    const system = Array.from(this.systems.values()).find(s => s.particles.has(particle.id));
    if (system) {
      const bounds = system.bounds;
      
      if (particle.position.x < bounds.min.x) {
        particle.position.x = bounds.min.x;
        particle.velocity.x = Math.abs(particle.velocity.x) * particle.bounce;
      } else if (particle.position.x > bounds.max.x) {
        particle.position.x = bounds.max.x;
        particle.velocity.x = -Math.abs(particle.velocity.x) * particle.bounce;
      }
      
      if (particle.position.z < bounds.min.z) {
        particle.position.z = bounds.min.z;
        particle.velocity.z = Math.abs(particle.velocity.z) * particle.bounce;
      } else if (particle.position.z > bounds.max.z) {
        particle.position.z = bounds.max.z;
        particle.velocity.z = -Math.abs(particle.velocity.z) * particle.bounce;
      }
    }
  }
  
  private applySurfaceEffects(particle: Particle): void {
    switch (particle.surfaceType) {
      case "asphalt":
        if (particle.type === "tire_smoke") {
          // Tire smoke disperses faster on asphalt
          particle.lifetime += dt * 0.5;
        }
        break;
        
      case "grass":
        if (particle.type === "dust") {
          // More dust on grass
          particle.size *= 1.2;
        }
        break;
        
      case "water":
        if (particle.type === "oil") {
          // Oil spreads on water
          particle.velocity.x *= 0.5;
          particle.velocity.z *= 0.5;
          particle.drag *= 1.5;
        }
        break;
        
      case "ice":
        if (particle.type === "sparks") {
          // Sparks bounce more on ice
          particle.bounce *= 1.5;
        }
        break;
    }
  }
  
  private updateVisualProperties(particle: Particle, dt: number): void {
    const t = particle.lifetime / particle.lifetimeMax;
    
    // Size interpolation
    const sizeLerp = t;
    const currentSize = particle.size + (particle.sizeEnd - particle.size) * sizeLerp;
    
    // Color interpolation
    const colorLerp = Math.min(1, t * 2); // Faster color fade
    particle.color = {
      r: particle.color.r + (particle.colorEnd.r - particle.color.r) * colorLerp,
      g: particle.color.g + (particle.colorEnd.g - particle.color.g) * colorLerp,
      b: particle.color.b + (particle.colorEnd.b - particle.color.b) * colorLerp,
      a: particle.color.a + (particle.colorEnd.a - particle.color.a) * colorLerp
    };
    
    // Additional effects
    switch (particle.type) {
      case "smoke":
        // Smoke spreads and fades
        particle.drag *= 0.98;
        break;
        
      case "sparks":
        // Sparks slow down and brighten briefly
        if (t < 0.1) {
          particle.color.a = Math.min(1, particle.color.a + 0.5);
        }
        break;
        
      case "energy":
        // Energy particles pulse
        const pulse = Math.sin(t * Math.PI * 4);
        particle.size *= 1 + pulse * 0.1;
        break;
    }
  }
  
  private removeParticle(system: ParticleSystem, particleId: string): void {
    system.particles.delete(particleId);
    system.activeCount = Math.max(0, system.activeCount - 1);
  }
  
  private cleanupParticles(): void {
    // Remove particles that are outside their system bounds for too long
    this.systems.forEach(system => {
      const particles = Array.from(system.particles.values());
      const bounds = system.bounds;
      
      particles.forEach(particle => {
        const isOutOfBounds = 
          particle.position.x < bounds.min.x - 100 ||
          particle.position.x > bounds.max.x + 100 ||
          particle.position.z < bounds.min.z - 100 ||
          particle.position.z > bounds.max.z + 100;
        
        if (isOutOfBounds && particle.lifetime > 1.0) {
          this.removeParticle(system, particle.id);
        }
      });
    });
  }
  
  // High-level methods for common effects
  public createCarEffects(carId: string, carState: CarState, intensity: number = 1): void {
    const systemId = "car-effects";
    const position = carState.p;
    const velocity = carState.v;
    
    // Exhaust effect
    if (Math.abs(carState.engineRPM) > 1000 && intensity > 0.1) {
      const exhaustVelocity = v3Scale(velocity, 0.1);
      exhaustVelocity.y += 2;
      
      this.createParticle(
        systemId,
        "exhaust",
        position,
        exhaustVelocity,
        { type: "car", id: carId, position, direction: velocity, intensity }
      );
    }
    
    // Tire smoke (hard braking or sliding)
    if (carState.wheelSlip.frontLeft > 0.5 || carState.wheelSlip.rearLeft > 0.5) {
      const tirePosition = {
        x: position.x,
        y: position.y - 0.5,
        z: position.z
      };
      
      this.createParticle(
        systemId,
        "tire_smoke",
        tirePosition,
        v3(0, 1, 0),
        { type: "car", id: carId, position: tirePosition, direction: v3(0, 1, 0), intensity }
      );
    }
    
    // Speed trail effect
    if (v3Len(velocity) > 50) {
      const trailPosition = {
        x: position.x - velocity.x * 0.1,
        y: position.y,
        z: position.z - velocity.z * 0.1
      };
      
      this.createParticle(
        systemId,
        "trail",
        trailPosition,
        v3Scale(velocity, -0.5),
        { type: "car", id: carId, position: trailPosition, direction: v3Scale(velocity, -1), intensity: intensity * 0.3 }
      );
    }
  }
  
  public createCrashEffect(position: Vec3, intensity: number = 1, material: "metal" | "glass" | "plastic" = "metal"): void {
    const systemId = "crash-effects";
    
    // Main explosion debris
    const debrisCount = Math.floor(intensity * 20);
    for (let i = 0; i < debrisCount; i++) {
      const velocity = this.randomVector().scale(20 + Math.random() * 30);
      this.createParticle(
        systemId,
        material === "metal" ? "metal" : material === "glass" ? "glass" : "debris",
        position,
        velocity,
        { type: "collision", position, direction: velocity, intensity }
      );
    }
    
    // Sparks
    const sparkCount = Math.floor(intensity * 10);
    for (let i = 0; i < sparkCount; i++) {
      const velocity = this.randomVector().scale(15 + Math.random() * 25);
      this.createParticle(
        systemId,
        "sparks",
        position,
        velocity,
        { type: "collision", position, direction: velocity, intensity }
      );
    }
    
    // Smoke
    this.createParticle(
      systemId,
      "smoke",
      position,
      v3(0, 5, 0),
      { type: "collision", position, direction: v3(0, 1, 0), intensity }
    );
  }
  
  public createWeatherEffect(weather: WeatherCondition, centerPosition: Vec3 = v3(0, 0, 0)): void {
    const systemId = "weather-effects";
    
    // Rain effect
    if (weather.type === "rain" && weather.intensity > 0) {
      const rainCount = Math.floor(weather.intensity * 100);
      for (let i = 0; i < rainCount; i++) {
        const offset = v3(
          (Math.random() - 0.5) * 100,
          Math.random() * 50 + 20,
          (Math.random() - 0.5) * 100
        );
        const position = v3Add(centerPosition, offset);
        const velocity = v3(
          weather.windSpeed * 0.1,
          -30 - weather.intensity * 20,
          0
        );
        
        this.createParticle(
          systemId,
          "rain",
          position,
          velocity,
          { type: "weather", position, direction: velocity, intensity: weather.intensity }
        );
      }
    }
    
    // Snow effect
    if (weather.type === "snow") {
      const snowCount = Math.floor(weather.intensity * 50);
      for (let i = 0; i < snowCount; i++) {
        const offset = v3(
          (Math.random() - 0.5) * 100,
          Math.random() * 30 + 10,
          (Math.random() - 0.5) * 100
        );
        const position = v3Add(centerPosition, offset);
        const velocity = v3(
          weather.windSpeed * 0.05,
          -5 - weather.intensity * 3,
          0
        );
        
        this.createParticle(
          systemId,
          "snow",
          position,
          velocity,
          { type: "weather", position, direction: velocity, intensity: weather.intensity }
        );
      }
    }
  }
  
  // Utility methods
  private parseColor(colorStr: string): { r: number; g: number; b: number; a: number } {
    // Simple rgba parser
    if (colorStr.startsWith("rgba")) {
      const match = colorStr.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([0-9.]+)\)/);
      if (match) {
        return {
          r: parseInt(match[1]) / 255,
          g: parseInt(match[2]) / 255,
          b: parseInt(match[3]) / 255,
          a: parseFloat(match[4])
        };
      }
    } else if (colorStr.startsWith("rgb")) {
      const match = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (match) {
        return {
          r: parseInt(match[1]) / 255,
          g: parseInt(match[2]) / 255,
          b: parseInt(match[3]) / 255,
          a: 1
        };
      }
    }
    
    return { r: 1, g: 1, b: 1, a: 1 };
  }
  
  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }
  
  private lerpVector(a: Vec3, b: Vec3, t: number): Vec3 {
    return v3(
      this.lerp(a.x, b.x, t),
      this.lerp(a.y, b.y, t),
      this.lerp(a.z, b.z, t)
    );
  }
  
  private randomVector(): Vec3 {
    return v3(
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
      Math.random() * 2 - 1
    );
  }
  
  private randomInCone(direction: Vec3, angle: number): Vec3 {
    // Generate random vector within a cone
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(1 - v * (1 - Math.cos(angle)));
    
    const sinPhi = Math.sin(phi);
    const x = sinPhi * Math.cos(theta);
    const y = Math.cos(phi);
    const z = sinPhi * Math.sin(theta);
    
    // Rotate to match direction
    const dir = v3Normalize(direction);
    const up = v3(0, 1, 0);
    const side = v3Normalize(v3Cross(dir, up));
    const correctedUp = v3Cross(side, dir);
    
    return v3(
      dir.x * y + side.x * x + correctedUp.x * z,
      dir.y * y + side.y * x + correctedUp.y * z,
      dir.z * y + side.z * x + correctedUp.z * z
    );
  }
  
  private randomInSphere(center: Vec3, radius: number): Vec3 {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = radius * Math.cbrt(Math.random());
    
    const sinPhi = Math.sin(phi);
    const x = r * sinPhi * Math.cos(theta);
    const y = r * Math.cos(phi);
    const z = r * sinPhi * Math.sin(theta);
    
    return v3Add(center, v3(x, y, z));
  }
  
  private randomInBox(center: Vec3, scale: Vec3): Vec3 {
    return v3(
      center.x + (Math.random() - 0.5) * scale.x,
      center.y + (Math.random() - 0.5) * scale.y,
      center.z + (Math.random() - 0.5) * scale.z
    );
  }
  
  private getForwardVector(rotation: Vec3): Vec3 {
    const yaw = rotation.y;
    const pitch = rotation.x;
    
    return v3(
      Math.cos(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      Math.sin(yaw) * Math.cos(pitch)
    );
  }
  
  // Public API
  public getAllParticles(): Particle[] {
    const allParticles: Particle[] = [];
    this.systems.forEach(system => {
      system.particles.forEach(particle => {
        allParticles.push({ ...particle });
      });
    });
    return allParticles;
  }
  
  public getParticlesByType(type: ParticleType): Particle[] {
    const particles: Particle[] = [];
    this.systems.forEach(system => {
      system.particles.forEach(particle => {
        if (particle.type === type) {
          particles.push({ ...particle });
        }
      });
    });
    return particles;
  }
  
  public getSystemParticles(systemId: string): Particle[] {
    const system = this.systems.get(systemId);
    if (!system) return [];
    
    return Array.from(system.particles.values()).map(particle => ({ ...particle }));
  }
  
  public clearSystem(systemId: string): void {
    const system = this.systems.get(systemId);
    if (system) {
      system.particles.clear();
      system.activeCount = 0;
    }
  }
  
  public clearAll(): void {
    this.systems.forEach(system => {
      system.particles.clear();
      system.activeCount = 0;
    });
    this.activeEmitters.clear();
  }
  
  public getSystemStats(): Map<string, { particles: number; maxParticles: number; emitters: number }> {
    const stats = new Map();
    this.systems.forEach((system, id) => {
      stats.set(id, {
        particles: system.activeCount,
        maxParticles: system.maxParticles,
        emitters: system.emitters.size
      });
    });
    return stats;
  }
}

// Factory function
export function createParticleSystem(): AdvancedParticleSystem {
  return new AdvancedParticleSystem();
}