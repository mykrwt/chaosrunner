import type { WeatherCondition, Track, CarState, PlayerId } from "./types";
import type { Vec3 } from "./vec3";
import { v3, v3Add, v3Sub, v3Scale, v3Dot, v3Len, v3Normalize } from "./vec3";

// Advanced Weather System with detailed environmental effects
export type WeatherLayer = {
  precipitation: {
    type: "rain" | "snow" | "hail" | "sleet";
    intensity: number; // 0-1
    dropSize: number; // affects visibility and audio
    windDrift: number; // how much wind affects precipitation
    temperature: number; // affects phase changes
    acidLevel: number; // environmental damage over time
  };
  
  wind: {
    speed: number; // m/s
    direction: number; // radians
    gusts: {
      frequency: number; // per minute
      intensity: number; // multiplier
      duration: number; // seconds
    };
    turbulence: number; // affects driving stability
    echoEffects: boolean; // affects audio reverb
  };
  
  fog: {
    density: number; // 0-1
    height: number; // affects visibility range
    movement: number; // how fast fog moves
    temperature: number; // affects visibility
    pollution: number; // affects color and health
  };
  
  temperature: {
    air: number; // celsius
    ground: number; // celsius
    track: number; // track surface temperature
    gradient: number; // rate of change per hour
    effects: {
      grip: number; // temperature effect on grip
      engine: number; // temperature effect on performance
      tire: number; // temperature effect on tires
    };
  };
  
  pressure: {
    value: number; // hPa
    changeRate: number; // hPa per hour
    storm: boolean; // indicates pressure storm
    effects: {
      aero: number; // aerodynamic effects
      engine: number; // engine performance
      visibility: number; // barometric pressure affects fog
    };
  };
  
  lightning: {
    active: boolean;
    frequency: number; // per minute
    intensity: number; // affects brightness and sound
    targets: Vec3[]; // lightning strike locations
    duration: number; // flash duration in ms
  };
};

export type EnvironmentState = {
  timeOfDay: {
    current: number; // 0-24 hours
    progression: number; // how fast time passes
    dayLength: number; // how long a full day takes (minutes)
    sunrise: number; // hour of sunrise
    sunset: number; // hour of sunset
    timezone: number; // affects sun position
  };
  
  lighting: {
    sunIntensity: number; // 0-1
    sunDirection: Vec3;
    ambientLevel: number; // 0-1
    cloudCover: number; // 0-1
    shadowIntensity: number; // 0-1
    colorTemperature: number; // affects overall lighting
    dynamicShadows: boolean;
    globalIllumination: boolean;
  };
  
  atmosphere: {
    humidity: number; // 0-1
    airDensity: number; // affects aerodynamics
    airQuality: number; // 0-1 (pollution level)
    ozoneLevel: number; // affects UV exposure
    particles: {
      dust: number; // dust in air
      pollen: number; // affects allergies
      pollution: number; // smog level
      volcanic: number; // ash particles
    };
  };
  
  trackConditions: {
    wetness: number; // 0-1
    rubber: number; // 0-1, racing line buildup
    oil: number; // oil spots on track
    debris: number; // track debris
    temperature: number; // track surface temp
    grip: number; // current grip level
    drainage: number; // how well track drains
    aging: number; // how much track has degraded
  };
  
  visual: {
    particleSystems: {
      rainDrops: {
        count: number;
        size: number;
        velocity: Vec3;
        lifetime: number;
      };
      snowFlakes: {
        count: number;
        size: number;
        velocity: Vec3;
        crystallization: number; // snow quality
      };
      dust: {
        count: number;
        opacity: number;
        movement: Vec3;
      };
      sparks: {
        count: number;
        temperature: number;
        lifetime: number;
      };
    };
    
    screenEffects: {
      rainOnWindshield: {
        intensity: number;
        movement: Vec3;
        evaporation: number;
      };
      fog: {
        density: number;
        color: { r: number; g: number; b: number };
        distance: number;
      };
      heatHaze: {
        intensity: number;
        height: number;
        temperature: number;
      };
      lensFlares: {
        intensity: number;
        color: { r: number; g: number; b: number };
        size: number;
      };
    };
  };
};

