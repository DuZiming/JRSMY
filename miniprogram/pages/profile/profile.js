const { ensureUser, saveSettings, saveProfile } = require('../../services/users');
const { TYPE_LABELS, TYPE_ORDER, DEFAULT_TAGS } = require('../../utils/constants');

Page({
  data: {
    user: null,
    nickname: '',
    avatar: '',
    people: 2,
    composition: { meat: 1, veg: 1, staple: 1, soup: 0, drink: 0 },
    compLabels: [],
    avoid: [],
    defaultTags: DEFAULT_TAGS,
    saving: false,
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    this.load();
  },

  async load() {
    const user = await ensureUser();
    const s = user.settings || {};
    this.setData({
      user,
      nickname: user.nickname || '',
      avatar: user.avatar || '',
      people: s.people || 2,
      composition: s.composition || { meat: 1, veg: 1, staple: 1, soup: 0, drink: 0 },
      avoid: s.avoid || [],
    });
    this.syncLabels();
  },

  syncLabels() {
    this.setData({
      compLabels: TYPE_ORDER.map((t) => ({
        key: t,
        label: TYPE_LABELS[t],
        count: this.data.composition[t] || 0,
      })),
    });
  },

  onChooseAvatar(e) {
    this.setData({ avatar: e.detail.avatarUrl });
  },
  onNickname(e) {
    this.setData({ nickname: e.detail.value });
  },

  incPeople() {
    this.setData({ people: Math.min(20, this.data.people + 1) });
  },
  decPeople() {
    this.setData({ people: Math.max(1, this.data.people - 1) });
  },

  incType(e) {
    const { key } = e.currentTarget.dataset;
    const composition = { ...this.data.composition, [key]: Math.min(6, (this.data.composition[key] || 0) + 1) };
    this.setData({ composition });
    this.syncLabels();
  },
  decType(e) {
    const { key } = e.currentTarget.dataset;
    const composition = { ...this.data.composition, [key]: Math.max(0, (this.data.composition[key] || 0) - 1) };
    this.setData({ composition });
    this.syncLabels();
  },

  toggleAvoid(e) {
    const { tag } = e.currentTarget.dataset;
    const avoid = this.data.avoid.slice();
    const i = avoid.indexOf(tag);
    if (i >= 0) avoid.splice(i, 1);
    else avoid.push(tag);
    this.setData({ avoid });
  },

  async saveAll() {
    this.setData({ saving: true });
    try {
      await saveProfile({ nickname: this.data.nickname, avatar: this.data.avatar });
      await saveSettings({
        people: this.data.people,
        composition: this.data.composition,
        avoid: this.data.avoid,
      });
      wx.showToast({ title: '已保存', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: e.message || '保存失败', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },
});
