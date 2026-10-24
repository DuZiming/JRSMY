Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/menu/menu', text: '今日菜单' },
      { pagePath: '/pages/dishes/dishes', text: '菜品库' },
      { pagePath: '/pages/profile/profile', text: '我的' },
    ],
  },
  methods: {
    switchTab(e) {
      const { path, index } = e.currentTarget.dataset;
      wx.switchTab({ url: path });
      this.setData({ selected: index });
    },
  },
});
