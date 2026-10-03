import html2canvas from 'html2canvas';
import katex from 'katex';
import renderMathInElement from 'katex/contrib/auto-render';

/**
 * 计算 KaTeX 公式真实的可视包围盒（所有 .base 片段的并集）
 */
function mathBox(el) {
  const parts = el.querySelectorAll('.katex-html > .base, .katex-html > .tag');
  if (!parts.length) return null;
  let top = Infinity, left = Infinity, right = -Infinity, bottom = -Infinity;
  parts.forEach(p => {
    const r = p.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    top = Math.min(top, r.top);
    left = Math.min(left, r.left);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  });
  if (top === Infinity) return null;
  return { top, left, right, bottom };
}

/**
 * 【第二道保险】检测 WebView 文字缩放（系统“字体大小”设置）。
 * 文字缩放会同时放大字号和固定 px 行高，但不放大横线背景与分页高度。
 * 若检测到缩放（原生层锁定失效的极端机型），则按 1/z 反向补偿，保证 60px 网格。
 */
function compensateTextZoom() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;left:-9999px;top:0;font-size:20px;line-height:100px;padding:0;margin:0;';
  probe.textContent = 'x';
  document.body.appendChild(probe);
  const z = probe.offsetHeight / 100;
  probe.remove();

  let styleEl = document.getElementById('text-zoom-compensate');
  if (!z || Math.abs(z - 1) < 0.01) {
    if (styleEl) styleEl.remove();
    return;
  }
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'text-zoom-compensate';
    document.head.appendChild(styleEl);
  }
  const px = v => (v / z).toFixed(3) + 'px';
  styleEl.textContent = `
    #master-box, .sliced-content { font-size: ${px(21)} !important; line-height: ${px(60)} !important; }
    .ans-row { font-size: ${px(21)} !important; line-height: ${px(60)} !important; }
    .custom-legend, #capture-zone .custom-legend, .page-container .custom-legend { font-size: ${px(18)} !important; line-height: ${px(24)} !important; }
  `;
}

/**
 * 【跨平台 60px 行高锁定核心】行内公式“零高度化”
 *
 * 风险：较高的行内公式（分式、上下标、嵌套分式）若超出 60px 行框，
 * 会把所在行撑高，后面每一行都随之下沉，横线错位、分页时把一行字拦腰截断。
 *
 * 方案：先在原位测出公式相对文字基线的精确位置，然后把公式放进一个
 * “高度为 0、底边坐在基线上”的行内盒子里，公式本体绝对定位回原位置。
 * 这样公式视觉位置分毫不变，但对行框高度的贡献恒为 0，
 * 每一行都严格等于 60px，与平台/字体度量无关。
 */
function neutralizeInlineMath(root) {
  const items = Array.from(root.querySelectorAll('.katex')).filter(el => !el.closest('.katex-display'));
  if (!items.length) return;

  // 阶段 0：禁止公式内部折行，并在公式开头插入零尺寸基线探针
  const recs = items.map(el => {
    el.style.whiteSpace = 'nowrap';
    const mark = document.createElement('span');
    mark.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline;';
    el.insertBefore(mark, el.firstChild);
    return { el, mark };
  });

  // 阶段 1：测量公式相对基线的偏移与宽度
  recs.forEach(r => {
    const baseline = r.mark.getBoundingClientRect().top;
    const elRect = r.el.getBoundingClientRect();
    const box = mathBox(r.el) || elRect;
    r.top0 = box.top - baseline;
    r.lx = box.left - elRect.left;
    r.width = Math.max(box.right, elRect.right) - elRect.left;
  });

  // 阶段 2：移除探针，装入零高度包裹层
  recs.forEach(r => {
    r.mark.remove();
    const wrap = document.createElement('span');
    wrap.className = 'kx-wrap';
    wrap.style.width = (Math.ceil(r.width * 100) / 100) + 'px';
    r.el.parentNode.insertBefore(wrap, r.el);
    wrap.appendChild(r.el);
    r.el.style.position = 'absolute';
    r.el.style.left = '0px';
    r.el.style.top = '0px';
    r.wrap = wrap;
  });

  // 阶段 3：校正绝对定位，使公式回到与原基线完全一致的位置
  recs.forEach(r => {
    const wr = r.wrap.getBoundingClientRect(); // 高度为 0：top == bottom == 基线
    const nb = mathBox(r.el) || r.el.getBoundingClientRect();
    r.el.style.left = (r.lx - (nb.left - wr.left)) + 'px';
    r.el.style.top = (r.top0 - (nb.top - wr.top)) + 'px';
  });
}

