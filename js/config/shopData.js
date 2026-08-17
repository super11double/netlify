/* ============================================================
   shopData.js - 积分商店配置表
   商品 = 装备 / 技能 / 永久强化 / 宝箱
   解锁条件（unlockWave）= 无尽挑战通过第 N 波后可购买
   全局对象：SHOP_DATA, SHOP_CATEGORY, SHOP_UTILS
   ============================================================ */

const SHOP_CATEGORY = {
  EQUIP:   "equip",
  SKILL:   "skill",
  UPGRADE: "upgrade",
  BOX:     "box",
  PLANE:   "plane",
};

// 每件商品
// type: 类别
// refId: 对应 EQUIP_DATA / ACTIVE_SKILL_DATA / UPGRADE 的 id
// price: 积分单价
// maxPurchases: 购买次数上限（null = 不限）
// unlockWave: 无尽挑战通过第几波后解锁（0 = 默认解锁）
const SHOP_DATA = [
  // =============== 装备 ===============
  { id: "S01", tab:"equip", category: "equip", emoji:"⚡", name:"等离子直线激光", type: SHOP_CATEGORY.EQUIP,   refId: "laser",     price: 3000, maxPurchases: 1, unlockWave: 0,
    desc:"持续直线光束锁定敌人，过热后短暂冷却" },
  { id: "S02", tab:"equip", category: "equip", emoji:"🚀", name:"追踪导弹", type: SHOP_CATEGORY.EQUIP,   refId: "missile",   price: 2500, maxPurchases: 1, unlockWave: 0,
    desc:"弧线追踪最近敌人，弹匣6发装填" },
  { id: "S03", tab:"equip", category: "equip", emoji:"💣", name:"范围炸弹", type: SHOP_CATEGORY.EQUIP,   refId: "bomb",      price: 2000, maxPurchases: 1, unlockWave: 5,
    desc:"抛物线抛射，大范围爆炸伤害（解锁条件：无尽波5）" },
  { id: "S04", tab:"equip", category: "equip", emoji:"🔵", name:"贯穿电磁炮", type: SHOP_CATEGORY.EQUIP,   refId: "railgun",   price: 4000, maxPurchases: 1, unlockWave: 10,
    desc:"高速直线贯穿，穿透无上限（解锁：无尽波10）" },
  { id: "S05", tab:"equip", category: "equip", emoji:"💛", name:"散射霰弹", type: SHOP_CATEGORY.EQUIP,   refId: "shotgun",   price: 1500, maxPurchases: 1, unlockWave: 0,
    desc:"扇形5发散射，近战爆发神器" },
  { id: "S06", tab:"equip", category: "equip", emoji:"🛰️", name:"浮游炮·召唤", type: SHOP_CATEGORY.EQUIP,   refId: "drone",     price: 5000, maxPurchases: 1, unlockWave: 15,
    desc:"召唤2架浮游炮环绕自动射击（解锁：无尽波15）" },
  { id: "S07", tab:"equip", category: "equip", emoji:"⛓️", name:"弹射链球", type: SHOP_CATEGORY.EQUIP,   refId: "chainball", price: 1800, maxPurchases: 1, unlockWave: 8,
    desc:"链球击中敌人/墙壁弹射3次（解锁：无尽波8）" },
  { id: "S08", tab:"equip", category: "equip", emoji:"🎯", name:"蓄力狙击炮", type: SHOP_CATEGORY.EQUIP,   refId: "sniper",    price: 3500, maxPurchases: 1, unlockWave: 12,
    desc:"蓄力后瞬发狙击，1-3秒蓄能伤害翻倍（解锁：无尽波12）" },
  { id: "S09", tab:"equip", category: "equip", emoji:"🔪", name:"近身切割环", type: SHOP_CATEGORY.EQUIP,   refId: "bladering", price: 2200, maxPurchases: 1, unlockWave: 6,
    desc:"玩家周身360°双刀片对转（解锁：无尽波6）" },
  { id: "S10", tab:"equip", category: "equip", emoji:"✳️", name:"子母弹", type: SHOP_CATEGORY.EQUIP,   refId: "cluster",   price: 2800, maxPurchases: 1, unlockWave: 9,
    desc:"母弹飞行中分裂为5发子弹（解锁：无尽波9）" },

  // =============== 技能 ===============
  { id: "S11", tab:"skill", category: "skill", emoji:"☄️", name:"天罚·万象轰炸", type: SHOP_CATEGORY.SKILL,   refId: "judgment",       price: 4500, maxPurchases: 1, unlockWave: 20,
    desc:"清屏爆发：全屏爆炸，清除普通敌+Boss大伤（解锁：无尽波20）" },
  { id: "S12", tab:"skill", category: "skill", emoji:"🌟", name:"星陨·连续轰炸", type: SHOP_CATEGORY.SKILL,   refId: "meteor",         price: 3500, maxPurchases: 1, unlockWave: 15,
    desc:"清屏爆发：10颗陨石随机砸落（解锁：无尽波15）" },
  { id: "S13", tab:"skill", category: "skill", emoji:"🛡️", name:"绝对护盾", type: SHOP_CATEGORY.SKILL,   refId: "absoluteshield", price: 3000, maxPurchases: 1, unlockWave: 0,
    desc:"生存保命：5秒无敌，吸收所有伤害" },
  { id: "S14", tab:"skill", category: "skill", emoji:"⏪", name:"时空回溯", type: SHOP_CATEGORY.SKILL,   refId: "timerewind",     price: 2800, maxPurchases: 1, unlockWave: 10,
    desc:"生存保命：回到3秒前位置与血量（解锁：无尽波10）" },
  { id: "S15", tab:"skill", category: "skill", emoji:"⚡", name:"EMP磁暴", type: SHOP_CATEGORY.SKILL,   refId: "emp",            price: 2200, maxPurchases: 1, unlockWave: 8,
    desc:"控制干扰：范围内敌人瘫痪3秒（解锁：无尽波8）" },
  { id: "S16", tab:"skill", category: "skill", emoji:"🕳️", name:"黑洞牵引", type: SHOP_CATEGORY.SKILL,   refId: "blackhole",      price: 3200, maxPurchases: 1, unlockWave: 12,
    desc:"控制干扰：5秒内吸引敌人至中心（解锁：无尽波12）" },
  { id: "S17", tab:"skill", category: "skill", emoji:"🔥", name:"狂暴觉醒", type: SHOP_CATEGORY.SKILL,   refId: "berserk",        price: 4000, maxPurchases: 1, unlockWave: 18,
    desc:"状态增幅：10秒装备伤害×2，射速+50%（解锁：无尽波18）" },
  { id: "S18", tab:"skill", category: "skill", emoji:"💨", name:"极速过载", type: SHOP_CATEGORY.SKILL,   refId: "overclock",      price: 3800, maxPurchases: 1, unlockWave: 16,
    desc:"状态增幅：8秒射速翻倍，冷却过热清零（解锁：无尽波16）" },
  { id: "S19", tab:"skill", category: "skill", emoji:"✈️", name:"战术空袭", type: SHOP_CATEGORY.SKILL,   refId: "airstrike",      price: 3600, maxPurchases: 1, unlockWave: 14,
    desc:"战术召唤：召唤3架友机协战15秒（解锁：无尽波14）" },
  { id: "S20", tab:"skill", category: "skill", emoji:"🤖", name:"机甲形态", type: SHOP_CATEGORY.SKILL,   refId: "mechform",       price: 6000, maxPurchases: 1, unlockWave: 25,
    desc:"战术召唤：变身机甲12秒，双倍伤害+锁定（解锁：无尽波25）" },

  // =============== 永久强化 ===============
  { id: "S21", tab:"upgrade", category: "upgrade", emoji:"🔮", name:"SP 上限强化", type: SHOP_CATEGORY.UPGRADE, refId: "spmax",   price: 2000, maxPurchases: 5, unlockWave: 0,
    desc: "SP 上限 +20（最多叠加至 +100 额外）",
    apply: (u, lv) => { u.spMaxBonus = 20 * lv; },
    priceFn: (lv) => 2000 + lv * 500 },
  { id: "S22", tab:"upgrade", category: "upgrade", emoji:"⏱️", name:"技能CD 缩减", type: SHOP_CATEGORY.UPGRADE, refId: "cdcut",   price: 1500, maxPurchases: 10, unlockWave: 0,
    desc: "全部技能 CD -5%（每级叠加，最多 -50%）",
    apply: (u, lv) => { u.skillCdMul = Math.pow(0.95, lv); },
    priceFn: (lv) => 1500 + lv * 300 },
  { id: "S23", tab:"upgrade", category: "upgrade", emoji:"⚔️", name:"装备伤害增幅", type: SHOP_CATEGORY.UPGRADE, refId: "eqdmg",   price: 1800, maxPurchases: 15, unlockWave: 5,
    desc: "全部装备伤害 +3%（每级叠加，最多 +45%）",
    apply: (u, lv) => { u.equipDmgMul = 1 + 0.03 * lv; },
    priceFn: (lv) => 1800 + lv * 400 },

  // =============== 宝箱 ===============
  { id: "S24", tab:"chest", category: "chest", emoji:"📦", name:"随机装备宝箱", type: SHOP_CATEGORY.BOX,     refId: "equipBox",  price: 1200, maxPurchases: null, unlockWave: 0,
    desc: "随机装备宝箱：开 1 件未拥有装备；全拥有则返还 1000 积分" },
  { id: "S25", tab:"chest", category: "chest", emoji:"🎁", name:"随机技能宝箱", type: SHOP_CATEGORY.BOX,     refId: "skillBox",  price: 1500, maxPurchases: null, unlockWave: 0,
    desc: "随机技能宝箱：开 1 件未拥有技能；全拥有则返还 1000 积分" },

  // =============== 战机（积分商店购买解锁，购买后永久拥有；同时保留原有「通关章节解锁」途径）===============
  { id: "P02", tab:"plane", category: "plane", emoji:"🛩️", name:"暗影刺客",   type: SHOP_CATEGORY.PLANE, refId: "F02", price: 1200,  maxPurchases: 1, unlockWave: 0,
    desc:"高速型 · 单发高伤子弹，移速快判定小，适合走位流（也可通关第2章解锁）" },
  { id: "P03", tab:"plane", category: "plane", emoji:"🚁", name:"重装堡垒",   type: SHOP_CATEGORY.PLANE, refId: "F03", price: 3000,  maxPurchases: 1, unlockWave: 0,
    desc:"重火力型 · 四发散射高血量，移动慢但输出猛（也可通关第4章解锁）" },
  { id: "P04", tab:"plane", category: "plane", emoji:"👻", name:"量子幽灵",   type: SHOP_CATEGORY.PLANE, refId: "F04", price: 6000,  maxPurchases: 1, unlockWave: 0,
    desc:"技巧型 · 三发追踪弹，15% 概率闪避伤害（隐藏战机，积分商店直接解锁）" },
  { id: "P05", tab:"plane", category: "plane", emoji:"🔥", name:"灭世神罚",   type: SHOP_CATEGORY.PLANE, refId: "F05", price: 9000,  maxPurchases: 1, unlockWave: 0,
    desc:"狂暴型 · 六发散射+激光副武器，全能输出（隐藏战机，积分商店直接解锁）" },
  { id: "P06", tab:"plane", category: "plane", emoji:"✨", name:"虚空主宰",   type: SHOP_CATEGORY.PLANE, refId: "F06", price: 16000, maxPurchases: 1, unlockWave: 0,
    desc:"终极型 · 全屏弹幕+黑洞技能，终极形态（隐藏战机，积分商店直接解锁）" },
];

