import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import EmptyState from '../../../components/EmptyState';

interface Props {
  notas: any[];
  nota: string;
  setNota: (v: string) => void;
  gravandoNota: boolean;
  onGravar: () => void;
  podeCriarNota: boolean;
}

export default function TabNotas({ notas, nota, setNota, gravandoNota, onGravar, podeCriarNota }: Props) {
  return (
    <View style={s.secao}>
      {podeCriarNota && (
        <View style={s.inputCard}>
          <TextInput style={s.textInput} value={nota} onChangeText={setNota} placeholder="Escrever nota de turno..." multiline numberOfLines={3} />
          <TouchableOpacity style={[s.botao, !nota.trim() && s.botaoDesativado]} onPress={onGravar} disabled={gravandoNota || !nota.trim()}>
            <Text style={s.botaoTexto}>Guardar</Text>
          </TouchableOpacity>
        </View>
      )}
      {notas.length === 0 ? <EmptyState text="Sem notas registadas" /> : notas.map((n: any) => (
        <View key={n.id} style={s.card}>
          <View style={s.cabecalho}>
            <Text style={s.autor}>{n.autor.nome}</Text>
            <Text style={s.data}>{new Date(n.criadaEm).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</Text>
          </View>
          <Text style={s.texto}>{n.texto}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  secao: { padding: 16 },
  inputCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12 },
  textInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, fontSize: 14, color: '#334155', minHeight: 80, textAlignVertical: 'top', marginBottom: 10 },
  botao: { backgroundColor: '#2563eb', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  botaoDesativado: { backgroundColor: '#93c5fd' },
  botaoTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8 },
  cabecalho: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  autor: { fontSize: 13, fontWeight: '600', color: '#475569' },
  data: { fontSize: 12, color: '#94a3b8' },
  texto: { fontSize: 14, color: '#334155', lineHeight: 20 },
});
