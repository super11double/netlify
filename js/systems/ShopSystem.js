/* ============================================================
   ShopSystem.js - 积分商店 & 装备仓库 UI
   功能：
     - 按类别展示商品（装备/技能/强化/宝箱）
     - 购买（积分不够/已解锁/达到限购 → 拒绝）
     - 仓库面板：装备装/拆；技能装配到 3 个槽位
     - 与 SaveSystem / EquipSystem / ActiveSkillSystem 对接
   ============================================================ */
class ShopSystem {
  constructor(game) {
    this.game = game;

    // 玩家积分（持久化）
    this.credits = 0;

    // 购买次数记录（按商品 id）
    this.purchaseCount = {};

    // 升级等级（按 upgrade refId）
    this.upgradeLevel = {};

    // UI 可见性（由 UISystem 读取）
    this.visible = false;
    this.tab = "equip"; // equip / skill / upgrade / box / inventory
  }

  // ======================================================================
  // 保存 / 加载（给 SaveSystem 调用）
  // ======================================================================
  toSave() {
    return {
      credits: this.credits,
      purchaseCount: this.purchaseCount,
      upgradeLevel: this.upgradeLevel,
      ownedEquips: Array.from(this.game.equips.ownedEquips),
      ownedSkills: Array.from(this.game.activeSkills.ownedSkills),
      equippedIds: this.game.equips.equippedIds,
      skillSlots: this.game.activeSkills.slots,
    };
  }
  fromSave(data) {
    if (!data) return;
    this.credits = data.credits || 0;
    this.purchaseCount = data.purchaseCount || {};
    this.upgradeLevel = data.upgradeLevel || {};
    for (const id of (data.ownedEquips || [])) this.game.equips.unlockEquip(id);
    for (const id of (data.ownedSkills || [])) this.game.activeSkills.unlockSkill(id);

    // 新存档兜底：默认解锁 3 件初始装备（shotgun + laser + missile）
    // 确保玩家在 CH1 就有基础 DPS，不会"前期啥都没有硬怼厚血Boss"
    const STARTER_EQUIPS = ["shotgun", "laser", "missile"];
    const isNewSave = !data.ownedEquips || data.ownedEquips.length === 0;
    if (isNewSave) {
      for (const id of STARTER_EQUIPS) this.game.equips.unlockEquip(id);
    }

    if (data.equippedIds && data.equippedIds.length > 0) {
      // 一次性装配已拥有的（equip 本身会校验）
      this.game.equips.equippedIds = [];
      for (const id of data.equippedIds) this.game.equips.equip(id);
      if (this.game.equips.equippedIds.length === 0) this.game.equips.equip(EQUIP_DEFAULT_FALLBACK);
    } else if (isNewSave) {
      // 新存档默认装配 3 件初始装备
      this.game.equips.equippedIds = [];
      for (const id of STARTER_EQUIPS) this.game.equips.equip(id);
    }
    if (data.skillSlots) this.game.activeSkills.setSlots(data.skillSlots);

    // 重放永久强化效果
    for (const [refId, lv] of Object.entries(this.upgradeLevel)) {
      this._applyUpgrade(refId, lv);
    }
  }

  // ======================================================================
  // 积分变更
  // ======================================================================
  addCredits(n) {
    this.credits = Math.max(0, this.credits + n);
    if (this.game.ui) this.game.ui.onCreditsChange && this.game.ui.onCreditsChange(this.credits);
  }

  // ======================================================================
  // 购买
  // ======================================================================
  canBuy(shopId) {
    const item = SHOP_UTILS.byId(shopId);
    if (!item) return { ok: false, reason: "商品不存在" };
    // 解锁条件：无尽模式最高到达波
    const maxWave = (this.game.score && this.game.score.maxEndlessWave) || 0;
    if (maxWave < item.unlockWave) return { ok: false, reason: `需无尽模式通过第 ${item.unlockWave} 波解锁` };
    // === 先检查「已拥有」类商品：装备 / 技能 / 战机 只能解锁一次，优先显示 "已拥有" ===
    if (item.type === SHOP_CATEGORY.EQUIP && this.game.equips.ownedEquips.has(item.refId))
      return { ok: false, reason: "已拥有该装备" };
    if (item.type === SHOP_CATEGORY.SKILL && this.game.activeSkills.ownedSkills.has(item.refId))
      return { ok: false, reason: "已拥有该技能" };
    if (item.type === SHOP_CATEGORY.PLANE && this.game.save.isPlaneUnlocked(item.refId))
      return { ok: false, reason: "已拥有该战机" };
    // === 再检查限购（防止重复购买次数类的商品）===
    const cnt = this.purchaseCount[shopId] || 0;
    const limit = item.maxPurchases != null ? item.maxPurchases : item.limit;
    if (limit != null && cnt >= limit) {
      return { ok: false, reason: "已达购买上限" };
    }
    // 积分
    const price = item.priceFn ? item.price(this.upgradeLevel[shopId] || (this.upgradeLevel[item.refId] || 0)) : item.price;
    if (this.credits < price) return { ok: false, reason: "积分不足" };
    return { ok: true };
  }

