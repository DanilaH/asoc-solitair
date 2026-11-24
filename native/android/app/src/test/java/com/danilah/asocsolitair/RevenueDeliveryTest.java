package com.danilah.asocsolitair;

import org.junit.Test;
import static org.junit.Assert.*;
import java.io.IOException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;

public class RevenueDeliveryTest {
    private static final String PAYLOAD = "{\"deliveryId\":\"one\",\"format\":\"rewarded\",\"placement\":\"hint\",\"micros\":123,\"currency\":\"USD\"}";

    private static final class Disk implements RevenueOutbox.Store {
        byte[] saved;
        boolean fail, failAfterWrite;
        int writes;
        public byte[] read() { return saved; }
        public void write(byte[] state) throws IOException {
            writes++;
            if (fail) throw new IOException("Storage temporarily unavailable");
            saved = state;
            if (failAfterWrite) throw new IOException("Ambiguous write");
        }
    }

    private static final class Clock implements RevenueDelivery.Scheduler {
        final ArrayDeque<Runnable> jobs = new ArrayDeque<>();
        final ArrayDeque<Integer> delays = new ArrayDeque<>();
        public void schedule(Runnable work, int seconds) { jobs.addLast(work); delays.addLast(seconds); }
        int runNext() {
            assertFalse("A retry must have been scheduled", jobs.isEmpty());
            int seconds = delays.removeFirst();
            jobs.removeFirst().run();
            return seconds;
        }
    }

    private static final class Harness {
        final Disk disk = new Disk();
        final Clock clock = new Clock();
        final List<String> sent = new ArrayList<>(), diagnostics = new ArrayList<>();
        boolean enabled = true;
        RevenueOutbox.Sender send = sent::add;
        final RevenueDelivery delivery = new RevenueDelivery(disk, payload -> send.send(payload), () -> enabled,
            clock, (phase, state) -> diagnostics.add(phase));
    }

    @Test public void firstWriteFailureRetriesWithoutCallbackOrSessionAndKeepsOriginalPayload() {
        Harness h = new Harness();
        h.disk.fail = true;
        assertEquals(RevenueDelivery.Capture.CAPTURED, h.delivery.receive("one", PAYLOAD));
        assertEquals(0, h.disk.writes); // SDK callback never waits for storage/analytics.
        assertEquals(0, h.clock.runNext());
        assertNull(h.disk.saved);
        assertEquals(1, h.delivery.diagnostics().intakePending);
        assertEquals(1, h.delivery.diagnostics().intakeErrors);
        assertEquals(0, h.delivery.diagnostics().durableAccepted);
        assertTrue(h.sent.isEmpty());
        assertEquals(RevenueDelivery.Capture.DUPLICATE_PENDING, h.delivery.receive("one", "changed payload"));
        h.disk.fail = false;
        // No SDK callback, Session, Activity or WebView is involved in this retry.
        assertEquals(1, h.clock.runNext());
        assertEquals(List.of(PAYLOAD), h.sent);
        assertEquals(0, h.delivery.diagnostics().intakePending);
        assertEquals(1, h.delivery.diagnostics().durableAccepted);
        assertTrue(h.clock.jobs.isEmpty());
        assertEquals(List.of("intake_error", "durable_queued"), h.diagnostics);

        h.delivery.receive("one", "duplicate after handoff");
        h.clock.runNext();
        assertEquals(List.of(PAYLOAD), h.sent);
        assertEquals(1, h.delivery.diagnostics().durableDuplicates);
    }

    @Test public void intakePersistsWithoutAnalyticsAndPendingResumesAfterProcessRestart() {
        Harness h = new Harness();
        h.enabled = false;
        h.disk.fail = true;
        h.delivery.receive("one", PAYLOAD);
        h.clock.runNext();
        h.disk.fail = false;
        assertEquals(1, h.clock.runNext());
        assertNotNull(h.disk.saved);
        assertEquals(0, h.delivery.diagnostics().intakePending);
        assertTrue(h.sent.isEmpty());
        assertTrue(h.clock.jobs.isEmpty());

        Clock reopenedClock = new Clock();
        RevenueDelivery reopened = new RevenueDelivery(h.disk, h.sent::add, () -> true, reopenedClock, (p, d) -> {});
        reopened.schedule(0);
        reopenedClock.runNext();
        assertEquals(List.of(PAYLOAD), h.sent);
    }

    @Test public void ambiguousFirstWriteReconcilesByTheSameIdBeforeForwarding() {
        Harness h = new Harness();
        h.enabled = false;
        h.disk.failAfterWrite = true;
        h.delivery.receive("one", PAYLOAD);
        h.clock.runNext();
        assertNotNull(h.disk.saved);
        assertEquals(1, h.delivery.diagnostics().intakePending);
        assertEquals(0, h.delivery.diagnostics().durableAccepted);
        h.disk.failAfterWrite = false;
        h.enabled = true;
        h.clock.runNext();
        assertEquals(List.of(PAYLOAD), h.sent);
        assertEquals(0, h.delivery.diagnostics().intakePending);
        assertEquals(1, h.delivery.diagnostics().durableDuplicates);
    }

