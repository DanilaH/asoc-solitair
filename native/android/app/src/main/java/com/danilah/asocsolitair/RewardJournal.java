package com.danilah.asocsolitair;

import android.content.Context;
import android.util.AtomicFile;
import org.json.JSONObject;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

/** One pending externally earned receipt. AtomicFile avoids SharedPreferences' failed-commit memory ambiguity. */
final class RewardJournal {
    private static JSONObject unconfirmed;
    private final AtomicFile file;
    RewardJournal(Context context) { file = new AtomicFile(new File(context.getNoBackupFilesDir(), "solitaire-earned-v1.json")); }
    synchronized JSONObject pending() throws Exception {
        if (unconfirmed != null) persist(unconfirmed);
        try { return new JSONObject(new String(file.readFully(), StandardCharsets.UTF_8)); }
        catch (FileNotFoundException absent) {
            if (file.getBaseFile().exists() || new File(file.getBaseFile() + ".bak").exists()) throw absent;
            return null;
        }
    }
    synchronized void record(JSONObject receipt) throws Exception {
        JSONObject existing = pending();
        if (existing != null) throw new IllegalStateException("Previous earned receipt still pending");
        // Keep exact receipt process-wide across Activity destruction if the disk is temporarily unavailable.
        unconfirmed = receipt;
        persist(receipt);
    }
    private void persist(JSONObject receipt) throws Exception {
        FileOutputStream out = null;
        try {
            out = file.startWrite(); out.write(receipt.toString().getBytes(StandardCharsets.UTF_8));
            file.finishWrite(out); out = null;
            if (!new String(file.readFully(), StandardCharsets.UTF_8).equals(receipt.toString())) throw new java.io.IOException("Receipt verification failed");
            unconfirmed = null;
        } catch (Exception error) { if (out != null) file.failWrite(out); throw error; }
    }
    synchronized void acknowledge(String id) throws Exception {
        JSONObject receipt = pending();
        if (receipt == null) return;
        if (!receipt.getString("id").equals(id)) throw new IllegalArgumentException("Receipt mismatch");
        file.delete();
        // If deletion failed, a replay is safe: game-side effect+dedup must already be durable.
        if (file.getBaseFile().exists()) throw new IllegalStateException("Receipt acknowledgement failed");
    }
}