export type WeatherEvent = {
  type: "suddenRain" | "snowstorm" | "fogBank" | "heatwave" | "coldSnap" | "thunderstorm" | "tornado" | "hurricane" | "blizzard" | "sandstorm";
  startTime: number;
  duration: number;
  intensity: number; // 0-1
  affectedArea: {
    center: Vec3;
    radius: number;
  };
  progression: {
    onset: number; // seconds to reach full intensity
    peak: number; // when maximum intensity occurs
    recession: number; // seconds to fade out
  };
};

// Advanced Weather Manager
export class AdvancedWeatherSystem {
  private currentWeather: WeatherLayer;
  private environment: EnvironmentState;
  private weatherEvents: WeatherEvent[] = [];
  private trackConditions: TrackConditionManager;
  private playerEffects: Map<PlayerId, PlayerWeatherEffects> = new Map();
  
  // Weather patterns and cycles
  private weatherPatterns = {
    seasonal: {
      spring: { rainFrequency: 0.4, temperature: 15, wind: 3 },
      summer: { rainFrequency: 0.2, temperature: 25, wind: 2 },
      autumn: { rainFrequency: 0.6, temperature: 12, wind: 4 },
      winter: { rainFrequency: 0.8, temperature: 2, wind: 5 }
    },
    daily: {
      morning: { temperature: 15, wind: 2, visibility: 0.8 },
      afternoon: { temperature: 22, wind: 3, visibility: 1.0 },
      evening: { temperature: 18, wind: 2, visibility: 0.7 },
      night: { temperature: 8, wind: 1, visibility: 0.3 }
    }
  };
  
  constructor() {
    this.currentWeather = this.initializeWeather();
    this.environment = this.initializeEnvironment();
    this.trackConditions = new TrackConditionManager();
  }
  
  private initializeWeather(): WeatherLayer {
    return {
      precipitation: {
        type: "rain",
        intensity: 0.3,
        dropSize: 0.5,
        windDrift: 0.2,
        temperature: 15,
        acidLevel: 0
      },
      wind: {
        speed: 3,
        direction: 0,
        gusts: {
          frequency: 2,
          intensity: 0.3,
          duration: 5
        },
        turbulence: 0.1,
        echoEffects: true
      },
      fog: {
        density: 0.1,
        height: 10,
        movement: 0.5,
        temperature: 15,
        pollution: 0
      },
      temperature: {
        air: 18,
        ground: 16,
        track: 20,
        gradient: 0.5,
        effects: {
          grip: 1.0,
          engine: 1.0,
          tire: 1.0
        }
      },
      pressure: {
        value: 1013.25,
        changeRate: 0,
        storm: false,
        effects: {
          aero: 1.0,
          engine: 1.0,
          visibility: 1.0
        }
      },
      lightning: {
        active: false,
        frequency: 0,
        intensity: 0,
        targets: [],
        duration: 100
      }
    };
  }
  
  private initializeEnvironment(): EnvironmentState {
    return {
      timeOfDay: {
        current: 12, // Noon
        progression: 1.0, // Normal speed
        dayLength: 1440, // 24 hours in minutes
        sunrise: 6,
        sunset: 18,
        timezone: 0
      },
      lighting: {
        sunIntensity: 1.0,
        sunDirection: v3(0.5, 0.87, 0),
        ambientLevel: 0.4,
        cloudCover: 0.2,
        shadowIntensity: 0.8,
        colorTemperature: 5600, // Kelvin
        dynamicShadows: true,
        globalIllumination: true
      },
      atmosphere: {
        humidity: 0.6,
        airDensity: 1.225,
        airQuality: 0.9,
        ozoneLevel: 0.8,
        particles: {
          dust: 0.1,
          pollen: 0.3,
          pollution: 0.1,
          volcanic: 0
        }
      },
      trackConditions: {
        wetness: 0.1,
        rubber: 0.2,
        oil: 0,
        debris: 0.1,
        temperature: 25,
        grip: 1.0,
        drainage: 0.8,
        aging: 0
      },
      visual: {
        particleSystems: {
          rainDrops: {
            count: 0,
            size: 0.1,
            velocity: v3(0, -10, 0),
            lifetime: 2
          },
          snowFlakes: {
            count: 0,
            size: 0.2,
            velocity: v3(0, -2, 0),
            crystallization: 0.8
          },
          dust: {
            count: 0,
            opacity: 0.5,
            movement: v3(0, 0, 0)
          },
          sparks: {
            count: 0,
            temperature: 1000,
            lifetime: 0.5
          }
        },
        screenEffects: {
          rainOnWindshield: {
            intensity: 0,
            movement: v3(0, 0, 0),
            evaporation: 0.1
          },
          fog: {
            density: 0,
            color: { r: 0.8, g: 0.8, b: 0.8 },
            distance: 100
          },
          heatHaze: {
            intensity: 0,
            height: 5,
            temperature: 30
          },
          lensFlares: {
            intensity: 0.5,
            color: { r: 1, g: 0.9, b: 0.8 },
            size: 1.0
          }
        }
      }
    };
  }
  
