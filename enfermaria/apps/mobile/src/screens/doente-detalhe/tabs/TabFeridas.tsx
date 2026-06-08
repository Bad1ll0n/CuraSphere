import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import api from '../../../lib/api';

interface FotoFerida {
  id: string;
  url: string;
  mimeType: string;
  criadaEm: string;
}

interface Avaliacao {
  id: string;
  criadaEm: string;
  tipo: string;
  localizacao: string;
  estadoCicatrizacao: string;
  registadoPor: { nome: string };
  fotos: FotoFerida[];
}

interface Props {
  doenteId: string;
  podeRegistar: boolean;
}

const TIPO_LABEL: Record<string, string> = {
  ulcera_pressao: 'Úlcera Pressão', ulcera_venosa: 'Úlcera Venosa',
  ulcera_arterial: 'Úlcera Arterial', cirurgica: 'Cirúrgica',
  traumatica: 'Traumática', queimadura: 'Queimadura', outra: 'Outra',
};

export default function TabFeridas({ doenteId, podeRegistar }: Props) {
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/feridas/${doenteId}`);
      setAvaliacoes(r.data ?? []);
    } catch {
      setAvaliacoes([]);
    } finally {
      setLoading(false);
    }
  }, [doenteId]);

  useEffect(() => { carregar(); }, [carregar]);

  const uploadFoto = async (avaliacaoId: string) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à câmara para tirar fotos de feridas.');
      return;
    }

    Alert.alert(
      'Adicionar Fotografia',
      'Escolha a fonte da imagem',
      [
        {
          text: 'Câmara',
          onPress: () => pickAndUpload(avaliacaoId, 'camera'),
        },
        {
          text: 'Galeria',
          onPress: () => pickAndUpload(avaliacaoId, 'gallery'),
        },
        { text: 'Cancelar', style: 'cancel' },
      ],
    );
  };

  const pickAndUpload = async (avaliacaoId: string, source: 'camera' | 'gallery') => {
    try {
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            allowsEditing: false,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
          });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const uri = asset.uri;
      const mimeType = asset.mimeType ?? 'image/jpeg';
      const filename = uri.split('/').pop() ?? 'foto.jpg';

      setUploadingId(avaliacaoId);

      const fd = new FormData();
      fd.append('file', { uri, name: filename, type: mimeType } as any);

      await api.post(`/feridas/${avaliacaoId}/fotos`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      await carregar();
    } catch (e: any) {
      Alert.alert('Erro', e?.response?.data?.message ?? 'Erro ao enviar fotografia');
    } finally {
      setUploadingId(null);
    }
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (avaliacoes.length === 0) {
    return (
      <View style={s.center}>
        <Text style={s.emptyText}>Sem avaliações de feridas registadas</Text>
        <Text style={s.emptySubText}>Registe avaliações no portal web</Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 32 }}>
      {avaliacoes.map((av) => (
        <View key={av.id} style={s.card}>
          <View style={s.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.tipo}>{TIPO_LABEL[av.tipo] ?? av.tipo}</Text>
              <Text style={s.localizacao}>{av.localizacao}</Text>
              <Text style={s.meta}>
                {new Date(av.criadaEm).toLocaleDateString('pt-PT')} · {av.registadoPor?.nome?.split(' ')[0]}
              </Text>
            </View>
            {podeRegistar && (
              <TouchableOpacity
                style={s.fotoBotao}
                onPress={() => uploadFoto(av.id)}
                disabled={uploadingId === av.id}>
                {uploadingId === av.id
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.fotoBotaoTexto}>📷 Foto</Text>
                }
              </TouchableOpacity>
            )}
          </View>

          {/* Thumbnails */}
          {(av.fotos?.length ?? 0) > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              {av.fotos.map((foto) => (
                <Image
                  key={foto.id}
                  source={{ uri: foto.url }}
                  style={s.thumbnail}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          )}

          {(av.fotos?.length ?? 0) === 0 && (
            <Text style={s.semFotos}>Sem fotografias</Text>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { fontSize: 14, color: '#64748b', fontWeight: '600', marginBottom: 4 },
  emptySubText: { fontSize: 12, color: '#94a3b8', textAlign: 'center' },
  card: { backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  tipo: { fontSize: 13, fontWeight: '700', color: '#1e293b', marginBottom: 2 },
  localizacao: { fontSize: 13, color: '#475569', marginBottom: 2 },
  meta: { fontSize: 11, color: '#94a3b8' },
  fotoBotao: { backgroundColor: '#2563eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, minWidth: 70, alignItems: 'center', justifyContent: 'center' },
  fotoBotaoTexto: { color: '#fff', fontSize: 12, fontWeight: '600' },
  thumbnail: { width: 72, height: 72, borderRadius: 10, marginRight: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  semFotos: { fontSize: 12, color: '#cbd5e1', fontStyle: 'italic', marginTop: 8 },
});
