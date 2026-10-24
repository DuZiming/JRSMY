const { listDishes } = require('../../services/dishes');
const { addMenu } = require('../../services/menus');
const { buildMenuDoc } = require('../../utils/shoppingList');
const {
  TYPE_LABELS,
  TYPE_ORDER,
  SOURCE,
  SOURCE_LABELS,
  DEFAULT_TAGS,
} = require('../../utils/constants');

const SOURCE_OPTS = [{ key: '', label: '全部' }].concat(
  Object.values(SOURCE).map((s) => ({ key: s, label: SOURCE_LABELS[s] }))
);
const TYPE_OPTS = [{ key: '', label: '全部' }].concat(
  TYPE_ORDER.map((t) => ({ key: t, label: TYPE_LABELS[t] }))
);

Page({
  data: {
    // 列表
    allDishes: [],
    dishes: [],
    keyword: '',
    viewMode: 'card',
    typeLabels: TYPE_LABELS,
    sourceLabels: SOURCE_LABELS,
    loading: true,

    // 厨房（二期多厨房，当前仅默认）
    kitchenName: '我的厨房',

    // 筛选抽屉
    drawerOpen: false,
    drawerGroups: [],
    drawerPending: { source: '', type: '', tag: '' },
    drawerAnchor: '',
    // 已生效筛选
    filterSource: '',
    filterType: '',
    filterTag: '',

    // 已选菜单（手选）
    basketItems: [], // {…dish 快照, qty}
    basketCount: 0,
    basketPop: false,
    basketOpen: false,
    submitting: false,
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    this.setData({ viewMode: wx.getStorageSync('dishes_view_mode') || 'card' });
    this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const allDishes = await listDishes({});
      this.setData({ allDishes }, () => {
        this.buildDrawerGroups();
        this.applyFilters();
      });
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 下滑隐藏工具行、上滑出现
  onPageScroll(e) {
    const y = e.scrollTop;
    const dy = y - (this._lastY || 0);
    if (dy > 6 && y > 80 && !this.data.toolHidden) {
      this.setData({ toolHidden: true });
    } else if (dy < -6 && this.data.toolHidden) {
      this.setData({ toolHidden: false });
    }
    this._lastY = y;
  },

  // ===== 搜索 + 筛选（客户端叠加） =====
  onKeyword(e) {
    this.setData({ keyword: e.detail.value }, () => this.applyFilters());
  },
  clearKeyword() {
    this.setData({ keyword: '' }, () => this.applyFilters());
  },

  applyFilters() {
    const { allDishes, keyword, filterSource, filterType, filterTag } = this.data;
    const kw = (keyword || '').trim();
    const dishes = allDishes.filter((d) => {
      if (kw && !(d.name || '').includes(kw)) return false;
      if (filterSource && d.source !== filterSource) return false;
      if (filterType && d.type !== filterType) return false;
      if (filterTag && !(d.tags || []).includes(filterTag)) return false;
      return true;
    });
    this.setData({ dishes });
  },

  switchView() {
    const viewMode = this.data.viewMode === 'card' ? 'list' : 'card';
    wx.setStorageSync('dishes_view_mode', viewMode);
    this.setData({ viewMode });
  },

  // ===== 厨房选择（二期多厨房；当前仅默认厨房） =====
  pickKitchen() {
    wx.showActionSheet({
      itemList: ['我的厨房'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.setData({ kitchenName: '我的厨房' });
        }
      },
    });
  },

  // ===== 筛选抽屉 =====
  buildDrawerGroups() {
    const custom = [];
    this.data.allDishes.forEach((d) => (d.tags || []).forEach((t) => {
      if (!DEFAULT_TAGS.includes(t) && !custom.includes(t)) custom.push(t);
    }));
    const tagOpts = [{ key: '', label: '全部' }]
      .concat(DEFAULT_TAGS.map((t) => ({ key: t, label: t })))
      .concat(custom.map((t) => ({ key: t, label: t })));
    this.setData({
      drawerGroups: [
        { key: 'source', label: '来源', anchor: 'anchor-source', options: SOURCE_OPTS },
        { key: 'type', label: '类型', anchor: 'anchor-type', options: TYPE_OPTS },
        { key: 'tag', label: '标签', anchor: 'anchor-tag', options: tagOpts },
      ],
    });
  },

  openDrawer() {
    wx.hideTabBar({ animation: false, fail: () => {} });
    this.setData({
      drawerOpen: true,
      drawerPending: {
        source: this.data.filterSource,
        type: this.data.filterType,
        tag: this.data.filterTag,
      },
    });
  },
  closeDrawer() {
    wx.showTabBar({ animation: false, fail: () => {} });
    this.setData({ drawerOpen: false }); // 遮罩/关闭 = 取消，不生效
  },
  drawerPick(e) {
    const { group, key } = e.currentTarget.dataset;
    this.setData({ [`drawerPending.${group}`]: key });
  },
  drawerClear() {
    this.setData({ drawerPending: { source: '', type: '', tag: '' } });
  },
  drawerConfirm() {
    wx.showTabBar({ animation: false, fail: () => {} });
    const p = this.data.drawerPending;
    this.setData({
      filterSource: p.source,
      filterType: p.type,
      filterTag: p.tag,
      drawerOpen: false,
    }, () => this.applyFilters());
  },
  drawerJump(e) {
    const { anchor } = e.currentTarget.dataset;
    this.setData({ drawerAnchor: '' }, () => this.setData({ drawerAnchor: anchor }));
  },

  // ===== 手选菜单（点外卖式） =====
  onAdd(e) {
    const { id } = e.currentTarget.dataset;
    const dish = this.data.allDishes.find((d) => d._id === id);
    if (!dish) return;
    const items = this.data.basketItems.slice();
    const exist = items.find((it) => it._id === id);
    if (exist) {
      exist.qty += 1;
    } else {
      items.push({
        _id: dish._id,
        name: dish.name,
        photo: (dish.photos || [])[0] || '',
        type: dish.type,
        calories: dish.calories || null,
        ingredients: dish.ingredients || [],
        qty: 1,
      });
    }
    this.setData({ basketItems: items, basketCount: this.countBasket(items), basketPop: true });
    setTimeout(() => this.setData({ basketPop: false }), 400);
  },

  countBasket(items) {
    return items.reduce((n, it) => n + it.qty, 0);
  },

  openBasket() {
    if (!this.data.basketCount) return;
    wx.hideTabBar({ animation: false, fail: () => {} });
    this.setData({ basketOpen: true });
  },
  closeBasket() {
    wx.showTabBar({ animation: false, fail: () => {} });
    this.setData({ basketOpen: false });
  },

  incQty(e) {
    const { index } = e.currentTarget.dataset;
    const items = this.data.basketItems.slice();
    items[index].qty = Math.min(99, items[index].qty + 1);
    this.setData({ basketItems: items, basketCount: this.countBasket(items) });
  },
  decQty(e) {
    const { index } = e.currentTarget.dataset;
    const items = this.data.basketItems.slice();
    items[index].qty -= 1;
    const left = items[index].qty <= 0 ? items.filter((_, i) => i !== index) : items;
    this.setData({ basketItems: left, basketCount: this.countBasket(left) });
    if (!left.length) {
      wx.showTabBar({ animation: false, fail: () => {} });
      this.setData({ basketOpen: false });
    }
  },
  onQtyInput(e) {
    const { index } = e.currentTarget.dataset;
    const raw = parseInt(e.detail.value, 10);
    const val = Number.isFinite(raw) ? Math.min(99, Math.max(1, raw)) : 1;
    const items = this.data.basketItems.slice();
    items[index].qty = val;
    this.setData({ [`basketItems[${index}].qty`]: val, basketCount: this.countBasket(items) });
  },

  // 确定：构建手选菜单（mode: manual，份数参与清单与热量）→ 落库 → 看结果
  async confirmBasket() {
    if (!this.data.basketCount || this.data.submitting) return;
    this.setData({ submitting: true });
    try {
      const picks = this.data.basketItems.map((it) => ({ ...it, _qty: it.qty }));
      const doc = buildMenuDoc({ picks, requirements: {}, mode: 'manual' });
      const id = await addMenu(doc);
      wx.showTabBar({ animation: false, fail: () => {} });
      this.setData({ basketItems: [], basketCount: 0, basketOpen: false });
      wx.showToast({ title: '已加入今日菜单', icon: 'success' });
      setTimeout(() => wx.navigateTo({ url: `/pages/menu/detail?id=${id}` }), 500);
    } catch (e) {
      wx.showToast({ title: e.message || '保存失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  addDish() {
    wx.navigateTo({ url: '/pages/dishes/edit' });
  },
  openDetail(e) {
    wx.navigateTo({ url: `/pages/dishes/detail?id=${e.currentTarget.dataset.id}` });
  },
});
