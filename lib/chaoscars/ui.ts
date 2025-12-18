
export interface GameUICallbacks {
  onStartSinglePlayer: () => void;
  onCreateRoom: () => void;
  onJoinRoom: (roomId: string) => void;
  onLeaveMatch: () => void;
  onResume: () => void;
  onRestart: () => void;
  onSettingsChange: (settings: { volume: number; quality: 'low' | 'medium' | 'high' }) => void;
  onExit: () => void;
}

export class GameUI {
  private container: HTMLElement;
  private callbacks: GameUICallbacks;
  private root: HTMLElement;
  
  private screens: {
    main: HTMLElement;
    multiplayer: HTMLElement;
    settings: HTMLElement;
    hud: HTMLElement;
    pause: HTMLElement;
  };

  private elements: {
    speed: HTMLElement;
    gear: HTMLElement;
    lap: HTMLElement;
    timer: HTMLElement;
    connection: HTMLElement;
    roomIdDisplay: HTMLElement;
    copyRoomBtn: HTMLElement;
    joinInput: HTMLInputElement;
  };

  private state: {
    volume: number;
    quality: 'low' | 'medium' | 'high';
    roomId: string | null;
  } = {
    volume: 100,
    quality: 'high',
    roomId: null
  };

  constructor(container: HTMLElement, callbacks: GameUICallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.injectStyles();
    
    this.root = document.createElement('div');
    this.root.className = 'cc-ui-root';
    this.container.appendChild(this.root);

    // Initialize elements container
    this.elements = {} as typeof this.elements;

    this.screens = {
      main: this.createMainMenu(),
      multiplayer: this.createMultiplayerMenu(),
      settings: this.createSettingsMenu(),
      hud: this.createHUD(),
      pause: this.createPauseMenu(),
    };

    // Start at Main Menu
    this.showMainMenu();
  }

  public dispose() {
    this.root.remove();
  }

  public showMainMenu() {
    this.hideAll();
    this.screens.main.classList.remove('cc-hidden');
  }

  public showMultiplayerMenu() {
    this.hideAll();
    this.screens.multiplayer.classList.remove('cc-hidden');
    this.updateMultiplayerState();
  }

  public showHUD() {
    this.hideAll();
    this.screens.hud.classList.remove('cc-hidden');
  }

  public showPauseMenu() {
    this.screens.pause.classList.remove('cc-hidden');
  }

  public hidePauseMenu() {
    this.screens.pause.classList.add('cc-hidden');
  }

  public updateSpeed(speedKmh: number) {
    if (this.elements.speed) {
      this.elements.speed.textContent = Math.floor(speedKmh).toString();
    }
  }

  public updateGear(gear: number) {
    if (this.elements.gear) {
      this.elements.gear.textContent = gear === 0 ? 'R' : gear === -1 ? 'N' : gear.toString();
    }
  }

  public updateLap(current: number, total: number | null) {
    if (this.elements.lap) {
      this.elements.lap.textContent = `LAP ${current}${total ? '/' + total : ''}`;
    }
  }

  public updateTimer(seconds: number) {
    if (this.elements.timer) {
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      const ms = Math.floor((seconds * 100) % 100);
      this.elements.timer.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }
  }

  public updateConnectionStatus(status: 'connected' | 'disconnected' | 'connecting', ping?: number) {
    if (this.elements.connection) {
      const text = status === 'connected' ? `ONLINE ${ping ? ping + 'ms' : ''}` : status.toUpperCase();
      this.elements.connection.textContent = text;
      this.elements.connection.className = `cc-hud-connection cc-conn-${status}`;
    }
  }

  public setRoomId(id: string) {
    this.state.roomId = id;
    this.updateMultiplayerState();
  }

  private hideAll() {
    Object.values(this.screens).forEach(s => s.classList.add('cc-hidden'));
  }

  private updateMultiplayerState() {
    if (this.state.roomId) {
      this.elements.roomIdDisplay.textContent = `ROOM ID: ${this.state.roomId}`;
      this.elements.roomIdDisplay.classList.remove('cc-hidden');
      this.elements.copyRoomBtn.classList.remove('cc-hidden');
    } else {
      this.elements.roomIdDisplay.classList.add('cc-hidden');
      this.elements.copyRoomBtn.classList.add('cc-hidden');
    }
  }