  // Main weather update system
  public updateWeather(
    dt: number,
    players: Record<PlayerId, CarState>,
    track: Track,
    currentTime: number
  ): {
    weather: WeatherCondition;
    environment: EnvironmentState;
    trackEffects: TrackEffects;
    playerEffects: Record<PlayerId, PlayerWeatherEffects>;
  } {
    
    // Update time progression
    this.updateTimeOfDay(dt);
    
    // Update atmospheric conditions
    this.updateAtmosphericConditions(dt);
    
    // Handle weather events
    this.handleWeatherEvents(dt, track, currentTime);
    
    // Update track conditions
    this.trackConditions.update(dt, this.currentWeather, players, track);
    
    // Update player-specific effects
    this.updatePlayerEffects(players, dt);
    
    // Calculate visual effects
    this.updateVisualEffects(dt);
    
    return {
      weather: this.convertToWeatherCondition(),
      environment: { ...this.environment },
      trackEffects: this.trackConditions.getCurrentEffects(),
      playerEffects: this.getAllPlayerEffects()
    };
  }
  
  private updateTimeOfDay(dt: number): void {
    // Advance time
    const timeProgression = dt / 60; // Convert to hours
    this.environment.timeOfDay.current += timeProgression * this.environment.timeOfDay.progression;
    
    // Handle day wrap-around
    if (this.environment.timeOfDay.current >= 24) {
      this.environment.timeOfDay.current -= 24;
    } else if (this.environment.timeOfDay.current < 0) {
      this.environment.timeOfDay.current += 24;
    }
    
    // Update lighting based on time
    this.updateLighting();
    
    // Apply daily weather patterns
    this.applyDailyWeatherPattern();
  }
  
  private updateLighting(): void {
    const hour = this.environment.timeOfDay.current;
    let sunIntensity = 1.0;
    let sunDirection: Vec3;
    
    // Calculate sun position based on time
    if (hour >= this.environment.timeOfDay.sunrise && hour <= this.environment.timeOfDay.sunset) {
      // Daylight
      const dayProgress = (hour - this.environment.timeOfDay.sunrise) / 
                         (this.environment.timeOfDay.sunset - this.environment.timeOfDay.sunrise);
      
      sunIntensity = Math.sin(dayProgress * Math.PI);
      const sunAngle = (dayProgress - 0.5) * Math.PI;
      sunDirection = v3(Math.cos(sunAngle), Math.sin(sunAngle), 0);
    } else {
      // Night
      sunIntensity = 0.1;
      sunDirection = v3(0, -1, 0);
    }
    
    // Apply cloud cover
    const cloudEffect = 1 - this.environment.lighting.cloudCover * 0.7;
    sunIntensity *= cloudEffect;
    
    this.environment.lighting.sunIntensity = sunIntensity;
    this.environment.lighting.sunDirection = sunDirection;
    
    // Update ambient lighting
    this.environment.lighting.ambientLevel = Math.max(0.1, sunIntensity * 0.6 + 0.1);
    
    // Update color temperature based on time
    if (hour < 10 || hour > 16) {
      // Golden hour
      this.environment.lighting.colorTemperature = 3000;
    } else if (hour < 8 || hour > 18) {
      // Blue hour
      this.environment.lighting.colorTemperature = 8000;
    } else {
      // Midday
      this.environment.lighting.colorTemperature = 5600;
    }
  }
  
