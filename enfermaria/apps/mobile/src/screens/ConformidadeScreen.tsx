import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

interface AuditEntry {
  id: string;
  acao: string;
  entidadeId?: string;
  entidadeTipo?: string;
  ip?: string;
  createdAt: string;
  utilizador?: { id: string; nome: string; role: string };
}

interface Conformidade {
  acessosDoentes: AuditEntry[];
  acoesAltoRisco: AuditEntry[];
  totalUtilizadoresUnicos: number;
  totalAcessos30dias: number;
}

type EstadoChecklist = 'conforme' | 'verificar' | 'nao_conforme';

interface ChecklistItem {
  itemKey: string;
  estado: EstadoChecklist;
  atualizadoEm: string | null;
}

type TabKey = 'checklist' | 'acessos' | 'alto_risco';

interface Props { utilizador: Utilizador; onVoltar: () => void }

const CHECKLIST_DEF = [
  { id: 'rgpd_1', label: 'Registo de acessos a dados pessoais activo', categoria: 'RGPD' },
  { id: 'rgpd_2', label: 'Política de retenção de dados documentada', categoria: 'RGPD' },
  { id: 'rgpd_3', label: 'Designação de DPO comunicada à CNPD', categoria: 'RGPD' },
  { id: 'dgs_1',  label: 'Notificação de incidentes de segurança à DGS', categoria: 'DGS' },
  { id: 'dgs_2',  label: 'Plano de emergência hospitalar actualizado', categoria: 'DGS' },
  { id: 'acss_1', label: 'Relatório de qualidade enviado à ACSS', categoria: 'ACSS' },
  { id: 'acss_2', label: 'Indicadores de segurança do doente registados', categoria: 'ACSS' },
  { id: 'sns_1',  label: 'Integração SNS24 testada', categoria: 'SNS' },
];

const ESTADO_CFG: Record<EstadoChecklist, { label: string; bg: string; text: string }> = {
  conforme:      { label: 'Conforme',     bg: '#f0fdf4', text: '#16a34a' },
  verificar:     { label: 'A Verificar',  bg: '#fefce8', text: '#ca8a04' },
  nao_conforme:  { label: 'Não Conforme', bg: '#fef2f2', text: '#dc2626' },
};

const ESTADO_CICLO: EstadoChecklist[] = ['conforme', 'verificar', 'nao_conforme'];

function proximoEstado(atual: EstadoChecklist): EstadoChecklist {
  const idx = ESTADO_CICLO.indexOf(atual);
  return ESTADO_CICLO[(idx + 1) % ESTADO_CICLO.length];
}

