package com.yazhang.xueba;

import android.annotation.SuppressLint;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.graphics.Insets;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ValueCallback;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;

/**
 * 成为学霸 — thin WebView host for the offline app in assets/www.
 *
 * The app ships no network permission; every asset is local. Navigation,
 * including the hardware back button, is owned by the page itself (it keeps
 * a history entry per view), so back closes the open sheet or dialog before
 * it pops a screen, and only exits from the root.
 */
public class MainActivity extends Activity {

    private static final int REQ_PICK_IMAGE = 1001;

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    // -1 so the first callback always pushes a value through.
    private int lastTop = -1;
    private int lastBottom = -1;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Edge-to-edge: the page's own gradient paints under the status and
        // navigation bars, and viewport-fit=cover feeds the bar heights back to
        // CSS as env(safe-area-inset-*) so content still clears them.
        // Transparent bars are only honoured once the decor stops fitting
        // system windows, so these two must go together.
        Window w = getWindow();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            w.setDecorFitsSystemWindows(false);
        } else {
            w.getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
        w.setStatusBarColor(Color.TRANSPARENT);
        w.setNavigationBarColor(Color.TRANSPARENT);
        // Let the gradient run into the punch-hole/notch row too, otherwise the
        // system letterboxes that strip black.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            w.getAttributes().layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        // Pre-Q devices force a scrim onto a transparent nav bar otherwise.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            w.setNavigationBarContrastEnforced(false);
            w.setStatusBarContrastEnforced(false);
        }

        web = new WebView(this);
        web.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        web.setBackgroundColor(Color.parseColor("#070b1f"));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        // WebView derives env(safe-area-inset-*) from the display cutout only,
        // so on a device with no notch the status bar would still overlap the
        // header. Push the measured bar heights in as CSS variables instead,
        // and let the stylesheet fall back to env() when this never fires.
        web.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            public WindowInsets onApplyWindowInsets(View v, WindowInsets in) {
                int top, bottom;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    Insets bars = in.getInsets(
                            WindowInsets.Type.statusBars() | WindowInsets.Type.displayCutout());
                    top = bars.top;
                    bottom = in.getInsets(WindowInsets.Type.navigationBars()).bottom;
                } else {
                    top = in.getSystemWindowInsetTop();
                    bottom = in.getSystemWindowInsetBottom();
                }
                applyInsets(top, bottom);
                return in;
            }
        });

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // localStorage holds all app data
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        }
        // Keep the UI at the size the design was built for, ignoring the
        // system font scale that would otherwise reflow the fixed layout.
        s.setTextZoom(100);

        // Nothing in this app should ever leave the bundled assets.
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                // The first inset callback usually lands before the document
                // exists, so that setProperty goes nowhere. Re-push here, and
                // reset the cache first so the no-change guard can't skip it.
                lastTop = -1;
                lastBottom = -1;
                view.requestApplyInsets();
            }
        });

        // Without this the page's <input type="file"> is silently ignored,
        // so the avatar picker would do nothing when tapped.
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view,
                                             ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (fileCallback != null) {
                    fileCallback.onReceiveValue(null);
                }
                fileCallback = callback;

                // ACTION_GET_CONTENT needs no storage permission: the picker
                // runs in its own process and hands back a single URI grant.
                Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
                pick.setType("image/*");
                pick.addCategory(Intent.CATEGORY_OPENABLE);
                try {
                    startActivityForResult(
                            Intent.createChooser(pick, "选择头像图片"),
                            REQ_PICK_IMAGE);
                    return true;
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
            }
        });

        setContentView(web);
        web.loadUrl("file:///android_asset/www/index.html");
    }

    /** Publishes the system bar heights to CSS as --inset-top / --inset-bottom. */
    private void applyInsets(int topPx, int bottomPx) {
        // Insets are physical pixels; CSS works in density-independent ones.
        float d = getResources().getDisplayMetrics().density;
        if (d <= 0) d = 1f;
        final int top = Math.round(topPx / d);
        final int bottom = Math.round(bottomPx / d);
        if (top == lastTop && bottom == lastBottom) return;
        lastTop = top;
        lastBottom = bottom;

        final String js = "document.documentElement.style.setProperty("
                + "'--inset-top','" + top + "px');"
                + "document.documentElement.style.setProperty("
                + "'--inset-bottom','" + bottom + "px');";
        // Runs on every inset change, including the first one after load.
        web.post(new Runnable() {
            @Override public void run() { web.evaluateJavascript(js, null); }
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != REQ_PICK_IMAGE) {
            super.onActivityResult(requestCode, resultCode, data);
            return;
        }
        if (fileCallback == null) return;

        Uri[] result = null;
        if (resultCode == RESULT_OK && data != null && data.getData() != null) {
            result = new Uri[]{ data.getData() };
        }
        // Passing null tells the WebView the picker was cancelled, which
        // matters: omitting it leaves the file input permanently stuck.
        fileCallback.onReceiveValue(result);
        fileCallback = null;
    }

    /**
     * Hand back presses to the page first. It only declines to consume one
     * when it is at the root view with no sheet or dialog open, at which
     * point the default behaviour finishes the activity.
     */
    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