  private applyDailyWeatherPattern(): void {
    const hour = this.environment.timeOfDay.current;
    let pattern;
    
    if (hour >= 6 && hour < 12) pattern = this.weatherPatterns.daily.morning;
    else if (hour >= 12 && hour < 17) pattern = this.weatherPatterns.daily.afternoon;
    else if (hour >= 17 && hour < 21) pattern = this.weatherPatterns.daily.evening;
    else pattern = this.weatherPatterns.daily.night;
    
    // Adjust temperature based on daily pattern
    const tempVariation = (pattern.temperature - this.currentWeather.temperature.air) * 0.1;
    this.currentWeather.temperature.air += tempVariation;
    this.currentWeather.temperature.ground += tempVariation * 0.8;
    
    // Adjust wind based on daily pattern
    const windVariation = (pattern.wind - this.currentWeather.wind.speed) * 0.05;
    this.currentWeather.wind.speed += windVariation;
    
    // Adjust visibility based on daily pattern
    const fogReduction = (1 - pattern.visibility) * 0.02;
    this.currentWeather.fog.density = Math.max(0, this.currentWeather.fog.density - fogReduction);
  }
  
  private updateAtmosphericConditions(dt: number): void {
    // Update humidity based on precipitation
    const humidityRate = this.currentWeather.precipitation.intensity * 0.1;
    this.environment.atmosphere.humidity = Math.min(1.0, 
      this.environment.atmosphere.humidity + humidityRate * dt);
    
    // Update air density based on temperature and pressure
    const baseDensity = 1.225; // kg/m³ at 15°C and sea level
    const tempEffect = (this.currentWeather.temperature.air + 273.15) / 288.15;
    const pressureEffect = this.currentWeather.pressure.value / 1013.25;
    
    this.environment.atmosphere.airDensity = baseDensity * tempEffect * pressureEffect;
    
    // Update temperature gradient
    if (Math.abs(this.currentWeather.temperature.gradient) > 0.01) {
      const tempChange = this.currentWeather.temperature.gradient * dt / 3600; // per hour
      this.currentWeather.temperature.air += tempChange;
    }
    
    // Update wind with gusts
    this.updateWindGusts(dt);
  }
  
  private updateWindGusts(dt: number): void {
    const wind = this.currentWeather.wind;
    
    // Random gust generation
    if (Math.random() < wind.gusts.frequency * dt / 60) {
      const gustIntensity = 1 + wind.gusts.intensity * (Math.random() - 0.5);
      wind.speed *= gustIntensity;
    }
    
    // Wind direction drift
    wind.direction += (Math.random() - 0.5) * 0.01 * dt;
    
    // Apply turbulence effect
    const turbulence = wind.turbulence * (Math.random() - 0.5);
    wind.speed += turbulence;
  }
  
  private handleWeatherEvents(dt: number, track: Track, currentTime: number): void {
    // Update existing events
    this.weatherEvents = this.weatherEvents.filter(event => {
      const eventTime = currentTime;
      const eventProgress = (eventTime - event.startTime) / 1000; // Convert to seconds
      
      if (eventProgress > event.duration) {
        return false; // Event expired
      }
      
      // Update event intensity over time
      if (eventProgress < event.progression.onset) {
        // Event building up
        const buildFactor = eventProgress / event.progression.onset;
        event.intensity = Math.sin(buildFactor * Math.PI / 2);
      } else if (eventProgress > event.duration - event.progression.recession) {
        // Event fading out
        const fadeStart = event.duration - event.progression.recession;
        const fadeFactor = (eventProgress - fadeStart) / event.progression.recession;
        event.intensity = Math.cos(fadeFactor * Math.PI / 2);
      }
      // Otherwise peak intensity
      
      return true;
    });
    
    // Generate new weather events
    this.generateWeatherEvents(dt, currentTime);
    
    // Apply event effects
    this.applyEventEffects();
  }
  
  private generateWeatherEvents(dt: number, currentTime: number): void {
    const eventChance = 0.001 * dt; // Low chance per frame
    
    if (Math.random() < eventChance) {
      const eventTypes = ["suddenRain", "fogBank", "thunderstorm", "heatwave"];
      const type = eventTypes[Math.floor(Math.random() * eventTypes.length)] as WeatherEvent["type"];
      
      this.createWeatherEvent(type, currentTime);
    }
  }
  
  private createWeatherEvent(type: WeatherEvent["type"], currentTime: number): void {
    const event: WeatherEvent = {
      type,
      startTime: currentTime,
      duration: this.getEventDuration(type),
      intensity: Math.random(),
      affectedArea: {
        center: v3(0, 0, 0), // Would be based on track location
        radius: 500 + Math.random() * 1000
      },
      progression: this.getEventProgression(type)
    };
    
    this.weatherEvents.push(event);
  }
  
