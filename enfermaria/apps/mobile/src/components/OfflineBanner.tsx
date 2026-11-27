import React from 'react';
import { View, Text } from 'react-native';
import { useNetworkStatus } from '../lib/network';
import { estilosTematicos } from '../lib/tema';

export function OfflineBanner() {
  const isOnline = useNetworkStatus();

  if (isOnline) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.icon}>⚡</Text>
      <Text style={styles.text}>Sem ligação — dados guardados localmente</Text>
    </View>
  );
}

const styles = estilosTematicos((c) => ({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f59e0b',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  icon: { fontSize: 14 },
  text: { color: '#fff', fontSize: 13, fontWeight: '600' },
}));
