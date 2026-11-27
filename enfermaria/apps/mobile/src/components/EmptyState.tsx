import React from 'react';
import { Text } from 'react-native';
import { estilosTematicos } from '../lib/tema';

interface Props { text: string }

export default function EmptyState({ text }: Props) {
  return <Text style={s.text}>{text}</Text>;
}

const s = estilosTematicos((c) => ({
  text: { color: c.textoTenue, fontSize: 14, textAlign: 'center', padding: 20 },
}));
