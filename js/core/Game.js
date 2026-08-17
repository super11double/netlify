/* ============================================================
   Game.js - 游戏主类（入口、主循环、状态机、实体编排）
   状态：MENU / PLAYING / BOSS / PAUSED / CHIP / GAMEOVER / VICTORY
   ============================================================ */
class Game {
  constructor() {
    this.canvas = document.getElementById("game");
    this.ctx = this.canvas.getContext("2d");
    this._resizeCanvas();
    window.addEventListener("resize", () => this._resizeCanvas());

    // 实体集合
    this.player = null;
    this.enemies = [];
    this.bullets = [];         // 玩家子弹
    this.enemyBullets = [];
    this.items = [];
    this.particles = [];
    this.wingmen = [];
    this.boss = null;
    this.bossLasers = [];      // Boss 激光列表（普通垂直激光）
    this.bossSweepLasers = []; // Boss 横扫激光（扇形）
    this.gravityBombs = [];    // 引力炸弹
    this.equipMissiles = [];   // 装备：追踪导弹
    this.equipBombs = [];      // 装备：范围炸弹（抛物线飞行）
    this.equipRailguns = [];   // 装备：电磁炮（高速贯穿弹）
    this.equipChainballs = []; // 装备：弹射链球
    this.equipCluster = [];    // 装备：子母弹
    this.equipLasers = [];     // 装备：直线激光（每帧重新计算命中）
    this.equipBladerings = []; // 装备：近身切割环
    this.equipDrones = [];     // 装备：浮游炮渲染信息
    this.equipSniperBeams = [];// 装备：狙击瞬发射线
    this.floatTexts = [];      // 浮动文字

    // 对象池
    this.bulletPool = new Pool(() => new Bullet(), (b, ...a) => b.reset(...a), 40);
    this.enemyBulletPool = new Pool(() => new Bullet(), (b, ...a) => b.reset(...a), 40);
    this.particlePool = new Pool(() => new Particle(), (p, ...a) => p.reset(...a), 80);

    // 子系统
    this.save = new SaveSystem();
    this.settings = { shake: true, lowperf: false };
    this.renderer = new Renderer(this);
    this.input = new Input(this);
    this.audio = new AudioMgr();
    this.collision = new Collision(this);
    this.ui = new UISystem(this);
    this.skills = new SkillSystem(this);
    this.spawn = new SpawnSystem(this);
    this.waves = new WaveSystem(this);
    // 新增装备/技能/商店/积分子系统
    this.equips = new EquipSystem(this);
    this.activeSkills = new ActiveSkillSystem(this);
    this.shop = new ShopSystem(this);
    this.score = new ScoreSystem(this);
    // 给装备/技能/积分/商店互相注入引用
    this.shop.fromSave(this.save.get());

    // 游戏状态
    this.state = {
      state: "MENU",           // 当前状态
      mode: "level",           // level / endless / timed
      chapter: 1, stage: 1,
      wave: 0,
      score: 0,
      combo: 0, maxCombo: 0, comboTimer: 0,
      kills: 0,
      coins: 0,
      level: 1, exp: 0, expToNext: CONFIG.EXP_BASE,
      timer: 0, timerActive: false, startTimer: 180000,
      bossKilled: false,
      bossesKilled: 0,
      startHp: 0,
      damageTaken: 0,
    };

    // 循环
    this.lastTime = 0;
    this.frame = 0;
    this.fps = 60;
    this.fpsSamples = [];
    this.pausedForChip = false;
    this.bossWarningActive = false;

    // Konami 彩蛋监听
    this._konamiSeq = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","KeyB","KeyA"];
    this._konamiIdx = 0;
    window.addEventListener("keydown", (e) => this._onKonami(e));

    this.ui.showTitle();
    this.start();
  }

  _resizeCanvas() {
    // 检测设备类型和屏幕方向
    const isLandscape = window.innerWidth > window.innerHeight;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
                   || ('ontouchstart' in window && window.innerWidth < 900);

    // PC端最大宽度限制更宽
    const pcMaxW = isMobile ? 540 : 620;
    const maxW = Math.min(window.innerWidth, pcMaxW);
    const maxH = window.innerHeight;

    // 横屏时：以高度为基准，宽度更宽也不怕
    const ratio = CONFIG.WIDTH / CONFIG.HEIGHT;
    let w, h;

    if (isLandscape && isMobile) {
      // 手机横屏：优先适配高度
      h = Math.min(maxH, window.innerHeight - 4);
      w = h * ratio;
      if (w > maxW * 0.9) { w = maxW * 0.9; h = w / ratio; }
    } else {
      // 竖屏 / PC：优先适配宽度，再限制高度
      w = maxW;
      h = w / ratio;
      if (h > maxH) { h = maxH; w = h * ratio; }
    }

    // 边距修正：手机端留一点安全边距
    if (isMobile) {
      const pad = isLandscape ? 4 : 8;
      if (w + pad * 2 > window.innerWidth) { w = window.innerWidth - pad * 2; h = w / ratio; }
      if (h + pad * 2 > window.innerHeight) { h = window.innerHeight - pad * 2; w = h * ratio; }
    }

    this.canvas.style.width = Math.floor(w) + "px";
    this.canvas.style.height = Math.floor(h) + "px";
    this.canvas.width = CONFIG.WIDTH;
    this.canvas.height = CONFIG.HEIGHT;

    // 记录当前设备状态供其他系统使用
    this.deviceInfo = { isMobile, isLandscape };
  }

  start() { requestAnimationFrame((t) => this.loop(t)); }

  loop(timestamp) {
    // 全局兜底：update/render 任何异常都不能中断 rAF，否则游戏就"死机"了
    try {
      let dt = timestamp - this.lastTime;
      this.lastTime = timestamp;
      if (!isFinite(dt) || dt < 0) dt = 16;       // 时间戳异常兜底
      if (dt > 100) dt = 100;                     // 防止切后台后大跳
      this.frame++;

      // FPS 采样
      if (dt > 0) {
        this.fpsSamples.push(1000 / dt);
        if (this.fpsSamples.length > 30) this.fpsSamples.shift();
        this.fps = Math.round(this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length);
      }

      this.renderer.update(dt);

      const inPlay = (this.state.state === "PLAYING" || this.state.state === "BOSS") && !this.pausedForChip;
      if (inPlay) {
        try { this.update(dt); }
        catch (e) { console.error("[Game.update]", e); }
      }
      try { this.render(); }
      catch (e) { console.error("[Game.render]", e); }

      // BGM
      if (this.audio.bgmPlaying) {
        const intensity = this.state.state === "BOSS" ? 1.5 : 1;
        try { this.audio.updateBGM(dt, intensity); } catch (e) {}
      }

      if (CONFIG.DEBUG) {
        try { this._updateDebug(); } catch (e) {}
      }
    } catch (e) {
      console.error("[Game.loop] outer", e);
    } finally {
      // 关键：无论上面发生什么，rAF 必须继续
      requestAnimationFrame((t) => this.loop(t));
    }
  }

  update(dt) {
    const s = this.state;
    // 防御 dt 异常
    if (!isFinite(dt) || dt <= 0) dt = 16;
    if (dt > 50) dt = 50; // 单帧上限，防卡顿后子弹穿屏

    // 输入
    try { this.input.update(); } catch (e) { console.error("[input]", e); }

    // 玩家
    if (this.player) {
      try { this.player.update(dt, this); } catch (e) { console.error("[player]", e); }
    }

    // 各类实体：使用索引循环 + 缓存长度，避免迭代中数组被修改导致跳项或异常
    // 僚机
    let n = this.wingmen.length;
    for (let i = 0; i < n; i++) {
      try { this.wingmen[i].update(dt, this); } catch (e) { console.error("[wing]", e); }
    }
    // 敌机
    n = this.enemies.length;
    for (let i = 0; i < n; i++) {
      const e = this.enemies[i];
      if (!e || e.dead) continue;
      try { e.update(dt, this); } catch (err) { console.error("[enemy]", err); }
    }
    // Boss
    if (this.boss) {
      try { this.boss.update(dt, this); } catch (e) { console.error("[boss]", e); }
      if (this.boss.dead) { this.boss = null; }
    }
    // Boss 激光（缓存长度，避免迭代中 spawn）
    n = this.bossLasers.length;
    for (let i = 0; i < n; i++) {
      const lz = this.bossLasers[i];
      if (!lz || lz.dead) continue;
      try { this._updateBossLaser(lz, dt); } catch (e) { console.error("[bossLaser]", e); }
    }
    // Boss 横扫激光
    n = this.bossSweepLasers.length;
    for (let i = 0; i < n; i++) {
      const lz = this.bossSweepLasers[i];
      if (!lz || lz.dead) continue;
      try { this._updateSweepLaser(lz, dt); } catch (e) { console.error("[sweep]", e); }
    }
    // 引力炸弹
    n = this.gravityBombs.length;
    for (let i = 0; i < n; i++) {
      const gb = this.gravityBombs[i];
      if (!gb || gb.dead) continue;
      try { this._updateGravityBomb(gb, dt); } catch (e) { console.error("[gbomb]", e); }
    }
    // 装备：追踪导弹
    n = this.equipMissiles.length;
    for (let i = 0; i < n; i++) {
      const m = this.equipMissiles[i];
      if (!m || m.dead) continue;
      try { this._updateEquipMissile(m, dt); } catch (e) { console.error("[missile]", e); }
    }
    // 装备：范围炸弹（抛物线飞行）
    n = this.equipBombs.length;
    for (let i = 0; i < n; i++) {
      const b = this.equipBombs[i];
      if (!b || b.dead) continue;
      try { this._updateEquipBomb(b, dt); } catch (e) { console.error("[ebomb]", e); }
    }
    // 装备：电磁炮（高速贯穿弹）
    n = this.equipRailguns.length;
    for (let i = 0; i < n; i++) {
      const r = this.equipRailguns[i];
      if (!r || r.dead) continue;
      try { this._updateEquipRailgun(r, dt); } catch (e) { console.error("[rail]", e); }
    }
    // 装备：子母弹（母弹飞行 + 分裂）
    n = this.equipCluster.length;
    for (let i = 0; i < n; i++) {
      const c = this.equipCluster[i];
      if (!c || c.dead) continue;
      try { this._updateEquipCluster(c, dt); } catch (e) { console.error("[cluster]", e); }
    }
    // 装备：直线激光（装备 laser 每帧生成一次）
    n = this.equipLasers.length;
    for (let i = 0; i < n; i++) {
      const l = this.equipLasers[i];
      if (!l || l.dead) continue;
      try { this._updateEquipLaser(l, dt); } catch (e) { console.error("[equipLaser]", e); }
    }
    // 装备：近身切割环（每 tick 施加伤害 + life 递减）
    n = this.equipBladerings.length;
    for (let i = 0; i < n; i++) {
      const b = this.equipBladerings[i];
      if (!b || b.dead) continue;
      try {
        // life 递减：setBladeringState 每帧重置，但万一未重置也能自动过期
        b.life -= 1;
        if (b.life <= 0) { b.dead = true; continue; }
        // 旋转动画（在 update 中推进）
        b.rotationAngle = (b.rotationAngle || 0) + (Math.PI * 2 * dt) / 1000;
        // 每 tick 伤害（已在 applyBladeringDamage 施加过一次，这里仅保险若 EquipSystem 未触发时兜底）
      } catch (e) { console.error("[bladering]", e); }
    }
    // 装备：狙击射线（短命中即消失射线）
    n = this.equipSniperBeams.length;
    for (let i = 0; i < n; i++) {
      const sb = this.equipSniperBeams[i];
      if (!sb || sb.dead) continue;
      try { this._updateEquipSniper(sb, dt); } catch (e) { console.error("[sniper]", e); }
    }
    // 子弹
    n = this.bullets.length;
    for (let i = 0; i < n; i++) {
      const b = this.bullets[i];
      if (!b || b.dead) continue;
      try { b.update(dt, this); } catch (e) { console.error("[bullet]", e); }
    }
    n = this.enemyBullets.length;
    for (let i = 0; i < n; i++) {
      const b = this.enemyBullets[i];
      if (!b || b.dead) continue;
      try { b.update(dt, this); } catch (e) { console.error("[eBullet]", e); }
    }
    // 道具
    n = this.items.length;
    for (let i = 0; i < n; i++) {
      const it = this.items[i];
      if (!it || it.dead) continue;
      try { it.update(dt, this); } catch (e) { console.error("[item]", e); }
    }
    // 粒子
    n = this.particles.length;
    for (let i = 0; i < n; i++) {
      const p = this.particles[i];
      if (!p || p.dead) continue;
      try { p.update(dt); } catch (e) { console.error("[particle]", e); }
    }
    // 浮动文字
    n = this.floatTexts.length;
    for (let i = 0; i < n; i++) {
      const ft = this.floatTexts[i];
      if (!ft) continue;
      try { ft.y -= 0.6; ft.life -= dt; } catch (e) {}
    }

    // 连击衰减
    if (s.comboTimer > 0) {
      s.comboTimer -= dt;
      if (s.comboTimer <= 0) s.combo = 0;
    }
    // 计时器（限时模式）
    if (s.timerActive) {
      s.timer -= dt;
      if (s.timer <= 0) {
        s.timer = 0; s.timerActive = false;
        try { this.onTimedEnd(); } catch (e) { console.error("[timedEnd]", e); }
      }
    }
    // 生成系统
    try { this.spawn.update(dt); } catch (e) { console.error("[spawn]", e); }
    try { this.waves.update(dt); } catch (e) { console.error("[waves]", e); }
    // 装备 / 主动技能 / 商店 / 积分 子系统
    if (this.equips) {
      try { this.equips.update(dt / 1000); } catch (e) { console.error("[equips]", e); }
    }
    if (this.activeSkills) {
      try { this.activeSkills.update(dt / 1000); } catch (e) { console.error("[activeSkills]", e); }
    }
    // 碰撞
    try { this.collision.checkAll(); } catch (e) { console.error("[collision]", e); }
    // 清理
    try { this._cleanup(); } catch (e) { console.error("[cleanup]", e); }

    // 每 10 帧同步 HUD
    if (this.frame % 10 === 0) {
      try { this.ui.syncHUD(); } catch (e) { console.error("[syncHUD]", e); }
    }
  }

