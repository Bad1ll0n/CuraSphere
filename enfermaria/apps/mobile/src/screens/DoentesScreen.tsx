import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';
import DoenteDetalheScreen from './DoenteDetalheScreen';

interface Doente {
  id: string;
  nome: string;
  numeroProcesso: string;
  estado: string;
  diagnosticoPrincipal: string;
  cama: { numero: string; quarto: string };
  atribuicoes: { enfermeiro: { id: string; nome: string } }[];
}

const estadoCor: Record<string, string> = {
  estavel: '#22c55e', grave: '#f97316', critico: '#ef4444', alta_prevista: '#3b82f6',
};
const estadoLabel: Record<string, string> = {
  estavel: 'Estável', grave: 'Grave', critico: 'Crítico', alta_prevista: 'Alta Prevista',
};

interface Props { utilizador: Utilizador }

export default function DoentesScreen({ utilizador }: Props) {
  const [doentes, setDoentes] = useState<Doente[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pesquisa, setPesquisa] = useState('');
  const [doenteAberto, setDoenteAberto] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<'todos' | 'meus'>('meus');

  const carregar = async () => {
    try {
      const { data } = await api.get('/doentes');
      setDoentes(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  if (doenteAberto) return (
    <DoenteDetalheScreen
      doenteId={doenteAberto}
      utilizador={utilizador}
      onVoltar={() => setDoenteAberto(null)}
    />
  );

  const meus = doentes.filter((d) => d.atribuicoes.some((a) => a.enfermeiro.id === utilizador.id));
  const lista = filtro === 'meus' ? meus : doentes;
  const filtrados = lista.filter((d) =>
    d.nome.toLowerCase().includes(pesquisa.toLowerCase()) ||
    d.cama.numero.includes(pesquisa) ||
    d.numeroProcesso.includes(pesquisa),
  ).sort((a, b) => {
    const ordem = { critico: 0, grave: 1, estavel: 2, alta_prevista: 3 };
    return (ordem[a.estado as keyof typeof ordem] ?? 4) - (ordem[b.estado as keyof typeof ordem] ?? 4);
  });

  return (
    <View style={s.container}>
      <View style={s.topo}>
        <TextInput
          style={s.pesquisa}
          placeholder="Pesquisar doente, cama ou processo..."
          value={pesquisa}
          onChangeText={setPesquisa}
        />
        <View style={s.filtros}>
          <TouchableOpacity style={[s.filtro, filtro === 'meus' && s.filtroAtivo]} onPress={() => setFiltro('meus')}>
            <Text style={[s.filtroTexto, filtro === 'meus' && s.filtroTextoAtivo]}>Os meus ({meus.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.filtro, filtro === 'todos' && s.filtroAtivo]} onPress={() => setFiltro('todos')}>
            <Text style={[s.filtroTexto, filtro === 'todos' && s.filtroTextoAtivo]}>Todos ({doentes.length})</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={s.centro}><ActivityIndicator size="large" color="#2563eb" /></View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} />}
        >
          {filtrados.length === 0 ? (
            <View style={s.vazio}><Text style={s.vazioTexto}>Sem doentes encontrados</Text></View>
          ) : filtrados.map((d) => (
            <TouchableOpacity key={d.id} style={s.cartao} onPress={() => setDoenteAberto(d.id)} activeOpacity={0.8}>
              <View style={[s.estadoBar, { backgroundColor: estadoCor[d.estado] }]} />
              <View style={s.cartaoConteudo}>
                <View style={s.cartaoCabecalho}>
                  <Text style={s.doenteNome}>{d.nome}</Text>
                  <View style={[s.estadoBadge, { backgroundColor: estadoCor[d.estado] + '20' }]}>
                    <Text style={[s.estadoTexto, { color: estadoCor[d.estado] }]}>{estadoLabel[d.estado]}</Text>
                  </View>
                </View>
                <Text style={s.diagnostico} numberOfLines={1}>{d.diagnosticoPrincipal}</Text>
                <Text style={s.cama}>Cama {d.cama.quarto}/{d.cama.numero} · Proc. {d.numeroProcesso}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topo: { padding: 16, paddingBottom: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  pesquisa: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, backgroundColor: '#f8fafc', marginBottom: 10 },
  filtros: { flexDirection: 'row', gap: 8 },
  filtro: { flex: 1, paddingVertical: 8, borderRadius: 20, backgroundColor: '#e2e8f0', alignItems: 'center' },
  filtroAtivo: { backgroundColor: '#2563eb' },
  filtroTexto: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  filtroTextoAtivo: { color: '#fff' },
  vazio: { padding: 40, alignItems: 'center' },
  vazioTexto: { color: '#94a3b8', fontSize: 15 },
  cartao: { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 16, marginTop: 10, borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
  estadoBar: { width: 5 },
  cartaoConteudo: { flex: 1, padding: 14 },
  cartaoCabecalho: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  doenteNome: { fontSize: 16, fontWeight: '700', color: '#1e293b', flex: 1, marginRight: 8 },
  estadoBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  estadoTexto: { fontSize: 11, fontWeight: '600' },
  diagnostico: { fontSize: 13, color: '#64748b', marginBottom: 4 },
  cama: { fontSize: 12, color: '#94a3b8' },
});