  private createMainMenu(): HTMLElement {
    const el = this.createOverlay('cc-menu-main');
    
    const title = document.createElement('h1');
    title.className = 'cc-title';
    title.textContent = 'CHAOS CARS';
    el.appendChild(title);

    const menu = document.createElement('div');
    menu.className = 'cc-menu-list';
    
    this.createBtn(menu, 'PLAY (SINGLE PLAYER)', () => this.callbacks.onStartSinglePlayer());
    this.createBtn(menu, 'MULTIPLAYER', () => this.showMultiplayerMenu());
    this.createBtn(menu, 'SETTINGS', () => {
        this.showSettingsMenu();
        // Store previous screen to go back to
        this.screens.settings.dataset.backTo = 'main';
    });
    this.createBtn(menu, 'EXIT', () => this.callbacks.onExit());

    el.appendChild(menu);
    this.root.appendChild(el);
    return el;
  }

  private createMultiplayerMenu(): HTMLElement {
    const el = this.createOverlay('cc-menu-multi');
    
    const title = document.createElement('h2');
    title.className = 'cc-subtitle';
    title.textContent = 'MULTIPLAYER';
    el.appendChild(title);

    const content = document.createElement('div');
    content.className = 'cc-menu-content';

    // Room ID Display
    this.elements.roomIdDisplay = document.createElement('div');
    this.elements.roomIdDisplay.className = 'cc-room-id cc-hidden';
    content.appendChild(this.elements.roomIdDisplay);

    // Copy Button
    this.elements.copyRoomBtn = this.createBtn(content, 'COPY ROOM ID', () => {
      if (this.state.roomId) {
        navigator.clipboard.writeText(this.state.roomId);
        const original = this.elements.copyRoomBtn.textContent;
        this.elements.copyRoomBtn.textContent = 'COPIED!';
        setTimeout(() => this.elements.copyRoomBtn.textContent = original, 2000);
      }
    });
    this.elements.copyRoomBtn.classList.add('cc-hidden');

    // Create Room
    this.createBtn(content, 'CREATE ROOM', () => this.callbacks.onCreateRoom());

    // Join Section
    const joinSection = document.createElement('div');
    joinSection.className = 'cc-input-group';
    
    this.elements.joinInput = document.createElement('input');
    this.elements.joinInput.type = 'text';
    this.elements.joinInput.placeholder = 'ENTER ROOM ID';
    this.elements.joinInput.className = 'cc-input';
    
    const joinBtn = this.createBtn(joinSection, 'JOIN ROOM', () => {
      if (this.elements.joinInput.value) {
        this.callbacks.onJoinRoom(this.elements.joinInput.value);
      }
    });
    
    joinSection.insertBefore(this.elements.joinInput, joinBtn);
    content.appendChild(joinSection);

    // Back
    this.createBtn(content, 'BACK', () => this.showMainMenu());

    el.appendChild(content);
    this.root.appendChild(el);
    return el;
  }

  private createSettingsMenu(): HTMLElement {
    const el = this.createOverlay('cc-menu-settings');
    el.classList.add('cc-hidden');

    const title = document.createElement('h2');
    title.className = 'cc-subtitle';
    title.textContent = 'SETTINGS';
    el.appendChild(title);

    const content = document.createElement('div');
    content.className = 'cc-menu-content';

    // Volume
    const volGroup = document.createElement('div');
    volGroup.className = 'cc-setting-group';
    const volLabel = document.createElement('label');
    volLabel.textContent = 'VOLUME';
    const volSlider = document.createElement('input');
    volSlider.type = 'range';
    volSlider.min = '0';
    volSlider.max = '100';
    volSlider.value = '100';
    volSlider.oninput = (e: Event) => {
      const target = e.target as HTMLInputElement;
      this.state.volume = parseInt(target.value);
      this.triggerSettingsChange();
    };
    volGroup.appendChild(volLabel);
    volGroup.appendChild(volSlider);
    content.appendChild(volGroup);

    // Quality
    const qualGroup = document.createElement('div');
    qualGroup.className = 'cc-setting-group';
    const qualLabel = document.createElement('label');
    qualLabel.textContent = 'GRAPHICS';
    const qualSelect = document.createElement('select');
    ['low', 'medium', 'high'].forEach(q => {
      const opt = document.createElement('option');
      opt.value = q;
      opt.textContent = q.toUpperCase();
      if (q === 'high') opt.selected = true;
      qualSelect.appendChild(opt);
    });
    qualSelect.onchange = (e: Event) => {
      const target = e.target as HTMLSelectElement;
      this.state.quality = target.value as 'low' | 'medium' | 'high';
      this.triggerSettingsChange();
    };
    qualGroup.appendChild(qualLabel);
    qualGroup.appendChild(qualSelect);
    content.appendChild(qualGroup);

    // Keybindings
    const keysInfo = document.createElement('div');
    keysInfo.className = 'cc-keys-info';
    keysInfo.innerHTML = '<p>WASD / ARROWS to Drive</p><p>SPACE to Brake</p><p>SHIFT to Boost</p><p>R to Respawn</p><p>ESC to Pause</p>';
    content.appendChild(keysInfo);

    // Back
    this.createBtn(content, 'BACK', () => {
        el.classList.add('cc-hidden');
        if (el.dataset.backTo === 'main') {
            this.showMainMenu();
        } else {
            this.showPauseMenu();
        }
    });

    el.appendChild(content);
    this.root.appendChild(el);
    return el;
  }

