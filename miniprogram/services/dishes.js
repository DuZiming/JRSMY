// 菜品数据访问层：封装 wx.cloud 数据库与云存储操作


function db() {
  return wx.cloud.database();
}

// 上传前压缩：最大边压到 1280 + quality 70（手机原图 4000px 级别直接送模型又慢又贵，
// 视觉模型本身也会降采样，1280 足够识别菜品；失败容忍用原图）
const MAX_EDGE = 1280;

function getInfo(src) {
  return new Promise((resolve) => wx.getImageInfo({ src, success: resolve, fail: () => resolve(null) }));
}

function compressTemp(filePath) {
  return getInfo(filePath).then((info) => {
    const opts = { src: filePath, quality: 70 };
    if (info && Math.max(info.width, info.height) > MAX_EDGE) {
      // compressedWidth 按宽度等比缩放：以长边换算到宽度
      const isWide = info.width >= info.height;
      const scale = MAX_EDGE / (isWide ? info.width : info.height);
      opts.compressedWidth = Math.round(info.width * scale);
    }
    return new Promise((resolve) => {
      wx.compressImage({ ...opts, success: (r) => resolve(r.tempFilePath), fail: () => resolve(filePath) });
    });
  });
}

// 单张上传，失败自动重试 1 次；仍失败 reject
function uploadOne(cloudPath, filePath) {
  return wx.cloud
    .uploadFile({ cloudPath, filePath })
    .catch(() => wx.cloud.uploadFile({ cloudPath, filePath }));
}

// 批量上传菜品图（先压缩），返回 fileID 数组；任一张最终失败则整体 reject
async function uploadDishPhotos(tempFilePaths) {
  const stamp = Date.now();
  const results = [];
  for (let i = 0; i < tempFilePaths.length; i += 1) {
    const src = await compressTemp(tempFilePaths[i]);
    const ext = (src.match(/\.(jpe?g|png|webp|gif)$/i) || [, 'jpg'])[1];
    const res = await uploadOne(`dishes/${stamp}-${i}.${ext}`, src);
    results.push(res.fileID);
  }
  return results;
}

async function listDishes(filter = {}) {
  const cmd = db().command;
  // 多条件合并进同一个 where（小程序 db 链式二次 where 会互相覆盖）
  const where = {};
  if (filter.source) where.source = filter.source;
  if (filter.type) where.type = filter.type;
  if (filter.tag) where.tags = cmd.in([filter.tag]);
  let query = db().collection('dishes');
  if (Object.keys(where).length) query = query.where(where);
  const res = await query.orderBy('created_at', 'desc').limit(100).get();
  return res.data;
}

async function getDish(id) {
  const res = await db().collection('dishes').doc(id).get();
  return res.data;
}

async function addDish(dish) {
  const now = db().serverDate();
  const res = await db()
    .collection('dishes')
    .add({ data: { ...dish, created_at: now, updated_at: now } });
  return res._id;
}

async function updateDish(id, patch) {
  await db()
    .collection('dishes')
    .doc(id)
    .update({ data: { ...patch, updated_at: db().serverDate() } });
}

async function removeDish(id) {
  await db().collection('dishes').doc(id).remove();
}

module.exports = {
  uploadDishPhotos,
  listDishes,
  getDish,
  addDish,
  updateDish,
  removeDish,
};
