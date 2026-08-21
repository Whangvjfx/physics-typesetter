import html2canvas from 'html2canvas';
import katex from 'katex';
import renderMathInElement from 'katex/contrib/auto-render';

/**
 * 核心排版引擎 (Strictly preserved V42 typesetting logic)
 * @param {Object} options
 * @param {string} options.rawText 待排版的原始解析文本
 * @param {string|null} options.pastedImageSrc 配图 Base64 或 URL
 * @param {number} options.imageWidth 配图宽度 (px)
 * @param {HTMLElement} options.captureZone 用于离线渲染 DOM 的容器
 * @param {Function} [options.onProgress] 进度回调函数
 * @returns {Promise<Array<{dataUrl: string, blob: Blob, pageIndex: number}>>} 生成的图片数组
 */
export async function generateTypesetImages({
  rawText,
  pastedImageSrc = null,
  imageWidth = 250,
  captureZone,
  onProgress = () => {}
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

  const masterBox = document.createElement('div');
  masterBox.id = 'master-box';

  if (/android/i.test(navigator.userAgent)) {
    masterBox.classList.add('android-fix');
  }

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
  await new Promise(resolve => setTimeout(resolve, 200));

  masterBox.querySelectorAll('img').forEach(img => {
    if (!img.classList.contains('uploaded-float')) {
      img.style.verticalAlign = 'middle';
    }
  });

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

  const totalHeight = masterBox.offsetHeight;
  if (totalHeight === 0) throw new Error('文本处理异常，未检测到有效内容高度。');

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

    let pageDiv = document.createElement('div');
    pageDiv.className = 'page-container';

    let contentWrapper = document.createElement('div');
    contentWrapper.style.height = contentDisplayHeight + 'px';
    contentWrapper.style.overflow = 'hidden';

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
