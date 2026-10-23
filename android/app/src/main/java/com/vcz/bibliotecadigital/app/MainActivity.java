package com.vcz.bibliotecadigital.app;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.graphics.Bitmap;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private final Handler connectionHandler = new Handler(Looper.getMainLooper());
    private Runnable connectionTimeout;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        bridge.setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                cancelConnectionTimeout();
                if (!url.equals(bridge.getErrorUrl())) {
                    connectionTimeout = () -> {
                        view.stopLoading();
                        view.loadUrl(bridge.getErrorUrl());
                    };
                    connectionHandler.postDelayed(connectionTimeout, 20000);
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                // Ignore completion callbacks for an earlier, failed navigation.
                if (!url.equals(view.getUrl())) return;
                cancelConnectionTimeout();
                if (url.equals(bridge.getErrorUrl())) {
                    String target = bridge.getServerUrl();
                    if (target == null) target = bridge.getAppUrl();
                    view.evaluateJavascript("window.configureConnectionRetry(" + JSONObject.quote(target) + ");", null);
                }
            }
        });
    }

    private void cancelConnectionTimeout() {
        if (connectionTimeout != null) connectionHandler.removeCallbacks(connectionTimeout);
    }

    @Override
    public void onDestroy() {
        cancelConnectionTimeout();
        super.onDestroy();
    }
}