  render() {
    const ctx = this.ctx;
    try {
      ctx.save();
      // 屏幕震动
      if (this.renderer.shakeAmount > 0.1) ctx.translate(this.renderer.shakeX, this.renderer.shakeY);

      // 背景
      try { this.renderer.drawBackground(ctx); } catch (e) {}
      // 道具（底层）
      for (let i = 0; i < this.items.length; i++) {
        try { if (this.items[i] && !this.items[i].dead) this.items[i].draw(ctx); } catch (e) {}
      }
      // 敌机
      for (let i = 0; i < this.enemies.length; i++) {
        try { if (this.enemies[i] && !this.enemies[i].dead) this.enemies[i].draw(ctx); } catch (e) {}
      }
      // Boss
      if (this.boss) { try { this.boss.draw(ctx); } catch (e) {} }
      // Boss 激光
      for (let i = 0; i < this.bossLasers.length; i++) {
        try { if (this.bossLasers[i] && !this.bossLasers[i].dead)
          this.renderer.drawBossLaser(ctx, this.bossLasers[i]); } catch (e) {}
      }
      // 敌机子弹
      for (let i = 0; i < this.enemyBullets.length; i++) {
        try { if (this.enemyBullets[i] && !this.enemyBullets[i].dead) this.enemyBullets[i].draw(ctx); } catch (e) {}
      }
      // 玩家子弹
      for (let i = 0; i < this.bullets.length; i++) {
        try { if (this.bullets[i] && !this.bullets[i].dead) this.bullets[i].draw(ctx); } catch (e) {}
      }
      // 玩家
      if (this.player) { try { this.player.draw(ctx); } catch (e) {} }
      // 僚机
      for (let i = 0; i < this.wingmen.length; i++) {
        try { if (this.wingmen[i] && !this.wingmen[i].dead) this.wingmen[i].draw(ctx); } catch (e) {}
      }
      // 粒子
      for (let i = 0; i < this.particles.length; i++) {
        try { if (this.particles[i] && !this.particles[i].dead) this.particles[i].draw(ctx); } catch (e) {}
      }
      // 装备：追踪导弹
      for (let i = 0; i < this.equipMissiles.length; i++) {
        try { if (this.equipMissiles[i] && !this.equipMissiles[i].dead) this._drawMissile(ctx, this.equipMissiles[i]); } catch (e) {}
      }
      // 装备：范围炸弹
      for (let i = 0; i < this.equipBombs.length; i++) {
        try { if (this.equipBombs[i] && !this.equipBombs[i].dead) this._drawEquipBomb(ctx, this.equipBombs[i]); } catch (e) {}
      }
      // 装备：电磁炮
      for (let i = 0; i < this.equipRailguns.length; i++) {
        try { if (this.equipRailguns[i] && !this.equipRailguns[i].dead) this._drawRailgun(ctx, this.equipRailguns[i]); } catch (e) {}
      }
      // 装备：子母弹
      for (let i = 0; i < this.equipCluster.length; i++) {
        try { if (this.equipCluster[i] && !this.equipCluster[i].dead) this._drawCluster(ctx, this.equipCluster[i]); } catch (e) {}
      }
      // 装备：弹射链球
      for (let i = 0; i < this.equipChainballs.length; i++) {
        try { this._drawChainball(ctx, this.equipChainballs[i]); } catch (e) {}
      }
      // 装备：直线激光
      for (let i = 0; i < this.equipLasers.length; i++) {
        try { if (this.equipLasers[i] && !this.equipLasers[i].dead) this._drawEquipLaser(ctx, this.equipLasers[i]); } catch (e) {}
      }
      // 装备：近身切割环
      for (let i = 0; i < this.equipBladerings.length; i++) {
        try { if (this.equipBladerings[i] && !this.equipBladerings[i].dead) this._drawBladering(ctx, this.equipBladerings[i]); } catch (e) {}
      }
      // 装备：浮游炮
      for (let i = 0; i < this.equipDrones.length; i++) {
        try { if (this.equipDrones[i] && this.equipDrones[i].x) this._drawDrone(ctx, this.equipDrones[i]); } catch (e) {}
      }
      // 装备：狙击射线
      for (let i = 0; i < this.equipSniperBeams.length; i++) {
        try { if (this.equipSniperBeams[i] && !this.equipSniperBeams[i].dead) this._drawSniper(ctx, this.equipSniperBeams[i]); } catch (e) {}
      }
      // Boss 横扫激光
      for (let i = 0; i < this.bossSweepLasers.length; i++) {
        try { if (this.bossSweepLasers[i] && !this.bossSweepLasers[i].dead) this._drawSweepLaser(ctx, this.bossSweepLasers[i]); } catch (e) {}
      }
      // 引力炸弹
      for (let i = 0; i < this.gravityBombs.length; i++) {
        try { if (this.gravityBombs[i] && !this.gravityBombs[i].dead) this._drawGravityBomb(ctx, this.gravityBombs[i]); } catch (e) {}
      }
      // 浮动文字
      try { this._drawFloatTexts(ctx); } catch (e) {}

      ctx.restore();

      // 白闪（不受震动影响）
      try { this.renderer.drawWhiteFlash(ctx); } catch (e) {}

      // Boss 警告
      if (this.bossWarningActive) {
        try { this._drawBossWarning(ctx); } catch (e) {}
      }
    } catch (e) {
      console.error("[Game.render]", e);
      // 确保 ctx 状态恢复，避免下次渲染继承错误状态
      try { ctx.restore(); } catch (_) {}
    }
  }

  _drawFloatTexts(ctx) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // 索引循环：防止 floatTexts 在迭代期间被 swap-pop 清理时导致异常
    const fts = this.floatTexts;
    for (let fi = 0, fl = fts.length; fi < fl; fi++) {
      const ft = fts[fi];
      if (!ft) continue;
      const a = Math2.clamp(ft.life / ft.maxLife, 0, 1);
      ctx.globalAlpha = a;
      ctx.font = `bold ${ft.size || 14}px Consolas, monospace`;
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.restore();
  }

  _cleanup() {
    // 高性能：原地 swap-pop，不重建数组（避免 GC 抖动）
    // bullets / enemyBullets / particles 三组受 Pool 管理
    this.bullets = _swapPopFilter(this.bullets, b => !b.dead);
    this.enemyBullets = _swapPopFilter(this.enemyBullets, b => !b.dead);
    this.particles = _swapPopFilter(this.particles, p => !p.dead);
    this.bulletPool.sweep();
    this.enemyBulletPool.sweep();
    this.particlePool.sweep();
    this.enemies = _swapPopFilter(this.enemies, e => !e.dead);
    this.items = _swapPopFilter(this.items, i => !i.dead);
    this.wingmen = _swapPopFilter(this.wingmen, w => !w.dead);
    this.bossLasers = _swapPopFilter(this.bossLasers, l => !l.dead);
    this.bossSweepLasers = _swapPopFilter(this.bossSweepLasers, l => !l.dead);
    this.gravityBombs = _swapPopFilter(this.gravityBombs, g => !g.dead);
    this.equipMissiles = _swapPopFilter(this.equipMissiles, m => !m.dead);
    this.equipBombs = _swapPopFilter(this.equipBombs, b => !b.dead);
    this.equipRailguns = _swapPopFilter(this.equipRailguns, r => !r.dead);
    this.equipChainballs = _swapPopFilter(this.equipChainballs, c => c.life > 0);
    this.equipCluster = _swapPopFilter(this.equipCluster, c => !c.dead);
    this.equipLasers = _swapPopFilter(this.equipLasers, l => !l.dead);
    this.equipBladerings = _swapPopFilter(this.equipBladerings, b => !b.dead);
    this.equipSniperBeams = _swapPopFilter(this.equipSniperBeams, b => !b.dead);
    this.floatTexts = _swapPopFilter(this.floatTexts, f => f.life > 0);
  }

  // ====== 实体生成方法 ======
  spawnEnemy(type, x, y, opt = {}) {
    const e = new Enemy();
    e.reset(type, x, y, opt);
    this.enemies.push(e);
    return e;
  }

