import type { CarState, WeatherCondition, PlayerId } from "./types";

// Audio management system
export type AudioLayer = {
  volume: number;
  pitch: number;
  pan: number;
  fadeIn: number;
  fadeOut: number;
  loop: boolean;
  priority: number;
  category: "engine" | "environment" | "effects" | "music" | "ui";
};

export type EngineAudio = {
  rpm: number;
  throttle: number;
  load: number;
  gear: number;
  turboBoost: number;
  intakeNoise: number;
  exhaustNoise: number;
  turboNoise: number;
  valveNoise: number;
  supercharger: number;
};

export type WeatherAudio = {
  wind: number;
  rain: number;
  thunder: number;
  ambient: number;
  echo: number;
};

export type CollisionAudio = {
  impact: number;
  metal: number;
  glass: number;
  debris: number;
  echo: number;
};

export type TrackAudio = {
  tireGrip: number;
  suspension: number;
  brakeDisc: number;
  roadNoise: number;
  guardRail: number;
  grass: number;
  pitLane: number;
};

export type AudioManager = {
  // Engine audio
  playEngine: (carId: PlayerId, engine: EngineAudio) => void;
  updateEngineSound: (carId: PlayerId, rpm: number, throttle: number, load: number, gear: number) => void;
  
  // Environmental audio
  updateWeather: (weather: WeatherCondition) => void;
  updatePosition: (carId: PlayerId, position: { x: number; y: number; z: number }) => void;
  updateListener: (position: { x: number; y: number; z: number }, orientation: { yaw: number; pitch: number }) => void;
  
  // Effects
  playCollision: (carId: PlayerId, collision: CollisionAudio) => void;
  playBoost: (carId: PlayerId, duration: number, strength: number) => void;
  playTireSqueal: (carId: PlayerId, intensity: number, surface: string) => void;
  playSuspension: (carId: PlayerId, compression: number) => void;
  playBrakeDisc: (carId: PlayerId, intensity: number, speed: number) => void;
  
  // Track-specific audio
  playTrackAudio: (trackPosition: number, surfaceType: string) => void;
  playCheckpoint: (position: { x: number; y: number; z: number }, checkpointIndex: number) => void;
  playBoostPad: (position: { x: number; y: number; z: number }) => void;
  playCrash: (carId: PlayerId, intensity: number) => void;
  
  // UI and feedback
  playLapTime: (lapTime: number, isNewRecord: boolean) => void;
  playPosition: (position: number, total: number) => void;
  playCountdown: (count: number) => void;
  playStart: () => void;
  playFinish: (position: number, total: number) => void;
  
  // Music and atmosphere
  setMusicTrack: (track: string, intensity: number) => void;
  updateMusicIntensity: (raceIntensity: number) => void;
  playAmbientTrack: (trackType: "menu" | "garage" | "track" | "victory" | "defeat") => void;
  
  // Volume and settings
  setMasterVolume: (volume: number) => void;
  setCategoryVolume: (category: AudioLayer["category"], volume: number) => void;
  setCarVolume: (carId: PlayerId, volume: number) => void;
  
  // Spatial audio settings
  setReverb: (roomSize: number, dampening: number, wetness: number) => void;
  setDoppler: (enabled: boolean, intensity: number) => void;
  setOcclusion: (enabled: boolean, intensity: number) => void;
  
  // Advanced features
  enable3D: (enabled: boolean) => void;
  enableDynamicRange: (enabled: boolean) => void;
  enableSurround: (enabled: boolean, channel: string) => void;
  enableHRTF: (enabled: boolean) => void; // Head-Related Transfer Function for better 3D
  
  // Voice chat
  enableVoiceChat: (enabled: boolean) => void;
  setVoiceChatVolume: (playerId: PlayerId, volume: number) => void;
  mutePlayer: (playerId: PlayerId, muted: boolean) => void;
  
  // Analytics and performance
  getAudioStats: () => {
    activeLayers: number;
    cpuUsage: number;
    memoryUsage: number;
    latency: number;
    dropouts: number;
  };
};

interface AudioSource {
  id: string;
  layer: AudioLayer;
  buffer: AudioBuffer | null;
  source: AudioBufferSourceNode | null;
  gainNode: GainNode;
  panNode: StereoPannerNode | null;
  filterNodes: BiquadFilterNode[];
  lastPlay: number;
  volume: number;
}

