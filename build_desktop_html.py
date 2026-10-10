import os

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

    # 2. Add Nonlinear CSS Styles
    nonlinear_css = """
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
"""
    content = content.replace("/* 基础变量 */", nonlinear_css + "\n/* 基础变量 */")

    # 3. Add Slider HTML into Control Deck
    slider_target = """        <!-- 图片大小调节滑块 -->
        <div class="slider-deck">
          <div class="slider-deck-header">
            <span>图片渲染宽度</span>
            <span class="slider-deck-value" id="img-scale-val">250 px</span>
          </div>
          <input type="range" id="img-scale" min="100" max="400" step="5" value="250">
        </div>"""

    slider_replacement = slider_target + """

        <!-- 🌀 核心特性：非线性随机度调节滑块 -->
        <div class="slider-deck nonlinear-deck">
          <div class="slider-deck-header">
            <span style="display:flex; align-items:center; gap:8px;">
              <span style="font-weight:700;">🌀 手写非线性度</span>
              <span class="badge-nonlinear" id="nonlinear-tier-badge">自然生动</span>
            </span>
            <span class="slider-deck-value" id="nonlinear-val-text" style="color:var(--amber-gold); font-weight:800;">60%</span>
          </div>
          <input type="range" id="nonlinear-slider" min="0" max="100" step="5" value="60">
          <div class="nonlinear-presets">
            <button type="button" class="preset-btn" data-val="0">0% 规整</button>
            <button type="button" class="preset-btn" data-val="35">35% 秀雅</button>
            <button type="button" class="preset-btn active" data-val="60">60% 自然</button>
            <button type="button" class="preset-btn" data-val="90">90% 飞逸</button>
          </div>
        </div>"""

    content = content.replace(slider_target, slider_replacement)

    # 4. Replace Engine Implementation with Nonlinear Engine
    # Read the engine from physics-typesetter-nonlinear/src/typesetter.js
    with open(r"C:\Users\wb686\.gemini\antigravity\scratch\physics-typesetter-nonlinear\src\typesetter.js", 'r', encoding='utf-8') as f:
        ts_code = f.read()

    engine_start = ts_code.find("function createNonlinearChineseCharGenerator")
    engine_end = ts_code.find("export async function generateTypesetImages")
    nonlinear_engine_code = ts_code[engine_start:engine_end].strip()

    # Find where createOrganicChineseCharGenerator was defined in content
    old_engine_start = content.find("function createOrganicChineseCharGenerator")
    old_engine_end = content.find("async function generateTypesetImages")
    content = content[:old_engine_start] + nonlinear_engine_code + "\n\n" + content[old_engine_end:]

    # 5. Update generateTypesetImages signature & call in content
    content = content.replace(
        "async function generateTypesetImages({ rawText, pastedImageSrc = null, imageWidth = 250, captureZone, onProgress = () => {} })",
        "async function generateTypesetImages({ rawText, pastedImageSrc = null, imageWidth = 250, nonlinearIntensity = 0.60, captureZone, onProgress = () => {} })"
    )
    content = content.replace(
        "const organicEngine = createOrganicChineseCharGenerator();",
        "const organicEngine = createNonlinearChineseCharGenerator(nonlinearIntensity);"
    )

    # 6. Add JS Logic for Nonlinear Slider & Persistence in Content Script
    js_slider_hook = """
// 非线性状态管理与 UI
let nonlinearVal = 60;
const nonlinearSlider = document.getElementById('nonlinear-slider');
const nonlinearValText = document.getElementById('nonlinear-val-text');
const nonlinearTierBadge = document.getElementById('nonlinear-tier-badge');
const presetBtns = document.querySelectorAll('.preset-btn');

function getNonlinearTierDesc(val) {
  if (val <= 15) return '规整微澜';
  if (val <= 45) return '秀雅舒展';
  if (val <= 75) return '自然生动';
  return '笔势纵逸';
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
    updateNonlinearUI(60);
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

    os.makedirs(os.path.dirname(dest_html), exist_ok=True)
    with open(dest_html, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"Generated {dest_html} ({os.path.getsize(dest_html)} bytes)")

if __name__ == '__main__':
    generate()
