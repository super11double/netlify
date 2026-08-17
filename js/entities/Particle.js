/* ============================================================
   Particle.js - 粒子类（爆炸/拖尾/火花）
   使用对象池复用，reset 时重置状态
   ============================================================ */
class Particle {
  constructor() { this.dead = true; }

  reset(x, y, opt = {}) {
    this.x = x; this.y = y;
    this.vx = opt.vx ?? (Math.random() - 0.5) * 4;
    this.vy = opt.vy ?? (Math.random() - 0.5) * 4;
    this.size = opt.size ?? Math2.rand(2, 5);
    this.color = opt.color ?? CONFIG.COLORS.neonOrange;
    this.life = opt.life ?? Math2.rand(300, 600);
    this.maxLife = this.life;
    this.gravity = opt.gravity ?? 0;
    this.friction = opt.friction ?? 0.96;
    this.glow = opt.glow ?? 8;
    this.shape = opt.shape ?? "circle"; // circle | line | ring | spark
    this.angle = opt.angle ?? 0;
    this.spin = opt.spin ?? 0;
    this.dead = false;
    return this;
  }

  update(dt) {
    if (this.dead) return;
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= this.friction;
    this.vy *= this.friction;
    this.vy += this.gravity;
    this.angle += this.spin;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx) {
    if (this.dead) return;
    const t = Math.max(0, this.life / this.maxLife);
    ctx.save();
    ctx.globalAlpha = t;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = this.glow;
    ctx.fillStyle = this.color;
    ctx.strokeStyle = this.color;
    if (this.shape === "circle") {
      ctx.beginPath();
      ctx.arc(this.x, this.y, Math.max(0.5, this.size * t), 0, Math2.TAU);
      ctx.fill();
    } else if (this.shape === "spark") {
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.fillRect(-this.size, -1, this.size * 2, 2);
    } else if (this.shape === "ring") {
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * (1.5 - t), 0, Math2.TAU);
      ctx.stroke();
    } else {
      ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
    }
    ctx.restore();
  }
}
