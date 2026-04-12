import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { logout, Utilizador } from '../lib/auth';
import HorariosScreen from './HorariosScreen';
import AtribuicoesScreen from './AtribuicoesScreen';
import CamasScreen from './CamasScreen';
import TrocasScreen from './TrocasScreen';
import UtilizadoresScreen from './UtilizadoresScreen';

type SubTela = null | 'horarios' | 'atribuicoes' | 'camas' | 'trocas' | 'utilizadores';

const roleLabel: Record<string, string> = {
  enfermeiro: 'Enfermeiro', auxiliar: 'Auxiliar', medico: 'Médico',
  chefe_turno: 'Chefe de Turno', chefe_enfermeiros: 'Chefe de Enfermeiros',
  chefe_medicos: 'Chefe de Médicos', administrativo: 'Administrativo',
};

interface Props { utilizador: Utilizador; onLogout: () => void }

export default function MaisScreen({ utilizador, onLogout }: Props) {
  const [subTela, setSubTela] = useState<SubTela>(null);

  const voltar = () => setSubTela(null);

  if (subTela === 'horarios')    return <HorariosScreen utilizador={utilizador} onVoltar={voltar} />;
  if (subTela === 'atribuicoes') return <AtribuicoesScreen utilizador={utilizador} onVoltar={voltar} />;
  if (subTela === 'camas')       return <CamasScreen utilizador={utilizador} onVoltar={voltar} />;
  if (subTela === 'trocas')      return <TrocasScreen utilizador={utilizador} onVoltar={voltar} />;
  if (subTela === 'utilizadores') return <UtilizadoresScreen utilizador={utilizador} onVoltar={voltar} />;

  const confirmarLogout = () => {
    Alert.alert('Sair', 'Tem a certeza que quer sair?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: async () => { await logout(); onLogout(); } },
    ]);
  };

  const isAdmin = utilizador.role === 'administrativo';
  const isChefe = ['chefe_enfermeiros', 'chefe_medicos', 'chefe_turno'].includes(utilizador.role);
  const podeVerUtilizadores = isAdmin;
  const podeVerAtribuicoes = ['chefe_enfermeiros', 'chefe_medicos', 'chefe_turno', 'enfermeiro', 'medico', 'auxiliar'].includes(utilizador.role);
  const podeGerir = isAdmin || isChefe;

  const itens: { key: SubTela; emoji: string; titulo: string; sub: string; visivel: boolean }[] = [
    { key: 'horarios',     emoji: '📅', titulo: 'Horários',      sub: 'Escala mensal de turnos',       visivel: true },
    { key: 'atribuicoes',  emoji: '📋', titulo: 'Atribuições',   sub: 'Doentes por profissional',      visivel: podeVerAtribuicoes },
    { key: 'camas',        emoji: '🛏️', titulo: 'Camas',          sub: 'Mapa de camas e quartos',       visivel: true },
    { key: 'trocas',       emoji: '🔁', titulo: 'Trocas de Turno', sub: 'Pedidos de cobertura',         visivel: true },
    { key: 'utilizadores', emoji: '👥', titulo: 'Utilizadores',  sub: 'Gestão de profissionais',       visivel: podeVerUtilizadores },
  ];

  const itensVisiveis = itens.filter((i) => i.visivel);

  return (
    <ScrollView style={s.container}>
      {/* Perfil */}
      <View style={s.perfilCard}>
        <View style={s.avatar}>
          <Text style={s.avatarTexto}>{utilizador.nome.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={s.perfilInfo}>
          <Text style={s.perfilNome}>{utilizador.nome}</Text>
          <Text style={s.perfilRole}>{roleLabel[utilizador.role] ?? utilizador.role}</Text>
          <Text style={s.perfilNum}>Nº {utilizador.numeroFuncionario}</Text>
        </View>
      </View>

      {/* Menu */}
      <View style={s.secao}>
        <Text style={s.secaoTitulo}>Funcionalidades</Text>
        <View style={s.menuCard}>
          {itensVisiveis.map((item, i) => (
            <TouchableOpacity
              key={item.key}
              style={[s.menuItem, i < itensVisiveis.length - 1 && s.menuItemBorder]}
              onPress={() => setSubTela(item.key)}
              activeOpacity={0.7}
            >
              <View style={s.menuEmoji}>
                <Text style={s.menuEmojiTexto}>{item.emoji}</Text>
              </View>
              <View style={s.menuTextos}>
                <Text style={s.menuTitulo}>{item.titulo}</Text>
                <Text style={s.menuSub}>{item.sub}</Text>
              </View>
              <Text style={s.menuArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Logout */}
      <View style={s.secao}>
        <TouchableOpacity style={s.sairBotao} onPress={confirmarLogout}>
          <Text style={s.sairTexto}>Terminar Sessão</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  perfilCard: { backgroundColor: '#1e293b', padding: 24, paddingTop: 32, flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
  avatarTexto: { fontSize: 24, fontWeight: '700', color: '#fff' },
  perfilInfo: { flex: 1 },
  perfilNome: { fontSize: 18, fontWeight: '700', color: '#fff' },
  perfilRole: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  perfilNum: { fontSize: 12, color: '#64748b', marginTop: 2 },
  secao: { padding: 16, paddingBottom: 0 },
  secaoTitulo: { fontSize: 12, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  menuCard: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  menuEmoji: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  menuEmojiTexto: { fontSize: 20 },
  menuTextos: { flex: 1 },
  menuTitulo: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  menuSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  menuArrow: { fontSize: 20, color: '#cbd5e1', fontWeight: '300' },
  sairBotao: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 6 },
  sairTexto: { color: '#dc2626', fontWeight: '700', fontSize: 16 },
});