  private createHUD(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'cc-hud cc-hidden';

    // Top Left: Lap / Timer
    const topLeft = document.createElement('div');
    topLeft.className = 'cc-hud-top-left';
    this.elements.lap = document.createElement('div');
    this.elements.lap.className = 'cc-hud-lap';
    this.elements.lap.textContent = 'LAP 1/3';
    this.elements.timer = document.createElement('div');
    this.elements.timer.className = 'cc-hud-timer';
    this.elements.timer.textContent = '00:00.00';
    topLeft.appendChild(this.elements.lap);
    topLeft.appendChild(this.elements.timer);
    el.appendChild(topLeft);

    // Top Right: Connection + Pause
    const topRight = document.createElement('div');
    topRight.className = 'cc-hud-top-right';
    this.elements.connection = document.createElement('div');
    this.elements.connection.className = 'cc-hud-connection';
    this.elements.connection.textContent = 'OFFLINE';
    
    const pauseBtn = document.createElement('button');
    pauseBtn.className = 'cc-btn-icon';
    pauseBtn.textContent = '||';
    pauseBtn.onclick = () => this.showPauseMenu();
    
    topRight.appendChild(this.elements.connection);
    topRight.appendChild(pauseBtn);
    el.appendChild(topRight);

    // Bottom Right: Speed + Gear
    const bottomRight = document.createElement('div');
    bottomRight.className = 'cc-hud-bottom-right';
    
    const speedContainer = document.createElement('div');
    speedContainer.className = 'cc-hud-speed-group';
    this.elements.speed = document.createElement('div');
    this.elements.speed.className = 'cc-hud-speed';
    this.elements.speed.textContent = '0';
    const unit = document.createElement('div');
    unit.className = 'cc-hud-unit';
    unit.textContent = 'KM/H';
    speedContainer.appendChild(this.elements.speed);
    speedContainer.appendChild(unit);

    this.elements.gear = document.createElement('div');
    this.elements.gear.className = 'cc-hud-gear';
    this.elements.gear.textContent = 'N';

    bottomRight.appendChild(speedContainer);
    bottomRight.appendChild(this.elements.gear);
    el.appendChild(bottomRight);

    this.root.appendChild(el);
    return el;
  }

  private createPauseMenu(): HTMLElement {
    const el = this.createOverlay('cc-menu-pause');
    el.classList.add('cc-hidden');
    
    const title = document.createElement('h2');
    title.className = 'cc-subtitle';
    title.textContent = 'PAUSED';
    el.appendChild(title);

    const menu = document.createElement('div');
    menu.className = 'cc-menu-list';
    
    this.createBtn(menu, 'RESUME', () => {
        this.hidePauseMenu();
        this.callbacks.onResume();
    });
    this.createBtn(menu, 'RESTART', () => {
        this.hidePauseMenu();
        this.callbacks.onRestart();
    });
    this.createBtn(menu, 'SETTINGS', () => {
        this.hidePauseMenu();
        this.showSettingsMenu();
        this.screens.settings.dataset.backTo = 'pause';
    });
    this.createBtn(menu, 'LEAVE MATCH', () => {
        this.hidePauseMenu();
        this.callbacks.onLeaveMatch();
        this.showMainMenu();
    });

    el.appendChild(menu);
    this.root.appendChild(el);
    return el;
  }

  private showSettingsMenu() {
    this.screens.settings.classList.remove('cc-hidden');
  }

  private triggerSettingsChange() {
    this.callbacks.onSettingsChange({
      volume: this.state.volume,
      quality: this.state.quality
    });
  }

  private createOverlay(className: string): HTMLElement {
    const el = document.createElement('div');
    el.className = `cc-ui-overlay ${className}`;
    return el;
  }

  private createBtn(parent: HTMLElement, text: string, onClick: () => void): HTMLElement {
    const btn = document.createElement('button');
    btn.className = 'cc-btn';
    btn.textContent = text;
    btn.onclick = onClick;
    parent.appendChild(btn);
    return btn;
  }

  private injectStyles() {
    const styleId = 'cc-ui-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .cc-ui-root {
        font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        color: white;
        width: 100%;
        height: 100%;
        position: absolute;
        top: 0;
        left: 0;
        pointer-events: none;
        z-index: 1000;
        overflow: hidden;
      }
      .cc-hidden { display: none !important; }
      
