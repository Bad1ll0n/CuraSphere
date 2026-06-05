import { useEffect, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { flushMutationQueue } from './mutation-queue';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(prev => {
        if (!prev && online) {
          flushMutationQueue();
        }
        return online;
      });
    });
    return unsubscribe;
  }, []);

  return isOnline;
}
