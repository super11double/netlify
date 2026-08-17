/* ============================================================
   Wingman.js - 僚机类（跟随玩家，自动射击）
   火力 Lv6 召唤 1 架，Lv7 召唤 2 架，技能芯片可额外增加
   ============================================================ */
class Wingman {
  constructor() {}

  init(side, game) {
    this.side = side;          // -1 左 / +1 右
    this.x = game.player.x + side * 40;
    this.y = game.player.y + 10;
    this.fireTimer = 0;
    this.t = 0;
    this.dead = false;
    this.color = CONFIG.COLORS.neonCyan;
    this.accent = CONFIG.COLORS.neonPurple;
    return this;
  }

  update(dt, game) {
    if (this.dead || !game.player || !game.player.alive) return;
    this.t += dt;
    // 跟随玩家，带相位偏移
    const tx = game.player.x + this.side * 38;
    const ty = game.player.y + 14 + Math.sin(this.t * 0.004 + this.side) * 6;
    this.x = Math2.lerp(this.x, tx, 0.15);
    this.y = Math2.lerp(this.y, ty, 0.15);

    // 自动射击
    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.fireTimer = 280;
      const dmg = game.player.bulletDamage * game.player.bulletDamageMul * 0.5;
      game.spawnPlayerBullet(this.x, this.y - 10, 0, -game.player.bulletSpeed, {
        side: "player", damage: dmg, color: this.color, radius: 3, glow: 8,
      });
    }
  }

  draw(ctx) {
    if (this.dead) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = this.color;
    ctx.strokeStyle = this.accent;
    ctx.lineWidth = 1;
    const w = 16, h = 18;
    ctx.beginPath();
    ctx.moveTo(0, -h / 2);
    ctx.lineTo(w / 2, h / 3);
    ctx.lineTo(0, h / 2);
    ctx.lineTo(-w / 2, h / 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
