/* ============================================================
   Item.js - 道具类（8 种掉落）
   带磁吸效果，玩家靠近自动吸附
   ============================================================ */
class Item {
  constructor() { this.dead = true; }

  reset(x, y, type) {
    this.x = x; this.y = y;
    this.type = type;
    this.def = ITEM_DATA[type];
    this.vy = CONFIG.ITEM_FALL_SPEED;
    this.vx = (Math.random() - 0.5) * 1.2;
    this.radius = 12;
    this.pulse = 0;
    this.magnetized = false;
    this.life = 12000;
    this.dead = false;
    return this;
  }

  update(dt, game) {
    if (this.dead) return;
    this.pulse += dt * 0.006;
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }

    const player = game.player;
    if (player && player.alive) {
      const range = CONFIG.ITEM_MAGNET_BASE * player.magnetMul;
      const d2 = Math2.dist2(this.x, this.y, player.x, player.y);
      if (d2 < range * range || this.magnetized) {
        this.magnetized = true;
        const a = Math.atan2(player.y - this.y, player.x - this.x);
        const sp = CONFIG.ITEM_MAGNET_SPEED;
        this.vx = Math.cos(a) * sp;
        this.vy = Math.sin(a) * sp;
      } else {
        this.vy += 0; // 自然下落
        this.vx *= 0.98;
      }
    }
    this.x += this.vx;
    this.y += this.vy;

    if (this.y > CONFIG.HEIGHT + 30 || this.x < -30 || this.x > CONFIG.WIDTH + 30) {
      this.dead = true;
    }
  }

  draw(ctx) {
    if (this.dead) return;
    const p = Math.sin(this.pulse) * 0.5 + 0.5;
    ctx.save();
    ctx.shadowColor = this.def.color;
    ctx.shadowBlur = 14 + p * 8;
    // 外环
    ctx.strokeStyle = this.def.color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6 + p * 0.4;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius + 3, 0, Math2.TAU);
    ctx.stroke();
    // 内填充
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = this.def.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius - 2, 0, Math2.TAU);
    ctx.fill();
    // 字符
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#0a0e27";
    ctx.font = "bold 13px Consolas, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.def.glyph, this.x, this.y + 1);
    ctx.restore();
  }
}
