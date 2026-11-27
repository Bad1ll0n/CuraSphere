import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Modal, TextInput, ActivityIndicator } from 'react-native';
import { logout, mensagemDeSaida, Utilizador } from '../lib/auth';
import api from '../lib/api';
import { estilosTematicos, LETRA, useEsquema } from '../lib/tema';

const roleLabel: Record<string, string> = {
  medico:        'Médico',
  enfermeiro:    'Enfermeiro',
  auxiliar:      'Auxiliar',
  tecnico_saude: 'Técnico de Saúde',
  farmaceutico:  'Farmacêutico',
  administrativo:'Administrativo',
  operacional:   'Operacional',
  ti:            'Tecnologias de Informação',
  qualidade:     'Qualidade',
  direcao:       'Direção',
};

interface Props { utilizador: Utilizador; onLogout: () => void }

export default function PerfilScreen({ utilizador, onLogout }: Props) {
  useEsquema(); // UX-24: volta a desenhar quando o telemóvel muda de claro para escuro
  const [modalPwd, setModalPwd] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [salvando, setSalvando] = useState(false);

  const confirmarLogout = async () => {
    Alert.alert('Sair', await mensagemDeSaida(), [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: async () => { await logout(); onLogout(); } },
    ]);
  };

  const alterarPassword = async () => {
    if (novaSenha !== confirmarSenha) { Alert.alert('Erro', 'As passwords não coincidem'); return; }
    if (novaSenha.length < 6) { Alert.alert('Erro', 'A nova password deve ter pelo menos 6 caracteres'); return; }
    setSalvando(true);
    try {
      await api.patch('/auth/alterar-password', { senhaAtual, novaSenha });
      setModalPwd(false); setSenhaAtual(''); setNovaSenha(''); setConfirmarSenha('');
      Alert.alert('Sucesso', 'Password alterada com sucesso!');
    } catch (e: any) {
      Alert.alert('Erro', e.response?.data?.message ?? 'Erro ao alterar password');
    } finally { setSalvando(false); }
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

      <TouchableOpacity accessibilityRole="button" style={s.pwdBotao} onPress={() => { setSenhaAtual(''); setNovaSenha(''); setConfirmarSenha(''); setModalPwd(true); }}>
        <Text style={s.pwdTexto}>Alterar Password</Text>
      </TouchableOpacity>

      <TouchableOpacity accessibilityRole="button" style={s.sairBotao} onPress={confirmarLogout}>
        <Text style={s.sairTexto}>Sair</Text>
      </TouchableOpacity>

      {/* Modal alterar password */}
      <Modal visible={modalPwd} transparent animationType="slide" onRequestClose={() => setModalPwd(false)}>
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitulo}>Alterar Password</Text>
              <TouchableOpacity accessibilityRole="button" onPress={() => setModalPwd(false)}>
                <Text style={s.fechar}>✕</Text>
              </TouchableOpacity>
            </View>
            {[
              { label: 'Password Atual', val: senhaAtual, set: setSenhaAtual },
              { label: 'Nova Password', val: novaSenha, set: setNovaSenha },
              { label: 'Confirmar Nova Password', val: confirmarSenha, set: setConfirmarSenha },
            ].map(({ label, val, set }) => (
              <View key={label} style={{ marginBottom: 14 }}>
                <Text style={s.inputLabel}>{label}</Text>
                <TextInput
                  secureTextEntry
                  value={val}
                  onChangeText={set}
                  style={s.input}
                  placeholder="••••••••"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            ))}
            <View style={s.modalBotoes}>
              <TouchableOpacity accessibilityRole="button" style={s.cancelarBotao} onPress={() => setModalPwd(false)}>
                <Text style={s.cancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button"
                style={[s.confirmarBotao, salvando && { opacity: 0.6 }]}
                onPress={alterarPassword}
                disabled={salvando}
              >
                {salvando ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.confirmarTexto}>Guardar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = estilosTematicos((c) => ({
  container: { flex: 1, backgroundColor: c.fundo, alignItems: 'center', padding: 32 },
  avatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', marginTop: 40, marginBottom: 16 },
  avatarTexto: { fontSize: 36, fontWeight: '700', color: '#fff' },
  nome: { fontSize: 22, fontWeight: '700', color: c.texto, marginBottom: 4 },
  role: { fontSize: 15, color: c.textoTenue, marginBottom: 32 },
  infoCard: { backgroundColor: c.superficie, borderRadius: 16, width: '100%', padding: 4, marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  infoLabel: { fontSize: LETRA.corpo, color: c.textoTenue },
  infoValor: { fontSize: LETRA.corpo, fontWeight: '600', color: c.texto },
  separador: { height: 1, backgroundColor: c.fundo, marginHorizontal: 14 },
  pwdBotao: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 14, marginBottom: 12 },
  pwdTexto: { color: '#2563eb', fontWeight: '700', fontSize: 16 },
  sairBotao: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 14 },
  sairTexto: { color: '#dc2626', fontWeight: '700', fontSize: 16 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: c.superficie, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitulo: { fontSize: 18, fontWeight: '700', color: c.texto },
  fechar: { fontSize: 18, color: c.textoTenue, fontWeight: '700' },
  inputLabel: { fontSize: LETRA.corpo, fontWeight: '600', color: c.textoTenue, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: c.borda, borderRadius: 10, padding: 12, fontSize: 14, color: c.texto, backgroundColor: c.fundo },
  modalBotoes: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelarBotao: { flex: 1, paddingVertical: 13, borderRadius: 10, backgroundColor: '#e2e8f0', alignItems: 'center' },
  cancelarTexto: { color: c.textoTenue, fontWeight: '600', fontSize: LETRA.corpo },
  confirmarBotao: { flex: 1, paddingVertical: 13, borderRadius: 10, backgroundColor: '#2563eb', alignItems: 'center' },
  confirmarTexto: { color: '#fff', fontWeight: '700', fontSize: LETRA.corpo },
}));
