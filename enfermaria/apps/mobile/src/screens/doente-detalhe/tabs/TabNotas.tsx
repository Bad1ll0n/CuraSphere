import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import EmptyState from '../../../components/EmptyState';

// Lazy import to avoid crash if native module not linked in Expo Go
let Voice: any = null;
try {
  Voice = require('@react-native-voice/voice').default;
} catch { /* not available in Expo Go */ }

interface Props {
  notas: any[];
  nota: string;
  setNota: (v: string) => void;
  gravandoNota: boolean;
  onGravar: () => void;
  podeCriarNota: boolean;
}

export default function TabNotas({ notas, nota, setNota, gravandoNota, onGravar, podeCriarNota }: Props) {
  const [gravandoVoz, setGravandoVoz] = useState(false);
  const notaRef = useRef(nota);
  notaRef.current = nota;

  useEffect(() => {
    if (!Voice) return;
    Voice.onSpeechResults = (e: any) => {
      const texto = e.value?.[0] ?? '';
      if (texto) {
        const atual = notaRef.current;
        setNota(atual ? `${atual} ${texto}` : texto);
      }
    };
    Voice.onSpeechEnd = () => setGravandoVoz(false);
    Voice.onSpeechError = () => setGravandoVoz(false);
    return () => {
      if (Voice) { Voice.destroy().catch(() => {}); }
    };
  }, []);

  const alternarVoz = async () => {
    if (!Voice) return;
    if (gravandoVoz) {
      await Voice.stop();
      setGravandoVoz(false);
    } else {
      try {
        await Voice.start(Platform.OS === 'ios' ? 'pt-PT' : 'pt_PT');
        setGravandoVoz(true);
      } catch { setGravandoVoz(false); }
    }
  };

  return (
    <View style={s.secao}>
      {podeCriarNota && (
        <View style={s.inputCard}>
          <View style={s.inputRow}>
            <TextInput
              style={s.textInput}
              value={nota}
              onChangeText={setNota}
              placeholder="Escrever nota de turno..."
              multiline
              numberOfLines={3}
            />
            {Voice && (
              <TouchableOpacity style={[s.micBtn, gravandoVoz && s.micBtnAtivo]} onPress={alternarVoz}>
                <Text style={s.micIcon}>{gravandoVoz ? '⏹' : '🎙'}</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[s.botao, !nota.trim() && s.botaoDesativado]}
            onPress={onGravar}
            disabled={gravandoNota || !nota.trim()}>
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
  inputRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  textInput: { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, fontSize: 14, color: '#334155', minHeight: 80, textAlignVertical: 'top' },
  micBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  micBtnAtivo: { backgroundColor: '#fee2e2' },
  micIcon: { fontSize: 20 },
  botao: { backgroundColor: '#2563eb', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  botaoDesativado: { backgroundColor: '#93c5fd' },
  botaoTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8 },
  cabecalho: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  autor: { fontSize: 13, fontWeight: '600', color: '#475569' },
  data: { fontSize: 12, color: '#94a3b8' },
  texto: { fontSize: 14, color: '#334155', lineHeight: 20 },
});
