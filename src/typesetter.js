import html2canvas from 'html2canvas';
import katex from 'katex';
import renderMathInElement from 'katex/contrib/auto-render';

/**
 * 显式预加载并解码所有变体手写字体与依赖字体，确保离线环境和 html2canvas 绝对使用真实手写字形
 */
export async function preloadHandwritingFonts() {
  const requiredFonts = [
    '21px MyHandwriting',
    '21px MyHandwriting-Var1',
    '21px MyHandwriting-Var2',
    '21px MyHandwriting-Var3',
    '21px MyHandwriting-Var4',
    '21px MyHandwriting-Var5',
    '21px Caveat',
    '21px HandwritingGreek'
  ];
  try {
    await Promise.all(requiredFonts.map(f => document.fonts.load(f)));
  } catch (err) {
    console.warn('Font preload warning:', err);
  }
  await document.fonts.ready;
}

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
 * 【手写根号美化核心】将 KaTeX 机械生硬的多边形根号，替换为自然流畅的手写笔画路径
 */
function beautifyRadicals(root) {
  const sqrtSvgs = root.querySelectorAll('.katex .sqrt .hide-tail svg');
  sqrtSvgs.forEach(svg => {
    const viewBox = svg.getAttribute('viewBox');
    if (!viewBox) return;
    const parts = viewBox.trim().split(/\s+/).map(Number);
    if (parts.length < 4) return;
    const H = parts[3];
    if (!H || isNaN(H)) return;

    const path = svg.querySelector('path');
    if (!path) return;

    // 为每个根号注入微弱的真实书写随机性（笔尖入笔高度与转折起伏）
    const r1 = (Math.random() - 0.5) * 8;
    const r2 = (Math.random() - 0.5) * 6;
    const topY = Math.round(92 + r1);
    const bottomY = Math.round(H - 42 + r2);
    const startY = Math.round(H * 0.56 + r1 * 1.5);

    // 优雅自然的人手执笔连贯路径：
    // 起笔微带下顿 -> 顺势向右下运笔触底 -> 顿笔回折强力上挑 -> 翻腕过渡进入横向延伸上横线
    const d = `M 220,${startY} ` +
      `Q 280,${Math.round(startY + 35)} 355,${Math.round(H * 0.76)} ` +
      `T 450,${bottomY} ` +
      `Q 475,${bottomY} 530,${Math.round(H * 0.78)} ` +
      `T 985,${topY} ` +
      `Q 1025,${topY - 6} 1090,${topY} ` +
      `L 400000,${topY}`;

    path.setAttribute('d', d);
    path.style.setProperty('fill', 'none', 'important');
    path.style.setProperty('stroke', 'currentColor', 'important');
    path.style.setProperty('stroke-width', '42px', 'important');
    path.style.setProperty('stroke-linecap', 'round', 'important');
    path.style.setProperty('stroke-linejoin', 'round', 'important');
  });
}

/**
 * 【手写分数线优化】全平台与 html2canvas 绝对可见的真实 CSS 描边与手写微倾
 * 严禁使用动态 SVG 注入（html2canvas 无法稳定光栅化零高度行内 SVG 导致分数线缺失）
 * 严格保持零高度包裹，绝不干扰 60px 行高布局
 */
function beautifyFractionLines(root) {
  const fracLines = root.querySelectorAll('.katex .frac-line');
  if (!fracLines.length) return;

  fracLines.forEach((fl) => {
    // 彻底清除旧版本遗留的 SVG，防止渲染黑块或空节点
    const oldSvg = fl.querySelector('svg');
    if (oldSvg) oldSvg.remove();
    fl.classList.remove('handwritten-frac');

    // 严禁旋转倾斜，严禁 display: block（html2canvas 下 block 会导致分数线严重下坠压迫分母字符）
    // 保持原生 inline-block，确保分数线水平、平直、清晰可见且绝对不与分母干涉
    fl.style.setProperty('border-bottom-style', 'solid', 'important');
    fl.style.setProperty('border-bottom-width', '1.2px', 'important');
    fl.style.setProperty('border-bottom-color', 'currentColor', 'important');
    fl.style.setProperty('display', 'inline-block', 'important');
    fl.style.setProperty('opacity', '0.95', 'important');
    fl.style.removeProperty('border-radius');
    fl.style.removeProperty('transform');
    fl.style.removeProperty('transform-origin');
  });
}

