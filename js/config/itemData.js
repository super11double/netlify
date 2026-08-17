/* ============================================================
   itemData.js - 道具配置 + 掉落概率算法
   全局对象：ITEM_DATA, rollItemDrop
   ============================================================ */
const ITEM_DATA = {
  P:   { id: "P",   name: "火力强化", color: "#00f0ff", glyph: "P",  desc: "火力等级 +1（上限 Lv8）" },
  S:   { id: "S",   name: "量子护盾", color: "#39ff14", glyph: "S",  desc: "获得 1 层护盾（抵挡1次伤害）" },
  H:   { id: "H",   name: "生命恢复", color: "#ff00aa", glyph: "H",  desc: "恢复 25% 最大生命值" },
  C:   { id: "C",   name: "金币",     color: "#fff200", glyph: "C",  desc: "获得金币（10-50 随机）" },
  E:   { id: "E",   name: "能量",     color: "#b400ff", glyph: "E",  desc: "必杀技能量 +30%" },
  B:   { id: "B",   name: "清屏炸弹", color: "#ff6b00", glyph: "B",  desc: "获得 1 枚全屏清屏炸弹" },
  X:   { id: "X",   name: "技能芯片", color: "#ff003c", glyph: "X",  desc: "随机获得 1 个技能芯片（3选1）" },
  EXP: { id: "EXP", name: "经验球",   color: "#39ff14", glyph: "★", desc: "获得经验值（升级提升基础属性）" },
};

// 概率掉落算法（累积分布，与文档一致）
function rollItemDrop() {
  const r = Math.random() * 100;
  if (r < 12) return "P";      // 12%
  if (r < 18) return "S";      // 6%
  if (r < 23) return "H";      // 5%
  if (r < 43) return "C";      // 20%
  if (r < 51) return "E";      // 8%
  if (r < 54) return "B";      // 3%
  if (r < 58) return "X";      // 4%
  if (r < 73) return "EXP";    // 15%
  return null;                 // 27% 不掉
}

// 经验球给的经验值（按敌机等级微调）
function expValue(base) { return Math.round(base * (0.8 + Math.random() * 0.6)); }
