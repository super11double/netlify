/* ============================================================
   bossData.js - Boss 配置 + 弹幕模式
   必带 ≥4 种攻击：①扇形弹幕 ②激光横扫 ③召唤小怪 ④冲撞玩家
   额外：⑤全屏弹雨（狂暴专属） ⑥引力炸弹（中Boss+）
   全局对象：BOSS_DATA, BOSS_PATTERNS, BOSS_ATTACK_REQUIRED

   血量曲线设计依据（修复 equips.resetForRun 后的真实 DPS）：
   - CH1: 玩家 Lv3-4 + 默认霰弹, DPS ≈ 370~550 → 目标 15~20s
   - CH2: +1 件激光, DPS ≈ 800~1050 → 目标 20~25s
   - CH3: +2 件装备, DPS ≈ 900~1350 → 目标 25~30s
   - CH4: +3 件装备, DPS ≈ 1300~1800 → 目标 30~40s
   - CH5: +4~5 件装备, DPS ≈ 1800~2500 → 目标 40~50s
   - CH6: 满装满级, DPS ≈ 2200~3000 → 目标 60~75s
   - SubBoss ≈ 本章节 Boss 的 45%
   ============================================================ */

// 攻击类型分组（供 UI 展示/阶段编排）
const BOSS_ATTACK_REQUIRED = {
  spread:   ["spread_5", "spread_8"],            // ①扇形弹幕（必带）
  laser:    ["laser_beam", "laser_sweep"],       // ②激光横扫（必带）
  summon:   ["summon_minions", "summon_bomber"], // ③召唤小怪（必带）
  ram:      ["player_ram"],                      // ④冲撞玩家（必带）
  screen:   ["screen_rain"],                     // ⑤全屏弹雨（狂暴专属）
  gravity:  ["gravity_bomb"],                    // ⑥引力炸弹（可选追加）
  misc:     ["spiral_shot","ring_burst","cross_burst","windmill","tracking_missile","bubble_trap","aimed_shot","rain_bullets"],
};

