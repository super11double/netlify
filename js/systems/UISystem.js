/* ============================================================
   UISystem.js - UI 界面切换 + HUD 同步 + 战机仓库 + 排行
   通过显示/隐藏 .screen 元素实现界面流转
   ============================================================ */
class UISystem {
  constructor(game) {
    this.game = game;
    this.screens = {
      title:    document.getElementById("screen-title"),
      mode:     document.getElementById("screen-mode"),
      levels:   document.getElementById("screen-levels"),
      hangar:   document.getElementById("screen-hangar"),
      shop:     document.getElementById("screen-shop"),
      rank:     document.getElementById("screen-rank"),
      settings: document.getElementById("screen-settings"),
      hud:      document.getElementById("screen-hud"),
      pause:    document.getElementById("screen-pause"),
      chip:     document.getElementById("screen-chip"),
      result:   document.getElementById("screen-result"),
    };
    this._shopTab = "equip";
    this._bindActions();
    this._bindSettings();
    this._bindShopTabs();
  }

  _show(name) {
    for (const k in this.screens) {
      if (k === "hud") continue;
      this.screens[k].classList.remove("active");
    }
    if (name && this.screens[name]) this.screens[name].classList.add("active");
    // HUD 单独控制
    this.screens.hud.classList.toggle("active", name === "hud");
  }

  showTitle() {
    this._show("title");
    const sv = this.game.save.get();
    document.getElementById("title-highscore").textContent = (sv.highScore || 0).toLocaleString();
    // 首页底部显示积分
    const pts = (this.game.shop && this.game.shop.credits) || 0;
    const pe = document.getElementById("title-points");
    if (pe) pe.textContent = pts.toLocaleString();
  }
  showMode() { this._show("mode"); }
  /**
   * 选关界面：展示 6章 × 5关 = 30 关
   * - 已解锁：可点击，有边框高亮
   * - 未解锁：置灰 + 🔒，禁用
   * - 当前通关点：⭐ 特别标记（可选）
   */
  showLevels() {
    const save = this.game.save;
    const grid = document.getElementById("levels-grid");
    grid.innerHTML = "";
    const totalCh = CONFIG.CHAPTER_COUNT;
    const stPerCh = CONFIG.STAGES_PER_CHAPTER;
    // 顶部解锁进度显示
    const prog = save.get().progress;
    document.getElementById("levels-progress").textContent =
      `已解锁：第${prog.maxUnlockedChapter||1}章 - 第${prog.maxUnlockedStage||1}关 ｜ ` +
      `已完整通关章节：${prog.chapterCleared||0} / ${totalCh}`;
    for (let ch = 1; ch <= totalCh; ch++) {
      const chapterWrap = document.createElement("div");
      chapterWrap.className = "level-chapter";
      const header = document.createElement("div");
      header.className = "level-chapter-title";
      header.innerHTML = `第${ch}章`;
      chapterWrap.appendChild(header);
      const stageGrid = document.createElement("div");
      stageGrid.className = "level-stage-grid";
      for (let st = 1; st <= stPerCh; st++) {
        const unlocked = save.isLevelUnlocked(ch, st);
        const btn = document.createElement("button");
        btn.className = "level-stage-btn " + (unlocked ? "unlocked" : "locked");
        btn.innerHTML = unlocked
          ? `<span class="stage-num">${ch}-${st}</span>`
          : `<span class="stage-num">${ch}-${st}</span><span class="lock-icon">🔒</span>`;
        if (unlocked) {
          btn.onclick = () => {
            if (this.game.audio) this.game.audio.play("uiClick");
            this.game.startGame("level", { chapter: ch, stage: st });
          };
        } else {
          btn.disabled = true;
          btn.title = "通关前一关后解锁";
        }
        stageGrid.appendChild(btn);
      }
      chapterWrap.appendChild(stageGrid);
      grid.appendChild(chapterWrap);
    }
    this._show("levels");
  }
  showHangar() { this._renderHangar(); this._show("hangar"); }
  showRank() { this._renderRank(); this._show("rank"); }
  showSettings() { this._show("settings"); }
  showShop() {
    try { this._renderShop(); } catch (e) { console.error("[renderShop]", e); }
    this._show("shop");
  }
  showHUD() { this._show("hud"); }
  showPause() { this.screens.pause.classList.add("active"); }
  hidePause() { this.screens.pause.classList.remove("active"); }
  showResult(data) { this._renderResult(data); this._show("result"); }

