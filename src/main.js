import { generateTypesetImages } from './typesetter.js';
import {
  triggerHaptic,
  showToast,
  saveImageToAlbum,
  batchSaveImagesToAlbum,
  shareAllImages,
  readClipboardText
} from './native.js';

// 状态管理
let pastedImageSrc = null;
let imageWidth = 250;
let currentGeneratedImages = [];

// DOM 元素引用
const aiInput = document.getElementById('ai-input');
const imageUpload = document.getElementById('image-upload');
const uploadBtn = document.getElementById('upload-btn');
const previewImgContainer = document.getElementById('preview-img-container');
const imgScale = document.getElementById('img-scale');
const imgScaleVal = document.getElementById('img-scale-val');
const btnInsertBackslash = document.getElementById('btn-insert-backslash');
const btnPasteText = document.getElementById('btn-paste-text');
const btnLoadSample = document.getElementById('btn-load-sample');
const btnClearAll = document.getElementById('btn-clear-all');
const genBtn = document.getElementById('gen-btn');
const outputContainer = document.getElementById('output-container');
const emptyState = document.getElementById('empty-state');
const outputCountBadge = document.getElementById('output-count-badge');
const btnBatchSave = document.getElementById('btn-batch-save');
const btnShareAll = document.getElementById('btn-share-all');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxClose = document.getElementById('lightbox-close');

// ==========================================================================
// 1. 草稿持久化与初始化
// ==========================================================================
function loadDraft() {
  const savedText = localStorage.getItem('physics_draft_text');
  const savedScale = localStorage.getItem('physics_draft_scale');
  if (savedText && !aiInput.value) {
    aiInput.value = savedText;
  }
  if (savedScale) {
    imageWidth = parseInt(savedScale, 10);
    imgScale.value = imageWidth;
    imgScaleVal.innerText = `${imageWidth} px`;
  }
}

function saveDraft() {
  localStorage.setItem('physics_draft_text', aiInput.value);
  localStorage.setItem('physics_draft_scale', imageWidth.toString());
}

// ==========================================================================
// 2. 双反斜杠 \\ 插入与文本编辑操作 (直接插入两个真实反斜杠 \\)
// ==========================================================================
function insertDoubleBackslash() {
  const start = aiInput.selectionStart;
  const end = aiInput.selectionEnd;
  const val = aiInput.value;
  const insertion = '\\\\'; // 两个真实反斜杠字符

  aiInput.value = val.substring(0, start) + insertion + val.substring(end);
  aiInput.selectionStart = aiInput.selectionEnd = start + insertion.length;
  aiInput.focus();

  triggerHaptic('light');
  saveDraft();
}

btnInsertBackslash.addEventListener('click', insertDoubleBackslash);

aiInput.addEventListener('input', saveDraft);

btnPasteText.addEventListener('click', async () => {
  triggerHaptic('light');
  const text = await readClipboardText();
  if (text) {
    const start = aiInput.selectionStart;
    const end = aiInput.selectionEnd;
    const val = aiInput.value;
    aiInput.value = val.substring(0, start) + text + val.substring(end);
    aiInput.selectionStart = aiInput.selectionEnd = start + text.length;
    aiInput.focus();
    saveDraft();
    showToast('已从剪贴板粘贴文本');
  } else {
    showToast('未能获取剪贴板内容，请手动长按粘贴');
  }
});

btnLoadSample.addEventListener('click', () => {
  triggerHaptic('light');
  const sample = `【答案】
见解析

【解析】
带电粒子在匀强磁场中做匀速圆周运动，其洛伦兹力提供向心力：
$$qvB = m\frac{v^2}{R}$$
解得粒子的轨道半径为：
$$R = \frac{mv}{qB}$$
由题意可知，粒子在磁场中运动的周期为：
$$T = \frac{2\pi m}{qB}$$
粒子在磁场中运动的偏转角为 $\theta = \frac{\pi}{3}$，因此粒子在磁场中运动的时间为：
$$t = \frac{\theta}{2\pi} T = \frac{m}{3qB}$$
粒子出磁场后进入匀强电场，电场强度方向与粒子速度垂直。\\\\此时粒子在沿电场方向做初速度为零的匀加速直线运动，在垂直电场方向做匀速直线运动。
联立上述各式，可得粒子运动的最终速度大小为：
$$v_t = \sqrt{v^2 + a^2 t_1^2} = \sqrt{2} v$$
<red>综上所述，该粒子在电磁场中运动的完整轨迹与时间已求解完毕。</red>`;

  aiInput.value = sample;
  saveDraft();
  showToast('已加载物理示例数据');
});

