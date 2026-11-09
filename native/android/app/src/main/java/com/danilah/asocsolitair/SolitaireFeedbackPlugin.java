package com.danilah.asocsolitair;

import android.content.Context;
import android.media.AudioAttributes;
import android.os.*;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Road Lines native capability/freshness recipe, with Solitaire cues and a cancellation generation. */
@CapacitorPlugin(name = "SolitaireFeedback")
public class SolitaireFeedbackPlugin extends Plugin {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean foreground = true;
    private long generation, lastPulse = -1000, stoppedAt;
    private Vibrator vibrator() {
        if (Build.VERSION.SDK_INT >= 31) {
            VibratorManager manager = (VibratorManager)getContext().getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            return manager == null ? null : manager.getDefaultVibrator();
        }
        return (Vibrator)getContext().getSystemService(Context.VIBRATOR_SERVICE);
    }
    @PluginMethod public void pulse(PluginCall call) { handler.post(() -> {
        String cue = call.getString("cue", "");
        long issued = call.getLong("issuedAt", 0L), epoch = call.getLong("generation", -1L), now = SystemClock.uptimeMillis();
        if (epoch < generation || issued <= stoppedAt || Math.abs(System.currentTimeMillis() - issued) > 250 || !foreground || now - lastPulse < 60) { call.resolve(); return; }
        if (!cue.matches("button|transfer|complete|invalid|hint|undo|coins|win")) { call.reject("Invalid haptic cue"); return; }
        generation = epoch;
        try {
            Vibrator v = vibrator();
            if (v != null && v.hasVibrator()) {
                lastPulse = now;
                AudioAttributes attributes = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
                boolean accent = cue.equals("win") || cue.equals("complete");
                long[] timings = cue.equals("win") ? new long[]{0, 30, 42, 40, 50, 58}
                    : cue.equals("complete") ? new long[]{0, 25, 30, 35}
                    : cue.equals("undo") ? new long[]{0, 12, 20, 18}
                    : cue.equals("invalid") ? new long[]{0, 16, 25, 16} : null;
                if (timings != null) {
                    if (Build.VERSION.SDK_INT >= 26 && v.hasAmplitudeControl()) {
                        int[] amplitudes = new int[timings.length];
                        for (int i=1; i<amplitudes.length; i+=2) amplitudes[i] = accent ? 230 : 170;
                        v.vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1), attributes);
                    } else v.vibrate(timings, -1, attributes);
                } else {
                    long duration = cue.equals("transfer") ? 16 : 12;
                    if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(duration,
                        v.hasAmplitudeControl() ? cue.equals("coins") ? 140 : 170 : VibrationEffect.DEFAULT_AMPLITUDE), attributes);
                    else v.vibrate(duration, attributes);
                }
            }
            call.resolve();
        } catch (RuntimeException error) { call.reject("Haptics unavailable"); }
    }); }
    @PluginMethod public void cancel(PluginCall call) { handler.post(() -> {
        generation = Math.max(generation, call.getLong("generation", generation)); stop(); call.resolve();
    }); }
    private void stop() { stoppedAt = System.currentTimeMillis(); Vibrator v = vibrator(); if (v != null) v.cancel(); }
    @Override protected void handleOnPause() { foreground = false; stop(); }
    @Override protected void handleOnResume() { foreground = true; }
    @Override protected void handleOnDestroy() { foreground = false; stop(); handler.removeCallbacksAndMessages(null); }
}
