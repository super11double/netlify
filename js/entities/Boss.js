/* ============================================================
   Boss.js - Boss 类（多阶段AI、弹幕模式组合、阶段切换特效）
   ============================================================ */
class Boss {
  constructor() { this.dead = true; }

  reset(bossId, game, opts = {}) {
    const d = BOSS_DATA[bossId] || BOSS_DATA.BOSS_CH1;
    this.def = d;
    this.id = d.id;
    this.name = opts.nameOverride || d.name;
    this.x = CONFIG.WIDTH / 2;
    this.y = -d.height;        // 从屏幕外入场
    this.targetY = 110;
    this.entering = true;
    const hpMul = Math.max(1, opts.hpMul || 1);
    const baseHp = Math.round(d.maxHp * hpMul);
    this.maxHp = baseHp;
    this.hp = baseHp;
    this._hpMul = hpMul;
    this.width = d.width;
    this.height = d.height;
    this.hitRadius = d.hitRadius;
    this.color = d.color;
    this.accent = d.accent;
    this.shape = d.shape;
    this.phaseIndex = 0;
    this.phase = d.phases[0];
    this.attackTimer = 1500;   // 首次攻击延迟
    this.moveTimer = 0;
    this.moveAngle = 0;
    this.t = 0;
    this.hitFlash = 0;
    this.berserk = false;
    this.finalForm = false;
    this.warningShown = false;
    this.spiralAngle = 0;
    this.windmillAngle = 0;
    this.dead = false;
    this.dying = false;        // 死亡演出
    this.deathTimer = 0;
    this.id = "b" + (Boss._idCounter++);
    return this;
  }

  static _idCounter = 1;

  update(dt, game) {
    if (this.dead) return;
    this.t += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);

