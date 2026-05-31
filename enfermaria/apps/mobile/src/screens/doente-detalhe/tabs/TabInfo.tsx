import React from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { shared } from '../styles';
import EmptyState from '../../../components/EmptyState';

interface Props {
  doente: any;
  alergias: any[];
  contactos: any[];
  podeEditarDoente: boolean;
  podeRegistarVitais: boolean;
  podeDarAlta: boolean;
  onEditarDoente: () => void;
  onAdicionarAlergia: () => void;
  onRemoverAlergia: (id: string) => void;
  onAdicionarContacto: () => void;
  onRemoverContacto: (id: string) => void;
  onDarAlta: () => void;
}

export default function TabInfo({ doente, alergias, contactos, podeEditarDoente, podeRegistarVitais, podeDarAlta, onEditarDoente, onAdicionarAlergia, onRemoverAlergia, onAdicionarContacto, onRemoverContacto, onDarAlta }: Props) {
  return (
    <View style={s.secao}>
      {podeEditarDoente && (
        <View style={shared.secaoHeader}>
          <Text style={shared.secaoTitulo}>Dados Clínicos</Text>
          <TouchableOpacity style={[shared.iconBotao, shared.iconBotaoAzul]} onPress={onEditarDoente}>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>✎</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={shared.infoCard}>
        <Text style={shared.infoLabel}>Diagnóstico Principal</Text>
        <Text style={shared.infoValor}>{doente.diagnosticoPrincipal}</Text>
      </View>
      <View style={shared.infoCard}>
        <Text style={shared.infoLabel}>Data de Nascimento</Text>
        <Text style={shared.infoValor}>{new Date(doente.dataNascimento).toLocaleDateString('pt-PT')}</Text>
      </View>
      <View style={shared.infoCard}>
        <Text style={shared.infoLabel}>Data de Admissão</Text>
        <Text style={shared.infoValor}>{new Date(doente.dataAdmissao).toLocaleDateString('pt-PT')}</Text>
      </View>
      {doente.dataAltaPrevista && (
        <View style={shared.infoCard}>
          <Text style={shared.infoLabel}>Alta Prevista</Text>
          <Text style={shared.infoValor}>{new Date(doente.dataAltaPrevista).toLocaleDateString('pt-PT')}</Text>
        </View>
      )}

      {doente.atribuicoesHorario?.length > 0 && (
        <View style={shared.infoCard}>
          <Text style={shared.infoLabel}>Profissionais Atribuídos</Text>
          <ProfissionaisAtribuidos atribuicoes={doente.atribuicoesHorario} />
        </View>
      )}

      {/* Alergias */}
      <View style={shared.infoCard}>
        <View style={shared.secaoHeader}>
          <Text style={shared.infoLabel}>ALERGIAS</Text>
          {podeRegistarVitais && (
            <TouchableOpacity onPress={onAdicionarAlergia} style={[shared.iconBotao, shared.iconBotaoAzul]}>
              <Text style={shared.iconBotaoTextoAzul}>+</Text>
            </TouchableOpacity>
          )}
        </View>
        {alergias.length === 0 ? <EmptyState text="Sem alergias registadas" /> : alergias.map((a: any) => {
          const cor = a.severidade === 'anafilaxia' ? '#ef4444' : a.severidade === 'grave' ? '#f97316' : a.severidade === 'moderada' ? '#f59e0b' : '#64748b';
          return (
            <View key={a.id} style={s.alergiaRow}>
              <View style={[s.alergiaBadge, { backgroundColor: cor + '20' }]}>
                <Text style={[s.alergiaBadgeTexto, { color: cor }]}>{a.severidade}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.alergiaNome}>{a.alergenio}</Text>
                <Text style={s.alergiaTipo}>{a.tipo}</Text>
              </View>
              {podeRegistarVitais && (
                <TouchableOpacity onPress={() => Alert.alert('Remover', `Remover alergia "${a.alergenio}"?`, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Remover', style: 'destructive', onPress: () => onRemoverAlergia(a.id) }])}>
                  <Text style={{ color: '#ef4444', fontSize: 16, paddingHorizontal: 4 }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>

      {/* Contactos de Emergência */}
      <View style={shared.infoCard}>
        <View style={shared.secaoHeader}>
          <Text style={shared.infoLabel}>CONTACTOS DE EMERGÊNCIA</Text>
          <TouchableOpacity onPress={onAdicionarContacto} style={[shared.iconBotao, shared.iconBotaoAzul]}>
            <Text style={shared.iconBotaoTextoAzul}>+</Text>
          </TouchableOpacity>
        </View>
        {contactos.length === 0 ? <EmptyState text="Sem contactos registados" /> : contactos.map((c: any) => (
          <View key={c.id} style={s.contactoRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={s.contactoNome}>{c.nome}</Text>
                {c.principal && <View style={s.contactoPrincipalBadge}><Text style={s.contactoPrincipalTexto}>Principal</Text></View>}
              </View>
              <Text style={s.contactoMeta}>{c.relacao} · {c.telefone}</Text>
            </View>
            <TouchableOpacity onPress={() => Alert.alert('Remover', `Remover contacto "${c.nome}"?`, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Remover', style: 'destructive', onPress: () => onRemoverContacto(c.id) }])}>
              <Text style={{ color: '#ef4444', fontSize: 16, paddingHorizontal: 4 }}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {podeDarAlta && !doente.dataAlta && (
        <TouchableOpacity style={s.altaBotao} onPress={onDarAlta}>
          <Text style={s.altaBotaoTexto}>Dar Alta ao Doente</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function ProfissionaisAtribuidos({ atribuicoes }: { atribuicoes: any[] }) {
  const map = new Map<string, any>();
  for (const a of atribuicoes) {
    const uid = a.utilizador.id;
    if (!map.has(uid) || new Date(a.horarioTurno.data) > new Date(map.get(uid).horarioTurno.data)) map.set(uid, a);
  }
  const todos = Array.from(map.values());
  const turnoLabel = (t: string) => t === 'manha' ? 'Manhã' : t === 'tarde' ? 'Tarde' : 'Noite';
  const dataLabel = (d: string) => new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
  const medicos = todos.filter((a: any) => a.utilizador.role === 'medico');
  const enfermagem = todos.filter((a: any) => a.utilizador.role !== 'medico');

  const renderLinha = (a: any) => (
    <View key={a.utilizador.id} style={s.atribLinha}>
      <Text style={s.atribNome}>{a.utilizador.nome}</Text>
      <Text style={s.atribMeta}>{turnoLabel(a.horarioTurno.tipo)} · {dataLabel(a.horarioTurno.data)}</Text>
    </View>
  );

  return (
    <>
      {medicos.length > 0 && (
        <View style={s.grupoAtrib}>
          <View style={[s.grupoTag, { backgroundColor: '#eff6ff' }]}>
            <Text style={[s.grupoTagTexto, { color: '#2563eb' }]}>Médicos</Text>
          </View>
          {medicos.map(renderLinha)}
        </View>
      )}
      {enfermagem.length > 0 && (
        <View style={[s.grupoAtrib, medicos.length > 0 && { marginTop: 10 }]}>
          <View style={[s.grupoTag, { backgroundColor: '#f0fdf4' }]}>
            <Text style={[s.grupoTagTexto, { color: '#16a34a' }]}>Enfermagem</Text>
          </View>
          {enfermagem.map(renderLinha)}
        </View>
      )}
    </>
  );
}

const s = StyleSheet.create({
  secao: { padding: 16 },
  alergiaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  alergiaBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  alergiaBadgeTexto: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  alergiaNome: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  alergiaTipo: { fontSize: 11, color: '#64748b' },
  contactoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  contactoNome: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  contactoMeta: { fontSize: 12, color: '#64748b', marginTop: 1 },
  contactoPrincipalBadge: { backgroundColor: '#eff6ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  contactoPrincipalTexto: { fontSize: 10, fontWeight: '700', color: '#2563eb' },
  grupoAtrib: { gap: 2 },
  grupoTag: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginBottom: 4 },
  grupoTagTexto: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  atribLinha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  atribNome: { fontSize: 14, fontWeight: '600', color: '#1e293b', flex: 1 },
  atribMeta: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  altaBotao: { backgroundColor: '#dc2626', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8, marginHorizontal: 16, marginBottom: 16 },
  altaBotaoTexto: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
