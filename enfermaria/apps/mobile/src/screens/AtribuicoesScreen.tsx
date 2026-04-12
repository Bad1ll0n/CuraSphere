import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

interface Props { utilizador: Utilizador; onVoltar: () => void }

const tipoLabel: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };
const tipoCor: Record<string, string> = { manha: '#f59e0b', tarde: '#f97316', noite: '#6366f1' };
const estadoCor: Record<string, string> = {
  estavel: '#22c55e', grave: '#f97316', critico: '#ef4444', alta_prevista: '#3b82f6',
};
const estadoLabel: Record<string, string> = {
  estavel: 'Estável', grave: 'Grave', critico: 'Crítico', alta_prevista: 'Alta Prevista',
};

const grupoRoles: Record<string, string[]> = {
  medico:            ['medico', 'chefe_medicos'],
  chefe_medicos:     ['medico', 'chefe_medicos'],
  enfermeiro:        ['enfermeiro', 'chefe_turno', 'chefe_enfermeiros'],
  chefe_turno:       ['enfermeiro', 'chefe_turno', 'chefe_enfermeiros'],
  chefe_enfermeiros: ['enfermeiro', 'chefe_turno', 'chefe_enfermeiros'],
  auxiliar:          ['auxiliar'],
};

export default function AtribuicoesScreen({ utilizador, onVoltar }: Props) {
  const [turnos, setTurnos] = useState<any[]>([]);
  const [doentes, setDoentes] = useState<any[]>([]);
  const [turnoSelecionado, setTurnoSelecionado] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Modal: escolher profissional para doente
  const [modalDoente, setModalDoente] = useState<any>(null);

  const meuGrupo = grupoRoles[utilizador.role] ?? ['enfermeiro', 'chefe_turno', 'chefe_enfermeiros'];

  const turnoDoGrupo = (lista: any[], tipo: string) =>
    lista.find((t) => t.tipo === tipo && t.profissionais.some((p: any) => meuGrupo.includes(p.utilizador.role)))
    ?? lista.find((t) => t.tipo === tipo);

  const chefeDeTurno = (turno: any): any => {
    const doGrupo = turno.profissionais.filter((p: any) => meuGrupo.includes(p.utilizador.role));
    const chefe = doGrupo.find((p: any) => ['chefe_enfermeiros', 'chefe_medicos'].includes(p.utilizador.role));
    if (chefe) return chefe.utilizador;
    return doGrupo.sort((a: any, b: any) => (a.utilizador.ordemExperiencia ?? 999) - (b.utilizador.ordemExperiencia ?? 999))[0]?.utilizador ?? null;
  };

  const carregar = async () => {
    try {
      const [turnosR, doentesR] = await Promise.all([
        api.get('/atribuicoes/turnos'),
        api.get('/doentes?todos=true'),
      ]);
      const lista: any[] = turnosR.data;
      setTurnos(lista);
      setDoentes(doentesR.data);

      if (lista.length > 0) {
        const agora = new Date();
        const min = agora.getHours() * 60 + agora.getMinutes();
        const tipoAtual = min >= 8 * 60 && min < 16 * 60 + 30 ? 'manha'
          : min >= 16 * 60 && min < 23 * 60 + 30 ? 'tarde' : 'noite';
        const inicial = turnoDoGrupo(lista, tipoAtual) ?? lista[0];
        setTurnoSelecionado((prev: any) => prev ? lista.find((t) => t.id === prev.id) ?? inicial : inicial);
      }
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  const souChefe = turnoSelecionado ? chefeDeTurno(turnoSelecionado)?.id === utilizador.id : false;

  const atribuicaoDe = (doenteId: string) =>
    turnoSelecionado?.atribuicoes.find((a: any) => a.doenteId === doenteId && meuGrupo.includes(a.utilizador.role));

  const atribuir = async (doenteId: string, utilizadorId: string) => {
    if (!turnoSelecionado) return;
    setSalvando(true);
    try {
      const atual = atribuicaoDe(doenteId);
      if (atual && atual.utilizadorId !== utilizadorId) {
        await api.delete(`/atribuicoes/turno/${turnoSelecionado.id}`, { data: { doenteId, utilizadorId: atual.utilizadorId } });
      }
      if (!atual || atual.utilizadorId !== utilizadorId) {
        await api.post(`/atribuicoes/turno/${turnoSelecionado.id}`, { doenteId, utilizadorId });
      } else {
        await api.delete(`/atribuicoes/turno/${turnoSelecionado.id}`, { data: { doenteId, utilizadorId } });
      }
      setModalDoente(null);
      await carregar();
    } finally { setSalvando(false); }
  };

  const profissionaisDoTurno = turnoSelecionado?.profissionais
    .filter((p: any) => meuGrupo.includes(p.utilizador.role))
    .sort((a: any, b: any) => (a.utilizador.ordemExperiencia ?? 999) - (b.utilizador.ordemExperiencia ?? 999)) ?? [];

  const turnosDisponiveis = (['manha', 'tarde', 'noite'] as const)
    .map((tipo) => turnoDoGrupo(turnos, tipo))
    .filter(Boolean)
    .filter((t, i, arr) => arr.findIndex((x) => x?.id === t?.id) === i);

  if (loading) return <View style={s.centro}><ActivityIndicator size="large" color="#2563eb" /></View>;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onVoltar} style={s.voltarBotao}>
          <Text style={s.voltarTexto}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={s.titulo}>Atribuições de Turno</Text>
      </View>

      {turnos.length === 0 ? (
        <View style={s.centro}>
          <Text style={s.semTurnoTexto}>Sem turnos hoje</Text>
        </View>
      ) : (
        <>
          {/* Selector de turno */}
          <View style={s.turnoSelector}>
            {turnosDisponiveis.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[s.turnoTab, turnoSelecionado?.id === t.id && { borderBottomColor: tipoCor[t.tipo], borderBottomWidth: 2 }]}
                onPress={() => setTurnoSelecionado(t)}
              >
                <Text style={[s.turnoTabTexto, turnoSelecionado?.id === t.id && { color: tipoCor[t.tipo], fontWeight: '700' }]}>
                  {tipoLabel[t.tipo]}
                </Text>
                <Text style={s.turnoTabSub}>{t.atribuicoes.length} atrib.</Text>
              </TouchableOpacity>
            ))}
          </View>

          {turnoSelecionado && (
            <>
              {/* Info turno */}
              <View style={[s.turnoInfo, { borderLeftColor: tipoCor[turnoSelecionado.tipo] }]}>
                <Text style={[s.turnoInfoTipo, { color: tipoCor[turnoSelecionado.tipo] }]}>
                  Turno da {tipoLabel[turnoSelecionado.tipo]}
                  {souChefe ? ' · Tu és o chefe' : ''}
                </Text>
                <Text style={s.turnoInfoSub}>
                  {doentes.length} doentes · {profissionaisDoTurno.length} profissionais
                </Text>
              </View>

              {!souChefe && (
                <View style={s.avisoChefe}>
                  <Text style={s.avisoTexto}>
                    Apenas o chefe ({chefeDeTurno(turnoSelecionado)?.nome ?? '—'}) pode fazer atribuições
                  </Text>
                </View>
              )}

              <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} />}
              >
                {doentes.map((d) => {
                  const atrib = atribuicaoDe(d.id);
                  return (
                    <TouchableOpacity
                      key={d.id}
                      style={s.doenteCard}
                      onPress={() => souChefe && setModalDoente(d)}
                      activeOpacity={souChefe ? 0.7 : 1}
                    >
                      <View style={s.doenteCardEsq}>
                        <View style={[s.estadoBar, { backgroundColor: estadoCor[d.estado] }]} />
                        <View style={s.doenteInfo}>
                          <Text style={s.doenteNome}>{d.nome}</Text>
                          <Text style={s.doenteSub}>Cama {d.cama.quarto}/{d.cama.numero}</Text>
                          <Text style={s.doenteDiag} numberOfLines={1}>{d.diagnosticoPrincipal}</Text>
                        </View>
                      </View>
                      <View style={s.atribInfo}>
                        {atrib ? (
                          <>
                            <Text style={s.atribNome}>{atrib.utilizador.nome.split(' ')[0]}</Text>
                            {souChefe && <Text style={s.editarHint}>Alterar ›</Text>}
                          </>
                        ) : (
                          <Text style={[s.atribNome, { color: '#94a3b8' }]}>{souChefe ? 'Atribuir ›' : 'Sem atribuição'}</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
                <View style={{ height: 32 }} />
              </ScrollView>
            </>
          )}
        </>
      )}

      {/* Modal: Atribuir profissional */}
      <Modal visible={!!modalDoente} transparent animationType="slide" onRequestClose={() => setModalDoente(null)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setModalDoente(null)}>
          <View onStartShouldSetResponder={() => true} style={s.sheet}>
            <Text style={s.sheetTitulo}>Atribuir · {modalDoente?.nome}</Text>
            <Text style={s.sheetSub}>Selecione o profissional responsável</Text>
            {profissionaisDoTurno.map((p: any) => {
              const atual = atribuicaoDe(modalDoente?.id);
              const selecionado = atual?.utilizadorId === p.utilizador.id;
              return (
                <TouchableOpacity
                  key={p.utilizador.id}
                  style={[s.profRow, selecionado && s.profRowAtivo]}
                  onPress={() => !salvando && atribuir(modalDoente.id, p.utilizador.id)}
                >
                  <View style={s.profInfo}>
                    <Text style={s.profNome}>{p.utilizador.nome}</Text>
                    <Text style={s.profAtribs}>
                      {turnoSelecionado?.atribuicoes.filter((a: any) => a.utilizadorId === p.utilizador.id).length ?? 0} doentes
                    </Text>
                  </View>
                  {selecionado && <Text style={s.check}>✓</Text>}
                </TouchableOpacity>
              );
            })}
            {salvando && <ActivityIndicator color="#2563eb" style={{ marginTop: 10 }} />}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  header: { backgroundColor: '#1e293b', padding: 20, paddingTop: 16 },
  voltarBotao: { marginBottom: 10 },
  voltarTexto: { color: '#94a3b8', fontSize: 14 },
  titulo: { fontSize: 20, fontWeight: '700', color: '#fff' },
  semTurnoTexto: { fontSize: 16, color: '#94a3b8', textAlign: 'center' },
  turnoSelector: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  turnoTab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  turnoTabTexto: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },
  turnoTabSub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  turnoInfo: { backgroundColor: '#fff', padding: 14, marginHorizontal: 16, marginTop: 12, borderRadius: 12, borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 1 },
  turnoInfoTipo: { fontSize: 15, fontWeight: '700' },
  turnoInfoSub: { fontSize: 13, color: '#64748b', marginTop: 2 },
  avisoChefe: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 10, padding: 10, marginHorizontal: 16, marginTop: 8 },
  avisoTexto: { fontSize: 13, color: '#92400e' },
  doenteCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', marginHorizontal: 16, marginTop: 8, borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 1 },
  doenteCardEsq: { flexDirection: 'row', flex: 1 },
  estadoBar: { width: 4 },
  doenteInfo: { flex: 1, padding: 12 },
  doenteNome: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  doenteSub: { fontSize: 12, color: '#94a3b8', marginTop: 1 },
  doenteDiag: { fontSize: 12, color: '#64748b', marginTop: 2 },
  atribInfo: { paddingRight: 14, alignItems: 'flex-end' },
  atribNome: { fontSize: 13, fontWeight: '600', color: '#2563eb' },
  editarHint: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  sheetTitulo: { fontSize: 17, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  sheetSub: { fontSize: 13, color: '#64748b', marginBottom: 16 },
  profRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  profRowAtivo: { backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 8 },
  profInfo: { flex: 1 },
  profNome: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  profAtribs: { fontSize: 12, color: '#94a3b8', marginTop: 1 },
  check: { color: '#2563eb', fontWeight: '700', fontSize: 16 },
});
