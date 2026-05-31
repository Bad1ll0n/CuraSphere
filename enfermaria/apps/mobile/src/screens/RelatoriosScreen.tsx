import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

type TabKey = 'internamento' | 'ocupacao' | 'diagnosticos' | 'medicamentos' | 'urgencia' | 'produtividade';

interface ResInternamento {
  totalAltas: number;
  demoraMedia: number;
  demoraMediaPorServico: number;
  resumoPorServico: { servico: string; totalInternados: number; totalAltas: number; demoraMedia: number }[];
}

interface ResOcupacao {
  taxaOcupacaoMedia: number;
  estadoAtualCamas: { servico: string; total: number; ocupadas: number; livres: number; taxa: number }[];
}

interface ResDiagnosticos {
  total: number;
  top20: { cid10: string; descricao: string; count: number }[];
}

interface ResMedicamentos {
  totalAdministracoes: number;
  top20: { nome: string; count: number }[];
}

interface ResUrgencia {
  total: number;
  distribuicaoPorTriagem: { triagem: string; count: number; percentagem: number }[];
}

interface ResProdutividade {
  periodo: string;
  totalAcoes: number;
  linhas: { nome: string; role: string; totalAcoes: number; notas: number; tarefas: number; escalas: number; exames: number; medicacoes: number }[];
}

type TabData = ResInternamento | ResOcupacao | ResDiagnosticos | ResMedicamentos | ResUrgencia | ResProdutividade;

interface Props { utilizador: Utilizador; onVoltar: () => void }

const TABS: { key: TabKey; label: string }[] = [
  { key: 'internamento', label: 'Internamento' },
  { key: 'ocupacao', label: 'Ocupação' },
  { key: 'diagnosticos', label: 'Diagnósticos' },
  { key: 'medicamentos', label: 'Medicamentos' },
  { key: 'urgencia', label: 'Urgência' },
  { key: 'produtividade', label: 'Produtividade' },
];

const TRIAGEM_COR: Record<string, { bg: string; text: string }> = {
  vermelho:  { bg: '#fef2f2', text: '#dc2626' },
  laranja:   { bg: '#fff7ed', text: '#ea580c' },
  amarelo:   { bg: '#fefce8', text: '#ca8a04' },
  verde:     { bg: '#f0fdf4', text: '#16a34a' },
  azul:      { bg: '#eff6ff', text: '#2563eb' },
};

