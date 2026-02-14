import { collection, doc, setDoc, deleteDoc, getDoc, addDoc, onSnapshot, query, orderBy, limit, Timestamp, getDocs } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../../firebase';

export interface ActiveSession {
  uid: string;
  email: string;
  displayName: string;
  deviceInfo: string;
  browser: string;
  os: string;
  loginAt: Timestamp | null;
  lastActivity: Timestamp | null;
  sessionId: string;
  status: 'online' | 'idle' | 'offline';
}

export interface SessionLog {
  uid: string;
  email: string;
  displayName: string;
  deviceInfo: string;
  browser: string;
  os: string;
  loginAt: Timestamp | null;
  logoutAt: Timestamp | null;
  logoutReason: 'tab_closed' | 'admin_terminated' | 'logout' | 'unknown';
  sessionId: string;
}

const SESSION_STORAGE_KEY = 'medis_session_id';

// Session ID: localStorage'da saklayarak sayfa yenilemelerinde aynı session'ı kullan
function getOrCreateSessionId(): string {
  let sessionId = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  }
  return sessionId;
}

const SESSION_ID = getOrCreateSessionId();

function getDeviceInfo(): { deviceInfo: string; browser: string; os: string } {
  const ua = navigator.userAgent;

  let browser = 'Bilinmeyen';
  if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Safari/')) browser = 'Safari';

  let os = 'Bilinmeyen';
  if (ua.includes('Windows NT 10.0')) os = 'Windows 10/11';
  else if (ua.includes('Windows NT')) os = 'Windows';
  else if (ua.includes('Mac OS X')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  const screen = `${window.screen.width}x${window.screen.height}`;

  return {
    deviceInfo: `${os} - ${browser} (${screen})`,
    browser,
    os,
  };
}

// Oturum kaydını Firestore'a yaz (veya mevcut session'ı güncelle)
export async function registerSession(uid: string, email: string, displayName: string): Promise<() => void> {
  const { deviceInfo, browser, os } = getDeviceInfo();
  const sessionRef = doc(db, 'sessions', SESSION_ID);

  const now = Timestamp.now();

  // Mevcut session var mı kontrol et (sayfa yenileme durumu)
  const existingSession = await getDoc(sessionRef);

  if (existingSession.exists()) {
    // Session zaten var, sadece lastActivity güncelle
    await setDoc(sessionRef, {
      lastActivity: now,
      status: 'online',
      displayName, // Güncel ismi yaz
    }, { merge: true });
  } else {
    // Yeni session oluştur
    const sessionData = {
      uid,
      email,
      displayName,
      deviceInfo,
      browser,
      os,
      loginAt: now,
      lastActivity: now,
      sessionId: SESSION_ID,
      status: 'online' as const,
    };
    await setDoc(sessionRef, sessionData);
  }

  // Heartbeat: Her 30 saniyede lastActivity güncelle
  const heartbeat = setInterval(async () => {
    try {
      await setDoc(sessionRef, { lastActivity: Timestamp.now(), status: 'online' }, { merge: true });
    } catch {
      // Session silinmiş olabilir (admin tarafından kapatılmış)
    }
  }, 30_000);

  // Sayfa kapanırken session'ı offline olarak işaretle (silme - admin görebilsin)
  const handleUnload = () => {
    // Firestore'da status güncelle - beforeunload'da async çalışmayabilir
    setDoc(sessionRef, { status: 'offline', lastActivity: Timestamp.now() }, { merge: true }).catch(() => {});
    // localStorage'daki session ID'yi temizle ki yeni sekme yeni session alsın
    localStorage.removeItem(SESSION_STORAGE_KEY);
  };

  window.addEventListener('beforeunload', handleUnload);

  // Admin tarafından oturum kapatılırsa kullanıcıyı otomatik çıkış yaptır
  // Session doc silindiğinde veya forceLogout flag'i yazıldığında tetiklenir
  let terminated = false;
  const unsubSessionWatch = onSnapshot(sessionRef, (snap) => {
    if (terminated) return;
    if (!snap.exists()) {
      // Session doc silindi → admin terminate etti
      terminated = true;
      clearInterval(heartbeat);
      window.removeEventListener('beforeunload', handleUnload);
      localStorage.removeItem(SESSION_STORAGE_KEY);
      alert('Oturumunuz yönetici tarafından kapatıldı. Giriş sayfasına yönlendiriliyorsunuz.');
      signOut(auth).catch(() => {});
    }
  });

  // Cleanup fonksiyonu döndür (React useEffect cleanup)
  return () => {
    clearInterval(heartbeat);
    window.removeEventListener('beforeunload', handleUnload);
    unsubSessionWatch();
  };
}

// Aktif oturumları dinle (realtime)
export function subscribeToSessions(callback: (sessions: ActiveSession[]) => void): () => void {
  const sessionsRef = collection(db, 'sessions');
  const q = query(sessionsRef);

  return onSnapshot(q, (snapshot) => {
    const sessions: ActiveSession[] = snapshot.docs.map(d => {
      const data = d.data();
      // Status belirleme:
      // - Firestore'da 'offline' olarak işaretlenmişse → offline (kırmızı)
      // - 10 dakikadan fazla heartbeat gelmemişse → offline (kırmızı)
      // - 2-10 dakika arası → idle (sarı)
      // - 2 dakikadan az → online (yeşil)
      let status: 'online' | 'idle' | 'offline' = data.status === 'offline' ? 'offline' : 'online';
      if (status !== 'offline' && data.lastActivity?.toMillis) {
        const diffMs = Date.now() - data.lastActivity.toMillis();
        if (diffMs > 10 * 60 * 1000) {
          status = 'offline';
        } else if (diffMs > 2 * 60 * 1000) {
          status = 'idle';
        }
      }
      return {
        ...data,
        sessionId: d.id,
        status,
      } as ActiveSession;
    });

    // loginAt'e göre sırala (en yeni en üstte)
    sessions.sort((a, b) => {
      const timeA = a.loginAt?.toMillis?.() || 0;
      const timeB = b.loginAt?.toMillis?.() || 0;
      return timeB - timeA;
    });

    callback(sessions);
  });
}

// Geçmiş oturum loglarını getir (son 100)
export function subscribeToSessionLogs(callback: (logs: SessionLog[]) => void): () => void {
  const logsRef = collection(db, 'sessionLogs');
  const q = query(logsRef, orderBy('logoutAt', 'desc'), limit(100));

  return onSnapshot(q, (snapshot) => {
    const logs: SessionLog[] = snapshot.docs.map(d => ({
      ...d.data(),
    } as SessionLog));

    callback(logs);
  });
}

// Admin: Belirli bir oturumu zorla kapat
export async function terminateSession(sessionId: string): Promise<void> {
  const sessionRef = doc(db, 'sessions', sessionId);
  const sessionSnap = await getDoc(sessionRef);

  if (sessionSnap.exists()) {
    const data = sessionSnap.data();
    await addDoc(collection(db, 'sessionLogs'), {
      uid: data.uid || '',
      email: data.email || '',
      displayName: data.displayName || '',
      deviceInfo: data.deviceInfo || '',
      browser: data.browser || '',
      os: data.os || '',
      loginAt: data.loginAt || null,
      logoutAt: Timestamp.now(),
      logoutReason: 'admin_terminated',
      sessionId,
    });
  }

  await deleteDoc(sessionRef);
}

// Mevcut session ID'yi dışa aktar
export function getCurrentSessionId(): string {
  return SESSION_ID;
}

// Admin: Tüm offline oturumları temizle (heartbeat gelmeyen veya offline olarak işaretlenmiş)
export async function cleanupStaleSessions(): Promise<number> {
  const sessionsRef = collection(db, 'sessions');
  const allSessions = await getDocs(query(sessionsRef));
  const tenMinAgo = Date.now() - 10 * 60 * 1000;
  let cleaned = 0;

  for (const sessionDoc of allSessions.docs) {
    const data = sessionDoc.data();
    const lastActivity = data.lastActivity?.toMillis?.() || 0;
    const isOffline = data.status === 'offline' || lastActivity < tenMinAgo;

    if (isOffline) {
      await addDoc(collection(db, 'sessionLogs'), {
        uid: data.uid || '',
        email: data.email || '',
        displayName: data.displayName || '',
        deviceInfo: data.deviceInfo || '',
        browser: data.browser || '',
        os: data.os || '',
        loginAt: data.loginAt || null,
        logoutAt: Timestamp.now(),
        logoutReason: 'tab_closed' as const,
        sessionId: sessionDoc.id,
      });
      await deleteDoc(sessionDoc.ref);
      cleaned++;
    }
  }

  return cleaned;
}
