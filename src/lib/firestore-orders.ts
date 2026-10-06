import { collection, doc, getDocFromServer, onSnapshot, or, query, setDoc, where } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import type { Order } from '@api-client';
import { db } from '@/firebase.js';
import { useFirebaseSession } from '@/components/firebase-session';

/** Save only the complete, server-approved order, never client-calculated prices or identities. */
export async function saveValidatedOrder(order: Order): Promise<Order> {
  const reference = doc(db, 'pedidos', String(order.id));
  try {
    await withTimeout(setDoc(reference, order), 15_000);
    return order;
  } catch (cause) {
    // A seller may have advanced the order while checkout was finishing. Never overwrite it.
    const latest = await withTimeout(getDocFromServer(reference), 5000).catch(() => null);
    if (latest?.exists()) {
      const saved = latest.data() as Order;
      if (saved.id === order.id && saved.buyerId === order.buyerId && saved.sellerId === order.sellerId) return saved;
    }
    throw cause;
  }
}

async function withTimeout<T>(operation: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Firestore no respondió a tiempo.')), milliseconds);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

type OrdersState = { ownerId: string | null; data: Order[]; isLoading: boolean; isError: boolean; error: string };
const initial = (ownerId: string | null): OrdersState => ({ ownerId, data: [], isLoading: true, isError: false, error: '' });

export function useFirestoreOrders() {
  const session = useFirebaseSession();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<OrdersState>(() => initial(null));

  useEffect(() => {
    setState(initial(session.userId));
    if (!session.ready || !session.userId) return;
    const ownerId = session.userId;
    let serverReceived = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const timeout = setTimeout(() => {
      if (!serverReceived) setState({ ownerId, data: [], isLoading: false, isError: true, error: 'Firestore no respondió. Comprueba la conexión y los permisos de la colección pedidos.' });
    }, 20_000);
    const mine = query(collection(db, 'pedidos'), or(where('buyerId', '==', ownerId), where('sellerId', '==', ownerId)));
    const stop = onSnapshot(mine, { includeMetadataChanges: true }, snapshot => {
      // An empty cache is not confirmation that there are no orders.
      if (snapshot.metadata.fromCache && !serverReceived) return;
      serverReceived = true;
      clearTimeout(timeout);
      const data = snapshot.docs.map(item => item.data() as Order)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.id - a.id);
      setState({ ownerId, data, isLoading: false, isError: false, error: '' });
    }, () => {
      clearTimeout(timeout);
      setState({ ownerId, data: [], isLoading: false, isError: true, error: 'No pudimos leer tus pedidos en Firestore. Revisa las reglas de acceso y los permisos de Firebase.' });
      retryTimer = setTimeout(() => setAttempt(value => value + 1), 30_000);
    });
    return () => { clearTimeout(timeout); if (retryTimer) clearTimeout(retryTimer); stop(); };
  }, [session.ready, session.userId, attempt]);

  const patch = useCallback((order: Order) => {
    setState(current => current.ownerId !== session.userId ? current : {
      ...current, data: current.data.map(item => item.id === order.id ? order : item),
    });
  }, [session.userId]);
  const current = state.ownerId === session.userId ? state : initial(session.userId);
  return {
    ...current,
    isLoading: !session.error && (!session.ready || current.isLoading),
    isError: Boolean(session.error) || current.isError,
    error: session.error || current.error,
    refetch: () => { if (!session.ready) session.retry(); setAttempt(value => value + 1); },
    patch,
  };
}