import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import type { InstitutionMarker } from '../data/sanliurfaDistricts';

const DOC_PATH = 'appData';
const DOC_ID = 'mapInstitutions';

interface MapInstitutionsDoc {
  markers: InstitutionMarker[];
  lastUpdated: string;
  updatedBy: string;
}

export async function loadInstitutions(): Promise<InstitutionMarker[]> {
  try {
    const snap = await getDoc(doc(db, DOC_PATH, DOC_ID));
    if (snap.exists()) {
      const data = snap.data() as MapInstitutionsDoc;
      return data.markers || [];
    }
    return [];
  } catch (err) {
    console.error('Pin verileri yuklenemedi:', err);
    return [];
  }
}

export async function saveInstitutions(
  markers: InstitutionMarker[],
  updatedBy: string,
): Promise<void> {
  const payload: MapInstitutionsDoc = {
    markers,
    lastUpdated: new Date().toISOString(),
    updatedBy,
  };
  await setDoc(doc(db, DOC_PATH, DOC_ID), payload);
}
