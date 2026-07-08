import * as Crypto from 'expo-crypto';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { db } from '@/firebase';

// Signing in with an unknown ID number creates the account with that PIN.
// The PIN is stored as a salted SHA-256 hash — keeps casual snoopers out of
// the open database, but this is convenience-grade auth, not real security.
export type SignInResult = { ok: true; created: boolean } | { ok: false; error: string };

async function hashPin(idNumber: string, pin: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `motivator:${idNumber}:${pin}`
  );
}

export async function signIn(idNumber: string, pin: string): Promise<SignInResult> {
  const pinHash = await hashPin(idNumber, pin);
  const ref = doc(db, 'users', idNumber);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { pinHash, createdAt: serverTimestamp() });
    return { ok: true, created: true };
  }
  if (snap.data().pinHash !== pinHash) {
    return { ok: false, error: 'Wrong PIN for this ID number.' };
  }
  return { ok: true, created: false };
}