btnClearAll.addEventListener('click', () => {
  triggerHaptic('warning');
  aiInput.value = '';
  pastedImageSrc = null;
  previewImgContainer.innerHTML = '📷 点击上传配图 / 剪贴板粘贴 (可选)';
  outputContainer.innerHTML = '';
  outputContainer.appendChild(emptyState);
  emptyState.style.display = 'flex';
  btnBatchSave.style.display = 'none';
  btnShareAll.style.display = 'none';
  outputCountBadge.innerText = '[ 待生成 ]';
  currentGeneratedImages = [];
  saveDraft();
  showToast('已清空所有内容');
});

// ==========================================================================
// 3. 配图上传与剪贴板图片处理
// ==========================================================================
uploadBtn.addEventListener('click', () => {
  imageUpload.click();
});

imageUpload.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      pastedImageSrc = event.target.result;
      updateImagePreview();
      triggerHaptic('light');
    };
    reader.readAsDataURL(file);
  }
});

window.addEventListener('paste', (e) => {
  const items = (e.clipboardData || e.originalEvent.clipboardData)?.items;
  if (!items) return;
  for (let item of items) {
    if (item.type.indexOf('image/') === 0) {
      const blob = item.getAsFile();
      const reader = new FileReader();
      reader.onload = (event) => {
        pastedImageSrc = event.target.result;
        updateImagePreview();
        triggerHaptic('medium');
        showToast('已加载剪贴板配图');
      };
      reader.readAsDataURL(blob);
      break;
    }
  }
});

function updateImagePreview() {
  if (pastedImageSrc) {
    previewImgContainer.innerHTML = `
      <div class="preview-chip">
        <img src="${pastedImageSrc}">
        <span>配图已载入</span>
        <button type="button" class="remove-img-btn" id="remove-img-btn">移除</button>
      </div>
    `;
    document.getElementById('remove-img-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      pastedImageSrc = null;
      previewImgContainer.innerHTML = '📷 点击上传配图 / 剪贴板粘贴 (可选)';
      imageUpload.value = '';
      triggerHaptic('light');
    });
  } else {
    previewImgContainer.innerHTML = '📷 点击上传配图 / 剪贴板粘贴 (可选)';
  }
}

imgScale.addEventListener('input', (e) => {
  imageWidth = parseInt(e.target.value, 10);
  imgScaleVal.innerText = `${imageWidth} px`;
  saveDraft();
});

// ==========================================================================
// 4. 一键排版生成
// ==========================================================================
async function handleGenerate() {
  const rawText = aiInput.value.trim();
  if (!rawText && !pastedImageSrc) {
    triggerHaptic('error');
    showToast('请先输入解析文本或上传配图！');
    return;
  }

  triggerHaptic('medium');
  genBtn.disabled = true;
  genBtn.innerHTML = '<span>⏳ 正在拼命排版中，请稍候...</span>';

  try {
    const captureZone = document.getElementById('capture-zone');

    const images = await generateTypesetImages({
      rawText,
      pastedImageSrc,
      imageWidth,
      captureZone,
      onProgress: ({ message }) => {
        genBtn.innerHTML = `<span>⏳ ${message}</span>`;
      }
    });

    currentGeneratedImages = images;
    renderOutputCards(images);

    triggerHaptic('success');
    genBtn.innerHTML = '<span>✅ 生成成功！(重新调整可再次点击)</span>';
    genBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    genBtn.disabled = false;

    showToast(`🎉 排版完成！共生成 ${images.length} 页 A4 高清图`);

    // 移动端自动平滑滚动到结果区域
    if (window.innerWidth < 960) {
      outputContainer.scrollIntoView({ behavior: 'smooth' });
    }
  } catch (e) {
    console.error('Typesetting error:', e);
    triggerHaptic('error');
    alert('⛔ 排版发生错误：\n' + e.message);
    genBtn.innerHTML = '<span>⚡ 一键自动排版并生成图片</span>';
    genBtn.style.background = '';
    genBtn.disabled = false;
  }
}

