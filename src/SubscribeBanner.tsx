import { useState, type ReactElement } from 'react';
import {
	ActivityIndicator,
	Pressable,
	StyleSheet,
	Text,
	View,
	type StyleProp,
	type TextStyle,
	type ViewStyle,
} from 'react-native';
import { ComRaid } from './instance';
import { runSubscribeFlow } from './runSubscribeFlow';

export type SubscribeBannerProps = {
	/** When set, Login runs after register with this External user ID. */
	externalUserId?: string;
	/** Identity verification JWT when the Project requires it. */
	jwt?: string;
	title?: string;
	subtitle?: string;
	primaryLabel?: string;
	secondaryLabel?: string;
	/** Copy shown after the OS denies notification permission. */
	deniedLabel?: string;
	primaryColor?: string;
	secondaryColor?: string;
	containerStyle?: StyleProp<ViewStyle>;
	titleStyle?: StyleProp<TextStyle>;
	subtitleStyle?: StyleProp<TextStyle>;
	/** Host-owned hide / snooze — the SDK does not persist retry timing. */
	onDismiss?: () => void;
	onSuccess?: () => void;
	onError?: (error: unknown) => void;
	/** Optional host hook when permission is denied (e.g. open Settings yourself). */
	onPermissionDenied?: () => void;
};

const DEFAULT_TITLE = 'Stay updated';
const DEFAULT_SUBTITLE = 'Enable notifications to get updates from this app.';
const DEFAULT_PRIMARY = 'Enable notifications';
const DEFAULT_SECONDARY = 'Maybe later';
const DEFAULT_DENIED =
	'Notifications are off. You can enable them in your device Settings.';

/**
 * Thin JS UI: OS permission → register Subscription → optional Login.
 * Uses `runSubscribeFlow` with the package `ComRaid` singleton (ADR 0004).
 * Never calls Channel optIn/optOut.
 */
export function SubscribeBanner({
	externalUserId,
	jwt,
	title = DEFAULT_TITLE,
	subtitle = DEFAULT_SUBTITLE,
	primaryLabel = DEFAULT_PRIMARY,
	secondaryLabel = DEFAULT_SECONDARY,
	deniedLabel = DEFAULT_DENIED,
	primaryColor = '#111827',
	secondaryColor = '#6B7280',
	containerStyle,
	titleStyle,
	subtitleStyle,
	onDismiss,
	onSuccess,
	onError,
	onPermissionDenied,
}: SubscribeBannerProps): ReactElement {
	const [loading, setLoading] = useState(false);
	const [denied, setDenied] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	async function handlePrimaryPress(): Promise<void> {
		if (loading) {
			return;
		}
		setLoading(true);
		setErrorMessage(null);
		try {
			const result = await runSubscribeFlow(
				{
					requestNotificationPermission: () => ComRaid.requestNotificationPermission(),
					register: () => ComRaid.register(),
					login: (id, token) => ComRaid.login(id, token),
				},
				{ externalUserId, jwt },
			);
			if (result.status === 'denied') {
				setDenied(true);
				onPermissionDenied?.();
				return;
			}
			setDenied(false);
			onSuccess?.();
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Something went wrong';
			setErrorMessage(message);
			onError?.(error);
		} finally {
			setLoading(false);
		}
	}

	return (
		<View style={[styles.container, containerStyle]} accessibilityRole="summary">
			<Text style={[styles.title, titleStyle]}>{title}</Text>
			<Text style={[styles.subtitle, subtitleStyle]}>{subtitle}</Text>
			{denied ? <Text style={styles.denied}>{deniedLabel}</Text> : null}
			{errorMessage != null ? <Text style={styles.error}>{errorMessage}</Text> : null}
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={primaryLabel}
				accessibilityState={{ disabled: loading, busy: loading }}
				disabled={loading}
				onPress={() => {
					void handlePrimaryPress();
				}}
				style={[
					styles.primaryButton,
					{ backgroundColor: primaryColor, opacity: loading ? 0.7 : 1 },
				]}
			>
				{loading ? (
					<ActivityIndicator color="#FFFFFF" />
				) : (
					<Text style={styles.primaryLabel}>{primaryLabel}</Text>
				)}
			</Pressable>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={secondaryLabel}
				disabled={loading}
				onPress={() => {
					onDismiss?.();
				}}
				style={styles.secondaryButton}
			>
				<Text style={[styles.secondaryLabel, { color: secondaryColor }]}>
					{secondaryLabel}
				</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		padding: 16,
		borderRadius: 12,
		backgroundColor: '#F9FAFB',
		gap: 8,
	},
	title: {
		fontSize: 17,
		fontWeight: '600',
		color: '#111827',
	},
	subtitle: {
		fontSize: 14,
		color: '#4B5563',
		marginBottom: 4,
	},
	denied: {
		fontSize: 13,
		color: '#B45309',
	},
	error: {
		fontSize: 13,
		color: '#B91C1C',
	},
	primaryButton: {
		minHeight: 44,
		borderRadius: 8,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 16,
		marginTop: 4,
	},
	primaryLabel: {
		color: '#FFFFFF',
		fontSize: 15,
		fontWeight: '600',
	},
	secondaryButton: {
		minHeight: 40,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 8,
	},
	secondaryLabel: {
		fontSize: 14,
		fontWeight: '500',
	},
});