export class AdvancedAudioManager implements AudioManager {
  private context: AudioContext;
  private masterGain: GainNode;
  private compressor: DynamicsCompressorNode;
  private reverb: ConvolverNode;
  private sources = new Map<string, AudioSource>();
  private engineSources = new Map<PlayerId, {
    engine: AudioBufferSourceNode;
    intake: AudioBufferSourceNode;
    exhaust: AudioBufferSourceNode;
    turbo: AudioBufferSourceNode;
    gainNodes: GainNode[];
    filterNodes: BiquadFilterNode[];
  }>();
  
  private categories = new Map<AudioLayer["category"], GainNode>();
  private carVolumes = new Map<PlayerId, number>();
  private listenerPosition = { x: 0, y: 0, z: 0 };
  private listenerOrientation = { yaw: 0, pitch: 0 };
  private musicGain: GainNode;
  private voiceChatEnabled = false;
  
  private audioBuffers = new Map<string, AudioBuffer>();
  private pendingLoads = new Set<string>();
  
  // Audio processing chains
  private processingChains = {
    engine: {
      lowPass: new BiquadFilterNode(this.context, { type: "lowpass", frequency: 8000 }),
      highPass: new BiquadFilterNode(this.context, { type: "highpass", frequency: 20 }),
      bandPass: new BiquadFilterNode(this.context, { type: "bandpass", frequency: 2000, Q: 1 }),
      distortion: new WaveShaperNode(this.context, { curve: this.createDistortionCurve(400) })
    },
    effects: {
      reverb: this.reverb,
      delay: new DelayNode(this.context, { delayTime: 0.1 }),
      compression: this.compressor
    },
    ambient: {
      lowPass: new BiquadFilterNode(this.context, { type: "lowpass", frequency: 3000 }),
      bandPass: new BiquadFilterNode(this.context, { type: "bandpass", frequency: 800, Q: 0.5 }),
      echo: new DelayNode(this.context, { delayTime: 0.5 })
    }
  };
  
  constructor() {
    this.context = new AudioContext();
    this.masterGain = this.context.createGain();
    this.musicGain = this.context.createGain();
    this.compressor = this.context.createDynamicsCompressor();
    this.reverb = this.context.createConvolver();
    
    // Connect processing chain
    this.masterGain.connect(this.compressor);
    this.compressor.connect(this.context.destination);
    
    // Set up categories
    const categories: AudioLayer["category"][] = ["engine", "environment", "effects", "music", "ui"];
    categories.forEach(category => {
      const gain = this.context.createGain();
      gain.connect(this.masterGain);
      this.categories.set(category, gain);
    });
    
    // Initialize impulse response for reverb
    this.createReverbImpulse();
    
    // Set initial listener position
    this.updateListener({ x: 0, y: 1.7, z: 0 }, { yaw: 0, pitch: 0 });
  }
  
  private createReverbImpulse(): void {
    const length = this.context.sampleRate * 2; // 2 seconds
    const impulse = this.context.createBuffer(2, length, this.context.sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const decay = Math.pow(1 - i / length, 2);
        channelData[i] = (Math.random() * 2 - 1) * decay * 0.1;
      }
    }
    