/**
 * 【行级宏观书写流与行尾挤压】(Macro Line Flow & Right-Margin Cramping)
 * 1. 计算视觉行并在行内沿推进方向施加低频连贯基线微波 (振幅严格 <= 2.0px)
 * 2. 行尾边界心理挤压 (t > 0.82 渐进式微缩字距与展弦比，模拟人手临近右边界时的紧缩感)
 * 严格保持 zero layout box impact，所有偏移仅通过 transform 与 margin 实现，绝不改动 60px 行高
 */
function applyMacroLineDynamics(root, nonlinearIntensity = 0.60) {
  const K = Math.max(0.0, Math.min(1.0, Number(nonlinearIntensity) ?? 0.60));
  if (K <= 0.05) return;

  const chars = Array.from(root.querySelectorAll('.organic-char'));
  if (chars.length < 2) return;

  const rootRect = root.getBoundingClientRect();
  const charData = chars.map(el => {
    const r = el.getBoundingClientRect();
    return {
      el,
      left: r.left - rootRect.left,
      top: r.top - rootRect.top,
      width: r.width,
      height: r.height
    };
  });

  charData.sort((a, b) => a.top - b.top || a.left - b.left);

  const lines = [];
  let currentLine = [];
  let currentLineTop = -9999;

  charData.forEach(item => {
    if (Math.abs(item.top - currentLineTop) > 20) {
      if (currentLine.length > 0) {
        currentLine.sort((a, b) => a.left - b.left);
        lines.push(currentLine);
      }
      currentLine = [item];
      currentLineTop = item.top;
    } else {
      currentLine.push(item);
    }
  });
  if (currentLine.length > 0) {
    currentLine.sort((a, b) => a.left - b.left);
    lines.push(currentLine);
  }

  lines.forEach((lineChars, lineIdx) => {
    if (lineChars.length < 3) return;

    const minX = lineChars[0].left;
    const maxX = lineChars[lineChars.length - 1].left;
    const lineWidth = Math.max(80, maxX - minX);

    const theta1 = (lineIdx * 1.73 + 0.5) % (Math.PI * 2);
    const theta2 = (lineIdx * 2.41 + 1.2) % (Math.PI * 2);

    lineChars.forEach(item => {
      const t = Math.max(0.0, Math.min(1.0, (item.left - minX) / lineWidth));

      const rawWave = 1.2 * Math.sin(Math.PI * t + theta1) + 0.6 * Math.sin(2 * Math.PI * t + theta2);
      const deltaYWave = Math.max(-2.0, Math.min(2.0, rawWave * K));

      let crampScaleX = 1.0;
      let crampMarginR = 0.0;
      if (t > 0.82) {
        const u = (t - 0.82) / 0.18;
        crampMarginR = - (0.85 * K * u);
        crampScaleX = 1.0 - (0.045 * K * u);
      }

      const existingTransform = item.el.style.transform || '';
      let newTransform = existingTransform;
      if (existingTransform.includes('translateY(')) {
        newTransform = existingTransform.replace(/translateY\(([-0-9.]+)px\)/, (match, val) => {
          const combinedY = (parseFloat(val) + deltaYWave).toFixed(2);
          return `translateY(${combinedY}px)`;
        });
      } else {
        newTransform += ` translateY(${deltaYWave.toFixed(2)}px)`;
      }

      if (crampScaleX < 0.999) {
        newTransform += ` scaleX(${crampScaleX.toFixed(3)})`;
      }

      item.el.style.transform = newTransform;

      if (crampMarginR < -0.01) {
        const curMR = parseFloat(item.el.style.marginRight) || 0;
        item.el.style.marginRight = (curMR + crampMarginR).toFixed(2) + 'px';
      }
    });
  });
}

/**
 * 【纸张纤维毛细墨迹扩散滤镜】微观纸张物理质感
 */
