/* ============================================================
   Player.js - 玩家战机类
   包含：移动、自动射击、火力等级(Lv1-8)、必杀技、
         技能芯片效果、护盾、复活、受击降级
   ============================================================ */
class Player {
  constructor() {}

  init(planeId, game) {
    const d = PLANE_DATA[planeId] || PLANE_DATA.F01;
    this.def = d;
    this.planeId = planeId;
    this.x = CONFIG.PLAYER_START_X;
    this.y = CONFIG.PLAYER_START_Y;
    this.vx = 0; this.vy = 0;
    this.color = d.color;
    this.accent = d.accent;
    this.speed = d.speed;
    this.hitbox = d.hitbox;
    this.alive = true;

    // 血量
    this.maxHpBonus = 0;
    this.maxHp = d.maxHp;
    this.hp = d.maxHp;
    this.regen = false;
    this.regenAmount = 0;
    this.regenTimer = 0;

    // 射击
    this.fireRate = d.fireRate;
    this.fireTimer = 0;
    this.bulletDamage = d.bulletDamage;
    this.bulletSpeed = d.bulletSpeed;
    this.bulletType = d.bulletType;
    this.powerLevel = 1;
    // 芯片乘数/加成（初始化默认值）
    this.bulletDamageMul = 1;
    this.fireRateMul = 1;
    this.bossDmgMul = 1;
    this.pierce = 0;
    this.explosive = false;
    this.extraBullets = 0;
    this.dodgeChance = d.dodgeChance || 0;
    this.damageReduce = 1;
    this.magnetMul = 1;
    this.coinMul = 1;
    this.expMul = 1;
    this.skillCdMul = 1;
    this.bonusWingmen = 0;
    this.enemySlow = 1;
    this.startShield = 0;
    this.revives = 0;

    // 护盾/炸弹/能量
    this.shieldLayers = this.startShield;
    this.bombs = 3;
    this.skillEnergy = 0;       // 0-100
    this.skillId = d.skill;
    this.skillDef = SKILL_DEFS[d.skill];
    this.skillCdTimer = 0;
    this.maxSkillCd = d.skillCd;

    // 状态
    this.invincibleTimer = 0;
    this.engineTrail = [];
    this.t = 0;
    this.muzzleFlash = 0;

    // 重新计算属性（含 maxHpBonus）
    this._recalcStats();
    this.hp = this.maxHp;
    return this;
  }

  _recalcStats() {
    const d = this.def;
    this.maxHp = d.maxHp + this.maxHpBonus;
  }

  // 芯片应用（外部 SkillSystem 调用）
  applyChips(equippedChips) {
    // 重置乘数到默认
    this.bulletDamageMul = 1;
    this.fireRateMul = 1;
    this.bossDmgMul = 1;
    this.pierce = 0;
    this.explosive = false;
    this.extraBullets = 0;
    this.dodgeChance = this.def.dodgeChance || 0;
    this.damageReduce = 1;
    this.magnetMul = 1;
    this.coinMul = 1;
    this.expMul = 1;
    this.skillCdMul = 1;
    this.bonusWingmen = 0;
    this.enemySlow = 1;
    this.startShield = 0;
    this.revives = 0;
    this.regen = false;
    this.regenAmount = 0;
    this.maxHpBonus = 0;

    // 按芯片叠加
    for (const c of equippedChips) {
      const def = SKILL_DATA[c.id];
      if (def) def.apply(this, c.level);
    }
    const oldMax = this.maxHp;
    this._recalcStats();
    // 增加 maxHp 时同步补满差额
    if (this.maxHp > oldMax) this.hp += (this.maxHp - oldMax);
    if (this.hp > this.maxHp) this.hp = this.maxHp;
    // 开局护盾
    if (this.startShield > this.shieldLayers) this.shieldLayers = this.startShield;
  }