    @Test public void fullIntakeIsBoundedAndNeverReplacesAnEarlierPayload() {
        Harness h = new Harness();
        h.disk.fail = true;
        for (int i = 0; i < RevenueDelivery.MAX_INTAKE; i++)
            assertEquals(RevenueDelivery.Capture.CAPTURED, h.delivery.receive("id-" + i, "payload-" + i));
        assertEquals(RevenueDelivery.Capture.DUPLICATE_PENDING, h.delivery.receive("id-0", "replacement"));
        assertEquals(RevenueDelivery.Capture.INTAKE_FULL, h.delivery.receive("overflow", "overflow"));
        assertEquals(RevenueDelivery.MAX_INTAKE, h.delivery.diagnostics().intakePending);
        assertEquals(1, h.delivery.diagnostics().intakeDropped);
        h.clock.runNext();
        assertTrue(h.sent.isEmpty());
        h.disk.fail = false;
        h.clock.runNext();
        assertEquals(RevenueDelivery.MAX_INTAKE, h.sent.size());
        assertEquals("payload-0", h.sent.get(0));
        assertFalse(h.sent.contains("overflow"));
        assertTrue(h.diagnostics.contains("intake_full"));
    }

    @Test public void aFullDurableQueueKeepsAcceptedEventsAndDiagnosesTheRejectedIntake() throws IOException {
        Harness h = new Harness();
        RevenueOutbox outbox = new RevenueOutbox(h.disk);
        for (int i = 0; i < 256; i++) outbox.receive("id-" + i, "payload-" + i);
        h.delivery.receive("extra", "extra");
        h.clock.runNext();
        assertEquals(256, h.sent.size());
        assertFalse(h.sent.contains("extra"));
        assertEquals(0, h.delivery.diagnostics().intakePending);
        assertEquals(1, h.delivery.diagnostics().queueDropped);
        assertEquals(0, h.delivery.diagnostics().durableAccepted);
        assertTrue(h.diagnostics.contains("queue_full"));
    }

    @Test public void aPermanentStorageFailureUsesBoundedBackoffAndNoFalseDurableReceipt() {
        Harness h = new Harness();
        h.disk.fail = true;
        h.delivery.receive("one", PAYLOAD);
        List<Integer> delays = new ArrayList<>();
        for (int i = 0; i < 10; i++) delays.add(h.clock.runNext());
        assertEquals(List.of(0, 1, 2, 4, 8, 16, 32, 60, 60, 60), delays);
        assertEquals(1, h.delivery.diagnostics().intakePending);
        assertEquals(10, h.delivery.diagnostics().intakeErrors);
        assertEquals(0, h.delivery.diagnostics().durableAccepted);
        assertEquals(1, h.clock.jobs.size());
        assertTrue(h.sent.isEmpty());
    }

    @Test public void sdkFailureRetainsDurablePendingAndRetriesWithoutASecondCapture() {
        Harness h = new Harness();
        h.send = p -> { throw new IllegalStateException("SDK unavailable"); };
        h.delivery.receive("one", PAYLOAD);
        h.clock.runNext();
        assertEquals(0, h.delivery.diagnostics().intakePending);
        assertEquals(1, h.delivery.diagnostics().durableAccepted);
        assertTrue(h.diagnostics.contains("handoff_pending"));
        h.send = h.sent::add;
        assertEquals(1, h.clock.runNext());
        assertEquals(List.of(PAYLOAD), h.sent);
    }

    @Test public void ackWriteFailureRetriesWithoutResendingInTheSameProcess() {
        Harness h = new Harness();
        h.send = payload -> { h.sent.add(payload); h.disk.fail = true; };
        h.delivery.receive("one", PAYLOAD);
        h.clock.runNext();
        assertEquals(List.of(PAYLOAD), h.sent);
        h.disk.fail = false;
        h.clock.runNext();
        assertEquals(List.of(PAYLOAD), h.sent);
        assertTrue(h.clock.jobs.isEmpty());
    }

    @Test public void receiveDuringHandoffSchedulesTheNewIntakeAfterTheCurrentDrain() {
        Harness h = new Harness();
        h.send = payload -> {
            h.sent.add(payload);
            if (payload.equals("first")) h.delivery.receive("second", "second");
        };
        h.delivery.receive("first", "first");
        h.clock.runNext();
        assertEquals(List.of("first"), h.sent);
        assertEquals(0, h.clock.runNext());
        assertEquals(List.of("first", "second"), h.sent);
        assertTrue(h.clock.jobs.isEmpty());
    }

    @Test public void diagnosticsFailureDoesNotBlockCaptureOrDeliveryAndInvalidPayloadIsBounded() {
        Disk disk = new Disk(); Clock clock = new Clock(); List<String> sent = new ArrayList<>();
        RevenueDelivery delivery = new RevenueDelivery(disk, sent::add, () -> true, clock,
            (phase, state) -> { throw new IllegalStateException("diagnostic sink failed"); });
        assertEquals(RevenueDelivery.Capture.INVALID, delivery.receive("one", "x".repeat(4097)));
        assertEquals(0, delivery.diagnostics().intakePending);
        assertEquals(1, delivery.diagnostics().intakeDropped);
        delivery.receive("one", PAYLOAD);
        clock.runNext();
        assertEquals(List.of(PAYLOAD), sent);
    }

    @Test public void memoryCaptureDoesNotClaimRecoveryFromDeathBeforeTheFirstWrite() {
        Harness h = new Harness();
        h.delivery.receive("one", PAYLOAD);
        assertNull(h.disk.saved);
        assertEquals(0, h.delivery.diagnostics().durableAccepted);
        Clock reopenedClock = new Clock();
        RevenueDelivery reopened = new RevenueDelivery(h.disk, h.sent::add, () -> true, reopenedClock, (p, d) -> {});
        reopened.schedule(0);
        reopenedClock.runNext();
        assertTrue(h.sent.isEmpty());
    }
}
