// 菜品与菜单相关全局枚举（CommonJS，供小程序与 Jest 共用）
const SOURCE = { HOME: 'home', DINEOUT: 'dineout', TAKEOUT: 'takeout' };
const SOURCE_LABELS = { home: '自做', dineout: '外吃', takeout: '外卖' };

const TYPE = { MEAT: 'meat', VEG: 'veg', STAPLE: 'staple', SOUP: 'soup', DRINK: 'drink' };
const TYPE_LABELS = { meat: '荤菜', veg: '素菜', staple: '主食', soup: '汤', drink: '饮品' };
// 大转盘逐类选菜的顺序
const TYPE_ORDER = ['meat', 'veg', 'staple', 'soup', 'drink'];

const DEFAULT_TAGS = ['清淡健康', '低脂轻食', '香辣馋嘴'];

// AI 识别每用户每日限流次数
const AI_DAILY_LIMIT = 20;

module.exports = {
  SOURCE,
  SOURCE_LABELS,
  TYPE,
  TYPE_LABELS,
  TYPE_ORDER,
  DEFAULT_TAGS,
  AI_DAILY_LIMIT,
};
