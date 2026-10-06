import * as Network from "expo-network";
import { useEffect, useState } from "react";

/** Subscribes to connectivity. Calls `onReconnect` whenever the connection comes back. */
export function useOnline(onReconnect?: () => void): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let previous = true;
    const apply = (connected: boolean) => {
      setOnline(connected);
      if (connected && !previous) onReconnect?.();
      previous = connected;
    };
    Network.getNetworkStateAsync().then((s) => apply(s.isConnected !== false && s.isInternetReachable !== false));
    const sub = Network.addNetworkStateListener((s) => apply(s.isConnected !== false && s.isInternetReachable !== false));
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return online;
}
