/* ============================================================
   Renderer.js - 渲染器
   背景（3层视差星空+流星+扫描线网格）、所有实体绘制、屏幕震动、白闪
   优化：静态背景（网格 + 静态星点）预渲染到 OffscreenCanvas，每帧只 drawImage 一次
   ============================================================ */
class Renderer {
  constructor(game) {
    this.game = game;
    // 星空：3层不同速度（动态层，需要每帧移动）
    this.stars = [];
    for (let i = 0; i < 60; i++) this.stars.push(this._mkStar(0));
    for (let i = 0; i < 40; i++) this.stars.push(this._mkStar(1));
    for (let i = 0; i < 25; i++) this.stars.push(this._mkStar(2));
    this.meteors = [];
    this.meteorTimer = 0;
    this.shakeX = 0; this.shakeY = 0;
    this.shakeAmount = 0;
    this.whiteFlash = 0;       // 白闪剩余 ms

    // 静态背景缓存：网格 + 渐变（绘制一次复用）
    this._bgCanvas = null;
    this._buildStaticBg();
  }

  // 预渲染静态背景（渐变 + 扫描线网格）到离屏 Canvas
  _buildStaticBg() {
    try {
      this._bgCanvas = document.createElement("canvas");
      this._bgCanvas.width = CONFIG.WIDTH;
      this._bgCanvas.height = CONFIG.HEIGHT;
      const c = this._bgCanvas.getContext("2d");

      // 深空渐变
      const grad = c.createLinearGradient(0, 0, 0, CONFIG.HEIGHT);
      grad.addColorStop(0, "#0d1b3e");
      grad.addColorStop(0.5, "#0a0e27");
      grad.addColorStop(1, "#06081a");
      c.fillStyle = grad;
      c.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

      // 扫描线网格（静态）
      c.globalAlpha = 0.06;
      c.strokeStyle = CONFIG.COLORS.neonCyan;
      c.lineWidth = 1;
      c.beginPath();
      for (let y = 0; y < CONFIG.HEIGHT; y += 32) {
        c.moveTo(0, y); c.lineTo(CONFIG.WIDTH, y);
      }
      for (let x = 0; x < CONFIG.WIDTH; x += 32) {
        c.moveTo(x, 0); c.lineTo(x, CONFIG.HEIGHT);
      }
      c.stroke();
    } catch (e) {
      // 极端环境降级
      this._bgCanvas = null;
    }
  }

  _mkStar(layer) {
    return {
      x: Math.random() * CONFIG.WIDTH,
      y: Math.random() * CONFIG.HEIGHT,
      layer,
      size: layer === 2 ? Math2.rand(1.5, 2.5) : (layer === 1 ? Math2.rand(1, 1.8) : Math2.rand(0.5, 1)),
      speed: layer === 2 ? 1.8 : (layer === 1 ? 1.0 : 0.4),
      twinkle: Math.random() * Math2.TAU,
    };
  }

  shake(amount) {
    if (!this.game.settings.shake) return;
    this.shakeAmount = Math.max(this.shakeAmount, amount);
  }

  flashWhite(ms) { this.whiteFlash = ms; }

  update(dt) {
    // 星星滚动
    for (const s of this.stars) {
      s.y += s.speed;
      s.twinkle += dt * 0.003;
      if (s.y > CONFIG.HEIGHT) { s.y = -2; s.x = Math.random() * CONFIG.WIDTH; }
    }
    // 流星
    this.meteorTimer -= dt;
    if (this.meteorTimer <= 0) {
      this.meteorTimer = Math2.rand(2000, 5000);
      this.meteors.push({
        x: Math.random() * CONFIG.WIDTH,
        y: -20,
        vx: Math2.rand(-2, 2),
        vy: Math2.rand(6, 10),
        life: 1500, maxLife: 1500,
      });
    }
    for (const m of this.meteors) {
      m.x += m.vx; m.y += m.vy; m.life -= dt;
    }
    this.meteors = this.meteors.filter(m => m.life > 0 && m.y < CONFIG.HEIGHT + 50);

    // 震动衰减
    if (this.shakeAmount > 0.1) {
      this.shakeX = (Math.random() - 0.5) * this.shakeAmount;
      this.shakeY = (Math.random() - 0.5) * this.shakeAmount;
      this.shakeAmount *= CONFIG.SHAKE_DECAY;
    } else {
      this.shakeX = this.shakeY = this.shakeAmount = 0;
    }
    if (this.whiteFlash > 0) this.whiteFlash -= dt;
  }

  drawBackground(ctx) {
    // 静态背景：drawImage 一次（替代每帧重画渐变+网格 60+ 次 stroke）
    if (this._bgCanvas) {
      ctx.drawImage(this._bgCanvas, 0, 0);
    } else {
      // 降级路径
      const grad = ctx.createLinearGradient(0, 0, 0, CONFIG.HEIGHT);
      grad.addColorStop(0, "#0d1b3e");
      grad.addColorStop(0.5, "#0a0e27");
      grad.addColorStop(1, "#06081a");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    }

    // 星星（动态层，每帧移动，但用 fillRect 简化绘制）
    for (const s of this.stars) {
      const a = 0.4 + Math.sin(s.twinkle) * 0.3 + (s.layer * 0.15);
      ctx.globalAlpha = Math2.clamp(a, 0.1, 1);
      ctx.fillStyle = s.layer === 2 ? CONFIG.COLORS.neonCyan : (s.layer === 1 ? "#aaccff" : "#ffffff");
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;

    // 流星
    for (const m of this.meteors) {
      const t = m.life / m.maxLife;
      ctx.save();
      ctx.globalAlpha = t;
      ctx.strokeStyle = CONFIG.COLORS.neonCyan;
      ctx.shadowColor = CONFIG.COLORS.neonCyan;
      ctx.shadowBlur = 8;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x - m.vx * 4, m.y - m.vy * 4);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawBossLaser(ctx, lz) {
    if (lz.dead) return;
    ctx.save();
    if (lz.phase === "warn") {
      // 预警：闪烁的细线
      const blink = Math.floor(lz.t / 100) % 2 === 0;
      ctx.globalAlpha = blink ? 0.7 : 0.3;
      ctx.strokeStyle = CONFIG.COLORS.neonRed;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(lz.x, 0);
      ctx.lineTo(lz.x, CONFIG.HEIGHT);
      ctx.stroke();
    } else {
      // 发射：粗激光
      const pulse = 1 + Math.sin(lz.t * 0.02) * 0.15;
      const w = lz.width * pulse;
      ctx.shadowColor = CONFIG.COLORS.neonRed;
      ctx.shadowBlur = 30;
      const g = ctx.createLinearGradient(lz.x - w / 2, 0, lz.x + w / 2, 0);
      g.addColorStop(0, "rgba(255,0,60,0)");
      g.addColorStop(0.5, "#ff003c");
      g.addColorStop(1, "rgba(255,0,60,0)");
      ctx.fillStyle = g;
      ctx.fillRect(lz.x - w / 2, 0, w, CONFIG.HEIGHT);
      // 核心
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(lz.x - 3, 0, 6, CONFIG.HEIGHT);
    }
    ctx.restore();
  }

  drawWhiteFlash(ctx) {
    if (this.whiteFlash <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math2.clamp(this.whiteFlash / 1000, 0, 1) * 0.9;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
    ctx.restore();
  }
}
