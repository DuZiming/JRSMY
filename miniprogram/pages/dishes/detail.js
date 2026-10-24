const { getDish, removeDish } = require('../../services/dishes');
const { TYPE_LABELS, SOURCE_LABELS } = require('../../utils/constants');

const SPICY_LABELS = ['不辣', '微辣', '中辣', '重辣'];

Page({
  data: {
    dish: null,
    photoUrls: [],
    typeLabel: '',
    sourceLabel: '',
    spicyLabel: '',
  },

  onLoad(options) {
    this.dishId = options.id;
  },

  onShow() {
    this.load();
  },

  async load() {
    try {
      const dish = await getDish(this.dishId);
      // fileID → 临时链接供展示
      const res = await wx.cloud.getTempFileURL({ fileList: dish.photos });
      this.setData({
        dish,
        photoUrls: res.fileList.map((f) => f.tempFileURL),
        typeLabel: TYPE_LABELS[dish.type] || '',
        sourceLabel: SOURCE_LABELS[dish.source] || '',
        spicyLabel: SPICY_LABELS[dish.spicy_level || 0],
      });
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  edit() {
    wx.navigateTo({ url: `/pages/dishes/edit?id=${this.dishId}` });
  },

  remove() {
    wx.showModal({
      title: '删除菜品',
      content: `确定删除「${this.data.dish.name}」吗？历史菜单里的记录会保留。`,
      confirmColor: '#c0392b',
      success: async (res) => {
        if (res.confirm) {
          await removeDish(this.dishId);
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 600);
        }
      },
    });
  },
});
