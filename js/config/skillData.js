/* ============================================================
   skillData.js - 10 种主动技能配置表
   玩家手动释放，消耗 SP（共享上限 100），独立 CD
   携带上限 3 个（Q / E / R）
   5 种定位：爆发 / 生存 / 控制 / 增幅 / 召唤（每种 ≥2 个）
   全局对象：ACTIVE_SKILL_DATA, ACTIVE_SKILL_POOL, ACTIVE_SKILL_CATEGORY
   ============================================================ */

// 定位枚举（用于互斥规则：同属增幅类不可叠加，后者覆盖前者）
const ACTIVE_SKILL_CATEGORY = {
  BURST:  "burst",   // 清屏爆发
  SURVIVE:"survive", // 生存保命
  CONTROL:"control", // 控制干扰
  BUFF:   "buff",    // 状态增幅（互斥：后释放覆盖前）
  SUMMON: "summon",  // 战术召唤
};

const ACTIVE_SKILL_DATA = {
  // ====================================================================
  // 技能 1：天罚·万象轰炸  - 清屏爆发
  // ====================================================================
  judgment: {
    id: "judgment",
    name: "天罚·万象轰炸",
    short: "天罚",
    category: ACTIVE_SKILL_CATEGORY.BURST,
    unlockWave: 20,
    color: "#FF3366",
    glyph: "💥",

    spCost: 80,
    cdSec: 45,

    // 释放效果
    clearNormalEnemies: true,    // 清除普通敌人（一击必杀）
    bossDamage: 3000,            // 对 Boss 造成固定伤害
    radius: 9999,                // 全屏
    durationSec: 1.2,            // 特效持续时间（展示用）

    // 3 技能共存规则
    canStackWithOthers: true,
    conflictCategory: null,      // 无冲突
  },

  // ====================================================================
  // 技能 2：星陨·连续轰炸  - 清屏爆发
  // ====================================================================
  meteor: {
    id: "meteor",
    name: "星陨·连续轰炸",
    short: "星陨",
    category: ACTIVE_SKILL_CATEGORY.BURST,
    unlockWave: 15,
    color: "#FF9922",
    glyph: "☄",

    spCost: 60,
    cdSec: 30,

    meteorCount: 10,
    perMeteorDamage: 500,
    blastRadius: 60,
    durationSec: 2.5,            // 10 颗陨石落下总时长

    canStackWithOthers: true,
    conflictCategory: null,
  },

  // ====================================================================
  // 技能 3：绝对护盾  - 生存保命
  // ====================================================================
  absoluteshield: {
    id: "absoluteshield",
    name: "绝对护盾",
    short: "护盾",
    category: ACTIVE_SKILL_CATEGORY.SURVIVE,
    unlockWave: 0,
    color: "#39FF14",
    glyph: "🛡",

    spCost: 50,
    cdSec: 40,

    invincibilitySec: 5,         // 5 秒无敌（吸收所有伤害）

    canStackWithOthers: true,    // 可与狂暴、控制同时开启
    conflictCategory: null,
  },

  // ====================================================================
  // 技能 4：时空回溯  - 生存保命
  // ====================================================================
  timerewind: {
    id: "timerewind",
    name: "时空回溯",
    short: "回溯",
    category: ACTIVE_SKILL_CATEGORY.SURVIVE,
    unlockWave: 10,
    color: "#00FFFF",
    glyph: "⏪",

    spCost: 40,
    cdSec: 35,

    rewindSec: 3,                // 回到 3 秒前位置与血量
    clearDebuff: true,           // 清除所有 debuff

    canStackWithOthers: true,
    conflictCategory: null,
  },

  // ====================================================================
  // 技能 5：EMP 磁暴  - 控制干扰
  // ====================================================================
  emp: {
    id: "emp",
    name: "EMP磁暴",
    short: "EMP",
    category: ACTIVE_SKILL_CATEGORY.CONTROL,
    unlockWave: 8,
    color: "#4FC3F7",
    glyph: "⚡",

    spCost: 45,
    cdSec: 25,

    stunRadius: 300,
    stunSec: 3,                  // 敌人无法移动/攻击
    damagePerSec: 0,

    canStackWithOthers: true,
    conflictCategory: null,
  },

  // ====================================================================
  // 技能 6：黑洞牵引  - 控制干扰
  // ====================================================================
  blackhole: {
    id: "blackhole",
    name: "黑洞牵引",
    short: "黑洞",
    category: ACTIVE_SKILL_CATEGORY.CONTROL,
    unlockWave: 12,
    color: "#9C27B0",
    glyph: "🌀",

    spCost: 55,
    cdSec: 30,

    pullRadius: 200,
    durationSec: 5,
    damagePerSec: 100,           // 持续拉扯伤害

    canStackWithOthers: true,
    conflictCategory: null,
  },

  // ====================================================================
  // 技能 7：狂暴觉醒  - 状态增幅（与极速过载互斥）
  // ====================================================================
  berserk: {
    id: "berserk",
    name: "狂暴觉醒",
    short: "狂暴",
    category: ACTIVE_SKILL_CATEGORY.BUFF,
    unlockWave: 18,
    color: "#FF0040",
    glyph: "🔥",

    spCost: 70,
    cdSec: 50,

    durationSec: 10,
    dmgMul: 2.0,                 // 所有装备伤害 ×2
    fireRateMul: 1.5,            // 射速 ×1.5

    // 增幅类不可叠加；后释放覆盖前
    canStackWithOthers: true,    // 可与其他类（非增幅）共存
    conflictCategory: ACTIVE_SKILL_CATEGORY.BUFF,
  },

  // ====================================================================
  // 技能 8：极速过载  - 状态增幅（与狂暴互斥）
  // ====================================================================
  overclock: {
    id: "overclock",
    name: "极速过载",
    short: "过载",
    category: ACTIVE_SKILL_CATEGORY.BUFF,
    unlockWave: 16,
    color: "#FFD700",
    glyph: "⚡",

    spCost: 60,
    cdSec: 45,

    durationSec: 8,
    clearCooldowns: true,        // 开启瞬间清零所有装备冷却/过热
    fireRateMul: 2.0,            // 射速 ×2

    canStackWithOthers: true,
    conflictCategory: ACTIVE_SKILL_CATEGORY.BUFF, // 与狂暴后释放者生效
  },

  // ====================================================================
  // 技能 9：战术空袭  - 战术召唤
  // ====================================================================
  airstrike: {
    id: "airstrike",
    name: "战术空袭",
    short: "空袭",
    category: ACTIVE_SKILL_CATEGORY.SUMMON,
    unlockWave: 14,
    color: "#00BCD4",
    glyph: "✈",

    spCost: 65,
    cdSec: 40,

    summonCount: 3,
    perDps: 200,                 // 每架协战机 200 DPS
    durationSec: 15,

    canStackWithOthers: true,
    conflictCategory: null,
  },

  // ====================================================================
  // 技能 10：机甲形态  - 战术召唤
  // ====================================================================
  mechform: {
    id: "mechform",
    name: "机甲形态",
    short: "机甲",
    category: ACTIVE_SKILL_CATEGORY.SUMMON,
    unlockWave: 25,
    color: "#FF00AA",
    glyph: "🤖",

    spCost: 90,
    cdSec: 60,

    durationSec: 12,
    equipDmgMul: 2,              // 装备伤害双倍
    autoLock: true,              // 自动锁定敌人（所有发射追踪最近目标）
    // 变身期间，狂暴/过载等增幅类技能无效（已自带增幅）
    suppressBuffSkills: true,

    canStackWithOthers: true,
    conflictCategory: null,
  },
};

