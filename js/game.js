'use strict';
/* =====================================================================
 * 坦克大作战 TANK BATTLE  ——  邱冠超 作业
 * 单人端游 · HTML5 Canvas + JavaScript
 * 功能:校园底图加分 / QGC砖墙原创标识 / 6武器 / 5被动装备 /
 *      4主动道具 / 限时Buff / 5种敌人AI / BOSS / 多关卡 / 小地图 /
 *      特效粒子 / localStorage最高分
 * ===================================================================== */

/* ===================== 一、全局配置常量 ===================== */
const TILE = 40;            // 单格像素
const COLS = 20;            // 地图列数
const ROWS = 20;            // 地图行数
const W = COLS * TILE;      // 画布宽 800
const H = ROWS * TILE;      // 画布高 800

// 方向常量(0=上 1=右 2=下 3=左)
const DIR = { UP:0, RIGHT:1, DOWN:2, LEFT:3 };
const DIR_VEC = [ [0,-1],[1,0],[0,1],[-1,0] ];

// 地形类型
const T = { EMPTY:0, BRICK:1, STEEL:2, WATER:3, GRASS:4, ICE:5, BASE:6 };

/* ===================== 二、武器定义 ===================== */
// 8 种武器:伤害 / 冷却ms / 速度 / 颜色 / 特性
const WEAPONS = [
  { id:0, name:'普通炮弹', icon:'🔵', dmg:25, cd:380,  speed:5.2, color:'#fbbf24', pierce:false, splash:0,  type:'normal' },
  { id:1, name:'穿甲弹',   icon:'🟡', dmg:40, cd:620,  speed:6.0, color:'#f59e0b', pierce:true,  splash:0,  type:'armor'   },
  { id:2, name:'散弹',     icon:'🟢', dmg:18, cd:700,  speed:4.8, color:'#4ade80', pierce:false, splash:0,  type:'shotgun', spread:3 },
  { id:3, name:'导弹',     icon:'🔴', dmg:80, cd:1300, speed:3.6, color:'#ef4444', pierce:false, splash:60, type:'missile' },
  { id:4, name:'速射炮',   icon:'🟣', dmg:12, cd:140,  speed:6.4, color:'#a78bfa', pierce:false, splash:0,  type:'rapid'   },
  { id:5, name:'追踪弹',   icon:'🟠', dmg:30, cd:900,  speed:4.0, color:'#fb923c', pierce:false, splash:0,  type:'homing'  },
  { id:6, name:'等离子炮', icon:'🟦', dmg:55, cd:1000, speed:5.0, color:'#38bdf8', pierce:true,  splash:30, type:'plasma'  },
  { id:7, name:'脉冲弹',   icon:'🟫', dmg:15, cd:800,  speed:4.5, color:'#f472b6', pierce:false, splash:45, type:'emp'     },
];

/* ===================== 三、被动装备定义(12种,开关式,最多同时携带3件) ===================== */
const PASSIVES = [
  // 防御
  { id:'composite_armor', cat:'防御', name:'复合装甲',         icon:'🛡', desc:'受到伤害降低20%' },
  { id:'energy_shield',   cat:'防御', name:'能量护盾发生器',   icon:'🔵', desc:'每15秒生成一层护盾,抵挡单次炮击伤害' },
  { id:'blast_chassis',   cat:'防御', name:'防爆底盘',         icon:'🦾', desc:'免疫地雷、导弹爆炸溅射伤害' },
  // 机动
  { id:'turbo_engine',    cat:'机动', name:'涡轮增压引擎',     icon:'⚙', desc:'移动速度提升25%' },
  { id:'anti_slip',       cat:'机动', name:'防滑履带',         icon:'⛓', desc:'消除冰面打滑效果' },
  // 火力
  { id:'fast_reload',     cat:'火力', name:'快速装填模块',     icon:'🔋', desc:'武器开火冷却缩短22%' },
  { id:'ap_rounds',       cat:'火力', name:'穿甲弹头改良',     icon:'💠', desc:'全部炮弹伤害提升15%' },
  { id:'guidance_chip',   cat:'火力', name:'制导芯片',         icon:'🎯', desc:'扩大追踪弹追踪范围、增大导弹爆炸半径' },
  // 侦查辅助
  { id:'tac_radar',       cat:'侦查', name:'战术雷达升级版',   icon:'📡', desc:'小地图标注敌方类型与剩余血量' },
  { id:'salvage',         cat:'侦查', name:'战场回收装置',     icon:'♻', desc:'击杀敌人获得积分增加20%' },
  // 稀有
  { id:'auto_repair',     cat:'稀有', name:'自修复装甲',       icon:'✨', desc:'脱离战斗状态持续缓慢回血' },
  { id:'deflect_field',   cat:'稀有', name:'子弹偏转力场',     icon:'🌀', desc:'30%概率抵消敌方来袭炮弹' },
];

/* ===================== 四、主动道具定义(5种消耗品,存背包Q释放,阵亡保留) ===================== */
const ITEMS = [
  { id:0, name:'应急维修包',   icon:'🔧', desc:'恢复50点血量',       duration:0 },
  { id:1, name:'全域冰冻弹',   icon:'❄', desc:'冻结全场敌人4秒',     duration:4000 },
  { id:2, name:'战术空袭',     icon:'✈', desc:'清屏并对BOSS造成伤害', duration:0 },
  { id:3, name:'短时过载护盾', icon:'🛡', desc:'6秒无敌护盾',         duration:6000 },
  { id:4, name:'火力增幅药剂', icon:'💉', desc:'10秒火力提升50%',     duration:10000 },
];

/* ===================== 四·二、关卡定义 ===================== */
const MAX_LEVEL = 8;     // 最大关卡数(选关界面上限)
const LEVEL_NAMES = [
  '校园入口', '教学楼', '实验楼', '图书馆',
  '体育馆',   '宿舍区', '校医院', '终极决战',
];

/* ===================== 四·二·五、坦克型号定义(5款,每款外观/属性/专属神技) ===================== */
const TANK_MODELS = [
  // T-01 先锋 (默认): 基础均衡 · 无专属神技
  { id:0, key:'pioneer', name:'T-01 先锋', icon:'🟢', color:'#22c55e', accent:'#86efac', price:0,
    hp:100, speedMul:1.0, fireCdMul:1.0, turretStyle:'standard',
    skill:null,
    desc:'标准主战坦克 · 各项性能均衡 · 无专属神技' },
  // T-02 雷霆: 机动敏捷 · 神技 ⚡ 连锁闪电
  { id:1, key:'thunder', name:'T-02 雷霆', icon:'⚡', color:'#2563eb', accent:'#93c5fd', price:350,
    hp:95, speedMul:1.13, fireCdMul:0.92, turretStyle:'twin',
    skill:{ id:'chain_lightning', name:'⚡ 连锁闪电', key:'F', cd:12000,
      desc:'按下F释放闪电链,最多弹射5个敌人,每跳80伤害,距离越远伤害衰减' },
    desc:'闪电涂装 · 机动型 · 车身更轻 · 射速微提' },
  // T-03 烈焰: 重装厚甲 · 神技 🔥 火焰喷射
  { id:2, key:'inferno', name:'T-03 烈焰', icon:'🔥', color:'#f97316', accent:'#fdba74', price:500,
    hp:120, speedMul:0.92, fireCdMul:1.0, turretStyle:'flame',
    skill:{ id:'flame_jet', name:'🔥 火焰喷射', key:'F', cd:15000,
      desc:'按下F持续3秒朝炮管方向喷火焰,锥形范围灼烧敌人,并略微推离' },
    desc:'烈焰涂装 · 重甲型 · 血量更厚 · 擅长近距离压制' },
  // T-04 壁垒: 超级重甲 · 神技 🛡 能量壁垒
  { id:3, key:'bulwark', name:'T-04 壁垒', icon:'🛡', color:'#cbd5e1', accent:'#f1f5f9', price:650,
    hp:145, speedMul:0.84, fireCdMul:1.08, turretStyle:'hex',
    skill:{ id:'energy_barrier', name:'🛡 能量壁垒', key:'F', cd:18000,
      desc:'按下F展开持续5秒的360°能量屏障,吸收全部伤害并反弹敌方子弹' },
    desc:'白银多边形装甲 · 超重型 · 抗打击能力最强' },
  // T-05 幽灵: 潜行刺客 · 神技 👻 相位潜行
  { id:4, key:'phantom', name:'T-05 幽灵', icon:'👻', color:'#7c3aed', accent:'#c4b5fd', price:800,
    hp:85, speedMul:1.22, fireCdMul:0.86, turretStyle:'stealth',
    skill:{ id:'phase_stealth', name:'👻 相位潜行', key:'F', cd:20000,
      desc:'按下F进入8秒隐身状态:敌人无法瞄准你,移动+30%,攻击时短暂显形' },
    desc:'暗紫半透明 · 狙击型 · 机动最高 · 擅长偷袭' },
];

/* ===================== 四·二、战术支援载具（宠物）—— 8 种 × 10 级成长 ===================== */
const PET_STATE = { FOLLOW:'follow', ASSIST:'assist', DEFEND:'defend', CAST:'cast', DEAD:'dead' };
const PET_SKILL_STAGE = { IDLE:'idle', WINDUP:'windup', ACTIVE:'active', BACK:'back' };

const PET_LEVEL_EXP_THRESHOLD = lvl => lvl * 120;   // 升级所需经验 = Lv * 120 (Lv1→2 = 120 exp, Lv9→10 = 1080 exp)

/* 每级成长：HP、Spd、Dmg 线性 + CD 线性降低；Lv5/Lv10 小质变节点 */
const PET_LEVEL_GROWTH = [
  // Lv1 基础（0级成长）
  { hp:1.00, spd:1.00, dmg:1.00, cd:1.00, note:'Lv1 基础' },
  // Lv2
  { hp:1.08, spd:1.04, dmg:1.10, cd:0.96, note:'Lv2 +8%HP +4%Spd +10%Dmg CD-4%' },
  { hp:1.16, spd:1.08, dmg:1.20, cd:0.92, note:'Lv3' },
  { hp:1.24, spd:1.12, dmg:1.30, cd:0.88, note:'Lv4' },
  { hp:1.38, spd:1.18, dmg:1.45, cd:0.82, note:'Lv5 质变(HP/Dmg突增)' },
  { hp:1.52, spd:1.22, dmg:1.60, cd:0.78, note:'Lv6' },
  { hp:1.66, spd:1.26, dmg:1.78, cd:0.74, note:'Lv7' },
  { hp:1.82, spd:1.30, dmg:1.98, cd:0.70, note:'Lv8' },
  { hp:2.00, spd:1.34, dmg:2.20, cd:0.66, note:'Lv9' },
  { hp:2.25, spd:1.40, dmg:2.55, cd:0.60, note:'Lv10 质变(最终形态,属性约2.5倍)' }
];

/* ===================== 四·二·A、坦克型号 10 级成长表 (与宠物类似的线性 + Lv5/Lv10 质变) ===================== */
const TANK_LEVEL_GROWTH = [
  // Lv1 基础
  { hp:1.00, spd:1.00, fire:1.00, cd:1.00, note:'Lv1 基础' },
  { hp:1.08, spd:1.03, fire:0.96, cd:0.96, note:'Lv2 +8%HP +3%Spd CD-4%' },
  { hp:1.16, spd:1.06, fire:0.92, cd:0.92, note:'Lv3' },
  { hp:1.24, spd:1.09, fire:0.88, cd:0.88, note:'Lv4' },
  { hp:1.40, spd:1.13, fire:0.82, cd:0.82, note:'Lv5 质变(HP突增)' },
  { hp:1.56, spd:1.16, fire:0.78, cd:0.78, note:'Lv6' },
  { hp:1.72, spd:1.19, fire:0.74, cd:0.74, note:'Lv7' },
  { hp:1.90, spd:1.22, fire:0.70, cd:0.70, note:'Lv8' },
  { hp:2.10, spd:1.25, fire:0.66, cd:0.66, note:'Lv9' },
  { hp:2.35, spd:1.30, fire:0.60, cd:0.60, note:'Lv10 质变(约2.3倍HP/CD-40%)' }
];

/* ===================== 四·二·B、武器 10 级成长表 (伤害↑/CD↓/速度↑) ===================== */
const WEAPON_LEVEL_GROWTH = [
  { dmg:1.00, cd:1.00, spd:1.00, note:'Lv1 基础' },
  { dmg:1.08, cd:0.96, spd:1.02, note:'Lv2 +8%Dmg CD-4%' },
  { dmg:1.18, cd:0.92, spd:1.04, note:'Lv3' },
  { dmg:1.28, cd:0.88, spd:1.06, note:'Lv4' },
  { dmg:1.42, cd:0.82, spd:1.08, note:'Lv5 质变(Dmg突增)' },
  { dmg:1.56, cd:0.78, spd:1.10, note:'Lv6' },
  { dmg:1.72, cd:0.74, spd:1.12, note:'Lv7' },
  { dmg:1.90, cd:0.70, spd:1.14, note:'Lv8' },
  { dmg:2.10, cd:0.66, spd:1.16, note:'Lv9' },
  { dmg:2.35, cd:0.60, spd:1.20, note:'Lv10 质变(约2.35倍Dmg)' }
];

const PET_DEFS = [
  // 0 🛰️ 侦察无人机：轻甲超高速 + 扫描脉冲标记增伤
  { id:0, key:'drone',   name:'侦察无人机',   icon:'🛰️', price:0,   tierColor:'#38bdf8', accentColor:'#0ea5e9',
    base:{ hp:80,  spd:1.60, dmgMul:0.70, fireCd:400, bulletDmg:9, bulletSpeed:5.2, range:260 },
    skill:{ id:'scan_pulse', name:'🛰️ 扫描脉冲', cd:20000, range:999, markDur:8000, bonusDmg:0.25, smallStun:0 },
    defendAI:'sky_patrol', desc:'四轴飞行器 · 超高速 · 视野全屏 · E: 全屏标记敌人+增伤25%' },
  // 1 🚙 突击吉普：中血高速 + 冲撞清场
  { id:1, key:'jeep',    name:'突击吉普',     icon:'🚙', price:300, tierColor:'#fb923c', accentColor:'#ea580c',
    base:{ hp:180, spd:1.35, dmgMul:1.00, fireCd:260, bulletDmg:13, bulletSpeed:5.6, range:280 },
    skill:{ id:'ram_charge', name:'🚙 冲撞冲锋', cd:14000, range:180, ramDmg:40, shockRange:70, stun:1500 },
    defendAI:'guerrilla_loop', desc:'四轮越野+重机枪 · E: 直线冲撞敌人 + 范围击晕' },
  // 2 🛡️ 护卫轻坦：重甲高血 + 嘲讽力场
  { id:2, key:'guard',   name:'护卫轻坦',     icon:'🛡️', price:400, tierColor:'#94a3b8', accentColor:'#475569',
    base:{ hp:400, spd:0.85, dmgMul:1.10, fireCd:450, bulletDmg:18, bulletSpeed:5.0, range:260 },
    skill:{ id:'taunt_field', name:'🛡️ 嘲讽力场', cd:16000, range:150, dur:4000, defReduce:0.6, endBlast:20 },
    defendAI:'door_block', desc:'重装小坦克 · E: 4秒内强制吸引所有敌人 + 60%减伤' },
  // 3 💣 自行火炮：脆皮慢 + 全屏齐射
  { id:3, key:'spg',     name:'自行火炮',     icon:'💣', price:520, tierColor:'#facc15', accentColor:'#a16207',
    base:{ hp:150, spd:0.70, dmgMul:1.80, fireCd:1400, bulletDmg:22, bulletSpeed:4.6, range:320 },
    skill:{ id:'barrage', name:'💣 全屏齐射', cd:25000, range:999, shells:12, shellDmg:65, splash:48, fallWarn:1500 },
    defendAI:'rear_artillery', desc:'大口径榴弹炮 · E: 召唤12发全屏榴弹(带1.5秒预警圈)' },
  // 4 ⚡ 电磁干扰车：中血 + EMP策反
  { id:4, key:'emv',     name:'电磁干扰车',   icon:'⚡', price:620, tierColor:'#a78bfa', accentColor:'#7c3aed',
    base:{ hp:140, spd:1.00, dmgMul:0.50, fireCd:600, bulletDmg:7,  bulletSpeed:5.4, range:240 },
    skill:{ id:'emp_storm', name:'⚡ EMP策反风暴', cd:22000, range:170, stun:2500, convertRate:0.15, convertDur:8000 },
    defendAI:'emp_patrol', desc:'天线阵电磁战车 · E: 2.5秒眩晕 + 15%概率让敌人叛变8秒' },
  // 5 👻 幽灵诱饵车：高血不输出 + 全息假身吸引
  { id:5, key:'ghost',   name:'幽灵诱饵车',   icon:'👻', price:560, tierColor:'#22d3ee', accentColor:'#0891b2',
    base:{ hp:300, spd:1.25, dmgMul:0.00, fireCd:9999, bulletDmg:0, bulletSpeed:0, range:0 },
    skill:{ id:'hologram', name:'👻 全息诱饵阵', cd:18000, range:260, decoys:2, decoyHp:120, decoyDeathEmp:1000, playerInvis:0.55, playerSpd:0.20 },
    defendAI:'sacrificial_decoy', desc:'半透明伪装车 · 不输出 · E: 生成2个假坦克全息吸引所有仇恨' },
  // 6 🔥 狂战士突击炮：中血慢 + 毁灭锥形清屏
  { id:6, key:'berserker', name:'狂战士突击炮', icon:'🔥', price:750, tierColor:'#ef4444', accentColor:'#991b1b',
    base:{ hp:260, spd:0.75, dmgMul:2.20, fireCd:700, bulletDmg:28, bulletSpeed:5.2, range:300 },
    skill:{ id:'rage_roar', name:'🔥 毁灭怒吼', cd:30000, cone:1.05, coneRange:260, dmg:150, knockback:70, rageDur:3000, rageSpeedMul:2.0, rageDmgMul:1.5, rageInvul:true },
    defendAI:'last_stand_berserk', desc:'巨炮履带突击炮 · E: 正面120°锥形清屏+狂暴' },
  // 7 💠 布雷工兵车：中血 + 地雷海
  { id:7, key:'miner',   name:'布雷工兵车',   icon:'💠', price:680, tierColor:'#84cc16', accentColor:'#4d7c0f',
    base:{ hp:220, spd:0.95, dmgMul:0.60, fireCd:500, bulletDmg:10, bulletSpeed:5.0, range:220 },
    skill:{ id:'mine_sea', name:'💠 地雷海', cd:18000, range:160, mines:8, mineDmg:90, mineRadius:38, iceRate:0.3, iceDur:3000 },
    defendAI:'mine_defender', desc:'机械臂布雷车 · E: 周围6格随机铺8颗隐形雷(30%冰冻)' }
];


/* ===================== 四·三、积分商城商品(四类,购买立即生效) =====================
 *   passive —— 装备到玩家(最多3件,阵亡清空,不阵亡则跨关保留)
 *   item    —— 加入背包(阵亡保留,跨局保留)
 *   weapon  —— 永久解锁武器(之后宝箱才会掉该武器)
 *   laser   —— 永久解锁激光主炮(充能激光常驻,无需5次充能)
 *   tank    —— 永久解锁坦克型号(可切换装备)
 * ============================================================ */
const SHOP_ITEMS = [
  // —— 坦克型号解锁(5种,永久,切换装备) ——
  { id:'t_01', type:'tank', tid:0, name:TANK_MODELS[0].name, icon:TANK_MODELS[0].icon, cost:0,    desc:TANK_MODELS[0].desc + ' · 默认装备' },
  { id:'t_02', type:'tank', tid:1, name:TANK_MODELS[1].name, icon:TANK_MODELS[1].icon, cost:350,  desc:TANK_MODELS[1].desc + ' · 神技:' + TANK_MODELS[1].skill.name },
  { id:'t_03', type:'tank', tid:2, name:TANK_MODELS[2].name, icon:TANK_MODELS[2].icon, cost:500,  desc:TANK_MODELS[2].desc + ' · 神技:' + TANK_MODELS[2].skill.name },
  { id:'t_04', type:'tank', tid:3, name:TANK_MODELS[3].name, icon:TANK_MODELS[3].icon, cost:650,  desc:TANK_MODELS[3].desc + ' · 神技:' + TANK_MODELS[3].skill.name },
  { id:'t_05', type:'tank', tid:4, name:TANK_MODELS[4].name, icon:TANK_MODELS[4].icon, cost:800,  desc:TANK_MODELS[4].desc + ' · 神技:' + TANK_MODELS[4].skill.name },
  // —— 被动装备(12种) ——
  { id:'p_composite_armor', type:'passive', pid:'composite_armor', name:'复合装甲',       icon:'🛡', cost:280, desc:'受到伤害降低20%' },
  { id:'p_energy_shield',   type:'passive', pid:'energy_shield',   name:'能量护盾发生器', icon:'🔵', cost:350, desc:'每15秒生成一层护盾,抵挡单次炮击' },
  { id:'p_blast_chassis',   type:'passive', pid:'blast_chassis',   name:'防爆底盘',       icon:'🦾', cost:300, desc:'免疫地雷、导弹爆炸溅射' },
  { id:'p_turbo_engine',    type:'passive', pid:'turbo_engine',    name:'涡轮增压引擎',   icon:'⚙', cost:260, desc:'移动速度提升25%' },
  { id:'p_anti_slip',       type:'passive', pid:'anti_slip',       name:'防滑履带',       icon:'⛓', cost:200, desc:'消除冰面打滑效果' },
  { id:'p_fast_reload',     type:'passive', pid:'fast_reload',     name:'快速装填模块',   icon:'🔋', cost:260, desc:'武器开火冷却缩短22%' },
  { id:'p_ap_rounds',       type:'passive', pid:'ap_rounds',       name:'穿甲弹头改良',   icon:'💠', cost:300, desc:'全部炮弹伤害提升15%' },
  { id:'p_guidance_chip',   type:'passive', pid:'guidance_chip',   name:'制导芯片',       icon:'🎯', cost:320, desc:'扩大追踪范围、增大导弹爆炸半径' },
  { id:'p_tac_radar',       type:'passive', pid:'tac_radar',       name:'战术雷达升级版', icon:'📡', cost:340, desc:'小地图标注敌方类型与剩余血量' },
  { id:'p_salvage',         type:'passive', pid:'salvage',         name:'战场回收装置',   icon:'♻', cost:330, desc:'击杀敌人获得积分增加20%' },
  { id:'p_auto_repair',     type:'passive', pid:'auto_repair',     name:'自修复装甲',     icon:'✨', cost:380, desc:'脱离战斗状态持续缓慢回血' },
  { id:'p_deflect_field',   type:'passive', pid:'deflect_field',   name:'子弹偏转力场',   icon:'🌀', cost:400, desc:'30%概率抵消敌方来袭炮弹' },
  // —— 一次性消耗道具(背包,上限9) ——
  { id:'i_repair',    type:'item', iid:0, name:'应急维修包',   icon:'🔧', cost:100, desc:'背包 +1 (恢复50血)' },
  { id:'i_freeze',    type:'item', iid:1, name:'全域冰冻弹',   icon:'❄', cost:130, desc:'背包 +1 (冻结全场4秒)' },
  { id:'i_airstrike', type:'item', iid:2, name:'战术空袭',     icon:'✈', cost:160, desc:'背包 +1 (清屏伤BOSS)' },
  { id:'i_shield',    type:'item', iid:3, name:'短时过载护盾', icon:'🛡', cost:140, desc:'背包 +1 (6秒无敌)' },
  { id:'i_power',     type:'item', iid:4, name:'火力增幅药剂', icon:'💉', cost:120, desc:'背包 +1 (10秒火力+50%)' },
  // —— 武器解锁(永久) ——
  { id:'w_normal',  type:'weapon', wid:0, name:'普通炮弹', icon:'🔵', cost:0,   desc:'默认装备 · 可消耗积分升级强化' },
  { id:'w_armor',   type:'weapon', wid:1, name:'穿甲炮',   icon:'🟡', cost:550, desc:'永久解锁,宝箱才会掉穿甲弹' },
  { id:'w_shotgun', type:'weapon', wid:2, name:'散弹炮',   icon:'🟢', cost:500, desc:'永久解锁,宝箱才会掉散弹' },
  { id:'w_missile', type:'weapon', wid:3, name:'导弹炮',   icon:'🔴', cost:600, desc:'永久解锁,宝箱才会掉导弹' },
  { id:'w_rapid',   type:'weapon', wid:4, name:'速射炮',   icon:'🟣', cost:580, desc:'永久解锁,宝箱才会掉速射弹' },
  { id:'w_homing',  type:'weapon', wid:5, name:'追踪导弹', icon:'🟠', cost:650, desc:'永久解锁,宝箱才会掉追踪弹' },
  { id:'w_plasma',  type:'weapon', wid:6, name:'等离子炮', icon:'🟦', cost:750, desc:'永久解锁,穿透+溅射高伤炮弹' },
  { id:'w_emp',     type:'weapon', wid:7, name:'脉冲弹',   icon:'🟫', cost:700, desc:'永久解锁,范围瘫痪敌人1.5秒' },
  { id:'w_laser',   type:'laser',          name:'激光主炮', icon:'🔫', cost:900, desc:'永久解锁,充能激光常驻(无需5次充能)' },
  // —— 战术支援载具(宠物)解锁(8种,永久解锁后车库可切换装备) ——
  { id:'pet_0', type:'pet', pid:0, name:PET_DEFS[0].name, icon:PET_DEFS[0].icon, cost:PET_DEFS[0].price,   desc:PET_DEFS[0].desc + ' · 10级总加成≈HP×2.25/Dmg×2.55' },
  { id:'pet_1', type:'pet', pid:1, name:PET_DEFS[1].name, icon:PET_DEFS[1].icon, cost:PET_DEFS[1].price,   desc:PET_DEFS[1].desc + ' · 10级总加成≈HP×2.25/CD-40%' },
  { id:'pet_2', type:'pet', pid:2, name:PET_DEFS[2].name, icon:PET_DEFS[2].icon, cost:PET_DEFS[2].price,   desc:PET_DEFS[2].desc + ' · 10级总加成≈HP×900/Lv5嘲讽范围+15%' },
  { id:'pet_3', type:'pet', pid:3, name:PET_DEFS[3].name, icon:PET_DEFS[3].icon, cost:PET_DEFS[3].price,   desc:PET_DEFS[3].desc + ' · 10级总加成≈Dmg×2.55/每级多发2颗炮弹' },
  { id:'pet_4', type:'pet', pid:4, name:PET_DEFS[4].name, icon:PET_DEFS[4].icon, cost:PET_DEFS[4].price,   desc:PET_DEFS[4].desc + ' · 10级总加成≈策反上限+25%/CD-40%' },
  { id:'pet_5', type:'pet', pid:5, name:PET_DEFS[5].name, icon:PET_DEFS[5].icon, cost:PET_DEFS[5].price,   desc:PET_DEFS[5].desc + ' · 10级总加成≈诱饵数Lv5+1/Lv9+2' },
  { id:'pet_6', type:'pet', pid:6, name:PET_DEFS[6].name, icon:PET_DEFS[6].icon, cost:PET_DEFS[6].price,   desc:PET_DEFS[6].desc + ' · 10级总加成≈Dmg×2.55/狂暴时长+1s' },
  { id:'pet_7', type:'pet', pid:7, name:PET_DEFS[7].name, icon:PET_DEFS[7].icon, cost:PET_DEFS[7].price,   desc:PET_DEFS[7].desc + ' · 10级总加成≈地雷数Lv4+2/Lv8+3' },
];

/* ===================== 五、敌人类型 ===================== */
const ENEMY_TYPES = [
  { name:'普通坦克', hp:60,  speed:1.2, fireCd:1100, color:'#ef4444', score:100, type:'normal' },
  { name:'高速轻坦', hp:40,  speed:2.4, fireCd:900,  color:'#f97316', score:150, type:'fast'   },
  { name:'重甲坦克', hp:160, speed:0.8, fireCd:1300, color:'#7c3aed', score:220, type:'heavy'  },
  { name:'速射坦克', hp:55,  speed:1.3, fireCd:320,  color:'#db2777', score:200, type:'rapid'  },
  { name:'自爆坦克', hp:35,  speed:2.0, fireCd:99999, color:'#facc15', score:180, type:'suicide'},
];

/* ===================== 六、资源加载器(图片+纯色兜底) ===================== */
const Assets = {
  imgs: {},           // 已加载的 Image 对象
  processed: {},      // 预处理后的 canvas(坦克去白底透明 / 地形上底色)
  fallback: {},       // 兜底颜色
  total: 8, loaded: 0,
  list: [
    // bg.jpg 保留使用图片(校园背景);其余坦克/方块全部纯程序化绘制,不加载图片
    { key:'bg',          src:'images/bg.jpg',          fallback:'#1a2a1a' },
    { key:'tank_player', src:'', fallback:'#22c55e', procedural:true },
    { key:'tank_enemy',  src:'', fallback:'#ef4444', procedural:true },
    { key:'boss_tank',   src:'', fallback:'#1f2937', procedural:true },
    { key:'wall_brick',  src:'', fallback:'#a8a29e', procedural:true },
    { key:'wall_steel',  src:'', fallback:'#94a3b8', procedural:true },
    { key:'water',       src:'', fallback:'#0ea5e9', procedural:true },
    { key:'grass',       src:'', fallback:'#16a34a', procedural:true },
  ],
  // 加载全部资源,每加载完一个回调进度
  loadAll(onProgress, onDone) {
    this.list.forEach(item => {
      this.fallback[item.key] = item.fallback;
      // 程序化绘制资源:不加载图片,直接计入进度,渲染时走 fallback 程序化分支
      if (item.procedural){
        this.imgs[item.key] = null;
        this.processed[item.key] = null;
        this.loaded++;
        this._check(onProgress, onDone);
        return;
      }
      const img = new Image();
      img.onload = () => {
        this.loaded++;
        this.imgs[item.key] = img;
        // 预处理:坦克贴图去白底变透明,地形贴图用兜底色 multiply(白底变底色)
        this.processed[item.key] = this.processImage(item.key, img);
        this._check(onProgress, onDone);
      };
      img.onerror = () => { this.loaded++; this.imgs[item.key] = null; this._check(onProgress, onDone); };
      img.src = item.src;
    });
  },
  _check(onProgress, onDone) {
    onProgress(this.loaded, this.total);
    if (this.loaded >= this.total) onDone();
  },
  // 获取图片:优先返回预处理后的 canvas,再返回原图,再 null
  get(key){ return this.processed[key] || this.imgs[key] || null; },
  // hex 颜色转 rgb
  hexToRgb(hex){
    const h = hex.replace('#','');
    return { r: parseInt(h.substr(0,2),16), g: parseInt(h.substr(2,2),16), b: parseInt(h.substr(4,2),16) };
  },
  // 图片预处理:坦克去白底透明;地形 multiply 兜底色(让白色背景变成有底色的纹理)
  processImage(key, img){
    try {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const cx = cv.getContext('2d');
      cx.drawImage(img, 0, 0);
      const data = cx.getImageData(0, 0, w, h);
      const d = data.data;
      const isTank = (key === 'tank_player' || key === 'tank_enemy' || key === 'boss_tank');
      if (isTank){
        // 坦克:白色背景变透明,保留坦克本体
        for (let i=0; i<d.length; i+=4){
          const br = (d[i] + d[i+1] + d[i+2]) / 3;
          if (br > 215){ d[i+3] = 0; }               // 接近白 → 完全透明
          else if (br > 180){ d[i+3] = (255-br)*4; } // 过渡 → 半透明边缘
        }
      } else {
        // 地形:与兜底色相乘(multiply),白底→兜底色,有色→更深,整体获得正确底色
        const fc = this.hexToRgb(this.fallback[key] || '#888888');
        for (let i=0; i<d.length; i+=4){
          d[i]   = (d[i]   * fc.r) / 255;
          d[i+1] = (d[i+1] * fc.g) / 255;
          d[i+2] = (d[i+2] * fc.b) / 255;
        }
      }
      cx.putImageData(data, 0, 0);
      return cv;
    } catch(e){
      // 跨域或其它异常时回退到原图
      console.warn('processImage failed for', key, e);
      return img;
    }
  }
};

/* ===================== 七、输入管理 ===================== */
const Input = {
  keys: {},
  // 触控虚拟键状态(与键盘键名统一,方便游戏逻辑无差别读取)
  touchKeys: {},  // 如 { 'arrowup':true, ' ':true }
  // —— 炮管瞄准输入(鼠标/触屏瞄准点,画布坐标) ——
  aimActive: false,          // 是否在瞄准(鼠标在画布内 / 触屏按下)
  aimX: 0,                   // 瞄准点画布坐标 X
  aimY: 0,                   // 瞄准点画布坐标 Y
  // 摇杆连续角度(移动端摇杆任意方向, 非4离散)
  joyAngle: null,            // 弧度, null 表示摇杆未激活
  joyIntensity: 0,           // 0~1 摇杆强度
  init() {
    window.addEventListener('keydown', e => {
      // 阻止空格滚动页面(WASD不滚动,无需阻止)
      if(e.key === ' ') e.preventDefault();
      this.keys[e.key.toLowerCase()] = true;
      // 单次触发的按键由 Game 处理
      if (Game.instance) Game.instance.onKeyPress(e.key.toLowerCase());
    });
    window.addEventListener('keyup', e => { this.keys[e.key.toLowerCase()] = false; });
    // —— 鼠标瞄准(炮管朝向) ——
    const canvas = document.getElementById('game-canvas');
    if (canvas){
      const toCanvas = (cx, cy) => {
        const r = canvas.getBoundingClientRect();
        const sx = (cx - r.left) * (canvas.width / r.width);
        const sy = (cy - r.top)  * (canvas.height / r.height);
        return { x: sx, y: sy };
      };
      canvas.addEventListener('mousemove', e => {
        const p = toCanvas(e.clientX, e.clientY);
        this.aimActive = true;
        this.aimX = p.x; this.aimY = p.y;
      });
      canvas.addEventListener('mouseenter', e => {
        const p = toCanvas(e.clientX, e.clientY);
        this.aimActive = true;
        this.aimX = p.x; this.aimY = p.y;
      });
      canvas.addEventListener('mouseleave', () => {
        // 鼠标离开时保持最后一个瞄准点,但标记 inactive 让炮管可选跟随车身
        this.aimActive = false;
        // 离开画布同时松开点击开火(避免粘键)
        this.setTouch(' ', false);
      });
      // —— 鼠标点击/按住 = 开火(与空格键等效) ——
      canvas.addEventListener('mousedown', e => {
        if (e.button === 0){ // 左键
          const p = toCanvas(e.clientX, e.clientY);
          this.aimActive = true;
          this.aimX = p.x; this.aimY = p.y;
          this.setTouch(' ', true);
        }
      });
      const endMouseFire = e => {
        if (e.button === 0) this.setTouch(' ', false);
      };
      window.addEventListener('mouseup', endMouseFire);
      // 触屏:画面任意位置按住拖动 → 炮管瞄准 + 开火
      // —— [v62优化] 瞄准 canvas 触控同样改为 Pointer Events + setPointerCapture,
      //    手指滑出画布时 aimTouchId 不会丢失/跟手性大幅提升; 同时兼容摇杆不被误判瞄准
      let aimPointerId = null;
      const notJoystick = (e) => {
        const js = document.getElementById('joystick');
        if (!js) return true;
        return !js.contains(e.target);
      };
      canvas.addEventListener('pointerdown', e => {
        if (e.pointerType === 'mouse'){
          // 鼠标左键:等价于旧 mousedown — 瞄谁 + 开 fire 键
          if (e.button !== 0) return;
          e.preventDefault();
          try { canvas.setPointerCapture(e.pointerId); } catch(_){}
          aimPointerId = e.pointerId;
          const p = toCanvas(e.clientX, e.clientY);
          this.aimActive = true;
          this.aimX = p.x; this.aimY = p.y;
          this.setTouch(' ', true);
          return;
        }
        // 触控:只有不在摇杆区域发起的 pointer 才算"瞄准/开火"
        if (!notJoystick(e)) return;
        e.preventDefault();
        try { canvas.setPointerCapture(e.pointerId); } catch(_){}
        aimPointerId = e.pointerId;
        const p = toCanvas(e.clientX, e.clientY);
        this.aimActive = true;
        this.aimX = p.x; this.aimY = p.y;
        this.setTouch(' ', true);
      }, { passive:false });
      canvas.addEventListener('pointermove', e => {
        if (aimPointerId !== e.pointerId) return;
        if (e.cancelable) e.preventDefault();
        const p = toCanvas(e.clientX, e.clientY);
        this.aimActive = true;
        this.aimX = p.x; this.aimY = p.y;
      }, { passive:false });
      const endAimPtr = (e) => {
        if (aimPointerId !== e.pointerId) return;
        if (e.cancelable) { try { e.preventDefault(); } catch(_){} }
        try { canvas.releasePointerCapture(e.pointerId); } catch(_){}
        aimPointerId = null;
        this.aimActive = false;
        this.setTouch(' ', false);
      };
      canvas.addEventListener('pointerup', endAimPtr, {passive:false});
      canvas.addEventListener('pointercancel', endAimPtr, {passive:false});
      canvas.addEventListener('lostpointercapture', (e) => {
        if (aimPointerId !== e.pointerId) return;
        aimPointerId = null;
        this.aimActive = false;
        this.setTouch(' ', false);
      }, {passive:false});
    }
    // 检测触屏设备并初始化虚拟控制器
    this.detectTouch();
  },
  // 统一查询:键盘或触控任一按下即为true
  down(k){
    k = k.toLowerCase();
    return !!(this.keys[k] || this.touchKeys[k]);
  },
  // 设置/清除触控虚拟键
  setTouch(k, down){ this.touchKeys[k.toLowerCase()] = down; },
  // 检测触屏设备 → 设置标志(显示由 updateHudBtns 控制)
  detectTouch(){
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    this.isTouchDevice = isTouch;
  },
  // 读取炮管瞄准角度(以玩家为中心的弧度)。无瞄准返回null
  getAimAngle(originX, originY){
    if (!this.aimActive) return null;
    return Math.atan2(this.aimY - originY, this.aimX - originX);
  }
};

/* ===================== 七·二、虚拟控制器(移动端) ===================== */
const TouchControls = {
  joyId: null,       // 当前活跃的摇杆 touch id
  joyCenter: {x:0, y:0},
  joyRadius: 50,
  stickEl: null,
  _globalTouchBound: false,  // 是否已绑定全局touch拦截
  init(){
    if (!Input.isTouchDevice) return;
    this.stickEl = document.getElementById('joystick-stick');
    // —— [v59修复] 全局兜底拦截:防止手指滑出摇杆/按钮边界后触发浏览器页面滚动(橡皮筋) ——
    // 只在游戏容器区域生效, overlay(菜单/商店等)里可正常滚动
    if (!this._globalTouchBound){
      this._globalTouchBound = true;
      const ga = document.querySelector('.game-area');
      const inOverlay = (el) => {
        if (!el) return false;
        const ov = document.getElementById('overlay');
        return ov && !ov.classList.contains('hidden') && ov.contains(el);
      };
      // —— [v62优化] 游戏状态判断:overlay 打开 + 游戏状态非 playing 时,不拦截 document touchmove,
      //    否则商店/选关的长列表永远无法滚动. 只有游戏真正在玩中才需要兜底拦截.
      const shouldBlockGlobal = () => {
        const ov = document.getElementById('overlay');
        if (ov && !ov.classList.contains('hidden')) return false;
        const g = Game.instance;
        if (!g) return false;
        return g.state === 'playing';
      };
      const blockIfGame = (e) => {
        // overlay 打开时:不拦截,让菜单/商店内容能滚动;overlay 关闭时:全部拦截
        const ov = document.getElementById('overlay');
        const overlayOpen = ov && !ov.classList.contains('hidden');
        if (overlayOpen) return;
        // 只有在游戏区/控制层内发起的触摸 或 正在摇杆/按钮操作时,才拦截
        if (e.target && inOverlay(e.target)) return;
        if (e.cancelable) e.preventDefault();
      };
      // game-area 的 touchstart 先拦一道,注册手势识别起点
      if (ga){
        ga.addEventListener('touchstart', e => {
          const ov = document.getElementById('overlay');
          if (ov && !ov.classList.contains('hidden')) return;
          if (e.target && inOverlay(e.target)) return;
          if (e.cancelable) e.preventDefault();
        }, {passive:false});
        ga.addEventListener('touchmove', blockIfGame, {passive:false});
      }
      // 兜底:document 层再拦 touchmove(快速滑出边界时事件会冒上来)
      // —— [v62优化] 用 shouldBlockGlobal 精确判断游戏进行中才拦,避免阻塞菜单滚动
      document.addEventListener('touchmove', e => {
        if (!shouldBlockGlobal()) return;
        if (e.target && inOverlay(e.target)) return;
        if (e.cancelable) e.preventDefault();
      }, {passive:false});
    }
    const joystick = document.getElementById('joystick');
    // —— [v62优化] 改用 Pointer Events 统一模型 + setPointerCapture,
    //    鼠标/触控/触控笔全部统一;捕获后手指/鼠标移出元素边界仍能稳定收到 move/up 事件,
    //    解决旧 touch 模型下:快速拖动超出容器后丢事件 → 摇杆"不归位/失灵"
    if (joystick){
      const rect = ()=> joystick.getBoundingClientRect();
      const start = (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        try { joystick.setPointerCapture(e.pointerId); } catch(_){}
        this.joyId = 'p_'+e.pointerId;
        const r = rect();
        this.joyCenter = { x:r.left + r.width/2, y:r.top + r.height/2 };
        this.joyRadius = r.width / 2;
        this.updateStick(e.clientX, e.clientY);
      };
      const move = (e) => {
        if ((''+this.joyId) !== 'p_'+e.pointerId) return;
        // —— [v62优化] pointermove 不依赖事件冒泡+被动模式,直接 preventDefault 阻止页面手势
        if (e.cancelable) e.preventDefault();
        this.updateStick(e.clientX, e.clientY);
      };
      const end = (e) => {
        if ((''+this.joyId) !== 'p_'+e.pointerId) return;
        e.preventDefault();
        try { joystick.releasePointerCapture(e.pointerId); } catch(_){}
        this.joyId = null;
        this.resetStick();
      };
      joystick.addEventListener('pointerdown', start, {passive:false});
      joystick.addEventListener('pointermove', move, {passive:false});
      joystick.addEventListener('pointerup', end, {passive:false});
      joystick.addEventListener('pointercancel', end, {passive:false});
      joystick.addEventListener('lostpointercapture', end, {passive:false});
    }
    // —— [v62优化] 射击/道具/神技/武器切换按钮:同样用 Pointer Events + setPointerCapture
    //    解决触屏手指滑出按钮 → touchend 不触发 → 射击键一直"按住"导致跟手感错乱 & 激光蓄力卡住
    const bindHoldBtn = (elId, keyCode) => {
      const el = document.getElementById(elId);
      if (!el) return;
      let capturedId = null;
      el.addEventListener('pointerdown', e => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        try { el.setPointerCapture(e.pointerId); } catch(_){}
        capturedId = e.pointerId;
        Input.setTouch(keyCode, true);
      }, {passive:false});
      const clearBtn = (e) => {
        if (capturedId !== e.pointerId) return;
        e.preventDefault();
        try { el.releasePointerCapture(e.pointerId); } catch(_){}
        capturedId = null;
        Input.setTouch(keyCode, false);
      };
      el.addEventListener('pointermove', e => {
        if (capturedId !== e.pointerId) return;
        if (e.cancelable) e.preventDefault();
        // 只要 capture 没丢,手指滑到哪都保持"按下",不中途误伤
        Input.setTouch(keyCode, true);
      }, {passive:false});
      el.addEventListener('pointerup', clearBtn, {passive:false});
      el.addEventListener('pointercancel', clearBtn, {passive:false});
      el.addEventListener('lostpointercapture', (e) => {
        if (capturedId !== e.pointerId) return;
        capturedId = null;
        Input.setTouch(keyCode, false);
      }, {passive:false});
    };
    bindHoldBtn('touch-fire', ' ');
    // —— 道具按钮:单次触发(用 pointerdown 一次性,不长按) ——
    const itemBtn = document.getElementById('touch-item');
    if (itemBtn){
      itemBtn.addEventListener('pointerdown', e => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        if (Game.instance) Game.instance.onKeyPress('q');
      }, {passive:false});
    }
    // —— 专属神技按钮:单次触发 ——
    const skillBtn = document.getElementById('touch-skill');
    if (skillBtn){
      skillBtn.addEventListener('pointerdown', e => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        if (Game.instance) Game.instance.onKeyPress('f');
      }, {passive:false});
    }
    // —— 武器切换:上一把/下一把 ——
    const wPrev = document.getElementById('touch-wprev');
    const wNext = document.getElementById('touch-wnext');
    if (wPrev) wPrev.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault(); this.switchWeapon(-1);
    }, {passive:false});
    if (wNext) wNext.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault(); this.switchWeapon(1);
    }, {passive:false});
  },
  // 摇杆位置 → 方向键模拟(旧) + 连续角度/强度(新,用于坦克自由驾驶)
  updateStick(tx, ty){
    const dx = tx - this.joyCenter.x;
    const dy = ty - this.joyCenter.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const maxDist = this.joyRadius;
    // 归一化方向(死区 0.3)
    const nx = dist > 0 ? dx / dist : 0;
    const ny = dist > 0 ? dy / dist : 0;
    const intensity = Math.min(dist / maxDist, 1);
    // 摇杆视觉位置
    if (this.stickEl){
      const clampX = Math.max(-maxDist, Math.min(maxDist, dx));
      const clampY = Math.max(-maxDist, Math.min(maxDist, dy));
      // —— [v62优化] 摇杆视觉用 requestAnimationFrame 合帧,避免 pointermove 高频触发导致抖动
      if (this._rafStickPending) {
        this._stickPendingX = clampX; this._stickPendingY = clampY;
        return;
      }
      this._rafStickPending = true;
      this._stickPendingX = clampX; this._stickPendingY = clampY;
      requestAnimationFrame(() => {
        this._rafStickPending = false;
        if (this.stickEl){
          this.stickEl.style.transform = `translate(${this._stickPendingX}px, ${this._stickPendingY}px)`;
        }
      });
    }
    // 死区内不触发移动
    if (intensity < 0.3){
      Input.setTouch('arrowup', false);
      Input.setTouch('arrowdown', false);
      Input.setTouch('arrowleft', false);
      Input.setTouch('arrowright', false);
      Input.joyAngle = null;
      Input.joyIntensity = 0;
      return;
    }
    // —— 连续角度(任意方向驾驶) ——
    const angle = Math.atan2(ny, nx); // -π ~ π
    Input.joyAngle = angle;
    Input.joyIntensity = intensity;
    // 8方向判断(兼容旧逻辑,非自由模式用)
    const isRight = angle > -Math.PI/4 && angle <= Math.PI/4;
    const isDown  = angle > Math.PI/4 && angle <= Math.PI*3/4;
    const isLeft  = angle > Math.PI*3/4 || angle <= -Math.PI*3/4;
    const isUp    = angle > -Math.PI*3/4 && angle <= -Math.PI/4;
    Input.setTouch('arrowup',    isUp);
    Input.setTouch('arrowdown',  isDown);
    Input.setTouch('arrowleft',  isLeft);
    Input.setTouch('arrowright', isRight);
  },
  resetStick(){
    if (this.stickEl) this.stickEl.style.transform = '';
    Input.setTouch('arrowup', false);
    Input.setTouch('arrowdown', false);
    Input.setTouch('arrowleft', false);
    Input.setTouch('arrowright', false);
    Input.joyAngle = null;
    Input.joyIntensity = 0;
  },
  // 武器循环切换(跳过未解锁)
  switchWeapon(dir){
    if (!Game.instance || !Game.instance.player) return;
    const p = Game.instance.player;
    let cur = p.currentWeapon;
    for (let i=0; i<9; i++){
      cur = (cur + dir + 9) % 9;
      if (cur === 8){
        if (p.laserUnlocked){ p.currentWeapon = 8; Game.instance.updateUI(); return; }
      } else if (p.unlockedWeapons.includes(cur)){
        p.currentWeapon = cur; Game.instance.updateUI(); return;
      }
    }
  }
};

/* ===================== 八、工具函数 ===================== */
const Util = {
  clamp(v,a,b){ return v<a?a:(v>b?b:v); },
  rand(a,b){ return a + Math.random()*(b-a); },
  randInt(a,b){ return Math.floor(a + Math.random()*(b-a+1)); },
  chance(p){ return Math.random() < p; },
  pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; },
  // AABB 矩形重叠检测
  rectsHit(a,b){
    return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
  },
  // 两点距离
  dist(ax,ay,bx,by){ const dx=ax-bx, dy=ay-by; return Math.sqrt(dx*dx+dy*dy); },
  // 像素坐标 -> 网格坐标
  toCell(p){ return Math.floor(p / TILE); },
  // 颜色明暗调整: amt>0 变亮(最多白), amt<0 变暗(最多黑)
  // 支持 #rgb / #rrggbb 格式,返回 #rrggbb
  shade(hex, amt){
    const h = hex.replace('#','');
    const n = h.length === 3 ? h.split('').map(c=>c+c).join('') : h;
    let r = parseInt(n.substr(0,2),16);
    let g = parseInt(n.substr(2,2),16);
    let b = parseInt(n.substr(4,2),16);
    if (amt >= 0){
      r = Math.round(r + (255-r)*amt);
      g = Math.round(g + (255-g)*amt);
      b = Math.round(b + (255-b)*amt);
    } else {
      r = Math.round(r * (1+amt));
      g = Math.round(g * (1+amt));
      b = Math.round(b * (1+amt));
    }
    const toHex = v => Math.max(0,Math.min(255,v)).toString(16).padStart(2,'0');
    return '#' + toHex(r) + toHex(g) + toHex(b);
  }
};

/* ===================== 九、子弹类 ===================== */
class Bullet {
  // dir 可选(兼容旧代码),优先用 vx,vy 连续方向(支持任意角度)
  constructor(x,y,dir,weapon,owner, vxOverride, vyOverride){
    this.x = x; this.y = y;
    this.dir = dir;
    if (vxOverride !== undefined && vyOverride !== undefined){
      this.vx = vxOverride;
      this.vy = vyOverride;
    } else {
      const v = DIR_VEC[dir];
      this.vx = v[0]*weapon.speed; this.vy = v[1]*weapon.speed;
    }
    this.w = 8; this.h = 8;
    this.dmg = weapon.dmg;
    this.color = weapon.color;
    this.weapon = weapon;
    this.owner = owner;       // 'player' | 'enemy'
    this.pierce = weapon.pierce;     // 穿透砖墙
    this.splash = weapon.splash;     // 爆炸半径
    this.type = weapon.type;         // 武器类型
    this.dead = false;
    this.life = 200;                 // 生命周期(帧)
    this.target = null;              // 追踪弹目标
    this.trail = [];                 // 拖尾
  }
  get rect(){ return { x:this.x-this.w/2, y:this.y-this.h/2, w:this.w, h:this.h }; }
  // 当前弹道角度(弧度,以x轴向右为0,y轴向下为+PI/2)
  get angle(){
    return Math.atan2(this.vy, this.vx);
  }

  update(dt, game){
    this.life--;
    if (this.life <= 0) this.dead = true;

    // 追踪弹:每帧调整方向朝向目标(玩家弹追敌人,敌方弹追玩家)
    if (this.type === 'homing'){
      if (this.owner === 'player'){
        if (!this.target || this.target.dead) this.target = game.findNearestEnemy(this.x, this.y);
      } else {
        this.target = game.player;
      }
      if (this.target && !this.target.dead){
        const tx = this.target.cx, ty = this.target.cy;
        const ang = Math.atan2(ty - this.y, tx - this.x);
        const sp = this.weapon.speed;
        // 平滑转向
        this.vx = this.vx*0.8 + Math.cos(ang)*sp*0.2;
        this.vy = this.vy*0.8 + Math.sin(ang)*sp*0.2;
        // 限制速度
        const m = Math.sqrt(this.vx*this.vx+this.vy*this.vy);
        if (m > sp){ this.vx = this.vx/m*sp; this.vy = this.vy/m*sp; }
      }
    }

    this.trail.push({x:this.x, y:this.y});
    if (this.trail.length > 6) this.trail.shift();

    // —— 子弹速度标准化: 旧 vx/vy 是「像素/帧@60Hz」, 按 dt/16.67 缩放为任意帧率一致速度 ——
    const bs = dt / 16.67;
    // [v60修复] 速度/位移非法值防御: NaN/Infinity/超大量 → 置为0,防止 steps 爆炸或穿墙
    if (!isFinite(this.vx)) this.vx = 0;
    if (!isFinite(this.vy)) this.vy = 0;
    const fvx = this.vx * bs, fvy = this.vy * bs;
    if (!isFinite(fvx) || Math.abs(fvx) > TILE*10) this.vx = 0;
    if (!isFinite(fvy) || Math.abs(fvy) > TILE*10) this.vy = 0;
    const moveDist = Math.hypot(this.vx*bs, this.vy*bs);
    // 分步检测: 位移超过半格(16px)时拆成小步, 防止穿墙(追踪弹转向/高dt跳格)
    const rawSteps = Math.ceil(moveDist / (TILE*0.4));
    const steps = Math.max(1, Math.min(rawSteps, 30));  // [v60修复] 步数上限30兜底,极端情况防卡死
    const sdx = (this.vx * bs) / steps;
    const sdy = (this.vy * bs) / steps;
    let hitTerrain = false;
    for (let si=0; si<steps && !this.dead && !hitTerrain; si++){
      // [v60修复] 单步增量也必须有限, 否则 grid[NaN][NaN] 崩溃
      if (!isFinite(sdx) || !isFinite(sdy)){ this.dead = true; break; }
      this.x += sdx;
      this.y += sdy;
      // 出界
      if (this.x < 0 || this.x > W || this.y < 0 || this.y > H){ this.dead = true; return; }
      // [v60修复] 坐标有限才查地形
      if (!isFinite(this.x) || !isFinite(this.y)){ this.dead = true; return; }
      // 撞击地形
      const cx = Util.toCell(this.x), cy = Util.toCell(this.y);
      if (cx>=0 && cx<COLS && cy>=0 && cy<ROWS){
        const cell = game.grid[cy][cx];
        if (cell.type === T.BRICK){
          if (this.pierce){ cell.hp -= this.dmg; if(cell.hp<=0){ cell.type=T.EMPTY; game.spawnBrickDebris(cx,cy); } }
          else {
            cell.hp -= this.dmg;
            if (cell.hp <= 0){ cell.type = T.EMPTY; game.spawnBrickDebris(cx,cy); }
            if (this.splash > 0){ this.explode(game); }
            this.dead = true; hitTerrain = true; break;
          }
        } else if (cell.type === T.STEEL){
          // 钢墙阻挡所有子弹(导弹爆炸但墙不破)
          if (this.splash > 0){ this.explode(game); }
          this.dead = true; hitTerrain = true; break;
        } else if (cell.type === T.BASE){
          // [v58修复] 只有敌方子弹能打基地,玩家子弹不打自己基地
          if (this.owner !== 'player'){
            game.damageBase(this.dmg);
            this.dead = true; hitTerrain = true; break;
          }
        }
        // 水/草/冰:子弹穿过
      }
    } // end for(steps)

    // 撞击坦克
    if (this.owner === 'player'){
      // 打敌人
      for (const e of game.enemies){
        if (!e.dead && Util.rectsHit(this.rect, e.rect)){
          e.hurt(this.dmg, game);
          if (this.splash > 0) this.explode(game);
          if (!this.pierce){ this.dead = true; return; }
        }
      }
      // 打BOSS
      if (game.boss && !game.boss.dead && Util.rectsHit(this.rect, game.boss.rect)){
        game.boss.hurt(this.dmg, game);
        if (this.splash > 0) this.explode(game);
        if (!this.pierce){ this.dead = true; return; }
      }
    } else {
      // 敌方子弹打玩家
      if (game.player && !game.player.dead && Util.rectsHit(this.rect, game.player.rect)){
        game.player.hurt(this.dmg, game, { bullet:true, splash: this.splash>0 });
        this.dead = true; return;
      }
      // 敌方子弹也能打基地
      const cx2 = Util.toCell(this.x), cy2 = Util.toCell(this.y);
      if (cx2>=0&&cx2<COLS&&cy2>=0&&cy2<ROWS && game.grid[cy2][cx2].type===T.BASE){
        game.damageBase(this.dmg); this.dead=true; return;
      }
    }

    // 子弹互相抵消(玩家子弹 vs 敌方子弹)
    for (const b of game.bullets){
      if (b === this || b.dead) continue;
      if (b.owner !== this.owner && Util.rectsHit(this.rect, b.rect)){
        b.dead = true; this.dead = true;
        game.spawnSparks(this.x, this.y, '#fff', 6);
        return;
      }
    }
  }

  // 导弹爆炸:范围伤害(带距离衰减)+破坏周围砖墙+冲击波碎片
  explode(game){
    const r = this.splash;
    const isEmp = (this.type === 'emp');
    const isPlasma = (this.type === 'plasma');
    // 导弹专属:额外加大爆炸半径 + 更强震屏 + 更大屏幕冲击,打击感更爽
    game.spawnExplosion(this.x, this.y, r * (isEmp ? 0.85 : 1.15));
    const missileShake = Math.floor(r * 0.55) + (this.owner==='player' ? 14 : 8);
    game.shake = Math.max(game.shake, Math.min(48, missileShake));
    game.screenFlash = Math.max(game.screenFlash, this.owner==='player' ? (isEmp ? 0.35 : 0.55) : 0.28);
    game.vignette    = Math.max(game.vignette,    this.owner==='player' ? (isEmp ? 0.30 : 0.45) : 0.22);
    // 范围伤害: 爆心1.0倍, 边缘0.3倍(距离衰减曲线)
    const hurtFalloff = (tx,ty) => {
      const d = Util.dist(this.x, this.y, tx, ty);
      if (d > r) return 0;
      const t = 1 - (d / r);
      // 曲线: 中心附近高, 快速衰减到 0.3
      return (0.3 + 0.7 * (t*t)) * this.dmg;
    };
    // 范围内敌人
    for (const e of game.enemies){
      if (e.dead) continue;
      const dmg = hurtFalloff(e.cx, e.cy);
      if (dmg > 0) e.hurt(dmg, game, { splash:true });
      // EMP 脉冲弹:范围内敌人瘫痪1.5秒(复用 freezeTimer)
      if (isEmp && dmg > 0){
        e.freezeTimer = Math.max(e.freezeTimer||0, 1500);
        game.spawnSparks(e.cx, e.cy, '#f472b6', 8);
      }
    }
    if (game.boss && !game.boss.dead){
      const dmg = hurtFalloff(game.boss.cx, game.boss.cy);
      if (dmg > 0) game.boss.hurt(dmg, game, { splash:true });
      // EMP 对 BOSS 瘫痪0.6秒(BOSS抗性)
      if (isEmp && dmg > 0){
        game.boss.freezeTimer = Math.max(game.boss.freezeTimer||0, 600);
      }
    }
    // 玩家也会被自己/敌人的爆炸溅射伤害(敌方导弹溅射,玩家自己导弹0.3倍)
    if (game.player && !game.player.dead){
      let dmg = hurtFalloff(game.player.cx, game.player.cy);
      if (dmg > 0){
        if (this.owner === 'player') dmg *= 0.3;
        game.player.hurt(dmg, game, { splash:true });
      }
    }
    // 破坏周围砖墙(距离衰减:越靠近越容易摧毁)
    const c0 = Util.toCell(this.x - r), c1 = Util.toCell(this.x + r);
    const r0 = Util.toCell(this.y - r), r1 = Util.toCell(this.y + r);
    for (let cy=r0; cy<=r1; cy++){
      for (let cx=c0; cx<=c1; cx++){
        if (cx>=0&&cx<COLS&&cy>=0&&cy<ROWS){
          const cell = game.grid[cy][cx];
          if (cell.type === T.BRICK){
            const d = Util.dist(this.x,this.y, cx*TILE+TILE/2, cy*TILE+TILE/2);
            if (d < r){
              const t = 1 - d/r;
              cell.hp -= this.dmg * (0.4 + 0.6*t);
              if (cell.hp <= 0){ cell.type = T.EMPTY; game.spawnBrickDebris(cx,cy); }
            }
          }
        }
      }
    }
  }

  render(ctx){
    // 拖尾
    for (let i=0;i<this.trail.length;i++){
      const p = this.trail[i];
      ctx.globalAlpha = (i+1)/this.trail.length * 0.4;
      ctx.fillStyle = this.color;
      ctx.fillRect(p.x-2, p.y-2, 4, 4);
    }
    ctx.globalAlpha = 1;
    // 弹体
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color; ctx.shadowBlur = 8;
    ctx.beginPath();
    const bRadius = (this.type==='missile'||this.type==='plasma') ? 5 : (this.type==='emp' ? 6 : 3.5);
    ctx.arc(this.x, this.y, bRadius, 0, Math.PI*2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // 导弹画个小三角头
    if (this.type === 'missile'){
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(this.x,this.y,2,0,Math.PI*2); ctx.fill();
    }
    // 等离子炮: 画个白色亮核
    if (this.type === 'plasma'){
      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath(); ctx.arc(this.x,this.y,2.5,0,Math.PI*2); ctx.fill();
    }
    // 脉冲弹: 画个脉冲环
    if (this.type === 'emp'){
      ctx.strokeStyle = '#fce7f3'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(this.x,this.y,4,0,Math.PI*2); ctx.stroke();
    }
  }
}

/* ===================== 九B、激光(充能发射·钢墙反射) ===================== */
// 玩家每攻击5次,下次空格发射激光:沿方向射线,遇钢墙镜像反射(最多3次),
// 遇砖墙破坏并停止,遇敌人/BOSS穿透造成高伤害,遇边界/基地停止
class Laser {
  // 构造: 支持「离散4方向 DIR」或「连续弧度 angle(rad)」两种入口
  // opts: { weak:false, power:1 }
  //   weak=true  → 普通激光(攻击5次触发): 细线、低伤害、淡色、无分支
  //   weak=false → 激光武器(槽位8蓄力释放): 粗光束、辉光、分支发散,power=1~5控制强度
  constructor(x, y, dirOrAngle, dmg, game, useAngle=false, opts={}){
    this.points = [];          // 主折线路径点 [{x,y}, ...]
    this.branches = [];        // 边界发散出的子光路径 [[{x,y},...], ...]
    this.dmg = dmg;
    this.weak = !!opts.weak;
    this.power = Math.max(1, Math.min(5, opts.power || 1));
    this.life = this.weak ? 10 : (14 + this.power * 2);  // 激光武器更持久
    this.maxLife = this.life;
    this.dead = false;
    // 颜色:普通激光=淡青, 激光武器=随等级从青→白→紫渐变
    if (this.weak){
      this.color = '#a5f3fc';
    } else if (this.power >= 5){
      this.color = '#ffffff';
    } else if (this.power >= 4){
      this.color = '#22d3ee';
    } else {
      this.color = '#67e8f9';
    }
    if (useAngle){
      const ang = Number(dirOrAngle);
      const vx = Math.cos(ang), vy = Math.sin(ang);
      this.traceAnyAngle(x, y, vx, vy, game);
    } else {
      const v = DIR_VEC[dirOrAngle];
      this.traceAnyAngle(x, y, v[0], v[1], game);
    }
  }

  // 用 DDA 网格遍历(一次移动一格,不是 3px), 同时射线-AABB 命中敌人
  traceAnyAngle(sx, sy, vx, vy, game){
    this.points.push({ x:sx, y:sy });
    // 处理零方向
    if (Math.abs(vx) < 1e-6 && Math.abs(vy) < 1e-6){ this.points.push({x:sx, y:sy}); return; }
    const maxDist = 2400;
    const grid = game.grid;
    const hitTargets = new Set();
    let bounces = 0;

    // 反射循环 (最多 3 次钢墙反射)
    let rx = sx, ry = sy;   // 当前射线起点
    let rvx = vx, rvy = vy; // 当前方向向量
    let curDist = 0;

    while (bounces <= 3 && curDist < maxDist){
      // —— DDA 初始化 (以格为单位移动) ——
      const inv = Util.toCell;
      let cellX = inv(rx), cellY = inv(ry);
      const stepX = rvx >= 0 ? 1 : -1;
      const stepY = rvy >= 0 ? 1 : -1;
      // 当前点到下一条 X/Y 网格线的 t 参数 (沿方向归一化距离)
      const nextGridX = (cellX + (rvx >= 0 ? 1 : 0)) * TILE;
      const nextGridY = (cellY + (rvy >= 0 ? 1 : 0)) * TILE;
      let tMaxX = (Math.abs(rvx) > 1e-6) ? (nextGridX - rx) / rvx : Infinity;
      let tMaxY = (Math.abs(rvy) > 1e-6) ? (nextGridY - ry) / rvy : Infinity;
      const tDeltaX = (Math.abs(rvx) > 1e-6) ? Math.abs(TILE / rvx) : Infinity;
      const tDeltaY = (Math.abs(rvy) > 1e-6) ? Math.abs(TILE / rvy) : Infinity;

      let tTotal = 0;  // 当前反射段已走距离
      let hitSomething = false;
      const segStartX = rx, segStartY = ry;  // 本段起点
      let segEndX = rx, segEndY = ry;        // 本段终点(碰墙或最大距)

      while (curDist + tTotal < maxDist){
        // 前进到下一个网格边界
        let tStep, enterCellX, enterCellY, fromXdir;
        if (tMaxX < tMaxY){
          tStep = tMaxX; tMaxX += tDeltaX;
          enterCellX = cellX + stepX; enterCellY = cellY;
          cellX = enterCellX;
          fromXdir = true;
        } else {
          tStep = tMaxY; tMaxY += tDeltaY;
          enterCellX = cellX; enterCellY = cellY + stepY;
          cellY = enterCellY;
          fromXdir = false;
        }
        if (!isFinite(tStep) || tStep < 0) break;
        tTotal = tStep;
        const walkX = segStartX + rvx * tTotal;
        const walkY = segStartY + rvy * tTotal;
        // 超出最大距离
        if (curDist + tTotal > maxDist){
          const overT = (curDist + tTotal - maxDist);
          const t = tTotal - overT;
          segEndX = segStartX + rvx*t; segEndY = segStartY + rvy*t;
          break;
        }
        // 出界
        if (enterCellX < 0 || enterCellX >= COLS || enterCellY < 0 || enterCellY >= ROWS){
          const bx = Util.clamp(walkX, 2, W-2), by = Util.clamp(walkY, 2, H-2);
          this.points.push({ x:bx, y:by });
          // 普通激光不生成分支发散光(只有激光武器才有壮观分支)
          if (!this.weak){
            this.branches.push(this.traceBranch(bx, by, -rvy, rvx, game));
            this.branches.push(this.traceBranch(bx, by,  rvy, -rvx, game));
          }
          game.spawnSparks(bx, by, this.weak ? '#a5f3fc' : '#67e8f9', this.weak ? 6 : 14);
          this._collectHitsOnSegment(segStartX, segStartY, bx, by, game, hitTargets);
          return;
        }
        const cell = grid[enterCellY][enterCellX];
        if (cell.type === T.STEEL){
          // 钢墙 → 反射一次
          this.points.push({ x:walkX, y:walkY });
          game.spawnSparks(walkX, walkY, '#67e8f9', 6);
          this._collectHitsOnSegment(segStartX, segStartY, walkX, walkY, game, hitTargets);
          // 反射:轴向
          if (fromXdir) rvx = -rvx;
          else          rvy = -rvy;
          rx = walkX; ry = walkY;
          bounces++;
          curDist += tTotal;
          hitSomething = true;
          break;
        }
        if (cell.type === T.BRICK){
          cell.hp -= this.dmg;
          if (cell.hp <= 0){ cell.type = T.EMPTY; game.spawnBrickDebris(enterCellX, enterCellY); }
          this.points.push({ x:walkX, y:walkY });
          this._collectHitsOnSegment(segStartX, segStartY, walkX, walkY, game, hitTargets);
          return;
        }
        if (cell.type === T.BASE){
          this.points.push({ x:walkX, y:walkY });
          this._collectHitsOnSegment(segStartX, segStartY, walkX, walkY, game, hitTargets);
          return;
        }
      }
      if (hitSomething){ continue; } // 反射了,重开 DDA

      // 整段走完(无墙体阻挡或达到最大距离)
      if (!hitSomething){
        // 没碰墙, 直接把最后一段写进去
        if (curDist + tTotal >= maxDist){
          this.points.push({ x:segEndX, y:segEndY });
          this._collectHitsOnSegment(segStartX, segStartY, segEndX, segEndY, game, hitTargets);
        } else if (this.points.length < 2 || Math.abs(this.points[this.points.length-1].x - segStartX) > 0.1 || Math.abs(this.points[this.points.length-1].y - segStartY) > 0.1){
          // 异常情况: 收尾补一个端点
          const ex = segStartX + rvx * Math.min(tTotal, maxDist - curDist);
          const ey = segStartY + rvy * Math.min(tTotal, maxDist - curDist);
          this.points.push({ x:ex, y:ey });
          this._collectHitsOnSegment(segStartX, segStartY, ex, ey, game, hitTargets);
        }
        break;
      }
    }
  }

  // 线段 vs 所有潜在目标 (AABB 射线相交) 一次性打伤害, 不做逐像素点检查
  _collectHitsOnSegment(x1, y1, x2, y2, game, hitTargets){
    const dx = x2-x1, dy = y2-y1;
    // 目标列表: enemies + boss (玩家发射的激光永不自伤, 跳过 game.player)
    const targets = [];
    for (const e of game.enemies) if (!e.dead && !hitTargets.has(e)) targets.push(e);
    if (game.boss && !game.boss.dead && !hitTargets.has(game.boss)) targets.push(game.boss);
    for (const t of targets){
      // 线段 vs AABB (求 t∈[0,1] 上的交集)
      const minX = t.x, maxX = t.x + t.w;
      const minY = t.y, maxY = t.y + t.h;
      let tmin = 0, tmax = 1;
      // X 轴
      if (Math.abs(dx) < 1e-6){
        if (x1 < minX || x1 > maxX) continue;
      } else {
        const inv_dx = 1 / dx;
        let t1 = (minX - x1) * inv_dx;
        let t2 = (maxX - x1) * inv_dx;
        if (t1 > t2){ const tmp=t1; t1=t2; t2=tmp; }
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) continue;
      }
      // Y 轴
      if (Math.abs(dy) < 1e-6){
        if (y1 < minY || y1 > maxY) continue;
      } else {
        const inv_dy = 1 / dy;
        let t1 = (minY - y1) * inv_dy;
        let t2 = (maxY - y1) * inv_dy;
        if (t1 > t2){ const tmp=t1; t1=t2; t2=tmp; }
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) continue;
      }
      if (tmin > 1 || tmax < 0) continue;
      const tt = Math.max(0, Math.min(1, tmin));
      const hx = x1 + dx * tt;
      const hy = y1 + dy * tt;
      t.hurt(this.dmg, game);
      hitTargets.add(t);
      const sp = (t === game.boss) ? '#a855f7' : '#22d3ee';
      game.spawnSparks(hx, hy, sp, t === game.boss ? 8 : 6);
    }
  }

  // 发散光追踪: 同样 DDA + 线段 AABB 打伤害
  traceBranch(sx, sy, vx, vy, game){
    const points = [{ x:sx, y:sy }];
    const branchDmg = this.dmg * 0.5;
    const maxDist = 2000;
    if (Math.abs(vx) < 1e-6 && Math.abs(vy) < 1e-6){ points.push({x:sx, y:sy}); return points; }
    const grid = game.grid;
    const hitTargets = new Set();

    let cellX = Util.toCell(sx), cellY = Util.toCell(sy);
    const stepX = vx >= 0 ? 1 : -1;
    const stepY = vy >= 0 ? 1 : -1;
    const nextGridX = (cellX + (vx >= 0 ? 1 : 0)) * TILE;
    const nextGridY = (cellY + (vy >= 0 ? 1 : 0)) * TILE;
    let tMaxX = (Math.abs(vx) > 1e-6) ? (nextGridX - sx) / vx : Infinity;
    let tMaxY = (Math.abs(vy) > 1e-6) ? (nextGridY - sy) / vy : Infinity;
    const tDeltaX = (Math.abs(vx) > 1e-6) ? Math.abs(TILE / vx) : Infinity;
    const tDeltaY = (Math.abs(vy) > 1e-6) ? Math.abs(TILE / vy) : Infinity;
    let t = 0;
    let lastT = 0;
    let finished = false;

    while (t < maxDist && !finished){
      let tStep, enterCellX, enterCellY;
      if (tMaxX < tMaxY){
        tStep = tMaxX; tMaxX += tDeltaX;
        enterCellX = cellX + stepX; enterCellY = cellY;
        cellX = enterCellX;
      } else {
        tStep = tMaxY; tMaxY += tDeltaY;
        enterCellX = cellX; enterCellY = cellY + stepY;
        cellY = enterCellY;
      }
      if (!isFinite(tStep) || tStep < 0) break;
      if (tStep > maxDist) tStep = maxDist;
      t = tStep;
      const wx = sx + vx*tStep, wy = sy + vy*tStep;
      if (wx < 2 || wx > W-2 || wy < 2 || wy > H-2){
        points.push({ x:Util.clamp(wx,2,W-2), y:Util.clamp(wy,2,H-2) });
        this._collectHitsOnBranchSegment(sx, sy, Util.clamp(wx,2,W-2), Util.clamp(wy,2,H-2), game, hitTargets, branchDmg);
        finished = true; break;
      }
      if (enterCellX<0||enterCellX>=COLS||enterCellY<0||enterCellY>=ROWS){
        points.push({ x:wx, y:wy }); finished = true; break;
      }
      const cell = grid[enterCellY][enterCellX];
      if (cell.type === T.BRICK){
        cell.hp -= branchDmg;
        if (cell.hp <= 0){ cell.type = T.EMPTY; game.spawnBrickDebris(enterCellX, enterCellY); }
        points.push({ x:wx, y:wy });
        this._collectHitsOnBranchSegment(sx, sy, wx, wy, game, hitTargets, branchDmg);
        finished = true; break;
      }
      if (cell.type === T.STEEL || cell.type === T.WATER || cell.type === T.BASE){
        game.spawnSparks(wx, wy, '#a5f3fc', 10);
        points.push({ x:wx, y:wy });
        this._collectHitsOnBranchSegment(sx, sy, wx, wy, game, hitTargets, branchDmg);
        finished = true; break;
      }
      lastT = tStep;
    }
    if (!finished){
      const ex = sx + vx * Math.min(t, maxDist);
      const ey = sy + vy * Math.min(t, maxDist);
      points.push({ x:ex, y:ey });
      this._collectHitsOnBranchSegment(sx, sy, ex, ey, game, hitTargets, branchDmg);
    }
    if (points.length === 1){ points.push({ x:sx + vx*TILE, y:sy + vy*TILE }); }
    return points;
  }

  _collectHitsOnBranchSegment(x1, y1, x2, y2, game, hitTargets, branchDmg){
    const dx = x2-x1, dy = y2-y1;
    const targets = [];
    for (const e of game.enemies) if (!e.dead && !hitTargets.has(e)) targets.push(e);
    if (game.boss && !game.boss.dead && !hitTargets.has(game.boss)) targets.push(game.boss);
    for (const t of targets){
      const minX = t.x, maxX = t.x + t.w;
      const minY = t.y, maxY = t.y + t.h;
      let tmin = 0, tmax = 1;
      if (Math.abs(dx) < 1e-6){ if (x1 < minX || x1 > maxX) continue; }
      else {
        const inv = 1/dx;
        let a=(minX-x1)*inv, b=(maxX-x1)*inv;
        if (a>b){ const tmp=a; a=b; b=tmp; }
        if (a>tmin) tmin=a; if (b<tmax) tmax=b;
        if (tmin>tmax) continue;
      }
      if (Math.abs(dy) < 1e-6){ if (y1 < minY || y1 > maxY) continue; }
      else {
        const inv = 1/dy;
        let a=(minY-y1)*inv, b=(maxY-y1)*inv;
        if (a>b){ const tmp=a; a=b; b=tmp; }
        if (a>tmin) tmin=a; if (b<tmax) tmax=b;
        if (tmin>tmax) continue;
      }
      if (tmin>1 || tmax<0) continue;
      const tt = Math.max(0, Math.min(1, tmin));
      t.hurt(branchDmg, game);
      hitTargets.add(t);
      game.spawnSparks(x1 + dx*tt, y1 + dy*tt, t===game.boss?'#fbbf24':t.color, 6);
      return; // 分支只命中第一个目标即停
    }
  }

  update(){
    this.life--;
    if (this.life <= 0) this.dead = true;
  }
  render(ctx){
    if (this.points.length < 2) return;
    const a = this.life / this.maxLife;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.shadowColor = this.color;

    const drawPath = (pts, w, alpha, color) => {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    };

    if (this.weak){
      // —— 普通激光(攻击5次触发): 单层细线 + 淡辉光,视觉低调 ——
      ctx.shadowBlur = 8;
      drawPath(this.points, 5, a * 0.25, this.color);  // 外层淡光晕
      drawPath(this.points, 2.5, a * 0.6, this.color); // 中层
      drawPath(this.points, 1, a, '#e0f7ff');          // 核心细线
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      return;
    }

    // —— 激光武器(槽位8蓄力释放): 三层粗光束, power 等级越粗越亮 ——
    const p = this.power;
    const outerW = 10 + p * 2.5;   // 外层光晕宽度(Lv1=12.5 ~ Lv5=22.5)
    const midW   = 5 + p * 1.2;    // 中层宽度
    const coreW  = 1.5 + p * 0.3;  // 核心白光宽度
    ctx.shadowBlur = 18 + p * 6;   // 辉光强度随等级
    drawPath(this.points, outerW, a * 0.35, this.color);            // 外层光晕
    drawPath(this.points, midW,   a * 0.7,  this.color);            // 中层
    drawPath(this.points, coreW,  a,        '#ffffff');             // 核心白光
    // Lv4+: 额外紫色辉光层(更显眼)
    if (p >= 4){
      ctx.shadowColor = '#a855f7';
      drawPath(this.points, midW + 2, a * 0.4, '#a855f7');
      ctx.shadowColor = this.color;
    }
    // Lv5: 极致满级 → 彩虹核心(白+紫+青交织)
    if (p >= 5){
      drawPath(this.points, coreW + 1.5, a * 0.6, '#f0abfc');
    }

    // —— 边界发散光(激光武器专属,壮观分支) ——
    const branchColor = '#a5f3fc';
    ctx.shadowColor = branchColor;
    ctx.shadowBlur = 12;
    for (const br of this.branches){
      if (br.length < 2) continue;
      drawPath(br, 7, a * 0.3, branchColor);   // 外层光晕
      drawPath(br, 3.5, a * 0.6, branchColor); // 中层
      drawPath(br, 1.4, a * 0.9, '#ffffff');   // 核心
    }

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
}

/* ===================== 十、坦克基类 ===================== */
class Tank {
  constructor(col, row){
    this.w = TILE*0.85; this.h = TILE*0.85;
    this.cx = col*TILE + TILE/2;  // 中心坐标
    this.cy = row*TILE + TILE/2;
    this.x = this.cx - this.w/2;   // 左上角
    this.y = this.cy - this.h/2;
    this.dir = DIR.UP;                // 兼容4方向枚举(敌人AI仍使用)
    this.bodyAngle = -Math.PI/2;      // 车身连续角度(弧度): 0→右, -PI/2→上, +PI/2→下, ±PI→左
    this.turretAngle = -Math.PI/2;    // 炮管连续角度(可独立跟随鼠标,指哪打哪)
    // —— 速度/角速度单位改为「每秒」,乘以 dt/1000 可统一跨刷新率位移 ——
    this.speedBase = 96;              // 前进基础速度(像素/秒, ≈1.6px/帧 @60Hz,略快于旧1.4)
    this.reverseSpeedMul = 0.72;      // 倒车速度比例(稍微提高,更机动)
    this.turnSpeedBase = 4.8;         // 原地转向角速度(弧度/秒,≈275°/s,比旧快2.5x)
    this.turnSpeedForward = 3.4;      // 前进中转向角速度(弧度/秒,≈195°/s,避免高速转太猛)
    this.turnSpeedReverse = 2.6;      // 倒车中转向角速度
    // 平滑缓动:油门(-1..1)/转向(-1..1),避免 0→max 突然起步/急刹
    this.moveSmooth = 0;
    this.turnSmooth = 0;
    this.hp = 100; this.maxHp = 100;
    this.dead = false;
    this.fireTimer = 0;
    this.moving = 0;                  // 正=前进, 负=倒车, 0=静止(用于履带动画方向)
    this.animTick = 0;                // 履带动画
    this.spawnFlash = 30;             // 出生闪烁
  }
  get rect(){ return { x:this.x, y:this.y, w:this.w, h:this.h }; }
  // 同步:将 bodyAngle 四舍五入到最近的 DIR 枚举(兼容老逻辑)
  syncDirFromAngle(){
    const a = this.bodyAngle;
    const deg = a * 180 / Math.PI;
    // 以 -157.5/-67.5/22.5/112.5 为分界
    let d = DIR.UP;
    if (deg >= -22.5 && deg < 67.5) d = DIR.RIGHT;
    else if (deg >= 67.5 && deg < 157.5) d = DIR.DOWN;
    else if (deg >= 157.5 || deg < -157.5) d = DIR.LEFT;
    else if (deg >= -112.5 && deg < -22.5) d = DIR.UP;
    this.dir = d;
  }
  // 将指定的目标角度值归一化到 [-PI, PI]
  normAngle(a){
    while (a > Math.PI) a -= Math.PI*2;
    while (a < -Math.PI) a += Math.PI*2;
    return a;
  }
  // 朝目标角度平滑旋转车身, 返回true表示到达
  turnBodyTowards(targetAngle, maxTurn){
    const diff = this.normAngle(targetAngle - this.bodyAngle);
    if (Math.abs(diff) <= maxTurn){
      this.bodyAngle = targetAngle;
      this.syncDirFromAngle();
      return true;
    }
    this.bodyAngle += Math.sign(diff) * maxTurn;
    this.syncDirFromAngle();
    return false;
  }
  // 朝目标角度平滑旋转炮管, 返回true表示到达
  turnTurretTowards(targetAngle, maxTurn){
    const diff = this.normAngle(targetAngle - this.turretAngle);
    if (Math.abs(diff) <= maxTurn){
      this.turretAngle = targetAngle;
      return true;
    }
    this.turretAngle += Math.sign(diff) * maxTurn;
    return false;
  }

  // 尝试移动 dx,dy,带碰撞检测
  // 检查指定 (x,y) 左上角位置是否合法(不越界、不撞地形),不含坦克间碰撞
  _positionLegal(nx, ny, game){
    // [v60修复] NaN/Infinity 污染防御:坐标非有限数直接返回false,阻止 grid[NaN][NaN] 类型崩溃
    if (!isFinite(nx) || !isFinite(ny)) return false;
    if (nx < 0 || nx+this.w > W || ny < 0 || ny+this.h > H) return false;
    const c0 = Util.toCell(nx), c1 = Util.toCell(nx+this.w-1);
    const r0 = Util.toCell(ny), r1 = Util.toCell(ny+this.h-1);
    // [v60修复] 格坐标也必须是有限整数,否则跳过
    if (!isFinite(c0)||!isFinite(c1)||!isFinite(r0)||!isFinite(r1)) return false;
    for (let cy=r0; cy<=r1; cy++){
      for (let cx=c0; cx<=c1; cx++){
        if (cx<0||cx>=COLS||cy<0||cy>=ROWS) return false;
        const row = game.grid[cy];
        if (!row) return false;
        const cell = row[cx];
        if (!cell) return false;
        const t = cell.type;
        if (t===T.BRICK || t===T.STEEL || t===T.WATER || t===T.BASE) return false;
      }
    }
    return true;
  }

  tryMove(dx, dy, game){
    // [v60修复] 位移非法值防御:NaN/Infinity/超大量 → 归零,防止递归崩溃或穿墙
    if (!isFinite(dx)) dx = 0;
    if (!isFinite(dy)) dy = 0;
    // 位移过大(>5格) → 截断,避免 steps 爆炸
    const dist = Math.hypot(dx, dy);
    const MAX_MOVE = TILE * 5;
    if (dist > MAX_MOVE){ const k = MAX_MOVE/dist; dx *= k; dy *= k; }
    // —— 大位移安全网: 位移超过半格时分步移动, 防止跳过钢墙/水/基地 ——
    // (击退/冲撞等一帧推 70px+, tryMove 只检查终点角点, 会跳过中间的墙)
    if (dist > TILE * 0.5){
      const steps = Math.ceil(dist / (TILE * 0.5));
      // [v60修复] 步数上限兜底(20步),极端情况防止死循环
      const safeSteps = Math.min(steps, 20);
      const sx = dx / safeSteps, sy = dy / safeSteps;
      let movedAny = false;
      for (let i = 0; i < safeSteps; i++){
        if (this.tryMove(sx, sy, game)) movedAny = true;
      }
      return movedAny;
    }
    // —— 沿墙滑移: 先整体, 再单独X, 再单独Y, 再半步。记录各分量是否成功 ——
    let movedX = false, movedY = false;
    let nx = this.x + dx, ny = this.y + dy;
    if (this._positionLegal(nx, ny, game)){
      // 整体合法: 先暂定, 后面再查坦克碰撞
      this.x = nx; this.y = ny;
      movedX = dx !== 0; movedY = dy !== 0;
    } else {
      // 分别尝试 X 分量
      let movedAny = false;
      if (dx !== 0 && this._positionLegal(this.x+dx, this.y, game)){
        this.x += dx; movedX = true; movedAny = true;
      }
      if (dy !== 0 && this._positionLegal(this.x, this.y+dy, game)){
        this.y += dy; movedY = true; movedAny = true;
      }
      if (!movedAny && (dx !== 0 || dy !== 0)){
        // 再尝试「半步滑移」(0.62x + 0.62y), 防止网格棱角刚好卡住
        const hx = dx*0.62, hy = dy*0.62;
        if (this._positionLegal(this.x+hx, this.y+hy, game)){
          this.x += hx; this.y += hy; movedX = hx !== 0; movedY = hy !== 0;
        } else {
          // 最后再分别试半步X/Y
          if (dx !== 0 && this._positionLegal(this.x+hx, this.y, game)){
            this.x += hx; movedX = true;
          }
          if (dy !== 0 && this._positionLegal(this.x, this.y+hy, game)){
            this.y += hy; movedY = true;
          }
        }
      }
    }
    this.cx = this.x + this.w/2; this.cy = this.y + this.h/2;

    // 坦克间碰撞 —— 检测重叠,不直接拒绝(避免黏连卡住):
    // 1) 有伤害冷却则造成碰撞伤害(不重复)
    // 2) 若 testRect 会与其他坦克重叠 → 尝试「只保留X分量/Y分量」解冲突
    // 3) 若当前位置已重叠(黏连),则把 this 沿最短轴推开
    const others = [game.player, ...game.enemies, game.boss].filter(t=>t && t!==this && !t.dead);
    let anyCurHit = false;
    let undoY = false, undoX = false;
    for (const o of others){
      const curHit = Util.rectsHit(this.rect, o.rect);
      if (curHit) anyCurHit = true;
      const testHit = curHit;  // 上面已经按整体/X/Y/半步移动过, rect 就是当前最新
      if (testHit || curHit){
        // 施加碰撞伤害(带冷却)
        if (!this.collideCd) this.collideCd = 0;
        if (!o.collideCd) o.collideCd = 0;
        if (this.collideCd <= 0){
          let dmg = 5;
          if (this.type === 'suicide' || o.type === 'suicide') dmg = 20;
          if ((this instanceof EnemyTank && o instanceof PlayerTank) ||
              (this instanceof PlayerTank && o instanceof EnemyTank)) dmg = 8;
          if (this instanceof BossTank || o instanceof BossTank) dmg = 12;
          o.hurt(dmg, game);
          this.hurt(dmg*0.6, game);
          this.collideCd = 500;
          o.collideCd = 500;
          game.spawnSparks((this.cx+o.cx)/2, (this.cy+o.cy)/2, '#fbbf24', 8);
          game.shake = Math.max(game.shake, 3);
        }
      }
    }
    // 如果当前和其他坦克重叠,尝试回滚 y/x 分量解冲突(更丝滑,而非整步拒绝)
    if (anyCurHit){
      const candidates = [];
      if (movedX && movedY){
        // 尝试回滚Y, 保留X
        const sx = this.x, sy = this.y - dy;
        if (Util.rectsHit({x:sx,y:sy,w:this.w,h:this.h}, (game.player && game.player!==this?game.player:null)?.rect || null) === false) { /* skip */ }
        candidates.push({ x:sx, y:sy, keep:'x' });
        // 尝试回滚X, 保留Y
        candidates.push({ x:this.x - dx, y:this.y, keep:'y' });
        // 回滚到移动前(最坏)
        candidates.push({ x:this.x - dx, y:this.y - dy, keep:'none' });
      } else {
        candidates.push({ x:this.x - dx, y:this.y - dy, keep:'none' });
      }
      // 对 candidates 做合法性 + 坦克不重叠 双重检查, 选第一个可行
      let applied = false;
      for (const c of candidates){
        if (!this._positionLegal(c.x, c.y, game)) continue;
        const rect = { x:c.x, y:c.y, w:this.w, h:this.h };
        let collideTank = false;
        for (const o of others){
          if (Util.rectsHit(rect, o.rect)){ collideTank = true; break; }
        }
        if (!collideTank){
          this.x = c.x; this.y = c.y;
          this.cx = this.x + this.w/2; this.cy = this.y + this.h/2;
          if (c.keep === 'x') movedY = false;
          else if (c.keep === 'y') movedX = false;
          else { movedX = false; movedY = false; }
          applied = true;
          break;
        }
      }
      if (!applied){
        // 都不行: 直接用 separateFrom 推开
        for (const o of others){
          if (Util.rectsHit(this.rect, o.rect)) this.separateFrom(o, game);
        }
      }
    }
    // 冷却递减
    if (this.collideCd > 0) this.collideCd -= 16;
    return movedX || movedY;
  }

  // 将 this 从 o 中推开(沿重叠最短轴),避开地形与边界
  separateFrom(o, game){
    const overlapX = Math.min(this.x+this.w, o.x+o.w) - Math.max(this.x, o.x);
    const overlapY = Math.min(this.y+this.h, o.y+o.h) - Math.max(this.y, o.y);
    let pushX = 0, pushY = 0;
    if (overlapX < overlapY){
      // 沿X轴推开
      pushX = (this.x < o.x) ? -overlapX : overlapX;
    } else {
      // 沿Y轴推开
      pushY = (this.y < o.y) ? -overlapY : overlapY;
    }
    const tx = this.x + pushX;
    const ty = this.y + pushY;
    // 边界钳制
    const fx = Util.clamp(tx, 0, W-this.w);
    const fy = Util.clamp(ty, 0, H-this.h);
    // 地形检查:推开后的位置不能陷入砖墙/钢墙/水/基地
    const c0 = Util.toCell(fx), c1 = Util.toCell(fx+this.w-1);
    const r0 = Util.toCell(fy), r1 = Util.toCell(fy+this.h-1);
    let terrainOK = true;
    for (let cy=r0; cy<=r1 && terrainOK; cy++){
      for (let cx=c0; cx<=c1 && terrainOK; cx++){
        if (cx<0||cx>=COLS||cy<0||cy>=ROWS){ terrainOK = false; break; }
        const t = game.grid[cy][cx].type;
        if (t===T.BRICK || t===T.STEEL || t===T.WATER || t===T.BASE) terrainOK = false;
      }
    }
    if (terrainOK){
      this.x = fx; this.y = fy;
      this.cx = this.x + this.w/2; this.cy = this.y + this.h/2;
    } else {
      // 直接推开撞地形 → 尝试只推X或只推Y,或减半步长
      const tryFns = [
        ()=>({x: Util.clamp(this.x+pushX,0,W-this.w), y: this.y}),
        ()=>({x: this.x, y: Util.clamp(this.y+pushY,0,H-this.h)}),
        ()=>({x: Util.clamp(this.x+pushX*0.5,0,W-this.w), y: Util.clamp(this.y+pushY*0.5,0,H-this.h)})
      ];
      for (const f of tryFns){
        const {x:tx2, y:ty2} = f();
        const c0=Util.toCell(tx2), c1=Util.toCell(tx2+this.w-1);
        const r0=Util.toCell(ty2), r1=Util.toCell(ty2+this.h-1);
        let ok = true;
        for (let cy=r0; cy<=r1 && ok; cy++){
          for (let cx=c0; cx<=c1 && ok; cx++){
            if (cx<0||cx>=COLS||cy<0||cy>=ROWS){ ok=false; break; }
            const t = game.grid[cy][cx].type;
            if (t===T.BRICK || t===T.STEEL || t===T.WATER || t===T.BASE) ok=false;
          }
        }
        if (ok){
          this.x = tx2; this.y = ty2;
          this.cx = this.x + this.w/2; this.cy = this.y + this.h/2;
          break;
        }
      }
    }
  }

  // 当前所在格子的地形(用于冰面打滑/草丛隐身)
  currentTerrain(game){
    const cx = Util.toCell(this.cx), cy = Util.toCell(this.cy);
    if (cx<0||cx>=COLS||cy<0||cy>=ROWS) return T.EMPTY;
    return game.grid[cy][cx].type;
  }

  hurt(dmg, game){
    this.hp -= dmg;
    if (this.hp <= 0){ this.hp = 0; this.die(game); }
  }
  die(game){ this.dead = true; }

  // 通用渲染:画坦克贴图+履带+炮管
  // tdef/tankId 仅 PlayerTank 传入,用于差异化外观(敌方坦克传 undefined 走旧逻辑)
  renderBody(ctx, imgKey, fallbackColor, tdef, tankId){
    ctx.save();
    ctx.translate(this.cx, this.cy);
    // —— 车身 + 履带(用 bodyAngle 连续旋转): 约定 -PI/2 对应"朝上"(坦克贴图默认方向) ——
    const rot = this.bodyAngle + Math.PI/2;
    ctx.rotate(rot);
    // 出生闪烁
    if (this.spawnFlash > 0){
      ctx.globalAlpha = (Math.floor(this.spawnFlash/4)%2) ? 0.4 : 1;
    }
    const img = Assets.get(imgKey);
    const s = this.w;
    const baseColor = fallbackColor;
    // 坦克型号辅助色(若有)
    const accentColor = (tdef && tdef.accent) ? tdef.accent : Util.shade(baseColor, 0.45);
    const isPlayerModel = Number.isInteger(tankId) && this instanceof PlayerTank;

    if (img){
      // 有贴图:纯色底+履带+炮塔+贴图叠加
      ctx.fillStyle = baseColor;
      ctx.fillRect(-s/2, -s/2, s, s);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(-s/2, -s/2, s*0.16, s);
      ctx.fillRect(s*0.34, -s/2, s*0.16, s);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.arc(0, 0, s*0.22, 0, Math.PI*2); ctx.fill();
      ctx.drawImage(img, -s/2, -s/2, s, s);
      // 颜色叠加层:确保不同类型坦克颜色可区分(即使贴图不透明也能染色)
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = 0.38;
      ctx.fillStyle = baseColor;
      ctx.fillRect(-s/2, -s/2, s, s);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    } else {
      // —— 程序化精细绘制(无贴图):立体装甲车身+动画履带+高光炮塔 ——
      // 1) 车身主体:垂直渐变(上亮下暗,营造俯视立体感)
      const bodyGrad = ctx.createLinearGradient(0, -s/2, 0, s/2);
      bodyGrad.addColorStop(0, Util.shade(baseColor, 0.28));
      bodyGrad.addColorStop(0.5, baseColor);
      bodyGrad.addColorStop(1, Util.shade(baseColor, -0.28));
      ctx.fillStyle = bodyGrad;
      ctx.fillRect(-s/2, -s/2, s, s);
      // 2) 履带(两侧深色条)+ 滚动条纹(移动时动画)
      const trackW = s*0.17;
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(-s/2, -s/2, trackW, s);
      ctx.fillRect(s/2-trackW, -s/2, trackW, s);
      // 履带齿纹(随移动滚动,前进向下,倒车向上)
      let treadOffset = 0;
      if (this.moving){
        const dir = this.moving > 0 ? 1 : -1;
        treadOffset = (Math.floor(this.animTick/3 * dir) % 4) * (s/4);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      for (let i=-1; i<5; i++){
        const ty = -s/2 + i*(s/4) + treadOffset;
        if (ty > -s/2 - s/4 && ty < s/2){
          ctx.fillRect(-s/2+1, ty, trackW-2, 2);
          ctx.fillRect(s/2-trackW+1, ty, trackW-2, 2);
        }
      }
      // 3) 装甲板:中央车体(略小于外框,带高光/阴影边)
      const inset = s*0.18;
      const plateGrad = ctx.createLinearGradient(0, -s/2, 0, s/2);
      plateGrad.addColorStop(0, Util.shade(baseColor, 0.15));
      plateGrad.addColorStop(1, Util.shade(baseColor, -0.15));
      ctx.fillStyle = plateGrad;
      ctx.fillRect(-s/2+trackW+1, -s/2+inset*0.4, s-2*trackW-2, s-inset*0.8);
      // 装甲板高光(上边+左边)
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(-s/2+trackW+1, -s/2+inset*0.4, s-2*trackW-2, 2);
      ctx.fillRect(-s/2+trackW+1, -s/2+inset*0.4, 2, s-inset*0.8);
      // 装甲板阴影(下边+右边)
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(-s/2+trackW+1, s/2-inset*0.4-2, s-2*trackW-2, 2);
      ctx.fillRect(s/2-trackW-3, -s/2+inset*0.4, 2, s-inset*0.8);
      // 4) 炮塔:渐变圆+高光
      const turretR = s*0.24;
      const turretGrad = ctx.createRadialGradient(-turretR*0.3, -turretR*0.3, 1, 0, 0, turretR);
      turretGrad.addColorStop(0, Util.shade(baseColor, 0.4));
      turretGrad.addColorStop(0.7, Util.shade(baseColor, -0.1));
      turretGrad.addColorStop(1, Util.shade(baseColor, -0.4));
      ctx.fillStyle = turretGrad;
      ctx.beginPath(); ctx.arc(0, 0, turretR, 0, Math.PI*2); ctx.fill();
      // 炮塔外圈描边
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, turretR, 0, Math.PI*2); ctx.stroke();
      // 炮塔顶高光点
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath(); ctx.arc(-turretR*0.3, -turretR*0.3, turretR*0.25, 0, Math.PI*2); ctx.fill();
      // 5) 类型标识(敌方坦克):小色块/铆钉区分类型
      if (this instanceof EnemyTank){
        if (this.type === 'heavy'){
          // 重甲:四角铆钉
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          [[-1,1],[1,1],[-1,-1],[1,-1]].forEach(([dx,dy])=>{
            ctx.beginPath(); ctx.arc(dx*s*0.28, dy*s*0.28, 2, 0, Math.PI*2); ctx.fill();
          });
        } else if (this.type === 'fast'){
          // 高速:前部尖角导流条
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          ctx.beginPath();
          ctx.moveTo(-s*0.12, -s*0.4);
          ctx.lineTo(0, -s*0.46);
          ctx.lineTo(s*0.12, -s*0.4);
          ctx.closePath(); ctx.fill();
        } else if (this.type === 'rapid'){
          // 速射:双炮管基座
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          ctx.fillRect(-s*0.14, -s*0.28, 3, 6);
          ctx.fillRect(s*0.11, -s*0.28, 3, 6);
        } else if (this.type === 'suicide'){
          // 自爆:中央警示三角
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.beginPath();
          ctx.moveTo(0, -s*0.1);
          ctx.lineTo(s*0.1, s*0.08);
          ctx.lineTo(-s*0.1, s*0.08);
          ctx.closePath(); ctx.fill();
        }
      }

      // 6) 玩家坦克型号专属装饰(美感差异化)
      if (isPlayerModel){
        const tid = tankId;
        ctx.save();
        if (tid === 0){
          // T-01 先锋: 简单的前部 V 型标记(绿色经典)
          ctx.fillStyle = 'rgba(255,255,255,0.28)';
          ctx.beginPath();
          ctx.moveTo(-s*0.15, -s*0.42);
          ctx.lineTo(0, -s*0.30);
          ctx.lineTo(s*0.15, -s*0.42);
          ctx.closePath(); ctx.fill();
          // 小型号编号
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.font = `bold ${Math.round(s*0.14)}px Consolas`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('01', 0, s*0.10);
        } else if (tid === 1){
          // T-02 雷霆: 左右闪电条 + 辅助色锯齿导流
          ctx.fillStyle = accentColor;
          // 左闪电斜条
          ctx.beginPath();
          ctx.moveTo(-s*0.38, -s*0.28);
          ctx.lineTo(-s*0.28, -s*0.10);
          ctx.lineTo(-s*0.34, -s*0.02);
          ctx.lineTo(-s*0.22,  s*0.20);
          ctx.lineTo(-s*0.32,  s*0.14);
          ctx.lineTo(-s*0.26,  s*0.04);
          ctx.lineTo(-s*0.40, -s*0.18);
          ctx.closePath(); ctx.fill();
          // 右闪电斜条
          ctx.beginPath();
          ctx.moveTo( s*0.38, -s*0.28);
          ctx.lineTo( s*0.28, -s*0.10);
          ctx.lineTo( s*0.34, -s*0.02);
          ctx.lineTo( s*0.22,  s*0.20);
          ctx.lineTo( s*0.32,  s*0.14);
          ctx.lineTo( s*0.26,  s*0.04);
          ctx.lineTo( s*0.40, -s*0.18);
          ctx.closePath(); ctx.fill();
          // 编号
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.font = `bold ${Math.round(s*0.14)}px Consolas`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('T-02', 0, s*0.12);
          // 前部导流尖
          ctx.fillStyle = 'rgba(147,197,253,0.55)';
          ctx.beginPath();
          ctx.moveTo(-s*0.14, -s*0.42);
          ctx.lineTo(0, -s*0.50);
          ctx.lineTo(s*0.14, -s*0.42);
          ctx.closePath(); ctx.fill();
        } else if (tid === 2){
          // T-03 烈焰: 左右火焰纹 + 散热孔格栅
          // 散热格栅
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          for (let i=0; i<4; i++){
            const y = -s*0.15 + i*(s*0.10);
            ctx.fillRect(-s*0.16, y, s*0.32, 2);
          }
          // 左火焰纹
          ctx.fillStyle = accentColor;
          ctx.beginPath();
          ctx.moveTo(-s*0.36, -s*0.30);
          ctx.quadraticCurveTo(-s*0.28, -s*0.05, -s*0.40, s*0.22);
          ctx.quadraticCurveTo(-s*0.30, s*0.05, -s*0.22, -s*0.05);
          ctx.quadraticCurveTo(-s*0.30, s*0.10, -s*0.36, s*0.28);
          ctx.lineTo(-s*0.28, s*0.20);
          ctx.quadraticCurveTo(-s*0.18, s*0.05, -s*0.22, -s*0.25);
          ctx.closePath(); ctx.fill();
          // 右火焰纹(镜像)
          ctx.beginPath();
          ctx.moveTo( s*0.36, -s*0.30);
          ctx.quadraticCurveTo( s*0.28, -s*0.05,  s*0.40, s*0.22);
          ctx.quadraticCurveTo( s*0.30, s*0.05,  s*0.22, -s*0.05);
          ctx.quadraticCurveTo( s*0.30, s*0.10,  s*0.36, s*0.28);
          ctx.lineTo( s*0.28, s*0.20);
          ctx.quadraticCurveTo( s*0.18, s*0.05,  s*0.22, -s*0.25);
          ctx.closePath(); ctx.fill();
          // 编号
          ctx.fillStyle = '#fff7ed';
          ctx.font = `bold ${Math.round(s*0.14)}px Consolas`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('T-03', 0, s*0.12);
        } else if (tid === 3){
          // T-04 壁垒: 八边形装甲板 + 铆钉(多边形厚重感)
          const cx = 0, cy = 0;
          const r = s*0.30;
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          ctx.beginPath();
          for (let i=0;i<8;i++){
            const a = -Math.PI/2 + i*Math.PI/4;
            const x = cx + Math.cos(a)*r;
            const y = cy + Math.sin(a)*r;
            if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
          }
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(15,23,42,0.65)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          // 8 颗铆钉
          ctx.fillStyle = 'rgba(15,23,42,0.75)';
          for (let i=0;i<8;i++){
            const a = -Math.PI/2 + i*Math.PI/4;
            const x = cx + Math.cos(a)*(r - 3);
            const y = cy + Math.sin(a)*(r - 3);
            ctx.beginPath(); ctx.arc(x, y, 1.7, 0, Math.PI*2); ctx.fill();
          }
          // 编号
          ctx.fillStyle = '#0f172a';
          ctx.font = `bold ${Math.round(s*0.14)}px Consolas`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('T-04', 0, s*0.14);
          // 前部斜面装甲
          ctx.fillStyle = 'rgba(203,213,225,0.65)';
          ctx.beginPath();
          ctx.moveTo(-s*0.18, -s*0.44);
          ctx.lineTo(-s*0.26, -s*0.30);
          ctx.lineTo( s*0.26, -s*0.30);
          ctx.lineTo( s*0.18, -s*0.44);
          ctx.closePath(); ctx.fill();
        } else if (tid === 4){
          // T-05 幽灵: 多边形切角 + 暗纹 + 半透明磨砂菱形迷彩
          ctx.fillStyle = 'rgba(196,181,253,0.35)';
          // 切角菱形花纹
          const pts = [
            [-s*0.10, -s*0.42], [ s*0.10, -s*0.42],
            [ s*0.30, -s*0.20], [ s*0.30,  s*0.20],
            [ s*0.10,  s*0.42], [-s*0.10,  s*0.42],
            [-s*0.30,  s*0.20], [-s*0.30, -s*0.20]
          ];
          ctx.beginPath();
          pts.forEach((p,i)=> i===0 ? ctx.moveTo(p[0],p[1]) : ctx.lineTo(p[0],p[1]));
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(109,40,217,0.7)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
          // 神秘符号(相位纹)
          ctx.fillStyle = 'rgba(196,181,253,0.6)';
          ctx.beginPath();
          ctx.moveTo(0, -s*0.12);
          ctx.lineTo( s*0.12, 0);
          ctx.lineTo(0,  s*0.12);
          ctx.lineTo(-s*0.12, 0);
          ctx.closePath(); ctx.fill();
          // 编号(深紫)
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.font = `bold ${Math.round(s*0.13)}px Consolas`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('T-05', 0, s*0.32);
          // 四角切角装饰
          ctx.fillStyle = 'rgba(124,58,237,0.55)';
          [[-0.40,-0.40],[0.40,-0.40],[-0.40,0.40],[0.40,0.40]].forEach(([dx,dy])=>{
            ctx.beginPath();
            ctx.moveTo(dx*s, dy*s);
            ctx.lineTo((dx + Math.sign(dx)*0.06)*s, dy*s);
            ctx.lineTo(dx*s, (dy + Math.sign(dy)*0.06)*s);
            ctx.closePath(); ctx.fill();
          });
        }
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // 炮管(独立绘制,不随车身,用 turretAngle)
    ctx.save();
    ctx.translate(this.cx, this.cy);
    // 约定 turretAngle=-PI/2 朝上, 绘制时旋转 (turretAngle + PI/2)
    ctx.rotate(this.turretAngle + Math.PI/2);
    const barrelH = this.h;
    // 按 turretStyle 画炮管造型
    const style = (tdef && tdef.turretStyle) ? tdef.turretStyle : 'standard';
    if (style === 'twin'){
      // T-02 雷霆: 双短粗平行管 + 闪电边纹
      const bGrad = ctx.createLinearGradient(-6, 0, 6, 0);
      bGrad.addColorStop(0, '#0c4a6e');
      bGrad.addColorStop(0.5, '#3b82f6');
      bGrad.addColorStop(1, '#0c4a6e');
      ctx.fillStyle = bGrad;
      ctx.fillRect(-7, -barrelH/2-6, 4, 8);
      ctx.fillRect( 3, -barrelH/2-6, 4, 8);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-8, -barrelH/2-8, 6, 2);
      ctx.fillRect( 2, -barrelH/2-8, 6, 2);
      // 中央底座(蓝银金属感)
      ctx.fillStyle = 'rgba(147,197,253,0.9)';
      ctx.fillRect(-5, -barrelH/2-2, 10, 4);
    } else if (style === 'flame'){
      // T-03 烈焰: 单粗管 + 火焰扩散口
      const bGrad = ctx.createLinearGradient(-4, 0, 4, 0);
      bGrad.addColorStop(0, '#7c2d12');
      bGrad.addColorStop(0.5, '#ea580c');
      bGrad.addColorStop(1, '#7c2d12');
      ctx.fillStyle = bGrad;
      ctx.fillRect(-4, -barrelH/2-9, 8, 11);
      // 扩散口(梯形火焰喷口)
      ctx.fillStyle = '#431407';
      ctx.beginPath();
      ctx.moveTo(-5, -barrelH/2-9);
      ctx.lineTo( 5, -barrelH/2-9);
      ctx.lineTo( 7, -barrelH/2-12);
      ctx.lineTo(-7, -barrelH/2-12);
      ctx.closePath(); ctx.fill();
      // 小喷气孔
      ctx.fillStyle = 'rgba(253,186,116,0.7)';
      ctx.fillRect(-5, -barrelH/2-2, 10, 2);
    } else if (style === 'hex'){
      // T-04 壁垒: 六边形粗炮管 + 护盾发生器外圈
      const bGrad = ctx.createLinearGradient(-6, 0, 6, 0);
      bGrad.addColorStop(0, '#334155');
      bGrad.addColorStop(0.5, '#cbd5e1');
      bGrad.addColorStop(1, '#334155');
      ctx.fillStyle = bGrad;
      ctx.beginPath();
      ctx.moveTo(-6, -barrelH/2+1);
      ctx.lineTo(-4, -barrelH/2-8);
      ctx.lineTo( 4, -barrelH/2-8);
      ctx.lineTo( 6, -barrelH/2+1);
      ctx.lineTo( 4, -barrelH/2+3);
      ctx.lineTo(-4, -barrelH/2+3);
      ctx.closePath(); ctx.fill();
      // 炮口强化圈
      ctx.strokeStyle = 'rgba(15,23,42,0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-6, -barrelH/2+1); ctx.lineTo(-4, -barrelH/2-8);
      ctx.lineTo( 4, -barrelH/2-8); ctx.lineTo( 6, -barrelH/2+1);
      ctx.lineTo( 4, -barrelH/2+3); ctx.lineTo(-4, -barrelH/2+3);
      ctx.closePath(); ctx.stroke();
    } else if (style === 'stealth'){
      // T-05 幽灵: 细长削尖隐身管 + 紫色棱边
      const bGrad = ctx.createLinearGradient(-2.5, 0, 2.5, 0);
      bGrad.addColorStop(0, '#3b0764');
      bGrad.addColorStop(0.5, '#8b5cf6');
      bGrad.addColorStop(1, '#3b0764');
      ctx.fillStyle = bGrad;
      ctx.beginPath();
      ctx.moveTo(-2.5, -barrelH/2+1);
      ctx.lineTo(-1.2, -barrelH/2-11);
      ctx.lineTo( 1.2, -barrelH/2-11);
      ctx.lineTo( 2.5, -barrelH/2+1);
      ctx.closePath(); ctx.fill();
      // 消音口切角
      ctx.fillStyle = 'rgba(196,181,253,0.6)';
      ctx.beginPath();
      ctx.moveTo(-1.2, -barrelH/2-11);
      ctx.lineTo( 0,   -barrelH/2-14);
      ctx.lineTo( 1.2, -barrelH/2-11);
      ctx.closePath(); ctx.fill();
    } else {
      // standard: 单标准炮管(T-01 先锋 / 敌人默认)
      const barrelGrad = ctx.createLinearGradient(-3, 0, 3, 0);
      barrelGrad.addColorStop(0, '#0f172a');
      barrelGrad.addColorStop(0.5, '#475569');
      barrelGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = barrelGrad;
      ctx.fillRect(-3, -barrelH/2-7, 6, 9);
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(-4, -barrelH/2-8, 8, 2);
    }
    ctx.restore();
  }

  // 头顶血条
  renderHpBar(ctx, color){
    const bw = this.w, bh = 4;
    const bx = this.cx - bw/2, by = this.y - 9;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(bx-1, by-1, bw+2, bh+2);
    ctx.fillStyle = '#333';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = color;
    ctx.fillRect(bx, by, bw * (this.hp/this.maxHp), bh);
    // —— 数字血条：当前/最大 —— //
    const hpNow = Math.max(0, Math.ceil(this.hp));
    const hpMax = Math.ceil(this.maxHp);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px Consolas';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth = 2.5;
    const txt = `${hpNow}/${hpMax}`;
    ctx.strokeText(txt, this.cx, by - 1);
    ctx.fillText(txt, this.cx, by - 1);
  }
}

/* ===================== 十一、玩家坦克 ===================== */
class PlayerTank extends Tank {
  constructor(col,row){
    super(col,row);
    this.maxHp = 100; this.hp = 100;
    this.speed = 1.8;
    this.lives = 3;
    this.currentWeapon = 0;        // 当前武器索引
    this.unlockedWeapons = [0];    // 已解锁武器(本局:初始0号 + 永久解锁)
    this.passives = [];            // 装备的被动(最多3件,阵亡清空)
    this.inventory = [0,0,0,0,0];  // 5种主动道具数量
    this.buffs = [];               // 限时Buff列表
    this.invuln = 0;               // 无敌时间(ms)
    this.fireTimer = 0;
    this.respawnDelay = 0;
    this.attackCount = 0;          // 攻击充能计数(满5下次发射激光)
    this.shieldReady = false;      // 能量护盾就绪(抵挡单次炮击)
    this.shieldTimer = 0;          // 护盾生成计时器(ms)
    this.combatTimer = 0;          // 战斗状态计时(脱离后自修复回血)
    this.laserState = 'idle';      // 激光充能状态: idle / charging / firing
    this.laserChargeStart = 0;     // 充能开始时间戳(ms, Date.now())
    this.laserChargeDur = 1000;    // 充能满额时长(ms) — 1秒蓄满5级
    this.laserPressTime = 0;       // 按下空格的时间戳(用于短按判定)
    this.laserPendingPress = false;// 是否有待判定的按下(短按检测)
    // —— 坦克型号(默认 T-01 先锋) + 专属神技 ——
    this.tankId = 0;
    this.tankModel = TANK_MODELS[0];
    this.skillCd = 0;              // 神技剩余冷却(ms)
    this.skillActive = false;      // 神技激活中(持续型技能)
    this.skillTimer = 0;           // 持续型剩余时长(ms)
    this.skillData = {};           // 神技内部数据(火焰:DOT计时等)
    this.phaseInvisible = false;   // T-05 幽灵:是否处于隐形
    this.revealTimer = 0;          // T-05 攻击后短暂显形计时
    this.barrierActive = false;    // T-04 壁垒:屏障激活中
  }

  // 应用坦克型号:HP/速度/射速系数/外观/神技
  applyTankModel(tdef, level){
    if (!tdef) tdef = TANK_MODELS[0];
    this.tankId = tdef.id;
    this.tankModel = tdef;
    // —— 等级加成 (默认 Lv1, 不传等于 Lv1) —— //
    this.tankLevel = Math.max(1, Math.min(10, level || 1));
    const g = TANK_LEVEL_GROWTH[this.tankLevel - 1] || TANK_LEVEL_GROWTH[0];
    this.tankGrowth = g;
    // 血量按坦克型号比例 × 等级倍率
    this.maxHp = Math.round(tdef.hp * g.hp);
    this.hp = this.maxHp;
    // 速度 & 转向系数:乘到 speedBase 等基值(用于 update 内部计算)
    this.tankSpeedMul  = (tdef.speedMul  || 1) * g.spd;
    this.tankFireCdMul = (tdef.fireCdMul || 1) * g.fire;
    // 神技 CD 倍率 (等级越高 CD 越短)
    this.tankSkillCdMul = g.cd;
    // 初始化技能:已解锁型号有专属神技
    this.skillCd = 0;
    this.skillActive = false;
    this.skillTimer = 0;
    this.skillData = {};
    this.phaseInvisible = false;
    this.revealTimer = 0;
    this.barrierActive = false;
  }

  hurt(dmg, game, opts){
    opts = opts || {};
    if (this.invuln > 0) return;
    // T-04 壁垒专属神技:能量壁垒激活 → 100% 吸收伤害,触发时冒蓝色火花
    if (this.barrierActive){
      game.spawnSparks(this.cx, this.cy, '#bae6fd', 14);
      game.shake = Math.max(game.shake, 4);
      return;
    }
    // 子弹偏转力场:30%概率抵消敌方来袭炮弹
    if (opts.bullet && this.hasPassive('deflect_field') && Util.chance(0.3)){
      game.spawnSparks(this.cx, this.cy, '#67e8f9', 10);
      return;
    }
    // 防爆底盘:免疫地雷/导弹爆炸溅射伤害
    if (opts.splash && this.hasPassive('blast_chassis')){
      game.spawnSparks(this.cx, this.cy, '#94a3b8', 8);
      return;
    }
    // 能量护盾发生器:抵挡单次炮击伤害
    if (this.shieldReady){
      this.shieldReady = false;
      game.spawnSparks(this.cx, this.cy, '#38bdf8', 16);
      return;
    }
    // 复合装甲:受到伤害降低20%
    if (this.hasPassive('composite_armor')) dmg *= 0.8;
    this.combatTimer = 5000; // 受伤 → 进入战斗状态5秒
    const wasAlive = this.hp > 0;
    super.hurt(dmg, game);
    game.spawnSparks(this.cx, this.cy, '#fbbf24', 10);
    if (wasAlive && this.hp <= 0){
      // 玩家坦克被击毁 —— 夸张爆炸 + 闪白屏 + 暗角冲击
      game.shake = Math.max(game.shake, 36);
      game.screenFlash = Math.max(game.screenFlash, 0.95);
      game.vignette = Math.max(game.vignette, 0.8);
      game.spawnExplosion(this.cx, this.cy, 78);
      // 大块装甲碎片(玩家坦克要更夸张)
      for (let i=0;i<90;i++){
        const ang = Math.random()*Math.PI*2;
        const sp = Util.rand(4, 13);
        const colors = ['#57534e','#78716c','#44403c','#991b1b','#b91c1c','#dc2626','#fbbf24','#f59e0b','#fde047'];
        const sz = Util.rand(4, 10);
        const p = new Particle(
          this.cx + Util.rand(-this.w/2.5, this.w/2.5),
          this.cy + Util.rand(-this.h/2.5, this.h/2.5),
          Math.cos(ang)*sp, Math.sin(ang)*sp,
          Util.pick(colors),
          Util.randInt(32, 70), sz);
        p.gravity = 0.2 + Util.rand(0, 0.15);
        p.expand = (Math.random() < 0.3 ? +0.09 : -0.05);
        game.particles.push(p);
      }
      // 油火飞溅颗粒
      for (let i=0;i<120;i++){
        const ang = Math.random()*Math.PI*2;
        const sp = Util.rand(2, 12);
        const colors = ['#fbbf24','#ef4444','#fde047','#fb923c','#fff'];
        const p = new Particle(this.cx, this.cy, Math.cos(ang)*sp, Math.sin(ang)*sp, Util.pick(colors), Util.randInt(16,36), Util.rand(2,5));
        p.gravity = 0.08;
        game.particles.push(p);
      }
      // 多层连续爆炸,增加冲击感
      setTimeout(()=>{ game.spawnExplosion(this.cx+14, this.cy-8, 42); game.shake = Math.max(game.shake, 22); }, 90);
      setTimeout(()=>{ game.spawnExplosion(this.cx-16, this.cy+12, 48); game.shake = Math.max(game.shake, 26); game.screenFlash = Math.max(game.screenFlash, 0.55); }, 200);
      setTimeout(()=>{ game.spawnExplosion(this.cx+2, this.cy+10, 38); game.shake = Math.max(game.shake, 18); }, 320);
      setTimeout(()=>{ game.spawnExplosion(this.cx-10, this.cy-6, 34); game.vignette = Math.max(game.vignette, 0.5); }, 460);
      // 阵亡:所有被动装备清空(背包道具保留)
      this.passives = [];
      this.shieldReady = false; this.shieldTimer = 0;
      // 死亡:基地存在 → 5秒后无限复活;基地被毁 → GameOver
      const baseAlive = game.baseHp > 0;
      if (!baseAlive){
        setTimeout(()=>{ game.gameOver(); }, 600);
      } else {
        this.respawnDelay = 300; // 5秒后复活(300帧 @60fps),基地在则可无限复活
      }
    }
  }

  // 是否装备了某被动(开关式,无等级)
  hasPassive(id){
    return this.passives.some(x=>x.id===id);
  }

  update(dt, game){
    if (this.respawnDelay > 0){
      this.respawnDelay--;
      if (this.respawnDelay === 0){
        this.respawn(game);
      }
      return;
    }
    if (this.dead) return;

    if (this.invuln > 0) this.invuln -= dt;
    if (this.fireTimer > 0) this.fireTimer -= dt;

    // —— 专属神技计时 ——
    if (this.skillCd > 0) this.skillCd = Math.max(0, this.skillCd - dt);
    if (this.skillActive){
      this.skillTimer -= dt;
      if (this.skillTimer <= 0){ this._skillEnd(game); this.skillActive = false; this.skillTimer = 0; }
      else { this._skillTick(game, dt); }
    }
    // T-05 幽灵:攻击后短暂显形计时
    if (this.revealTimer > 0) this.revealTimer = Math.max(0, this.revealTimer - dt);

    // 更新Buff
    this.buffs = this.buffs.filter(b => { b.time -= dt; return b.time > 0; });

    // —— 输入解析:键盘 vs 移动端摇杆 ——
    // 「前进为主」控制模式:
    //   - 前方定义 = 炮管瞄准方向(鼠标/触屏指哪=前方,敌人方向=前方)
    //   - W / 摇杆前推 → 沿瞄准方向前进
    //   - S / 摇杆后拉 → 沿瞄准方向反向(撤退/倒车)
    //   - A → 瞄准方向的左侧平移(侧移)
    //   - D → 瞄准方向的右侧平移(侧移)
    //   - 车身自动转向:目标 = 瞄准方向(静止时) / 合成移动方向(运动时)
    const aimAng = Input.getAimAngle(this.cx, this.cy);
    const forwardAng = (aimAng !== null) ? aimAng : this.bodyAngle;

    // —— 油门 (forward > 0 前进, < 0 倒车) ——
    let moveForward = 0;
    // —— 侧移 (strafe > 0 右侧, < 0 左侧) ——
    let strafe = 0;

    let joyFwd = 0, joyStrafe = 0;
    if (Input.joyAngle !== null){
      // 摇杆方向以瞄准方向为参考:局部化到 前/后/左/右
      const ca = Math.cos(Input.joyAngle), sa = Math.sin(Input.joyAngle);
      const fCos = Math.cos(forwardAng), fSin = Math.sin(forwardAng);
      // 局部前向 = 世界向量 dot 瞄准前方向量 (fwdX, fwdY)
      joyFwd    =  ca * fCos + sa * fSin;   // +1=正对瞄准方向前进
      joyStrafe  = -ca * fSin + sa * fCos;   // +1=正对瞄准方向右侧
      const tIntensity = Input.joyIntensity || 1;
      joyFwd    *= tIntensity;
      joyStrafe *= tIntensity;
      // 死区过滤
      if (Math.abs(joyFwd)    < 0.18) joyFwd = 0;
      if (Math.abs(joyStrafe) < 0.18) joyStrafe = 0;
      moveForward = joyFwd;
      strafe = joyStrafe;
    }
    const keyW = Input.down('w') || Input.down('arrowup');
    const keyS = Input.down('s') || Input.down('arrowdown');
    const keyA = Input.down('a') || Input.down('arrowleft');
    const keyD = Input.down('d') || Input.down('arrowright');
    // 键盘覆盖摇杆 (硬值 ±1)
    if (keyW) moveForward = +1;
    if (keyS) moveForward = -1;
    if (keyA) strafe = -1;
    if (keyD) strafe = +1;
    // 互斥
    if (keyW && keyS) moveForward = 0;
    if (keyA && keyD) strafe = 0;
    // 合成强度钳制:防止 W+D 同时按导致 √2 超速
    const mag = Math.hypot(moveForward, strafe);
    if (mag > 1){ moveForward /= mag; strafe /= mag; }

    // 充能中降低移动速度(蓄力锁定感),移动仍可继续
    let moveSpeedMul = 1;
    if (this.laserState === 'charging') moveSpeedMul = 0.55;
    // 坦克型号系数(速度)
    moveSpeedMul *= (this.tankSpeedMul || 1);
    // T-05 相位潜行激活 → +30%
    if (this.phaseInvisible) moveSpeedMul *= 1.30;

    // —— 平滑缓动: moveFwdSmooth / strafeSmooth —— 让起步/刹车不顿挫 ——
    // —— [v62优化] 移动端把响应速度加倍(k 乘 2):触控每帧 16ms → 起步/刹车迟滞 100ms 就很明显,
    //    缓动要更激进. 区分触屏设备(isTouchDevice)动态设置 k 系数
    const isTouchInput = Input.isTouchDevice || (Input.joyAngle !== null);
    const kBase = isTouchInput ? 0.52 : 0.26;
    const k = Math.min(1, (dt/16.67) * kBase);
    this.moveFwdSmooth    = this.moveFwdSmooth    ?? 0;
    this.strafeSmooth     = this.strafeSmooth     ?? 0;
    this.moveFwdSmooth += (moveForward - this.moveFwdSmooth) * k;
    this.strafeSmooth  += (strafe      - this.strafeSmooth)  * k;
    // —— [v62优化] 松开摇杆时归零阈值放大,避免 0.0x 残值"粘手"——
    const ZERO_THRESH = isTouchInput ? 0.04 : 0.01;
    if (moveForward === 0 && Math.abs(this.moveFwdSmooth) < ZERO_THRESH) this.moveFwdSmooth = 0;
    if (strafe === 0 && Math.abs(this.strafeSmooth) < ZERO_THRESH) this.strafeSmooth = 0;

    const timeScale = dt / 1000;

    // —— 车身自动朝向目标 ——
    // 1) 有移动 → 朝向合成移动方向 ( 更直觉:往哪开哪是前 )
    // 2) 静止 → 朝向瞄准方向 ( 敌人=前方,不会晕 )
    let fwdX = Math.cos(forwardAng), fwdY = Math.sin(forwardAng);
    let rightX = -fwdY, rightY = fwdX;
    const worldDX = this.moveFwdSmooth*fwdX + this.strafeSmooth*rightX;
    const worldDY = this.moveFwdSmooth*fwdY + this.strafeSmooth*rightY;
    const movingMag = Math.hypot(worldDX, worldDY);
    let targetBodyAngle = forwardAng;
    if (movingMag > 0.06){
      // 车身跟随移动方向,但保留正向: 车头永远朝移动方向
      targetBodyAngle = Math.atan2(worldDY, worldDX);
    }
    const turnRadPerSec = Math.max(this.turnSpeedForward, this.turnSpeedBase * 0.9);
    const angErr = this.normAngle(targetBodyAngle - this.bodyAngle);
    const maxTurn = turnRadPerSec * timeScale;
    if (Math.abs(angErr) > maxTurn){
      this.bodyAngle += Math.sign(angErr) * maxTurn;
    } else {
      this.bodyAngle = targetBodyAngle;
    }
    this.bodyAngle = this.normAngle(this.bodyAngle);
    this.syncDirFromAngle();

    // —— 合成实际位移 (像素/秒 × timeScale) ——
    let pxPerSec = this.speedBase * moveSpeedMul;
    if (this.hasPassive('turbo_engine')) pxPerSec *= 1.3;
    if (this.hasBuff('speed')) pxPerSec *= 1.6;
    const terrain = this.currentTerrain(game);
    if (terrain === T.ICE && !this.hasPassive('anti_slip')) pxPerSec *= 1.75;
    // 倒车(纯后退 moveFwdSmooth < 0 且 没侧移) 速度略低
    const pureReverse = (this.moveFwdSmooth < -0.5 && Math.abs(this.strafeSmooth) < 0.2);
    if (pureReverse) pxPerSec *= this.reverseSpeedMul;
    // 每帧位移像素
    const moveLen = Math.hypot(this.moveFwdSmooth, this.strafeSmooth);
    const sp = pxPerSec * Math.min(1, moveLen) * timeScale;
    let movedSign = 0;
    let dx = 0, dy = 0;
    if (moveLen > 0.02 && sp > 0.001){
      // worldDX/worldDY 是单位向量(或<1),乘 sp 得到本帧像素位移
      const scale = (moveLen > 1) ? sp / moveLen : sp;
      dx = worldDX * scale;
      dy = worldDY * scale;
      const didMove = this.tryMove(dx, dy, game);
      movedSign = didMove ? (this.moveFwdSmooth >= -0.2 ? 1 : -1) : 0;
      this.animTick += (pxPerSec / 30) * (dt / 16.67) * 0.9 * Math.min(1, moveLen);
    }
    this.moving = movedSign;

    // —— 炮管瞄准(指哪打哪):永远沿鼠标/触屏指向 ——
    const turretScale = dt / 16.67;
    // —— [v62优化] 移动端触屏瞄准 + 炮管 转更快,减少"手已经指过去但炮管还在慢吞吞转"的不跟手感
    const turretTurnRate = (Input.isTouchDevice) ? 0.52 : 0.30;
    if (aimAng !== null){
      this.turnTurretTowards(aimAng, turretTurnRate * turretScale);
    } else {
      // 无瞄准输入 → 炮管缓缓对齐车身
      this.turnTurretTowards(this.bodyAngle, 0.15 * turretScale);
    }

    // —— 激光系统:区分「激光武器(槽位8)」和「普通激光(攻击5次触发)」——
    // ⚠ 蓄力与松手释放机制两种完全一致(不改!),仅【伤害倍率】和【特效】区分:
    //   激光武器(槽位8蓄力) → isWeak=false: 多道Lv1~5,高伤,壮观光束+分支+白闪+震屏
    //   普通激光(攻击5次)   → isWeak=true:  单道Lv1, 低伤(50%), 细线,无分支,低调
    const LV5_CHARGE_MS = 800;    // 满级蓄力阈值
    if (this.laserChargeHoldAccum == null) this.laserChargeHoldAccum = 0;
    if (this.laserPrevSpace == null) this.laserPrevSpace = false;
    // 统一触发条件: ① 激光武器槽位 + 已解锁  ② 任意武器攻击满5次充能
    const isLaserWeaponSlot = (game.laserUnlocked && this.currentWeapon === 8);
    const shouldFireLaser = isLaserWeaponSlot || (this.attackCount >= 5);
    // 本次发射是否属于"普通弱激光"(非槽位8且攻击满5次)
    const isWeakThisFire = (!isLaserWeaponSlot && this.attackCount >= 5);
    // 非激光条件:清理蓄力状态
    if (!shouldFireLaser){
      if (this.laserState !== 'idle' && this.laserState !== 'firing') this.laserState = 'idle';
      this.laserChargeHoldAccum = 0;
      this.laserPrevSpace = false;
    }

    if (shouldFireLaser){
      const spaceDown = Input.down(' ');
      // 边沿:按下瞬间开始蓄力
      if (spaceDown && !this.laserPrevSpace){
        this.laserChargeHoldAccum = 0;
        this.laserState = 'charging';
      }
      // 持续按住:累计蓄力 + 蓄力粒子特效
      if (spaceDown){
        this.laserChargeHoldAccum = Math.min(LV5_CHARGE_MS + 50, this.laserChargeHoldAccum + dt);
        const chgP = Math.min(1, this.laserChargeHoldAccum / LV5_CHARGE_MS);
        // 普通弱激光:粒子更淡更少(低调); 激光武器:粒子越满越密集越亮
        if (isWeakThisFire){
          if (Math.random() < 0.12 + chgP*0.2){
            const mz = this.getMuzzle();
            game.spawnSparks(mz.x, mz.y, '#a5f3fc', 1);
          }
        } else {
          if (Math.random() < 0.15 + chgP*0.6){
            const mz = this.getMuzzle();
            const vx0 = Math.cos(this.turretAngle), vy0 = Math.sin(this.turretAngle);
            const spread = (1-chgP)*14 + 2;
            const ox = (Math.random()-0.5)*spread + vx0*chgP*10;
            const oy = (Math.random()-0.5)*spread + vy0*chgP*10;
            const col = chgP > 0.8 ? '#ffffff' : (chgP > 0.5 ? '#22d3ee' : '#67e8f9');
            game.spawnSparks(mz.x+ox, mz.y+oy, col, 1 + Math.floor(chgP*2));
          }
        }
      }
      // ⚠ 边沿:松手瞬间 → 根据蓄力时长发射(与原有机制完全一致,不改!)
      if (!spaceDown && this.laserPrevSpace){
        // [v58修复] 检查 fireTimer 冷却,防止快速连发
        // —— [v62优化] 允许 fireTimer 残留≤120ms 时直接发射(移动端 pointerup 到下一帧间隔小,
        //    否则极短冷却期内蓄力被误判为"冷却中"丢弃,表现为"蓄力了但没打出来"/"收放不自如")
        if (this.fireTimer > 120){
          this.laserState = 'idle';
          this.laserChargeHoldAccum = 0;
        } else {
        const chargeMs = this.laserChargeHoldAccum;
        // —— [v62优化] 移动端极短按(<40ms)视作误触, 不给 laser 也不吞掉蓄力计数器
        //    (解决 快速点击射击按钮 → 本想打普通武器弹 → 结果被 laser 边沿触发当蓄力但又发不出, 手感差)
        const IS_TOUCH = Input.isTouchDevice;
        if (isWeakThisFire){
          // 普通激光(弱): 固定 Lv1, 伤害只有一半, isWeak=true
          this.laserState = 'firing';
          this.fireLaser(game, 1, 1.0, true);
          this.attackCount = 0;
        } else {
          if (IS_TOUCH && chargeMs < 40){
            // 移动端误触短按:不发射激光,把按键当作普通武器一次射击
            if (this.fireTimer <= 0){
              this.fire(game);
              this.attackCount++;
            }
            this.laserState = 'idle';
          } else {
          // 激光武器: 根据蓄力时长判定 Lv1~5, isWeak=false
          let lv, mul;
          if (chargeMs < 150)      { lv = 1; mul = 1.0; }
          else if (chargeMs < 350) { lv = 2; mul = 1.3; }
          else if (chargeMs < 550) { lv = 3; mul = 1.5; }
          else if (chargeMs < 800) { lv = 4; mul = 1.6; }
          else                     { lv = 5; mul = 1.8; }
          this.laserState = 'firing';
          this.fireLaser(game, lv, mul, false);
          this.attackCount = 0;
        }
        }
        this.laserChargeHoldAccum = 0;
        setTimeout(()=>{ this.laserState = 'idle'; }, 120);
        }
      }
      this.laserPrevSpace = spaceDown;
      return;
    } else {
      // 非激光条件:普通武器射击
      if (this.laserState !== 'firing' && this.laserState !== 'charging') this.laserState = 'idle';
    }
    if (!shouldFireLaser){
      if (Input.down(' ') && this.fireTimer <= 0){
        this.fire(game);
        this.attackCount++;
      }
    }

    // —— 被动装备计时器 ——
    // 能量护盾发生器:每15秒生成一层护盾
    if (this.hasPassive('energy_shield')){
      if (!this.shieldReady){
        if (this.shieldTimer <= 0) this.shieldTimer = 15000; // 初始化/被消耗后重置为15秒
        this.shieldTimer -= dt;
        if (this.shieldTimer <= 0){ this.shieldReady = true; this.shieldTimer = 0; }
      }
    } else { this.shieldReady = false; this.shieldTimer = 0; }
    // 自修复装甲:脱离战斗状态(5秒未受伤)持续缓慢回血
    if (this.combatTimer > 0) this.combatTimer -= dt;
    else if (this.hasPassive('auto_repair')) this.hp = Math.min(this.maxHp, this.hp + dt*0.012);
  }

  // 对齐:水平移动时y靠向格子中心,垂直移动时x靠向格子中心
  alignToAxis(dx, dy){
    if (dx !== 0){
      const target = Util.toCell(this.cy)*TILE + TILE/2;
      this.cy += (target - this.cy) * 0.3;
      this.y = this.cy - this.h/2;
    } else if (dy !== 0){
      const target = Util.toCell(this.cx)*TILE + TILE/2;
      this.cx += (target - this.cx) * 0.3;
      this.x = this.cx - this.w/2;
    }
  }

  fire(game){
    if (this.currentWeapon === 8) return; // 激光槽位不发射普通炮弹
    if (!this.unlockedWeapons.includes(this.currentWeapon)) return;
    const w = WEAPONS[this.currentWeapon];
    // —— 武器等级加成 (从 game.weaponLevels 读取) —— //
    const wlv = (game.weaponLevels && game.weaponLevels[w.id]) || 1;
    const wg = WEAPON_LEVEL_GROWTH[wlv-1] || WEAPON_LEVEL_GROWTH[0];
    // 冷却:快速装填模块缩短22% + 坦克型号射速系数 + 武器等级
    let cd = w.cd * wg.cd;
    if (this.hasPassive('fast_reload')) cd *= 0.78;
    if (this.hasBuff('rapidfire')) cd *= 0.4;
    cd *= (this.tankFireCdMul || 1);
    this.fireTimer = cd;

    const muzzle = this.getMuzzle();
    // T-05 幽灵:开炮瞬间短暂显形(让对方知道你在哪,但很快消失)
    if (this.phaseInvisible) this.revealTimer = 280; // 0.28秒短暂显形
    // 伤害加成:武器等级 + 穿甲弹头改良+15% + 火力激增 + 暴击
    let dmg = w.dmg * wg.dmg;
    if (this.hasPassive('ap_rounds')) dmg *= 1.15;
    if (this.hasBuff('power')) dmg *= 1.5;
    if (this.hasBuff('crit') && Util.chance(0.5)) dmg *= 2;

    // 制导芯片:增大导弹爆炸半径
    const guidance = this.hasPassive('guidance_chip');
    const splash = (guidance && w.splash > 0) ? w.splash*1.5 : w.splash;
    const wUse = Object.assign({}, w, { dmg, splash });

    // 以 turretAngle 为基准方向(指哪打哪)
    const baseAng = this.turretAngle;
    const spd = w.speed * wg.spd;
    if (w.type === 'shotgun'){
      // 散弹:扇形发射(基于炮管角度)
      for (let i=-1;i<=1;i++){
        const ang = baseAng + i*0.25;
        const vx = Math.cos(ang)*spd;
        const vy = Math.sin(ang)*spd;
        game.bullets.push(new Bullet(muzzle.x, muzzle.y, this.dir, wUse, 'player', vx, vy));
      }
    } else {
      const vx = Math.cos(baseAng)*spd;
      const vy = Math.sin(baseAng)*spd;
      game.bullets.push(new Bullet(muzzle.x, muzzle.y, this.dir, wUse, 'player', vx, vy));
    }
    game.muzzleFlash(muzzle.x, muzzle.y);
  }

  // 激光:支持多弹道+伤害倍率。lv=1~5对应1~5条道, dmgMul=倍率系数
  // isWeak=true → 普通激光(攻击5次触发,单道低伤); isWeak=false → 激光武器(蓄力释放,多道壮观)
  fireLaser(game, lv, dmgMul, isWeak=false){
    lv = Math.max(1, Math.min(5, lv||1));
    dmgMul = dmgMul || 1.0;
    const muzzle = this.getMuzzle();
    const baseAng = this.turretAngle;
    const perpX = -Math.sin(baseAng), perpY = Math.cos(baseAng);

    if (isWeak){
      // —— 普通激光: 单道、低伤害、低调视觉 ——
      const weakDmg = 50 * dmgMul;  // 基础伤害只有激光武器的一半
      game.lasers.push(new Laser(muzzle.x, muzzle.y, baseAng, weakDmg, game, true, { weak:true, power:1 }));
      this.fireTimer = 320;
      game.shake = Math.max(game.shake, 4);
      game.muzzleFlash(muzzle.x, muzzle.y);
      game.spawnSparks(muzzle.x, muzzle.y, '#a5f3fc', 8);
      return;
    }

    // —— 激光武器(蓄力释放): 多道、高伤害、壮观特效 ——
    let dmg = 100 * dmgMul;
    if (this.hasPassive('ap_rounds')) dmg *= 1.15;
    if (this.hasBuff('power')) dmg *= 1.5;
    if (this.hasBuff('crit') && Util.chance(0.5)) dmg *= 2;
    // 每道之间的间距(像素),高等级间距略大更显气势
    const spacing = 5 + lv * 0.6;
    const totalOffset = (lv - 1) * spacing;
    const startOff = -totalOffset / 2;

    for (let i=0; i<lv; i++){
      const off = startOff + i*spacing;
      const ox = perpX * off;
      const oy = perpY * off;
      game.lasers.push(new Laser(muzzle.x+ox, muzzle.y+oy, baseAng, dmg, game, true, { weak:false, power:lv }));
    }

    // 激光冷却(随道数略微增加,避免连发过于夸张)
    this.fireTimer = 400 + lv * 40;
    // —— 发射瞬间增强特效 ——
    game.shake = Math.max(game.shake, 7 + lv * 1.5);
    game.muzzleFlash(muzzle.x, muzzle.y);
    // 能量爆发粒子:三波不同颜色,从炮口喷射
    const sparkN = 6 + lv*3;
    game.spawnSparks(muzzle.x, muzzle.y, '#ffffff', sparkN);
    game.spawnSparks(muzzle.x, muzzle.y, lv>=4 ? '#22d3ee' : '#67e8f9', sparkN+2);
    if (lv >= 3) game.spawnSparks(muzzle.x, muzzle.y, '#a855f7', 4 + lv*2);
    // 额外的发射方向扇形粒子
    for (let i=0;i<6+lv*2;i++){
      const ang = baseAng + (Math.random()-0.5)*0.8;
      const sp = 1 + Math.random()*3;
      const px = muzzle.x + Math.cos(ang)*sp;
      const py = muzzle.y + Math.sin(ang)*sp;
      game.spawnSparks(px, py, '#67e8f9', 2);
    }
    // 瞬时光环(爆炸式扩散)
    const now = Date.now();
    game.laserBurstFx = game.laserBurstFx || [];
    game.laserBurstFx.push({ x:muzzle.x, y:muzzle.y, t:now, dur:250 + lv*30 });
    // Lv4+: 屏幕白闪(高能释放的视觉冲击)
    if (lv >= 4){
      game.screenFlash = Math.max(game.screenFlash || 0, lv >= 5 ? 0.45 : 0.25);
    }
    // Lv5: 满级额外震屏 + 紫色冲击波粒子
    if (lv >= 5){
      game.shake = Math.max(game.shake, 18);
      game.spawnSparks(muzzle.x, muzzle.y, '#f0abfc', 16);
      game.spawnSparks(muzzle.x, muzzle.y, '#ffffff', 12);
    }
  }

  // 基于炮管角度获取炮口位置(turretAngle:0→右,+PI/2→下,PI→左,-PI/2→上)
  getMuzzle(){
    const ang = this.turretAngle;
    // 坦克"半个车长"距离(炮管底在中心,露出来的长度加上车半径)
    const len = (this.w/2) + 8;
    return { x: this.cx + Math.cos(ang)*len, y: this.cy + Math.sin(ang)*len };
  }

  hasBuff(id){ return this.buffs.some(b=>b.id===id); }
  addBuff(id, time){ this.buffs.push({id, time}); }

  respawn(game){
    this.hp = this.maxHp;
    this.dead = false;
    this.cx = 9*TILE+TILE/2; this.cy = 16*TILE+TILE/2;
    this.x = this.cx-this.w/2; this.y=this.cy-this.h/2;
    this.dir = DIR.UP;
    this.bodyAngle = -Math.PI/2;   // 复活默认朝上
    this.turretAngle = -Math.PI/2;
    this.invuln = 2000;
    this.spawnFlash = 30;
    this.attackCount = 0; // 复活后重置激光充能
    // 复活粒子特效
    for (let i=0;i<16;i++){
      const ang = (i/16)*Math.PI*2;
      game.particles.push(new Particle(this.cx, this.cy, Math.cos(ang)*2.8, Math.sin(ang)*2.8, '#4ade80', 25, 4));
    }
    game.shake = Math.max(game.shake, 4);
  }

  render(ctx){
    if (this.respawnDelay > 0){
      // 玩家5秒复活倒计时:旋转光圈+数字
      const t = Date.now()/400;
      const sec = Math.ceil(this.respawnDelay / 60); // 60fps下换算成秒
      const bx = 9*TILE+TILE/2, by = 16*TILE+TILE/2; // 总是在出生点显示(原位置可能被挡住)
      // 外圈旋转虚线
      ctx.strokeStyle = `rgba(74,222,128,${0.4+0.3*Math.sin(t*2)})`;
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = -t*15;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(bx,by,36,0,Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
      // 内部柔光
      const grd = ctx.createRadialGradient(bx,by,4, bx,by,36);
      grd.addColorStop(0, 'rgba(74,222,128,0.45)');
      grd.addColorStop(1, 'rgba(74,222,128,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(bx,by,36,0,Math.PI*2); ctx.fill();
      // 倒计时数字
      ctx.fillStyle = '#4ade80';
      ctx.shadowColor = '#4ade80'; ctx.shadowBlur = 14;
      ctx.font = 'bold 28px Consolas'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(sec > 0 ? sec : '!', bx, by);
      ctx.shadowBlur = 0;
      ctx.textBaseline = 'alphabetic';
      // 上方提示文字
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 12px Consolas'; ctx.textAlign = 'center';
      ctx.fillText('坦克复活中', bx, by - 48);
      return;
    }
    if (this.dead) return;
    // T-05 幽灵: 隐身状态下降低不透明度(攻击后短暂显形)
    const tdef = this.tankModel || TANK_MODELS[0];
    const invis = this.phaseInvisible && this.revealTimer <= 0;
    if (invis) ctx.globalAlpha = 0.28;
    this.renderBody(ctx, 'tank_player', tdef.color, tdef, this.tankId);
    if (invis) ctx.globalAlpha = 1;
    // T-04 壁垒:屏障光环(比护盾光环更亮)
    if (this.barrierActive){
      const t = Date.now()/120;
      const pulse = 0.65 + 0.2*Math.sin(t*1.6);
      const grad = ctx.createRadialGradient(this.cx,this.cy,this.w*0.5, this.cx,this.cy,this.w*1.08);
      grad.addColorStop(0, `rgba(148,163,184,${0.0})`);
      grad.addColorStop(0.72, `rgba(203,213,225,${0.18*pulse})`);
      grad.addColorStop(0.92, `rgba(186,230,253,${0.55*pulse})`);
      grad.addColorStop(1, `rgba(56,189,248,0)`);
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(this.cx,this.cy,this.w*1.08,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle = `rgba(186,230,253,${0.75*pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(this.cx,this.cy,this.w*0.96,0,Math.PI*2); ctx.stroke();
    }
    // 无敌护盾光环
    if (this.invuln > 0){
      ctx.strokeStyle = `rgba(0,255,224,${0.5+0.3*Math.sin(Date.now()/80)})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(this.cx,this.cy,this.w*0.7,0,Math.PI*2); ctx.stroke();
    }
    // 能量护盾就绪(蓝色光环)
    if (this.shieldReady){
      ctx.strokeStyle = `rgba(56,189,248,${0.5+0.3*Math.sin(Date.now()/100)})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(this.cx,this.cy,this.w*0.85,0,Math.PI*2); ctx.stroke();
    }
    this.renderHpBar(ctx, tdef.color);
    // —— 激光蓄力动画渲染(基于炮管角度任意方向) ——
    if (this.laserState === 'charging' || this.laserState === 'firing'){
      // [v58修复] 用 laserChargeHoldAccum 计算进度,不再用未更新的 laserChargeStart
      const progress = this.laserState === 'firing'
        ? 1
        : Math.min(1, (this.laserChargeHoldAccum || 0) / 800);
      // 当前蓄力等级 1~5
      const lv = Math.max(1, Math.min(5, Math.ceil(progress * 5)));
      const mz = this.getMuzzle();
      // 以 turretAngle 为基准方向,不再用离散 DIR_VEC[this.dir]
      const baseAng = this.turretAngle;
      const vx0 = Math.cos(baseAng), vy0 = Math.sin(baseAng);
      const perpX = -vy0, perpY = vx0;  // 垂直于炮管方向
      const t = Date.now() / 60;

      // 1) 炮口能量球(从小到大、颜色渐变,等级越高越偏紫)
      const ballSize = 3 + progress*14;
      const ballAlpha = 0.5 + progress*0.5 + 0.1*Math.sin(t*1.5);
      const coreColor = lv >= 4 ? '#a855f7' : (lv >= 2 ? '#22d3ee' : '#67e8f9');
      ctx.shadowColor = coreColor;
      ctx.shadowBlur = 8 + progress*32;
      const ballGrad = ctx.createRadialGradient(mz.x, mz.y, 0, mz.x, mz.y, ballSize);
      ballGrad.addColorStop(0, `rgba(255,255,255,${ballAlpha})`);
      ballGrad.addColorStop(0.35, lv >= 4
        ? `rgba(168,85,247,${ballAlpha*0.9})`
        : (lv >= 2 ? `rgba(34,211,238,${ballAlpha*0.9})` : `rgba(103,232,249,${ballAlpha*0.9})`));
      ballGrad.addColorStop(1, `rgba(14,165,233,0)`);
      ctx.fillStyle = ballGrad;
      ctx.beginPath(); ctx.arc(mz.x, mz.y, ballSize, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;

      // 1.5) 能量球外侧显示 N 个小点,表示即将发射的弹道数量(沿垂直炮管方向排列)
      if (lv >= 2){
        const dotSpacing = 5;
        const dotR = 2 + progress*1.2;
        for (let i=0; i<lv; i++){
          const off = ((i - (lv-1)/2) * dotSpacing);
          const dx = perpX * off;
          const dy = perpY * off;
          ctx.shadowColor = coreColor;
          ctx.shadowBlur = 8 + progress*8;
          ctx.fillStyle = `rgba(255,255,255,${0.7+0.3*Math.sin(t*2+i)})`;
          ctx.beginPath(); ctx.arc(mz.x+dx, mz.y+dy, dotR, 0, Math.PI*2); ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // 2) 扩展光环(围绕能量球的呼吸圆环)
      const ringR = 6 + progress*22 + 4*Math.sin(t*1.2);
      ctx.strokeStyle = `rgba(103,232,249,${0.25 + 0.5*progress})`;
      ctx.lineWidth = 1.5 + progress*1.5;
      ctx.beginPath(); ctx.arc(mz.x, mz.y, ringR, 0, Math.PI*2); ctx.stroke();

      // 3) 汇聚的光束(从坦克周围6个点飞向炮口)
      const beamCount = 6;
      for (let i=0;i<beamCount;i++){
        const ang = (i / beamCount) * Math.PI*2 + t*0.05;
        const srcR = 26 + 4*Math.sin(t*0.8 + i);
        const sx = this.cx + Math.cos(ang)*srcR;
        const sy = this.cy + Math.sin(ang)*srcR;
        const blend = progress*0.85;
        const ex = sx + (mz.x - sx)*blend;
        const ey = sy + (mz.y - sy)*blend;
        const grad = ctx.createLinearGradient(sx,sy,ex,ey);
        grad.addColorStop(0, 'rgba(103,232,249,0)');
        grad.addColorStop(1, lv >= 4
          ? `rgba(168,85,247,${0.55 + 0.4*progress})`
          : (lv >= 2 ? `rgba(34,211,238,${0.5 + 0.4*progress})` : `rgba(103,232,249,${0.35 + 0.5*progress})`));
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1 + progress*2;
        ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(ex,ey); ctx.stroke();
      }

      // 4) 炮口前方准激光预览(短的光束尾迹,高等级显示多条,沿炮管方向)
      if (progress > 0.3){
        const previewLen = (progress - 0.3) * 130 / 0.7;
        const spacing = 4;
        for (let i=0; i<lv; i++){
          const off = ((i - (lv-1)/2) * spacing);
          const ox = perpX * off;
          const oy = perpY * off;
          const ex = mz.x + ox + vx0*previewLen;
          const ey = mz.y + oy + vy0*previewLen;
          const pgrad = ctx.createLinearGradient(mz.x+ox,mz.y+oy,ex,ey);
          pgrad.addColorStop(0, lv >= 4
            ? `rgba(168,85,247,${0.55 + 0.2*Math.sin(t*3+i)})`
            : (lv >= 2 ? `rgba(34,211,238,${0.5 + 0.25*Math.sin(t*3+i)})` : `rgba(103,232,249,${0.4 + 0.3*Math.sin(t*3)})`));
          pgrad.addColorStop(1, 'rgba(103,232,249,0)');
          ctx.strokeStyle = pgrad;
          ctx.lineWidth = 1.5 + progress*2.5;
          ctx.shadowColor = lv >= 4 ? '#a855f7' : '#22d3ee';
          ctx.shadowBlur = progress>0.7 ? 14 : 8;
          ctx.beginPath(); ctx.moveTo(mz.x+ox,mz.y+oy); ctx.lineTo(ex,ey); ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }

      // 5) 头顶: 弹道等级图标 + 5段式进度条
      const barW = 44, barH = 5;
      const bx = this.cx - barW/2, by = this.y - 26;
      // 弹道数显示 (Lv.1~5 对应1~5根竖条)
      const iconW = 4 + lv*3, iconH = 6;
      const ix = this.cx - iconW/2, iy = by - 10;
      for (let i=0;i<lv;i++){
        const barColor = lv >= 4 ? '#a855f7' : (lv >= 2 ? '#22d3ee' : '#67e8f9');
        ctx.shadowColor = barColor;
        ctx.shadowBlur = 6;
        ctx.fillStyle = barColor;
        ctx.fillRect(ix + i*3, iy, 2, iconH);
        ctx.shadowBlur = 0;
      }
      // 5段式进度条背景
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(bx-1, by-1, barW+2, barH+2);
      for (let seg=0; seg<5; seg++){
        const segW = barW/5 - 1;
        const segX = bx + seg*(barW/5);
        const segFilled = (progress*5) >= (seg+1) ? 1 : Math.max(0, (progress*5 - seg));
        const segColor = seg < 3 ? '#67e8f9' : (seg === 3 ? '#22d3ee' : '#a855f7');
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(segX, by, segW, barH);
        ctx.fillStyle = segColor;
        ctx.fillRect(segX, by, segW * segFilled, barH);
      }
      // Lv文字
      ctx.fillStyle = '#e0f2fe';
      ctx.font = 'bold 10px Consolas'; ctx.textAlign = 'center';
      ctx.fillText('Lv'+lv, this.cx, by - 2);
      // 满级闪烁
      if (progress >= 1){
        ctx.shadowColor = '#a855f7';
        ctx.shadowBlur = 14 + 6*Math.sin(t*2);
        ctx.fillStyle = '#f0abfc';
        ctx.font = 'bold 11px Consolas'; ctx.textAlign = 'center';
        ctx.fillText('⚡MAX⚡', this.cx, by - 13);
        ctx.shadowBlur = 0;
      }
    }
    // 激光就绪(非充能时)的头顶提示
    // 激光槽位+已解锁 → ⚡LASER; 普通武器攒满5次 → ⚡READY(连击就绪)
    const laserSlotReady = (this.laserUnlocked && this.currentWeapon === 8);
    const comboReady = (this.attackCount >= 5);
    if (this.laserState === 'idle' && (laserSlotReady || comboReady)){
      const t = Date.now()/120;
      ctx.fillStyle = `rgba(103,232,249,${0.6+0.4*Math.sin(t)})`;
      ctx.shadowColor = '#67e8f9'; ctx.shadowBlur = 10;
      ctx.font = 'bold 11px Consolas'; ctx.textAlign = 'center';
      ctx.fillText(laserSlotReady ? '⚡LASER' : '⚡READY', this.cx, this.y - 14);
      ctx.shadowBlur = 0;
    }
    // —— 头顶技能冷却 HUD(专属神技) ——
    const tdefSkill = (this.tankModel && this.tankModel.skill) ? this.tankModel.skill : null;
    if (tdefSkill){
      const skCdMax = tdefSkill.cd;
      const ratio = Math.max(0, Math.min(1, this.skillCd / skCdMax));
      const bx = this.cx - 18, by = this.y - 24;
      const bw = 36, bh = 3;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(bx-1, by-1, bw+2, bh+2);
      if (ratio > 0){
        ctx.fillStyle = 'rgba(251,191,36,0.85)';
        ctx.fillRect(bx, by, bw*ratio, bh);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = '9px Consolas'; ctx.textAlign = 'center';
        ctx.fillText('F ' + (this.skillCd/1000).toFixed(1)+'s', this.cx, by - 2);
      } else {
        ctx.fillStyle = this.skillActive ? '#22d3ee' : '#4ade80';
        ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px Consolas'; ctx.textAlign = 'center';
        ctx.fillText(this.skillActive ? ('F 施放中') : (tdefSkill.key + ' 就绪 → ' + tdefSkill.name), this.cx, by - 2);
      }
    }
  }

  // —— 专属神技:按 F 触发 ——
  tryUseSkill(game){
    const tdef = this.tankModel || TANK_MODELS[0];
    const sk = tdef.skill;
    if (!sk){ game.flashMsg('先锋号无专属神技,切换其他坦克试试~'); return; }
    if (this.skillCd > 0){ game.flashMsg('神技冷却中 ' + (this.skillCd/1000).toFixed(1) + 's'); return; }
    if (this.skillActive){ game.flashMsg('神技已在施放中'); return; }
    this.skillCd = sk.cd * (this.tankSkillCdMul || 1);
    if (sk.id === 'chain_lightning'){
      // T-02 雷霆 ⚡ 连锁闪电: 瞬时作用,一次伤害,视觉特效 420ms
      this.skillActive = true;
      this.skillTimer = 420;
      this._skillStart(game, sk);
    } else if (sk.id === 'flame_jet'){
      // T-03 烈焰 🔥 火焰喷射: 持续 3 秒
      this.skillActive = true;
      this.skillTimer = 3000;
      this.skillData.jetTick = 0;
      this._skillStart(game, sk);
    } else if (sk.id === 'energy_barrier'){
      // T-04 壁垒 🛡 能量壁垒: 持续 5 秒
      this.skillActive = true;
      this.skillTimer = 5000;
      this.barrierActive = true;
      this._skillStart(game, sk);
    } else if (sk.id === 'phase_stealth'){
      // T-05 幽灵 👻 相位潜行: 持续 8 秒
      this.skillActive = true;
      this.skillTimer = 8000;
      this.phaseInvisible = true;
      game.flashMsg('👻 相位潜行激活 · 移动+30%,开火会短暂显形');
    }
  }
  _skillStart(game, sk){
    const px = this.cx, py = this.cy;
    if (sk.id === 'chain_lightning'){
      // 寻找炮管方向最近的敌人 → 作为闪电链起点
      const aimAng = this.turretAngle;
      const fvx = Math.cos(aimAng), fvy = Math.sin(aimAng);
      const mz = this.getMuzzle();
      const candidates = [...game.enemies];
      if (game.boss && !game.boss.dead) candidates.push(game.boss);
      // 敌人按"炮管方向距离加权"排序(距离近 + 在炮管方向正前方优先)
      const scored = candidates.filter(e=>e && !e.dead).map(e=>{
        const dx = e.cx - mz.x, dy = e.cy - mz.y;
        const d  = Math.hypot(dx, dy);
        const forwardScore = (dx*fvx + dy*fvy) / Math.max(1, d); // 1=正对前方,-1=正后方
        const score = (forwardScore * 140) - d;
        return { e, d, score };
      }).sort((a,b)=>b.score - a.score);
      // 最多 5 跳,每跳距离 ≤ 220,伤害逐跳 0.8x 衰减
      const maxHops = 5;
      const maxHopDist = 220;
      const hops = []; // [{from:{x,y},to:{x,y},dmg}]
      const visited = new Set();
      let curX = mz.x, curY = mz.y;
      let baseDmg = 80;
      // 首跳: 选分数最高或最近的敌人
      let first = null;
      if (scored.length > 0 && scored[0].score > -100) first = scored[0];
      else {
        // 无正前方敌人 → 找最近敌人
        const nearest = [...candidates].filter(e=>e && !e.dead)
          .map(e=>({e, d:Math.hypot(e.cx-px,e.cy-py)}))
          .sort((a,b)=>a.d-b.d)[0];
        if (nearest) first = { e: nearest.e, d: nearest.d, score: -999 };
      }
      if (first){
        hops.push({ from:{x:curX,y:curY}, to:{x:first.e.cx,y:first.e.cy}, dmg:baseDmg, target:first.e });
        first.e.hurt(baseDmg, game);
        game.spawnSparks(first.e.cx, first.e.cy, '#93c5fd', 18);
        visited.add(first.e);
        curX = first.e.cx; curY = first.e.cy;
        baseDmg *= 0.8;
      }
      // 后续 4 跳: 从未访问敌人中找最近的
      for (let h=hops.length; h<maxHops; h++){
        let next = null; let bestD = maxHopDist+1;
        for (const e of candidates){
          if (!e || e.dead || visited.has(e)) continue;
          const d = Math.hypot(e.cx - curX, e.cy - curY);
          if (d < bestD){ bestD = d; next = e; }
        }
        if (!next) break;
        hops.push({ from:{x:curX,y:curY}, to:{x:next.cx,y:next.cy}, dmg:baseDmg, target:next });
        next.hurt(baseDmg, game);
        game.spawnSparks(next.cx, next.cy, '#93c5fd', 12);
        visited.add(next);
        curX = next.cx; curY = next.cy;
        baseDmg *= 0.8;
      }
      // 震屏+白闪
      game.shake = Math.max(game.shake, Math.min(24, 8 + hops.length*2));
      game.screenFlash = Math.max(game.screenFlash, 0.2 + hops.length*0.05);
      // 视觉特效对象(持续 420ms)
      game.lightningChains.push({ hops, born: Date.now(), life: 420 });
    } else if (sk.id === 'flame_jet'){
      game.flashMsg('🔥 火焰喷射!持续 3 秒');
    } else if (sk.id === 'energy_barrier'){
      game.flashMsg('🛡 能量壁垒展开! 5 秒无敌+反弹子弹');
      game.barriers.push({ x: this.cx, y: this.cy, born: Date.now(), life: 5000, player: this });
      game.shake = Math.max(game.shake, 10);
    }
  }
  _skillTick(game, dt){
    const tdef = this.tankModel || TANK_MODELS[0];
    const sk = tdef.skill;
    if (!sk) return;
    if (sk.id === 'flame_jet'){
      // 每 50ms 喷一波火焰粒子 + DOT 伤害
      this.skillData.jetTick = (this.skillData.jetTick || 0) + dt;
      const interval = 50;
      while (this.skillData.jetTick >= interval){
        this.skillData.jetTick -= interval;
        const mz = this.getMuzzle();
        const ang = this.turretAngle;
        const fvx = Math.cos(ang), fvy = Math.sin(ang);
        const perpX = -fvy, perpY = fvx;
        // 锥形发射 6~9 颗火焰弹,速度/角度略微散布
        const count = 8;
        for (let i=0;i<count;i++){
          const spread = (Math.random()-0.5) * 0.78; // ±22°
          const spdAng = ang + spread;
          const spd = Util.rand(2.8, 5.2) + (3 - this.skillTimer/1000)*0.6;
          const vx = Math.cos(spdAng)*spd;
          const vy = Math.sin(spdAng)*spd;
          // 压力高就减少
          const flamePressure = game.flames.length / Math.max(1, game.MAX_FLAMES);
          if (flamePressure > 0.9) break;
          game.flames.push({
            x: mz.x + fvx*6 + perpX*Util.rand(-2,2),
            y: mz.y + fvy*6 + perpY*Util.rand(-2,2),
            vx, vy,
            life: 520, born: Date.now(),
            size: Util.rand(5, 10),
            dmg: 16, // 碰撞瞬间伤害,持续 burn
            burned: new Set()
          });
        }
      }
      // DOT: 对当前已在火焰范围内敌人持续灼烧 + 轻微推开
      const fvx = Math.cos(this.turretAngle), fvy = Math.sin(this.turretAngle);
      for (const e of [...game.enemies, game.boss]){
        if (!e || e.dead) continue;
        // 锥形范围:炮管方向 ±35°, 距离 ≤ 150
        const dx = e.cx - this.cx, dy = e.cy - this.cy;
        const d = Math.hypot(dx, dy);
        if (d <= 150){
          const localF = (dx*fvx + dy*fvy) / Math.max(1, d);
          if (localF >= Math.cos(0.61)){ // ≈ 约 35° (0.61 rad)
            // 范围内 → 每 dt 秒 DOT + 推离
            const dmgPerSec = 60;
            e.hurt(dmgPerSec * (dt/1000), game);
            // 推离: 沿炮管方向轻微推开
            const pushAmp = 0.08 * (dt/16.67);
            e.tryMove(fvx*pushAmp*40, fvy*pushAmp*40, game);
          }
        }
      }
    } else if (sk.id === 'energy_barrier'){
      // 维持屏障跟随玩家(屏障对象已绑定 this,每帧渲染用最新 this.cx/this.cy)
    } else if (sk.id === 'phase_stealth'){
      // 在 update 外层已处理 revealTimer tick,这里仅保持状态
    }
  }
  _skillEnd(game){
    const tdef = this.tankModel || TANK_MODELS[0];
    const sk = tdef.skill;
    if (!sk) return;
    if (sk.id === 'energy_barrier'){
      this.barrierActive = false;
      game.flashMsg('🛡 能量壁垒消散');
    } else if (sk.id === 'phase_stealth'){
      this.phaseInvisible = false;
      this.revealTimer = 0;
      game.flashMsg('👻 相位潜行结束');
    } else if (sk.id === 'flame_jet'){
      game.flashMsg('🔥 火焰喷射结束');
    }
  }
}

/* ===================== 十二、敌方坦克 ===================== */
class EnemyTank extends Tank {
  constructor(col,row,def,level,endlessWave){
    super(col,row);
    this.def = def;
    if (endlessWave){
      // 无尽模式:属性随波次大幅增长(数量固定,质量提升)
      const w = endlessWave;
      this.maxHp     = Math.floor(def.hp * (1 + w * 0.28));         // 血量+28%/波
      this.speed     = def.speed * Math.min(1.8, 1 + w * 0.04);     // 速度+4%/波(上限1.8倍)
      this.fireCd    = Math.max(220, def.fireCd * (1 - w * 0.03));  // 射速+3%/波(下限220ms)
      this.bulletDmg = Math.floor(18 * (1 + w * 0.07));             // 伤害+7%/波
      this.score     = def.score + w * 25;                          // 积分+25/波
      this.endlessWave = w;
    } else {
      this.maxHp     = def.hp + level*15;     // 关卡加成
      this.speed     = def.speed;             // 普通模式:按配置原始速度(像素/帧@60Hz)
      this.fireCd    = def.fireCd;
      this.bulletDmg = 18;                    // 普通模式固定伤害
      this.score     = def.score;
    }
    this.hp = this.maxHp;
    this.fireTimer = Util.rand(300, this.fireCd);
    this.type = def.type;
    this.color = def.color;
    this.dir = DIR.DOWN;
    this.aiTimer = 0;
    this.targetDir = DIR.DOWN;
    this.spawnFlash = 40;
  }

  hurt(dmg, game){
    const wasAlive = this.hp > 0;
    super.hurt(dmg, game);
    game.spawnSparks(this.cx,this.cy,this.color,6);
    if (wasAlive && this.dead){
      // 敌人被击毁 —— 夸张爆炸特效
      const isHeavy = this.type === 'heavy';
      const tier = isHeavy ? 2 : (this.type==='armored'||this.type==='sniper' ? 1.5 : 1);
      const mainR = (isHeavy ? 72 : 52);
      game.shake = Math.max(game.shake, isHeavy ? 28 : (tier>=1.5?18:12));
      game.screenFlash = Math.max(game.screenFlash, isHeavy ? 0.85 : 0.55);
      game.vignette = Math.max(game.vignette, isHeavy ? 0.75 : 0.45);
      game.spawnExplosion(this.cx, this.cy, mainR);
      // 大块装甲碎片(重型更多)
      const fragCount = Math.floor(28 + tier*16);
      for (let i=0;i<fragCount;i++){
        const ang = Math.random()*Math.PI*2;
        const sp = Util.rand(3, 9) * (0.8 + tier*0.2);
        const colors = ['#57534e','#78716c','#44403c','#991b1b','#b91c1c','#f59e0b','#dc2626'];
        const sz = Util.rand(3, 7 + tier*2);
        const p = new Particle(
          this.cx + Util.rand(-this.w/3, this.w/3),
          this.cy + Util.rand(-this.h/3, this.h/3),
          Math.cos(ang)*sp, Math.sin(ang)*sp,
          Util.pick(colors),
          Util.randInt(28, 60), sz);
        p.gravity = 0.18 + Util.rand(0,0.12);
        p.expand = (Math.random() < 0.25 ? +0.08 : -0.04);
        game.particles.push(p);
      }
      // 外抛飞溅油/弹药火光颗粒
      for (let i=0;i<Math.floor(40 + tier*28);i++){
        const ang = Math.random()*Math.PI*2;
        const sp = Util.rand(2, 10);
        const colors = ['#fbbf24','#ef4444','#fde047','#fb923c','#ffffff'];
        const p = new Particle(this.cx, this.cy, Math.cos(ang)*sp, Math.sin(ang)*sp, Util.pick(colors), Util.randInt(12,28), Util.rand(2,4));
        p.gravity = 0.05;
        game.particles.push(p);
      }
      // 多层延迟爆炸 + 更大震屏
      if (tier >= 1.5){
        setTimeout(()=>{ game.spawnExplosion(this.cx+14, this.cy-8, 36); game.shake = Math.max(game.shake, isHeavy?18:12); }, 90);
        setTimeout(()=>{ game.spawnExplosion(this.cx-12, this.cy+10, 42); game.shake = Math.max(game.shake, isHeavy?20:14); game.screenFlash = Math.max(game.screenFlash, isHeavy?0.55:0.3); }, 180);
      }
      if (isHeavy){
        setTimeout(()=>{ game.spawnExplosion(this.cx, this.cy-14, 50); game.shake = Math.max(game.shake, 22); game.vignette = Math.max(game.vignette, 0.45); }, 330);
        setTimeout(()=>{ game.spawnExplosion(this.cx-16, this.cy-4, 38); game.shake = Math.max(game.shake, 14); }, 520);
      }
      game.onEnemyKilled(this);
    }
  }

  update(dt, game){
    if (this.spawnFlash > 0){ this.spawnFlash--; return; }
    if (this.dead) return;
    // 冰冻
    if (game.freezeTimer > 0) return;

    if (this.fireTimer > 0) this.fireTimer -= dt;
    this.aiTimer -= dt;
    if (this.aiTimer <= 0){
      this.aiTimer = Util.rand(400, 1200);
      this.decideAI(game);
    }

    // 从 dir 同步连续角度(bodyAngle 立刻对齐到目标 4 方向, turretAngle 跟随)
    const targetAng = [ -Math.PI/2, 0, Math.PI/2, Math.PI ][this.dir];
    this.bodyAngle = this.normAngle(targetAng);
    // 敌人炮管:面向玩家 + dir 目标(瞄准玩家优先,给玩家压迫感)
    let turretTarget = targetAng;
    // T-05 幽灵相位潜行期间(没攻击显形),敌人丢失玩家 → 乱瞄,不追
    const playerVisible = game.player && !game.player.dead && !(game.player.phaseInvisible && game.player.revealTimer <= 0);
    if (playerVisible && Util.chance(0.85)){
      turretTarget = Math.atan2(game.player.cy - this.cy, game.player.cx - this.cx);
    }
    // 敌人 turnTurretTowards 的 maxTurn 也按 dt 标准化: 0.08 rad/帧@60Hz
    this.turnTurretTowards(turretTarget, 0.08 * (dt/16.67));

    // 移动: this.speed 是「像素/帧@60Hz」,按 dt 标准化
    const v = DIR_VEC[this.dir];
    const scale = dt / 16.67;
    const moved = this.tryMove(v[0]*this.speed*scale, v[1]*this.speed*scale, game);
    this.moving = moved ? 1 : 0;
    if (!moved){
      // 撞墙换方向
      this.decideAI(game);
    }
    this.animTick++;

    // 自爆坦克:接近玩家就爆炸(玩家隐身时不会盯玩家爆)
    if (this.type === 'suicide' && game.player && !game.player.dead){
      const playerInvis = game.player.phaseInvisible && game.player.revealTimer <= 0;
      if (!playerInvis && Util.dist(this.cx,this.cy,game.player.cx,game.player.cy) < TILE*1.2){
        this.explode(game);
        return;
      }
    }

    // 射击
    if (this.fireTimer <= 0){
      this.fire(game);
      this.fireTimer = this.fireCd;
    }
  }

  decideAI(game){
    // 简单AI:大部分时间朝玩家或基地方向,偶尔随机
    const playerInvis = game.player && !game.player.dead && game.player.phaseInvisible && game.player.revealTimer <= 0;
    const target = (game.player && !game.player.dead && !playerInvis) ? game.player : { cx: 9*TILE, cy: 19*TILE };
    // 潜行期间,敌人降低追玩家概率(更多随机+攻基地),自爆坦克也不会盯人
    const chaseChance = playerInvis ? 0.15 : 0.55;
    if (Util.chance(chaseChance)){
      // 朝目标方向
      const dx = target.cx - this.cx, dy = target.cy - this.cy;
      if (Math.abs(dx) > Math.abs(dy)){
        this.dir = dx > 0 ? DIR.RIGHT : DIR.LEFT;
      } else {
        this.dir = dy > 0 ? DIR.DOWN : DIR.UP;
      }
    } else {
      this.dir = Util.randInt(0,3);
    }
  }

  fire(game){
    const muzzle = this.getMuzzle();
    const w = { dmg:this.bulletDmg||18, speed:3.6, color:this.color, pierce:false, splash:0, type:'normal' };
    // 敌人沿 turretAngle 方向射(指玩家)
    const spd = w.speed;
    const vx = Math.cos(this.turretAngle)*spd;
    const vy = Math.sin(this.turretAngle)*spd;
    game.bullets.push(new Bullet(muzzle.x, muzzle.y, this.dir, w, 'enemy', vx, vy));
  }

  // 基于 turretAngle 计算炮口
  getMuzzle(){
    const ang = this.turretAngle;
    const len = (this.w/2) + 6;
    return { x: this.cx + Math.cos(ang)*len, y: this.cy + Math.sin(ang)*len };
  }

  // 自爆
  explode(game){
    this.dead = true;
    game.shake = Math.max(game.shake, 22);
    game.screenFlash = Math.max(game.screenFlash, 0.7);
    game.vignette = Math.max(game.vignette, 0.55);
    game.spawnExplosion(this.cx, this.cy, 65);
    // 碎片
    for (let i=0;i<60;i++){
      const ang = Math.random()*Math.PI*2;
      const sp = Util.rand(4, 11);
      const colors = ['#57534e','#44403c','#ef4444','#f59e0b','#fbbf24','#fde047'];
      const p = new Particle(this.cx, this.cy, Math.cos(ang)*sp, Math.sin(ang)*sp, Util.pick(colors), Util.randInt(22, 52), Util.rand(3, 7));
      p.gravity = 0.15;
      game.particles.push(p);
    }
    // 延迟二次爆炸(弹药殉爆)
    setTimeout(()=>{ game.spawnExplosion(this.cx+10, this.cy+8, 48); game.shake = Math.max(game.shake, 18); }, 110);
    setTimeout(()=>{ game.spawnExplosion(this.cx-12, this.cy-4, 44); game.shake = Math.max(game.shake, 14); game.screenFlash = Math.max(game.screenFlash, 0.4); }, 220);
    if (game.player && !game.player.dead && Util.dist(this.cx,this.cy,game.player.cx,game.player.cy) < 80){
      game.player.hurt(55, game, { splash:true }); // 自爆溅射
    }
    game.onEnemyKilled(this);
  }

  render(ctx){
    if (this.dead) return;
    this.renderBody(ctx, 'tank_enemy', this.color);
    this.renderHpBar(ctx, this.color);
    // 自爆坦克闪烁警告
    if (this.type === 'suicide'){
      ctx.fillStyle = `rgba(250,204,21,${0.3+0.3*Math.sin(Date.now()/60)})`;
      ctx.beginPath(); ctx.arc(this.cx,this.cy,this.w*0.6,0,Math.PI*2); ctx.fill();
    }
  }
}

/* ===================== 十三、BOSS坦克 ===================== */
class BossTank extends Tank {
  constructor(level){
    super(9, 2);
    this.w = TILE*2; this.h = TILE*2;
    this.cx = 9*TILE+TILE; this.cy = 2*TILE+TILE;
    this.x = this.cx-this.w/2; this.y=this.cy-this.h/2;
    this.maxHp = 800 + level*250;
    this.hp = this.maxHp;
    this.speed = 0.6;
    this.dir = DIR.DOWN;
    this.fireTimer = 1000;
    this.score = 1000 + level*300;
    this.spawnFlash = 60;
    this.phase = 0;
    this.moveTimer = 0;
    // —— BOSS 技能系统 ——
    this.skillTimer = 4000;   // 首次技能 4s 后
    this.skillName = '';      // 当前技能名(显示用)
    this.skillNameTimer = 0;  // 技能名显示时长
    this.chargeTimer = 0;     // 冲撞蓄力计时
    this.chargeDir = null;    // 冲撞方向
    this.isCharging = false;  // 冲撞状态
  }

  hurt(dmg, game){
    const wasAlive = this.hp > 0;
    super.hurt(dmg, game);
    game.spawnSparks(this.cx,this.cy,'#fbbf24',8);
    // 阶段切换(血量越低攻击越猛)
    const ratio = this.hp/this.maxHp;
    this.phase = ratio < 0.33 ? 2 : (ratio < 0.66 ? 1 : 0);
    // 阶段切换时爆炸冲击
    if (wasAlive && ratio > 0 && (this.phase === 1 && ratio < 0.66 && ratio > 0.32) || (this.phase === 2 && ratio < 0.33 && ratio > 0)){
      if (!this._phaseBoomed) this._phaseBoomed = 0;
      const boomNeeded = this.phase === 2 ? 2 : 1;
      if (this._phaseBoomed < boomNeeded){
        this._phaseBoomed = boomNeeded;
        game.shake = Math.max(game.shake, 12);
        game.spawnExplosion(this.cx, this.cy, 60);
      }
    }
    if (wasAlive && this.dead){
      // BOSS被击毁 —— 震撼级多段大爆炸 + 全屏闪白 + 暗角冲击 + 装甲碎片雨
      game.shake = Math.max(game.shake, 55);
      game.screenFlash = 1.0;
      game.vignette = 0.9;
      game.spawnExplosion(this.cx, this.cy, 130);
      // 装甲碎片雨(BOSS体型大,碎片超多)
      for (let i=0;i<180;i++){
        const ang = Math.random()*Math.PI*2;
        const sp = Util.rand(5, 18);
        const colors = ['#57534e','#78716c','#44403c','#292524','#991b1b','#b91c1c','#dc2626','#fbbf24','#f59e0b','#fde047','#7c2d12'];
        const sz = Util.rand(5, 13);
        const p = new Particle(
          this.cx + Util.rand(-this.w/2.2, this.w/2.2),
          this.cy + Util.rand(-this.h/2.2, this.h/2.2),
          Math.cos(ang)*sp, Math.sin(ang)*sp,
          Util.pick(colors),
          Util.randInt(40, 90), sz);
        p.gravity = 0.25 + Util.rand(0, 0.2);
        p.expand = (Math.random() < 0.35 ? +0.1 : -0.06);
        game.particles.push(p);
      }
      // 油火弹药飞溅颗粒
      for (let i=0;i<260;i++){
        const ang = Math.random()*Math.PI*2;
        const sp = Util.rand(2, 16);
        const colors = ['#fbbf24','#ef4444','#fde047','#fb923c','#fff','#f97316'];
        const p = new Particle(this.cx, this.cy, Math.cos(ang)*sp, Math.sin(ang)*sp, Util.pick(colors), Util.randInt(18, 48), Util.rand(2, 6));
        p.gravity = 0.1;
        game.particles.push(p);
      }
      // 多层连续爆炸 + 多次闪白震屏
      setTimeout(()=>{ game.spawnExplosion(this.cx+36, this.cy-26, 85); game.shake = Math.max(game.shake, 38); game.screenFlash = Math.max(game.screenFlash, 0.65); game.vignette = Math.max(game.vignette, 0.7); }, 130);
      setTimeout(()=>{ game.spawnExplosion(this.cx-32, this.cy+30, 90); game.shake = Math.max(game.shake, 42); game.screenFlash = Math.max(game.screenFlash, 0.75); }, 280);
      setTimeout(()=>{ game.spawnExplosion(this.cx+14, this.cy+20, 68); game.shake = Math.max(game.shake, 28); }, 430);
      setTimeout(()=>{ game.spawnExplosion(this.cx-22, this.cy-14, 62); game.shake = Math.max(game.shake, 26); game.vignette = Math.max(game.vignette, 0.55); }, 580);
      setTimeout(()=>{ game.spawnExplosion(this.cx+28, this.cy+6, 52); game.shake = Math.max(game.shake, 18); }, 760);
      setTimeout(()=>{ game.onBossKilled(); }, 920);
    }
  }

  update(dt, game){
    if (this.spawnFlash > 0){ this.spawnFlash--; return; }
    if (this.dead) return;
    if (game.freezeTimer > 0) return;

    if (this.fireTimer > 0) this.fireTimer -= dt;
    if (this.skillTimer > 0) this.skillTimer -= dt;
    if (this.skillNameTimer > 0) this.skillNameTimer -= dt;
    this.moveTimer -= dt;

    // —— 冲撞状态: 蓄力→高速冲刺→恢复 ——
    if (this.isCharging){
      this.chargeTimer -= dt;
      if (this.chargeTimer > 800){
        // 蓄力阶段:原地不动,粒子聚集
        if (Math.random() < 0.4){
          const ang = Math.random()*Math.PI*2;
          const r = 40 + Math.random()*20;
          game.spawnSparks(this.cx+Math.cos(ang)*r, this.cy+Math.sin(ang)*r, '#fbbf24', 1);
        }
      } else if (this.chargeTimer > 0){
        // 冲刺阶段:高速移动(冲撞可破坏砖墙,势不可挡)
        const cv = this.chargeDir;
        const chargeSpeed = 4.5;
        const scale = dt / 16.67;
        const ddx = cv[0]*chargeSpeed*scale, ddy = cv[1]*chargeSpeed*scale;
        // 先破坏路径上的砖墙(钢墙仍阻挡)
        const nbx = this.x + ddx, nby = this.y + ddy;
        const bc0 = Util.toCell(Math.min(this.x, nbx)), bc1 = Util.toCell(Math.max(this.x+this.w, nbx+this.w)-1);
        const br0 = Util.toCell(Math.min(this.y, nby)), br1 = Util.toCell(Math.max(this.y+this.h, nby+this.h)-1);
        for (let cy=br0; cy<=br1; cy++){
          for (let cx=bc0; cx<=bc1; cx++){
            if (cx>=0&&cx<COLS&&cy>=0&&cy<ROWS && game.grid[cy][cx].type === T.BRICK){
              game.grid[cy][cx].type = T.EMPTY;
              game.spawnBrickDebris(cx, cy);
              game.spawnSparks(cx*TILE+TILE/2, cy*TILE+TILE/2, '#f97316', 4);
            }
          }
        }
        this.tryMove(ddx, ddy, game);
        // 冲撞粒子
        if (Math.random() < 0.5) game.spawnSparks(this.cx, this.cy, '#f97316', 2);
        // 冲撞伤害(接触玩家)
        if (game.player && !game.player.dead && Util.rectsHit(this.rect, game.player.rect)){
          game.player.hurt(30, game, { splash:true });
          game.shake = Math.max(game.shake, 20);
        }
      } else {
        // 冲刺结束
        this.isCharging = false;
        this.chargeDir = null;
        this.moveTimer = 800;
      }
      this.animTick++;
      return; // 冲撞期间不普通移动/射击
    }

    // 横向巡逻:同步连续角度(bodyAngle)
    if (this.moveTimer <= 0){
      this.moveTimer = 1500;
      this.dir = Util.chance(0.5) ? DIR.LEFT : DIR.RIGHT;
    }
    this.bodyAngle = this.normAngle([ -Math.PI/2, 0, Math.PI/2, Math.PI ][this.dir]);
    // BOSS 炮管瞄准玩家(如果玩家存在,幽灵潜行期间BOSS盲瞄)
    let turretTarget = Math.PI/2; // 默认朝下
    const bossPlayerInvis = game.player && !game.player.dead && game.player.phaseInvisible && game.player.revealTimer <= 0;
    if (game.player && !game.player.dead && !bossPlayerInvis){
      turretTarget = Math.atan2(game.player.cy - this.cy, game.player.cx - this.cx);
    } else if (bossPlayerInvis){
      turretTarget = Math.PI/2 + Math.sin(Date.now()/500)*0.6; // 左右摇摆盲扫
    }
    // 0.06 rad/帧@60Hz,按 dt 标准化
    this.turnTurretTowards(turretTarget, 0.06 * (dt/16.67));

    // this.speed 是「像素/帧@60Hz」,按 dt 标准化
    const v = DIR_VEC[this.dir];
    const scale = dt / 16.67;
    if (!this.tryMove(v[0]*this.speed*scale, v[1]*this.speed*scale, game)){
      this.dir = this.dir === DIR.LEFT ? DIR.RIGHT : DIR.LEFT;
    }
    this.moving = 1;
    this.animTick++;

    // 射击:多发炮弹(扇形/追踪)
    if (this.fireTimer <= 0){
      this.fire(game);
      this.fireTimer = this.phase === 2 ? 550 : (this.phase === 1 ? 800 : 1100);
    }

    // —— BOSS 技能释放(阶段1/2 才用) ——
    if (this.skillTimer <= 0 && this.phase >= 1 && game.player && !game.player.dead){
      this.castSkill(game);
      // 阶段2技能更频繁
      this.skillTimer = this.phase === 2 ? 5000 : 7000;
    }
  }

  // —— BOSS 技能: 随机选一个释放 ——
  castSkill(game){
    const skills = this.phase === 2
      ? ['bullet_hell', 'charge', 'summon', 'homing_swarm']
      : ['bullet_hell', 'charge', 'summon'];
    const skill = Util.pick(skills);
    switch (skill){
      case 'bullet_hell': this.skillBulletHell(game); break;
      case 'charge':      this.skillCharge(game);      break;
      case 'summon':      this.skillSummon(game);      break;
      case 'homing_swarm':this.skillHomingSwarm(game); break;
    }
  }

  // 技能1: 弹幕地狱 — 360度全方位散弹
  skillBulletHell(game){
    this.skillName = '弹幕地狱';
    this.skillNameTimer = 1500;
    const count = this.phase === 2 ? 24 : 16;
    const w = { dmg:18, speed:2.8, color:'#ef4444', pierce:false, splash:0, type:'normal' };
    for (let i=0;i<count;i++){
      const ang = (i/count)*Math.PI*2;
      const vx = Math.cos(ang)*w.speed, vy = Math.sin(ang)*w.speed;
      game.bullets.push(new Bullet(this.cx, this.cy, 0, w, 'enemy', vx, vy));
    }
    game.spawnExplosion(this.cx, this.cy, 50);
    game.shake = Math.max(game.shake, 15);
  }

  // 技能2: 冲撞 — 蓄力后朝玩家方向高速冲刺
  skillCharge(game){
    this.skillName = '冲撞突击';
    this.skillNameTimer = 2000;
    this.isCharging = true;
    this.chargeTimer = 1600; // 0.8s蓄力 + 0.8s冲刺
    const ang = Math.atan2(game.player.cy - this.cy, game.player.cx - this.cx);
    this.chargeDir = [Math.cos(ang), Math.sin(ang)];
    game.spawnSparks(this.cx, this.cy, '#fbbf24', 12);
  }

  // 技能3: 召唤援军 — 在身边生成2~3个普通敌人
  skillSummon(game){
    this.skillName = '召唤援军';
    this.skillNameTimer = 1500;
    const count = this.phase === 2 ? 3 : 2;
    for (let i=0;i<count;i++){
      const ang = (i/count)*Math.PI*2;
      const sx = this.cx + Math.cos(ang)*TILE*1.5;
      const sy = this.cy + Math.sin(ang)*TILE*1.5;
      const col = Util.clamp(Util.toCell(sx), 1, COLS-2);
      const row = Util.clamp(Util.toCell(sy), 1, ROWS-2);
      // 避免在墙里生成
      if (game.grid[row][col].type === T.EMPTY || game.grid[row][col].type === T.GRASS){
        const def = Util.pick(ENEMY_TYPES.filter(e=>e.type==='normal'||e.type==='fast'));
        const e = new EnemyTank(col, row, def, game.level||1);
        e.spawnFlash = 30;
        game.enemies.push(e);
        game.spawnSparks(col*TILE+TILE/2, row*TILE+TILE/2, '#a78bfa', 10);
      }
    }
    game.shake = Math.max(game.shake, 8);
  }

  // 技能4: 追踪弹群 — 发射4~6发追踪弹(仅阶段2)
  skillHomingSwarm(game){
    this.skillName = '追踪导弹群';
    this.skillNameTimer = 1500;
    const count = 6;
    const w = { dmg:20, speed:2.5, color:'#fb923c', pierce:false, splash:0, type:'homing' };
    for (let i=0;i<count;i++){
      const ang = (i/count)*Math.PI*2;
      const b = new Bullet(this.cx, this.cy, 0, w, 'enemy', Math.cos(ang)*w.speed, Math.sin(ang)*w.speed);
      b.target = game.player;
      game.bullets.push(b);
    }
    game.spawnSparks(this.cx, this.cy, '#fb923c', 15);
  }

  fire(game){
    const baseAng = this.turretAngle;  // 沿炮管朝向(指向玩家)扇形发射
    const count = this.phase === 2 ? 5 : (this.phase === 1 ? 3 : 1);
    const w = { dmg:22, speed:3.2, color:'#ef4444', pierce:false, splash:0, type:'normal' };
    for (let i=0;i<count;i++){
      const ang = baseAng + (i - (count-1)/2) * 0.22;
      const vx = Math.cos(ang)*w.speed, vy = Math.sin(ang)*w.speed;
      const mz = { x: this.cx + Math.cos(baseAng)*this.w/2, y: this.cy + Math.sin(baseAng)*this.h/2 };
      game.bullets.push(new Bullet(mz.x, mz.y, this.dir, w, 'enemy', vx, vy));
    }
    // 阶段1+:发射追踪弹
    if (this.phase >= 1 && game.player){
      const wb = { dmg:25, speed:3.0, color:'#fb923c', pierce:false, splash:0, type:'homing' };
      const mz = { x: this.cx + Math.cos(baseAng)*this.w/2, y: this.cy + Math.sin(baseAng)*this.h/2 };
      const b = new Bullet(mz.x, mz.y, this.dir, wb, 'enemy', Math.cos(baseAng)*wb.speed, Math.sin(baseAng)*wb.speed);
      b.target = game.player;
      game.bullets.push(b);
    }
    // 阶段2:额外发射溅射炮弹(打地面爆炸)
    if (this.phase === 2){
      const ws = { dmg:28, speed:2.8, color:'#dc2626', pierce:false, splash:50, type:'missile' };
      const mz = { x: this.cx + Math.cos(baseAng)*this.w/2, y: this.cy + Math.sin(baseAng)*this.h/2 };
      const ang2 = baseAng + (Math.random()-0.5)*0.3;
      game.bullets.push(new Bullet(mz.x, mz.y, this.dir, ws, 'enemy', Math.cos(ang2)*ws.speed, Math.sin(ang2)*ws.speed));
    }
  }

  render(ctx){
    if (this.dead) return;
    ctx.save();
    ctx.translate(this.cx, this.cy);
    if (this.spawnFlash > 0 && Math.floor(this.spawnFlash/4)%2){ ctx.globalAlpha = 0.4; }
    const img = Assets.get('boss_tank');
    const s = this.w;
    if (img){
      // 有贴图:沿用原逻辑
      ctx.fillStyle = '#1f2937'; ctx.fillRect(-s/2,-s/2,s,s);
      ctx.fillStyle = '#ef4444'; ctx.fillRect(-s/2,-s/2,s,s*0.2);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(-s/2,-s/2,s*0.12,s);
      ctx.fillRect(s*0.38,-s/2,s*0.12,s);
      ctx.drawImage(img, -s/2, -s/2, s, s);
    } else {
      // —— 程序化绘制:暗红重型BOSS,金属装甲+能量核心+多炮管 ——
      const phaseColor = this.phase===2 ? '#ef4444' : (this.phase===1 ? '#f59e0b' : '#dc2626');
      // 1) 车身主体:深色金属渐变
      const bodyGrad = ctx.createLinearGradient(0, -s/2, 0, s/2);
      bodyGrad.addColorStop(0, '#374151');
      bodyGrad.addColorStop(0.5, '#1f2937');
      bodyGrad.addColorStop(1, '#111827');
      ctx.fillStyle = bodyGrad;
      ctx.fillRect(-s/2, -s/2, s, s);
      // 2) 顶部红色装甲条(BOSS标识色)
      const topGrad = ctx.createLinearGradient(0, -s/2, 0, -s/2+s*0.2);
      topGrad.addColorStop(0, phaseColor);
      topGrad.addColorStop(1, '#7f1d1d');
      ctx.fillStyle = topGrad;
      ctx.fillRect(-s/2, -s/2, s, s*0.2);
      // 3) 履带(两侧加宽)
      const trackW = s*0.12;
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(-s/2, -s/2, trackW, s);
      ctx.fillRect(s/2-trackW, -s/2, trackW, s);
      // 履带齿纹
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      for (let i=0; i<8; i++){
        const ty = -s/2 + i*(s/8);
        ctx.fillRect(-s/2+1, ty, trackW-2, 2);
        ctx.fillRect(s/2-trackW+1, ty, trackW-2, 2);
      }
      // 4) 装甲板:中央带高光/阴影边
      const plateX = -s/2+trackW+2, plateW = s-2*trackW-4;
      const plateGrad = ctx.createLinearGradient(0, -s/2, 0, s/2);
      plateGrad.addColorStop(0, '#4b5563');
      plateGrad.addColorStop(1, '#1f2937');
      ctx.fillStyle = plateGrad;
      ctx.fillRect(plateX, -s/2+s*0.2+2, plateW, s-s*0.2-4);
      // 装甲板铆钉
      ctx.fillStyle = '#1f2937';
      const rivets = [[plateX+6,-s/2+s*0.3],[plateX+plateW-6,-s/2+s*0.3],
                      [plateX+6,s/2-8],[plateX+plateW-6,s/2-8]];
      rivets.forEach(([rx,ry])=>{
        ctx.beginPath(); ctx.arc(rx, ry, 2.5, 0, Math.PI*2); ctx.fill();
      });
      // 5) 中央能量核心(随phase变色,呼吸闪烁)
      const coreT = Date.now()/300;
      const coreR = s*0.16 + Math.sin(coreT)*2;
      const coreGrad = ctx.createRadialGradient(0, s*0.05, 1, 0, s*0.05, coreR);
      coreGrad.addColorStop(0, '#ffffff');
      coreGrad.addColorStop(0.4, phaseColor);
      coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = coreGrad;
      ctx.shadowColor = phaseColor; ctx.shadowBlur = 14 + Math.sin(coreT)*4;
      ctx.beginPath(); ctx.arc(0, s*0.05, coreR, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
      // 6) 多炮管(三联装,沿 turretAngle 朝向,跟随玩家独立于车身)
      ctx.save();
      // 已经 translate 到中心, 绘制炮管时单独旋转
      ctx.rotate(this.turretAngle + Math.PI/2);
      const barrelW = 5, barrelH = 10;
      [-s*0.18, 0, s*0.18].forEach(bx=>{
        const bGrad = ctx.createLinearGradient(bx-3, 0, bx+3, 0);
        bGrad.addColorStop(0, '#0f172a');
        bGrad.addColorStop(0.5, '#475569');
        bGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = bGrad;
        ctx.fillRect(bx-barrelW/2, s/2-barrelH+2, barrelW, barrelH);
      });
      ctx.restore();
      // 7) 装甲板高光/阴影边
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(plateX, -s/2+s*0.2+2, plateW, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(plateX, s/2-4, plateW, 2);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // 血条(大,多段)
    const bw = this.w, bh = 7;
    const bx = this.cx-bw/2, by = this.y-14;
    ctx.fillStyle='rgba(0,0,0,0.7)'; ctx.fillRect(bx-1,by-1,bw+2,bh+2);
    ctx.fillStyle='#333'; ctx.fillRect(bx,by,bw,bh);
    ctx.fillStyle = this.phase===2?'#ef4444':(this.phase===1?'#f59e0b':'#fbbf24');
    ctx.fillRect(bx,by,bw*(this.hp/this.maxHp),bh);
    // BOSS标签 + 数字血条
    const hpNow = Math.max(0, Math.ceil(this.hp));
    const hpMax = Math.ceil(this.maxHp);
    ctx.fillStyle='#ef4444'; ctx.font='bold 11px Consolas'; ctx.textAlign='left';
    ctx.fillText('BOSS', bx, by-4);
    ctx.fillStyle = this.phase===2?'#fecaca':(this.phase===1?'#fed7aa':'#fde68a');
    ctx.font = 'bold 11px Consolas'; ctx.textAlign='right';
    ctx.strokeStyle='rgba(0,0,0,0.85)'; ctx.lineWidth=3;
    const hpTxt = `${hpNow} / ${hpMax}`;
    ctx.strokeText(hpTxt, bx+bw, by-4);
    ctx.fillText(hpTxt, bx+bw, by-4);
    // —— 技能名显示(释放时弹出,1.5s淡出) ——
    if (this.skillNameTimer > 0 && this.skillName){
      const alpha = Math.min(1, this.skillNameTimer/500);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.phase===2 ? '#ef4444' : '#f59e0b';
      ctx.font = 'bold 14px Consolas';
      ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 8;
      ctx.fillText('▶ '+this.skillName, this.cx, by-20);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  }
}

/* ===================== 十四、粒子(特效) ===================== */


/* ===================== 十二·二、战术支援载具（宠物）系统 ===================== */
/* Pet 基类: 状态机（Follow/Assist/DefendBase/Cast）+ E 技能 前摇-生效-后摇 + 10 级成长 */
class Pet {
  constructor(def, game){
    this.def = def;                            // PET_DEFS 中的定义
    this.game = game;                          // 保存 Game 实例（moveTo/shootAt 需要地形 grid）
    this.pid = def.id;
    this.player = game.player;                 // 主人（玩家坦克）
    this.state = PET_STATE.FOLLOW;
    this.prevPlayerAlive = !!game.player && !game.player.dead;
    this.cx = game.player ? game.player.cx - 40 : (9*TILE+TILE);
    this.cy = game.player ? game.player.cy - 40 : (18*TILE+TILE);
    this.x = this.cx; this.y = this.cy;
    this.w = TILE*0.62; this.h = TILE*0.62;
    this.turretAngle = 0;
    this.bodyAngle = 0;
    this.fireTimer = 0;
    this.bulletsHit = new Set();
    // 成长 等级/经验
    this.level = 1;                            // Lv1 ~ Lv10
    this.exp = 0;
    this.expToNext = PET_LEVEL_EXP_THRESHOLD(this.level);
    this.totalSpentExp = 0;
    this._levelUpFlashTimer = 0;               // 升级视觉闪光
    // E 技能 (前摇-生效-后摇 三段判定)
    this.skillCd = 0;
    this.skillStage = PET_SKILL_STAGE.IDLE;
    this.skillStageTimer = 0;
    this.rageActive = false; this.rageTimer = 0;  // 狂战士专用狂暴状态
    this.tauntActive = false; this.tauntTimer = 0; // 护卫轻坦专用
    this.marks = new Map();                    // 无人机标记: enemy -> expireAt
    this.cooldownAcc = 0;
    this.animTick = 0;
    // 主动巡逻/索敌相关(避免傻呆呆站桩)
    this.patrolPhase = Math.random() * Math.PI * 2;  // 巡逻相位(每只宠物错开)
    this.scanAngle = 0;                              // 无目标时炮塔扫描角度
    this.idleScanDir = 1;                            // 扫描方向
    // HP 按基础 × Lv1
    this.maxHp = def.base.hp * (PET_LEVEL_GROWTH[this.level-1]?.hp || 1);
    this.hp = this.maxHp;
    this.dead = false;
    // 死亡时宠物复活：玩家复活时宠物 50% HP 复活
  }
  get growth(){ return PET_LEVEL_GROWTH[this.level-1] || PET_LEVEL_GROWTH[9]; }
  get hpNow(){ return Math.max(0, this.hp); }
  get hpPct(){ return Math.max(0, Math.min(1, this.hp/Math.max(1,this.maxHp))); }
  get attackRange(){ return this.def.base.range; }
  rect(){ return { x:this.cx - this.w/2, y:this.cy - this.h/2, w:this.w, h:this.h }; }

  /* ===== 宠物经验 ===== */
  addExp(amount, game){
    if (this.level >= 10) return;
    this.exp += amount;
    this.totalSpentExp += amount;
    while (this.exp >= this.expToNext && this.level < 10){
      this.exp -= this.expToNext;
      this.level++;
      this.expToNext = PET_LEVEL_EXP_THRESHOLD(this.level);
      // 升级：按新倍率重置 hp 上限（保留现有 HP 比例）+ 视觉特效
      const prevRatio = this.hp / Math.max(1, this.maxHp);
      const newMax = this.def.base.hp * (this.growth.hp || 1);
      this.maxHp = newMax;
      this.hp = Math.min(this.maxHp, Math.max(this.maxHp * Math.max(prevRatio, 0.4)));
      this._levelUpFlashTimer = 1200;     // 1.2s 金光
      game.flashMsg(`${this.def.icon}${this.def.name} 升级到 Lv${this.level}！(本局有效)`);
      game.shake = Math.max(game.shake, 8);
      // 注意: 局内经验升级不写入存档,只对当前局生效
      // 商店升级(upgradePet)才永久保留,新一局以商店等级为开局等级
      // 升级粒子爆炸
      for (let i=0;i<36;i++){
        const ang = (i/36)*Math.PI*2;
        const spd = 2.2 + Math.random()*3.4;
        game.particles.push(new Particle(this.cx, this.cy, Math.cos(ang)*spd, Math.sin(ang)*spd, ['#fde68a','#fbbf24','#fff'][i%3], 60+Math.random()*40, 3+Math.random()*2));
      }
    }
  }

  /* ===== E 技能：三段判定 ===== */
  tryCastSkill(game){
    if (this.dead) return false;
    if (this.skillCd > 0){ game.flashMsg('宠物技能冷却中 '+(this.skillCd/1000).toFixed(1)+'s'); return false; }
    if (this.skillStage !== PET_SKILL_STAGE.IDLE){ return false; }
    this.skillStage = PET_SKILL_STAGE.WINDUP;
    this.skillStageTimer = 300;
    return true;
  }
  tickSkillStage(dt, game){
    if (this.skillStage === PET_SKILL_STAGE.IDLE) return;
    this.skillStageTimer -= dt;
    if (this.skillStage === PET_SKILL_STAGE.WINDUP && this.skillStageTimer <= 0){
      // 前摇结束 → 真正生效
      this._doSkillEffect(game);
      this.skillStage = PET_SKILL_STAGE.BACK;
      this.skillStageTimer = 200;
      this.skillCd = this.def.skill.cd * (this.growth.cd || 1);
    } else if (this.skillStage === PET_SKILL_STAGE.BACK && this.skillStageTimer <= 0){
      this.skillStage = PET_SKILL_STAGE.IDLE;
    }
  }
  _doSkillEffect(game){
    const s = this.def.skill;
    const dmgMul = this.growth.dmg || 1;
    // ① 扫描脉冲（无人机）
    if (s.id === 'scan_pulse'){
      const enemies = [...game.enemies];
      if (game.boss && !game.boss.dead) enemies.push(game.boss);
      const expireAt = Date.now() + (s.markDur);
      for (const e of enemies) if (e && !e.dead) this.marks.set(e, expireAt);
      // 扫描脉冲特效（扩散蓝圈）
      game.scanPulses = game.scanPulses || [];
      game.scanPulses.push({ x:game.player?game.player.cx:this.cx, y:game.player?game.player.cy:this.cy, t:Date.now(), dur:900, maxR:900 });
      game.shake = Math.max(game.shake, 4);
      game.flashMsg(this.def.icon+' 扫描脉冲：敌人已标记 +增伤25%');
    }
    // ② 冲撞冲锋（突击吉普）
    else if (s.id === 'ram_charge'){
      const aimAng = game.player && !game.player.dead ? game.player.turretAngle : this.bodyAngle;
      game.rams = game.rams || [];
      game.rams.push({ pid:this.pid, x:this.cx, y:this.cy, t:Date.now(), dur:500, ang:aimAng,
        dist: s.range, ramDmg: (s.ramDmg * dmgMul), shockRange: s.shockRange, stun: s.stun });
      // 实际应用伤害在 Game.update rams tick 中
      game.shake = Math.max(game.shake, 12);
      game.screenFlash = Math.max(game.screenFlash, 0.25);
    }
    // ③ 嘲讽力场（护卫轻坦）
    else if (s.id === 'taunt_field'){
      this.tauntActive = true; this.tauntTimer = s.dur;
      game.tauntFields = game.tauntFields || [];
      game.tauntFields.push({ x:this.cx, y:this.cy, r:s.range, t:Date.now(), dur:s.dur, pet:this, defReduce:s.defReduce, endBlast:s.endBlast*dmgMul });
      game.shake = Math.max(game.shake, 6);
    }
    // ④ 全屏齐射（自行火炮）
    else if (s.id === 'barrage'){
      const lvlBoost = Math.floor((this.level-1)/2);  // 每2级多发2颗
      const count = s.shells + lvlBoost*2;
      const enemies = [...game.enemies, game.boss].filter(e=>e && !e.dead);
      const hotspots = enemies.length>0 ? enemies.map(e=>({x:e.cx,y:e.cy})) : [{x:this.cx, y:this.cy}];
      game.barrages = game.barrages || [];
      const now = Date.now();
      for (let i=0;i<count;i++){
        const target = Util.pick(hotspots);
        const r = 40 + Math.random()*80;
        const ang = Math.random()*Math.PI*2;
        game.barrages.push({
          x: target.x + Math.cos(ang)*r,
          y: target.y + Math.sin(ang)*r,
          dropAt: now + s.fallWarn,
          born: now,
          dur: s.fallWarn + 300,
          dmg: s.shellDmg * dmgMul,
          splash: s.splash * (dmgMul**0.7)
        });
      }
      game.flashMsg('💣 炮击覆盖来袭！1.5秒后落弹');
    }
    // ⑤ EMP 策反（电磁干扰车）
    else if (s.id === 'emp_storm'){
      const R = s.range;
      const lvlConvBoost = Math.min(0.25, (this.level-1)*0.02);  // 每级 +2% 策反，上限 +25%
      const convRate = Math.min(0.85, s.convertRate + lvlConvBoost);
      game.empPulses = game.empPulses || [];
      game.empPulses.push({ x:this.cx, y:this.cy, r:R, t:Date.now(), dur:520, stun:s.stun, convRate, convDur:s.convertDur, dmgMul });
      // 眩晕 + 策反
      const candidates = [...game.enemies];
      if (game.boss && !game.boss.dead && Math.hypot(game.boss.cx-this.cx, game.boss.cy-this.cy) < R) candidates.push(game.boss);
      for (const e of candidates){
        if (!e || e.dead) continue;
        const d = Math.hypot(e.cx-this.cx, e.cy-this.cy);
        if (d <= R){
          e.freezeTimer = (e.freezeTimer||0) + s.stun;   // 复用 freezeTimer 当作眩晕
          if (Util.chance(convRate) && e !== game.boss){
            e._converted = true;
            e._convertUntil = Date.now() + s.convertDur;
            // 叛变的敌人：owner 临时变 player，射击其它敌人（通过 hack 在敌人 update 里分支）
          }
        }
      }
      game.shake = Math.max(game.shake, 8);
      game.screenFlash = Math.max(game.screenFlash, 0.2);
    }
    // ⑥ 全息诱饵（幽灵）
    else if (s.id === 'hologram'){
      const decoyCount = s.decoys + (this.level >= 5 ? 1 : 0) + (this.level >= 9 ? 2 : 0);
      game.decoys = game.decoys || [];
      for (let i=0;i<decoyCount;i++){
        const ang = (i/decoyCount)*Math.PI*2;
        const r = 70;
        game.decoys.push({
          x: this.cx + Math.cos(ang)*r,
          y: this.cy + Math.sin(ang)*r,
          hp: s.decoyHp * this.growth.hp,
          born: Date.now(),
          dur: 8000 + (this.level-1)*500,
          turretAngle: 0,
          fireTimer: 0,
          deathEmp: s.decoyDeathEmp
        });
      }
      // 真玩家半透明隐形 + 移速加成 2.5s
      if (game.player && !game.player.dead){
        game.player.ghostSkillBuff = { until: Date.now() + 6000, invis: s.playerInvis, spd: s.playerSpd };
      }
      game.shake = Math.max(game.shake, 5);
    }
    // ⑦ 狂战士毁灭怒吼
    else if (s.id === 'rage_roar'){
      game.berserkerCones = game.berserkerCones || [];
      game.berserkerCones.push({
        x:this.cx, y:this.cy, t:Date.now(), dur:560,
        coneAng: this.bodyAngle,
        coneWidth: s.cone, coneRange: s.coneRange,
        dmg: s.dmg * dmgMul, knockback: s.knockback
      });
      // 锥形伤害立即结算
      const ang0 = this.bodyAngle;
      const halfW = s.cone/2;
      const maxR = s.coneRange;
      const candidates = [...game.enemies];
      if (game.boss && !game.boss.dead) candidates.push(game.boss);
      for (const e of candidates){
        if (!e || e.dead) continue;
        const dx = e.cx-this.cx, dy = e.cy-this.cy;
        const d = Math.hypot(dx, dy);
        if (d > maxR) continue;
        let ang = Math.atan2(dy, dx) - ang0;
        while (ang > Math.PI) ang -= Math.PI*2;
        while (ang < -Math.PI) ang += Math.PI*2;
        if (Math.abs(ang) > halfW) continue;
        e.hurt(s.dmg*dmgMul, game);
        const kbx = dx/Math.max(1,d); const kby = dy/Math.max(1,d);
        e.tryMove?.(kbx*s.knockback, kby*s.knockback, game);
      }
      // 进入狂暴
      this.rageActive = true;
      this.rageTimer = s.rageDur + (this.level-1)*120;
      this.rageInvul = !!s.rageInvul;
      this.rageSpeedMul = s.rageSpeedMul;
      this.rageDmgMul = s.rageDmgMul;
      game.shake = Math.max(game.shake, 18);
      game.screenFlash = Math.max(game.screenFlash, 0.45);
      game.vignette = Math.max(game.vignette, 0.35);
    }
    // ⑧ 布雷工兵车 地雷海
    else if (s.id === 'mine_sea'){
      const mineCount = s.mines + (this.level >= 4 ? 2 : 0) + (this.level >= 8 ? 3 : 0);
      game.petMines = game.petMines || [];
      const R = s.range;
      for (let i=0;i<mineCount;i++){
        const ang = Math.random()*Math.PI*2;
        const r = Math.random()*R;
        const px = this.cx + Math.cos(ang)*r;
        const py = this.cy + Math.sin(ang)*r;
        const clampedX = Util.clamp(px, 20, W-20);
        const clampedY = Util.clamp(py, 20, H-20);
        const isIce = Util.chance(s.iceRate + Math.min(0.2, (this.level-1)*0.02));
        game.petMines.push({
          x: clampedX, y: clampedY, born: Date.now(), life: 99999,
          armed: false, armAt: Date.now()+300,  // 300ms 后才激活(避免刚铺就炸)
          mineDmg: s.mineDmg * dmgMul,
          mineRadius: s.mineRadius,
          isIce, iceDur: s.iceDur
        });
      }
      game.shake = Math.max(game.shake, 5);
    }
  }

  /* ===== 被击中扣血/死亡 ===== */
  hurt(dmg, game){
    if (this.dead) return;
    if (this.rageInvul && this.rageActive) return;  // 狂战士狂暴免伤
    if (this.tauntActive) dmg *= (1 - (this.def.skill.defReduce || 0));  // 嘲讽期间减伤
    this.hp -= dmg;
    game.spawnSparks(this.cx, this.cy, '#ef4444', 4);
    if (this.hp <= 0){
      this.hp = 0;
      this.dead = true;
      game.spawnExplosion(this.cx, this.cy, 36);
      game.shake = Math.max(game.shake, 10);
      // 玩家复活时宠物也复活
    }
  }

  /* ===== 状态切换（第一优先级：玩家存活监测）===== */
  transitState(next, game){
    if (this.state === next) return;
    this.state = next;
    // [v58修复] WINDUP(前摇)期间不中断技能,只有BACK(后摇)可以被打断
    if (this.skillStage !== PET_SKILL_STAGE.WINDUP){
      this.skillStage = PET_SKILL_STAGE.IDLE;
      this.skillStageTimer = 0;
    }
    // [v58修复] 状态切换时清空卡墙日志,避免跨状态误触发
    this._stuckLog = [];
  }

  tickPlayerAliveMonitor(game){
    const playerAlive = game.player && !game.player.dead;
    if (playerAlive !== this.prevPlayerAlive){
      if (!playerAlive) {
        // 玩家刚阵亡 → 立刻进入守家模式（打断所有动作）
        this.transitState(PET_STATE.DEFEND, game);
      } else {
        // 玩家刚复活 → 回到跟随模式；宠物 50% HP 复活
        if (this.dead){ this.dead = false; this.hp = this.maxHp * 0.5; }
        this.transitState(PET_STATE.FOLLOW, game);
      }
      this.prevPlayerAlive = playerAlive;
    }
  }

  /* ===== 主循环 tick ===== */
  update(dt, game){
    if (this.dead) return;
    this.animTick++;
    if (this._levelUpFlashTimer > 0) this._levelUpFlashTimer -= dt;
    if (this.skillCd > 0) this.skillCd = Math.max(0, this.skillCd - dt);
    this.tickPlayerAliveMonitor(game);
    this.tickSkillStage(dt, game);
    // 狂暴计时
    if (this.rageActive){
      this.rageTimer -= dt;
      if (this.rageTimer <= 0){ this.rageActive = false; }
    }
    if (this.tauntActive){
      this.tauntTimer -= dt;
      if (this.tauntTimer <= 0){ this.tauntActive = false; }
    }
    // 无人机标记过期清理
    if (this.marks.size > 0){
      const now = Date.now();
      for (const [enemy, ttl] of this.marks) if (now > ttl || enemy.dead) this.marks.delete(enemy);
    }
    if (this.fireTimer > 0) this.fireTimer -= dt;

    // 嘲讽/EMP 叛变敌人: 强制让所有范围内敌人朝自己开火方向偏向 (在 Enemy.update 外额外 hack 一下 turretAngle)
    if (this.tauntActive){
      const R = this.def.skill.range;
      const enemies = [...game.enemies];
      if (game.boss && !game.boss.dead) enemies.push(game.boss);
      for (const e of enemies){
        if (!e || e.dead) continue;
        const d = Math.hypot(e.cx-this.cx, e.cy-this.cy);
        if (d < R){
          // 强制 turret 朝自己 + move direction 朝自己
          const to = Math.atan2(this.cy - e.cy, this.cx - e.cx);
          e.turretAngle = to;
          const adx = Math.cos(to), ady = Math.sin(to);
          if (Math.abs(adx) > Math.abs(ady)) e.dir = adx>0 ? 1 : 3;
          else e.dir = ady>0 ? 2 : 0;
        }
      }
    }

    // —— 根据状态走具体 AI（每种宠物 override 具体行为）——
    switch(this.state){
      case PET_STATE.FOLLOW:    this.behaviourFollow(dt, game); break;
      case PET_STATE.ASSIST:    this.behaviourAssist(dt, game); break;
      case PET_STATE.DEFEND:    this.behaviourDefend(dt, game); break;
    }

    // —— FOLLOW 状态统一后处理: 炮塔扫描(让宠物有活力,不傻呆呆) ——
    // [抖动修复 v52] 悬浮不碰物理 cx/cy,全部统一在 Pet.render 中按宠物类型做视觉偏移
    // [v58修复] x/y 同步移到所有状态(不只FOLLOW),确保碰撞盒正确
    this.x = this.cx - this.w/2;
    this.y = this.cy - this.h/2;
    if (this.state === PET_STATE.FOLLOW && !this.dead){
      this.patrolPhase += dt * 0.0022;  // 悬浮相位(放慢约20%,更稳)
      // 炮塔左右扫描(跟随玩家朝向 + 扫描偏移)
      this.scanAngle += this.idleScanDir * dt * 0.0014;
      if (this.scanAngle > 0.9){ this.idleScanDir = -1; this.scanAngle = 0.9; }
      else if (this.scanAngle < -0.9){ this.idleScanDir = 1; this.scanAngle = -0.9; }
      const baseScan = (game.player && !game.player.dead) ? game.player.turretAngle : -Math.PI/2;
      this.turretAngle = baseScan + this.scanAngle;
    }
  }

  /* ===== 通用：找最近敌人 ===== */
  findNearestEnemy(game, maxRange = 99999){
    let best = null, bd = maxRange;
    for (const e of game.enemies){
      if (e.dead) continue;
      const d = Math.hypot(e.cx-this.cx, e.cy-this.cy);
      if (d < bd){ bd = d; best = e; }
    }
    if (game.boss && !game.boss.dead){
      const d = Math.hypot(game.boss.cx-this.cx, game.boss.cy-this.cy);
      if (d < bd){ bd = d; best = game.boss; }
    }
    return { enemy: best, dist: bd };
  }

  /* ===== 宠物差异化：哪些地形阻挡移动 =====
     pid: 0=无人机(飞: 只挡钢/基/界), 5=幽灵(穿砖墙)
  */
  tilePassable(tp){
    if (tp===2 || tp===6) return false; // STEEL/BASE 所有人都不能穿
    if (tp===0 || tp===4 || tp===5) return true; // EMPTY/GRASS/ICE 全通
    // 1=BRICK, 3=WATER
    if (this.pid===0) return true; // 无人机: 飞过去
    if (this.pid===5 && tp===1) return true; // 幽灵: 穿墙
    return false; // 其余: 砖/水 挡
  }
  /* 子弹视线(LOS)：所有宠物子弹同等受地形阻挡（BRICK/STEEL/WATER/BASE 都会挡） */
  bulletBlocksTile(tp){ return tp===1||tp===2||tp===3||tp===6; }

  /* ===== DDA 网格视线检测：判断两点间子弹能穿过不 ===== */
  hasLineOfSight(game, fx, fy, tx, ty){
    const g = game.grid; if (!g) return true;
    const dx = tx-fx, dy = ty-fy;
    const dist = Math.hypot(dx, dy);
    if (dist < 2) return true;
    // 每步 1/4 格, 保证不漏小格
    const segLen = TILE*0.25;
    const steps = Math.ceil(dist / segLen);
    const stepX = dx/steps, stepY = dy/steps;
    for (let i=1; i<=steps; i++){
      const x = fx + stepX*i, y = fy + stepY*i;
      const cx = Util.toCell(x), cy = Util.toCell(y);
      if (cx<0||cx>=COLS||cy<0||cy>=ROWS) return false;
      const tp = g[cy][cx].type;
      if (this.bulletBlocksTile(tp)) return false;
    }
    return true;
  }

  /* ===== 找最佳开火位置：可达 + 有 LOS + 距离合适 + 离当前位置近 ===== */
  findBestFiringSpot(game, enemy, idealDist = null){
    if (!enemy) return null;
    idealDist = idealDist != null ? idealDist : this.attackRange * 0.7;
    // 计算该宠物可容忍的砖墙层数 (选位依据, 跟 shootAt 阈值一致)
    const dmg = this.def.base.bulletDmg * (this.growth.dmg || 1);
    const maxBricks = (this.pid===3) ? 2 : (dmg >= 18 ? 3 : 1);
    let best = null;
    // 16 角度 × 5 距离 = 80 候选 (覆盖远近, 便于无人机贴脸找零砖墙位)
    for (let a=0; a<16; a++){
      const ang = a * (Math.PI*2) / 16;
      for (const ratio of [0.5, 0.65, 0.85, 1.0, 1.2]){
        const d = idealDist * ratio;
        const px = enemy.cx + Math.cos(ang)*d;
        const py = enemy.cy + Math.sin(ang)*d;
        if (px < 12 || px > W-12 || py < 12 || py > H-12) continue;
        // 碰撞盒判定可达
        const w=this.w, h=this.h;
        const c0=Util.toCell(px-w/2), c1=Util.toCell(px+w/2-1);
        const r0=Util.toCell(py-h/2), r1=Util.toCell(py+h/2-1);
        let spotOK = true;
        for (let cy=r0; cy<=r1 && spotOK; cy++){
          for (let cx=c0; cx<=c1 && spotOK; cx++){
            if (cx<0||cx>=COLS||cy<0||cy>=ROWS){ spotOK=false; break; }
            const tp = game.grid[cy][cx].type;
            if (!this.tilePassable(tp)) spotOK=false;
          }
        }
        if (!spotOK) continue;
        // LOS 评分: 优先畅通 → 砖墙少 → 否则硬挡淘汰
        const los = this._bulletLOSGrade(game, px, py, enemy.cx, enemy.cy);
        if (los.grade === 'blocked_hard') continue;
        if (los.brickCount > maxBricks) continue; // 砖墙太厚, 不值得走位到这里
        // 评分：砖墙越少 + 离当前近 + 距离理想值偏差小
        const distToMe = Math.hypot(px-this.cx, py-this.cy);
        const distDelta = Math.abs(d - idealDist);
        const brickPenalty = los.brickCount * 240; // 1层砖≈ 240 距离惩罚, 优先找无砖位
        const score = - (distToMe * 0.5 + distDelta + brickPenalty);
        if (!best || score > best.score){
          best = { x:px, y:py, los: los.grade, brickCount: los.brickCount, dist:distToMe, score };
        }
      }
    }
    return best;
  }

  /* ===== 卡墙脱困：8 方向采样一步选位移最大的方向 =====
     [抖动修复 v52] 阈值放宽 + 增加"帧间移动距离均值"判定, 避免跟随态被误判成卡住 */
  tryEscapeStuck(dt){
    if (!this._stuckLog) this._stuckLog = [];
    const now = Date.now();
    const lastPos = this._stuckLog[this._stuckLog.length - 1];
    const frameDist = lastPos ? Math.hypot(this.cx-lastPos.x, this.cy-lastPos.y) : 99;
    // 正常推进本帧>2px → 肯定不卡,清空历史直接返回(大大降低误触发)
    if (frameDist > 2){ this._stuckLog = [{ t:now, x:this.cx, y:this.cy }]; return false; }
    this._stuckLog.push({ t: now, x: this.cx, y: this.cy });
    if (this._stuckLog.length > 20) this._stuckLog.shift();
    const N = this._stuckLog.length;
    if (N >= 16){
      const a = this._stuckLog[0], b = this._stuckLog[N-1];
      const elapsed = b.t - a.t;
      const disp = Math.hypot(b.x-a.x, b.y-a.y);
      // 阈值比原来更严格: ≥700ms 且 <0.22 格位移 (原 450ms/0.35 会大量误触发抖动)
      if (elapsed >= 700 && disp < TILE*0.22){
        // 卡住 → 8 方向采样
        let bestAng = 0, bestOK = false;
        const tryStep = TILE*0.9;
        for (let k=0; k<8; k++){
          const ang = k * Math.PI/4;
          const tx = this.cx + Math.cos(ang)*tryStep;
          const ty = this.cy + Math.sin(ang)*tryStep;
          const w=this.w, h=this.h;
          const c0=Util.toCell(tx-w/2), c1=Util.toCell(tx+w/2-1);
          const r0=Util.toCell(ty-h/2), r1=Util.toCell(ty+h/2-1);
          let ok = true;
          for (let cy=r0; cy<=r1 && ok; cy++){
            for (let cx=c0; cx<=c1 && ok; cx++){
              if (cx<0||cx>=COLS||cy<0||cy>=ROWS){ ok=false; break; }
              const tp = (this.game && this.game.grid && this.game.grid[cy] && this.game.grid[cy][cx]) ? this.game.grid[cy][cx].type : 0;
              if (!this.tilePassable(tp)) ok=false;
            }
          }
          if (ok){ bestOK = true; bestAng = ang; break; }
        }
        if (bestOK){
          const tx = this.cx + Math.cos(bestAng)*tryStep*1.4;
          const ty = this.cy + Math.sin(bestAng)*tryStep*1.4;
          // 脱困一次性走一步,之后清空历史给移动一个缓冲期,避免连续触发抖动
          this.moveTo(tx, ty, dt, 1.5);
          this._stuckLog = [];
          return true;
        }
      }
    }
    return false;
  }

  /* ===== 通用：朝目标点移动 =====
     [抖动修复 v52] 1) d<4px 到达阈值不再移动/不调角度, 避免像素级"原地转身"
                  2) bodyAngle 用 lerp 平滑插值, 不直接赋值, 消除每帧180°抽搐 */
  moveTo(targetX, targetY, dt, mulSpd = 1){
    const dx = targetX - this.cx, dy = targetY - this.cy;
    const d = Math.hypot(dx, dy);
    // 到达阈值:距离<4px 不移动
    if (d < 4){
      return 0;
    }
    let speed = this.def.base.spd * (this.growth.spd || 1) * (TILE*0.06) * mulSpd;
    if (this.rageActive && this.rageSpeedMul) speed *= this.rageSpeedMul;
    const step = Math.min(d, speed * (dt/16.67));
    const nx = this.cx + dx/d * step;
    const ny = this.cy + dy/d * step;
    // 碰撞：使用宠物差异化 tilePassable
    const w=this.w, h=this.h;
    const c0=Util.toCell(nx-w/2), c1=Util.toCell(nx+w/2-1);
    const r0=Util.toCell(ny-h/2), r1=Util.toCell(ny+h/2-1);
    let ok = true;
    for (let cy=r0; cy<=r1 && ok; cy++){
      for (let cx=c0; cx<=c1 && ok; cx++){
        if (cx<0||cx>=COLS||cy<0||cy>=ROWS){ ok=false; break; }
        const tp = (this.game && this.game.grid && this.game.grid[cy] && this.game.grid[cy][cx]) ? this.game.grid[cy][cx].type : 0;
        if (!this.tilePassable(tp)) ok=false;
      }
    }
    if (ok){ this.cx = nx; this.cy = ny; }
    // 车身角度: 平滑插值 0.3, 不再瞬间硬转
    const tgtAng = Math.atan2(dy, dx);
    if (!isFinite(this.bodyAngle)) this.bodyAngle = tgtAng;
    else {
      let delta = tgtAng - this.bodyAngle;
      while (delta >  Math.PI) delta -= Math.PI*2;
      while (delta < -Math.PI) delta += Math.PI*2;
      this.bodyAngle += delta * 0.35;
    }
    return d;
  }

  /* ===== 通用：面向敌人发射一发子弹 ===== */
  shootAt(enemy, game){
    if (!enemy || enemy.dead) return;
    // 防打墙：LOS 检查（对象: {grade, brickCount}）
    const los = this._bulletLOSGrade(game, this.cx, this.cy, enemy.cx, enemy.cy);
    if (los.grade === 'blocked_hard') return; // 钢/水/基: 完全挡住, 不打
    const dmg = this.def.base.bulletDmg * (this.growth.dmg || 1) * (this.rageActive && this.rageDmgMul ? this.rageDmgMul : 1);
    // 砖墙穿透策略: 按伤害决定是否值得打
    //   - 伤害 >= 18 (狂战士/护卫/火炮): 最多容忍 3 层砖墙 (开墙战术)
    //   - 伤害 < 18 (无人机/吉普/工兵): 只容忍 1 层砖墙 (否则打墙纯浪费)
    //   - SPG 溅射 (pid 3): 可以容忍 2 层砖墙 (溅射覆盖敌人)
    if (los.grade === 'brick' && los.brickCount >= 1){
      const maxBricks = (this.pid===3) ? 2 : (dmg >= 18 ? 3 : 1);
      if (los.brickCount > maxBricks) return; // 不值得打, 走位另找
    }
    const ang = Math.atan2(enemy.cy - this.cy, enemy.cx - this.cx);
    this.turretAngle = ang;
    const cd = this.def.base.fireCd * (this.growth.cd || 1) / (this.rageActive && this.rageSpeedMul ? this.rageSpeedMul : 1);
    this.fireTimer = cd;
    // 无人机标记增伤（所有宠物都能受益）
    let extra = 1;
    if (game.pet && game.pet.marks && game.pet.marks.has(enemy)) extra *= (1 + game.pet.def.skill.bonusDmg);
    // SPG / 火炮: 子弹带 40 半径溅射, 可以间接受益
    const isArtillery = (this.pid === 3);
    const w = {
      dmg: dmg*extra,
      speed: this.def.base.bulletSpeed,
      color: this.def.accentColor,
      pierce:false,
      splash: isArtillery ? 42 : 0,
      type:'normal',
      fromPet:true
    };
    const muzzleX = this.cx + Math.cos(ang)*this.w*0.6;
    const muzzleY = this.cy + Math.sin(ang)*this.w*0.6;
    game.bullets.push(new Bullet(muzzleX, muzzleY, 0, w, 'player', Math.cos(ang)*w.speed, Math.sin(ang)*w.speed));
    game.muzzleFlash(muzzleX, muzzleY);
  }
  /* 子弹 LOS 分级:
     return { grade:'ok'|'brick'|'blocked_hard', brickCount:number }
     - ok = 完全畅通
     - brick = 中间有砖墙, 但可打穿 (是否值得打由 shootAt 根据伤害决定)
     - blocked_hard = 钢/水/基 硬挡, 绝对不打
  */
  _bulletLOSGrade(game, fx, fy, tx, ty){
    const g = game.grid; if (!g) return { grade:'ok', brickCount:0 };
    const dx = tx-fx, dy = ty-fy;
    const dist = Math.hypot(dx, dy);
    if (dist < 2) return { grade:'ok', brickCount:0 };
    const steps = Math.ceil(dist / (TILE*0.22));
    const sx = dx/steps, sy = dy/steps;
    let bricks = 0;
    let lastBrickCell = -1;  // [v58修复] 用 tile 索引去重,避免单个砖墙被采样多次
    for (let i=1; i<=steps; i++){
      const x = fx + sx*i, y = fy + sy*i;
      const cx = Util.toCell(x), cy = Util.toCell(y);
      if (cx<0||cx>=COLS||cy<0||cy>=ROWS) return { grade:'blocked_hard', brickCount:bricks };
      const tp = g[cy][cx].type;
      if (tp===2||tp===3||tp===6) return { grade:'blocked_hard', brickCount:bricks }; // STEEL/WATER/BASE
      if (tp===1){
        const cellIdx = cy*COLS+cx;
        if (cellIdx !== lastBrickCell){ bricks++; lastBrickCell = cellIdx; }
      }
    }
    return { grade: bricks>0 ? 'brick' : 'ok', brickCount: bricks };
  }

  /* ===== 保证能打到敌人：先脱困 → 若无 LOS 则跑最佳开火位 → 返回 true=已有LOS可开火 ===== */
  ensureFiringPosition(dt, game, enemy, idealDist = null){
    // 1) 卡墙先脱困
    if (this.tryEscapeStuck(dt)) return false;
    if (!enemy) return false;
    // 2) 当前有硬挡 (钢/水/基) ？
    const los = this._bulletLOSGrade(game, this.cx, this.cy, enemy.cx, enemy.cy);
    if (los.grade === 'ok') return true; // 完全通畅, 直接打
    if (los.grade === 'brick') {
      // 砖墙: 根据伤害判断是否值得打, 不值得的话要走位
      const dmg = this.def.base.bulletDmg * (this.growth.dmg || 1);
      const maxBricks = (this.pid===3) ? 2 : (dmg >= 18 ? 3 : 1);
      if (los.brickCount <= maxBricks) return true; // 打得穿
    }
    // 3) 有硬挡 或 砖墙太厚 → 找最佳开火点, 往那边移动
    const spot = this.findBestFiringSpot(game, enemy, idealDist);
    if (spot){
      this.moveTo(spot.x, spot.y, dt, 1.25);
      return false;
    }
    return false; // 找不到点, 暂时不打
  }

  /* ===== 默认 AI 行为（子类重写）===== */
  behaviourFollow(dt, game){
    // 1) 脱困
    if (this.tryEscapeStuck(dt)) return;
    // 2) 主动索敌(范围远大于攻击范围,避免傻呆呆等敌人贴脸)
    const scanRange = Math.max(this.attackRange * 1.8, TILE * 7);
    const { enemy } = this.findNearestEnemy(game, scanRange);
    if (enemy){ this.transitState(PET_STATE.ASSIST, game); return; }
    // 3) 默认: 跟随玩家车尾 1.5 格
    const target = game.player ? game.player : { cx: 9*TILE+TILE, cy: 18*TILE+TILE, bodyAngle: Math.PI/2 };
    const backAng = (game.player && !game.player.dead) ? (game.player.bodyAngle + Math.PI) : Math.PI/2;
    const dBack = TILE*1.5;
    const tx = target.cx + Math.cos(backAng)*dBack + (this.pid%2===0 ? TILE*0.55 : -TILE*0.55);
    const ty = target.cy + Math.sin(backAng)*dBack;
    this.moveTo(tx, ty, dt, 1.0);
    // 巡逻晃动 + 炮塔扫描统一在 update() 末尾处理
  }
  behaviourAssist(dt, game){
    // 远程宠物：保持射程；近战宠物：贴上去
    const { enemy, dist } = this.findNearestEnemy(game, 99999);
    // 跟随索敌范围同步扩大,带迟滞(避免边缘震荡)
    const scanRange = Math.max(this.attackRange * 1.8, TILE * 7);
    if (!enemy || dist > scanRange * 1.15){ this.transitState(PET_STATE.FOLLOW, game); return; }
    const idealDist = (this.pid === 1 ? 30 : this.pid === 2 ? 60 : this.attackRange*0.7);
    // 如果有硬挡 → 去最佳开火位
    const canFire = this.ensureFiringPosition(dt, game, enemy, idealDist);
    if (!canFire){
      // 仍在走位中: 保持炮管对准, 不开火
      this.turretAngle = Math.atan2(enemy.cy - this.cy, enemy.cx - this.cx);
      return;
    }
    // [抖动修复 v52] 进退迟滞带扩大: 理想距离 ±(50/30), 避免贴脸→后退→贴脸循环
    if (dist > idealDist + 50) {
      this.moveTo(enemy.cx, enemy.cy, dt, 1.1);
    } else if (dist < idealDist - 30) {
      const backAng = Math.atan2(this.cy - enemy.cy, this.cx - enemy.cx);
      // 后退只退到 idealDist 距离点(而不是本帧位置+42px 跳跃),避免摆荡
      const retX = enemy.cx + Math.cos(backAng)*idealDist;
      const retY = enemy.cy + Math.sin(backAng)*idealDist;
      this.moveTo(retX, retY, dt, 0.85);
    }
    this.turretAngle = Math.atan2(enemy.cy - this.cy, enemy.cx - this.cx);
    if (this.fireTimer <= 0 && dist < this.attackRange && this.def.base.dmgMul > 0){
      this.shootAt(enemy, game);
    }
  }
  behaviourDefend(dt, game){
    // 默认：站基地门口前 1 格，面向敌人多的方向开火
    const bx = 9*TILE+TILE, by = 18*TILE;
    const tx = bx, ty = by - TILE*1.1;
    // 先脱困 / 若卡住则不站桩
    if (!this.tryEscapeStuck(dt)) this.moveTo(tx, ty, dt, 1.15);
    // 面向最近敌人或朝北(默认)
    const { enemy, dist } = this.findNearestEnemy(game);
    if (enemy && dist < 99999){
      // 若无硬挡就开炮, 有硬挡则绕基地一圈找开火位
      const canFire = this.ensureFiringPosition(dt, game, enemy, TILE*3.5);
      this.turretAngle = Math.atan2(enemy.cy - this.cy, enemy.cx - this.cx);
      if (canFire && this.fireTimer <= 0 && dist < this.attackRange*1.25 && this.def.base.dmgMul > 0){
        this.shootAt(enemy, game);
      }
    } else {
      this.turretAngle = -Math.PI/2; // 朝上
    }
  }

  /* ===== 宠物渲染（简单几何） ===== */
  render(ctx, game){
    if (this.dead) return;
    const tdef = this.def;
    // [抖动修复 v52] 悬浮统一在渲染层计算并通过 ctx.translate 叠加, 完全不污染 cx/cy 物理坐标
    //   pid 0 无人机: 做明显悬浮; 地面宠物不悬浮
    let hoverOx = 0, hoverOy = 0;
    if (this.pid === 0){
      const ph = this.patrolPhase || 0;
      hoverOx = Math.cos(ph) * 1.4;
      hoverOy = Math.sin(ph * 1.3) * 1.0;
    }
    const cx = this.cx, cy = this.cy;
    ctx.save();
    ctx.translate(hoverOx, hoverOy);
    // 升级金光 flash
    if (this._levelUpFlashTimer > 0){
      const p = Math.min(1, this._levelUpFlashTimer/1200);
      const gr = ctx.createRadialGradient(cx, cy, 2, cx, cy, this.w*2.5);
      gr.addColorStop(0, `rgba(253,224,71,${0.6*p})`);
      gr.addColorStop(1, 'rgba(251,191,36,0)');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(cx, cy, this.w*2.5, 0, Math.PI*2); ctx.fill();
    }
    // 无人机:浮空飞 (无履带)
    if (this.pid === 0) this._renderDrone(ctx, tdef);
    else if (this.pid === 1) this._renderJeep(ctx, tdef);
    else if (this.pid === 2) this._renderGuard(ctx, tdef);
    else if (this.pid === 3) this._renderSPG(ctx, tdef);
    else if (this.pid === 4) this._renderEMV(ctx, tdef);
    else if (this.pid === 5) this._renderGhost(ctx, tdef);
    else if (this.pid === 6) this._renderBerserker(ctx, tdef);
    else this._renderMiner(ctx, tdef);
    // 狂战士狂暴:红色闪电
    if (this.rageActive && this.pid === 6){
      for (let i=0;i<3;i++){
        const ang = Math.random()*Math.PI*2;
        const r1 = this.w*0.35, r2 = this.w*0.85 + Math.random()*this.w*0.4;
        ctx.strokeStyle = `rgba(239,68,68,${0.55+Math.random()*0.45})`;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(cx+Math.cos(ang)*r1, cy+Math.sin(ang)*r1);
        ctx.lineTo(cx+Math.cos(ang+0.4)*r2, cy+Math.sin(ang+0.4)*r2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
    // 玩家阵亡守家模式 → 外框红色脉动
    if (game.player && game.player.dead){
      const t = Date.now()/200;
      ctx.strokeStyle = `rgba(239,68,68,${0.6+0.35*Math.sin(t)})`;
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(cx, cy, this.w*0.75, 0, Math.PI*2); ctx.stroke();
    }
    ctx.restore();
    // 血条（画在最外层不受 translate 影响）
    this._renderHpBar(ctx, tdef);
  }
  _renderHpBar(ctx, tdef){
    const pct = this.hpPct;
    const bw = this.w, bh = 3;
    const bx = this.cx - bw/2, by = this.cy - this.h/2 - 8;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(bx-1, by-1, bw+2, bh+2);
    ctx.fillStyle = '#333';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = pct > 0.5 ? '#22c55e' : (pct > 0.25 ? '#fbbf24' : '#ef4444');
    ctx.fillRect(bx, by, bw*pct, bh);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px Consolas'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // 左侧 Lv 标签 + 右侧 HP 数字
    ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 2.5;
    const lvTxt = `Lv${this.level}`;
    const hpTxt = `${Math.max(0,Math.ceil(this.hp))}/${Math.ceil(this.maxHp)}`;
    ctx.textAlign = 'left';
    ctx.strokeText(lvTxt, bx, by - 7);
    ctx.fillText(lvTxt, bx, by - 7);
    ctx.textAlign = 'right';
    ctx.strokeText(hpTxt, bx + bw, by - 7);
    ctx.fillText(hpTxt, bx + bw, by - 7);
  }
  /* 每种宠物具体外观 render（详见下一个大 patch 里的 8 个子 render 方法）*/
  _renderDrone(ctx, t){ PetArt.renderDrone(ctx, this, t); }
  _renderJeep(ctx, t){  PetArt.renderJeep(ctx, this, t); }
  _renderGuard(ctx, t){ PetArt.renderGuard(ctx, this, t); }
  _renderSPG(ctx, t){   PetArt.renderSPG(ctx, this, t); }
  _renderEMV(ctx, t){   PetArt.renderEMV(ctx, this, t); }
  _renderGhost(ctx, t){ PetArt.renderGhost(ctx, this, t); }
  _renderBerserker(ctx, t){ PetArt.renderBerserker(ctx, this, t); }
  _renderMiner(ctx, t){ PetArt.renderMiner(ctx, this, t); }
}

/* Pet artwork renderer (separated for readability) */
const PetArt = {
  _lvPattern(level){ return level>=7 ? 'elite' : (level>=4 ? 'tier2' : 'basic'); },
  _bodyGlowStroke(ctx, accent, level){
    if (level >= 7){
      ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2;
    } else if (level >= 4){
      ctx.strokeStyle = accent; ctx.lineWidth = 1.8;
    }
  },
  renderDrone(ctx, pet, t){
    const w = pet.w, h = pet.h, cx = pet.cx, cy = pet.cy;
    const ang = pet.turretAngle;
    ctx.save();
    ctx.translate(cx, cy);
    // 阴影：无人机飞得高，所以影子淡大一点
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(3, 6, w*0.45, w*0.18, 0, 0, Math.PI*2); ctx.fill();
    ctx.rotate((Date.now()/380) % (Math.PI*2)); // 整个机身缓慢转
    // 四轴支架
    ctx.strokeStyle = t.accentColor; ctx.lineWidth = 2;
    for (let i=0;i<4;i++){
      ctx.rotate(Math.PI/2);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w*0.42, 0); ctx.stroke();
      // 轴端 + 旋转螺旋桨
      const t2 = Date.now()/12 + i;
      ctx.save();
      ctx.translate(w*0.42, 0);
      ctx.fillStyle = i%2 ? '#e0f2fe' : '#bae6fd';
      ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.ellipse(0, 0, w*0.30, w*0.05 + Math.abs(Math.sin(t2))*0.01, t2, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#1e293b';
      ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    // 机身核心（不旋转）
    ctx.save();
    ctx.translate(cx, cy);
    const pat = PetArt._lvPattern(pet.level);
    const coreCol = (pat === 'elite') ? '#fbbf24' : (pat === 'tier2' ? '#0ea5e9' : t.tierColor);
    const core = ctx.createRadialGradient(0,0,1, 0,0,w*0.25);
    core.addColorStop(0, '#fff');
    core.addColorStop(0.4, coreCol);
    core.addColorStop(1, t.accentColor);
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(0, 0, w*0.22, 0, Math.PI*2); ctx.fill();
    // 镜头下视
    ctx.fillStyle = '#0f172a';
    ctx.beginPath(); ctx.arc(0, w*0.02, w*0.08, 0, Math.PI*2); ctx.fill();
    // Lv4+:蓝条纹；Lv7+:金/红精英
    if (pet.level >= 4){
      ctx.strokeStyle = pet.level>=7 ? '#fbbf24' : '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0,0,w*0.30, 0, Math.PI*2); ctx.stroke();
    }
    if (pet.level >= 7){
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0,0,w*0.34, 0, Math.PI*2); ctx.stroke();
      // 炮口火焰小光点（顶部）
      ctx.fillStyle = '#fb923c';
      ctx.beginPath(); ctx.arc(w*0.1, -w*0.08, 2, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  },
  renderJeep(ctx, pet, t){
    const w = pet.w, h = pet.h, cx = pet.cx, cy = pet.cy;
    const tAng = pet.bodyAngle;
    ctx.save();
    ctx.translate(cx, cy);
    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(3, 4, w*0.55, w*0.25, 0, 0, Math.PI*2); ctx.fill();
    ctx.rotate(tAng);
    // 车身
    const pat = PetArt._lvPattern(pet.level);
    ctx.fillStyle = (pat==='elite') ? '#fbbf24' : t.tierColor;
    this._roundRect(ctx, -w*0.42, -h*0.30, w*0.84, h*0.60, 4);
    ctx.fill();
    // 驾驶舱
    ctx.fillStyle = t.accentColor;
    this._roundRect(ctx, -w*0.12, -h*0.22, w*0.36, h*0.44, 3);
    ctx.fill();
    // 四个轮子
    ctx.fillStyle = '#111827';
    [[-w*0.32,-h*0.36],[w*0.1,-h*0.36],[-w*0.32,h*0.36-2],[w*0.1,h*0.36-2]].forEach(p=>{
      ctx.fillRect(p[0], p[1], w*0.22, h*0.12);
    });
    // 车顶天线 + 晃动（正弦）
    const sway = Math.sin(Date.now()/240) * 0.35;
    ctx.strokeStyle = pet.level>=7 ? '#ef4444' : '#334155';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-w*0.08, -h*0.22);
    ctx.lineTo(-w*0.08 + sway*4, -h*0.22 - h*0.38);
    ctx.stroke();
    ctx.fillStyle = pet.level>=7 ? '#fca5a5' : '#e11d48';
    ctx.beginPath(); ctx.arc(-w*0.08 + sway*4, -h*0.22 - h*0.38, 2, 0, Math.PI*2); ctx.fill();
    // 车顶重机枪（朝 turretAngle），需要反向 rotate bodyAng 再朝 turret
    ctx.rotate(-tAng);
    ctx.rotate(pet.turretAngle);
    ctx.fillStyle = pet.level>=7 ? '#991b1b' : '#111827';
    ctx.fillRect(w*0.18, -1.6, w*0.32, 3.2);
    ctx.fillStyle = '#1f2937';
    ctx.beginPath(); ctx.arc(w*0.18, 0, 4, 0, Math.PI*2); ctx.fill();
    // Lv7+ 枪口焰
    if (pet.level >= 7){
      ctx.fillStyle = '#fb923c';
      ctx.beginPath(); ctx.arc(w*0.50, 0, 2.6, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  },
  renderGuard(ctx, pet, t){
    const w = pet.w, h = pet.h;
    ctx.save();
    ctx.translate(pet.cx, pet.cy);
    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath(); ctx.ellipse(2, 3, w*0.55, w*0.26, 0, 0, Math.PI*2); ctx.fill();
    ctx.rotate(pet.bodyAngle);
    const pat = PetArt._lvPattern(pet.level);
    // 履带
    ctx.fillStyle = '#111827';
    ctx.fillRect(-w*0.5, -h*0.44, w*0.12, h*0.88);
    ctx.fillRect(w*0.38, -h*0.44, w*0.12, h*0.88);
    // 车身
    ctx.fillStyle = (pat==='elite') ? '#f59e0b' : t.tierColor;
    this._roundRect(ctx, -w*0.38, -h*0.34, w*0.76, h*0.68, 3);
    ctx.fill();
    // 盾状护板
    ctx.fillStyle = t.accentColor;
    ctx.fillRect(-w*0.40, -h*0.25, w*0.04, h*0.50);
    ctx.fillRect(w*0.36, -h*0.25, w*0.04, h*0.50);
    // Lv4+: 蓝色能量条纹（车身中央竖条）
    if (pet.level >= 4){
      ctx.strokeStyle = pet.level>=7 ? '#fde68a' : '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -h*0.30); ctx.lineTo(0, h*0.30); ctx.stroke();
    }
    // 炮塔 + 升降炮管
    ctx.rotate(-pet.bodyAngle);
    ctx.rotate(pet.turretAngle);
    const lift = pet.fireTimer > (t.base.fireCd*0.66) ? -2 : (pet.fireTimer < (t.base.fireCd*0.33) ? 1.5 : 0);
    ctx.save();
    ctx.translate(0, lift);
    ctx.fillStyle = pet.level>=7 ? '#b45309' : '#334155';
    ctx.beginPath(); ctx.arc(0, 0, w*0.18, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = (pat==='elite') ? '#dc2626' : '#111827';
    ctx.fillRect(w*0.16, -2.2, w*0.34, 4.4);
    if (pet.level >= 7){
      ctx.fillStyle = '#fb923c';
      ctx.beginPath(); ctx.arc(w*0.50, 0, 3, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
    ctx.restore();
  },
  renderSPG(ctx, pet, t){
    const w = pet.w, h = pet.h;
    ctx.save();
    ctx.translate(pet.cx, pet.cy);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(3, 4, w*0.56, w*0.27, 0, 0, Math.PI*2); ctx.fill();
    ctx.rotate(pet.bodyAngle);
    const pat = PetArt._lvPattern(pet.level);
    // 履带
    ctx.fillStyle = '#111827';
    ctx.fillRect(-w*0.5, -h*0.42, w*0.12, h*0.84);
    ctx.fillRect(w*0.38, -h*0.42, w*0.12, h*0.84);
    // 车身
    ctx.fillStyle = (pat==='elite') ? '#fde047' : t.tierColor;
    this._roundRect(ctx, -w*0.40, -h*0.30, w*0.80, h*0.60, 3);
    ctx.fill();
    // 弹药箱（后）
    ctx.fillStyle = t.accentColor;
    this._roundRect(ctx, -w*0.42, -h*0.20, w*0.16, h*0.40, 2);
    ctx.fill();
    // 巨炮管（朝 turretAngle，有开火后座动画）
    ctx.rotate(-pet.bodyAngle);
    ctx.rotate(pet.turretAngle);
    const recoil = pet.fireTimer > (t.base.fireCd*0.55) ? 5 : 0;
    ctx.save(); ctx.translate(-recoil, 0);
    ctx.fillStyle = '#111827';
    ctx.fillRect(-2, -5, w*0.72, 10);
    ctx.fillStyle = (pet.level>=7 ? '#ef4444' : '#374151');
    ctx.fillRect(w*0.62, -6.5, w*0.10, 13);
    // 射前预热火焰(Lv7)
    if (pet.level >= 7){
      const f = 0.4 + 0.6*Math.abs(Math.sin(Date.now()/80));
      const g = ctx.createRadialGradient(w*0.55,0,1, w*0.55,0,10);
      g.addColorStop(0, `rgba(255,255,255,${0.9*f})`);
      g.addColorStop(0.4, `rgba(254,240,138,${0.7*f})`);
      g.addColorStop(1, 'rgba(251,146,60,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(w*0.55, 0, 10, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
    // Lv4+:蓝色弹道纹
    if (pet.level >= 4){
      ctx.rotate(-pet.turretAngle); ctx.rotate(pet.bodyAngle);
      ctx.strokeStyle = pet.level>=7 ? '#fbbf24' : '#60a5fa';
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(-w*0.3, -h*0.22); ctx.lineTo(w*0.3, -h*0.22); ctx.moveTo(-w*0.3, h*0.22); ctx.lineTo(w*0.3, h*0.22); ctx.stroke();
    }
    ctx.restore();
  },
  renderEMV(ctx, pet, t){
    const w = pet.w, h = pet.h;
    ctx.save();
    ctx.translate(pet.cx, pet.cy);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(2, 3, w*0.55, w*0.25, 0, 0, Math.PI*2); ctx.fill();
    ctx.rotate(pet.bodyAngle);
    const pat = PetArt._lvPattern(pet.level);
    ctx.fillStyle = (pat==='elite') ? '#f0abfc' : t.tierColor;
    this._roundRect(ctx, -w*0.42, -h*0.30, w*0.84, h*0.60, 3);
    ctx.fill();
    // 底部轮胎
    ctx.fillStyle = '#111827';
    [[-w*0.30,-h*0.32],[w*0.08,-h*0.32],[-w*0.30,h*0.30],[w*0.08,h*0.30]].forEach(p=>{
      ctx.fillRect(p[0], p[1], w*0.22, h*0.12);
    });
    // 四根天线阵（随机放电）
    ctx.strokeStyle = '#1e293b';
    for (let i=0;i<4;i++){
      const ax = -w*0.3 + i*w*0.2;
      ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(ax, -h*0.28); ctx.lineTo(ax + (i%2===0?-2:2), -h*0.50); ctx.stroke();
      ctx.fillStyle = t.accentColor;
      ctx.beginPath(); ctx.arc(ax + (i%2===0?-2:2), -h*0.50, 1.5, 0, Math.PI*2); ctx.fill();
    }
    // 天线之间偶发电弧
    const now = Date.now();
    if ((now >> 6) % 3 !== 0){
      ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 1;
      ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 6;
      for (let i=0;i<3;i++){
        const a1 = -w*0.3 + i*w*0.2;
        const a2 = a1 + w*0.2;
        ctx.beginPath();
        ctx.moveTo(a1, -h*0.50);
        for (let k=1;k<4;k++){
          const tt = k/4;
          const baseX = a1 + (a2-a1)*tt;
          ctx.lineTo(baseX + Util.rand(-2,2), -h*0.50 + Util.rand(-2,2));
        }
        ctx.lineTo(a2, -h*0.50);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }
    // Lv4+: 蓝色关节发光
    if (pet.level >= 4){
      ctx.strokeStyle = pet.level>=7 ? '#f0abfc' : '#22d3ee';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, w*0.25, 0, Math.PI*2); ctx.stroke();
    }
    // Lv7+: 3 个旋转闪电小球
    if (pet.level >= 7){
      ctx.rotate(-pet.bodyAngle);
      for (let i=0;i<3;i++){
        const a = (Date.now()/400) + i*Math.PI*2/3;
        const x = Math.cos(a)*w*0.5, y = Math.sin(a)*w*0.5;
        ctx.fillStyle = '#22d3ee';
        ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
    ctx.restore();
  },
  renderGhost(ctx, pet, t){
    const w = pet.w, h = pet.h;
    const alpha = 0.55 + 0.15*Math.sin(Date.now()/220);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(pet.cx, pet.cy);
    // 全息网格
    ctx.fillStyle = 'rgba(8,145,178,0.3)';
    ctx.beginPath(); ctx.ellipse(2,3,w*0.55,w*0.25,0,0,Math.PI*2); ctx.fill();
    ctx.rotate(pet.bodyAngle);
    const pat = PetArt._lvPattern(pet.level);
    // 半透明车身
    const body = ctx.createLinearGradient(0,-h/2, 0, h/2);
    body.addColorStop(0, (pat==='elite' ? '#fde68a' : '#67e8f9'));
    body.addColorStop(1, t.accentColor);
    ctx.fillStyle = body;
    this._roundRect(ctx, -w*0.44, -h*0.32, w*0.88, h*0.64, 4);
    ctx.fill();
    // 全息投影镜头
    ctx.rotate(-pet.bodyAngle);
    ctx.fillStyle = '#0e7490';
    ctx.beginPath(); ctx.arc(0, -h*0.08, w*0.16, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 1.2;
    // 旋转发光圈
    for (let i=0;i<6;i++){
      const a = (Date.now()/600) + i*Math.PI/3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a)*w*0.16, -h*0.08 + Math.sin(a)*w*0.16);
      ctx.lineTo(Math.cos(a)*w*0.24, -h*0.08 + Math.sin(a)*w*0.24);
      ctx.stroke();
    }
    // Lv4+ 边缘描边
    if (pet.level >= 4){
      ctx.strokeStyle = pet.level>=7 ? '#c4b5fd' : '#38bdf8';
      ctx.lineWidth = 1.8;
      ctx.strokeRect(-w*0.44, -h*0.32, w*0.88, h*0.64);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  },
  renderBerserker(ctx, pet, t){
    const w = pet.w, h = pet.h;
    ctx.save();
    ctx.translate(pet.cx, pet.cy);
    // 震动（炮管前后抖 ~每秒 ±2px）
    const shake = Math.sin(Date.now()/140) * 2;
    ctx.translate(shake, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(3, 4, w*0.56, w*0.27, 0, 0, Math.PI*2); ctx.fill();
    ctx.rotate(pet.bodyAngle);
    const pat = PetArt._lvPattern(pet.level);
    // 履带
    ctx.fillStyle = '#111827';
    ctx.fillRect(-w*0.5, -h*0.44, w*0.12, h*0.88);
    ctx.fillRect(w*0.38, -h*0.44, w*0.12, h*0.88);
    // 车身 + 铆钉
    ctx.fillStyle = (pat==='elite') ? '#dc2626' : t.tierColor;
    this._roundRect(ctx, -w*0.40, -h*0.34, w*0.80, h*0.68, 3);
    ctx.fill();
    ctx.fillStyle = '#a8a29e';
    for (let i=0;i<5;i++){
      ctx.beginPath(); ctx.arc(-w*0.30 + i*w*0.18, -h*0.25, 1.2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(-w*0.30 + i*w*0.18, h*0.25, 1.2, 0, Math.PI*2); ctx.fill();
    }
    // 巨炮管 + 永远冒火焰
    ctx.rotate(-pet.bodyAngle);
    ctx.rotate(pet.turretAngle);
    ctx.fillStyle = '#111827';
    ctx.fillRect(w*0.05, -4, w*0.52, 8);
    ctx.fillStyle = pet.level>=7 ? '#fbbf24' : '#57534e';
    ctx.fillRect(w*0.52, -5.5, w*0.08, 11);
    // 持续冒火
    {
      const f = 0.7 + 0.3*Math.sin(Date.now()/60);
      const g = ctx.createRadialGradient(w*0.55,0,1, w*0.55,0,9);
      g.addColorStop(0, `rgba(255,255,255,${0.9*f})`);
      g.addColorStop(0.4, `rgba(254,240,138,${0.75*f})`);
      g.addColorStop(1, 'rgba(239,68,68,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(w*0.55, 0, 9, 0, Math.PI*2); ctx.fill();
    }
    // Lv4+: 蓝色能量管(炮管两侧)
    if (pet.level >= 4){
      const tubeCol = pet.level>=7 ? '#fbbf24' : '#3b82f6';
      ctx.fillStyle = tubeCol;
      ctx.fillRect(w*0.08, -6.5, w*0.42, 1.8);
      ctx.fillRect(w*0.08, 4.7, w*0.42, 1.8);
    }
    ctx.restore();
  },
  renderMiner(ctx, pet, t){
    const w = pet.w, h = pet.h;
    ctx.save();
    ctx.translate(pet.cx, pet.cy);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(3,4,w*0.55,w*0.25,0,0,Math.PI*2); ctx.fill();
    ctx.rotate(pet.bodyAngle);
    const pat = PetArt._lvPattern(pet.level);
    // 车轮
    ctx.fillStyle = '#111827';
    [[-w*0.30,-h*0.32],[w*0.08,-h*0.32],[-w*0.30,h*0.30],[w*0.08,h*0.30]].forEach(p=>{
      ctx.fillRect(p[0], p[1], w*0.22, h*0.12);
    });
    // 车身
    ctx.fillStyle = (pat==='elite') ? '#ca8a04' : t.tierColor;
    this._roundRect(ctx, -w*0.42, -h*0.30, w*0.84, h*0.60, 3);
    ctx.fill();
    // 布雷槽（尾部）
    ctx.fillStyle = '#52525b';
    this._roundRect(ctx, -w*0.46, -h*0.20, w*0.10, h*0.40, 2);
    ctx.fill();
    // 机械臂（摆动：每 2 秒一次放雷动作）
    const cycle = (Date.now() % 2000) / 2000;
    const swing = (cycle < 0.5 ? cycle*2 : (1-cycle)*2) * 0.8;
    ctx.rotate(-pet.bodyAngle);
    const armAng = -0.5 + swing;   // 从 -0.5 扫到 0.3
    ctx.save();
    ctx.translate(-w*0.25, h*0.08);
    ctx.rotate(armAng);
    ctx.strokeStyle = pet.level>=7 ? '#fbbf24' : '#a3a3a3';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w*0.3, 0);
    ctx.stroke();
    // 关节（发光）
    ctx.fillStyle = pet.level>=7 ? '#ef4444' : '#22d3ee';
    ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(w*0.3, 0, 2.4, 0, Math.PI*2); ctx.fill();
    // 布雷瞬间金光爆
    if (cycle > 0.48 && cycle < 0.52){
      const g = ctx.createRadialGradient(w*0.3, 0, 1, w*0.3, 0, 9);
      g.addColorStop(0, 'rgba(253,224,71,0.9)');
      g.addColorStop(1, 'rgba(251,191,36,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(w*0.3, 0, 9, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
    // Lv4+:履带蓝条纹
    if (pet.level >= 4){
      ctx.rotate(pet.bodyAngle);
      ctx.strokeStyle = pet.level>=7 ? '#fbbf24' : '#22d3ee';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-w*0.38, -h*0.16); ctx.lineTo(w*0.38, -h*0.16);
      ctx.moveTo(-w*0.38, h*0.16); ctx.lineTo(w*0.38, h*0.16); ctx.stroke();
    }
    ctx.restore();
  },
  _roundRect(ctx, x, y, w, h, r){
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.lineTo(x+w-r, y);
    ctx.quadraticCurveTo(x+w, y, x+w, y+r);
    ctx.lineTo(x+w, y+h-r);
    ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
    ctx.lineTo(x+r, y+h);
    ctx.quadraticCurveTo(x, y+h, x, y+h-r);
    ctx.lineTo(x, y+r);
    ctx.quadraticCurveTo(x, y, x+r, y);
    ctx.closePath();
  }
};

/* 8 个子类：Override behaviourFollow/Assist/Defend 以实现专属 AI */
class PetDrone extends Pet {
  constructor(def,game){ super(def,game); }
  behaviourFollow(dt, game){
    if (this.tryEscapeStuck(dt)) return;
    // 无人机: 飞在玩家头顶 1.3 格上方 (y - 1.3TILE), 飞行无视砖/水
    const pcx = game.player ? game.player.cx : 9*TILE+TILE;
    const pcy = game.player ? game.player.cy - TILE*1.3 : 18*TILE;
    this.moveTo(pcx, pcy, dt, 1.15);
    const scanRange = Math.max(this.attackRange * 1.8, TILE * 7);
    const { enemy } = this.findNearestEnemy(game, scanRange);
    if (enemy) this.transitState(PET_STATE.ASSIST, game);
  }
  behaviourAssist(dt, game){
    const { enemy, dist } = this.findNearestEnemy(game);
    if (!enemy){ this.transitState(PET_STATE.FOLLOW, game); return; }
    // 无人机特性: 高飞绕圈 + 保证 LOS 才开火 (飞越高空 → 更容易获得 LOS)
    const desired = 180;
    // 若无 LOS (被挡), 先移动到最佳开火位. 无人机由于 tilePassable 宽松, 能飞到楼顶位
    const canFire = this.ensureFiringPosition(dt, game, enemy, desired);
    if (!canFire){
      this.turretAngle = Math.atan2(enemy.cy - this.cy, enemy.cx - this.cx);
      return;
    }
    // LOS OK, 保持约 180px 绕飞
    if (dist > desired + 40) this.moveTo(enemy.cx, enemy.cy, dt, 1.15);
    else {
      const orbitAng = Math.atan2(this.cy - enemy.cy, this.cx - enemy.cx) + 0.028 * (dt/16.67);
      this.moveTo(enemy.cx + Math.cos(orbitAng)*desired, enemy.cy + Math.sin(orbitAng)*desired, dt, 1.1);
    }
    this.turretAngle = Math.atan2(enemy.cy - this.cy, enemy.cx - this.cx);
    if (this.fireTimer <= 0) this.shootAt(enemy, game);
  }
  behaviourDefend(dt, game){
    // 高空巡航守家: 基地正上方 1.6 格 绕圈
    const bx = 9*TILE+TILE, by = 18*TILE - TILE*1.6;
    const ang = (Date.now()/600);
    const tx = bx + Math.cos(ang)*TILE*0.7;
    const ty = by + Math.sin(ang)*TILE*0.7;
    if (!this.tryEscapeStuck(dt)) this.moveTo(tx, ty, dt, 1.25);
    const nearby = game.enemies.filter(e=>!e.dead && Math.hypot(e.cx-bx, e.cy-by) < TILE*4).length;
    if (nearby >= 3 && this.skillCd <= 0 && this.skillStage===PET_SKILL_STAGE.IDLE){
      this.skillCd = this.def.skill.cd * (this.growth.cd || 1) * 0.5;
      this._doSkillEffect(game);
    }
    const { enemy } = this.findNearestEnemy(game);
    if (enemy){
      const canFire = this.ensureFiringPosition(dt, game, enemy, TILE*3);
      if (canFire && this.fireTimer <= 0) this.shootAt(enemy, game);
    }
  }
}
class PetJeep extends Pet {
  constructor(def,game){ super(def,game); }
  behaviourFollow(dt, game){ if (this.tryEscapeStuck(dt)) return; super.behaviourFollow(dt, game); }
  behaviourAssist(dt, game){
    // 吉普特性: 近战机枪 + 短兵相接, 必须有路直线冲到敌人面前才打
    const { enemy, dist } = this.findNearestEnemy(game);
    if (!enemy){ this.transitState(PET_STATE.FOLLOW, game); return; }
    const ideal = 90; // 贴身
    const canFire = this.ensureFiringPosition(dt, game, enemy, ideal);
    if (!canFire){
      this.turretAngle = Math.atan2(enemy.cy - this.cy, enemy.cx - this.cx);
      return; // 走位, 不开火
    }
    if (dist > ideal + 30) this.moveTo(enemy.cx, enemy.cy, dt, 1.3);
    else if (dist < ideal - 20){
      const back = Math.atan2(this.cy-enemy.cy, this.cx-enemy.cx);
      this.moveTo(this.cx+Math.cos(back)*44, this.cy+Math.sin(back)*44, dt, 1.05);
    }
    this.turretAngle = Math.atan2(enemy.cy - this.cy, enemy.cx - this.cx);
    if (this.fireTimer <= 0) this.shootAt(enemy, game);
    // 自爆兵/高威胁目标接近 → 自动冲撞, 优先直线不打墙
    if ((enemy.type === 'suicide' || (enemy.bulletDmg && enemy.bulletDmg>=25)) && dist < 160 && this.skillCd<=0 && this.skillStage===PET_SKILL_STAGE.IDLE){
      // 冲撞也做 LOS 检查: 如果中间钢墙/水/基地挡住就不撞; 砖墙 OK (冲撞撞得穿)
      const los = this._bulletLOSGrade(game, this.cx, this.cy, enemy.cx, enemy.cy);
      if (los.grade !== 'blocked_hard'){
        this.tryCastSkill(game);
      }
    }
  }
  behaviourDefend(dt, game){
    // 游击 8 字绕家 + 自爆兵撞飞
    const bx = 9*TILE+TILE, by = 18*TILE;
    if (this.tryEscapeStuck(dt)) { /* 脱困优先 */ }
    else {
      const t = Date.now()/900;
      const tx = bx + Math.sin(t)*TILE*2.3;
      const ty = by - TILE*1.8 + Math.sin(t*2)*TILE*0.8;
      this.moveTo(tx, ty, dt, 1.3);
    }
    // 自爆/敌人靠近基地 → 直接冲撞 (有LOS才撞, 砖墙可穿)
    const enemies = [...game.enemies, game.boss].filter(e=>e && !e.dead);
    for (const e of enemies){
      if (Math.hypot(e.cx-bx, e.cy-by) < TILE*2.2){
        if (e.type === 'suicide' || (e.bulletDmg && e.bulletDmg>=25)){
          this.bodyAngle = Math.atan2(e.cy - this.cy, e.cx - this.cx);
          const losOK = this._bulletLOSGrade(game, this.cx, this.cy, e.cx, e.cy).grade !== 'blocked_hard';
          if (losOK && this.skillCd<=0 && this.skillStage===PET_SKILL_STAGE.IDLE) this.tryCastSkill(game);
        }
      }
    }
    const {enemy} = this.findNearestEnemy(game);
    if (enemy){
      const canFire = this.ensureFiringPosition(dt, game, enemy, TILE*2.5);
      this.turretAngle = Math.atan2(enemy.cy - this.cy, enemy.cx - this.cx);
      if (canFire && this.fireTimer <= 0) this.shootAt(enemy, game);
    }
  }
}
class PetGuard extends Pet {
  behaviourFollow(dt, game){
    if (this.tryEscapeStuck(dt)) return;
    // 贴玩家左/右,当护盾挡子弹
    const pcx = game.player ? game.player.cx : this.cx;
    const pcy = game.player ? game.player.cy : this.cy;
    const side = (this.cx < pcx) ? -1 : 1;
    const tx = pcx + side * TILE*0.9;
    const ty = pcy + TILE*0.1;
    this.moveTo(tx, ty, dt, 0.95);
    const {enemy} = this.findNearestEnemy(game, this.attackRange);
    if (enemy) this.transitState(PET_STATE.ASSIST, game);
  }
  behaviourAssist(dt, game){
    // 护卫轻坦特性: 挡在玩家和敌人中间 + 嘲讽 + 反击 (必须挡得住: 玩家←Guard←敌人, 三点一线)
    const pcx = game.player ? game.player.cx : this.cx;
    const pcy = game.player ? game.player.cy : this.cy;
    const {enemy, dist} = this.findNearestEnemy(game);
    if (!enemy){ this.transitState(PET_STATE.FOLLOW, game); return; }
    const toEnemy = Math.atan2(enemy.cy - pcy, enemy.cx - pcx);
    // 站位: 玩家和敌人之间, 稍微靠玩家一侧 0.9 格
    const tx = pcx + Math.cos(toEnemy)*TILE*0.9;
    const ty = pcy + Math.sin(toEnemy)*TILE*0.9;
    if (!this.tryEscapeStuck(dt)) this.moveTo(tx, ty, dt, 1.0);
    // 反击: 只有挡弹位有 LOS 到敌人才开火 (hasLineOfSight 视为硬挡, 不区分砖)
    const los = this.hasLineOfSight(game, this.cx, this.cy, enemy.cx, enemy.cy)
      ? { grade:'ok', brickCount:0 }
      : this._bulletLOSGrade(game, this.cx, this.cy, enemy.cx, enemy.cy);
    this.turretAngle = Math.atan2(enemy.cy - this.cy, enemy.cx - this.cx);
    if (los.grade !== 'blocked_hard' && this.fireTimer <= 0) this.shootAt(enemy, game);
    // 敌人多于 2 个范围内 → 自动嘲讽
    const count = game.enemies.filter(e=>!e.dead && Math.hypot(e.cx-this.cx,e.cy-this.cy)<this.def.skill.range).length;
    if (count >= 2 && this.skillCd<=0 && this.skillStage===PET_SKILL_STAGE.IDLE) this.tryCastSkill(game);
  }
  behaviourDefend(dt, game){
    // 固定堵基地门口前 1 格, 面对主通道（朝北）
    const bx = 9*TILE+TILE, by = 18*TILE;
    if (!this.tryEscapeStuck(dt)) this.moveTo(bx, by - TILE*1.2, dt, 1.0);
    // [v58修复] 不用 || 判断 turretAngle(0 是有效角度); 未初始化时朝北
    if (this.turretAngle == null) this.turretAngle = -Math.PI/2;
    const {enemy, dist} = this.findNearestEnemy(game);
    if (enemy){
      const canFire = this.ensureFiringPosition(dt, game, enemy, TILE*3.5);
      this.turretAngle = Math.atan2(enemy.cy - this.cy, enemy.cx - this.cx);
      if (canFire && this.fireTimer <= 0 && dist < this.attackRange) this.shootAt(enemy, game);
      const cnt = game.enemies.filter(e=>!e.dead && Math.hypot(e.cx-this.cx,e.cy-this.cy)<this.def.skill.range).length;
      if (cnt>=2 && this.skillCd<=0 && this.skillStage===PET_SKILL_STAGE.IDLE) this.tryCastSkill(game);
    }
  }
}
class PetSPG extends Pet {
  behaviourFollow(dt, game){
    if (this.tryEscapeStuck(dt)) return;
    const pcx = game.player ? game.player.cx : this.cx;
    const pcy = game.player ? game.player.cy : this.cy;
    const back = (game.player && !game.player.dead) ? (game.player.bodyAngle+Math.PI) : Math.PI/2;
    const tx = pcx + Math.cos(back)*TILE*3.3;
    const ty = pcy + Math.sin(back)*TILE*3.3;
    this.moveTo(tx, ty, dt, 0.95);
    const scanRange = Math.max(this.attackRange * 1.8, TILE * 7);
    const {enemy} = this.findNearestEnemy(game, scanRange);
    if (enemy) this.transitState(PET_STATE.ASSIST, game);
  }
  behaviourAssist(dt, game){
    // 火炮特性: 超远距 (280-350), 优先选能覆盖 120° 扇形最多敌人的位
    const {enemy, dist} = this.findNearestEnemy(game);
    if (!enemy){ this.transitState(PET_STATE.FOLLOW, game); return; }
    const ideal = 310;
    // SPG 有溅射, 允许 2 层砖墙, 硬挡或砖墙过厚才走位
    const los = this._bulletLOSGrade(game, this.cx, this.cy, enemy.cx, enemy.cy);
    if (los.grade === 'blocked_hard' || (los.grade === 'brick' && los.brickCount > 2)){
      const spot = this.findBestFiringSpot(game, enemy, ideal);
      if (spot){ this.moveTo(spot.x, spot.y, dt, 1.05); this.turretAngle = Math.atan2(enemy.cy-this.cy, enemy.cx-this.cx); return; }
    }
    if (this.tryEscapeStuck(dt)) return;
    // 距离控制: 火炮保持超远距
    if (dist > ideal + 45) this.moveTo(enemy.cx, enemy.cy, dt, 0.9);
    else if (dist < ideal - 70) {
      const bk = Math.atan2(this.cy-enemy.cy, this.cx-enemy.cx);
      this.moveTo(this.cx + Math.cos(bk)*66, this.cy + Math.sin(bk)*66, dt, 0.95);
    }
    this.turretAngle = Math.atan2(enemy.cy - this.cy, enemy.cx - this.cx);
    if (this.fireTimer <= 0) this.shootAt(enemy, game);
    // 密集敌人 → 全屏齐射
    const packed = game.enemies.filter(e=>!e.dead).length;
    if (packed >= 5 && this.skillCd<=0 && this.skillStage===PET_SKILL_STAGE.IDLE) this.tryCastSkill(game);
  }
  behaviourDefend(dt, game){
    // 最后方 2 格(玩家出生点)不动, 点射门口
    const bx = 9*TILE+TILE, by = 16*TILE - TILE*0.6;
    if (!this.tryEscapeStuck(dt)) this.moveTo(bx, by, dt, 0.8);
    const count = game.enemies.filter(e=>!e.dead && Math.hypot(e.cx-(9*TILE+TILE),e.cy-(18*TILE)) < TILE*3.5).length;
    if (count >= 3 && this.skillCd<=0 && this.skillStage===PET_SKILL_STAGE.IDLE){
      this.skillCd = this.def.skill.cd * (this.growth.cd || 1) * 0.5;
      this._doSkillEffect(game);
    }
    const {enemy} = this.findNearestEnemy(game);
    if (enemy){
      const canFire = this.ensureFiringPosition(dt, game, enemy, TILE*5);
      this.turretAngle = Math.atan2(enemy.cy - this.cy, enemy.cx - this.cx);
      if (canFire && this.fireTimer <= 0) this.shootAt(enemy, game);
    }
  }
}
class PetEMV extends Pet {
  behaviourFollow(dt, game){ if (this.tryEscapeStuck(dt)) return; super.behaviourFollow(dt, game); }
  behaviourAssist(dt, game){
    // 电磁干扰车: 中距离 (~200), 优先保证 EMP 技能覆盖 (LOS 对 EMP 更宽松)
    const {enemy, dist} = this.findNearestEnemy(game);
    if (!enemy){ this.transitState(PET_STATE.FOLLOW, game); return; }
    const ideal = Math.min(this.def.skill.range*0.7, 210);
    const canFire = this.ensureFiringPosition(dt, game, enemy, ideal);
    if (dist > ideal + 30) this.moveTo(enemy.cx, enemy.cy, dt, 1.1);
    // 敌人多 → EMP
    const near = game.enemies.filter(e=>!e.dead && Math.hypot(e.cx-this.cx,e.cy-this.cy)<this.def.skill.range).length;
    if (near >= 3 && this.skillCd<=0 && this.skillStage===PET_SKILL_STAGE.IDLE) this.tryCastSkill(game);
    this.turretAngle = Math.atan2(enemy.cy - this.cy, enemy.cx - this.cx);
    if (canFire && this.fireTimer <= 0 && this.def.base.dmgMul>0) this.shootAt(enemy, game);
  }
  behaviourDefend(dt, game){
    // 基地外围顺时针巡逻
    const bx = 9*TILE+TILE, by = 18*TILE;
    if (this.tryEscapeStuck(dt)) { /* */ }
    else {
      const ang = (Date.now()/1200);
      const tx = bx + Math.cos(ang)*TILE*1.8;
      const ty = by - TILE*0.5 + Math.sin(ang)*TILE*1.0;
      this.moveTo(tx, ty, dt, 1.1);
    }
    const cnt = game.enemies.filter(e=>!e.dead && Math.hypot(e.cx-bx,e.cy-by)<TILE*3).length;
    if (cnt >= 3 && this.skillCd<=0 && this.skillStage===PET_SKILL_STAGE.IDLE) this.tryCastSkill(game);
    const {enemy} = this.findNearestEnemy(game);
    if (enemy){
      const canFire = this.ensureFiringPosition(dt, game, enemy, TILE*3);
      this.turretAngle = Math.atan2(enemy.cy - this.cy, enemy.cx - this.cx);
      if (canFire && this.fireTimer<=0 && this.def.base.dmgMul>0) this.shootAt(enemy, game);
    }
  }
}
class PetGhost extends Pet {
  // Ghost: 不输出, 专门肉盾, 可以穿砖墙 (tilePassable 已允许)
  behaviourFollow(dt, game){
    if (this.tryEscapeStuck(dt)) return;
    const pcx = game.player ? game.player.cx : this.cx;
    const pcy = game.player ? game.player.cy : this.cy;
    const fw = (game.player&&!game.player.dead) ? game.player.turretAngle : -Math.PI/2;
    const tx = pcx + Math.cos(fw)*TILE*1.2;
    const ty = pcy + Math.sin(fw)*TILE*1.2;
    this.moveTo(tx, ty, dt, 1.2);
    const scanRange = Math.max(this.attackRange * 1.8, TILE * 7);
    const {enemy} = this.findNearestEnemy(game, scanRange);
    if (enemy) this.transitState(PET_STATE.ASSIST, game);
  }
  behaviourAssist(dt, game){
    const pcx = game.player ? game.player.cx : this.cx;
    const pcy = game.player ? game.player.cy : this.cy;
    const {enemy} = this.findNearestEnemy(game);
    if (!enemy){ this.transitState(PET_STATE.FOLLOW, game); return; }
    if (this.tryEscapeStuck(dt)) return;
    // 特性: 站在玩家←敌人 中间当肉盾, 幽灵可以穿砖墙快速到位
    const midAng = Math.atan2(enemy.cy-pcy, enemy.cx-pcx);
    const tx = pcx + Math.cos(midAng)*TILE*0.9;
    const ty = pcy + Math.sin(midAng)*TILE*0.9;
    this.moveTo(tx, ty, dt, 1.3);
    this.turretAngle = Math.atan2(enemy.cy - this.cy, enemy.cx - this.cx);
    // 敌人多 → 诱饵阵
    const cnt = game.enemies.filter(e=>!e.dead && Math.hypot(e.cx-this.cx, e.cy-this.cy) < this.def.skill.range*0.9).length;
    if (cnt >= 3 && this.skillCd<=0 && this.skillStage===PET_SKILL_STAGE.IDLE) this.tryCastSkill(game);
  }
  behaviourDefend(dt, game){
    // 变形:假装成玩家,吸引所有火力
    const bx = 9*TILE+TILE, by = 18*TILE;
    if (!this.tryEscapeStuck(dt)) this.moveTo(bx, by - TILE*1.0, dt, 1.2);
    if (this.skillCd<=0 && this.skillStage===PET_SKILL_STAGE.IDLE){
      const cnt = game.enemies.filter(e=>!e.dead && Math.hypot(e.cx-bx,e.cy-by) < TILE*3).length;
      if (cnt >= 2) this.tryCastSkill(game);
    }
  }
}
class PetBerserker extends Pet {
  behaviourFollow(dt, game){ if (this.tryEscapeStuck(dt)) return; super.behaviourFollow(dt, game); }
  behaviourAssist(dt, game){
    const {enemy, dist} = this.findNearestEnemy(game);
    if (!enemy){ this.transitState(PET_STATE.FOLLOW, game); return; }
    // 狂战士特性: 贴脸 150, 狂暴时站死不动; 硬挡走位, 砖墙最多 3 层 (高伤开墙)
    const ideal = 150;
    const los = this._bulletLOSGrade(game, this.cx, this.cy, enemy.cx, enemy.cy);
    if (los.grade === 'blocked_hard' || (los.grade === 'brick' && los.brickCount > 3)){
      const spot = this.findBestFiringSpot(game, enemy, ideal);
      if (spot){ this.moveTo(spot.x, spot.y, dt, 1.2); this.turretAngle = Math.atan2(enemy.cy-this.cy, enemy.cx-this.cx); return; }
    }
    if (this.tryEscapeStuck(dt)) return;
    if (this.rageActive){
      this.turretAngle = Math.atan2(enemy.cy-this.cy, enemy.cx-this.cx);
      if (los.grade !== 'blocked_hard' && this.fireTimer <= 0) this.shootAt(enemy, game);
      return;
    }
    if (dist > ideal + 30) this.moveTo(enemy.cx, enemy.cy, dt, 1.1);
    else if (dist < ideal - 20){
      const bk = Math.atan2(this.cy-enemy.cy, this.cx-enemy.cx);
      this.moveTo(this.cx + Math.cos(bk)*48, this.cy + Math.sin(bk)*48, dt, 0.95);
    }
    this.turretAngle = Math.atan2(enemy.cy-this.cy, enemy.cx-this.cx);
    if (this.fireTimer <= 0 && los.grade !== 'blocked_hard') this.shootAt(enemy, game);
    // 敌人 ≥ 4 → 怒吼清屏
    const cnt = game.enemies.filter(e=>!e.dead && Math.hypot(e.cx-this.cx,e.cy-this.cy) < this.def.skill.coneRange*0.9).length;
    if (cnt >= 4 && this.skillCd<=0 && this.skillStage===PET_SKILL_STAGE.IDLE) this.tryCastSkill(game);
  }
  behaviourDefend(dt, game){
    // 绝战:站死不挪,朝敌人多的方向无限开火 + 基地血<20% 触发同归于尽
    const bx = 9*TILE+TILE, by = 18*TILE;
    if (!this.tryEscapeStuck(dt)) this.moveTo(bx, by - TILE*1.5, dt, 0.6);
    // [v58修复] DEFEND态不开永久无敌,只在rageActive技能期间无敌
    if (!this.rageActive){ this.rageSpeedMul = 1.2; this.rageDmgMul = 1.2; this.rageInvul = false; }
    const {enemy} = this.findNearestEnemy(game);
    if (enemy){
      const canFire = this.ensureFiringPosition(dt, game, enemy, TILE*2.5);
      this.bodyAngle = Math.atan2(enemy.cy - this.cy, enemy.cx - this.cx);
      this.turretAngle = this.bodyAngle;
      if (canFire && this.fireTimer <= 0) this.shootAt(enemy, game);
      const cnt = game.enemies.filter(e=>!e.dead && Math.hypot(e.cx-this.cx,e.cy-this.cy) < this.def.skill.coneRange).length;
      if (cnt >= 3 && this.skillCd<=0 && this.skillStage===PET_SKILL_STAGE.IDLE) this.tryCastSkill(game);
    }
    // 基地血<20% 时 → 同归于尽:大自爆
    if (game.baseHp > 0 && game.baseHp / game.baseMaxHp < 0.2){
      if (!this._berserkerFinalBombAt){
        this._berserkerFinalBombAt = Date.now() + 2800;
      }
      if (Date.now() >= this._berserkerFinalBombAt){
        const finalDmg = 250 * (this.growth.dmg||1);
        for (const e of [...game.enemies, game.boss]) if (e && !e.dead) e.hurt(finalDmg, game);
        game.shake = Math.max(game.shake, 25);
        game.screenFlash = Math.max(game.screenFlash, 0.7);
        game.vignette = Math.max(game.vignette, 0.55);
        for (let i=0;i<120;i++){
          const ang = Math.random()*Math.PI*2;
          const sp = Util.rand(3, 10);
          game.particles.push(new Particle(this.cx, this.cy, Math.cos(ang)*sp, Math.sin(ang)*sp, Util.pick(['#ef4444','#f59e0b','#fbbf24','#fff']), 50+Math.random()*40, 3+Math.random()*3));
        }
        if (!(game.player && !game.player.dead)){
          this.hp = Math.min(this.maxHp*0.5, this.hp);
        }
        delete this._berserkerFinalBombAt;
      }
    }
  }
}
class PetMiner extends Pet {
  behaviourFollow(dt, game){
    if (this.tryEscapeStuck(dt)) return;
    const pcx = game.player ? game.player.cx : this.cx;
    const pcy = game.player ? game.player.cy : this.cy;
    const tx = pcx - TILE*0.8; const ty = pcy + TILE*0.9;
    this.moveTo(tx, ty, dt, 1.0);
    const scanRange = Math.max(this.attackRange * 1.8, TILE * 7);
    const {enemy} = this.findNearestEnemy(game, scanRange);
    if (enemy) this.transitState(PET_STATE.ASSIST, game);
  }
  behaviourAssist(dt, game){
    // 工兵: 远程 180, 保持距离放小机枪+布雷; LOS 硬挡就走位
    const {enemy, dist} = this.findNearestEnemy(game);
    if (!enemy){ this.transitState(PET_STATE.FOLLOW, game); return; }
    const ideal = 180;
    const canFire = this.ensureFiringPosition(dt, game, enemy, ideal);
    if (dist > ideal + 30) this.moveTo(enemy.cx, enemy.cy, dt, 1.0);
    else if (dist < ideal - 30){
      const bk = Math.atan2(this.cy-enemy.cy, this.cx-enemy.cx);
      this.moveTo(this.cx + Math.cos(bk)*45, this.cy + Math.sin(bk)*45, dt, 0.9);
    }
    this.turretAngle = Math.atan2(enemy.cy-this.cy, enemy.cx-this.cx);
    if (canFire && this.fireTimer <= 0 && this.def.base.dmgMul>0) this.shootAt(enemy, game);
    // 敌人 ≥ 5 → 地雷海
    const cnt = game.enemies.filter(e=>!e.dead).length;
    if (cnt >= 5 && this.skillCd<=0 && this.skillStage===PET_SKILL_STAGE.IDLE) this.tryCastSkill(game);
  }
  behaviourDefend(dt, game){
    // 构建:环形雷区 + 主通道之字形 + 大雷牺牲
    const bx = 9*TILE+TILE, by = 18*TILE;
    if (!this._minerAutoMineAt) this._minerAutoMineAt = Date.now() + 4500;
    if (Date.now() >= this._minerAutoMineAt){
      const mines = 5 + Math.floor((this.level-1)/2);
      game.petMines = game.petMines || [];
      for (let i=0;i<mines;i++){
        const a = (i/mines)*Math.PI*2;
        const r = TILE*1.3;
        const px = bx + Math.cos(a)*r;
        const py = by - TILE*0.5 + Math.sin(a)*r;
        const isIce = Util.chance(this.def.skill.iceRate + 0.01*(this.level-1));
        game.petMines.push({ x: Util.clamp(px,20,W-20), y: Util.clamp(py,20,H-20), born: Date.now(), life: 99999, armed: false, armAt: Date.now()+350, mineDmg: this.def.skill.mineDmg*(this.growth.dmg||1), mineRadius: this.def.skill.mineRadius, isIce, iceDur: this.def.skill.iceDur });
      }
      for (let i=0;i<5;i++){
        const zz = (i%2===0) ? 9-2 : 9+2;
        const c = zz + Util.rand(-1, 1);
        const r = 16 + Util.randInt(0, 1);
        game.petMines.push({
          x: c*TILE + TILE/2, y: r*TILE + TILE/2,
          born: Date.now(), life: 99999, armed: false, armAt: Date.now()+350,
          mineDmg: this.def.skill.mineDmg*(this.growth.dmg||1),
          mineRadius: this.def.skill.mineRadius,
          isIce: Util.chance(this.def.skill.iceRate),
          iceDur: this.def.skill.iceDur
        });
      }
      this._minerAutoMineAt = Date.now() + 4500;
    }
    // 基地 <30% 时, 工兵自己变超级大雷冲向人群自爆 (砖墙可穿, 钢墙/水必须绕)
    if (game.baseHp > 0 && game.baseHp / game.baseMaxHp < 0.3){
      const {enemy} = this.findNearestEnemy(game);
      if (enemy){
        const los = this._bulletLOSGrade(game, this.cx, this.cy, enemy.cx, enemy.cy);
        if (los.grade !== 'blocked_hard') this.moveTo(enemy.cx, enemy.cy, dt, 1.3);
        else this.tryEscapeStuck(dt);
        if (Math.hypot(enemy.cx-this.cx, enemy.cy-this.cy) < 40){
          const bigDmg = 300*(this.growth.dmg||1);
          const bigR = TILE*2.5;
          game.spawnExplosion(this.cx, this.cy, bigR);
          const all = [...game.enemies];
          if (game.boss && !game.boss.dead) all.push(game.boss);
          for (const e of all) if (!e.dead && Math.hypot(e.cx-this.cx, e.cy-this.cy) < bigR) e.hurt(bigDmg, game);
          game.shake = Math.max(game.shake, 14);
          this.hp = Math.max(this.maxHp*0.4, this.hp);
        }
      }
    } else {
      if (!this.tryEscapeStuck(dt)){
        const t = Date.now()/900;
        this.moveTo(bx + Math.cos(t)*TILE*1.0, by - TILE, dt, 1.0);
      }
    }
    const {enemy} = this.findNearestEnemy(game);
    if (enemy){
      const canFire = this.ensureFiringPosition(dt, game, enemy, TILE*3);
      this.turretAngle = Math.atan2(enemy.cy - this.cy, enemy.cx - this.cx);
      if (canFire && this.fireTimer<=0 && this.def.base.dmgMul>0) this.shootAt(enemy, game);
    }
  }
}

class Particle {
  constructor(x,y,vx,vy,color,life,size){
    this.x=x;this.y=y;this.vx=vx;this.vy=vy;
    this.color=color;this.life=life;this.maxLife=life;this.size=size||3;
    this.baseSize = this.size;
    this.gravity = 0;          // 可选: 重力(正值向下)
    this.expand = 0;           // 可选: 每帧尺寸增加量(正=扩散,负=收缩)
    this.dead=false;
  }
  update(dt){
    this.x+=this.vx; this.y+=this.vy;
    this.vx*=0.94; this.vy*=0.94;
    if (this.gravity) this.vy += this.gravity;
    if (this.expand) this.size = Math.max(0.1, this.size + this.expand);
    this.life--;
    if(this.life<=0) this.dead=true;
  }
  render(ctx){
    const a = Math.max(0, Math.min(1, this.life/this.maxLife));
    ctx.globalAlpha = a;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x-this.size/2, this.y-this.size/2, this.size, this.size);
    ctx.globalAlpha = 1;
  }
}

/* ===================== 十五、掉落物(武器/装备/道具) ===================== */
class Drop {
  constructor(x,y,kind,id){
    this.x=x;this.y=y;this.w=24;this.h=24;
    this.kind=kind; // 'weapon'|'passive'|'item'|'buff'|'weapon_unlock'
    this.id=id;
    this.life=600; // 存在帧数
    this.dead=false;
    this.bob=0;
  }
  get rect(){ return {x:this.x-this.w/2,y:this.y-this.h/2,w:this.w,h:this.h}; }
  update(dt){
    this.life--;
    if(this.life<=0) this.dead=true;
    this.bob += 0.1;
  }
  render(ctx){
    const label = this.getLabel();
    const yoff = Math.sin(this.bob)*3;
    // 光晕(weapon_unlock 加强金色光环)
    if (this.kind === 'weapon_unlock'){
      const t = Date.now()/120;
      ctx.fillStyle = '#fbbf24';
      ctx.globalAlpha = this.life<60 ? this.life/60*0.5 : 0.35 + 0.15*Math.sin(t);
      ctx.beginPath(); ctx.arc(this.x, this.y+yoff, 20 + 3*Math.sin(t), 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
      // 旋转的金色星芒
      ctx.save();
      ctx.translate(this.x, this.y+yoff);
      ctx.rotate(t*0.5);
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 2;
      for (let i=0;i<4;i++){
        ctx.rotate(Math.PI/2);
        ctx.beginPath();
        ctx.moveTo(0,0); ctx.lineTo(0, 15);
        ctx.stroke();
      }
      ctx.restore();
    } else {
      ctx.fillStyle = this.getColor();
      ctx.globalAlpha = this.life<60 ? this.life/60*0.4 : 0.25;
      ctx.beginPath(); ctx.arc(this.x, this.y+yoff, 16, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // 边框
    ctx.strokeStyle = this.getColor(); ctx.lineWidth=2;
    ctx.strokeRect(this.x-12, this.y+yoff-12, 24, 24);
    // 图标
    ctx.font='14px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(label, this.x, this.y+yoff);
  }
  getLabel(){
    if(this.kind==='weapon'||this.kind==='weapon_unlock') return WEAPONS[this.id].icon;
    if(this.kind==='passive') return PASSIVES.find(p=>p.id===this.id).icon;
    if(this.kind==='item') return ITEMS[this.id].icon;
    if(this.kind==='buff') return '✨';
    return '?';
  }
  getColor(){
    if(this.kind==='weapon_unlock') return '#fbbf24';
    if(this.kind==='weapon') return '#00ffe0';
    if(this.kind==='passive') return '#a78bfa';
    if(this.kind==='item') return '#f59e0b';
    if(this.kind==='buff') return '#fbbf24';
    return '#fff';
  }
}

/* ===================== 十六、宝箱/地雷 ===================== */
class Chest {
  constructor(col,row){
    this.cx=col*TILE+TILE/2; this.cy=row*TILE+TILE/2;
    this.x=this.cx-14; this.y=this.cy-14; this.w=28; this.h=28;
    this.hp=30; this.dead=false;
  }
  get rect(){return {x:this.x,y:this.y,w:this.w,h:this.h};}
  hurt(dmg,game){ this.hp-=dmg; if(this.hp<=0){ this.dead=true; game.onChestBroken(this); } }
  render(ctx){
    ctx.fillStyle='#92400e'; ctx.fillRect(this.x,this.y,this.w,this.h);
    ctx.fillStyle='#fbbf24'; ctx.fillRect(this.x+2,this.y+2,this.w-4,6);
    ctx.strokeStyle='#000'; ctx.strokeRect(this.x,this.y,this.w,this.h);
  }
}
class Mine {
  constructor(col,row){
    this.cx=col*TILE+TILE/2; this.cy=row*TILE+TILE/2;
    this.x=this.cx-10; this.y=this.cy-10; this.w=20; this.h=20;
    this.dead=false; this.armed=true;
  }
  get rect(){return {x:this.x,y:this.y,w:this.w,h:this.h};}
  trigger(game){
    this.dead=true;
    game.spawnExplosion(this.cx,this.cy,40);
    if(game.player && !game.player.dead && Util.rectsHit(this.rect, game.player.rect)){
      game.player.hurt(35, game, { splash:true }); // 地雷爆炸溅射
    }
  }
  render(ctx){
    ctx.fillStyle = `rgba(239,68,68,${0.5+0.3*Math.sin(Date.now()/200)})`;
    ctx.beginPath(); ctx.arc(this.cx,this.cy,8,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#1f2937'; ctx.beginPath(); ctx.arc(this.cx,this.cy,4,0,Math.PI*2); ctx.fill();
  }
}

/* ===================== 十七、游戏主类 ===================== */
class Game {
  // 多玩家存档槽: 所有需要按槽位隔离的存档键 (不含 slot 本身)
  static SAVE_KEYS = ['highscore','endless_max','laser','credits','unlocked','cleared','uweapons','utanks','seltank','upets','petlv','tanklv','wplv','selpet','inv'];

  constructor(canvas, minimap){
    Game.instance = this;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.minimap = minimap;
    this.mctx = minimap.getContext('2d');

    // —— [v62优化] 移动端/低性能设备 动态降级特效上限:
    //    手机屏是低PPI/DPR的渲染开销也低,但CPU/内存往往弱于PC;
    //    若为触屏设备,把粒子/子弹/激光等特效压到约60%,显著提升大爆炸/BOSS战时的流畅度
    const IS_TOUCH = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (IS_TOUCH){
      this.MAX_PARTICLES = 420;     // 原700的60%
      this.MAX_BULLETS   = 140;     // 原220的63%
      this.MAX_LASERS    = 18;      // 原28的64%
      this.MAX_DEBRIS    = 240;     // 原400的60%
      this.MAX_LIGHTNINGS= 12;      // 原18的66%
      this.FLAME_LIMIT   = 280;     // 火焰喷射粒子上限(移动端)
    } else {
      this.MAX_PARTICLES = 700;
      this.MAX_BULLETS   = 220;
      this.MAX_LASERS    = 28;
      this.MAX_DEBRIS    = 400;
      this.MAX_LIGHTNINGS= 18;
      this.FLAME_LIMIT   = 450;
    }

    // [v57] 多玩家存档槽: 首次运行迁移旧数据到 s0, 再读取当前槽位
    this.migrateSlot0IfNeeded();
    this.slot = this.loadSlot();

    this.state = 'loading';   // loading/menu/playing/paused/gameover/win
    this.level = 1;
    this.score = 0;
    this.highScore = this.loadHighScore();
    this.endless = false;              // 无尽模式标记
    this.endlessWave = 0;              // 当前波次
    this.endlessMaxWave = this.loadEndlessMax(); // 历史最高波次

    // —— 积分商城相关(localStorage 持久化,跨局保留) ——
    this.credits = this.loadCredits();                  // 商城货币(跨局累积)
    this.unlockedLevels = this.loadUnlocked();          // 已解锁关卡数
    this.clearedLevels = this.loadCleared();            // 已通关关卡集合
    this.unlockedWeapons = this.loadUnlockedWeapons();  // 永久解锁的武器id(宝箱才会掉)
    this.unlockedTanks = this.loadUnlockedTanks();      // 永久解锁的坦克id(默认0号T-01)
    this.selectedTankId = this.loadSelectedTankId();    // 当前装备的坦克id
    this.tankLevels = this.loadTankLevels();            // 每辆坦克的等级(1~10, 跨局保留)
    this.unlockedPets = this.loadUnlockedPets();        // 永久解锁的宠物id(默认0号侦察无人机)
    this.selectedPetId = this.loadSelectedPetId();      // 当前装备的宠物id
    this.petLevels = this.loadPetLevels();              // 每只宠物的等级(1~10, 跨局保留)
    this.weaponLevels = this.loadWeaponLevels();        // 每把武器的等级(1~10, 跨局保留)
    this.laserUnlocked = this.loadLaserUnlocked();      // 激光主炮解锁 → 充能激光常驻
    this.savedInventory = this.loadInventory();         // 背包消耗道具(阵亡保留,跨局保留)
    this.shopOpen = false;                              // 商店打开中(暂停游戏)
    this.shopFrom = 'menu';                             // 商店来源: menu/level(通关)/playing(战斗中)
    this.lastStartedLevel = 1;                          // 上次开始的关卡(重新开始用)

    this.grid = [];           // 地形网格
    this.player = null;
    this.pet = null;          // 当前激活的战术支援载具(宠物)
    this.enemies = [];
    this.boss = null;
    this.bullets = [];
    this.lasers = [];         // 激光(充能发射)
    this.lightningChains = []; // T-02 连锁闪电特效
    this.flames = [];         // T-03 火焰喷射粒子
    this.barriers = [];       // T-04 能量壁垒特效
    this.particles = [];
    this.drops = [];
    this.chests = [];
    this.mines = [];
    // —— 宠物 E 技能特效数组 ——
    this.scanPulses = [];     // 无人机扫描脉冲(扩散蓝圈)
    this.rams = [];           // 吉普冲撞轨迹 + 伤害结算
    this.tauntFields = [];    // 护卫嘲讽力场
    this.barrages = [];       // 火炮全屏预警落弹
    this.empPulses = [];      // EMP 紫光扩散
    this.decoys = [];         // 幽灵全息诱饵
    this.berserkerCones = []; // 狂战士锥形清屏特效
    this.petMines = [];       // 工兵地雷海

    this.baseHp = 100; this.baseMaxHp = 100;
    this.enemiesToSpawn = 0;
    this.spawnTimer = 0;
    this.spawnPoints = [ {c:1,r:0}, {c:9,r:0}, {c:18,r:0} ];
    this.bossSpawned = false;
    this.freezeTimer = 0;     // 冰冻效果
    this.airstrikeTimer = 0;  // 空袭动画
    this.shake = 0;           // 屏幕震动
    this.screenFlash = 0;     // 屏幕白闪 (0~1,击败/大爆炸用)
    this.vignette = 0;        // 暗角冲击 (0~1,爆炸瞬间加强)
    // —— 防卡机硬上限:超过就删最老的(头部) ——
    // —— [v62优化] 这里不再写死,而是沿用上面 constructor 里按 触屏/PC 分开初始化好的值(避免被覆盖)
    //    以下赋值仅在 非触屏设备 下存在,保证旧代码能找到这些属性
    if (!this.MAX_FLAMES){
      this.MAX_PARTICLES = 700;
      this.MAX_BULLETS   = 220;
      this.MAX_LASERS    = 28;
      this.MAX_DEBRIS    = 400;
      this.MAX_LIGHTNINGS= 18;
      this.MAX_FLAMES    = 260;
    }
    this.MAX_FLAMES = Math.min(this.MAX_FLAMES || 260, this.FLAME_LIMIT || 999);
    this.MAX_BARRIERS = 4;    // 壁垒特效上限
    // —— 宠物 E 技能特效上限(防卡机) ——
    this.MAX_SCAN_PULSES   = 8;
    this.MAX_RAMS          = 6;
    this.MAX_TAUNT_FIELDS  = 4;
    this.MAX_BARRAGES      = 60;   // 单轮齐射炮弹数×场次
    this.MAX_EMP_PULSES    = 6;
    this.MAX_DECOYS        = 10;
    this.MAX_BERSERKER_CONES = 4;
    this.MAX_PET_MINES     = 80;   // 地雷海上限

    this.lastTime = 0;
    this.bgReady = false;
  }

  /* ---------- 资源加载 ---------- */
  startLoading(){
    const loadBar = document.getElementById('load-bar');
    const loadText = document.getElementById('load-text');
    Assets.loadAll(
      (loaded, total) => {
        const pct = Math.round(loaded/total*100);
        loadBar.style.width = pct+'%';
        loadText.textContent = loaded + ' / ' + total;
      },
      () => {
        this.bgReady = true;
        this.showMenu();
      }
    );
  }

  /* ---------- overlay 视图控制 ---------- */
  showView(name){
    ['loading','menu','pause','result','shop'].forEach(v=>{
      const el = document.getElementById('view-'+v);
      if (el) el.style.display = (v===name) ? '' : 'none';
    });
    document.getElementById('overlay').classList.remove('hidden');
    // HUD 按钮仅在游戏内(playing/paused/shop)显示,菜单/加载/结果时隐藏
    this.updateHudBtns();
  }
  hideOverlay(){
    document.getElementById('overlay').classList.add('hidden');
    this.updateHudBtns();
  }
  // 控制游戏内 HUD 按钮组显示/隐藏
  updateHudBtns(){
    const hud = document.getElementById('game-hud-btns');
    if (!hud) return;
    // playing/paused/shop 状态下显示按钮; menu/loading/gameover/win 隐藏
    const show = (this.state === 'playing' || this.state === 'paused' || this.shopOpen);
    hud.style.display = show ? '' : 'none';
    // 虚拟控制器同步:仅触屏设备 + playing 状态 + 非商店时显示
    const tc = document.getElementById('touch-controls');
    if (tc){
      const tcShow = Input.isTouchDevice && this.state === 'playing' && !this.shopOpen;
      tc.style.display = tcShow ? '' : 'none';
    }
  }

  /* ---------- 主菜单(选关 + 商城) ---------- */
  // 统一清理战斗临时状态(返回菜单/重开/结束无尽时调用,确保无残留)
  resetBattleState(){
    // 战场实体清空
    this.pet = null;              // 宠物实例
    this.enemies = [];
    this.bullets = [];
    this.lasers = [];
    this.particles = [];
    this.drops = [];
    this.chests = [];
    this.mines = [];
    this.lightningChains = []; // 连锁闪电特效
    this.flames = [];          // 火焰喷射粒子
    this.barriers = [];        // 能量壁垒
    // —— 宠物 E 技能特效数组清空 ——
    this.scanPulses = [];
    this.rams = [];
    this.tauntFields = [];
    this.barrages = [];
    this.empPulses = [];
    this.decoys = [];
    this.berserkerCones = [];
    this.petMines = [];
    this.boss = null;
    this.bossSpawned = false;
    // 计时器/计数器归零
    this.enemiesToSpawn = 0;
    this.spawnTimer = 0;
    this.freezeTimer = 0;
    this.airstrikeTimer = 0;
    this.shake = 0;
    this.screenFlash = 0;
    this.vignette = 0;
    // 渲染冻结标记解冻
    this._frozen = false;
    this._levelCleared = 0;
    // 无尽模式状态归零(最高波次记录保留在 endlessMaxWave,不重置)
    this.endless = false;
    this.endlessWave = 0;
    // 商店状态归零
    this.shopOpen = false;
    this.shopFrom = 'menu';
    // 激光爆发特效清空
    if (this.laserBurstFx) this.laserBurstFx = [];
    // 清除残留的 toast 提示定时器
    if (this.toastTimer){ clearTimeout(this.toastTimer); this.toastTimer = null; }
    if (this.toastEl) this.toastEl.style.opacity = '0';
  }

  showMenu(){
    this.state = 'menu';
    this.resetBattleState(); // 彻底清理所有战斗临时状态
    this.showView('menu');
    this.bindSlotBar();      // [v57] 绑定存档槽按钮
    this.renderSlotBar();    // [v57] 高亮当前玩家
    this.updateMenuCredits();
    this.renderLevelGrid();
    this.renderShop();
    // 更新无尽模式历史记录
    const recEl = document.getElementById('endless-record');
    if (recEl) recEl.textContent = '历史最高: ' + this.endlessMaxWave + ' 波';
  }

  updateMenuCredits(){
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('menu-credits', this.credits);
    set('menu-high', this.highScore);
    set('menu-unlocked', this.unlockedLevels);
    set('credits', this.credits);   // 顶部 header 同步
  }

  switchMenuTab(tab){
    document.querySelectorAll('.mtab').forEach(b=>{
      b.classList.toggle('active', b.dataset.mtab === tab);
    });
    document.getElementById('panel-levels').style.display = (tab==='levels') ? '' : 'none';
    document.getElementById('panel-shop').style.display  = (tab==='shop')  ? '' : 'none';
  }

  renderLevelGrid(){
    const grid = document.getElementById('level-grid');
    if (!grid) return;
    grid.innerHTML = '';
    for (let i=1; i<=MAX_LEVEL; i++){
      const locked  = i > this.unlockedLevels;
      const cleared = this.clearedLevels.includes(i);
      const card = document.createElement('div');
      card.className = 'level-card' + (locked?' locked':'') + (cleared?' cleared':'');
      card.innerHTML =
        `<div class="lv-num">${i}</div>` +
        `<div class="lv-name">${LEVEL_NAMES[i-1] || ('关卡 '+i)}</div>` +
        (locked ? '<div class="lv-lock">🔒</div>' : '');
      if (!locked){
        card.addEventListener('click', ()=> this.startLevel(i));
      }
      grid.appendChild(card);
    }
  }

  /* ---------- 商店(菜单面板 + 战斗内浮层,购买立即生效) ---------- */
  // 公共方法:构建单个商店商品元素(weapon/laser/tank 特殊渲染)
  buildShopItemEl(item){
    const owned  = this.getShopOwnedDesc(item);
    const maxed  = this.isShopItemMaxed(item);
    const canBuy = this.canBuyShopItem(item);
    const noPlayer = item.type === 'passive' && !this.player;
    const isWeapon = (item.type === 'weapon' || item.type === 'laser');
    const isTank   = item.type === 'tank';
    const isPet    = item.type === 'pet';
    const div = document.createElement('div');

    if (isTank){
      // —— 坦克皮肤商品:未解锁→金币解锁; 已解锁→显示等级/数值 + 升级 + 装备 —— //
      const def = TANK_MODELS.find(t => t.id === item.tid) || TANK_MODELS[0];
      const unlocked = this.unlockedTanks.includes(item.tid);
      const equipped = this.selectedTankId === item.tid;
      const lv = unlocked ? (this.tankLevels[item.tid] || 1) : 1;
      const g = TANK_LEVEL_GROWTH[lv-1] || TANK_LEVEL_GROWTH[0];
      const nextG = lv < 10 ? (TANK_LEVEL_GROWTH[lv] || null) : null;
      const curHp   = Math.round(def.hp * g.hp);
      const curSpd  = (def.speedMul * g.spd).toFixed(2);
      const curFire = Math.round(def.fireCdMul * g.fire * 100);
      const nextHp   = nextG ? Math.round(def.hp * nextG.hp) : curHp;
      const nextFire = nextG ? Math.round(def.fireCdMul * nextG.fire * 100) : curFire;
      const upCost = this.tankUpgradeCost(item.tid);
      const lvlDots = Array.from({length:10}, (_,i)=>
        `<span class="lv-dot ${i<lv?'on':(i===lv?'cur':'')}">${i+1}</span>`
      ).join('');

      if (!unlocked){
        div.className = 'shop-item s-locked';
        div.innerHTML =
          `<div class="s-ico">🔒</div>` +
          `<div class="s-info">` +
            `<div class="s-name">${item.name} <span class="s-cost">${item.cost}🪙</span></div>` +
            `<div class="s-desc">${item.desc}</div>` +
            `<div class="s-owned" style="color:var(--muted);">未解锁 · 购买后永久解锁并立即装备</div>` +
          `</div>` +
          `<button class="s-buy ${canBuy?'':' disabled'}">${canBuy?('解锁 '+item.cost+'🪙'):('需 '+item.cost+'🪙')}</button>`;
        const btn = div.querySelector('.s-buy');
        if (canBuy) btn.addEventListener('click', ()=> this.buyItem(item.id));
      } else {
        div.className = equipped ? 'shop-item s-unlocked' : 'shop-item';
        const equipBtn = equipped
          ? `<button class="s-buy maxed" disabled>已装备</button>`
          : `<button class="s-buy ${this.state==='playing'||this.state==='paused'?'maxed':''}">${this.state==='playing'||this.state==='paused'?'战斗中':'装备'}</button>`;
        const upBtn = lv >= 10
          ? `<button class="s-buy maxed" disabled>满级</button>`
          : `<button class="s-buy up ${this.credits>=upCost?'':' disabled'}">⬆ ${upCost}🪙</button>`;
        const skName = def.skill ? def.skill.name : '无神技';
        const skCd = def.skill ? (Math.round(def.skill.cd * g.cd / 100)/10) : 0;
        const nextSkCd = (def.skill && nextG) ? (Math.round(def.skill.cd * nextG.cd / 100)/10) : skCd;
        div.innerHTML =
          `<div class="s-ico">${item.icon}</div>` +
          `<div class="s-info">` +
            `<div class="s-name">${item.name} <span class="s-cost">${item.cost}🪙</span>` +
              `<span class="pet-lv-tag">Lv ${lv}/10</span></div>` +
            `<div class="lv-bar">${lvlDots}</div>` +
            `<div class="s-desc">${item.desc}</div>` +
            `<div class="s-stats">` +
              `<span>❤️ HP <b>${curHp}</b>${nextG?` <i class="up-arrow">→${nextHp}</i>`:''}</span>` +
              `<span>🌀 速度 <b>×${curSpd}</b></span>` +
              `<span>🔥 射速 <b>${(100/curFire*100).toFixed(0)}%</b>${nextG?` <i class="up-arrow">→${(100/nextFire*100).toFixed(0)}%</i>`:''}</span>` +
              (def.skill
                ? `<span>⚡ 神技 <b>${skName.replace(/^\S+\s/,'')}</b></span><span>💤 CD <b>${skCd}s</b>${nextG?` <i class="up-arrow">→${nextSkCd}s</i>`:''}</span>`
                : `<span>⚡ 神技 <b>—</b></span>`) +
            `</div>` +
            (equipped
              ? `<div class="s-owned">✅ 已装备(战斗外可切换)</div>`
              : `<div class="s-owned" style="color:var(--neon-dim);">已解锁 · 战斗外点击装备</div>`) +
          `</div>` +
          `<div class="s-btns">${upBtn}${equipBtn}</div>`;
        const upButton = div.querySelector('.s-buy.up');
        if (upButton && this.credits >= upCost && lv < 10){
          upButton.addEventListener('click', ()=> this.upgradeTank(item.tid));
        }
        const eqButton = div.querySelector('.s-buy:not(.up):not(.maxed)');
        if (eqButton && !equipped && !(this.state==='playing'||this.state==='paused')){
          eqButton.addEventListener('click', ()=> this.buyItem(item.id));
        }
      }
    } else if (isPet){
      // —— 宠物商品: 未解锁→金币解锁; 已解锁→显示等级/数值 + 升级按钮 + 装备按钮 —— //
      const def = PET_DEFS.find(p => p.id === item.pid);
      const unlocked = this.unlockedPets.includes(item.pid);
      const equipped = this.selectedPetId === item.pid;
      const lv = unlocked ? (this.petLevels[item.pid] || 1) : 1;
      const g = PET_LEVEL_GROWTH[lv-1] || PET_LEVEL_GROWTH[0];
      const nextG = lv < 10 ? (PET_LEVEL_GROWTH[lv] || null) : null;
      // 当前数值 (基础 × 成长倍率)
      const curHp   = Math.round(def.base.hp * g.hp);
      const curSpd  = (def.base.spd * g.spd).toFixed(2);
      const curDmg  = def.base.bulletDmg > 0 ? Math.round(def.base.bulletDmg * g.dmg) : 0;
      const curFire = Math.round(def.base.fireCd * g.cd);
      const curSkillCd = Math.round((def.skill.cd||0) * g.cd / 1000 * 10) / 10;
      // 下一级数值预览
      const nextHp   = nextG ? Math.round(def.base.hp * nextG.hp) : curHp;
      const nextDmg  = nextG && def.base.bulletDmg > 0 ? Math.round(def.base.bulletDmg * nextG.dmg) : curDmg;
      const nextFire = nextG ? Math.round(def.base.fireCd * nextG.cd) : curFire;
      const upCost = this.petUpgradeCost(item.pid);
      const lvlDots = Array.from({length:10}, (_,i)=>
        `<span class="lv-dot ${i<lv?'on':(i===lv?'cur':'')}">${i+1}</span>`
      ).join('');

      if (!unlocked){
        div.className = 'shop-item s-locked';
        div.innerHTML =
          `<div class="s-ico">🔒</div>` +
          `<div class="s-info">` +
            `<div class="s-name">${item.icon} ${item.name} <span class="s-cost">${item.cost}🪙</span></div>` +
            `<div class="s-desc">${item.desc}</div>` +
            `<div class="s-owned" style="color:var(--muted);">未解锁 · 购买后可装备并升级</div>` +
          `</div>` +
          `<button class="s-buy ${canBuy?'':' disabled'}">${canBuy?('解锁 '+item.cost+'🪙'):('需 '+item.cost+'🪙')}</button>`;
        const btn = div.querySelector('.s-buy');
        if (canBuy) btn.addEventListener('click', ()=> this.buyItem(item.id));
      } else {
        div.className = equipped ? 'shop-item s-unlocked' : 'shop-item';
        const equipBtn = equipped
          ? `<button class="s-buy maxed" disabled>已出战</button>`
          : `<button class="s-buy ${this.state==='playing'||this.state==='paused'?'maxed':''}">${this.state==='playing'||this.state==='paused'?'战斗中':'装备'}</button>`;
        const upBtn = lv >= 10
          ? `<button class="s-buy maxed" disabled>满级</button>`
          : `<button class="s-buy up ${this.credits>=upCost?'':' disabled'}">⬆ ${upCost}🪙</button>`;
        div.innerHTML =
          `<div class="s-ico">${item.icon}</div>` +
          `<div class="s-info">` +
            `<div class="s-name">${item.name} <span class="s-cost">${item.cost}🪙</span>` +
              `<span class="pet-lv-tag">Lv ${lv}/10</span></div>` +
            `<div class="lv-bar">${lvlDots}</div>` +
            `<div class="s-desc">${item.desc}</div>` +
            `<div class="s-stats">` +
              `<span>❤️ HP <b>${curHp}</b>${nextG?` <i class="up-arrow">→${nextHp}</i>`:''}</span>` +
              `<span>🌀 速度 <b>${curSpd}</b></span>` +
              (curDmg>0
                ? `<span>💥 伤害 <b>${curDmg}</b>${nextG?` <i class="up-arrow">→${nextDmg}</i>`:''}</span>`
                : `<span>💥 伤害 <b>—</b></span>`) +
              `<span>🔥 射速 <b>${(60000/curFire).toFixed(1)}/min</b>${nextG?` <i class="up-arrow">→${(60000/nextFire).toFixed(1)}</i>`:''}</span>` +
              (def.skill && def.skill.cd
                ? `<span>⚡ 技能CD <b>${curSkillCd}s</b></span>`
                : '') +
            `</div>` +
            (equipped
              ? `<div class="s-owned">✅ 已出战</div>`
              : `<div class="s-owned" style="color:var(--neon-dim);">已解锁 · 点击装备</div>`) +
          `</div>` +
          `<div class="s-btns">${upBtn}${equipBtn}</div>`;
        // 升级按钮
        const upButton = div.querySelector('.s-buy.up');
        if (upButton && this.credits >= upCost && lv < 10){
          upButton.addEventListener('click', ()=> this.upgradePet(item.pid));
        }
        // 装备按钮
        const eqButton = div.querySelector('.s-buy:not(.up):not(.maxed)');
        if (eqButton && !equipped && !(this.state==='playing'||this.state==='paused')){
          eqButton.addEventListener('click', ()=> this.buyItem(item.id));
        }
      }
    } else if (isWeapon){
      // —— 武器类商品:激光主炮走原逻辑, 其他武器显示等级+升级 —— //
      if (item.type === 'laser'){
        if (maxed){
          div.className = 'shop-item s-unlocked';
          div.innerHTML =
            `<div class="s-ico">${item.icon}</div>` +
            `<div class="s-info">` +
              `<div class="s-name">${item.name} <span class="s-cost">${item.cost}🪙</span></div>` +
              `<div class="s-desc">${item.desc}</div>` +
              `<div class="s-owned">✅ 已永久解锁 · 蓄力释放 Lv1~5</div>` +
            `</div>` +
            `<button class="s-buy maxed" disabled>已解锁</button>`;
        } else {
          div.className = 'shop-item s-locked';
          div.innerHTML =
            `<div class="s-ico">🔒</div>` +
            `<div class="s-info">` +
              `<div class="s-name">${item.name} <span class="s-cost">${item.cost}🪙</span></div>` +
              `<div class="s-desc">${item.desc}</div>` +
              `<div class="s-owned" style="color:var(--muted);">未解锁 · 购买后永久解锁</div>` +
            `</div>` +
            `<button class="s-buy ${canBuy?'':' disabled'}">${canBuy?('解锁 '+item.cost+'🪙'):('需 '+item.cost+'🪙')}</button>`;
          const btn = div.querySelector('.s-buy');
          if (canBuy) btn.addEventListener('click', ()=> this.buyItem(item.id));
        }
      } else {
        // 普通武器(0号默认解锁, 1~7需购买解锁, 全部支持10级升级)
        const def = WEAPONS.find(w => w.id === item.wid) || WEAPONS[0];
        const unlocked = item.wid === 0 ? true : this.unlockedWeapons.includes(item.wid);
        const lv = unlocked ? (this.weaponLevels[item.wid] || 1) : 1;
        const g = WEAPON_LEVEL_GROWTH[lv-1] || WEAPON_LEVEL_GROWTH[0];
        const nextG = lv < 10 ? (WEAPON_LEVEL_GROWTH[lv] || null) : null;
        const curDmg = Math.round(def.dmg * g.dmg);
        const curCd  = (def.cd * g.cd / 1000).toFixed(2);
        const curSpd = (def.speed * g.spd).toFixed(1);
        const nextDmg = nextG ? Math.round(def.dmg * nextG.dmg) : curDmg;
        const nextCd  = nextG ? (def.cd * nextG.cd / 1000).toFixed(2) : curCd;
        const upCost = this.weaponUpgradeCost(item.wid);
        const lvlDots = Array.from({length:10}, (_,i)=>
          `<span class="lv-dot ${i<lv?'on':(i===lv?'cur':'')}">${i+1}</span>`
        ).join('');
        if (!unlocked){
          div.className = 'shop-item s-locked';
          div.innerHTML =
            `<div class="s-ico">🔒</div>` +
            `<div class="s-info">` +
              `<div class="s-name">${item.name} <span class="s-cost">${item.cost}🪙</span></div>` +
              `<div class="s-desc">${item.desc}</div>` +
              `<div class="s-owned" style="color:var(--muted);">未解锁 · 开宝箱或购买解锁</div>` +
            `</div>` +
            `<button class="s-buy ${canBuy?'':' disabled'}">${canBuy?('解锁 '+item.cost+'🪙'):('需 '+item.cost+'🪙')}</button>`;
          const btn = div.querySelector('.s-buy');
          if (canBuy) btn.addEventListener('click', ()=> this.buyItem(item.id));
        } else {
          div.className = 'shop-item';
          const upBtn = lv >= 10
            ? `<button class="s-buy maxed" disabled>满级</button>`
            : `<button class="s-buy up ${this.credits>=upCost?'':' disabled'}">⬆ ${upCost}🪙</button>`;
          const featStr = def.pierce ? '可穿透' : (def.splash>0 ? `溅射${def.splash}` : (def.spread ? `${def.spread}连发` : '单体'));
          div.innerHTML =
            `<div class="s-ico">${item.icon}</div>` +
            `<div class="s-info">` +
              `<div class="s-name">${item.name} <span class="s-cost">${item.cost}🪙</span>` +
                `<span class="pet-lv-tag">Lv ${lv}/10</span></div>` +
              `<div class="lv-bar">${lvlDots}</div>` +
              `<div class="s-desc">${item.desc}</div>` +
              `<div class="s-stats">` +
                `<span>💥 伤害 <b>${curDmg}</b>${nextG?` <i class="up-arrow">→${nextDmg}</i>`:''}</span>` +
                `<span>🔥 CD <b>${curCd}s</b>${nextG?` <i class="up-arrow">→${nextCd}s</i>`:''}</span>` +
                `<span>🌀 弹速 <b>${curSpd}</b></span>` +
                `<span>⚡ 特性 <b>${featStr}</b></span>` +
              `</div>` +
              `<div class="s-owned">✅ 已永久解锁</div>` +
            `</div>` +
            `<div class="s-btns">${upBtn}</div>`;
          const upButton = div.querySelector('.s-buy.up');
          if (upButton && this.credits >= upCost && lv < 10){
            upButton.addEventListener('click', ()=> this.upgradeWeapon(item.wid));
          }
        }
      }
    } else {
      // —— 其他商品(被动/道具):保持原有逻辑 ——
      div.className = 'shop-item';
      div.innerHTML =
        `<div class="s-ico">${item.icon}</div>` +
        `<div class="s-info">` +
          `<div class="s-name">${item.name} <span class="s-cost">${item.cost}🪙</span></div>` +
          `<div class="s-desc">${item.desc}</div>` +
          (owned ? `<div class="s-owned">${owned}</div>` : '') +
        `</div>` +
        `<button class="s-buy ${(maxed||noPlayer)?'maxed':(canBuy?'':' disabled')}">${maxed?'已满':(noPlayer?'战斗中':(item.cost+'🪙'))}</button>`;
      const btn = div.querySelector('.s-buy');
      if (!maxed && !noPlayer && canBuy){
        btn.addEventListener('click', ()=> this.buyItem(item.id));
      }
    }
    return div;
  }

  renderShop(){
    // 菜单面板渲染(shop-list)
    const list = document.getElementById('shop-list');
    if (!list) return;
    list.innerHTML = '';
    SHOP_ITEMS.forEach(item=>{
      list.appendChild(this.buildShopItemEl(item));
    });
  }

  getShopOwnedDesc(item){
    if (item.type === 'weapon')   return this.unlockedWeapons.includes(item.wid) ? '已解锁' : '';
    if (item.type === 'laser')    return this.laserUnlocked ? '已解锁' : '';
    if (item.type === 'tank'){
      const unlocked = this.unlockedTanks.includes(item.tid);
      if (!unlocked) return '';
      return this.selectedTankId === item.tid ? '✅ 已装备' : '已解锁(点击装备)';
    }
    if (item.type === 'pet'){
      const unlocked = this.unlockedPets.includes(item.pid);
      if (!unlocked) return '';
      return this.selectedPetId === item.pid ? '✅ 已出战' : '已解锁(点击出战)';
    }
    if (item.type === 'passive')  return (this.player && this.player.hasPassive(item.pid)) ? '已装备' : '';
    if (item.type === 'item'){
      const n = this.savedInventory[item.iid] || 0;
      return n > 0 ? ('背包 ×'+n) : '';
    }
    return '';
  }

  canBuyShopItem(item){
    if (this.isShopItemMaxed(item)) return false;
    return this.credits >= item.cost;
  }

  isShopItemMaxed(item){
    // 0号武器默认解锁, 不算 maxed (允许后续升级)
    if (item.type === 'weapon')   return item.wid === 0 ? false : this.unlockedWeapons.includes(item.wid);
    if (item.type === 'laser')    return this.laserUnlocked;
    if (item.type === 'tank')     return this.unlockedTanks.includes(item.tid);
    if (item.type === 'pet')      return this.unlockedPets.includes(item.pid);
    if (item.type === 'passive')  return this.player ? this.player.passives.length >= 3 : false;
    if (item.type === 'item')     return (this.savedInventory[item.iid] || 0) >= 9;
    return false;
  }

  buyItem(id){
    const item = SHOP_ITEMS.find(s=>s.id===id);
    if (!item) return;
    // 0号普通炮弹默认解锁, 不允许购买 (仅通过升级强化)
    if (item.type === 'weapon' && item.wid === 0){
      this.flashMsg('普通炮弹默认解锁, 请使用升级按钮强化');
      return;
    }
    // 被动装备需要活跃玩家(战斗中/通关后才能买)
    if (item.type === 'passive' && !this.player){
      this.flashMsg('请进入战斗后购买被动装备');
      return;
    }
    // 坦克装备:已解锁的情况下切换装备(不花钱,直接点装备按钮走equipTank)
    if (item.type === 'tank'){
      if (this.unlockedTanks.includes(item.tid)){ this.equipTank(item.tid); this.renderShop(); if (this.shopOpen) this.renderShopView(); return; }
    }
    // 宠物装备:已解锁的情况下切换装备(不花钱,走 equipPet 同步 HUD)
    if (item.type === 'pet'){
      if (this.unlockedPets.includes(item.pid)){ this.equipPet(item.pid); this.renderShop(); if (this.shopOpen) this.renderShopView(); return; }
    }
    if (this.isShopItemMaxed(item)){ this.flashMsg('已满级/已装备'); return; }
    if (this.credits < item.cost){ this.flashMsg('积分不足'); return; }
    this.credits -= item.cost;
    if (item.type === 'weapon'){
      if (!this.unlockedWeapons.includes(item.wid)) this.unlockedWeapons.push(item.wid);
      this.saveUnlockedWeapons();
    } else if (item.type === 'tank'){
      if (!this.unlockedTanks.includes(item.tid)) this.unlockedTanks.push(item.tid);
      this.saveUnlockedTanks();
      // 解锁后立刻装备 + 同步 player/pet HUD
      this.equipTank(item.tid);
      this.flashMsg('解锁并已装备: ' + item.name);
    } else if (item.type === 'pet'){
      if (!this.unlockedPets.includes(item.pid)) this.unlockedPets.push(item.pid);
      this.saveUnlockedPets();
      // 解锁后立刻装备 + 同步 HUD
      this.equipPet(item.pid);
      this.flashMsg('解锁并已装备宠物: ' + item.name);
    } else if (item.type === 'laser'){
      this.laserUnlocked = true;
      this.saveLaserUnlocked();
    } else if (item.type === 'passive'){
      // 立即装备到玩家(最多3件,超出替换最早的)
      if (this.player.passives.length >= 3) this.player.passives.shift();
      this.player.passives.push({ id:item.pid });
    } else if (item.type === 'item'){
      this.savedInventory[item.iid] = Math.min(9, (this.savedInventory[item.iid]||0)+1);
      if (this.player) this.player.inventory = this.savedInventory.slice();
      this.saveInventory();
    }
    this.saveCredits();
    this.updateMenuCredits();
    this.updateUI();
    this.renderShop();
    if (this.shopOpen) this.renderShopView();
    if (item.type !== 'tank' && item.type !== 'pet') this.flashMsg('购买成功: ' + item.name);
  }

  // 打开商店浮层(from: 'menu'/'level'/'playing')
  openShop(from){
    this.shopOpen = true;
    this.shopFrom = from || 'menu';
    this.shopTab = this.shopTab || 'passive';
    if (this.state === 'playing') this.state = 'paused'; // 暂停游戏
    this.showView('shop');
    this.renderShopView();
    // [v58修复] 动态更新关闭按钮文本
    const btn = document.getElementById('close-shop-btn');
    if (btn){
      if (from === 'level')      btn.textContent = '进入下一关';
      else if (from === 'playing') btn.textContent = '返回战斗';
      else                        btn.textContent = '返回主菜单';
    }
  }

  closeShop(){
    const from = this.shopFrom;
    this.shopOpen = false;
    this.shopFrom = 'menu';
    if (from === 'level'){
      // 通关后关闭 → 进入下一关
      this.level += 1;
      this.state = 'playing';
      this.hideOverlay();
      this.initLevel();
      this.updateUI();
      this.flashMsg('第 ' + this.level + ' 关 · ' + (LEVEL_NAMES[this.level-1]||'') + ' 开始!');
    } else if (from === 'playing'){
      // 战斗中关闭 → 恢复游戏
      this.state = 'playing';
      this.hideOverlay();
    } else {
      // 菜单关闭 → 返回菜单
      this.showMenu();
    }
  }

  switchShopTab(tab){
    this.shopTab = tab;
    document.querySelectorAll('.stab').forEach(b=>{
      b.classList.toggle('active', b.dataset.stab === tab);
    });
    this.renderShopView();
  }

  // 通关后智能推荐:根据玩家状态生成购买建议
  getShopHint(){
    if (this.shopFrom !== 'level') return null;
    const p = this.player;
    const hints = [];

    // 1. 被动装备:有空槽 → 推荐买得起的最便宜被动
    if (p && p.passives.length < 3){
      const afford = SHOP_ITEMS.filter(s =>
        s.type === 'passive' && s.cost <= this.credits && !this.isShopItemMaxed(s)
      ).sort((a,b)=>a.cost-b.cost);
      if (afford.length > 0){
        const r = afford[0];
        hints.push({
          ico:'⚙',
          html:`装备槽还空 <b style="color:#fbbf24">${3-p.passives.length}</b> 格 · 推荐 <span class="hint-item">${r.icon} ${r.name}</span> <span class="hint-cost">${r.cost}🪙</span> — ${r.desc}`
        });
      } else if (p.passives.length === 0) {
        hints.push({ ico:'⚙', html:`尚无被动装备 · 攒到 <span class="hint-cost">200🪙</span> 即可购买第一件` });
      }
    }

    // 2. 武器解锁:有未解锁 → 推荐买得起的
    const lockedW = SHOP_ITEMS.filter(s =>
      (s.type === 'weapon' || s.type === 'laser') && !this.isShopItemMaxed(s)
    );
    if (lockedW.length > 0){
      const afford = lockedW.find(w => w.cost <= this.credits);
      if (afford){
        hints.push({
          ico:'🔫',
          html:`可解锁 <span class="hint-item">${afford.icon} ${afford.name}</span> <span class="hint-cost">${afford.cost}🪙</span> — 解锁后宝箱才会掉落此武器`
        });
      } else {
        const cheapest = lockedW.sort((a,b)=>a.cost-b.cost)[0];
        hints.push({ ico:'🔫', html:`${lockedW.length} 把武器未解锁 · 最低 <span class="hint-cost">${cheapest.cost}🪙</span> 解锁 ${cheapest.icon} ${cheapest.name}` });
      }
    }

    // 3. 消耗道具:背包不足 → 推荐应急道具
    if (p){
      const totalItems = (p.inventory||[]).reduce((a,b)=>a+(b||0), 0);
      if (totalItems < 3){
        const afford = SHOP_ITEMS.filter(s => s.type === 'item' && s.cost <= this.credits)
                                  .sort((a,b)=>a.cost-b.cost);
        if (afford.length > 0){
          const r = afford[0];
          hints.push({
            ico:'🔧',
            html:`背包仅 ${totalItems} 件道具 · 推荐 <span class="hint-item">${r.icon} ${r.name}</span> <span class="hint-cost">${r.cost}🪙</span> 应急`
          });
        }
      }
    }

    // 4. 无可买项
    if (hints.length === 0){
      if (this.credits < 100){
        return [{ ico:'💡', html:`积分不足(仅 ${this.credits}🪙)· 直接"返回战斗"进入下一关,战斗中开宝箱/击杀攒积分` }];
      }
      return [{ ico:'✅', html:`装备充足!可直接"返回战斗"进入下一关挑战` }];
    }
    return hints;
  }

  // 渲染通关推荐提示横幅
  renderShopHint(){
    const el = document.getElementById('shop-hint');
    if (!el) return;
    const hints = this.getShopHint();
    if (!hints || hints.length === 0){
      el.style.display = 'none';
      return;
    }
    el.style.display = '';
    const nextLevelName = LEVEL_NAMES[(this._levelCleared||this.level)] || ('第'+((this._levelCleared||this.level)+1)+'关');
    el.innerHTML =
      '<span class="hint-title">💡 下一关前推荐强化 (即将进入: ' + nextLevelName + ')</span>' +
      hints.map(h => `<div class="hint-line"><span class="hint-ico">${h.ico}</span><span>${h.html}</span></div>`).join('');
  }

  // 战斗内/通关后商店浮层渲染
  renderShopView(){
    const creditsEl = document.getElementById('shop-credits');
    if (creditsEl) creditsEl.textContent = this.credits;
    // 通关推荐提示(仅 shopFrom==='level' 时显示)
    this.renderShopHint();
    const content = document.getElementById('shop-content');
    if (!content) return;
    const tab = this.shopTab || 'passive';
    content.innerHTML = '';
    const items = SHOP_ITEMS.filter(s=>{
      if (tab === 'passive') return s.type === 'passive';
      if (tab === 'item')    return s.type === 'item';
      if (tab === 'weapon')  return s.type === 'weapon' || s.type === 'laser';
      if (tab === 'tank')    return s.type === 'tank';
      if (tab === 'pet')     return s.type === 'pet';
      return false;
    });
    items.forEach(item=>{
      content.appendChild(this.buildShopItemEl(item));
    });
    // —— 底部装备概览栏: 坦克/宠物/武器/被动/道具, 从存档读取, 不依赖 player 实例 ——
    const ov = document.getElementById('eq-overview');
    if (ov){
      let html = '';
      // 1) 坦克型号 + 宠物
      const tankDef = TANK_MODELS.find(m => m.id === this.selectedTankId) || TANK_MODELS[0];
      const petDef = PET_DEFS.find(p => p.id === this.selectedPetId);
      html += `<div class="eq-row"><span class="eq-row-label">坦克/宠物</span><div class="eq-chips">`;
      html += `<span class="eq-chip active"><span class="ico">${tankDef.icon}</span>${tankDef.name}</span>`;
      if (petDef) html += `<span class="eq-chip active"><span class="ico">${petDef.icon}</span>${petDef.name}</span>`;
      else html += `<span class="eq-chip">未出战</span>`;
      html += `</div></div>`;
      // 2) 已解锁武器
      const wChips = WEAPONS.filter(w => this.unlockedWeapons.includes(w.id))
        .map(w => `<span class="eq-chip active"><span class="ico">${w.icon}</span>${w.name}</span>`).join('');
      const laserChip = this.laserUnlocked ? `<span class="eq-chip active"><span class="ico">⚡</span>激光主炮</span>` : '';
      html += `<div class="eq-row"><span class="eq-row-label">武器</span><div class="eq-chips">${wChips}${laserChip || '<span class="eq-chip">仅初始炮弹</span>'}</div></div>`;
      // 3) 已装备被动(本局, 从 player 读取; 主菜单时为空)
      const passives = (this.player && this.player.passives) ? this.player.passives : [];
      html += `<div class="eq-row"><span class="eq-row-label">被动</span><div class="eq-slots">`;
      for (let i=0;i<3;i++){
        const p = passives[i];
        const def = p ? PASSIVES.find(x=>x.id===p.id) : null;
        html += def
          ? `<div class="eq-slot"><span class="ico">${def.icon}</span><span class="nm">${def.name}</span></div>`
          : `<div class="eq-slot empty"><span class="nm">空</span></div>`;
      }
      html += `</div></div>`;
      // 4) 背包道具
      const itemChips = ITEMS.map((it, i) => {
        const n = this.savedInventory[i] || 0;
        return n > 0 ? `<span class="eq-chip"><span class="ico">${it.icon}</span>${it.name} ×${n}</span>` : null;
      }).filter(Boolean).join('');
      html += `<div class="eq-row"><span class="eq-row-label">道具</span><div class="eq-chips">${itemChips || '<span class="eq-chip">背包空</span>'}</div></div>`;
      ov.innerHTML = html;
    }
  }

  startLevel(level){
    this.startGame(level);
  }

  /* ---------- 开始/重置游戏 ---------- */
  startGame(level){
    this.resetBattleState(); // 确保从干净状态开始
    const lv = level || 1;
    this.level = lv;
    this.lastStartedLevel = lv;
    this.score = 0;
    this.state = 'playing';
    this.player = new PlayerTank(9, 16);
    // 应用坦克型号(外观/属性/专属神技) + 坦克等级加成
    const selTankId = this.unlockedTanks.includes(this.selectedTankId) ? this.selectedTankId : 0;
    const tdef = TANK_MODELS.find(m => m.id === selTankId) || TANK_MODELS[0];
    this.player.applyTankModel(tdef, this.tankLevels[selTankId] || 1);
    // 应用永久数据:武器解锁(0号初始 + 商店永久解锁)、背包道具(跨局保留)、被动清空(新局)
    this.player.unlockedWeapons = [0, ...this.unlockedWeapons];
    this.player.currentWeapon = 0;
    this.player.passives = [];                       // 新局被动清空(本局通关商店购买/掉落获得)
    this.player.inventory = this.savedInventory.slice();  // 背包从存档恢复(使用时同步回存档)
    this.player.laserUnlocked = this.laserUnlocked;  // 激光主炮解锁状态(渲染/射击用)
    this.baseMaxHp = 100; this.baseHp = 100;          // 基地血量固定100
    // 创建宠物实例(若已装备宠物)
    const petId = this.unlockedPets.includes(this.selectedPetId) ? this.selectedPetId : (this.unlockedPets[0] ?? -1);
    this.pet = this.createPet(petId, this);
    this.hideOverlay();
    this.initLevel();
    this.updateUI();
    this.flashMsg('第 ' + lv + ' 关 · ' + (LEVEL_NAMES[lv-1]||'') + ' 开始!');
  }

  /* ---------- 无尽模式 ---------- */
  startEndless(){
    this.resetBattleState(); // 确保从干净状态开始
    this.endless = true;
    this.endlessWave = 0;
    this.score = 0;
    this.state = 'playing';
    this.player = new PlayerTank(9, 16);
    const selTankId = this.unlockedTanks.includes(this.selectedTankId) ? this.selectedTankId : 0;
    const tdef = TANK_MODELS.find(m => m.id === selTankId) || TANK_MODELS[0];
    this.player.applyTankModel(tdef, this.tankLevels[selTankId] || 1);
    this.player.unlockedWeapons = [0, ...this.unlockedWeapons];
    this.player.currentWeapon = 0;
    this.player.passives = [];
    this.player.inventory = this.savedInventory.slice();
    this.player.laserUnlocked = this.laserUnlocked;
    this.baseMaxHp = 100; this.baseHp = 100;
    // 创建宠物实例(若已装备宠物)
    const petId = this.unlockedPets.includes(this.selectedPetId) ? this.selectedPetId : (this.unlockedPets[0] ?? -1);
    this.pet = this.createPet(petId, this);
    this.hideOverlay();
    this.nextWave();
    this.updateUI();
  }
  // 无尽模式:进入下一波(固定8敌人+1BOSS,属性随波次提升)
  nextWave(){
    this.endlessWave++;
    if (this.endlessWave > this.endlessMaxWave){
      this.endlessMaxWave = this.endlessWave;
      this.saveEndlessMax();
    }
    // 每波奖励积分(递增)
    const bonus = 50 + this.endlessWave * 30;
    this.addCredits(bonus);
    this.initLevel();
    if (this.endlessWave > 1){
      this.flashMsg('第 ' + (this.endlessWave-1) + ' 波清除! +' + bonus + '🪙 · 第 ' + this.endlessWave + ' 波开始!');
    } else {
      this.flashMsg('无尽模式开始! 第 1 波 · 固定8敌人+BOSS · 刷积分!');
    }
    this.updateUI();
  }

  resetGame(){
    // R键:返回主菜单(积分/装备/解锁均保留)
    this.showMenu();
  }

  /* ---------- 关卡初始化 ---------- */
  initLevel(){
    this.enemies = [];
    this.bullets = [];
    this.lasers = [];
    this.particles = [];
    this.drops = [];
    this.chests = [];
    this.mines = [];
    this.boss = null;
    this.bossSpawned = false;
    this.freezeTimer = 0;
    this.baseHp = this.baseMaxHp;
    this.generateMap();
    // 敌人数量:无尽模式固定8个(质量随波次提升),普通模式随关卡增加
    this.enemiesToSpawn = this.endless ? 8 : (6 + this.level*2);
    this.spawnTimer = 0;
    // 重置玩家位置与状态(基地上方,避免与基地/保护墙重叠)
    this.player.cx = 9*TILE+TILE/2; this.player.cy = 16*TILE+TILE/2;
    this.player.x = this.player.cx-this.player.w/2;
    this.player.y = this.player.cy-this.player.h/2;
    this.player.dir = DIR.UP;
    this.player.hp = this.player.maxHp;   // 每关开始满血
    this.player.dead = false;
    this.player.respawnDelay = 0;         // 清除可能的复活倒计时
    this.player.invuln = 2500;
    this.player.spawnFlash = 20;
    this.player.attackCount = 0;          // 重置激光充能
    this.updateUI();
  }

  /* ---------- 地图生成(核心:QGC砖墙字母) ---------- */
  generateMap(){
    this.grid = [];
    for (let r=0;r<ROWS;r++){
      const row = [];
      for (let c=0;c<COLS;c++) row.push({ type:T.EMPTY, hp:0 });
      this.grid.push(row);
    }

    // 1) 边界钢墙(美观+阻挡)—— 仅左右两侧少量,保持开放
    // 2) 中央 QGC 字母(只用砖墙)—— 原创标识
    // 字母点阵:5宽7高,放在 row 4-10
    const Q = [
      [0,1,1,1,0],
      [1,0,0,0,1],
      [1,0,0,0,1],
      [1,0,0,0,1],
      [1,0,1,0,1],
      [1,1,0,0,1],
      [0,1,1,1,1],
    ];
    const G = [
      [0,1,1,1,0],
      [1,0,0,0,0],
      [1,0,0,0,0],
      [1,0,0,1,1],
      [1,0,0,0,1],
      [1,0,0,0,1],
      [0,1,1,1,0],
    ];
    const C = [
      [0,1,1,1,0],
      [1,0,0,0,1],
      [1,0,0,0,0],
      [1,0,0,0,0],
      [1,0,0,0,0],
      [1,0,0,0,1],
      [0,1,1,1,0],
    ];
    const letters = [Q, G, C];
    const startCol = 2;   // 字母起始列
    const letterW = 5;
    const gap = 1;        // 字母间隔
    const startRow = 4;
    letters.forEach((letter, li) => {
      const baseC = startCol + li*(letterW+gap);
      for (let r=0;r<letter.length;r++){
        for (let c=0;c<letter[r].length;c++){
          if (letter[r][c]){
            const cc = baseC+c, rr = startRow+r;
            if (cc<COLS && rr<ROWS){
              this.grid[rr][cc] = { type:T.BRICK, hp:60 };
            }
          }
        }
      }
    });

    // 3) 基地区域(底部中央)—— 基地+周围砖墙保护
    const baseC = 9, baseR = 18;
    this.grid[baseR][baseC] = { type:T.BASE, hp:100 };
    // 基地四周砖墙
    const protect = [[baseC-1,baseR-1],[baseC,baseR-1],[baseC+1,baseR-1],[baseC-1,baseR],[baseC+1,baseR]];
    protect.forEach(([c,r])=>{ if(c>=0&&c<COLS&&r>=0&&r<ROWS) this.grid[r][c]={type:T.BRICK,hp:60}; });

    // 4) 随机地形:钢墙/水/草/冰(避开QGC字母区和基地区)
    const reserved = (c,r) => {
      // QGC字母区 row4-10 col2-18
      if (r>=4 && r<=10 && c>=2 && c<=18) return true;
      // 基地区
      if (r>=16 && c>=7 && c<=12) return true;
      // 顶部出生区
      if (r<=1) return true;
      // 玩家区
      if (r>=16 && c>=7 && c<=11) return true;
      return false;
    };
    const terrainCount = 14 + this.level*2;
    for (let i=0;i<terrainCount;i++){
      const c = Util.randInt(1,COLS-2), r = Util.randInt(2,ROWS-3);
      if (reserved(c,r)) continue;
      if (this.grid[r][c].type !== T.EMPTY) continue;
      const t = Util.pick([T.STEEL, T.WATER, T.GRASS, T.ICE, T.BRICK, T.BRICK]);
      this.grid[r][c] = { type:t, hp: t===T.BRICK?60:(t===T.STEEL?9999:0) };
    }

    // 5) 随机宝箱
    const chestCount = 2 + Math.floor(this.level/2);
    for (let i=0;i<chestCount;i++){
      const c = Util.randInt(2,COLS-3), r = Util.randInt(3,15);
      if (this.grid[r][c].type === T.EMPTY && !reserved(c,r)){
        this.grid[r][c].type = T.EMPTY;
        this.chests.push(new Chest(c,r));
      }
    }

    // 6) 随机地雷
    const mineCount = 2 + this.level;
    for (let i=0;i<mineCount;i++){
      const c = Util.randInt(2,COLS-3), r = Util.randInt(5,16);
      if (this.grid[r][c].type === T.EMPTY && !reserved(c,r)){
        this.mines.push(new Mine(c,r));
      }
    }
  }

  /* ---------- 敌人生成 ---------- */
  spawnEnemy(){
    if (this.enemiesToSpawn <= 0) return;
    const freePts = this.spawnPoints.filter(p => !this.isSpawnOccupied(p));
    if (freePts.length === 0) return;  // 无空位,稍后再刷
    const pt = Util.pick(freePts);
    // 敌人类型池:无尽模式全部可用,普通模式按关卡解锁
    let def;
    if (this.endless){
      // 无尽模式:全部敌人类型,高波次更多强敌
      const pool = [ENEMY_TYPES[0]];
      if (this.endlessWave >= 2) pool.push(ENEMY_TYPES[1]);
      if (this.endlessWave >= 3) pool.push(ENEMY_TYPES[2], ENEMY_TYPES[3]);
      if (this.endlessWave >= 4) pool.push(ENEMY_TYPES[4]);
      // 高波次(5+)增加强敌权重
      if (this.endlessWave >= 5) pool.push(ENEMY_TYPES[2], ENEMY_TYPES[3], ENEMY_TYPES[4]);
      def = Util.pick(pool);
      const e = new EnemyTank(pt.c, pt.r, def, 1, this.endlessWave);
      this.resolveSpawnOverlap(e);
      this.enemies.push(e);
      this.enemiesToSpawn--;
    } else {
      const pool = [ENEMY_TYPES[0]];
      if (this.level >= 2) pool.push(ENEMY_TYPES[1]);
      if (this.level >= 3) pool.push(ENEMY_TYPES[2], ENEMY_TYPES[3]);
      if (this.level >= 4) pool.push(ENEMY_TYPES[4]);
      def = Util.pick(pool);
      const e = new EnemyTank(pt.c, pt.r, def, this.level);
      this.resolveSpawnOverlap(e);
      this.enemies.push(e);
      this.enemiesToSpawn--;
    }
  }
  isSpawnOccupied(pt){
    const x = pt.c*TILE+TILE/2, y = pt.r*TILE+TILE/2;
    for (const e of this.enemies){
      if (!e.dead && Util.dist(x,y,e.cx,e.cy) < TILE) return true;
    }
    // 也避开玩家出生区域,防止一刷出来就粘玩家
    if (this.player && !this.player.dead && Util.dist(x,y,this.player.cx,this.player.cy) < TILE*3) return true;
    return false;
  }
  // 放置新坦克后若和已有坦克重叠 → 微调找最近的空位
  resolveSpawnOverlap(newTank){
    const others = [this.player, ...this.enemies, this.boss].filter(t=>t && t!==newTank && !t.dead);
    let tries = 0;
    const startX = newTank.x, startY = newTank.y;
    const w = newTank.w, h = newTank.h;
    while (tries < 60){
      let overlap = false;
      for (const o of others){
        if (Util.rectsHit(newTank.rect, o.rect)){ overlap = true; break; }
      }
      if (!overlap) return;
      // 螺旋搜索:按角度向外扩散搜索8个方向+各距离
      tries++;
      const ang = (tries * 37) % 360 * Math.PI / 180;
      const r = TILE * 0.5 * (1 + Math.floor(tries/8));
      const tx = Util.clamp(startX + Math.cos(ang)*r, 0, W-w);
      const ty = Util.clamp(startY + Math.sin(ang)*r, 0, H-h);
      // 地形检查(不卡进墙里)
      const c0=Util.toCell(tx), c1=Util.toCell(tx+w-1);
      const r0=Util.toCell(ty), r1=Util.toCell(ty+h-1);
      let terrainOK = true;
      for (let cy=r0; cy<=r1 && terrainOK; cy++){
        for (let cx=c0; cx<=c1 && terrainOK; cx++){
          if (cx<0||cx>=COLS||cy<0||cy>=ROWS){ terrainOK=false; break; }
          const t = this.grid[cy][cx].type;
          if (t===T.BRICK||t===T.STEEL||t===T.WATER||t===T.BASE) terrainOK=false;
        }
      }
      if (terrainOK){
        newTank.x = tx; newTank.y = ty;
        newTank.cx = tx + w/2; newTank.cy = ty + h/2;
      }
    }
  }

  // 所有坦克每帧全局重叠分离:双轴尝试+剩余量由另一方承担,避免黏连
  resolveTankSeparation(){
    const tanks = [this.player, ...this.enemies, this.boss].filter(t=>t && !t.dead);
    for (let iter=0; iter<10; iter++){
      let anyHit = false;
      for (let i=0;i<tanks.length;i++){
        for (let j=i+1;j<tanks.length;j++){
          const a = tanks[i], b = tanks[j];
          if (!Util.rectsHit(a.rect, b.rect)) continue;
          anyHit = true;
          const overlapX = Math.min(a.x+a.w, b.x+b.w) - Math.max(a.x, b.x);
          const overlapY = Math.min(a.y+a.h, b.y+b.h) - Math.max(a.y, b.y);
          if (overlapX <= 0 || overlapY <= 0) continue;

          // 优先尝试"最小重叠"的轴;如果推不开就换另一轴
          const axes = overlapX < overlapY
            ? [ ['x', overlapX], ['y', overlapY] ]
            : [ ['y', overlapY], ['x', overlapX] ];

          let done = false;
          for (const [axis, overlapTotal] of axes){
            const needed = overlapTotal * 1.05;
            // 方向: a 推到 b 的哪一边
            let dirA;
            if (axis === 'x') dirA = a.x + a.w/2 < b.x + b.w/2 ? -1 : 1;
            else              dirA = a.y + a.h/2 < b.y + b.h/2 ? -1 : 1;

            const half = needed * 0.5;
            const ma = (axis==='x') ? this._tryPush1D(a, half*dirA, 0)
                                    : this._tryPush1D(a, 0, half*dirA);
            const mb = (axis==='x') ? this._tryPush1D(b, half*-dirA, 0)
                                    : this._tryPush1D(b, 0, half*-dirA);

            const remain = needed - (Math.abs(ma) + Math.abs(mb));
            if (remain > 0.1){
              // 另一方没推够的,由这一方尽量多承担(即使原先只分到一半)
              if (axis === 'x'){
                const exA = this._tryPush1D(a, remain*dirA, 0);
                if (Math.abs(exA) < 0.1) this._tryPush1D(b, remain*-dirA, 0);
              } else {
                const exA = this._tryPush1D(a, 0, remain*dirA);
                if (Math.abs(exA) < 0.1) this._tryPush1D(b, 0, remain*-dirA);
              }
            }
            // 如果这对现在已经分离,跳过下一轴
            if (!Util.rectsHit(a.rect, b.rect)){ done = true; break; }
          }
        }
      }
      if (!anyHit) break;
    }
  }
  // 单轴1D平移,返回实际成功移动的有符号距离
  _tryPush1D(t, dx, dy){
    const sx = Math.sign(dx), sy = Math.sign(dy);
    let remain = Math.max(Math.abs(dx), Math.abs(dy));
    let moved = 0;
    if (remain < 0.01) return 0;
    // [v60修复] 非有限值直接跳出;加迭代次数上限(2000),防止极端情况下卡死
    if (!isFinite(remain)) return 0;
    let iter = 0;
    const ITER_MAX = 2000;
    while (remain >= 0.01 && iter < ITER_MAX){
      iter++;
      const step = Math.min(remain, 1.5);
      if (!isFinite(step)) break;
      const nx = Util.clamp(t.x + sx*step, 0, W-t.w);
      const ny = Util.clamp(t.y + sy*step, 0, H-t.h);
      const c0=Util.toCell(nx), c1=Util.toCell(nx+t.w-1);
      const r0=Util.toCell(ny), r1=Util.toCell(ny+t.h-1);
      let ok = true;
      if (!isFinite(c0)||!isFinite(c1)||!isFinite(r0)||!isFinite(r1)) break;
      for (let cy=r0; cy<=r1 && ok; cy++){
        for (let cx=c0; cx<=c1 && ok; cx++){
          if (cx<0||cx>=COLS||cy<0||cy>=ROWS){ ok=false; break; }
          const row = this.grid[cy];
          if (!row){ ok=false; break; }
          const cell = row[cx];
          if (!cell){ ok=false; break; }
          const tp = cell.type;
          if (tp===T.BRICK||tp===T.STEEL||tp===T.WATER||tp===T.BASE) ok=false;
        }
      }
      if (!ok) break;
      t.x = nx; t.y = ny; moved += step; remain -= step;
    }
    t.cx = t.x + t.w/2; t.cy = t.y + t.h/2;
    return moved * (dx !== 0 ? sx : sy);
  }
  _rectTerrainFree(r){
    const c0=Util.toCell(r.x), c1=Util.toCell(r.x+r.w-1);
    const r0=Util.toCell(r.y), r1=Util.toCell(r.y+r.h-1);
    for (let cy=r0; cy<=r1; cy++){
      for (let cx=c0; cx<=c1; cx++){
        if (cx<0||cx>=COLS||cy<0||cy>=ROWS) return false;
        const t = this.grid[cy][cx].type;
        if (t===T.BRICK || t===T.STEEL || t===T.WATER || t===T.BASE) return false;
      }
    }
    return true;
  }

  findNearestEnemy(x,y){
    let best=null, bd=1e9;
    for (const e of this.enemies){ if(e.dead) continue; const d=Util.dist(x,y,e.cx,e.cy); if(d<bd){bd=d;best=e;} }
    if (this.boss && !this.boss.dead){ const d=Util.dist(x,y,this.boss.cx,this.boss.cy); if(d<bd){bd=d;best=this.boss;} }
    return best;
  }

  /* ---------- 事件回调 ---------- */
  // 检查并保存新高分(实时保护,防止中途退出丢失)
  checkHighScore(){
    if (this.score > this.highScore){
      this.highScore = this.score;
      this.saveHighScore();
    }
  }
  onEnemyKilled(enemy){
    this.score += enemy.score;
    this.checkHighScore(); // 实时保存新高分
    // 宠物获取经验:exp = 敌人分值 × 1,最高Lv10
    if (this.pet && this.pet.level < 10) this.pet.addExp(enemy.score, this);
    // 战场回收装置:击杀积分+20%
    let cred = enemy.score;
    if (this.player && this.player.hasPassive('salvage')) cred = Math.floor(cred*1.2);
    this.addCredits(cred);
    this.spawnExplosion(enemy.cx, enemy.cy, 35);
    // 随机掉落
    if (Util.chance(0.35)) this.spawnDrop(enemy.cx, enemy.cy);
    this.updateUI();
  }
  onBossKilled(){
    const bx = this.boss.cx, by = this.boss.cy, bs = this.boss.score;
    this.score += bs;
    this.checkHighScore(); // 实时保存新高分
    // BOSS宠物经验加成:exp = BOSS分值 × 1.2(保底不低于50)
    if (this.pet && this.pet.level < 10){
      const bossExp = Math.max(50, Math.floor(bs * 1.2));
      this.pet.addExp(bossExp, this);
    }
    // 战场回收装置:击杀积分+20%
    let cred = bs;
    if (this.player && this.player.hasPassive('salvage')) cred = Math.floor(cred*1.2);
    this.addCredits(cred);
    this.spawnExplosion(bx, by, 80);
    this.spawnExplosion(bx+20, by, 50);
    this.spawnExplosion(bx-20, by, 50);
    this.shake = 20;
    // BOSS掉落多件
    for (let i=0;i<3;i++) this.spawnDrop(bx+Util.rand(-30,30), by+Util.rand(-30,30));
    this.boss = null;
    this.updateUI();
  }
  onChestBroken(chest){
    this.spawnExplosion(chest.cx, chest.cy, 25);
    // 宝箱掉落:第1件有概率掉未解锁武器(永久解锁),第2件普通掉落
    this.spawnDrop(chest.cx, chest.cy, { fromChest:true });
    this.spawnDrop(chest.cx, chest.cy, { fromChest:true });
  }
  damageBase(dmg){
    const wasAlive = this.baseHp > 0;
    this.baseHp -= dmg;
    this.shake = Math.max(this.shake, 8);
    this.spawnSparks(9*TILE+TILE/2, 18*TILE+TILE/2, '#06b6d4', 12);
    if (wasAlive && this.baseHp <= 0){
      this.baseHp = 0;
      // 基地被摧毁 —— 毁灭性爆炸 + 直接GameOver
      this.shake = Math.max(this.shake, 25);
      this.spawnExplosion(9*TILE+TILE/2, 18*TILE+TILE/2, 80);
      setTimeout(()=>{ this.spawnExplosion(9*TILE, 18*TILE, 50); this.shake = Math.max(this.shake,14); }, 150);
      setTimeout(()=>{ this.spawnExplosion(10*TILE, 18*TILE, 50); this.shake = Math.max(this.shake,14); }, 250);
      setTimeout(()=>{ this.spawnExplosion(9*TILE+TILE/2, 17*TILE+TILE/2, 45); }, 350);
      setTimeout(()=>{ this.gameOver(); }, 700);
    }
    this.updateUI();
  }

  /* ---------- 掉落物生成 ---------- */
  spawnDrop(x,y, opts){
    opts = opts || {};
    const r = Math.random();
    let kind, id;
    // —— 宝箱专属:有概率掉落未解锁武器(永久解锁,商店外另一条解锁路径) ——
    if (opts.fromChest){
      const lockedWeapons = WEAPONS.filter(w => w.id >= 1 && !this.unlockedWeapons.includes(w.id));
      if (lockedWeapons.length > 0 && r < 0.25){
        kind = 'weapon_unlock';
        id = Util.pick(lockedWeapons).id;
        this.drops.push(new Drop(x,y,kind,id));
        return;
      }
    }
    // 武器掉落:仅永久解锁的武器(宝箱才会掉,未解锁则转为被动)
    if (r < 0.35){
      const pool = this.unlockedWeapons.slice(); // 永久解锁(不含0号初始)
      if (pool.length > 0){ kind='weapon'; id = Util.pick(pool); }
      else { kind='passive'; id = Util.pick(PASSIVES).id; }
    } else if (r < 0.65){ kind='passive'; id = Util.pick(PASSIVES).id; }
    else if (r < 0.85){ kind='item'; id = Util.randInt(0, ITEMS.length-1); }
    else { kind='buff'; id = Util.pick(['power','speed','crit']); }
    this.drops.push(new Drop(x,y,kind,id));
  }

  // 玩家拾取掉落物
  pickupDrop(drop){
    if (drop.kind === 'weapon_unlock'){
      // 永久解锁新武器(写入localStorage,跨局/跨关保留)
      const wdef = WEAPONS[drop.id];
      const wasLocked = !this.unlockedWeapons.includes(drop.id);
      if (wasLocked){
        this.unlockedWeapons.push(drop.id);
        this.saveUnlockedWeapons();
      }
      // 同步到玩家本局可用武器列表
      if (this.player && !this.player.unlockedWeapons.includes(drop.id)){
        this.player.unlockedWeapons.push(drop.id);
      }
      if (this.player) this.player.currentWeapon = drop.id;
      // 解锁特效:金色粒子爆发
      if (this.player){
        this.spawnSparks(this.player.cx, this.player.cy, '#fbbf24', 24);
        this.spawnSparks(this.player.cx, this.player.cy, '#fde68a', 14);
        this.spawnExplosion(this.player.cx, this.player.cy, 30);
        this.shake = Math.max(this.shake, 8);
      }
      this.flashMsg('🔒 解锁新武器: ' + wdef.name + ' (永久保留!)');
    } else if (drop.kind === 'weapon'){
      if (!this.player.unlockedWeapons.includes(drop.id)){
        this.player.unlockedWeapons.push(drop.id);
      }
      this.player.currentWeapon = drop.id;
      this.flashMsg('获得武器: ' + WEAPONS[drop.id].name);
    } else if (drop.kind === 'passive'){
      const def = PASSIVES.find(p=>p.id===drop.id);
      if (this.player.hasPassive(drop.id)){
        this.score += 50; this.flashMsg('已装备该被动 +50分');
      } else {
        if (this.player.passives.length >= 3) this.player.passives.shift(); // 替换最早的
        this.player.passives.push({ id:drop.id });
        this.flashMsg('装备: ' + (def?def.name:drop.id));
      }
    } else if (drop.kind === 'item'){
      this.player.inventory[drop.id] = Math.min(9, this.player.inventory[drop.id]+1);
      this.savedInventory = this.player.inventory.slice(); // 同步存档(跨局保留)
      this.saveInventory();
      this.flashMsg('获得道具: ' + ITEMS[drop.id].name);
    } else if (drop.kind === 'buff'){
      const time = 8000;
      const names = { power:'火力激增', speed:'移速提升', crit:'暴击双倍' };
      this.player.addBuff(drop.id, time);
      this.flashMsg('Buff: ' + names[drop.id]);
    }
    this.updateUI();
  }

  /* ---------- 主动道具使用 ---------- */
  useActiveItem(){
    // 找第一个有存量的道具
    for (let i=0;i<this.player.inventory.length;i++){
      if (this.player.inventory[i] > 0){
        this.activateItem(i);
        return;
      }
    }
    this.flashMsg('没有可用道具');
  }
  activateItem(idx){
    this.player.inventory[idx]--;
    this.savedInventory = this.player.inventory.slice(); // 同步存档(跨局保留)
    this.saveInventory();
    const item = ITEMS[idx];
    this.flashMsg('使用: ' + item.name);
    if (idx === 0){ // 应急维修包:恢复50血
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 50);
      this.spawnSparks(this.player.cx,this.player.cy,'#4ade80',15);
    } else if (idx === 1){ // 全域冰冻弹:冻结全场4秒
      this.freezeTimer = item.duration;
      for (const e of this.enemies) this.spawnSparks(e.cx,e.cy,'#67e8f9',6);
    } else if (idx === 2){ // 战术空袭:清屏伤BOSS
      this.airstrikeTimer = 60;
    } else if (idx === 3){ // 短时过载护盾:6秒无敌
      this.player.invuln = item.duration;
    } else if (idx === 4){ // 火力增幅药剂:10秒火力+50%
      this.player.addBuff('power', item.duration);
      this.spawnSparks(this.player.cx,this.player.cy,'#f97316',12);
    }
    this.updateUI();
  }

  /* ---------- 按键处理(单次触发) ---------- */
  onKeyPress(k){
    if (this.state === 'loading') return;
    // 数字键切换武器(仅游戏中,1-8普通武器,9激光主炮)
    if (k >= '1' && k <= '8' && this.state === 'playing'){
      const idx = parseInt(k)-1;
      if (this.player && this.player.unlockedWeapons.includes(idx)){
        this.player.currentWeapon = idx;
        this.updateUI();
      }
    }
    // 9键:切换到激光主炮(需解锁)
    if (k === '9' && this.state === 'playing'){
      if (this.player && this.player.laserUnlocked){
        this.player.currentWeapon = 8;
        this.updateUI();
      }
    }
    if (k === 'q' && this.state === 'playing'){ this.useActiveItem(); }
    // E键:宠物技能(前摇0.3s-生效-后摇0.2s三段判定,无宠物时提示)
    if (k === 'e' && this.state === 'playing'){
      if (this.pet){
        const ok = this.pet.tryCastSkill(this);
        if (!ok && this.pet.skillCd > 0){ /* toast 已在 tryCastSkill 内弹出 */ }
      } else {
        this.flashMsg('当前未装备宠物,可去车库选择(E:宠物技能)');
      }
    }
    // F键:释放玩家坦克专属神技(若无则提示)
    if (k === 'f' && this.state === 'playing'){ if (this.player) this.player.tryUseSkill(this); }
    // B键:战斗中打开商店(暂停),商店打开时关闭
    if (k === 'b'){
      if (this.shopOpen) this.closeShop();
      else if (this.state === 'playing') this.openShop('playing');
    }
    // [v58修复] ESC键关闭商店
    if (k === 'escape' && this.shopOpen) this.closeShop();
    if (k === 'p' && !this.shopOpen && (this.state === 'playing' || this.state === 'paused')){ this.togglePause(); }
    if (k === 'r' && !this.shopOpen){ this.resetGame(); }
  }

  togglePause(){
    if (this.state === 'playing'){
      this.state = 'paused';
      this.showView('pause');
    } else if (this.state === 'paused'){
      this.state = 'playing';
      this.hideOverlay();
    }
  }

  /* ---------- 游戏结束/通关 ---------- */
  gameOver(){
    this.state = 'gameover';
    if (this.score > this.highScore){ this.highScore = this.score; this.saveHighScore(); }
    if (this.endless){
      // 无尽模式结束:显示波次和积分收益
      const wasNewRecord = this.endlessWave >= this.endlessMaxWave;
      this.showResult('无尽模式结束', 'lose',
        `坚持到第 <b style="color:#a855f7">${this.endlessWave}</b> 波<br>` +
        `最终得分: <b style="color:#fbbf24">${this.score}</b><br>` +
        `最高分: ${this.highScore}<br>` +
        `当前积分: <b style="color:#67e8f9">${this.credits}</b>🪙(已累积,可去商城消费)<br>` +
        (wasNewRecord ? `<b style="color:#fbbf24">🏆 创下新纪录!</b>` : `历史最高: ${this.endlessMaxWave} 波`),
        { showRetry:true, showMenu:true });
      // 不在此重置 endless,让 retry-btn 能判断模式;在 startGame/showMenu 中重置
    } else {
      this.showResult('游戏结束', 'lose',
        `基地被毁或坦克全毁<br>最终得分: <b style="color:#fbbf24">${this.score}</b><br>最高分: ${this.highScore}<br>到达关卡: ${this.level}<br>当前积分: <b style="color:#67e8f9">${this.credits}</b>🪙(可去商城消费)`,
        { showRetry:true, showMenu:true });
    }
  }
  nextLevel(){
    // 记录刚通关的关卡
    const cleared = this.level;
    if (!this.clearedLevels.includes(cleared)){
      this.clearedLevels.push(cleared);
      this.saveCleared();
    }
    // 通关奖励:分数 + 积分
    this.score += 200;
    this.addCredits(150);
    // 解锁下一关
    if (cleared < MAX_LEVEL){
      this.unlockedLevels = Math.max(this.unlockedLevels, cleared + 1);
      this.saveUnlocked();
    }
    // 最后一关 → 全部通关胜利结局
    if (cleared >= MAX_LEVEL){
      this.state = 'win';
      if (this.score > this.highScore){ this.highScore = this.score; this.saveHighScore(); }
      this.showResult('全部通关!', 'win',
        `恭喜击败全部 ${MAX_LEVEL} 关!<br>最终得分: <b style="color:#fbbf24">${this.score}</b><br>当前积分: <b style="color:#67e8f9">${this.credits}</b>🪙<br>可在商城强化后再战`,
        { showRetry:true, showMenu:true });
      this.renderLevelGrid();
      return;
    }
    // 通关单关 → 显示结果界面(继续下一关 / 退出到首页)
    this.state = 'win'; // 临时设为win以冻结背景
    this._levelCleared = cleared; // 记录已通关关卡,供"继续下一关"按钮使用
    this.showResult('通关第 ' + cleared + ' 关!', 'win',
      `成功通关第 ${cleared} 关!<br>获得奖励: +200分 · +150🪙<br>累计得分: <b style="color:#fbbf24">${this.score}</b><br>当前积分: <b style="color:#67e8f9">${this.credits}</b>🪙<br>下一关: ${LEVEL_NAMES[cleared]||('第'+(cleared+1)+'关')}`,
      { showNext:true, showMenu:true });
  }

  // "继续下一关"按钮:先开商店(可购买强化),关闭后进入下一关
  proceedNextLevel(){
    this.state = 'paused';
    this._frozen = false; // 解冻渲染
    this.flashMsg('商店已开启 · 购买后进入下一关');
    this.openShop('level');
  }

  // 统一结果视图(显示在 view-result)
  // opts: { showRetry, showNext, showMenu } 控制按钮显示
  showResult(title, cls, html, opts){
    if (typeof opts === 'boolean') opts = { showRetry: opts, showMenu: opts }; // 兼容旧调用
    opts = opts || {};
    this.showView('result');
    const t = document.getElementById('result-title');
    t.textContent = title;
    t.className = cls || '';
    document.getElementById('result-text').innerHTML = html;
    document.getElementById('next-level-btn').style.display = opts.showNext  ? '' : 'none';
    document.getElementById('retry-btn').style.display      = opts.showRetry ? '' : 'none';
    document.getElementById('back-menu-btn').style.display  = opts.showMenu  ? '' : 'none';
  }

  // 兼容旧调用(showOverlay) —— 转发到 result 视图,不显示按钮
  showOverlay(title, text, cls){
    this.showResult(title, cls, text, false);
  }

  flashMsg(msg){
    // 简易消息提示(用overlay-text临时显示会冲突,改用单独toast)
    if (!this.toastEl){
      this.toastEl = document.createElement('div');
      this.toastEl.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);background:rgba(0,255,224,0.9);color:#04101a;padding:8px 20px;border-radius:6px;font-weight:700;z-index:2000;font-size:14px;box-shadow:0 0 20px rgba(0,255,224,0.6);transition:opacity .3s;';
      document.body.appendChild(this.toastEl);
    }
    this.toastEl.textContent = msg;
    this.toastEl.style.opacity = '1';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(()=>{ this.toastEl.style.opacity='0'; }, 1500);
  }

  /* ---------- 特效生成 ---------- */
  spawnExplosion(x,y,radius){
    // —— 防卡机:根据粒子压力自动缩减爆炸强度(粒子越多越少生成) ——
    const pressure = this.particles.length / Math.max(1, this.MAX_PARTICLES);
    let mul = 1.0;
    if (pressure >= 0.95) mul = 0.0;          // 快爆仓了:不生成(保留最基础白闪和震屏)
    else if (pressure >= 0.85) mul = 0.18;
    else if (pressure >= 0.70) mul = 0.45;
    else if (pressure >= 0.50) mul = 0.75;

    // 0. 瞬时光晕(径向渐变一次性绘制用粒子近似 —— 大尺寸低寿命白色闪光)
    if (mul > 0){
      const flashR = Math.max(18, radius*0.9);
      const p = new Particle(x,y, 0,0, 'rgba(255,255,240,0.9)', 6, flashR);
      this.particles.push(p);
    }
    if (mul <= 0){
      // 只保留震屏,直接返回
      this.shake = Math.max(this.shake, Math.min(24, Math.floor(radius/7 + (radius>=50?6:0))));
      return;
    }
    // 1. 核心火球(大) 橙黄红渐变粒子
    const f1 = Math.max(1, Math.floor(radius * 0.8 * mul));
    for (let i=0;i<f1;i++){
      const ang = Math.random()*Math.PI*2;
      const sp = Util.rand(1.0, 4.2) * (0.7 + radius/80);
      const colors = ['#fbbf24','#ef4444','#f97316','#fff','#fef3c7','#fde68a'];
      const part = new Particle(x,y, Math.cos(ang)*sp, Math.sin(ang)*sp, Util.pick(colors), Util.randInt(22,48), Util.rand(5,10));
      part.vy += 0.05;
      this.particles.push(part);
    }
    // 2. 外圈金属碎片(坦克摧毁视觉)
    const f2 = Math.max(0, Math.floor(radius * 0.6 * mul));
    for (let i=0;i<f2;i++){
      const ang = Math.random()*Math.PI*2;
      const sp = Util.rand(3, 7) * (0.8 + radius/60);
      const colors = ['#78350f','#991b1b','#44403c','#525252','#6b7280','#374151'];
      const size = Util.rand(2,5);
      const part = new Particle(x,y, Math.cos(ang)*sp, Math.sin(ang)*sp, Util.pick(colors), Util.randInt(22,48), size);
      part.gravity = 0.1;
      this.particles.push(part);
    }
    // 3. 冲击环(淡色扩散) —— 两圈不同颜色(压力高就只画 1 圈)
    const ringPass = pressure >= 0.65 ? 1 : 2;
    for (let pass=0;pass<ringPass;pass++){
      const baseSpeed = radius/11 + pass*0.5;
      const ringColor = pass === 0 ? 'rgba(255,220,150,0.75)' : 'rgba(255,120,60,0.35)';
      const segs = Math.max(8, Math.floor((16 + (pass===0?4:0)) * mul));
      for (let i=0;i<segs;i++){
        const ang = (i/segs)*Math.PI*2 + (pass===1?0.12:0);
        const sp = baseSpeed * Util.rand(0.9, 1.1);
        this.particles.push(new Particle(x,y, Math.cos(ang)*sp, Math.sin(ang)*sp, ringColor, Util.randInt(12, 20 + pass*4), 4 + pass*2));
      }
    }
    // 4. 向外辐射的火星(细粒高亮度)
    const f4 = Math.max(0, Math.floor(radius * 0.5 * mul));
    for (let i=0;i<f4;i++){
      const ang = Math.random()*Math.PI*2;
      const sp = Util.rand(4, 9);
      this.particles.push(new Particle(x,y, Math.cos(ang)*sp, Math.sin(ang)*sp, 'rgba(255,230,150,0.9)', Util.randInt(8,16), 2));
    }
    // 5. 烟雾(慢速上升+逐渐变大) —— 两层
    const f5 = Math.max(0, Math.floor(radius * 0.5 * mul));
    for (let i=0;i<f5;i++){
      const ang = Math.random()*Math.PI*2;
      const sp = Util.rand(0.3, 1.1);
      const offX = Util.rand(-8,8), offY = Util.rand(-8,8);
      const color = Util.chance(0.5) ? 'rgba(60,60,60,0.65)' : 'rgba(130,130,130,0.5)';
      const size = Util.rand(6, 12);
      const life = Util.randInt(44, 72);
      this.particles.push(new Particle(x+offX, y+offY, Math.cos(ang)*sp, -Math.abs(Math.sin(ang)*sp)-0.4, color, life, size));
    }
    // 震屏强度与爆炸半径正相关
    this.shake = Math.max(this.shake, Math.min(24, Math.floor(radius/7 + (radius>=50?6:0))));
  }
  spawnSparks(x,y,color,n){
    // 压力高时减半/取消火花
    const pressure = this.particles.length / Math.max(1, this.MAX_PARTICLES);
    if (pressure >= 0.95) return;
    if (pressure >= 0.75) n = Math.max(1, Math.floor(n * 0.28));
    else if (pressure >= 0.55) n = Math.max(1, Math.floor(n * 0.55));
    for (let i=0;i<n;i++){
      const ang = Math.random()*Math.PI*2;
      const sp = Util.rand(1,3);
      this.particles.push(new Particle(x,y, Math.cos(ang)*sp, Math.sin(ang)*sp, color, Util.randInt(10,20), 2));
    }
  }
  spawnBrickDebris(cx,cy){
    // 压力高时减少砖瓦碎片
    const pressure = (this.brickDebris ? this.brickDebris.length : 0) / Math.max(1, this.MAX_DEBRIS)
                   + this.particles.length / Math.max(1, this.MAX_PARTICLES);
    let n = 6;
    if (pressure >= 1.2) return;
    if (pressure >= 0.9) n = 1;
    else if (pressure >= 0.7) n = 2;
    else if (pressure >= 0.5) n = 4;
    const x = cx*TILE+TILE/2, y = cy*TILE+TILE/2;
    for (let i=0;i<n;i++){
      const ang = Math.random()*Math.PI*2;
      const sp = Util.rand(1,2.5);
      this.particles.push(new Particle(x,y, Math.cos(ang)*sp, Math.sin(ang)*sp, '#b45309', Util.randInt(15,25), 3));
    }
  }
  muzzleFlash(x,y){
    for (let i=0;i<4;i++){
      const ang = Math.random()*Math.PI*2;
      this.particles.push(new Particle(x,y, Math.cos(ang)*1.5, Math.sin(ang)*1.5, '#fff', 8, 3));
    }
  }

  /* ---------- 主更新 ---------- */
  update(dt){
    if (this.state !== 'playing') return;

    if (this.freezeTimer > 0) this.freezeTimer -= dt;

    // 玩家
    if (this.player) this.player.update(dt, this);

    // 宠物
    if (this.pet) this.pet.update(dt, this);

    // 敌人
    this.enemies.forEach(e => e.update(dt, this));
    this.enemies = this.enemies.filter(e => !e.dead);

    // BOSS
    if (this.boss) this.boss.update(dt, this);

    // 坦克黏连全局分离通道(每帧所有坦克两两检查重叠,主动推开,防止卡在一起)
    this.resolveTankSeparation();

    // 子弹
    this.bullets.forEach(b => b.update(dt, this));
    this.bullets = this.bullets.filter(b => !b.dead);
    if (this.bullets.length > this.MAX_BULLETS){
      this.bullets.splice(0, this.bullets.length - this.MAX_BULLETS);
    }

    // 激光
    this.lasers.forEach(l => l.update());
    this.lasers = this.lasers.filter(l => !l.dead);
    if (this.lasers.length > this.MAX_LASERS){
      this.lasers.splice(0, this.lasers.length - this.MAX_LASERS);
    }

    // 粒子
    this.particles.forEach(p => p.update(dt));
    this.particles = this.particles.filter(p => !p.dead);
    if (this.particles.length > this.MAX_PARTICLES){
      this.particles.splice(0, this.particles.length - this.MAX_PARTICLES);
    }
    // 砖瓦碎片(爆炸产生)
    if (this.brickDebris && this.brickDebris.length > this.MAX_DEBRIS){
      this.brickDebris.splice(0, this.brickDebris.length - this.MAX_DEBRIS);
    }
    // 激光爆发光环特效(清理过期)
    if (this.laserBurstFx){
      const now = Date.now();
      this.laserBurstFx = this.laserBurstFx.filter(f => now - f.t < f.dur);
    }
    // —— 神技特效数组更新 & 数量上限 ——
    const now = Date.now();
    // ① 连锁闪电
    this.lightningChains = this.lightningChains.filter(ch => (now - ch.born) < (ch.life || 420));
    while (this.lightningChains.length > this.MAX_LIGHTNINGS) this.lightningChains.shift();
    // ② 火焰喷射粒子 → 移动 + 碰撞敌人
    for (const f of this.flames){
      const age = now - f.born;
      // 减速 + 扩散
      f.x += f.vx * (dt/16.67);
      f.y += f.vy * (dt/16.67);
      f.vx *= 0.95; f.vy *= 0.95;
      // 单颗火焰碰到敌人 → 瞬间伤害 + 加入 burned(避免同颗重复)
      for (const e of [...this.enemies, this.boss]){
        if (!e || e.dead) continue;
        if (f.burned && f.burned.has(e)) continue;
        if (Util.dist(f.x, f.y, e.cx, e.cy) <= Math.max(e.w*0.45, f.size)){
          e.hurt(f.dmg, this);
          this.spawnSparks(f.x, f.y, '#fb923c', 3);
          if (f.burned) f.burned.add(e);
          break;
        }
      }
    }
    this.flames = this.flames.filter(f => (now - f.born) < (f.life || 520));
    while (this.flames.length > this.MAX_FLAMES) this.flames.shift();
    // ③ 能量壁垒 → 过期移除 + 反弹敌人子弹
    this.barriers = this.barriers.filter(b => {
      // 过期清理
      if ((now - b.born) >= (b.life || 5000)) return false;
      // 让屏障跟随持有玩家(玩家坦克 move 后 cx/cy 已更新)
      if (b.player && !b.player.dead){ b.x = b.player.cx; b.y = b.player.cy; }
      return true;
    });
    while (this.barriers.length > this.MAX_BARRIERS) this.barriers.shift();

    // 屏障反弹敌人子弹: 子弹 owner!=='player' 且离 player < w*0.98 且 player.barrierActive
    if (this.player && this.player.barrierActive){
      const px = this.player.cx, py = this.player.cy;
      const R  = this.player.w * 0.98;
      for (const b of this.bullets){
        if (b.dead || b.owner === 'player') continue;
        const d2 = (b.x - px)**2 + (b.y - py)**2;
        if (d2 <= R*R){
          // 反弹:反方向 + 切换 owner='player' + 伤害 + 视觉反馈
          const nx = (b.x - px), ny = (b.y - py);
          const nd = Math.max(1, Math.hypot(nx,ny));
          b.vx = (nx/nd) * Math.hypot(b.vx||0, b.vy||0) * 1.15;
          b.vy = (ny/nd) * Math.hypot(b.vx||0, b.vy||0) * 1.15;
          b.owner = 'player';
          b.color = '#7dd3fc'; // 反弹子弹变蓝
          // 命中瞬间小火花
          this.spawnSparks(b.x, b.y, '#bae6fd', 5);
        }
      }
    }

    // —— 宠物 E 技能特效 tick（伤害结算 + 过期清理 + MAX上限裁剪） ——
    const nowP = Date.now();
    const allEnemies = () => [...this.enemies, this.boss].filter(e=>e && !e.dead);
    // ① 扫描脉冲(仅特效,不造成伤害) —— 过期清理 + 上限
    this.scanPulses = this.scanPulses.filter(p => nowP - p.t < (p.dur||900));
    while (this.scanPulses.length > this.MAX_SCAN_PULSES) this.scanPulses.shift();
    // ② 吉普冲撞：500ms内沿轨迹推进,每帧检查碰撞造成伤害 + 范围击晕
    this.rams = this.rams.filter(r => {
      const age = nowP - r.t;
      if (age >= (r.dur||500)) return false;
      // 推进进度 0→1,插值计算当前位置
      const prog = Math.min(1, age / (r.dur||500));
      const cx = r.x + Math.cos(r.ang) * r.dist * prog;
      const cy = r.y + Math.sin(r.ang) * r.dist * prog;
      r._curX = cx; r._curY = cy;
      for (const e of allEnemies()){
        if (e._ramHit && e._ramHit === r) continue; // 同一次冲撞只伤一次
        const d = Math.hypot(e.cx-cx, e.cy-cy);
        if (d < Math.max(e.w*0.7, 26)){
          e.hurt(r.ramDmg, this);
          e.freezeTimer = (e.freezeTimer||0) + (r.stun||1000); // 击晕(复用freezeTimer)
          e._ramHit = r;
          this.spawnSparks(e.cx, e.cy, '#fb923c', 12);
          // 范围冲击波(shockRange)
          for (const e2 of allEnemies()){
            if (e2 === e || e2._ramShock && e2._ramShock===r) continue;
            const dd = Math.hypot(e2.cx-e.cx, e2.cy-e.cy);
            if (dd < r.shockRange){ e2.hurt(r.ramDmg*0.4, this); e2._ramShock = r; }
          }
        }
      }
      return true;
    });
    while (this.rams.length > this.MAX_RAMS) this.rams.shift();
    // ③ 嘲讽力场：持续时间内保持,结束时爆炸
    this.tauntFields = this.tauntFields.filter(t => {
      const age = nowP - t.t;
      if (age >= (t.dur||4000)){
        // 结束爆炸伤害
        for (const e of allEnemies()){
          const d = Math.hypot(e.cx-t.x, e.cy-t.y);
          if (d < t.r) e.hurt(t.endBlast, this);
        }
        this.spawnExplosion(t.x, t.y, 56);
        this.shake = Math.max(this.shake, 8);
        return false;
      }
      return true;
    });
    while (this.tauntFields.length > this.MAX_TAUNT_FIELDS) this.tauntFields.shift();
    // ④ 火炮全屏齐射：dropAt 到时爆炸造成伤害+splash
    this.barrages = this.barrages.filter(b => {
      const age = nowP - b.born;
      if (age < b.dur){
        if (nowP >= b.dropAt && !b._exploded){
          b._exploded = true;
          // 爆炸：直接伤害 + 溅射
          for (const e of allEnemies()){
            const d = Math.hypot(e.cx-b.x, e.cy-b.y);
            if (d < Math.max(e.w*0.6, 22)) e.hurt(b.dmg, this);
            else if (d < b.splash) e.hurt(b.dmg * (1 - d/b.splash) * 0.7, this);
          }
          this.spawnExplosion(b.x, b.y, b.splash);
          this.shake = Math.max(this.shake, 7);
        }
        return true;
      }
      return false;
    });
    while (this.barrages.length > this.MAX_BARRAGES) this.barrages.splice(0, this.barrages.length - this.MAX_BARRAGES);
    // ⑤ EMP紫光：仅视觉扩散环,眩晕策反已在释放瞬间处理,这里只清理过期
    this.empPulses = this.empPulses.filter(p => nowP - p.t < (p.dur||520));
    while (this.empPulses.length > this.MAX_EMP_PULSES) this.empPulses.shift();
    // ⑥ 幽灵全息诱饵：移动吸引仇恨 + 假射击 + 被击破EMP + 过期清理
    for (const d of this.decoys){
      if (d.hp <= 0) continue;
      // 朝最近敌人移动
      const { enemy, dist } = this.pet ? this.pet.findNearestEnemy(this, 500) : { enemy:null, dist:9999 };
      if (enemy){
        const dx = enemy.cx - d.x, dy = enemy.cy - d.y;
        const dd = Math.max(1, Math.hypot(dx, dy));
        const sp = 1.6 * (dt/16.67);
        d.x += dx/dd * sp; d.y += dy/dd * sp;
        d.turretAngle = Math.atan2(dy, dx);
        // 假装开火(小火花,无伤害)
        d.fireTimer -= dt;
        if (d.fireTimer <= 0 && dist < 280){
          d.fireTimer = 500 + Math.random()*200;
          const mx = d.x + Math.cos(d.turretAngle)*18;
          const my = d.y + Math.sin(d.turretAngle)*18;
          this.muzzleFlash(mx, my);
        }
      }
    }
    this.decoys = this.decoys.filter(d => {
      if (d.hp <= 0 || nowP - d.born >= d.dur){
        // 死亡EMP：小范围眩晕敌人
        if (d.hp <= 0){
          for (const e of allEnemies()){
            if (Math.hypot(e.cx-d.x, e.cy-d.y) < 70){
              e.freezeTimer = (e.freezeTimer||0) + (d.deathEmp||1000);
            }
          }
          this.spawnExplosion(d.x, d.y, 34);
        }
        return false;
      }
      return true;
    });
    while (this.decoys.length > this.MAX_DECOYS) this.decoys.shift();
    // ⑦ 狂战士锥形：仅视觉,伤害已在释放瞬间结算,这里只清理过期
    this.berserkerCones = this.berserkerCones.filter(c => nowP - c.t < (c.dur||560));
    while (this.berserkerCones.length > this.MAX_BERSERKER_CONES) this.berserkerCones.shift();
    // ⑧ 工兵地雷海：敌人进入范围爆炸,激活后才触发
    this.petMines = this.petMines.filter(m => {
      if (!m.armed && nowP >= m.armAt) m.armed = true;
      if (!m.armed) return true;
      // 检查敌人碰撞
      for (const e of allEnemies()){
        const d = Math.hypot(e.cx-m.x, e.cy-m.y);
        if (d < Math.max(e.w*0.55, 20)){
          // 爆炸：直接伤害 + 溅射 + 概率冰冻
          for (const e2 of allEnemies()){
            const dd = Math.hypot(e2.cx-m.x, e2.cy-m.y);
            if (dd < m.mineRadius){
              e2.hurt(m.mineDmg * (1 - dd/m.mineRadius*0.5), this);
              if (m.isIce) { e2.freezeTimer = (e2.freezeTimer||0) + (m.iceDur||3000); }
            }
          }
          this.spawnExplosion(m.x, m.y, m.mineRadius);
          this.shake = Math.max(this.shake, 5);
          return false;
        }
      }
      return true;
    });
    while (this.petMines.length > this.MAX_PET_MINES) this.petMines.splice(0, this.petMines.length - this.MAX_PET_MINES);
    // 敌人子弹打全息诱饵 → 诱饵扣血(把 owner!=='player' 且接近的子弹拦截)
    if (this.decoys.length > 0){
      for (const b of this.bullets){
        if (b.dead || b.owner === 'player') continue;
        for (const d of this.decoys){
          if (d.hp <= 0) continue;
          const dd = Math.hypot(b.x-d.x, b.y-d.y);
          if (dd < 22){
            b.dead = true;
            d.hp -= Math.max(12, (b.dmg||25)*0.4);
            this.spawnSparks(d.x, d.y, '#22d3ee', 6);
            break;
          }
        }
      }
    }

    // 掉落物
    this.drops.forEach(d => d.update(dt));
    this.drops = this.drops.filter(d => !d.dead);
    // 拾取检测
    if (this.player && !this.player.dead){
      for (const d of this.drops){
        if (!d.dead && Util.rectsHit(d.rect, this.player.rect)){
          d.dead = true; this.pickupDrop(d);
        }
      }
    }

    // 地雷触发
    if (this.player && !this.player.dead){
      for (const m of this.mines){
        if (!m.dead && Util.rectsHit(m.rect, this.player.rect)) m.trigger(this);
      }
    }
    this.mines = this.mines.filter(m => !m.dead);

    // 敌人生成
    if (this.enemiesToSpawn > 0 && this.enemies.length < 4 + Math.floor(this.level/2)){
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0){ this.spawnEnemy(); this.spawnTimer = 1500; }
    }

    // 空袭效果
    if (this.airstrikeTimer > 0){
      this.airstrikeTimer--;
      if (this.airstrikeTimer === 30){
        // 清除普通敌人,BOSS高额伤害
        for (const e of this.enemies){ e.hurt(9999, this); this.spawnExplosion(e.cx,e.cy,40); }
        if (this.boss) this.boss.hurt(200, this);
        this.shake = 15;
      }
      // 空袭视觉:随机爆炸
      if (this.airstrikeTimer < 30 && Util.chance(0.4)){
        this.spawnExplosion(Util.rand(0,W), Util.rand(0,H), 30);
      }
    }

    // 屏幕震动衰减
    if (this.shake > 0) this.shake--;
    if (this.screenFlash > 0) this.screenFlash = Math.max(0, this.screenFlash - 0.05);
    if (this.vignette > 0) this.vignette = Math.max(0, this.vignette - 0.025);

    // 通关检测:敌人清空且不再生成 且 BOSS已击败
    if (this.enemiesToSpawn <= 0 && this.enemies.length === 0 && !this.boss && this.bossSpawned){
      this.bossSpawned = false;
      if (this.endless){
        this.nextWave();   // 无尽模式:进入下一波
      } else {
        this.nextLevel();  // 普通模式:进入下一关
      }
    }
    // 关卡末尾刷新BOSS:当普通敌人剩1/3时
    if (this.enemiesToSpawn <= 1 && this.enemies.length <= 2 && !this.boss && !this.bossSpawned){
      this.bossSpawned = true;
      // 无尽模式BOSS随波次缩放(传入endlessWave+4作为等级)
      this.boss = new BossTank(this.endless ? (this.endlessWave + 4) : this.level);
      // BOSS也需要放置去重
      this.resolveSpawnOverlap(this.boss);
      this.flashMsg('⚠ BOSS出现!');
      this.shake = 15;
    }

    this.updateUI();
  }

  /* ---------- 渲染 ---------- */
  render(){
    const ctx = this.ctx;
    ctx.save();
    // 屏幕震动
    if (this.shake > 0){
      ctx.translate(Util.rand(-this.shake,this.shake), Util.rand(-this.shake,this.shake));
    }

    // 1) 程序化绘制战场地面背景(不依赖外部图片,离线可运行)
    const bg = Assets.get('bg');
    if (bg){
      ctx.drawImage(bg, 0, 0, W, H);
      ctx.fillStyle = 'rgba(7,11,22,0.18)';
      ctx.fillRect(0,0,W,H);
    } else {
      // —— 代码绘制:泥土沙石战场地面,带网格、斑点、渐变,视觉层次丰富 ——
      // 大底色渐变:左上偏暖黄绿,右下偏深青绿,模拟战地光影
      const bgGrad = ctx.createLinearGradient(0, 0, W, H);
      bgGrad.addColorStop(0,    '#2d3f24');
      bgGrad.addColorStop(0.45, '#243420');
      bgGrad.addColorStop(1,    '#16241a');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);
      // 淡色瓷砖网格(地图格子参考线,不抢眼)
      ctx.strokeStyle = 'rgba(255,255,255,0.035)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx <= W; gx += TILE){
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
      }
      for (let gy = 0; gy <= H; gy += TILE){
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
      }
      // 随机沙石斑点(利用行列位置做伪随机,不闪烁)
      for (let gy = 0; gy < H; gy += 12){
        for (let gx = 0; gx < W; gx += 12){
          const seed = (gx * 374761393 + gy * 668265263) >>> 0;
          const r = (seed % 100) / 100;
          if (r < 0.22){
            const px = gx + ((seed>>5) % 12);
            const py = gy + ((seed>>9) % 12);
            const sz = 1 + (seed % 3);
            const shade = 30 + (seed % 35);
            ctx.fillStyle = `rgba(${120+shade}, ${110+shade*0.6}, ${70+shade*0.3}, 0.18)`;
            ctx.fillRect(px, py, sz, sz);
          }
        }
      }
      // 外圈深色暗角(让视线聚焦到战场中心)
      const vignette = ctx.createRadialGradient(W/2, H/2, Math.min(W,H)*0.3, W/2, H/2, Math.max(W,H)*0.7);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, W, H);
    }

    // 加载阶段或地图未生成时,只画背景,不渲染游戏对象
    if (this.grid.length === 0 || !this.player){
      ctx.restore();
      return;
    }

    // 2) 地形层(砖墙/钢墙/水/冰/基地) —— 草丛最后画(遮挡)
    this.renderTerrain(ctx, false);

    // 3) 宝箱/地雷
    this.chests.forEach(c => c.render(ctx));
    this.mines.forEach(m => m.render(ctx));

    // 4) 掉落物
    this.drops.forEach(d => d.render(ctx));

    // 5) 坦克
    if (this.boss) this.boss.render(ctx);
    this.enemies.forEach(e => e.render(ctx));
    if (this.player) this.player.render(ctx);
    // 5a) 宠物(战术支援载具)
    if (this.pet) this.pet.render(ctx, this);
    // 5b) 幽灵全息诱饵（画在草丛之前，和坦克一层）
    for (const d of this.decoys){
      const age = Date.now() - d.born;
      const alpha = 0.55 + 0.2*Math.sin((d.born + age)/160);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(d.x, d.y);
      // 影子
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(2,3,20,8,0,0,Math.PI*2); ctx.fill();
      ctx.rotate(d.turretAngle || 0);
      // 全息车身(青蓝半透明渐变)
      const grd = ctx.createLinearGradient(0,-16,0,16);
      grd.addColorStop(0,'#67e8f9'); grd.addColorStop(1,'#0891b2');
      ctx.fillStyle = grd;
      PetArt._roundRect(ctx, -18, -12, 36, 24, 4); ctx.fill();
      // 炮管
      ctx.fillStyle = '#0e7490';
      ctx.fillRect(8, -2, 16, 4);
      // 旋转发光圈
      ctx.rotate(-(d.turretAngle||0));
      ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 1.2;
      for (let i=0;i<6;i++){
        const a = (Date.now()/600) + i*Math.PI/3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a)*12, Math.sin(a)*12);
        ctx.lineTo(Math.cos(a)*18, Math.sin(a)*18);
        ctx.stroke();
      }
      ctx.restore();
      // HP条
      const pct = Math.max(0, Math.min(1, d.hp / Math.max(1, (PET_DEFS[5]?.skill?.decoyHp||120))));
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(d.x-17, d.y-22, 34, 4);
      ctx.fillStyle = '#22d3ee'; ctx.fillRect(d.x-17, d.y-22, 34*pct, 4);
    }

    // 6) 子弹
    this.bullets.forEach(b => b.render(ctx));

    // 7) 草丛层(遮挡坦克,实现隐身视觉效果)
    this.renderTerrain(ctx, true);

    // 8) 激光(草丛之上,保证光束清晰可见)
    this.lasers.forEach(l => l.render(ctx));

    // —— 神技特效渲染: 火焰 / 闪电链 / 能量壁垒 ——
    // 8a) 火焰喷射粒子 (扩散渐变橙色+黄色+核心白)
    for (const f of this.flames){
      const age = Date.now() - f.born;
      const lifeMax = f.life || 520;
      const p = Math.max(0, Math.min(1, 1 - age/lifeMax));
      const size = (f.size || 6) * (0.55 + p*1.05);
      // 外层光晕:半透明橙红
      const grd = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, size);
      grd.addColorStop(0,    `rgba(255,255,255,${0.92*p})`);
      grd.addColorStop(0.3,  `rgba(254,240,138,${0.7*p})`);
      grd.addColorStop(0.55, `rgba(251,146,60,${0.55*p})`);
      grd.addColorStop(1,    `rgba(239,68,68,0)`);
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(f.x, f.y, size, 0, Math.PI*2); ctx.fill();
    }
    // 8b) 连锁闪电 (锯齿状 + 辉光)
    for (const ch of this.lightningChains){
      const age = Date.now() - ch.born;
      const lifeMax = ch.life || 420;
      const alpha = 1 - age/lifeMax;
      if (alpha <= 0) continue;
      for (const hop of ch.hops){
        const { from, to } = hop;
        // 锯齿路径:5 段扰动
        const seg = 6;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineWidth = 4.2;
        ctx.strokeStyle = `rgba(147,197,253,${0.4*alpha})`;
        ctx.shadowColor = '#93c5fd'; ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        for (let i=1;i<seg;i++){
          const t = i/seg;
          const baseX = from.x + (to.x-from.x)*t;
          const baseY = from.y + (to.y-from.y)*t;
          const jitter = (seg - i) * 3.8;
          ctx.lineTo(baseX + Util.rand(-jitter, jitter), baseY + Util.rand(-jitter, jitter));
        }
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        // 内亮线
        ctx.shadowBlur = 0;
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = `rgba(255,255,255,${0.95*alpha})`;
        ctx.stroke();
        ctx.restore();
        // 命中点火花
        const pulse = 0.7 * alpha;
        const sp = ctx.createRadialGradient(to.x, to.y, 1, to.x, to.y, 14);
        sp.addColorStop(0, `rgba(255,255,255,${pulse})`);
        sp.addColorStop(1, `rgba(59,130,246,0)`);
        ctx.fillStyle = sp;
        ctx.beginPath(); ctx.arc(to.x, to.y, 14, 0, Math.PI*2); ctx.fill();
      }
    }
    // 8c) 能量壁垒: 已经在 PlayerTank.render 画了玩家身边光环,这里额外加一层散弹冲击感 (已通过 barrierActive 处理)

    // 9) 粒子特效(最上层)
    this.particles.forEach(p => p.render(ctx));

    // 10) 激光爆发光环(能量扩散的瞬时光环)
    if (this.laserBurstFx && this.laserBurstFx.length > 0){
      const now = Date.now();
      this.laserBurstFx.forEach(f=>{
        const p = Math.min(1, (now - f.t) / f.dur); // 0→1
        const r = 6 + p*55;
        const alpha = (1 - p) * 0.9;
        // 外层扩散圆环
        ctx.strokeStyle = `rgba(34,211,238,${alpha*0.8})`;
        ctx.lineWidth = 4 - p*3.5;
        ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI*2); ctx.stroke();
        // 内层柔光
        const grd = ctx.createRadialGradient(f.x,f.y, 2, f.x,f.y, r);
        grd.addColorStop(0, `rgba(255,255,255,${alpha*0.6})`);
        grd.addColorStop(0.3, `rgba(103,232,249,${alpha*0.5})`);
        grd.addColorStop(1, `rgba(14,165,233,0)`);
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI*2); ctx.fill();
        // 紫色能量外环(第二层)
        ctx.strokeStyle = `rgba(168,85,247,${alpha*0.5})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(f.x, f.y, r*0.72, 0, Math.PI*2); ctx.stroke();
      });
    }

    // —— 宠物 E 技能特效渲染（7种）——
    const nowFx = Date.now();
    // ① 无人机扫描脉冲：扩散蓝圈 + 内部敌人头顶标记(用marks map判断)
    for (const p of this.scanPulses){
      const age = nowFx - p.t;
      const prog = Math.min(1, age / (p.dur||900));
      const r = 10 + prog * p.maxR;
      const alpha = (1 - prog) * 0.75;
      // 外圈
      ctx.strokeStyle = `rgba(56,189,248,${alpha})`;
      ctx.lineWidth = 4 - prog*3;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2); ctx.stroke();
      // 扫描网格填充
      ctx.fillStyle = `rgba(56,189,248,${0.08 * (1-prog)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2); ctx.fill();
    }
    // 被无人机标记的敌人：头顶蓝色V图标 + 连到扫描中心的虚线
    if (this.pet && this.pet.marks && this.pet.marks.size > 0){
      for (const [enemy, expireAt] of this.pet.marks){
        if (!enemy || enemy.dead || nowFx > expireAt) continue;
        const t = (expireAt - nowFx) / (PET_DEFS[0]?.skill?.markDur || 8000);
        ctx.save();
        // 头顶V标记
        ctx.fillStyle = `rgba(56,189,248,${0.5 + 0.4*Math.sin(nowFx/120)})`;
        ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center';
        ctx.fillText('▼', enemy.cx, enemy.cy - enemy.h*0.65 - 2);
        // 底部标记光环
        ctx.strokeStyle = `rgba(56,189,248,${0.4 + 0.3*t})`;
        ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.arc(enemy.cx, enemy.cy, enemy.w*0.65, 0, Math.PI*2); ctx.stroke();
        ctx.restore();
      }
    }
    // ② 吉普冲撞：橙黄轨迹线 + 车头锥形火花
    for (const r of this.rams){
      const age = nowFx - r.t;
      const prog = Math.min(1, age / (r.dur||500));
      const r2 = Math.min(1, prog + 0.1);
      const endX = r.x + Math.cos(r.ang) * r.dist * r2;
      const endY = r.y + Math.sin(r.ang) * r.dist * r2;
      // 渐变尾迹
      const grd = ctx.createLinearGradient(r.x, r.y, endX, endY);
      grd.addColorStop(0, 'rgba(251,146,60,0)');
      grd.addColorStop(1, 'rgba(251,191,36,0.85)');
      ctx.strokeStyle = grd;
      ctx.lineWidth = 10 * (1 - prog*0.5);
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(endX, endY); ctx.stroke();
      // 车头火花爆
      const hg = ctx.createRadialGradient(endX, endY, 2, endX, endY, 22);
      hg.addColorStop(0, 'rgba(255,255,255,0.95)');
      hg.addColorStop(0.5, 'rgba(251,191,36,0.65)');
      hg.addColorStop(1, 'rgba(239,68,68,0)');
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(endX, endY, 22, 0, Math.PI*2); ctx.fill();
    }
    // ③ 护卫嘲讽力场：旋转六边形 + 橙色脉动边 + 敌人连线
    for (const t of this.tauntFields){
      const age = nowFx - t.t;
      const progT = age / (t.dur||4000);
      const alpha = progT < 0.1 ? (progT*10) : (progT > 0.9 ? ((1-progT)*10) : 1);
      ctx.save();
      ctx.translate(t.x, t.y);
      // 外圈脉动
      const pulse = 1 + 0.05*Math.sin(nowFx/90);
      const R = t.r * pulse;
      // 内部柔光
      const hg = ctx.createRadialGradient(0,0,5,0,0,R);
      hg.addColorStop(0, `rgba(251,191,36,${0.15*alpha})`);
      hg.addColorStop(1, `rgba(239,68,68,0)`);
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(0,0,R,0,Math.PI*2); ctx.fill();
      // 六边形
      ctx.rotate(nowFx/800);
      ctx.strokeStyle = `rgba(251,146,60,${0.65*alpha})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i=0;i<6;i++){
        const a = i*Math.PI/3;
        const x = Math.cos(a)*R, y = Math.sin(a)*R;
        if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.closePath(); ctx.stroke();
      // 内层六边形(反向转)
      ctx.rotate(-nowFx/400);
      ctx.strokeStyle = `rgba(254,240,138,${0.55*alpha})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i=0;i<6;i++){
        const a = i*Math.PI/3 + Math.PI/6;
        const x = Math.cos(a)*R*0.85, y = Math.sin(a)*R*0.85;
        if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.closePath(); ctx.stroke();
      ctx.restore();
      // 中心嘲讽图标
      ctx.fillStyle = `rgba(239,68,68,${0.75*alpha})`;
      ctx.font = 'bold 20px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('!', t.x, t.y);
    }
    // ④ 火炮全屏齐射：预警圈（红色脉动+倒计时收缩）→ 爆炸后短暂残留环
    for (const b of this.barrages){
      const age = nowFx - b.born;
      const untilDrop = Math.max(0, b.dropAt - nowFx);
      const warnP = 1 - untilDrop / Math.max(1, (b.dropAt - b.born));
      if (!b._exploded){
        // 预警圈:由大到小收缩 + 颜色从黄→红
        const warnR = 60 - warnP*30;
        const colR = Math.floor(251 * (0.2 + warnP*0.8));
        const colG = Math.floor(191 * (1 - warnP*0.7));
        // 外圈扩散
        ctx.strokeStyle = `rgba(${colR},${colG},36,${0.5 + 0.4*Math.sin(nowFx/60)})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.arc(b.x, b.y, warnR + 8, 0, Math.PI*2); ctx.stroke();
        ctx.setLineDash([]);
        // 内圈十字靶心
        ctx.strokeStyle = `rgba(239,68,68,${0.6 + 0.35*Math.sin(nowFx/50)})`;
        ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.arc(b.x, b.y, 14, 0, Math.PI*2); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(b.x-20, b.y); ctx.lineTo(b.x-8, b.y);
        ctx.moveTo(b.x+8, b.y);  ctx.lineTo(b.x+20, b.y);
        ctx.moveTo(b.x, b.y-20); ctx.lineTo(b.x, b.y-8);
        ctx.moveTo(b.x, b.y+8);  ctx.lineTo(b.x, b.y+20);
        ctx.stroke();
        // 即将爆炸时更醒目
        if (warnP > 0.75){
          ctx.fillStyle = `rgba(239,68,68,${0.2*Math.sin(nowFx/40)})`;
          ctx.beginPath(); ctx.arc(b.x, b.y, warnR + 8, 0, Math.PI*2); ctx.fill();
        }
      } else {
        // 爆炸后残留:烟灰色大圈逐渐淡出
        const postAge = age - (b.dropAt - b.born);
        const postP = Math.min(1, postAge / Math.max(1,(b.dur - (b.dropAt-b.born))));
        const rr = b.splash * (0.85 + postP*0.5);
        ctx.strokeStyle = `rgba(254,215,170,${0.55*(1-postP)})`;
        ctx.lineWidth = 3 - postP*2.5;
        ctx.beginPath(); ctx.arc(b.x, b.y, rr, 0, Math.PI*2); ctx.stroke();
      }
    }
    // ⑤ EMP紫光：扩散紫环 + 内部电弧
    for (const p of this.empPulses){
      const age = nowFx - p.t;
      const prog = Math.min(1, age / (p.dur||520));
      const r = 15 + prog * p.r;
      const alpha = (1 - prog) * 0.8;
      // 外环紫色
      ctx.strokeStyle = `rgba(168,85,247,${alpha})`;
      ctx.lineWidth = 4 - prog*3;
      ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2); ctx.stroke();
      ctx.shadowBlur = 0;
      // 内层电弧
      ctx.strokeStyle = `rgba(216,180,254,${alpha*0.9})`;
      ctx.lineWidth = 1.2;
      for (let i=0;i<4;i++){
        const startAng = i*Math.PI/2 + nowFx/300;
        ctx.beginPath();
        const segs = 5;
        for (let k=0;k<=segs;k++){
          const tt = k/segs;
          const ang = startAng + tt*0.8;
          const rr = r*0.95 - tt*r*0.4 + Util.rand(-4,4);
          const x = p.x + Math.cos(ang)*rr;
          const y = p.y + Math.sin(ang)*rr;
          if (k===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        }
        ctx.stroke();
      }
    }
    // ⑥ 狂战士锥形清屏：半透明红色锥形 + 锯齿爆边
    for (const c of this.berserkerCones){
      const age = nowFx - c.t;
      const prog = Math.min(1, age / (c.dur||560));
      const alpha = (1 - prog);
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.coneAng);
      const halfW = c.coneWidth/2;
      const maxR = c.coneRange * (0.7 + prog*0.35);
      // 锥形主体(径向渐变红→透明)
      const grd = ctx.createRadialGradient(0,0,5,0,0,maxR);
      grd.addColorStop(0, `rgba(254,202,202,${0.85*alpha})`);
      grd.addColorStop(0.4, `rgba(239,68,68,${0.6*alpha})`);
      grd.addColorStop(1, `rgba(127,29,29,0)`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.arc(0,0,maxR,-halfW,halfW);
      ctx.closePath();
      ctx.fill();
      // 边缘锯齿(锯齿状闪电)
      ctx.strokeStyle = `rgba(254,240,138,${0.85*alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const edgeSegs = 10;
      for (let i=0;i<=edgeSegs;i++){
        const tt = i/edgeSegs;
        const ang = -halfW + tt*c.coneWidth;
        const rnd = 1 + (i%2===0 ? 0.06 : -0.05) + Util.rand(-0.03, 0.03);
        const rr = maxR * rnd;
        const x = Math.cos(ang)*rr, y = Math.sin(ang)*rr;
        if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.stroke();
      ctx.restore();
    }
    // ⑦ 工兵地雷海：激活前半透明小点 + 激活后隐形(仅偶尔微弱闪光,玩家可见)
    for (const m of this.petMines){
      if (!m.armed){
        // 300ms激活前：落地闪光(玩家可见)
        const age = nowFx - m.born;
        const prog = Math.min(1, age / 300);
        const g = ctx.createRadialGradient(m.x,m.y,1, m.x,m.y, 12);
        g.addColorStop(0, `rgba(132,204,22,${0.85*(1-prog)})`);
        g.addColorStop(1, `rgba(132,204,22,0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(m.x, m.y, 12, 0, Math.PI*2); ctx.fill();
      } else {
        // 激活后：仅对玩家显示微弱的呼吸闪烁点(极小)
        const breath = 0.35 + 0.25*Math.sin(nowFx/450 + m.x*0.13 + m.y*0.17);
        ctx.fillStyle = m.isIce ? `rgba(103,232,249,${breath*0.55})` : `rgba(132,204,22,${breath*0.45})`;
        ctx.beginPath(); ctx.arc(m.x, m.y, 2.2, 0, Math.PI*2); ctx.fill();
      }
    }

    // 冰冻效果遮罩
    if (this.freezeTimer > 0){
      ctx.fillStyle = `rgba(103,232,249,${0.1+0.05*Math.sin(Date.now()/200)})`;
      ctx.fillRect(0,0,W,H);
    }

    // —— 夸张击败特效:屏幕白闪 + 冲击暗角(径向渐变) ——
    if (this.screenFlash > 0.01){
      ctx.fillStyle = `rgba(255,255,255,${Util.clamp(this.screenFlash,0,1)})`;
      ctx.fillRect(0,0,W,H);
    }
    if (this.vignette > 0.01){
      const vg = ctx.createRadialGradient(W/2, H/2, Math.min(W,H)*0.15, W/2, H/2, Math.max(W,H)*0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, `rgba(0,0,0,${Util.clamp(this.vignette,0,0.9)})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0,0,W,H);
    }

    ctx.restore();
    this.renderMinimap();
  }

  // 渲染地形:grassOnly=false 画非草丛, true 只画草丛
  renderTerrain(ctx, grassOnly){
    const time = Date.now()/1000;
    for (let r=0;r<ROWS;r++){
      for (let c=0;c<COLS;c++){
        const cell = this.grid[r][c];
        const x = c*TILE, y = r*TILE;
        if (cell.type === T.BRICK){
          if (grassOnly) continue;
          const img = Assets.get('wall_brick');
          // 如果有贴图就贴图,否则程序化画精美砖墙
          if (img){
            ctx.drawImage(img, x, y, TILE, TILE);
            // 颜色叠加:确保砖墙呈暖棕色(即使贴图不透明也能染色)
            ctx.globalCompositeOperation = 'source-atop';
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = '#c4622e';
            ctx.fillRect(x, y, TILE, TILE);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
          } else {
            // 程序化精美砖墙:青灰暖砖色调,适配校园背景(教学楼灰砖+浅褐)
            // 底色:青灰暖棕渐变
            const grad = ctx.createLinearGradient(x, y, x, y+TILE);
            grad.addColorStop(0, '#78716c');
            grad.addColorStop(1, '#57534e');
            ctx.fillStyle = grad;
            ctx.fillRect(x, y, TILE, TILE);
            // 砖块交错排列(行错位)
            const brickH = TILE/4, brickW = TILE/2;
            for (let br=0; br<4; br++){
              const offset = (br%2===0) ? 0 : brickW/2;
              for (let bc=-1; bc<3; bc++){
                const bx = x + bc*brickW + offset;
                const by = y + br*brickH;
                // 砖块高光 —— 青灰暖调:浅米灰→中暖灰→深青灰
                const tint = ((br+bc)*37) % 10; // 每块砖微色差
                const bg2 = ctx.createLinearGradient(bx, by, bx, by+brickH);
                bg2.addColorStop(0, `rgb(${168-tint}, ${162-tint}, ${148-tint})`);
                bg2.addColorStop(0.5, `rgb(${140-tint}, ${132-tint*0.8}, ${118-tint*0.6})`);
                bg2.addColorStop(1, `rgb(${102-tint*0.7}, ${94-tint*0.5}, ${82-tint*0.3})`);
                ctx.fillStyle = bg2;
                ctx.fillRect(bx+1, by+1, brickW-2, brickH-2);
                // 纹理噪点(细腻)
                ctx.fillStyle = 'rgba(68,64,60,0.12)';
                for (let i=0;i<3;i++){
                  ctx.fillRect(bx+3+((br*3+i*7)%(brickW-6)), by+2+((bc*5+i*3)%(brickH-4)), 1, 1);
                }
              }
            }
            // 砖缝线(细窄深灰)
            ctx.strokeStyle = 'rgba(41,37,36,0.38)';
            ctx.lineWidth = 1;
            for (let br=0; br<=4; br++){
              ctx.beginPath();
              ctx.moveTo(x, y+br*brickH);
              ctx.lineTo(x+TILE, y+br*brickH);
              ctx.stroke();
            }
            for (let br=0; br<4; br++){
              const offset = (br%2===0) ? 0 : brickW/2;
              for (let bc=0; bc<=2; bc++){
                const lx = x + bc*brickW + offset;
                ctx.beginPath();
                ctx.moveTo(lx, y+br*brickH);
                ctx.lineTo(lx, y+(br+1)*brickH);
                ctx.stroke();
              }
            }
            // 左上角高光(冷白微暖)
            ctx.fillStyle = 'rgba(231,229,228,0.14)';
            ctx.fillRect(x, y, TILE, 2);
            ctx.fillRect(x, y, 2, TILE);
            // 右下角阴影(深青灰)
            ctx.fillStyle = 'rgba(28,25,23,0.24)';
            ctx.fillRect(x, y+TILE-2, TILE, 2);
            ctx.fillRect(x+TILE-2, y, 2, TILE);
          }
          // 砖墙血量损坏叠加(裂缝)
          if (cell.hp > 0 && cell.hp < 60){
            const dmgRatio = 1 - cell.hp/60;
            ctx.strokeStyle = `rgba(0,0,0,${0.3 + dmgRatio*0.4})`;
            ctx.lineWidth = 1 + dmgRatio*1.5;
            ctx.beginPath();
            ctx.moveTo(x+TILE*0.2, y+TILE*0.1);
            ctx.lineTo(x+TILE*0.45, y+TILE*0.5);
            ctx.lineTo(x+TILE*0.3, y+TILE*0.85);
            ctx.moveTo(x+TILE*0.75, y+TILE*0.2);
            ctx.lineTo(x+TILE*0.55, y+TILE*0.6);
            ctx.lineTo(x+TILE*0.8, y+TILE*0.9);
            ctx.stroke();
            // 破损缺口
            if (dmgRatio > 0.4){
              ctx.fillStyle = 'rgba(0,0,0,0.35)';
              ctx.fillRect(x+TILE*0.08, y+TILE*0.55, 6, 6);
              ctx.fillRect(x+TILE*0.72, y+TILE*0.15, 5, 5);
            }
          }

        } else if (cell.type === T.STEEL){
          if (grassOnly) continue;
          const img = Assets.get('wall_steel');
          if (img){
            ctx.drawImage(img, x, y, TILE, TILE);
            // 颜色叠加:确保钢墙呈冷灰色
            ctx.globalCompositeOperation = 'source-atop';
            ctx.globalAlpha = 0.25;
            ctx.fillStyle = '#828a96';
            ctx.fillRect(x, y, TILE, TILE);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
          } else {
            // 程序化钢墙:冷蓝灰金属感
            const grad = ctx.createLinearGradient(x, y, x+TILE, y+TILE);
            grad.addColorStop(0, '#94a3b8');
            grad.addColorStop(0.5, '#cbd5e1');
            grad.addColorStop(1, '#64748b');
            ctx.fillStyle = grad;
            ctx.fillRect(x, y, TILE, TILE);
            // 四块钢板拼合(田字格)
            ctx.strokeStyle = 'rgba(15,23,42,0.5)';
            ctx.lineWidth = 2;
            ctx.strokeRect(x+1, y+1, TILE-2, TILE-2);
            ctx.beginPath();
            ctx.moveTo(x+TILE/2, y+1); ctx.lineTo(x+TILE/2, y+TILE-1);
            ctx.moveTo(x+1, y+TILE/2); ctx.lineTo(x+TILE-1, y+TILE/2);
            ctx.stroke();
            // 每块铆钉
            ctx.fillStyle = '#334155';
            const rivets = [[x+8,y+8],[x+TILE-8,y+8],[x+8,y+TILE-8],[x+TILE-8,y+TILE-8],
                           [x+TILE/2+6,y+TILE/2-6],[x+TILE/2-6,y+TILE/2+6],[x+TILE/2-6,y+TILE/2-6],[x+TILE/2+6,y+TILE/2+6]];
            rivets.forEach(([rx,ry]) => {
              ctx.beginPath(); ctx.arc(rx, ry, 2.5, 0, Math.PI*2); ctx.fill();
            });
            // 金属高光
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.fillRect(x+2, y+2, TILE-4, 2);
            ctx.fillRect(x+2, y+2, 2, TILE-4);
            // 金属阴影
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(x+2, y+TILE-4, TILE-4, 2);
            ctx.fillRect(x+TILE-4, y+2, 2, TILE-4);
          }

        } else if (cell.type === T.WATER){
          if (grassOnly) continue;
          const img = Assets.get('water');
          if (img){
            // 水面叠加动态波纹
            ctx.globalAlpha = 0.6 + 0.1*Math.sin(time*2 + r*0.5 + c*0.3);
            ctx.drawImage(img, x, y, TILE, TILE);
            ctx.globalAlpha = 1;
            // 颜色叠加:确保水域呈蓝色
            ctx.globalCompositeOperation = 'source-atop';
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = '#238de8';
            ctx.fillRect(x, y, TILE, TILE);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
          } else {
            // 程序化水面:渐变蓝+动态波纹
            const grad = ctx.createLinearGradient(x, y, x, y+TILE);
            grad.addColorStop(0, '#38bdf8');
            grad.addColorStop(0.5, '#0284c7');
            grad.addColorStop(1, '#075985');
            ctx.fillStyle = grad;
            ctx.fillRect(x, y, TILE, TILE);
            // 动态波纹
            ctx.strokeStyle = 'rgba(186,230,253,0.45)';
            ctx.lineWidth = 1.2;
            for (let w=0; w<3; w++){
              const phase = (time*1.5 + w*1.3 + r*0.7 + c*0.5) % 2;
              const wy = y + (phase/2)*TILE + w*8;
              ctx.beginPath();
              ctx.moveTo(x, wy);
              for (let wx=0; wx<=TILE; wx+=4){
                ctx.lineTo(x+wx, wy + Math.sin((wx/TILE)*Math.PI*3 + time*3 + w)*2.2);
              }
              ctx.stroke();
            }
            // 高光反射点
            ctx.fillStyle = `rgba(255,255,255,${0.3+0.15*Math.sin(time*4+c)})`;
            ctx.fillRect(x+6 + Math.sin(time+c)*2, y+10, 5, 2);
            ctx.fillRect(x+TILE-14 + Math.cos(time*1.3+r)*2, y+TILE-16, 4, 1.5);
          }

        } else if (cell.type === T.ICE){
          if (grassOnly) continue;
          // 程序化冰面:淡蓝透明+冰裂纹+高光
          const grad = ctx.createLinearGradient(x, y, x+TILE, y+TILE);
          grad.addColorStop(0, 'rgba(224,242,254,0.88)');
          grad.addColorStop(0.5, 'rgba(186,230,253,0.78)');
          grad.addColorStop(1, 'rgba(147,197,253,0.82)');
          ctx.fillStyle = grad;
          ctx.fillRect(x, y, TILE, TILE);
          // 冰裂纹(基于rc坐标固定)
          ctx.strokeStyle = 'rgba(255,255,255,0.55)';
          ctx.lineWidth = 1;
          const seed = (r*31 + c*17) % 100;
          ctx.beginPath();
          ctx.moveTo(x + (seed%10)*4, y+2);
          ctx.lineTo(x + TILE/2 + ((seed*3)%10-5)*2, y + TILE/2);
          ctx.lineTo(x + ((seed*7)%10)*4, y+TILE-2);
          ctx.moveTo(x+TILE-2, y + ((seed*5)%10)*4);
          ctx.lineTo(x + TILE/2, y + TILE/2 + ((seed*11)%10-5)*2);
          ctx.stroke();
          // 冰面高光
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.fillRect(x+3, y+3, TILE-6, 1.5);
          ctx.fillRect(x+3, y+3, 1.5, TILE-6);
          ctx.fillStyle = 'rgba(125,211,252,0.35)';
          ctx.fillRect(x+TILE/2-3, y+TILE/2-3, 6, 6);
          ctx.strokeStyle = 'rgba(255,255,255,0.4)';
          ctx.strokeRect(x+2, y+2, TILE-4, TILE-4);

        } else if (cell.type === T.BASE){
          if (grassOnly) continue;
          // 基地:科技风格能量核心
          // 底座
          const baseColor = this.baseHp > this.baseMaxHp*0.3 ? '#06b6d4' : '#ef4444';
          const bgGrad = ctx.createLinearGradient(x, y, x, y+TILE);
          bgGrad.addColorStop(0, '#0f172a');
          bgGrad.addColorStop(1, '#1e293b');
          ctx.fillStyle = bgGrad;
          ctx.fillRect(x, y, TILE, TILE);
          // 外框发光
          const pulse = 0.5 + 0.3*Math.sin(time*3);
          ctx.strokeStyle = baseColor;
          ctx.lineWidth = 2;
          ctx.shadowColor = baseColor;
          ctx.shadowBlur = 8 + pulse*6;
          ctx.strokeRect(x+3, y+3, TILE-6, TILE-6);
          ctx.shadowBlur = 0;
          // 内部格纹
          ctx.strokeStyle = 'rgba(148,163,184,0.3)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x+7, y+7, TILE-14, TILE-14);
          // 中央能量星
          ctx.translate(x+TILE/2, y+TILE/2);
          ctx.rotate(time*0.8);
          ctx.fillStyle = baseColor;
          ctx.shadowColor = baseColor;
          ctx.shadowBlur = 12 + pulse*8;
          ctx.beginPath();
          for (let i=0;i<10;i++){
            const ang = (i/10)*Math.PI*2;
            const rr = i%2===0 ? TILE*0.23 : TILE*0.11;
            const px = Math.cos(ang)*rr, py = Math.sin(ang)*rr;
            if (i===0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          ctx.shadowBlur = 0;
          // 中央圆点
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(0, 0, 3, 0, Math.PI*2);
          ctx.fill();
          ctx.rotate(-time*0.8);
          ctx.translate(-x-TILE/2, -y-TILE/2);
          // 血量低时警告闪烁
          if (this.baseHp <= this.baseMaxHp*0.3){
            ctx.fillStyle = `rgba(239,68,68,${0.1+0.2*Math.abs(Math.sin(time*6))})`;
            ctx.fillRect(x, y, TILE, TILE);
          }

        } else if (cell.type === T.GRASS){
          if (!grassOnly) continue;
          const img = Assets.get('grass');
          if (img){
            ctx.globalAlpha = 0.92;
            ctx.drawImage(img, x, y, TILE, TILE);
            ctx.globalAlpha = 1;
            // 颜色叠加:确保草丛呈绿色
            ctx.globalCompositeOperation = 'source-atop';
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = '#5a920b';
            ctx.fillRect(x, y, TILE, TILE);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
          } else {
            // 程序化草丛:深绿底+草叶
            const grad = ctx.createLinearGradient(x, y, x, y+TILE);
            grad.addColorStop(0, '#166534');
            grad.addColorStop(1, '#14532d');
            ctx.fillStyle = grad;
            ctx.fillRect(x, y, TILE, TILE);
            // 多层草叶
            ctx.strokeStyle = '#15803d';
            ctx.lineWidth = 1.5;
            const leafSeed = r*100 + c;
            for (let i=0;i<18;i++){
              const sx = x + ((leafSeed*(i+3)*7)%TILE);
              const sy = y + 6 + ((leafSeed*(i+1)*5)%(TILE-8));
              const sway = Math.sin(time*2 + i*0.5 + c*0.3 + r*0.2)*1.5;
              ctx.beginPath();
              ctx.moveTo(sx, sy);
              ctx.quadraticCurveTo(sx + sway, sy-6, sx + sway*2, sy-11);
              ctx.stroke();
            }
            // 亮草叶
            ctx.strokeStyle = '#22c55e';
            ctx.lineWidth = 1;
            for (let i=0;i<10;i++){
              const sx = x + ((leafSeed*(i+5)*11)%TILE);
              const sy = y + 10 + ((leafSeed*(i+2)*9)%(TILE-14));
              const sway = Math.sin(time*2.5 + i*0.7 + r*0.4)*1.2;
              ctx.beginPath();
              ctx.moveTo(sx, sy);
              ctx.quadraticCurveTo(sx + sway, sy-4, sx + sway*1.8, sy-8);
              ctx.stroke();
            }
            // 草地点缀(小花朵)
            if ((r+c)%5 === 0){
              ctx.fillStyle = '#fcd34d';
              ctx.beginPath(); ctx.arc(x+TILE*0.25, y+TILE*0.65, 1.8, 0, Math.PI*2); ctx.fill();
            }
            if ((r*2+c)%7 === 0){
              ctx.fillStyle = '#f472b6';
              ctx.beginPath(); ctx.arc(x+TILE*0.7, y+TILE*0.35, 1.6, 0, Math.PI*2); ctx.fill();
            }
          }
        }
      }
    }
  }

  /* ---------- 小地图 ---------- */
  renderMinimap(){
    const ctx = this.mctx;
    const mw = this.minimap.width, mh = this.minimap.height;
    ctx.fillStyle = '#04101a'; ctx.fillRect(0,0,mw,mh);
    // 地图未生成时不绘制地形
    if (this.grid.length === 0 || !this.player) return;
    const sx = mw / W, sy = mh / H;
    // 地形
    for (let r=0;r<ROWS;r++){
      for (let c=0;c<COLS;c++){
        const cell = this.grid[r][c];
        if (cell.type === T.BRICK) ctx.fillStyle = '#a8a29e';
        else if (cell.type === T.STEEL) ctx.fillStyle = '#64748b';
        else if (cell.type === T.WATER) ctx.fillStyle = '#0ea5e9';
        else if (cell.type === T.BASE) ctx.fillStyle = '#06b6d4';
        else continue;
        ctx.fillRect(c*TILE*sx, r*TILE*sy, TILE*sx+1, TILE*sy+1);
      }
    }
    // 敌人(战术雷达升级版:标注类型+剩余血量;否则不显示)
    const hasRadar = this.player && this.player.hasPassive('tac_radar');
    if (hasRadar){
      // 类型颜色:普通红/高速橙/重甲紫/速射粉/自爆黄
      const typeColor = { normal:'#ef4444', fast:'#f97316', heavy:'#7c3aed', rapid:'#db2777', suicide:'#facc15' };
      this.enemies.forEach(e=>{
        const col = typeColor[e.type] || '#ef4444';
        // 重甲/自爆坦克画大点
        const sz = (e.type==='heavy' || e.type==='suicide') ? 5 : 4;
        ctx.fillStyle = col;
        ctx.fillRect(e.cx*sx-sz/2, e.cy*sy-sz/2, sz, sz);
        // 剩余血量条(3px高)
        const hpPct = e.hp / e.maxHp;
        const bw = 8;
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(e.cx*sx-bw/2, e.cy*sy-sz/2-4, bw, 2);
        ctx.fillStyle = hpPct > 0.5 ? '#22c55e' : (hpPct > 0.25 ? '#fbbf24' : '#ef4444');
        ctx.fillRect(e.cx*sx-bw/2, e.cy*sy-sz/2-4, bw*hpPct, 2);
      });
      // BOSS:大红十字 + 血量
      if (this.boss){
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(this.boss.cx*sx-4, this.boss.cy*sy-4, 8, 8);
        ctx.fillStyle = '#fff';
        ctx.fillRect(this.boss.cx*sx-3, this.boss.cy*sy-1, 6, 2);
        ctx.fillRect(this.boss.cx*sx-1, this.boss.cy*sy-3, 2, 6);
        // BOSS血量条
        const bhpPct = this.boss.hp / this.boss.maxHp;
        const bbw = 14;
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(this.boss.cx*sx-bbw/2, this.boss.cy*sy-7, bbw, 2);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(this.boss.cx*sx-bbw/2, this.boss.cy*sy-7, bbw*bhpPct, 2);
      }
    }
    // 玩家
    if (this.player && !this.player.dead){
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(this.player.cx*sx-2, this.player.cy*sy-2, 4,4);
    }
    // 掉落物
    this.drops.forEach(d=>{ ctx.fillStyle='#fbbf24'; ctx.fillRect(d.x*sx-1, d.y*sy-1, 2,2); });
  }

  /* ---------- UI更新 ---------- */
  updateUI(){
    document.getElementById('score').textContent = this.score;
    // 无尽模式显示波次,普通模式显示关卡
    document.getElementById('level').textContent = this.endless ? ('∞ ' + this.endlessWave) : this.level;
    document.getElementById('highscore').textContent = this.highScore;
    document.getElementById('credits').textContent = this.credits;
    if (this.player){
      const hpPct = this.player.hp/this.player.maxHp*100;
      document.getElementById('player-hp-fill').style.width = hpPct+'%';
      document.getElementById('player-hp-text').textContent = Math.ceil(this.player.hp)+'/'+this.player.maxHp;
      // —— 坦克型号 + 等级 + 当前武器等级 HUD 显示 —— //
      const tdef = this.player.tankModel || TANK_MODELS[0];
      const tIcon = document.getElementById('player-tank-icon');
      const tName = document.getElementById('player-tank-name');
      const tLvl  = document.getElementById('player-tank-lvl');
      const tWpn  = document.getElementById('player-tank-weapon');
      if (tIcon) tIcon.textContent = tdef.icon || '🟢';
      if (tName)  tName.textContent = tdef.name || 'T-01 先锋';
      if (tLvl)   tLvl.textContent = 'Lv' + (this.player.tankLevel || 1);
      if (tWpn){
        if (this.player.currentWeapon === 8 && this.player.laserUnlocked){
          tWpn.innerHTML = '⚡ 激光主炮 <b style="color:#a855f7;">Lv1-5 蓄力</b>';
        } else {
          const w = WEAPONS[this.player.currentWeapon] || WEAPONS[0];
          const wlv = (this.weaponLevels && this.weaponLevels[w.id]) || 1;
          tWpn.innerHTML = `${w.icon} ${w.name} <b style="color:var(--warn);">Lv${wlv}</b>`;
        }
      }
    } else {
      // [v54] 菜单/通关/结束态:无 player 时,也要显示"车库当前选中的坦克",避免显示旧值或默认先锋
      const tdef = TANK_MODELS[this.selectedTankId] || TANK_MODELS[0];
      const tLv  = (this.tankLevels && this.tankLevels[this.selectedTankId]) ? this.tankLevels[this.selectedTankId] : 1;
      const tIcon = document.getElementById('player-tank-icon');
      const tName = document.getElementById('player-tank-name');
      const tLvl  = document.getElementById('player-tank-lvl');
      const tWpn  = document.getElementById('player-tank-weapon');
      if (tIcon) tIcon.textContent = tdef.icon || '🟢';
      if (tName)  tName.textContent = tdef.name || 'T-01 先锋';
      if (tLvl)   tLvl.textContent = 'Lv' + tLv;
      if (tWpn){
        const w = WEAPONS[0];
        const wlv = (this.weaponLevels && this.weaponLevels[0]) || 1;
        tWpn.innerHTML = `${w.icon} ${w.name} <b style="color:var(--warn);">Lv${wlv}</b>`;
      }
    }
    const basePct = this.baseHp/this.baseMaxHp*100;
    document.getElementById('base-hp-fill').style.width = basePct+'%';
    document.getElementById('base-hp-text').textContent = Math.ceil(this.baseHp)+'/'+this.baseMaxHp;
    document.getElementById('base-hp-fill').style.background = 'linear-gradient(90deg,#06b6d4,#3b82f6)';
    document.getElementById('enemy-count').textContent = this.enemies.length + this.enemiesToSpawn + (this.boss?1:0);
    // 激光充能进度
    if (this.player){
      const ac = this.player.attackCount;
      // 激光槽位(已解锁):常驻可用,不显示连击计数
      const inLaserSlot = (this.player.currentWeapon === 8 && this.player.laserUnlocked);
      if (inLaserSlot){
        document.getElementById('laser-fill').style.width = '100%';
        document.getElementById('laser-text').textContent = '常驻⚡';
      } else {
        // 普通武器:显示连击充能进度(满5次触发激光彩蛋)
        document.getElementById('laser-fill').style.width = (ac/5*100)+'%';
        document.getElementById('laser-text').textContent = ac >= 5 ? '就绪!' : (ac+'/5');
      }
    }

    this.updatePetUI();

    this.updateSkinUI();  // 外装(坦克皮肤)槽：只能装备1个

    this.updateWeaponBar();
    this.updatePassiveUI();
    this.updateInventoryUI();
    this.updateBuffUI();
  }

  updatePetUI(){
    const panel = document.getElementById('pet-panel');
    if (!panel) return;
    if (!this.pet){ panel.style.display = 'none'; return; }
    panel.style.display = '';
    const p = this.pet;
    const iconEl = document.getElementById('pet-icon');
    const nameEl = document.getElementById('pet-name');
    const lvlEl  = document.getElementById('pet-lvl');
    if (iconEl) iconEl.textContent = p.def.icon || '🛰️';
    if (nameEl) nameEl.textContent = p.def.name || '战术宠物';
    if (lvlEl)  lvlEl.textContent = 'Lv' + p.level;
    // 血量
    const hpFill = document.getElementById('pet-hp-fill');
    const hpText = document.getElementById('pet-hp-text');
    if (hpFill){ const pct = p.hpPct*100; hpFill.style.width = pct+'%'; }
    if (hpText){ hpText.textContent = Math.ceil(p.hp)+'/'+p.maxHp; }
    // 经验
    const expFill = document.getElementById('pet-exp-fill');
    const expText = document.getElementById('pet-exp-text');
    const need = p.level < 10 ? PET_LEVEL_EXP_THRESHOLD(p.level) : 1;
    const expRatio = p.level >= 10 ? 1 : Math.min(1, p.exp / Math.max(1, need));
    if (expFill){ expFill.style.width = (expRatio*100)+'%'; }
    if (expText){ expText.textContent = p.level >= 10 ? '满级MAX' : (p.exp+'/'+need); }
    // 技能CD
    const cdFill = document.getElementById('pet-cd-fill');
    const cdText = document.getElementById('pet-cd-text');
    const cdDef = (p.def.skill && p.def.skill.cd) ? p.def.skill.cd : 15000;
    const cdMul = (p.growth.cdMul || 1);
    const maxCd = cdDef * cdMul;
    const cdRatio = p.skillCd <= 0 ? 1 : Math.max(0, 1 - (p.skillCd / Math.max(1, maxCd)));
    if (cdFill){ cdFill.style.width = (cdRatio*100)+'%'; }
    if (cdText){
      if (p.level >= 5) cdText.textContent = (p.skillCd <= 0 ? '🟡 就绪' : ((p.skillCd/1000).toFixed(1)+'s'));
      else cdText.textContent = p.skillCd <= 0 ? '就绪' : ((p.skillCd/1000).toFixed(1)+'s');
    }
    // AI状态标签
    const tagEl = document.getElementById('pet-state-tag');
    if (tagEl){
      if (p.dead) tagEl.textContent = '💀 宠物阵亡(下局恢复)';
      else if (p.state === PET_STATE.DEFEND) tagEl.textContent = '🔴 守家模式(玩家阵亡)';
      else if (p.skillStage === 'Windup') tagEl.textContent = '⚡ 神技前摇…';
      else if (p.skillStage === 'Active') tagEl.textContent = '💥 神技生效中！';
      else if (p.state === PET_STATE.ASSIST) tagEl.textContent = '🟡 协助集火';
      else tagEl.textContent = '🟢 跟随作战';
    }
  }

  updateWeaponBar(){
    const bar = document.getElementById('weapon-bar');
    if (!this.player){ bar.innerHTML=''; return; }
    bar.innerHTML = '';
    WEAPONS.forEach((w, i) => {
      const unlocked = this.player.unlockedWeapons.includes(i);
      const active = this.player.currentWeapon === i;
      const lv = unlocked ? ((this.weaponLevels && this.weaponLevels[i]) || 1) : 1;
      const div = document.createElement('div');
      div.className = 'weapon' + (active?' active':'') + (unlocked?'':' locked');
      div.innerHTML = `<span class="num">${i+1}</span><span class="wlv">Lv${lv}</span><div class="wicon">${w.icon}</div><div class="wname">${unlocked?w.name:'未解锁'}</div>`;
      div.onclick = () => { if(unlocked){ this.player.currentWeapon=i; this.updateUI(); } };
      bar.appendChild(div);
    });
    // 激光槽位(第9格,解锁后显示,紫色高亮)
    if (this.player.laserUnlocked){
      const active = this.player.currentWeapon === 8;
      const div = document.createElement('div');
      div.className = 'weapon laser-slot' + (active?' active':'');
      div.innerHTML = `<span class="num">9</span><span class="wlv">Lv5</span><div class="wicon">⚡</div><div class="wname">激光主炮</div>`;
      div.onclick = () => { this.player.currentWeapon = 8; this.updateUI(); };
      bar.appendChild(div);
    }
  }

  // 外装(坦克皮肤) —— 只能装备1个，战斗外通过商店切换
  updateSkinUI(){
    const tdef = (this.player && this.player.tankModel)
      ? this.player.tankModel
      : (TANK_MODELS.find(m => m.id === this.selectedTankId) || TANK_MODELS[0]);
    const lv = (this.player && this.player.tankLevel)
      ? this.player.tankLevel
      : (this.tankLevels && this.tankLevels[tdef.id] ? this.tankLevels[tdef.id] : 1);
    const ico = document.getElementById('skin-icon');
    const nm  = document.getElementById('skin-name');
    const lvT = document.getElementById('skin-lvl');
    const ds  = document.getElementById('skin-desc');
    if (ico){ ico.textContent = tdef.icon || '🟢'; }
    if (nm){ nm.childNodes.forEach((n,i)=>{ if (i===0) n.nodeValue = (tdef.name || 'T-01 先锋') + ' '; }); }
    if (lvT){ lvT.textContent = 'Lv' + lv; }
    if (ds){ ds.textContent = tdef.desc || ''; }
  }

  updatePassiveUI(){
    const cont = document.getElementById('passive-slots');
    cont.innerHTML = '';
    for (let i=0;i<3;i++){
      const p = this.player ? this.player.passives[i] : null;
      const div = document.createElement('div');
      div.className = 'equip-slot' + (p?'':' empty');
      if (p){
        const def = PASSIVES.find(x=>x.id===p.id);
        div.innerHTML = `<div class="ico">${def.icon}</div><div class="nm">${def.name}</div>`;
        div.title = def.name + ' - ' + def.desc;
      } else {
        div.innerHTML = `<div class="ico">▪</div><div class="nm">空</div>`;
      }
      cont.appendChild(div);
    }
  }

  updateInventoryUI(){
    const cont = document.getElementById('inventory');
    cont.innerHTML = '';
    if (!this.player) return;
    ITEMS.forEach((it, i) => {
      const cnt = this.player.inventory[i];
      const div = document.createElement('div');
      div.className = 'inv-item' + (cnt>0?'':' empty');
      div.innerHTML = `<div class="ico">${it.icon}</div><div class="cnt">${cnt}</div>`;
      div.title = it.name + ' - ' + it.desc;
      div.onclick = () => { if(cnt>0) this.activateItem(i); };
      cont.appendChild(div);
    });
  }

  updateBuffUI(){
    const cont = document.getElementById('buff-list');
    cont.innerHTML = '';
    if (!this.player || this.player.buffs.length === 0){
      cont.innerHTML = '<div style="font-size:11px;color:var(--muted);">无</div>';
      return;
    }
    const names = { power:'火力激增', speed:'移速提升', crit:'暴击双倍' };
    this.player.buffs.forEach(b => {
      const div = document.createElement('div');
      div.className = 'buff-tag';
      div.innerHTML = `<span class="t">✨ ${names[b.id]||b.id}</span><span class="d">${(b.time/1000).toFixed(1)}s</span>`;
      cont.appendChild(div);
    });
  }

  /* ---------- 多玩家存档槽 (v57) ---------- */
  // 原理: 游戏始终读写 tank_battle_* 活跃键; 切换玩家时把活跃键 flush 到
  //       tank_battle_s{N}_*, 再把目标槽加载到活跃键, 最后 reload 页面
  loadSlot(){
    try {
      const v = parseInt(localStorage.getItem('tank_battle_slot')||'0',10);
      return Number.isFinite(v) && v>=0 && v<=2 ? v : 0;
    } catch(e){ return 0; }
  }
  saveSlot(){
    try { localStorage.setItem('tank_battle_slot', String(this.slot)); } catch(e){}
  }
  // 首次运行: 把旧版 tank_battle_* 数据搬到 s0, 避免老玩家丢档
  migrateSlot0IfNeeded(){
    try {
      if (localStorage.getItem('tank_battle_slot') !== null) return;
      for (const k of Game.SAVE_KEYS){
        const v = localStorage.getItem('tank_battle_'+k);
        if (v !== null) localStorage.setItem('tank_battle_s0_'+k, v);
      }
      localStorage.setItem('tank_battle_slot', '0');
    } catch(e){}
  }
  // 把当前活跃键 flush 到指定槽 (保存当前玩家进度)
  flushToSlot(n){
    try {
      for (const k of Game.SAVE_KEYS){
        const v = localStorage.getItem('tank_battle_'+k);
        if (v !== null) localStorage.setItem('tank_battle_s'+n+'_'+k, v);
        else localStorage.removeItem('tank_battle_s'+n+'_'+k);
      }
    } catch(e){}
  }
  // 把指定槽加载到活跃键 (切换玩家)
  loadFromSlot(n){
    try {
      for (const k of Game.SAVE_KEYS){
        const v = localStorage.getItem('tank_battle_s'+n+'_'+k);
        if (v !== null) localStorage.setItem('tank_battle_'+k, v);
        else localStorage.removeItem('tank_battle_'+k);
      }
    } catch(e){}
  }
  // 切换玩家: 保存当前 → 加载目标 → reload
  switchSlot(n){
    if (n === this.slot || n<0 || n>2) return;
    // 战斗中禁止切换
    if (this.state === 'playing' || this.state === 'paused'){
      this.flashMsg('战斗中无法切换玩家'); return;
    }
    this._switchingSlot = true;    // [v57] 锁:阻止游戏循环回写旧数据
    this.flushToSlot(this.slot);   // 保存当前进度
    this.loadFromSlot(n);          // 加载目标槽
    this.slot = n;
    this.saveSlot();
    location.reload();             // 立即刷新
  }
  // 重置指定槽: 只删自己的数据, 不影响其他玩家
  resetSlot(n){
    if (this.state === 'playing' || this.state === 'paused'){
      this.flashMsg('战斗中无法重置'); return;
    }
    // 二次确认
    if (!confirm('确定要重置玩家'+(n+1)+'的存档吗？\n此操作不可撤销，其他玩家不受影响。')) return;
    this._switchingSlot = true;    // [v57] 锁
    // 删除该槽的备份数据
    for (const k of Game.SAVE_KEYS){
      localStorage.removeItem('tank_battle_s'+n+'_'+k);
    }
    // 如果重置的是当前槽, 也清空活跃键
    if (n === this.slot){
      for (const k of Game.SAVE_KEYS){
        localStorage.removeItem('tank_battle_'+k);
      }
    }
    location.reload();
  }
  // 渲染存档槽选择栏
  renderSlotBar(){
    const bar = document.getElementById('slot-bar');
    if (!bar) return;
    bar.querySelectorAll('.slot-btn').forEach(btn=>{
      const s = parseInt(btn.dataset.slot,10);
      btn.classList.toggle('active', s === this.slot);
    });
  }
  // 绑定存档槽按钮事件 (只绑一次)
  bindSlotBar(){
    if (this._slotBound) return;
    this._slotBound = true;
    const bar = document.getElementById('slot-bar');
    if (!bar) return;
    bar.querySelectorAll('.slot-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const s = parseInt(btn.dataset.slot,10);
        this.switchSlot(s);
      });
    });
    const resetBtn = document.getElementById('slot-reset-btn');
    if (resetBtn){
      resetBtn.addEventListener('click', ()=> this.resetSlot(this.slot));
    }
  }

  /* ---------- 存档 ---------- */
  loadHighScore(){
    try { return parseInt(localStorage.getItem('tank_battle_highscore')||'0',10); }
    catch(e){ return 0; }
  }
  saveHighScore(){
    try { localStorage.setItem('tank_battle_highscore', this.highScore); } catch(e){}
  }

  /* ---------- 无尽模式存档 ---------- */
  loadEndlessMax(){
    try { return parseInt(localStorage.getItem('tank_battle_endless_max')||'0',10); }
    catch(e){ return 0; }
  }
  saveEndlessMax(){
    try { localStorage.setItem('tank_battle_endless_max', String(this.endlessMaxWave)); } catch(e){}
  }

  /* ---------- 兜底保存:页面卸载/隐藏时保存所有数据 ---------- */
  saveAll(){
    if (this._switchingSlot) return;  // [v57] 切换玩家中,禁止回写旧数据
    // 统一保存所有持久化数据(防止中途退出/刷新丢失)
    this.checkHighScore();                // 最高分(含实时比较)
    this.saveCredits();                   // 积分
    this.saveEndlessMax();               // 无尽模式最高波次
    this.saveInventory();                // 背包道具
    this.saveUnlockedWeapons();          // 武器解锁
    this.saveUnlockedTanks();            // 坦克解锁
    this.saveSelectedTankId();           // 当前装备坦克
    this.saveTankLevels();               // 坦克等级
    this.saveUnlockedPets();             // 宠物解锁
    this.saveSelectedPetId();            // 当前装备宠物
    this.savePetLevels();                // 宠物等级
    this.saveWeaponLevels();             // 武器等级
    this.saveUnlocked();                 // 关卡解锁
    this.saveCleared();                  // 通关记录
    try { localStorage.setItem('tank_battle_laser', this.laserUnlocked?'1':'0'); } catch(e){}
  }
  // 注册页面生命周期监听(在游戏初始化时调用)
  setupAutoSave(){
    // 页面隐藏时保存(切标签页/最小化,比beforeunload更可靠)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.saveAll();
    });
    // 页面卸载前保存(刷新/关闭,兜底保护)
    window.addEventListener('beforeunload', () => this.saveAll());
    // 页面被浏览器缓存时保存(移动端兜底)
    window.addEventListener('pagehide', () => this.saveAll());
  }
  // 控制游戏内虚拟控制器显示/隐藏(随游戏状态变化)
  updateTouchControls(){
    const tc = document.getElementById('touch-controls');
    if (!tc) return;
    // 仅在 playing 状态且非商店打开时显示虚拟控制器
    const show = Input.isTouchDevice && this.state === 'playing' && !this.shopOpen;
    tc.style.display = show ? '' : 'none';
  }

  /* ---------- 积分/商城存档 ---------- */
  loadCredits(){
    try { return parseInt(localStorage.getItem('tank_battle_credits')||'0',10); }
    catch(e){ return 0; }
  }
  saveCredits(){
    try { localStorage.setItem('tank_battle_credits', this.credits); } catch(e){}
  }
  loadUnlocked(){
    try {
      const v = parseInt(localStorage.getItem('tank_battle_unlocked')||'1',10);
      return Math.max(1, Math.min(MAX_LEVEL, Number.isFinite(v)?v:1));
    }
    catch(e){ return 1; }
  }
  saveUnlocked(){
    try { localStorage.setItem('tank_battle_unlocked', this.unlockedLevels); } catch(e){}
  }
  loadCleared(){
    try {
      let arr = JSON.parse(localStorage.getItem('tank_battle_cleared')||'[]');
      if (!Array.isArray(arr)) arr = [];
      // —— 双向一致性校验 v55 —— //
      // 1) 过滤:只保留 1..MAX_LEVEL 范围内的合法整数, 去重
      const valid = [];
      for (let i=0;i<arr.length;i++){
        const x = parseInt(arr[i],10);
        if (!Number.isFinite(x) || x<1 || x>MAX_LEVEL) continue;
        if (valid.includes(x)) continue;
        valid.push(x);
      }
      arr = valid;
      // 2) 防"没玩过显示全通关":已通关不能>=已解锁关卡(除非已解锁已是MAX_LEVEL)
      // [v58修复] off-by-one: cleared应 < unlocked (通关第N关会把unlocked推到N+1)
      const maxUnl = (this.unlockedLevels && Number.isFinite(this.unlockedLevels)) ? this.unlockedLevels : 1;
      if (maxUnl < MAX_LEVEL){
        arr = arr.filter(x => x < maxUnl);
      }
      // 3) 防"打过的显示未玩过"(兼容老存档):已解锁第N关意味着1..N-1必通关,补齐
      if (maxUnl > 1){
        for (let k=1; k<=maxUnl-1; k++){
          if (!arr.includes(k)) arr.push(k);
        }
      }
      arr.sort((a,b)=>a-b);
      // 修正后写回一次,避免下次再修
      try { localStorage.setItem('tank_battle_cleared', JSON.stringify(arr)); } catch(e){}
      return arr;
    }
    catch(e){ return []; }
  }
  saveCleared(){
    try { localStorage.setItem('tank_battle_cleared', JSON.stringify(this.clearedLevels)); } catch(e){}
  }
  // 永久解锁的武器id(宝箱才会掉,初始仅普通炮弹0号)
  loadUnlockedWeapons(){
    try { const a = JSON.parse(localStorage.getItem('tank_battle_uweapons')||'[]'); return Array.isArray(a)?a:[]; }
    catch(e){ return []; }
  }
  saveUnlockedWeapons(){
    try { localStorage.setItem('tank_battle_uweapons', JSON.stringify(this.unlockedWeapons)); } catch(e){}
  }
  // 激光主炮解锁(充能激光常驻)
  loadLaserUnlocked(){
    try { return localStorage.getItem('tank_battle_laser')==='1'; }
    catch(e){ return false; }
  }
  saveLaserUnlocked(){
    try { localStorage.setItem('tank_battle_laser', this.laserUnlocked?'1':'0'); } catch(e){}
  }
  // 永久解锁的坦克id(默认0号T-01)
  loadUnlockedTanks(){
    try {
      const a = JSON.parse(localStorage.getItem('tank_battle_utanks')||'null');
      if (!Array.isArray(a)) return [0];
      if (!a.includes(0)) a.unshift(0);
      return a;
    } catch(e){ return [0]; }
  }
  saveUnlockedTanks(){
    try { localStorage.setItem('tank_battle_utanks', JSON.stringify(this.unlockedTanks)); } catch(e){}
  }
  // 当前装备的坦克id(必须已解锁,未解锁默认0号)
  loadSelectedTankId(){
    try {
      const v = parseInt(localStorage.getItem('tank_battle_seltank')||'0',10);
      if (Number.isFinite(v) && this.unlockedTanks.includes(v)) return v;
      return 0;
    } catch(e){ return 0; }
  }
  saveSelectedTankId(){
    try { localStorage.setItem('tank_battle_seltank', String(this.selectedTankId)); } catch(e){}
  }
  // —— 宠物持久化 & 工厂方法 ——
  // 永久解锁的宠物id(默认0号侦察无人机)
  loadUnlockedPets(){
    try {
      const a = JSON.parse(localStorage.getItem('tank_battle_upets')||'null');
      if (!Array.isArray(a)) return [0];
      if (!a.includes(0)) a.unshift(0);
      return a;
    } catch(e){ return [0]; }
  }
  saveUnlockedPets(){
    try { localStorage.setItem('tank_battle_upets', JSON.stringify(this.unlockedPets)); } catch(e){}
  }
  // —— 宠物等级持久化 (1~10, 跨局保留, 用积分升级) ——
  loadPetLevels(){
    try {
      const a = JSON.parse(localStorage.getItem('tank_battle_petlv')||'null');
      if (!Array.isArray(a)) return PET_DEFS.map(()=>1);
      // 补齐到 8 个
      while (a.length < PET_DEFS.length) a.push(1);
      return a.map(n => Math.max(1, Math.min(10, parseInt(n,10)||1)));
    } catch(e){ return PET_DEFS.map(()=>1); }
  }
  savePetLevels(){
    try { localStorage.setItem('tank_battle_petlv', JSON.stringify(this.petLevels)); } catch(e){}
  }
  // 宠物升级花费: 基础 60 + 当前等级 × 50
  petUpgradeCost(pid){
    const lv = this.petLevels[pid] || 1;
    if (lv >= 10) return 0;
    return 60 + lv * 50;
  }
  // 升级宠物 (返回 true 表示成功)
  upgradePet(pid){
    if (!this.unlockedPets.includes(pid)){ this.flashMsg('请先解锁该宠物'); return false; }
    const lv = this.petLevels[pid] || 1;
    if (lv >= 10){ this.flashMsg('已满级 Lv10'); return false; }
    const cost = this.petUpgradeCost(pid);
    if (this.credits < cost){ this.flashMsg('积分不足, 需要 ' + cost + '🪙'); return false; }
    this.credits -= cost;
    this.petLevels[pid] = lv + 1;
    this.savePetLevels();
    this.saveCredits();
    this.updateMenuCredits();
    // 若升级的是当前装备的宠物, 同步刷新实例等级
    if (this.pet && this.pet.pid === pid){
      const prevRatio = this.pet.hp / Math.max(1, this.pet.maxHp);
      this.pet.level = this.petLevels[pid];
      this.pet.expToNext = PET_LEVEL_EXP_THRESHOLD(this.pet.level);
      this.pet.maxHp = this.pet.def.base.hp * (this.pet.growth.hp || 1);
      this.pet.hp = Math.min(this.pet.maxHp, Math.max(this.pet.maxHp * Math.max(prevRatio, 0.5), this.pet.hp));
      this.pet._levelUpFlashTimer = 1000;
    }
    const m = PET_DEFS.find(x=>x.id===pid);
    this.flashMsg(`${m.icon}${m.name} 升级到 Lv${this.petLevels[pid]}!`);
    this.renderShop();
    if (this.shopOpen) this.renderShopView();
    return true;
  }
  // —— 坦克等级持久化 (1~10, 跨局保留) ——
  loadTankLevels(){
    try {
      const a = JSON.parse(localStorage.getItem('tank_battle_tanklv')||'null');
      if (!Array.isArray(a)) return TANK_MODELS.map(()=>1);
      while (a.length < TANK_MODELS.length) a.push(1);
      return a.map(n => Math.max(1, Math.min(10, parseInt(n,10)||1)));
    } catch(e){ return TANK_MODELS.map(()=>1); }
  }
  saveTankLevels(){
    try { localStorage.setItem('tank_battle_tanklv', JSON.stringify(this.tankLevels)); } catch(e){}
  }
  tankUpgradeCost(tid){
    const lv = this.tankLevels[tid] || 1;
    if (lv >= 10) return 0;
    return 80 + lv * 60;
  }
  upgradeTank(tid){
    if (!this.unlockedTanks.includes(tid)){ this.flashMsg('请先解锁该坦克'); return false; }
    const lv = this.tankLevels[tid] || 1;
    if (lv >= 10){ this.flashMsg('已满级 Lv10'); return false; }
    const cost = this.tankUpgradeCost(tid);
    if (this.credits < cost){ this.flashMsg('积分不足, 需要 ' + cost + '🪙'); return false; }
    this.credits -= cost;
    this.tankLevels[tid] = lv + 1;
    this.saveTankLevels();
    this.saveCredits();
    this.updateMenuCredits();
    // 若升级的是当前装备的坦克, 同步刷新实例属性
    if (this.player && this.player.tankId === tid){
      const prevRatio = this.player.hp / Math.max(1, this.player.maxHp);
      const tdef = TANK_MODELS.find(m=>m.id===tid) || TANK_MODELS[0];
      this.player.applyTankModel(tdef, this.tankLevels[tid]);
      this.player.hp = Math.min(this.player.maxHp, Math.max(this.player.maxHp * Math.max(prevRatio, 0.5), this.player.hp));
    }
    const m = TANK_MODELS.find(x=>x.id===tid);
    this.flashMsg(`${m.icon}${m.name} 升级到 Lv${this.tankLevels[tid]}!`);
    this.renderShop();
    if (this.shopOpen) this.renderShopView();
    return true;
  }
  // —— 武器等级持久化 (1~10, 跨局保留) ——
  loadWeaponLevels(){
    try {
      const a = JSON.parse(localStorage.getItem('tank_battle_wplv')||'null');
      if (!Array.isArray(a)) return WEAPONS.map(()=>1);
      while (a.length < WEAPONS.length) a.push(1);
      return a.map(n => Math.max(1, Math.min(10, parseInt(n,10)||1)));
    } catch(e){ return WEAPONS.map(()=>1); }
  }
  saveWeaponLevels(){
    try { localStorage.setItem('tank_battle_wplv', JSON.stringify(this.weaponLevels)); } catch(e){}
  }
  weaponUpgradeCost(wid){
    const lv = this.weaponLevels[wid] || 1;
    if (lv >= 10) return 0;
    return 70 + lv * 55;
  }
  upgradeWeapon(wid){
    // 0号普通炮弹默认解锁, 其他需要先解锁
    if (wid !== 0 && !this.unlockedWeapons.includes(wid)){ this.flashMsg('请先解锁该武器'); return false; }
    const lv = this.weaponLevels[wid] || 1;
    if (lv >= 10){ this.flashMsg('已满级 Lv10'); return false; }
    const cost = this.weaponUpgradeCost(wid);
    if (this.credits < cost){ this.flashMsg('积分不足, 需要 ' + cost + '🪙'); return false; }
    this.credits -= cost;
    this.weaponLevels[wid] = lv + 1;
    this.saveWeaponLevels();
    this.saveCredits();
    this.updateMenuCredits();
    const w = WEAPONS.find(x=>x.id===wid);
    this.flashMsg(`${w.icon}${w.name} 升级到 Lv${this.weaponLevels[wid]}!`);
    this.renderShop();
    if (this.shopOpen) this.renderShopView();
    return true;
  }
  // 当前装备的宠物id(未解锁默认0号,-1=不携带宠物)
  loadSelectedPetId(){
    try {
      const v = parseInt(localStorage.getItem('tank_battle_selpet')||'0',10);
      if (Number.isFinite(v) && (v===-1 || this.unlockedPets.includes(v))) return v;
      return 0;
    } catch(e){ return 0; }
  }
  saveSelectedPetId(){
    try { localStorage.setItem('tank_battle_selpet', String(this.selectedPetId)); } catch(e){}
  }
  // 装备宠物(切换已解锁的型号,战斗中不可切)
  equipPet(pid){
    if (pid === -1){
      this.selectedPetId = -1;
      this.saveSelectedPetId();
      if (this.state !== 'playing' && this.state !== 'paused') this.pet = null;   // 卸下
      this.updateUI();
      this.flashMsg('已卸下宠物,裸装出战');
      return;
    }
    const m = PET_DEFS.find(x=>x && x.id===pid);
    if (!m) { this.flashMsg('未知宠物型号'); return; }
    if (!this.unlockedPets.includes(pid)){ this.flashMsg('请先解锁该宠物'); return; }
    if (this.state === 'playing' || this.state === 'paused'){ this.flashMsg('战斗中无法切换宠物'); return; }
    this.selectedPetId = pid;
    this.saveSelectedPetId();
    // [宠物同步 v54] 菜单/通关/结束态:同步 pet 实例,让所有HUD一致
    this.pet = this.createPet(pid, this);
    // [v58修复] 不再对 player 调 applyTankModel——切宠物与坦克无关,重置会清空神技冷却/屏障
    this.updateUI();
    this.flashMsg('已装备宠物: ' + m.name);
  }
  // 宠物工厂方法:根据 id 创建对应子类实例 (从存档等级初始化)
  createPet(pid, game){
    if (pid === -1 || pid === null || pid === undefined) return null;
    const def = PET_DEFS.find(d => d.id === pid);
    if (!def) return null;
    const initLv = (this.petLevels && this.petLevels[pid]) || 1;
    let pet = null;
    switch(pid){
      case 0: pet = new PetDrone(def, game); break;
      case 1: pet = new PetJeep(def, game); break;
      case 2: pet = new PetGuard(def, game); break;
      case 3: pet = new PetSPG(def, game); break;
      case 4: pet = new PetEMV(def, game); break;
      case 5: pet = new PetGhost(def, game); break;
      case 6: pet = new PetBerserker(def, game); break;
      case 7: pet = new PetMiner(def, game); break;
      default: return null;
    }
    // 应用存档等级(直接覆盖 Lv1 基础值)
    if (initLv > 1 && pet){
      pet.level = initLv;
      pet.expToNext = PET_LEVEL_EXP_THRESHOLD(initLv);
      pet.maxHp = def.base.hp * (pet.growth.hp || 1);
      pet.hp = pet.maxHp;
    }
    return pet;
  }
  // 装备坦克(切换已解锁的型号,战斗中不可切)
  equipTank(tid){
    const m = TANK_MODELS.find(x=>x && x.id===tid);
    if (!m) { this.flashMsg('未知坦克型号'); return; }
    if (!this.unlockedTanks.includes(tid)){ this.flashMsg('请先解锁该坦克'); return; }
    if (this.state === 'playing' || this.state === 'paused'){ this.flashMsg('战斗中无法切换坦克'); return; }
    this.selectedTankId = tid;
    this.saveSelectedTankId();
    // [外装同步 v54] 菜单/通关/结束态:若已有 player 实例,立刻应用型号,让 HUD/商店不再显示"新旧坦克同时装备"
    if (this.player && !this.player.dead){
      const lv = this.tankLevels && this.tankLevels[tid] ? this.tankLevels[tid] : 1;
      const oldHpPct = this.player.maxHp > 0 ? (this.player.hp / this.player.maxHp) : 1;
      this.player.applyTankModel(m, lv);
      // 按旧血量百分比回补,避免切换坦克引起血量跳变
      this.player.hp = Math.max(1, Math.round(this.player.maxHp * Math.min(1, oldHpPct)));
    }
    // [v58修复] 不再重建宠物实例——切坦克与宠物无关,重建会清空当局经验
    this.updateUI();
    this.flashMsg('已装备: ' + m.name);
  }
  // 背包消耗道具(跨局保留)
  loadInventory(){
    try {
      const a = JSON.parse(localStorage.getItem('tank_battle_inv')||'null');
      if (!Array.isArray(a)) return [0,0,0,0,0];
      while (a.length < ITEMS.length) a.push(0);   // 兜底补足到5格
      return a.map(n => Math.max(0, Math.min(9, n)));
    } catch(e){ return [0,0,0,0,0]; }
  }
  saveInventory(){
    try { localStorage.setItem('tank_battle_inv', JSON.stringify(this.savedInventory)); } catch(e){}
  }

  // 增加 credits 并同步存档 + 刷新 UI
  addCredits(n){
    this.credits += n;
    this.saveCredits();
    if (this.state === 'playing' || this.state === 'paused' || this.state === 'gameover' || this.state === 'win'){
      this.updateUI();
    }
    if (this.shopOpen) this.renderShopView();
  }

  /* ---------- 主循环 ---------- */
  loop(time){
    if (this._switchingSlot) { requestAnimationFrame(t => this.loop(t)); return; }  // [v57] 切换玩家中,停止循环防止回写旧数据
    const dt = Math.min(time - this.lastTime, 50) || 16;
    this.lastTime = time;
    // [v60修复] 全局防护:任何 update/render 异常都不打断帧循环,防止"玩两下卡死"
    // 历史经验(802196):一次未捕获异常就足以让 requestAnimationFrame 链永久中断,表现为页面冻结
    try {
      this.update(dt);
    } catch(e){
      this._crashCount = (this._crashCount||0) + 1;
      this._recordCrash('update', e);
    }
    // gameover/win 时只渲染一次静态画面(背景停下来),恢复后自动解冻
    try {
      if (this.state === 'gameover' || this.state === 'win'){
        if (!this._frozen){ this.render(); this._frozen = true; }
      } else {
        this._frozen = false;
        this.render();
      }
    } catch(e){
      this._crashCount = (this._crashCount||0) + 1;
      this._recordCrash('render', e);
    }
    requestAnimationFrame(t => this.loop(t));
  }
  // 记录崩溃(写入内存+localStorage双份,便于事后排查)
  _recordCrash(stage, err){
    try {
      const entry = {
        t: Date.now(),
        stage: stage,
        msg: (err && err.message) ? String(err.message) : String(err),
        stack: (err && err.stack) ? String(err.stack).slice(0, 800) : null,
        state: this.state,
        level: this.level,
        enemies: this.enemies ? this.enemies.length : null,
        bullets: this.bullets ? this.bullets.length : null,
        particles: this.particles ? this.particles.length : null
      };
      this._crashLogs = this._crashLogs || [];
      this._crashLogs.push(entry);
      if (this._crashLogs.length > 50) this._crashLogs.shift();
      // 持久化: 只写最近20条
      try {
        localStorage.setItem('tank_battle_crashlogs', JSON.stringify(this._crashLogs.slice(-20)));
      } catch(e2){}
      // HUD 提示(最多显示一次提示,避免刷屏)
      if (!this._lastCrashFlash || Date.now() - this._lastCrashFlash > 3000){
        this._lastCrashFlash = Date.now();
        this.flashMsg('⚠️ 异常自动恢复(' + this._crashCount + ')');
      }
    } catch(fatal){} // 防止记录函数自己又崩
  }
}

/* ===================== 十八、启动入口 ===================== */
window.addEventListener('DOMContentLoaded', () => {
  Input.init();
  TouchControls.init(); // 初始化移动端虚拟控制器(触屏设备自动激活)
  const canvas = document.getElementById('game-canvas');
  const minimap = document.getElementById('minimap');
  const game = new Game(canvas, minimap);
    window.__game = game; // 调试暴露(便于在控制台检查游戏状态)

  // 主菜单 tab 切换(选关 / 商城)
  document.querySelectorAll('.mtab').forEach(btn => {
    btn.addEventListener('click', () => game.switchMenuTab(btn.dataset.mtab));
  });
  // 无尽模式:开始挑战
  document.getElementById('start-endless-btn').addEventListener('click', () => {
    game.startEndless();
  });
  // 结果视图:重新开始当前关
  document.getElementById('retry-btn').addEventListener('click', () => {
    // 无尽模式失败后重试 → 重新开始无尽模式;普通模式 → 重开当前关
    if (game.endless){
      game.startEndless();
    } else {
      game.startGame(game.level || game.lastStartedLevel || 1);
    }
  });
  // 结果视图:继续下一关(先开商店,关闭后进下一关)
  document.getElementById('next-level-btn').addEventListener('click', () => {
    game.proceedNextLevel();
  });
  // 结果视图:退出到首页
  document.getElementById('back-menu-btn').addEventListener('click', () => {
    game.showMenu();
  });
  // 商店浮层:tab切换 + 关闭按钮
  document.querySelectorAll('.stab').forEach(btn => {
    btn.addEventListener('click', () => game.switchShopTab(btn.dataset.stab));
  });
  const closeShopBtn = document.getElementById('close-shop-btn');
  if (closeShopBtn) closeShopBtn.addEventListener('click', () => game.closeShop());

  // —— 游戏内 HUD 按钮(右上角悬浮,点击触发暂停/菜单/重开/商店) ——
  const hudPause = document.getElementById('hud-pause');
  if (hudPause) hudPause.addEventListener('click', () => {
    if (game.state === 'playing' || game.state === 'paused') game.togglePause();
  });
  const hudShop = document.getElementById('hud-shop');
  if (hudShop) hudShop.addEventListener('click', () => {
    if (game.shopOpen) game.closeShop();
    else if (game.state === 'playing') game.openShop('playing');
    else if (game.state === 'paused') game.openShop('playing'); // 暂停时也允许打开商店
  });
  const hudRestart = document.getElementById('hud-restart');
  if (hudRestart) hudRestart.addEventListener('click', () => {
    if (game.state === 'playing' || game.state === 'paused'){
      if (game.endless) game.startEndless();
      else game.startGame(game.level || game.lastStartedLevel || 1);
    }
  });
  const hudMenu = document.getElementById('hud-menu');
  if (hudMenu) hudMenu.addEventListener('click', () => {
    if (game.state === 'playing' || game.state === 'paused' || game.state === 'gameover' || game.state === 'win'){
      game.showMenu();
    }
  });

  // —— 暂停视图内的按钮 ——
  const pauseResume = document.getElementById('pause-resume-btn');
  if (pauseResume) pauseResume.addEventListener('click', () => game.togglePause());
  const pauseRestart = document.getElementById('pause-restart-btn');
  if (pauseRestart) pauseRestart.addEventListener('click', () => {
    if (game.endless) game.startEndless();
    else game.startGame(game.level || game.lastStartedLevel || 1);
  });
  const pauseMenu = document.getElementById('pause-menu-btn');
  if (pauseMenu) pauseMenu.addEventListener('click', () => game.showMenu());

  // 注册自动保存监听(页面隐藏/卸载时保存所有数据,防止中途退出丢失)
  game.setupAutoSave();

  // —— [v60修复] 全局异常兜底:把页面所有未捕获错误/未处理Promise拒绝记入 localStorage,便于事后排查
  // 即使主循环 try/catch 没兜住(例如初始化阶段、DOM事件回调里),也能定位根因
  try {
    window.addEventListener('error', e => {
      try {
        const entry = {
          t: Date.now(),
          type: 'error',
          msg: e.message ? String(e.message) : '',
          file: e.filename || '',
          line: e.lineno || 0,
          col: e.colno || 0,
          stack: e.error && e.error.stack ? String(e.error.stack).slice(0, 1000) : null
        };
        const arr = JSON.parse(localStorage.getItem('tank_battle_crashlogs') || '[]');
        arr.push(entry);
        while (arr.length > 50) arr.shift();
        localStorage.setItem('tank_battle_crashlogs', JSON.stringify(arr));
      } catch(_){}
    });
    window.addEventListener('unhandledrejection', e => {
      try {
        const entry = {
          t: Date.now(),
          type: 'unhandledrejection',
          reason: e.reason ? String(e.reason).slice(0, 500) : '',
          stack: e.reason && e.reason.stack ? String(e.reason.stack).slice(0, 1000) : null
        };
        const arr = JSON.parse(localStorage.getItem('tank_battle_crashlogs') || '[]');
        arr.push(entry);
        while (arr.length > 50) arr.shift();
        localStorage.setItem('tank_battle_crashlogs', JSON.stringify(arr));
      } catch(_){}
    });
  } catch(_){}

  // 先加载资源,再启动循环(循环内根据state决定是否更新)
  game.startLoading();
  requestAnimationFrame(t => { game.lastTime = t; game.loop(t); });
});
