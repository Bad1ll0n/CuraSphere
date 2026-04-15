import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, TouchableOpacity, Modal, ActivityIndicator, StyleSheet, AppState, AppStateStatus, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';

import { getUtilizador, logout, Utilizador } from '../lib/auth';
import api, { setUnauthorizedCallback } from '../lib/api';
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import TarefasScreen from '../screens/TarefasScreen';
import DoentesScreen from '../screens/DoentesScreen';
import MaisScreen from '../screens/MaisScreen';
import QRScannerScreen from '../screens/QRScannerScreen';
import DoenteDetalheScreen from '../screens/DoenteDetalheScreen';

const Tab = createBottomTabNavigator();

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, { ativo: IoniconName; inativo: IoniconName }> = {
  Dashboard: { ativo: 'grid',     inativo: 'grid-outline' },
  Doentes:   { ativo: 'medkit',   inativo: 'medkit-outline' },
  Tarefas:   { ativo: 'checkbox', inativo: 'checkbox-outline' },
  Mais:      { ativo: 'menu',     inativo: 'menu-outline' },
};

function TabIcon({ label, ativo }: { label: string; ativo: boolean }) {
  const icons = TAB_ICONS[label];
  const cor = ativo ? '#2563eb' : '#94a3b8';
  return (
    <View style={estilos.tabIcon}>
      <Ionicons name={ativo ? icons.ativo : icons.inativo} size={24} color={cor} />
      <Text style={[estilos.tabLabel, { color: cor }]}>{label}</Text>
    </View>
  );
}

export default function App() {
  const [utilizador, setUtilizador] = useState<Utilizador | null>(null);
  const [loading, setLoading] = useState(true);
  const [scannerAberto, setScannerAberto] = useState(false);
  const [scanDoente, setScanDoente] = useState<string | null>(null);

  const TIMEOUT_MS = 15 * 60 * 1000;
  const lastActiveRef = useRef<number>(Date.now());
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/active/) && nextState === 'background') {
        lastActiveRef.current = Date.now();
      }
      if (appStateRef.current === 'background' && nextState === 'active') {
        if (Date.now() - lastActiveRef.current > TIMEOUT_MS) {
          await logout();
          setUtilizador(null);
        }
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, []);

  // Configurar notificações push
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
    });
  }, []);

  const registarTokenPush = async () => {
    if (Platform.OS === 'web') return;
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;
      const { data: token } = await Notifications.getExpoPushTokenAsync();
      await api.post('/notificacoes/registar-token', { token, plataforma: Platform.OS });
    } catch { /* silencioso */ }
  };

  useEffect(() => {
    setUnauthorizedCallback(() => setUtilizador(null));

    const iniciar = async () => {
      const u = await getUtilizador();
      if (!u) { setLoading(false); return; }

      try {
        await api.get('/auth/me');
        setUtilizador(u);
        registarTokenPush();
      } catch {
        await logout();
        setUtilizador(null);
      } finally {
        setLoading(false);
      }
    };

    iniciar();
  }, []);

  if (loading) return (
    <View style={estilos.loading}>
      <ActivityIndicator size="large" color="#2563eb" />
    </View>
  );

  if (!utilizador) return (
    <LoginScreen onLogin={async () => {
      const u = await getUtilizador();
      setUtilizador(u);
    }} />
  );

  return (
    <SafeAreaProvider>
      {/* Modal scanner QR */}
      <Modal visible={scannerAberto} animationType="slide" onRequestClose={() => setScannerAberto(false)}>
        <QRScannerScreen
          onScan={(id) => { setScannerAberto(false); setScanDoente(id); }}
          onFechar={() => setScannerAberto(false)}
        />
      </Modal>

      {/* Overlay ficha do doente após scan */}
      {scanDoente && (
        <View style={StyleSheet.absoluteFill}>
          <DoenteDetalheScreen
            doenteId={scanDoente}
            utilizador={utilizador}
            onVoltar={() => setScanDoente(null)}
          />
        </View>
      )}

      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarShowLabel: false,
            tabBarStyle: estilos.tabBar,
            tabBarItemStyle: estilos.tabItem,
          }}
        >
          <Tab.Screen
            name="Dashboard"
            options={{ tabBarIcon: ({ focused }) => <TabIcon label="Dashboard" ativo={focused} /> }}
          >
            {() => <DashboardScreen utilizador={utilizador} />}
          </Tab.Screen>

          <Tab.Screen
            name="Doentes"
            options={{ tabBarIcon: ({ focused }) => <TabIcon label="Doentes" ativo={focused} /> }}
          >
            {() => <DoentesScreen utilizador={utilizador} />}
          </Tab.Screen>

          {/* Botão Scan central */}
          <Tab.Screen
            name="Scan"
            component={() => null}
            options={{
              tabBarButton: () => (
                <TouchableOpacity
                  style={estilos.scanBotaoWrapper}
                  onPress={() => setScannerAberto(true)}
                  activeOpacity={0.85}
                >
                  <View style={estilos.scanCirculo}>
                    <Ionicons name="qr-code-outline" size={24} color="#fff" />
                  </View>
                </TouchableOpacity>
              ),
            }}
          />

          <Tab.Screen
            name="Tarefas"
            component={TarefasScreen}
            options={{ tabBarIcon: ({ focused }) => <TabIcon label="Tarefas" ativo={focused} /> }}
          />

          <Tab.Screen
            name="Mais"
            options={{ tabBarIcon: ({ focused }) => <TabIcon label="Mais" ativo={focused} /> }}
          >
            {() => <MaisScreen utilizador={utilizador} onLogout={() => setUtilizador(null)} />}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const estilos = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },
  tabBar: { height: 72, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  tabItem: { justifyContent: 'center', alignItems: 'center', paddingTop: 10, paddingBottom: 10 },
  tabIcon: { alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabLabel: { fontSize: 10, fontWeight: '500' },
  scanBotaoWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanCirculo: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    shadowColor: '#2563eb',
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 8,
  },
});
