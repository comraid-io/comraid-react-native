import { ComRaid } from '@comraid/react-native';
import { registerRootComponent } from 'expo';

import App from './App';

/**
 * Must run before the React tree mounts (same pattern as RNFirebase).
 * Background / killed deliveries land here; the UI also mirrors them into the event log.
 */
ComRaid.setBackgroundMessageHandler(async message => {
	console.log('[ComRaid example] background message', message);
});

registerRootComponent(App);
