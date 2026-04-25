package il.technician.mazganim;

import android.Manifest;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.provider.CallLog;
import androidx.core.app.ActivityCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * יומן שיחות אנדרואיד — מספר + שם שמור (CACHED_NAME; לעיתים אחרי זיהוי/Truecaller).
 * אין API ציבורי לשיחות מתוך אפליקציית Truecaller עצמה.
 */
@CapacitorPlugin(
    name = "RecentCalls",
    permissions = {
        @Permission(
            strings = { Manifest.permission.READ_CALL_LOG },
            alias = "calllog"
        )
    }
)
public class RecentCallsPlugin extends Plugin {

    @PluginMethod
    public void getRecent(PluginCall call) {
        if (ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.READ_CALL_LOG)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissionForAlias("calllog", call, "onCallLogPerms");
            return;
        }
        readCalls(call);
    }

    @PermissionCallback
    private void onCallLogPerms(PluginCall call) {
        if (ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.READ_CALL_LOG)
                == PackageManager.PERMISSION_GRANTED) {
            readCalls(call);
        } else {
            call.reject("נדרשת הרשאה ליומן שיחות (הגדרות האפליקציה → הרשאות).");
        }
    }

    private void readCalls(PluginCall call) {
        int limit = call.getInt("limit", 50);
        if (limit < 1) {
            limit = 50;
        }
        if (limit > 2000) {
            limit = 2000;
        }

        JSArray arr = new JSArray();
        Cursor cursor = null;
        try {
            cursor =
                getContext()
                    .getContentResolver()
                    .query(
                        CallLog.Calls.CONTENT_URI,
                        new String[] {
                            CallLog.Calls.NUMBER,
                            CallLog.Calls.CACHED_NAME,
                            CallLog.Calls.DATE,
                            CallLog.Calls.TYPE
                        },
                        null,
                        null,
                        CallLog.Calls.DATE + " DESC"
                    );

            if (cursor == null) {
                call.reject("אין גישה ליומן השיחות");
                return;
            }

            int count = 0;
            int idxNum = cursor.getColumnIndex(CallLog.Calls.NUMBER);
            int idxName = cursor.getColumnIndex(CallLog.Calls.CACHED_NAME);
            int idxDate = cursor.getColumnIndex(CallLog.Calls.DATE);
            int idxType = cursor.getColumnIndex(CallLog.Calls.TYPE);

            while (cursor.moveToNext() && count < limit) {
                String num = idxNum >= 0 ? cursor.getString(idxNum) : null;
                if (num == null || num.trim().isEmpty()) {
                    continue;
                }
                String name = idxName >= 0 ? cursor.getString(idxName) : null;
                if (name != null) {
                    name = name.trim();
                    if (name.isEmpty()) {
                        name = null;
                    }
                }
                long when = idxDate >= 0 ? cursor.getLong(idxDate) : 0L;
                int type = idxType >= 0 ? cursor.getInt(idxType) : 0;

                JSObject row = new JSObject();
                row.put("phoneRaw", num.replaceAll("\\s+", ""));
                row.put("name", name == null ? "" : name);
                row.put("dateMs", when);
                row.put("type", type);
                arr.put(row);
                count++;
            }

            JSObject out = new JSObject();
            out.put("calls", arr);
            call.resolve(out);
        } catch (Exception e) {
            call.reject("שגיאה בקריאת יומן שיחות: " + e.getMessage(), e);
        } finally {
            if (cursor != null) {
                cursor.close();
            }
        }
    }
}