      /* Overlay & Menus */
      .cc-ui-overlay {
        position: absolute;
        top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(10, 10, 15, 0.85);
        backdrop-filter: blur(8px);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
      }
      .cc-title {
        font-size: 4rem;
        font-weight: 900;
        letter-spacing: 0.2em;
        margin-bottom: 2rem;
        background: linear-gradient(45deg, #fff, #888);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        text-shadow: 0 4px 20px rgba(0,0,0,0.5);
      }
      .cc-subtitle {
        font-size: 2rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        margin-bottom: 2rem;
        color: #ddd;
      }
      .cc-menu-list, .cc-menu-content {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        width: 300px;
        align-items: stretch;
      }
      
      /* Buttons */
      .cc-btn {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
        padding: 1rem 2rem;
        font-size: 1.1rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .cc-btn:hover {
        background: rgba(255, 255, 255, 0.2);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      }
      .cc-btn:active {
        transform: translateY(0);
      }

      /* Inputs */
      .cc-input {
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: white;
        padding: 1rem;
        font-size: 1rem;
        width: 100%;
        box-sizing: border-box;
      }
      .cc-input:focus {
        border-color: white;
        outline: none;
      }
      .cc-input-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      /* Settings */
      .cc-setting-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        text-align: left;
      }
      .cc-setting-group label {
        font-size: 0.8rem;
        color: #aaa;
        font-weight: 600;
      }
      .cc-setting-group select, .cc-setting-group input {
        background: rgba(0,0,0,0.3);
        border: 1px solid #444;
        color: white;
        padding: 0.5rem;
      }
      .cc-keys-info {
        background: rgba(255,255,255,0.05);
        padding: 1rem;
        border-radius: 4px;
        font-size: 0.9rem;
        color: #ccc;
        line-height: 1.4;
      }
      .cc-keys-info p { margin: 0.2rem 0; }

      /* HUD */
      .cc-hud {
        position: absolute;
        top: 0; left: 0; width: 100%; height: 100%;
        padding: 2rem;
        box-sizing: border-box;
        pointer-events: none;
      }
      .cc-hud-top-left {
        position: absolute;
        top: 2rem; left: 2rem;
        text-align: left;
      }
      .cc-hud-top-right {
        position: absolute;
        top: 2rem; right: 2rem;
        display: flex;
        gap: 1rem;
        align-items: center;
      }
      .cc-hud-bottom-right {
        position: absolute;
        bottom: 2rem; right: 2rem;
        text-align: right;
        display: flex;
        align-items: flex-end;
        gap: 1rem;
      }

      .cc-hud-lap { font-size: 1.2rem; font-weight: 600; color: #ddd; }
      .cc-hud-timer { font-size: 2rem; font-weight: 700; font-variant-numeric: tabular-nums; }
      
      .cc-hud-speed-group {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
      }
      .cc-hud-speed {
        font-size: 5rem;
        font-weight: 900;
        line-height: 1;
        font-style: italic;
      }
      .cc-hud-unit {
        font-size: 1rem;
        font-weight: 600;
        color: #aaa;
      }
      .cc-hud-gear {
        font-size: 3rem;
        font-weight: 700;
        color: #ffcc00;
        background: rgba(0,0,0,0.5);
        width: 60px; height: 60px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        border: 2px solid rgba(255,255,255,0.1);
      }

      .cc-hud-connection {
        font-size: 0.8rem;
        font-weight: 700;
        padding: 0.3rem 0.6rem;
        border-radius: 4px;
      }
      .cc-conn-connected { color: #0f0; background: rgba(0,255,0,0.1); }
      .cc-conn-disconnected { color: #f00; background: rgba(255,0,0,0.1); }
      .cc-conn-connecting { color: #fc0; background: rgba(255,200,0,0.1); }

      .cc-btn-icon {
        background: transparent;
        border: 2px solid white;
        color: white;
        width: 40px; height: 40px;
        border-radius: 50%;
        cursor: pointer;
        pointer-events: auto;
        font-weight: 900;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1rem;
      }
      .cc-btn-icon:hover { background: rgba(255,255,255,0.2); }

      .cc-room-id {
        font-size: 1.5rem;
        font-weight: 700;
        color: #fc0;
        margin-bottom: 1rem;
      }
      
      @media (max-width: 600px) {
        .cc-title { font-size: 2.5rem; }
        .cc-hud-speed { font-size: 3rem; }
        .cc-hud-gear { width: 40px; height: 40px; font-size: 1.5rem; }
      }
    `;
    document.head.appendChild(style);
  }
}