  // 子弹硬上限：防止装备全开时失控
  // 普通弹幕过多时直接丢弃最老的一颗
  _enforceBulletCap(arr, cap) {
    if (arr.length >= cap) {
      // 标记最老的（已飞行最远的）为 dead，让 _cleanup 回收
      let oldestIdx = 0, oldestY = -Infinity;
      for (let i = 0; i < arr.length; i++) {
        if (arr[i].y > oldestY) { oldestY = arr[i].y; oldestIdx = i; }
      }
      arr[oldestIdx].dead = true;
    }
  }

  spawnPlayerBullet(x, y, vx, vy, opt = {}) {
    this._enforceBulletCap(this.bullets, CONFIG.MAX_PLAYER_BULLETS || 280);
    const b = this.bulletPool.acquire(x, y, vx, vy, { side: "player", ...opt });
    this.bullets.push(b); // Pool 已保证唯一，无需 includes
    return b;
  }

  spawnEnemyBullet(x, y, vx, vy, color, radius, damage, opt = {}) {
    this._enforceBulletCap(this.enemyBullets, CONFIG.MAX_ENEMY_BULLETS || 400);
    const b = this.enemyBulletPool.acquire(x, y, vx, vy, {
      side: "enemy", color, radius, damage, ...opt,
    });
    this.enemyBullets.push(b);
    return b;
  }

  spawnItem(x, y, type) {
    const it = new Item();
    it.reset(x, y, type);
    this.items.push(it);
    return it;
  }

  spawnParticle(x, y, opt = {}) {
    if (this.settings.lowperf && this.particles.length > 60) return;
    // 粒子硬上限：防止爆炸特效失控
    if (this.particles.length >= (CONFIG.MAX_PARTICLES || 200)) return;
    const p = this.particlePool.acquire(x, y, opt);
    this.particles.push(p); // Pool 保证唯一，无需 includes
    return p;
  }

  spawnExplosion(x, y, color, scale = "normal") {
    const cfg = {
      small:  { count: 6,  sp: [1, 3],  life: [200, 400], size: [2, 4] },
      normal: { count: 16, sp: [1, 5],  life: [300, 600], size: [2, 5] },
      big:    { count: 28, sp: [2, 7],  life: [400, 800], size: [3, 6] },
      huge:   { count: 45, sp: [2, 9],  life: [500, 1000],size: [3, 8] },
    }[scale] || { count: 16, sp: [1, 5], life: [300, 600], size: [2, 5] };
    for (let i = 0; i < cfg.count; i++) {
      const a = Math.random() * Math2.TAU;
      const sp = Math2.rand(cfg.sp[0], cfg.sp[1]);
      this.spawnParticle(x, y, {
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        color, life: Math2.rand(cfg.life[0], cfg.life[1]),
        size: Math2.rand(cfg.size[0], cfg.size[1]),
        shape: Math2.chance(0.3) ? "spark" : "circle", angle: a, glow: 10,
      });
    }
    // 中心光环
    this.spawnRing(x, y, color, scale === "huge" ? 60 : 30);
  }

  spawnRing(x, y, color, maxR = 30) {
    // 用一个 ring 粒子表示
    const p = this.spawnParticle(x, y, { color, life: 400, size: maxR * 0.5, shape: "ring", vx: 0, vy: 0, glow: 12 });
    if (p) p.maxLife = 400;
  }

