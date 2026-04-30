import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';
import { Utilizador } from '../lib/auth';

interface Mensagem {
  id: string;
  assunto: string;
  conteudo: string;
  lida: boolean;
  criadoEm: string;
  de: { nome: string; role: string };
  para?: { nome: string };
}

interface Anuncio {
  id: string;
  titulo: string;
  conteudo: string;
  prioridade: string;
  criadoEm: string;
  autor: { nome: string };
}

interface Props { utilizador: Utilizador; onVoltar: () => void }

const prioridadeCor: Record<string, string> = {
  urgente: '#ef4444', alta: '#f97316', normal: '#3b82f6', baixa: '#94a3b8',
};

export default function ComunicacaoScreen({ utilizador, onVoltar }: Props) {
  const [tab, setTab] = useState<'mensagens' | 'anuncios'>('mensagens');
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [anuncios, setAnuncios] = useState<Anuncio[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Nova mensagem
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [destinatarioId, setDestinatarioId] = useState('');
  const [assunto, setAssunto] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [enviando, setEnviando] = useState(false);

  const carregar = async () => {
    try {
      const [msgsRes, anunciosRes] = await Promise.all([
        api.get('/comunicacao/mensagens'),
        api.get('/comunicacao/anuncios'),
      ]);
      setMensagens(msgsRes.data?.data ?? msgsRes.data ?? []);
      setAnuncios(anunciosRes.data?.data ?? anunciosRes.data ?? []);
    } catch { /* ignorar */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { carregar(); }, []));

  const enviarMensagem = async () => {
    if (!assunto.trim() || !conteudo.trim()) return;
    setEnviando(true);
    try {
      await api.post('/comunicacao/mensagens', {
        paraId: destinatarioId || undefined,
        assunto: assunto.trim(),
        conteudo: conteudo.trim(),
      });
      setAssunto('');
      setConteudo('');
      setDestinatarioId('');
      setMostrarFormulario(false);
      await carregar();
    } catch { /* ignorar */ }
    finally { setEnviando(false); }
  };

  const tempoAgo = (data: string) => {
    const diff = Date.now() - new Date(data).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 60) return `${min}min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  };

  if (loading) return <View style={s.centro}><ActivityIndicator size="large" color="#2563eb" /></View>;

  if (mostrarFormulario) {
    return (
      <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => setMostrarFormulario(false)} style={s.voltarBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitulo}>Nova Mensagem</Text>
        </View>
        <ScrollView style={s.form}>
          <Text style={s.label}>Assunto</Text>
          <TextInput
            style={s.input}
            value={assunto}
            onChangeText={setAssunto}
            placeholder="Assunto da mensagem"
            placeholderTextColor="#94a3b8"
          />
          <Text style={s.label}>Mensagem</Text>
          <TextInput
            style={[s.input, s.inputMulti]}
            value={conteudo}
            onChangeText={setConteudo}
            placeholder="Escreva a sua mensagem..."
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[s.btnEnviar, enviando && { opacity: 0.6 }]}
            onPress={enviarMensagem}
            disabled={enviando}
          >
            <Ionicons name="send-outline" size={18} color="#fff" />
            <Text style={s.btnEnviarTexto}>{enviando ? 'A enviar...' : 'Enviar'}</Text>
          </TouchableOpacity>
          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  const naoLidas = mensagens.filter(m => !m.lida).length;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={onVoltar} style={s.voltarBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitulo}>Comunicação</Text>
          {naoLidas > 0 && <Text style={s.headerSub}>{naoLidas} mensagem(ns) não lida(s)</Text>}
        </View>
        {tab === 'mensagens' && (
          <TouchableOpacity onPress={() => setMostrarFormulario(true)} style={s.novaBtn}>
            <Ionicons name="create-outline" size={22} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <View style={s.tabs}>
        {([
          { key: 'mensagens', label: 'Mensagens' },
          { key: 'anuncios', label: 'Anúncios' },
        ] as const).map(t => (
          <TouchableOpacity key={t.key} style={[s.tab, tab === t.key && s.tabAtivo]} onPress={() => setTab(t.key)}>
            <Text style={[s.tabTexto, tab === t.key && s.tabTextoAtivo]}>{t.label}</Text>
            {t.key === 'mensagens' && naoLidas > 0 && (
              <View style={s.badge}><Text style={s.badgeTexto}>{naoLidas}</Text></View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); carregar(); }} />}>
        {tab === 'mensagens' && (
          mensagens.length === 0
            ? <View style={s.vazio}><Text style={s.vazioTexto}>Sem mensagens</Text></View>
            : mensagens.map(m => (
              <View key={m.id} style={[s.cartao, !m.lida && s.cartaoNaoLido]}>
                <View style={s.cartaoTopo}>
                  <View style={s.avatarMini}>
                    <Text style={s.avatarMiniTexto}>{m.de.nome.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={s.msgCabecalho}>
                      <Text style={[s.msgRemetente, !m.lida && { fontWeight: '700' }]}>{m.de.nome}</Text>
                      <Text style={s.msgTempo}>{tempoAgo(m.criadoEm)}</Text>
                    </View>
                    <Text style={[s.msgAssunto, !m.lida && { fontWeight: '700' }]} numberOfLines={1}>{m.assunto}</Text>
                    <Text style={s.msgPreview} numberOfLines={1}>{m.conteudo}</Text>
                  </View>
                  {!m.lida && <View style={s.dot} />}
                </View>
              </View>
            ))
        )}

        {tab === 'anuncios' && (
          anuncios.length === 0
            ? <View style={s.vazio}><Text style={s.vazioTexto}>Sem anúncios</Text></View>
            : anuncios.map(a => (
              <View key={a.id} style={[s.cartao, { borderLeftWidth: 3, borderLeftColor: prioridadeCor[a.prioridade] ?? '#94a3b8' }]}>
                <View style={s.anuncioTopo}>
                  <Text style={s.anuncioTitulo}>{a.titulo}</Text>
                  <Text style={s.anuncioTempo}>{tempoAgo(a.criadoEm)}</Text>
                </View>
                <Text style={s.anuncioConteudo}>{a.conteudo}</Text>
                <Text style={s.anuncioAutor}>— {a.autor.nome}</Text>
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
  novaBtn: { padding: 4 },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  tabAtivo: { backgroundColor: '#2563eb' },
  tabTexto: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  tabTextoAtivo: { color: '#fff' },
  badge: { backgroundColor: '#ef4444', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  badgeTexto: { color: '#fff', fontSize: 11, fontWeight: '700' },
  vazio: { padding: 40, alignItems: 'center' },
  vazioTexto: { color: '#94a3b8', fontSize: 15 },
  cartao: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 10, borderRadius: 14, padding: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 1 },
  cartaoNaoLido: { backgroundColor: '#f0f7ff' },
  cartaoTopo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarMini: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
  avatarMiniTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
  msgCabecalho: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  msgRemetente: { fontSize: 14, color: '#1e293b' },
  msgTempo: { fontSize: 12, color: '#94a3b8' },
  msgAssunto: { fontSize: 14, color: '#334155', marginTop: 2 },
  msgPreview: { fontSize: 13, color: '#94a3b8', marginTop: 1 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2563eb' },
  anuncioTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  anuncioTitulo: { fontSize: 15, fontWeight: '700', color: '#1e293b', flex: 1 },
  anuncioTempo: { fontSize: 12, color: '#94a3b8' },
  anuncioConteudo: { fontSize: 14, color: '#475569', lineHeight: 20 },
  anuncioAutor: { fontSize: 12, color: '#94a3b8', marginTop: 8, fontStyle: 'italic' },
  form: { padding: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#fff', borderRadius: 10, padding: 12, fontSize: 15, color: '#1e293b', borderWidth: 1, borderColor: '#e2e8f0' },
  inputMulti: { height: 120 },
  btnEnviar: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20 },
  btnEnviarTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
