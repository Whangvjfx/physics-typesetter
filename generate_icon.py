import math
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def create_nonlinear_icon(size=1024):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 1. Base Dark Background with Rounded Squircle
    # Create background mask with rounded rectangle
    bg = Image.new("RGBA", (size, size), (10, 14, 23, 255)) # Dark navy obsidian
    bg_draw = ImageDraw.Draw(bg)

    # Radial gradient in background
    cx, cy = size // 2, size // 2
    for r in range(size // 2, 0, -4):
        alpha = int(35 * (1 - r / (size / 2)))
        # Subtle cyan-emerald glow in center
        color = (16, 185, 129, alpha) if r > size // 3 else (245, 158, 11, alpha)
        bg_draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)

    # Background subtle ruled lines representing physics paper
    line_color = (255, 255, 255, 18)
    for y in range(120, size - 100, 72):
        bg_draw.line([(80, y), (size - 80, y)], fill=line_color, width=2)

    # 2. Draw Mathematical Nonlinear Phase Portrait / Chaotic Attractor Curves
    # Nonlinear Duffing / Strange Attractor spiral trajectory
    curve_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    curve_draw = ImageDraw.Draw(curve_layer)

    points_gold = []
    points_cyan = []
    
    # Lorenz/Rössler-style nonlinear 2D projection
    dt = 0.015
    x, y, z = 0.1, 0.0, 0.0
    for i in range(1800):
        # Nonlinear differential equations
        dx = -y - z
        dy = x + 0.2 * y
        dz = 0.2 + z * (x - 5.7)
        x += dx * dt
        y += dy * dt
        z += dz * dt
        
        px = cx + int(x * 24 + y * 8)
        py = cy - 40 + int(y * 22 - z * 10)
        
        if 80 < px < size - 80 and 80 < py < size - 80:
            if i % 2 == 0:
                points_gold.append((px, py))
            else:
                points_cyan.append((px, py))

    # Draw glow for nonlinear curves
    if len(points_gold) > 2:
        for offset in [(0, 0), (1, 1), (-1, -1)]:
            curve_draw.line(points_gold, fill=(245, 158, 11, 200), width=4)
    if len(points_cyan) > 2:
        curve_draw.line(points_cyan, fill=(0, 240, 255, 180), width=3)

    # Blur curve glow slightly
    glow_curve = curve_layer.filter(ImageFilter.GaussianBlur(radius=6))
    bg.paste(Image.alpha_composite(curve_layer, glow_curve), (0, 0), curve_layer)

    # 3. Main Glyph: "非线性" or stylized "NL" and Chinese Typography
    text_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    text_draw = ImageDraw.Draw(text_layer)

    # Try font loading
    font_path = r"C:\Windows\Fonts\msyh.ttc"
    try:
        font_main = ImageFont.truetype(font_path, 210)
        font_sub = ImageFont.truetype(font_path, 68)
        font_en = ImageFont.truetype(font_path, 52)
    except Exception:
        font_main = ImageFont.load_default()
        font_sub = ImageFont.load_default()
        font_en = ImageFont.load_default()

    # Text "非线性" in gold with gradient shadow
    title = "非线性"
    bbox = text_draw.textbbox((0, 0), title, font=font_main)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = (size - tw) // 2
    ty = cy - th // 2 - 20

    # Glow shadow
    for sx, sy in [(-3, -3), (3, 3), (-3, 3), (3, -3), (0, 5), (0, -5)]:
        text_draw.text((tx + sx, ty + sy), title, font=font_main, fill=(0, 240, 255, 60))
    # Outer gold glow
    for sx, sy in [(-2, 0), (2, 0), (0, -2), (0, 2)]:
        text_draw.text((tx + sx, ty + sy), title, font=font_main, fill=(245, 158, 11, 140))
    # Core luminous white-gold text
    text_draw.text((tx, ty), title, font=font_main, fill=(255, 252, 240, 255))

    # Subtitle: "PHYSICS TYPESETTER"
    sub_en = "NONLINEAR TYPESETTER"
    bbox_en = text_draw.textbbox((0, 0), sub_en, font=font_en)
    tw_en = bbox_en[2] - bbox_en[0]
    text_draw.text(((size - tw_en) // 2, ty + th + 60), sub_en, font=font_en, fill=(0, 240, 255, 220))

    # Small physics formula badge at top: "x' = f(x, y, t)"
    formula = "dx/dt = f(x, y)"
    bbox_f = text_draw.textbbox((0, 0), formula, font=font_en)
    tw_f = bbox_f[2] - bbox_f[0]
    text_draw.text(((size - tw_f) // 2, 140), formula, font=font_en, fill=(245, 158, 11, 190))

    # Combine text
    final_img = Image.alpha_composite(bg, text_layer)

    # 4. Apply modern iOS squircle mask or save full bleed
    # iOS AppIcon should be square without transparency (Xcode applies the squircle mask)
    # We output RGB 1024x1024 for AppStore / iOS app icon
    rgb_icon = Image.new("RGB", (size, size), (10, 14, 23))
    rgb_icon.paste(final_img, (0, 0), final_img)
    return rgb_icon

if __name__ == '__main__':
    icon = create_nonlinear_icon(1024)
    # Save to iOS AppIcon
    ios_icon_path = r"C:\Users\wb686\.gemini\antigravity\scratch\physics-typesetter-nonlinear\ios\App\App\Assets.xcassets\AppIcon.appiconset\AppIcon-512@2x.png"
    icon.save(ios_icon_path, "PNG")
    print("Saved iOS AppIcon to:", ios_icon_path)

    # Save to public web icons
    icon_512 = icon.resize((512, 512), Image.Resampling.LANCZOS)
    icon_512.save(r"C:\Users\wb686\.gemini\antigravity\scratch\physics-typesetter-nonlinear\public\icons\icon-512.png", "PNG")
    icon_192 = icon.resize((192, 192), Image.Resampling.LANCZOS)
    icon_192.save(r"C:\Users\wb686\.gemini\antigravity\scratch\physics-typesetter-nonlinear\public\icons\icon-192.png", "PNG")
    icon_64 = icon.resize((64, 64), Image.Resampling.LANCZOS)
    icon_64.save(r"C:\Users\wb686\.gemini\antigravity\scratch\physics-typesetter-nonlinear\public\favicon.png", "PNG")

    # Save desktop preview
    os.makedirs(r"C:\Users\wb686\Desktop\非线性", exist_ok=True)
    icon.save(r"C:\Users\wb686\Desktop\非线性\非线性-AppIcon.png", "PNG")
    print("Saved Desktop icon preview to C:\\Users\\wb686\\Desktop\\非线性\\非线性-AppIcon.png")