function fmtData(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' + d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

export default function ConformidadeScreen({ utilizador, onVoltar }: Props) {
  const [abaAtual, setAbaAtual] = useState<TabKey>('checklist');
  const [loadingChecklist, setLoadingChecklist] = useState(true);
  const [loadingConformidade, setLoadingConformidade] = useState(true);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [conformidade, setConformidade] = useState<Conformidade | null>(null);
  const [atualizando, setAtualizando] = useState<string | null>(null);

  const carregarChecklist = async () => {
    setLoadingChecklist(true);
    try {
      const r = await api.get('/audit/checklist');
      setChecklist(r.data ?? []);
    } catch { /* ignorar */ }
    finally { setLoadingChecklist(false); }
  };

  const carregarConformidade = async () => {
    setLoadingConformidade(true);
    try {
      const r = await api.get('/audit/conformidade');
      setConformidade(r.data);
    } catch { /* ignorar */ }
    finally { setLoadingConformidade(false); }
  };

  useFocusEffect(useCallback(() => {
    carregarChecklist();
    carregarConformidade();
  }, []));

  const ciclarEstado = async (itemKey: string, estadoAtual: EstadoChecklist) => {
    const novoEstado = proximoEstado(estadoAtual);
    setAtualizando(itemKey);
    setChecklist(prev => prev.map(it => it.itemKey === itemKey ? { ...it, estado: novoEstado } : it));
    try {
      await api.patch(`/audit/checklist/${itemKey}`, { estado: novoEstado });
    } catch {
      setChecklist(prev => prev.map(it => it.itemKey === itemKey ? { ...it, estado: estadoAtual } : it));
    } finally {
      setAtualizando(null);
    }
  };

  const getEstado = (itemKey: string): EstadoChecklist => {
    const found = checklist.find(c => c.itemKey === itemKey);
    return found?.estado ?? 'verificar';
  };

  const countEstado = (est: EstadoChecklist) =>
    CHECKLIST_DEF.filter(def => getEstado(def.id) === est).length;

  const categorias = Array.from(new Set(CHECKLIST_DEF.map(d => d.categoria)));

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'checklist', label: 'Checklist' },
    { key: 'acessos', label: 'Acessos' },
    { key: 'alto_risco', label: 'Alto Risco' },
  ];

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={onVoltar} style={s.btnVoltar}>
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={s.headerTitulo}>Conformidade</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[s.tab, abaAtual === t.key && s.tabAtiva]}
            onPress={() => setAbaAtual(t.key)}
          >
            <Text style={[s.tabLabel, abaAtual === t.key && s.tabLabelAtiva]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Aba Checklist */}
      {abaAtual === 'checklist' && (
        loadingChecklist ? (
          <View style={s.centro}><ActivityIndicator size="large" color="#6366f1" /></View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
            {/* KPI chips */}
            <View style={s.kpiChipsRow}>
              <View style={[s.kpiChip, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                <Text style={[s.kpiChipNum, { color: '#16a34a' }]}>{countEstado('conforme')}</Text>
                <Text style={[s.kpiChipLabel, { color: '#16a34a' }]}>Conforme</Text>
              </View>
              <View style={[s.kpiChip, { backgroundColor: '#fefce8', borderColor: '#fef08a' }]}>
                <Text style={[s.kpiChipNum, { color: '#ca8a04' }]}>{countEstado('verificar')}</Text>
                <Text style={[s.kpiChipLabel, { color: '#ca8a04' }]}>A Verificar</Text>
              </View>
              <View style={[s.kpiChip, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                <Text style={[s.kpiChipNum, { color: '#dc2626' }]}>{countEstado('nao_conforme')}</Text>
                <Text style={[s.kpiChipLabel, { color: '#dc2626' }]}>Não Conforme</Text>
              </View>
            </View>

            {categorias.map(cat => {
              const itens = CHECKLIST_DEF.filter(d => d.categoria === cat);
              return (
                <View key={cat} style={s.categoriaSecao}>
                  <Text style={s.categoriaTitulo}>{cat}</Text>
                  {itens.map(def => {
                    const estado = getEstado(def.id);
                    const cfg = ESTADO_CFG[estado];
                    const carregando = atualizando === def.id;
                    return (
                      <View key={def.id} style={s.checkItem}>
                        <Text style={s.checkLabel} numberOfLines={2}>{def.label}</Text>
                        <TouchableOpacity
                          style={[s.estadoBadge, { backgroundColor: cfg.bg }]}
                          onPress={() => ciclarEstado(def.id, estado)}
                          disabled={carregando}
                          activeOpacity={0.7}
                        >
                          {carregando ? (
                            <ActivityIndicator size="small" color={cfg.text} style={{ width: 60 }} />
                          ) : (
                            <Text style={[s.estadoBadgeTexto, { color: cfg.text }]}>{cfg.label}</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>
        )
      )}

      {/* Aba Acessos */}
      {abaAtual === 'acessos' && (
        loadingConformidade ? (
          <View style={s.centro}><ActivityIndicator size="large" color="#6366f1" /></View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
            <View style={s.kpiRow}>
              <View style={s.kpiCard}>
                <Text style={s.kpiNum}>{conformidade?.totalUtilizadoresUnicos ?? 0}</Text>
                <Text style={s.kpiLabel}>Utilizadores Únicos (30d)</Text>
              </View>
              <View style={s.kpiCard}>
                <Text style={s.kpiNum}>{conformidade?.totalAcessos30dias ?? 0}</Text>
                <Text style={s.kpiLabel}>Total Acessos (30d)</Text>
              </View>
            </View>
            {(conformidade?.acessosDoentes ?? []).slice(0, 50).map(entry => (
              <View key={entry.id} style={s.entradaCard}>
                <View style={s.entradaLinha}>
                  <Text style={s.entradaAcao} numberOfLines={1}>{entry.acao}</Text>
                  <Text style={s.entradaData}>{fmtData(entry.createdAt)}</Text>
                </View>
                <View style={s.entradaMeta}>
                  {entry.utilizador && (
                    <Text style={s.entradaMetaTexto}>{entry.utilizador.nome}</Text>
                  )}
                  {entry.ip && (
                    <Text style={s.entradaIp}>{entry.ip}</Text>
                  )}
                </View>
              </View>
            ))}
            {(conformidade?.acessosDoentes?.length ?? 0) === 0 && (
              <Text style={s.vazioTexto}>Sem acessos registados.</Text>
            )}
          </ScrollView>
        )
      )}

      {/* Aba Alto Risco */}
      {abaAtual === 'alto_risco' && (
        loadingConformidade ? (
          <View style={s.centro}><ActivityIndicator size="large" color="#6366f1" /></View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
            {(conformidade?.acoesAltoRisco ?? []).length === 0 ? (
              <View style={s.vazioCentro}>
                <Ionicons name="checkmark-circle-outline" size={48} color="#94a3b8" />
                <Text style={s.vazioTexto}>Sem ações de alto risco registadas.</Text>
              </View>
            ) : (
              (conformidade?.acoesAltoRisco ?? []).map(entry => (
                <View key={entry.id} style={s.altoRiscoCard}>
                  <View style={s.entradaLinha}>
                    <Text style={s.entradaAcao} numberOfLines={1}>{entry.acao}</Text>
                    <Text style={s.entradaData}>{fmtData(entry.createdAt)}</Text>
                  </View>
                  <View style={s.entradaMeta}>
                    {entry.utilizador && (
                      <Text style={s.entradaMetaTexto}>{entry.utilizador.nome}</Text>
                    )}
                    {entry.entidadeTipo && (
                      <View style={s.entidadeBadge}>
                        <Text style={s.entidadeBadgeTexto}>{entry.entidadeTipo}</Text>
                      </View>
                    )}
                    {entry.ip && (
                      <Text style={s.entradaIp}>{entry.ip}</Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        )
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

  tabRow: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabAtiva: { borderBottomWidth: 2, borderBottomColor: '#0f172a' },
  tabLabel: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },
  tabLabelAtiva: { color: '#0f172a', fontWeight: '700' },

  kpiChipsRow: { flexDirection: 'row', gap: 10 },
  kpiChip: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    borderRadius: 12, borderWidth: 1,
  },
  kpiChipNum: { fontSize: 24, fontWeight: '800' },
  kpiChipLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },

  categoriaSecao: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  categoriaTitulo: {
    fontSize: 11, fontWeight: '800', color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
  },
  checkItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', gap: 10,
  },
  checkLabel: { flex: 1, fontSize: 13, color: '#334155', lineHeight: 18 },
  estadoBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, minWidth: 90, alignItems: 'center' },
  estadoBadgeTexto: { fontSize: 11, fontWeight: '700' },

  kpiRow: { flexDirection: 'row', gap: 10 },
  kpiCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center',
  },
  kpiNum: { fontSize: 28, fontWeight: '800', color: '#0f172a' },
  kpiLabel: { fontSize: 12, color: '#64748b', marginTop: 4, textAlign: 'center' },

  entradaCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  altoRiscoCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#e2e8f0',
    borderLeftWidth: 4, borderLeftColor: '#dc2626',
  },
  entradaLinha: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  entradaAcao: { flex: 1, fontSize: 13, fontWeight: '600', color: '#1e293b' },
  entradaData: { fontSize: 11, color: '#94a3b8' },
  entradaMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  entradaMetaTexto: { fontSize: 12, color: '#64748b' },
  entradaIp: { fontSize: 11, color: '#94a3b8' },

  entidadeBadge: { backgroundColor: '#f1f5f9', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  entidadeBadgeTexto: { fontSize: 11, color: '#475569' },

  vazioCentro: { padding: 60, alignItems: 'center', gap: 12 },
  vazioTexto: { color: '#94a3b8', fontSize: 14, textAlign: 'center' },
});