  hideChip() { this.screens.chip.classList.remove("active"); }
  showChip(cards, onPick) {
    // 防御：已经显示芯片时，不要重复创建 DOM 覆盖回调
    if (this.screens.chip.classList.contains("active")) return;
    const wrap = document.getElementById("chip-cards");
    wrap.innerHTML = "";
    for (const c of cards) {
      const def = SKILL_DATA[c];
      if (!def) continue;
      const cur = this.game.player && this.game.player.equippedChips
        ? this.game.player.equippedChips.find(x => x.id === c)
        : null;
      const lvl = cur ? cur.level : 0;
      const el = document.createElement("div");
      el.className = "chip-card " + def.cat;
      el.innerHTML = `
        <div class="chip-emoji">${def.emoji || ""}</div>
        <div class="chip-name">${def.name || c}</div>
        <div class="chip-desc">${def.desc || ""}</div>
        <div class="chip-level">${lvl > 0 ? "当前 Lv." + lvl + " → " + (lvl + 1) : "未拥有 → Lv.1"}</div>
      `;
      el.onclick = () => {
        if (el.dataset._picked === "1") return; // 防止玩家连点重复触发
        el.dataset._picked = "1";
        if (this.game.audio) this.game.audio.play("chipSelect");
        onPick(c);
      };
      wrap.appendChild(el);
    }
    this.screens.chip.classList.add("active");
  }

