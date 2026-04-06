import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { login } from '../lib/auth';

interface Props {
  onLogin: () => void;
}

export default function LoginScreen({ onLogin }: Props) {
  const [numeroFuncionario, setNumeroFuncionario] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!numeroFuncionario || !password) return;
    setLoading(true);
    try {
      await login(numeroFuncionario, password);
      onLogin();
    } catch {
      Alert.alert('Erro', 'Número de funcionário ou password incorretos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.container}>
      <View style={s.card}>
        <View style={s.icon}>
          <Text style={s.iconText}>🏥</Text>
        </View>
        <Text style={s.titulo}>Enfermaria</Text>
        <Text style={s.subtitulo}>Gestão Hospitalar</Text>

        <View style={s.campo}>
          <Text style={s.label}>Número de Funcionário</Text>
          <TextInput
            style={s.input}
            value={numeroFuncionario}
            onChangeText={setNumeroFuncionario}
            placeholder="Ex: 12345"
            keyboardType="numeric"
            autoCapitalize="none"
          />
        </View>

        <View style={s.campo}>
          <Text style={s.label}>Password</Text>
          <TextInput
            style={s.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
          />
        </View>

        <TouchableOpacity style={[s.botao, loading && s.botaoDesativado]} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.botaoTexto}>Entrar</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 28, shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 5 },
  icon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  iconText: { fontSize: 28 },
  titulo: { fontSize: 22, fontWeight: '700', color: '#1e293b', textAlign: 'center' },
  subtitulo: { fontSize: 14, color: '#94a3b8', textAlign: 'center', marginBottom: 28 },
  campo: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1e293b', backgroundColor: '#f8fafc' },
  botao: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  botaoDesativado: { backgroundColor: '#93c5fd' },
  botaoTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
