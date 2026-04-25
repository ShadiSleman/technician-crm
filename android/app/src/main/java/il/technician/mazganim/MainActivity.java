package il.technician.mazganim;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(TruecallerPlugin.class);
    registerPlugin(RecentCallsPlugin.class);
    registerPlugin(DeviceContactsListPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
