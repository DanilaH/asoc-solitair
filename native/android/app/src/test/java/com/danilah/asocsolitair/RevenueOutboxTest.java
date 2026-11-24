package com.danilah.asocsolitair;

import org.junit.Test;
import static org.junit.Assert.*;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

public class RevenueOutboxTest {
    private static final class Disk implements RevenueOutbox.Store {
        byte[] saved;
        boolean fail;
        public byte[] read() { return saved; }
        public void write(byte[] state) throws IOException {
            if (fail) throw new IOException("Write failed");
            saved = state;
        }
    }

    @Test public void transportFailureSurvivesRestartAndDuplicateCallbacks() throws IOException {
        Disk disk = new Disk();
        RevenueOutbox first = new RevenueOutbox(disk);
        assertEquals(RevenueOutbox.Receipt.QUEUED, first.receive("one", "event-one"));
        assertEquals(RevenueOutbox.Receipt.QUEUED, first.receive("two", "event-two"));
        assertThrows(RuntimeException.class, () -> first.forwardNext(payload -> { throw new IllegalStateException(); }));

        RevenueOutbox reopened = new RevenueOutbox(disk);
        assertEquals(RevenueOutbox.Receipt.DUPLICATE, reopened.receive("one", "different-value"));
        List<String> sent = new ArrayList<>();
        assertTrue(reopened.forwardNext(sent::add));
        assertTrue(reopened.forwardNext(sent::add));
        assertEquals(List.of("event-one", "event-two"), sent);
        assertFalse(reopened.forwardNext(sent::add));
        assertEquals(RevenueOutbox.Receipt.DUPLICATE, new RevenueOutbox(disk).receive("one", "event-one"));
    }

    @Test public void retriesDiskAcknowledgementWithoutResendingInTheSameProcess() throws IOException {
        Disk disk = new Disk();
        RevenueOutbox queue = new RevenueOutbox(disk);
        queue.receive("one", "event");
        List<String> sent = new ArrayList<>();
        disk.fail = true;
        assertThrows(IOException.class, () -> queue.forwardNext(sent::add));
        disk.fail = false;
        assertTrue(queue.forwardNext(sent::add));
        assertEquals(List.of("event"), sent);
    }

    @Test public void aFullQueueKeepsEveryPreviouslyAcceptedEvent() throws IOException {
        Disk disk = new Disk();
        RevenueOutbox queue = new RevenueOutbox(disk);
        for (int i = 0; i < 256; i++) assertEquals(RevenueOutbox.Receipt.QUEUED, queue.receive("id-" + i, "event-" + i));
        assertEquals(RevenueOutbox.Receipt.FULL, queue.receive("excess", "excess"));
        List<String> delivered = new ArrayList<>();
        while (queue.forwardNext(delivered::add)) { }
        assertEquals(256, delivered.size());
        assertEquals("event-0", delivered.get(0));
        assertEquals("event-255", delivered.get(255));
    }
}
