/* ============================================================
   EquipSystem.js - 装备系统核心引擎
   负责：玩家装备挂载/拆卸、10 件装备并行独立计时/过热/弹匣、
         每帧自动开火、伤害与技能互不影响
   约束：拆卸时必须至少保留 1 件（0 件时强制兜底霰弹）
   ============================================================ */
class EquipSystem {
  constructor(game) {
    this.game = game;

    // 已拥有（永久解锁的装备 id 集合）
    this.ownedEquips = new Set();

    // 当前挂载（最多 10 件，全部可同时开火）
    this.equippedIds = [];

    // 每件装备的运行时状态（按 id 索引）
    // 包含：fireTimer 射击计时、heat 热量、magazine 弹匣、reloading、
    //       charging 狙击蓄力、laserActive、drones 浮游炮实体列表
    this.runtime = {};

    // 装备全局伤害倍率（由永久强化 / 狂暴技能 / 机甲形态提供）
    this.globalDmgMul = 1;
    // 装备全局射速倍率
    this.globalFireRateMul = 1;
    // 机甲自动锁敌开关
    this.autoLock = false;

    this._t = 0;
  }

  // ======================================================================
  // 生命周期：游戏开始时根据装备构建 runtime
  // ======================================================================
  resetForRun(equippedIds) {
    // 确保至少 1 件（兜底霰弹 shotgun）
    let ids = (equippedIds && equippedIds.length > 0) ? equippedIds.slice() : [EQUIP_DEFAULT_FALLBACK];
    ids = ids.filter(id => this.ownedEquips.has(id) || id === EQUIP_DEFAULT_FALLBACK);
    if (ids.length === 0) ids = [EQUIP_DEFAULT_FALLBACK];
    // 自动兜底：如果一件都没装，补上默认
    if (ids.length < 1) ids.push(EQUIP_DEFAULT_FALLBACK);

    this.equippedIds = ids;
    this.runtime = {};
    for (const id of ids) {
      this.runtime[id] = this._makeRuntime(id);
    }
    this.globalDmgMul = 1;
    this.globalFireRateMul = 1;
    this.autoLock = false;
  }

  _makeRuntime(id) {
    const d = EQUIP_DATA[id];
    const base = {
      fireTimer: 0,
      cdTimer: 0,
    };
    switch (id) {
      case "laser":
        return Object.assign(base, {
          heat: 0, overheated: false, overheatTimer: 0,
          continuousOnMs: 0,
        });
      case "missile":
        return Object.assign(base, {
          magazine: d.magazine,
          reloading: false,
          reloadTimer: 0,
          aliveCount: 0,
        });
      case "bomb":
        return base;
      case "railgun":
        return Object.assign(base, { charging: false, chargeTime: 0 });
      case "shotgun":
        return base;
      case "drone":
        return Object.assign(base, {
          drones: [],            // 浮游炮实体（带 angle/life）
          summonCd: 0,
          droneFireTimer: 0,
        });
      case "chainball":
        return Object.assign(base, { aliveBalls: [] });
      case "sniper":
        return Object.assign(base, { chargeTime: 0, cooling: false, cdTimer: 0 });
      case "bladering":
        return Object.assign(base, { tickTimer: 0, rotationAngle: 0 });
      case "cluster":
        return base;
      default:
        return base;
    }
  }

  // ======================================================================
  // 装备获取/失去（UI 层 / 宝箱 / 商店调用）
  // ======================================================================
  /** 永久获得一件装备 */
  unlockEquip(id) {
    if (!EQUIP_DATA[id]) return false;
    this.ownedEquips.add(id);
    return true;
  }

  /** 装配一件：必须已拥有；最多 10 件；去重 */
  equip(id) {
    if (!this.ownedEquips.has(id) && id !== EQUIP_DEFAULT_FALLBACK) return false;
    if (this.equippedIds.includes(id)) return false;
    if (this.equippedIds.length >= 10) return false;
    this.equippedIds.push(id);
    this.runtime[id] = this._makeRuntime(id);
    return true;
  }

