import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';

const ALERT_STYLES: Record<string, { bg: string; border: string; label: string }> = {
  ia_watchdog:          { bg: '#fdf4ff', border: '#a855f7', label: '🧠 IA Watchdog' },
  escalacao_automatica: { bg: '#fff1f2', border: '#f43f5e', label: '⬆️ Escalação' },
  news2_critico:        { bg: '#fef2f2', border: '#ef4444', label: '🚨 NEWS2 Crítico' },
  sepsis:               { bg: '#fff7ed', border: '#f97316', label: '⚠️ Sépsis' },
  sos:                  { bg: '#fff1f2', border: '#be123c', label: '🆘 SOS' },
  default:              { bg: '#f8fafc', border: '#94a3b8', label: '🔔 Alerta' },
};

function formatarTempo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

interface Alerta {
  id: string;
  tipo: string;
  mensagem: string;
  lido: boolean;
  criadoEm: string;
}

interface Props {
  alertas: Alerta[];
  onMarcarLido: (id: string) => void;
}

export default function TabAlertas({ alertas, onMarcarLido }: Props) {
  const sorted = [...alertas].sort((a, b) => {
    if (a.lido !== b.lido) return a.lido ? 1 : -1;
    return new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime();
  });

  if (sorted.length === 0) {
    return (
      <View style={s.vazio}>
        <Text style={s.vazioTexto}>Sem alertas activos</Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {sorted.map((alerta) => {
        const estilo = ALERT_STYLES[alerta.tipo] ?? ALERT_STYLES.default;
        return (
          <TouchableOpacity
            key={alerta.id}
            onPress={() => !alerta.lido && onMarcarLido(alerta.id)}
            activeOpacity={alerta.lido ? 1 : 0.7}
            style={[s.card, { backgroundColor: estilo.bg, borderLeftColor: estilo.border, opacity: alerta.lido ? 0.6 : 1 }]}
          >
            <View style={s.cardTopo}>
              <Text style={[s.cardLabel, { color: estilo.border }]}>{estilo.label}</Text>
              <View style={s.cardDireita}>
                <Text style={s.cardTempo}>{formatarTempo(alerta.criadoEm)}</Text>
                {!alerta.lido && <View style={s.badgeNaoLido} />}
              </View>
            </View>
            <Text style={s.cardMensagem}>{alerta.mensagem}</Text>
            {!alerta.lido && (
              <Text style={s.tapParaLer}>Toque para marcar como lido</Text>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1 },
  content:      { padding: 16, gap: 10 },
  vazio:        { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  vazioTexto:   { color: '#94a3b8', fontSize: 14, textAlign: 'center' },
  card:         { borderLeftWidth: 4, borderRadius: 12, padding: 14, backgroundColor: '#f8fafc' },
  cardTopo:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardLabel:    { fontSize: 12, fontWeight: '700' },
  cardDireita:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTempo:    { fontSize: 11, color: '#94a3b8' },
  badgeNaoLido: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' },
  cardMensagem: { fontSize: 13, color: '#334155', lineHeight: 19 },
  tapParaLer:   { fontSize: 11, color: '#94a3b8', marginTop: 6, fontStyle: 'italic' },
});
