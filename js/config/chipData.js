/* ============================================================
   chipData.js - 芯片（被动升级卡）配置表
   与主动技能 ACTIVE_SKILL_DATA 不同：芯片是3选1升级卡，永久生效
   SkillSystem 里的 SKILL_DATA / SKILL_POOL 本是指这组配置
   全局对象：SKILL_DATA, SKILL_POOL, SKILL_BY_CAT
   ============================================================ */

const SKILL_DATA = {
  // ============================================================
  // 红色系：攻击强化
  // ============================================================
  damageUp: {
    id: "damageUp", name: "火力强化", cat: "red",
    emoji: "🔥", max: 5,
    desc: "玩家子弹伤害 +15% / 级",
    apply(p, lv) { p.bulletDamageMul += 0.15 * lv; },
  },
  fireRateUp: {
    id: "fireRateUp", name: "极速射击", cat: "red",
    emoji: "⚡", max: 5,
    desc: "玩家射速 +10% / 级",
    apply(p, lv) { p.fireRateMul *= Math.pow(1 - 0.09, lv); },
  },
  bossHunter: {
    id: "bossHunter", name: "Boss猎手", cat: "red",
    emoji: "🎯", max: 4,
    desc: "对 Boss 伤害 +25% / 级",
    apply(p, lv) { p.bossDmgMul += 0.25 * lv; },
  },
  pierceShot: {
    id: "pierceShot", name: "贯穿子弹", cat: "red",
    emoji: "🗡", max: 3,
    desc: "子弹贯穿 +1 / 级",
    apply(p, lv) { p.pierce += lv; },
  },
  explosiveShot: {
    id: "explosiveShot", name: "爆裂弹", cat: "red",
    emoji: "💥", max: 2,
    desc: "击中敌人 30% 概率爆裂",
    apply(p, lv) { if (lv >= 1) p.explosive = true; },
  },
  multiShot: {
    id: "multiShot", name: "多重射击", cat: "red",
    emoji: "🎶", max: 4,
    desc: "玩家子弹额外 +1 / 级",
    apply(p, lv) { p.extraBullets += lv; },
  },

  // ============================================================
  // 蓝色系：生存保命
  // ============================================================
  hpUp: {
    id: "hpUp", name: "装甲强化", cat: "blue",
    emoji: "🛡", max: 5,
    desc: "最大 HP +50 / 级",
    apply(p, lv) { p.maxHpBonus += 50 * lv; },
  },
  dodgeChance: {
    id: "dodgeChance", name: "极限闪避", cat: "blue",
    emoji: "💨", max: 3,
    desc: "受击时 8% 概率免疫 / 级",
    apply(p, lv) { p.dodgeChance += 0.08 * lv; },
  },
  damageReduce: {
    id: "damageReduce", name: "纳米装甲", cat: "blue",
    emoji: "🧱", max: 4,
    desc: "受伤减少 -7% / 级",
    apply(p, lv) { p.damageReduce *= Math.pow(0.93, lv); },
  },
  startShield: {
    id: "startShield", name: "护盾发生器", cat: "blue",
    emoji: "🔰", max: 3,
    desc: "开局护盾 +1 / 级",
    apply(p, lv) { p.startShield += lv; },
  },
  regen: {
    id: "regen", name: "纳米修复", cat: "blue",
    emoji: "💚", max: 3,
    desc: "每 30 秒恢复 10% 最大 HP / 级",
    apply(p, lv) { if (lv >= 1) { p.regen = true; p.regenAmount = 0.1 * lv; } },
  },
  revive: {
    id: "revive", name: "复活协议", cat: "blue",
    emoji: "💫", max: 2,
    desc: "每局可复活 +1 / 级（50% HP）",
    apply(p, lv) { p.revives += lv; },
  },

  // ============================================================
  // 黄色系：经济/辅助
  // ============================================================
  magnetRange: {
    id: "magnetRange", name: "磁吸范围", cat: "yellow",
    emoji: "🧲", max: 4,
    desc: "拾取范围 +40% / 级",
    apply(p, lv) { p.magnetMul *= Math.pow(1.4, lv); },
  },
  coinMultiplier: {
    id: "coinMultiplier", name: "金币倍率", cat: "yellow",
    emoji: "💰", max: 4,
    desc: "金币/积分获取 +20% / 级",
    apply(p, lv) { p.coinMul *= Math.pow(1.2, lv); },
  },
  expMultiplier: {
    id: "expMultiplier", name: "经验加成", cat: "yellow",
    emoji: "⭐", max: 4,
    desc: "经验获取 +20% / 级",
    apply(p, lv) { p.expMul *= Math.pow(1.2, lv); },
  },
  skillCdReduce: {
    id: "skillCdReduce", name: "超频冷却", cat: "yellow",
    emoji: "⏱", max: 4,
    desc: "主动技能冷却 -8% / 级",
    apply(p, lv) { p.skillCdMul *= Math.pow(0.92, lv); },
  },
  bonusWingmen: {
    id: "bonusWingmen", name: "僚机编队", cat: "yellow",
    emoji: "✈️", max: 3,
    desc: "额外僚机 +1 / 级（自动副炮）",
    apply(p, lv) { p.bonusWingmen += lv; },
  },
  slowField: {
    id: "slowField", name: "时间减速", cat: "yellow",
    emoji: "⏳", max: 3,
    desc: "所有敌机移速 -10% / 级",
    apply(p, lv) { p.enemySlow *= Math.pow(0.9, lv); },
  },

  // ============================================================
  // 稀有：合体技
  // ============================================================
  luckyCrit: {
    id: "luckyCrit", name: "幸运暴击", cat: "yellow",
    emoji: "🍀", max: 3,
    desc: "子弹有 10% 概率造成双倍伤害 / 级",
    apply(p, lv) { p._critChance = (p._critChance || 0) + 0.1 * lv; if (!p._critApplied) {
        p._critApplied = true;
        const origFire = p._fire ? p._fire.bind(p) : null;
      } },
  },
  shieldAbsorb: {
    id: "shieldAbsorb", name: "护盾充能", cat: "blue",
    emoji: "🔋", max: 2,
    desc: "拾取能量球 15% 概率回 10 HP / 级",
    apply(p, lv) { p._energyHealPct = 0.15 * lv; },
  },
};

const SKILL_POOL = Object.keys(SKILL_DATA);

const SKILL_BY_CAT = {
  red:    SKILL_POOL.filter(k => SKILL_DATA[k].cat === "red"),
  blue:   SKILL_POOL.filter(k => SKILL_DATA[k].cat === "blue"),
  yellow: SKILL_POOL.filter(k => SKILL_DATA[k].cat === "yellow"),
};