// 辅助工具集合
const SHOP_UTILS = {
  /** 按 id 查商品 */
  byId(id) { return SHOP_DATA.find(s => s.id === id); },
  /** 按类别过滤 */
  byCategory(cat) { return SHOP_DATA.filter(s => s.type === cat); },
  /** 无尽挑战达到 wave 时，解锁的商品列表 */
  availableAt(wave) { return SHOP_DATA.filter(s => wave >= s.unlockWave); },
  /** 查询商品显示名/简介 */
  display(s) {
    if (s.type === SHOP_CATEGORY.PLANE) {
      const d = PLANE_DATA[s.refId];
      return {
        name: (d.name || s.refId) + " · " + (d.role || "战机"),
        desc: (d.desc || s.desc) + (d.unlockDesc ? `（原解锁途径：${d.unlockDesc}）` : ""),
      };
    }
    if (s.type === SHOP_CATEGORY.EQUIP) {
      const d = EQUIP_DATA[s.refId];
      return { name: d.name, desc: d.coexist || "自动攻击装备" };
    }
    if (s.type === SHOP_CATEGORY.SKILL) {
      const d = ACTIVE_SKILL_DATA[s.refId];
      return { name: d.name, desc: `SP ${d.spCost} · CD ${d.cdSec}s · ${d.short}` };
    }
    if (s.type === SHOP_CATEGORY.UPGRADE) {
      return { name: s.refId, desc: s.desc };
    }
    if (s.type === SHOP_CATEGORY.BOX) {
      if (s.refId === "equipBox") return { name: "随机装备宝箱", desc: s.desc };
      return { name: "随机技能宝箱", desc: s.desc };
    }
    return { name: "未知商品", desc: "" };
  },
};

// 无尽挑战积分基准：第 N 波击杀奖励
function endlessWaveScore(wave) {
  return Math.round(50 * wave);
}
// 击败 Boss 奖励（按波次）
function endlessBossScore(wave) {
  return Math.round(500 * Math.max(1, Math.ceil(wave / 10)));
}
