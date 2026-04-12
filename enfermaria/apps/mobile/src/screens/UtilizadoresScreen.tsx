import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

interface Props { utilizador: Utilizador; onVoltar: () => void }

const roleLabel: Record<string, string> = {
  enfermeiro: 'Enfermeiro', auxiliar: 'Auxiliar', medico: 'Médico',
  chefe_turno: 'Chefe de Turno', chefe_enfermeiros: 'Chefe de Enfermeiros',
  chefe_medicos: 'Chefe de Médicos', administrativo: 'Administrativo',
};
const roleCor: Record<string, string> = {
  enfermeiro: '#0d9488', auxiliar: '#64748b', medico: '#7c3aed',
  chefe_turno: '#d97706', chefe_enfermeiros: '#2563eb',
  chefe_medicos: '#9333ea', administrativo: '#ec4899',
};

const roles = ['enfermeiro', 'auxiliar', 'medico', 'chefe_enfermeiros', 'chefe_medicos', 'administrativo'];

export default function UtilizadoresScreen({ utilizador, onVoltar }: Props) {
  const [utilizadores, setUtilizadores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal criar
  const [modalCriar, setModalCriar] = useState(false);
  const [form, setForm] = useState({ nome: '', numeroFuncionario: '', password: '', role: 'enfermeiro', ordemExperiencia: '' });
  const [erroCriar, setErroCriar] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Modal editar
  const [editando, setEditando] = useState<any>(null);
  const [formEdit, setFormEdit] = useState({ nome: '', role: 'enfermeiro', ordemExperiencia: '', equipa: '' });
  const [erroEdit, setErroEdit] = useState('');

  const carregar = async () => {
    try {
      const { data } = await api.get('/utilizadores');
      setUtilizadores(data);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  const criar = async () => {
    if (!form.nome.trim() || !form.numeroFuncionario.trim() || !form.password.trim()) return;
    setSalvando(true);
    setErroCriar('');
    try {
      await api.post('/utilizadores', {
        ...form,
        ordemExperiencia: form.ordemExperiencia ? Number(form.ordemExperiencia) : undefined,
      });
      setModalCriar(false);
      setForm({ nome: '', numeroFuncionario: '', password: '', role: 'enfermeiro', ordemExperiencia: '' });
      await carregar();
    } catch (e: any) {
      setErroCriar(e.response?.data?.message ?? 'Erro ao criar utilizador');
    } finally { setSalvando(false); }
  };

  const guardarEdicao = async () => {
    if (!editando || !formEdit.nome.trim()) return;
    setSalvando(true);
    setErroEdit('');
    try {
      await api.patch(`/utilizadores/${editando.id}`, {
        nome: formEdit.nome,
        role: formEdit.role,
        ordemExperiencia: formEdit.ordemExperiencia ? Number(formEdit.ordemExperiencia) : undefined,
        equipa: formEdit.equipa || undefined,
      });
      setEditando(null);
      await carregar();
    } catch (e: any) {
      setErroEdit(e.response?.data?.message ?? 'Erro ao guardar');
    } finally { setSalvando(false); }
  };

  const desativar = (u: any) => {
    Alert.alert('Desativar', `Desativar ${u.nome}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desativar', style: 'destructive', onPress: async () => {
        try { await api.delete(`/utilizadores/${u.id}`); await carregar(); } catch {}
      }},
    ]);
  };

  const abrirEditar = (u: any) => {
    setEditando(u);
    setFormEdit({ nome: u.nome, role: u.role, ordemExperiencia: u.ordemExperiencia?.toString() ?? '', equipa: u.equipa ?? '' });
    setErroEdit('');
  };

  const ativos = utilizadores.filter((u) => u.ativo);
  const porRole = roles.reduce<Record<string, any[]>>((acc, r) => {
    acc[r] = ativos.filter((u) => u.role === r);
    return acc;
  }, {});
  const rolesComUtilizadores = roles.filter((r) => porRole[r].length > 0);

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onVoltar} style={s.voltarBotao}>
          <Text style={s.voltarTexto}>← Voltar</Text>
        </TouchableOpacity>
        <View style={s.headerRow}>
          <View>
            <Text style={s.titulo}>Utilizadores</Text>
            <Text style={s.subtitulo}>{ativos.length} profissionais ativos</Text>
          </View>
          <TouchableOpacity style={s.addBotao} onPress={() => { setErroCriar(''); setModalCriar(true); }}>
            <Text style={s.addTexto}>+ Novo</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={s.centro}><ActivityIndicator size="large" color="#2563eb" /></View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} />}
        >
          {rolesComUtilizadores.map((role) => (
            <View key={role} style={s.grupoBloco}>
              <View style={s.grupoCabecalho}>
                <View style={[s.grupoDot, { backgroundColor: roleCor[role] ?? '#94a3b8' }]} />
                <Text style={s.grupoTitulo}>{roleLabel[role]}</Text>
                <View style={s.grupoBadge}>
                  <Text style={s.grupoBadgeTexto}>{porRole[role].length}</Text>
                </View>
              </View>
              {porRole[role].map((u) => (
                <View key={u.id} style={s.utilizadorRow}>
                  <View style={s.avatar}>
                    <Text style={s.avatarTexto}>{u.nome.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()}</Text>
                  </View>
                  <View style={s.utilizadorInfo}>
                    <Text style={s.utilizadorNome}>{u.nome}</Text>
                    <Text style={s.utilizadorNum}>Nº {u.numeroFuncionario}{u.equipa ? ` · Equipa ${u.equipa}` : ''}</Text>
                  </View>
                  <View style={s.utilizadorAcoes}>
                    <TouchableOpacity style={s.editarBotao} onPress={() => abrirEditar(u)}>
                      <Text style={s.editarTexto}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.desativarBotao} onPress={() => desativar(u)}>
                      <Text style={s.desativarTexto}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* Modal: Criar Utilizador */}
      <Modal visible={modalCriar} transparent animationType="slide" onRequestClose={() => setModalCriar(false)}>
        <View style={s.overlay}>
          <ScrollView style={s.sheet} keyboardShouldPersistTaps="handled">
            <View style={s.sheetCabecalho}>
              <Text style={s.sheetTitulo}>Novo Utilizador</Text>
              <TouchableOpacity onPress={() => setModalCriar(false)}><Text style={s.fechar}>✕</Text></TouchableOpacity>
            </View>

            <Text style={s.formLabel}>Nome *</Text>
            <TextInput style={s.formInput} value={form.nome} onChangeText={(v) => setForm((f) => ({ ...f, nome: v }))} placeholder="Nome completo" />

            <Text style={s.formLabel}>Número de Funcionário *</Text>
            <TextInput style={s.formInput} value={form.numeroFuncionario} onChangeText={(v) => setForm((f) => ({ ...f, numeroFuncionario: v }))} placeholder="Ex: ENF001" keyboardType="default" />

            <Text style={s.formLabel}>Password *</Text>
            <TextInput style={s.formInput} value={form.password} onChangeText={(v) => setForm((f) => ({ ...f, password: v }))} placeholder="Password inicial" secureTextEntry />

            <Text style={s.formLabel}>Função</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {roles.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[s.rolePill, form.role === r && { backgroundColor: roleCor[r] ?? '#2563eb' }]}
                    onPress={() => setForm((f) => ({ ...f, role: r }))}
                  >
                    <Text style={[s.rolePillTexto, form.role === r && { color: '#fff' }]}>{roleLabel[r]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={s.formLabel}>Ordem de Experiência (opcional)</Text>
            <TextInput style={s.formInput} value={form.ordemExperiencia} onChangeText={(v) => setForm((f) => ({ ...f, ordemExperiencia: v }))} placeholder="Ex: 1, 2, 3..." keyboardType="numeric" />

            {erroCriar ? <Text style={s.erroTexto}>{erroCriar}</Text> : null}

            <View style={[s.botoes, { marginBottom: 32 }]}>
              <TouchableOpacity style={s.cancelarBtn} onPress={() => setModalCriar(false)}>
                <Text style={s.cancelarBtnTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.submeterBtn, (!form.nome.trim() || !form.numeroFuncionario.trim() || !form.password.trim() || salvando) && s.submeterBtnDes]}
                onPress={criar}
                disabled={!form.nome.trim() || !form.numeroFuncionario.trim() || !form.password.trim() || salvando}
              >
                <Text style={s.submeterBtnTexto}>{salvando ? 'A criar...' : 'Criar'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal: Editar Utilizador */}
      <Modal visible={!!editando} transparent animationType="slide" onRequestClose={() => setEditando(null)}>
        <View style={s.overlay}>
          <ScrollView style={s.sheet} keyboardShouldPersistTaps="handled">
            <View style={s.sheetCabecalho}>
              <Text style={s.sheetTitulo}>Editar · {editando?.nome}</Text>
              <TouchableOpacity onPress={() => setEditando(null)}><Text style={s.fechar}>✕</Text></TouchableOpacity>
            </View>

            <Text style={s.formLabel}>Nome</Text>
            <TextInput style={s.formInput} value={formEdit.nome} onChangeText={(v) => setFormEdit((f) => ({ ...f, nome: v }))} />

            <Text style={s.formLabel}>Função</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {roles.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[s.rolePill, formEdit.role === r && { backgroundColor: roleCor[r] ?? '#2563eb' }]}
                    onPress={() => setFormEdit((f) => ({ ...f, role: r }))}
                  >
                    <Text style={[s.rolePillTexto, formEdit.role === r && { color: '#fff' }]}>{roleLabel[r]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={s.formLabel}>Equipa (opcional)</Text>
            <TextInput style={s.formInput} value={formEdit.equipa} onChangeText={(v) => setFormEdit((f) => ({ ...f, equipa: v }))} placeholder="Ex: A, B" />

            <Text style={s.formLabel}>Ordem de Experiência (opcional)</Text>
            <TextInput style={s.formInput} value={formEdit.ordemExperiencia} onChangeText={(v) => setFormEdit((f) => ({ ...f, ordemExperiencia: v }))} keyboardType="numeric" />

            {erroEdit ? <Text style={s.erroTexto}>{erroEdit}</Text> : null}

            <View style={[s.botoes, { marginBottom: 32 }]}>
              <TouchableOpacity style={s.cancelarBtn} onPress={() => setEditando(null)}>
                <Text style={s.cancelarBtnTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.submeterBtn, (!formEdit.nome.trim() || salvando) && s.submeterBtnDes]}
                onPress={guardarEdicao}
                disabled={!formEdit.nome.trim() || salvando}
              >
                <Text style={s.submeterBtnTexto}>{salvando ? 'A guardar...' : 'Guardar'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: '#1e293b', padding: 20, paddingTop: 16 },
  voltarBotao: { marginBottom: 10 },
  voltarTexto: { color: '#94a3b8', fontSize: 14 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titulo: { fontSize: 20, fontWeight: '700', color: '#fff' },
  subtitulo: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  addBotao: { backgroundColor: '#2563eb', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addTexto: { color: '#fff', fontWeight: '700', fontSize: 13 },
  grupoBloco: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 1 },
  grupoCabecalho: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  grupoDot: { width: 10, height: 10, borderRadius: 5 },
  grupoTitulo: { flex: 1, fontSize: 14, fontWeight: '700', color: '#1e293b' },
  grupoBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  grupoBadgeTexto: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  utilizadorRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f8fafc', gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' },
  avatarTexto: { color: '#fff', fontSize: 13, fontWeight: '700' },
  utilizadorInfo: { flex: 1 },
  utilizadorNome: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  utilizadorNum: { fontSize: 12, color: '#94a3b8', marginTop: 1 },
  utilizadorAcoes: { flexDirection: 'row', gap: 6 },
  editarBotao: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  editarTexto: { fontSize: 14 },
  desativarBotao: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center' },
  desativarTexto: { color: '#dc2626', fontWeight: '700', fontSize: 14 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  sheetCabecalho: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sheetTitulo: { fontSize: 17, fontWeight: '700', color: '#1e293b' },
  fechar: { fontSize: 18, color: '#94a3b8', fontWeight: '700' },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginTop: 12, marginBottom: 6 },
  formInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, fontSize: 14, color: '#334155', backgroundColor: '#f8fafc' },
  rolePill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#e2e8f0' },
  rolePillTexto: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  erroTexto: { color: '#dc2626', fontSize: 13, marginTop: 8 },
  botoes: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelarBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#e2e8f0', alignItems: 'center' },
  cancelarBtnTexto: { fontWeight: '600', color: '#64748b', fontSize: 14 },
  submeterBtn: { flex: 2, paddingVertical: 12, borderRadius: 10, backgroundColor: '#2563eb', alignItems: 'center' },
  submeterBtnDes: { backgroundColor: '#93c5fd' },
  submeterBtnTexto: { fontWeight: '700', color: '#fff', fontSize: 14 },
});
