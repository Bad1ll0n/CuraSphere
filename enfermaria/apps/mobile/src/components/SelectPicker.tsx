import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Option<T> { value: T; label: string }
interface Props<T> { options: Option<T>[]; value: T; onChange: (v: T) => void }

export default function SelectPicker<T extends string | number>({ options, value, onChange }: Props<T>) {
  return (
    <View style={s.row}>
      {options.map((o) => (
        <TouchableOpacity
          key={String(o.value)}
          style={[s.option, value === o.value && s.active]}
          onPress={() => onChange(o.value)}
        >
          <Text style={[s.text, value === o.value && s.textActive]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  option: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#e2e8f0' },
  active: { backgroundColor: '#2563eb' },
  text: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  textActive: { color: '#fff' },
});
