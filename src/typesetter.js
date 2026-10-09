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
 * 【跨平台 60px 行高锁定核心】行内公式“零高度化”
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
    const wr = r.wrap.getBoundingClientRect();
    const nb = mathBox(r.el) || r.el.getBoundingClientRect();
    r.el.style.left = (r.lx - (nb.left - wr.left)) + 'px';
    r.el.style.top = (r.top0 - (nb.top - wr.top)) + 'px';
  });
}

/**
 * 【第二道保险】检测 WebView 文字缩放
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
 * 汉字专属：拟真手写有机扰动引擎 (Organic Chinese Handwriting Engine)
 * 仅对汉字生效，公式、英文字母、数字和标点完全保持原样不变。
 * 
 * 包含六大核心特性：
 * 1. 同字同形异构化 (解重复字千篇一律问题)
 * 2. 基线自然浮动 (Baseline vertical jitter)
 * 3. 微小倾斜角度 (Micro-rotation)
 * 4. 大小微小差异 (Size micro-variation)
 * 5. 字距松紧微调 (Kerning/tracking jitter)
 * 6. 纸张纤维微洇笔墨 (Micro ink-bleed diffusion)
 */
/**
 * 高熵 32 位整型哈希函数（无可见周期的确定性伪随机）
 */
function hash32(a, b, c, d) {
  let h = (a * 1664525 + b * 1013904223 + c * 374761393 + d * 668265263) >>> 0;
  h = ((h ^ (h >>> 16)) * 0x45d9f3b) >>> 0;
  h = ((h ^ (h >>> 16)) * 0x45d9f3b) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

/**
 * 汉字专属：拟真手写有机扰动引擎 (Organic Chinese Handwriting Engine V2 - Enhanced)
 * 仅对汉字生效，公式、英文字母、数字和标点完全保持原样不变。
 * 
 * 核心升级：
 * 1. 同字异构化 (6 套大相径庭的字态骨架，长宽比与体势差异高达 40%，绝不重样)
 * 2. 旋转幅度显著放大 (-9.5° ~ +11.2° 真实手写倾角错落)
 * 3. 字体大小变化显著放大 (0.78 ~ 1.28 非均质长宽比与大小微变)
 * 4. 上下浮动大幅放大 (±5.5px 行进起伏与微抖，行内自由流动)
 * 5. 一句话浓淡深浅波动 (Writing Pressure & Ink Gradient: 起笔浓润、行笔飞动微浅)
 * 6. 字内笔画粗细变化 (Calligraphic Nib Angle & Directional Shading: 竖/撇粗、横笔细)
 * 7. 纸张毛细微洇笔墨 (随墨量动态调节扩散光晕)
 */
function createOrganicChineseCharGenerator() {
  const charOccurMap = new Map();
  let chineseCharSeq = 0;
  let charInClause = 0;

  const profiles = [
    // 0: 正势端庄 (稳健中正)
    { sx: 1.00, sy: 1.00, skewX: -1.0, skewY: 0.5, tilt: 1.5, stroke: 0.15, penAng: 55, penW: 0.35, dP: 0.00 },
    // 1: 扁阔舒展 (横向扩张，重墨厚重)
    { sx: 1.20, sy: 0.86, skewX: -6.5, skewY: -2.0, tilt: -4.2, stroke: 0.48, penAng: 35, penW: 0.55, dP: 0.09 },
    // 2: 纵势耸拔 (纵向拉伸，清劲清秀)
    { sx: 0.85, sy: 1.18, skewX: 5.5, skewY: 2.2, tilt: 6.5, stroke: 0.00, penAng: 75, penW: 0.20, dP: -0.09 },
    // 3: 疾书大倾 (右倾飞动，行气连贯)
    { sx: 1.08, sy: 0.94, skewX: -9.5, skewY: 2.0, tilt: 8.2, stroke: 0.30, penAng: 62, penW: 0.42, dP: -0.02 },
    // 4: 欹侧左倚 (侧锋取势，反向逆倾)
    { sx: 0.93, sy: 1.08, skewX: 8.5, skewY: -3.0, tilt: -6.8, stroke: 0.42, penAng: 45, penW: 0.48, dP: 0.05 },
    // 5: 简练收敛 (整体略小，含蓄紧致)
    { sx: 0.88, sy: 0.88, skewX: -3.0, skewY: 1.0, tilt: 3.2, stroke: 0.10, penAng: 50, penW: 0.25, dP: -0.07 }
  ];

  return {
    resetClause: () => { charInClause = 0; },
    formatChar: (char, isHighlight = false) => {
      const count = charOccurMap.get(char) || 0;
      charOccurMap.set(char, count + 1);
      const seq = chineseCharSeq++;
      charInClause++;

      const charCode = char.charCodeAt(0);
      const r1 = hash32(charCode, seq, count, 101);
      const r2 = hash32(charCode, seq, count, 203);
      const r3 = hash32(charCode, seq, count, 307);
      const r4 = hash32(charCode, seq, count, 409);
      const r5 = hash32(charCode, seq, count, 521);

      // 1. 同字异构化：6 套姿态骨架轮换
      const profile = profiles[count % 6];

      // 2. 字体大小变化显著放大：骨架缩放 + ±10% 随机缩放
      const scaleJitter = 1.0 + (r1 - 0.5) * 0.20;
      const finalScaleX = (profile.sx * scaleJitter).toFixed(3);
      const finalScaleY = (profile.sy * scaleJitter).toFixed(3);

      // 3. 文字旋转幅度显著放大：骨架倾斜 + ±3.2° 随机偏角
      const tiltNoise = (r2 - 0.5) * 6.4;
      const finalTilt = (profile.tilt + tiltNoise).toFixed(2);

      // 4. 双轴切变 (SkewX & SkewY)
      const skewNoiseX = (r3 - 0.5) * 3.0;
      const finalSkewX = (profile.skewX + skewNoiseX).toFixed(2);
      const finalSkewY = (profile.skewY + (r4 - 0.5) * 1.5).toFixed(2);

      // 5. 上下浮动大幅放大：行进宏观波浪 + 字符随机微抖，范围达 ±5.5px
      const wave = Math.sin(seq * 0.38 + 0.5) * 2.5 + Math.cos(seq * 0.72) * 1.5;
      const microJitter = (r5 - 0.5) * 3.5;
      const deltaY = (wave + microJitter).toFixed(2);

      // 6. 字距自然松紧
      const marginR = ((r1 - 0.45) * 2.8).toFixed(2);
      const marginL = ((r2 - 0.5) * 1.4).toFixed(2);

      // 7. 句子宏观深浅与下笔浓淡波动 (Writing Pressure & Ink Density)
      const clauseWave = Math.sin((charInClause % 14) / 14 * Math.PI) * 0.16;
      let pressure = 0.88 + profile.dP + clauseWave + (r3 - 0.5) * 0.14;
      pressure = Math.max(0.68, Math.min(1.04, pressure));

      const opacity = Math.min(1.0, 0.74 + pressure * 0.26).toFixed(2);

      // 8. 字内笔画粗细变化 (Calligraphic Nib Angle & Directional Shading)
      const penRad = (profile.penAng + (r4 - 0.5) * 16) * Math.PI / 180;
      const effectiveWeight = profile.penW * (pressure / 0.88);
      const dx = (Math.cos(penRad) * effectiveWeight).toFixed(2);
      const dy = (Math.sin(penRad) * effectiveWeight).toFixed(2);

      let strokeCSS = '';
      const totalStroke = profile.stroke * pressure;
      if (totalStroke > 0.05) {
        strokeCSS = `-webkit-text-stroke: ${totalStroke.toFixed(2)}px currentColor;`;
      }

      // 纸张纤维微洇漫墨 (随墨量动态调节扩散光晕)
      let shadowCSS = '';
      if (isHighlight) {
        const bleed1 = (0.35 + pressure * 0.25).toFixed(2);
        const bleed2 = (0.80 + pressure * 0.40).toFixed(2);
        shadowCSS = `text-shadow: ${dx}px ${dy}px 0.2px currentColor, 0 0 ${bleed1}px rgba(211, 47, 47, 0.55), 0 0 ${bleed2}px rgba(211, 47, 47, 0.22);`;
      } else {
        const bleed1 = (0.35 + pressure * 0.25).toFixed(2);
        const bleed2 = (0.80 + pressure * 0.40).toFixed(2);
        const inkAlpha = (0.35 + pressure * 0.25).toFixed(2);
        shadowCSS = `text-shadow: ${dx}px ${dy}px 0.2px currentColor, 0 0 ${bleed1}px rgba(22, 24, 28, ${inkAlpha}), 0 0 ${bleed2}px rgba(22, 24, 28, 0.16);`;
      }

      // 句子内部深浅浓淡渐变
      let colorCSS = '';
      if (isHighlight) {
        const redR = Math.round(180 + (1.04 - pressure) * 45);
        const redG = Math.round(25 + (1.04 - pressure) * 35);
        const redB = Math.round(25 + (1.04 - pressure) * 35);
        colorCSS = `color: rgb(${redR}, ${redG}, ${redB}) !important;`;
      } else {
        const gray = Math.round(8 + (1.04 - pressure) * 42);
        colorCSS = `color: rgb(${gray}, ${gray + 2}, ${gray + 6}) !important;`;
      }

      const transform = `transform: translateY(${deltaY}px) rotate(${finalTilt}deg) scale(${finalScaleX}, ${finalScaleY}) skew(${finalSkewX}deg, ${finalSkewY}deg);`;

      return `<span class="f1 organic-char" style="display:inline-block; vertical-align:baseline; font-size:1.5em; line-height:21px !important; margin-right:${marginR}px; margin-left:${marginL}px; opacity:${opacity}; ${colorCSS} ${strokeCSS} ${shadowCSS} ${transform}">${char}</span>`;
    }
  };
}

/**
 * 核心排版引擎 (V2 拟真手写版 - Organic Typesetting Engine)
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

  // 核心功能点：在解析开始前，将所有的数字 1 替换为小写字母 l
  text = text.replace(/1/g, 'l');

  onProgress({ stage: 'preprocessing', message: '正在进行文本预处理与拟真分词...' });
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

  // ========== 汉字专属拟真有机打散引擎 ==========
  const organicEngine = createOrganicChineseCharGenerator();
  const tokenRegex = /(<[^>]+>)|(\$\$[\s\S]*?\$\$|\$[^$]*?\$)|([\s\S])/g;
  let randomizedText = '';
  let match;
  let isHighlight = false;
  while ((match = tokenRegex.exec(htmlText)) !== null) {
    if (match[1]) {
      const tag = match[1];
      if (/class=["'][^"']*highlight[^"']*["']/.test(tag)) {
        isHighlight = true;
      } else if (/<\/span>/i.test(tag)) {
        isHighlight = false;
      }
      if (/<br\s*\/?>/i.test(tag)) {
        organicEngine.resetClause();
      }
      randomizedText += tag;
    } else if (match[2]) {
      randomizedText += match[2]; // 公式区域原样放行，交由后续 KaTeX 渲染（完全保持原样）
    } else if (match[3]) {
      let char = match[3];
      if (/[，。、；：？！,.;:?!]/.test(char)) {
        organicEngine.resetClause();
      }
      if (char.trim() === '' || char === '\n') {
        randomizedText += char;
      } else {
        if (/[\u4e00-\u9fa5]/.test(char)) {
          // 【核心】：仅汉字应用拟真手写扰动（基线浮动、倾斜、大小微差、字距松紧、同字异构、微洇）
          randomizedText += organicEngine.formatChar(char, isHighlight);
        } else {
          // 【核心】：非汉字（英文字母、数字、西文标点）严格沿用原方法不变！
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

  // ========== 使用 html2canvas 输出 A4 高清位图 ==========
  const results = [];
  for (let i = 0; i < pages.length; i++) {
    onProgress({
      stage: 'rendering',
      message: `正在生成拟真手写 A4 视网膜图片 (第 ${i + 1} / ${pages.length} 页)...`,
      current: i + 1,
      total: pages.length
    });

    const canvas = await html2canvas(pages[i], {
      scale: 2,
      backgroundColor: '#fbf9f4',
      useCORS: true,
      logging: false
    });

    const dataUrl = canvas.toDataURL('image/jpeg', 0.98);
    results.push({
      dataUrl,
      pageIndex: i + 1,
      width: canvas.width,
      height: canvas.height
    });
  }

  // 释放离线 DOM 内存
  captureZone.innerHTML = '';

  onProgress({ stage: 'completed', message: '拟真手写排版全部完成！' });
  return results;
}
