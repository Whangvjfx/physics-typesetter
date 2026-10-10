import html2canvas from 'html2canvas';
import katex from 'katex';
import renderMathInElement from 'katex/contrib/auto-render';

/**
 * 计算 KaTeX 公式真实的可视包围盒（所有 .base 片段的并集）
 */
function mathBox(el) {
  const parts = el.querySelectorAll('.katex-html > .base, .katex-html > .tag, .katex-html > .katex-base');
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
 * 汉字专属：非线性动力学真手写形变引擎 (Nonlinear Dynamics Chinese Handwriting Engine)
 * 仅对汉字生效，公式、英文字母、数字和标点完全保持原样不变。
 * 
 * 核心创新：打破全局仿射线性变换限制，引入空间透视逆射投射、偏心极点漂移、混沌相移谐波及字内墨压梯度：
 * 
 * 1. 空间透视逆射变换 (3D Projective Homography Warp):
 *    通过 perspective(d) + rotateX(rx) + rotateY(ry) + rotateZ(rz) 生成非线性 2D 投影。
 *    在笛卡尔坐标系中，局部变换率随坐标 (x, y) 空间位置非均匀变化（倒梯形、正梯形、不对称楔形收展），
 *    使得同一汉字的上部与下部、左部与右部具有完全不同的形变率，彻底打破平行线约束！
 * 
 * 2. 偏心极点漂移 (Eccentric Transform-Origin Drift):
 *    动态偏离中心 50% 50%，模拟执笔支点随笔势在字形左上/右下/中心的动态转移。
 * 
 * 3. 混沌相移多频谐波行气 (Chaotic Multi-Harmonic Baseline Drift):
 *    引入非周期性谐波耦合，消除周期性波浪假感。
 * 
 * 4. 8套非线性动力学异构形态骨架 (8 Non-linear Structural Profiles):
 *    涵盖：稳正中和、俯势倒梯、仰势正梯、左欹敛势、右拓连笔、纵拔挺峰、横张宽博、微倚侧峰。
 * 
 * 5. 全动态可调参数 (nonlinearIntensity):
 *    0.0 (完全平正无透视形变) ~ 1.0 (极富张力的非线性书法态)，默认 0.60。
 */
function createNonlinearChineseCharGenerator(nonlinearIntensity = 0.60) {
  const K = Math.max(0.0, Math.min(1.0, Number(nonlinearIntensity) ?? 0.60));
  const charOccurMap = new Map();
  let chineseCharSeq = 0;
  let charInClause = 0;

  // 8 套张弛有度、非线性空间投影骨架 (涵盖倒梯形、正梯形、不对称楔形收放，大幅强化动态张力)
  const profiles = [
    // 0: 稳正中和态 (基准适中，轻微正向右倾)
    { sx: 1.00, sy: 1.00, rotX: 2.0, rotY: -1.5, rotZ: 2.5, skew: -1.0, stroke: 0.10, dP: 0.00, pDist: 280, ox: 50, oy: 50 },
    // 1: 俯势倒梯态 (上宽下敛，倒梯形透视收窄，下笔沉实)
    { sx: 1.15, sy: 0.88, rotX: 26.0, rotY: -8.0, rotZ: 2.0, skew: -3.2, stroke: 0.25, dP: 0.08, pDist: 150, ox: 55, oy: 78 },
    // 2: 仰势正梯态 (下盘拓开，上部聚气，正梯形透视)
    { sx: 0.88, sy: 1.15, rotX: -24.0, rotY: 8.0, rotZ: 5.5, skew: -0.6, stroke: 0.02, dP: -0.05, pDist: 160, ox: 45, oy: 22 },
    // 3: 左欹修长态 (左侧挺拔，右侧微虚，左高右低楔形)
    { sx: 0.86, sy: 1.16, rotX: -8.0, rotY: -20.0, rotZ: 7.0, skew: -4.0, stroke: 0.04, dP: -0.04, pDist: 170, ox: 28, oy: 50 },
    // 4: 右拓纵逸态 (右肩放开，顺势疾书，右高左低楔形)
    { sx: 1.16, sy: 0.90, rotX: 12.0, rotY: 19.0, rotZ: 7.5, skew: -4.5, stroke: 0.20, dP: -0.01, pDist: 160, ox: 72, oy: 50 },
    // 5: 凝敛小核态 (内聚紧凑，清秀端方，微左依)
    { sx: 0.84, sy: 0.86, rotX: -5.0, rotY: -4.0, rotZ: -1.8, skew: -0.5, stroke: 0.08, dP: -0.06, pDist: 260, ox: 50, oy: 42 },
    // 6: 横张雄浑态 (字势宽扁，骨力充沛)
    { sx: 1.20, sy: 0.84, rotX: 18.0, rotY: -13.0, rotZ: 1.5, skew: -2.8, stroke: 0.24, dP: 0.07, pDist: 180, ox: 58, oy: 70 },
    // 7: 侧峰凌虚态 (斜势取险，体态灵动)
    { sx: 0.90, sy: 1.12, rotX: -16.0, rotY: 15.0, rotZ: 6.0, skew: -2.2, stroke: 0.14, dP: 0.02, pDist: 190, ox: 38, oy: 32 }
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
      const r6 = hash32(charCode, seq, count, 631);

      // 1. 同字异形轮转 (8套骨架，同字出现时大相径庭)
      const profile = profiles[count % 8];

      // 2. 尺度长宽比非线性缩放 (大幅放大，受 K 调控)
      const scaleJitter = 1.0 + (r1 - 0.5) * (0.24 * K);
      const finalScaleX = (profile.sx * (1.0 + (profile.sx - 1.0) * K * 0.5) * scaleJitter).toFixed(3);
      const finalScaleY = (profile.sy * (1.0 + (profile.sy - 1.0) * K * 0.5) * scaleJitter).toFixed(3);

      // 3. 3D 空间透视逆射参数 (核心创新：生成倒梯形、正梯形、斜切不等边梯形，K=1 时大幅拉满)
      const rxNoise = (r2 - 0.5) * 8.0 * K;
      const finalRotX = ((profile.rotX + rxNoise) * K).toFixed(2);

      const ryNoise = (r3 - 0.5) * 7.5 * K;
      const finalRotY = ((profile.rotY + ryNoise) * K).toFixed(2);

      // 4. 自然右手执笔主轴旋转
      const rzNoise = (r4 - 0.5) * 4.0 * K;
      const finalRotZ = (profile.rotZ + rzNoise).toFixed(2);

      // 5. 偏心极点漂移 (支点离开绝对中心)
      const originX = (profile.ox + (profile.ox - 50) * K * 0.4 + (r5 - 0.5) * 20 * K).toFixed(1);
      const originY = (profile.oy + (profile.oy - 50) * K * 0.4 + (r6 - 0.5) * 20 * K).toFixed(1);

      // 6. 透视景深距离 (越小倒梯/正梯畸变越剧烈，K=1 时低至 90px~150px)
      const pDist = Math.max(90, Math.round(profile.pDist - K * 75 + (r1 - 0.5) * 30));

      // 7. 顺势微倾斜
      const skewNoise = (r3 - 0.5) * 1.6 * K;
      const finalSkewX = (profile.skew + skewNoise).toFixed(2);

      // 8. 【基线与字距完全解耦】：无论 K 调多大，基线与字距严格保持在 60px 格线安全区间内！
      const wave1 = Math.sin(seq * 0.35 + 0.4) * 1.5;
      const wave2 = Math.sin(Math.pow(seq, 1.18) * 0.18 + 0.9) * 0.6;
      const microJitter = (r4 - 0.5) * 1.5;
      const deltaY = (wave1 + wave2 + microJitter).toFixed(2);

      // 9. 字距呼吸微调 (独立解耦，保持自然呼吸)
      const marginR = ((r1 - 0.42) * 1.4).toFixed(2);
      const marginL = ((r2 - 0.5) * 0.8).toFixed(2);

      // 10. 句子下笔深浅浓淡波动
      const clauseWave = Math.sin((charInClause % 12) / 12 * Math.PI) * 0.10;
      let pressure = 0.92 + profile.dP * K + clauseWave + (r3 - 0.5) * 0.08 * K;
      pressure = Math.max(0.82, Math.min(1.05, pressure));

      const opacity = Math.min(1.0, 0.86 + pressure * 0.14).toFixed(2);

      // 11. 笔画轮廓粗细微调
      let strokeCSS = '';
      const currentStroke = profile.stroke * (0.5 + 0.5 * K);
      if (currentStroke > 0.02) {
        strokeCSS = `-webkit-text-stroke: ${currentStroke.toFixed(2)}px currentColor;`;
      }

      // 12. 非线性不对称纸张微洇与毛细渗透效果 (阴影方向根据笔势动态不对称漂移)
      const shadowDx = ((r5 - 0.5) * 0.45 * K).toFixed(2);
      const shadowDy = ((r6 - 0.5) * 0.45 * K).toFixed(2);
      let shadowCSS = '';
      if (isHighlight) {
        shadowCSS = `text-shadow: ${shadowDx}px ${shadowDy}px 0.40px rgba(211, 47, 47, 0.52), 0 0 0.80px rgba(211, 47, 47, 0.16);`;
      } else {
        shadowCSS = `text-shadow: ${shadowDx}px ${shadowDy}px 0.40px rgba(18, 20, 24, 0.45), 0 0 0.80px rgba(18, 20, 24, 0.14);`;
      }

      // 墨色深浅浓淡 (深黑至润墨自然过渡)
      let colorCSS = '';
      if (isHighlight) {
        const redR = Math.round(195 + (1.05 - pressure) * 28);
        const redG = Math.round(35 + (1.05 - pressure) * 22);
        const redB = Math.round(35 + (1.05 - pressure) * 22);
        colorCSS = `color: rgb(${redR}, ${redG}, ${redB}) !important;`;
      } else {
        const gray = Math.round(14 + (1.05 - pressure) * 26);
        colorCSS = `color: rgb(${gray}, ${gray + 2}, ${gray + 5}) !important;`;
      }

      // 核心：若 K > 0.05 则引入 perspective 3D 透视逆射非线性形变，若 K 近似 0 则平正退化
      let transform;
      let originCSS = `transform-origin: ${originX}% ${originY}%;`;
      if (K > 0.05) {
        transform = `transform: perspective(${pDist}px) rotateX(${finalRotX}deg) rotateY(${finalRotY}deg) rotateZ(${finalRotZ}deg) translateY(${deltaY}px) scale(${finalScaleX}, ${finalScaleY}) skewX(${finalSkewX}deg);`;
      } else {
        transform = `transform: translateY(${deltaY}px) rotate(${finalRotZ}deg) scale(${finalScaleX}, ${finalScaleY}) skewX(${finalSkewX}deg);`;
      }

      return `<span class="f1 organic-char" style="display:inline-block; vertical-align:baseline; font-size:1.5em; line-height:21px !important; margin-right:${marginR}px; margin-left:${marginL}px; opacity:${opacity}; ${colorCSS} ${strokeCSS} ${shadowCSS} ${originCSS} ${transform}">${char}</span>`;
    }
  };
}

