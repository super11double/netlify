/* ============================================================
   ActiveSkillSystem.js - 主动技能系统核心引擎
   功能：
     - 3 技能槽（Q/E/R）玩家最多同时装备 3 个技能
     - SP 共享能量条（上限 100；商店强化最多 +50 额外）
     - 增幅类 buff 不可叠加（后者覆盖前者）
     - 机甲形态：变身期间，所有增幅类技能无效
   全局接口：castBySlot(slot) / castById(id)
   ============================================================ */
class ActiveSkillSystem {
  constructor(game) {
    this.game = game;

    // 永久已拥有的技能 id
    this.ownedSkills = new Set();

    // 3 个技能槽；索引 0=Q 1=E 2=R，值 = skill id 或 null
    this.slots = [null, null, null];

    // 每个技能 CD 计时（按 id）
    this.cdTimers = {};

    // 能量 SP
    this.spMax = ACTIVE_SKILL_SP_MAX_BASE;
    this.sp = 0;

    // 永久强化带来的 CD 缩减倍率（1 = 不变；0.95 = 每级 -5%）
    this.globalCdMul = 1;

    // 当前激活 buff 状态（按 id → 剩余秒）
    this.activeBuffs = {};

    // 机甲形态：自带双倍 & 锁敌；压制其他增幅 buff
    this.mechActive = false;
    this.mechTimer = 0;
  }

  // ======================================================================
  // 初始化
  // ======================================================================
  resetForRun() {
    this.cdTimers = {};
    for (const id of this.slots) if (id) this.cdTimers[id] = 0;
    this.sp = 0;
    this.activeBuffs = {};
    this.mechActive = false;
    this.mechTimer = 0;
    this._applyEquipMulFromActive();
  }

  setSlots(ids /* length<=3 */) {
    this.slots = [null, null, null];
    const src = ids || [];
    for (let i = 0; i < Math.min(src.length, ACTIVE_SKILL_MAX_SLOTS); i++) {
      const id = src[i];
      if (id && (this.ownedSkills.has(id))) this.slots[i] = id;
    }
  }

  unlockSkill(id) {
    if (!ACTIVE_SKILL_DATA[id]) return false;
    this.ownedSkills.add(id);
    return true;
  }

  /** 商店强化：SP 上限永久 +N */
  addSpMax(n) {
    this.spMax = Math.min(
      ACTIVE_SKILL_SP_MAX_BASE + ACTIVE_SKILL_SP_MAX_EXTRA_LIMIT,
      this.spMax + n
    );
  }
  /** 商店强化：全局 CD 缩减（乘法）*/
  applyGlobalCdMul(mul) {
    this.globalCdMul = Math.max(0.25, this.globalCdMul * mul);
  }

  // ======================================================================
  // 能量输入（玩家击杀/道具/时间自然回复）
  // ======================================================================
  addSp(amount) {
    this.sp = Math.min(this.spMax, this.sp + amount);
  }

  // ======================================================================
  // 主循环
  // ======================================================================
  update(dt) {
    // 冷却计时
    for (const id of Object.keys(this.cdTimers)) {
      this.cdTimers[id] = Math.max(0, this.cdTimers[id] - dt);
    }
    // buff 持续时间
    for (const id of Object.keys(this.activeBuffs)) {
      this.activeBuffs[id] -= dt;
      if (this.activeBuffs[id] <= 0) {
        delete this.activeBuffs[id];
        this._applyEquipMulFromActive();
      }
    }
    // 机甲形态计时
    if (this.mechActive) {
      this.mechTimer -= dt;
      if (this.mechTimer <= 0) {
        this.mechActive = false;
        this._applyEquipMulFromActive();
      }
    }
    // 轻微 SP 自动回复（每 3 秒 +1）
    this._spRegenTimer = (this._spRegenTimer || 0) + dt;
    if (this._spRegenTimer >= 3) {
      this._spRegenTimer -= 3;
      this.addSp(1);
    }
  }

