package il.technician.mazganim;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * פתיחה אמיתית של Truecaller — לא דרך intent: ב־URL (לעתים נחסם ב־WebView).
 */
@CapacitorPlugin(name = "TruecallerLaunch")
public class TruecallerPlugin extends Plugin {

  private static final String PKG = "com.truecaller";

  @PluginMethod
  public void open(PluginCall call) {
    try {
      android.content.Context ctx = getContext();
      Intent launch = ctx.getPackageManager().getLaunchIntentForPackage(PKG);
      if (launch != null) {
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startActivity(launch);
        call.resolve();
        return;
      }
      Intent play = new Intent(
        Intent.ACTION_VIEW,
        Uri.parse("https://play.google.com/store/apps/details?id=" + PKG)
      );
      play.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      ctx.startActivity(play);
      call.resolve();
    } catch (ActivityNotFoundException e) {
      call.reject("לא ניתן לפתוח", e);
    } catch (Exception e) {
      call.reject("שגיאה בפתיחת Truecaller: " + e.getMessage(), e);
    }
  }
}
