import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, Alert, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

interface StockItem {
  id: string;
  nome: string;
  categoria: string;
  quantidade: number;
  unidade: string;
  minimo: number;
}

interface PedidoFarmacia {
  id: string;
  medicamentoNome: string;
  quantidade: number;
  estado: string;
  prioridade: string;
  doente?: { nome: string };
  criadoEm: string;
}

interface Props { utilizador: Utilizador; onVoltar: () => void }

const estadoCor: Record<string, string> = {
  pendente: '#f59e0b', aprovado: '#3b82f6', dispensado: '#22c55e', recusado: '#ef4444',
};
const estadoLabel: Record<string, string> = {
  pendente: 'Pendente', aprovado: 'Aprovado', dispensado: 'Dispensado', recusado: 'Recusado',
};
const prioridadeCor: Record<string, string> = {
  urgente: '#ef4444', alta: '#f97316', normal: '#3b82f6', baixa: '#94a3b8',
};

export default function FarmaciaScreen({ utilizador, onVoltar }: Props) {
  const [tab, setTab] = useState<'pedidos' | 'stock'>('pedidos');
  const [stock, setStock] = useState<StockItem[]>([]);
  const [pedidos, setPedidos] = useState<PedidoFarmacia[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const carregar = async () => {
    try {
      const [stockRes, pedidosRes] = await Promise.all([
        api.get('/farmacia/stock'),
        api.get('/farmacia/pedidos'),
      ]);
      setStock(stockRes.data?.data ?? stockRes.data ?? []);
      setPedidos(pedidosRes.data?.data ?? pedidosRes.data ?? []);
    } catch { /* ignorar */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  const confirmarDispensa = (id: string) => {
    const acao = async () => {
      try {
        await api.patch(`/farmacia/pedidos/${id}/estado`, { estado: 'dispensado' });
        await carregar();
      } catch { /* ignorar */ }
    };
    if (Platform.OS === 'web') {
      if ((window as any).confirm('Confirmar dispensa do medicamento?')) acao();
    } else {
      Alert.alert('Dispensar', 'Confirmar dispensa do medicamento?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: acao },
      ]);
    }
  };

  if (loading) return <View style={s.centro}><ActivityIndicator size="large" color="#2563eb" /></View>;

  const stockCritico = stock.filter(i => i.quantidade <= i.minimo);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={onVoltar} style={s.voltarBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitulo}>Farmácia</Text>
          {stockCritico.length > 0 && (
            <Text style={s.headerSub}>{stockCritico.length} item(s) abaixo do mínimo</Text>
          )}
        </View>
      </View>

      <View style={s.tabs}>
        {(['pedidos', 'stock'] as const).map(t => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabAtivo]} onPress={() => setTab(t)}>
            <Text style={[s.tabTexto, tab === t && s.tabTextoAtivo]}>
              {t === 'pedidos' ? 'Pedidos' : 'Stock'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} />}>
        {tab === 'pedidos' && (
          pedidos.length === 0
            ? <View style={s.vazio}><Text style={s.vazioTexto}>Sem pedidos</Text></View>
            : pedidos.map(p => (
              <View key={p.id} style={s.cartao}>
                <View style={s.cartaoTopo}>
                  <Text style={s.cartaoTitulo} numberOfLines={1}>{p.medicamentoNome}</Text>
                  <View style={[s.badge, { backgroundColor: estadoCor[p.estado] + '22' }]}>
                    <Text style={[s.badgeTexto, { color: estadoCor[p.estado] }]}>{estadoLabel[p.estado] ?? p.estado}</Text>
                  </View>
                </View>
                {p.doente && <Text style={s.cartaoSub}>Doente: {p.doente.nome}</Text>}
                <Text style={s.cartaoSub}>Quantidade: {p.quantidade}</Text>
                {p.prioridade && (
                  <View style={[s.priorBadge, { backgroundColor: prioridadeCor[p.prioridade] + '22' }]}>
                    <Text style={[s.priorTexto, { color: prioridadeCor[p.prioridade] }]}>{p.prioridade}</Text>
                  </View>
                )}
                {p.estado === 'aprovado' && (
                  <TouchableOpacity style={s.btnDispensar} onPress={() => confirmarDispensa(p.id)}>
                    <Ionicons name="checkmark-circle-outline" size={16} color="#16a34a" />
                    <Text style={s.btnDispensarTexto}>Dispensar</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
        )}

        {tab === 'stock' && (
          stock.length === 0
            ? <View style={s.vazio}><Text style={s.vazioTexto}>Sem itens em stock</Text></View>
            : stock.map(item => (
              <View key={item.id} style={[s.cartao, item.quantidade <= item.minimo && s.cartaoAlerta]}>
                <View style={s.cartaoTopo}>
                  <Text style={s.cartaoTitulo} numberOfLines={1}>{item.nome}</Text>
                  {item.quantidade <= item.minimo && (
                    <Ionicons name="warning-outline" size={18} color="#ef4444" />
                  )}
                </View>
                <Text style={s.cartaoSub}>Categoria: {item.categoria}</Text>
                <View style={s.stockRow}>
                  <Text style={[s.stockQtd, item.quantidade <= item.minimo && { color: '#ef4444' }]}>
                    {item.quantidade} {item.unidade}
                  </Text>
                  <Text style={s.stockMin}>mín. {item.minimo}</Text>
                </View>
              </View>
            ))
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: '#2563eb', paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  voltarBtn: { padding: 4 },
  headerTitulo: { fontSize: 20, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 12, color: '#bfdbfe', marginTop: 2 },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9', alignItems: 'center' },
  tabAtivo: { backgroundColor: '#2563eb' },
  tabTexto: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  tabTextoAtivo: { color: '#fff' },
  vazio: { padding: 40, alignItems: 'center' },
  vazioTexto: { color: '#94a3b8', fontSize: 15 },
  cartao: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, borderRadius: 14, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
  cartaoAlerta: { borderLeftWidth: 4, borderLeftColor: '#ef4444' },
  cartaoTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cartaoTitulo: { fontSize: 15, fontWeight: '700', color: '#1e293b', flex: 1, marginRight: 8 },
  cartaoSub: { fontSize: 13, color: '#64748b', marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeTexto: { fontSize: 12, fontWeight: '600' },
  priorBadge: { marginTop: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  priorTexto: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  stockQtd: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  stockMin: { fontSize: 12, color: '#94a3b8' },
  btnDispensar: { marginTop: 10, backgroundColor: '#dcfce7', paddingVertical: 8, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  btnDispensarTexto: { color: '#16a34a', fontWeight: '700', fontSize: 14 },
});