function ensureInkBleedFilter(container, nonlinearIntensity = 0.60) {
  const K = Math.max(0.0, Math.min(1.0, Number(nonlinearIntensity) ?? 0.60));
  let filterSvg = document.getElementById('ink-bleed-defs');
  if (K <= 0.05) {
    if (filterSvg) filterSvg.remove();
    return;
  }
  if (!filterSvg) {
    filterSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    filterSvg.id = 'ink-bleed-defs';
    filterSvg.style.cssText = 'position:absolute; width:0; height:0; overflow:hidden; pointer-events:none;';
    filterSvg.innerHTML = `
      <defs>
        <filter id="handwriting-ink-bleed" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="${(0.32 * K).toFixed(2)}" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    `;
    container.insertBefore(filterSvg, container.firstChild);
  } else {
    const disp = filterSvg.querySelector('feDisplacementMap');
    if (disp) disp.setAttribute('scale', (0.32 * K).toFixed(2));
  }
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
/**
 * 汉字专属：物理运笔惯性与连续流形非线性动力学真手写形变引擎 (Kinematic Inertia Nonlinear Chinese Handwriting Engine)
 * 仅对汉字生效，公式、英文字母、数字和标点完全保持原样不变。
 * 
 * 核心创新与物理约束：
 * 1. 物理运笔惯性与平滑连续流场 (Continuous Kinematic Flow):
 *    人在书写时，手腕的肌肉状态、手指伸缩与笔尖倾角具备物理动量，
 *    相邻字的变化由多频宏观连续波 (波长约 12~24 字) 驱动，并经过一阶惯性阻尼滤波 (Exponential Momentum Smoothing)
 *    和单步最大速率限制器 (Slew Rate Limiter)，绝对杜绝“相邻两字一个巨大一个极小、或一个矮胖一个瘦长”的突兀跳变！
 * 
 * 2. 宏观多字形态显著演化 (Significant Multi-Character Progression):
 *    在保证相邻字平滑渐变的前提下，随书写序列流动推进 3~5 字，整体形态在尺寸、宽扁/挺秀、
 *    3D 空间透视（正梯形/倒梯形/斜切梯形）及倾斜度上展开明显且富有张力的书法演化。
 * 
 * 3. 叠字与重字书法异构呼应 (Homomorphic Repetition Decoupling):
 *    当相同字符连续出现或重现时，注入平滑的互补笔势相移，打破千篇一律，但视觉体量依然与上下文连续协调。
 * 
 * 4. 视觉面积守恒伸缩 (Equal-Area Aspect Stretching):
 *    采用 scaleX = size * sqrt(aspect), scaleY = size / sqrt(aspect)，
 *    在改变宽扁/修长的同时保持字形视觉面积守恒，杜绝因变形引起的忽大忽小感。
 * 
 * 5. 全动态可调参数 (nonlinearIntensity):
 *    0.0 (完全平正无透视形变) ~ 1.0 (极富张力的非线性书法态)，默认 0.60。
 */
function createNonlinearChineseCharGenerator(nonlinearIntensity = 0.60) {
  const K = Math.max(0.0, Math.min(1.0, Number(nonlinearIntensity) ?? 0.60));
  const charOccurMap = new Map();
  const charTabuMap = new Map();   // 单字历史禁忌队列 (容量 4)
  const globalRecentQueue = [];     // 全局紧邻字形禁忌队列 (容量 3)
  let chineseCharSeq = 0;
  let charInClause = 0;
  let prevChar = '';

  // 物理惯性运笔连续状态机
  let state = {
    size: 1.0,
    aspect: 1.0,    // >1 略宽展，<1 略挺秀
    rotX: 0.0,      // 3D 俯仰透视 (倒梯形/正梯形)
    rotY: 0.0,      // 3D 偏转透视 (左窄右展/右窄左展)
    rotZ: 2.0 * K,  // 右手主轴自然倾斜随 K 自适应 (K=0 时为 0)
    skew: -1.0 * K, // 顺势剪切随 K 自适应 (K=0 时为 0)
    ox: 50.0,       // 偏心支点 X
    oy: 50.0,       // 偏心支点 Y
    pDist: 220,     // 透视景深
    pressure: 0.94  // 下笔力度
  };

  const clampDelta = (curr, prev, limit) => {
    const d = curr - prev;
    if (Math.abs(d) > limit) {
      return prev + Math.sign(d) * limit;
    }
    return curr;
  };

  return {
    resetClause: () => {
      charInClause = 0;
    },
    formatChar: (char, isHighlight = false) => {
      const count = charOccurMap.get(char) || 0;
      charOccurMap.set(char, count + 1);
      const seq = chineseCharSeq++;
      charInClause++;

      // 1. 多频宏观低频波：驱动字势在句子与段落中的舒卷流动 (周期 12 ~ 26 字，超平滑导数有界)
      const waveSize = Math.sin(seq * 0.28 + 0.7) * 0.70 + Math.sin(seq * 0.11 + 2.1) * 0.30;
      let targetSize = 1.0 + waveSize * (0.048 * K);

      const waveAspect = Math.cos(seq * 0.24 + 1.4) * 0.65 + Math.sin(seq * 0.09 + 0.5) * 0.35;
      let targetAspect = 1.0 + waveAspect * (0.072 * K);

      const waveRotX = Math.sin(seq * 0.22 + 1.8) * 0.75 + Math.cos(seq * 0.49 + 0.7) * 0.25;
      let targetRotX = waveRotX * (26.0 * K);

      const waveRotY = Math.cos(seq * 0.19 + 0.8) * 0.75 + Math.sin(seq * 0.43 + 2.1) * 0.25;
      let targetRotY = waveRotY * (20.0 * K);

      // 【核心升级】：转动幅度随滑块 K 显著放大联动！
      // 复合多频手腕运笔旋转波 (主频周期约 12~18 字，副频波澜周期约 4~6 字)
      const waveRotZ = Math.sin(seq * 0.27 + 0.4) * 0.72 + Math.sin(seq * 0.58 + 1.9) * 0.28;
      const rotZBase = 2.6 * K; // 右手自然主轴偏角随滑块平滑展开
      const rotZAmplitude = 12.8 * K; // 摆动幅度随 K 显著增强 (K=1.0 时幅度达到 ±12.8°，总摆幅高达 16°+)
      let targetRotZ = rotZBase + waveRotZ * rotZAmplitude;

      const waveSkew = Math.cos(seq * 0.23 + 1.5);
      let targetSkew = (-1.2 * K) + waveSkew * (2.8 * K);

      let targetOx = 50 + Math.cos(seq * 0.21 + 1.2) * (18 * K);
      let targetOy = 50 + Math.sin(seq * 0.17 + 2.4) * (20 * K);
      let targetPDist = Math.max(90, Math.round(220 - K * 95 + Math.sin(seq * 0.25) * (25 * K)));

      // 句子呼吸起伏力道 (前半句渐沉，后半句微提)
      const clauseWave = Math.sin((charInClause % 14) / 14 * Math.PI) * 0.08;
      let targetPressure = 0.93 + clauseWave + Math.sin(seq * 0.18) * (0.06 * K);

      // 2. 【叠字与重字书法异构呼应】若紧邻相同字或相近重现，注入互补反相偏移，但受平滑容差约束
      const isRepeat = (char === prevChar) || (count > 0);
      if (isRepeat) {
        targetRotX = -targetRotX * 0.75;
        targetRotY = -targetRotY * 0.75;
        targetRotZ = rotZBase - (targetRotZ - rotZBase) * 0.60;
        targetAspect = 1.0 - (targetAspect - 1.0) * 0.65;
        targetOx = 100 - targetOx;
        targetOy = 100 - targetOy;
        targetSize += (count % 2 === 1 ? 0.012 : -0.012) * K;
      }

      // 3. 【一阶惯性动量阻尼更新】(Physical Inertia Damper)
      const alphaSize = 0.75;
      const alphaRot = 0.58;
      const rawSize = state.size * alphaSize + targetSize * (1 - alphaSize);
      const rawAspect = state.aspect * alphaSize + targetAspect * (1 - alphaSize);
      const rawRotX = state.rotX * alphaRot + targetRotX * (1 - alphaRot);
      const rawRotY = state.rotY * alphaRot + targetRotY * (1 - alphaRot);
      const rawRotZ = state.rotZ * alphaRot + targetRotZ * (1 - alphaRot);
      const rawSkew = state.skew * alphaRot + targetSkew * (1 - alphaRot);
      const rawOx = state.ox * alphaRot + targetOx * (1 - alphaRot);
      const rawOy = state.oy * alphaRot + targetOy * (1 - alphaRot);
      const rawPDist = state.pDist * alphaRot + targetPDist * (1 - alphaRot);
      const rawPressure = state.pressure * alphaSize + targetPressure * (1 - alphaSize);

      // 4. 【单步最大速率限制器】(Slew Rate Clamp: 严格截断相邻两字的最大突变率)
      state.size = clampDelta(rawSize, state.size, 0.009 + 0.005 * K);
      state.aspect = clampDelta(rawAspect, state.aspect, 0.013 + 0.007 * K);
      state.rotX = clampDelta(rawRotX, state.rotX, 2.2 + 1.8 * K);
      state.rotY = clampDelta(rawRotY, state.rotY, 1.8 + 1.4 * K);

      const maxStepRotZ = 2.4 * K;
      state.rotZ = clampDelta(rawRotZ, state.rotZ, maxStepRotZ);
      state.skew = clampDelta(rawSkew, state.skew, 0.6 + 0.4 * K);
      state.ox = clampDelta(rawOx, state.ox, 2.4 + 1.6 * K);
      state.oy = clampDelta(rawOy, state.oy, 2.4 + 1.6 * K);
      state.pDist = clampDelta(rawPDist, state.pDist, 10 + 10 * K);
      state.pressure = Math.max(0.82, Math.min(1.05, clampDelta(rawPressure, state.pressure, 0.03)));

      // 4.1 【极值硬性区间锁定】：严格压缩最大字与最小字的大小差距极值
      const maxDeltaSize = 0.048 * (0.6 + 0.4 * K);
      state.size = Math.max(1.0 - maxDeltaSize, Math.min(1.0 + maxDeltaSize, state.size));

      const maxDeltaAspect = 0.072 * (0.6 + 0.4 * K);
      state.aspect = Math.max(1.0 - maxDeltaAspect, Math.min(1.0 + maxDeltaAspect, state.aspect));

      prevChar = char;

      // 5. 【视觉面积守恒伸缩计算】
      const sqrtA = Math.sqrt(state.aspect);
      const finalScaleX = (state.size * sqrtA).toFixed(3);
      const finalScaleY = (state.size / sqrtA).toFixed(3);

      const finalRotX = state.rotX.toFixed(2);
      const finalRotY = state.rotY.toFixed(2);
      const finalRotZ = state.rotZ.toFixed(2);
      const finalSkewX = state.skew.toFixed(2);
      const originX = state.ox.toFixed(1);
      const originY = state.oy.toFixed(1);
      const pDist = Math.round(state.pDist);

      // 6. 【基线与字距完全解耦】：无论 K 调多大，严格保持在 60px 格线安全区间内！
      const wave1 = Math.sin(seq * 0.35 + 0.4) * 1.2;
      const wave2 = Math.sin(Math.pow(seq, 1.15) * 0.16 + 0.9) * 0.5;
      const deltaY = (wave1 + wave2).toFixed(2);

      // 7. 字距呼吸微调 (连续平滑演进)
      const marginR = (Math.sin(seq * 0.4 + 0.2) * (0.8 + 0.6 * K)).toFixed(2);
      const marginL = (Math.cos(seq * 0.4 + 0.8) * (0.4 + 0.4 * K)).toFixed(2);

      // ========== 【Phase 2：禁忌队列字形状态机 (Tabu-Queue Glyph Engine)】 ==========
      let variantIndex = 0;
      if (K > 0.05) {
        const charTabu = charTabuMap.get(char) || [];
        const allVariants = [0, 1, 2, 3, 4, 5];

        // 1. 过滤单字历史禁忌（容量扩大至 5，确保连续 6 次出现 100% 变体各不相同）
        let candidates = allVariants.filter(v => !charTabu.includes(v));
        if (candidates.length === 0) {
          const lastUsed = charTabu[charTabu.length - 1];
          candidates = allVariants.filter(v => v !== lastUsed);
          charTabu.length = 0;
          charTabu.push(lastUsed);
        }

        // 2. 避免紧邻上一个字符重复相同变体（防止相邻不同字也呈现相同姿态）
        if (candidates.length > 1 && globalRecentQueue.length > 0) {
          const lastGlobal = globalRecentQueue[globalRecentQueue.length - 1];
          const nonAdjacent = candidates.filter(v => v !== lastGlobal);
          if (nonAdjacent.length > 0) candidates = nonAdjacent;
        }

        // 3. 【绝对防重铁律】：同字上一次出现的变体绝对禁止使用
        if (charTabu.length > 0) {
          const lastUsedForThisChar = charTabu[charTabu.length - 1];
          const strictlyDifferent = candidates.filter(v => v !== lastUsedForThisChar);
          if (strictlyDifferent.length > 0) {
            candidates = strictlyDifferent;
          }
        }

        // 4. 【紧邻叠字强反差】：若紧挨着的两字相同（如“的的”、“大大”），强制选用形态对比最强烈的变体
        if (char === prevChar && charTabu.length > 0) {
          const lastVar = charTabu[charTabu.length - 1];
          // 形态互补反差映射：1(瘦长) <-> 2(扁阔), 3(右倾) <-> 4(左倾S曲), 5(耸肩) <-> 0(原正)
          const contrastMap = {
            1: [2, 3, 4],
            2: [1, 3, 5],
            3: [4, 1, 2],
            4: [3, 2, 5],
            5: [0, 1, 2],
            0: [3, 5, 2]
          };
          const preferred = contrastMap[lastVar] || [1, 2, 3, 4, 5];
          const highContrastCandidates = candidates.filter(v => preferred.includes(v));
          if (highContrastCandidates.length > 0) {
            candidates = highContrastCandidates;
          }
        }

        // 5. 运笔动量与微姿态偏置加权采样 (Kinesthetic Persona Bias)
        const weights = candidates.map(v => {
          let w = 1.0;
          if (v === 3 || v === 5) {
            if (Math.abs(state.rotZ) > 3.0 * K || Math.abs(state.skew) > 1.2 * K) {
              w += 0.8 * K;
            }
          }
          if (v === 2 && state.aspect > 1.02) w += 0.7 * K;
          if (v === 1 && state.aspect < 0.98) w += 0.7 * K;
          if (v === 4 && state.pressure > 0.96) w += 0.6 * K;
          if (v === 0 && Math.abs(state.rotZ) < 2.0 * K) w += 0.5;
          return w;
        });

        // 确定性伪随机采样
        const totalWeight = weights.reduce((acc, val) => acc + val, 0);
        const randVal = hash32(char.charCodeAt(0), seq, count, Math.round(state.rotZ * 100)) * totalWeight;
        let cumulative = 0;
        variantIndex = candidates[0];
        for (let idx = 0; idx < candidates.length; idx++) {
          cumulative += weights[idx];
          if (randVal <= cumulative) {
            variantIndex = candidates[idx];
            break;
          }
        }

        // 更新单字禁忌队列（容量 5）
        charTabu.push(variantIndex);
        if (charTabu.length > 5) charTabu.shift();
        charTabuMap.set(char, charTabu);

        globalRecentQueue.push(variantIndex);
        if (globalRecentQueue.length > 3) globalRecentQueue.shift();
      }

      // ========== 【Phase 5：字重粗细与墨量体量物理平衡 (Physical Stroke & Volume Compensation)】 ==========
      // 通过物理描边微补与体量微调，完全保持 100% 墨色与纯黑浓淡一致，彻底消除偏色与发灰
      const variantStrokeMap = [0.18, 0.0, 0.14, 0.0, 0.0, 0.08];
      const variantScaleMap = [1.01, 0.975, 1.01, 0.975, 1.00, 1.00];

      const vStroke = variantStrokeMap[variantIndex] !== undefined ? variantStrokeMap[variantIndex] : 0.0;
      const vScale = variantScaleMap[variantIndex] !== undefined ? variantScaleMap[variantIndex] : 1.0;

      const dynamicPressureStroke = (state.pressure - 0.90) * 0.06 * K;
      const finalStrokeVal = Math.max(0, vStroke + dynamicPressureStroke);

      let strokeCSS = '';
      if (finalStrokeVal > 0.02) {
        strokeCSS = `-webkit-text-stroke: ${finalStrokeVal.toFixed(2)}px currentColor;`;
      }

      // 【100% 纸墨均匀不透明度】：所有文字统一为1.0满不透明度，杜绝透光发灰假象
      const effectiveOpacity = 1.0;

      // 【统一真实的微观笔墨纸张渗透晕染 (Paper Ink-Bleed Absorption)】
      let shadowCSS = '';
      if (isHighlight) {
        shadowCSS = 'text-shadow: 0 0 0.35px rgba(211, 47, 47, 0.25);';
      } else {
        shadowCSS = 'text-shadow: 0 0 0.35px rgba(18, 20, 24, 0.22);';
      }

      // 【绝对纯正浓郁墨色 (Uniform Pure Ink Color)】：所有变体共享完全一致的浓黑墨水与正红墨水
      let colorCSS = '';
      if (isHighlight) {
        colorCSS = 'color: rgb(211, 47, 47) !important;';
      } else {
        const baseGray = 14;
        const gray = Math.round(baseGray + (1.05 - state.pressure) * 4);
        colorCSS = `color: rgb(${gray}, ${gray + 2}, ${gray + 4}) !important;`;
      }

      const scaledX = (parseFloat(finalScaleX) * vScale).toFixed(3);
      const scaledY = (parseFloat(finalScaleY) * vScale).toFixed(3);

      let transform;
      const originCSS = `transform-origin: ${originX}% ${originY}%;`;
      if (K > 0.05) {
        transform = `transform: perspective(${pDist}px) rotateX(${finalRotX}deg) rotateY(${finalRotY}deg) rotateZ(${finalRotZ}deg) translateY(${deltaY}px) scale(${scaledX}, ${scaledY}) skewX(${finalSkewX}deg);`;
      } else {
        transform = `transform: translateY(${deltaY}px) rotate(${finalRotZ}deg) scale(${scaledX}, ${scaledY}) skewX(${finalSkewX}deg);`;
      }

      const fontFamilies = [
        "'Caveat', 'HandwritingGreek', 'MyHandwriting', 'KaiTi', '楷体', serif",
        "'Caveat', 'HandwritingGreek', 'MyHandwriting-Var1', 'MyHandwriting', 'KaiTi', '楷体', serif",
        "'Caveat', 'HandwritingGreek', 'MyHandwriting-Var2', 'MyHandwriting', 'KaiTi', '楷体', serif",
        "'Caveat', 'HandwritingGreek', 'MyHandwriting-Var3', 'MyHandwriting', 'KaiTi', '楷体', serif",
        "'Caveat', 'HandwritingGreek', 'MyHandwriting-Var4', 'MyHandwriting', 'KaiTi', '楷体', serif",
        "'Caveat', 'HandwritingGreek', 'MyHandwriting-Var5', 'MyHandwriting', 'KaiTi', '楷体', serif"
      ];
      const fontCSS = `font-family: ${fontFamilies[variantIndex] || fontFamilies[0]} !important;`;

      const glyphClass = `glyph-v${variantIndex}`;
      return `<span class="f1 organic-char ${glyphClass}" style="display:inline-block; vertical-align:baseline; font-size:1.5em; line-height:21px !important; margin-right:${marginR}px; margin-left:${marginL}px; opacity:${effectiveOpacity}; ${fontCSS} ${colorCSS} ${strokeCSS} ${shadowCSS} ${originCSS} ${transform}">${char}</span>`;
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

  // 3. 【核心修复】：防止公式内 < 与 > 破坏 HTML 解析器导致公式被吞噬与乱码
  // 在 HTML 环境下，公式内的形如 $F_{\text{库}}<mg\sin\alpha$ 会被浏览器的 innerHTML 解析器误判为 HTML 标签（如 <mg...），
  // 导致标签闭合失效、后续公式内容被吞噬、闭合 $ 丢失，进而产生乱码。
  // 将数学公式内部所有 < 与 > 转换为标准 LaTeX 宏 \lt 与 \gt，彻底杜绝 HTML 标签误吞！
  text = text.replace(/(\$\$[\s\S]*?\$\$|\$[^$]*?\$)/g, (formula) => {
    return formula.replace(/</g, '\\lt ').replace(/>/g, '\\gt ');
  });

  // 4. 全面支持在普通文本中直接书写的 LaTeX 数学与希腊符号，转义为 Unicode 字符
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
      // 保护 <red> 与 </red>，将普通文本中可能出现的裸写 < 与 > 转义为 HTML 实体，防止注入
      mathParts[i] = mathParts[i]
        .replace(/<red>/g, '【RED_OPEN】')
        .replace(/<\/red>/g, '【RED_CLOSE】')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/【RED_OPEN】/g, '<red>')
        .replace(/【RED_CLOSE】/g, '</red>')
        .replace(/\\\\/g, '【MANUAL_BR】')
        .replace(/\\/g, '【MANUAL_BR】');
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
          // 【核心】：物理数学运算符与特殊符号，优先调用手写希腊体与手写符号
          randomizedText += `<span class="f1 math-sym" style="font-family:'HandwritingGreek', 'Caveat', 'KaTeX_Main', 'MyHandwriting', sans-serif; font-size:1.35em; line-height:21px !important; vertical-align:baseline; color:inherit;">${char}</span>`;
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

  // ========== 美化根号为自然手写笔画 ==========
  beautifyRadicals(masterBox);

  // ========== 【分数线稳定渲染】：水平平直与标准内联显示（全平台及 html2canvas 绝对清晰稳定） ==========
  beautifyFractionLines(masterBox);

  // ========== 【避头尾法则 / 标点防孤行】确保标点符号与前字绑定，绝不出现行首孤点 ==========
  const punctRegex = /^[，。、；：？！,.;:?!’”'”）》〉】〕｝]$/;
  const spans = Array.from(masterBox.querySelectorAll('span.f1'));
  for (let i = 0; i < spans.length; i++) {
    const el = spans[i];
    const text = el.textContent.trim();
    if (punctRegex.test(text)) {
      // 1. 若该标点符号已经被包裹在 nowrap 容器中（例如已与公式在预处理阶段绑定），严禁跨节点挪动位置！
      if (el.closest('.kinsoku-wrap') || el.closest('[style*="nowrap"]')) {
        continue;
      }
      // 2. 获取其在真实 DOM 树中的紧邻前驱兄弟节点（杜绝跨公式跨节点错误错位）
      let prev = el.previousSibling;
      while (prev && prev.nodeType === Node.TEXT_NODE && prev.textContent.trim() === '') {
        prev = prev.previousSibling;
      }
      if (!prev) continue;
      // 避免重复包裹或与换行符错误包裹
      if (prev.nodeType === Node.ELEMENT_NODE && (prev.classList.contains('kinsoku-wrap') || prev.tagName === 'BR')) {
        continue;
      }
      const wrapper = document.createElement('span');
      wrapper.className = 'kinsoku-wrap';
      wrapper.style.cssText = 'white-space: nowrap !important; display: inline !important;';
      prev.parentNode.insertBefore(wrapper, prev);
      wrapper.appendChild(prev);
      wrapper.appendChild(el);
    }
  }

  // ========== 【V4 纸张纤维微洇】：注入微观纸张物理质感 SVG 滤镜 ==========
  ensureInkBleedFilter(captureZone, nonlinearIntensity);

  // 强制显式预加载与解码全部 6 套变体中文字体族、西文手写体与希腊体，杜绝 html2canvas 异步绘制时字形回退降级为同一基准字体
  await preloadHandwritingFonts();
  await document.fonts.ready;
  let fontWaitCount = 0;
  while ((!document.fonts.check('21px MyHandwriting-Var1') || !document.fonts.check('21px MyHandwriting-Var2') || !document.fonts.check('21px MyHandwriting-Var4')) && fontWaitCount < 20) {
    await new Promise(r => setTimeout(r, 100));
    fontWaitCount++;
  }
  await document.fonts.ready;
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

  // ========== 【V4 行级宏观书写流与行尾挤压】：低频基线波与边界心理紧缩 ==========
  applyMacroLineDynamics(masterBox, nonlinearIntensity);

  const masterRect = masterBox.getBoundingClientRect();

  // 获取所有可能干扰切割的图片和大型公式的位置（递归测算子元素几何投影）
  const imagesPos = [];
  masterBox.querySelectorAll('img, .katex-display').forEach(el => {
    const rect = el.getBoundingClientRect();
    let top = rect.top - masterRect.top;
    let bottom = rect.bottom - masterRect.top;
    el.querySelectorAll('*').forEach(child => {
      const cr = child.getBoundingClientRect();
      if (cr.height > 0) {
        const cTop = cr.top - masterRect.top;
        const cBottom = cr.bottom - masterRect.top;
        if (cTop < top) top = cTop;
        if (cBottom > bottom) bottom = cBottom;
      }
    });
    imagesPos.push({ top, bottom, el });
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
      // 核心防截断与防残留：只要公式或图片延伸进底部警戒区（离理论底边不到 30px）或跨越理论底边，
      // 说明若在此切割会导致公式被腰斩截断或在下一页顶部产生公式残余，必须整块顺延至下一页！
      if (img.top < theoreticalEnd && img.bottom > theoreticalEnd - 30) {
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
    contentWrapper.className = 'content-wrapper';
    contentWrapper.style.width = '678px';
    contentWrapper.style.minWidth = '678px';
    contentWrapper.style.maxWidth = '678px';
    contentWrapper.style.boxSizing = 'border-box';
    if (isLastPage) {
      const maxPageH = pageHeights[i] || 1020;
      contentWrapper.style.height = maxPageH + 'px';
    } else {
      contentWrapper.style.height = contentDisplayHeight + 'px';
      contentWrapper.style.overflow = 'hidden';
    }

    let contentClone = document.createElement('div');
    contentClone.className = 'sliced-content';
    contentClone.style.width = '678px';
    contentClone.style.minWidth = '678px';
    contentClone.style.maxWidth = '678px';
    contentClone.style.boxSizing = 'border-box';
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
      backgroundColor: '#fdfdfe',
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
