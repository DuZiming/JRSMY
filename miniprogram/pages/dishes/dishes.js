const { listDishes, removeDish } = require('../../services/dishes');
const {
  TYPE,
  TYPE_LABELS,
  TYPE_ORDER,
  SOURCE,
  SOURCE_LABELS,
  DEFAULT_TAGS,
} = require('../../utils/constants');

const SOURCE_FILTERS = [{ key: '', label: '全部' }].concat(
  Object.values(SOURCE).map((s) => ({ key: s, label: SOURCE_LABELS[s] }))
);
const TYPE_FILTERS = [{ key: '', label: '全部' }].concat(
  TYPE_ORDER.map((t) => ({ key: t, label: TYPE_LABELS[t] }))
);

Page({
  data: {
    dishes: [],
    typeLabels: TYPE_LABELS,
    sourceLabels: SOURCE_LABELS,
    sourceFilters: SOURCE_FILTERS,
    typeFilters: TYPE_FILTERS,
    tagFilters: [{ key: '', label: '全部' }].concat(DEFAULT_TAGS.map((t) => ({ key: t, label: t }))),
    filterSource: '',
    filterType: '',
    filterTag: '',
    viewMode: 'card', // card | list
    loading: true,
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
      const dishes = await listDishes({
        source: this.data.filterSource,
        type: this.data.filterType,
        tag: this.data.filterTag,
      });
      // 自定义标签并入筛选项
      const custom = [];
      dishes.forEach((d) => (d.tags || []).forEach((t) => {
        if (!DEFAULT_TAGS.includes(t) && !custom.includes(t)) custom.push(t);
      }));
      const tagFilters = [{ key: '', label: '全部' }]
        .concat(DEFAULT_TAGS.map((t) => ({ key: t, label: t })))
        .concat(custom.map((t) => ({ key: t, label: t })));
      this.setData({ dishes, tagFilters });
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  setSource(e) {
    this.setData({ filterSource: e.currentTarget.dataset.key }, () => this.load());
  },
  setType(e) {
    this.setData({ filterType: e.currentTarget.dataset.key }, () => this.load());
  },
  setTag(e) {
    this.setData({ filterTag: e.currentTarget.dataset.key }, () => this.load());
  },

  switchView() {
    const viewMode = this.data.viewMode === 'card' ? 'list' : 'card';
    wx.setStorageSync('dishes_view_mode', viewMode);
    this.setData({ viewMode });
  },

  addDish() {
    wx.navigateTo({ url: '/pages/dishes/edit' });
  },
  openDetail(e) {
    wx.navigateTo({ url: `/pages/dishes/detail?id=${e.currentTarget.dataset.id}` });
  },
});
