import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { estilosTematicos, LETRA, useEsquema } from '../../../lib/tema';

interface Props {
  escalas: { braden?: any; morse?: any };
  onAvaliar: (tipo: 'braden' | 'morse') => void;
}

export default function TabEscalas({ escalas, onAvaliar }: Props) {
  useEsquema(); // UX-24: volta a desenhar quando o telemóvel muda de claro para escuro
  return (
    <View style={s.secao}>
      <EscalaCard
        titulo="Escala de Braden"
        subtitulo="Risco de úlcera de pressão"
        avaliacao={escalas.braden}
        riscoMap={{ baixo: '#dcfce7', moderado: '#fef9c3', alto: '#ffedd5', muito_alto: '#fee2e2' }}
        riscoTextMap={{ baixo: '#16a34a', moderado: '#92400e', alto: '#c2410c', muito_alto: '#b91c1c' }}
        riscoLabel={{ baixo: 'Baixo', moderado: 'Moderado', alto: 'Alto', muito_alto: 'Muito Alto' }}
        onAvaliar={() => onAvaliar('braden')}
      />
      <EscalaCard
        titulo="Escala de Morse"
        subtitulo="Risco de queda"
        avaliacao={escalas.morse}
        riscoMap={{ baixo: '#dcfce7', moderado: '#fef9c3', alto: '#fee2e2' }}
        riscoTextMap={{ baixo: '#16a34a', moderado: '#92400e', alto: '#b91c1c' }}
        riscoLabel={{ baixo: 'Baixo', moderado: 'Moderado', alto: 'Alto' }}
        onAvaliar={() => onAvaliar('morse')}
      />
    </View>
  );
}

function EscalaCard({ titulo, subtitulo, avaliacao, riscoMap, riscoTextMap, riscoLabel, onAvaliar }: {
  titulo: string; subtitulo: string; avaliacao: any;
  riscoMap: Record<string, string>; riscoTextMap: Record<string, string>; riscoLabel: Record<string, string>;
  onAvaliar: () => void;
}) {
  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View>
          <Text style={s.titulo}>{titulo}</Text>
          <Text style={s.subtitulo}>{subtitulo}</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" style={s.avaliarBotao} onPress={onAvaliar}>
          <Text style={s.avaliarTexto}>+ Avaliar</Text>
        </TouchableOpacity>
      </View>
      {avaliacao ? (
        <View style={s.resultado}>
          <View style={[s.badge, { backgroundColor: riscoMap[avaliacao.risco] ?? '#f1f5f9' }]}>
            <Text style={[s.badgeTexto, { color: riscoTextMap[avaliacao.risco] ?? '#64748b' }]}>{riscoLabel[avaliacao.risco] ?? avaliacao.risco}</Text>
          </View>
          <Text style={s.pontuacao}>{avaliacao.pontuacao} pts</Text>
          <Text style={s.dataText}>{new Date(avaliacao.criadaEm).toLocaleDateString('pt-PT')}</Text>
        </View>
      ) : (
        <Text style={s.semDados}>Sem avaliação registada</Text>
      )}
    </View>
  );
}

const s = estilosTematicos((c) => ({
  secao: { padding: 16 },
  card: { backgroundColor: c.superficie, borderRadius: 12, padding: 14, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  titulo: { fontSize: 15, fontWeight: '700', color: c.texto },
  subtitulo: { fontSize: LETRA.corpo, color: c.textoTenue, marginTop: 2 },
  avaliarBotao: { backgroundColor: '#2563eb', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  avaliarTexto: { color: '#fff', fontSize: LETRA.corpo, fontWeight: '700' },
  resultado: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeTexto: { fontSize: LETRA.corpo, fontWeight: '700' },
  pontuacao: { fontSize: 16, fontWeight: '700', color: c.texto },
  dataText: { fontSize: 13, color: c.textoTenue, marginLeft: 'auto' as any },
  semDados: { fontSize: 13, color: c.textoTenue, fontStyle: 'italic' },
}));
