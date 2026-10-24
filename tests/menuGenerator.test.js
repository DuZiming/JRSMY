const {
  generateMenu,
  pickForWheel,
  filterPool,
} = require('../miniprogram/utils/menuGenerator');

const zeroRng = () => 0;

const dish = (id, type, extra = {}) => ({
  _id: id,
  name: id,
  type,
  tags: [],
  spicy_level: 0,
  ingredients: [],
  ...extra,
});

describe('generateMenu 随机整单', () => {
  test('按 composition 各类取够数量', () => {
    const dishes = [
      dish('m1', 'meat'), dish('m2', 'meat'),
      dish('v1', 'veg'), dish('v2', 'veg'), dish('v3', 'veg'),
      dish('s1', 'staple'), dish('s2', 'staple'),
    ];
    const { picks, skippedTypes } = generateMenu(
      dishes,
      { composition: { meat: 1, veg: 1, staple: 1, soup: 0, drink: 0 }, rng: zeroRng }
    );
    expect(picks).toHaveLength(3);
    expect(picks.map((d) => d.type).sort()).toEqual(['meat', 'staple', 'veg']);
    expect(skippedTypes).toEqual([]);
  });

  test('某类型池空时该类型进 skippedTypes，其余正常返回', () => {
    const dishes = [dish('v1', 'veg'), dish('v2', 'veg')];
    const { picks, skippedTypes } = generateMenu(
      dishes,
      { composition: { meat: 1, veg: 1 }, rng: zeroRng }
    );
    expect(picks).toHaveLength(1);
    expect(picks[0].type).toBe('veg');
    expect(skippedTypes).toEqual(['meat']);
  });

  test('池数量不足需求时取全部可用，不算 skipped', () => {
    const dishes = [dish('v1', 'veg'), dish('v2', 'veg')];
    const { picks, skippedTypes } = generateMenu(
      dishes,
      { composition: { veg: 3 }, rng: zeroRng }
    );
    expect(picks).toHaveLength(2);
    expect(skippedTypes).toEqual([]);
  });

  test('recentDishIds 优先排除', () => {
    const dishes = [dish('m1', 'meat'), dish('m2', 'meat')];
    const { picks } = generateMenu(
      dishes,
      { composition: { meat: 1 }, recentDishIds: ['m1'], rng: zeroRng }
    );
    expect(picks.map((d) => d._id)).toEqual(['m2']);
  });

  test('排除后池空时放宽回全池仍能取到', () => {
    const dishes = [dish('m1', 'meat')];
    const { picks, skippedTypes } = generateMenu(
      dishes,
      { composition: { meat: 1 }, recentDishIds: ['m1'], rng: zeroRng }
    );
    expect(picks.map((d) => d._id)).toEqual(['m1']);
    expect(skippedTypes).toEqual([]);
  });

  test('avoid 含"辣"时排除 spicy_level > 0 的菜', () => {
    const dishes = [
      dish('m1', 'meat', { spicy_level: 2 }),
      dish('m2', 'meat', { spicy_level: 0 }),
    ];
    const { picks } = generateMenu(
      dishes,
      { composition: { meat: 1 }, avoid: ['辣'], rng: zeroRng }
    );
    expect(picks.map((d) => d._id)).toEqual(['m2']);
  });

  test('avoid 含标签名时排除含该标签的菜', () => {
    const dishes = [
      dish('v1', 'veg', { tags: ['清淡健康'] }),
      dish('v2', 'veg', { tags: ['香辣馋嘴'] }),
    ];
    const { picks } = generateMenu(
      dishes,
      { composition: { veg: 1 }, avoid: ['清淡健康'], rng: zeroRng }
    );
    expect(picks.map((d) => d._id)).toEqual(['v2']);
  });

  test('同一菜单内不重复取同一道菜', () => {
    const dishes = [dish('m1', 'meat'), dish('m2', 'meat')];
    const { picks } = generateMenu(
      dishes,
      { composition: { meat: 2 }, rng: zeroRng }
    );
    expect(picks.map((d) => d._id).sort()).toEqual(['m1', 'm2']);
  });
});

describe('pickForWheel 大转盘单类抽取', () => {
  test('返回指定类型的一道菜', () => {
    const dishes = [dish('m1', 'meat'), dish('v1', 'veg')];
    const pick = pickForWheel(dishes, 'meat', { rng: zeroRng });
    expect(pick._id).toBe('m1');
  });

  test('池空返回 null', () => {
    const dishes = [dish('v1', 'veg')];
    expect(pickForWheel(dishes, 'meat', { rng: zeroRng })).toBeNull();
  });

  test('excludeIds 生效', () => {
    const dishes = [dish('m1', 'meat'), dish('m2', 'meat'), dish('m3', 'meat')];
    const pick = pickForWheel(dishes, 'meat', { excludeIds: ['m1', 'm2'], rng: zeroRng });
    expect(pick._id).toBe('m3');
  });

  test('avoid 排除后池空返回 null（不放宽，放宽语义只属于整单模式）', () => {
    const dishes = [dish('m1', 'meat', { spicy_level: 3 })];
    expect(pickForWheel(dishes, 'meat', { avoid: ['辣'], rng: zeroRng })).toBeNull();
  });
});

describe('filterPool', () => {
  test('按类型过滤并剔除 excludeIds', () => {
    const dishes = [
      dish('m1', 'meat'), dish('m2', 'meat'), dish('v1', 'veg'),
    ];
    const pool = filterPool(dishes, { type: 'meat', excludeIds: ['m1'] });
    expect(pool.map((d) => d._id)).toEqual(['m2']);
  });
});