    // 死亡演出
    if (this.dying) {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) {
        this.dead = true;
        this._onDeathFinal(game);
      } else {
        // 持续爆炸
        if (Math2.chance(0.3)) {
          game.spawnExplosion(
            this.x + Math2.rand(-this.width / 2, this.width / 2),
            this.y + Math2.rand(-this.height / 2, this.height / 2),
            Math2.pick([CONFIG.COLORS.neonOrange, CONFIG.COLORS.neonYellow, CONFIG.COLORS.neonPink]),
            "normal"
          );
        }
      }
      return;
    }

    // 入场动画
    if (this.entering) {
      this.y += (this.targetY - this.y) * 0.04;
      if (Math.abs(this.y - this.targetY) < 1) {
        this.y = this.targetY;
        this.entering = false;
      }
      return;
    }

    // 阶段切换检测
    const hpRatio = this.hp / this.maxHp;
    while (this.phaseIndex < this.def.phases.length - 1 && hpRatio <= this.phase.hpThreshold) {
      this.phaseIndex++;
      this.phase = this.def.phases[this.phaseIndex];
      this._onPhaseEnter(game);
    }

    // 冲撞（优先，覆盖正常移动）
    if (this._ramState && this._ramState.active) {
      this._updateRam(dt, game);
    } else {
      // 移动
      this._updateMove(dt, game);
    }

    // 攻击
    this.attackTimer -= dt;
    if (this.attackTimer <= 0) {
      this.attackTimer = this.phase.attackInterval;
      this._attack(game);
    }
  }

  _onPhaseEnter(game) {
    if (this.phase.berserk) {
      this.berserk = true;
      this.color = this.def.berserkColor;
    }
    if (this.phase.finalForm) this.finalForm = true;
    // 屏幕震动 + 警告音 + 环形粒子
    game.shake(CONFIG.SHAKE_BIG);
    if (game.audio) game.audio.play("bossBerserk");
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math2.TAU;
      const sp = Math2.rand(2, 6);
      game.spawnParticle(this.x, this.y, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, color: this.color, life: 600, size: Math2.rand(3, 6), shape: "spark", angle: a });
    }
  }

  _updateMove(dt, game) {
    const sp = 2.2;
    switch (this.phase.movePattern) {
      case "horizontal_pan":
        this.x = CONFIG.WIDTH / 2 + Math.sin(this.t * 0.0008) * (CONFIG.WIDTH / 2 - this.width / 2);
        break;
      case "figure_8":
        this.x = CONFIG.WIDTH / 2 + Math.sin(this.t * 0.0012) * (CONFIG.WIDTH / 2 - this.width / 2);
        this.y = this.targetY + Math.sin(this.t * 0.0024) * 30;
        break;
      case "chase_player":
        if (game.player) {
          const target = Math2.clamp(game.player.x, this.width / 2, CONFIG.WIDTH - this.width / 2);
          this.x += (target - this.x) * 0.02;
        }
        this.y = this.targetY + Math.sin(this.t * 0.003) * 20;
        break;
    }
    this.x = Math2.clamp(this.x, this.width / 2, CONFIG.WIDTH - this.width / 2);
  }

  // Boss 冲撞：warn 2s → charging 向锁定点冲刺 → 回到 targetY
  _updateRam(dt, game) {
    const rs = this._ramState;
    rs.phaseTimer += dt;
    const warnMs = rs.warnSec * 1000;
    if (rs.phase === "warn") {
      // 预警阶段：轻微抖动
      this.x += (Math.random() - 0.5) * 2;
      if (rs.phaseTimer >= warnMs) {
        rs.phase = "charging";
        rs.phaseTimer = 0;
        const dx = rs.lockX - this.x;
        const dy = rs.lockY - this.y;
        const dist = Math.hypot(dx, dy) || 1;
        rs.ramDirX = dx / dist;
        rs.ramDirY = dy / dist;
        if (game.audio) game.audio.play("bossShoot");
      }
    } else if (rs.phase === "charging") {
      this.x += rs.ramDirX * rs.speed * (dt / 16.66);
      this.y += rs.ramDirY * rs.speed * (dt / 16.66);
      // 玩家碰撞伤害
      if (game.player && game.player.alive && game.player.invincibleTimer <= 0) {
        if (Math2.circleHit(this.x, this.y, this.hitRadius, game.player.x, game.player.y, game.player.hitbox)) {
          game.player.takeDamage(rs.damage, game);
          // 撞击后直接进入返回阶段
          rs.phase = "returning";
          rs.phaseTimer = 0;
        }
      }
      // 冲撞出屏幕或超过 1.5s 就返回
      if (rs.phaseTimer >= 1500 ||
          this.y > CONFIG.HEIGHT + 40 || this.y < -60 ||
          this.x < -60 || this.x > CONFIG.WIDTH + 60) {
        rs.phase = "returning";
        rs.phaseTimer = 0;
      }
    } else if (rs.phase === "returning") {
      // 平滑回到 targetY / 水平位置
      this.x += ((rs.startX || (CONFIG.WIDTH / 2)) - this.x) * 0.04;
      this.y += (this.targetY - this.y) * 0.04;
      if (Math.abs(this.y - this.targetY) < 3) {
        this.y = this.targetY;
        rs.active = false;
        this._ramState = null;
      }
    }
  }

  _attack(game) {
    const patterns = this.phase.attackPatterns;
    // 轮流或随机选一个模式
    const p = patterns[Math.floor(Math.random() * patterns.length)];
    const fn = BOSS_PATTERNS[p];
    if (fn) fn(this, game);
    if (game.audio) game.audio.play("bossShoot");
  }

  takeDamage(dmg, game, fromPlayer) {
    if (this.dying) return false;
    let final = dmg;
    if (fromPlayer && game.player) final *= game.player.bossDmgMul;
    this.hp -= final;
    this.hitFlash = 80;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dying = true;
      this.deathTimer = 1800;
      // 大震动
      game.shake(CONFIG.SHAKE_BIG);
      return true;
    }
    return false;
  }

  _onDeathFinal(game) {
    const d = this.def;
    // 超大爆炸
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math2.TAU;
      const sp = Math2.rand(1, 8);
      game.spawnParticle(this.x, this.y, {
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        color: Math2.pick([CONFIG.COLORS.neonOrange, CONFIG.COLORS.neonYellow, CONFIG.COLORS.neonPink, CONFIG.COLORS.neonCyan]),
        life: Math2.rand(500, 1200), size: Math2.rand(3, 8), shape: Math2.pick(["circle", "spark"]),
        angle: a, glow: 14,
      });
    }
    // 屏幕白闪（终Boss 彩蛋）
    if (this.def.id === "BOSS_CH6") {
      game.flashWhite(1000);
    }
    game.shake(CONFIG.SHAKE_BIG);
    // 分数/经验/金币：无尽缩放后的 Boss 奖励也按倍率放（但 clip 到 15x 内避免夸张）
    const mul = Math.min(15, Math.max(1, this._hpMul || 1));
    game.addScore(Math.round(d.score * mul));
    game.addExp(Math.round(d.exp * mul));
    game.state.coins += Math.round(d.coin * mul);
    game.state.bossKilled = true;
    game.state.bossesKilled = (game.state.bossesKilled || 0) + 1;
    if (game.audio) game.audio.play("bossExplode");
  }

  draw(ctx) {
    if (this.dead) return;
    const flash = this.hitFlash > 0;
    const main = flash ? "#ffffff" : this.color;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.shadowColor = this.color;
    ctx.shadowBlur = this.berserk ? 26 : 16;
    ctx.fillStyle = main;
    ctx.strokeStyle = this.accent;
    ctx.lineWidth = 2;

    const w = this.width, h = this.height;
    switch (this.shape) {
      case "saucer": // 圆形飞碟 + 四周炮管
        ctx.beginPath();
        ctx.ellipse(0, 0, w / 2, h / 3, 0, 0, Math2.TAU);
        ctx.fill(); ctx.stroke();
        // 顶部圆顶
        ctx.fillStyle = this.accent;
        ctx.beginPath();
        ctx.arc(0, -h / 6, w / 5, 0, Math2.TAU);
        ctx.fill();
        // 炮管
        ctx.fillStyle = main;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math2.TAU;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * w / 2.2, Math.sin(a) * h / 3.5, 5, 0, Math2.TAU);
          ctx.fill();
        }
        break;
      case "crab": // 螃蟹形
        ctx.beginPath();
        ctx.ellipse(0, 0, w / 2, h / 2.4, 0, 0, Math2.TAU);
        ctx.fill(); ctx.stroke();
        // 双钳
        ctx.fillStyle = this.accent;
        ctx.beginPath();
        ctx.arc(-w / 2, h / 4, w / 6, 0, Math2.TAU);
        ctx.arc(w / 2, h / 4, w / 6, 0, Math2.TAU);
        ctx.fill();
        // 眼
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(-w / 6, -h / 6, 4, 0, Math2.TAU);
        ctx.arc(w / 6, -h / 6, 4, 0, Math2.TAU);
        ctx.fill();
        break;
      case "core": // 母舰核心：多面体 + 核心
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math2.TAU - Math.PI / 2;
          const rx = Math.cos(a) * w / 2, ry = Math.sin(a) * h / 2;
          if (i === 0) ctx.moveTo(rx, ry); else ctx.lineTo(rx, ry);
        }
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // 内层旋转环
        ctx.rotate(this.t * 0.001);
        ctx.strokeStyle = this.accent;
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math2.TAU;
          const rx = Math.cos(a) * w / 3, ry = Math.sin(a) * h / 3;
          if (i === 0) ctx.moveTo(rx, ry); else ctx.lineTo(rx, ry);
        }
        ctx.closePath();
        ctx.stroke();
        // 核心
        ctx.rotate(-this.t * 0.002);
        ctx.fillStyle = this.berserk ? CONFIG.COLORS.neonRed : CONFIG.COLORS.neonYellow;
        ctx.shadowBlur = 30;
        ctx.beginPath();
        ctx.arc(0, 0, w / 7 + Math.sin(this.t * 0.01) * 3, 0, Math2.TAU);
        ctx.fill();
        break;
    }
    ctx.restore();
  }
}