genBtn.addEventListener('click', handleGenerate);

// ==========================================================================
// 5. 结果展示与相册保存
// ==========================================================================
function renderOutputCards(images) {
  outputContainer.innerHTML = '';
  emptyState.style.display = 'none';

  outputCountBadge.innerText = `[ 共 ${images.length} 页 ]`;
  btnBatchSave.style.display = 'flex';
  btnShareAll.style.display = 'flex';

  images.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = 'output-card';
    card.innerHTML = `
      <div class="output-card-header">
        <span>📄 PAGE ${String(item.pageIndex).padStart(2, '0')} / ${String(images.length).padStart(2, '0')}</span>
        <span>A4 RETINA 2X</span>
      </div>
      <img src="${item.dataUrl}" alt="Page ${item.pageIndex}" data-idx="${idx}">
      <div class="output-card-actions">
        <button type="button" class="card-action-btn btn-view-img" data-idx="${idx}">🔍 点击查看大图</button>
        <button type="button" class="card-action-btn btn-save-single" data-idx="${idx}" style="background: rgba(16, 185, 129, 0.2); border-color: var(--neon-emerald); color: #34d399; font-weight: 700;">
          💾 保存此页到相册
        </button>
      </div>
    `;

    // 绑定单张大图查看与保存
    card.querySelector('img').addEventListener('click', () => openLightbox(item.dataUrl));
    card.querySelector('.btn-view-img').addEventListener('click', () => openLightbox(item.dataUrl));
    card.querySelector('.btn-save-single').addEventListener('click', async () => {
      const ok = await saveImageToAlbum(item.dataUrl, `physics_page_${item.pageIndex}.jpg`);
      if (ok) showToast(`已将第 ${item.pageIndex} 页保存至相册！`);
    });

    outputContainer.appendChild(card);
  });
}

// 批量保存到相册
btnBatchSave.addEventListener('click', () => {
  batchSaveImagesToAlbum(currentGeneratedImages);
});

// 分享所有图片
btnShareAll.addEventListener('click', () => {
  shareAllImages(currentGeneratedImages);
});

// 大图灯箱查看
function openLightbox(src) {
  lightboxImg.src = src;
  lightbox.style.display = 'flex';
  triggerHaptic('light');
}

function closeLightbox() {
  lightbox.style.display = 'none';
  lightboxImg.src = '';
}

lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) closeLightbox();
});

// ==========================================================================
// 6. 注册 Service Worker (PWA 离线支持，开发模式下自动注销以防缓存旧版页面)
// ==========================================================================
if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });
    if ('caches' in window) {
      caches.keys().then((keys) => {
        keys.forEach((k) => caches.delete(k));
      });
    }
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.log('SW registration skipped or failed:', err);
      });
    });
  }
}

// ==========================================================================
// 7. 主题模式切换 (白天模式 / 黑夜模式 / 自动跟随系统)
// ==========================================================================
const themeButtons = document.querySelectorAll('.theme-seg-btn');
const themeMeta = document.querySelector('meta[name="theme-color"]');

function applyTheme(mode) {
  let activeTheme = mode;
  if (mode === 'auto') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    activeTheme = isDark ? 'dark' : 'light';
  }

  document.documentElement.setAttribute('data-theme', activeTheme);
  document.documentElement.setAttribute('data-theme-mode', mode);

  if (themeMeta) {
    themeMeta.setAttribute('content', activeTheme === 'dark' ? '#07090e' : '#f0fdf4');
  }

  themeButtons.forEach(btn => {
    if (btn.getAttribute('data-theme-val') === mode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  localStorage.setItem('physics_theme_mode', mode);
}

themeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const mode = btn.getAttribute('data-theme-val');
    triggerHaptic('light');
    applyTheme(mode);
    const modeNames = { auto: '跟随系统', light: '清爽绿意白天模式', dark: '复古未来黑夜模式' };
    showToast(`已切换至: ${modeNames[mode]}`);
  });
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const savedMode = localStorage.getItem('physics_theme_mode') || 'auto';
  if (savedMode === 'auto') {
    applyTheme('auto');
  }
});

// 初始化加载
const initialThemeMode = localStorage.getItem('physics_theme_mode') || 'auto';
applyTheme(initialThemeMode);
loadDraft();
