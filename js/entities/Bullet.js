/* ============================================================
   Bullet.js - 子弹类（玩家弹 + 敌机弹，统一结构）
   side: "player" | "enemy"
   ============================================================ */
class Bullet {
  constructor() { this.dead = true; }

  reset(x, y, vx, vy, opt = {}) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.side = opt.side ?? "player";
    this.damage = opt.damage ?? 10;
    this.radius = opt.radius ?? 4;
    this.color = opt.color ?? (this.side === "player" ? CONFIG.COLORS.neonCyan : CONFIG.COLORS.neonOrange);
    this.glow = opt.glow ?? 10;
    this.pierce = opt.pierce ?? 0;        // 穿透次数
    this.explosive = opt.explosive ?? false;
    this.homing = opt.homing ?? false;    // 追踪
    this.homingTime = opt.homingTime ?? 0;
    this.big = opt.big ?? false;          // 大体积弹（气泡）
    this.shape = opt.shape ?? "bolt";     // bolt | missile | orb | laser | big
    // trail 改为固定长度数组（环形缓冲），避免每帧 push/shift 创建对象
    if (!this._trailBuf) {
      this._trailBuf = new Array(6);
      this._trailX = new Float32Array(6);
      this._trailY = new Float32Array(6);
    }
    this._trailHead = 0;
    this._trailCount = 0;
    // hitTargets：复用 Set，避免每帧 new Set() 产生 GC
    if (this.hitTargets) this.hitTargets.clear();
    else this.hitTargets = new Set();
    this.life = opt.life ?? 6000;
    this.dead = false;
    return this;
  }

  update(dt, game) {
    if (this.dead) return;
    // 追踪逻辑
    if (this.homing && this.homingTime > 0 && game.player && this.side === "enemy") {
      this.homingTime -= dt;
      const tx = game.player.x, ty = game.player.y;
      const ang = Math.atan2(ty - this.y, tx - this.x);
      const cur = Math.atan2(this.vy, this.vx);
      const newAng = Math2.turnToward(cur, ang, 0.06);
      const sp = Math.hypot(this.vx, this.vy);
      this.vx = Math.cos(newAng) * sp;
      this.vy = Math.sin(newAng) * sp;
    }
    // 拖尾：环形缓冲写入（无对象创建）
    this._trailX[this._trailHead] = this.x;
    this._trailY[this._trailHead] = this.y;
    this._trailHead = (this._trailHead + 1) % 6;
    if (this._trailCount < 6) this._trailCount++;

    this.x += this.vx;
    this.y += this.vy;
    this.life -= dt;
    // 越界 / 寿命到
    if (this.life <= 0) this.dead = true;
    const m = 30;
    if (this.x < -m || this.x > CONFIG.WIDTH + m || this.y < -m || this.y > CONFIG.HEIGHT + m) {
      this.dead = true;
    }
  }

  draw(ctx) {
    if (this.dead) return;
    ctx.save();
    // 性能优化：玩家弹 shadowBlur 仅在 glow 较大时启用，且降到 12
    // 大量子弹（普通弹 glow=10）改为不开 shadow，靠亮色+核心白条模拟发光
    const useShadow = this.glow >= 14;
    if (useShadow) {
      ctx.shadowColor = this.color;
      ctx.shadowBlur = Math.min(this.glow, 12);
    } else {
      ctx.shadowBlur = 0;
    }

    // 拖尾：从环形缓冲读取，从最旧到最新
    if (this._trailCount > 1) {
      ctx.strokeStyle = this.color;
      ctx.lineWidth = Math.max(1, this.radius * 0.8);
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      const start = (this._trailHead - this._trailCount + 6) % 6;
      ctx.moveTo(this._trailX[start], this._trailY[start]);
      for (let i = 1; i < this._trailCount; i++) {
        const idx = (start + i) % 6;
        ctx.lineTo(this._trailX[idx], this._trailY[idx]);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = this.color;

    const r = this.radius;
    if (this.shape === "orb" || this.shape === "big") {
      ctx.beginPath();
      ctx.arc(this.x, this.y, r, 0, Math2.TAU);
      ctx.fill();
      if (this.shape === "big") {
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(this.x, this.y, r * 1.4, 0, Math2.TAU);
        ctx.fill();
      }
    } else if (this.shape === "missile") {
      const ang = Math.atan2(this.vy, this.vx);
      ctx.translate(this.x, this.y);
      ctx.rotate(ang);
      ctx.fillRect(-r * 2, -r * 0.6, r * 4, r * 1.2);
      // 尾焰
      ctx.fillStyle = "#fff200";
      ctx.globalAlpha = 0.8;
      ctx.fillRect(-r * 2.6, -r * 0.3, r * 0.8, r * 0.6);
    } else {
      // bolt：胶囊形（朝速度方向拉长）
      const ang = Math.atan2(this.vy, this.vx);
      ctx.translate(this.x, this.y);
      ctx.rotate(ang);
      ctx.fillRect(-r * 2.2, -r * 0.7, r * 4.4, r * 1.4);
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 0.85;
      ctx.fillRect(-r * 1.5, -r * 0.35, r * 3, r * 0.7);
    }
    ctx.restore();
  }
}
