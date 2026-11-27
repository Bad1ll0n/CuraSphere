import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Platform } from 'react-native';
import EmptyState from '../../../components/EmptyState';

import { registarFalhaSilenciosa } from '../../../lib/erros';
import { estilosTematicos, LETRA, useEsquema } from '../../../lib/tema';
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
  useEsquema(); // UX-24: volta a desenhar quando o telemóvel muda de claro para escuro
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
      if (Voice) { Voice.destroy().catch((e: unknown) => registarFalhaSilenciosa('TabNotas', e)); }
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
              <TouchableOpacity accessibilityRole="button" style={[s.micBtn, gravandoVoz && s.micBtnAtivo]} onPress={alternarVoz}>
                <Text style={s.micIcon}>{gravandoVoz ? '⏹' : '🎙'}</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity accessibilityRole="button"
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

const s = estilosTematicos((c) => ({
  secao: { padding: 16 },
  inputCard: { backgroundColor: c.superficie, borderRadius: 12, padding: 14, marginBottom: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  textInput: { flex: 1, borderWidth: 1, borderColor: c.borda, borderRadius: 8, padding: 10, fontSize: 14, color: c.textoSecundario, minHeight: 80, textAlignVertical: 'top' },
  micBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.fundo, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  micBtnAtivo: { backgroundColor: '#fee2e2' },
  micIcon: { fontSize: 20 },
  botao: { backgroundColor: '#2563eb', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  botaoDesativado: { backgroundColor: '#93c5fd' },
  botaoTexto: { color: '#fff', fontWeight: '700', fontSize: LETRA.corpo },
  card: { backgroundColor: c.superficie, borderRadius: 12, padding: 14, marginBottom: 8 },
  cabecalho: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  autor: { fontSize: 13, fontWeight: '600', color: c.textoSecundario },
  data: { fontSize: 13, color: c.textoTenue },
  texto: { fontSize: LETRA.corpo, color: c.textoSecundario, lineHeight: 20 },
}));
