// AI 返回解析与字段清洗（云函数版）
// ⚠️ 本文件与 miniprogram/utils/aiParse.js 是同一逻辑的拷贝：
// 云函数独立打包，无法 require miniprogramRoot 下的文件。
// 两处必须同步修改。
// 枚举值拷贝自 miniprogram/utils/constants.js，同样需同步。
const TYPE_VALUES = ['meat', 'veg', 'staple', 'soup', 'drink'];
const SOURCE_VALUES = ['home', 'dineout', 'takeout'];

function stripFences(raw) {
  const m = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return m ? m[1] : raw;
}

function tryParse(raw) {
  const attempts = [raw, stripFences(raw)];
  const fence = stripFences(raw);
  const brace = fence.match(/\{[\s\S]*\}/);
  if (brace) attempts.push(brace[0]);

  for (const text of attempts) {
    try {
      return JSON.parse(text);
    } catch (e) {
      // 继续下一个尝试
    }
  }
  return null;
}

function clean(obj) {
  const data = {};

  if (typeof obj.name === 'string' && obj.name.trim()) {
    data.name = obj.name.trim();
  }
  if (TYPE_VALUES.includes(obj.type)) {
    data.type = obj.type;
  }
  if (SOURCE_VALUES.includes(obj.source)) {
    data.source = obj.source;
  }
  if (
    Array.isArray(obj.tags) &&
    obj.tags.length > 0 &&
    obj.tags.every((t) => typeof t === 'string' && t.trim())
  ) {
    data.tags = obj.tags.map((t) => t.trim());
  }
  if (Array.isArray(obj.ingredients)) {
    const ings = obj.ingredients.filter(
      (ing) => ing && typeof ing === 'object' && typeof ing.name === 'string' && ing.name.trim()
    );
    if (ings.length > 0) {
      data.ingredients = ings.map((ing) => ({
        name: ing.name.trim(),
        amount: typeof ing.amount === 'string' ? ing.amount : '',
      }));
    }
  }
  if (typeof obj.calories === 'number' && Number.isFinite(obj.calories)) {
    data.calories = obj.calories;
  }
  if (Number.isInteger(obj.spicy_level) && obj.spicy_level >= 0 && obj.spicy_level <= 3) {
    data.spicy_level = obj.spicy_level;
  }

  return data;
}

function parseAiJson(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { ok: false, data: {}, error: 'AI 返回为空' };
  }
  const parsed = tryParse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, data: {}, error: 'AI 返回不是 JSON 对象' };
  }
  return { ok: true, data: clean(parsed) };
}

module.exports = { parseAiJson };
