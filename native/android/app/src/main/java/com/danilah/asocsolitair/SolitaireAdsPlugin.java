package com.danilah.asocsolitair;

import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.View;
import android.view.Gravity;
import android.widget.FrameLayout;
import com.yandex.mobile.ads.banner.*;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.yandex.mobile.ads.common.*;
import com.yandex.mobile.ads.interstitial.*;
import com.yandex.mobile.ads.rewarded.*;
import org.json.JSONObject;
import java.util.UUID;

/** Adapted from Road Lines 180d5b1. All SDK operations and session transitions belong to the main thread. */
@CapacitorPlugin(name = "SolitaireAds")
public class SolitaireAdsPlugin extends Plugin {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean ready, destroyed, background, preparing;
    private int preloadGeneration;
    private long retryAt;
    private BannerAdView banner;
    private int bannerWidth;
    private long bannerGeneration, bannerRetryAt;
    private boolean bannerLoaded, bannerWanted;
    private InterstitialAdLoader interLoader;
    private RewardedAdLoader rewardLoader;
    private InterstitialAd interstitial;
    private RewardedAd rewarded;
    private RewardJournal journal;
    private Session session;
    private final android.view.ViewTreeObserver.OnWindowFocusChangeListener focusListener = focused -> {
        if (focused && session != null && session.invoked && !session.shown) checkUnshown(session);
    };
    private static final class Session {
        final PluginCall call;
        final String kind, placement, attempt, mode, dealId;
        final String id = UUID.randomUUID().toString();
        boolean invoked, shown, earned;
        long invokedAt;
        Session(PluginCall call, String kind, String placement, String attempt, String mode, String dealId) {
            this.call = call; this.kind = kind; this.placement = placement; this.attempt = attempt; this.mode = mode; this.dealId = dealId;
        }
    }
    @Override public void load() {
        journal = new RewardJournal(getContext());
        getActivity().getWindow().getDecorView().getViewTreeObserver().addOnWindowFocusChangeListener(focusListener);
        if (BuildConfig.AD_MODE.equals("disabled")) return;
        handler.post(() -> {
            try {
                YandexAds.setLocationTracking(false);
                YandexAds.initialize(getContext(), () -> handler.post(() -> {
                    if (destroyed) return;
                    interLoader = new InterstitialAdLoader(getContext());
                    rewardLoader = new RewardedAdLoader(getContext()); ready = true;
                }));
            } catch (RuntimeException ignored) { event("interstitial", "init_error"); }
        });
    }
    private String unit(String kind) {
        return kind.equals("banner") ? BuildConfig.BANNER_AD_UNIT_ID : kind.equals("rewarded") ? BuildConfig.REWARDED_AD_UNIT_ID : BuildConfig.INTERSTITIAL_AD_UNIT_ID;
    }
    private boolean available(String kind) { return ready && !destroyed && !unit(kind).isEmpty(); }
    private void event(String kind, String phase) {
        if (destroyed) return;
        JSObject e = new JSObject(); e.put("kind", kind); e.put("phase", phase); notifyListeners("adEvent", e);
    }
    @PluginMethod public void status(PluginCall call) { handler.post(() -> {
        JSObject result = new JSObject(); result.put("ready", ready); result.put("mode", BuildConfig.AD_MODE);
        result.put("banner", available("banner")); result.put("rewarded", available("rewarded")); result.put("interstitial", available("interstitial")); call.resolve(result);
    }); }
    @PluginMethod public void prepareInterstitial(PluginCall call) { handler.post(() -> {
        call.resolve();
        if (!available("interstitial") || preparing || interstitial != null || session != null || background || SystemClock.elapsedRealtime() < retryAt) return;
        final int generation = ++preloadGeneration;
        preparing = true; event("interstitial", "request");
        Runnable timeout = () -> {
            if (!preparing || generation != preloadGeneration) return;
            preparing = false; preloadGeneration++; retryAt = SystemClock.elapsedRealtime() + 30000;
            interLoader.cancelLoading(); event("interstitial", "load_error");
        };
        handler.postDelayed(timeout, 15000);
        try {
            interLoader.loadAd(new AdRequest.Builder(unit("interstitial")).build(), new InterstitialAdLoadListener() {
                public void onAdLoaded(@NonNull InterstitialAd ad) {
                    if (destroyed || generation != preloadGeneration) { ad.setAdEventListener(null); return; }
                    handler.removeCallbacks(timeout); preparing = false; interstitial = ad; event("interstitial", "loaded");
                }
                public void onAdFailedToLoad(@NonNull AdRequestError error) {
                    if (destroyed || generation != preloadGeneration) return;
                    handler.removeCallbacks(timeout); preparing = false; retryAt = SystemClock.elapsedRealtime() + 30000;
                    event("interstitial", "load_error");
                }
            });
        } catch (RuntimeException error) { timeout.run(); }
    }); }
    @PluginMethod public void show(PluginCall call) { handler.post(() -> {
        String kind = call.getString("kind", ""), placement = call.getString("placement", "");
        String attempt = call.getString("attempt", ""), mode = call.getString("mode", "");
        String dealId = call.getString("dealId", "");
        if ((!kind.equals("interstitial") && !kind.equals("rewarded")) ||
            !attempt.matches("[a-zA-Z0-9_-]{1,100}") || !dealId.matches("[a-zA-Z0-9_-]{1,100}") || (!mode.equals("campaign") && !mode.equals("daily")) ||
            (kind.equals("rewarded") ? !placement.equals("hint") && !placement.equals("undo") && !placement.equals("continue") : !placement.equals("continue"))) {
            call.reject("Invalid ad request"); return;
        }
        if (!available(kind) || session != null || background || !getActivity().hasWindowFocus()) { resolve(call, false, "unavailable"); return; }
        try { if (journal.pending() != null) { resolve(call, false, "unavailable"); return; } }
        catch (Exception error) { resolve(call, false, "unavailable"); return; }
        Session s = new Session(call, kind, placement, attempt, mode, dealId); session = s; hide();
        try {
            if (kind.equals("interstitial")) {
                if (interstitial == null) { finish(s, "unavailable"); return; }
                interstitial.setAdEventListener(new InterstitialAdEventListener() {
                    public void onAdShown() { shown(s); }
                    public void onAdFailedToShow(@NonNull AdError error) { if (session == s) { event(kind, "show_error"); finish(s, "error"); } }
                    public void onAdDismissed() { if (session == s) { event(kind, "dismiss"); finish(s, "dismissed"); } }
                    public void onAdClicked() {}
                    public void onAdImpression(@Nullable ImpressionData data) { if (session == s) event(kind, "impression"); }
                });
                beforeShow(s); interstitial.show(getActivity());
            } else {
                event(kind, "request");
                handler.postDelayed(() -> { if (session == s && !s.invoked) finish(s, "unavailable"); }, 15000);
                rewardLoader.loadAd(new AdRequest.Builder(unit(kind)).build(), new RewardedAdLoadListener() {
                    public void onAdLoaded(@NonNull RewardedAd ad) {
                        if (session != s || destroyed) { ad.setAdEventListener(null); return; }
                        if (background || !getActivity().hasWindowFocus()) { ad.setAdEventListener(null); finish(s, "cancelled"); return; }
                        rewarded = ad; event(kind, "loaded"); displayRewarded(s);
                    }
                    public void onAdFailedToLoad(@NonNull AdRequestError error) {
                        if (session == s) { event(kind, "load_error"); finish(s, "error"); }
                    }
                });
            }
        } catch (RuntimeException error) { event(kind, "show_error"); finish(s, "error"); }
    }); }
    private void beforeShow(Session s) {
        s.invoked = true; s.invokedAt = SystemClock.elapsedRealtime();
        handler.postDelayed(() -> checkUnshown(s), 8000);
    }
    private void checkUnshown(Session s) {
        if (session != s || s.shown || background || !getActivity().hasWindowFocus()) return;
        long remaining = 8000 - (SystemClock.elapsedRealtime() - s.invokedAt);
        if (remaining > 0) { handler.postDelayed(() -> checkUnshown(s), remaining); return; }
        event(s.kind, "show_error"); finish(s, "error");
    }
    private void shown(Session s) { if (session == s) { s.shown = true; event(s.kind, "show"); } }
    private void displayRewarded(Session s) {
        rewarded.setAdEventListener(new RewardedAdEventListener() {
            public void onAdShown() { shown(s); }
            public void onAdFailedToShow(@NonNull AdError error) { if (session == s) { event(s.kind, "show_error"); finish(s, "error"); } }
            public void onAdDismissed() { if (session == s) { event(s.kind, "dismiss"); finish(s, "dismissed"); } }
            public void onAdClicked() {}
            public void onAdImpression(@Nullable ImpressionData data) { if (session == s) event(s.kind, "impression"); }
            public void onRewarded(@NonNull Reward reward) {
                if (session != s || s.earned) return;
                s.earned = true;
                try {
                    JSONObject receipt = new JSONObject(); receipt.put("schema", 1); receipt.put("id", s.id);
                    receipt.put("placement", s.placement); receipt.put("attempt", s.attempt); receipt.put("mode", s.mode); receipt.put("dealId", s.dealId);
                    journal.record(receipt); event(s.kind, "earned");
                } catch (Exception error) { event(s.kind, "receipt_pending"); }
            }
        });
        beforeShow(s);
        try { rewarded.show(getActivity()); }
        catch (RuntimeException error) { event(s.kind, "show_error"); finish(s, "error"); }
    }
    @PluginMethod public void pending(PluginCall call) { handler.post(() -> {
        try {
            JSONObject receipt = journal.pending(); JSArray receipts = new JSArray(); if (receipt != null) receipts.put(receipt);
            JSObject result = new JSObject(); result.put("receipts", receipts); call.resolve(result);
        } catch (Exception error) { call.reject("Earned receipt storage unavailable"); }
    }); }
    @PluginMethod public void acknowledge(PluginCall call) { handler.post(() -> {
        try { journal.acknowledge(call.getString("id", "")); call.resolve(); }
        catch (Exception error) { call.reject("Earned receipt acknowledgement failed"); }
    }); }
    @PluginMethod public void cancelPending(PluginCall call) { handler.post(() -> {
        // Never guess that a displayed SDK screen has closed.
        if (session != null && !session.invoked) finish(session, "cancelled");
        call.resolve();
    }); }
    private void resolve(PluginCall call, boolean shown, String outcome) {
        JSObject result = new JSObject(); result.put("shown", shown); result.put("outcome", outcome); call.resolve(result);
    }
    private void finish(Session s, String outcome) {
        if (session != s) return;
        session = null;
        if (rewarded != null) { rewarded.setAdEventListener(null); rewarded = null; }
        if (rewardLoader != null && !s.invoked && s.kind.equals("rewarded")) rewardLoader.cancelLoading();
        if (interstitial != null && s.kind.equals("interstitial")) { interstitial.setAdEventListener(null); interstitial = null; }
        resolve(s.call, s.shown, outcome);
    }
    @PluginMethod public void measureBanner(PluginCall call) { handler.post(() -> {
        if (!available("banner") || background || session!=null) { call.resolve(); return; }
        try {
            View web=getBridge().getWebView(); FrameLayout parent=(FrameLayout)getActivity().findViewById(android.R.id.content);
            double viewport=call.getDouble("viewportWidth",0.0), slot=call.getDouble("slotWidth",0.0);
            if (!Double.isFinite(viewport) || !Double.isFinite(slot) || viewport<=0 || slot<=0 || slot>viewport || web.getWidth()<=0) { call.resolve(); return; }
            int width=(int)Math.floor(web.getWidth()*slot/viewport);
            if (width<=0) { call.resolve(); return; }
            if (banner==null || width!=bannerWidth) {
                destroyBanner(); bannerWidth=width;
                banner=new BannerAdView(getActivity());
                int dp=(int)Math.floor(width/getContext().getResources().getDisplayMetrics().density);
                banner.setAdSize(BannerAdSize.sticky(getContext(),dp));
                banner.measure(View.MeasureSpec.makeMeasureSpec(width,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(0,View.MeasureSpec.UNSPECIFIED));
            }
            int h=banner.getMeasuredHeight();
            if (h<=0) { call.resolve(); return; }
            int[] w=new int[2],p=new int[2]; web.getLocationOnScreen(w); parent.getLocationOnScreen(p);
            JSObject o=new JSObject();
            o.put("webView",rect(w[0]-p[0],w[1]-p[1],web.getWidth(),web.getHeight()));
            JSObject root=new JSObject(); root.put("width",parent.getWidth()); root.put("height",parent.getHeight()); o.put("root",root);
            JSObject padding=new JSObject(); padding.put("left",parent.getPaddingLeft()); padding.put("top",parent.getPaddingTop()); o.put("parentPadding",padding);
            JSObject safe=new JSObject(); safe.put("left",parent.getPaddingLeft()); safe.put("top",parent.getPaddingTop()); safe.put("right",parent.getPaddingRight()); safe.put("bottom",parent.getPaddingBottom()); o.put("safeInsets",safe);
            o.put("adHeight",h); call.resolve(o);
        } catch (Exception e) { call.reject("Banner measurement failed"); }
    }); }
    private JSObject rect(int x,int y,int width,int height) { JSObject r=new JSObject(); r.put("x",x);r.put("y",y);r.put("width",width);r.put("height",height);return r; }
    @PluginMethod public void placeBanner(PluginCall call) { handler.post(() -> {
        long generation=call.getLong("generation",0L);
        JSObject placement=call.getObject("placement");
        if (generation<bannerGeneration || banner==null || placement==null || !placement.optString("kind").equals("place") || background || session!=null || destroyed) { call.resolve(); return; }
        bannerGeneration=generation;
        try {
            JSONObject r=placement.getJSONObject("rect"); FrameLayout parent=(FrameLayout)getActivity().findViewById(android.R.id.content);
            int x=r.getInt("x"),y=r.getInt("y"),width=r.getInt("width"),height=r.getInt("height");
            View web=getBridge().getWebView(); int[] w=new int[2],p=new int[2]; web.getLocationOnScreen(w);parent.getLocationOnScreen(p);
            if (width<=0 || height<=0 || x<parent.getPaddingLeft() || y<parent.getPaddingTop() || x+width>parent.getWidth()-parent.getPaddingRight() || y+height>parent.getHeight()-parent.getPaddingBottom() || x<w[0]-p[0] || y<w[1]-p[1] || x+width>w[0]-p[0]+web.getWidth() || y+height>w[1]-p[1]+web.getHeight() || width!=bannerWidth || height<banner.getMeasuredHeight()) { hide(); call.resolve();return; }
            FrameLayout.LayoutParams lp=new FrameLayout.LayoutParams(width,height,Gravity.TOP|Gravity.LEFT);
            lp.leftMargin=x-parent.getPaddingLeft();lp.topMargin=y-parent.getPaddingTop();
            if (banner.getParent()==null) parent.addView(banner,lp); else banner.setLayoutParams(lp);
            bannerWanted=true;banner.setVisibility(bannerLoaded?View.VISIBLE:View.INVISIBLE);
            if (!bannerLoaded && android.os.SystemClock.elapsedRealtime()>=bannerRetryAt) {
                bannerRetryAt=Long.MAX_VALUE; final BannerAdView target=banner;
                target.setBannerAdEventListener(new BannerAdEventListener() {
                    public void onAdLoaded() { if (banner!=target || destroyed) return; bannerLoaded=true;target.setVisibility(bannerWanted && !background && session==null?View.VISIBLE:View.INVISIBLE);event("banner","loaded"); }
                    public void onAdFailedToLoad(@NonNull AdRequestError error) { if (banner!=target || destroyed) return;bannerRetryAt=android.os.SystemClock.elapsedRealtime()+60000;event("banner","load_error"); }
                    public void onAdClicked() {}
                    public void onImpression(@Nullable ImpressionData data) { if (banner==target) event("banner","impression"); }
                });
                event("banner","request");target.loadAd(new AdRequest.Builder(unit("banner")).build());
            }
            call.resolve();
        } catch (Exception e) { hide();call.reject("Banner placement failed"); }
    }); }
    private void hide() { bannerWanted=false; if (banner!=null) banner.setVisibility(View.INVISIBLE); }
    @PluginMethod public void hideBanner(PluginCall call) { handler.post(() -> { bannerGeneration=Math.max(bannerGeneration,call.getLong("generation",bannerGeneration));hide();call.resolve(); }); }
    private void destroyBanner() { if (banner!=null) { banner.setBannerAdEventListener(null);if (banner.getParent() instanceof FrameLayout) ((FrameLayout)banner.getParent()).removeView(banner);banner.destroy();banner=null; } bannerLoaded=false;bannerRetryAt=0; }
    @Override protected void handleOnPause() { background = true; hide(); if (session != null && !session.invoked) finish(session, "cancelled"); }
    @Override protected void handleOnResume() { background = false; if (session != null && session.invoked && !session.shown) handler.postDelayed(() -> { if (session != null) checkUnshown(session); }, 200); }
    @PluginMethod public void dispose(PluginCall call) { handler.post(() -> { handleOnDestroy(); call.resolve(); }); }
    @Override protected void handleOnDestroy() {
        destroyed = true; hide(); destroyBanner(); preloadGeneration++; handler.removeCallbacksAndMessages(null);
        getActivity().getWindow().getDecorView().getViewTreeObserver().removeOnWindowFocusChangeListener(focusListener);
        if (session != null) finish(session, "cancelled");
        if (interLoader != null) interLoader.cancelLoading();
        if (rewardLoader != null) rewardLoader.cancelLoading();
        if (interstitial != null) interstitial.setAdEventListener(null);
        interstitial = null; interLoader = null; rewardLoader = null;
    }
}