  /** 拆卸一件：0 件时强制装备默认霰弹（不可拆光）*/
  unequip(id) {
    const idx = this.equippedIds.indexOf(id);
    if (idx < 0) return false;
    if (this.equippedIds.length <= 1) return false; // 强制至少 1 件
    this.equippedIds.splice(idx, 1);
    delete this.runtime[id];
    if (this.equippedIds.length === 0) {
      // 兜底
      this.equippedIds.push(EQUIP_DEFAULT_FALLBACK);
      this.runtime[EQUIP_DEFAULT_FALLBACK] = this._makeRuntime(EQUIP_DEFAULT_FALLBACK);
    }
    return true;
  }

  // ======================================================================
  // 倍率：由主动技能调用
  // ======================================================================
  setGlobalMul({ dmg = 1, fireRate = 1, autoLock = false }) {
    this.globalDmgMul = dmg;
    this.globalFireRateMul = fireRate;
    this.autoLock = autoLock;
  }
  applyMul(mul) {
    this.globalDmgMul *= (mul.dmg ?? 1);
    this.globalFireRateMul *= (mul.fireRate ?? 1);
    if (mul.autoLock) this.autoLock = true;
  }

  // ======================================================================
  // 主循环 dt = 秒
  // 性能优化：每件装备每帧最多生成 1 颗子弹；game 层 _enforceBulletCap 兜底
  // ======================================================================
  update(dt) {
    this._t += dt;
    const g = this.game;
    // 性能守卫：玩家子弹已超硬上限，本帧暂停所有装备生成新弹（不影响已在飞的）
    const bulletStarved = g.bullets.length >= (CONFIG.MAX_PLAYER_BULLETS || 280) - 4;
    for (const id of this.equippedIds) {
      const d = EQUIP_DATA[id];
      const r = this.runtime[id];
      if (!d || !r) continue;
      // 传递 bulletStarved 标志，让每个 update 内部判断是否生成新弹
      r._starved = bulletStarved;
      switch (id) {
        case "laser":     this._updateLaser(dt, d, r);    break;
        case "missile":   this._updateMissile(dt, d, r);  break;
        case "bomb":      this._updateBomb(dt, d, r);     break;
        case "railgun":   this._updateRailgun(dt, d, r);  break;
        case "shotgun":   this._updateShotgun(dt, d, r);  break;
        case "drone":     this._updateDrone(dt, d, r);    break;
        case "chainball": this._updateChainball(dt, d, r);break;
        case "sniper":    this._updateSniper(dt, d, r);   break;
        case "bladering": this._updateBladering(dt, d, r);break;
        case "cluster":   this._updateCluster(dt, d, r);  break;
      }
    }
  }

  // ======================================================================
  // 10 种装备各自动开火实现
  // ======================================================================

  // ---------- 1. 直线激光 ----------
  _updateLaser(dt, d, r) {
    if (r.overheated) {
      r.overheatTimer -= dt;
      r.heat = Math.max(0, r.heat - 33 * dt); // 强制冷却期间快速冷却
      if (r.overheatTimer <= 0) { r.overheated = false; }
      return;
    }
    // 持续开启，每帧累计热量
    r.heat += d.heatPerSec * dt;
    if (r.heat >= d.overheatThreshold) {
      r.heat = d.overheatThreshold;
      r.overheated = true;
      r.overheatTimer = d.overheatCooldownSec;
      this.game.notifyLaserState && this.game.notifyLaserState("overheat");
      return;
    }
    // 锁定最近敌人（或机甲强制锁敌）
    const target = this._pickTarget();
    const player = this.game.player;
    if (!player) return;

    const hitDamage = d.dpsPerFrame * (60 * dt) * this.globalDmgMul;
    // 通知渲染层绘制 & 对命中敌人施加每帧伤害
    this.game.applyLaserDamage && this.game.applyLaserDamage({
      x1: player.x, y1: player.y - 20,
      color: d.color, colorCore: d.colorCore, width: d.width,
      damage: hitDamage,
      heatRatio: r.heat / d.overheatThreshold,
      target,
    });
  }

