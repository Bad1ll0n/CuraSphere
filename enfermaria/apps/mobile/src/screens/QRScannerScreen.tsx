import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { Ionicons } from '@expo/vector-icons';
import api from '../lib/api';

interface Props {
  onScan: (doenteId: string) => void;
  onFechar: () => void;
}

export default function QRScannerScreen({ onScan, onFechar }: Props) {
  const [permissao, setPermissao] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [validando, setValidando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    BarCodeScanner.requestPermissionsAsync().then(({ status }) => {
      setPermissao(status === 'granted');
    });
  }, []);

  const handleScan = async ({ data }: { type: string; data: string }) => {
    if (scanned || validando) return;
    setScanned(true);
    setValidando(true);
    setErro('');
    try {
      await api.get(`/doentes/${data}`);
      onScan(data);
    } catch {
      setErro('QR code inválido ou doente não encontrado.');
      setValidando(false);
      // Permite tentar de novo após 2 segundos
      setTimeout(() => setScanned(false), 2000);
    }
  };

  return (
    <View style={s.container}>
      {/* Botão fechar */}
      <TouchableOpacity style={s.fechar} onPress={onFechar}>
        <Ionicons name="close" size={28} color="#fff" />
      </TouchableOpacity>

      <Text style={s.titulo}>Ler QR do Doente</Text>
      <Text style={s.subtitulo}>Aponta a câmara para o QR code na cama ou pulseira</Text>

      {permissao === null && (
        <View style={s.centro}>
          <ActivityIndicator color="#fff" size="large" />
          <Text style={s.textoInfo}>A pedir acesso à câmara…</Text>
        </View>
      )}

      {permissao === false && (
        <View style={s.centro}>
          <Ionicons name="camera-off-outline" size={56} color="#94a3b8" />
          <Text style={s.textoInfo}>Sem acesso à câmara.{'\n'}Ativa a permissão nas definições.</Text>
        </View>
      )}

      {permissao === true && (
        <>
          <View style={s.cameraBox}>
            <BarCodeScanner
              onBarCodeScanned={scanned ? undefined : handleScan}
              style={StyleSheet.absoluteFillObject}
              barCodeTypes={[BarCodeScanner.Constants.BarCodeType.qr]}
            />
            {/* Frame de scan */}
            <View style={s.frame}>
              <View style={[s.canto, s.cantoTL]} />
              <View style={[s.canto, s.cantoTR]} />
              <View style={[s.canto, s.cantoBL]} />
              <View style={[s.canto, s.cantoBR]} />
            </View>
          </View>

          {validando && (
            <View style={s.statusBox}>
              <ActivityIndicator color="#fff" />
              <Text style={s.statusTexto}>A verificar…</Text>
            </View>
          )}

          {erro ? (
            <View style={s.erroBox}>
              <Ionicons name="warning-outline" size={18} color="#fca5a5" />
              <Text style={s.erroTexto}>{erro}</Text>
            </View>
          ) : null}

          {!validando && !erro && (
            <Text style={s.dica}>Posiciona o QR code dentro do quadrado</Text>
          )}
        </>
      )}
    </View>
  );
}

const CANTO = 22;
const BORDA = 3;

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1e',
    paddingTop: 56,
    alignItems: 'center',
  },
  fechar: {
    position: 'absolute',
    top: 52,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  titulo: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginTop: 8,
  },
  subtitulo: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 6,
    marginBottom: 32,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  textoInfo: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  cameraBox: {
    width: 260,
    height: 260,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1e293b',
  },
  frame: {
    ...StyleSheet.absoluteFillObject,
  },
  canto: {
    position: 'absolute',
    width: CANTO,
    height: CANTO,
    borderColor: '#2563eb',
  },
  cantoTL: { top: 12, left: 12, borderTopWidth: BORDA, borderLeftWidth: BORDA, borderTopLeftRadius: 6 },
  cantoTR: { top: 12, right: 12, borderTopWidth: BORDA, borderRightWidth: BORDA, borderTopRightRadius: 6 },
  cantoBL: { bottom: 12, left: 12, borderBottomWidth: BORDA, borderLeftWidth: BORDA, borderBottomLeftRadius: 6 },
  cantoBR: { bottom: 12, right: 12, borderBottomWidth: BORDA, borderRightWidth: BORDA, borderBottomRightRadius: 6 },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 24,
  },
  statusTexto: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  erroBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    backgroundColor: 'rgba(239,68,68,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  erroTexto: {
    color: '#fca5a5',
    fontSize: 13,
    fontWeight: '500',
  },
  dica: {
    color: '#475569',
    fontSize: 12,
    marginTop: 20,
  },
});
