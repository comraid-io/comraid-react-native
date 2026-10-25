import { ComRaid, type Capabilities, type RemoteMessage } from '@comraid/react-native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
	ActivityIndicator,
	Platform,
	Pressable,
	SafeAreaView,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native';

import { loadConfig, type ExampleConfig } from './src/config';
import { makeLogEntry, type LogEntry } from './src/eventLog';

type ReadyState = 'booting' | 'ready' | 'config-error';

export default function App() {
	const [ready, setReady] = useState<ReadyState>('booting');
	const [configError, setConfigError] = useState<string | null>(null);
	const [config, setConfig] = useState<ExampleConfig | null>(null);
	const [busy, setBusy] = useState(false);
	const [logs, setLogs] = useState<LogEntry[]>([]);
	const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
	const [token, setToken] = useState<string>('');
	const [externalUserId, setExternalUserId] = useState('example_user_1');
	const [jwt, setJwt] = useState('');
	const [attrPlan, setAttrPlan] = useState('premium');
	const [lastMessage, setLastMessage] = useState<RemoteMessage | null>(null);

	const pushLog = useCallback((kind: LogEntry['kind'], message: string, detail?: unknown) => {
		setLogs(prev => [makeLogEntry(kind, message, detail), ...prev].slice(0, 80));
	}, []);

	const run = useCallback(
		async (label: string, action: () => Promise<unknown>) => {
			setBusy(true);
			try {
				const result = await action();
				pushLog('ok', label, result === undefined ? undefined : result);
				return result;
			} catch (error) {
				pushLog('error', label, error instanceof Error ? error.message : error);
				throw error;
			} finally {
				setBusy(false);
			}
		},
		[pushLog],
	);

	useEffect(() => {
		let cancelled = false;
		const unsubs: Array<() => void> = [];

		(async () => {
			try {
				const next = loadConfig();
				if (cancelled) return;
				setConfig(next);
				setExternalUserId(next.externalUserId);
				setJwt(next.jwt ?? '');

				await ComRaid.initialize({
					appId: next.appId,
					apiBaseURL: next.apiBaseURL,
					displayForegroundNotifications: true,
					android: {
						defaultChannelId: 'comraid-example',
						defaultChannelName: 'ComRaid Example',
						smallIconResourceName: 'ic_launcher',
					},
					ios: { apnsEnvironment: next.apnsEnvironment },
				});

				unsubs.push(
					ComRaid.onMessage(message => {
						setLastMessage(message);
						pushLog('event', 'onMessage', message);
					}),
				);
				unsubs.push(
					ComRaid.onNotificationOpenedApp(message => {
						setLastMessage(message);
						pushLog('event', 'onNotificationOpenedApp', message);
					}),
				);
				unsubs.push(
					ComRaid.onTokenRefresh(nextToken => {
						setToken(nextToken);
						pushLog('event', 'onTokenRefresh', nextToken);
					}),
				);

				const initial = await ComRaid.getInitialNotification();
				if (initial) {
					setLastMessage(initial);
					pushLog('event', 'getInitialNotification', initial);
				}

				const caps = await ComRaid.getCapabilities();
				if (!cancelled) {
					setCapabilities(caps);
					setReady('ready');
					pushLog('info', 'initialized', {
						appId: next.appId,
						apiBaseURL: next.apiBaseURL ?? '(default)',
						platform: caps.platform,
					});
				}
			} catch (error) {
				if (cancelled) return;
				const message = error instanceof Error ? error.message : String(error);
				setConfigError(message);
				setReady('config-error');
			}
		})();

		return () => {
			cancelled = true;
			unsubs.forEach(unsub => unsub());
		};
	}, [pushLog]);

	const header = useMemo(() => {
		if (ready === 'booting') return 'Booting ComRaid…';
		if (ready === 'config-error') return 'Config required';
		return 'ComRaid method playground';
	}, [ready]);

	if (ready === 'booting') {
		return (
			<SafeAreaView style={styles.center}>
				<ActivityIndicator size="large" color="#0B1F33" />
				<Text style={styles.muted}>{header}</Text>
				<StatusBar style="dark" />
			</SafeAreaView>
		);
	}

	if (ready === 'config-error') {
		return (
			<SafeAreaView style={styles.center}>
				<Text style={styles.title}>{header}</Text>
				<Text style={styles.error}>{configError}</Text>
				<Text style={styles.muted}>
					Copy `.env.example` → `.env`, set `EXPO_PUBLIC_COMRAID_APP_ID`, then rebuild the
					dev client.
				</Text>
				<StatusBar style="dark" />
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.root}>
			<StatusBar style="dark" />
			<ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
				<Text style={styles.title}>{header}</Text>
				<Text style={styles.muted}>
					Expo {Platform.OS} · New Architecture · local `@comraid/react-native` (file:..)
				</Text>
				{config ? (
					<Text style={styles.mono}>
						appId={config.appId}
						{'\n'}
						api={config.apiBaseURL ?? 'https://api.comraid.io'}
					</Text>
				) : null}

				<Section title="1. Happy path">
					<Row
						label="requestNotificationPermission"
						disabled={busy}
						onPress={() =>
							run('requestNotificationPermission', () => ComRaid.requestNotificationPermission())
						}
					/>
					<Row
						label="register"
						disabled={busy}
						onPress={() => run('register', () => ComRaid.register())}
					/>
					<Field label="external_user_id" value={externalUserId} onChangeText={setExternalUserId} />
					<Field label="jwt (optional)" value={jwt} onChangeText={setJwt} />
					<Row
						label="login"
						disabled={busy || !externalUserId.trim()}
						onPress={() =>
							run('login', () =>
								ComRaid.login(externalUserId.trim(), jwt.trim() || undefined),
							)
						}
					/>
					<Row
						label="setDeviceProperties"
						disabled={busy}
						onPress={() =>
							run('setDeviceProperties', () =>
								ComRaid.setDeviceProperties({
									appVersion: '1.0.0',
									model: Platform.OS === 'ios' ? 'iPhone' : 'Android',
									osVersion: String(Platform.Version),
									extras: { example: 'true' },
								}),
							)
						}
					/>
				</Section>

				<Section title="2. Identity / channel">
					<Row label="logout" disabled={busy} onPress={() => run('logout', () => ComRaid.logout())} />
					<Row label="optOut" disabled={busy} onPress={() => run('optOut', () => ComRaid.optOut())} />
					<Row label="optIn" disabled={busy} onPress={() => run('optIn', () => ComRaid.optIn())} />
					<Field label="attribute plan" value={attrPlan} onChangeText={setAttrPlan} />
					<Row
						label="setAttributes"
						disabled={busy}
						onPress={() =>
							run('setAttributes', () => ComRaid.setAttributes({ plan: attrPlan || 'premium' }))
						}
					/>
				</Section>

				<Section title="3. Token + capabilities">
					<Row
						label="getCapabilities"
						disabled={busy}
						onPress={async () => {
							const caps = (await run('getCapabilities', () =>
								ComRaid.getCapabilities(),
							)) as Capabilities;
							setCapabilities(caps);
						}}
					/>
					<Row
						label="getToken"
						disabled={busy}
						onPress={async () => {
							const next = (await run('getToken', () => ComRaid.getToken())) as string;
							setToken(next);
						}}
					/>
					{capabilities ? (
						<Text style={styles.mono}>{JSON.stringify(capabilities, null, 2)}</Text>
					) : null}
					{token ? <Text style={styles.mono}>token={token}</Text> : null}
				</Section>

				<Section title="4. Receive / present / ACKs">
					<Text style={styles.muted}>
						Listeners are wired in `useEffect`. Background handler is registered in `index.ts`.
						Send a Message from the dashboard or `@comraid/node` to this device after login.
					</Text>
					<Row
						label="getInitialNotification"
						disabled={busy}
						onPress={async () => {
							const initial = (await run('getInitialNotification', () =>
								ComRaid.getInitialNotification(),
							)) as RemoteMessage | null;
							setLastMessage(initial);
						}}
					/>
					<Row
						label="presentNotification (last / sample)"
						disabled={busy}
						onPress={() =>
							run('presentNotification', () =>
								ComRaid.presentNotification(
									lastMessage ?? {
										messageId: 'local-sample',
										title: 'Example presentNotification',
										body: 'Drawn by the SDK from JS',
										data: { source: 'example' },
									},
								),
							)
						}
					/>
					<Row
						label="acknowledgeDelivered (last)"
						disabled={busy || !lastMessage?.deliveryId || !lastMessage.attributionToken}
						onPress={() =>
							run('acknowledgeDelivered', () =>
								ComRaid.acknowledgeDelivered(
									lastMessage!.deliveryId!,
									lastMessage!.attributionToken!,
								),
							)
						}
					/>
					<Row
						label="acknowledgeOpened (last)"
						disabled={busy || !lastMessage?.deliveryId || !lastMessage.attributionToken}
						onPress={() =>
							run('acknowledgeOpened', () =>
								ComRaid.acknowledgeOpened(
									lastMessage!.deliveryId!,
									lastMessage!.attributionToken!,
								),
							)
						}
					/>
					<Row
						label="flushAcks"
						disabled={busy}
						onPress={() => run('flushAcks', () => ComRaid.flushAcks())}
					/>
					{lastMessage ? (
						<Text style={styles.mono}>{JSON.stringify(lastMessage, null, 2)}</Text>
					) : null}
				</Section>

				<Section title="5. Local schedule / timer">
					<Row
						label="schedule (+60s)"
						disabled={busy}
						onPress={() =>
							run('schedule', () =>
								ComRaid.schedule({
									notification: {
										id: `sched-${Date.now()}`,
										title: 'Scheduled example',
										body: 'Fired from ComRaid.schedule',
										data: { kind: 'schedule' },
									},
									triggerAt: Date.now() + 60_000,
								}),
							)
						}
					/>
					<Row
						label="startTimer (30s)"
						disabled={busy}
						onPress={() =>
							run('startTimer', () =>
								ComRaid.startTimer({
									notification: {
										id: `timer-${Date.now()}`,
										title: 'Timer example',
										body: 'Fired from ComRaid.startTimer',
										data: { kind: 'timer' },
									},
									durationMs: 30_000,
								}),
							)
						}
					/>
					<Row
						label="pendingSchedules"
						disabled={busy}
						onPress={() => run('pendingSchedules', () => ComRaid.pendingSchedules())}
					/>
					<Row
						label="cancel (type an id in log / use pending)"
						disabled={busy}
						onPress={() =>
							run('cancel', async () => {
								const pending = await ComRaid.pendingSchedules();
								const id = pending[0]?.notification.id;
								if (!id) throw new Error('No pending schedules to cancel');
								await ComRaid.cancel(id);
								return { cancelled: id };
							})
						}
					/>
				</Section>

				<Section title="Event log">
					<Row label="Clear log" disabled={busy} onPress={() => setLogs([])} />
					{logs.length === 0 ? (
						<Text style={styles.muted}>No events yet.</Text>
					) : (
						logs.map(entry => (
							<View key={entry.id} style={styles.logRow}>
								<Text style={[styles.logKind, logColor(entry.kind)]}>
									{entry.at} · {entry.kind}
								</Text>
								<Text style={styles.mono}>{entry.message}</Text>
							</View>
						))
					)}
				</Section>
			</ScrollView>
			{busy ? (
				<View style={styles.busyBanner}>
					<ActivityIndicator color="#fff" />
					<Text style={styles.busyText}>Running…</Text>
				</View>
			) : null}
		</SafeAreaView>
	);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<View style={styles.section}>
			<Text style={styles.sectionTitle}>{title}</Text>
			{children}
		</View>
	);
}

