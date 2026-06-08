import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNetworkStatus } from '../lib/network';
import { getQueueLength } from '../lib/mutation-queue';

export function SyncStatusBanner() {
  const isOnline = useNetworkStatus();
  const [queueLen, setQueueLen] = useState(0);

  useEffect(() => {
    getQueueLength().then(setQueueLen);
  }, [isOnline]);

  if (isOnline && queueLen === 0) return null;

  return (
    <View style={[s.banner, { backgroundColor: isOnline ? '#dcfce7' : '#fef2f2' }]}>
      <Text style={[s.texto, { color: isOnline ? '#166534' : '#991b1b' }]}>
        {!isOnline
          ? '📵 Sem ligação — registos guardados localmente'
          : `🔄 ${queueLen} operaç${queueLen === 1 ? 'ão' : 'ões'} a sincronizar...`}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  banner:  { paddingVertical: 7, paddingHorizontal: 16, alignItems: 'center' },
  texto:   { fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
