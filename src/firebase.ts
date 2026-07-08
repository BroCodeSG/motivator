import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';

import { firebaseConfig } from './firebase-config';

const app = initializeApp(firebaseConfig);

// Auto-detect long polling: the default WebChannel transport is flaky in
// React Native environments.
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});
