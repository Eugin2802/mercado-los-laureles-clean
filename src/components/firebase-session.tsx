import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@clerk/react';
import { getAuth, inMemoryPersistence, setPersistence, signInWithCustomToken, signOut } from 'firebase/auth';
import { getFirebaseToken } from '@api-client';
import { app } from '@/firebase.js';
import { apiErrorMessage } from '@/lib/payment-proof';

const auth = getAuth(app);
let authWork: Promise<unknown> = Promise.resolve();
function serialAuth<T>(work: () => Promise<T>): Promise<T> {
  const result = authWork.catch(() => undefined).then(work);
  authWork = result.catch(() => undefined);
  return result;
}

type Session = { ready: boolean; userId: string | null; error: string; retry: () => void };
const FirebaseSessionContext = createContext<Session>({ ready: false, userId: null, error: '', retry: () => undefined });

export function FirebaseSessionProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId, sessionId, getToken } = useAuth();
  const tokenGetter = useRef(getToken);
  tokenGetter.current = getToken;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<Omit<Session, 'retry'>>({ ready: false, userId: null, error: '' });

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setState({ ready: false, userId: null, error: '' });

    const connect = async () => {
      try {
        await serialAuth(async () => {
          if (disposed) return;
          if (!isLoaded || !isSignedIn || !userId) {
            await signOut(auth);
            return;
          }
          await setPersistence(auth, inMemoryPersistence);
          if (auth.currentUser && auth.currentUser.uid !== userId) await signOut(auth);
          // A fresh Clerk token binds Firebase authorization to the live session.
          const clerkToken = await tokenGetter.current({ skipCache: true });
          if (disposed) return;
          if (!clerkToken) throw new Error('Vuelve a ingresar a tu cuenta para conectar con los pedidos.');
          const credential = await getFirebaseToken({ headers: { Authorization: `Bearer ${clerkToken}` }, signal: AbortSignal.timeout(15_000) });
          if (disposed) return;
          await signInWithCustomToken(auth, credential.token);
          if (disposed) return;
          if (auth.currentUser?.uid !== userId) throw new Error('No pudimos verificar tu identidad para acceder a los pedidos.');
          const remaining = credential.expiresAt * 1000 - Date.now();
          if (remaining <= 0) throw new Error('La autorización de pedidos expiró. Vuelve a conectarte.');
          setState({ ready: true, userId, error: '' });
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => { void connect(); }, Math.max(1000, Math.min(40_000, remaining - 15_000)));
        });
      } catch (cause) {
        if (disposed) return;
        const code = cause && typeof cause === 'object' && 'code' in cause ? String(cause.code) : '';
        const error = code.startsWith('auth/')
          ? 'Firebase Authentication no permitió conectar tu sesión. Revisa que esté habilitado para este proyecto.'
          : apiErrorMessage(cause, 'No pudimos conectar con Firestore. Comprueba la configuración de Firebase y tus permisos.');
        setState({ ready: false, userId: userId ?? null, error });
        timer = setTimeout(() => { void connect(); }, 15_000);
      }
    };

    const resume = () => { if (document.visibilityState === 'visible') void connect(); };
    document.addEventListener('visibilitychange', resume);
    void connect();
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', resume);
      // Enqueue logout after any in-flight sign-in, including Clerk session changes.
      void serialAuth(() => signOut(auth));
    };
  }, [isLoaded, isSignedIn, userId, sessionId, attempt]);

  const current = state.userId === userId ? state : { ready: false, userId: userId ?? null, error: '' };
  return <FirebaseSessionContext.Provider value={{ ...current, retry: () => setAttempt(value => value + 1) }}>{children}</FirebaseSessionContext.Provider>;
}

export const useFirebaseSession = () => useContext(FirebaseSessionContext);