/**
 * 核心排版引擎 (Strictly preserved V42 typesetting logic)
 * @param {Object} options
 * @param {string} options.rawText 待排版的原始解析文本
 * @param {string|null} options.pastedImageSrc 配图 Base64 或 URL
 * @param {number} options.imageWidth 配图宽度 (px)
 * @param {HTMLElement} options.captureZone 用于离线渲染 DOM 的容器
 * @param {Function} [options.onProgress] 进度回调函数
 * @param {Function} [options.onLayout] 排版完成后的调试回调 (masterBox)
 * @returns {Promise<Array<{dataUrl: string, blob: Blob, pageIndex: number}>>} 生成的图片数组
 */
export async function generateTypesetImages({
  rawText,
  pastedImageSrc = null,
  imageWidth = 250,
  captureZone,
  onProgress = () => {},
  onLayout = null
}) {
  let text = (rawText || '').trim();
  if (!text && !pastedImageSrc) {
    throw new Error('请先粘贴解析文本或上传图片！');
  }

  // ====== 核心功能点：在解析开始前，将所有的数字 1 替换为小写字母 l ======
  text = text.replace(/1/g, 'l');

  onProgress({ stage: 'preprocessing', message: '正在进行文本预处理与分词...' });
  await new Promise(r => setTimeout(r, 60));

  if (!captureZone) {
    captureZone = document.createElement('div');
    captureZone.id = 'capture-zone';
    document.body.appendChild(captureZone);
  }
  captureZone.innerHTML = '';
  compensateTextZoom();

  const masterBox = document.createElement('div');
  masterBox.id = 'master-box';

  let parts = text.split(/(\$\$[\s\S]*?\$\$|\$[^$]*?\$)/g);
  for (let i = 0; i < parts.length; i++) {
    if (!parts[i].startsWith('$')) {
      parts[i] = parts[i].replace(/\\/g, '【MANUAL_BR】');
    }
  }
  let safeText = parts.join('');

  let periodCount = 0;
  let htmlText = safeText
    .replace(/【解析】/g, '')
    .replace(/【答案】/g, '')
    .replace(/\n/g, '')
    .replace(/<\/red>\s*([，。、；：？！,.;:?!]+)/g, '$1</red>')
    .replace(/。/g, function(match) {
      periodCount++;
      return periodCount % 3 === 0 ? match + '<br>' : match;
    })
    .replace(/(\${1,2}[^$]+\${1,2})\s*([，。、；：？！,.;:?!]+)/g, '<span style="white-space: nowrap;">$1$2</span>')
    .replace(/<red>/g, '<span class="highlight">')
    .replace(/<\/red>/g, '</span>')
    .replace(/【MANUAL_BR】/g, '<br>')
    .replace(/(<br>)+/g, '<br>')
    .replace(/^<br>|<br>$/g, '');

  // ========== 逐字打散并应用单字体，严格加锁 line-height: 21px ==========
  const tokenRegex = /(<[^>]+>)|(\$\$[\s\S]*?\$\$|\$[^$]*?\$)|([\s\S])/g;
  let randomizedText = '';
  let match;
  while ((match = tokenRegex.exec(htmlText)) !== null) {
    if (match[1]) {
      randomizedText += match[1];
    } else if (match[2]) {
      randomizedText += match[2]; // 公式区域原样放行，交由后续 KaTeX 渲染
    } else if (match[3]) {
      let char = match[3];
      if (char.trim() === '' || char === '\n') {
        randomizedText += char;
      } else {
        // 【完美对齐核心】: 使用 21px 的自身行高，绝对不撑破父级 60px 的网格！
        if (/[\u4e00-\u9fa5]/.test(char)) {
          randomizedText += `<span class="f1" style="font-size: 1.5em; line-height: 21px !important;">${char}</span>`;
        } else {
          randomizedText += `<span class="f1" style="font-size: 1.35em; line-height: 21px !important;">${char}</span>`;
        }
      }
    }
  }
  htmlText = randomizedText;

  let imgHTML = '';
  if (pastedImageSrc) {
    imgHTML = `<img src="${pastedImageSrc}" class="uploaded-float" style="width: ${imageWidth}px; height: auto; float: right; margin: 0 0 10px 20px; background: white; border-radius: 4px;">`;
  }

  masterBox.innerHTML = imgHTML + htmlText;
  captureZone.appendChild(masterBox);

  // ========== 启动 KaTeX 公式渲染 ==========
  onProgress({ stage: 'math', message: '正在渲染数学与物理公式...' });
  renderMathInElement(masterBox, {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '$', right: '$', display: false }
    ],
    throwOnError: false
  });

  // 强制等待网络与本地字体加载完毕并留出绘制时间
  await document.fonts.ready;
  let fontWaitCount = 0;
  while (!document.fonts.check('21px MyHandwriting') && fontWaitCount < 10) {
    await new Promise(r => setTimeout(r, 100));
    fontWaitCount++;
  }
  await new Promise(resolve => setTimeout(resolve, 200));

  masterBox.querySelectorAll('img').forEach(img => {
    if (!img.classList.contains('uploaded-float')) {
      img.style.verticalAlign = 'middle';
    }
  });

  // ========== 【跨平台行高锁定核心】：行内公式零高度化，杜绝行框被撑高 ==========
  neutralizeInlineMath(masterBox);

  // ========== 【完美对齐核心】：公式高度强制锁定为 60 的倍数 ==========
  masterBox.querySelectorAll('.katex-display').forEach(el => {
    const h = el.offsetHeight;
    const targetH = Math.ceil(h / 60) * 60;

    if (targetH > 0) {
      el.style.height = targetH + 'px';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.margin = '0px !important';
      el.style.padding = '0px !important';
    }
  });

  const masterRect = masterBox.getBoundingClientRect();

  // 获取所有可能干扰切割的图片和大型公式的位置
  const imagesPos = [];
  masterBox.querySelectorAll('img, .katex-display').forEach(el => {
    const rect = el.getBoundingClientRect();
    const computed = window.getComputedStyle(el);
    const top = rect.top - masterRect.top - (parseFloat(computed.marginTop) || 0);
    const bottom = rect.top - masterRect.top + rect.height + (parseFloat(computed.marginBottom) || 0);
    imagesPos.push({ top, bottom });
  });

  // 严密测算真实内容高度，包含所有子元素底部位置
  let maxChildBottom = 0;
  masterBox.querySelectorAll('*').forEach(el => {
    const r = el.getBoundingClientRect();
    const b = r.bottom - masterRect.top;
    if (b > maxChildBottom) maxChildBottom = b;
  });

  const measuredHeight = Math.max(masterBox.offsetHeight, masterBox.scrollHeight, maxChildBottom);
  if (measuredHeight === 0) throw new Error('文本处理异常，未检测到有效内容高度。');

  // 向上取整到整行 60px 网格高度，确保绝不截断最后一行
  const totalHeight = Math.ceil(measuredHeight / 60) * 60;

  if (onLayout) onLayout(masterBox);

  onProgress({ stage: 'slicing', message: '正在执行智能防截断分页...' });

  const pageHeights = [780, 1020, 1020, 1020, 1020, 1020, 1020, 1020, 1020, 1020];

  const pageStarts = [0];
  let currentPage = 0;
  let loopGuard = 0;

  while (true) {
    loopGuard++;
    if (loopGuard > 100) throw new Error('触发分页循环保护，文案过长。');

    const start = pageStarts[currentPage];
    if (start >= totalHeight) break;

    const boxHeight = pageHeights[currentPage] || 1020;
    const usableHeight = boxHeight;
    const theoreticalEnd = start + usableHeight;

    let minCrossTop = theoreticalEnd;
    for (let img of imagesPos) {
      if (img.top < theoreticalEnd - 15 && img.bottom > theoreticalEnd + 15) {
        if (img.top < minCrossTop) minCrossTop = img.top;
      }
    }

    let actualEnd;
    if (minCrossTop < theoreticalEnd) {
      actualEnd = Math.floor(minCrossTop / 60) * 60;
      if (actualEnd <= start) {
        actualEnd = start + 60;
      }
    } else {
      actualEnd = theoreticalEnd;
    }

    actualEnd = Math.floor(actualEnd / 60) * 60;

    if (actualEnd > totalHeight) actualEnd = totalHeight;

    pageStarts.push(actualEnd);
    currentPage++;
    if (actualEnd >= totalHeight) break;
  }

  const pages = [];
  for (let i = 0; i < pageStarts.length - 1; i++) {
    const start = pageStarts[i];
    const end = pageStarts[i + 1];
    const contentDisplayHeight = end - start;
    const isLastPage = (i === pageStarts.length - 2);

    let pageDiv = document.createElement('div');
    pageDiv.className = 'page-container';

    let contentWrapper = document.createElement('div');
    if (isLastPage) {
      // 最后一页：无需使用紧凑像素截断，直接给足当前页的最大容纳高度
      // 外层容器 (.p1 或 .p2) 自身已有严格的 780px / 1020px 纸张边界与 overflow:hidden
      // 这样确保末尾内容或最后几行绝对不会被 contentWrapper 提前截断
      const maxPageH = pageHeights[i] || 1020;
      contentWrapper.style.height = maxPageH + 'px';
    } else {
      contentWrapper.style.height = contentDisplayHeight + 'px';
      contentWrapper.style.overflow = 'hidden';
    }

    let contentClone = document.createElement('div');
    contentClone.className = 'sliced-content';
    contentClone.style.marginTop = `-${start}px`;
    contentClone.innerHTML = masterBox.innerHTML;

    contentWrapper.appendChild(contentClone);

    if (i === 0) {
      pageDiv.innerHTML = `
        <div class="custom-box ans-box">
            <div class="custom-legend">答案</div>
            <div class="ans-row"></div>
            <div class="ans-row" style="padding-left: 2em;"><span style="font-size: 1.5em; line-height: 60px !important;">见解析</span></div>
            <div class="ans-row"></div>
        </div>
        <div class="custom-box exp-box" style="margin-bottom: 0;">
            <div class="custom-legend">解析</div>
            <div class="ruled-content p1"></div>
        </div>
      `;
      pageDiv.querySelector('.p1').appendChild(contentWrapper);
    } else {
      pageDiv.innerHTML = `
        <div class="custom-box exp-box" style="margin-bottom: 0;">
            <div class="custom-legend">解析</div>
            <div class="ruled-content p2"></div>
        </div>
      `;
      pageDiv.querySelector('.p2').appendChild(contentWrapper);
    }
    captureZone.appendChild(pageDiv);
    pages.push(pageDiv);
  }

  await new Promise(r => setTimeout(r, 200));

  const results = [];
  for (let i = 0; i < pages.length; i++) {
    onProgress({
      stage: 'rendering',
      message: `正在生成 A4 视网膜高清图片 (第 ${i + 1} / ${pages.length} 页)...`,
      current: i + 1,
      total: pages.length
    });

    const canvas = await html2canvas(pages[i], {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false
    });

    const dataUrl = canvas.toDataURL('image/jpeg', 1.0);
    results.push({
      dataUrl,
      pageIndex: i + 1,
      width: canvas.width,
      height: canvas.height
    });
  }

  captureZone.innerHTML = '';
  return results;
}
