/* ============================================================
   Enemy.js - 普通敌机类（增强版：9种敌人 + 高级AI + 精细绘制）
   ============================================================ */
class Enemy {
  constructor() { this.dead = true; }

  reset(type, x, y, opt = {}) {
    const d = ENEMY_DATA[type] || ENEMY_DATA.scout;
    this.type = type;
    this.def = d;
    this.x = x; this.y = y;
    this.startX = x; this.startY = y;
    this.hp = d.hp * (opt.hpMul || 1);
    this.maxHp = this.hp;
    this.vx = 0; this.vy = d.speed;
    this.fireTimer = d.fireRate > 0 ? d.fireRate * 0.6 : 0;
    this.telegraphTimer = 0;    // 狙击预警倒计时
    this.telegraphTarget = null;
    this.stunTimer = 0;         // EMP 眩晕倒计时
    this.fireTimerOffset = 0;   // EMP 导致的射击偏移
    this.hitFlash = 0;
    this.t = 0;
    this.fromBoss = !!opt.fromBoss;
    this.id = "e" + (Enemy._idCounter++);
    this.dead = false;
    return this;
  }

  static _idCounter = 1;

  update(dt, game) {
    if (this.dead) return;
    // EMP 眩晕：倒计时期间跳过移动/攻击（只更新视觉计时器）
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      this.hitFlash = Math.max(0, this.hitFlash - dt);
      if (this.telegraphTimer > 0) this.telegraphTimer -= dt;
      return;
    }
    this.t += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.telegraphTimer > 0) this.telegraphTimer -= dt;

    const speedMul = game.player ? (game.player.enemySlow || 1) : 1;
    const sp = this.def.speed * speedMul;

    // 移动模式（新增 hunting / snipe_strafing / aggressive）
    const pl = game.player;
    switch (this.def.movePattern) {
      case "straight":
        this.y += sp;
        break;
      case "slow_descent":
        this.y += sp;
        this.x = this.startX + Math.sin(this.t * 0.002) * 20;
        break;
      case "zigzag":
        this.y += sp;
        this.x = this.startX + Math.sin(this.t * 0.004) * 60;
        break;
      case "hover_top":
        if (this.y < 100) this.y += sp;
        else this.x = this.startX + Math.sin(this.t * 0.0015) * 80;
        break;
      case "hunting": {   // 追踪玩家（无人机）
        this.y += sp * 0.7;
        if (pl && pl.alive) {
          const dx = pl.x - this.x;
          this.x += Math2.clamp(dx * 0.015, -sp * 0.6, sp * 0.6);
        }
        break;
      }
      case "snipe_strafing": { // 狙击：慢速下降+左右横移
        if (this.y < 120) this.y += sp * 0.8;
        else this.x = this.startX + Math.sin(this.t * 0.0012) * (CONFIG.WIDTH / 2 - 40);
        break;
      }
      case "aggressive": { // 精英：追踪+偶尔冲刺
        this.y += sp * 0.9;
        if (pl && pl.alive) {
          const dx = pl.x - this.x;
          this.x += Math2.clamp(dx * 0.02, -sp, sp);
          // 冲刺：周期性加速下降
          if (Math.sin(this.t * 0.002) > 0.9) this.y += sp * 1.2;
        }
        break;
      }
    }

    this.x = Math2.clamp(this.x, 20, CONFIG.WIDTH - 20);

    // 射击（带预警）
    if (this.def.fireRate > 0) {
      this.fireTimer -= dt;
      if (this.fireTimer <= 0 && this.y > 0 && this.y < CONFIG.HEIGHT - 50) {
        // 狙击手：先显示预警线，再开火
        if (this.def.telegraph && pl && pl.alive) {
          if (this.telegraphTimer <= 0) {
            this.telegraphTimer = 800;  // 0.8s 预警
            this.telegraphTarget = { x: pl.x, y: pl.y };
            this.fireTimer = 800;       // 预警后再重置fireTimer
            if (game.audio) game.audio.play("enemyShoot");
          } else {
            // 预警结束，真开火
            this.fireTimer = this.def.fireRate;
            this._fire(game);
            this.telegraphTarget = null;
          }
        } else {
          this.fireTimer = this.def.fireRate;
          this._fire(game);
        }
      }
    }

    if (this.def.movePattern !== "hover_top" && this.y > CONFIG.HEIGHT + 60) {
      this.dead = true;
    }
  }

  _fire(game) {
    const d = this.def;
    const pl = game.player;
    const y = this.y + d.height * 0.4;
    switch (d.bulletType) {
      case "aimed":
        if (pl) {
          const a = Math.atan2(pl.y - this.y, pl.x - this.x);
          game.spawnEnemyBullet(this.x, y, Math.cos(a) * d.bulletSpeed, Math.sin(a) * d.bulletSpeed, CONFIG.COLORS.neonRed, 6, d.bulletDamage);
        }
        break;
      case "spread3":
        for (let i = -1; i <= 1; i++) {
          const a = Math.PI / 2 + i * 0.3;
          game.spawnEnemyBullet(this.x, y, Math.cos(a) * d.bulletSpeed, Math.sin(a) * d.bulletSpeed, CONFIG.COLORS.neonPurple, 6, d.bulletDamage);
        }
        break;
      case "spread5":
        for (let i = -2; i <= 2; i++) {
          const a = Math.PI / 2 + i * 0.22;
          game.spawnEnemyBullet(this.x, y, Math.cos(a) * d.bulletSpeed, Math.sin(a) * d.bulletSpeed, CONFIG.COLORS.neonPink, 7, d.bulletDamage);
        }
        break;
      case "fast_single":
        game.spawnEnemyBullet(this.x, y, 0, d.bulletSpeed, CONFIG.COLORS.neonCyan, 5, d.bulletDamage);
        break;
      case "homing_mini":
        if (pl) {
          const a = Math.atan2(pl.y - this.y, pl.x - this.x);
          game.spawnEnemyBullet(this.x, y, Math.cos(a) * d.bulletSpeed, Math.sin(a) * d.bulletSpeed, CONFIG.COLORS.neonGreen, 5, d.bulletDamage, { homing: true, homingTime: 1500 });
        }
        break;
      case "sniper_beam": {
        // 狙击：向预警点方向发射高速细弹
        let a = Math.PI / 2;
        if (this.telegraphTarget && pl) {
          a = Math.atan2(pl.y - this.y, pl.x - this.x);
        } else if (pl) {
          a = Math.atan2(pl.y - this.y, pl.x - this.x);
        }
        game.spawnEnemyBullet(this.x, y, Math.cos(a) * d.bulletSpeed, Math.sin(a) * d.bulletSpeed, CONFIG.COLORS.neonPurple, 4, d.bulletDamage, { shape: "bolt", glow: 14 });
        break;
      }
      case "heal_pulse": {
        // 支援舰：治疗附近队友（无子弹，但有治疗脉冲视觉）
        game.spawnRing(this.x, this.y, d.accent, d.healRadius || 100);
        // 对范围内敌机进行治疗（索引循环防修改异常）
        const allEnemies = game.enemies;
        for (let ei = 0, el = allEnemies.length; ei < el; ei++) {
          const e = allEnemies[ei];
          if (e !== this && !e.dead && Math.hypot(e.x - this.x, e.y - this.y) < (d.healRadius || 100)) {
            const heal = d.healAmount || 20;
            e.hp = Math.min(e.maxHp, e.hp + heal);
            game.spawnFloatText(e.x, e.y - d.height / 2, "+" + heal, CONFIG.COLORS.neonGreen, 12);
          }
        }
        break;
      }
      case "summon":
        for (let i = 0; i < d.summonCount; i++) {
          game.spawnEnemy(d.summonType, this.x + (i - (d.summonCount - 1) / 2) * 30, this.y + 20, { fromBoss: true });
        }
        break;
    }
    if (game.audio && d.bulletType !== "heal_pulse") game.audio.play("enemyShoot");
  }

  takeDamage(dmg, game) {
    this.hp -= dmg;
    this.hitFlash = 120;
    if (this.hp <= 0) {
      this.dead = true;
      this._onDeath(game);
      return true;
    }
    return false;
  }

  _onDeath(game) {
    const d = this.def;
    const size = this.type === "bomber" || this.type === "carrier" || this.type === "support" ? "big" : "normal";
    game.spawnExplosion(this.x, this.y, d.color, size);
    game.addScore(d.score);
    game.addExp(d.exp);
    const coinGain = Math.round(d.coin * (game.player ? game.player.coinMul : 1));
    game.state.coins += coinGain;
    // 掉落加成
    let drop = rollItemDrop();
    if (!drop && d.dropBonus && Math.random() < d.dropBonus) drop = rollItemDrop(true);
    if (drop) game.spawnItem(this.x, this.y, drop);
    if (game.audio) game.audio.play(size === "big" ? "bigExplode" : "explode");
  }

  draw(ctx) {
    if (this.dead) return;
    const d = this.def;
    const w = d.width, h = d.height;

    // ============ 精英光环 ============
    if (d.elite) {
      ctx.save();
      ctx.translate(this.x, this.y);
      const pulse = 0.5 + Math.sin(this.t * 0.008) * 0.2;
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = CONFIG.COLORS.neonYellow;
      ctx.shadowColor = CONFIG.COLORS.neonYellow;
      ctx.shadowBlur = 20;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(w, h) * 0.7, 0, Math2.TAU);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    const flash = this.hitFlash > 0;
    const main = flash ? "#ffffff" : d.color;
    ctx.shadowColor = d.color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = main;
    ctx.strokeStyle = d.accent;
    ctx.lineWidth = 1.5;

    // ============ 按外形绘制 ============
    switch (d.shape) {
      case "arrow":       this._drawArrow(ctx, w, h, d, main); break;
      case "tri_wing":    this._drawTriWing(ctx, w, h, d, main); break;
      case "heavy":       this._drawHeavy(ctx, w, h, d, main); break;
      case "dart":        this._drawDart(ctx, w, h, d, main); break;
      case "platform":    this._drawPlatform(ctx, w, h, d, main); break;
      case "hex_drone":   this._drawHexDrone(ctx, w, h, d, main); break;
      case "long_range":  this._drawLongRange(ctx, w, h, d, main); break;
      case "healer_ship": this._drawHealer(ctx, w, h, d, main); break;
      case "elite_wing":  this._drawEliteWing(ctx, w, h, d, main); break;
      default:            this._drawArrow(ctx, w, h, d, main); break;
    }
    ctx.restore();

    // ============ 狙击预警线 ============
    if (this.telegraphTimer > 0 && this.telegraphTarget) {
      ctx.save();
      const blink = Math.floor(this.telegraphTimer / 80) % 2 === 0;
      ctx.globalAlpha = blink ? 0.7 : 0.3;
      ctx.strokeStyle = CONFIG.COLORS.neonPurple;
      ctx.shadowColor = CONFIG.COLORS.neonPurple;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.telegraphTarget.x, this.telegraphTarget.y + 50);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // ============ 血条 ============
    if (this.hp < this.maxHp) {
      const bw = Math.max(w, 26);
      const ratio = Math.max(0, this.hp / this.maxHp);
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(this.x - bw / 2, this.y - h / 2 - 8, bw, 3);
      ctx.fillStyle = ratio > 0.5 ? CONFIG.COLORS.neonGreen : (ratio > 0.25 ? CONFIG.COLORS.neonYellow : CONFIG.COLORS.neonRed);
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 4;
      ctx.fillRect(this.x - bw / 2, this.y - h / 2 - 8, bw * ratio, 3);
      ctx.restore();
    }

    // ============ 支援舰治疗范围（淡显示） ============
    if (d.bulletType === "heal_pulse") {
      ctx.save();
      ctx.globalAlpha = 0.08 + Math.sin(this.t * 0.005) * 0.03;
      ctx.fillStyle = d.accent;
      ctx.beginPath();
      ctx.arc(this.x, this.y, d.healRadius || 100, 0, Math2.TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  // ---- 侦察机：箭头 ----
  _drawArrow(ctx, w, h, d, main) {
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(-w / 2, -h / 2);
    ctx.lineTo(0, -h / 4);
    ctx.lineTo(w / 2, -h / 2);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // 核心
    ctx.fillStyle = d.accent;
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math2.TAU);
    ctx.fill();
  }

  // ---- 战斗机：三角翼 ----
  _drawTriWing(ctx, w, h, d, main) {
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(-w / 2, -h / 3);
    ctx.lineTo(-w / 5, -h / 5);
    ctx.lineTo(0, -h / 2);
    ctx.lineTo(w / 5, -h / 5);
    ctx.lineTo(w / 2, -h / 3);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // 机舱
    ctx.fillStyle = d.accent;
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.1, h * 0.2, 0, 0, Math2.TAU);
    ctx.fill();
    // 翼尖装饰
    ctx.strokeStyle = d.accent;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h / 3); ctx.lineTo(-w / 2.2, -h / 6);
    ctx.moveTo(w / 2, -h / 3); ctx.lineTo(w / 2.2, -h / 6);
    ctx.stroke();
  }

  // ---- 轰炸机：重装 + 双炮管 ----
  _drawHeavy(ctx, w, h, d, main) {
    // 机身
    ctx.fillRect(-w / 2, -h / 2, w, h * 0.8);
    ctx.strokeRect(-w / 2, -h / 2, w, h * 0.8);
    // 尾舱
    ctx.fillRect(-w / 3, h * 0.3, w / 1.5, h * 0.22);
    ctx.strokeRect(-w / 3, h * 0.3, w / 1.5, h * 0.22);
    // 装甲细节
    ctx.fillStyle = d.accent;
    ctx.fillRect(-w / 2, -h / 6, w, h / 8);
    ctx.fillStyle = main;
    // 两侧引擎
    ctx.fillRect(-w / 2 - 4, -h / 6, 6, h / 3);
    ctx.fillRect(w / 2 - 2, -h / 6, 6, h / 3);
    ctx.strokeRect(-w / 2 - 4, -h / 6, 6, h / 3);
    ctx.strokeRect(w / 2 - 2, -h / 6, 6, h / 3);
  }

  // ---- 截击机：锐利飞镖 ----
  _drawDart(ctx, w, h, d, main) {
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(-w / 2, -h / 6);
    ctx.lineTo(0, -h / 2);
    ctx.lineTo(w / 2, -h / 6);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // 中央条纹
    ctx.fillStyle = d.accent;
    ctx.fillRect(-w * 0.08, -h * 0.4, w * 0.16, h * 0.7);
    // 尾部三角
    ctx.fillStyle = d.accent;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.45); ctx.lineTo(-w * 0.2, h * 0.15); ctx.lineTo(w * 0.2, h * 0.15);
    ctx.closePath();
    ctx.fill();
  }

  // ---- 母舰：圆形平台 + 炮台 ----
  _drawPlatform(ctx, w, h, d, main) {
    // 外环
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2, h / 2.2, 0, 0, Math2.TAU);
    ctx.fill(); ctx.stroke();
    // 内圈
    ctx.fillStyle = d.accent;
    ctx.beginPath();
    ctx.arc(0, -h * 0.05, w / 4, 0, Math2.TAU);
    ctx.fill();
    // 发光核心
    ctx.fillStyle = "#ffffff";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(0, -h * 0.05, w / 10, 0, Math2.TAU);
    ctx.fill();
    ctx.shadowBlur = 12;
    ctx.fillStyle = main;
    // 6 门环形炮台
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + this.t * 0.0005;
      const bx = Math.cos(a) * w / 2.3;
      const by = Math.sin(a) * h / 2.8;
      ctx.beginPath();
      ctx.arc(bx, by, 4, 0, Math2.TAU);
      ctx.fill();
      // 炮管
      ctx.strokeStyle = d.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a) * 5, by + Math.sin(a) * 5);
      ctx.stroke();
    }
  }

  // ---- 无人机：六角形 ----
  _drawHexDrone(ctx, w, h, d, main) {
    // 旋转感
    const rot = this.t * 0.003;
    ctx.save();
    ctx.rotate(rot);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      const x = Math.cos(a) * w / 2;
      const y = Math.sin(a) * h / 2;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
    // 中心眼
    ctx.fillStyle = d.accent;
    ctx.beginPath();
    ctx.arc(0, 0, w * 0.22, 0, Math2.TAU);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, 0, w * 0.1, 0, Math2.TAU);
    ctx.fill();
  }

  // ---- 狙击手：长管狙击舰 ----
  _drawLongRange(ctx, w, h, d, main) {
    // 主体（倒水滴）
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(-w * 0.35, h * 0.1);
    ctx.lineTo(-w * 0.3, -h * 0.35);
    ctx.lineTo(0, -h / 2);
    ctx.lineTo(w * 0.3, -h * 0.35);
    ctx.lineTo(w * 0.35, h * 0.1);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // 超长长炮管（特征！）
    ctx.fillStyle = d.accent;
    ctx.fillRect(-1.5, -h / 2 - h * 0.5, 3, h * 0.55);
    ctx.strokeStyle = d.accent;
    ctx.strokeRect(-1.5, -h / 2 - h * 0.5, 3, h * 0.55);
    // 瞄准镜
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = d.accent;
    ctx.beginPath();
    ctx.arc(0, 0, w * 0.1, 0, Math2.TAU);
    ctx.fill();
  }

  // ---- 支援舰：治疗舰（带十字+环） ----
  _drawHealer(ctx, w, h, d, main) {
    // 椭圆主体
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math2.TAU);
    ctx.fill(); ctx.stroke();
    // 十字标志
    ctx.fillStyle = d.accent;
    ctx.shadowColor = d.accent;
    ctx.shadowBlur = 10;
    const cs = Math.min(w, h) * 0.3;
    ctx.fillRect(-cs / 5, -cs / 2, cs / 2.5, cs);
    ctx.fillRect(-cs / 2, -cs / 5, cs, cs / 2.5);
    ctx.shadowBlur = 12;
    // 四角突出
    ctx.fillStyle = main;
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      const bx = Math.cos(a) * w / 2.2;
      const by = Math.sin(a) * h / 2.2;
      ctx.beginPath();
      ctx.arc(bx, by, 3.5, 0, Math2.TAU);
      ctx.fill();
    }
  }

  // ---- 精英战机：变后掠翼 + 双尾 ----
  _drawEliteWing(ctx, w, h, d, main) {
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(-w / 2, 0);
    ctx.lineTo(-w * 0.25, -h * 0.25);
    ctx.lineTo(0, -h / 2);
    ctx.lineTo(w * 0.25, -h * 0.25);
    ctx.lineTo(w / 2, 0);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // 内部分色（精英标识）
    ctx.fillStyle = d.accent;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.4);
    ctx.lineTo(-w * 0.18, -h * 0.1);
    ctx.lineTo(0, -h * 0.4);
    ctx.lineTo(w * 0.18, -h * 0.1);
    ctx.closePath();
    ctx.fill();
    // 双尾鳍
    ctx.fillStyle = main;
    ctx.strokeStyle = d.accent;
    ctx.fillRect(-w * 0.38, h * 0.1, 4, h * 0.35);
    ctx.strokeRect(-w * 0.38, h * 0.1, 4, h * 0.35);
    ctx.fillRect(w * 0.34, h * 0.1, 4, h * 0.35);
    ctx.strokeRect(w * 0.34, h * 0.1, 4, h * 0.35);
    // 驾驶舱
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = d.accent;
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.12, w * 0.08, h * 0.15, 0, 0, Math2.TAU);
    ctx.fill();
  }
}