  // 安全 clamp 工具
  _pct(v) { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) + "%" : "0%"; }
  _num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
  _str(v) { const n = Number(v); return Number.isFinite(n) ? Math.round(n).toLocaleString() : "0"; }

  // HUD 同步（每 10 帧调用一次，数值全防御 clamp 避免 layout 死循环）
  syncHUD() {
    const g = this.game, p = g.player;
    if (!p) return;
    // score
    document.getElementById("hud-score").textContent = this._str(g.state.score);
    // hp bar
    const hpPct = this._num(p.hp) / this._num(p.maxHp, 1) * 100;
    document.getElementById("bar-hp").style.width = this._pct(hpPct);
    // sp bar（两套系统合并显示：Player.skillEnergy + activeSkills.spPct 的较大值）
    let spPct = this._num(p.skillEnergy);
    if (g.activeSkills) spPct = Math.max(spPct, g.activeSkills.spPct() * 100);
    document.getElementById("bar-sp").style.width = this._pct(spPct);
    document.getElementById("hud-combo").textContent = "×" + this._num(g.state.combo);
    document.getElementById("hud-shield").textContent = this._num(p.shieldLayers);
    document.getElementById("hud-bomb").textContent = this._num(p.bombs);
    document.getElementById("hud-power").textContent = this._num(p.powerLevel);

    // 必杀按钮
    const btn = document.getElementById("btn-skill");
    const cdTxt = document.getElementById("skill-cd");
    if (p.canUseSkill()) {
      btn.classList.add("ready"); btn.classList.remove("cooling");
      if (cdTxt) cdTxt.textContent = "";
    } else {
      btn.classList.remove("ready");
      if (p.skillCdTimer > 0) {
        btn.classList.add("cooling");
        if (cdTxt) cdTxt.textContent = Math.ceil(this._num(p.skillCdTimer) / 1000);
      } else if (spPct < 100) {
        btn.classList.add("cooling");
        if (cdTxt) cdTxt.textContent = Math.floor(spPct) + "%";
      } else {
        btn.classList.remove("cooling");
        if (cdTxt) cdTxt.textContent = "";
      }
    }

    // 关卡显示
    if (g.state.mode === "level") {
      document.getElementById("hud-stage").textContent = `第${g.state.chapter}章-第${g.state.stage}关`;
    } else if (g.state.mode === "endless") {
      document.getElementById("hud-stage").textContent = `无尽 · 波${this._num(g.state.wave)}`;
    } else {
      document.getElementById("hud-stage").textContent = `限时挑战`;
    }
    // 关卡进度条（仅闯关模式 level 显示）
    const lpw = document.getElementById("level-progress-wrap");
    if (lpw) {
      if (g.state.mode === "level") {
        const lp = typeof g.getLevelProgress === "function" ? g.getLevelProgress() : 0;
        const lpN = this._num(lp);
        lpw.style.display = "";
        document.getElementById("bar-level").style.width = this._pct(lpN);
        const pctTxt = document.getElementById("hud-level-pct");
        if (pctTxt) pctTxt.textContent = Math.round(lpN) + "%";
      } else {
        lpw.style.display = "none";
      }
    }
    // 计时器
    const tw = document.getElementById("hud-timer-wrap");
    if (g.state.timerActive) {
      tw.style.display = "";
      const sec = Math.max(0, Math.ceil(this._num(g.state.timer) / 1000));
      document.getElementById("hud-timer").textContent = `${Math.floor(sec/60)}:${String(sec%60).padStart(2,"0")}`;
    } else tw.style.display = "none";
    // Boss 血条
    const bw = document.getElementById("boss-bar-wrap");
    if (g.boss && !g.boss.dead) {
      bw.style.display = "";
      document.getElementById("boss-name").textContent = g.boss.name + (g.boss.berserk ? " [狂暴]" : "");
      const bossPct = this._num(g.boss.hp) / this._num(g.boss.maxHp, 1) * 100;
      document.getElementById("bar-boss").style.width = this._pct(bossPct);
    } else bw.style.display = "none";

    // 移动端：炸弹角标 + 必杀CD
    const tBombCnt = document.getElementById("touch-bomb-count");
    if (tBombCnt) tBombCnt.textContent = this._num(p.bombs);
    const tSkill = document.getElementById("touch-skill");
    const tSkillCd = document.getElementById("touch-skill-cd");
    if (tSkill && tSkillCd) {
      if (p.canUseSkill()) {
        tSkill.classList.remove("cooling");
        tSkillCd.textContent = "";
      } else {
        tSkill.classList.add("cooling");
        if (p.skillCdTimer > 0) tSkillCd.textContent = Math.ceil(this._num(p.skillCdTimer) / 1000);
        else if (spPct < 100) tSkillCd.textContent = Math.floor(spPct) + "%";
        else tSkillCd.textContent = "";
      }
    }
  }

  _renderHangar() {
    const list = document.getElementById("hangar-list");
    list.innerHTML = "";
    const save = this.game.save.get();
    for (const id of PLANE_ORDER) {
      const d = PLANE_DATA[id];
      const unlocked = this.game.isPlaneUnlocked(id, save);
      const sel = save.selectedPlane === id;
      const el = document.createElement("button");
      el.className = "hangar-card" + (unlocked ? "" : " locked") + (sel ? " selected" : "");
      el.innerHTML = `${d.name}${!unlocked ? " 🔒" : (sel ? " ✓" : "")}`;
      el.onclick = () => {
        if (!unlocked) return;
        if (this.game.audio) this.game.audio.play("uiClick");
        this.game.save.update({ selectedPlane: id });
        this._renderHangar();
        this._renderHangarDetail(id);
      };
      list.appendChild(el);
    }
    this._renderHangarDetail(this.game.save.get().selectedPlane || "F01");
  }

  _renderHangarDetail(id) {
    const d = PLANE_DATA[id] || PLANE_DATA.F01;
    const save = this.game.save.get();
    const unlocked = this.game.isPlaneUnlocked(id, save);
    const el = document.getElementById("hangar-detail");
    el.innerHTML = `
      <h3>${d.name} <span style="font-size:12px;color:var(--text-secondary)">[${d.role}]</span></h3>
      <div class="row"><span>生命值</span><b>${d.maxHp}</b></div>
      <div class="row"><span>移动速度</span><b>${d.speed}</b></div>
      <div class="row"><span>射击间隔</span><b>${d.fireRate}ms</b></div>
      <div class="row"><span>子弹伤害</span><b>${d.bulletDamage}</b></div>
      <div class="row"><span>弹道类型</span><b>${d.bulletType}</b></div>
      <div class="row"><span>判定半径</span><b>${d.hitbox}</b></div>
      <div class="row"><span>必杀技</span><b>${(SKILL_DEFS[d.skill]||{}).name || d.skill}</b></div>
      <div class="row" style="margin-top:8px"><span>说明</span></div>
      <div style="color:var(--text-secondary);font-size:13px;line-height:1.5">${d.desc}</div>
      ${unlocked ? "" : `<div class="lock-note">🔒 解锁条件：${d.unlockDesc}</div>`}
    `;
  }

  _renderRank() {
    const list = document.getElementById("rank-list");
    const save = this.game.save.get();
    const scores = (save.scores || []).slice(0, 10);
    list.innerHTML = "";
    if (scores.length === 0) {
      list.innerHTML = `<div style="text-align:center;color:var(--text-secondary);padding:20px">暂无战绩，快去战斗吧！</div>`;
      return;
    }
    scores.forEach((s, i) => {
      const row = document.createElement("div");
      row.className = "rank-row";
      row.innerHTML = `<span class="rank-idx">#${i+1}</span><span>${s.mode} · ${s.plane}</span><span class="rank-score">${(s.score||0).toLocaleString()}</span>`;
      list.appendChild(row);
    });
  }

  onCreditsChange() {
    const pts = (this.game.shop && this.game.shop.credits) || 0;
    const e1 = document.getElementById("shop-points");
    if (e1) e1.textContent = pts.toLocaleString();
    const e2 = document.getElementById("title-points");
    if (e2) e2.textContent = pts.toLocaleString();
  }
  _refreshPoints() { this.onCreditsChange(); }

  _bindShopTabs() {
    const tabs = document.getElementById("shop-tabs");
    if (!tabs) return;
    tabs.addEventListener("click", (e) => {
      const t = e.target.closest("[data-shop-tab]");
      if (!t) return;
      if (this.game.audio) this.game.audio.play("uiClick");
      this._shopTab = t.dataset.shopTab;
      tabs.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b === t));
      try { this._renderShopList(); } catch (err) { console.error("[shopTab]", err); }
    });
  }

  _renderShop() {
    const shop = this.game.shop;
    if (!shop) return;
    this._refreshPoints();
    document.querySelectorAll("#shop-tabs .tab").forEach(b =>
      b.classList.toggle("active", b.dataset.shopTab === this._shopTab));
    this._renderShopList();
    this._renderShopInventory();
  }

  _renderShopList() {
    const shop = this.game.shop;
    if (!shop) return;
    const wrap = document.getElementById("shop-list");
    if (!wrap) return;
    const tab = this._shopTab;
    const list = SHOP_DATA.filter(it => it.tab === tab);
    wrap.innerHTML = "";
    for (const it of list) {
      const owned = shop.isOwned(it.id);
      const can = shop.canBuy(it.id);
      const upgradeLv = shop.upgradeLevel[it.id] || 0;
      const bought = shop.purchaseCount[it.id] || 0;
      const price = it.priceFn ? it.price(upgradeLv) : (it.price || 0);
      const limit = it.maxPurchases != null ? it.maxPurchases : it.limit;
      let statusHtml = "";
      if (owned && limit === 1) {
        statusHtml = `<span class="shop-status owned">已拥有</span>`;
      } else if (limit && bought >= limit && it.category !== "upgrade") {
        statusHtml = `<span class="shop-status limit">已达上限</span>`;
      } else if (!can.ok) {
        statusHtml = `<span class="shop-status lock" title="${can.reason}">${can.reason}</span>`;
      } else {
        statusHtml = `<button class="neon-btn small buy-btn" data-buy="${it.id}">
          ${it.category === "upgrade" ? `升级 Lv.${upgradeLv}→${upgradeLv+1}` : "购买"}
           💰${(price||0).toLocaleString()}
        </button>`;
      }
      const catColor = { equip:"equip-color", skill:"skill-color", upgrade:"up-color", chest:"chest-color", plane:"plane-color" }[it.category] || "";
      const typeMap = { equip:"装备", skill:"技能", upgrade:"强化", chest:"宝箱", plane:"战机" };
      const el = document.createElement("div");
      el.className = `shop-card ${catColor}`;
      el.innerHTML = `
        <div class="shop-card-head">
          <span class="shop-card-icon">${it.emoji || ""}</span>
          <span class="shop-card-name">${it.name}</span>
          <span class="shop-card-type">${typeMap[it.category]||""}</span>
        </div>
        <div class="shop-card-desc">${it.desc || ""}</div>
        <div class="shop-card-foot">${statusHtml}</div>
      `;
      wrap.appendChild(el);
    }
    wrap.querySelectorAll("[data-buy]").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-buy");
        const r = shop.buy(id);
        if (this.game.audio) this.game.audio.play(r.ok ? "buy" : "fail");
        this._showToast(r.ok ? `✅ 购买成功！${r.gained || ""}` : `❌ ${r.reason}`);
        this._renderShopList();
        this._renderShopInventory();
        this._refreshPoints();
      };
    });
  }

  _renderShopInventory() {
    const shop = this.game.shop;
    if (!shop) return;
    // ---- 装备 ----
    const eqWrap = document.getElementById("shop-equipped");
    if (eqWrap) {
      eqWrap.innerHTML = "";
      const equips = this.game.equips;
      if (equips.equippedIds.length === 0) {
        const none = document.createElement("div");
        none.className = "shop-inv-empty";
        none.textContent = "⚠ 系统已自动装备默认霰弹";
        eqWrap.appendChild(none);
      }
      for (const id of equips.equippedIds) {
        const def = EQUIP_DATA[id];
        if (!def) continue;
        const el = document.createElement("div");
        el.className = "shop-inv-item equipped equip-color";
        el.innerHTML = `
          <div class="shop-inv-name">${def.name}</div>
          <div class="shop-inv-desc">${def.desc || ""}</div>
          <button class="neon-btn small danger" data-unequip="${id}"
            ${equips.equippedIds.length <= 1 ? "disabled title='至少保留 1 件装备'" : ""}>
            卸下
          </button>
        `;
        eqWrap.appendChild(el);
      }
      const ownedNotEq = [...equips.ownedEquips].filter(x => !equips.equippedIds.includes(x));
      for (const id of ownedNotEq) {
        const def = EQUIP_DATA[id];
        if (!def) continue;
        const el = document.createElement("div");
        el.className = "shop-inv-item equip-color";
        el.innerHTML = `
          <div class="shop-inv-name">${def.name}</div>
          <div class="shop-inv-desc">${def.desc || ""}</div>
          <button class="neon-btn small" data-equip="${id}">装备</button>
        `;
        eqWrap.appendChild(el);
      }
      eqWrap.querySelectorAll("[data-unequip]").forEach(b =>
        b.onclick = (e) => { e.stopPropagation(); shop.unequipEquip(b.getAttribute("data-unequip")); this._renderShopInventory(); });
      eqWrap.querySelectorAll("[data-equip]").forEach(b =>
        b.onclick = (e) => { e.stopPropagation(); shop.equipEquip(b.getAttribute("data-equip")); this._renderShopInventory(); });
    }
    // ---- 技能槽 ----
    const skWrap = document.getElementById("shop-skills");
    if (skWrap) {
      skWrap.innerHTML = "";
      const slots = this.game.activeSkills.slots;
      const slotKeys = ["slot1", "slot2", "slot3"];
      const slotNames = ["Q 技能槽", "E 技能槽", "R 技能槽"];
      const catName = { burst:"清屏", survival:"生存", control:"控制", buff:"增幅", summon:"召唤" };
      for (let i = 0; i < 3; i++) {
        const k = slotKeys[i];
        const skId = slots[k];
        const def = skId ? ACTIVE_SKILL_DATA[skId] : null;
        const el = document.createElement("div");
        el.className = "shop-slot skill-color";
        if (def) {
          el.innerHTML = `
            <div class="shop-slot-name">${slotNames[i]}</div>
            <div class="shop-skill-info">
              <span class="shop-skill-emoji">${def.emoji || ""}</span>
              <span class="shop-skill-name">${def.name}</span>
              <span class="shop-skill-cat">${catName[def.category]||""}</span>
            </div>
            <div class="shop-skill-desc">${def.desc || ""}</div>
            <button class="neon-btn small danger" data-removeslot="${k}">卸下</button>
          `;
        } else {
          el.innerHTML = `
            <div class="shop-slot-name">${slotNames[i]}</div>
            <div class="shop-skill-empty">空槽位 · 请在下方装配技能</div>
          `;
        }
        skWrap.appendChild(el);
      }
      const owned = [...this.game.activeSkills.ownedSkills];
      const slotVals = Object.values(slots);
      const unslotted = owned.filter(x => !slotVals.includes(x));
      if (unslotted.length > 0) {
        const hd = document.createElement("h4");
        hd.textContent = "待装配技能（点击装配到槽位）";
        hd.style.cssText = "margin:18px 0 8px 0;color:var(--neon-cyan);";
        skWrap.appendChild(hd);
        for (const id of unslotted) {
          const def = ACTIVE_SKILL_DATA[id];
          if (!def) continue;
          const el = document.createElement("div");
          el.className = "shop-inv-item skill-color";
          el.innerHTML = `
            <div class="shop-inv-name">${def.emoji || ""} ${def.name}</div>
            <div class="shop-inv-desc">${def.desc || ""}</div>
            <button class="neon-btn small" data-skill-slot="Q">装配Q</button>
            <button class="neon-btn small" data-skill-slot="E">装配E</button>
            <button class="neon-btn small" data-skill-slot="R">装配R</button>
          `;
          el.querySelectorAll("[data-skill-slot]").forEach(b =>
            b.onclick = (e) => {
              e.stopPropagation();
              const key = {Q:"slot1", E:"slot2", R:"slot3"}[b.getAttribute("data-skill-slot")];
              shop.setSkillSlot(key, id);
              this._renderShopInventory();
            });
          skWrap.appendChild(el);
        }
      }
      skWrap.querySelectorAll("[data-removeslot]").forEach(b =>
        b.onclick = (e) => {
          e.stopPropagation();
          shop.setSkillSlot(b.getAttribute("data-removeslot"), null);
          this._renderShopInventory();
        });
    }
  }

  _showToast(msg) {
    let t = document.getElementById("ui-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "ui-toast";
      Object.assign(t.style, {
        position: "fixed", top: "20%", left: "50%", transform: "translate(-50%,0)",
        padding: "10px 18px", background: "rgba(10,14,39,.92)", border: "1px solid #00f0ff",
        color: "#fff", borderRadius: "10px", zIndex: 9999, fontSize: "14px",
        boxShadow: "0 0 14px #00f0ff", whiteSpace: "nowrap", pointerEvents: "none",
      });
      document.body.appendChild(t);
    }
    t.style.transition = "";
    t.textContent = msg;
    t.style.opacity = "1";
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => { t.style.transition = "opacity .3s"; t.style.opacity = "0"; }, 1500);
  }

  _renderResult(data) {
    document.getElementById("result-title").textContent = data.win ? "🏆 胜利" : "💥 失败";
    document.getElementById("result-title").style.color = data.win ? "var(--neon-cyan)" : "var(--neon-red)";
    const body = document.getElementById("result-body");
    const grade = data.grade ? `<div class="grade ${data.grade}">${data.grade}</div>` : "";
    const creditsHtml = (data.creditsGain && data.creditsGain > 0)
      ? `<div class="row" style="color:var(--neon-yellow)"><span>💰 获得积分</span><b>${data.creditsGain.toLocaleString()}</b></div>
         <div class="row" style="font-size:12px;color:var(--text-secondary)"><span></span><i>${data.creditsReason || ""}</i></div>`
      : "";
    // 章节/关卡信息（闯关模式时显示）
    const levelInfo = (data.mode === "level" && data.chapter)
      ? `<div class="row" style="color:var(--neon-purple)"><span>${data.chapterEnd ? "章节完成！" : "当前关卡"}</span><b>${data.chapterEnd ? `第${data.chapter}章全通` : `第${data.chapter}章-${data.stage}关`}</b></div>`
      : "";
    body.innerHTML = `
      ${grade}
      ${levelInfo}
      <div class="row"><span>最终分数</span><b>${(data.score||0).toLocaleString()}</b></div>
      <div class="row"><span>击杀数</span><b>${data.kills||0}</b></div>
      <div class="row"><span>最高连击</span><b>×${data.maxCombo||0}</b></div>
      <div class="row"><span>金币获得</span><b>${data.coins||0}</b></div>
      <div class="row"><span>等级</span><b>Lv.${data.level||1}</b></div>
      ${creditsHtml}
      ${data.newHigh ? `<div class="row" style="color:var(--neon-yellow)"><span>🎉 新纪录！</span></div>` : ""}
    `;
    // 按钮组：闯关胜利 → 分支选择；其他模式 → 默认按钮
    const actionsEl = document.getElementById("result-actions");
    if (data.win && data.mode === "level" && !data.allCleared) {
      // 闯关胜利（非最后一关）：显示分支选择
      const hasNext = !!data.hasNext;
      actionsEl.innerHTML = `
        ${hasNext ? `<button class="neon-btn primary" data-action="next-level">▶ 下一关</button>` : ``}
        <button class="neon-btn" data-action="replay-level">🔄 重玩本关</button>
        <button class="neon-btn" data-action="levels">🗺 选关</button>
        <button class="neon-btn ghost" data-action="shop-from-result">🛒 积分商店</button>
        <button class="neon-btn ghost" data-action="quit">🚪 主菜单</button>
      `;
    } else if (data.win && data.mode === "level" && data.allCleared) {
      // 全部通关
      actionsEl.innerHTML = `
        <button class="neon-btn" data-action="replay-level">🔄 重温最终战</button>
        <button class="neon-btn" data-action="levels">🗺 选关</button>
        <button class="neon-btn ghost" data-action="shop-from-result">🛒 积分商店</button>
        <button class="neon-btn ghost" data-action="quit">🚪 主菜单</button>
      `;
    } else {
      // 失败 / 非闯关模式：默认
      actionsEl.innerHTML = `
        <button class="neon-btn" data-action="restart">🔄 再来一局</button>
        <button class="neon-btn ghost" data-action="quit">🚪 主菜单</button>
      `;
    }
  }

  _bindActions() {
    document.body.addEventListener("click", (e) => {
      const t = e.target.closest("[data-action]");
      if (!t) return;
      const action = t.dataset.action;
      if (this.game.audio) this.game.audio.play("uiClick");
      switch (action) {
        case "start":       this.game.startGame("level"); break;
        case "mode":        this.showMode(); break;
        case "levels":      this.showLevels(); break;
        case "shop":        this.showShop(); break;
        case "hangar":      this.showHangar(); break;
        case "rank":        this.showRank(); break;
        case "settings":    this.showSettings(); break;
        case "back-title":  this.showTitle(); break;
        case "pause":       this.game.pause(); break;
        case "resume":      this.game.resume(); break;
        case "restart":     this.game.restart(); break;
        case "quit":        this.game.quitToTitle(); break;
        case "skill":       this.game.tryUseSkill(); break;
        // ========== 结算页关卡分支 ==========
        case "next-level":      this.game.continueNextLevel(); break;
        case "replay-level":    this.game.replayCurrentLevel(); break;
        case "shop-from-result":{
          // 从结算进入商店，保存玩家跳转意图（"返回"应回到哪）
          this.game._uiReturnFrom = "result";
          this.showShop();
          break;
        }
      }
    });
    // 模式选择
    document.body.addEventListener("click", (e) => {
      const t = e.target.closest("[data-mode]");
      if (!t) return;
      if (this.game.audio) this.game.audio.play("uiClick");
      this.game.startGame(t.dataset.mode);
    });
  }

  _bindSettings() {
    const sfx = document.getElementById("set-sfx");
    const bgm = document.getElementById("set-bgm");
    const shake = document.getElementById("set-shake");
    const lowperf = document.getElementById("set-lowperf");
    const save = this.game.save;
    // 载入已存设置
    const s = save.get().settings || {};
    sfx.value = s.sfx ?? 60; document.getElementById("set-sfx-val").textContent = sfx.value;
    bgm.value = s.bgm ?? 40; document.getElementById("set-bgm-val").textContent = bgm.value;
    shake.checked = s.shake !== false;
    lowperf.checked = !!s.lowperf;
    this.game.settings = { shake: shake.checked, lowperf: !!s.lowperf };

    sfx.oninput = () => {
      document.getElementById("set-sfx-val").textContent = sfx.value;
      const v = sfx.value / 100;
      if (this.game.audio) this.game.audio.setSfxVol(v);
      save.update({ settings: { ...save.get().settings, sfx: +sfx.value } });
    };
    bgm.oninput = () => {
      document.getElementById("set-bgm-val").textContent = bgm.value;
      const v = bgm.value / 100;
      if (this.game.audio) this.game.audio.setBgmVol(v);
      save.update({ settings: { ...save.get().settings, bgm: +bgm.value } });
    };
    shake.onchange = () => {
      this.game.settings.shake = shake.checked;
      save.update({ settings: { ...save.get().settings, shake: shake.checked } });
    };
    lowperf.onchange = () => {
      this.game.settings.lowperf = lowperf.checked;
      save.update({ settings: { ...save.get().settings, lowperf: lowperf.checked } });
    };
    document.querySelector('[data-action="reset-save"]').onclick = () => {
      if (confirm("确定清除所有存档？此操作不可恢复！")) {
        save.reset();
        alert("存档已清除");
        this.showTitle();
      }
    };
  }
}
