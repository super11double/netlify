/* ============================================================
   gameConfig.js - 游戏全局常量（Builder 最常修改）
   全局对象：CONFIG
   ============================================================ */
const CONFIG = {
  // ===== 画布逻辑尺寸（内部坐标，渲染时按窗口缩放） =====
  WIDTH: 480,
  HEIGHT: 720,

  // ===== 主循环 =====
  TARGET_FPS: 60,

  // ===== 玩家相关 =====
  PLAYER_START_X: 240,
  PLAYER_START_Y: 620,
  PLAYER_INVINCIBLE_MS: 1500,   // 受击后无敌时间
  PLAYER_RESPAWN_HP_RATIO: 0.5, // 复活协议芯片复活血量
  COMBO_TIMEOUT_MS: 2500,       // 连击保持时间

  // ===== 火力等级 =====
  MAX_POWER_LEVEL: 8,

  // ===== 道具 =====
  ITEM_FALL_SPEED: 2.2,
  ITEM_MAGNET_BASE: 70,         // 基础磁吸半径
  ITEM_MAGNET_SPEED: 6,

  // ===== 经验/升级 =====
  EXP_BASE: 30,                 // Lv1->2 所需经验
  EXP_GROWTH: 1.35,             // 每级递增系数

  // ===== 屏幕震动 =====
  SHAKE_SMALL: 3,
  SHAKE_MED: 6,
  SHAKE_BIG: 12,
  SHAKE_DECAY: 0.85,

  // ===== 颜色（与 CSS 变量一致，Canvas 用） =====
  COLORS: {
    bgDeep: "#0a0e27",
    bgSpace: "#0d1b3e",
    neonCyan: "#00f0ff",
    neonCyanDim: "#00a8b3",
    neonPurple: "#b400ff",
    neonPink: "#ff00aa",
    neonGreen: "#39ff14",
    neonYellow: "#fff200",
    neonOrange: "#ff6b00",
    neonRed: "#ff003c",
    textPrimary: "#e6f1ff",
    textSecondary: "#8aa0c4",
  },

  // ===== 模式 =====
  MODES: {
    level:   { name: "闯关模式",   timerSec: 0,   endless: false },
    endless: { name: "无尽模式",   timerSec: 0,   endless: true  },
    timed:   { name: "限时挑战",   timerSec: 180, endless: false },
  },

  // ===== 限时挑战连击倍率 =====
  COMBO_MULTIPLIER_MAX: 10,

  // ===== 章节数 =====
  CHAPTER_COUNT: 6,
  STAGES_PER_CHAPTER: 5,

  // ===== 存档键名 =====
  SAVE_KEY: "stellar_thunder_save_v1",

  // ===== 调试 =====
  DEBUG: false,

  // ===== 性能上限（防止装备全开 + Boss弹幕时失控）=====
  MAX_PLAYER_BULLETS: 280,   // 玩家子弹最大并存数
  MAX_ENEMY_BULLETS: 400,    // 敌机/Boss 子弹最大并存数
  MAX_PARTICLES: 200,        // 粒子最大并存数（爆炸/特效）
};

// ============================================================
// 高性能数组过滤：原地 swap-pop，不重建数组
// 比 Array.filter 减少 GC 抖动（每帧调用 6+ 次）
// 用法：arr = _swapPopFilter(arr, x => !x.dead)
// ============================================================
function _swapPopFilter(arr, keep) {
  let w = 0;
  for (let r = 0; r < arr.length; r++) {
    if (keep(arr[r])) {
      if (w !== r) arr[w] = arr[r];
      w++;
    }
  }
  arr.length = w;
  return arr;
}
