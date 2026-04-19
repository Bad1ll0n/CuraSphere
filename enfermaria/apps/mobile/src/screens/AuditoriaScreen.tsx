import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

interface LogEntry {
  id: string;
  acao: string;
  entidadeTipo: string | null;
  entidadeId: string | null;
  ip: string | null;
  createdAt: string;
  utilizador: { id: string; nome: string; role: string } | null;
}

interface Resposta {
  total: number;
  pagina: number;
  totalPaginas: number;
  logs: LogEntry[];
}

interface Props { utilizador: Utilizador; onVoltar?: () => void }

export default function AuditoriaScreen({ utilizador, onVoltar }: Props) {
  const [dados, setDados] = useState<Resposta | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [busca, setBusca] = useState('');

  const carregar = async (p = 1, q = busca) => {
    try {
      const params: Record<string, string> = { page: String(p) };
      if (q.trim()) params.acao = q.trim();
      const { data } = await api.get('/audit/logs', { params });
      setDados(data);
      setPagina(p);
    } catch { /* silencioso */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { carregar(1); }, []));

  const formatarData = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' }) + ' ' +
      d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={s.container}>
      {/* Cabeçalho */}
      <View style={s.header}>
        {onVoltar && (
          <TouchableOpacity onPress={onVoltar} style={s.voltarBotao}>
            <Text style={s.voltarTexto}>‹  Voltar</Text>
          </TouchableOpacity>
        )}
        <Text style={s.headerTitulo}>Auditoria</Text>
        <Text style={s.headerSub}>{dados ? `${dados.total} registos` : 'Logs de acesso e ações'}</Text>
      </View>

      {/* Pesquisa */}
      <View style={s.pesquisaWrap}>
        <TextInput
          style={s.pesquisa}
          placeholder="Filtrar por ação..."
          placeholderTextColor="#94a3b8"
          value={busca}
          onChangeText={setBusca}
          onSubmitEditing={() => carregar(1)}
          returnKeyType="search"
        />
        <TouchableOpacity style={s.pesquisaBotao} onPress={() => carregar(1)}>
          <Text style={s.pesquisaBotaoTexto}>Filtrar</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.centro}><ActivityIndicator size="large" color="#2563eb" /></View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(1); }} />}
        >
          {/* Logs */}
          <View style={s.listaCard}>
            {(dados?.logs ?? []).map((log, i) => (
              <View key={log.id} style={[s.logItem, i < (dados?.logs.length ?? 0) - 1 && s.logItemBorder]}>
                <View style={s.logTopo}>
                  <Text style={s.logAcao} numberOfLines={1}>{log.acao}</Text>
                  <Text style={s.logHora}>{formatarData(log.createdAt)}</Text>
                </View>
                <View style={s.logMeta}>
                  {log.utilizador && (
                    <Text style={s.logMetaTexto}>{log.utilizador.nome}</Text>
                  )}
                  {log.entidadeTipo && (
                    <Text style={s.logMetaTag}>{log.entidadeTipo}</Text>
                  )}
                  {log.ip && (
                    <Text style={s.logIp}>{log.ip}</Text>
                  )}
                </View>
              </View>
            ))}
            {dados?.logs.length === 0 && (
              <View style={s.semLogs}>
                <Text style={s.semLogsTexto}>Sem registos para o filtro aplicado</Text>
              </View>
            )}
          </View>

          {/* Paginação */}
          {dados && dados.totalPaginas > 1 && (
            <View style={s.paginacao}>
              <TouchableOpacity
                style={[s.pagBotao, pagina <= 1 && s.pagBotaoDesativ]}
                onPress={() => carregar(pagina - 1)}
                disabled={pagina <= 1}
              >
                <Text style={s.pagBotaoTexto}>‹ Anterior</Text>
              </TouchableOpacity>
              <Text style={s.pagInfo}>{pagina} / {dados.totalPaginas}</Text>
              <TouchableOpacity
                style={[s.pagBotao, pagina >= dados.totalPaginas && s.pagBotaoDesativ]}
                onPress={() => carregar(pagina + 1)}
                disabled={pagina >= dados.totalPaginas}
              >
                <Text style={s.pagBotaoTexto}>Próxima ›</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: '#0f172a', padding: 20, paddingTop: 16 },
  voltarBotao: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginBottom: 10 },
  voltarTexto: { color: '#fff', fontSize: 14, fontWeight: '600' },
  headerTitulo: { fontSize: 22, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
  pesquisaWrap: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  pesquisa: { flex: 1, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: '#1e293b' },
  pesquisaBotao: { backgroundColor: '#2563eb', paddingHorizontal: 14, borderRadius: 10, justifyContent: 'center' },
  pesquisaBotaoTexto: { color: '#fff', fontWeight: '600', fontSize: 13 },
  listaCard: { margin: 12, backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
  logItem: { padding: 14 },
  logItemBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  logTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  logAcao: { fontSize: 13, fontWeight: '600', color: '#1e293b', flex: 1 },
  logHora: { fontSize: 11, color: '#94a3b8' },
  logMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  logMetaTexto: { fontSize: 12, color: '#64748b' },
  logMetaTag: { fontSize: 11, backgroundColor: '#f1f5f9', color: '#475569', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  logIp: { fontSize: 11, color: '#94a3b8' },
  semLogs: { padding: 24, alignItems: 'center' },
  semLogsTexto: { color: '#94a3b8', fontSize: 14 },
  paginacao: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  pagBotao: { backgroundColor: '#2563eb', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  pagBotaoDesativ: { backgroundColor: '#e2e8f0' },
  pagBotaoTexto: { color: '#fff', fontWeight: '600', fontSize: 13 },
  pagInfo: { fontSize: 13, color: '#64748b' },
});
