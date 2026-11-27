import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import api from '../../../lib/api';
import { estilosTematicos, LETRA, useEsquema } from '../../../lib/tema';

interface Props {
  doenteId: string;
}

export default function TabIA({ doenteId }: Props) {
  useEsquema(); // UX-24: volta a desenhar quando o telemóvel muda de claro para escuro
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
        <TouchableOpacity accessibilityRole="button" style={s.botao} onPress={analisar}>
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
              <Text style={s.secaoTitulo}>Padrões Detetados</Text>
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

          <TouchableOpacity accessibilityRole="button" style={s.botaoReanalisar} onPress={analisar}>
            <Text style={s.botaoReanalisarTexto}>↺ Reanalisar</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const s = estilosTematicos((c) => ({
  container: { flex: 1 },
  content: { padding: 16 },
  cabecalho: { marginBottom: 16 },
  titulo: { fontSize: 17, fontWeight: '700', color: '#1e1b4b' },
  subtitulo: { fontSize: LETRA.corpo, color: c.textoTenue, marginTop: 2 },
  botao: { backgroundColor: '#7c3aed', borderRadius: 14, paddingVertical: 18, alignItems: 'center', gap: 6 },
  botaoIcon: { fontSize: 28 },
  botaoTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },
  loadingBox: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  loadingTexto: { color: '#7c3aed', fontSize: LETRA.corpo },
  erroBox: { backgroundColor: '#fef2f2', borderRadius: 10, padding: 12 },
  erroTexto: { color: '#dc2626', fontSize: LETRA.corpo },
  resultados: { gap: 12 },
  secao: { backgroundColor: c.superficie, borderRadius: 12, padding: 14 },
  secaoTitulo: { fontSize: LETRA.corpo, fontWeight: '700', color: '#7c3aed', marginBottom: 8 },
  secaoTexto: { fontSize: LETRA.corpo, color: c.textoSecundario, lineHeight: 20 },
  item: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  itemBullet: { color: '#7c3aed', fontSize: 16, lineHeight: 20 },
  itemTexto: { flex: 1, fontSize: LETRA.corpo, color: c.textoSecundario, lineHeight: 20 },
  urgenciaBox: { backgroundColor: '#f0fdf4', borderRadius: 10, padding: 12 },
  urgenciaBoxAlt: { backgroundColor: '#fef2f2' },
  urgenciaTexto: { fontSize: LETRA.corpo, color: c.textoSecundario },
  urgenciaNivel: { fontWeight: '700', textTransform: 'capitalize' },
  botaoReanalisar: { borderWidth: 1, borderColor: '#7c3aed', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  botaoReanalisarTexto: { color: '#7c3aed', fontWeight: '600', fontSize: LETRA.corpo },
}));