  // ---------- 2. 追踪导弹 ----------
  _updateMissile(dt, d, r) {
    // 装填
    if (r.reloading) {
      r.reloadTimer -= dt;
      if (r.reloadTimer <= 0) {
        r.reloading = false;
        r.magazine = d.magazine;
      }
      return;
    }
    r.fireTimer -= dt;
    const interval = d.fireIntervalSec / this.globalFireRateMul;
    if (r.fireTimer <= 0 && r.magazine > 0 && r.aliveCount < d.maxAlive) {
      r.fireTimer = interval;
      r.magazine -= 1;
      r.aliveCount += 1;
      const player = this.game.player;
      if (!player) return;
      this.game.spawnEquipMissile({
        x: player.x - 20 + Math.random() * 40,
        y: player.y - 10,
        speed: d.speed,
        turnRate: d.turnRate,
        directDamage: d.directDamage * this.globalDmgMul,
        splashRadius: d.splashRadius,
        splashFalloff: d.splashFalloff,
        color: d.color, colorTrail: d.colorTrail,
        onDead: () => { r.aliveCount = Math.max(0, r.aliveCount - 1); },
      });
      if (r.magazine === 0) {
        r.reloading = true;
        r.reloadTimer = d.reloadSec;
      }
    }
  }

  // ---------- 3. 范围炸弹 ----------
  _updateBomb(dt, d, r) {
    r.fireTimer -= dt;
    const interval = d.fireIntervalSec / this.globalFireRateMul;
    if (r.fireTimer <= 0) {
      r.fireTimer = interval;
      const player = this.game.player;
      const target = this._pickTarget();
      if (!player) return;
      const tx = target ? target.x : player.x;
      const ty = target ? Math.max(target.y, player.y - 300) : player.y - 200;
      this.game.spawnEquipBomb({
        x: player.x, y: player.y - 10,
        tx, ty,
        gravity: d.gravity, arcHeight: d.arcHeight,
        flightSec: d.flightSec,
        centerDamage: d.centerDamage * this.globalDmgMul,
        edgeDamage: d.edgeDamage * this.globalDmgMul,
        blastRadius: d.blastRadius,
        color: d.color,
      });
    }
  }

  // ---------- 4. 贯穿电磁炮 ----------
  _updateRailgun(dt, d, r) {
    r.fireTimer -= dt;
    const interval = d.fireIntervalSec / this.globalFireRateMul;
    if (r.fireTimer <= 0) {
      r.fireTimer = interval;
      // 0.5 秒蓄力后发射
      r.charging = true;
      r.chargeTime = d.chargeSec;
    }
    if (r.charging) {
      r.chargeTime -= dt;
      if (r.chargeTime <= 0) {
        r.charging = false;
        const player = this.game.player;
        if (!player) return;
        // 方向：自动锁敌 or 向上
        const target = this.autoLock ? this._pickTarget() : null;
        let angle = -Math.PI / 2;
        if (target) angle = Math.atan2(target.y - player.y, target.x - player.x);
        this.game.spawnEquipRailgun({
          x: player.x, y: player.y - 20, angle,
          speed: d.speed,
          damage: d.damage * this.globalDmgMul,
          pierceFalloff: d.pierceFalloff,
          color: d.color, colorArc: d.colorArc, colorLightning: d.colorLightning,
          width: d.width,
        });
      }
    }
  }

  // ---------- 5. 散射霰弹 ----------
  _updateShotgun(dt, d, r) {
    r.fireTimer -= dt;
    const interval = d.fireIntervalSec / this.globalFireRateMul;
    if (r.fireTimer <= 0) {
      r.fireTimer = interval;
      const player = this.game.player;
      if (!player) return;
      const spreadRad = (d.spreadDeg * Math.PI) / 180;
      const baseAngle = -Math.PI / 2 + (this.autoLock ? this._angleToNearest(player) : 0);
      for (let i = 0; i < d.pelletCount; i++) {
        const t = d.pelletCount === 1 ? 0 : (i / (d.pelletCount - 1)) - 0.5;
        const a = baseAngle + t * spreadRad;
        this.game.spawnEquipBullet({
          x: player.x, y: player.y - 20,
          vx: Math.cos(a) * d.speed,
          vy: Math.sin(a) * d.speed,
          damage: d.pelletDamage * this.globalDmgMul,
          maxRange: d.maxRange,
          color: d.color, size: d.pelletSize,
          from: "shotgun",
        });
      }
    }
  }

