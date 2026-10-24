const { listDishes } = require('../../services/dishes');
const { ensureUser } = require('../../services/users');
const { generateMenu, pickForWheel } = require('../../utils/menuGenerator');
const { lastNDays } = require('../../utils/date');
const {
  TYPE,
  TYPE_LABELS,
  TYPE_ORDER,
  DEFAULT_TAGS,
} = require('../../utils/constants');

function db() {
  return wx.cloud.database();
}

Page({
  data: {
    // 需求
    people: 2,
    composition: { meat: 1, veg: 1, staple: 1, soup: 0, drink: 0 },
    avoid: [],
    compItems: [],
    defaultTags: DEFAULT_TAGS,
    // 模式与结果
    mode: 'random', // random | wheel
    dishes: [],
    picks: [],
    skippedTypes: [],
    recentCount: 0,
    // 大转盘
    wheelTypes: [],   // 待转类型队列
    wheelIndex: -1,   // 当前转到第几个类型
    wheelPool: [],    // 当前类型的候选（最多 8 个上盘）
    wheelRotation: 0,
    wheelSpinning: false,
    wheelPick: null,
    wheelLocked: [],
    excludedIds: [],
  },

  onLoad() {
    this.loadContext();
  },

  async loadContext() {
    const [user, dishes] = await Promise.all([ensureUser(), listDishes({})]);
    const s = user.settings || {};
    this.setData({
      dishes,
      people: s.people || 2,
      composition: s.composition || { meat: 1, veg: 1, staple: 1, soup: 0, drink: 0 },
      avoid: s.avoid || [],
    });
    this.syncCompItems();
  },

  syncCompItems() {
    this.setData({
      compItems: TYPE_ORDER.map((t) => ({
        key: t,
        label: TYPE_LABELS[t],
        count: this.data.composition[t] || 0,
      })),
    });
  },

  incPeople() { this.setData({ people: Math.min(20, this.data.people + 1) }); },
  decPeople() { this.setData({ people: Math.max(1, this.data.people - 1) }); },
  incType(e) {
    const { key } = e.currentTarget.dataset;
    this.setData({ composition: { ...this.data.composition, [key]: Math.min(6, (this.data.composition[key] || 0) + 1) } });
    this.syncCompItems();
  },
  decType(e) {
    const { key } = e.currentTarget.dataset;
    this.setData({ composition: { ...this.data.composition, [key]: Math.max(0, (this.data.composition[key] || 0) - 1) } });
    this.syncCompItems();
  },
  toggleAvoid(e) {
    const { tag } = e.currentTarget.dataset;
    const avoid = this.data.avoid.slice();
    const i = avoid.indexOf(tag);
    if (i >= 0) avoid.splice(i, 1);
    else avoid.push(tag);
    this.setData({ avoid });
  },

  setMode(e) {
    this.setData({ mode: e.currentTarget.dataset.mode, picks: [], skippedTypes: [], wheelLocked: [], wheelPick: null, excludedIds: [], wheelIndex: -1 });
  },

  // 近 7 天进过菜单的 dish_id（用于去重）
  async recentDishIds() {
    try {
      const days = lastNDays(7);
      const res = await db().collection('menus')
        .where({ date: db().command.in(days) })
        .limit(50)
        .get();
      const ids = [];
      res.data.forEach((m) => (m.items || []).forEach((it) => {
        if (it.dish_id && !ids.includes(it.dish_id)) ids.push(it.dish_id);
      }));
      return ids;
    } catch (e) {
      return [];
    }
  },

  // ===== 随机整单 =====
  async generate() {
    const { dishes, composition, avoid } = this.data;
    const recentDishIds = await this.recentDishIds();
    const { picks, skippedTypes } = generateMenu(dishes, { composition, avoid, recentDishIds });
    this.setData({ picks, skippedTypes, recentCount: recentDishIds.length });
    if (!picks.length) {
      wx.showToast({ title: '厨房里还没有能用的菜，先去加几道', icon: 'none' });
    }
  },

  // 左滑换一批
  onTouchStart(e) { this.touchX = e.touches[0].clientX; },
  async onTouchEnd(e) {
    if (this.data.mode !== 'random' || !this.data.picks.length) return;
    const dx = e.changedTouches[0].clientX - this.touchX;
    if (dx < -60) this.generate();
  },

  // ===== 大转盘 =====
  startWheel() {
    const { composition, avoid } = this.data;
    const wheelTypes = TYPE_ORDER.filter((t) => (composition[t] || 0) > 0);
    if (!wheelTypes.length) {
      wx.showToast({ title: '搭配里一个类型都没选', icon: 'none' });
      return;
    }
    // 菜不够的类直接跳过并提示
    const skipped = wheelTypes.filter((t) => !this.data.dishes.some((d) => d.type === t));
    if (skipped.length) {
      wx.showToast({ title: `厨房还没有${skipped.map((t) => TYPE_LABELS[t]).join('、')}，这几类先跳过`, icon: 'none' });
    }
    const playable = wheelTypes.filter((t) => this.data.dishes.some((d) => d.type === t));
    if (!playable.length) {
      wx.showToast({ title: '先去加几道菜再来转', icon: 'none' });
      return;
    }
    this.setData({ wheelTypes: playable, wheelIndex: -1, wheelLocked: [], excludedIds: [], wheelPick: null });
    this.nextType();
  },

  nextType() {
    const next = this.data.wheelIndex + 1;
    if (next >= this.data.wheelTypes.length) {
      this.finishWheel();
      return;
    }
    const type = this.data.wheelTypes[next];
    const { avoid, excludedIds } = this.data;
    const pool = [];
    // 上盘最多 8 个；逐个抽取直到抽满或池空
    const remaining = this.data.dishes.filter((d) => d.type === type);
    const excl = excludedIds.slice();
    while (pool.length < 8) {
      const pick = pickForWheel(remaining, type, { avoid, excludeIds: excl });
      if (!pick) break;
      pool.push(pick);
      excl.push(pick._id);
    }
    if (!pool.length) {
      wx.showToast({ title: `${TYPE_LABELS[type]}没了，跳过`, icon: 'none' });
      this.setData({ wheelIndex: next });
      this.nextType();
      return;
    }
    this.setData({ wheelIndex: next, wheelPool: pool, wheelPick: null, wheelRotation: 0, wheelSpinning: false });
  },

  spin() {
    if (this.data.wheelSpinning) return;
    const { wheelPool, avoid } = this.data;
    const pick = pickForWheel(wheelPool, wheelPool[0].type, { avoid, excludeIds: [] });
    const idx = wheelPool.findIndex((d) => d._id === pick._id);
    const seg = 360 / wheelPool.length;
    // 转 5 圈 + 停在 idx 位置（指针在正上方 12 点）
    const rotation = this.data.wheelRotation + 360 * 5 + ((360 - (idx * seg + seg / 2)) % 360);
    this.setData({ wheelSpinning: true, wheelRotation: rotation });
    setTimeout(() => {
      this.setData({ wheelSpinning: false, wheelPick: pick });
    }, 2600);
  },

  // 锁定当前转盘结果，进入下一类型
  lockPick() {
    const { wheelPick, wheelLocked, excludedIds } = this.data;
    this.setData({
      wheelLocked: wheelLocked.concat(wheelPick),
      excludedIds: excludedIds.concat(wheelPick._id),
      wheelPick: null,
    });
    this.nextType();
  },

  async finishWheel() {
    const { composition, avoid, people } = this.data;
    const picks = this.data.wheelLocked;
    this.setData({ mode: 'wheel', picks });
    if (!picks.length) {
      wx.showToast({ title: '一道都没转出来，先去加菜', icon: 'none' });
      return;
    }
    this.confirm();
  },

  // ===== 确认 =====
  confirm() {
    const { picks, people, composition, avoid, mode } = this.data;
    if (!picks.length) {
      wx.showToast({ title: '还没有菜单可确认', icon: 'none' });
      return;
    }
    wx.setStorageSync('pending_menu', { picks, requirements: { people, composition, avoid }, mode });
    wx.navigateTo({ url: '/pages/menu/detail?confirm=1' });
  },
});
