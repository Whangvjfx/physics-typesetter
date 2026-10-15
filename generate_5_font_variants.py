#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_5_font_variants.py
基于 Python fonttools 离线构建 5 套近邻手写字体变体（myfont-var1 ~ myfont-var5）
与原字体 v0 共同构成 6 槽位动态字形流形池。
"""

import math
import random
import copy
import os
import io
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._g_l_y_f import GlyphCoordinates
from fontTools import subset

def get_target_characters():
    # 1. 高中物理专属高频词汇与符号
    physics_vocab = (
        "的一是在不了有和人这中大为上个国我以要他时来用们生到作地于出会就也学对也力质速度加速度位移时间功动能势能机械能动量冲量牛顿"
        "洛伦兹库仑安培法拉第楞次焦耳麦克斯韦欧姆电阻电容电感电动势磁场电场引力万有引力轨道周期频率波长振幅相位简谐振动单摆弹簧滑块"
        "斜面光滑粗糙摩擦力支持力压力张力浮力弹力合力分力正交分解平衡状态临界极大极小极值最大值最小值导轨金属棒线框线圈磁通量变化率"
        "交流电感抗容抗有效值峰值变压器升压降压输电线发热损耗光电效应逸出功截止频率极限频率普朗克常量光子电子质子中子正电子微中子"
        "阿尔法贝塔伽马衰变裂变聚变质能方程半衰期射线性核反应方程质子数质量数能级跃迁玻尔氢原子光谱线吸收辐射迈克尔逊相对论"
        "平抛圆周向心离心匀速变速匀加速变加速匀减速变减速直线曲线偏转加速减速释放静止初速度末速度平均瞬时微元微积分极限矢量标量"
        "图像切线斜率截距面积闭合回路右手定则左手定则右手螺旋定则安培定则正极负极阴极阳极内阻定值滑动变阻器分压限流电压表电流表"
        "改装电桥电势电势差电势能等势面电容充放电稳态暂态自感互感涡流阻尼示波管偏转电极荧光屏偏转量偏转角回旋加速器速度选择器"
        "质谱仪磁流体发电机霍尔效应霍尔元件霍尔电压霍尔系数半导体载流子电子空穴漂移速度自由电子粒子束电量电荷带电粒子点电荷电偶极子"
        "重力重力加速度质量重力势能弹性势能机械能守恒动能定理动量定理动量守恒能量守恒碰撞完全弹性非弹性对心正碰斜碰反冲火箭爆炸"
        "开普勒行星运动天体恒星行星卫星赤道同步近地极地周期半径双星三星黑洞引力波潮汐超重失重完全失重自由落体竖直上抛平抛斜抛"
        "抛体运动运动的合成与分解相对运动参考系质点刚体转动惯量转矩角速度线速度向心加速度切向加速度法向加速度力矩转动动能"
        "温度热力学分子动理论阿伏伽德罗常数摩尔质量体积密度微观状态宏观压强体积理想气体状态方程等温等容等压内能热量做功热力学第一定律"
        "第二定律熵增可逆不可逆绝对零度卡诺循环热机效率热传导对流辐射比热容熔化汽化升华潜热表面张力毛细润湿"
        "横波纵波机械波声波超声次声干涉衍射多普勒效应驻波波速波阵面惠更斯原理薄膜干涉双缝干涉单缝衍射光栅偏振偏振片偏振化方向布儒斯特角"
        "全反射折射率光速临界角色散色散棱镜凸透镜凹透镜成像焦点焦距实像虚像放大缩小正立倒立物距像距放大镜显微镜望远镜"
        "实验探究验证测量误差系统偶然有效数字游标卡尺螺旋测微器千分尺打点计时器频闪照相纸带光电门传感器多用电表欧姆调零校准步骤注意事项"
        "核心破题点识别特征确立切换开关定值电阻切割竖直向上水平分速度产生感应电流内侧板正电外侧带负电错误任意时刻电场能成正比"
        "隐藏等效关联条件参数关系充电安培力代入整理恒定达到棒速解得运动时间正确此时说明平衡求得回路剩余部分保持进入初速度仍然"
        "并非滑行路程直接利用避开复杂微积分电荷量公式可得化简得出综上选项为题图可知球两释放间距最小远大于随着增大减小牛顿第二定律"
        "只要相同便持续恰好此时达到若越过该位置继续上滑导致反向将做减速因此等于临界条件针对第问依据列方程直接求隐含求得位移再由"
        "改变量可知做功结合过程列动能定理直接解得"
    )

    # 2. GB2312 一级高频常用汉字
    gb_chars = []
    for qu in range(16, 56):
        for wei in range(1, 95):
            try:
                b = bytes([0xa0 + qu, 0xa0 + wei])
                gb_chars.append(b.decode('gb2312'))
            except Exception:
                pass

    char_set = set(physics_vocab)
    for c in gb_chars:
        char_set.add(c)
        if len(char_set) >= 2050:
            break

    # 3. 常见标点符号
    for p in '，。！？；：“”‘’（）【】《》、…—～·+-*/=<>≤≥≠≈':
        char_set.add(p)

    return char_set

def transform_glyph(coords, gname, variant_idx):
    if len(coords) == 0:
        return coords

    xs = [p[0] for p in coords]
    ys = [p[1] for p in coords]
    cx = (min(xs) + max(xs)) / 2.0
    cy = (min(ys) + max(ys)) / 2.0
    W = max(1.0, float(max(xs) - min(xs)))
    H = max(1.0, float(max(ys) - min(ys)))

    # 确定性伪随机数生成器（按字形名和变体号哈希）
    h = 0
    for ch in gname:
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    seed = (h ^ (variant_idx * 0x9E3779B9)) & 0xFFFFFFFF
    rng = random.Random(seed)

    new_coords = []

    if variant_idx == 1:
        # 变体 1 (`var1` · 修长聚心态)：
        # 水平微缩 sx ∈ [0.965, 0.985], sy = 1/sx；右上微倾剪切 shear_y ∈ [+1.0°, +1.8°]；中宫微聚 2%
        sx = rng.uniform(0.965, 0.982)
        sy = 1.0 / sx
        shear_y = math.radians(rng.uniform(1.0, 1.8))
        Ax = rng.uniform(8.0, 13.0)
        Ay = rng.uniform(7.0, 12.0)
        w1 = rng.uniform(0.85, 1.15)
        w2 = rng.uniform(0.85, 1.15)
        phi1 = rng.uniform(0, math.pi * 2)
        phi2 = rng.uniform(0, math.pi * 2)

        for x, y in coords:
            x1 = cx + (x - cx) * sx
            y1 = cy + (y - cy) * sy
            y2 = y1 + (x1 - cx) * math.tan(shear_y)
            x2 = x1
            r = math.sqrt(((x2 - cx) / W) ** 2 + ((y2 - cy) / H) ** 2)
            if r < 0.5:
                pull = 0.02 * (1.0 - 2.0 * r)
                x2 -= (x2 - cx) * pull
                y2 -= (y2 - cy) * pull
            dx_wave = Ax * math.sin(2 * math.pi * (y2 - cy) / H * w1 + phi1)
            dy_wave = Ay * math.cos(2 * math.pi * (x2 - cx) / W * w2 + phi2)
            new_coords.append((round(x2 + dx_wave), round(y2 + dy_wave)))

    elif variant_idx == 2:
        # 变体 2 (`var2` · 扁阔舒展态)：
        # 水平微展 sx ∈ [1.02, 1.04], sy = 1/sx；水平微剪切 shear_x ∈ [-1.2°, +0.8°]；低频空间波
        sx = rng.uniform(1.02, 1.038)
        sy = 1.0 / sx
        shear_x = math.radians(rng.uniform(-1.2, 0.8))
        Ax = rng.uniform(9.0, 14.0)
        Ay = rng.uniform(8.0, 13.0)
        w1 = rng.uniform(0.65, 0.85)
        w2 = rng.uniform(0.65, 0.85)
        phi1 = rng.uniform(0, math.pi * 2)
        phi2 = rng.uniform(0, math.pi * 2)

        for x, y in coords:
            x1 = cx + (x - cx) * sx
            y1 = cy + (y - cy) * sy
            x2 = x1 + (y1 - cy) * math.tan(shear_x)
            y2 = y1
            dx_wave = Ax * math.sin(2 * math.pi * (y2 - cy) / H * w1 + phi1)
            dy_wave = Ay * math.cos(2 * math.pi * (x2 - cx) / W * w2 + phi2)
            new_coords.append((round(x2 + dx_wave), round(y2 + dy_wave)))

    elif variant_idx == 3:
        # 变体 3 (`var3` · 左敛右扬态)：
        # 非对称空间场：左侧紧凑 s_left ∈ [0.95, 0.98]，右侧主笔向右上方舒展发力
        s_left = rng.uniform(0.955, 0.98)
        Ax = rng.uniform(8.0, 13.0)
        Ay = rng.uniform(8.0, 13.0)
        w1 = rng.uniform(0.8, 1.1)
        w2 = rng.uniform(0.8, 1.1)
        phi1 = rng.uniform(0, math.pi * 2)
        phi2 = rng.uniform(0, math.pi * 2)

        for x, y in coords:
            if x < cx:
                x1 = cx + (x - cx) * s_left
                y1 = y
            else:
                x1 = cx + (x - cx) * 1.032
                y1 = y + (x - cx) * 0.030  # 笔画向右上微扬
            dx_wave = Ax * math.sin(2 * math.pi * (y1 - cy) / H * w1 + phi1)
            dy_wave = Ay * math.cos(2 * math.pi * (x1 - cx) / W * w2 + phi2)
            new_coords.append((round(x1 + dx_wave), round(y1 + dy_wave)))

    elif variant_idx == 4:
        # 变体 4 (`var4` · 内紧外松态)：
        # 非线性径向重映射：内部 (r < 0.45) 笔画微缩 3%~4%，外部 (r > 0.5) 笔画微张 2%~3%
        Ax = rng.uniform(8.0, 13.0)
        Ay = rng.uniform(8.0, 13.0)
        w1 = rng.uniform(0.85, 1.1)
        w2 = rng.uniform(0.85, 1.1)
        phi1 = rng.uniform(0, math.pi * 2)
        phi2 = rng.uniform(0, math.pi * 2)

        for x, y in coords:
            r = math.sqrt(((x - cx) / W) ** 2 + ((y - cy) / H) ** 2)
            if r < 0.5:
                scale = 1.0 - 0.035 * (1.0 - 2.0 * r)
            else:
                scale = 1.0 + 0.024 * min(1.0, 2.0 * r - 1.0)
            x1 = cx + (x - cx) * scale
            y1 = cy + (y - cy) * scale
            dx_wave = Ax * math.sin(2 * math.pi * (y1 - cy) / H * w1 + phi1)
            dy_wave = Ay * math.cos(2 * math.pi * (x1 - cx) / W * w2 + phi2)
            new_coords.append((round(x1 + dx_wave), round(y1 + dy_wave)))

    elif variant_idx == 5:
        # 变体 5 (`var5` · 疾书连贯态)：
        # 顺时针微倾 shear_x ∈ [+1.5°, +2.2°]，叠加略高频平滑空间场
        shear_x = math.radians(rng.uniform(1.5, 2.2))
        Ax = rng.uniform(10.0, 15.0)
        Ay = rng.uniform(9.0, 14.0)
        w1 = rng.uniform(0.95, 1.25)
        w2 = rng.uniform(0.95, 1.25)
        phi1 = rng.uniform(0, math.pi * 2)
        phi2 = rng.uniform(0, math.pi * 2)

        for x, y in coords:
            x1 = x + (y - cy) * math.tan(shear_x)
            y1 = y
            dx_wave = Ax * math.sin(2 * math.pi * (y1 - cy) / H * w1 + phi1)
            dy_wave = Ay * math.cos(2 * math.pi * (x1 - cx) / W * w2 + phi2)
            new_coords.append((round(x1 + dx_wave), round(y1 + dy_wave)))

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
    print(f"Loading base font from: {base_font_path}")

    # 1. 提取目标高频字符集
    target_chars = get_target_characters()
    print(f"Target characters pool size: {len(target_chars)}")

    base_font = TTFont(base_font_path)
    cmap = base_font.getBestCmap()

    # 收集在原字体中存在的目标 Unicode
    unicodes = [ord(c) for c in target_chars if ord(c) in cmap]
    # 强制纳入 ASCII 打印字符 (32 ~ 126)
    for cp in range(32, 127):
        if cp in cmap:
            unicodes.append(cp)
    unicodes = sorted(list(set(unicodes)))
    print(f"Matched Unicode codepoints in font: {len(unicodes)}")

    # 2. 先做基础子集化 (Subsetting)
    print("Subsetting base font to high-priority glyphs...")
    options = subset.Options()
    options.flavor = 'woff2'
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=unicodes)
    subsetter.subset(base_font)

    # 暂存为内存中的 TTF/WOFF2 基础对象
    subset_buf = io.BytesIO()
    base_font.save(subset_buf)
    subset_bytes = subset_buf.getvalue()
    print(f"Subset base font size: {len(subset_bytes)} bytes (~{round(len(subset_bytes)/1024)} KB)")

    # 3. 循环衍生 5 套变体字体
    out_dirs = [
        os.path.join('public', 'fonts'),
        '.'
    ]
    for d in out_dirs:
        os.makedirs(d, exist_ok=True)

    for v_idx in range(1, 6):
        family_name = f"MyHandwriting-Var{v_idx}"
        print(f"\n--- Generating Variant {v_idx}: {family_name} ---")
        
        # 重新从子集字节流加载，保证纯净隔离
        v_font = TTFont(io.BytesIO(subset_bytes))
        glyf = v_font['glyf']
        hmtx = v_font['hmtx']

        glyph_names = v_font.getGlyphOrder()
        modified_count = 0

        for gname in glyph_names:
            g = glyf[gname]
            if g.numberOfContours > 0 and not g.isComposite():
                orig_coords = g.coordinates
                new_coords = transform_glyph(orig_coords, gname, v_idx)
                g.coordinates = new_coords
                g.recalcBounds(glyf)
                
                # 同步更新水平度量表 hmtx 的 lsb
                adv, _ = hmtx[gname]
                hmtx[gname] = (adv, g.xMin)
                modified_count += 1

        print(f"Variant {v_idx}: Deformed and recalculated bounds for {modified_count} glyphs.")

        # 更新字体元数据表
        update_name_table(v_font, family_name)
        v_font.flavor = 'woff2'

        # 保存输出文件
        filename = f"myfont-var{v_idx}.woff2"
        for out_dir in out_dirs:
            target_path = os.path.join(out_dir, filename)
            v_font.save(target_path)
            size_kb = round(os.path.getsize(target_path) / 1024)
            print(f"Saved: {target_path} ({size_kb} KB)")

    print("\nSUCCESS: All 5 font variants generated cleanly!")

if __name__ == '__main__':
    main()
