/* ============================================================
   enemyData.js - 普通敌机配置表（增强版）
   全局对象：ENEMY_DATA
   通过 type 字段统一驱动一个通用 Enemy 类
   新增：精英单位、追踪无人机、狙击手、支援舰
   ============================================================ */
const ENEMY_DATA = {
  // 🟠 小型侦察机
  scout: {
    type: "scout", name: "侦察机",
    hp: 20, score: 100, exp: 8, coin: 5,
    width: 26, height: 26, hitRadius: 13,
    color: "#ff6b00", accent: "#fff200",
    speed: 2.5, fireRate: 0, bulletType: null,
    movePattern: "straight",
    shape: "arrow",
    dropBonus: 0.15,  // 额外掉落加成
  },
  // 🔴 中型战斗机
  fighter: {
    type: "fighter", name: "战斗机",
    hp: 60, score: 300, exp: 18, coin: 12,
    width: 34, height: 34, hitRadius: 16,
    color: "#ff003c", accent: "#ff6b00",
    speed: 1.6, fireRate: 2000, bulletType: "aimed",
    bulletSpeed: 4, bulletDamage: 8,
    movePattern: "straight",
    shape: "tri_wing",
  },
  // 🟣 大型轰炸机
  bomber: {
    type: "bomber", name: "轰炸机",
    hp: 150, score: 800, exp: 40, coin: 25,
    width: 50, height: 46, hitRadius: 23,
    color: "#b400ff", accent: "#ff00aa",
    speed: 1.0, fireRate: 3000, bulletType: "spread5",
    bulletSpeed: 3.5, bulletDamage: 10,
    movePattern: "slow_descent",
    shape: "heavy",
  },
  // 🔵 高速截击机
  interceptor: {
    type: "interceptor", name: "截击机",
    hp: 40, score: 500, exp: 22, coin: 15,
    width: 28, height: 32, hitRadius: 13,
    color: "#00f0ff", accent: "#39ff14",
    speed: 4.0, fireRate: 1800, bulletType: "fast_single",
    bulletSpeed: 6.5, bulletDamage: 6,
    movePattern: "zigzag",
    shape: "dart",
  },
  // 🟡 召唤型母舰
  carrier: {
    type: "carrier", name: "母舰",
    hp: 200, score: 1200, exp: 55, coin: 40,
    width: 62, height: 42, hitRadius: 28,
    color: "#fff200", accent: "#ff6b00",
    speed: 0.6, fireRate: 5000, bulletType: "summon",
    summonType: "drone", summonCount: 3,
    movePattern: "hover_top",
    shape: "platform",
  },
  // 💚 追踪无人机（新）- 精英小兵
  drone: {
    type: "drone", name: "无人机",
    hp: 30, score: 180, exp: 12, coin: 8,
    width: 22, height: 22, hitRadius: 11,
    color: "#39ff14", accent: "#00f0ff",
    speed: 3.2, fireRate: 2500, bulletType: "homing_mini",
    bulletSpeed: 3, bulletDamage: 6,
    movePattern: "hunting",   // 追踪玩家
    shape: "hex_drone",
  },
  // 💜 狙击手（新）- 远距离精确射击
  sniper: {
    type: "sniper", name: "狙击手",
    hp: 50, score: 600, exp: 28, coin: 20,
    width: 30, height: 36, hitRadius: 14,
    color: "#b400ff", accent: "#00f0ff",
    speed: 1.2, fireRate: 3500, bulletType: "sniper_beam",
    bulletSpeed: 8, bulletDamage: 18,
    movePattern: "snipe_strafing",
    shape: "long_range",
    telegraph: true,  // 攻击前有预警
  },
  // 🧡 支援舰（新）- 治疗周围敌机
  support: {
    type: "support", name: "支援舰",
    hp: 120, score: 900, exp: 45, coin: 35,
    width: 44, height: 40, hitRadius: 20,
    color: "#ff9e3d", accent: "#fff200",
    speed: 0.8, fireRate: 4000, bulletType: "heal_pulse",
    healAmount: 25, healRadius: 100,
    movePattern: "slow_descent",
    shape: "healer_ship",
  },
  // ❤️ 精英战斗机（新）- 带红色描边，高血量高伤
  elite: {
    type: "elite", name: "精英战机",
    hp: 140, score: 1000, exp: 50, coin: 30,
    width: 38, height: 38, hitRadius: 18,
    color: "#ff2d55", accent: "#fff200",
    speed: 1.8, fireRate: 1500, bulletType: "spread3",
    bulletSpeed: 5, bulletDamage: 12,
    movePattern: "aggressive",
    shape: "elite_wing",
    elite: true,   // 精英标志（带光环）
    dropBonus: 0.5,
  },
};

// 编队模式（用于 waveData 配置）
const FORMATIONS = {
  line:       (count, startX, y) => {  // 横排
    const gap = 50, total = (count - 1) * gap;
    const arr = [];
    for (let i = 0; i < count; i++) arr.push({ x: startX - total / 2 + i * gap, y });
    return arr;
  },
  v_formation:(count, startX, y) => {  // V 字
    const arr = [];
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const step = Math.ceil(i / 2);
      arr.push({ x: startX + side * step * 40, y: y - side * step * 20 });
    }
    return arr;
  },
  zigzag:     (count, startX, y) => {  // 之字形间隔
    const arr = [];
    for (let i = 0; i < count; i++) arr.push({ x: startX + (i % 2 === 0 ? -60 : 60), y: y - i * 50 });
    return arr;
  },
  random_top: (count, startX, y) => {
    const arr = [];
    for (let i = 0; i < count; i++) arr.push({ x: 60 + Math.random() * (CONFIG.WIDTH - 120), y: -40 - i * 60 });
    return arr;
  },
};
