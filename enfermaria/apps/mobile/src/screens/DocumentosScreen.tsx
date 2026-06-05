import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import api from '../lib/api';
import { useAuth } from '../lib/auth';

interface Documento {
  id: string;
  tipo: string;
  titulo: string;
  dataDocumento: string;
  origem: string;
  formato: string;
  mimeType: string;
  tamanhoBytes?: number;
  sistemaOrigem?: { nome: string } | null;
  fhirResourceId?: string;
}

const TIPO_EMOJI: Record<string, string> = {
  rx: '🦴', tc: '🧠', rmn: '🧲', eco: '🫀', ecg: '📈',
  lab: '🧪', alta: '📋', prescricao: '💊', vacinacao: '💉', patologia: '🔬', outro: '📄',
};

function formatBytes(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1048576) return ` · ${(bytes / 1024).toFixed(0)} KB`;
  return ` · ${(bytes / 1048576).toFixed(1)} MB`;
}

interface Props {
  route: { params: { doenteId: string; doenteNome?: string } };
  navigation: any;
}

export default function DocumentosScreen({ route, navigation }: Props) {
  const { doenteId, doenteNome } = route.params;
  const { user } = useAuth();
  const role = user?.role ?? '';
  const podeUpload = ['medico', 'enfermeiro', 'tecnico_saude'].includes(role);
  const podeSincronizar = ['medico', 'enfermeiro', 'chefe_enfermeiros'].includes(role);

  const [docs, setDocs] = useState<Documento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await api.get(`/documentos-saude/doente/${doenteId}`);
      setDocs(r.data);
    } catch {
      setDocs([]);
    } finally { setCarregando(false); }
  }, [doenteId]);

  useEffect(() => {
    navigation.setOptions({ title: `Dossier de Saúde${doenteNome ? ` — ${doenteNome}` : ''}` });
    carregar();
  }, [carregar, doenteNome, navigation]);

  const abrirDocumento = async (doc: Documento) => {
    try {
      const r = await api.get(`/documentos-saude/${doc.id}/download`);
      await WebBrowser.openBrowserAsync(r.data.url);
    } catch (e: any) {
      Alert.alert('Erro', e?.response?.data?.message ?? 'Não foi possível abrir o documento');
    }
  };

  const sincronizar = async () => {
    setSincronizando(true);
    try {
      const r = await api.post(`/documentos-saude/doente/${doenteId}/sincronizar`);
      Alert.alert('Sincronização', r.data.mensagem ?? 'Concluída');
      carregar();
    } catch (e: any) {
      Alert.alert('Erro', e?.response?.data?.message ?? 'Erro ao sincronizar');
    } finally { setSincronizando(false); }
  };

  const upload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png', 'application/octet-stream'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      setEnviando(true);

      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType ?? 'application/octet-stream',
      } as any);
      formData.append('tipo', 'outro');
      formData.append('titulo', asset.name.replace(/\.[^.]+$/, ''));
      formData.append('dataDocumento', new Date().toISOString().slice(0, 10));
      formData.append('origem', 'Upload manual');

      await api.post(`/documentos-saude/doente/${doenteId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      Alert.alert('Sucesso', 'Documento carregado');
      carregar();
    } catch (e: any) {
      Alert.alert('Erro', e?.response?.data?.message ?? 'Erro ao carregar documento');
    } finally { setEnviando(false); }
  };

  const renderDoc = ({ item }: { item: Documento }) => (
    <TouchableOpacity style={styles.card} onPress={() => abrirDocumento(item)}>
      <Text style={styles.emoji}>{TIPO_EMOJI[item.tipo] ?? '📄'}</Text>
      <View style={styles.cardBody}>
        <Text style={styles.titulo} numberOfLines={1}>{item.titulo}</Text>
        <Text style={styles.meta}>
          {new Date(item.dataDocumento).toLocaleDateString('pt-PT')}
          {formatBytes(item.tamanhoBytes)}
          {' · '}{item.sistemaOrigem?.nome ?? item.origem}
        </Text>
        {item.fhirResourceId && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Externo</Text>
          </View>
        )}
      </View>
      <Text style={styles.verBtn}>Ver</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Toolbar */}
      <View style={styles.toolbar}>
        {podeSincronizar && (
          <TouchableOpacity
            style={styles.btnSecundario}
            onPress={sincronizar}
            disabled={sincronizando}
          >
            <Text style={styles.btnSecundarioText}>{sincronizando ? 'A sincronizar...' : '↺ Sincronizar'}</Text>
          </TouchableOpacity>
        )}
        {podeUpload && (
          <TouchableOpacity
            style={styles.btnPrimario}
            onPress={upload}
            disabled={enviando}
          >
            <Text style={styles.btnPrimarioText}>{enviando ? 'A enviar...' : '+ Carregar'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {carregando ? (
        <ActivityIndicator style={{ marginTop: 48 }} color="#2563eb" />
      ) : docs.length === 0 ? (
        <View style={styles.vazio}>
          <Text style={styles.vazioIcon}>📂</Text>
          <Text style={styles.vazioText}>Sem documentos de saúde</Text>
          {podeUpload && <Text style={styles.vazioSub}>Sincroniza ou carrega um documento</Text>}
        </View>
      ) : (
        <FlatList
          data={docs}
          keyExtractor={d => d.id}
          renderItem={renderDoc}
          contentContainerStyle={{ padding: 16, gap: 8 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  toolbar: {
    flexDirection: 'row', gap: 8, padding: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  btnPrimario: {
    flex: 1, backgroundColor: '#2563eb', borderRadius: 12,
    paddingVertical: 10, alignItems: 'center',
  },
  btnPrimarioText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  btnSecundario: {
    flex: 1, backgroundColor: '#f1f5f9', borderRadius: 12,
    paddingVertical: 10, alignItems: 'center',
  },
  btnSecundarioText: { color: '#475569', fontWeight: '600', fontSize: 14 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#f1f5f9',
  },
  emoji: { fontSize: 24 },
  cardBody: { flex: 1 },
  titulo: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  meta: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  badge: { marginTop: 4, backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  badgeText: { fontSize: 10, fontWeight: '600', color: '#2563eb' },
  verBtn: { fontSize: 13, fontWeight: '600', color: '#2563eb' },
  vazio: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  vazioIcon: { fontSize: 48 },
  vazioText: { fontSize: 16, fontWeight: '600', color: '#475569' },
  vazioSub: { fontSize: 13, color: '#94a3b8' },
});
