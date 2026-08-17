/* ============================================================
   ScoreSystem.js - 积分 & 无尽挑战系统
   功能：
     - 无尽挑战每波/Boss 击败积分累加
     - 无尽最高波次记录（用于商品解锁）
     - Boss 击败后：根据 Boss 档位抽取宝箱 → dropTable.js
   ============================================================ */
class ScoreSystem {
  constructor(game) {
    this.game = game;

    // 存档数据
    this.maxEndlessWave = 0;           // 无尽最高波
    this.totalCreditsEarned = 0;       // 累计获得积分
    // 保底计数：{ normal: n, elite: n, legend: n }（连续空次数）
    this.pityStreak = { normal: 0, elite: 0, legend: 0 };
    // 历史宝箱数量（统计）
    this.boxOpened = 0;
  }

  // ======================================================================
  // 持久化
  // ======================================================================
  toSave() {
    return {
      maxEndlessWave: this.maxEndlessWave,
      totalCreditsEarned: this.totalCreditsEarned,
      pityStreak: this.pityStreak,
      boxOpened: this.boxOpened,
    };
  }
  fromSave(data) {
    if (!data) return;
    this.maxEndlessWave = data.maxEndlessWave || 0;
    this.totalCreditsEarned = data.totalCreditsEarned || 0;
    this.pityStreak = data.pityStreak || { normal: 0, elite: 0, legend: 0 };
    this.boxOpened = data.boxOpened || 0;
  }

  // ======================================================================
  // 无尽模式积分计算（每波击杀）
  // ======================================================================
  /** 每波结束时结算 */
  settleEndlessWave(wave, killsInWave) {
    const base = endlessWaveScore(wave);
    const gained = Math.round(base * (1 + killsInWave * 0.002));
    if (this.game.shop) this.game.shop.addCredits(gained);
    this.totalCreditsEarned += gained;
    if (wave > this.maxEndlessWave) this.maxEndlessWave = wave;
    return gained;
  }

  /** 击败 Boss（非波次击杀）奖励 */
  settleEndlessBoss(wave) {
    const gained = endlessBossScore(wave);
    if (this.game.shop) this.game.shop.addCredits(gained);
    this.totalCreditsEarned += gained;
    return gained;
  }

  // ======================================================================
  // Boss 宝箱掉落
  // bossTier = mini / mid / big
  // 返回：{ quality, reward }
  // ======================================================================
  rollBossChest(bossTier = "mini") {
    const quality = DROP_UTILS.rollQuality(bossTier);
    const streak = this.pityStreak[quality] || 0;
    const ownedEq = this.game.equips ? this.game.equips.ownedEquips : new Set();
    const ownedSk = this.game.activeSkills ? this.game.activeSkills.ownedSkills : new Set();
    const { reward, pityStreakNext } = DROP_UTILS.rollContent(quality, ownedEq, ownedSk, streak);
    this.pityStreak[quality] = pityStreakNext;
    this.boxOpened += 1;

    // 应用奖励
    this._applyReward(reward);

    return { quality, reward };
  }

  _applyReward(r) {
    const g = this.game;
    if (!g.shop) return;

    // 新装备
    if (r.kind === "equip" && !r.isDuplicate) {
      g.equips && g.equips.unlockEquip(r.id);
    }
    // 重复装备 → 积分 + 强化石
    if (r.kind === "equip" && r.isDuplicate) {
      if (r.coin) g.shop.addCredits(r.coin);
      // stones 已在 rollContent 时累积到 r.stones
    }
    // 新技能
    if (r.kind === "skill" && !r.isDuplicate) {
      g.activeSkills && g.activeSkills.unlockSkill(r.id);
    }
    if (r.kind === "skill" && r.isDuplicate) {
      if (r.coin) g.shop.addCredits(r.coin);
      if (r.spPlus && g.activeSkills) g.activeSkills.addSpMax(r.spPlus);
    }
    if (r.kind === "coin") {
      g.shop.addCredits(r.amount || 0);
    }
    // 强化石（每箱必出，装备石 / CD 石交替计算）
    if (r.stones && r.stones > 0) {
      // 每颗：+2% 装备永久伤害、-1% CD（交替处理，简化：统一按每颗）
      for (let i = 0; i < r.stones; i++) {
        const eqMul = (g.equips.shopDmgMul || 1) * 1 + (r.stoneEquipPer || 0.02);
        g.equips.shopDmgMul = Math.min(2.5, (g.equips.shopDmgMul || 1) + (r.stoneEquipPer || 0.02));
        if (g.activeSkills) {
          g.activeSkills.globalCdMul = Math.max(0.25, g.activeSkills.globalCdMul * (1 - (r.stoneCdcutPer || 0.01)));
        }
      }
    }
  }
}