function fmtData(d: Date) {
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function primeiroDoMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default function RelatoriosScreen({ utilizador, onVoltar }: Props) {
  const [abaAtual, setAbaAtual] = useState<TabKey>('internamento');
  const [loadingAba, setLoadingAba] = useState(false);
  const cacheRef = useRef<Partial<Record<TabKey, TabData>>>({});
  const [dadosAba, setDadosAba] = useState<Partial<Record<TabKey, TabData>>>({});

  const inicio = primeiroDoMes();
  const fim = new Date();

  const inicioStr = inicio.toISOString().split('T')[0];
  const fimStr = fim.toISOString().split('T')[0];

  const carregarAba = useCallback(async (tab: TabKey) => {
    if (cacheRef.current[tab] !== undefined) return;
    setLoadingAba(true);
    try {
      const r = await api.get(`/relatorios/${tab}`, { params: { inicio: inicioStr, fim: fimStr } });
      cacheRef.current[tab] = r.data;
      setDadosAba(prev => ({ ...prev, [tab]: r.data }));
    } catch { /* ignorar */ }
    finally { setLoadingAba(false); }
  }, [inicioStr, fimStr]);

  useFocusEffect(useCallback(() => {
    cacheRef.current = {};
    setDadosAba({});
    carregarAba('internamento');
  }, []));

  const mudarAba = (tab: TabKey) => {
    setAbaAtual(tab);
    carregarAba(tab);
  };

  const dados = dadosAba[abaAtual];

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={onVoltar} style={s.btnVoltar}>
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={s.headerTitulo}>Relatórios</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Seletor de período */}
      <View style={s.periodoRow}>
        <Ionicons name="calendar-outline" size={15} color="#64748b" />
        <TouchableOpacity style={s.periodoBtn}>
          <Text style={s.periodoBtnTexto}>Início: {fmtData(inicio)}</Text>
        </TouchableOpacity>
        <Text style={s.periodoDash}>—</Text>
        <TouchableOpacity style={s.periodoBtn}>
          <Text style={s.periodoBtnTexto}>Fim: {fmtData(fim)}</Text>
        </TouchableOpacity>
      </View>

      {/* Tab pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabScroll} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[s.tabPill, abaAtual === t.key && s.tabPillAtivo]}
            onPress={() => mudarAba(t.key)}
            activeOpacity={0.7}
          >
            <Text style={[s.tabPillTexto, abaAtual === t.key && s.tabPillTextoAtivo]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Conteúdo */}
      {loadingAba && !dados ? (
        <View style={s.centro}><ActivityIndicator size="large" color="#6366f1" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
          {abaAtual === 'internamento' && (() => {
            const d = dados as ResInternamento | undefined;
            if (!d) return <Text style={s.vazioTexto}>Sem dados</Text>;
            return (
              <>
                <View style={s.kpiRow}>
                  <View style={s.kpiCard}>
                    <Text style={s.kpiNum}>{d.totalAltas}</Text>
                    <Text style={s.kpiLabel}>Total Altas</Text>
                  </View>
                  <View style={s.kpiCard}>
                    <Text style={s.kpiNum}>{typeof d.demoraMedia === 'number' ? d.demoraMedia.toFixed(1) : '—'}</Text>
                    <Text style={s.kpiLabel}>Demora Média (dias)</Text>
                  </View>
                </View>
                {d.resumoPorServico?.map(row => (
                  <View key={row.servico} style={s.listaCard}>
                    <Text style={s.listaCardNome}>{row.servico}</Text>
                    <View style={s.listaCardMeta}>
                      <Text style={s.listaCardMetaTexto}>Internados: <Text style={s.listaCardMetaVal}>{row.totalInternados}</Text></Text>
                      <Text style={s.listaCardMetaTexto}>Altas: <Text style={s.listaCardMetaVal}>{row.totalAltas}</Text></Text>
                      <Text style={s.listaCardMetaTexto}>D.M.: <Text style={s.listaCardMetaVal}>{row.demoraMedia.toFixed(1)}d</Text></Text>
                    </View>
                  </View>
                ))}
              </>
            );
          })()}

          {abaAtual === 'ocupacao' && (() => {
            const d = dados as ResOcupacao | undefined;
            if (!d) return <Text style={s.vazioTexto}>Sem dados</Text>;
            return (
              <>
                <View style={s.kpiCardFull}>
                  <Text style={s.kpiNumGrande}>{d.taxaOcupacaoMedia?.toFixed(1)}%</Text>
                  <Text style={s.kpiLabel}>Taxa Média de Ocupação</Text>
                </View>
                {d.estadoAtualCamas?.map(row => (
                  <View key={row.servico} style={s.listaCard}>
                    <Text style={s.listaCardNome}>{row.servico}</Text>
                    <View style={s.listaCardMeta}>
                      <Text style={s.listaCardMetaTexto}>Total: <Text style={s.listaCardMetaVal}>{row.total}</Text></Text>
                      <Text style={s.listaCardMetaTexto}>Ocupadas: <Text style={s.listaCardMetaVal}>{row.ocupadas}</Text></Text>
                      <Text style={s.listaCardMetaTexto}>Livres: <Text style={s.listaCardMetaVal}>{row.livres}</Text></Text>
                      <Text style={s.listaCardMetaTexto}>Taxa: <Text style={[s.listaCardMetaVal, { color: '#6366f1' }]}>{row.taxa.toFixed(1)}%</Text></Text>
                    </View>
                  </View>
                ))}
              </>
            );
          })()}

          {abaAtual === 'diagnosticos' && (() => {
            const d = dados as ResDiagnosticos | undefined;
            if (!d) return <Text style={s.vazioTexto}>Sem dados</Text>;
            return (
              <>
                <View style={s.kpiCardFull}>
                  <Text style={s.kpiNumGrande}>{d.total}</Text>
                  <Text style={s.kpiLabel}>Total de Diagnósticos</Text>
                </View>
                {d.top20?.map((item, i) => (
                  <View key={item.cid10} style={s.rankCard}>
                    <Text style={s.rankNum}>#{i + 1}</Text>
                    <View style={s.rankBadge}>
                      <Text style={s.rankBadgeTexto}>{item.cid10}</Text>
                    </View>
                    <Text style={s.rankDescricao} numberOfLines={2}>{item.descricao}</Text>
                    <Text style={s.rankCount}>{item.count}</Text>
                  </View>
                ))}
              </>
            );
          })()}

          {abaAtual === 'medicamentos' && (() => {
            const d = dados as ResMedicamentos | undefined;
            if (!d) return <Text style={s.vazioTexto}>Sem dados</Text>;
            return (
              <>
                <View style={s.kpiCardFull}>
                  <Text style={s.kpiNumGrande}>{d.totalAdministracoes}</Text>
                  <Text style={s.kpiLabel}>Total Administrações</Text>
                </View>
                {d.top20?.map((item, i) => (
                  <View key={item.nome} style={s.rankCard}>
                    <Text style={s.rankNum}>#{i + 1}</Text>
                    <Text style={[s.rankDescricao, { flex: 1 }]} numberOfLines={2}>{item.nome}</Text>
                    <Text style={s.rankCount}>{item.count}</Text>
                  </View>
                ))}
              </>
            );
          })()}

          {abaAtual === 'urgencia' && (() => {
            const d = dados as ResUrgencia | undefined;
            if (!d) return <Text style={s.vazioTexto}>Sem dados</Text>;
            return (
              <>
                <View style={s.kpiCardFull}>
                  <Text style={s.kpiNumGrande}>{d.total}</Text>
                  <Text style={s.kpiLabel}>Total de Episódios</Text>
                </View>
                {d.distribuicaoPorTriagem?.map(item => {
                  const cor = TRIAGEM_COR[item.triagem.toLowerCase()] ?? { bg: '#f1f5f9', text: '#475569' };
                  return (
                    <View key={item.triagem} style={s.listaCard}>
                      <View style={s.listaCardTopo}>
                        <View style={[s.triagemBadge, { backgroundColor: cor.bg }]}>
                          <Text style={[s.triagemBadgeTexto, { color: cor.text }]}>{item.triagem}</Text>
                        </View>
                        <Text style={s.rankCount}>{item.count}</Text>
                        <Text style={s.triagemPct}>{item.percentagem.toFixed(1)}%</Text>
                      </View>
                    </View>
                  );
                })}
              </>
            );
          })()}

          {abaAtual === 'produtividade' && (() => {
            const d = dados as ResProdutividade | undefined;
            if (!d) return <Text style={s.vazioTexto}>Sem dados</Text>;
            return (
              <>
                <View style={s.kpiCardFull}>
                  <Text style={s.kpiNumGrande}>{d.totalAcoes}</Text>
                  <Text style={s.kpiLabel}>Total de Ações</Text>
                </View>
                {d.linhas?.map(linha => (
                  <View key={linha.nome} style={s.listaCard}>
                    <View style={s.listaCardTopo}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.listaCardNome}>{linha.nome}</Text>
                        <Text style={s.listaCardRole}>{linha.role}</Text>
                      </View>
                      <Text style={s.rankCount}>{linha.totalAcoes}</Text>
                    </View>
                    <View style={s.listaCardMeta}>
                      <Text style={s.listaCardMetaTexto}>Notas: <Text style={s.listaCardMetaVal}>{linha.notas}</Text></Text>
                      <Text style={s.listaCardMetaTexto}>Tarefas: <Text style={s.listaCardMetaVal}>{linha.tarefas}</Text></Text>
                      <Text style={s.listaCardMetaTexto}>Escalas: <Text style={s.listaCardMetaVal}>{linha.escalas}</Text></Text>
                      <Text style={s.listaCardMetaTexto}>Exames: <Text style={s.listaCardMetaVal}>{linha.exames}</Text></Text>
                      <Text style={s.listaCardMetaTexto}>Medicações: <Text style={s.listaCardMetaVal}>{linha.medicacoes}</Text></Text>
                    </View>
                  </View>
                ))}
              </>
            );
          })()}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  btnVoltar: {
    width: 38, height: 38, borderRadius: 10, backgroundColor: '#f1f5f9',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitulo: { fontSize: 17, fontWeight: '700', color: '#0f172a' },

  periodoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  periodoBtn: {
    backgroundColor: '#f1f5f9', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  periodoBtnTexto: { fontSize: 13, color: '#334155', fontWeight: '500' },
  periodoDash: { fontSize: 13, color: '#94a3b8' },

  tabScroll: { flexGrow: 0, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingVertical: 10 },
  tabPill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0',
  },
  tabPillAtivo: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  tabPillTexto: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  tabPillTextoAtivo: { color: '#fff', fontWeight: '700' },

  vazioTexto: { color: '#94a3b8', fontSize: 14, textAlign: 'center', marginTop: 32 },

  kpiRow: { flexDirection: 'row', gap: 10 },
  kpiCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center',
  },
  kpiCardFull: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center',
  },
  kpiNum: { fontSize: 28, fontWeight: '800', color: '#0f172a' },
  kpiNumGrande: { fontSize: 36, fontWeight: '800', color: '#0f172a' },
  kpiLabel: { fontSize: 12, color: '#64748b', marginTop: 4, textAlign: 'center' },

  listaCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  listaCardTopo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  listaCardNome: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
  listaCardRole: { fontSize: 11, color: '#64748b', marginTop: 1 },
  listaCardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  listaCardMetaTexto: { fontSize: 12, color: '#64748b' },
  listaCardMetaVal: { fontWeight: '700', color: '#0f172a' },

  rankCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  rankNum: { fontSize: 13, fontWeight: '700', color: '#94a3b8', width: 28 },
  rankBadge: { backgroundColor: '#eff6ff', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  rankBadgeTexto: { fontSize: 11, fontWeight: '700', color: '#2563eb' },
  rankDescricao: { flex: 1, fontSize: 13, color: '#334155' },
  rankCount: { fontSize: 15, fontWeight: '800', color: '#0f172a', minWidth: 36, textAlign: 'right' },

  triagemBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start' },
  triagemBadgeTexto: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  triagemPct: { fontSize: 13, color: '#64748b', fontWeight: '600', minWidth: 44, textAlign: 'right' },
});