  // ---------- 6. 浮游炮·召唤 ----------
  _updateDrone(dt, d, r) {
    // 清理已过期（索引循环）
    const drones = r.drones;
    for (let di = drones.length - 1; di >= 0; di--) {
      if (drones[di].life <= 0) drones.splice(di, 1);
    }
    for (let di = 0, dl = drones.length; di < dl; di++) {
      drones[di].life -= dt;
    }

    // 召唤 CD
    r.summonCd -= dt;
    if (r.drones.length < d.droneCount && r.summonCd <= 0) {
      // 补齐到 droneCount
      const player = this.game.player;
      while (r.drones.length < d.droneCount) {
        r.drones.push({
          angle: (r.drones.length / d.droneCount) * Math.PI * 2,
          life: d.lifetimeSec,
        });
      }
      r.summonCd = d.summonCooldownSec;
    }

    // 移动 & 射击
    r.droneFireTimer -= dt;
    const fireItv = d.fireIntervalSec / this.globalFireRateMul;
    const player = this.game.player;
    if (player) {
      for (let i = 0; i < r.drones.length; i++) {
        const dr = r.drones[i];
        dr.angle += d.orbitSpeed * dt;
        const dx = Math.cos(dr.angle) * d.orbitRadius;
        const dy = Math.sin(dr.angle) * d.orbitRadius * 0.5;
        dr.x = player.x + dx;
        dr.y = player.y - 30 + dy;
      }
      if (r.droneFireTimer <= 0 && r.drones.length > 0) {
        r.droneFireTimer = fireItv;
        // 索引循环：drone 射击（drone 列表本身不变，只在外部生成子弹）
        for (let di2 = 0, dl2 = r.drones.length; di2 < dl2; di2++) {
          const dr = r.drones[di2];
          if (!dr.x) continue;
          let angle = -Math.PI / 2;
          if (this.autoLock) {
            const t = this._pickTarget();
            if (t) angle = Math.atan2(t.y - dr.y, t.x - dr.x);
          }
          this.game.spawnEquipBullet({
            x: dr.x, y: dr.y,
            vx: Math.cos(angle) * d.speed,
            vy: Math.sin(angle) * d.speed,
            damage: d.pelletDamage * this.globalDmgMul,
            color: d.colorBullet, size: 3,
            from: "drone",
          });
        }
      }
    }
    // 通知渲染层绘制浮游炮
    this.game.setDronePositions && this.game.setDronePositions(r.drones, d);
  }

  // ---------- 7. 弹射链球 ----------
  _updateChainball(dt, d, r) {
    // 清理死亡链球（索引倒序过滤）
    const balls = r.aliveBalls;
    for (let bi = balls.length - 1; bi >= 0; bi--) {
      if (balls[bi].life <= 0) balls.splice(bi, 1);
    }
    r.fireTimer -= dt;
    const interval = d.fireIntervalSec / this.globalFireRateMul;
    if (r.fireTimer <= 0) {
      r.fireTimer = interval;
      const player = this.game.player;
      if (!player) return;
      const angle = this.autoLock ? this._angleToNearest(player) : -Math.PI / 2;
      r.aliveBalls.push({
        x: player.x, y: player.y - 20,
        vx: Math.cos(angle) * d.speed,
        vy: Math.sin(angle) * d.speed,
        bounces: d.bounceCount,
        life: d.lifetimeSec,
        damage: d.damagePerHit * this.globalDmgMul,
        radius: d.radius,
        prevX: player.x, prevY: player.y - 20,
      });
    }
    // 每帧让 game 层统一物理移动
    for (let bi = 0, bl = balls.length; bi < bl; bi++) {
      const b = balls[bi];
      b.prevX = b.x; b.prevY = b.y;
      b.x += b.vx * dt * 60 / 60; // 速度已经是 px/s
      b.y += b.vy * dt * 60 / 60;
      b.life -= dt;
      // 碰撞屏幕 → 弹射
      if (b.x < b.radius) { b.x = b.radius; b.vx = Math.abs(b.vx); b.bounces--; }
      else if (b.x > CONFIG.WIDTH - b.radius) { b.x = CONFIG.WIDTH - b.radius; b.vx = -Math.abs(b.vx); b.bounces--; }
      if (b.y < b.radius) { b.y = b.radius; b.vy = Math.abs(b.vy); b.bounces--; }
      else if (b.y > CONFIG.HEIGHT - b.radius) { b.y = CONFIG.HEIGHT - b.radius; b.vy = -Math.abs(b.vy); b.bounces--; }
      if (b.bounces < 0) b.life = 0;
    }
    this.game.setChainballPositions && this.game.setChainballPositions(r.aliveBalls, d);
  }

