package com.hyperrevamp.bbdo;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.messaging.FirebaseMessaging;

/**
 * Direct Android FCM token bridge.
 *
 * The standard Capacitor PushNotifications registration event is still used,
 * but this plugin gives the web layer a deterministic fallback so Android never
 * ends a login session without a stored device token.
 */
@CapacitorPlugin(name = "BBDOAndroidPush")
public class BBDOAndroidPushPlugin extends Plugin {
    @PluginMethod
    public void getToken(PluginCall call) {
        FirebaseMessaging.getInstance().setAutoInitEnabled(true);
        FirebaseMessaging.getInstance().getToken()
            .addOnCompleteListener(task -> {
                if (!task.isSuccessful()) {
                    Exception exception = task.getException();
                    call.reject(exception != null ? exception.getMessage() : "Unable to fetch FCM token");
                    return;
                }

                JSObject result = new JSObject();
                result.put("token", task.getResult());
                call.resolve(result);
            });
    }
}