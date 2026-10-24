// 云函数：recognizeDish —— 菜品图片 AI 识别
// 链路：限流(users.ai_usage) → downloadFile 取图 → base64 Data URL →
//       node-sdk 多模态 generateText → parseAiJson 清洗 → 返回
// 消息格式依据官方多模态配方（docs.cloudbase.net/recipes/add-multimodal-image-cloudbase-deepseek-v4）：
// content 为数组，image_url 在前、text 在后；图片走 base64 Data URL 内联（不走公网 URL）。
const cloud = require('wx-server-sdk');
const tcb = require('@cloudbase/node-sdk');
const { checkQuota } = require('./quota');
const { parseAiJson } = require('./parse');

const ENV_ID = 'absent-jellyfish-d7ejuaa974b8533';
// 预检后确定：cloudbase 组的混元视觉模型（目录确认多模态理解，激励计划代金券覆盖混元 token）
const AI_PROVIDER = 'cloudbase';
const AI_MODEL = 'hunyuan-t1-vision-20250916';
const AI_DAILY_LIMIT = 20;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // base64 建议单张 ≤5MB

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const app = tcb.init({ env: ENV_ID });
const db = cloud.database();

// 本地时区日期键（与 miniprogram/utils/date.js 同步；云函数侧独立拷贝）
function formatDateKey(date) {
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// 魔数识别图片 MIME（Data URL 前缀）
function imageMime(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf.length > 4 && buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  if (buf.length > 3 && buf[0] === 0x47 && buf[1] === 0x49) return 'image/gif';
  if (buf.length > 8 && buf[8] === 0x57 && buf[9] === 0x45) return 'image/webp';
  return 'image/jpeg';
}

const SYSTEM_PROMPT = [
  '你是菜品识别助手。用户上传一张食物照片，识别后只返回一个 JSON 对象，',
  '不要任何解释文字、不要 markdown 代码围栏。字段：',
  'name(菜名,string)；type(meat/veg/staple/soup/drink 之一)；',
  'source(home/dineout/takeout 之一，按摆盘猜测)；',
  'tags(健康标签数组，可用值 清淡健康/低脂轻食/香辣馋嘴)；',
  'ingredients(数组，每项 {name:string, amount:string}，amount 如 "200克"，无法估量为空串)；',
  'calories(一份的估计千卡,number)；spicy_level(0-3 的整数)。',
  '看不清或无法判断的字段直接省略。',
].join('');

async function main(event) {
  const { fileID } = event || {};
  const { OPENID } = cloud.getWXContext();

  if (!OPENID) {
    return { code: 401, message: '无法获取用户身份' };
  }
  if (!fileID || typeof fileID !== 'string') {
    return { code: 400, message: '缺少 fileID 参数' };
  }

  // ① 限流：读 users.ai_usage → checkQuota → 放行即写入新计数
  const userRes = await db.collection('users').where({ _openid: OPENID }).limit(1).get();
  const user = userRes.data[0];
  const today = formatDateKey(new Date());
  const { allowed, nextUsage } = checkQuota(user && user.ai_usage, today, AI_DAILY_LIMIT);
  if (!allowed) {
    return { code: 429, message: `今日识别次数已用完（${AI_DAILY_LIMIT}次/天），明天再来吧` };
  }

  // ② 取图 → base64 Data URL
  let fileRes;
  try {
    fileRes = await cloud.downloadFile({ fileID });
  } catch (e) {
    return { code: 500, message: `图片下载失败：${e.message || e}` };
  }
  const buf = fileRes.fileContent;
  if (!buf || !buf.length) {
    return { code: 500, message: '图片内容为空' };
  }
  if (buf.length > MAX_IMAGE_BYTES) {
    return { code: 400, message: '图片过大，请压缩后重试' };
  }
  const dataUrl = `data:${imageMime(buf)};base64,${buf.toString('base64')}`;

  // ③ 多模态识别（content 数组：image 在前 text 在后，官方推荐顺序）
  let text;
  try {
    const model = app.ai().createModel(AI_PROVIDER);
    const result = await model.generateText({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUrl } },
            { type: 'text', text: '识别这道菜' },
          ],
        },
      ],
    });
    text = result.text;
  } catch (e) {
    return { code: 500, message: `AI 调用失败：${e.message || e}` };
  }

  // ④ 解析清洗（失败/字段缺失交给客户端手填兜底）
  const parsed = parseAiJson(text);

  // ⑤ 计数落库（识别调用发生后再计数）
  try {
    if (user) {
      await db.collection('users').doc(user._id).update({ data: { ai_usage: nextUsage } });
    } else {
      await db.collection('users').add({ data: { _openid: OPENID, ai_usage: nextUsage } });
    }
  } catch (e) {
    console.error('ai_usage 更新失败', e && e.message);
  }

  if (!parsed.ok) {
    return { code: 0, data: {}, message: '识别返回无法解析，请手动填写' };
  }
  return { code: 0, data: parsed.data };
}

exports.main = main;
