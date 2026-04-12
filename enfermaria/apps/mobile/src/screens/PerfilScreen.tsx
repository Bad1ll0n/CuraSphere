import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { logout, Utilizador } from '../lib/auth';

const roleLabel: Record<string, string> = {
  enfermeiro: 'Enfermeiro',
  auxiliar: 'Auxiliar',
  medico: 'Médico',
  chefe_turno: 'Chefe de Turno',
  chefe_enfermeiros: 'Chefe de Enfermeiros',
  chefe_medicos: 'Chefe de Médicos',
  administrativo: 'Administrativo',
};

interface Props { utilizador: Utilizador; onLogout: () => void }

export default function PerfilScreen({ utilizador, onLogout }: Props) {
  const confirmarLogout = () => {
    Alert.alert('Sair', 'Tem a certeza que quer sair?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: async () => { await logout(); onLogout(); } },
    ]);
  };

  return (
    <View style={s.container}>
      <View style={s.avatar}>
        <Text style={s.avatarTexto}>{utilizador.nome.charAt(0).toUpperCase()}</Text>
      </View>

      <Text style={s.nome}>{utilizador.nome}</Text>
      <Text style={s.role}>{roleLabel[utilizador.role] ?? utilizador.role}</Text>

      <View style={s.infoCard}>
        <View style={s.infoRow}>
          <Text style={s.infoLabel}>Número de Funcionário</Text>
          <Text style={s.infoValor}>{utilizador.numeroFuncionario}</Text>
        </View>
        <View style={s.separador} />
        <View style={s.infoRow}>
          <Text style={s.infoLabel}>Função</Text>
          <Text style={s.infoValor}>{roleLabel[utilizador.role] ?? utilizador.role}</Text>
        </View>
      </View>

      <TouchableOpacity style={s.sairBotao} onPress={confirmarLogout}>
        <Text style={s.sairTexto}>Sair</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', alignItems: 'center', padding: 32 },
  avatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', marginTop: 40, marginBottom: 16 },
  avatarTexto: { fontSize: 36, fontWeight: '700', color: '#fff' },
  nome: { fontSize: 22, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  role: { fontSize: 15, color: '#64748b', marginBottom: 32 },
  infoCard: { backgroundColor: '#fff', borderRadius: 16, width: '100%', padding: 4, marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  infoLabel: { fontSize: 14, color: '#64748b' },
  infoValor: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  separador: { height: 1, backgroundColor: '#f1f5f9', marginHorizontal: 14 },
  sairBotao: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 14 },
  sairTexto: { color: '#dc2626', fontWeight: '700', fontSize: 16 },
});