// 兼容别名
const createOrganicChineseCharGenerator = createNonlinearChineseCharGenerator;

/**
 * 核心排版引擎 (V2 拟真手写版 - Organic Typesetting Engine)
 */
export async function generateTypesetImages({
  rawText,
  pastedImageSrc = null,
  imageWidth = 250,
  nonlinearIntensity = 0.60,
  captureZone,
  onProgress = () => {},
  onLayout = null
}) {
  let text = (rawText || '').trim();
  if (!text && !pastedImageSrc) {
    throw new Error('请先粘贴解析文本或上传图片！');
  }

  // 1. 标准化各种 AI 输出的标红语法变体 (\textcolor{red}{...}, \red{...})
  text = text
    .replace(/\\textcolor\{red\}\{([^}]*)\}/g, '<red>$1</red>')
    .replace(/\\red\{([^}]*)\}/g, '<red>$1</red>');

  // 2. 深度解决 <red> 与数学公式 $...$ / $$...$$ 重叠冲突：
  // 将公式内部的 <red> 标签提炼提升到公式外部，确保 KaTeX 永远只接收纯净的标准 LaTeX 代码
  text = text.replace(/(\$\$[\s\S]*?\$\$|\$[^$]*?\$)/g, (formula) => {
    const isDisplay = formula.startsWith('$$');
    const delim = isDisplay ? '$$' : '$';
    const inner = isDisplay ? formula.slice(2, -2) : formula.slice(1, -1);

    if (inner.includes('<red>') || inner.includes('</red>')) {
      const fullMatch = inner.match(/^\s*<red>([\s\S]*?)<\/red>\s*$/);
      if (fullMatch) {
        return `<red>${delim}${fullMatch[1]}${delim}</red>`;
      }
      const parts = inner.split(/(<red>[\s\S]*?<\/red>)/g);
      return parts.map(p => {
        if (p.startsWith('<red>')) {
          const redInner = p.slice(5, -6);
          return `<red>${delim}${redInner}${delim}</red>`;
        }
        return p.trim() ? `${delim}${p}${delim}` : '';
      }).join('');
    }
    return formula;
  });

  // 3. 全面支持在普通文本中直接书写的 LaTeX 数学与希腊符号，转义为 Unicode 字符
  // 防止在普通文本中书写 \neq, \alpha 时被当成换行符或损坏
  const plainTextSymbolMap = [
    [/\\neq\b/g, '≠'],
    [/\\ne\b/g, '≠'],
    [/\\leq\b/g, '≤'],
    [/\\le\b/g, '≤'],
    [/\\geq\b/g, '≥'],
    [/\\ge\b/g, '≥'],
    [/\\pm\b/g, '±'],
    [/\\mp\b/g, '∓'],
    [/\\times\b/g, '×'],
    [/\\div\b/g, '÷'],
    [/\\approx\b/g, '≈'],
    [/\\sim\b/g, '∼'],
    [/\\propto\b/g, '∝'],
    [/\\infty\b/g, '∞'],
    [/\\degree\b/g, '°'],
    [/\\circ\b/g, '°'],
    [/\\alpha\b/g, 'α'],
    [/\\beta\b/g, 'β'],
    [/\\gamma\b/g, 'γ'],
    [/\\delta\b/g, 'δ'],
    [/\\theta\b/g, 'θ'],
    [/\\lambda\b/g, 'λ'],
    [/\\mu\b/g, 'μ'],
    [/\\pi\b/g, 'π'],
    [/\\rho\b/g, 'ρ'],
    [/\\sigma\b/g, 'σ'],
    [/\\tau\b/g, 'τ'],
    [/\\phi\b/g, 'ϕ'],
    [/\\omega\b/g, 'ω'],
    [/\\Delta\b/g, 'Δ'],
    [/\\Omega\b/g, 'Ω']
  ];

  let mathParts = text.split(/(\$\$[\s\S]*?\$\$|\$[^$]*?\$)/g);
  for (let i = 0; i < mathParts.length; i++) {
    if (!mathParts[i].startsWith('$')) {
      for (const [reg, sym] of plainTextSymbolMap) {
        mathParts[i] = mathParts[i].replace(reg, sym);
      }
      mathParts[i] = mathParts[i].replace(/\\\\/g, '【MANUAL_BR】').replace(/\\/g, '【MANUAL_BR】');
    }
  }
  let safeText = mathParts.join('');

  // 4. 数字 1 转小写字母 l (遵循原项目设定)
  safeText = safeText.replace(/1/g, 'l');

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

  // ========== 汉字专属非线性动力学打散引擎 ==========
  const organicEngine = createNonlinearChineseCharGenerator(nonlinearIntensity);
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
        } else if (/[≠≤≥≈±×÷∝∞°′″∠△⊥∈∑∫√~]/.test(char)) {
          // 【核心】：物理数学运算符与特殊符号，保留原生符号字体渲染
          randomizedText += `<span class="f1 math-sym" style="font-family:'KaTeX_Main', 'Caveat', 'HandwritingGreek', 'MyHandwriting', sans-serif; font-size:1.35em; line-height:21px !important; vertical-align:baseline; color:inherit;">${char}</span>`;
        } else {
          // 【核心】：非汉字（希腊字母、英文字母、数字、西文标点）无缝调用 Caveat + HandwritingGreek 手写体
          randomizedText += `<span class="f1" style="font-family:'Caveat', 'HandwritingGreek', 'MyHandwriting', sans-serif; font-size:1.35em; line-height:21px !important; color:inherit;">${char}</span>`;
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