  buy(shopId) {
    const chk = this.canBuy(shopId);
    if (!chk.ok) return chk;
    const item = SHOP_UTILS.byId(shopId);
    const price = item.priceFn ? item.price(this.upgradeLevel[item.refId] || 0) : item.price;
    this.credits = Math.max(0, this.credits - price);
    this.purchaseCount[shopId] = (this.purchaseCount[shopId] || 0) + 1;

    let gained = "";
    switch (item.type) {
      case SHOP_CATEGORY.EQUIP:
        this.game.equips.unlockEquip(item.refId);
        gained = `获得装备：${(EQUIP_DATA[item.refId]||{}).name || item.refId}`;
        break;
      case SHOP_CATEGORY.SKILL:
        this.game.activeSkills.unlockSkill(item.refId);
        gained = `获得技能：${(ACTIVE_SKILL_DATA[item.refId]||{}).name || item.refId}`;
        break;
      case SHOP_CATEGORY.PLANE: {
        const ok = this.game.save.unlockPlane(item.refId);
        const pd = PLANE_DATA[item.refId] || {};
        gained = (ok ? "解锁战机：" : "战机已解锁：") + (pd.name || item.refId);
        break;
      }
      case SHOP_CATEGORY.UPGRADE:
        this.upgradeLevel[item.refId] = (this.upgradeLevel[item.refId] || 0) + 1;
        this._applyUpgrade(item.refId, this.upgradeLevel[item.refId]);
        gained = `强化成功 Lv.${this.upgradeLevel[item.refId]}`;
        break;
      case SHOP_CATEGORY.BOX:
        const boxInfo = this._openBox(item.refId);
        gained = boxInfo || "宝箱开启";
        break;
    }
    // 保存
    try { this.game.save.save(); } catch (e) {}
    if (this.game.ui && this.game.ui.onCreditsChange) this.game.ui.onCreditsChange();
    return { ok: true, gained };
  }

  _applyUpgrade(refId, lv) {
    // 根据 shopData 中 apply 函数（模拟相同的逻辑）
    const u = {};
    const item = SHOP_DATA.find(s => s.type === SHOP_CATEGORY.UPGRADE && s.refId === refId);
    if (!item || !item.apply) return;
    item.apply(u, lv);
    if (u.spMaxBonus) {
      // 设置 SP 上限额外值
      const base = this.game.activeSkills.spMax;
      const needed = u.spMaxBonus;
      // 重设：先重置再加上（但已逐步购买，故只 +delta）
      this.game.activeSkills.addSpMax(needed);
    }
    if (u.skillCdMul) {
      this.game.activeSkills.globalCdMul = u.skillCdMul;
    }
    if (u.equipDmgMul) {
      // 通过 EquipSystem 暴露一个 setShopDmgMul 字段（使用全局 globalDmgMul 额外乘）
      this.game.equips.shopDmgMul = u.equipDmgMul;
    }
  }

  // ======================================================================
  // 宝箱开启
  // ======================================================================
  _openBox(boxRefId) {
    const eqSys = this.game.equips;
    const skSys = this.game.activeSkills;
    const ownedEq = eqSys.ownedEquips;
    const ownedSk = skSys.ownedSkills;

    const pool = boxRefId === "equipBox"
      ? EQUIP_POOL.filter(id => !ownedEq.has(id))
      : ACTIVE_SKILL_POOL.filter(id => !ownedSk.has(id));

    if (pool.length === 0) {
      // 全部拥有：返还 1000 积分
      this.addCredits(1000);
      return "全拥有，返还 💰1000 积分";
    }
    const id = pool[Math.floor(Math.random() * pool.length)];
    if (boxRefId === "equipBox") {
      eqSys.unlockEquip(id);
      return `获得装备：${(EQUIP_DATA[id]||{}).name || id}`;
    } else {
      skSys.unlockSkill(id);
      return `获得技能：${(ACTIVE_SKILL_DATA[id]||{}).name || id}`;
    }
  }

  // ======================================================================
  // 仓库 UI 接口（首页用：至少 1 件装备约束、装备装拆、技能装配）
  // ======================================================================
  isOwned(shopId) {
    const it = SHOP_UTILS.byId(shopId);
    if (!it) return false;
    if (it.type === SHOP_CATEGORY.EQUIP) return this.game.equips.ownedEquips.has(it.refId);
    if (it.type === SHOP_CATEGORY.SKILL) return this.game.activeSkills.ownedSkills.has(it.refId);
    if (it.type === SHOP_CATEGORY.PLANE) return this.game.save.isPlaneUnlocked(it.refId);
    return false;
  }

  // 装备装备（到 EquipSystem 槽位）
  equipEquip(id) {
    if (!this.game.equips.ownedEquips.has(id)) return false;
    this.game.equips.equip(id);
    try { this.game.save.save(); } catch (e) {}
    return true;
  }
  // 卸下装备（至少保留 1 件）
  unequipEquip(id) {
    if (this.game.equips.equippedIds.length <= 1) return false;
    this.game.equips.unequip(id);
    // 兜底：卸完没装备 → 自动装备默认霰弹
    if (this.game.equips.equippedIds.length === 0) this.game.equips.equip(EQUIP_DEFAULT_FALLBACK);
    try { this.game.save.save(); } catch (e) {}
    return true;
  }

  // 装配技能到 3 槽位（slotKey = slot1/slot2/slot3）
  setSkillSlot(slotKey, skillId) {
    const map = { slot1: 0, slot2: 1, slot3: 2 };
    const idx = map[slotKey];
    if (idx == null) return false;
    const slots = [...this.game.activeSkills.slots];
    if (skillId) {
      if (!this.game.activeSkills.ownedSkills.has(skillId)) return false;
      // 如果技能在其他槽位，先卸下
      const otherIdx = slots.indexOf(skillId);
      if (otherIdx >= 0) slots[otherIdx] = null;
    }
    slots[idx] = skillId || null;
    this.game.activeSkills.setSlots(slots);
    try { this.game.save.save(); } catch (e) {}
    return true;
  }
}
