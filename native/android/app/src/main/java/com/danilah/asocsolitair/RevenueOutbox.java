package com.danilah.asocsolitair;

import java.io.*;
import java.util.ArrayDeque;
import java.util.LinkedHashMap;
import java.util.Map;

/** Native receive/forward journal. Every update is one atomic store write. */
final class RevenueOutbox {
    interface Store {
        byte[] read() throws IOException;
        void write(byte[] state) throws IOException;
    }

    interface Sender {
        void send(String payload);
    }

    enum Receipt { QUEUED, DUPLICATE, FULL }

    private static final int MAX_PENDING = 256;
    private static final int MAX_FORWARDED = 1024;
    private final Store store;
    private String handedOff;

    private static class State {
        final LinkedHashMap<String, String> pending = new LinkedHashMap<>();
        final ArrayDeque<String> forwarded = new ArrayDeque<>();
        long dropped;
    }

    RevenueOutbox(Store store) {
        this.store = store;
    }

    synchronized Receipt receive(String id, String payload) throws IOException {
        State state = read();
        if (state.pending.containsKey(id) || state.forwarded.contains(id)) return Receipt.DUPLICATE;
        if (state.pending.size() >= MAX_PENDING) {
            if (state.dropped < Long.MAX_VALUE) state.dropped++;
            write(state);
            return Receipt.FULL;
        }
        state.pending.put(id, payload);
        write(state);
        return Receipt.QUEUED;
    }

    // The single delivery worker calls this method. Do not hold the disk lock while calling the SDK.
    boolean forwardNext(Sender sender) throws IOException {
        Map.Entry<String, String> next;
        synchronized (this) {
            next = read().pending.entrySet().stream().findFirst().orElse(null);
        }
        if (next == null) return false;
        String id = next.getKey();
        if (!id.equals(handedOff)) {
            sender.send(next.getValue());
            handedOff = id;
        }
        synchronized (this) {
            State state = read();
            state.pending.remove(id);
            state.forwarded.addLast(id);
            if (state.forwarded.size() > MAX_FORWARDED) state.forwarded.removeFirst();
            write(state);
        }
        handedOff = null;
        return true;
    }

    private State read() throws IOException {
        byte[] data = store.read();
        State state = new State();
        if (data == null) return state;
        try (DataInputStream input = new DataInputStream(new ByteArrayInputStream(data))) {
            if (input.readInt() != 1) throw new IOException("Invalid revenue outbox version");
            state.dropped = input.readLong();
            if (state.dropped < 0) throw new IOException("Invalid revenue drop count");
            int pending = input.readInt();
            if (pending < 0 || pending > MAX_PENDING) throw new IOException("Invalid pending count");
            for (int i = 0; i < pending; i++) {
                String id = input.readUTF();
                if (state.pending.put(id, input.readUTF()) != null) throw new IOException("Duplicate revenue id");
            }
            int forwarded = input.readInt();
            if (forwarded < 0 || forwarded > MAX_FORWARDED) throw new IOException("Invalid forwarded count");
            for (int i = 0; i < forwarded; i++) state.forwarded.addLast(input.readUTF());
            if (input.read() != -1) throw new IOException("Trailing revenue outbox data");
        }
        return state;
    }

    private void write(State state) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (DataOutputStream output = new DataOutputStream(bytes)) {
            output.writeInt(1);
            output.writeLong(state.dropped);
            output.writeInt(state.pending.size());
            for (Map.Entry<String, String> entry : state.pending.entrySet()) {
                output.writeUTF(entry.getKey());
                output.writeUTF(entry.getValue());
            }
            output.writeInt(state.forwarded.size());
            for (String id : state.forwarded) output.writeUTF(id);
        }
        store.write(bytes.toByteArray());
    }
}
