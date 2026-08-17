/* ============================================================
   dropTable.js - Boss 宝箱掉落概率表
   品质：NORMAL / ELITE / LEGEND
   内容矩阵：装备（低/中/高）/ 技能（低/中/高）/ 积分补偿 / 强化石
   保底：同类宝箱 9 连空 → 第 10 次必出 1 件未拥有
   全局对象：DROP_TABLE, DROP_QUALITY, DROP_UTILS
   ============================================================ */

const DROP_QUALITY = {
  NORMAL: "normal",
  ELITE:  "elite",
  LEGEND: "legend",
};

// 宝箱品质按 Boss 档位（小/中/大 Boss）
const DROP_BOX_QUALITY_RATES = {
  // 小 Boss（波 10、20）
  mini:   { normal: 0.70, elite: 0.25, legend: 0.05 },
  // 中 Boss（波 25、50）
  mid:    { normal: 0.30, elite: 0.50, legend: 0.20 },
  // 大 Boss（波 50、100）
  big:    { normal: 0.05, elite: 0.35, legend: 0.60 },
};

// 宝箱内容权重矩阵（根据品质）
// pool：从哪些候选池选；weights：对应权重（整数）
// 强化石：每次必出（普通 1~3 / 精英 3~6 / 传说 6~12）
const DROP_CONTENT_MATRIX = {
  [DROP_QUALITY.NORMAL]: [
    // 装备·基础档（霰弹/炸弹/链球/切割环）
    { kind: "equip", pool: "low",  weight: 40 },
    // 装备·中端档
    { kind: "equip", pool: "mid",  weight: 25 },
    // 装备·高端档（浮游炮）
    { kind: "equip", pool: "high", weight: 2 },
    // 技能·基础档
    { kind: "skill", pool: "survive_control", weight: 15 },
    // 技能·中端档
    { kind: "skill", pool: "mid",   weight: 10 },
    // 技能·高端档（null，普通不出）
    { kind: "skill", pool: "high",  weight: 0 },
    // 积分补偿
    { kind: "coin",  amount: 500,  weight: 8 },
  ],
  [DROP_QUALITY.ELITE]: [
    { kind: "equip", pool: "low",  weight: 20 },
    { kind: "equip", pool: "mid",  weight: 40 },
    { kind: "equip", pool: "high", weight: 10 },
    { kind: "skill", pool: "survive_control", weight: 10 },
    { kind: "skill", pool: "mid",   weight: 12 },
    { kind: "skill", pool: "high",  weight: 5 },
    { kind: "coin",  amount: 1200, weight: 3 },
  ],
  [DROP_QUALITY.LEGEND]: [
    { kind: "equip", pool: "low",  weight: 5 },
    { kind: "equip", pool: "mid",  weight: 20 },
    { kind: "equip", pool: "high", weight: 25 },
    { kind: "skill", pool: "survive_control", weight: 5 },
    { kind: "skill", pool: "mid",   weight: 15 },
    { kind: "skill", pool: "high",  weight: 20 },
    { kind: "coin",  amount: 3000, weight: 5 },
    // 传说额外保底：必出 1 件高端装备或高端技能
    { kind: "legend_guarantee", weight: 5 },
  ],
};

// 技能分档（与装备对应：低/中/高端）
const SKILL_TIER = {
  // 基础档（生存 + 控制）
  survive_control: ["absoluteshield", "timerewind", "emp", "blackhole"],
  // 中端档
  mid:   ["meteor", "airstrike", "overclock"],
  // 高端档
  high:  ["berserk", "judgment", "mechform"],
};

// 强化石配置
const DROP_STONE = {
  [DROP_QUALITY.NORMAL]: { min: 1, max: 3, equip: 0.02, cdcut: 0.01 }, // 1~3 颗；每颗装备 +2% / 技能 CD -1%
  [DROP_QUALITY.ELITE]:  { min: 3, max: 6, equip: 0.02, cdcut: 0.01 },
  [DROP_QUALITY.LEGEND]: { min: 6, max: 12, equip: 0.02, cdcut: 0.01 },
};

// 重复掉落处理：已拥有装备/技能如何转化
const DROP_DUPLICATE_RULE = {
  equipDuplicate: { stones: 2, coin: 200 },      // 强化石 ×2 + 200 积分
  skillDuplicate: { spPlus: 5, coin: 300 },      // SP 上限永久 +5（叠加上限 50）+ 300 积分
  allMax:          { coinMul: 1.5 },             // 全部毕业：按价值 150% 返还积分
};

// 保底机制：同品质连续 N 次"没出货" → 第 N+1 次必出
// 定义"出货"：获得一件未拥有的装备 or 技能
const DROP_PITY = {
  threshold: 9,   // 9 连空
};

