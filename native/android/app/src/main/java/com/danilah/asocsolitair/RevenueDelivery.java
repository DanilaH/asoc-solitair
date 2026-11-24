package com.danilah.asocsolitair;

import android.content.Context;
import android.util.AtomicFile;
import android.util.Log;
import io.appmetrica.analytics.AppMetrica;
import java.io.*;
import java.util.Arrays;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/** Process-wide retry, independent of Activity, WebView and game SaveStore. */
final class RevenueDelivery {
    private final ScheduledExecutorService worker = Executors.newSingleThreadScheduledExecutor();
    private final RevenueOutbox outbox;
    private boolean scheduled;
    private boolean receivedWhileScheduled;
    private int delay = 1;

    RevenueDelivery(Context context) {
        AtomicFile file = new AtomicFile(new File(context.getNoBackupFilesDir(), "solitaire-live-revenue-v1.bin"));
        outbox = new RevenueOutbox(new RevenueOutbox.Store() {
            @Override public byte[] read() throws IOException {
                try { return file.readFully(); }
                catch (FileNotFoundException missing) {
                    if (file.getBaseFile().exists() || new File(file.getBaseFile() + ".bak").exists()) throw missing;
                    return null;
                }
            }

            @Override public void write(byte[] state) throws IOException {
                FileOutputStream output = null;
                try {
                    output = file.startWrite();
                    output.write(state);
                    file.finishWrite(output);
                    output = null;
                    if (!Arrays.equals(state, file.readFully())) throw new IOException("Revenue write verification failed");
                } catch (IOException error) {
                    if (output != null) file.failWrite(output);
                    throw error;
                }
            }
        });
    }

    RevenueOutbox.Receipt receive(String id, String payload) throws IOException {
        RevenueOutbox.Receipt result = outbox.receive(id, payload);
        synchronized (this) {
            if (scheduled) receivedWhileScheduled = true;
            else schedule(0);
        }
        return result;
    }

    private void drain() {
        boolean failed = false;
        try {
            if (SolitaireApplication.analyticsEnabled) {
                while (outbox.forwardNext(payload -> AppMetrica.reportEvent("ad_impression_revenue", payload))) { }
            }
        } catch (IOException | RuntimeException error) {
            failed = true;
            Log.w("SolitaireRevenue", "Revenue handoff pending");
        } finally {
            synchronized (this) {
                scheduled = false;
                boolean received = receivedWhileScheduled;
                receivedWhileScheduled = false;
                if (failed) {
                    schedule(delay);
                    delay = Math.min(60, delay * 2);
                } else {
                    delay = 1;
                    if (received) schedule(0);
                }
            }
        }
    }

    synchronized void schedule(int seconds) {
        if (scheduled || !SolitaireApplication.analyticsEnabled) return;
        scheduled = true;
        worker.schedule(this::drain, seconds, TimeUnit.SECONDS);
    }
}
