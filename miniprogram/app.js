const { ENV_ID } = require('./config');

App({
  onLaunch() {
    if (ENV_ID) {
      wx.cloud.init({ env: ENV_ID, traceUser: true });
      // 静默初始化用户文档（失败容忍，页面侧还会兜底）
      const { ensureUser } = require('./services/users');
      ensureUser();
    } else {
      console.warn('[今日食咩野] config.js 未配置 ENV_ID，云能力未初始化');
    }
  },
});