  // ---------- 8. 蓄力狙击炮 ----------
  _updateSniper(dt, d, r) {
    if (r.cooling) {
      r.cdTimer -= dt;
      if (r.cdTimer <= 0) { r.cooling = false; r.chargeTime = 0; }
      return;
    }
    // 一直自动蓄力（类似自动武器），蓄到 3 秒自动发射
    r.chargeTime += dt;
    if (r.chargeTime >= d.chargeMaxSec) {
      this._sniperFire(d, r);
    }
  }
  _sniperFire(d, r) {
    const player = this.game.player;
    if (!player) return;
    const lv = Math.max(0, Math.min(3, Math.floor(r.chargeTime)));
    const dmg = d.chargeLevelDamage[lv] * this.globalDmgMul;
    let angle = -Math.PI / 2;
    if (this.autoLock) angle = this._angleToNearest(player);
    this.game.spawnEquipSniper({
      x: player.x, y: player.y - 20, angle,
      damage: dmg, color: d.color, colorCharge: d.colorCharge,
      chargeLv: lv,
    });
    r.cooling = true;
    r.cdTimer = d.fireCooldownSec;
    r.chargeTime = 0;
  }

  // ---------- 9. 近身切割环 ----------
  _updateBladering(dt, d, r) {
    r.tickTimer -= dt;
    r.rotationAngle += d.rotationSpeed * dt;
    const player = this.game.player;
    if (player) {
      // 直接对环内敌人每 tick 施加伤害
      if (r.tickTimer <= 0) {
        r.tickTimer = d.tickIntervalSec;
        this.game.applyBladeringDamage({
          x: player.x, y: player.y,
          radius: d.radius,
          damage: d.damagePerTick * this.globalDmgMul * (60 * d.tickIntervalSec),
        });
      }
      // 渲染
      this.game.setBladeringState && this.game.setBladeringState({
        x: player.x, y: player.y, radius: d.radius,
        rotationAngle: r.rotationAngle, bladeCount: d.bladeCount,
        color: d.color, colorRing: d.colorRing,
      });
    }
  }

  // ---------- 10. 子母弹 ----------
  _updateCluster(dt, d, r) {
    r.fireTimer -= dt;
    const interval = d.fireIntervalSec / this.globalFireRateMul;
    if (r.fireTimer <= 0) {
      r.fireTimer = interval;
      const player = this.game.player;
      if (!player) return;
      let angle = -Math.PI / 2;
      if (this.autoLock) angle = this._angleToNearest(player);
      this.game.spawnEquipClusterMother({
        x: player.x, y: player.y - 20, angle,
        motherSpeed: d.motherSpeed,
        subSpeed: d.subSpeed,
        motherDamage: d.motherDamage * this.globalDmgMul,
        subDamage: d.subDamage * this.globalDmgMul,
        subCount: d.subCount,
        splitSec: d.splitSec,
        subSpreadDeg: d.subSpreadDeg,
        color: d.color, colorSub: d.colorSub, colorBurst: d.colorBurst,
      });
    }
  }

  // ======================================================================
  // 辅助：选择最近敌人（用于锁敌）
  // ======================================================================
  _pickTarget() {
    const p = this.game.player;
    if (!p) return null;
    const list = this.game.enemies || [];
    const boss = this.game.boss;
    let best = null, bestD = Infinity;
    // 索引循环：避免 update 中敌机被标记 dead 导致迭代异常
    for (let ei = 0, el = list.length; ei < el; ei++) {
      const e = list[ei];
      if (!e || !e.alive) continue;  // e.dead 也可，但用 alive 更严格
      const dx = e.x - p.x, dy = e.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD) { bestD = d2; best = e; }
    }
    if (boss && boss.alive) {
      const dx = boss.x - p.x, dy = boss.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD) best = boss;
    }
    return best;
  }

  _angleToNearest(player) {
    const t = this._pickTarget();
    if (!t) return -Math.PI / 2;
    return Math.atan2(t.y - player.y, t.x - player.x);
  }
}