  private getEventDuration(type: WeatherEvent["type"]): number {
    const durations = {
      suddenRain: 300, // 5 minutes
      snowstorm: 600, // 10 minutes
      fogBank: 900, // 15 minutes
      heatwave: 1800, // 30 minutes
      coldSnap: 1200, // 20 minutes
      thunderstorm: 450, // 7.5 minutes
      tornado: 180, // 3 minutes
      hurricane: 3600, // 1 hour
      blizzard: 720, // 12 minutes
      sandstorm: 1500 // 25 minutes
    };
    
    return durations[type] || 600;
  }
  
  private getEventProgression(type: WeatherEvent["type"]): WeatherEvent["progression"] {
    return {
      onset: 30, // 30 seconds to build up
      peak: 120, // Peak at 2 minutes
      recession: 60 // 1 minute to fade
    };
  }
  
  private applyEventEffects(): void {
    this.weatherEvents.forEach(event => {
      switch (event.type) {
        case "suddenRain":
          this.currentWeather.precipitation.intensity = Math.max(
            this.currentWeather.precipitation.intensity,
            event.intensity * 0.8
          );
          break;
          
        case "thunderstorm":
          this.currentWeather.lightning.active = true;
          this.currentWeather.lightning.frequency = event.intensity * 10;
          this.currentWeather.lightning.intensity = event.intensity;
          break;
          
        case "fogBank":
          this.currentWeather.fog.density = Math.max(
            this.currentWeather.fog.density,
            event.intensity * 0.6
          );
          break;
      }
    });
  }
  
  private updatePlayerEffects(players: Record<PlayerId, CarState>, dt: number): void {
    Object.keys(players).forEach(playerId => {
      let effects = this.playerEffects.get(playerId);
      if (!effects) {
        effects = this.initializePlayerEffects(playerId);
        this.playerEffects.set(playerId, effects);
      }
      
      this.updateSinglePlayerEffects(playerId, effects, dt);
    });
  }
  
  private updateSinglePlayerEffects(playerId: string, effects: PlayerWeatherEffects, dt: number): void {
    const weather = this.currentWeather;
    
    // Rain effects
    if (weather.precipitation.intensity > 0) {
      effects.rainIntensity = weather.precipitation.intensity;
      effects.wetness = Math.min(1, effects.wetness + dt * 0.1);
    } else {
      effects.wetness = Math.max(0, effects.wetness - dt * 0.05);
    }
    
    // Wind effects
    effects.windExposure = Math.abs(weather.wind.speed) * 0.1;
    
    // Temperature effects
    if (weather.temperature.air < 5) {
      effects.coldExposure = Math.min(1, effects.coldExposure + dt * 0.02);
    } else {
      effects.coldExposure = Math.max(0, effects.coldExposure - dt * 0.01);
    }
    
    if (weather.temperature.air > 30) {
      effects.heatExposure = Math.min(1, effects.heatExposure + dt * 0.02);
    } else {
      effects.heatExposure = Math.max(0, effects.heatExposure - dt * 0.01);
    }
    
    // Visibility effects
    effects.visibilityReduction = this.calculateVisibilityReduction();
    
    // Audio effects
    effects.audioDampening = this.calculateAudioDampening();
  }
  
  private updateVisualEffects(dt: number): void {
    const visual = this.environment.visual;
    
    // Update rain particles
    if (this.currentWeather.precipitation.type === "rain" && this.currentWeather.precipitation.intensity > 0) {
      visual.particleSystems.rainDrops.count = Math.floor(
        this.currentWeather.precipitation.intensity * 1000
      );
      visual.particleSystems.rainDrops.velocity = v3(
        this.currentWeather.wind.speed * 0.3,
        -10 - this.currentWeather.precipitation.intensity * 20,
        0
      );
    } else {
      visual.particleSystems.rainDrops.count = 0;
    }
    
    // Update snow particles
    if (this.currentWeather.precipitation.type === "snow") {
      visual.particleSystems.snowFlakes.count = Math.floor(
        this.currentWeather.precipitation.intensity * 500
      );
      visual.particleSystems.snowFlakes.velocity = v3(
        this.currentWeather.wind.speed * 0.1,
        -2 - this.currentWeather.precipitation.intensity * 3,
        0
      );
    } else {
      visual.particleSystems.snowFlakes.count = 0;
    }
    
    // Update windshield effects
    const windshield = visual.screenEffects.rainOnWindshield;
    windshield.intensity = this.currentWeather.precipitation.intensity * 0.8;
    windshield.movement = v3(
      this.currentWeather.wind.speed * 0.2,
      -this.currentWeather.precipitation.intensity * 5,
      0
    );
    
    // Update fog effects
    const fog = visual.screenEffects.fog;
    fog.density = this.currentWeather.fog.density;
    fog.distance = 100 - this.currentWeather.fog.density * 80;
    
    // Update heat haze (when temperature is high)
    if (this.currentWeather.temperature.air > 25) {
      visual.screenEffects.heatHaze.intensity = Math.min(1, 
        (this.currentWeather.temperature.air - 25) / 20
      );
    } else {
      visual.screenEffects.heatHaze.intensity = 0;
    }
  }
  