    this.reverb.buffer = impulse;
  }
  
  private createDistortionCurve(amount: number): Float32Array {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    
    return curve;
  }
  
  // Engine audio implementation
  playEngine(carId: PlayerId, engine: EngineAudio): void {
    // Ensure engine sources exist
    if (!this.engineSources.has(carId)) {
      this.createEngineSources(carId);
    }
    
    const sources = this.engineSources.get(carId)!;
    
    // Update RPM and throttle for all engine layers
    const rpmFactor = engine.rpm / 7000; // Normalize to max RPM
    
    // Base engine sound
    sources.engine.playbackRate.setValueAtTime(
      Math.max(0.3, rpmFactor * 0.8 + engine.throttle * 0.4),
      this.context.currentTime
    );
    
    // Intake sound (higher frequency, varies with throttle)
    sources.intake.playbackRate.setValueAtTime(
      Math.max(0.4, rpmFactor * 0.6 + engine.throttle * 0.3),
      this.context.currentTime
    );
    
    // Exhaust sound (lower frequency, varies with RPM more)
    sources.exhaust.playbackRate.setValueAtTime(
      Math.max(0.2, rpmFactor * 0.5),
      this.context.currentTime
    );
    
    // Turbo sound (only when boost is applied)
    if (engine.turboBoost > 0.1) {
      sources.turbo.playbackRate.setValueAtTime(
        0.5 + engine.turboBoost * 0.8,
        this.context.currentTime
      );
    }
    
    // Update gain based on throttle and RPM
    const baseGain = Math.min(0.8, engine.throttle * 0.6 + rpmFactor * 0.3);
    
    sources.gainNodes[0].gain.setValueAtTime(baseGain, this.context.currentTime);
    sources.gainNodes[1].gain.setValueAtTime(baseGain * 0.8, this.context.currentTime);
    sources.gainNodes[2].gain.setValueAtTime(baseGain * 0.9, this.context.currentTime);
    sources.gainNodes[3].gain.setValueAtTime(engine.turboBoost * 0.7, this.context.currentTime);
  }
  
  private createEngineSources(carId: PlayerId): void {
    const engineBuffer = this.audioBuffers.get("engine-loop");
    const intakeBuffer = this.audioBuffers.get("intake-loop");
    const exhaustBuffer = this.audioBuffers.get("exhaust-loop");
    const turboBuffer = this.audioBuffers.get("turbo-loop");
    
    if (!engineBuffer || !intakeBuffer || !exhaustBuffer || !turboBuffer) {
      // Load audio buffers if not available
      this.loadEngineBuffers();
      return;
    }
    
    const sources = {
      engine: this.context.createBufferSource(),
      intake: this.context.createBufferSource(),
      exhaust: this.context.createBufferSource(),
      turbo: this.context.createBufferSource(),
      gainNodes: [
        this.context.createGain(),
        this.context.createGain(),
        this.context.createGain(),
        this.context.createGain()
      ],
      filterNodes: [
        new BiquadFilterNode(this.context, { type: "lowpass", frequency: 4000 }),
        new BiquadFilterNode(this.context, { type: "highpass", frequency: 200 }),
        new BiquadFilterNode(this.context, { type: "lowpass", frequency: 2000 }),
        new BiquadFilterNode(this.context, { type: "bandpass", frequency: 1000, Q: 2 })
      ]
    };
    
    // Configure sources
    [sources.engine, sources.intake, sources.exhaust, sources.turbo].forEach(source => {
      source.buffer = engineBuffer;
      source.loop = true;
    });
    
    sources.intake.buffer = intakeBuffer;
    sources.exhaust.buffer = exhaustBuffer;
    sources.turbo.buffer = turboBuffer;
    
    // Connect processing chain
    sources.engine.connect(sources.filterNodes[0]).connect(sources.gainNodes[0]);
    sources.intake.connect(sources.filterNodes[1]).connect(sources.gainNodes[1]);
    sources.exhaust.connect(sources.filterNodes[2]).connect(sources.gainNodes[2]);
    sources.turbo.connect(sources.filterNodes[3]).connect(sources.gainNodes[3]);
    
    // Connect to category gain
    sources.gainNodes.forEach(gain => {
      gain.connect(this.categories.get("engine")!);
    });
    
    // Start sources
    const now = this.context.currentTime;
    [sources.engine, sources.intake, sources.exhaust, sources.turbo].forEach(source => {
      source.start(now);
    });
    
    this.engineSources.set(carId, sources);
  }
  
  private async loadEngineBuffers(): Promise<void> {
    // In a real implementation, these would load from audio files
    // For now, we'll create synthetic engine sounds using oscillators
    
    const createEngineBuffer = (frequency: number, duration: number): AudioBuffer => {
      const sampleRate = this.context.sampleRate;
      const buffer = this.context.createBuffer(1, sampleRate * duration, sampleRate);
      const data = buffer.getChannelData(0);
      
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        data[i] = (Math.sin(2 * Math.PI * frequency * t) + 
                  Math.sin(2 * Math.PI * frequency * t * 0.5) * 0.3 +
                  Math.sin(2 * Math.PI * frequency * t * 1.5) * 0.2) * 0.3;
      }
      
      return buffer;
    };
    
    this.audioBuffers.set("engine-loop", createEngineBuffer(80, 1.0));
    this.audioBuffers.set("intake-loop", createEngineBuffer(200, 0.5));
    this.audioBuffers.set("exhaust-loop", createEngineBuffer(60, 0.8));
    this.audioBuffers.set("turbo-loop", createEngineBuffer(400, 0.3));
  }
  
  updateEngineSound(carId: PlayerId, rpm: number, throttle: number, load: number, gear: number): void {
    if (!this.engineSources.has(carId)) {
      this.createEngineSources(carId);
    }
    
    const engine: EngineAudio = {
      rpm,
      throttle,
      load,
      gear,
      turboBoost: load > 0.8 ? Math.min(1, (load - 0.8) * 5) : 0,
      intakeNoise: throttle * 0.7,
      exhaustNoise: rpm * 0.0001,
      turboNoise: 0,
      valveNoise: rpm * 0.00005,
      supercharger: 0
    };
    
    this.playEngine(carId, engine);
  }
  
  updateWeather(weather: WeatherCondition): void {
    const ambientGain = this.categories.get("environment")!;
    
    // Update ambient sounds based on weather
    switch (weather.type) {
      case "rain":
        this.playLayeredSound("rain-light", 0.3 * weather.intensity, "environment");
        this.playLayeredSound("rain-heavy", 0.1 * weather.intensity, "environment");
        break;
      case "snow":
        this.playLayeredSound("snow-light", 0.4 * weather.intensity, "environment");
        break;
      case "storm":
        this.playLayeredSound("thunder", 0.6 * weather.intensity, "environment");
        this.playLayeredSound("wind-heavy", 0.5 * weather.intensity, "environment");
        break;
      case "fog":
        this.playLayeredSound("fog-horn", 0.2, "environment");
        break;
      case "clear":
        this.playLayeredSound("wind-light", weather.windSpeed * 0.01, "environment");
        break;
    }
    
    // Update wind sounds
    if (weather.windSpeed > 5) {
      const windIntensity = Math.min(1, weather.windSpeed / 30);
      this.playLayeredSound("wind", windIntensity, "environment");
    }
  }
  
  private playLayeredSound(name: string, volume: number, category: AudioLayer["category"]): void {
    const sourceId = `weather-${name}`;
    
    if (volume > 0.01) {
      this.createOrUpdateSource(sourceId, {
        volume,
        pitch: 1.0,
        pan: 0,
        fadeIn: 2.0,
        fadeOut: 1.0,
        loop: true,
        priority: 1,
        category
      });
    } else {
      this.fadeOutSource(sourceId, 1.0);
    }
  }
  
  private createOrUpdateSource(id: string, layer: AudioLayer): void {
    let source = this.sources.get(id);
    
    if (!source) {
      source = this.createSource(id, layer);
      this.sources.set(id, source);
    }
    
    // Update layer properties
    source.layer = layer;
    source.volume = layer.volume;
    
    // Update gain
    source.gainNode.gain.setValueAtTime(
      layer.volume * this.categories.get(layer.category)!.gain.value,
      this.context.currentTime
    );
    
    // Update pan if stereo
    if (source.panNode) {
      source.panNode.pan.setValueAtTime(layer.pan, this.context.currentTime);
    }
  }
  
  private createSource(id: string, layer: AudioLayer): AudioSource {
    const source = this.context.createBufferSource();
    const gainNode = this.context.createGain();
    const panNode = layer.category === "engine" || layer.category === "effects" ? 
      this.context.createStereoPanner() : null;
    const filterNodes: BiquadFilterNode[] = [];
    
    // Create filter chain based on category
    if (layer.category === "engine") {
      filterNodes.push(
        new BiquadFilterNode(this.context, { type: "lowpass", frequency: 8000 }),
        new BiquadFilterNode(this.context, { type: "highpass", frequency: 20 })
      );
    } else if (layer.category === "environment") {
      filterNodes.push(
        new BiquadFilterNode(this.context, { type: "lowpass", frequency: 3000 })
      );
    }
    
    // Connect processing chain
    let currentNode: AudioNode = source;
    filterNodes.forEach(filter => {
      currentNode.connect(filter);
      currentNode = filter;
    });
    
    if (panNode) {
      currentNode.connect(panNode);
      panNode.connect(gainNode);
    } else {
      currentNode.connect(gainNode);
    }
    
    gainNode.connect(this.categories.get(layer.category)!);
    
    return {
      id,
      layer,
      buffer: null,
      source,
      gainNode,
      panNode,
      filterNodes,
      lastPlay: 0,
      volume: layer.volume
    };
  }
  
  private fadeOutSource(id: string, fadeOutTime: number): void {
    const source = this.sources.get(id);
    if (!source) return;
    
    const now = this.context.currentTime;
    source.gainNode.gain.cancelScheduledValues(now);
    source.gainNode.gain.setValueAtTime(source.volume, now);
    source.gainNode.gain.linearRampToValueAtTime(0, now + fadeOutTime);
    
    // Remove after fade out
    setTimeout(() => {
      if (source.source) {
        source.source.stop();
      }
      this.sources.delete(id);
    }, fadeOutTime * 1000);
  }
  
  // Implementation of other methods with detailed audio processing...
  updatePosition(carId: PlayerId, position: { x: number; y: number; z: number }): void {
    // Update 3D positioning for spatial audio
    const source = this.sources.get(`car-${carId}`);
    if (source && source.panNode) {
      // Calculate relative position to listener
      const dx = position.x - this.listenerPosition.x;
      const dz = position.z - this.listenerPosition.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      
      // Pan based on horizontal angle
      const angle = Math.atan2(dz, dx);
      const pan = Math.sin(angle) * Math.min(1, 20 / (distance + 1));
      
      source.panNode.pan.setValueAtTime(pan, this.context.currentTime);
      
      // Volume based on distance (inverse square law)
      const volume = Math.max(0, 1 - (distance / 50));
      source.volume = volume * (this.carVolumes.get(carId) || 1.0);
      source.gainNode.gain.setValueAtTime(
        source.volume * source.layer.volume * this.categories.get(source.layer.category)!.gain.value,
        this.context.currentTime
      );
    }
  }
  
  updateListener(position: { x: number; y: number; z: number }, orientation: { yaw: number; pitch: number }): void {
    this.listenerPosition = position;
    this.listenerOrientation = orientation;
    
    // Update Web Audio API listener
    this.context.listener.positionX.setValueAtTime(position.x, this.context.currentTime);
    this.context.listener.positionY.setValueAtTime(position.y, this.context.currentTime);
    this.context.listener.positionZ.setValueAtTime(position.z, this.context.currentTime);
    
    // Calculate forward and up vectors from yaw and pitch
    const forwardX = Math.cos(orientation.yaw) * Math.cos(orientation.pitch);
    const forwardY = Math.sin(orientation.pitch);
    const forwardZ = Math.sin(orientation.yaw) * Math.cos(orientation.pitch);
    
    this.context.listener.forwardX.setValueAtTime(forwardX, this.context.currentTime);
    this.context.listener.forwardY.setValueAtTime(forwardY, this.context.currentTime);
    this.context.listener.forwardZ.setValueAtTime(forwardZ, this.context.currentTime);
    
    this.context.listener.upX.setValueAtTime(0, this.context.currentTime);
    this.context.listener.upY.setValueAtTime(1, this.context.currentTime);
    this.context.listener.upZ.setValueAtTime(0, this.context.currentTime);
  }
  
  // Placeholder implementations for remaining methods
  playCollision(carId: PlayerId, collision: CollisionAudio): void {
    const intensity = Math.min(1, collision.impact * 0.5);
    this.playLayeredSound(`collision-${carId}`, intensity, "effects");
  }
  
  playBoost(carId: PlayerId, duration: number, strength: number): void {
    const volume = Math.min(1, strength * 0.8);
    this.playLayeredSound(`boost-${carId}`, volume, "effects");
  }
  
  playTireSqueal(carId: PlayerId, intensity: number, surface: string): void {
    this.playLayeredSound(`tire-${surface}-${carId}`, intensity * 0.6, "effects");
  }
  
  playSuspension(carId: PlayerId, compression: number): void {
    const intensity = Math.min(1, Math.abs(compression) * 2);
    this.playLayeredSound(`suspension-${carId}`, intensity * 0.4, "effects");
  }
  
  playBrakeDisc(carId: PlayerId, intensity: number, speed: number): void {
    const volume = Math.min(0.8, intensity * speed * 0.02);
    this.playLayeredSound(`brake-${carId}`, volume, "effects");
  }
  
  playTrackAudio(trackPosition: number, surfaceType: string): void {
    // Implement track surface audio
  }
  
  playCheckpoint(position: { x: number; y: number; z: number }, checkpointIndex: number): void {
    this.playLayeredSound(`checkpoint-${checkpointIndex}`, 0.5, "effects");
  }
  
  playBoostPad(position: { x: number; y: number; z: number }): void {
    this.playLayeredSound("boost-pad", 0.4, "effects");
  }
  
  playCrash(carId: PlayerId, intensity: number): void {
    const volume = Math.min(1, intensity);
    this.playLayeredSound(`crash-${carId}`, volume, "effects");
  }
  
  playLapTime(lapTime: number, isNewRecord: boolean): void {
    const volume = isNewRecord ? 0.8 : 0.5;
    this.playLayeredSound("lap-time", volume, "ui");
  }
  
  playPosition(position: number, total: number): void {
    const volume = position <= 3 ? 0.6 : 0.4;
    this.playLayeredSound("position", volume, "ui");
  }
  
  playCountdown(count: number): void {
    this.playLayeredSound(`countdown-${count}`, 0.7, "ui");
  }
  
  playStart(): void {
    this.playLayeredSound("race-start", 0.8, "ui");
  }
  
  playFinish(position: number, total: number): void {
    const isVictory = position === 1;
    const volume = isVictory ? 1.0 : 0.6;
    this.playLayeredSound("race-finish", volume, "ui");
  }
  
  setMusicTrack(track: string, intensity: number): void {
    this.musicGain.gain.setValueAtTime(intensity * 0.3, this.context.currentTime);
  }
  
  updateMusicIntensity(raceIntensity: number): void {
    const targetVolume = Math.min(0.5, raceIntensity * 0.4);
    this.musicGain.gain.setValueAtTime(targetVolume, this.context.currentTime);
  }
  
  playAmbientTrack(trackType: "menu" | "garage" | "track" | "victory" | "defeat"): void {
    // Implement ambient music tracks
  }
  
  setMasterVolume(volume: number): void {
    this.masterGain.gain.setValueAtTime(volume, this.context.currentTime);
  }
  
  setCategoryVolume(category: AudioLayer["category"], volume: number): void {
    const categoryGain = this.categories.get(category)!;
    categoryGain.gain.setValueAtTime(volume, this.context.currentTime);
  }
  
  setCarVolume(carId: PlayerId, volume: number): void {
    this.carVolumes.set(carId, volume);
  }
  
  setReverb(roomSize: number, dampening: number, wetness: number): void {
    // Update reverb parameters
  }
  
  setDoppler(enabled: boolean, intensity: number): void {
    // Implement Doppler effect
  }
  
  setOcclusion(enabled: boolean, intensity: number): void {
    // Implement occlusion effects
  }
  
  enable3D(enabled: boolean): void {
    // Enable/disable 3D audio processing
  }
  
  enableDynamicRange(enabled: boolean): void {
    if (enabled) {
      this.compressor.threshold.setValueAtTime(-24, this.context.currentTime);
      this.compressor.knee.setValueAtTime(30, this.context.currentTime);
      this.compressor.ratio.setValueAtTime(12, this.context.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.context.currentTime);
      this.compressor.release.setValueAtTime(0.25, this.context.currentTime);
    }
  }
  
  enableSurround(enabled: boolean, channel: string): void {
    // Implement surround sound support
  }
  
  enableHRTF(enabled: boolean): void {
    // Implement HRTF for better 3D positioning
  }
  
  enableVoiceChat(enabled: boolean): void {
    this.voiceChatEnabled = enabled;
  }
  
  setVoiceChatVolume(playerId: PlayerId, volume: number): void {
    // Implement voice chat volume
  }
  
  mutePlayer(playerId: PlayerId, muted: boolean): void {
    // Implement player muting
  }
  
  getAudioStats() {
    return {
      activeLayers: this.sources.size,
      cpuUsage: this.context.baseLatency || 0,
      memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
      latency: this.context.baseLatency || 0,
      dropouts: 0 // Would need audio monitoring
    };
  }
}

// Export factory function
export function createAudioManager(): AudioManager {
  return new AdvancedAudioManager();
}