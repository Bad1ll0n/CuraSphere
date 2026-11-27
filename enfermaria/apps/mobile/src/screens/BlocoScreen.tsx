import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

import { registarFalhaSilenciosa } from '../lib/erros';
import { estilosTematicos, LETRA, useEsquema } from '../lib/tema';
interface Props { utilizador: Utilizador; onVoltar: () => void }

interface Cirurgia {
  id: string; tipo: string; estado: string; dataHora: string; duracao?: number;
  observacoes?: string;
  doente: { id: string; nome: string };
  cirurgiaoPrincipal?: { id: string; nome: string };
  equipa?: { id: string; nome: string; role: string }[];
}

const ESTADO_COR: Record<string, string>   = { agendada: '#2563eb', em_curso: '#d97706', concluida: '#16a34a', cancelada: '#64748b', suspensa: '#ef4444' };
const ESTADO_BG: Record<string, string>    = { agendada: '#eff6ff', em_curso: '#fef3c7', concluida: '#dcfce7', cancelada: '#f1f5f9', suspensa: '#fef2f2' };
const ESTADO_LABEL: Record<string, string> = { agendada: 'Agendada', em_curso: 'Em Curso', concluida: 'Concluída', cancelada: 'Cancelada', suspensa: 'Suspensa' };

export default function BlocoScreen({ utilizador, onVoltar }: Props) {
  useEsquema(); // UX-24: volta a desenhar quando o telemóvel muda de claro para escuro
  const [cirurgias, setCirurgias] = useState<Cirurgia[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtro, setFiltro] = useState('todos');
  const [expanded, setExpanded] = useState<string | null>(null);

  const carregar = async () => {
    try {
      const { data } = await api.get('/bloco');
      setCirurgias(data ?? []);
    } catch (e) { registarFalhaSilenciosa('BlocoScreen', e); } finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  const filtros = ['todos', 'agendada', 'em_curso', 'concluida'];
  const lista = filtro === 'todos' ? cirurgias : cirurgias.filter(c => c.estado === filtro);

  const fmt = (d: string) => new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  const fmtData = (d: string) => new Date(d).toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: 'short' });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity accessibilityRole="button" onPress={onVoltar} style={s.voltarBotao}>
          <Text style={s.voltarTexto}>‹  Voltar</Text>
        </TouchableOpacity>
        <Text style={s.titulo}>Bloco Operatório</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtrosScroll}>
        <View style={s.filtrosRow}>
          {filtros.map(f => (
            <TouchableOpacity accessibilityRole="button" key={f} style={[s.filtroChip, filtro === f && s.filtroChipAtivo]} onPress={() => setFiltro(f)}>
              <Text style={[s.filtroTexto, filtro === f && s.filtroTextoAtivo]}>
                {f === 'todos' ? 'Todos' : ESTADO_LABEL[f]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {loading ? (
        <View style={s.centro}><ActivityIndicator size="large" color="#7c3aed" /></View>
      ) : (
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} />} style={{ flex: 1 }}>
          <View style={s.lista}>
            {lista.length === 0 ? (
              <View style={s.vazio}><Text style={s.vazioTexto}>Sem cirurgias agendadas</Text></View>
            ) : lista.map(c => (
              <TouchableOpacity accessibilityRole="button" key={c.id} style={s.card} activeOpacity={0.8} onPress={() => setExpanded(expanded === c.id ? null : c.id)}>
                <View style={s.cardTopo}>
                  <View style={[s.estadoDot, { backgroundColor: ESTADO_COR[c.estado] ?? '#94a3b8' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTipo}>{c.tipo}</Text>
                    <Text style={s.cardDoente}>{c.doente.nome}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <View style={[s.estadoBadge, { backgroundColor: ESTADO_BG[c.estado] }]}>
                      <Text style={[s.estadoTexto, { color: ESTADO_COR[c.estado] }]}>{ESTADO_LABEL[c.estado]}</Text>
                    </View>
                    <Text style={s.cardHora}>{fmt(c.dataHora)}</Text>
                  </View>
                </View>

                {expanded === c.id && (
                  <View style={s.expandido}>
                    {c.duracao ? <Text style={s.detalhe}>Duração estimada: {c.duracao} min</Text> : null}
                    {c.cirurgiaoPrincipal ? <Text style={s.detalhe}>Cirurgião: {c.cirurgiaoPrincipal.nome}</Text> : null}
                    {c.equipa && c.equipa.length > 0 && (
                      <View style={s.equipaBox}>
                        <Text style={s.equipaTitulo}>Equipa:</Text>
                        {c.equipa.map(m => (
                          <Text key={m.id} style={s.equipaMembro}>{m.nome} ({m.role})</Text>
                        ))}
                      </View>
                    )}
                    {c.observacoes ? <Text style={s.detalhe}>Obs: {c.observacoes}</Text> : null}
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = estilosTematicos((c) => ({
  container: { flex: 1, backgroundColor: c.fundo },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: '#1e293b', padding: 20, paddingTop: 16 },
  voltarBotao: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, marginBottom: 10 },
  voltarTexto: { color: '#fff', fontSize: LETRA.corpo, fontWeight: '600' },
  titulo: { fontSize: 20, fontWeight: '700', color: '#fff' },
  filtrosScroll: { backgroundColor: c.superficie, borderBottomWidth: 1, borderBottomColor: c.borda },
  filtrosRow: { flexDirection: 'row', gap: 8, padding: 12 },
  filtroChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: c.fundo },
  filtroChipAtivo: { backgroundColor: '#7c3aed' },
  filtroTexto: { fontSize: LETRA.corpo, fontWeight: '600', color: c.textoTenue },
  filtroTextoAtivo: { color: '#fff' },
  lista: { padding: 16, gap: 12 },
  card: { backgroundColor: c.superficie, borderRadius: 14, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 1 }, shadowRadius: 6, elevation: 1 },
  cardTopo: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  estadoDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  cardTipo: { fontSize: 14, fontWeight: '700', color: c.texto },
  cardDoente: { fontSize: 13, color: c.textoSecundario, marginTop: 2 },
  estadoBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, marginBottom: 4 },
  estadoTexto: { fontSize: LETRA.corpo, fontWeight: '700' },
  cardHora: { fontSize: 13, color: c.textoTenue },
  expandido: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.borda, gap: 4 },
  detalhe: { fontSize: 13, color: c.textoSecundario },
  equipaBox: { marginTop: 4 },
  equipaTitulo: { fontSize: LETRA.corpo, fontWeight: '700', color: c.textoTenue, marginBottom: 2 },
  equipaMembro: { fontSize: 13, color: c.textoSecundario },
  vazio: { backgroundColor: c.superficie, borderRadius: 14, padding: 32, alignItems: 'center' },
  vazioTexto: { color: c.textoTenue, fontSize: LETRA.corpo },
}));
