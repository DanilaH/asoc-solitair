package com.danilah.asocsolitair;

import android.content.Context;
import android.util.AtomicFile;
import android.util.Log;
import io.appmetrica.analytics.AppMetrica;
import java.io.*;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.function.BooleanSupplier;

/** Process-wide retry, independent of Activity, WebView and game SaveStore. */
final class RevenueDelivery {
    /** CAPTURED is process memory ownership, not a durable receipt or SDK acknowledgement. */
    enum Capture { CAPTURED, DUPLICATE_PENDING, INTAKE_FULL, INVALID }
    interface Scheduler { void schedule(Runnable work, int seconds); }
    interface Reporter { void report(String phase, Diagnostics diagnostics); }
    static final int MAX_INTAKE = 64;
    private static final int MAX_PAYLOAD_CHARS = 4096;

    static final class Diagnostics {
        final int intakePending;
        final long intakeErrors, intakeDropped, queueDropped, durableAccepted, durableDuplicates;
        Diagnostics(int intakePending, long intakeErrors, long intakeDropped, long queueDropped,
                    long durableAccepted, long durableDuplicates) {
            this.intakePending = intakePending;
            this.intakeErrors = intakeErrors;
            this.intakeDropped = intakeDropped;
            this.queueDropped = queueDropped;
            this.durableAccepted = durableAccepted;
            this.durableDuplicates = durableDuplicates;
        }
    }

    private final RevenueOutbox outbox;
    private final RevenueOutbox.Sender sender;
    private final BooleanSupplier analyticsEnabled;
    private final Scheduler worker;
    private final Reporter reporter;
    // Retained until durable receive succeeds (or explicitly rejects a full queue).
    // A process death before that first successful write cannot recover this memory.
    private final LinkedHashMap<String, String> intake = new LinkedHashMap<>();
    private long intakeErrors, intakeDropped, queueDropped, durableAccepted, durableDuplicates;
    private boolean scheduled;
    private boolean requestedWhileScheduled;
    private int delay = 1;

    RevenueDelivery(Context context) {
        this(atomicStore(context), payload -> AppMetrica.reportEvent("ad_impression_revenue", payload),
            () -> SolitaireApplication.analyticsEnabled, executor(), (phase, diagnostics) -> {
                if (phase.equals("intake_error") || phase.equals("intake_full") || phase.equals("intake_invalid") ||
                    phase.equals("queue_full") || phase.equals("handoff_pending"))
                    Log.w("SolitaireRevenue", phase + ": pending=" + diagnostics.intakePending +
                        ", storeErrors=" + diagnostics.intakeErrors + ", intakeDrops=" + diagnostics.intakeDropped +
                        ", queueDrops=" + diagnostics.queueDropped);
            });
    }

    // The same production pipeline is exercised with controlled disk/SDK/scheduling in JVM tests.
    RevenueDelivery(RevenueOutbox.Store store, RevenueOutbox.Sender sender, BooleanSupplier analyticsEnabled,
                    Scheduler worker, Reporter reporter) {
        this.outbox = new RevenueOutbox(store);
        this.sender = sender;
        this.analyticsEnabled = analyticsEnabled;
        this.worker = worker;
        this.reporter = reporter;
    }

    private static Scheduler executor() {
        ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor();
        return (work, seconds) -> executor.schedule(work, seconds, TimeUnit.SECONDS);
    }

    private static RevenueOutbox.Store atomicStore(Context context) {
        AtomicFile file = new AtomicFile(new File(context.getNoBackupFilesDir(), "solitaire-live-revenue-v1.bin"));
        return new RevenueOutbox.Store() {
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
        };
    }

    Capture receive(String id, String payload) {
        Capture result;
        synchronized (this) {
            if (id == null || id.isEmpty() || id.length() > 128 || payload == null ||
                payload.isEmpty() || payload.length() > MAX_PAYLOAD_CHARS) {
                intakeDropped = increment(intakeDropped);
                result = Capture.INVALID;
            } else if (intake.containsKey(id)) {
                result = Capture.DUPLICATE_PENDING;
            } else if (intake.size() >= MAX_INTAKE) {
                intakeDropped = increment(intakeDropped);
                result = Capture.INTAKE_FULL;
            } else {
                intake.put(id, payload);
                schedule(0);
                result = Capture.CAPTURED;
            }
        }
        if (result == Capture.INTAKE_FULL) report("intake_full");
        if (result == Capture.INVALID) report("intake_invalid");
        return result;
    }

    synchronized Diagnostics diagnostics() {
        return new Diagnostics(intake.size(), intakeErrors, intakeDropped, queueDropped, durableAccepted, durableDuplicates);
    }

    private static long increment(long value) { return value == Long.MAX_VALUE ? value : value + 1; }

    private void report(String phase) {
        try { reporter.report(phase, diagnostics()); }
        catch (RuntimeException ignored) { /* Diagnostics cannot gate capture or delivery. */ }
    }

    private boolean persistIntake() {
        while (true) {
            Map.Entry<String, String> next;
            synchronized (this) { next = intake.entrySet().stream().findFirst().orElse(null); }
            if (next == null) return true;
            RevenueOutbox.Receipt receipt;
            try { receipt = outbox.receive(next.getKey(), next.getValue()); }
            catch (IOException error) {
                synchronized (this) { intakeErrors = increment(intakeErrors); }
                report("intake_error");
                return false;
            }
            synchronized (this) {
                intake.remove(next.getKey());
                if (receipt == RevenueOutbox.Receipt.QUEUED) durableAccepted = increment(durableAccepted);
                if (receipt == RevenueOutbox.Receipt.DUPLICATE) durableDuplicates = increment(durableDuplicates);
                if (receipt == RevenueOutbox.Receipt.FULL) queueDropped = increment(queueDropped);
            }
            report(receipt == RevenueOutbox.Receipt.QUEUED ? "durable_queued" :
                receipt == RevenueOutbox.Receipt.DUPLICATE ? "durable_duplicate" : "queue_full");
        }
    }

    private void drain() {
        boolean failed = false;
        try {
            // Intake must persist even when analytics has not started or is disabled.
            failed = !persistIntake();
            if (analyticsEnabled.getAsBoolean()) {
                while (outbox.forwardNext(sender)) { }
            }
        } catch (IOException | RuntimeException error) {
            failed = true;
            report("handoff_pending");
        } finally {
            synchronized (this) {
                scheduled = false;
                boolean requested = requestedWhileScheduled;
                requestedWhileScheduled = false;
                if (failed) {
                    schedule(delay);
                    delay = Math.min(60, delay * 2);
                } else {
                    delay = 1;
                    if (requested || !intake.isEmpty()) schedule(0);
                }
            }
        }
    }

    synchronized void schedule(int seconds) {
        if (scheduled) { requestedWhileScheduled = true; return; }
        if (intake.isEmpty() && !analyticsEnabled.getAsBoolean()) return;
        scheduled = true;
        worker.schedule(this::drain, seconds);
    }
}
