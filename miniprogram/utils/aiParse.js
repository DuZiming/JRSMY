// AI 返回解析与字段清洗（纯函数）
// 注意：cloudfunctions/recognizeDish/parse.js 内有同逻辑拷贝（云函数独立打包），
// 两处同步修改时必须互相同步。
const { TYPE, SOURCE } = require('./constants');

const TYPE_VALUES = Object.values(TYPE);
const SOURCE_VALUES = Object.values(SOURCE);

// 剥 markdown 代码围栏（```json ... ```）
function stripFences(raw) {
  const m = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return m ? m[1] : raw;
}

// 依次尝试：直接 parse → 剥围栏 parse → 正则提取首个 {...} parse
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

// 字段级清洗：非法枚举/类型不符的字段丢弃（不报错），让用户手填兜底
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

// raw → { ok, data, error? }；ok:false 仅当完全解析不出 JSON
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
