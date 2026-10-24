// 用户数据访问层
const DEFAULT_SETTINGS = {
  people: 2,
  composition: { meat: 1, veg: 1, staple: 1, soup: 0, drink: 0 },
  avoid: [],
};

function db() {
  return wx.cloud.database();
}

// 取当前用户文档；没有则创建默认文档（静默失败容忍：云未就绪时返回默认值）
async function ensureUser() {
  try {
    const res = await db().collection('users').limit(1).get();
    if (res.data.length) return res.data[0];
    const addRes = await db()
      .collection('users')
      .add({
        data: {
          nickname: '',
          avatar: '',
          settings: DEFAULT_SETTINGS,
          ai_usage: null,
          cabbage: 0,
          created_at: db().serverDate(),
        },
      });
    return { _id: addRes._id, nickname: '', avatar: '', settings: DEFAULT_SETTINGS, ai_usage: null, cabbage: 0 };
  } catch (e) {
    console.warn('ensureUser 失败，使用默认设置', e && e.message);
    return { _id: '', nickname: '', avatar: '', settings: DEFAULT_SETTINGS, ai_usage: null, cabbage: 0 };
  }
}

async function saveSettings(settings) {
  const user = await ensureUser();
  if (!user._id) throw new Error('用户未就绪');
  await db().collection('users').doc(user._id).update({ data: { settings } });
}

async function saveProfile({ nickname, avatar }) {
  const user = await ensureUser();
  if (!user._id) throw new Error('用户未就绪');
  const patch = {};
  if (nickname != null) patch.nickname = nickname;
  if (avatar != null) patch.avatar = avatar;
  await db().collection('users').doc(user._id).update({ data: patch });
}

module.exports = { ensureUser, saveSettings, saveProfile, DEFAULT_SETTINGS };
