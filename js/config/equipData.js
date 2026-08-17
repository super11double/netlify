/* ============================================================
   equipData.js - 10 种攻击装备配置表
   全部为自动攻击高级武器，独立计时/过热/弹匣
   10 件可同时挂载，弹幕共存，伤害加算，互不覆盖
   全局对象：EQUIP_DATA, EQUIP_POOL
   ============================================================ */

const EQUIP_DATA = {
  // ====================================================================
  // 装备 1：等离子直线激光
  // 机制：持续直线光束；过热 5 秒 / 冷却 3 秒；每帧 8 点伤害
  // ====================================================================
  laser: {
    id: "laser",
    name: "等离子直线激光",
    short: "激光",
    tier: "mid",
    unlockWave: 0,
    color: "#00E5FF",
    colorCore: "#FFFFFF",
    colorHit: "#FF8800",
    width: 8,

    // 射击 / 伤害
    dpsPerFrame: 8,          // 持续激光每帧伤害
    heatPerSec: 20,          // 每秒热量积累 (0~100)
    overheatThreshold: 100,  // 过热阈值
    overheatCooldownSec: 3,  // 强制冷却时长
    continuousSec: 5,        // 最大连续照射时间

    // 渲染分层提示 (layer 0 装备弹幕层)
    layer: 0,
    zIndex: 5,

    // 运行时规则（与其他 9 件并行）
    coexist: "独立光束图层 + 独立过热计时器，不占用子弹对象池",
  },

  // ====================================================================
  // 装备 2：追踪导弹
  // 机制：弧线追踪；弹匣 6 发 / 1.2 秒/发；打空装填 4 秒
  // ====================================================================
  missile: {
    id: "missile",
    name: "追踪导弹",
    short: "导弹",
    tier: "mid",
    unlockWave: 0,
    color: "#FF5522",
    colorTrail: "#FFDD44",
    colorExplosion: "#FFAA22",

    directDamage: 120,
    splashRadius: 40,
    splashFalloff: 0.5,      // 边缘伤害倍率
    turnRate: 3,             // rad/s，转向灵敏度
    speed: 400,              // px/s
    fireIntervalSec: 1.2,
    magazine: 6,
    reloadSec: 4,
    maxAlive: 6,             // 场上最多并存 6 枚

    layer: 0,
    zIndex: 4,
    coexist: "独立导弹实体池，不与其他子弹共用",
  },

  // ====================================================================
  // 装备 3：范围炸弹
  // 机制：抛物线抛射；爆炸半径 80px；2.5 秒/发
  // ====================================================================
  bomb: {
    id: "bomb",
    name: "范围炸弹",
    short: "炸弹",
    tier: "low",
    unlockWave: 5,
    color: "#FF3366",
    colorShock: "#FF99BB",
    colorSmoke: "#666666",

    centerDamage: 250,
    edgeDamage: 80,
    blastRadius: 80,
    gravity: 200,
    arcHeight: 200,
    flightSec: 1.2,
    fireIntervalSec: 2.5,

    layer: 0,
    zIndex: 3,
    coexist: "独立爆炸 AOE 判定，与其他范围伤害叠加",
  },

  // ====================================================================
  // 装备 4：贯穿电磁炮
  // 机制：高速直线贯穿；2 秒/发；蓄力 0.5 秒；每穿透 1 敌衰减 10%
  // ====================================================================
  railgun: {
    id: "railgun",
    name: "贯穿电磁炮",
    short: "电磁炮",
    tier: "mid",
    unlockWave: 10,
    color: "#00FF88",
    colorArc: "#66EEFF",
    colorLightning: "#4488FF",

    damage: 180,
    pierceFalloff: 0.9,      // 每穿透 1 敌 ×0.9
    chargeSec: 0.5,
    speed: 1200,             // px/s
    fireIntervalSec: 2,
    width: 10,

    layer: 0,
    zIndex: 6,
    coexist: "独立贯穿判定，不干扰其他子弹飞行",
  },

  // ====================================================================
  // 装备 5：散射霰弹
  // 机制：扇形 5 发 30°；0.8 秒/发；射程 400px
  // ====================================================================
  shotgun: {
    id: "shotgun",
    name: "散射霰弹",
    short: "霰弹",
    tier: "low",
    unlockWave: 0,
    color: "#FFD700",
    colorTrail: "#FFEE99",

    pelletCount: 5,
    spreadDeg: 30,
    pelletDamage: 75,           // 强化：45 → 75（前期对Boss不至于刮痧）
    speed: 600,
    maxRange: 400,
    fireIntervalSec: 0.6,      // 强化：0.8 → 0.6（射速+33%）
    pelletSize: 4,

    layer: 0,
    zIndex: 2,
    coexist: "独立扇形弹组，与直线弹道并行互不影响",
  },

  // ====================================================================
  // 装备 6：浮游炮·召唤
  // 机制：召唤 2 架浮游炮环绕自动射击；存在 20 秒 / 召唤 CD 8 秒
  // ====================================================================
  drone: {
    id: "drone",
    name: "浮游炮·召唤",
    short: "浮游炮",
    tier: "high",
    unlockWave: 15,
    color: "#E6F1FF",
    colorCore: "#00A8FF",
    colorBullet: "#00FFFF",

    droneCount: 2,
    orbitRadius: 70,
    orbitSpeed: 2,
    pelletDamage: 30,
    speed: 500,
    fireIntervalSec: 0.5,
    lifetimeSec: 20,
    summonCooldownSec: 8,

    layer: 0,
    zIndex: 7,
    coexist: "浮游炮为独立实体，子弹独立对象池/独立判定",
  },

  // ====================================================================
  // 装备 7：弹射链球
  // 机制：链球弹射 3 次；3 秒/发；持续 2 秒
  // ====================================================================
  chainball: {
    id: "chainball",
    name: "弹射链球",
    short: "链球",
    tier: "low",
    unlockWave: 8,
    color: "#2A2A2A",
    colorChain: "#CCCCCC",
    colorSpark: "#FFCC33",

    bounceCount: 3,
    damagePerHit: 100,
    speed: 450,
    lifetimeSec: 2,
    radius: 14,
    fireIntervalSec: 3,

    layer: 0,
    zIndex: 5,
    coexist: "独立物理弹道，弹射判定不干扰其他子弹",
  },

  // ====================================================================
  // 装备 8：蓄力狙击炮
  // 机制：蓄力后瞬发（无飞行时间）；蓄 1s=400 / 2s=800 / 3s=1200
  // ====================================================================
  sniper: {
    id: "sniper",
    name: "蓄力狙击炮",
    short: "狙击",
    tier: "mid",
    unlockWave: 12,
    color: "#FF0040",
    colorCharge: "#FF4488",

    chargeLevelDamage: [0, 400, 800, 1200], // 蓄 0/1/2/3 秒
    chargeMaxSec: 3,
    fireCooldownSec: 1,
    instant: true,          // 无飞行时间，射线判定

    layer: 0,
    zIndex: 9,
    coexist: "独立蓄力计时器；蓄力期间其他装备照常射击",
  },

  // ====================================================================
  // 装备 9：近身切割环
  // 机制：周身 360° 双刀片对转；半径 60px；每 0.1 秒判定
  // ====================================================================
  bladering: {
    id: "bladering",
    name: "近身切割环",
    short: "切割环",
    tier: "low",
    unlockWave: 6,
    color: "#F2F2F2",
    colorRing: "#4FC3F7",

    radius: 60,
    damagePerTick: 15,
    tickIntervalSec: 0.1,   // 每 0.1 秒判定一次
    rotationSpeed: 8,       // rad/s
    bladeCount: 2,

    layer: 0,
    zIndex: 10,
    coexist: "独立判定环，不占用子弹；不影响远程弹道",
  },

  // ====================================================================
  // 装备 10：子母弹
  // 机制：母弹飞行中分裂 5 发；1.5 秒/发
  // ====================================================================
  cluster: {
    id: "cluster",
    name: "子母弹",
    short: "子母弹",
    tier: "mid",
    unlockWave: 9,
    color: "#1565C0",
    colorSub: "#4FC3F7",
    colorBurst: "#90CAF9",

    motherDamage: 100,
    subCount: 5,
    subDamage: 40,
    motherSpeed: 500,
    subSpeed: 450,
    splitSec: 0.5,          // 母弹飞行多久后分裂
    fireIntervalSec: 1.5,
    subSpreadDeg: 60,

    layer: 0,
    zIndex: 3,
    coexist: "独立母弹分裂逻辑，子弹出现在独立帧",
  },
};

// 装备池数组（用于商店、宝箱、循环）
const EQUIP_POOL = Object.keys(EQUIP_DATA);

// 按档位（低端 = low，中端 = mid，高端 = high）
const EQUIP_BY_TIER = {
  low:  EQUIP_POOL.filter(k => EQUIP_DATA[k].tier === "low"),
  mid:  EQUIP_POOL.filter(k => EQUIP_DATA[k].tier === "mid"),
  high: EQUIP_POOL.filter(k => EQUIP_DATA[k].tier === "high"),
};

// 默认兜底装备（拆卸至 0 件时强制装备）
const EQUIP_DEFAULT_FALLBACK = "shotgun";
