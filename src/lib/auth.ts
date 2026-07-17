import * as Crypto from 'expo-crypto';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

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
    await setDoc(ref, { pinHash, email: '', createdAt: serverTimestamp() });
    return { ok: true, created: true };
  }
  if (snap.data().pinHash !== pinHash) {
    return { ok: false, error: 'Wrong PIN for this ID number.' };
  }
  return { ok: true, created: false };
}

export async function changePin(idNumber: string, newPin: string): Promise<void> {
  const pinHash = await hashPin(idNumber, newPin);
  await updateDoc(doc(db, 'users', idNumber), { pinHash });
}

export async function getUserEmail(idNumber: string): Promise<string> {
  const snap = await getDoc(doc(db, 'users', idNumber));
  return snap.exists() ? snap.data().email ?? '' : '';
}

export async function setUserEmail(idNumber: string, email: string): Promise<void> {
  await updateDoc(doc(db, 'users', idNumber), { email });
}

// How long archived pages are kept before auto-deletion (months). Default 3.
export async function getRetentionMonths(idNumber: string): Promise<number> {
  const snap = await getDoc(doc(db, 'users', idNumber));
  const v = snap.exists() ? snap.data().retentionMonths : undefined;
  return typeof v === 'number' && v > 0 ? v : 3;
}

export async function setRetentionMonths(idNumber: string, months: number): Promise<void> {
  await updateDoc(doc(db, 'users', idNumber), { retentionMonths: months });
}
