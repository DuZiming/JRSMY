const { computeMove } = require('../miniprogram/utils/orderHelper');

// 列表顺序与显示一致：index 0 最上
const list = [
  { _id: 'a' }, // 无 sort 的旧数据
  { _id: 'b', sort: 500 },
  { _id: 'c', sort: 300 },
  { _id: 'd' }, // 无 sort
];

describe('computeMove 手动排序', () => {
  test('置顶：得到比全场有效值都大的 sort', () => {
    const r = computeMove(list, 2, 'top');
    expect(r).toEqual([{ _id: 'c', sort: 501 }]);
  });

  test('上移：与上一项交换有效值（对方有 sort）', () => {
    const r = computeMove(list, 2, 'up');
    // c 的有效值 300 与 b 的 500 交换
    expect(r).toEqual([
      { _id: 'c', sort: 500 },
      { _id: 'b', sort: 300 },
    ]);
  });

  test('上移：上一项无 sort 时，给两者按位置派生的新值（保持相对顺序互换）', () => {
    const r = computeMove(list, 1, 'up');
    // b(500) 与 a(null) 交换：a 得到 500，b 得到略小的新值
    expect(r.find((x) => x._id === 'a').sort).toBe(500);
    expect(r.find((x) => x._id === 'b').sort).toBeLessThan(500);
    expect(r.find((x) => x._id === 'b').sort).toBeGreaterThan(300);
  });

  test('下移：与下一项交换有效值', () => {
    const r = computeMove(list, 1, 'down');
    // b(500) 下移与 c(300) 交换
    expect(r).toEqual([
      { _id: 'b', sort: 300 },
      { _id: 'c', sort: 500 },
    ]);
  });

  test('边界：第一项上移 / 最后一项下移返回空数组', () => {
    expect(computeMove(list, 0, 'up')).toEqual([]);
    expect(computeMove(list, 3, 'down')).toEqual([]);
  });
});
