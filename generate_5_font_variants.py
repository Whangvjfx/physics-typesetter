#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_5_font_variants.py
基于 Python fonttools 离线构建 5 套具备【显著手写形态差异】的全量变体字库（myfont-var1 ~ myfont-var5）
全面覆盖国家标准《通用规范汉字表》8105 汉字及原字库全部 7288 字符（全量无损衍生，取消子集化限制）：
  - Var 1 (劲挺瘦长态 · Tall & Slender): sx ~ 0.83, sy ~ 1.12, 瘦长挺拔
  - Var 2 (宽博扁阔态 · Wide & Flat): sx ~ 1.22, sy ~ 0.84, 扁宽舒展, 重心下沉
  - Var 3 (疾书右倾态 · Dynamic Right-Slant): shear_x ~ +10.5°, 明显向右倾斜, 行气疾走
  - Var 4 (逆锋端凝S曲度 · Left Counter-Tilt & S-Spine): shear_x ~ -5.5°, 垂直S型脊椎波动
  - Var 5 (左低右高上开下收 · Rising Horizon & Top-Broad): shear_y ~ +7.2°, 上部外扩下部收敛
"""

import math
import random
import os
import io
import time
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._g_l_y_f import GlyphCoordinates

def transform_glyph_dramatic(coords, gname, variant_idx):
    if len(coords) == 0:
        return coords

    xs = [p[0] for p in coords]
    ys = [p[1] for p in coords]
    cx = (min(xs) + max(xs)) / 2.0
    cy = (min(ys) + max(ys)) / 2.0
    W = max(1.0, float(max(xs) - min(xs)))
    H = max(1.0, float(max(ys) - min(ys)))

    # 确定性哈希伪随机
    h = 0
    for ch in gname:
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    seed = (h ^ (variant_idx * 0x9E3779B9)) & 0xFFFFFFFF
    rng = random.Random(seed)

    new_coords = []

    if variant_idx == 1:
        # 变体 1 (劲挺瘦长态 · Tall & Slender):
        # sx ∈ [0.82, 0.85], sy ∈ [1.10, 1.14], 右上微仰剪切 shear_y ~ 2.5°
        sx = rng.uniform(0.82, 0.85)
        sy = rng.uniform(1.10, 1.14)
        shear_y = math.radians(rng.uniform(2.0, 3.0))
        Ax = rng.uniform(12.0, 18.0)
        Ay = rng.uniform(10.0, 16.0)
        phi1 = rng.uniform(0, math.pi * 2)
        phi2 = rng.uniform(0, math.pi * 2)

        for x, y in coords:
            x1 = cx + (x - cx) * sx
            y1 = cy + (y - cy) * sy
            y2 = y1 + (x1 - cx) * math.tan(shear_y)
            x2 = x1
            dx_wave = Ax * math.sin(2 * math.pi * (y2 - cy) / H + phi1)
            dy_wave = Ay * math.cos(2 * math.pi * (x2 - cx) / W + phi2)
            new_coords.append((round(x2 + dx_wave), round(y2 + dy_wave)))

    elif variant_idx == 2:
        # 变体 2 (宽博扁阔态 · Wide & Flat):
        # sx ∈ [1.20, 1.25], sy ∈ [0.82, 0.86], 重心微沉
        sx = rng.uniform(1.20, 1.24)
        sy = rng.uniform(0.82, 0.86)
        y_shift = rng.uniform(-25.0, -15.0)
        Ax = rng.uniform(14.0, 20.0)
        Ay = rng.uniform(10.0, 15.0)
        phi1 = rng.uniform(0, math.pi * 2)
        phi2 = rng.uniform(0, math.pi * 2)

        for x, y in coords:
            x1 = cx + (x - cx) * sx
            y1 = cy + (y - cy) * sy + y_shift
            dx_wave = Ax * math.sin(2 * math.pi * (y1 - cy) / H + phi1)
            dy_wave = Ay * math.cos(2 * math.pi * (x1 - cx) / W + phi2)
            new_coords.append((round(x1 + dx_wave), round(y1 + dy_wave)))

    elif variant_idx == 3:
        # 变体 3 (疾书右倾态 · Dynamic Right-Slant Italic):
        # shear_x ∈ [+9.5°, +11.5°] (明显向右倾斜)
        shear_x = math.radians(rng.uniform(9.5, 11.5))
        sx = rng.uniform(0.96, 1.02)
        sy = rng.uniform(0.96, 1.02)
        Ax = rng.uniform(16.0, 24.0)
        Ay = rng.uniform(12.0, 18.0)
        phi1 = rng.uniform(0, math.pi * 2)
        phi2 = rng.uniform(0, math.pi * 2)

        for x, y in coords:
            x1 = cx + (x - cx) * sx
            y1 = cy + (y - cy) * sy
            x2 = x1 + (y1 - cy) * math.tan(shear_x)
            y2 = y1
            dx_wave = Ax * math.sin(2 * math.pi * (y2 - cy) / H + phi1)
            dy_wave = Ay * math.cos(2 * math.pi * (x2 - cx) / W + phi2)
            new_coords.append((round(x2 + dx_wave), round(y2 + dy_wave)))

    elif variant_idx == 4:
        # 变体 4 (逆锋微左倾 + S型脊椎反曲态 · Left Counter-Tilt & S-Spine):
        # shear_x ∈ [-6.0°, -4.5°], 垂直 S 曲线摆动
        shear_x = math.radians(rng.uniform(-6.0, -4.5))
        sx = rng.uniform(0.92, 0.96)
        sy = rng.uniform(0.98, 1.02)
        A_spine = rng.uniform(36.0, 46.0)

        for x, y in coords:
            x1 = cx + (x - cx) * sx
            y1 = cy + (y - cy) * sy
            x2 = x1 + (y1 - cy) * math.tan(shear_x)
            dx_spine = A_spine * math.sin(2 * math.pi * (y1 - cy) / H)
            new_coords.append((round(x2 + dx_spine), round(y1)))

    elif variant_idx == 5:
        # 变体 5 (左低右高 + 上宽下敛耸肩态 · Rising Horizon & Top-Broad):
        # shear_y ∈ [+6.5°, +8.0°], 梯形变异 (上宽下收)
        shear_y = math.radians(rng.uniform(6.5, 8.0))
        Ax = rng.uniform(12.0, 18.0)
        phi1 = rng.uniform(0, math.pi * 2)

        for x, y in coords:
            norm_y = (y - cy) / (H / 2.0)  # -1 到 +1
            scale_x = 1.0 + 0.13 * norm_y   # 上部展开 1.13, 下部收缩 0.87
            x1 = cx + (x - cx) * scale_x
            y1 = y + (x1 - cx) * math.tan(shear_y)
            dx_wave = Ax * math.sin(2 * math.pi * (y1 - cy) / H + phi1)
            new_coords.append((round(x1 + dx_wave), round(y1)))

    return GlyphCoordinates(new_coords)

def update_name_table(font, family_name):
    name_table = font['name']
    for r in list(name_table.names):
        if r.nameID in (1, 4, 6, 16, 21):
            name_table.names.remove(r)
    name_table.setName(family_name, 1, 3, 1, 0x409)
    name_table.setName(family_name, 4, 3, 1, 0x409)
    name_table.setName(family_name.replace('-', ''), 6, 3, 1, 0x409)

def main():
    base_font_path = 'myfont.woff2'
    if not os.path.exists(base_font_path):
        base_font_path = os.path.join('public', 'fonts', 'myfont.woff2')
    print(f"Loading full base font from: {base_font_path}...")

    # 读取全量基准字体（无子集化）
    with open(base_font_path, 'rb') as f:
        full_base_bytes = f.read()

    base_font = TTFont(io.BytesIO(full_base_bytes))
    cmap = base_font.getBestCmap()
    gname_to_cp = {gname: cp for cp, gname in cmap.items()}
    total_glyphs = len(base_font.getGlyphOrder())
    print(f"Full base font loaded: {total_glyphs} glyphs, {len(cmap)} codepoints in cmap.")

    def is_cjk_glyph(gname):
        cp = gname_to_cp.get(gname)
        if cp is not None:
            return (0x4E00 <= cp <= 0x9FFF) or (0x3400 <= cp <= 0x4DBF) or (0xF900 <= cp <= 0xFAFF)
        if gname.startswith('uni') and len(gname) == 7:
            try:
                val = int(gname[3:], 16)
                return (0x4E00 <= val <= 0x9FFF) or (0x3400 <= val <= 0x4DBF)
            except ValueError:
                pass
        return False

    out_dirs = [
        os.path.join('public', 'fonts'),
        os.path.join('dist', 'fonts'),
        os.path.join('android', 'app', 'src', 'main', 'assets', 'public', 'fonts'),
        os.path.join('ios', 'App', 'App', 'public', 'fonts'),
        r'C:\Users\wb686\Desktop\非线性\fonts',
        r'C:\Users\wb686\Desktop\非线性_V4_Pro\fonts',
        '.'
    ]
    for d in out_dirs:
        os.makedirs(d, exist_ok=True)

    t0 = time.time()
    for v_idx in range(1, 6):
        family_name = f"MyHandwriting-Var{v_idx}"
        print(f"\n--- Generating Full-Coverage Variant {v_idx}: {family_name} ---")
        
        v_font = TTFont(io.BytesIO(full_base_bytes))
        glyf = v_font['glyf']
        hmtx = v_font['hmtx']

        glyph_names = v_font.getGlyphOrder()
        modified_count = 0

        for gname in glyph_names:
            g = glyf[gname]
            if g.numberOfContours > 0 and not g.isComposite() and is_cjk_glyph(gname):
                orig_coords = g.coordinates
                new_coords = transform_glyph_dramatic(orig_coords, gname, v_idx)
                g.coordinates = new_coords
                g.recalcBounds(glyf)
                
                adv, _ = hmtx[gname]
                hmtx[gname] = (adv, g.xMin)
                modified_count += 1

        print(f"Variant {v_idx}: Deformed and recalculated bounds for {modified_count} CJK glyphs.")

        update_name_table(v_font, family_name)
        v_font.flavor = 'woff2'

        filename = f"myfont-var{v_idx}.woff2"
        for out_dir in out_dirs:
            target_path = os.path.join(out_dir, filename)
            v_font.save(target_path)
            size_kb = round(os.path.getsize(target_path) / 1024)
            print(f"Saved: {target_path} ({size_kb} KB)")

    elapsed = round(time.time() - t0, 1)
    print(f"\nSUCCESS: All 5 full-coverage font variants generated in {elapsed}s across all destinations!")

if __name__ == '__main__':
    main()
