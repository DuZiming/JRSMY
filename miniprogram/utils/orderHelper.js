// 手动排序计算（纯函数）
// 约定：列表顺序与展示一致（index 0 在最上）；sort 值越大越靠前；
// 缺 sort 的旧数据有效值按位置派生（(len-index)*100），保证可交换。

function effectiveSort(list, index) {
  const item = list[index];
  return typeof item.sort === 'number' ? item.sort : (list.length - index) * 100;
}

// 返回需要落库的 [{ _id, sort }]；无可操作（越界）返回 []
function computeMove(list, index, dir) {
  if (!Array.isArray(list) || index < 0 || index >= list.length) return [];
  let j = -1;
  if (dir === 'top') {
    if (index === 0) return [];
    const max = Math.max(...list.map((_, i) => effectiveSort(list, i)));
    return [{ _id: list[index]._id, sort: max + 1 }];
  }
  if (dir === 'up') {
    if (index === 0) return [];
    j = index - 1;
  } else if (dir === 'down') {
    if (index === list.length - 1) return [];
    j = index + 1;
  } else {
    return [];
  }
  const a = effectiveSort(list, index);
  const b = effectiveSort(list, j);
  const aHas = typeof list[index].sort === 'number';
  const bHas = typeof list[j].sort === 'number';
  // 双方都有值 → 直接交换；否则给缺失方赋对方的有效值，另一方派生新值
  if (aHas && bHas) {
    return [
      { _id: list[index]._id, sort: b },
      { _id: list[j]._id, sort: a },
    ];
  }
  if (!aHas && bHas) {
    return [
      { _id: list[index]._id, sort: b },
      { _id: list[j]._id, sort: b - 1 },
    ];
  }
  if (aHas && !bHas) {
    return [
      { _id: list[index]._id, sort: b },
      { _id: list[j]._id, sort: a },
    ];
  }
  // 双方都没有：按位置派生赋值
  return [
    { _id: list[index]._id, sort: b },
    { _id: list[j]._id, sort: a },
  ];
}

module.exports = { computeMove };
