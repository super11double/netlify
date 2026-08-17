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
// 6 种武器:伤害 / 冷却ms / 速度 / 颜色 / 特性
const WEAPONS = [
  { id:0, name:'普通炮弹', icon:'🔵', dmg:25, cd:380,  speed:5.2, color:'#fbbf24', pierce:false, splash:0,  type:'normal' },
  { id:1, name:'穿甲弹',   icon:'🟡', dmg:40, cd:620,  speed:6.0, color:'#f59e0b', pierce:true,  splash:0,  type:'armor'   },
  { id:2, name:'散弹',     icon:'🟢', dmg:18, cd:700,  speed:4.8, color:'#4ade80', pierce:false, splash:0,  type:'shotgun', spread:3 },
  { id:3, name:'导弹',     icon:'🔴', dmg:80, cd:1300, speed:3.6, color:'#ef4444', pierce:false, splash:60, type:'missile' },
  { id:4, name:'速射炮',   icon:'🟣', dmg:12, cd:140,  speed:6.4, color:'#a78bfa', pierce:false, splash:0,  type:'rapid'   },
  { id:5, name:'追踪弹',   icon:'🟠', dmg:30, cd:900,  speed:4.0, color:'#fb923c', pierce:false, splash:0,  type:'homing'  },
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

/* ===================== 四·三、积分商城商品(三类,购买立即生效) =====================
 *   passive —— 装备到玩家(最多3件,阵亡清空,不阵亡则跨关保留)
 *   item    —— 加入背包(阵亡保留,跨局保留)
 *   weapon  —— 永久解锁武器(之后宝箱才会掉该武器)
 *   laser   —— 永久解锁激光主炮(充能激光常驻,无需5次充能)
 * ============================================================ */
const SHOP_ITEMS = [
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
  { id:'w_shotgun', type:'weapon', wid:2, name:'散弹炮',   icon:'🟢', cost:500, desc:'永久解锁,宝箱才会掉散弹' },
  { id:'w_armor',   type:'weapon', wid:1, name:'穿甲炮',   icon:'🟡', cost:550, desc:'永久解锁,宝箱才会掉穿甲弹' },
  { id:'w_homing',  type:'weapon', wid:5, name:'追踪导弹', icon:'🟠', cost:650, desc:'永久解锁,宝箱才会掉追踪弹' },
  { id:'w_laser',   type:'laser',          name:'激光主炮', icon:'🔫', cost:900, desc:'永久解锁,充能激光常驻(无需5次充能)' },
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
  init() {
    window.addEventListener('keydown', e => {
      // 阻止空格滚动页面(WASD不滚动,无需阻止)
      if(e.key === ' ') e.preventDefault();
      this.keys[e.key.toLowerCase()] = true;
      // 单次触发的按键由 Game 处理
      if (Game.instance) Game.instance.onKeyPress(e.key.toLowerCase());
    });
    window.addEventListener('keyup', e => { this.keys[e.key.toLowerCase()] = false; });
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
  }
};

/* ===================== 七·二、虚拟控制器(移动端) ===================== */
const TouchControls = {
  joyId: null,       // 当前活跃的摇杆 touch id
  joyCenter: {x:0, y:0},
  joyRadius: 50,
  stickEl: null,
  init(){
    if (!Input.isTouchDevice) return;
    this.stickEl = document.getElementById('joystick-stick');
    const joystick = document.getElementById('joystick');
    // —— 摇杆:touchstart/move/end ——
    if (joystick){
      const rect = ()=> joystick.getBoundingClientRect();
      joystick.addEventListener('touchstart', e => {
        e.preventDefault();
        const t = e.changedTouches[0];
        this.joyId = t.identifier;
        const r = rect();
        this.joyCenter = { x:r.left + r.width/2, y:r.top + r.height/2 };
        this.joyRadius = r.width / 2;
        this.updateStick(t.clientX, t.clientY);
      }, {passive:false});
      joystick.addEventListener('touchmove', e => {
        e.preventDefault();
        for (const t of e.changedTouches){
          if (t.identifier === this.joyId){
            this.updateStick(t.clientX, t.clientY);
          }
        }
      }, {passive:false});
      const endHandler = e => {
        e.preventDefault();
        for (const t of e.changedTouches){
          if (t.identifier === this.joyId){
            this.joyId = null;
            this.resetStick();
          }
        }
      };
      joystick.addEventListener('touchend', endHandler, {passive:false});
      joystick.addEventListener('touchcancel', endHandler, {passive:false});
    }
    // —— 射击按钮:按住=持续射击 ——
    const fireBtn = document.getElementById('touch-fire');
    if (fireBtn){
      fireBtn.addEventListener('touchstart', e => { e.preventDefault(); Input.setTouch(' ', true); }, {passive:false});
      fireBtn.addEventListener('touchend',   e => { e.preventDefault(); Input.setTouch(' ', false); }, {passive:false});
      fireBtn.addEventListener('touchcancel',e => { e.preventDefault(); Input.setTouch(' ', false); }, {passive:false});
    }
    // —— 道具按钮:单次触发 ——
    const itemBtn = document.getElementById('touch-item');
    if (itemBtn){
      itemBtn.addEventListener('touchstart', e => {
        e.preventDefault();
        if (Game.instance) Game.instance.onKeyPress('q');
      }, {passive:false});
    }
    // —— 武器切换:上一把/下一把 ——
    const wPrev = document.getElementById('touch-wprev');
    const wNext = document.getElementById('touch-wnext');
    if (wPrev) wPrev.addEventListener('touchstart', e => { e.preventDefault(); this.switchWeapon(-1); }, {passive:false});
    if (wNext) wNext.addEventListener('touchstart', e => { e.preventDefault(); this.switchWeapon(1); }, {passive:false});
  },
  // 摇杆位置 → 方向键模拟
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
      this.stickEl.style.transform = `translate(${clampX}px, ${clampY}px)`;
    }
    // 死区内不触发移动
    if (intensity < 0.3){
      Input.setTouch('arrowup', false);
      Input.setTouch('arrowdown', false);
      Input.setTouch('arrowleft', false);
      Input.setTouch('arrowright', false);
      return;
    }
    // 8方向判断(优先主轴)
    const angle = Math.atan2(ny, nx); // -π ~ π
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
  },
  // 武器循环切换(跳过未解锁)
  switchWeapon(dir){
    if (!Game.instance || !Game.instance.player) return;
    const p = Game.instance.player;
    const max = 6; // 0-5普通武器, 6激光
    let cur = p.currentWeapon;
    for (let i=0; i<7; i++){
      cur = (cur + dir + 7) % 7;
      if (cur === 6){
        if (p.laserUnlocked){ p.currentWeapon = 6; Game.instance.updateUI(); return; }
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
  constructor(x,y,dir,weapon,owner){
    this.x = x; this.y = y;
    this.dir = dir;
    const v = DIR_VEC[dir];
    this.vx = v[0]*weapon.speed; this.vy = v[1]*weapon.speed;
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

    // 拖尾记录
    this.trail.push({x:this.x, y:this.y});
    if (this.trail.length > 6) this.trail.shift();

    this.x += this.vx;
    this.y += this.vy;

    // 出界
    if (this.x < 0 || this.x > W || this.y < 0 || this.y > H){ this.dead = true; return; }

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
          this.dead = true; return;
        }
      } else if (cell.type === T.STEEL){
        // 钢墙阻挡所有子弹(导弹爆炸但墙不破)
        if (this.splash > 0){ this.explode(game); }
        this.dead = true; return;
      } else if (cell.type === T.BASE){
        game.damageBase(this.dmg);
        this.dead = true; return;
      }
      // 水/草/冰:子弹穿过
    }

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

  // 导弹爆炸:范围伤害+破坏周围砖墙
  explode(game){
    game.spawnExplosion(this.x, this.y, this.splash);
    // 范围内敌人
    for (const e of game.enemies){
      if (!e.dead && Util.dist(this.x,this.y,e.cx,e.cy) < this.splash){
        e.hurt(this.dmg*0.6, game);
      }
    }
    if (game.boss && !game.boss.dead && Util.dist(this.x,this.y,game.boss.cx,game.boss.cy) < this.splash){
      game.boss.hurt(this.dmg*0.6, game);
    }
    // 破坏周围砖墙
    const r = this.splash;
    const c0 = Util.toCell(this.x - r), c1 = Util.toCell(this.x + r);
    const r0 = Util.toCell(this.y - r), r1 = Util.toCell(this.y + r);
    for (let cy=r0; cy<=r1; cy++){
      for (let cx=c0; cx<=c1; cx++){
        if (cx>=0&&cx<COLS&&cy>=0&&cy<ROWS){
          const cell = game.grid[cy][cx];
          if (cell.type === T.BRICK && Util.dist(this.x,this.y, cx*TILE+TILE/2, cy*TILE+TILE/2) < r){
            cell.type = T.EMPTY; game.spawnBrickDebris(cx,cy);
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
    ctx.arc(this.x, this.y, this.type==='missile'?5:3.5, 0, Math.PI*2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // 导弹画个小三角头
    if (this.type === 'missile'){
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(this.x,this.y,2,0,Math.PI*2); ctx.fill();
    }
  }
}

/* ===================== 九B、激光(充能发射·钢墙反射) ===================== */
// 玩家每攻击5次,下次空格发射激光:沿方向射线,遇钢墙镜像反射(最多3次),
// 遇砖墙破坏并停止,遇敌人/BOSS穿透造成高伤害,遇边界/基地停止
class Laser {
  constructor(x, y, dir, dmg, game){
    this.points = [];          // 主折线路径点 [{x,y}, ...]
    this.branches = [];        // 边界发散出的子光路径 [[{x,y},...], ...]
    this.dmg = dmg;
    this.life = 16;            // 渲染存活帧数(淡出)
    this.maxLife = 16;
    this.dead = false;
    this.color = '#67e8f9';
    this.trace(x, y, dir, game);
  }
  // 射线追踪:计算反射路径与伤害
  trace(sx, sy, dir, game){
    this.points.push({ x:sx, y:sy });
    let x = sx, y = sy;
    const v = DIR_VEC[dir];
    let vx = v[0], vy = v[1];   // 单位方向(水平或垂直,其中一个为0)
    let bounces = 0;
    let dist = 0;
    const step = 3;
    const maxDist = 2400;       // 防止无限循环
    // 记录已伤害过的目标,避免同一目标被多次步进判定重复扣血
    const hitTargets = new Set();

    while (dist < maxDist){
      const nx = x + vx*step, ny = y + vy*step;
      dist += step;

      // 到达屏幕边界 → 不射出,在边界点发散成两条光
      if (nx < 2 || nx > W-2 || ny < 2 || ny > H-2){
        const bx = Util.clamp(nx, 2, W-2);
        const by = Util.clamp(ny, 2, H-2);
        this.points.push({ x:bx, y:by });
        // 发散方向:垂直于入射方向(水平入射→上下发散;垂直入射→左右发散)
        let dvx = 0, dvy = 0;
        if (vx !== 0){ dvx = 0;  dvy = 1; }   // 水平射→发散光沿垂直方向
        else        { dvx = 1;  dvy = 0; }    // 垂直射→发散光沿水平方向
        // 两条发散光:正方向 + 负方向,伤害为主激光一半
        this.branches.push(this.traceBranch(bx, by,  dvx,  dvy, game));
        this.branches.push(this.traceBranch(bx, by, -dvx, -dvy, game));
        // 边界发散火花
        game.spawnSparks(bx, by, '#67e8f9', 14);
        return;
      }

      const cc = Util.toCell(nx), cy = Util.toCell(ny);
      if (cc<0||cc>=COLS||cy<0||cy>=ROWS){
        const bx = Util.clamp(nx, 2, W-2);
        const by = Util.clamp(ny, 2, H-2);
        this.points.push({ x:bx, y:by });
        let dvx = 0, dvy = 0;
        if (vx !== 0){ dvx = 0;  dvy = 1; } else { dvx = 1; dvy = 0; }
        this.branches.push(this.traceBranch(bx, by,  dvx,  dvy, game));
        this.branches.push(this.traceBranch(bx, by, -dvx, -dvy, game));
        game.spawnSparks(bx, by, '#67e8f9', 14);
        return;
      }
      const cell = game.grid[cy][cc];

      if (cell.type === T.STEEL){
        // 钢墙:反射或终止
        if (bounces >= 3){
          this.points.push({ x:nx, y:ny });
          return;
        }
        // 判断撞击面:水平移动(vx≠0)撞到垂直面→vx反向;垂直移动(vy≠0)撞到水平面→vy反向
        if (vx !== 0){ vx = -vx; } else { vy = -vy; }
        this.points.push({ x:nx, y:ny });
        // 反射火花
        game.spawnSparks(nx, ny, '#67e8f9', 6);
        x = nx; y = ny;
        bounces++;
        continue;
      }

      if (cell.type === T.BRICK){
        // 砖墙:破坏并终止
        cell.hp -= this.dmg;
        if (cell.hp <= 0){ cell.type = T.EMPTY; game.spawnBrickDebris(cc, cy); }
        this.points.push({ x:nx, y:ny });
        return;
      }

      if (cell.type === T.BASE){
        // 基地:激光停止(不伤害己方基地)
        this.points.push({ x:nx, y:ny });
        return;
      }

      // 敌人碰撞(穿透,每个目标只伤一次)
      for (const e of game.enemies){
        if (e.dead || hitTargets.has(e)) continue;
        if (nx >= e.x && nx <= e.x+e.w && ny >= e.y && ny <= e.y+e.h){
          e.hurt(this.dmg, game);
          hitTargets.add(e);
          game.spawnSparks(nx, ny, e.color, 8);
        }
      }
      // BOSS
      if (game.boss && !game.boss.dead && !hitTargets.has(game.boss)){
        if (nx >= game.boss.x && nx <= game.boss.x+game.boss.w && ny >= game.boss.y && ny <= game.boss.y+game.boss.h){
          game.boss.hurt(this.dmg, game);
          hitTargets.add(game.boss);
          game.spawnSparks(nx, ny, '#fbbf24', 10);
        }
      }

      x = nx; y = ny;
    }
    // 达到最大距离,终止
    this.points.push({ x, y });
  }

  // 发散光追踪:从(sx,sy)沿(vx,vy)方向延伸,碰任何障碍物(墙/水/基地/敌人/BOSS/边界)即消失
  // 伤害为主激光的一半;不再反射、不再发散
  traceBranch(sx, sy, vx, vy, game){
    const points = [{ x:sx, y:sy }];
    let x = sx, y = sy;
    const step = 3;
    const maxDist = 2000;
    const branchDmg = this.dmg * 0.5;   // 发散光伤害减半
    const hitTargets = new Set();
    let dist = 0;

    while (dist < maxDist){
      const nx = x + vx*step, ny = y + vy*step;
      dist += step;

      // 出界 → 在边界停止
      if (nx < 2 || nx > W-2 || ny < 2 || ny > H-2){
        points.push({ x: Util.clamp(nx, 2, W-2), y: Util.clamp(ny, 2, H-2) });
        break;
      }
      const cc = Util.toCell(nx), cy = Util.toCell(ny);
      if (cc<0||cc>=COLS||cy<0||cy>=ROWS){
        points.push({ x:nx, y:ny });
        break;
      }
      const cell = game.grid[cy][cc];

      // 砖墙:造成伤害并破坏,然后消失
      if (cell.type === T.BRICK){
        cell.hp -= branchDmg;
        if (cell.hp <= 0){ cell.type = T.EMPTY; game.spawnBrickDebris(cc, cy); }
        points.push({ x:nx, y:ny });
        break;
      }
      // 钢墙:产生火花但不造成伤害,光消失
      if (cell.type === T.STEEL){
        game.spawnSparks(nx, ny, '#a5f3fc', 10);
        points.push({ x:nx, y:ny });
        break;
      }
      // 水域/基地:碰到即消失(不伤害基地)
      if (cell.type === T.WATER || cell.type === T.BASE){
        points.push({ x:nx, y:ny });
        break;
      }

      // 敌人碰撞:造成一半伤害后消失(每个目标只伤一次)
      let hit = false;
      for (const e of game.enemies){
        if (e.dead || hitTargets.has(e)) continue;
        if (nx >= e.x && nx <= e.x+e.w && ny >= e.y && ny <= e.y+e.h){
          e.hurt(branchDmg, game);
          hitTargets.add(e);
          game.spawnSparks(nx, ny, e.color, 6);
          hit = true;
          break;
        }
      }
      // BOSS
      if (!hit && game.boss && !game.boss.dead && !hitTargets.has(game.boss)){
        if (nx >= game.boss.x && nx <= game.boss.x+game.boss.w && ny >= game.boss.y && ny <= game.boss.y+game.boss.h){
          game.boss.hurt(branchDmg, game);
          hitTargets.add(game.boss);
          game.spawnSparks(nx, ny, '#fbbf24', 8);
          hit = true;
        }
      }
      if (hit){
        points.push({ x:nx, y:ny });
        break;
      }

      x = nx; y = ny;
    }
    // 保证至少两个点(避免单点无法绘制线段)
    if (points.length === 1){
      points.push({ x: x + vx*step, y: y + vy*step });
    }
    return points;
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

    // —— 主激光(三层光束) ——
    const drawPath = (pts, w, alpha, color) => {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    };
    ctx.shadowBlur = 20;
    drawPath(this.points, 12, a * 0.35, this.color);   // 外层光晕
    drawPath(this.points, 6,  a * 0.7,  this.color);    // 中层
    drawPath(this.points, 2,  a,        '#ffffff');     // 核心白光

    // —— 边界发散光(稍细,色调偏紫青以区分) ——
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
    this.dir = DIR.UP;
    this.speed = 1.4;
    this.hp = 100; this.maxHp = 100;
    this.dead = false;
    this.fireTimer = 0;
    this.moving = false;
    this.animTick = 0;            // 履带动画
    this.spawnFlash = 30;         // 出生闪烁
  }
  get rect(){ return { x:this.x, y:this.y, w:this.w, h:this.h }; }

  // 尝试移动 dx,dy,带碰撞检测
  tryMove(dx, dy, game){
    const nx = this.x + dx, ny = this.y + dy;
    const testRect = { x:nx, y:ny, w:this.w, h:this.h };
    // 边界
    if (nx < 0 || nx+this.w > W || ny < 0 || ny+this.h > H) return false;
    // 地形碰撞(砖墙/钢墙/水 阻挡; 草/冰/空 可通行)
    const c0 = Util.toCell(testRect.x), c1 = Util.toCell(testRect.x+testRect.w-1);
    const r0 = Util.toCell(testRect.y), r1 = Util.toCell(testRect.y+testRect.h-1);
    for (let cy=r0; cy<=r1; cy++){
      for (let cx=c0; cx<=c1; cx++){
        if (cx<0||cx>=COLS||cy<0||cy>=ROWS) return false;
        const t = game.grid[cy][cx].type;
        if (t===T.BRICK || t===T.STEEL || t===T.WATER || t===T.BASE) return false;
      }
    }
    // 坦克间碰撞 —— 检测重叠,但不直接拒绝(避免黏连卡住):
    // 1) 有伤害冷却则造成碰撞伤害(不重复)
    // 2) 若 testRect 会与其他坦克重叠 → 拒绝这一步(保持原有分离位置)
    // 3) 若当前位置已重叠(黏连),则把 this 沿最短轴推开
    const others = [game.player, ...game.enemies, game.boss].filter(t=>t && t!==this && !t.dead);
    let blocked = false;
    for (const o of others){
      const testHit = Util.rectsHit(testRect, o.rect);
      if (testHit) blocked = true;
      const curHit = Util.rectsHit(this.rect, o.rect);
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
        // 已黏连 → 推开,防止卡在一起不动
        if (curHit){
          this.separateFrom(o, game);
        }
      }
    }
    if (blocked) return false;
    // 冷却递减
    if (this.collideCd > 0) this.collideCd -= 16;
    this.x = nx; this.y = ny;
    this.cx = this.x + this.w/2; this.cy = this.y + this.h/2;
    return true;
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
  renderBody(ctx, imgKey, fallbackColor){
    ctx.save();
    ctx.translate(this.cx, this.cy);
    // 根据方向旋转(图片默认朝上)
    const rot = [0, Math.PI/2, Math.PI, -Math.PI/2][this.dir];
    ctx.rotate(rot);
    // 出生闪烁
    if (this.spawnFlash > 0){
      ctx.globalAlpha = (Math.floor(this.spawnFlash/4)%2) ? 0.4 : 1;
    }
    const img = Assets.get(imgKey);
    const s = this.w;
    const baseColor = fallbackColor;

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
      // 履带齿纹(随移动滚动)
      const treadOffset = this.moving ? (Math.floor(this.animTick/3) % 4) * (s/4) : 0;
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
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // 炮管(独立绘制,不随贴图)
    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.rotate([0, Math.PI/2, Math.PI, -Math.PI/2][this.dir]);
    // 炮管渐变(深色金属感)
    const barrelGrad = ctx.createLinearGradient(-3, 0, 3, 0);
    barrelGrad.addColorStop(0, '#0f172a');
    barrelGrad.addColorStop(0.5, '#475569');
    barrelGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = barrelGrad;
    ctx.fillRect(-3, -this.h/2-7, 6, 9);
    // 炮口
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(-4, -this.h/2-8, 8, 2);
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
  }

  hurt(dmg, game, opts){
    opts = opts || {};
    if (this.invuln > 0) return;
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
      // 玩家坦克被击毁 —— 大爆炸+屏幕震动
      game.shake = Math.max(game.shake, 18);
      game.spawnExplosion(this.cx, this.cy, 55);
      // 多层连续爆炸,增加冲击感
      setTimeout(()=>{ game.spawnExplosion(this.cx+12, this.cy-8, 30); }, 80);
      setTimeout(()=>{ game.spawnExplosion(this.cx-14, this.cy+10, 35); game.shake = Math.max(game.shake, 10); }, 180);
      setTimeout(()=>{ game.spawnExplosion(this.cx, this.cy+6, 28); }, 280);
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

    // 更新Buff
    this.buffs = this.buffs.filter(b => { b.time -= dt; return b.time > 0; });

    // —— 移动输入(WASD + 方向键 + 触控摇杆) ——
    let dx=0, dy=0, moved=false;
    if (Input.down('a') || Input.down('arrowleft'))  { dx=-1; this.dir=DIR.LEFT;  moved=true; }
    else if (Input.down('d') || Input.down('arrowright')) { dx=1;  this.dir=DIR.RIGHT; moved=true; }
    else if (Input.down('w') || Input.down('arrowup'))    { dy=-1; this.dir=DIR.UP;    moved=true; }
    else if (Input.down('s') || Input.down('arrowdown'))  { dy=1;  this.dir=DIR.DOWN;  moved=true; }

    // 充能中降低移动速度(蓄力锁定感),移动仍可继续
    let moveSpeedMul = 1;
    if (this.laserState === 'charging') moveSpeedMul = 0.55;

    if (moved){
      // 速度加成:涡轮增压引擎 +25% + 移速Buff
      let sp = this.speed * moveSpeedMul;
      if (this.hasPassive('turbo_engine')) sp *= 1.25;
      if (this.hasBuff('speed')) sp *= 1.6;
      // 冰面打滑:防滑履带消除(简化为速度提升但难控制)
      const terrain = this.currentTerrain(game);
      if (terrain === T.ICE && !this.hasPassive('anti_slip')) sp *= 1.7;
      // 对齐到网格中心,方便通过窄道(坦克大战经典处理)
      this.alignToAxis(dx, dy);
      this.tryMove(dx*sp, dy*sp, game);
      this.moving = true;
      this.animTick++;
    } else {
      this.moving = false;
    }

    // —— 激光充能状态机 + 射击逻辑 ——
    const now = Date.now();
    const SHORT_PRESS_MS = 130;     // 短按阈值:小于此值松开=单点直接发射1道
    // 激光触发条件:① 选中激光槽位(6)且已解锁  ② 攻击充能满5次(彩蛋/连击奖励,与是否解锁无关)
    //    —— 解锁前:5次射击触发激光是唯一方式
    //    —— 解锁后:即便用普通武器,每攒满5次也能触发一次激光作为连击奖励
    const shouldFireLaser = (game.laserUnlocked && this.currentWeapon === 6)
                         || (this.attackCount >= 5);
    // 非激光武器时清理激光充能状态(防止残留)
    // 但 attackCount>=5(连击彩蛋)时允许激光状态机运行,即便不在激光槽位
    if (!shouldFireLaser && this.laserState !== 'idle'){
      this.laserState = 'idle';
      this.laserPendingPress = false;
    }

    if (this.laserState === 'idle'){
      // 空闲状态:空格按下 → 普通射击 或 开始激光(短按判定+蓄力)
      if (Input.down(' ') && this.fireTimer <= 0){
        if (shouldFireLaser){
          if (!this.laserPendingPress){
            this.laserPendingPress = true;
            this.laserPressTime = now;
          }
          // 超过短按阈值还在按着 → 进入蓄力状态
          if (now - this.laserPressTime >= SHORT_PRESS_MS){
            this.laserState = 'charging';
            this.laserChargeStart = this.laserPressTime; // 从按下那一刻算起,更顺滑
            this.laserPendingPress = false;
          }
        } else {
          this.fire(game);
          this.attackCount++;
        }
      } else {
        // 检测到已经按下过(laserPendingPress=true)且现在松开了 → 短按,直接发射1道
        if (this.laserPendingPress){
          this.laserPendingPress = false;
          const held = now - this.laserPressTime;
          // 松开即发射激光(移除短按阈值,避免5发后卡住无反应)
          this.laserState = 'firing';
          this.fireLaser(game, 1, 1.0);
          this.attackCount = 0;  // 发射后重置充能(避免连击彩蛋无限触发)
          setTimeout(()=>{ this.laserState = 'idle'; }, 100);
        }
      }
    } else if (this.laserState === 'charging'){
      // 充能进度 0~1,映射 Lv1~Lv5
      const progress = Math.min(1, (now - this.laserChargeStart) / this.laserChargeDur);
      // 充能粒子特效:围绕炮口(强度随progress增加)
      if (Math.random() < 0.25 + progress*0.6){
        const mz = this.getMuzzle();
        const v = DIR_VEC[this.dir];
        const spread = (1-progress)*14 + 4;
        const ox = (Math.random()-0.5) * spread + v[0]*progress*8;
        const oy = (Math.random()-0.5) * spread + v[1]*progress*8;
        game.spawnSparks(mz.x+ox, mz.y+oy, progress>0.7?'#22d3ee':'#67e8f9', 1);
      }
      // 充能完成 → 自动发射满级(Lv.5 五道)
      if (progress >= 1){
        this.laserState = 'firing';
        this.fireLaser(game, 5, 1.8);
        this.attackCount = 0;  // 发射后重置充能
        setTimeout(()=>{ this.laserState = 'idle'; }, 100);
      }
      // 蓄力中松开空格 → 按当前进度对应等级发射
      if (!Input.down(' ')){
        const lv = Math.max(1, Math.min(5, Math.ceil(progress * 5)));
        const mulTbl = [0, 1.0, 1.15, 1.3, 1.5, 1.8];
        this.laserState = 'firing';
        this.fireLaser(game, lv, mulTbl[lv]);
        this.attackCount = 0;  // 发射后重置充能
        setTimeout(()=>{ this.laserState = 'idle'; }, 100);
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
    if (this.currentWeapon === 6) return; // 激光槽位不发射普通炮弹
    if (!this.unlockedWeapons.includes(this.currentWeapon)) return;
    const w = WEAPONS[this.currentWeapon];
    // 冷却:快速装填模块缩短22%
    let cd = w.cd;
    if (this.hasPassive('fast_reload')) cd *= 0.78;
    if (this.hasBuff('rapidfire')) cd *= 0.4;
    this.fireTimer = cd;

    const muzzle = this.getMuzzle();
    // 伤害加成:穿甲弹头改良+15%,火力激增,暴击
    let dmg = w.dmg;
    if (this.hasPassive('ap_rounds')) dmg *= 1.15;
    if (this.hasBuff('power')) dmg *= 1.5;
    if (this.hasBuff('crit') && Util.chance(0.5)) dmg *= 2;

    // 制导芯片:增大导弹爆炸半径
    const guidance = this.hasPassive('guidance_chip');
    const splash = (guidance && w.splash > 0) ? w.splash*1.5 : w.splash;
    const wUse = Object.assign({}, w, { dmg, splash });

    if (w.type === 'shotgun'){
      // 散弹:3发扇形
      for (let i=-1;i<=1;i++){
        const ang = [0, Math.PI/2, Math.PI, -Math.PI/2][this.dir] + i*0.25;
        const b = new Bullet(muzzle.x, muzzle.y, this.dir, wUse, 'player');
        b.vx = Math.cos(ang)*w.speed; b.vy = Math.sin(ang)*w.speed;
        game.bullets.push(b);
      }
    } else {
      game.bullets.push(new Bullet(muzzle.x, muzzle.y, this.dir, wUse, 'player'));
    }
    game.muzzleFlash(muzzle.x, muzzle.y);
  }

  // 激光:支持多弹道+伤害倍率。lv=1~5对应1~5条道, dmgMul=倍率系数
  fireLaser(game, lv, dmgMul){
    lv = Math.max(1, Math.min(5, lv||1));
    dmgMul = dmgMul || 1.0;
    const muzzle = this.getMuzzle();
    // 单道伤害:基础100 × 倍率 × 被动/Buff加成
    let dmg = 100 * dmgMul;
    if (this.hasPassive('ap_rounds')) dmg *= 1.15;
    if (this.hasBuff('power')) dmg *= 1.5;
    if (this.hasBuff('crit') && Util.chance(0.5)) dmg *= 2;

    // 多弹道扇形发散:水平/垂直方向偏移,角度很小(保证集中)
    const v = DIR_VEC[this.dir];
    const isHoriz = (this.dir === DIR.LEFT || this.dir === DIR.RIGHT);
    // 每道之间的间距(像素,垂直于发射方向)
    const spacing = 5;
    const totalOffset = (lv - 1) * spacing;
    const startOff = -totalOffset / 2;

    for (let i=0; i<lv; i++){
      const off = startOff + i*spacing;
      // 偏移起点(垂直于方向): 例如上下方向时偏移X轴,左右方向偏移Y轴
      const ox = isHoriz ? 0 : off;
      const oy = isHoriz ? off : 0;
      // 轻微发散角(随道数增加),最多 2.5°×(i-centerIdx)
      const spreadAngle = lv <= 1 ? 0 : ((i - (lv-1)/2) * 0.035);
      let dirVec = [v[0], v[1]];
      if (spreadAngle !== 0){
        const cos = Math.cos(spreadAngle), sin = Math.sin(spreadAngle);
        dirVec = [v[0]*cos - v[1]*sin, v[0]*sin + v[1]*cos];
      }
      // 估算方向序号(0上1右2下3左),最接近原方向即可
      let dDir = this.dir;
      if (spreadAngle !== 0){
        const ang = Math.atan2(dirVec[1], dirVec[0]); // -PI..PI (x向右,y向下)
        // Canvas y轴朝下,约定: 上=(-y),右=(+x),下=(+y),左=(-x)
        // ang对应: 0=RIGHT, PI/2=DOWN, PI或-PI=LEFT, -PI/2=UP
        const deg = ang * 180 / Math.PI;
        if (deg >= -45 && deg < 45) dDir = DIR.RIGHT;
        else if (deg >= 45 && deg < 135) dDir = DIR.DOWN;
        else if (deg >= 135 || deg < -135) dDir = DIR.LEFT;
        else dDir = DIR.UP;
      }
      game.lasers.push(new Laser(muzzle.x+ox, muzzle.y+oy, dDir, dmg, game));
    }

    // 激光冷却(随道数略微增加,避免连发过于夸张)
    this.fireTimer = 400 + lv * 40;
    // —— 发射瞬间增强特效 ——
    // 爆发式震屏(随等级加强)
    game.shake = Math.max(game.shake, 7 + lv);
    // 更强的炮口闪光
    game.muzzleFlash(muzzle.x, muzzle.y);
    // 能量爆发粒子:三波不同颜色,从炮口喷射
    const sparkN = 6 + lv*3;
    game.spawnSparks(muzzle.x, muzzle.y, '#ffffff', sparkN);
    game.spawnSparks(muzzle.x, muzzle.y, lv>=4 ? '#22d3ee' : '#67e8f9', sparkN+2);
    if (lv >= 3) game.spawnSparks(muzzle.x, muzzle.y, '#a855f7', 4 + lv*2);
    // 额外的发射方向扇形粒子
    for (let i=0;i<6+lv*2;i++){
      const ang = [0, Math.PI/2, Math.PI, -Math.PI/2][this.dir] + (Math.random()-0.5)*0.8;
      const sp = 1 + Math.random()*3;
      const px = muzzle.x + Math.cos(ang)*sp;
      const py = muzzle.y + Math.sin(ang)*sp;
      game.spawnSparks(px, py, '#67e8f9', 2);
    }
    // 瞬时光环(爆炸式扩散)
    const now = Date.now();
    game.laserBurstFx = game.laserBurstFx || [];
    game.laserBurstFx.push({ x:muzzle.x, y:muzzle.y, t:now, dur:250 + lv*30 });
  }

  getMuzzle(){
    const v = DIR_VEC[this.dir];
    return { x: this.cx + v[0]*this.w/2, y: this.cy + v[1]*this.h/2 };
  }

  hasBuff(id){ return this.buffs.some(b=>b.id===id); }
  addBuff(id, time){ this.buffs.push({id, time}); }

  respawn(game){
    this.hp = this.maxHp;
    this.dead = false;
    this.cx = 9*TILE+TILE/2; this.cy = 16*TILE+TILE/2;
    this.x = this.cx-this.w/2; this.y=this.cy-this.h/2;
    this.dir = DIR.UP;
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
    this.renderBody(ctx, 'tank_player', '#22c55e');
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
    this.renderHpBar(ctx, '#22c55e');
    // —— 激光蓄力动画渲染 ——
    if (this.laserState === 'charging' || this.laserState === 'firing'){
      const now = Date.now();
      const progress = this.laserState === 'firing'
        ? 1
        : Math.min(1, (now - this.laserChargeStart) / this.laserChargeDur);
      // 当前蓄力等级 1~5
      const lv = Math.max(1, Math.min(5, Math.ceil(progress * 5)));
      const mz = this.getMuzzle();
      const v = DIR_VEC[this.dir];
      const t = now / 60;

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

      // 1.5) 能量球外侧显示 N 个小点,表示即将发射的弹道数量
      if (lv >= 2){
        const isHoriz = (this.dir === DIR.LEFT || this.dir === DIR.RIGHT);
        const dotSpacing = 5;
        const dotR = 2 + progress*1.2;
        for (let i=0; i<lv; i++){
          const off = ((i - (lv-1)/2) * dotSpacing);
          const dx = isHoriz ? 0 : off;
          const dy = isHoriz ? off : 0;
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

      // 4) 炮口前方准激光预览(短的光束尾迹,高等级显示多条)
      if (progress > 0.3){
        const previewLen = (progress - 0.3) * 130 / 0.7;
        const isHoriz = (this.dir === DIR.LEFT || this.dir === DIR.RIGHT);
        const spacing = 4;
        for (let i=0; i<lv; i++){
          const off = ((i - (lv-1)/2) * spacing);
          const ox = isHoriz ? 0 : off;
          const oy = isHoriz ? off : 0;
          const ex = mz.x + ox + v[0]*previewLen;
          const ey = mz.y + oy + v[1]*previewLen;
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
    const laserSlotReady = (this.laserUnlocked && this.currentWeapon === 6);
    const comboReady = (this.attackCount >= 5);
    if (this.laserState === 'idle' && (laserSlotReady || comboReady)){
      const t = Date.now()/120;
      ctx.fillStyle = `rgba(103,232,249,${0.6+0.4*Math.sin(t)})`;
      ctx.shadowColor = '#67e8f9'; ctx.shadowBlur = 10;
      ctx.font = 'bold 11px Consolas'; ctx.textAlign = 'center';
      ctx.fillText(laserSlotReady ? '⚡LASER' : '⚡READY', this.cx, this.y - 14);
      ctx.shadowBlur = 0;
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
      // 敌人被击毁 —— 增强爆炸特效
      game.shake = Math.max(game.shake, this.type==='heavy'?10:5);
      game.spawnExplosion(this.cx, this.cy, this.type==='heavy'?55:38);
      // 重甲坦克额外连续爆炸
      if (this.type === 'heavy'){
        setTimeout(()=>{ game.spawnExplosion(this.cx+10, this.cy-5, 30); }, 100);
        setTimeout(()=>{ game.spawnExplosion(this.cx-8, this.cy+8, 28); }, 200);
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

    // 移动
    const v = DIR_VEC[this.dir];
    const moved = this.tryMove(v[0]*this.speed, v[1]*this.speed, game);
    if (!moved){
      // 撞墙换方向
      this.decideAI(game);
    }
    this.animTick++;

    // 自爆坦克:接近玩家就爆炸
    if (this.type === 'suicide' && game.player && !game.player.dead){
      if (Util.dist(this.cx,this.cy,game.player.cx,game.player.cy) < TILE*1.2){
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
    const target = game.player && !game.player.dead ? game.player : { cx: 9*TILE, cy: 19*TILE };
    if (Util.chance(0.55)){
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
    game.bullets.push(new Bullet(muzzle.x, muzzle.y, this.dir, w, 'enemy'));
  }

  getMuzzle(){
    const v = DIR_VEC[this.dir];
    return { x: this.cx + v[0]*this.w/2, y: this.cy + v[1]*this.h/2 };
  }

  // 自爆
  explode(game){
    this.dead = true;
    game.spawnExplosion(this.cx, this.cy, 45);
    if (game.player && !game.player.dead && Util.dist(this.cx,this.cy,game.player.cx,game.player.cy) < 50){
      game.player.hurt(45, game, { splash:true }); // 自爆溅射
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
      // BOSS被击毁 —— 震撼级多段大爆炸
      game.shake = Math.max(game.shake, 28);
      game.spawnExplosion(this.cx, this.cy, 95);
      setTimeout(()=>{ game.spawnExplosion(this.cx+30, this.cy-20, 65); game.shake = Math.max(game.shake,18); }, 120);
      setTimeout(()=>{ game.spawnExplosion(this.cx-28, this.cy+24, 70); game.shake = Math.max(game.shake,20); }, 260);
      setTimeout(()=>{ game.spawnExplosion(this.cx+10, this.cy+16, 55); }, 400);
      setTimeout(()=>{ game.spawnExplosion(this.cx-18, this.cy-10, 50); game.shake = Math.max(game.shake,12); }, 520);
      setTimeout(()=>{ game.onBossKilled(); }, 650);
    }
  }

  update(dt, game){
    if (this.spawnFlash > 0){ this.spawnFlash--; return; }
    if (this.dead) return;
    if (game.freezeTimer > 0) return;

    if (this.fireTimer > 0) this.fireTimer -= dt;
    this.moveTimer -= dt;

    // 横向巡逻
    if (this.moveTimer <= 0){
      this.moveTimer = 1500;
      this.dir = Util.chance(0.5) ? DIR.LEFT : DIR.RIGHT;
    }
    const v = DIR_VEC[this.dir];
    if (!this.tryMove(v[0]*this.speed, v[1]*this.speed, game)){
      this.dir = this.dir === DIR.LEFT ? DIR.RIGHT : DIR.LEFT;
    }

    // 射击:多发炮弹(扇形/追踪)
    if (this.fireTimer <= 0){
      this.fire(game);
      this.fireTimer = this.phase === 2 ? 600 : (this.phase === 1 ? 900 : 1200);
    }
  }

  fire(game){
    const baseAng = Math.PI/2; // 朝下
    const count = this.phase === 2 ? 5 : (this.phase === 1 ? 3 : 1);
    const w = { dmg:22, speed:3.2, color:'#ef4444', pierce:false, splash:0, type:'normal' };
    for (let i=0;i<count;i++){
      const ang = baseAng + (i - (count-1)/2) * 0.3;
      const b = new Bullet(this.cx, this.cy+this.h/2, DIR.DOWN, w, 'enemy');
      b.vx = Math.cos(ang)*w.speed; b.vy = Math.sin(ang)*w.speed;
      game.bullets.push(b);
    }
    // 阶段2:发射追踪弹
    if (this.phase === 2 && game.player){
      const wb = { dmg:25, speed:3.0, color:'#fb923c', pierce:false, splash:0, type:'homing' };
      const b = new Bullet(this.cx, this.cy+this.h/2, DIR.DOWN, wb, 'enemy');
      b.target = game.player;
      game.bullets.push(b);
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
      // 6) 多炮管(三联装,朝下)
      ctx.fillStyle = '#0f172a';
      const barrelW = 5, barrelH = 10;
      [-s*0.18, 0, s*0.18].forEach(bx=>{
        const bGrad = ctx.createLinearGradient(bx-3, 0, bx+3, 0);
        bGrad.addColorStop(0, '#0f172a');
        bGrad.addColorStop(0.5, '#475569');
        bGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = bGrad;
        ctx.fillRect(bx-barrelW/2, s/2-barrelH+2, barrelW, barrelH);
      });
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
    // BOSS标签
    ctx.fillStyle='#ef4444'; ctx.font='bold 11px Consolas'; ctx.textAlign='center';
    ctx.fillText('BOSS', this.cx, by-4);
  }
}

/* ===================== 十四、粒子(特效) ===================== */
class Particle {
  constructor(x,y,vx,vy,color,life,size){
    this.x=x;this.y=y;this.vx=vx;this.vy=vy;
    this.color=color;this.life=life;this.maxLife=life;this.size=size||3;
    this.dead=false;
  }
  update(dt){
    this.x+=this.vx; this.y+=this.vy;
    this.vx*=0.94; this.vy*=0.94;
    this.life--;
    if(this.life<=0) this.dead=true;
  }
  render(ctx){
    const a = this.life/this.maxLife;
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
  constructor(canvas, minimap){
    Game.instance = this;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.minimap = minimap;
    this.mctx = minimap.getContext('2d');

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
    this.laserUnlocked = this.loadLaserUnlocked();      // 激光主炮解锁 → 充能激光常驻
    this.savedInventory = this.loadInventory();         // 背包消耗道具(阵亡保留,跨局保留)
    this.shopOpen = false;                              // 商店打开中(暂停游戏)
    this.shopFrom = 'menu';                             // 商店来源: menu/level(通关)/playing(战斗中)
    this.lastStartedLevel = 1;                          // 上次开始的关卡(重新开始用)

    this.grid = [];           // 地形网格
    this.player = null;
    this.enemies = [];
    this.boss = null;
    this.bullets = [];
    this.lasers = [];         // 激光(充能发射)
    this.particles = [];
    this.drops = [];
    this.chests = [];
    this.mines = [];

    this.baseHp = 100; this.baseMaxHp = 100;
    this.enemiesToSpawn = 0;
    this.spawnTimer = 0;
    this.spawnPoints = [ {c:1,r:0}, {c:9,r:0}, {c:18,r:0} ];
    this.bossSpawned = false;
    this.freezeTimer = 0;     // 冰冻效果
    this.airstrikeTimer = 0;  // 空袭动画
    this.shake = 0;           // 屏幕震动

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
    this.enemies = [];
    this.bullets = [];
    this.lasers = [];
    this.particles = [];
    this.drops = [];
    this.chests = [];
    this.mines = [];
    this.boss = null;
    this.bossSpawned = false;
    // 计时器/计数器归零
    this.enemiesToSpawn = 0;
    this.spawnTimer = 0;
    this.freezeTimer = 0;
    this.airstrikeTimer = 0;
    this.shake = 0;
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
  // 公共方法:构建单个商店商品元素(weapon/laser 特殊渲染)
  buildShopItemEl(item){
    const owned  = this.getShopOwnedDesc(item);
    const maxed  = this.isShopItemMaxed(item);
    const canBuy = this.canBuyShopItem(item);
    const noPlayer = item.type === 'passive' && !this.player;
    const isWeapon = (item.type === 'weapon' || item.type === 'laser');
    const div = document.createElement('div');

    if (isWeapon){
      // —— 武器类商品:已解锁=灰色不可买, 未解锁=锁住状态 ——
      if (maxed){
        div.className = 'shop-item s-unlocked';
        div.innerHTML =
          `<div class="s-ico">${item.icon}</div>` +
          `<div class="s-info">` +
            `<div class="s-name">${item.name} <span class="s-cost">${item.cost}🪙</span></div>` +
            `<div class="s-desc">${item.desc}</div>` +
            `<div class="s-owned">✅ 已永久解锁</div>` +
          `</div>` +
          `<button class="s-buy maxed" disabled>已解锁</button>`;
      } else {
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
        if (canBuy){
          btn.addEventListener('click', ()=> this.buyItem(item.id));
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
    if (item.type === 'weapon')   return this.unlockedWeapons.includes(item.wid);
    if (item.type === 'laser')    return this.laserUnlocked;
    if (item.type === 'passive')  return this.player ? this.player.passives.length >= 3 : false;
    if (item.type === 'item')     return (this.savedInventory[item.iid] || 0) >= 9;
    return false;
  }

  buyItem(id){
    const item = SHOP_ITEMS.find(s=>s.id===id);
    if (!item) return;
    // 被动装备需要活跃玩家(战斗中/通关后才能买)
    if (item.type === 'passive' && !this.player){
      this.flashMsg('请进入战斗后购买被动装备');
      return;
    }
    if (this.isShopItemMaxed(item)){ this.flashMsg('已满级/已装备'); return; }
    if (this.credits < item.cost){ this.flashMsg('积分不足'); return; }
    this.credits -= item.cost;
    if (item.type === 'weapon'){
      if (!this.unlockedWeapons.includes(item.wid)) this.unlockedWeapons.push(item.wid);
      this.saveUnlockedWeapons();
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
    this.flashMsg('购买成功: ' + item.name);
  }

  // 打开商店浮层(from: 'menu'/'level'/'playing')
  openShop(from){
    this.shopOpen = true;
    this.shopFrom = from || 'menu';
    this.shopTab = this.shopTab || 'passive';
    if (this.state === 'playing') this.state = 'paused'; // 暂停游戏
    this.showView('shop');
    this.renderShopView();
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
      return false;
    });
    items.forEach(item=>{
      content.appendChild(this.buildShopItemEl(item));
    });
    // 已装备被动栏(底部3格)
    const eq = document.getElementById('eq-slots');
    if (eq){
      eq.innerHTML = '';
      for (let i=0;i<3;i++){
        const p = this.player ? this.player.passives[i] : null;
        const def = p ? PASSIVES.find(x=>x.id===p.id) : null;
        const slot = document.createElement('div');
        slot.className = 'eq-slot' + (def?'':' empty');
        slot.innerHTML = def ? `<span class="ico">${def.icon}</span><span class="nm">${def.name}</span>` : '<span class="nm">空</span>';
        eq.appendChild(slot);
      }
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
    // 应用永久数据:武器解锁(0号初始 + 商店永久解锁)、背包道具(跨局保留)、被动清空(新局)
    this.player.unlockedWeapons = [0, ...this.unlockedWeapons];
    this.player.currentWeapon = 0;
    this.player.passives = [];                       // 新局被动清空(本局通关商店购买/掉落获得)
    this.player.inventory = this.savedInventory.slice();  // 背包从存档恢复(使用时同步回存档)
    this.player.laserUnlocked = this.laserUnlocked;  // 激光主炮解锁状态(渲染/射击用)
    this.baseMaxHp = 100; this.baseHp = 100;          // 基地血量固定100
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
    this.player.unlockedWeapons = [0, ...this.unlockedWeapons];
    this.player.currentWeapon = 0;
    this.player.passives = [];
    this.player.inventory = this.savedInventory.slice();
    this.player.laserUnlocked = this.laserUnlocked;
    this.baseMaxHp = 100; this.baseHp = 100;
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
    while (remain >= 0.01){
      const step = Math.min(remain, 1.5);
      const nx = Util.clamp(t.x + sx*step, 0, W-t.w);
      const ny = Util.clamp(t.y + sy*step, 0, H-t.h);
      const c0=Util.toCell(nx), c1=Util.toCell(nx+t.w-1);
      const r0=Util.toCell(ny), r1=Util.toCell(ny+t.h-1);
      let ok = true;
      for (let cy=r0; cy<=r1 && ok; cy++){
        for (let cx=c0; cx<=c1 && ok; cx++){
          if (cx<0||cx>=COLS||cy<0||cy>=ROWS){ ok=false; break; }
          const tp = this.grid[cy][cx].type;
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
    // 数字键切换武器(仅游戏中,1-6普通武器,7激光主炮)
    if (k >= '1' && k <= '6' && this.state === 'playing'){
      const idx = parseInt(k)-1;
      if (this.player && this.player.unlockedWeapons.includes(idx)){
        this.player.currentWeapon = idx;
        this.updateUI();
      }
    }
    // 7键:切换到激光主炮(需解锁)
    if (k === '7' && this.state === 'playing'){
      if (this.player && this.player.laserUnlocked){
        this.player.currentWeapon = 6;
        this.updateUI();
      }
    }
    if (k === 'q' && this.state === 'playing'){ this.useActiveItem(); }
    // B键:战斗中打开商店(暂停),商店打开时关闭
    if (k === 'b'){
      if (this.shopOpen) this.closeShop();
      else if (this.state === 'playing') this.openShop('playing');
    }
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
    // 核心火球(大)
    for (let i=0;i<Math.floor(radius/2);i++){
      const ang = Math.random()*Math.PI*2;
      const sp = Util.rand(0.8, 3.5);
      const colors = ['#fbbf24','#ef4444','#f97316','#fff','#fef3c7'];
      this.particles.push(new Particle(x,y, Math.cos(ang)*sp, Math.sin(ang)*sp, Util.pick(colors), Util.randInt(22,50), Util.rand(4,9)));
    }
    // 外圈飞溅碎片(高速)
    for (let i=0;i<Math.floor(radius/3);i++){
      const ang = Math.random()*Math.PI*2;
      const sp = Util.rand(2.5, 6);
      const colors = ['#78350f','#991b1b','#44403c'];
      this.particles.push(new Particle(x,y, Math.cos(ang)*sp, Math.sin(ang)*sp, Util.pick(colors), Util.randInt(18,38), Util.rand(2,5)));
    }
    // 冲击环(淡色扩散)
    for (let i=0;i<10;i++){
      const ang = (i/10)*Math.PI*2;
      const sp = radius/12;
      this.particles.push(new Particle(x,y, Math.cos(ang)*sp, Math.sin(ang)*sp, 'rgba(255,220,150,0.8)', Util.randInt(14,22), 5));
    }
    // 烟雾(慢速上升)
    for (let i=0;i<Math.floor(radius/5);i++){
      const ang = Math.random()*Math.PI*2;
      const sp = Util.rand(0.4, 1.2);
      this.particles.push(new Particle(x+Util.rand(-8,8),y+Util.rand(-8,8), Math.cos(ang)*sp, -Math.abs(Math.sin(ang)*sp)-0.3, 'rgba(80,80,80,0.7)', Util.randInt(35,55), Util.rand(5,10)));
    }
    this.shake = Math.max(this.shake, Math.floor(radius/8));
  }
  spawnSparks(x,y,color,n){
    for (let i=0;i<n;i++){
      const ang = Math.random()*Math.PI*2;
      const sp = Util.rand(1,3);
      this.particles.push(new Particle(x,y, Math.cos(ang)*sp, Math.sin(ang)*sp, color, Util.randInt(10,20), 2));
    }
  }
  spawnBrickDebris(cx,cy){
    const x = cx*TILE+TILE/2, y = cy*TILE+TILE/2;
    for (let i=0;i<6;i++){
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

    // 激光
    this.lasers.forEach(l => l.update());
    this.lasers = this.lasers.filter(l => !l.dead);

    // 粒子
    this.particles.forEach(p => p.update(dt));
    this.particles = this.particles.filter(p => !p.dead);
    // 激光爆发光环特效(清理过期)
    if (this.laserBurstFx){
      const now = Date.now();
      this.laserBurstFx = this.laserBurstFx.filter(f => now - f.t < f.dur);
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

    // 6) 子弹
    this.bullets.forEach(b => b.render(ctx));

    // 7) 草丛层(遮挡坦克,实现隐身视觉效果)
    this.renderTerrain(ctx, true);

    // 8) 激光(草丛之上,保证光束清晰可见)
    this.lasers.forEach(l => l.render(ctx));

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

    // 冰冻效果遮罩
    if (this.freezeTimer > 0){
      ctx.fillStyle = `rgba(103,232,249,${0.1+0.05*Math.sin(Date.now()/200)})`;
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
      const inLaserSlot = (this.player.currentWeapon === 6 && this.player.laserUnlocked);
      if (inLaserSlot){
        document.getElementById('laser-fill').style.width = '100%';
        document.getElementById('laser-text').textContent = '常驻⚡';
      } else {
        // 普通武器:显示连击充能进度(满5次触发激光彩蛋)
        document.getElementById('laser-fill').style.width = (ac/5*100)+'%';
        document.getElementById('laser-text').textContent = ac >= 5 ? '就绪!' : (ac+'/5');
      }
    }

    this.updateWeaponBar();
    this.updatePassiveUI();
    this.updateInventoryUI();
    this.updateBuffUI();
  }

  updateWeaponBar(){
    const bar = document.getElementById('weapon-bar');
    if (!this.player){ bar.innerHTML=''; return; }
    bar.innerHTML = '';
    WEAPONS.forEach((w, i) => {
      const unlocked = this.player.unlockedWeapons.includes(i);
      const active = this.player.currentWeapon === i;
      const div = document.createElement('div');
      div.className = 'weapon' + (active?' active':'') + (unlocked?'':' locked');
      div.innerHTML = `<span class="num">${i+1}</span><div class="wicon">${w.icon}</div><div class="wname">${unlocked?w.name:'未解锁'}</div>`;
      div.onclick = () => { if(unlocked){ this.player.currentWeapon=i; this.updateUI(); } };
      bar.appendChild(div);
    });
    // 激光槽位(第7格,解锁后显示,紫色高亮)
    if (this.player.laserUnlocked){
      const active = this.player.currentWeapon === 6;
      const div = document.createElement('div');
      div.className = 'weapon laser-slot' + (active?' active':'');
      div.innerHTML = `<span class="num">7</span><div class="wicon">⚡</div><div class="wname">激光主炮</div>`;
      div.onclick = () => { this.player.currentWeapon = 6; this.updateUI(); };
      bar.appendChild(div);
    }
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
    // 统一保存所有持久化数据(防止中途退出/刷新丢失)
    this.checkHighScore();                // 最高分(含实时比较)
    this.saveCredits();                   // 积分
    this.saveEndlessMax();               // 无尽模式最高波次
    this.saveInventory();                // 背包道具
    this.saveUnlockedWeapons();          // 武器解锁
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
    try { return Math.max(1, parseInt(localStorage.getItem('tank_battle_unlocked')||'1',10)); }
    catch(e){ return 1; }
  }
  saveUnlocked(){
    try { localStorage.setItem('tank_battle_unlocked', this.unlockedLevels); } catch(e){}
  }
  loadCleared(){
    try { return JSON.parse(localStorage.getItem('tank_battle_cleared')||'[]'); }
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
    const dt = Math.min(time - this.lastTime, 50) || 16;
    this.lastTime = time;
    this.update(dt);
    // gameover/win 时只渲染一次静态画面(背景停下来),恢复后自动解冻
    if (this.state === 'gameover' || this.state === 'win'){
      if (!this._frozen){ this.render(); this._frozen = true; }
    } else {
      this._frozen = false;
      this.render();
    }
    requestAnimationFrame(t => this.loop(t));
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

  // 先加载资源,再启动循环(循环内根据state决定是否更新)
  game.startLoading();
  requestAnimationFrame(t => { game.lastTime = t; game.loop(t); });
});
