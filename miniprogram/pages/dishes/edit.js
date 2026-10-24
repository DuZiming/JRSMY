const {
  uploadDishPhotos,
  getDish,
  addDish,
  updateDish,
} = require('../../services/dishes');
const {
  TYPE,
  TYPE_LABELS,
  TYPE_ORDER,
  SOURCE,
  SOURCE_LABELS,
  DEFAULT_TAGS,
} = require('../../utils/constants');
const { parseAiJson } = require('../../utils/aiParse');

const TYPE_OPTIONS = TYPE_ORDER.map((t) => TYPE_LABELS[t]);
const SOURCE_OPTIONS = Object.values(SOURCE).map((s) => SOURCE_LABELS[s]);

function emptyForm() {
  return {
    name: '',
    type: 'meat',
    source: 'home',
    tags: [],
    ingredients: [{ name: '', amount: '' }],
    calories: '',
    spicy_level: 0,
    practice: '',
  };
}

Page({
  data: {
    editId: '',
    photos: [], // 临时路径数组（新图）；编辑模式追加已有 fileID（以 cloud:// 开头）
    recognizing: false,
    saving: false,
    form: emptyForm(),
    typeOptions: TYPE_OPTIONS,
    typeIndex: 0,
    sourceOptions: SOURCE_OPTIONS,
    sourceIndex: 0,
    spicyOptions: ['不辣', '微辣', '中辣', '重辣'],
    defaultTags: DEFAULT_TAGS,
    canvasW: 300,
    canvasH: 300,
    canvasScale: 1,
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ editId: options.id });
      this.loadDish(options.id);
    }
  },

  async loadDish(id) {
    const dish = await getDish(id);
    this.setData({
      photos: dish.photos || [],
      form: {
        name: dish.name || '',
        type: dish.type || 'meat',
        source: dish.source || 'home',
        tags: dish.tags || [],
        ingredients: (dish.ingredients && dish.ingredients.length)
          ? dish.ingredients
          : [{ name: '', amount: '' }],
        calories: dish.calories != null ? String(dish.calories) : '',
        spicy_level: dish.spicy_level || 0,
        practice: dish.practice || '',
      },
      typeIndex: Math.max(0, TYPE_ORDER.indexOf(dish.type)),
      sourceIndex: Math.max(0, Object.values(SOURCE).indexOf(dish.source)),
    });
  },

  choosePhotos() {
    wx.chooseMedia({
      count: 9 - this.data.photos.length,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success: (res) => {
        this.setData({ photos: this.data.photos.concat(res.tempFiles.map((f) => f.tempFilePath)) });
      },
    });
  },

  removePhoto(e) {
    const { index } = e.currentTarget.dataset;
    const photos = this.data.photos.slice();
    photos.splice(index, 1);
    this.setData({ photos });
  },

  // 点击照片：旋转 / 删除（解决手机照片方向不对、无法调整的问题）
  onPhotoTap(e) {
    const { index } = e.currentTarget.dataset;
    const path = this.data.photos[index];
    const isCloud = path.startsWith('cloud://');
    const items = isCloud ? ['删除这张'] : ['向右旋转 90°', '删除这张'];
    wx.showActionSheet({
      itemList: items,
      success: (res) => {
        if (isCloud) {
          if (res.tapIndex === 0) this.removePhoto(e);
        } else if (res.tapIndex === 0) {
          this.rotatePhoto(index);
        } else if (res.tapIndex === 1) {
          this.removePhoto(e);
        }
      },
    });
  },

  // 老式 canvas 顺时针旋转 90°，产物替换原图
  async rotatePhoto(index) {
    const path = this.data.photos[index];
    try {
      const info = await new Promise((res, rej) => wx.getImageInfo({ src: path, success: res, fail: rej }));
      const w = info.width;
      const h = info.height;
      this.setData({ canvasW: Math.min(h, 1600), canvasH: Math.min(w, 1600), canvasScale: Math.min(h, 1600) / h });
      await new Promise((res) => setTimeout(res, 80)); // 等 canvas 尺寸生效
      const ctx = wx.createCanvasContext('rotate-canvas', this);
      const s = this.data.canvasScale;
      ctx.translate((h * s) / 2, (w * s) / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(path, (-w * s) / 2, (-h * s) / 2, w * s, h * s);
      await new Promise((res) => ctx.draw(false, res));
      const out = await new Promise((res, rej) =>
        wx.canvasToTempFilePath({ canvasId: 'rotate-canvas', fileType: 'jpg', quality: 0.92, success: res, fail: rej }, this)
      );
      const photos = this.data.photos.slice();
      photos[index] = out.tempFilePath;
      this.setData({ photos });
    } catch (err) {
      wx.showToast({ title: '旋转失败', icon: 'none' });
    }
  },

  // AI 识别：上传封面图 → 调云函数（失败自动重试 1 次）→ 解析预填；失败 toast 降级手填
  async recognize() {
    const cover = this.data.photos.find((p) => !p.startsWith('cloud://'));
    if (!cover) {
      wx.showToast({ title: '请先添加一张菜品照片', icon: 'none' });
      return;
    }
    this.setData({ recognizing: true });
    try {
      const up = await uploadDishPhotos([cover]);
      const call = () => wx.cloud.callFunction({ name: 'recognizeDish', data: { fileID: up[0] } });
      let res;
      try {
        res = await call();
      } catch (e) {
        res = await call(); // 偶现超时/网络抖动重试一次
      }
      const r = res.result || {};
      if (r.code !== 0) {
        wx.showToast({ title: r.message || '识别失败，请手动填写', icon: 'none' });
        return;
      }
      const { data } = parseAiJson(JSON.stringify(r.data));
      const patch = {};
      if (data.name) patch['form.name'] = data.name;
      if (data.type && TYPE_ORDER.includes(data.type)) {
        patch['form.type'] = data.type;
        patch.typeIndex = TYPE_ORDER.indexOf(data.type);
      }
      if (data.source && Object.values(SOURCE).includes(data.source)) {
        patch['form.source'] = data.source;
        patch.sourceIndex = Object.values(SOURCE).indexOf(data.source);
      }
      if (data.tags && data.tags.length) patch['form.tags'] = data.tags;
      if (data.ingredients && data.ingredients.length) {
        patch['form.ingredients'] = data.ingredients;
      }
      if (data.calories != null) patch['form.calories'] = String(data.calories);
      if (data.spicy_level != null) patch['form.spicy_level'] = data.spicy_level;
      if (Object.keys(patch).length) {
        this.setData(patch);
        wx.showToast({ title: '已识别，请确认修正', icon: 'success' });
      } else {
        wx.showToast({ title: '没认出来，请手动填写', icon: 'none' });
      }
    } catch (e) {
      wx.showToast({ title: '识别失败，请手动填写', icon: 'none' });
    } finally {
      this.setData({ recognizing: false });
    }
  },

  onName(e) {
    this.setData({ 'form.name': e.detail.value });
  },
  onType(e) {
    this.setData({
      typeIndex: Number(e.detail.value),
      'form.type': TYPE_ORDER[Number(e.detail.value)],
    });
  },
  onSource(e) {
    const idx = Number(e.detail.value);
    this.setData({
      sourceIndex: idx,
      'form.source': Object.values(SOURCE)[idx],
    });
  },
  onCalories(e) {
    this.setData({ 'form.calories': e.detail.value });
  },
  onSpicy(e) {
    this.setData({ 'form.spicy_level': Number(e.detail.value) });
  },
  onPractice(e) {
    this.setData({ 'form.practice': e.detail.value });
  },
  toggleTag(e) {
    const { tag } = e.currentTarget.dataset;
    const tags = this.data.form.tags.slice();
    const i = tags.indexOf(tag);
    if (i >= 0) tags.splice(i, 1);
    else tags.push(tag);
    this.setData({ 'form.tags': tags });
  },
  addCustomTag(e) {
    const tag = (e.detail.value || '').trim();
    if (!tag) return;
    if (!this.data.form.tags.includes(tag)) {
      this.setData({ 'form.tags': this.data.form.tags.concat(tag) });
    }
  },

  onIngredientName(e) {
    const { index } = e.currentTarget.dataset;
    this.setData({ [`form.ingredients[${index}].name`]: e.detail.value });
  },
  onIngredientAmount(e) {
    const { index } = e.currentTarget.dataset;
    this.setData({ [`form.ingredients[${index}].amount`]: e.detail.value });
  },
  addIngredient() {
    this.setData({ 'form.ingredients': this.data.form.ingredients.concat([{ name: '', amount: '' }]) });
  },
  removeIngredient(e) {
    const { index } = e.currentTarget.dataset;
    const list = this.data.form.ingredients.slice();
    list.splice(index, 1);
    this.setData({ 'form.ingredients': list.length ? list : [{ name: '', amount: '' }] });
  },

  async save() {
    const { form, photos, editId } = this.data;
    if (!form.name.trim()) {
      wx.showToast({ title: '请填写菜名', icon: 'none' });
      return;
    }
    if (!photos.length) {
      wx.showToast({ title: '请至少添加一张照片', icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    try {
      // 上传尚未上传的新图；已是 fileID 的直接复用
      const newPaths = photos.filter((p) => !p.startsWith('cloud://'));
      const uploaded = newPaths.length ? await uploadDishPhotos(newPaths) : [];
      const fileIDs = photos
        .filter((p) => p.startsWith('cloud://'))
        .concat(uploaded);

      const dish = {
        name: form.name.trim(),
        photos: fileIDs,
        source: form.source,
        type: form.type,
        tags: form.tags,
        ingredients: form.ingredients.filter((i) => i.name.trim()),
        calories: form.calories ? Number(form.calories) : null,
        spicy_level: Number(form.spicy_level) || 0,
        practice: form.practice.trim(),
      };

      if (editId) {
        await updateDish(editId, dish);
      } else {
        await addDish(dish);
      }
      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    } catch (e) {
      wx.showToast({ title: e.message || '保存失败，请重试', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },
});
