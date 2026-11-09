package com.danilah.asocsolitair;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;

/** OS audio focus is independent of the app/visibility/ad blockers. */
@CapacitorPlugin(name = "SolitaireAudio")
public class SolitaireAudioPlugin extends Plugin {
    private AudioManager manager;
    private AudioFocusRequest request;
    private boolean enabled, held, foreground = true;
    private final AudioManager.OnAudioFocusChangeListener listener = change -> {
        held = change == AudioManager.AUDIOFOCUS_GAIN;
        emit(held);
    };
    private void emit(boolean focused) { JSObject value = new JSObject(); value.put("focused", focused); notifyListeners("audioFocus", value); }
    @Override public void load() { manager = (AudioManager)getContext().getSystemService(Context.AUDIO_SERVICE); }
    @PluginMethod public void configure(PluginCall call) { getActivity().runOnUiThread(() -> {
        enabled = call.getBoolean("enabled", false);
        if (enabled && foreground) acquire(); else abandon();
        JSObject state = new JSObject(); state.put("focused", held); call.resolve(state);
    }); }
    private void acquire() {
        if (held || manager == null) return;
        int result;
        if (Build.VERSION.SDK_INT >= 26) {
            if (request == null) request = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
                .setOnAudioFocusChangeListener(listener).setWillPauseWhenDucked(true).build();
            result = manager.requestAudioFocus(request);
        } else result = manager.requestAudioFocus(listener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN);
        held = result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED; emit(held);
    }
    private void abandon() {
        if (manager != null && held) {
            if (Build.VERSION.SDK_INT >= 26 && request != null) manager.abandonAudioFocusRequest(request);
            else manager.abandonAudioFocus(listener);
        }
        held = false; emit(false);
    }
    @Override protected void handleOnPause() { foreground = false; abandon(); }
    @Override protected void handleOnResume() { foreground = true; if (enabled) acquire(); }
    @Override protected void handleOnDestroy() { enabled = false; abandon(); }
}
