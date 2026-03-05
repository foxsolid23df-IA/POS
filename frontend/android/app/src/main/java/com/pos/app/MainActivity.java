package com.pos.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onStart() {
        super.onStart();

        // Retrieve the WebView after Bridge initialization
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            WebSettings settings = webView.getSettings();

            // Allow responsive scaling while preserving design aspects
            settings.setLoadWithOverviewMode(true);
            settings.setUseWideViewPort(true);

            // Fix text scaling issues when users change OS font size (always 100%)
            settings.setTextZoom(100);

            // Configure scrolling behaviors to allow overflow inside web view
            webView.setVerticalScrollBarEnabled(true);
            webView.setOverScrollMode(WebView.OVER_SCROLL_ALWAYS);
        }
    }
}