  spawnHitSpark(x, y, color) {
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math2.TAU;
      this.spawnParticle(x, y, {
        vx: Math.cos(a) * 2, vy: Math.sin(a) * 2,
        color: Math2.chance(0.5) ? "#ffffff" : color, life: 150, size: 2, shape: "spark", angle: a,
      });
    }
  }

  spawnFloatText(x, y, text, color, size = 14) {
    this.floatTexts.push({ x, y, text, color, size, life: 900, maxLife: 900 });
  }

  // ======================================================================
  // 装备生成 & 更新 & 渲染辅助方法（EquipSystem 调用这些入口）
  // ======================================================================

  // ---------- 1. 普通装备子弹（霰弹 / 浮游炮） ----------
  spawnEquipBullet(opt) {
    const { x, y, vx, vy, damage, maxRange, color, size, from } = opt;
    this._enforceBulletCap(this.bullets, CONFIG.MAX_PLAYER_BULLETS || 280);
    const life = maxRange ? (maxRange / (Math.hypot(vx, vy) / 60)) : 6000;
    const b = this.bulletPool.acquire(x, y, vx / 60, vy / 60, {
      side: "player",
      damage: damage || 10,
      radius: size || 4,
      color: color || CONFIG.COLORS.neonCyan,
      life: Number.isFinite(life) ? life : 6000,
      shape: "bolt",
    });
    b.equipFrom = from || "shotgun";
    this.bullets.push(b);
    return b;
  }

  // ---------- 2. 追踪导弹 ----------
  spawnEquipMissile(opt) {
    const m = {
      x: opt.x, y: opt.y,
      vx: 0, vy: -(opt.speed || 400) / 60,
      speed: (opt.speed || 400) / 60,
      turnRate: opt.turnRate || 3,
      directDamage: opt.directDamage || 120,
      splashRadius: opt.splashRadius || 40,
      splashFalloff: opt.splashFalloff || 0.5,
      color: opt.color || "#FF5522",
      colorTrail: opt.colorTrail || "#FFDD44",
      onDead: opt.onDead,
      dead: false, life: 6000,
      trail: [],
    };
    this.equipMissiles.push(m);
    return m;
  }
  _updateEquipMissile(m, dt) {
    const t = (this.boss && !this.boss.dead && !this.boss.entering) ? this.boss : this._enemiesNearest(m.x, m.y);
    if (t) {
      const targetAng = Math.atan2(t.y - m.y, t.x - m.x);
      const curAng = Math.atan2(m.vy, m.vx);
      const newAng = Math2.turnToward(curAng, targetAng, m.turnRate * dt / 1000);
      m.vx = Math.cos(newAng) * m.speed;
      m.vy = Math.sin(newAng) * m.speed;
    }
    m.x += m.vx * (dt / 16.66);
    m.y += m.vy * (dt / 16.66);
    m.life -= dt;
    if (m.life <= 0 || m.y < -20 || m.y > CONFIG.HEIGHT + 20 || m.x < -20 || m.x > CONFIG.WIDTH + 20) {
      m.dead = true; if (m.onDead) m.onDead();
    }
    m.trail.push({ x: m.x, y: m.y });
    if (m.trail.length > 5) m.trail.shift();
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.dead) continue;
      if (Math2.circleHit(m.x, m.y, 6, e.x, e.y, e.def.hitRadius)) {
        this._explodeMissile(m); return;
      }
    }
    if (this.boss && !this.boss.dead && !this.boss.entering) {
      if (Math2.circleHit(m.x, m.y, 6, this.boss.x, this.boss.y, this.boss.hitRadius)) {
        this._explodeMissile(m); return;
      }
    }
  }
  _explodeMissile(m) {
    if (m.dead) return;
    m.dead = true; if (m.onDead) m.onDead();
    this.spawnExplosion(m.x, m.y, m.color, "normal");
    const r = m.splashRadius;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]; if (e.dead) continue;
      const d = Math.hypot(e.x - m.x, e.y - m.y);
      if (d < r) {
        const mul = Math.max(0.3, 1 - (d / r) * (1 - m.splashFalloff));
        e.takeDamage(m.directDamage * mul, this, true);
      }
    }
    if (this.boss && !this.boss.dead && !this.boss.entering) {
      const d = Math.hypot(this.boss.x - m.x, this.boss.y - m.y);
      if (d < r) {
        const mul = Math.max(0.3, 1 - (d / r) * (1 - m.splashFalloff));
        this.boss.takeDamage(m.directDamage * mul, this, true);
      }
    }
  }
  _drawMissile(ctx, m) {
    ctx.save();
    for (let i = 0; i < m.trail.length; i++) {
      const t = m.trail[i];
      const a = (i + 1) / m.trail.length;
      ctx.globalAlpha = a * 0.7;
      ctx.fillStyle = m.colorTrail;
      ctx.beginPath(); ctx.arc(t.x, t.y, 3 * a, 0, Math2.TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.translate(m.x, m.y);
    ctx.rotate(Math.atan2(m.vy, m.vx) + Math.PI / 2);
    ctx.fillStyle = m.color;
    ctx.shadowColor = m.color; ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(4, 6); ctx.lineTo(0, 3); ctx.lineTo(-4, 6);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // ---------- 3. 范围炸弹（抛物线） ----------
  spawnEquipBomb(opt) {
    const { x, y, tx, ty, gravity, flightSec, centerDamage, edgeDamage, blastRadius, color } = opt;
    const dx = (tx || x) - x;
    const dy = (ty || (y - 200)) - y;
    const fs = flightSec || 1.2;
    const g = gravity || 200;
    // 解运动方程：计算初始 vx/vy 使 fs 秒后到达 (tx, ty)
    const vx = dx / fs / 60;
    const vy = (dy - 0.5 * g * fs * fs) / fs / 60;
    this.equipBombs.push({
      x, y, vx, vy,
      gravity: g / 60 / 60, // px/frame^2
      flightSec: fs, t: 0,
      centerDamage: centerDamage || 250,
      edgeDamage: edgeDamage || 80,
      blastRadius: blastRadius || 80,
      color: color || "#FF3366",
      dead: false,
    });
  }
  _updateEquipBomb(b, dt) {
    b.t += dt / 1000;
    b.vy += b.gravity * (dt / 16.66);
    b.x += b.vx * (dt / 16.66);
    b.y += b.vy * (dt / 16.66);
    if (b.t >= b.flightSec || b.y > CONFIG.HEIGHT + 20) this._explodeBomb(b);
  }
  _explodeBomb(b) {
    if (b.dead) return;
    b.dead = true;
    this.spawnExplosion(b.x, b.y, b.color, "big");
    this.shake(CONFIG.SHAKE_MED);
    const r = b.blastRadius;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]; if (e.dead) continue;
      const d = Math.hypot(e.x - b.x, e.y - b.y);
      if (d < r) {
        const mul = 1 - (d / r) * (1 - b.edgeDamage / b.centerDamage);
        e.takeDamage(b.centerDamage * Math.max(0.2, mul), this, true);
      }
    }
    if (this.boss && !this.boss.dead && !this.boss.entering) {
      const d = Math.hypot(this.boss.x - b.x, this.boss.y - b.y);
      if (d < r) {
        const mul = 1 - (d / r) * (1 - b.edgeDamage / b.centerDamage);
        this.boss.takeDamage(b.centerDamage * Math.max(0.2, mul), this, true);
      }
    }
  }
  _drawEquipBomb(ctx, b) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.fillStyle = b.color;
    ctx.shadowColor = b.color; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math2.TAU); ctx.fill();
    ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  // ---------- 4. 贯穿电磁炮 ----------
  spawnEquipRailgun(opt) {
    const { x, y, angle, speed, damage, pierceFalloff, color, colorArc, colorLightning, width } = opt;
    this.equipRailguns.push({
      x, y,
      vx: Math.cos(angle || -Math.PI / 2) * (speed || 1200) / 60,
      vy: Math.sin(angle || -Math.PI / 2) * (speed || 1200) / 60,
      damage: damage || 180,
      pierceFalloff: pierceFalloff || 0.9,
      color: color || "#00FF88",
      colorArc: colorArc || "#66EEFF",
      colorLightning: colorLightning || "#4488FF",
      width: width || 10,
      hit: new Set(),
      dead: false, life: 2000,
    });
  }
  _updateEquipRailgun(r, dt) {
    r.x += r.vx * (dt / 16.66);
    r.y += r.vy * (dt / 16.66);
    r.life -= dt;
    if (r.life <= 0 || r.y < -30 || r.y > CONFIG.HEIGHT + 30 || r.x < -30 || r.x > CONFIG.WIDTH + 30) {
      r.dead = true; return;
    }
    let curDmg = r.damage;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.dead || r.hit.has(e.id)) continue;
      if (Math2.circleHit(r.x, r.y, r.width / 2, e.x, e.y, e.def.hitRadius)) {
        e.takeDamage(curDmg, this, true);
        r.hit.add(e.id);
        curDmg *= r.pierceFalloff;
        this.spawnHitSpark(r.x, r.y, r.color);
      }
    }
    if (this.boss && !this.boss.dead && !this.boss.entering && !r.hit.has(this.boss.id)) {
      if (Math2.circleHit(r.x, r.y, r.width / 2, this.boss.x, this.boss.y, this.boss.hitRadius)) {
        this.boss.takeDamage(curDmg, this, true);
        r.hit.add(this.boss.id);
        r.dead = true;
        this.spawnHitSpark(r.x, r.y, r.color);
      }
    }
  }
  _drawRailgun(ctx, r) {
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(Math.atan2(r.vy, r.vx));
    ctx.strokeStyle = r.color; ctx.lineWidth = r.width;
    ctx.shadowColor = r.colorArc; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(20, 0); ctx.stroke();
    ctx.lineWidth = r.width / 2; ctx.strokeStyle = r.colorLightning;
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.stroke();
    ctx.restore();
  }

  // ---------- 5. 蓄力狙击（瞬发射线） ----------
  spawnEquipSniper(opt) {
    const { x, y, angle, damage, color, colorCharge, chargeLv } = opt;
    const ang = angle || -Math.PI / 2;
    const endX = x + Math.cos(ang) * 2000;
    const endY = y + Math.sin(ang) * 2000;
    const hitTargets = [];
    const maxHit = 10;
    // 需要 distPointToSegment 工具
    const segFunc = Math2.distPointToSegment || function (px, py, ax, ay, bx, by) {
      const dx = bx - ax, dy = by - ay;
      const len2 = dx * dx + dy * dy;
      if (len2 === 0) return Math.hypot(px - ax, py - ay);
      let t = ((px - ax) * dx + (py - ay) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    };
    for (let i = 0; i < this.enemies.length && hitTargets.length < maxHit; i++) {
      const e = this.enemies[i]; if (e.dead) continue;
      if (segFunc(e.x, e.y, x, y, endX, endY) < (e.def.hitRadius + 6)) {
        hitTargets.push(e);
      }
    }
    if (this.boss && !this.boss.dead && !this.boss.entering) {
      if (segFunc(this.boss.x, this.boss.y, x, y, endX, endY) < (this.boss.hitRadius + 8)) {
        this.boss.takeDamage(damage || 100, this, true);
        this.spawnHitSpark(this.boss.x, this.boss.y, color || "#FF0040");
      }
    }
    for (const tgt of hitTargets) {
      tgt.takeDamage(damage || 100, this, true);
      this.spawnHitSpark(tgt.x, tgt.y, color || "#FF0040");
    }
    this.equipSniperBeams.push({
      x, y, endX, endY,
      color: color || "#FF0040",
      colorCharge: colorCharge || "#FF4488",
      chargeLv: chargeLv || 0,
      dead: false, life: 250, maxLife: 250,
    });
  }
  _drawSniper(ctx, b) {
    const a = b.life / b.maxLife;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = b.colorCharge;
    ctx.lineWidth = (10 + b.chargeLv * 3) * a;
    ctx.shadowColor = b.color; ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.endX, b.endY); ctx.stroke();
    ctx.restore();
  }

  // ---------- 6. 子母弹 ----------
  spawnEquipClusterMother(opt) {
    const { x, y, angle, motherSpeed, subSpeed, motherDamage, subDamage, subCount, splitSec, subSpreadDeg, color, colorSub, colorBurst } = opt;
    const ang = angle || -Math.PI / 2;
    this.equipCluster.push({
      x, y,
      vx: Math.cos(ang) * (motherSpeed || 500) / 60,
      vy: Math.sin(ang) * (motherSpeed || 500) / 60,
      motherDamage: motherDamage || 100,
      subDamage: subDamage || 40,
      subCount: subCount || 5,
      splitSec: splitSec || 0.5,
      subSpreadDeg: subSpreadDeg || 60,
      subSpeed: subSpeed || 450,
      color: color || "#1565C0",
      colorSub: colorSub || "#4FC3F7",
      colorBurst: colorBurst || "#90CAF9",
      t: 0, split: false,
      dead: false, life: 6000,
    });
  }
  _updateEquipCluster(c, dt) {
    c.t += dt / 1000;
    c.x += c.vx * (dt / 16.66);
    c.y += c.vy * (dt / 16.66);
    c.life -= dt;
    if (!c.split && c.t >= c.splitSec) {
      c.split = true;
      const baseAngle = Math.atan2(c.vy, c.vx);
      const spreadRad = (c.subSpreadDeg * Math.PI) / 180;
      for (let i = 0; i < c.subCount; i++) {
        const tt = c.subCount === 1 ? 0 : (i / (c.subCount - 1)) - 0.5;
        const a = baseAngle + tt * spreadRad;
        this.spawnEquipBullet({
          x: c.x, y: c.y,
          vx: Math.cos(a) * c.subSpeed, vy: Math.sin(a) * c.subSpeed,
          damage: c.subDamage, color: c.colorSub, size: 3, from: "cluster",
        });
      }
      this.spawnExplosion(c.x, c.y, c.colorBurst, "small");
      if (this.boss && !this.boss.dead && !this.boss.entering) {
        if (Math2.circleHit(c.x, c.y, 10, this.boss.x, this.boss.y, this.boss.hitRadius)) {
          this.boss.takeDamage(c.motherDamage, this, true);
        }
      }
      c.dead = true; return;
    }
    if (c.life <= 0 || c.y < -30 || c.y > CONFIG.HEIGHT + 30) c.dead = true;
  }

  // ---------- 7b. 直线激光 update / sniper（之前缺失，导致数组对象 life 永不递减 → 残留） ----------
  _updateEquipLaser(l, dt) {
    // 激光是每帧从 applyLaserDamage push 的新对象，这里只负责让老的淡出
    l.life -= 1.5;  // 稍微快一点淡出，避免叠太多
    if (l.life <= 0) l.dead = true;
  }
  spawnEquipSniper(opt) {
    const { x, y, angle, damage, color, colorCharge, chargeLv } = opt;
    const len = CONFIG.HEIGHT * 1.5;
    const ex = x + Math.cos(angle) * len;
    const ey = y + Math.sin(angle) * len;
    this.equipSniperBeams.push({
      x, y, ex, ey, angle,
      damage, color: color || "#FF3366",
      colorCharge: colorCharge || "#FFFFFF",
      chargeLv: chargeLv || 0,
      dead: false, life: 18, maxLife: 18,
    });
    // 瞬发命中伤害（只造成一次）
    const hitR = 6 + (chargeLv || 0) * 2;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]; if (e.dead) continue;
      // 线段到圆心的距离
      const dx = ex - x, dy = ey - y;
      const t = Math2.clamp(((e.x - x) * dx + (e.y - y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
      const cx = x + dx * t, cy = y + dy * t;
      if (Math.hypot(cx - e.x, cy - e.y) < hitR + e.def.hitRadius) {
        e.takeDamage(damage, this, true);
        this.spawnHitSpark(e.x, e.y, color || "#FF3366");
      }
    }
    if (this.boss && !this.boss.dead && !this.boss.entering) {
      const b = this.boss;
      const dx = ex - x, dy = ey - y;
      const t = Math2.clamp(((b.x - x) * dx + (b.y - y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
      const cx = x + dx * t, cy = y + dy * t;
      if (Math.hypot(cx - b.x, cy - b.y) < hitR + b.hitRadius) {
        b.takeDamage(damage, this, true);
        this.spawnHitSpark(b.x, b.y, color || "#FF3366");
      }
    }
    if (this.audio) this.audio.play("sniper" in this.audio.sounds ? "sniper" : "shoot");
  }
  _updateEquipSniper(sb, dt) {
    sb.life -= 1.2;
    if (sb.life <= 0) sb.dead = true;
  }
  notifyLaserState(state) {
    // 预留：过热 / 冷却完成等 HUD 提示
    if (state === "overheat") {
      this.spawnFloatText(this.player ? this.player.x : CONFIG.WIDTH / 2,
        this.player ? this.player.y - 40 : 100,
        "激光过热!", "#FF6B6B", 14);
    }
  }
  _drawCluster(ctx, c) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(Math.atan2(c.vy, c.vx));
    ctx.fillStyle = c.color;
    ctx.shadowColor = c.color; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math2.TAU); ctx.fill();
    ctx.restore();
  }

  // ---------- 7. 直线激光（每帧伤害） ----------
  applyLaserDamage(opt) {
    const { x1, y1, color, colorCore, width, damage, heatRatio } = opt;
    const endX = x1, endY = -50;
    const w = width || 8;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]; if (e.dead) continue;
      if (e.y < y1 && Math.abs(e.x - endX) < (w / 2 + e.def.hitRadius)) {
        e.takeDamage(damage || 8, this, true);
      }
    }
    if (this.boss && !this.boss.dead && !this.boss.entering) {
      const b = this.boss;
      if (b.y < y1 && Math.abs(b.x - endX) < (w / 2 + b.hitRadius)) {
        b.takeDamage(damage || 8, this, true);
        this.spawnHitSpark(b.x, b.y, color || "#00E5FF");
      }
    }
    this.equipLasers.push({
      x: x1, y: y1, endX, endY,
      color: color || "#00E5FF",
      colorCore: colorCore || "#FFFFFF",
      width: w, heatRatio: heatRatio || 0,
      dead: false, life: 20, maxLife: 20,
    });
    // 关键：限制最多保留最近 2 条激光用于淡出尾迹，防止每帧 push 一条 → 数组膨胀 → 视觉"残留"叠加
    if (this.equipLasers.length > 2) {
      // 标记多余的老激光为 dead，交给 _cleanup swap-pop 回收
      const extra = this.equipLasers.length - 2;
      for (let i = 0; i < extra; i++) this.equipLasers[i].dead = true;
    }
  }
  _drawEquipLaser(ctx, l) {
    const a = l.life / l.maxLife;
    ctx.save();
    ctx.globalAlpha = a;
    const grad = ctx.createLinearGradient(l.x, l.y, l.x, l.endY);
    grad.addColorStop(0, l.colorCore);
    grad.addColorStop(Math.max(0.05, 1 - (l.heatRatio || 0) * 0.3), l.color);
    ctx.strokeStyle = grad; ctx.lineWidth = (l.width || 8) * a;
    ctx.shadowColor = l.color; ctx.shadowBlur = 15 + (l.heatRatio || 0) * 10;
    ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(l.endX, l.endY); ctx.stroke();
    ctx.restore();
  }

  // ---------- 8. 近身切割环 ----------
  applyBladeringDamage(opt) {
    const { x, y, radius, damage } = opt;
    const r = radius || 60;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]; if (e.dead) continue;
      if (Math.hypot(e.x - x, e.y - y) < r + e.def.hitRadius) {
        e.takeDamage(damage || 15, this, true);
      }
    }
    if (this.boss && !this.boss.dead && !this.boss.entering) {
      if (Math.hypot(this.boss.x - x, this.boss.y - y) < r + this.boss.hitRadius) {
        this.boss.takeDamage(damage || 15, this, true);
      }
    }
  }
  setBladeringState(opt) {
    this.equipBladerings = [{ ...opt, dead: false, life: 20, maxLife: 20 }];
  }
  _drawBladering(ctx, b) {
    const a = b.life / b.maxLife;
    ctx.save();
    ctx.globalAlpha = 0.5 * a;
    ctx.translate(b.x, b.y);
    ctx.strokeStyle = b.colorRing || "#4FC3F7"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, b.radius, 0, Math2.TAU); ctx.stroke();
    ctx.globalAlpha = a;
    ctx.rotate(b.rotationAngle || 0);
    ctx.fillStyle = b.color || "#F2F2F2";
    ctx.shadowColor = b.color || "#F2F2F2"; ctx.shadowBlur = 8;
    const bc = b.bladeCount || 2;
    for (let i = 0; i < bc; i++) {
      ctx.rotate(Math2.TAU / bc);
      ctx.beginPath();
      ctx.moveTo(-3, -b.radius + 4); ctx.lineTo(3, -b.radius + 4);
      ctx.lineTo(2, -b.radius - 10); ctx.lineTo(-2, -b.radius - 10);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  // ---------- 9. 浮游炮 ----------
  setDronePositions(drones, def) {
    this.equipDrones = drones.map(d => ({
      ...d,
      color: def.color,
      colorCore: def.colorCore,
    }));
  }
  _drawDrone(ctx, d) {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.fillStyle = d.color || "#E6F1FF";
    ctx.shadowColor = d.colorCore || "#00A8FF"; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math2.TAU); ctx.fill();
    ctx.fillStyle = d.colorCore || "#00A8FF";
    ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math2.TAU); ctx.fill();
    ctx.restore();
  }

  // ---------- 10. 弹射链球 ----------
  setChainballPositions(balls, def) {
    this.equipChainballs = (balls || []).map(b => ({
      x: b.x, y: b.y,
      vx: b.vx, vy: b.vy,
      life: b.life,
      radius: b.radius || def.radius,
      color: def.color,
      colorChain: def.colorChain,
      colorSpark: def.colorSpark,
      prevX: b.prevX, prevY: b.prevY,
    }));
    // 索引循环：防止链球数组迭代中修改 enemies
    const allBalls = balls || [];
    for (let bi = 0, bl = allBalls.length; bi < bl; bi++) {
      const b = allBalls[bi];
      if (b.life <= 0 || !b.damage) continue;
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i]; if (e.dead) continue;
        if (Math2.circleHit(b.x, b.y, b.radius, e.x, e.y, e.def.hitRadius)) {
          e.takeDamage(b.damage, this, true);
          this.spawnHitSpark(b.x, b.y, def.colorSpark || "#FFCC33");
        }
      }
      if (this.boss && !this.boss.dead && !this.boss.entering) {
        if (Math2.circleHit(b.x, b.y, b.radius, this.boss.x, this.boss.y, this.boss.hitRadius)) {
          this.boss.takeDamage(b.damage, this, true);
        }
      }
    }
  }
  _drawChainball(ctx, b) {
    if (!b || !b.x) return;
    ctx.save();
    ctx.strokeStyle = b.colorChain || "#CCCCCC"; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.prevX || b.x, b.prevY || b.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.fillStyle = b.color || "#2A2A2A";
    ctx.shadowColor = b.colorSpark || "#FFCC33"; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.radius || 14, 0, Math2.TAU); ctx.fill();
    ctx.restore();
  }

  // ---------- 11. Boss 横扫激光 + 引力炸弹绘制 ----------
  _drawSweepLaser(ctx, lz) {
    ctx.save();
    if (lz.phase === "warn") {
      const blink = Math.floor(lz.t / 200) % 2 === 0;
      ctx.globalAlpha = blink ? 0.8 : 0.3;
      ctx.strokeStyle = CONFIG.COLORS.neonRed; ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(lz.originX || CONFIG.WIDTH / 2, lz.originY || 100,
        CONFIG.HEIGHT - (lz.originY || 100), -Math.PI, 0);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      const ang = lz.currentAngle || 0;
      const ox = lz.originX || CONFIG.WIDTH / 2;
      const oy = lz.originY || 100;
      const beamAng = Math.PI / 2 + ang;
      const len = CONFIG.HEIGHT * 1.2;
      const ex = ox + Math.cos(beamAng) * len;
      const ey = oy + Math.sin(beamAng) * len;
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = CONFIG.COLORS.neonPurple; ctx.lineWidth = lz.width;
      ctx.shadowColor = CONFIG.COLORS.neonPink; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ex, ey); ctx.stroke();
    }
    ctx.restore();
  }
  _drawGravityBomb(ctx, gb) {
    ctx.save();
    if (gb.phase === "warn") {
      const blink = Math.floor(gb.t / 150) % 2 === 0;
      ctx.globalAlpha = blink ? 0.7 : 0.3;
      ctx.strokeStyle = CONFIG.COLORS.neonPurple; ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.arc(gb.x, gb.y, gb.radius, 0, Math2.TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = CONFIG.COLORS.neonPurple;
      ctx.beginPath(); ctx.arc(gb.x, gb.y, 5, 0, Math2.TAU); ctx.fill();
    } else {
      ctx.globalAlpha = 0.35;
      const grad = ctx.createRadialGradient(gb.x, gb.y, 0, gb.x, gb.y, gb.radius);
      grad.addColorStop(0, CONFIG.COLORS.neonPink);
      grad.addColorStop(1, "#000000");
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(gb.x, gb.y, gb.radius, 0, Math2.TAU); ctx.fill();
    }
    ctx.restore();
  }

  _enemiesNearest(x, y) {
    let best = null, bestD = Infinity;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e || e.dead) continue;
      const d = Math2.dist2 ? Math2.dist2(x, y, e.x, e.y) : ((e.x - x) ** 2 + (e.y - y) ** 2);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  spawnBoss(bossId, opts = {}) {
    const b = new Boss();
    b.reset(bossId, this, opts);
    this.boss = b;
    this.state.state = "BOSS";
    if (this.audio) this.audio.play("bossWarn");
  }

  // Boss 普通激光（单柱垂直）
  fireBossLaser(originX, targetX, warnMs, fireMs) {
    this.bossLasers.push({
      x: targetX, originX, width: 50,
      phase: "warn", t: 0,
      warnMs, fireMs,
      damage: 25,
      dead: false,
    });
  }
  _updateBossLaser(lz, dt) {
    if (lz.dead) return;
    lz.t += dt;
    if (lz.phase === "warn" && lz.t >= lz.warnMs) { lz.phase = "fire"; lz.t = 0; if (this.audio) this.audio.play("bossShoot"); }
    else if (lz.phase === "fire" && lz.t >= lz.fireMs) { lz.dead = true; }
  }

  // Boss 横扫激光（180° 扇形）
  fireBossSweepLaser(originX, centerX, warnMs, sweepMs, widthPx) {
    this.bossSweepLasers.push({
      originX, originY: 100,
      centerX, width: widthPx || 20,
      phase: "warn", t: 0,
      warnMs, sweepMs,
      currentAngle: 0,     // -90°~+90°
      damage: 18,
      dead: false,
    });
  }
  _updateSweepLaser(lz, dt) {
    if (lz.dead) return;
    lz.t += dt;
    if (lz.phase === "warn" && lz.t >= lz.warnMs) {
      lz.phase = "fire"; lz.t = 0;
      if (this.audio) this.audio.play("bossShoot");
    } else if (lz.phase === "fire") {
      const progress = Math2.clamp(lz.t / lz.sweepMs, 0, 1);
      lz.currentAngle = (progress - 0.5) * Math.PI; // -π/2 ~ +π/2
      // ===== 碰撞检测（必须在 UPDATE 阶段做，不能放在 draw 里）=====
      if (this.player && this.player.alive) {
        const ang = lz.currentAngle || 0;
        const ox = lz.originX || CONFIG.WIDTH / 2;
        const oy = lz.originY || 100;
        const beamAng = Math.PI / 2 + ang;
        const len = CONFIG.HEIGHT * 1.2;
        const px = this.player.x - ox;
        const py = this.player.y - oy;
        const la = Math.atan2(py, px);
        // 每 100ms 最多造成一次伤害，避免扫射激光瞬间满血秒杀
        if (!lz.lastHitMs || (lz.t - lz.lastHitMs) > 100) {
          if (Math.abs(la - beamAng) < 0.12 && Math.hypot(px, py) < len) {
            this.player.takeDamage(lz.damage || 18, this);
            lz.lastHitMs = lz.t;
          }
        }
      }
      if (lz.t >= lz.sweepMs) lz.dead = true;
    }
  }

  // 引力炸弹
  spawnGravityBomb(x, y, warnMs, radius, damage, lifeMs) {
    this.gravityBombs.push({
      x, y, radius, damage, lifeMs, warnMs,
      phase: "warn", t: 0,
      dead: false,
    });
  }
  _updateGravityBomb(gb, dt) {
    if (gb.dead) return;
    gb.t += dt;
    if (gb.phase === "warn" && gb.t >= gb.warnMs) {
      gb.phase = "explode"; gb.t = 0;
      this.shake(CONFIG.SHAKE_MED);
      this.spawnExplosion(gb.x, gb.y, CONFIG.COLORS.neonPurple, "normal");
    } else if (gb.phase === "explode") {
      // 爆炸阶段：吸引玩家 + 造成伤害
      if (this.player && this.player.alive) {
        const dx = gb.x - this.player.x, dy = gb.y - this.player.y;
        const d = Math.hypot(dx, dy);
        if (d < gb.radius && d > 0) {
          // 吸引
          this.player.x += (dx / d) * 1.2;
          this.player.y += (dy / d) * 1.2;
          // 伤害（每秒2次）
          if (Math.floor(gb.t * 2) !== Math.floor((gb.t - dt) * 2)) {
            this.player.takeDamage(gb.damage, this);
          }
        }
      }
      if (gb.t >= gb.lifeMs) gb.dead = true;
    }
  }

  // Boss 冲撞玩家（已在 Boss.js _ramState 初始化）
  startBossRam(boss) {
    // no-op：逻辑在 Boss.js 中通过 boss._ramState 自行处理
    // 保留此方法仅为 bossData.js 里 `if (game.startBossRam)` 的存在性检查
  }

  // ====== 分数 / 经验 / 连击 ======
  addScore(n) {
    let mul = 1;
    if (this.state.mode === "timed") mul = Math.min(CONFIG.COMBO_MULTIPLIER_MAX, 1 + this.state.combo * 0.1);
    this.state.score += Math.round(n * mul);
    this.state.kills++;
    this.state.combo++;
    this.state.comboTimer = CONFIG.COMBO_TIMEOUT_MS;
    if (this.state.combo > this.state.maxCombo) this.state.maxCombo = this.state.combo;
    // 100 连杀彩蛋
    if (this.state.kills === 100 && this.save.markEasterEgg("hundredKills")) {
      this.showEasterEgg("🏅 百人斩成就解锁！", "单局击杀 100 架敌机");
    }
  }
  addExp(n) { this.skills.addExp(n); }

  // ====== 游戏流程 ======
  /**
   * 开启一场游戏
   * @param {"level"|"endless"|"timed"} mode  游戏模式
   * @param {{chapter?:number,stage?:number}} [opts]  仅 level 模式：指定从哪一章哪一关开始（默认 1-1，选关面板会传）
   */
  startGame(mode, opts) {
    this.audio.init();
    this.audio.resume();
    const save = this.save.get();
    const planeId = save.selectedPlane || "F01";
    if (!this.isPlaneUnlocked(planeId, save)) { alert("该战机未解锁"); return; }

    opts = opts || {};
    const startChapter = Math.max(1, Math.min(CONFIG.CHAPTER_COUNT, opts.chapter || 1));
    const startStage   = Math.max(1, Math.min(CONFIG.STAGES_PER_CHAPTER, opts.stage || 1));

    // 重置状态
    Object.assign(this.state, {
      state: "PLAYING", mode,
      chapter: startChapter,
      stage: startStage,
      score: 0, combo: 0, maxCombo: 0, comboTimer: 0, kills: 0,
      coins: 0, level: 1, exp: 0, expToNext: CONFIG.EXP_BASE,
      timer: (CONFIG.MODES[mode].timerSec || 0) * 1000,
      startTimer: (CONFIG.MODES[mode].timerSec || 0) * 1000,
      timerActive: CONFIG.MODES[mode].timerSec > 0,
      bossKilled: false, bossesKilled: 0, damageTaken: 0,
    });

    // 重置实体
    this.enemies = []; this.items = []; this.wingmen = [];
    this.bossLasers = []; this.bossSweepLasers = []; this.gravityBombs = [];
    this.equipMissiles = []; this.equipBombs = []; this.equipRailguns = [];
    this.equipChainballs = []; this.equipCluster = []; this.equipLasers = [];
    this.equipBladerings = []; this.equipDrones = []; this.equipSniperBeams = [];
    this.floatTexts = [];
    this.boss = null;
    this.bulletPool.clear(); this.bullets = [];
    this.enemyBulletPool.clear(); this.enemyBullets = [];
    this.particlePool.clear(); this.particles = [];

    // 玩家
    this.player = new Player();
    this.player.init(planeId, this);
    this.player.equippedChips = [];
    this.player.targetX = this.player.x;
    this.player.targetY = this.player.y;
    this.state.startHp = this.player.maxHp;

    // 系统
    this.spawn.reset();
    // 关键：初始化装备 runtime（否则装备虽挂载但不会开火）
    if (this.equips) this.equips.resetForRun(this.equips.equippedIds);
    // 初始化主动技能 runtime（CD/SP/buff 清零）
    if (this.activeSkills) this.activeSkills.resetForRun();
    if (mode === "level") {
      this.waves.startLevel(startChapter, startStage);
    } else {
      this.waves.spawning = null;
    }

    this.ui.showHUD();
    this.audio.startBGM();
  }

  pause() {
    if (this.state.state !== "PLAYING" && this.state.state !== "BOSS") return;
    this._prevState = this.state.state;
    this.state.state = "PAUSED";
    this.ui.showPause();
  }
  resume() {
    if (this.state.state !== "PAUSED") return;
    this.state.state = this._prevState || "PLAYING";
    this.ui.hidePause();
  }
  restart() {
    this.ui.hidePause();
    if (this.state.mode === "level") {
      this.startGame("level", { chapter: this.state.chapter, stage: this.state.stage });
    } else {
      this.startGame(this.state.mode);
    }
  }
  quitToTitle() {
    this.ui.hidePause();
    this.state.state = "MENU";
    this.audio.stopBGM();
    this.ui.showTitle();
  }

  // 芯片选择暂停/恢复
  requestChipChoice() { this.skills.offerChoice(); }
  pauseForChip() { this.pausedForChip = true; }
  resumeAfterChip() { this.pausedForChip = false; }

  // 必杀技
  tryUseSkill() {
    if (!this.player || !this.player.canUseSkill()) return;
    this.player.useSkill(this);
  }

  activateSkill(skillId, def) {
    if (this.audio) this.audio.play("skill");
    this.shake(CONFIG.SHAKE_MED);
    switch (def.type) {
      case "clear":
        // 清空敌机子弹 + 全屏伤害
        this.enemyBullets.forEach(b => b.dead = true);
        this.enemies.forEach(e => e.takeDamage(def.damage, this, true));
        if (this.boss) this.boss.takeDamage(def.damage, this, true);
        this._screenFlashEffect();
        break;
      case "beam": {
        // 贯穿激光：在玩家正上方画一条强力激光（持续1秒）
        this.enemyBullets.forEach(b => { if (Math.abs(b.x - this.player.x) < 60) b.dead = true; });
        this.enemies.forEach(e => { if (Math.abs(e.x - this.player.x) < 60) e.takeDamage(def.damage, this, true); });
        if (this.boss && Math.abs(this.boss.x - this.player.x) < 80) this.boss.takeDamage(def.damage, this, true);
        // 视觉：在玩家列发射一束激光弹（pierce 99）
        for (let i = 0; i < 3; i++) {
          this.spawnPlayerBullet(this.player.x, this.player.y, 0, -20, { shape: "bolt", radius: 12, damage: def.damage / 3, color: CONFIG.COLORS.neonCyan, glow: 24, pierce: 99, life: 800 });
        }
        break;
      }
      case "storm":
        this.enemyBullets.forEach(b => b.dead = true);
        this.enemies.forEach(e => e.takeDamage(def.damage, this, true));
        if (this.boss) this.boss.takeDamage(def.damage * 0.6, this, true);
        this._screenFlashEffect();
        // 环形粒子
        for (let i = 0; i < 60; i++) {
          const a = (i / 60) * Math2.TAU;
          this.spawnParticle(this.player.x, this.player.y, { vx: Math.cos(a)*6, vy: Math.sin(a)*6, color: CONFIG.COLORS.neonPink, life: 800, size: 4, shape: "spark", angle: a });
        }
        break;
      case "blackhole":
        // 黑洞：把敌机/子弹吸向中心并造成伤害
        this.enemyBullets.forEach(b => {
          const a = Math.atan2(this.player.y - b.y, this.player.x - b.x);
          b.vx = Math.cos(a) * 4; b.vy = Math.sin(a) * 4;
        });
        this.enemies.forEach(e => { e.takeDamage(def.damage, this, true); });
        if (this.boss) this.boss.takeDamage(def.damage * 0.5, this, true);
        this._screenFlashEffect();
        break;
      case "dash":
        this.player.invincibleTimer = 1500;
        this.enemies.forEach(e => { if (Math.abs(e.x - this.player.x) < 50) e.takeDamage(def.damage, this, true); });
        break;
      case "invincible":
        this.player.invincibleTimer = 5000;
        this.spawnRing(this.player.x, this.player.y, CONFIG.COLORS.neonGreen, 60);
        break;
    }
  }

  // 清屏炸弹
  useBomb() {
    if (!this.player || this.player.bombs <= 0) return;
    this.player.bombs--;
    this.enemyBullets.forEach(b => b.dead = true);
    this.enemies.forEach(e => e.takeDamage(150, this, true));
    if (this.boss) this.boss.takeDamage(200, this, true);
    if (this.audio) this.audio.play("bomb");
    this.shake(CONFIG.SHAKE_BIG);
    this._screenFlashEffect();
  }

  _screenFlashEffect() {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math2.TAU;
      const sp = Math2.rand(3, 10);
      this.spawnParticle(CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, { vx: Math.cos(a)*sp, vy: Math.sin(a)*sp, color: Math2.pick([CONFIG.COLORS.neonCyan, CONFIG.COLORS.neonPurple, CONFIG.COLORS.neonPink]), life: 600, size: Math2.rand(3,6), shape: "spark", angle: a });
    }
  }

  shake(amount) { this.renderer.shake(amount); }
  flashWhite(ms) { this.renderer.flashWhite(ms); }

  // 僚机同步
  syncWingmen() {
    if (!this.player) return;
    const lv = this.player.powerLevel;
    const bonus = this.player.bonusWingmen || 0;
    // Lv6+1架，Lv7+2架
    let count = lv >= 7 ? 2 : (lv >= 6 ? 1 : 0);
    count = Math.min(2, count + bonus);
    // 重建
    this.wingmen = [];
    for (let i = 0; i < count; i++) {
      const w = new Wingman();
      w.init(i === 0 ? -1 : 1, this);
      this.wingmen.push(w);
    }
  }

  // 玩家死亡
  onPlayerDeath() {
    this.state.state = "GAMEOVER";
    this.audio.stopBGM();
    if (this.audio) this.audio.play("gameover");
    setTimeout(() => this._showResult(false), 1200);
  }

  // 关卡进度 0~100%（仅闯关模式 level）
  getLevelProgress() {
    if (this.state.mode !== "level") return 0;
    const w = this.waves;
    if (!w || !w.stageDef) return 0;
    const def = w.stageDef;
    const totalWaves = Array.isArray(def.waves) ? def.waves.length : 0;

    // ========= 基础权重 =========
    // 有最终 Boss：杂兵区 70% + Boss 区 30%
    // 无最终 Boss：杂兵区 100%
    const hasFinalBoss = !!def.hasBoss;
    const gruntWeight = hasFinalBoss ? 70 : 100;
    const bossWeight  = hasFinalBoss ? 30 : 0;

    // 杂兵区内部分配：有小 Boss → waves 占 gruntWeight - 10，subBoss 血量占 10
    //               无小 Boss → waves 独占 gruntWeight
    const hasSub = !!def.hasSubBoss;
    const wavesWeight = hasSub ? (gruntWeight - 10) : gruntWeight;
    const subWeight   = hasSub ? 10 : 0;

    let progress = 0;

    // (1) waves 进度
    if (totalWaves > 0) {
      const waveRatio = Math.max(0, Math.min(1, w.waveIndex / totalWaves));
      progress += waveRatio * wavesWeight;
    } else {
      progress += wavesWeight; // 没有 waves 直接给满
    }

    // (2) 小 Boss 血量进度（出场后才累计）
    if (subWeight > 0) {
      if (w.subBossSpawned && this.boss && !this.boss.dead && !w.bossSpawned) {
        // 小 Boss 在场：按已掉血比例推进 subWeight 部分
        const hpRatio = this.boss.maxHp > 0 ? (1 - this.boss.hp / this.boss.maxHp) : 1;
        progress += Math.max(0, Math.min(1, hpRatio)) * subWeight;
      } else if (w.subBossSpawned && w.bossSpawned) {
        // 小 Boss 已被击败（最终 Boss 都出了）→ 小 Boss 权重直接加满
        progress += subWeight;
      }
      // 小 Boss 还没出场 → 不加（保持 0）
    }

    // (3) 最终 Boss 血量进度
    if (bossWeight > 0) {
      if (w.bossSpawned && this.boss && !this.boss.dead) {
        const hpRatio = this.boss.maxHp > 0 ? (1 - this.boss.hp / this.boss.maxHp) : 1;
        progress += Math.max(0, Math.min(1, hpRatio)) * bossWeight;
      } else if (w.bossSpawned && (!this.boss || this.boss.dead)) {
        // 最终 Boss 已死 → Boss 权直接加满
        progress += bossWeight;
      }
      // 最终 Boss 还没出场 → 不加
    }

    // 通关状态强行 100
    if (this.state.state === "VICTORY") progress = 100;

    return Math.max(0, Math.min(100, progress));
  }

  // 关卡通过
  onLevelClear() {
    if (this.state.mode !== "level") return;
    if (this.state.state === "VICTORY" || this.state.state === "GAMEOVER") return;
    // ========== 胜利统一流程：停止生成、停BGM、播音效 ==========
    this.state.state = "VICTORY";
    this.audio.stopBGM();
    if (this.audio) this.audio.play("victory");

    // 清屏结算，给玩家"胜利"反馈感
    this.spawnFloatText(CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, "关卡完成！", CONFIG.COLORS.neonCyan, 32);

    // ========== 1. 存档：标记通关 + 解锁下一关 ==========
    const curCh = this.state.chapter;
    const curSt = this.state.stage;
    this.save.markLevelCleared(curCh, curSt);

    // ========== 2. 关卡积分奖励（每关通过都给积分） ==========
    // 单关基础积分：30 + chapter*10，章节通关额外 +100
    let creditsGain = 30 + curCh * 10;
    let creditsReason = `通关奖励 · 第${curCh}章-${curSt}关`;
    const chapterEnded = curSt >= CONFIG.STAGES_PER_CHAPTER;
    if (chapterEnded) {
      creditsGain += 100;
      creditsReason += " ｜章节通关 +100";
    }
    creditsGain = Math.round(creditsGain);
    this.shop.addCredits(creditsGain);
    this.save.markProgress("totalCredits", this.shop.credits);
    this.spawnFloatText(CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 - 40, "💰 +" + creditsGain + " 积分", CONFIG.COLORS.neonYellow, 20);

    // ========== 3. 章节通关战机解锁 ==========
    let allCleared = false;
    if (chapterEnded) {
      if (curCh >= 2) this._tryUnlock("F02");
      if (curCh >= 4) this._tryUnlock("F03");
      if (curCh >= 6) { this.save.markProgress("roguelikeCleared", true); this._tryUnlock("F06"); }
      if (curCh >= CONFIG.CHAPTER_COUNT) {
        allCleared = true;
        this._tryUnlock("F05");
      }
    }

    // ========== 4. 延迟 1.5s 弹结算面板（非无缝） ==========
    //    计算"下一关"坐标：用于 hasNext 字段
    let hasNext = false;
    if (!allCleared) {
      let nextCh = curCh, nextSt = curSt + 1;
      if (nextSt > CONFIG.STAGES_PER_CHAPTER) { nextCh = curCh + 1; nextSt = 1; }
      hasNext = (nextCh <= CONFIG.CHAPTER_COUNT) && this.save.isLevelUnlocked(nextCh, nextSt);
    }
    setTimeout(() => {
      this._showResult(true, {
        levelClear: true,
        chapterEnded, allCleared,
        chapter: curCh, stage: curSt,
        hasNext,
        creditsGain, creditsReason,
      });
    }, 1500);
  }

  /** 兼容性：章节通关的战机解锁等逻辑已整合到 onLevelClear，不再直接走 _onChapterClear */
  _onChapterClear() {
    // 保留接口，防止其他地方误调用时报错（实际上所有关卡胜利 now 走 onLevelClear）
    this.onLevelClear();
  }

  _tryUnlock(planeId) {
    if (this.save.unlockPlane(planeId)) {
      this.showEasterEgg("🏆 解锁战机：" + PLANE_DATA[planeId].name + "！", PLANE_DATA[planeId].unlockDesc);
    }
  }

  onTimedEnd() {
    this.state.timerActive = false;
    this.state.state = "VICTORY";
    this.audio.stopBGM();
    if (this.audio) this.audio.play("victory");
    setTimeout(() => this._showResult(true), 800);
  }

  _showResult(win, ctx) {
    ctx = ctx || {};
    const s = this.state;
    const newHigh = s.score > this.save.get().highScore;
    // 评级
    let grade = "D";
    if (win) {
      if (s.score >= 50000) grade = "S";
      else if (s.score >= 30000) grade = "A";
      else if (s.score >= 15000) grade = "B";
      else grade = "C";
    }
    // 无伤 Boss 彩蛋
    if (win && s.bossKilled && s.damageTaken === 0 && this.save.markEasterEgg("noDamageBoss")) {
      this.showEasterEgg("💎 无伤击败Boss！", "全程未受任何伤害");
    }

    // ======================================================================
    // 结算积分：无尽是大头，其余模式也有对应产出
    // - 无尽：波次×100 + Boss×500 + 分数/50（主要获取途径）
    // - 闯关胜利：单关积分已经在 onLevelClear 里实时发放，这里不再重复计算
    // - 闯关失败：安慰积分（分数/200，最少 100）
    // - 限时挑战：分数/100 + 存活秒数×2
    // ======================================================================
    let creditsGain = 0;
    let creditsReason = "";
    try {
      if (ctx.levelClear && ctx.creditsGain) {
        // 闯关胜利：积分已在 onLevelClear 发放，这里直接复用传进来的数值（用于显示）
        creditsGain = ctx.creditsGain;
        creditsReason = ctx.creditsReason || "";
      } else if (s.mode === "endless") {
        const wavePart = s.wave * 100;
        const bossPart = (s.bossesKilled || 0) * 500;
        const scorePart = Math.floor(s.score / 50);
        creditsGain = wavePart + bossPart + scorePart;
        creditsReason = `无尽 · 波×100 + Boss×500 + 分数/50`;
        if (this.score) {
          if (s.wave > this.score.maxEndlessWave) this.score.maxEndlessWave = s.wave;
          this.score.totalCreditsEarned += creditsGain;
        }
        if (creditsGain > 0 && this.shop) this.shop.addCredits(creditsGain);
      } else if (s.mode === "level" && !win) {
        creditsGain = Math.max(100, Math.floor(s.score / 200));
        creditsReason = `闯关失败安慰 + 分数/200`;
        if (creditsGain > 0 && this.shop) this.shop.addCredits(creditsGain);
      } else if (s.mode === "timed") {
        const total = s.startTimer || (CONFIG.MODES["timed"].timerSec || 180) * 1000;
        const remain = Math.max(0, s.timer || 0);
        const timeSurv = Math.min(180, Math.max(0, Math.floor((total - remain) / 1000)));
        creditsGain = Math.floor(s.score / 100) + timeSurv * 2;
        creditsReason = `限时 · 分数/100 + 存活秒×2`;
        if (creditsGain > 0 && this.shop) this.shop.addCredits(creditsGain);
      }
    } catch (e) { console.error("[credits]", e); }

    this.save.addScore({
      mode: CONFIG.MODES[s.mode].name,
      plane: (this.player && this.player.planeId && PLANE_DATA[this.player.planeId]) ? PLANE_DATA[this.player.planeId].name : "未知战机",
      score: s.score,
      coins: s.coins,
      date: Date.now(),
    });
    // 保存累计积分
    if (this.shop) this.save.markProgress("totalCredits", this.shop.credits);
    // 给 UI 的参数：闯关模式才展示的章节/关卡/hasNext 字段
    this.ui.showResult(Object.assign({
      win, mode: s.mode, score: s.score, kills: s.kills, maxCombo: s.maxCombo,
      coins: s.coins, level: s.level, grade, newHigh,
      creditsGain, creditsReason,
    }, (s.mode === "level") ? {
      chapter: s.chapter, stage: s.stage,
      chapterEnd: !!ctx.chapterEnded,
      allCleared: !!ctx.allCleared,
      hasNext: !!ctx.hasNext,
    } : {}));
  }

  /** 结算面板：继续下一关 */
  continueNextLevel() {
    const s = this.state;
    if (s.mode !== "level") return;
    let nextCh = s.chapter, nextSt = s.stage + 1;
    if (nextSt > CONFIG.STAGES_PER_CHAPTER) { nextCh = s.chapter + 1; nextSt = 1; }
    if (nextCh > CONFIG.CHAPTER_COUNT) return; // 没了
    if (!this.save.isLevelUnlocked(nextCh, nextSt)) return;
    this.startGame("level", { chapter: nextCh, stage: nextSt });
  }
  /** 结算面板：重玩本关 */
  replayCurrentLevel() {
    const s = this.state;
    if (s.mode !== "level") return;
    this.startGame("level", { chapter: s.chapter, stage: s.stage });
  }

  // Boss 登场警告
  showBossWarning(cb) {
    this.bossWarningActive = true;
    if (this.audio) this.audio.play("bossWarn");
    setTimeout(() => { this.bossWarningActive = false; cb(); }, 2000);
  }
  _drawBossWarning(ctx) {
    ctx.save();
    const blink = Math.floor(Date.now() / 150) % 2 === 0;
    ctx.globalAlpha = blink ? 0.85 : 0.4;
    ctx.fillStyle = CONFIG.COLORS.neonRed;
    ctx.fillRect(0, CONFIG.HEIGHT / 2 - 50, CONFIG.WIDTH, 100);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#fff";
    ctx.font = "bold 36px Consolas, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = CONFIG.COLORS.neonRed;
    ctx.shadowBlur = 20;
    ctx.fillText("⚠ WARNING ⚠", CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 - 12);
    ctx.font = "bold 18px Consolas, monospace";
    ctx.fillText("BOSS 接近中", CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 + 20);
    ctx.restore();
  }

  // 彩蛋提示
  showEasterEgg(title, desc) {
    // 用浮动文字 + 临时横幅
    this.floatTexts.push({ x: CONFIG.WIDTH / 2, y: CONFIG.HEIGHT / 2, text: title, color: CONFIG.COLORS.neonYellow, size: 20, life: 2500, maxLife: 2500 });
    this.floatTexts.push({ x: CONFIG.WIDTH / 2, y: CONFIG.HEIGHT / 2 + 30, text: desc, color: CONFIG.COLORS.neonCyan, size: 14, life: 2500, maxLife: 2500 });
  }

  // 战机解锁判定
  isPlaneUnlocked(id, save) {
    const d = PLANE_DATA[id];
    if (!d) return false;
    if (d.unlock === "default") return true;
    if (save.unlockedPlanes.includes(id)) return true;
    return false;
  }

  // Konami 彩蛋：上上下下左右左右BA → 满火力+满能量
  _onKonami(e) {
    if (e.code !== this._konamiSeq[this._konamiIdx]) { this._konamiIdx = 0; return; }
    this._konamiIdx++;
    if (this._konamiIdx === this._konamiSeq.length) {
      this._konamiIdx = 0;
      if (this.save.markEasterEgg("konami")) {
        this.showEasterEgg("🎮 Konami 彩蛋触发！", "隐藏指令已激活");
      }
      if (this.player && this.player.alive) {
        this.player.powerLevel = CONFIG.MAX_POWER_LEVEL;
        this.player.skillEnergy = 100;
        this.player.hp = this.player.maxHp;
        this.syncWingmen();
        this.spawnRing(this.player.x, this.player.y, CONFIG.COLORS.neonYellow, 80);
      }
    }
  }

  // 调试
  debugNextWave() { if (this.waves) this.waves.skipToBoss(); }
  _updateDebug() {
    const el = document.getElementById("debug-panel");
    if (!el) return;
    el.style.display = "";
    el.textContent =
      `FPS:${this.fps} E:${this.enemies.length} B:${this.bullets.length} EB:${this.enemyBullets.length} P:${this.particles.length} ` +
      `HP:${this.player?Math.round(this.player.hp):0}/${this.player?this.player.maxHp:0} Lv:${this.player?this.player.powerLevel:0} ` +
      `Boss:${this.boss?Math.round(this.boss.hp/this.boss.maxHp*100)+"%":"-"}`;
  }

  // ======================================================================
  // 主动技能：爆发类 (burst)
  // ======================================================================
  burstJudgment(bossDamage, durationSec, clearNormalEnemies) {
    if (clearNormalEnemies !== false) {
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i]; if (e.dead) continue;
        e.takeDamage(99999, this, true); // 秒杀普通
      }
    }
    this.enemyBullets.forEach(b => b.dead = true);
    if (this.boss && !this.boss.dead) this.boss.takeDamage(bossDamage || 3000, this, true);
    this.shake(CONFIG.SHAKE_BIG);
    this._screenFlashEffect();
    for (let i = 0; i < 80; i++) {
      const a = Math.random() * Math2.TAU;
      const sp = Math2.rand(4, 12);
      this.spawnParticle(CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2, {
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        color: Math2.pick([CONFIG.COLORS.neonRed, CONFIG.COLORS.neonOrange, CONFIG.COLORS.neonYellow]),
        life: Math2.rand(400, 900), size: Math2.rand(3, 7), shape: "spark", angle: a, glow: 16,
      });
    }
  }

  burstMeteor(meteorCount, perMeteorDamage, blastRadius, durationSec) {
    const count = meteorCount || 10;
    const totalMs = (durationSec || 2.5) * 1000;
    const interval = totalMs / count;
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        if (this.state.state !== "PLAYING" && this.state.state !== "BOSS") return;
        const tx = 40 + Math.random() * (CONFIG.WIDTH - 80);
        const ty = 100 + Math.random() * (CONFIG.HEIGHT - 200);
        // 抛物线：从屏幕上方飞入，落点 (tx, ty)
        this.spawnEquipBomb({
          x: tx + (Math.random() - 0.5) * 100, y: -30,
          tx, ty, gravity: 400, flightSec: 0.7,
          centerDamage: perMeteorDamage || 500,
          edgeDamage: (perMeteorDamage || 500) * 0.35,
          blastRadius: blastRadius || 60,
          color: CONFIG.COLORS.neonOrange,
        });
      }, i * interval);
    }
  }

  // ======================================================================
  // 主动技能：生存类 (survive)
  // ======================================================================
  overlayShield(invincibilitySec) {
    // 已经在 player.invincibleTimer 中设置了无敌；这里加一层视觉环特效
    if (!this.player) return;
    this.spawnRing(this.player.x, this.player.y, CONFIG.COLORS.neonGreen, 50);
    this.floatTexts.push({
      x: this.player.x, y: this.player.y - 40,
      text: "绝对护盾!", color: CONFIG.COLORS.neonGreen, size: 16,
      life: 1500, maxLife: 1500,
    });
  }

  doTimeRewind(rewindSec, clearDebuff) {
    const p = this.player; if (!p) return;
    // 简化版回溯：恢复 60% 最大血量 + 清理敌弹
    const heal = Math.round(p.maxHp * 0.6);
    p.hp = Math.min(p.maxHp, p.hp + heal);
    if (clearDebuff !== false) {
      p.invincibleTimer = Math.max(p.invincibleTimer || 0, 1500);
    }
    this.enemyBullets.forEach(b => b.dead = true);
    this.spawnRing(p.x, p.y, CONFIG.COLORS.neonCyan, 70);
    this.spawnFloatText(p.x, p.y - 30, "时空回溯 +" + heal, CONFIG.COLORS.neonCyan);
    this.shake(CONFIG.SHAKE_SMALL);
  }

  // ======================================================================
  // 主动技能：控制类 (control)
  // ======================================================================
  applyEmp(cx, cy, stunRadius, stunSec) {
    // EMP：对范围内敌人施加 stun（跳过攻击/移动 stunSec 秒）
    this.enemyBullets.forEach(b => {
      const d = Math.hypot(b.x - cx, b.y - cy);
      if (d < (stunRadius || 300)) b.dead = true;
    });
    const ms = (stunSec || 3) * 1000;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]; if (e.dead) continue;
      const d = Math.hypot(e.x - cx, e.y - cy);
      if (d < (stunRadius || 300)) {
        e.stunTimer = Math.max(e.stunTimer || 0, ms); // 倒计时：ms
        e.fireTimerOffset = ms;
      }
    }
    // Boss 不会被眩晕，但清空其激光 / 引力炸弹
    if (this.boss && !this.boss.dead) {
      const d = Math.hypot(this.boss.x - cx, this.boss.y - cy);
      if (d < (stunRadius || 300)) {
        this.boss.attackTimer = Math.max(this.boss.attackTimer, ms);
      }
    }
    this.bossLasers = [];
    this.bossSweepLasers = [];
    this.gravityBombs = [];
    // 视觉：EMP 环
    for (let r = 1; r <= 4; r++) {
      setTimeout(() => {
        this.spawnParticle(cx, cy, {
          color: CONFIG.COLORS.neonCyan, life: 500,
          size: (stunRadius || 300) * (r / 4) * 0.5,
          shape: "ring", vx: 0, vy: 0, glow: 18,
        });
      }, r * 80);
    }
  }

  spawnBlackhole(cx, cy, pullRadius, durationSec, damagePerSec) {
    const ms = (durationSec || 5) * 1000;
    const start = Date.now();
    const r = pullRadius || 200;
    const dmgMul = damagePerSec || 100;
    const tick = () => {
      if (this.state.state !== "PLAYING" && this.state.state !== "BOSS") return;
      const elapsed = Date.now() - start;
      if (elapsed >= ms) return;
      // 拉拽敌人 + 子弹
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i]; if (e.dead) continue;
        const dx = cx - e.x, dy = cy - e.y;
        const d = Math.hypot(dx, dy);
        if (d < r && d > 5) {
          const pull = 2.5 * (1 - d / r);
          e.x += (dx / d) * pull;
          e.y += (dy / d) * pull;
          e.takeDamage(dmgMul / 60, this, true);
        }
      }
      for (let i = 0; i < this.enemyBullets.length; i++) {
        const b = this.enemyBullets[i]; if (b.dead) continue;
        const dx = cx - b.x, dy = cy - b.y;
        const d = Math.hypot(dx, dy);
        if (d < r && d > 3) {
          const pull = 3 * (1 - d / r);
          b.x += (dx / d) * pull;
          b.y += (dy / d) * pull;
        }
      }
      // 黑洞漩涡视觉
      const ang = (elapsed / 200) * Math2.TAU;
      for (let k = 0; k < 3; k++) {
        const a = ang + (k / 3) * Math2.TAU;
        this.spawnParticle(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5, {
          vx: 0, vy: 0,
          color: CONFIG.COLORS.neonPurple, life: 200,
          size: 4, shape: "spark", glow: 10,
        });
      }
      setTimeout(tick, 16);
    };
    tick();
    // 中心环
    this.spawnParticle(cx, cy, {
      color: CONFIG.COLORS.neonPink, life: ms,
      size: r * 0.35, shape: "ring", vx: 0, vy: 0, glow: 22,
    });
  }

  // ======================================================================
  // 主动技能：召唤类 (summon)
  // ======================================================================
  summonAirstrike(summonCount, perDps, durationSec) {
    // 战术空袭：在屏幕顶部召唤 summonCount 架协战机，持续射击 durationSec 秒
    const n = summonCount || 3;
    const ms = (durationSec || 15) * 1000;
    const dps = perDps || 200;
    const dmgPerShot = Math.round(dps * 0.4); // 每 0.4 秒一发
    const startMs = Date.now();
    const planes = [];
    for (let i = 0; i < n; i++) {
      planes.push({
        x: (CONFIG.WIDTH / (n + 1)) * (i + 1),
        y: 50,
      });
    }
    const fireLoop = () => {
      const elapsed = Date.now() - startMs;
      if (elapsed >= ms) return;
      if (this.state.state === "PLAYING" || this.state.state === "BOSS") {
        for (let i = 0; i < planes.length; i++) {
          const pl = planes[i];
          // 轻微摇摆
          pl.x += Math.sin((elapsed / 500) + i) * 0.6;
          // 自动锁敌射击
          const target = (this.boss && !this.boss.dead && !this.boss.entering) ? this.boss : this._enemiesNearest(pl.x, pl.y);
          let ang = -Math.PI / 2;
          if (target) ang = Math.atan2(target.y - pl.y, target.x - pl.x);
          this.spawnEquipBullet({
            x: pl.x, y: pl.y + 10,
            vx: Math.cos(ang) * 650, vy: Math.sin(ang) * 650,
            damage: dmgPerShot, color: CONFIG.COLORS.neonCyan, size: 3.5, from: "airstrike",
          });
          // 视觉：协战机作为临时粒子（每帧重绘成本高，用持久粒子）
          this.spawnParticle(pl.x, pl.y, {
            vx: 0, vy: 0, life: 400, size: 8, shape: "spark",
            color: CONFIG.COLORS.neonCyan, glow: 10,
          });
        }
      }
      setTimeout(fireLoop, 400);
    };
    fireLoop();
    this.spawnFloatText(CONFIG.WIDTH / 2, 80, "空袭召唤!", CONFIG.COLORS.neonCyan, 18);
  }

  enterMechForm(durationSec, equipDmgMul, autoLock) {
    // 机甲形态：变身视觉 + EquipSystem 已通过 setGlobalMul 处理倍率/锁敌
    const p = this.player; if (!p) return;
    const ms = (durationSec || 12) * 1000;
    p.mechUntil = Date.now() + ms;
    this.shake(CONFIG.SHAKE_MED);
    this._screenFlashEffect();
    this.spawnRing(p.x, p.y, CONFIG.COLORS.neonPink, 90);
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math2.TAU;
      const sp = Math2.rand(2, 6);
      this.spawnParticle(p.x, p.y, {
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        color: Math2.pick([CONFIG.COLORS.neonPink, CONFIG.COLORS.neonPurple, "#FFFFFF"]),
        life: Math2.rand(400, 800), size: Math2.rand(3, 6), shape: "spark", angle: a, glow: 12,
      });
    }
    this.spawnFloatText(p.x, p.y - 50, "机甲形态!", CONFIG.COLORS.neonPink, 20);
  }
}
