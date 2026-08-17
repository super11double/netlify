/* ============================================================
   Audio.js - 音频管理器（Web Audio API 程序化合成，零素材）
   提供 SFX 与简单 BGM
   ============================================================ */
class AudioMgr {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.bgmGain = null;
    this.sfxGain = null;
    this.bgmTimer = 0;
    this.bgmStep = 0;
    this.bgmPlaying = false;
    this.settings = { sfx: 0.6, bgm: 0.4, muted: false };
  }

  // 首次用户交互时初始化（浏览器自动播放策略）
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1;
      this.masterGain.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.settings.sfx;
      this.sfxGain.connect(this.masterGain);
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = this.settings.bgm * 0.4;
      this.bgmGain.connect(this.masterGain);
    } catch (e) { console.warn("Audio init failed", e); }
  }

  resume() { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); }

  setSfxVol(v) { this.settings.sfx = v; if (this.sfxGain) this.sfxGain.gain.value = v; }
  setBgmVol(v) { this.settings.bgm = v; if (this.bgmGain) this.bgmGain.gain.value = v * 0.4; }

  // 通用振荡器音
  _tone(freq, dur, type = "square", vol = 0.3, freqEnd = null, when = 0) {
    if (!this.ctx || this.settings.muted) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  // 噪声爆破（爆炸用）
  _noise(dur, vol = 0.3, filterFreq = 1000, when = 0) {
    if (!this.ctx || this.settings.muted) return;
    const t0 = this.ctx.currentTime + when;
    const bufSize = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter); filter.connect(g); g.connect(this.sfxGain);
    src.start(t0); src.stop(t0 + dur);
  }

  // SFX 字典
  play(name) {
    if (!this.ctx) return;
    switch (name) {
      case "shoot":      this._tone(800, 0.06, "square", 0.12, 400); break;
      case "hit":        this._tone(200, 0.05, "triangle", 0.15); break;
      case "explode":    this._noise(0.25, 0.3, 1200); this._tone(120, 0.2, "sine", 0.2, 60); break;
      case "bigExplode": this._noise(0.6, 0.45, 800); this._tone(80, 0.5, "sine", 0.3, 30); this._noise(0.4, 0.3, 400, 0.05); break;
      case "bossExplode":this._noise(1.2, 0.6, 600); this._tone(60, 1.0, "sine", 0.4, 20); this._noise(0.8, 0.4, 300, 0.1); break;
      case "pickup":     this._tone(523, 0.08, "sine", 0.2); this._tone(659, 0.08, "sine", 0.2, null, 0.06); this._tone(784, 0.12, "sine", 0.2, null, 0.12); break;
      case "powerup":    [523,587,659,698,784,880,988,1047].forEach((f,i)=>this._tone(f,0.1,"square",0.15,null,i*0.06)); break;
      case "hurt":       this._tone(150, 0.3, "sawtooth", 0.3, 40); this._noise(0.2, 0.2, 500); break;
      case "shield":     this._tone(440, 0.15, "sine", 0.25, 880); break;
      case "revive":     this._tone(200, 0.4, "sine", 0.3, 800); break;
      case "skill":      this._noise(0.5, 0.4, 2000); this._tone(200, 0.5, "sawtooth", 0.3, 1500); break;
      case "bomb":       this._noise(0.8, 0.5, 1500); this._tone(100, 0.6, "sine", 0.3, 50); break;
      case "enemyShoot": this._tone(300, 0.05, "square", 0.08, 200); break;
      case "bossShoot":  this._tone(250, 0.08, "sawtooth", 0.12, 150); break;
      case "bossWarn":   for (let i=0;i<5;i++) this._tone(800, 0.1, "square", 0.2, null, i*0.2); break;
      case "bossBerserk":this._tone(100, 0.6, "sawtooth", 0.4, 300); this._noise(0.5, 0.3, 500); break;
      case "levelup":    this._tone(523,0.1,"sine",0.2); this._tone(784,0.15,"sine",0.2,null,0.1); break;
      case "gameover":   this._tone(440,0.3,"sawtooth",0.3,220); this._tone(330,0.4,"sawtooth",0.3,165,0.25); this._tone(220,0.6,"sawtooth",0.3,110,0.55); break;
      case "victory":    [523,659,784,1047].forEach((f,i)=>this._tone(f,0.3,"square",0.2,null,i*0.15)); break;
      case "uiClick":    this._tone(600, 0.04, "square", 0.1, 900); break;
      case "chipSelect": this._tone(440, 0.1, "sine", 0.2, 660); this._tone(660, 0.15, "sine", 0.2, 880, 0.1); break;
    }
  }

  // ===== BGM：循环合成（鼓点+贝斯+琶音） =====
  startBGM() {
    if (!this.ctx || this.bgmPlaying) return;
    this.bgmPlaying = true;
    this.bgmStep = 0;
    this.bgmTimer = 0;
  }
  stopBGM() { this.bgmPlaying = false; }

  updateBGM(dt, intensity = 1) {
    if (!this.ctx || !this.bgmPlaying) return;
    this.bgmTimer -= dt;
    if (this.bgmTimer > 0) return;
    const stepDur = 140 / intensity; // ms per step，Boss战加速
    this.bgmTimer = stepDur;
    const step = this.bgmStep % 16;
    const t0 = this.ctx.currentTime;
    // 鼓点
    if (step % 4 === 0) this._noise(0.08, 0.25 * this.settings.bgm, 200);
    if (step % 8 === 4) this._noise(0.05, 0.15 * this.settings.bgm, 1000);
    // 贝斯
    const bassNotes = [55, 55, 0, 73, 0, 55, 65, 0, 55, 0, 73, 0, 65, 0, 49, 0];
    const bn = bassNotes[step];
    if (bn) this._tone(bn, stepDur / 1000 * 0.9, "sawtooth", 0.12 * this.settings.bgm, bn);
    // 琶音
    const arpNotes = [220, 277, 330, 415, 330, 277, 220, 277];
    const an = arpNotes[step % 8];
    if (step % 2 === 0) this._tone(an, 0.12, "triangle", 0.08 * this.settings.bgm, an * 0.5);
    this.bgmStep++;
  }
}