const ACTIVE_SKILL_POOL = Object.keys(ACTIVE_SKILL_DATA);

// 按定位分组（UI 展示）
const ACTIVE_SKILL_BY_CATEGORY = {
  burst:   ACTIVE_SKILL_POOL.filter(k => ACTIVE_SKILL_DATA[k].category === ACTIVE_SKILL_CATEGORY.BURST),
  survive: ACTIVE_SKILL_POOL.filter(k => ACTIVE_SKILL_DATA[k].category === ACTIVE_SKILL_CATEGORY.SURVIVE),
  control: ACTIVE_SKILL_POOL.filter(k => ACTIVE_SKILL_DATA[k].category === ACTIVE_SKILL_CATEGORY.CONTROL),
  buff:    ACTIVE_SKILL_POOL.filter(k => ACTIVE_SKILL_DATA[k].category === ACTIVE_SKILL_CATEGORY.BUFF),
  summon:  ACTIVE_SKILL_POOL.filter(k => ACTIVE_SKILL_DATA[k].category === ACTIVE_SKILL_CATEGORY.SUMMON),
};

// 全局 SP 上限（玩家最多 100；可通过商店强化+5 最多外 50）
const ACTIVE_SKILL_SP_MAX_BASE = 100;
const ACTIVE_SKILL_SP_MAX_EXTRA_LIMIT = 50;

// 玩家携带上限
const ACTIVE_SKILL_MAX_SLOTS = 3;
const ACTIVE_SKILL_SLOT_KEYS = ["Q", "E", "R"]; // 映射到键盘
