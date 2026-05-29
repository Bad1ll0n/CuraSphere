import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, Alert, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

interface DoenteIsolado {
  id: string; nome: string; numeroProcesso: string;
  motivoIsolamento: string; dataIsolamento: string;
  cama?: { numero: string; quarto: string };
}

interface Cultura {
  id: string; tipoAmostra: string; agente?: string; resultado: string;
  dataColheita: string; servico?: string;
  doente?: { id: string; nome: string };
  registadoPor?: { id: string; nome: string };
}

interface Surto {
  id: string; agente: string; servico: string; estado: string;
  numCasos: number; dataInicio: string; dataFim?: string;
  medidas?: string[];
}

interface Props { utilizador: Utilizador; onVoltar: () => void }

type Aba = 'isolamentos' | 'culturas' | 'surtos';

const motivoCor: Record<string, string> = {
  MRSA: '#ef4444', VRE: '#f97316', ESBL: '#eab308', 'C.diff': '#8b5cf6',
  KPC: '#dc2626', Pseudomonas: '#3b82f6', Acinetobacter: '#06b6d4',
  COVID: '#ec4899', Influenza: '#64748b', Outros: '#94a3b8',
};

const RESULTADO_COR: Record<string, { bg: string; text: string; label: string }> = {
  pendente:     { bg: '#fef3c7', text: '#d97706', label: 'Pendente' },
  positivo:     { bg: '#fef2f2', text: '#ef4444', label: 'Positivo' },
  negativo:     { bg: '#dcfce7', text: '#16a34a', label: 'Negativo' },
  contaminado:  { bg: '#f1f5f9', text: '#64748b', label: 'Contaminado' },
};

const SURTO_COR: Record<string, { bg: string; text: string; label: string; borda: string }> = {
  activo:      { bg: '#fef2f2', text: '#ef4444', label: 'Activo',      borda: '#ef4444' },
  controlado:  { bg: '#fef3c7', text: '#d97706', label: 'Controlado',  borda: '#f59e0b' },
  encerrado:   { bg: '#f1f5f9', text: '#64748b', label: 'Encerrado',   borda: '#94a3b8' },
};

