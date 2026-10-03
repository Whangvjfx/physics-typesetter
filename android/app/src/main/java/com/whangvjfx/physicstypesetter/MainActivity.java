package com.whangvjfx.physicstypesetter;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        lockTextZoom();
    }

    @Override
    public void onResume() {
        super.onResume();
        // 用户在系统设置里调整字体大小后返回 App，也要重新锁定
        lockTextZoom();
    }

    /**
     * 【安卓排版错位根因修复】
     * Android WebView 默认会把系统“字体大小/大字体”设置作为 textZoom 应用到网页，
     * Blink 会同时放大字号和所有固定 px 行高（60px → 约 70px），但横线背景(60px)
     * 和分页高度(780/1020px)不会被放大，导致每行累积下沉、分页把字拦腰截断。
     * 排版是固定尺寸的 A4 渲染，必须锁定为 100%，与 iOS / 电脑端像素级一致。
     */
    private void lockTextZoom() {
        if (bridge == null) return;
        WebView webView = bridge.getWebView();
        if (webView == null) return;
        WebSettings settings = webView.getSettings();
        settings.setTextZoom(100);
        settings.setMinimumFontSize(1);
        settings.setMinimumLogicalFontSize(1);
    }
}
