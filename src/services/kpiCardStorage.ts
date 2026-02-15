import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';

const DOC_PATH = 'appData';
const DOC_ID = 'kpiCards';

/** Kullanılabilir ikon isimleri */
export type KpiIconName =
  | 'calendar'
  | 'users'
  | 'hospital'
  | 'chart'
  | 'heart'
  | 'clipboard'
  | 'clock'
  | 'star'
  | 'shield'
  | 'activity'
  | 'truck'
  | 'phone'
  | 'document'
  | 'home';

export interface KpiCardData {
  id: string;
  title: string;
  value: string;
  subtitle: string;
  icon: KpiIconName;
  order: number;
}

interface KpiCardsDoc {
  cards: KpiCardData[];
  lastUpdated: string;
  updatedBy: string;
}

/** Varsayılan kartlar */
export const DEFAULT_KPI_CARDS: KpiCardData[] = [
  {
    id: 'kpi-1',
    title: 'Aktif Randevu',
    value: '4.832',
    subtitle: 'Bu hafta',
    icon: 'calendar',
    order: 0,
  },
  {
    id: 'kpi-2',
    title: 'Aktif Talep',
    value: '—',
    subtitle: 'Veri bekleniyor',
    icon: 'activity',
    order: 1,
  },
];

/** Firestore'dan KPI kartlarını yükle */
export async function loadKpiCards(): Promise<KpiCardData[]> {
  try {
    const snap = await getDoc(doc(db, DOC_PATH, DOC_ID));
    if (snap.exists()) {
      const data = snap.data() as KpiCardsDoc;
      return data.cards && data.cards.length > 0
        ? data.cards.sort((a, b) => a.order - b.order)
        : DEFAULT_KPI_CARDS;
    }
    return DEFAULT_KPI_CARDS;
  } catch (err) {
    console.error('KPI kartları yüklenemedi:', err);
    return DEFAULT_KPI_CARDS;
  }
}

/** KPI kartlarını Firestore'a kaydet */
export async function saveKpiCards(
  cards: KpiCardData[],
  updatedBy: string,
): Promise<void> {
  const payload: KpiCardsDoc = {
    cards,
    lastUpdated: new Date().toISOString(),
    updatedBy,
  };
  await setDoc(doc(db, DOC_PATH, DOC_ID), payload);
}

/** Realtime listener */
export function subscribeKpiCards(
  callback: (cards: KpiCardData[]) => void,
): () => void {
  return onSnapshot(doc(db, DOC_PATH, DOC_ID), (snap) => {
    if (snap.exists()) {
      const data = snap.data() as KpiCardsDoc;
      callback(data.cards && data.cards.length > 0
        ? data.cards.sort((a, b) => a.order - b.order)
        : DEFAULT_KPI_CARDS);
    } else {
      callback(DEFAULT_KPI_CARDS);
    }
  });
}
