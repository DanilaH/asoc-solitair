package com.danilah.asocsolitair;

import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import io.appmetrica.analytics.AppMetrica;
import org.json.JSONObject;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;

/** Road Lines transport, with one shared per-event schema instead of two hand-maintained whitelists. */
@CapacitorPlugin(name = "SolitaireAnalytics")
public class SolitaireAnalyticsPlugin extends Plugin {
    private JSONObject contract = new JSONObject();
    @Override public void load() {
        try (InputStream in = getContext().getAssets().open("solitaire-analytics-contract.json")) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[1024]; int n;
            while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
            contract = new JSONObject(new String(out.toByteArray(), StandardCharsets.UTF_8));
        } catch (Exception ignored) { /* Invalid/missing contract disables transport. */ }
    }
    @PluginMethod public void report(PluginCall call) {
        String name = call.getString("event", "");
        JSObject params = call.getObject("params", new JSObject());
        JSONObject fields = contract.optJSONObject(name);
        if (fields == null || fields.length() != params.length()) { call.reject("Invalid event"); return; }
        Iterator<String> keys = fields.keys();
        while (keys.hasNext()) {
            String key = keys.next(), type = fields.optString(key); Object value = params.opt(key);
            boolean valid = "string".equals(type) ? value instanceof String && ((String)value).length() <= 160
                : "boolean".equals(type) ? value instanceof Boolean
                : "number".equals(type) && value instanceof Number && Double.isFinite(((Number)value).doubleValue());
            if (!valid) { call.reject("Invalid event parameter"); return; }
        }
        if (SolitaireApplication.analyticsEnabled) {
            try { AppMetrica.reportEvent(name, params.toString()); }
            catch (RuntimeException ignored) { /* Never a gameplay dependency. */ }
        }
        call.resolve();
    }
}
