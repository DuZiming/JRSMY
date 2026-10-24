const {
  aggregateShoppingList,
  sumCalories,
  buildMenuDoc,
} = require('../miniprogram/utils/shoppingList');

describe('aggregateShoppingList 买菜清单聚合', () => {
  test('同名材料合并（可数值化时相加保留单位）', () => {
    const dishes = [
      { ingredients: [{ name: '盐', amount: '5克' }] },
      { ingredients: [{ name: '盐', amount: '3克' }] },
    ];
    const list = aggregateShoppingList(dishes);
    expect(list).toEqual([{ name: '盐', amount: '8克', bought: false }]);
  });

  test('不可数值化的 amount 用 / 连接', () => {
    const dishes = [
      { ingredients: [{ name: '蒜', amount: '2瓣' }] },
      { ingredients: [{ name: '蒜', amount: '适量' }] },
    ];
    const list = aggregateShoppingList(dishes);
    expect(list[0].amount).toBe('2瓣/适量');
  });

  test('无材料的菜被跳过，材料缺 name 的项被过滤', () => {
    const dishes = [
      { name: '白切鸡', ingredients: [] },
      { name: '无字段菜' },
      { ingredients: [{ amount: '若干' }, { name: '姜', amount: '1块' }] },
    ];
    const list = aggregateShoppingList(dishes);
    expect(list).toEqual([{ name: '姜', amount: '1块', bought: false }]);
  });

  test('按首次出现排序且 bought 初始为 false', () => {
    const dishes = [
      { ingredients: [{ name: '盐', amount: '' }, { name: '糖', amount: '1勺' }] },
      { ingredients: [{ name: '盐', amount: '' }] },
    ];
    const list = aggregateShoppingList(dishes);
    expect(list.map((i) => i.name)).toEqual(['盐', '糖']);
    expect(list.every((i) => i.bought === false)).toBe(true);
  });
});

describe('sumCalories', () => {
  test('混合 null/undefined/数字，缺失按 0', () => {
    const items = [{ calories: 100 }, { calories: null }, { calories: 50 }, {}];
    expect(sumCalories(items)).toBe(150);
  });
});

describe('buildMenuDoc', () => {
  const makePicks = () => [
    {
      _id: 'm1',
      name: '红烧肉',
      type: 'meat',
      calories: 600,
      photos: ['cloud://p1', 'cloud://p2'],
      ingredients: [{ name: '五花肉', amount: '500克' }],
    },
    {
      _id: 'v1',
      name: '清炒时蔬',
      type: 'veg',
      calories: 120,
      photos: [],
      ingredients: [],
    },
  ];

  test('items 是快照：只取 dish_id/name/photo(封面)/type/calories', () => {
    const doc = buildMenuDoc({
      picks: makePicks(),
      requirements: { people: 2, composition: { meat: 1, veg: 1 }, avoid: [] },
      mode: 'random',
    });
    expect(doc.items).toEqual([
      { dish_id: 'm1', name: '红烧肉', photo: 'cloud://p1', type: 'meat', calories: 600 },
      { dish_id: 'v1', name: '清炒时蔬', photo: '', type: 'veg', calories: 120 },
    ]);
  });

  test('改原 dish 对象不影响已生成的菜单文档', () => {
    const picks = makePicks();
    const doc = buildMenuDoc({ picks, requirements: {}, mode: 'wheel' });
    picks[0].name = '已改名';
    picks[0].calories = 9999;
    expect(doc.items[0].name).toBe('红烧肉');
    expect(doc.items[0].calories).toBe(600);
  });

  test('total_calories 为合计，shopping_list 从材料聚合，date 为本地今天', () => {
    const { formatDateKey } = require('../miniprogram/utils/date');
    const doc = buildMenuDoc({ picks: makePicks(), requirements: { people: 2 }, mode: 'random' });
    expect(doc.total_calories).toBe(720);
    expect(doc.shopping_list).toEqual([
      { name: '五花肉', amount: '500克', bought: false },
    ]);
    expect(doc.date).toBe(formatDateKey(new Date()));
    expect(doc.requirements).toEqual({ people: 2 });
    expect(doc.mode).toBe('random');
  });
});