// ===== Boss 数据（按章节，6 章全齐 + 6 个 SubBoss 梯度） =====
const BOSS_DATA = {
  // 第1章 Boss：轨道防卫者·MK-I（3阶段，必带 4 种基础攻击）
  // 血量再次下调：默认霰弹枪 DPS≈375，目标 10~15s 击杀
  BOSS_CH1: {
    id: "BOSS_CH1", name: "轨道防卫者·MK-I",
    chapter: 1, maxHp: 3500, score: 5000, exp: 300, coin: 200,
    width: 120, height: 90, hitRadius: 50,
    color: "#ff6b00", accent: "#fff200", berserkColor: "#ff003c",
    shape: "saucer",
    bossTier: "mini",
    phases: [
      { hpThreshold: 0.66, attackPatterns: ["spread_5", "aimed_shot"], movePattern: "horizontal_pan", attackInterval: 1500 },
      { hpThreshold: 0.33, attackPatterns: ["spiral_shot", "laser_sweep", "summon_minions"], movePattern: "figure_8", attackInterval: 1100 },
      { hpThreshold: 0,    attackPatterns: ["screen_rain", "laser_sweep", "summon_minions", "player_ram"], movePattern: "chase_player", attackInterval: 700, berserk: true },
    ],
  },

  // 第2章 Boss：月球巡航舰·狩猎者（3阶段，狂暴追加冲撞）
  // 血量下调：玩家此时已有 laser+missile，DPS≈600~800，目标 12~18s
  BOSS_CH2: {
    id: "BOSS_CH2", name: "月球巡航舰·狩猎者",
    chapter: 2, maxHp: 8000, score: 7000, exp: 380, coin: 260,
    width: 126, height: 96, hitRadius: 52,
    color: "#00a8b3", accent: "#00f0ff", berserkColor: "#ff003c",
    shape: "saucer",
    bossTier: "mini",
    phases: [
      { hpThreshold: 0.66, attackPatterns: ["spread_8", "aimed_shot", "rain_bullets"], movePattern: "horizontal_pan", attackInterval: 1400 },
      { hpThreshold: 0.33, attackPatterns: ["spiral_shot", "laser_sweep", "summon_minions"], movePattern: "figure_8", attackInterval: 1050 },
      { hpThreshold: 0,    attackPatterns: ["screen_rain", "laser_sweep", "summon_minions", "player_ram"], movePattern: "chase_player", attackInterval: 680, berserk: true },
    ],
  },

  // 第3章 Boss：小行星·巨蟹（3阶段，追加引力炸弹）
  BOSS_CH3: {
    id: "BOSS_CH3", name: "小行星·巨蟹",
    chapter: 3, maxHp: 28000, score: 10000, exp: 500, coin: 350,
    width: 140, height: 110, hitRadius: 55,
    color: "#b400ff", accent: "#ff00aa", berserkColor: "#ff003c",
    shape: "crab",
    bossTier: "mid",
    phases: [
      { hpThreshold: 0.66, attackPatterns: ["spread_8", "spiral_shot"], movePattern: "horizontal_pan", attackInterval: 1400 },
      { hpThreshold: 0.33, attackPatterns: ["laser_sweep", "cross_burst", "summon_minions", "gravity_bomb"], movePattern: "figure_8", attackInterval: 1000 },
      { hpThreshold: 0,    attackPatterns: ["screen_rain", "player_ram", "summon_minions", "gravity_bomb"], movePattern: "chase_player", attackInterval: 650, berserk: true },
    ],
  },

  // 第4章 Boss：火星防御塔·熔火（3阶段，冲撞+追踪导弹）
  BOSS_CH4: {
    id: "BOSS_CH4", name: "火星防御塔·熔火",
    chapter: 4, maxHp: 50000, score: 14000, exp: 650, coin: 480,
    width: 148, height: 118, hitRadius: 58,
    color: "#ff6b00", accent: "#ff003c", berserkColor: "#fff200",
    shape: "crab",
    bossTier: "mid",
    phases: [
      { hpThreshold: 0.66, attackPatterns: ["spread_8", "ring_burst", "tracking_missile"], movePattern: "horizontal_pan", attackInterval: 1300 },
      { hpThreshold: 0.33, attackPatterns: ["laser_sweep", "gravity_bomb", "summon_bomber"], movePattern: "figure_8", attackInterval: 950 },
      { hpThreshold: 0,    attackPatterns: ["screen_rain", "player_ram", "tracking_missile", "summon_bomber"], movePattern: "chase_player", attackInterval: 620, berserk: true },
    ],
  },

  // 第5章 Boss：暗影母舰·吞噬者（4阶段，前半段合体攻击多）
  BOSS_CH5: {
    id: "BOSS_CH5", name: "暗影母舰·吞噬者",
    chapter: 5, maxHp: 90000, score: 20000, exp: 900, coin: 700,
    width: 170, height: 126, hitRadius: 62,
    color: "#8aa0c4", accent: "#b400ff", berserkColor: "#ff003c",
    shape: "core",
    bossTier: "big",
    phases: [
      { hpThreshold: 0.75, attackPatterns: ["spread_8", "spiral_shot", "windmill"], movePattern: "horizontal_pan", attackInterval: 1200 },
      { hpThreshold: 0.50, attackPatterns: ["spread_8", "laser_sweep", "summon_bomber", "gravity_bomb"], movePattern: "figure_8", attackInterval: 900 },
      { hpThreshold: 0.25, attackPatterns: ["cross_burst", "ring_burst", "player_ram", "tracking_missile"], movePattern: "chase_player", attackInterval: 720 },
      { hpThreshold: 0,    attackPatterns: ["screen_rain", "laser_sweep", "summon_bomber", "player_ram", "gravity_bomb"], movePattern: "chase_player", attackInterval: 550, berserk: true },
    ],
  },

  // 第6章 终极 Boss：母舰核心·神谕（4阶段 + 狂暴合体，6 种攻击全登场）
  BOSS_CH6: {
    id: "BOSS_CH6", name: "母舰核心·神谕",
    chapter: 6, maxHp: 180000, score: 30000, exp: 1500, coin: 1000,
    width: 180, height: 130, hitRadius: 65,
    color: "#ff00aa", accent: "#b400ff", berserkColor: "#ff003c",
    shape: "core",
    bossTier: "big",
    phases: [
      { hpThreshold: 0.75, attackPatterns: ["spread_8", "laser_sweep", "spiral_shot", "windmill"], movePattern: "horizontal_pan", attackInterval: 1300 },
      { hpThreshold: 0.50, attackPatterns: ["spread_8", "laser_sweep", "summon_bomber", "gravity_bomb", "tracking_missile"], movePattern: "figure_8", attackInterval: 1000 },
      { hpThreshold: 0.25, attackPatterns: ["spread_8", "laser_sweep", "player_ram", "ring_burst", "cross_burst"], movePattern: "chase_player", attackInterval: 750 },
      { hpThreshold: 0,    attackPatterns: ["screen_rain", "laser_sweep", "summon_bomber", "player_ram", "gravity_bomb", "windmill"], movePattern: "chase_player", attackInterval: 500, berserk: true, finalForm: true },
    ],
  },

  // ===== SubBoss：对应章节 45% 血量 =====
  // CH1/CH2 SubBoss 同步下调（保持 ≈45% 比例）
  SUBOSS_CH1: {
    id: "SUBOSS_CH1", name: "护卫艇·先锋",
    chapter: 1, maxHp: 1500, score: 2000, exp: 150, coin: 80,
    width: 80, height: 60, hitRadius: 35,
    color: "#ff6b00", accent: "#fff200", berserkColor: "#ff003c",
    shape: "saucer", bossTier: "mini",
    phases: [
      { hpThreshold: 0.5, attackPatterns: ["spread_5", "laser_sweep"], movePattern: "horizontal_pan", attackInterval: 1300 },
      { hpThreshold: 0,   attackPatterns: ["spread_8", "player_ram", "summon_minions"], movePattern: "figure_8", attackInterval: 900, berserk: true },
    ],
  },
  SUBOSS_CH2: {
    id: "SUBOSS_CH2", name: "巡逻舰·哨兵",
    chapter: 2, maxHp: 3600, score: 2600, exp: 190, coin: 110,
    width: 86, height: 64, hitRadius: 37,
    color: "#00a8b3", accent: "#00f0ff", berserkColor: "#ff003c",
    shape: "saucer", bossTier: "mini",
    phases: [
      { hpThreshold: 0.5, attackPatterns: ["spread_5", "spiral_shot"], movePattern: "horizontal_pan", attackInterval: 1250 },
      { hpThreshold: 0,   attackPatterns: ["spread_8", "player_ram", "summon_minions"], movePattern: "figure_8", attackInterval: 880, berserk: true },
    ],
  },
  SUBOSS_CH3: {
    id: "SUBOSS_CH3", name: "巨蟹副炮·断螯",
    chapter: 3, maxHp: 12500, score: 3400, exp: 240, coin: 150,
    width: 98, height: 76, hitRadius: 42,
    color: "#b400ff", accent: "#ff00aa", berserkColor: "#ff003c",
    shape: "crab", bossTier: "mid",
    phases: [
      { hpThreshold: 0.5, attackPatterns: ["spread_8", "cross_burst"], movePattern: "figure_8", attackInterval: 1150 },
      { hpThreshold: 0,   attackPatterns: ["laser_sweep", "summon_minions", "player_ram"], movePattern: "chase_player", attackInterval: 820, berserk: true },
    ],
  },
  SUBOSS_CH4: {
    id: "SUBOSS_CH4", name: "熔火炮塔·灰烬",
    chapter: 4, maxHp: 22500, score: 4800, exp: 320, coin: 210,
    width: 108, height: 84, hitRadius: 46,
    color: "#ff6b00", accent: "#ff003c", berserkColor: "#fff200",
    shape: "crab", bossTier: "mid",
    phases: [
      { hpThreshold: 0.5, attackPatterns: ["spread_8", "tracking_missile"], movePattern: "figure_8", attackInterval: 1100 },
      { hpThreshold: 0,   attackPatterns: ["gravity_bomb", "summon_bomber", "player_ram"], movePattern: "chase_player", attackInterval: 800, berserk: true },
    ],
  },
  SUBOSS_CH5: {
    id: "SUBOSS_CH5", name: "暗影尖兵·吞噬",
    chapter: 5, maxHp: 40000, score: 6400, exp: 420, coin: 300,
    width: 124, height: 96, hitRadius: 50,
    color: "#8aa0c4", accent: "#b400ff", berserkColor: "#ff003c",
    shape: "core", bossTier: "big",
    phases: [
      { hpThreshold: 0.6, attackPatterns: ["spread_8", "windmill", "summon_minions"], movePattern: "figure_8", attackInterval: 1050 },
      { hpThreshold: 0,   attackPatterns: ["screen_rain", "ring_burst", "player_ram", "gravity_bomb"], movePattern: "chase_player", attackInterval: 720, berserk: true },
    ],
  },
  SUBOSS_CH6: {
    id: "SUBOSS_CH6", name: "神谕近卫·虚空之眼",
    chapter: 6, maxHp: 80000, score: 9000, exp: 600, coin: 450,
    width: 140, height: 110, hitRadius: 55,
    color: "#ff00aa", accent: "#b400ff", berserkColor: "#fff200",
    shape: "core", bossTier: "big",
    phases: [
      { hpThreshold: 0.6, attackPatterns: ["spread_8", "laser_sweep", "windmill"], movePattern: "figure_8", attackInterval: 950 },
      { hpThreshold: 0.25, attackPatterns: ["gravity_bomb", "summon_bomber", "tracking_missile"], movePattern: "chase_player", attackInterval: 750 },
      { hpThreshold: 0,   attackPatterns: ["screen_rain", "laser_sweep", "player_ram", "summon_bomber"], movePattern: "chase_player", attackInterval: 580, berserk: true },
    ],
  },
};