  // ======================================================================
  // 触发：按键
  // ======================================================================
  /** 按槽位（0 Q / 1 E / 2 R）*/
  castBySlot(slot) {
    const id = this.slots[slot];
    if (!id) return false;
    return this.castById(id);
  }

  /** 按技能 id 触发 */
  castById(id) {
    const def = ACTIVE_SKILL_DATA[id];
    if (!def) return false;
    if (!this.slots.includes(id)) return false;
    // CD
    if ((this.cdTimers[id] || 0) > 0) return false;
    // SP
    if (this.sp < def.spCost) return false;
    // 增幅类技能：若机甲形态激活 → 增幅类无效
    if (this.mechActive && def.suppressBuffSkills !== true && def.category === ACTIVE_SKILL_CATEGORY.BUFF) {
      return false;
    }
    this.sp -= def.spCost;
    this.cdTimers[id] = def.cdSec * this.globalCdMul;

    // 增幅类：后覆盖前 → 清除同类（buff）activeBuffs
    if (def.conflictCategory === ACTIVE_SKILL_CATEGORY.BUFF) {
      // 删除所有 BUFF 类正在生效
      for (const bid of Object.keys(this.activeBuffs)) {
        const bd = ACTIVE_SKILL_DATA[bid];
        if (bd && bd.category === ACTIVE_SKILL_CATEGORY.BUFF) delete this.activeBuffs[bid];
      }
    }
    this.activeBuffs[id] = def.durationSec || 0.01;

    // 根据定位实际施放效果
    this._castExecute(def);
    return true;
  }

  // ======================================================================
  // 各类技能实际效果（委派 game 层）
  // ======================================================================
  _castExecute(def) {
    const g = this.game;
    switch (def.category) {
      case ACTIVE_SKILL_CATEGORY.BURST:
        this._castBurst(def); break;
      case ACTIVE_SKILL_CATEGORY.SURVIVE:
        this._castSurvive(def); break;
      case ACTIVE_SKILL_CATEGORY.CONTROL:
        this._castControl(def); break;
      case ACTIVE_SKILL_CATEGORY.BUFF:
        this._applyEquipMulFromActive(); break;
      case ACTIVE_SKILL_CATEGORY.SUMMON:
        this._castSummon(def); break;
    }
    if (g.ui) g.ui.notifySkill(def);
  }

  _castBurst(def) {
    const g = this.game;
    if (def.id === "judgment") {
      // 全屏爆炸：清普通 + Boss 扣 3000
      g.burstJudgment && g.burstJudgment(def.bossDamage, def.durationSec, def.clearNormalEnemies);
    } else if (def.id === "meteor") {
      g.burstMeteor && g.burstMeteor(def.meteorCount, def.perMeteorDamage, def.blastRadius, def.durationSec);
    }
  }

  _castSurvive(def) {
    const g = this.game;
    const p = g.player;
    if (def.id === "absoluteshield") {
      if (p) {
        p.invincibleTimer = Math.max(p.invincibleTimer || 0, def.invincibilitySec * 1000);
      }
      g.overlayShield && g.overlayShield(def.invincibilitySec);
    } else if (def.id === "timerewind") {
      g.doTimeRewind && g.doTimeRewind(def.rewindSec, def.clearDebuff);
    }
  }

  _castControl(def) {
    const g = this.game;
    const p = g.player;
    const cx = p ? p.x : CONFIG.WIDTH / 2;
    const cy = p ? p.y : CONFIG.HEIGHT / 2;
    if (def.id === "emp") {
      g.applyEmp && g.applyEmp(cx, cy, def.stunRadius, def.stunSec);
    } else if (def.id === "blackhole") {
      g.spawnBlackhole && g.spawnBlackhole(cx, cy - 100, def.pullRadius, def.durationSec, def.damagePerSec);
    }
  }

