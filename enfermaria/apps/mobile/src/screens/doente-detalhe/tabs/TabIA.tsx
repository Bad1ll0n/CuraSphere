import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import api from '../../../lib/api';

interface Props {
  doenteId: string;
}

export default function TabIA({ doenteId }: Props) {
  const [analise, setAnalise] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const analisar = async () => {
    setLoading(true);
    setErro('');
    try {
      const res = await api.get(`/ai-clinico/${doenteId}`);
      setAnalise(res.data);
    } catch {
      setErro('Erro ao carregar análise IA. Verifique a ligação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.cabecalho}>
        <Text style={s.titulo}>Análise Clínica IA</Text>
        <Text style={s.subtitulo}>Análise de apoio — não substitui avaliação clínica</Text>
      </View>

      {!analise && !loading && (
        <TouchableOpacity style={s.botao} onPress={analisar}>
          <Text style={s.botaoIcon}>🧠</Text>
          <Text style={s.botaoTexto}>Analisar com IA</Text>
        </TouchableOpacity>
      )}

      {loading && (
        <View style={s.loadingBox}>
          <ActivityIndicator color="#7c3aed" size="large" />
          <Text style={s.loadingTexto}>A analisar dados clínicos...</Text>
        </View>
      )}

      {erro ? (
        <View style={s.erroBox}>
          <Text style={s.erroTexto}>⚠ {erro}</Text>
        </View>
      ) : null}

      {analise && (
        <View style={s.resultados}>
          {analise.observacoes && (
            <View style={s.secao}>
              <Text style={s.secaoTitulo}>Observações</Text>
              <Text style={s.secaoTexto}>{analise.observacoes}</Text>
            </View>
          )}

          {(analise.padroesDetectados?.length ?? 0) > 0 && (
            <View style={s.secao}>
              <Text style={s.secaoTitulo}>Padrões Detectados</Text>
              {analise.padroesDetectados.map((p: string, i: number) => (
                <View key={i} style={s.item}>
                  <Text style={s.itemBullet}>·</Text>
                  <Text style={s.itemTexto}>{p}</Text>
                </View>
              ))}
            </View>
          )}

          {(analise.investigacoesAConsiderar?.length ?? 0) > 0 && (
            <View style={s.secao}>
              <Text style={s.secaoTitulo}>Investigações a Considerar</Text>
              {analise.investigacoesAConsiderar.map((inv: string, i: number) => (
                <View key={i} style={s.item}>
                  <Text style={s.itemBullet}>·</Text>
                  <Text style={s.itemTexto}>{inv}</Text>
                </View>
              ))}
            </View>
          )}

          {analise.nivelUrgencia && (
            <View style={[s.urgenciaBox, analise.nivelUrgencia === 'urgente' && s.urgenciaBoxAlt]}>
              <Text style={s.urgenciaTexto}>
                Nível de urgência: <Text style={s.urgenciaNivel}>{analise.nivelUrgencia}</Text>
              </Text>
            </View>
          )}

          <TouchableOpacity style={s.botaoReanalisar} onPress={analisar}>
            <Text style={s.botaoReanalisarTexto}>↺ Reanalisar</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  cabecalho: { marginBottom: 16 },
  titulo: { fontSize: 17, fontWeight: '700', color: '#1e1b4b' },
  subtitulo: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  botao: { backgroundColor: '#7c3aed', borderRadius: 14, paddingVertical: 18, alignItems: 'center', gap: 6 },
  botaoIcon: { fontSize: 28 },
  botaoTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },
  loadingBox: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  loadingTexto: { color: '#7c3aed', fontSize: 14 },
  erroBox: { backgroundColor: '#fef2f2', borderRadius: 10, padding: 12 },
  erroTexto: { color: '#dc2626', fontSize: 13 },
  resultados: { gap: 12 },
  secao: { backgroundColor: '#fff', borderRadius: 12, padding: 14 },
  secaoTitulo: { fontSize: 13, fontWeight: '700', color: '#7c3aed', marginBottom: 8 },
  secaoTexto: { fontSize: 14, color: '#334155', lineHeight: 20 },
  item: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  itemBullet: { color: '#7c3aed', fontSize: 16, lineHeight: 20 },
  itemTexto: { flex: 1, fontSize: 14, color: '#334155', lineHeight: 20 },
  urgenciaBox: { backgroundColor: '#f0fdf4', borderRadius: 10, padding: 12 },
  urgenciaBoxAlt: { backgroundColor: '#fef2f2' },
  urgenciaTexto: { fontSize: 13, color: '#334155' },
  urgenciaNivel: { fontWeight: '700', textTransform: 'capitalize' },
  botaoReanalisar: { borderWidth: 1, borderColor: '#7c3aed', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  botaoReanalisarTexto: { color: '#7c3aed', fontWeight: '600', fontSize: 14 },
});
