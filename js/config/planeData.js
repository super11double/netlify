/* ============================================================
   planeData.js - 战机属性配置表（增强版：每架战机独立外形定义）
   优化决策：MVP 提供 3 架初始战机，其余通过解锁条件逐步开放
   全局对象：PLANE_DATA
   ============================================================ */
const PLANE_DATA = {
  // F-01 均衡型（默认）
  F01: {
    id: "F01", name: "雷霆先锋", role: "均衡型",
    color: "#00f0ff", accent: "#39ff14",
    maxHp: 100, speed: 5, fireRate: 150,
    bulletDamage: 10, bulletSpeed: 12,
    bulletType: "double_scatter",
    hitbox: 12,
    skill: "thunder_strike",
    skillCd: 20000, skillCost: 100,
    unlock: "default", unlockDesc: "默认拥有",
    desc: "标准双发散射，性能均衡无短板。",
    // 外形定义：战机主题 + 机翼参数 + 尾焰数
    shape: {
      style: "classic",    // 经典三角翼
      width: 30, height: 34,
      wingOffset: 8, engineCount: 2,
      noseLength: 10, tailLength: 6,
      cockpitColor: "#ffffff",
      hasStrakes: true,    // 边条翼
    },
  },
  // F-02 高速型
  F02: {
    id: "F02", name: "暗影刺客", role: "高速型",
    color: "#b400ff", accent: "#ff00aa",
    maxHp: 70, speed: 6.5, fireRate: 110,
    bulletDamage: 13, bulletSpeed: 14,
    bulletType: "single_high",
    hitbox: 9,
    skill: "phase_dash",
    skillCd: 16000, skillCost: 100,
    unlock: "chapter2", unlockDesc: "通关第2章",
    desc: "单发高伤子弹，移速快、判定小，适合走位流。",
    shape: {
      style: "sleek",      // 细长尖锐
      width: 24, height: 40,
      wingOffset: 6, engineCount: 2,
      noseLength: 16, tailLength: 8,
      cockpitColor: "#ff00aa",
      hasStrakes: false,
      forwardSweep: true,  // 前掠翼
    },
  },
  // F-03 重火力型
  F03: {
    id: "F03", name: "重装堡垒", role: "重火力型",
    color: "#ff6b00", accent: "#fff200",
    maxHp: 140, speed: 3.8, fireRate: 200,
    bulletDamage: 14, bulletSpeed: 10,
    bulletType: "quad_scatter",
    hitbox: 16,
    skill: "overload_cannon",
    skillCd: 24000, skillCost: 100,
    unlock: "chapter4", unlockDesc: "通关第4章",
    desc: "四发散射，高血量厚装甲，移动慢但输出猛。",
    shape: {
      style: "heavy",      // 厚重装甲
      width: 38, height: 30,
      wingOffset: 10, engineCount: 4,
      noseLength: 6, tailLength: 4,
      cockpitColor: "#fff200",
      hasStrakes: true,
      hasArmorPlate: true, // 装甲板装饰
      cannonSize: 3,       // 炮管数量
    },
  },
  // F-04 技巧型（隐藏）
  F04: {
    id: "F04", name: "量子幽灵", role: "技巧型",
    color: "#39ff14", accent: "#00f0ff",
    maxHp: 80, speed: 5.5, fireRate: 160,
    bulletDamage: 9, bulletSpeed: 13,
    bulletType: "triple_homing",
    hitbox: 10,
    dodgeChance: 0.15,
    skill: "quantum_phase",
    skillCd: 18000, skillCost: 100,
    unlock: "endless10min", unlockDesc: "无尽模式存活10分钟",
    desc: "三发追踪弹，15%概率闪避伤害。",
    shape: {
      style: "phantom",    // 幽灵/科幻风
      width: 28, height: 34,
      wingOffset: 10, engineCount: 3,
      noseLength: 12, tailLength: 6,
      cockpitColor: "#00f0ff",
      hasStrakes: false,
      deltaWing: true,     // 三角翼
      hasRingWing: true,   // 环形翼装饰
    },
  },
  // F-05 狂暴型（隐藏）
  F05: {
    id: "F05", name: "灭世神罚", role: "狂暴型",
    color: "#ff003c", accent: "#fff200",
    maxHp: 110, speed: 4.5, fireRate: 130,
    bulletDamage: 12, bulletSpeed: 12,
    bulletType: "hex_laser",
    hitbox: 12,
    skill: "annihilation",
    skillCd: 22000, skillCost: 100,
    unlock: "allLevelS", unlockDesc: "S级通关所有关卡",
    desc: "六发散射+激光副武器，全能输出。",
    shape: {
      style: "berserker",  // 狂暴/火力全开
      width: 34, height: 36,
      wingOffset: 9, engineCount: 4,
      noseLength: 12, tailLength: 6,
      cockpitColor: "#fff200",
      hasStrakes: true,
      multiCannon: true,   // 多管炮
      spineDetail: true,   // 背脊细节
    },
  },
  // F-06 终极型（隐藏）
  F06: {
    id: "F06", name: "虚空主宰", role: "终极型",
    color: "#ff00aa", accent: "#b400ff",
    maxHp: 130, speed: 5, fireRate: 120,
    bulletDamage: 11, bulletSpeed: 13,
    bulletType: "storm_blackhole",
    hitbox: 11,
    skill: "void_collapse",
    skillCd: 20000, skillCost: 100,
    unlock: "roguelike_clear", unlockDesc: "远征模式通关1次",
    desc: "全屏弹幕+黑洞技能，终极形态。",
    shape: {
      style: "void",       // 终极虚空风格
      width: 36, height: 38,
      wingOffset: 11, engineCount: 5,
      noseLength: 14, tailLength: 8,
      cockpitColor: "#b400ff",
      hasStrakes: true,
      hasAura: true,       // 能量光环
      crystalCore: true,   // 水晶核心
    },
  },
};

// 必杀技效果定义
const SKILL_DEFS = {
  thunder_strike:   { name: "雷霆突袭", type: "clear",   damage: 200, desc: "全屏清弹，并对所有敌机造成大量伤害" },
  phase_dash:       { name: "相位冲刺", type: "dash",    damage: 150, desc: "短暂无敌并向前冲刺，路径敌人受伤" },
  overload_cannon:  { name: "过载炮击", type: "beam",    damage: 400, desc: "发射贯穿屏幕的高能激光束" },
  quantum_phase:    { name: "量子相位", type: "invincible", damage: 0, desc: "5秒无敌，闪避一切伤害" },
  annihilation:     { name: "湮灭风暴", type: "storm",  damage: 350, desc: "释放毁灭弹幕风暴清扫全屏" },
  void_collapse:    { name: "虚空坍缩", type: "blackhole", damage: 500, desc: "召唤黑洞吸引并吞噬敌机" },
};

// 战机解锁顺序（仓库展示用）
const PLANE_ORDER = ["F01", "F02", "F03", "F04", "F05", "F06"];
