/* ============================================================
   waveData.js - 关卡波次配置
   闯关模式：6章 × 5关。MVP 实装第1章全部 + 章节Boss复用模板
   全局对象：CHAPTERS
   ============================================================ */

// 生成一个标准小关卡（3-4波小怪）
function _stage(waves, opt = {}) {
  return { waves, ...opt };
}

// 单波：{ delay, spawns:[{type, count, formation, gap}] }
function _wave(delay, spawns) { return { delay, spawns }; }
function _spawn(type, count, formation = "line", gap = 400) { return { type, count, formation, gap }; }

const CHAPTERS = [
  // ===== 第1章：地球近地轨道（入门） =====
  {
    id: 1, name: "地球近地轨道", theme: "blue",
    stages: [
      // 1-1
      _stage([
        _wave(500,  [_spawn("scout", 5, "line")]),
        _wave(3000, [_spawn("scout", 8, "v_formation")]),
        _wave(3000, [_spawn("scout", 6, "zigzag"), _spawn("fighter", 2, "random_top", 1500)]),
      ], { reward: { coin: 100, exp: 50 } }),
      // 1-2 小Boss
      _stage([
        _wave(500,  [_spawn("scout", 6, "line")]),
        _wave(3000, [_spawn("fighter", 3, "v_formation")]),
        _wave(3000, [_spawn("interceptor", 4, "random_top")]),
      ], { hasSubBoss: true, subBossId: "SUBOSS_CH1", subBossWave: 3 }),
      // 1-3
      _stage([
        _wave(500,  [_spawn("fighter", 4, "line")]),
        _wave(3000, [_spawn("scout", 8, "zigzag"), _spawn("bomber", 1, "random_top")]),
        _wave(4000, [_spawn("interceptor", 5, "v_formation")]),
      ]),
      // 1-4 小Boss
      _stage([
        _wave(500,  [_spawn("scout", 8, "random_top")]),
        _wave(3000, [_spawn("fighter", 4, "v_formation")]),
        _wave(3500, [_spawn("bomber", 2, "line", 1500)]),
      ], { hasSubBoss: true, subBossId: "SUBOSS_CH1", subBossWave: 3 }),
      // 1-5 章节Boss
      _stage([
        _wave(500,  [_spawn("scout", 6, "line")]),
        _wave(2500, [_spawn("fighter", 3, "v_formation")]),
      ], { hasBoss: true, bossId: "BOSS_CH1" }),
    ],
  },

  // ===== 第2章：月球基地攻防 =====
  {
    id: 2, name: "月球基地攻防", theme: "cyan",
    stages: [
      _stage([
        _wave(500,  [_spawn("fighter", 5, "line")]),
        _wave(3000, [_spawn("interceptor", 6, "zigzag")]),
        _wave(3500, [_spawn("bomber", 2, "v_formation"), _spawn("scout", 6, "random_top")]),
      ]),
      _stage([
        _wave(500,  [_spawn("interceptor", 6, "line")]),
        _wave(3000, [_spawn("fighter", 5, "v_formation")]),
        _wave(3500, [_spawn("carrier", 1, "random_top")]),
      ], { hasSubBoss: true, subBossId: "SUBOSS_CH2", subBossWave: 3 }),
      _stage([
        _wave(500,  [_spawn("fighter", 6, "zigzag")]),
        _wave(3000, [_spawn("bomber", 3, "line", 1500)]),
        _wave(4000, [_spawn("interceptor", 7, "random_top")]),
      ]),
      _stage([
        _wave(500,  [_spawn("scout", 10, "random_top")]),
        _wave(3000, [_spawn("bomber", 2, "v_formation"), _spawn("fighter", 4, "line")]),
      ], { hasSubBoss: true, subBossId: "SUBOSS_CH2", subBossWave: 2 }),
      _stage([
        _wave(500,  [_spawn("fighter", 4, "v_formation")]),
        _wave(2500, [_spawn("interceptor", 5, "zigzag")]),
      ], { hasBoss: true, bossId: "BOSS_CH2" }),
    ],
  },

  // ===== 第3章：小行星带突围（Boss: 巨蟹） =====
  {
    id: 3, name: "小行星带突围", theme: "purple",
    stages: [
      _stage([
        _wave(500,  [_spawn("fighter", 6, "line")]),
        _wave(3000, [_spawn("interceptor", 7, "zigzag")]),
        _wave(3500, [_spawn("bomber", 2, "v_formation")]),
      ]),
      _stage([
        _wave(500,  [_spawn("carrier", 1, "random_top")]),
        _wave(3500, [_spawn("fighter", 6, "v_formation")]),
        _wave(3500, [_spawn("interceptor", 6, "random_top")]),
      ], { hasSubBoss: true, subBossId: "SUBOSS_CH3", subBossWave: 3 }),
      _stage([
        _wave(500,  [_spawn("bomber", 3, "line", 1200)]),
        _wave(3000, [_spawn("fighter", 7, "zigzag")]),
        _wave(3500, [_spawn("interceptor", 8, "random_top")]),
      ]),
      _stage([
        _wave(500,  [_spawn("scout", 12, "random_top")]),
        _wave(3000, [_spawn("bomber", 3, "v_formation")]),
      ], { hasSubBoss: true, subBossId: "SUBOSS_CH3", subBossWave: 2 }),
      _stage([
        _wave(500,  [_spawn("fighter", 5, "v_formation")]),
        _wave(2500, [_spawn("interceptor", 6, "zigzag")]),
      ], { hasBoss: true, bossId: "BOSS_CH3" }),
    ],
  },

  // ===== 第4章：火星殖民地保卫 =====
  {
    id: 4, name: "火星殖民地保卫", theme: "orange",
    stages: [
      _stage([
        _wave(500,  [_spawn("fighter", 7, "line")]),
        _wave(3000, [_spawn("interceptor", 8, "zigzag")]),
        _wave(3500, [_spawn("bomber", 3, "v_formation"), _spawn("carrier", 1, "random_top")]),
      ]),
      _stage([
        _wave(500,  [_spawn("bomber", 3, "line", 1200)]),
        _wave(3000, [_spawn("fighter", 7, "v_formation")]),
        _wave(3500, [_spawn("interceptor", 8, "random_top")]),
      ], { hasSubBoss: true, subBossId: "SUBOSS_CH4", subBossWave: 3 }),
      _stage([
        _wave(500,  [_spawn("carrier", 2, "line", 2000)]),
        _wave(3500, [_spawn("fighter", 8, "zigzag")]),
        _wave(3500, [_spawn("interceptor", 8, "random_top")]),
      ]),
      _stage([
        _wave(500,  [_spawn("scout", 14, "random_top")]),
        _wave(3000, [_spawn("bomber", 3, "v_formation")]),
      ], { hasSubBoss: true, subBossId: "SUBOSS_CH4", subBossWave: 2 }),
      _stage([
        _wave(500,  [_spawn("fighter", 6, "v_formation")]),
        _wave(2500, [_spawn("interceptor", 7, "zigzag")]),
      ], { hasBoss: true, bossId: "BOSS_CH4" }),
    ],
  },

  // ===== 第5章：暗星云穿越 =====
  {
    id: 5, name: "暗星云穿越", theme: "dark",
    stages: [
      _stage([
        _wave(500,  [_spawn("fighter", 8, "line")]),
        _wave(3000, [_spawn("interceptor", 9, "zigzag")]),
        _wave(3500, [_spawn("bomber", 3, "v_formation"), _spawn("carrier", 1, "random_top")]),
      ]),
      _stage([
        _wave(500,  [_spawn("carrier", 2, "line", 1800)]),
        _wave(3500, [_spawn("fighter", 8, "v_formation")]),
        _wave(3500, [_spawn("interceptor", 9, "random_top")]),
      ], { hasSubBoss: true, subBossId: "SUBOSS_CH5", subBossWave: 3 }),
      _stage([
        _wave(500,  [_spawn("bomber", 4, "line", 1000)]),
        _wave(3000, [_spawn("fighter", 9, "zigzag")]),
        _wave(3500, [_spawn("interceptor", 10, "random_top")]),
      ]),
      _stage([
        _wave(500,  [_spawn("scout", 16, "random_top")]),
        _wave(3000, [_spawn("bomber", 4, "v_formation")]),
      ], { hasSubBoss: true, subBossId: "SUBOSS_CH5", subBossWave: 2 }),
      _stage([
        _wave(500,  [_spawn("fighter", 7, "v_formation")]),
        _wave(2500, [_spawn("interceptor", 8, "zigzag")]),
      ], { hasBoss: true, bossId: "BOSS_CH5" }),
    ],
  },

  // ===== 第6章：敌方母舰决战（终Boss 神谕） =====
  {
    id: 6, name: "敌方母舰决战", theme: "final",
    stages: [
      _stage([
        _wave(500,  [_spawn("fighter", 10, "line")]),
        _wave(3000, [_spawn("interceptor", 10, "zigzag")]),
        _wave(3500, [_spawn("bomber", 4, "v_formation"), _spawn("carrier", 2, "random_top")]),
      ]),
      _stage([
        _wave(500,  [_spawn("carrier", 2, "line", 1500)]),
        _wave(3500, [_spawn("fighter", 10, "v_formation")]),
        _wave(3500, [_spawn("interceptor", 10, "random_top")]),
      ], { hasSubBoss: true, subBossId: "SUBOSS_CH6", subBossWave: 3 }),
      _stage([
        _wave(500,  [_spawn("bomber", 5, "line", 900)]),
        _wave(3000, [_spawn("fighter", 11, "zigzag")]),
        _wave(3500, [_spawn("interceptor", 11, "random_top")]),
      ]),
      _stage([
        _wave(500,  [_spawn("scout", 20, "random_top")]),
        _wave(3000, [_spawn("bomber", 5, "v_formation")]),
      ], { hasSubBoss: true, subBossId: "SUBOSS_CH6", subBossWave: 2 }),
      _stage([
        _wave(500,  [_spawn("fighter", 8, "v_formation")]),
        _wave(2500, [_spawn("interceptor", 8, "zigzag")]),
      ], { hasBoss: true, bossId: "BOSS_CH6", isFinal: true }),
    ],
  },
];