// ====================================================================
// 工具函数集合（实际掉落时调用）
// ====================================================================
const DROP_UTILS = {
  /**
   * 抽取品质（根据 Boss 档位）
   */
  rollQuality(bossTier = "mini") {
    const t = DROP_BOX_QUALITY_RATES[bossTier] || DROP_BOX_QUALITY_RATES.mini;
    const r = Math.random();
    let acc = 0;
    for (const [q, w] of Object.entries(t)) {
      acc += w;
      if (r <= acc) return q;
    }
    return DROP_QUALITY.NORMAL;
  },

  /**
   * 按品质抽取一次掉落内容（不含强化石，强化石单独处理）
   * @param quality   DROP_QUALITY
   * @param ownedEquip Set<string>  玩家已拥有的装备 id
   * @param ownedSkill Set<string>  玩家已拥有的技能 id
   * @param pityStreak number       当前该品质连续空次数（用于保底）
   * @returns {reward: Object, pityStreakNext: number}
   *   reward = { kind, id/tier/amount, isDuplicate, coin, stones, spPlus }
   */
  rollContent(quality, ownedEquip, ownedSkill, pityStreak = 0) {
    const matrix = DROP_CONTENT_MATRIX[quality];
    const totalW = matrix.reduce((a, b) => a + b.weight, 0);

    // 保底触发？
    const needPity = pityStreak >= DROP_PITY.threshold;

    let picked = null;
    if (needPity) {
      // 强制选一件未拥有的装备或技能（优先高端）
      picked = this._pickOwnedGuarantee(quality, ownedEquip, ownedSkill);
    } else {
      let r = Math.random() * totalW;
      for (const entry of matrix) {
        if (entry.weight <= 0) continue;
        if (r < entry.weight) { picked = entry; break; }
        r -= entry.weight;
      }
      if (!picked) picked = matrix[matrix.length - 1];
    }

    // 根据 picked 解析出具体奖励
    const reward = this._resolveReward(picked, quality, ownedEquip, ownedSkill);

    // 计算保底计数更新
    const hasItem = reward.kind === "equip" || reward.kind === "skill";
    const gotNew = hasItem && !reward.isDuplicate;
    const pityNext = gotNew ? 0 : (needPity ? 0 : pityStreak + 1);

    // 强化石（每箱必出，附加）
    const stoneConf = DROP_STONE[quality];
    reward.stones = stoneConf.min + Math.floor(Math.random() * (stoneConf.max - stoneConf.min + 1));
    reward.stoneEquipPer = stoneConf.equip; // 每颗 +2%
    reward.stoneCdcutPer = stoneConf.cdcut; // 每颗 -1%

    return { reward, pityStreakNext: pityNext };
  },

  _resolveReward(entry, quality, ownedEquip, ownedSkill) {
    // 积分补偿 / 传说保底直接返回
    if (entry.kind === "coin") {
      return { kind: "coin", amount: entry.amount, isDuplicate: false };
    }
    if (entry.kind === "legend_guarantee") {
      return this._resolveHighEnd(ownedEquip, ownedSkill);
    }

    if (entry.kind === "equip") {
      const pool = EQUIP_BY_TIER[entry.pool] || EQUIP_BY_TIER.low;
      // 优先未拥有
      const unowned = pool.filter(id => !ownedEquip.has(id));
      const choose = unowned.length > 0 ? unowned : pool;
      const id = choose[Math.floor(Math.random() * choose.length)];
      const dup = ownedEquip.has(id);
      const base = { kind: "equip", id, isDuplicate: dup };
      if (dup) {
        base.coin = DROP_DUPLICATE_RULE.equipDuplicate.coin;
        base.stones = (base.stones || 0) + DROP_DUPLICATE_RULE.equipDuplicate.stones;
      }
      return base;
    }

    if (entry.kind === "skill") {
      const pool = SKILL_TIER[entry.pool] || SKILL_TIER.survive_control;
      const unowned = pool.filter(id => !ownedSkill.has(id));
      const choose = unowned.length > 0 ? unowned : pool;
      const id = choose[Math.floor(Math.random() * choose.length)];
      const dup = ownedSkill.has(id);
      const base = { kind: "skill", id, isDuplicate: dup };
      if (dup) {
        base.coin = DROP_DUPLICATE_RULE.skillDuplicate.coin;
        base.spPlus = DROP_DUPLICATE_RULE.skillDuplicate.spPlus;
      }
      return base;
    }
    return { kind: "coin", amount: 500, isDuplicate: false };
  },

  // 传说保底：优先选高端装备/技能中未拥有的
  _resolveHighEnd(ownedEquip, ownedSkill) {
    const highEq = EQUIP_BY_TIER.high.filter(id => !ownedEquip.has(id));
    const highSk = SKILL_TIER.high.filter(id => !ownedSkill.has(id));
    if (highEq.length || highSk.length) {
      const mixed = [
        ...highEq.map(id => ({ kind: "equip", id })),
        ...highSk.map(id => ({ kind: "skill", id })),
      ];
      const pick = mixed[Math.floor(Math.random() * mixed.length)];
      return { kind: pick.kind, id: pick.id, isDuplicate: false };
    }
    // 全部拥有：返还 150% 价值积分
    return { kind: "coin", amount: Math.round(5000 * DROP_DUPLICATE_RULE.allMax.coinMul), isDuplicate: false, allMax: true };
  },

  _pickOwnedGuarantee(quality, ownedEquip, ownedSkill) {
    // 保底：强制选择一件未拥有的装备或技能
    const order = quality === DROP_QUALITY.LEGEND
      ? [["equip","high"],["skill","high"],["equip","mid"],["skill","mid"]]
      : quality === DROP_QUALITY.ELITE
      ? [["equip","mid"],["skill","mid"],["equip","low"],["skill","survive_control"]]
      : [["equip","low"],["skill","survive_control"],["equip","mid"],["skill","mid"]];
    for (const [kind, pool] of order) {
      if (kind === "equip") {
        const un = EQUIP_BY_TIER[pool].filter(id => !ownedEquip.has(id));
        if (un.length) return { kind, pool };
      } else {
        const un = (SKILL_TIER[pool] || []).filter(id => !ownedSkill.has(id));
        if (un.length) return { kind, pool };
      }
    }
    return { kind: "coin" }; // 极端情况全部拥有
  },
};
