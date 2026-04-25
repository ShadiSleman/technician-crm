package il.technician.mazganim;

import android.Manifest;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.provider.ContactsContract.CommonDataKinds.Phone;
import androidx.core.app.ActivityCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.HashSet;
import java.util.Set;

/**
 * רשימת אנשי קשר (מספר + שם) ישירות מ־ContentResolver — אמין יותר
 * מ־JS ‎@capacitor-community/contacts.getContacts()‎ במכשירי אנדרואיד מסוימים.
 */
@CapacitorPlugin(
    name = "DeviceContactsList",
    permissions = {
        @Permission(
            strings = { Manifest.permission.READ_CONTACTS },
            alias = "contacts"
        )
    }
)
public class DeviceContactsListPlugin extends Plugin {

    @PluginMethod
    public void getPhoneRows(PluginCall call) {
        if (ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.READ_CONTACTS)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissionForAlias("contacts", call, "onContactsPerms");
            return;
        }
        readPhoneRows(call);
    }

    @PermissionCallback
    private void onContactsPerms(PluginCall call) {
        if (ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.READ_CONTACTS)
                == PackageManager.PERMISSION_GRANTED) {
            readPhoneRows(call);
        } else {
            call.reject("אין גישה לאנשי קשר. אפשרו הרשאה בהגדרות האפליקציה.");
        }
    }

    private void readPhoneRows(PluginCall call) {
        int max = call.getInt("max", 500);
        if (max < 1) {
            max = 500;
        }
        if (max > 2000) {
            max = 2000;
        }

        final Uri uri = Phone.CONTENT_URI;
        String[] projection = {
            Phone._ID,
            Phone.CONTACT_ID,
            Phone.DISPLAY_NAME,
            Phone.NUMBER
        };

        Cursor cursor = null;
        try {
            cursor =
                getContext()
                    .getContentResolver()
                    .query(uri, projection, null, null, Phone.DISPLAY_NAME + " ASC");

            if (cursor == null) {
                call.reject("אין גישה לרשומות אנשי הקשר");
                return;
            }

            Set<String> seen = new HashSet<>();
            JSArray out = new JSArray();
            int idxId = cursor.getColumnIndex(Phone._ID);
            int idxCid = cursor.getColumnIndex(Phone.CONTACT_ID);
            int idxName = cursor.getColumnIndex(Phone.DISPLAY_NAME);
            int idxNum = cursor.getColumnIndex(Phone.NUMBER);

            while (cursor.moveToNext() && out.length() < max) {
                String raw = idxNum >= 0 ? cursor.getString(idxNum) : null;
                if (raw == null || raw.trim().isEmpty()) {
                    continue;
                }
                raw = raw.trim();
                String digits = raw.replaceAll("\\D", "");
                if (digits.length() < 7) {
                    continue;
                }
                if (seen.contains(digits)) {
                    continue;
                }
                seen.add(digits);

                String name = idxName >= 0 ? cursor.getString(idxName) : null;
                if (name == null || name.trim().isEmpty()) {
                    name = "ללא שם";
                } else {
                    name = name.trim();
                }

                long rowId = idxId >= 0 ? cursor.getLong(idxId) : 0L;
                String cid = idxCid >= 0 ? String.valueOf(cursor.getLong(idxCid)) : "0";
                String id = cid + "-" + rowId + "-" + digits;

                JSObject row = new JSObject();
                row.put("id", id);
                row.put("name", name);
                row.put("phoneRaw", raw);
                out.put(row);
            }

            JSObject result = new JSObject();
            result.put("rows", out);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("שגיאה בקריאת אנשי קשר: " + e.getMessage(), e);
        } finally {
            if (cursor != null) {
                cursor.close();
            }
        }
    }
}