  private convertToWeatherCondition(): WeatherCondition {
    return {
      type: this.currentWeather.precipitation.type === "snow" ? "snow" : "rain",
      intensity: this.currentWeather.precipitation.intensity,
      visibility: Math.max(0, 1 - this.currentWeather.fog.density - this.currentWeather.precipitation.intensity * 0.3),
      trackGrip: this.calculateTrackGrip(),
      airDensity: this.environment.atmosphere.airDensity,
      windSpeed: this.currentWeather.wind.speed,
      windDirection: this.currentWeather.wind.direction,
      precipitation: this.currentWeather.precipitation.intensity,
      temperature: this.currentWeather.temperature.air,
      humidity: this.environment.atmosphere.humidity
    };
  }
  
  private calculateTrackGrip(): number {
    let grip = 1.0;
    
    // Weather effects on grip
    if (this.currentWeather.precipitation.intensity > 0) {
      grip *= 0.8; // Rain reduces grip
    }
    
    if (this.currentWeather.precipitation.type === "snow") {
      grip *= 0.4; // Snow is very slippery
    }
    
    // Temperature effects
    if (this.currentWeather.temperature.track < 10) {
      grip *= 0.9; // Cold track has less grip
    } else if (this.currentWeather.temperature.track > 35) {
      grip *= 0.85; // Very hot track can be slippery
    }
    
    // Track wetness effect
    grip *= (1 - this.environment.trackConditions.wetness * 0.3);
    
    return Math.max(0.1, grip);
  }
  
  private calculateVisibilityReduction(): number {
    let reduction = 0;
    
    // Fog effect
    reduction += this.currentWeather.fog.density * 0.6;
    
    // Precipitation effect
    reduction += this.currentWeather.precipitation.intensity * 0.4;
    
    // Night effect
    const hour = this.environment.timeOfDay.current;
    if (hour < this.environment.timeOfDay.sunrise || hour > this.environment.timeOfDay.sunset) {
      reduction += 0.3;
    }
    
    return Math.min(1.0, reduction);
  }
  
  private calculateAudioDampening(): number {
    let dampening = 0;
    
    // Precipitation dampens sound
    dampening += this.currentWeather.precipitation.intensity * 0.3;
    
    // Fog reduces echo
    dampening += this.currentWeather.fog.density * 0.2;
    
    // Wind reduces clarity
    dampening += this.currentWeather.wind.speed * 0.01;
    
    return Math.min(0.5, dampening);
  }
  
  // Helper methods
  private initializePlayerEffects(playerId: string): PlayerWeatherEffects {
    return {
      playerId,
      rainIntensity: 0,
      wetness: 0,
      windExposure: 0,
      coldExposure: 0,
      heatExposure: 0,
      visibilityReduction: 0,
      audioDampening: 0
    };
  }
  
  private getAllPlayerEffects(): Record<string, PlayerWeatherEffects> {
    const effects: Record<string, PlayerWeatherEffects> = {};
    this.playerEffects.forEach((effect, playerId) => {
      effects[playerId] = { ...effect };
    });
    return effects;
  }
  
  // Public methods for external control
  public setWeather(weather: Partial<WeatherLayer>): void {
    Object.assign(this.currentWeather, weather);
  }
  
  public setTime(hour: number): void {
    this.environment.timeOfDay.current = Math.max(0, Math.min(24, hour));
    this.updateLighting();
  }
  
