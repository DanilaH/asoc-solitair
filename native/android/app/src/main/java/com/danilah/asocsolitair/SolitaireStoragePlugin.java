package com.danilah.asocsolitair;

import android.util.AtomicFile;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** A process-wide disk queue; game codecs and the single coordinated save writer live in TS. */
@CapacitorPlugin(name = "SolitaireStorage")
public class SolitaireStoragePlugin extends Plugin {
    private static final ExecutorService IO = Executors.newSingleThreadExecutor();
    private AtomicFile file(PluginCall call) {
        String key = call.getString("key", "");
        if (!key.matches("[a-zA-Z0-9_.-]{1,100}")) throw new IllegalArgumentException("Invalid storage key");
        File directory = new File(getContext().getNoBackupFilesDir(), "solitaire-state-v1");
        if (!directory.isDirectory() && !directory.mkdirs()) throw new IllegalStateException("Storage unavailable");
        return new AtomicFile(new File(directory, key + ".json"));
    }
    @PluginMethod public void get(PluginCall call) { IO.execute(() -> {
        try {
            AtomicFile file = file(call); JSObject result = new JSObject();
            try { result.put("value", new String(file.readFully(), StandardCharsets.UTF_8)); }
            catch (FileNotFoundException absent) {
                // Permission/read failures for an existing file must not become a fresh save.
                if (file.getBaseFile().exists() || new File(file.getBaseFile() + ".bak").exists()) throw absent;
                result.put("value", org.json.JSONObject.NULL);
            }
            call.resolve(result);
        } catch (Exception error) { call.reject("Storage read failed"); }
    }); }
    @PluginMethod public void set(PluginCall call) { IO.execute(() -> {
        FileOutputStream out = null; AtomicFile file = null;
        try {
            String value = call.getString("value"); if (value == null) throw new IllegalArgumentException("Missing value");
            byte[] bytes = value.getBytes(StandardCharsets.UTF_8);
            if (bytes.length > 4 * 1024 * 1024) throw new IllegalArgumentException("Save too large");
            file = file(call); out = file.startWrite(); out.write(bytes); file.finishWrite(out); out = null;
            if (!Arrays.equals(file.readFully(), bytes)) throw new IOException("Write verification failed");
            call.resolve();
        } catch (Exception error) { if (file != null && out != null) file.failWrite(out); call.reject("Storage write failed"); }
    }); }
    @PluginMethod public void remove(PluginCall call) { IO.execute(() -> {
        try { AtomicFile file = file(call); file.delete(); if (file.getBaseFile().exists()) throw new IOException("Delete failed"); call.resolve(); }
        catch (Exception error) { call.reject("Storage remove failed"); }
    }); }
}