  update(dt, game) {
    if (!this.alive) return;
    this.t += dt;
    this.muzzleFlash = Math.max(0, this.muzzleFlash - dt);
    if (this.invincibleTimer > 0) this.invincibleTimer -= dt;
    if (this.skillCdTimer > 0) this.skillCdTimer -= dt;

    // 移动（由 Input 写入 this.targetX/Y，这里平滑跟随）
    if (this.targetX !== undefined) {
      this.x = Math2.lerp(this.x, this.targetX, 0.35);
      this.y = Math2.lerp(this.y, this.targetY, 0.35);
    }
    this.x = Math2.clamp(this.x, 16, CONFIG.WIDTH - 16);
    this.y = Math2.clamp(this.y, 16, CONFIG.HEIGHT - 16);

    // 引擎尾焰
    this.engineTrail.push({ x: this.x, y: this.y + 14, life: 1 });
    if (this.engineTrail.length > 8) this.engineTrail.shift();

    // 自动射击
    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.fireTimer = this.fireRate * this.fireRateMul;
      this._fire(game);
    }

    // 纳米修复
    if (this.regen) {
      this.regenTimer += dt;
      if (this.regenTimer >= 30000) {
        this.regenTimer = 0;
        this.heal(this.maxHp * this.regenAmount, game);
      }
    }

