import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Alert, Button, StyleSheet, Text, View } from 'react-native';
import { Comraid, type Capabilities } from 'react-native-comraid';

export default function App() {
  const [capabilities, setCapabilities] = useState<Capabilities>();
  const [pendingCount, setPendingCount] = useState(0);

  async function refresh() {
    setCapabilities(await Comraid.getCapabilities());
    setPendingCount((await Comraid.pendingSchedules()).length);
  }

  useEffect(() => {
    Comraid.configure()
      .then(refresh)
      .catch(error => Alert.alert('Comraid setup failed', String(error)));
  }, []);

  async function requestPermission() {
    await Comraid.requestNotificationPermission();
    await refresh();
  }

  async function startTimer() {
    const scheduled = await Comraid.startTimer({
      notification: {
        id: 'example-timer',
        title: 'Comraid timer complete',
        body: 'The native SDK delivered this notification.',
        data: { source: 'expo-example' },
      },
      durationMs: 10_000,
      fallbackPolicy: 'useInexact',
    });
    Alert.alert('Timer scheduled', scheduled.triggerAt.toLocaleTimeString());
    await refresh();
  }

  async function cancelTimer() {
    await Comraid.cancel('example-timer');
    await refresh();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Comraid native example</Text>
      <Text>Platform: {capabilities?.platform ?? 'loading'}</Text>
      <Text>Notifications: {capabilities?.authorizationStatus ?? 'unknown'}</Text>
      <Text>Pending schedules: {pendingCount}</Text>
      <View style={styles.actions}>
        <Button title="Request permission" onPress={requestPermission} />
        <Button title="Start 10-second timer" onPress={startTimer} />
        <Button title="Cancel timer" onPress={cancelTimer} />
      </View>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 16 },
  actions: { gap: 12, marginTop: 16 },
});