  _castSummon(def) {
    const g = this.game;
    if (def.id === "airstrike") {
      g.summonAirstrike && g.summonAirstrike(def.summonCount, def.perDps, def.durationSec);
    } else if (def.id === "mechform") {
      this.mechActive = true;
      this.mechTimer = def.durationSec;
      // 变身时清除所有其他增幅 buff
      for (const bid of Object.keys(this.activeBuffs)) {
        const bd = ACTIVE_SKILL_DATA[bid];
        if (bd && bd.category === ACTIVE_SKILL_CATEGORY.BUFF) delete this.activeBuffs[bid];
      }
      this._applyEquipMulFromActive();
      g.enterMechForm && g.enterMechForm(def.durationSec, def.equipDmgMul, def.autoLock);
    }
  }

  /** 根据当前激活 buff 重新计算 EquipSystem 全局倍率 */
  _applyEquipMulFromActive() {
    if (!this.game.equips) return;
    let dmg = 1, fireRate = 1, autoLock = false;

    // 机甲形态：强制装备伤害×2 + 自动锁定
    if (this.mechActive) {
      const def = ACTIVE_SKILL_DATA.mechform;
      dmg *= def.equipDmgMul;
      if (def.autoLock) autoLock = true;
    } else {
      // 普通增幅 buff 应用（非机甲）
      for (const id of Object.keys(this.activeBuffs)) {
        const bd = ACTIVE_SKILL_DATA[id];
        if (!bd || bd.category !== ACTIVE_SKILL_CATEGORY.BUFF) continue;
        if (bd.dmgMul) dmg *= bd.dmgMul;
        if (bd.fireRateMul) fireRate *= bd.fireRateMul;
        if (bd.clearCooldowns) {
          // 极速过载：开瞬间清零装备计时
          this.game.equips && this._resetEquipTimers();
          bd.clearCooldowns = false; // 一次性
          this._resetOverclockFlag = id;
        }
      }
    }
    this.game.equips.setGlobalMul({ dmg, fireRate, autoLock });
  }

  _resetEquipTimers() {
    const eq = this.game.equips;
    if (!eq) return;
    for (const id of eq.equippedIds) {
      const r = eq.runtime[id];
      if (!r) continue;
      r.fireTimer = 0;
      r.cdTimer = 0;
      // 激光过热清零
      if (id === "laser") { r.heat = 0; r.overheated = false; r.overheatTimer = 0; }
      // 狙击冷却清零
      if (id === "sniper") { r.cooling = false; r.cdTimer = 0; }
      // 导弹装填完成
      if (id === "missile") {
        const d = EQUIP_DATA.missile;
        r.reloading = false; r.reloadTimer = 0; r.magazine = d.magazine;
      }
    }
  }

  // ======================================================================
  // 状态查询（渲染 UI 用）
  // ======================================================================
  /** 返回每个技能槽（Q/E/R）的状态：{id, name, ready, cdPct, spEnough} */
  slotStates() {
    const out = [];
    for (let i = 0; i < ACTIVE_SKILL_MAX_SLOTS; i++) {
      const id = this.slots[i];
      if (!id) { out.push(null); continue; }
      const def = ACTIVE_SKILL_DATA[id];
      const cd = this.cdTimers[id] || 0;
      const cdPct = def.cdSec > 0 ? Math.max(0, Math.min(1, cd / (def.cdSec * this.globalCdMul))) : 0;
      out.push({
        slot: i, key: ACTIVE_SKILL_SLOT_KEYS[i],
        id, name: def.name, color: def.color, glyph: def.glyph,
        spCost: def.spCost, cdSec: def.cdSec,
        cdNow: cd, cdPct,
        ready: cd <= 0 && this.sp >= def.spCost,
        active: !!this.activeBuffs[id],
      });
    }
    return out;
  }
  spPct() { return this.spMax > 0 ? this.sp / this.spMax : 0; }
}
