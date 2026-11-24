package com.danilah.asocsolitair;

import android.content.Context;
import android.util.AtomicFile;
import org.json.JSONObject;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/** One pending SDK event per file, accessed on the Android main thread. */
final class RewardJournal {
    private static final Map<String, JSONObject> unconfirmed = new HashMap<>();
    private final AtomicFile file;
    private final String path;

    RewardJournal(Context context, String filename) {
        File base = new File(context.getNoBackupFilesDir(), filename);
        file = new AtomicFile(base);
        path = base.getAbsolutePath();
    }
    JSONObject pending() throws Exception {
        JSONObject retry = unconfirmed.get(path);
        if (retry != null) persist(retry);
        try { return new JSONObject(new String(file.readFully(), StandardCharsets.UTF_8)); }
        catch (FileNotFoundException absent) {
            if (file.getBaseFile().exists() || new File(file.getBaseFile() + ".bak").exists()) throw absent;
            return null;
        }
    }
    void record(JSONObject receipt) throws Exception {
        // show() verifies both journals are empty before admitting one SDK session.
        // Capture before any new I/O so transient disk errors do not lose this callback.
        if (unconfirmed.containsKey(path)) throw new IllegalStateException("Previous SDK event still pending");
        unconfirmed.put(path, receipt);
        persist(receipt);
    }
    private void persist(JSONObject receipt) throws Exception {
        FileOutputStream out = null;
        try {
            out = file.startWrite(); out.write(receipt.toString().getBytes(StandardCharsets.UTF_8));
            file.finishWrite(out); out = null;
            if (!new String(file.readFully(), StandardCharsets.UTF_8).equals(receipt.toString())) throw new java.io.IOException("Receipt verification failed");
            unconfirmed.remove(path);
        } catch (Exception error) { if (out != null) file.failWrite(out); throw error; }
    }
    void acknowledge(String id) throws Exception {
        JSONObject receipt = pending();
        if (receipt == null) return;
        if (!receipt.getString("id").equals(id)) throw new IllegalArgumentException("Receipt mismatch");
        file.delete();
        // If deletion failed, a replay is safe: game-side effect+dedup must already be durable.
        if (file.getBaseFile().exists()) throw new IllegalStateException("Receipt acknowledgement failed");
    }
}
