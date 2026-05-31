import React from 'react';
import { Text, StyleSheet } from 'react-native';

interface Props { text: string }

export default function EmptyState({ text }: Props) {
  return <Text style={s.text}>{text}</Text>;
}

const s = StyleSheet.create({
  text: { color: '#94a3b8', fontSize: 14, textAlign: 'center', padding: 20 },
});