function Row({
	label,
	onPress,
	disabled,
}: {
	label: string;
	onPress: () => void;
	disabled?: boolean;
}) {
	return (
		<Pressable
			accessibilityRole="button"
			disabled={disabled}
			onPress={onPress}
			style={({ pressed }) => [
				styles.button,
				pressed && styles.buttonPressed,
				disabled && styles.buttonDisabled,
			]}
		>
			<Text style={styles.buttonLabel}>{label}</Text>
		</Pressable>
	);
}

function Field({
	label,
	value,
	onChangeText,
}: {
	label: string;
	value: string;
	onChangeText: (value: string) => void;
}) {
	return (
		<View style={styles.field}>
			<Text style={styles.fieldLabel}>{label}</Text>
			<TextInput
				autoCapitalize="none"
				autoCorrect={false}
				style={styles.input}
				value={value}
				onChangeText={onChangeText}
			/>
		</View>
	);
}

function logColor(kind: LogEntry['kind']) {
	switch (kind) {
		case 'error':
			return { color: '#B42318' };
		case 'ok':
			return { color: '#027A48' };
		case 'event':
			return { color: '#175CD3' };
		default:
			return { color: '#475467' };
	}
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: '#F8FAFC' },
	center: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: 24,
		gap: 12,
		backgroundColor: '#F8FAFC',
	},
	content: { padding: 16, paddingBottom: 48, gap: 8 },
	title: { fontSize: 22, fontWeight: '700', color: '#0B1F33' },
	muted: { fontSize: 13, color: '#475467', lineHeight: 18 },
	error: { fontSize: 14, color: '#B42318', textAlign: 'center' },
	mono: {
		fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
		fontSize: 11,
		color: '#344054',
		backgroundColor: '#EEF2F6',
		padding: 8,
		borderRadius: 8,
		overflow: 'hidden',
	},
	section: {
		marginTop: 12,
		padding: 12,
		borderRadius: 12,
		backgroundColor: '#fff',
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: '#D0D5DD',
		gap: 8,
	},
	sectionTitle: { fontSize: 15, fontWeight: '600', color: '#0B1F33' },
	button: {
		backgroundColor: '#0B1F33',
		paddingVertical: 10,
		paddingHorizontal: 12,
		borderRadius: 8,
	},
	buttonPressed: { opacity: 0.85 },
	buttonDisabled: { opacity: 0.4 },
	buttonLabel: { color: '#fff', fontWeight: '600', fontSize: 13 },
	field: { gap: 4 },
	fieldLabel: { fontSize: 12, color: '#475467' },
	input: {
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: '#D0D5DD',
		borderRadius: 8,
		paddingHorizontal: 10,
		paddingVertical: 8,
		backgroundColor: '#fff',
		fontSize: 14,
		color: '#0B1F33',
	},
	logRow: { gap: 4, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EAECF0' },
	logKind: { fontSize: 11, fontWeight: '600' },
	busyBanner: {
		position: 'absolute',
		left: 16,
		right: 16,
		bottom: 24,
		backgroundColor: '#0B1F33',
		borderRadius: 999,
		paddingVertical: 10,
		paddingHorizontal: 16,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
	},
	busyText: { color: '#fff', fontWeight: '600' },
});