export default function IACSScreen({ utilizador, onVoltar }: Props) {
  const [aba, setAba] = useState<Aba>('isolamentos');
  const [isolados, setIsolados] = useState<DoenteIsolado[]>([]);
  const [culturas, setCulturas] = useState<Cultura[]>([]);
  const [surtos, setSurtos] = useState<Surto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const podeEditar = ['medico', 'enfermeiro', 'qualidade'].includes(utilizador.role);

  const carregar = async () => {
    try {
      const [r1, r2, r3] = await Promise.all([
        api.get('/doentes/iacs/isolados'),
        api.get('/iacs/culturas'),
        api.get('/iacs/surtos'),
      ]);
      setIsolados(r1.data?.data ?? r1.data ?? []);
      setCulturas(r2.data ?? []);
      setSurtos(r3.data ?? []);
    } catch { /* ignorar */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  const levantarIsolamento = (id: string, nome: string) => {
    const acao = async () => {
      try {
        await api.patch(`/doentes/${id}/isolamento`, { isolado: false });
        await carregar();
      } catch { /* ignorar */ }
    };
    if (Platform.OS === 'web') {
      if ((window as any).confirm(`Levantar isolamento de ${nome}?`)) acao();
    } else {
      Alert.alert('Isolamento', `Levantar isolamento de ${nome}?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Levantar', style: 'destructive', onPress: acao },
      ]);
    }
  };

  const diasDesde = (data: string) => Math.floor((Date.now() - new Date(data).getTime()) / 86400000);

  const fmtData = (d: string) => new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' });

  if (loading) return <View style={s.centro}><ActivityIndicator size="large" color="#8b5cf6" /></View>;

  const ABAS: { key: Aba; label: string; count: number }[] = [
    { key: 'isolamentos', label: 'Isolamentos', count: isolados.length },
    { key: 'culturas',    label: 'Culturas',    count: culturas.length },
    { key: 'surtos',      label: 'Surtos',      count: surtos.length },
  ];

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={onVoltar} style={s.voltarBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitulo}>IACS</Text>
          <Text style={s.headerSub}>Infecções Associadas aos Cuidados de Saúde</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={s.tabBar}>
        {ABAS.map(a => (
          <TouchableOpacity
            key={a.key}
            style={[s.tabItem, aba === a.key && s.tabItemAtivo]}
            onPress={() => setAba(a.key)}
          >
            <Text style={[s.tabTexto, aba === a.key && s.tabTextoAtivo]}>{a.label}</Text>
            {a.count > 0 && (
              <View style={[s.tabBadge, aba === a.key && s.tabBadgeAtivo]}>
                <Text style={[s.tabBadgeTexto, aba === a.key && s.tabBadgeTextoAtivo]}>{a.count}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} />}
        style={{ flex: 1 }}
      >
        {/* Tab Isolamentos */}
        {aba === 'isolamentos' && (
          <>
            {isolados.length === 0 ? (
              <View style={s.vazio}>
                <Ionicons name="shield-checkmark-outline" size={48} color="#22c55e" />
                <Text style={s.vazioTexto}>Sem doentes em isolamento</Text>
              </View>
            ) : isolados.map(d => {
              const cor = motivoCor[d.motivoIsolamento] ?? '#94a3b8';
              const dias = diasDesde(d.dataIsolamento);
              return (
                <View key={d.id} style={[s.cartao, { borderLeftColor: cor }]}>
                  <View style={s.cartaoTopo}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cartaoTitulo}>{d.nome}</Text>
                      <Text style={s.cartaoProc}>Proc. {d.numeroProcesso}</Text>
                    </View>
                    <View style={[s.motivoBadge, { backgroundColor: cor + '22' }]}>
                      <Text style={[s.motivoTexto, { color: cor }]}>{d.motivoIsolamento}</Text>
                    </View>
                  </View>
                  {d.cama && (
                    <View style={s.infoRow}>
                      <Ionicons name="bed-outline" size={14} color="#64748b" />
                      <Text style={s.infoTexto}>Quarto {d.cama.quarto} · Cama {d.cama.numero}</Text>
                    </View>
                  )}
                  <View style={s.infoRow}>
                    <Ionicons name="calendar-outline" size={14} color="#64748b" />
                    <Text style={s.infoTexto}>Desde {fmtData(d.dataIsolamento)} · {dias} dia(s)</Text>
                  </View>
                  {podeEditar && (
                    <TouchableOpacity style={s.btnLevantar} onPress={() => levantarIsolamento(d.id, d.nome)}>
                      <Ionicons name="lock-open-outline" size={15} color="#7c3aed" />
                      <Text style={s.btnLevantarTexto}>Levantar Isolamento</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </>
        )}

        {/* Tab Culturas */}
        {aba === 'culturas' && (
          <>
            {culturas.length === 0 ? (
              <View style={s.vazio}>
                <Ionicons name="flask-outline" size={48} color="#94a3b8" />
                <Text style={s.vazioTexto}>Sem culturas registadas</Text>
              </View>
            ) : culturas.map(c => {
              const res = RESULTADO_COR[c.resultado] ?? { bg: '#f1f5f9', text: '#64748b', label: c.resultado };
              return (
                <View key={c.id} style={[s.cartao, { borderLeftColor: res.text }]}>
                  <View style={s.cartaoTopo}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cartaoTitulo}>{c.doente?.nome ?? '—'}</Text>
                      <Text style={s.cartaoProc}>{c.tipoAmostra.replace(/_/g, ' ')}</Text>
                    </View>
                    <View style={[s.motivoBadge, { backgroundColor: res.bg }]}>
                      <Text style={[s.motivoTexto, { color: res.text }]}>{res.label}</Text>
                    </View>
                  </View>
                  {c.agente && (
                    <View style={s.infoRow}>
                      <Ionicons name="bug-outline" size={14} color="#64748b" />
                      <Text style={s.infoTexto}>{c.agente}</Text>
                    </View>
                  )}
                  <View style={s.infoRow}>
                    <Ionicons name="calendar-outline" size={14} color="#64748b" />
                    <Text style={s.infoTexto}>Colheita: {fmtData(c.dataColheita)}</Text>
                  </View>
                  {c.servico && (
                    <View style={s.infoRow}>
                      <Ionicons name="business-outline" size={14} color="#64748b" />
                      <Text style={s.infoTexto}>{c.servico}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}

        {/* Tab Surtos */}
        {aba === 'surtos' && (
          <>
            {surtos.length === 0 ? (
              <View style={s.vazio}>
                <Ionicons name="shield-outline" size={48} color="#94a3b8" />
                <Text style={s.vazioTexto}>Sem surtos registados</Text>
              </View>
            ) : surtos.map(surto => {
              const cfg = SURTO_COR[surto.estado] ?? { bg: '#f1f5f9', text: '#64748b', label: surto.estado, borda: '#94a3b8' };
              return (
                <View key={surto.id} style={[s.cartao, { borderLeftColor: cfg.borda }]}>
                  <View style={s.cartaoTopo}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cartaoTitulo}>{surto.agente}</Text>
                      <Text style={s.cartaoProc}>{surto.servico}</Text>
                    </View>
                    <View style={[s.motivoBadge, { backgroundColor: cfg.bg }]}>
                      <Text style={[s.motivoTexto, { color: cfg.text }]}>{cfg.label}</Text>
                    </View>
                  </View>
                  <View style={s.infoRow}>
                    <Ionicons name="people-outline" size={14} color="#64748b" />
                    <Text style={s.infoTexto}>{surto.numCasos} caso(s)</Text>
                  </View>
                  <View style={s.infoRow}>
                    <Ionicons name="calendar-outline" size={14} color="#64748b" />
                    <Text style={s.infoTexto}>
                      Início: {fmtData(surto.dataInicio)}
                      {surto.dataFim ? `  ·  Fim: ${fmtData(surto.dataFim)}` : `  ·  ${diasDesde(surto.dataInicio)} dia(s)`}
                    </Text>
                  </View>
                  {(surto.medidas ?? []).length > 0 && (
                    <View style={s.medidasBox}>
                      {(surto.medidas ?? []).slice(0, 3).map((m, i) => (
                        <View key={i} style={s.medidaBadge}>
                          <Text style={s.medidaTexto}>{m}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: '#7c3aed', paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  voltarBtn: { padding: 4 },
  headerTitulo: { fontSize: 20, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 11, color: '#ddd6fe', marginTop: 2 },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 6, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemAtivo: { borderBottomColor: '#7c3aed' },
  tabTexto: { fontSize: 13, fontWeight: '600', color: '#94a3b8' },
  tabTextoAtivo: { color: '#7c3aed' },
  tabBadge: { backgroundColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  tabBadgeAtivo: { backgroundColor: '#ede9fe' },
  tabBadgeTexto: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  tabBadgeTextoAtivo: { color: '#7c3aed' },
  vazio: { padding: 60, alignItems: 'center', gap: 12 },
  vazioTexto: { color: '#94a3b8', fontSize: 15 },
  cartao: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, borderRadius: 14, padding: 14, borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
  cartaoTopo: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  cartaoTitulo: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  cartaoProc: { fontSize: 12, color: '#94a3b8', marginTop: 2, textTransform: 'capitalize' },
  motivoBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  motivoTexto: { fontSize: 12, fontWeight: '700' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  infoTexto: { fontSize: 13, color: '#64748b' },
  btnLevantar: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ede9fe', paddingVertical: 8, borderRadius: 10, justifyContent: 'center', marginTop: 10 },
  btnLevantarTexto: { color: '#7c3aed', fontWeight: '700', fontSize: 14 },
  medidasBox: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  medidaBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  medidaTexto: { fontSize: 11, color: '#475569', fontWeight: '500' },
});