  public forceWeatherEvent(type: WeatherEvent["type"]): void {
    this.createWeatherEvent(type, Date.now());
  }
  
  public getCurrentWeather(): WeatherCondition {
    return this.convertToWeatherCondition();
  }
  
  public getEnvironmentState(): EnvironmentState {
    return { ...this.environment };
  }
}

// Supporting types and managers
export type PlayerWeatherEffects = {
  playerId: PlayerId;
  rainIntensity: number;
  wetness: number;
  windExposure: number;
  coldExposure: number;
  heatExposure: number;
  visibilityReduction: number;
  audioDampening: number;
};

export type TrackEffects = {
  grip: number;
  wetness: number;
  temperature: number;
  rubber: number;
  oil: number;
  debris: number;
  drainage: number;
};

export class TrackConditionManager {
  private conditions: TrackEffects = {
    grip: 1.0,
    wetness: 0,
    temperature: 25,
    rubber: 0,
    oil: 0,
    debris: 0,
    drainage: 0.8
  };
  
  public update(
    dt: number,
    weather: WeatherLayer,
    players: Record<PlayerId, CarState>,
    track: Track
  ): void {
    
    // Update wetness
    if (weather.precipitation.intensity > 0) {
      this.conditions.wetness = Math.min(1, this.conditions.wetness + dt * 0.05);
    } else {
      this.conditions.wetness = Math.max(0, this.conditions.wetness - dt * 0.02);
    }
    
    // Update temperature
    this.conditions.temperature += (weather.temperature.track - this.conditions.temperature) * 0.01 * dt;
    
    // Update rubber buildup from racing
    this.updateRubberBuildup(dt, players, track);
    
    // Update oil spills
    this.updateOilSpills(dt, players);
    
    // Update debris
    this.updateDebris(dt, players);
    
    // Calculate grip based on all factors
    this.calculateGrip();
  }
  
  private updateRubberBuildup(dt: number, players: Record<PlayerId, CarState>, track: Track): void {
    // Rubber builds up from cars racing on the racing line
    let totalRubberBuildup = 0;
    
    Object.values(players).forEach(player => {
      if (player.grounded) {
        const surfaceInfo = track.getSurfaceInfo(player.p.x, player.p.z);
        if (surfaceInfo.onRoad) {
          totalRubberBuildup += dt * 0.001;
        }
      }
    });
    
    this.conditions.rubber = Math.min(1, this.conditions.rubber + totalRubberBuildup);
  }
  
  private updateOilSpills(dt: number, players: Record<PlayerId, CarState>): void {
    // Oil spills can occur from damaged cars
    Object.values(players).forEach(player => {
      if (player.engineHealth < 0.7 && Math.random() < 0.001 * dt) {
        this.conditions.oil = Math.min(1, this.conditions.oil + 0.1);
      }
    });
    
    // Oil naturally dissipates over time
    this.conditions.oil = Math.max(0, this.conditions.oil - dt * 0.0005);
  }
  
  private updateDebris(dt: number, players: Record<PlayerId, CarState>): void {
    // Debris from collisions
    Object.values(players).forEach(player => {
      if (player.bodyDamage > 0.5 && Math.random() < 0.0005 * dt) {
        this.conditions.debris = Math.min(1, this.conditions.debris + 0.05);
      }
    });
    
    // Debris is cleaned up over time
    this.conditions.debris = Math.max(0, this.conditions.debris - dt * 0.0002);
  }
  
  private calculateGrip(): void {
    let grip = 1.0;
    
    // Wetness reduces grip
    grip *= (1 - this.conditions.wetness * 0.4);
    
    // Rubber buildup can improve grip up to a point
    if (this.conditions.rubber < 0.7) {
      grip *= (1 + this.conditions.rubber * 0.2);
    } else {
      grip *= (1.14 - (this.conditions.rubber - 0.7) * 0.3);
    }
    
    // Oil drastically reduces grip
    grip *= (1 - this.conditions.oil * 0.8);
    
    // Debris slightly reduces grip
    grip *= (1 - this.conditions.debris * 0.2);
    
    this.conditions.grip = Math.max(0.1, Math.min(1.2, grip));
  }
  
  public getCurrentEffects(): TrackEffects {
    return { ...this.conditions };
  }
}

// Factory function
export function createWeatherSystem(): AdvancedWeatherSystem {
  return new AdvancedWeatherSystem();
}