// ===== 12 种弹幕模式实现 =====
// 每个 pattern 是函数 (boss, game) => void，负责发射子弹
// 子弹通过 game.spawnEnemyBullet 创建
const BOSS_PATTERNS = {
  // 扇形散射 5 发，朝玩家方向 ±30°
  spread_5(boss, game) {
    _spreadAt(boss, game, 5, Math.PI / 6, 3.5, "#ff6b00");
  },
  // 广域扇形 8 发，±60°
  spread_8(boss, game) {
    _spreadAt(boss, game, 8, Math.PI / 3, 3.2, "#b400ff");
  },
  // 螺旋弹幕：一次性旋转射出一圈（12发，分散角度）
  spiral_shot(boss, game) {
    const count = 12;
    const baseAngle = boss.spiralAngle || 0;
    for (let i = 0; i < count; i++) {
      const a = baseAngle + (i / count) * Math2.TAU;
      const v = Math2.angleToVec(a);
      game.spawnEnemyBullet(boss.x, boss.y, v.x * 3, v.y * 3, "#00f0ff", 6, 8);
    }
    boss.spiralAngle = (baseAngle + 0.3) % Math2.TAU;
  },
  // 瞄准射击：精准追踪玩家
  aimed_shot(boss, game) {
    if (!game.player) return;
    const a = Math.atan2(game.player.y - boss.y, game.player.x - boss.x);
    const v = Math2.angleToVec(a);
    game.spawnEnemyBullet(boss.x, boss.y, v.x * 4.5, v.y * 4.5, "#ff003c", 7, 10);
  },
  // 环形爆发 360° 24 发
  ring_burst(boss, game) {
    const count = 24;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math2.TAU;
      const v = Math2.angleToVec(a);
      game.spawnEnemyBullet(boss.x, boss.y, v.x * 3, v.y * 3, "#e6f1ff", 6, 8);
    }
  },
  // 弹幕雨：从上方随机位置落下
  rain_bullets(boss, game) {
    for (let i = 0; i < 6; i++) {
      const x = 30 + Math.random() * (CONFIG.WIDTH - 60);
      game.spawnEnemyBullet(x, -10, (Math.random() - 0.5) * 1.5, 3.5, "#00f0ff", 6, 8);
    }
  },
  // 激光束：预热 1 秒 → 发射 2 秒垂直激光
  laser_beam(boss, game) {
    if (!game.player) return;
    // 在玩家当前 X 列发射激光（预警→爆发）
    game.fireBossLaser(boss.x, Math.max(40, Math.min(CONFIG.WIDTH - 40, game.player.x)), 1000, 1800);
  },
  // 十字爆裂 4 方向
  cross_burst(boss, game) {
    const dirs = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
    for (const a of dirs) {
      const v = Math2.angleToVec(a);
      for (let i = 0; i < 3; i++) {
        game.spawnEnemyBullet(boss.x, boss.y, v.x * (2 + i * 0.6), v.y * (2 + i * 0.6), "#fff200", 6, 9);
      }
    }
  },
  // 召唤小兵
  summon_minions(boss, game) {
    const count = 2;
    for (let i = 0; i < count; i++) {
      const ox = (i === 0 ? -1 : 1) * 50;
      game.spawnEnemy("scout", boss.x + ox, boss.y + 20, { fromBoss: true });
    }
  },
  // 风车甩弹：4 臂旋转，每臂 3 发
  windmill(boss, game) {
    const baseAngle = boss.windmillAngle || 0;
    for (let arm = 0; arm < 4; arm++) {
      const armAngle = baseAngle + (arm / 4) * Math2.TAU;
      for (let i = 0; i < 3; i++) {
        const a = armAngle;
        const v = Math2.angleToVec(a);
        const speed = 2.5 + i * 0.4;
        game.spawnEnemyBullet(boss.x, boss.y, v.x * speed, v.y * speed, "#ff00aa", 6, 8);
      }
    }
    boss.windmillAngle = (baseAngle + 0.4) % Math2.TAU;
  },
  // 追踪导弹 3 枚
  tracking_missile(boss, game) {
    for (let i = 0; i < 3; i++) {
      const ox = (i - 1) * 30;
      game.spawnEnemyBullet(boss.x + ox, boss.y, 0, 1.5, "#ff6b00", 8, 12, { homing: true, homingTime: 3000 });
    }
  },
  // 气泡陷阱：缓慢大体积弹
  bubble_trap(boss, game) {
    if (!game.player) return;
    const a = Math.atan2(game.player.y - boss.y, game.player.x - boss.x);
    const v = Math2.angleToVec(a);
    game.spawnEnemyBullet(boss.x, boss.y, v.x * 1.2, v.y * 1.2, "#b400ff", 18, 0, { big: true });
  },

  // ====================================================================
  // ② 激光横扫（必带）：锁定玩家 X 预警 → 发射 180° 横扫激光 2 秒
  // ====================================================================
  laser_sweep(boss, game) {
    if (!game.player) return;
    // 以玩家当前 X 为中心启动横扫激光（BOSS 先预警，然后从 -90° 扫到 +90°）
    const targetX = Math.max(60, Math.min(CONFIG.WIDTH - 60, game.player.x));
    // 调用 game 层接口：centerX, warmupMs=1000, sweepMs=2000, widthPx
    game.fireBossSweepLaser(boss.x, targetX, 1000, 2000, 20);
  },

  // ====================================================================
  // ③ 召唤自爆小怪（额外：代替普通 summon 的更具攻击性版本）
  // ====================================================================
  summon_bomber(boss, game) {
    const count = 3;
    for (let i = 0; i < count; i++) {
      const ox = (i - 1) * 40;
      game.spawnEnemy("bomber", boss.x + ox, boss.y + 30, { fromBoss: true });
    }
  },

  // ====================================================================
  // ④ 冲撞玩家（必带）：预警 2 秒锁定玩家位置 → 800 px/s 冲撞
  // ====================================================================
  player_ram(boss, game) {
    if (!game.player) return;
    // 已经在冲撞中？就不重复触发
    if (boss._ramState && boss._ramState.active) return;

    const px = game.player.x;
    const py = game.player.y;
    boss._ramState = {
      active: true,
      phase: "warn",          // warn(2s) → charging → done
      phaseTimer: 0,
      warnSec: 2,
      lockX: px,
      lockY: py,
      speed: 800 / 60,        // 每帧像素（约 800 px/s）
      damage: 50,
      startX: boss.x,
      startY: boss.y,
      ramDirX: 0,
      ramDirY: 0,
    };
    // game 层需要监听 boss._ramState 并移动 Boss 本体；此处只初始化
    if (game.startBossRam) game.startBossRam(boss);
  },

  // ====================================================================
  // ⑤ 全屏弹雨（狂暴专属）：屏幕四边生成子弹向中心汇聚
  // ====================================================================
  screen_rain(boss, game) {
    const bursts = 5;       // 一次调用生成 5 组（每帧由 game 主循环持续调用）
    for (let i = 0; i < bursts; i++) {
      const side = Math.floor(Math.random() * 4); // 0上 1下 2左 3右
      let x, y, vx, vy;
      if (side === 0) { x = Math.random() * CONFIG.WIDTH; y = -10; vx = (Math.random() - 0.5) * 1.5; vy = 200 / 60; }
      else if (side === 1) { x = Math.random() * CONFIG.WIDTH; y = CONFIG.HEIGHT + 10; vx = (Math.random() - 0.5) * 1.5; vy = -200 / 60; }
      else if (side === 2) { x = -10; y = Math.random() * CONFIG.HEIGHT; vx = 200 / 60; vy = (Math.random() - 0.5) * 1.5; }
      else { x = CONFIG.WIDTH + 10; y = Math.random() * CONFIG.HEIGHT; vx = -200 / 60; vy = (Math.random() - 0.5) * 1.5; }
      game.spawnEnemyBullet(x, y, vx * 3, vy * 3,
        ["#ff00aa", "#00f0ff", "#fff200", "#ff6b00"][i % 4], 5, 10);
    }
  },

  // ====================================================================
  // ⑥ 引力炸弹（中 Boss+）：3 枚落点爆炸 + 吸引玩家
  // ====================================================================
  gravity_bomb(boss, game) {
    const count = 3;
    for (let i = 0; i < count; i++) {
      const x = 80 + Math.random() * (CONFIG.WIDTH - 160);
      const y = 120 + Math.random() * (CONFIG.HEIGHT * 0.6);
      // 延迟 2 秒后爆炸：game 层维护计时
      game.spawnGravityBomb(x, y, 2000, 100, 100, 1000);
    }
  },
};

// 内部辅助：扇形散射
function _spreadAt(boss, game, count, spreadRad, speed, color) {
  if (!game.player) return;
  const base = Math.atan2(game.player.y - boss.y, game.player.x - boss.x);
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : (i / (count - 1)) - 0.5; // -0.5 ~ 0.5
    const a = base + t * 2 * spreadRad;
    const v = Math2.angleToVec(a);
    game.spawnEnemyBullet(boss.x, boss.y, v.x * speed, v.y * speed, color, 6, 9);
  }
}
