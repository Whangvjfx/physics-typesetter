import os
import re

def generate():
    source_html = r"C:\Users\wb686\Desktop\物理排版-真手写V2副本\物理排版-真手写体验.html"
    dest_html = r"C:\Users\wb686\Desktop\非线性\物理排版-非线性体验.html"

    with open(source_html, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update Title and Branding
    content = content.replace("物理排版 · 真手写V2 (真手写副本体验)", "非线性 - 物理手写排版系统 (桌面体验版)")
    content = content.replace("物理手写排版 · 真手写V2体验版", "物理手写排版 · 非线性动力学拟真引擎")
    content = content.replace("📐 A4手写", "🌀 非线性")
    content = content.replace("【真手写V2副本已激活】", "【非线性动力学引擎已就绪】")

    # 2. Add Greek & Variant @font-face rules & Nonlinear CSS
    greek_font_faces = """
@font-face {
  font-family: 'HandwritingGreek';
  src: url('./fonts/Handwriting-Greek.woff2') format('woff2'),
       url('./fonts/Handwriting-Greek.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
  unicode-range: U+0370-03FF, U+1F00-1FFF, U+2100-214F;
}

@font-face {
  font-family: 'HandwritingGreek';
  src: url('./fonts/Handwriting-Greek-Bold.woff2') format('woff2'),
       url('./fonts/Handwriting-Greek-Bold.ttf') format('truetype');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
  unicode-range: U+0370-03FF, U+1F00-1FFF, U+2100-214F;
}

@font-face {
  font-family: 'Caveat';
  src: url('./fonts/Handwriting-Greek.woff2') format('woff2'),
       url('./fonts/Handwriting-Greek.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
  unicode-range: U+0370-03FF, U+1F00-1FFF, U+2100-214F;
}

@font-face {
  font-family: 'Caveat';
  src: url('./fonts/Handwriting-Greek-Bold.woff2') format('woff2'),
       url('./fonts/Handwriting-Greek-Bold.ttf') format('truetype');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
  unicode-range: U+0370-03FF, U+1F00-1FFF, U+2100-214F;
}

@font-face {
  font-family: 'MyHandwriting-Var1';
  src: url('./fonts/myfont-var1.woff2') format('woff2');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'MyHandwriting-Var2';
  src: url('./fonts/myfont-var2.woff2') format('woff2');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'MyHandwriting-Var3';
  src: url('./fonts/myfont-var3.woff2') format('woff2');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'MyHandwriting-Var4';
  src: url('./fonts/myfont-var4.woff2') format('woff2');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'MyHandwriting-Var5';
  src: url('./fonts/myfont-var5.woff2') format('woff2');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

/* 6 套微姿态变体字形映射类，含完整降级回退链 */
span.f1.glyph-v0 {
  font-family: 'Caveat', 'HandwritingGreek', 'MyHandwriting', "KaiTi", "楷体", "STKaiti", "华文楷体", serif !important;
}
span.f1.glyph-v1 {
  font-family: 'Caveat', 'HandwritingGreek', 'MyHandwriting-Var1', 'MyHandwriting', "KaiTi", "楷体", "STKaiti", "华文楷体", serif !important;
}
span.f1.glyph-v2 {
  font-family: 'Caveat', 'HandwritingGreek', 'MyHandwriting-Var2', 'MyHandwriting', "KaiTi", "楷体", "STKaiti", "华文楷体", serif !important;
}
span.f1.glyph-v3 {
  font-family: 'Caveat', 'HandwritingGreek', 'MyHandwriting-Var3', 'MyHandwriting', "KaiTi", "楷体", "STKaiti", "华文楷体", serif !important;
}
span.f1.glyph-v4 {
  font-family: 'Caveat', 'HandwritingGreek', 'MyHandwriting-Var4', 'MyHandwriting', "KaiTi", "楷体", "STKaiti", "华文楷体", serif !important;
}
span.f1.glyph-v5 {
  font-family: 'Caveat', 'HandwritingGreek', 'MyHandwriting-Var5', 'MyHandwriting', "KaiTi", "楷体", "STKaiti", "华文楷体", serif !important;
}

/* 非线性专属滑块外观与预设按钮 */
.nonlinear-deck {
  border-left: 3px solid var(--amber-gold) !important;
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, var(--bg-card) 100%) !important;
}

[data-theme="light"] .nonlinear-deck {
  border-left: 3px solid #059669 !important;
  background: linear-gradient(135deg, #ecfdf5 0%, #f8fafc 100%) !important;
}

.badge-nonlinear {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(245, 158, 11, 0.2);
  color: var(--amber-gold);
  border: 1px solid rgba(245, 158, 11, 0.4);
}

[data-theme="light"] .badge-nonlinear {
  background: #d1fae5;
  color: #047857;
  border-color: #6ee7b7;
}

.nonlinear-presets {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}

.preset-btn {
  flex: 1;
  padding: 5px 0;
  font-size: 11px;
  font-weight: 600;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.preset-btn:hover {
  background: rgba(255, 255, 255, 0.14);
  color: var(--text-primary);
}

.preset-btn.active {
  background: var(--amber-gold);
  border-color: var(--amber-gold);
  color: #07090e;
  box-shadow: 0 0 10px var(--amber-glow);
}

[data-theme="light"] .preset-btn {
  background: #f1f5f9;
  border-color: #cbd5e1;
  color: #475569;
}

[data-theme="light"] .preset-btn:hover {
  background: #e2e8f0;
  color: #1e293b;
}

[data-theme="light"] .preset-btn.active {
  background: #059669;
  border-color: #059669;
  color: #ffffff;
  box-shadow: 0 0 8px rgba(5, 150, 105, 0.3);
}

/* 优先调用 Caveat 英文手写，紧接着是希腊手写体，没有的再 fallback 给中文手写体与通用楷体 */
.page-container,
#master-box,
#capture-zone,
.sliced-content {
  font-family: 'Caveat', 'HandwritingGreek', 'MyHandwriting', "KaiTi", "楷体", "STKaiti", "华文楷体", serif !important;
  color: #111111;
}

span.f1 {
  font-family: 'Caveat', 'HandwritingGreek', 'MyHandwriting', "KaiTi", "楷体", "STKaiti", "华文楷体", serif !important;
  color: inherit;
}

/* 物理数学特定运算符与符号（如 ≠, ≤, ≥, ±, ×, ÷, ≈ 等）：优先采用手写字体，没有的再 fallback 原生符号字体 */
span.f1.math-sym {
  font-family: 'Caveat', 'HandwritingGreek', 'MyHandwriting', 'KaTeX_Main', sans-serif !important;
  color: inherit;
}

/* KaTeX 基础容器样式 */
.katex {
  font-family: 'Caveat', 'HandwritingGreek', 'MyHandwriting', cursive !important;
  font-size: 1.25em !important;
  color: inherit !important;
}

/* 解除公式内部的 60px 限制，防止上下标被拉扯破碎 */
.katex * {
  line-height: normal !important;
}

/* 1. 公式中的变量、常数与斜体字母应用手写字体（包含拉丁手写与希腊手写） */
.katex .mathnormal,
.katex .mord.mathnormal {
  font-family: 'Caveat', 'HandwritingGreek', cursive !important;
}

/* 2. 【核心修复】数学算子与函数名（tan, sin, cos, ln, log, lim, max, min, exp, cot 等）手写化 */
.katex .mop:not(.op-symbol) {
  font-family: 'Caveat', 'HandwritingGreek', cursive !important;
  font-style: normal !important;
}

/* 3. 【核心修复】所有上下标与根指数（包括幂次 ^2, 下标 _B, _C, _N, _G, _E, _m, 中文下标 _合, 根号指数 \sqrt[3]{} 等）全量手写化 */
.katex .msupsub,
.katex .msupsub *,
.katex .mtight,
.katex .mtight *,
.katex .katex-root,
.katex .katex-root * {
  font-family: 'Caveat', 'HandwritingGreek', 'MyHandwriting', "KaiTi", cursive !important;
}

/* 消除手写体（如 Caveat 的 t 悬臂、r 突起、R 腿部等）与右上标/右下标的视觉重叠撞击 */
.katex .msupsub {
  margin-left: 0.16em !important;
}

/* 4. 【核心修复】公式中普通数字、数值、常数与量纲单位（如 20 N, 10 N, 5 J, 30°, 分数 1/2, 根号下数值等）手写化 */
.katex .mord:not(.katex-vbox):not(.katex-vbox *):not(.svg-align):not(.hide-tail):not(.hide-tail *):not(.sqrt) {
  font-family: 'Caveat', 'HandwritingGreek', 'MyHandwriting', cursive !important;
}

/* 5. 【核心修复】公式中出现的中文汉字（如 W_合, F_拉, \text{总功} 等）严格应用手写字体 */
.katex .cjk_fallback,
.katex .cjk_fallback * {
  font-family: 'MyHandwriting', 'KaiTi', cursive !important;
}

/* 6. 【核心修复】正体字母与量纲单位（N, J, kg, s, C, V, m 等）手写化 */
.katex .mathrm,
.katex .mathrm *,
.katex .text,
.katex .text * {
  font-family: 'Caveat', 'HandwritingGreek', 'MyHandwriting', cursive !important;
  font-style: normal !important;
}

/* 7. 【核心修复】关系符（等号 =、大于 >、小于 <、约等于 ≈、小于等于 ≤、大于等于 ≥ 等）全量手写化 */
.katex .mrel:not(.katex-vbox *) {
  font-family: 'Caveat', 'HandwritingGreek', 'MyHandwriting', 'KaTeX_Main', cursive !important;
}

/* 保护 \neq 的私有区斜杠符号 U+E020，确保其始终从 KaTeX 原生符号库提取绘制 */
.katex .rlap,
.katex .rlap *,
.katex .katex-inner,
.katex .katex-inner * {
  font-family: 'KaTeX_Main' !important;
}

/* 8. 【核心修复】二元运算符（加 +、减 −、乘 ×、除 ÷、点乘 ·、正负 ± 等）手写化 */
.katex .mbin {
  font-family: 'Caveat', 'HandwritingGreek', 'MyHandwriting', cursive !important;
}

/* 9. 【核心修复】定界符与圆括号、方括号（如 (, ), [, ], {, }）手写化 */
.katex .mopen,
.katex .mclose {
  font-family: 'Caveat', 'HandwritingGreek', cursive !important;
}

/* 10. 标点符号（逗号 ,、冒号 :）手写化 */
.katex .mpunct {
  font-family: 'Caveat', 'HandwritingGreek', cursive !important;
}

/* 11. 【核心修复】分数线：保持原生 inline-block 与水平平直，全平台及 html2canvas 绝对清晰稳定 */
.katex .frac-line {
  border-bottom-style: solid !important;
  border-bottom-width: 1.2px !important;
  border-bottom-color: currentColor !important;
  display: inline-block !important;
  opacity: 0.95;
}

/* 12. 【核心修复】根号 SVG 柔化与笔墨质感优化 */
.katex .sqrt svg {
  overflow: visible !important;
}
.katex .sqrt .hide-tail svg path {
  fill: none !important;
  stroke: currentColor !important;
  stroke-width: 42px !important;
  stroke-linecap: round !important;
  stroke-linejoin: round !important;
  filter: drop-shadow(0 0 0.35px rgba(18, 20, 24, 0.45));
}

.katex-display {
  text-align: left !important;
  padding-left: 1em !important;
  margin: 0 !important;
  display: block;
  color: inherit !important;
}

.highlight,
.highlight *,
#capture-zone .highlight,
#capture-zone .highlight *,
.page-container .highlight,
.page-container .highlight *,
.sliced-content .highlight,
.sliced-content .highlight * {
  color: #d32f2f !important;
}
"""
    myfont_idx = content.find("font-family: 'MyHandwriting'")
    if myfont_idx != -1:
        close_brace = content.find('}', myfont_idx) + 1
        content = content[:close_brace] + "\n" + greek_font_faces + "\n" + content[close_brace:]

    # 3. Add Slider HTML into Control Deck
    slider_html = """

        <!-- 🌀 核心特性：非线性随机度调节滑块 -->
        <div class="slider-deck nonlinear-deck">
          <div class="slider-deck-header">
            <span style="display:flex; align-items:center; gap:8px;">
              <span style="font-weight:700;">🌀 手写非线性度</span>
              <span class="badge-nonlinear" id="nonlinear-tier-badge">自然生动</span>
            </span>
            <span class="slider-deck-value" id="nonlinear-val-text" style="color:var(--amber-gold); font-weight:800;">65%</span>
          </div>
          <input type="range" id="nonlinear-slider" min="0" max="100" step="5" value="65">
          <div class="nonlinear-presets">
            <button type="button" class="preset-btn" data-val="0">0% 规整</button>
            <button type="button" class="preset-btn" data-val="35">35% 秀雅</button>
            <button type="button" class="preset-btn active" data-val="65">65% 自然</button>
            <button type="button" class="preset-btn" data-val="100">100% 极大扭曲</button>
          </div>
        </div>"""

    scale_idx = content.find('id="img-scale"')
    if scale_idx != -1:
        slider_div_close = content.find('</div>', scale_idx) + 6
        content = content[:slider_div_close] + slider_html + content[slider_div_close:]

    # 4. Fix mathBox selector in desktop HTML
    content = content.replace(
        "const parts = el.querySelectorAll('.katex-html > .base, .katex-html > .tag');",
        "const parts = el.querySelectorAll('.katex-html > .base, .katex-html > .tag, .katex-html > .katex-base');"
    )

    # 5. Read typesetter.js functions and replace all rendering logic in desktop HTML
    with open(r"C:\Users\wb686\.gemini\antigravity\scratch\physics-typesetter-nonlinear\src\typesetter.js", 'r', encoding='utf-8') as f:
        ts_code = f.read()

    b_start = ts_code.find("async function preloadHandwritingFonts")
    ts_end = ts_code.rfind('}') + 1
    ts_full_block = ts_code[b_start:ts_end].replace("export async function", "async function")

    old_block_start = content.find("function mathBox")
    old_block_end = content.find("// ==========================================================================\n// 主逻辑")
    content = content[:old_block_start] + ts_full_block + "\n\n" + content[old_block_end:]

    # 7. Add JS Slider Hooks & Sample Text
    js_slider_hook = """
// 非线性状态管理与 UI
let nonlinearVal = 65;
const nonlinearSlider = document.getElementById('nonlinear-slider');
const nonlinearValText = document.getElementById('nonlinear-val-text');
const nonlinearTierBadge = document.getElementById('nonlinear-tier-badge');
const presetBtns = document.querySelectorAll('.preset-btn');

function getNonlinearTierDesc(val) {
  if (val === 0) return '规整端楷';
  if (val <= 35) return '秀雅微澜';
  if (val <= 70) return '自然生动';
  if (val < 100) return '笔势纵逸';
  return '极大非线性扭曲';
}

function updateNonlinearUI(val) {
  nonlinearVal = Math.max(0, Math.min(100, parseInt(val, 10) || 0));
  if (nonlinearSlider) nonlinearSlider.value = nonlinearVal;
  if (nonlinearValText) nonlinearValText.innerText = `${nonlinearVal}%`;
  if (nonlinearTierBadge) nonlinearTierBadge.innerText = getNonlinearTierDesc(nonlinearVal);

  presetBtns.forEach(btn => {
    const btnVal = parseInt(btn.getAttribute('data-val'), 10);
    btn.classList.toggle('active', btnVal === nonlinearVal);
  });
}

if (nonlinearSlider) {
  nonlinearSlider.addEventListener('input', (e) => {
    updateNonlinearUI(e.target.value);
    saveDraft();
  });
}

presetBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const val = parseInt(btn.getAttribute('data-val'), 10);
    updateNonlinearUI(val);
    saveDraft();
  });
});
"""

    content = content.replace("let pastedImageSrc = null;", js_slider_hook + "\nlet pastedImageSrc = null;")

    # In loadDraft:
    content = content.replace(
        "if (savedScale) {",
        """const savedNonlinear = localStorage.getItem('physics_draft_nonlinear');
  if (savedNonlinear !== null) {
    updateNonlinearUI(parseInt(savedNonlinear, 10));
  } else {
    updateNonlinearUI(65);
  }
  if (savedScale) {"""
    )

    # In saveDraft:
    content = content.replace(
        "localStorage.setItem('physics_draft_scale', imageWidth.toString());",
        "localStorage.setItem('physics_draft_scale', imageWidth.toString());\n  localStorage.setItem('physics_draft_nonlinear', nonlinearVal.toString());"
    )

    # In handleGenerate:
    content = content.replace(
        "imageWidth,",
        "imageWidth,\n      nonlinearIntensity: nonlinearVal / 100,"
    )

    # 8. 移除“填入示例”按钮及监听
    content = re.sub(r'<button[^>]*id="btn-load-sample"[^>]*>.*?</button>', '', content, flags=re.DOTALL)
    content = re.sub(r'btnLoadSample\.addEventListener\(\'click\',.*?\}\);', '', content, flags=re.DOTALL)
    content = content.replace("const btnLoadSample = document.getElementById('btn-load-sample');", "")

    # 9. 纸张底色全面白皙化 (由偏黄 #fbf9f4 升级为纯白答题纸质感 #fdfdfe)
    content = content.replace("#fbf9f4", "#fdfdfe")

    # 10. 页面启动时自动预加载字体
    content = content.replace("loadDraft();", "loadDraft();\npreloadHandwritingFonts();")

    # 11. 彻底清除原版遗留的 .page-container * 通配符强制重置规则，恢复每个字的独立变体字形
    content = content.replace(
        ".page-container, .page-container *,\n#master-box, #master-box *,\n#capture-zone, #capture-zone *,\n.sliced-content, .sliced-content *",
        ".page-container,\n#master-box,\n#capture-zone,\n.sliced-content"
    )

    dest_dirs = [
        r"C:\Users\wb686\Desktop\物理排版-非线性体验.html",
        r"C:\Users\wb686\Desktop\非线性\物理排版-非线性体验.html",
        r"C:\Users\wb686\Desktop\非线性_V4_Pro\物理排版-非线性体验.html"
    ]
    for d_path in dest_dirs:
        os.makedirs(os.path.dirname(d_path), exist_ok=True)
        with open(d_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Generated {d_path} ({os.path.getsize(d_path)} bytes)")

    # 11. 同步全量字体文件至各桌面目录
    import shutil
    public_fonts_dir = r"C:\Users\wb686\.gemini\antigravity\scratch\physics-typesetter-nonlinear\public\fonts"
    target_font_dirs = [
        r"C:\Users\wb686\Desktop\fonts",
        r"C:\Users\wb686\Desktop\非线性\fonts",
        r"C:\Users\wb686\Desktop\非线性_V4_Pro\fonts"
    ]
    for tf_dir in target_font_dirs:
        os.makedirs(tf_dir, exist_ok=True)
        for font_file in os.listdir(public_fonts_dir):
            src_f = os.path.join(public_fonts_dir, font_file)
            dst_f = os.path.join(tf_dir, font_file)
            if os.path.isfile(src_f):
                shutil.copy2(src_f, dst_f)
        print(f"Synced fonts to {tf_dir}")

if __name__ == '__main__':
    generate()
