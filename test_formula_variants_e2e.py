import os
import base64
from playwright.sync_api import sync_playwright

USER_TEXT = r"""<red>学生的书写完全正确</red>，碘-125 俘获核外内层电子衰变为碲的核反应方程为 $^{125}_{\ 53}\text{I} + {^{\ 0}_{-1}\text{e}} \rightarrow {^{125}_{\ 52}\text{Te}}$。在产生 MNN 俄歇电子的过程中，M 层电子空缺，N 层一个电子跃迁填补该空缺时释放的能量为 $\Delta E = E_{\text{m}} - E_{\text{n}}$，该能量用于电离并打出 N 层上的另一个电子。由能量守恒定律可知：
$$E_{\text{MNN}} = E_{\text{m}} - E_{\text{n}} - E'_{\text{n}}$$
代入题目所给数据计算：
$$E_{\text{MNN}} = 583\text{eV} - 42\text{eV} - 41\text{eV} = 500\text{eV}$$
由此求得 <red>MNN 俄歇电子的动能数值为 500eV</red>。对于进入长方体电子磁谱仪的俄歇电子，其动能分别为 $E_{\text{MNN}} = 500\text{eV} = 0.5\text{keV}$、$E_{\text{LMM}} = 3.2\text{keV}$ 和 $E_{\text{KLL}} = 23\text{keV}$。当两滑块达到共同速度 $v_{\text{共}}$ 时，由动量守恒与能量守恒得 $m_1 v_1 + m_2 v_2 = (m_1 + m_2)v_{\text{共}}$，合外力做功 $\sum W_{\text{合}} = \Delta E_{\text{k共}} \neq 0$，且满足 $\theta \approx 30^\circ$、$x'' + \omega^2 x = 0$。电子垂直磁场方向射入匀强磁场后，洛伦兹力提供向心力，根据牛顿第二定律有：
$$e v B = \frac{m v^2}{r} \implies r = \frac{m v}{e B} = \frac{\sqrt{2m E_{\text{k}}}}{e B}$$
结合动能公式 $E_{\text{k}} = \frac{1}{2}m v^2$ 与 $r_1 = \frac{x}{2}$，经化简可得 <red>电子 1 出射点距离为 $x = \frac{2\sqrt{2m E_{\text{MNN}}}}{e B}$</red>，且轨道半径之比满足：
$$\frac{r_2}{r_1} = \sqrt{\frac{E_{\text{LMM}}}{E_{\text{MNN}}}} = \frac{4\sqrt{10}}{5} \implies r_2 = \frac{2\sqrt{10}}{5}x, \quad r_3 = \frac{\sqrt{46}}{2}x$$"""

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, channel="msedge")
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        dist_index = r"file:///C:/Users/wb686/.gemini/antigravity/scratch/physics-typesetter-nonlinear/dist/index.html"
        # Serve dist via local http server so @font-face /fonts/... loads properly
        import threading, http.server, functools
        dist_dir = r"C:\Users\wb686\.gemini\antigravity\scratch\physics-typesetter-nonlinear\dist"
        handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=dist_dir)
        httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        port = httpd.server_port
        t = threading.Thread(target=httpd.serve_forever, daemon=True)
        t.start()

        page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="networkidle")
        page.fill("#ai-input", USER_TEXT)
        page.click("#gen-btn")
        page.wait_for_selector(".output-card img", timeout=30000)

        imgs = page.query_selector_all(".output-card img")
        print(f"Rendered {len(imgs)} pages.")
        for idx, img in enumerate(imgs):
            src = img.get_attribute("src")
            b64 = src.split(",", 1)[1]
            out_file = os.path.join(
                r"C:\Users\wb686\.gemini\antigravity\scratch\physics-typesetter-nonlinear",
                f"verify_formula_variants_p{idx+1}.jpg"
            )
            with open(out_file, "wb") as f:
                f.write(base64.b64decode(b64))
            print("Saved:", out_file)

        httpd.shutdown()
        browser.close()

if __name__ == "__main__":
    main()