    // 僚机位置同步（由 Wingman 自身更新，这里只确保存在）
  }

  _fire(game) {
    this.muzzleFlash = 80;
    const dmg = this.bulletDamage * this.bulletDamageMul;
    const sp = this.bulletSpeed;
    const baseOpt = {
      side: "player", damage: dmg, color: this.color,
      pierce: this.pierce, explosive: this.explosive,
    };
    const fireX = this.x, fireY = this.y - 16;

    // 根据火力等级决定弹道
    const lv = this.powerLevel;
    // 主弹
    const mainBullets = this._mainPattern(lv, fireX, fireY, sp, baseOpt);
    for (const b of mainBullets) game.spawnPlayerBullet(b.x, b.y, b.vx, b.vy, b.opt || baseOpt);

    // 导弹（Lv4+）
    const missileCount = lv >= 7 ? 3 : (lv >= 6 ? 2 : (lv >= 4 ? 1 : 0));
    for (let i = 0; i < missileCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const off = side * (18 + Math.floor(i / 2) * 6);
      game.spawnPlayerBullet(fireX + off, fireY, side * 0.8, -sp * 0.8, {
        ...baseOpt, shape: "missile", radius: 5, damage: dmg * 0.7, homing: true, homingTime: 2500, color: "#fff200",
      });
    }

    // 激光（Lv8 MAX）
    if (lv >= 8) {
      game.spawnPlayerBullet(fireX, fireY, 0, -sp * 1.5, {
        ...baseOpt, shape: "bolt", radius: 7, damage: dmg * 1.2, color: CONFIG.COLORS.neonCyan, glow: 18, pierce: 99,
      });
    }

    // 弹片风暴额外斜弹
    if (this.extraBullets > 0) {
      for (let i = 0; i < this.extraBullets; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        game.spawnPlayerBullet(fireX, fireY, side * 2.5, -sp, { ...baseOpt, color: this.accent });
      }
    }

    if (game.audio) game.audio.play("shoot");
  }

  // 主弹道形态
  _mainPattern(lv, x, y, sp, baseOpt) {
    const out = [];
    const add = (vx, vy, opt) => out.push({ x, y, vx, vy, opt: { ...baseOpt, ...opt } });
    if (lv === 1) {
      add(0, -sp, { radius: 4 });
    } else if (lv === 2) {
      add(0, -sp, { radius: 4, x: x - 8 }); out[out.length - 1].x = x - 8;
      add(0, -sp, { radius: 4, x: x + 8 }); out[out.length - 1].x = x + 8;
    } else if (lv === 3) {
      // 三发扇形 5°
      for (const a of [-0.087, 0, 0.087]) add(Math.sin(a) * sp, -Math.cos(a) * sp, { radius: 4 });
    } else if (lv >= 4 && lv <= 5) {
      // 五发扇形 8°
      for (const a of [-0.14, -0.07, 0, 0.07, 0.14]) add(Math.sin(a) * sp, -Math.cos(a) * sp, { radius: 4 });
    } else {
      // Lv6-7 七发扇形
      for (const a of [-0.21, -0.14, -0.07, 0, 0.07, 0.14, 0.21]) add(Math.sin(a) * sp, -Math.cos(a) * sp, { radius: 4 });
    }
    return out;
  }

  takeDamage(dmg, game) {
    if (!this.alive || this.invincibleTimer > 0) return;
    // 闪避
    if (Math2.chance(this.dodgeChance)) {
      game.spawnFloatText(this.x, this.y - 20, "闪避", CONFIG.COLORS.neonGreen);
      return;
    }
    // 护盾
    if (this.shieldLayers > 0) {
      this.shieldLayers--;
      this.invincibleTimer = 800;
      game.shake(CONFIG.SHAKE_SMALL);
      game.spawnRing(this.x, this.y, CONFIG.COLORS.neonGreen, 40);
      game.spawnFloatText(this.x, this.y - 20, "护盾!", CONFIG.COLORS.neonGreen);
      if (game.audio) game.audio.play("shield");
      return;
    }
    // 实际受伤
    const real = dmg * this.damageReduce;
    this.hp -= real;
    game.state.damageTaken += real;
    this.invincibleTimer = CONFIG.PLAYER_INVINCIBLE_MS;
    game.shake(CONFIG.SHAKE_MED);
    if (game.audio) game.audio.play("hurt");
    game.spawnFloatText(this.x, this.y - 20, "-" + Math.round(real), CONFIG.COLORS.neonRed);

    // 火力降级
    if (this.powerLevel > 1) {
      this.powerLevel--;
      game.spawnFloatText(this.x, this.y - 36, "火力降级!", CONFIG.COLORS.neonOrange);
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this._die(game);
    }
  }

  _die(game) {
    // 复活协议
    if (this.revives > 0) {
      this.revives--;
      this.hp = this.maxHp * CONFIG.PLAYER_RESPAWN_HP_RATIO;
      this.invincibleTimer = 2500;
      this.powerLevel = Math.max(1, this.powerLevel - 2);
      game.shake(CONFIG.SHAKE_BIG);
      game.spawnRing(this.x, this.y, CONFIG.COLORS.neonCyan, 80);
      game.spawnFloatText(this.x, this.y - 30, "复活协议!", CONFIG.COLORS.neonCyan);
      if (game.audio) game.audio.play("revive");
      return;
    }
    this.alive = false;
    game.spawnExplosion(this.x, this.y, this.color, "huge");
    game.shake(CONFIG.SHAKE_BIG);
    if (game.audio) game.audio.play("bigExplode");
    game.onPlayerDeath();
  }

  heal(amount, game) {
    if (!this.alive) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    game.spawnFloatText(this.x, this.y - 20, "+" + Math.round(amount), CONFIG.COLORS.neonGreen);
  }

  // 必杀技
  canUseSkill() {
    return this.alive && this.skillCdTimer <= 0 && this.skillEnergy >= 100;
  }
  useSkill(game) {
    if (!this.canUseSkill()) return false;
    this.skillEnergy = 0;
    this.skillCdTimer = this.maxSkillCd * this.skillCdMul;
    game.activateSkill(this.skillId, this.skillDef);
    return true;
  }

  // 道具拾取（防御性：防止 NaN 溢出导致 HUD 死循环）
  pickupItem(type, game) {
    const num = (v, lo = -Infinity, hi = Infinity) =>
      Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : (lo === -Infinity ? 0 : lo);
    switch (type) {
      case "P":
        if (num(this.powerLevel, 1) < CONFIG.MAX_POWER_LEVEL) {
          this.powerLevel++;
          game.spawnFloatText(this.x, this.y - 20, "火力+" + this.powerLevel, CONFIG.COLORS.neonCyan);
          game.syncWingmen();
          if (game.audio) game.audio.play("powerup");
        } else {
          game.addScore(500);
          game.spawnFloatText(this.x, this.y - 20, "+500", CONFIG.COLORS.neonYellow);
        }
        break;
      case "S":
        this.shieldLayers = num(this.shieldLayers, 0) + 1;
        game.spawnFloatText(this.x, this.y - 20, "护盾+1", CONFIG.COLORS.neonGreen);
        break;
      case "H":
        this.heal(num(this.maxHp, 1) * 0.25, game);
        break;
      case "C": {
        const gain = Math.round(Math2.randInt(10, 50) * num(this.coinMul, 0));
        game.state.coins += Number.isFinite(gain) ? gain : 0;
        game.spawnFloatText(this.x, this.y - 20, "+" + gain + "💰", CONFIG.COLORS.neonYellow);
        break;
      }
      case "E": {
        const before = this.skillEnergy;
        this.skillEnergy = num(before, 0, 100);
        this.skillEnergy = Math.min(100, this.skillEnergy + 30);
        game.spawnFloatText(this.x, this.y - 20, "能量+30%", CONFIG.COLORS.neonPurple);
        // 同步到新的主动技能 SP 条
        if (game.activeSkills) {
          game.activeSkills.addSp(Math.round(30 * (game.activeSkills.spMax / 100)));
        }
        break;
      }
      case "B":
        this.bombs = num(this.bombs, 0) + 1;
        game.spawnFloatText(this.x, this.y - 20, "炸弹+1", CONFIG.COLORS.neonOrange);
        break;
      case "X":
        game.requestChipChoice();
        break;
      case "EXP": {
        const v = expValue(8);
        game.addExp(Number.isFinite(v) ? v : 8);
        game.spawnFloatText(this.x, this.y - 20, "EXP", CONFIG.COLORS.neonGreen);
        break;
      }
    }
    if (game.audio) game.audio.play("pickup");
  }

  draw(ctx) {
    if (!this.alive) return;
    const d = this.def.shape || {};
    const w = d.width || 30;
    const h = d.height || 34;
    const style = d.style || "classic";
    const blink = this.invincibleTimer > 0 && Math.floor(this.t / 80) % 2 === 0;

    // ========== 引擎尾焰（多引擎动态） ==========
    this._drawEngineTrails(ctx, d);

    // ========== 能量光环（终极型） ==========
    if (d.hasAura) {
      ctx.save();
      ctx.translate(this.x, this.y);
      const pulse = 0.6 + Math.sin(this.t * 0.006) * 0.2;
      ctx.globalAlpha = pulse * 0.5;
      ctx.strokeStyle = this.accent;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 30;
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 2; k++) {
        ctx.beginPath();
        ctx.arc(0, 0, (w * 0.8) + k * 6 + Math.sin(this.t * 0.004 + k) * 4, 0, Math2.TAU);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (blink) { ctx.save(); ctx.globalAlpha = 0.4; }

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = this.color;
    ctx.strokeStyle = this.accent;
    ctx.lineWidth = 1.5;

    // ========== 按风格绘制战机外形 ==========
    switch (style) {
      case "sleek":    this._drawSleek(ctx, w, h, d); break;
      case "heavy":    this._drawHeavy(ctx, w, h, d); break;
      case "phantom":  this._drawPhantom(ctx, w, h, d); break;
      case "berserker":this._drawBerserker(ctx, w, h, d); break;
      case "void":     this._drawVoid(ctx, w, h, d); break;
      case "classic":
      default:         this._drawClassic(ctx, w, h, d); break;
    }

    // ========== 驾驶舱（所有机型通用） ==========
    ctx.fillStyle = d.cockpitColor || "#ffffff";
    ctx.shadowColor = d.cockpitColor || "#ffffff";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    const cy = -h * 0.05;
    ctx.ellipse(0, cy, w * 0.12, h * 0.18, 0, 0, Math2.TAU);
    ctx.fill();

    // ========== 水晶核心（终极型） ==========
    if (d.crystalCore) {
      ctx.save();
      ctx.translate(0, h * 0.1);
      ctx.rotate(this.t * 0.003);
      ctx.fillStyle = this.accent;
      ctx.shadowColor = this.accent;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      const s = w * 0.18;
      ctx.moveTo(0, -s); ctx.lineTo(s, 0); ctx.lineTo(0, s); ctx.lineTo(-s, 0); ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // ========== 炮口闪光 ==========
    if (this.muzzleFlash > 0) {
      const alpha = this.muzzleFlash / 80;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 12;
      // 根据火力等级显示多个炮口
      const muzzleCount = Math.min(4, Math.max(1, Math.floor(this.powerLevel / 2) + 1));
      const spread = w * 0.4;
      for (let i = 0; i < muzzleCount; i++) {
        const off = muzzleCount === 1 ? 0 : -spread + (spread * 2 / (muzzleCount - 1)) * i;
        ctx.beginPath();
        ctx.arc(off, -h / 2 - 3, 3.5, 0, Math2.TAU);
        ctx.fill();
      }
    }
    ctx.restore();

    if (blink) ctx.restore();

    // ========== 护盾光环 ==========
    if (this.shieldLayers > 0) {
      ctx.save();
      ctx.strokeStyle = CONFIG.COLORS.neonGreen;
      ctx.shadowColor = CONFIG.COLORS.neonGreen;
      ctx.shadowBlur = 14;
      ctx.lineWidth = 2;
      for (let i = 0; i < this.shieldLayers; i++) {
        ctx.globalAlpha = (0.4 + Math.sin(this.t * 0.01 + i) * 0.2) / (1 + i * 0.3);
        ctx.beginPath();
        ctx.arc(this.x, this.y, 22 + this.shieldLayers * 3 + i * 4, 0, Math2.TAU);
        ctx.stroke();
      }
      ctx.restore();
    }

    // ========== 闪避残影（技巧型在闪避时） ==========
    if (this.dodgeChance && this.dodgeChance > 0) {
      ctx.save();
      ctx.globalAlpha = 0.15 + Math.sin(this.t * 0.008) * 0.08;
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.accent;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(this.x, this.y, (w + h) * 0.3, 0, Math2.TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  // ========== 引擎尾焰绘制 ==========
  _drawEngineTrails(ctx, d) {
    const count = d.engineCount || 2;
    const spread = (d.width || 30) * 0.35;
    ctx.save();
    for (let i = 0; i < this.engineTrail.length; i++) {
      const t = this.engineTrail[i];
      const a = (i / this.engineTrail.length) * 0.6;
      ctx.globalAlpha = a;
      ctx.fillStyle = this.accent;
      ctx.shadowColor = this.accent;
      ctx.shadowBlur = 10;
      const life = this.engineTrail.length - i;
      for (let e = 0; e < count; e++) {
        const off = count === 1 ? 0 : -spread + (spread * 2 / (count - 1)) * e;
        const jitter = Math.sin((this.t + i * 50 + e * 30) * 0.04) * 1.5;
        const r = Math.max(1.2, 3.2 - i * 0.25);
        ctx.beginPath();
        ctx.arc(t.x + off + jitter, t.y + life * 2, r, 0, Math2.TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // ========== F01 经典型（雷霆先锋） ==========
  _drawClassic(ctx, w, h, d) {
    // 机身
    ctx.beginPath();
    ctx.moveTo(0, -h / 2);                          // 机头
    ctx.lineTo(w * 0.18, -h * 0.1);
    ctx.lineTo(w * 0.5, h * 0.33);                  // 右翼尖
    ctx.lineTo(w * 0.25, h * 0.5);                  // 右尾翼
    ctx.lineTo(w * 0.1, h * 0.35);
    ctx.lineTo(-w * 0.1, h * 0.35);
    ctx.lineTo(-w * 0.25, h * 0.5);                 // 左尾翼
    ctx.lineTo(-w * 0.5, h * 0.33);                 // 左翼尖
    ctx.lineTo(-w * 0.18, -h * 0.1);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // 边条翼
    if (d.hasStrakes) {
      ctx.beginPath();
      ctx.moveTo(-w * 0.18, -h * 0.1);
      ctx.lineTo(-w * 0.35, h * 0.1);
      ctx.lineTo(-w * 0.22, h * 0.12);
      ctx.lineTo(-w * 0.1, -h * 0.05);
      ctx.moveTo(w * 0.18, -h * 0.1);
      ctx.lineTo(w * 0.35, h * 0.1);
      ctx.lineTo(w * 0.22, h * 0.12);
      ctx.lineTo(w * 0.1, -h * 0.05);
      ctx.fillStyle = this.accent;
      ctx.fill();
    }
    // 武器挂架细节
    ctx.strokeStyle = this.accent;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w * 0.35, h * 0.15); ctx.lineTo(w * 0.4, h * 0.28);
    ctx.moveTo(-w * 0.35, h * 0.15); ctx.lineTo(-w * 0.4, h * 0.28);
    ctx.stroke();
  }

  // ========== F02 高速型（暗影刺客）前掠翼 ==========
  _drawSleek(ctx, w, h, d) {
    // 长尖头 + 前掠翼（细长造型）
    ctx.beginPath();
    ctx.moveTo(0, -h / 2);                          // 尖头
    ctx.lineTo(w * 0.08, -h * 0.2);
    ctx.lineTo(w * 0.12, 0);
    ctx.lineTo(w * 0.5, -h * 0.1);                  // 前掠翼尖
    ctx.lineTo(w * 0.25, h * 0.5);                  // 尾翼
    ctx.lineTo(w * 0.08, h * 0.35);
    ctx.lineTo(-w * 0.08, h * 0.35);
    ctx.lineTo(-w * 0.25, h * 0.5);
    ctx.lineTo(-w * 0.5, -h * 0.1);
    ctx.lineTo(-w * 0.12, 0);
    ctx.lineTo(-w * 0.08, -h * 0.2);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // 背脊线
    ctx.strokeStyle = this.accent;
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.4); ctx.lineTo(0, h * 0.3);
    ctx.stroke();
    // 能量条纹（侧面）
    ctx.fillStyle = this.accent;
    ctx.fillRect(-w * 0.04, -h * 0.1, w * 0.08, h * 0.3);
  }

  // ========== F03 重火力型（重装堡垒） ==========
  _drawHeavy(ctx, w, h, d) {
    // 厚重主体
    ctx.beginPath();
    ctx.moveTo(0, -h / 2);
    ctx.lineTo(w * 0.22, -h * 0.25);
    ctx.lineTo(w * 0.28, 0);
    ctx.lineTo(w * 0.5, h * 0.1);                   // 机翼（水平）
    ctx.lineTo(w * 0.45, h * 0.45);                 // 尾翼
    ctx.lineTo(w * 0.2, h * 0.5);
    ctx.lineTo(-w * 0.2, h * 0.5);
    ctx.lineTo(-w * 0.45, h * 0.45);
    ctx.lineTo(-w * 0.5, h * 0.1);
    ctx.lineTo(-w * 0.28, 0);
    ctx.lineTo(-w * 0.22, -h * 0.25);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // 装甲板分格
    if (d.hasArmorPlate) {
      ctx.strokeStyle = this.accent;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-w * 0.3, -h * 0.05); ctx.lineTo(w * 0.3, -h * 0.05);
      ctx.moveTo(-w * 0.3, h * 0.2); ctx.lineTo(w * 0.3, h * 0.2);
      ctx.moveTo(0, -h * 0.15); ctx.lineTo(0, h * 0.35);
      ctx.stroke();
    }
    // 炮管（前部）
    const cannons = d.cannonSize || 3;
    ctx.fillStyle = this.accent;
    ctx.shadowColor = this.accent;
    for (let i = 0; i < cannons; i++) {
      const off = cannons === 1 ? 0 : -w * 0.15 + (w * 0.3 / (cannons - 1)) * i;
      ctx.fillRect(off - 1.5, -h / 2 - 5, 3, 7);
    }
    // 翼尖导弹
    ctx.fillStyle = this.color;
    ctx.strokeStyle = this.accent;
    ctx.fillRect(w * 0.42, h * 0.0, 6, h * 0.2);
    ctx.strokeRect(w * 0.42, h * 0.0, 6, h * 0.2);
    ctx.fillRect(-w * 0.48, h * 0.0, 6, h * 0.2);
    ctx.strokeRect(-w * 0.48, h * 0.0, 6, h * 0.2);
  }

  // ========== F04 技巧型（量子幽灵） ==========
  _drawPhantom(ctx, w, h, d) {
    if (d.deltaWing) {
      // 三角翼无尾布局
      ctx.beginPath();
      ctx.moveTo(0, -h / 2);
      ctx.lineTo(w * 0.5, h * 0.5);                   // 无尾三角翼尖
      ctx.lineTo(w * 0.18, h * 0.3);
      ctx.lineTo(-w * 0.18, h * 0.3);
      ctx.lineTo(-w * 0.5, h * 0.5);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
    // 环形翼装饰
    if (d.hasRingWing) {
      ctx.strokeStyle = this.accent;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = this.accent;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.ellipse(0, h * 0.0, w * 0.42, h * 0.18, 0, 0, Math2.TAU);
      ctx.stroke();
    }
    // 量子条纹
    ctx.fillStyle = this.accent;
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 3; i++) {
      const y = -h * 0.1 + i * (h * 0.18);
      ctx.fillRect(-w * 0.25, y, w * 0.5, 1.2);
    }
    ctx.globalAlpha = 1;
  }

  // ========== F05 狂暴型（灭世神罚） ==========
  _drawBerserker(ctx, w, h, d) {
    // 攻击性轮廓 + 后掠翼
    ctx.beginPath();
    ctx.moveTo(0, -h / 2);
    ctx.lineTo(w * 0.2, -h * 0.18);
    ctx.lineTo(w * 0.55, h * 0.05);                  // 后掠翼尖
    ctx.lineTo(w * 0.42, h * 0.38);
    ctx.lineTo(w * 0.22, h * 0.5);
    ctx.lineTo(w * 0.12, h * 0.3);
    ctx.lineTo(-w * 0.12, h * 0.3);
    ctx.lineTo(-w * 0.22, h * 0.5);
    ctx.lineTo(-w * 0.42, h * 0.38);
    ctx.lineTo(-w * 0.55, h * 0.05);
    ctx.lineTo(-w * 0.2, -h * 0.18);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // 背脊细节
    if (d.spineDetail) {
      ctx.fillStyle = this.accent;
      ctx.shadowColor = this.accent;
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.3);
      ctx.lineTo(w * 0.08, -h * 0.1);
      ctx.lineTo(0, h * 0.3);
      ctx.lineTo(-w * 0.08, -h * 0.1);
      ctx.closePath();
      ctx.fill();
    }
    // 多管炮
    if (d.multiCannon) {
      ctx.fillStyle = this.accent;
      ctx.fillRect(-w * 0.18, -h / 2 - 6, 3, 8);
      ctx.fillRect(-w * 0.06, -h / 2 - 6, 3, 8);
      ctx.fillRect(w * 0.03, -h / 2 - 6, 3, 8);
      ctx.fillRect(w * 0.15, -h / 2 - 6, 3, 8);
    }
    // 翼下武器架
    ctx.strokeStyle = this.accent;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(w * 0.35, h * 0.12); ctx.lineTo(w * 0.48, h * 0.3);
    ctx.moveTo(-w * 0.35, h * 0.12); ctx.lineTo(-w * 0.48, h * 0.3);
    ctx.stroke();
  }

  // ========== F06 终极型（虚空主宰） ==========
  _drawVoid(ctx, w, h, d) {
    // 未来主义造型：中央机身 + X形翼
    ctx.beginPath();
    ctx.moveTo(0, -h / 2);
    ctx.lineTo(w * 0.14, -h * 0.25);
    ctx.lineTo(w * 0.5, -h * 0.1);                    // 上右翼
    ctx.lineTo(w * 0.35, h * 0.1);
    ctx.lineTo(w * 0.5, h * 0.5);                     // 下右翼
    ctx.lineTo(w * 0.15, h * 0.32);
    ctx.lineTo(-w * 0.15, h * 0.32);
    ctx.lineTo(-w * 0.5, h * 0.5);                    // 下左翼
    ctx.lineTo(-w * 0.35, h * 0.1);
    ctx.lineTo(-w * 0.5, -h * 0.1);                   // 上左翼
    ctx.lineTo(-w * 0.14, -h * 0.25);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // 渐变发光翼面
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = this.accent;
    ctx.shadowColor = this.accent;
    // 填充翼面
    ctx.beginPath();
    ctx.moveTo(w * 0.18, -h * 0.2);
    ctx.lineTo(w * 0.48, -h * 0.12); ctx.lineTo(w * 0.33, h * 0.08);
    ctx.moveTo(-w * 0.18, -h * 0.2);
    ctx.lineTo(-w * 0.48, -h * 0.12); ctx.lineTo(-w * 0.33, h * 0.08);
    ctx.fill();
    ctx.restore();
    // 能量网格
    ctx.strokeStyle = this.accent;
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-w * 0.2 + i * w * 0.2, -h * 0.15);
      ctx.lineTo(-w * 0.15 + i * w * 0.15, h * 0.25);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
