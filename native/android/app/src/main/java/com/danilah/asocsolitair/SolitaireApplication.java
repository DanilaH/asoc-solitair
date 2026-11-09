package com.danilah.asocsolitair;

import android.app.Application;
import io.appmetrica.analytics.AppMetrica;
import io.appmetrica.analytics.AppMetricaConfig;

/** Adapted from Road Lines 180d5b1: process initialization is independent of WebView readiness. */
public class SolitaireApplication extends Application {
    static volatile boolean analyticsEnabled;
    @Override public void onCreate() {
        super.onCreate();
        if (BuildConfig.ANALYTICS_API_KEY.isEmpty()) return;
        try {
            AppMetrica.activate(this, AppMetricaConfig.newConfigBuilder(BuildConfig.ANALYTICS_API_KEY)
                .withLocationTracking(false).withAdvIdentifiersTracking(false)
                .withCrashReporting(true).withNativeCrashReporting(false).build());
            AppMetrica.enableActivityAutoTracking(this);
            analyticsEnabled = true;
        } catch (RuntimeException ignored) { /* Optional telemetry cannot prevent playing. */ }
    }
}
