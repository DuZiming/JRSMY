// 菜品数据访问层：封装 wx.cloud 数据库与云存储操作
const { TYPE_LABELS, SOURCE_LABELS, TYPE_ORDER, SOURCE } = require('../utils/constants');

function db() {
  return wx.cloud.database();
}

// 上传前压缩（quality 70，失败容忍用原图）——同时提速上传与 AI 识别
function compressTemp(filePath) {
  return new Promise((resolve) => {
    wx.compressImage({
      src: filePath,
      quality: 70,
      success: (r) => resolve(r.tempFilePath),
      fail: () => resolve(filePath),
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
  let query = db().collection('dishes').orderBy('created_at', 'desc');
  if (filter.source) query = query.where({ source: filter.source });
  if (filter.type) query = query.where({ type: filter.type });
  if (filter.tag) query = query.where({ tags: db().command.in([filter.tag]) });
  const res = await query.limit(100).get();
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
  TYPE_LABELS,
  SOURCE_LABELS,
  TYPE_ORDER,
  SOURCE,
};
