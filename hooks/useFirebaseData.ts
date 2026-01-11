import { useEffect } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

interface UseFirebaseDataProps<T> {
  collectionName: string;
  documentId: string;
  localData: T;
  setLocalData: (data: T) => void;
  isEnabled: boolean;
}

export const useFirebaseData = <T,>({
  collectionName,
  documentId,
  localData,
  setLocalData,
  isEnabled
}: UseFirebaseDataProps<T>) => {

  // Subscribe to Firestore changes
  useEffect(() => {
    if (!isEnabled) return;

    const docRef = doc(db, collectionName, documentId);

    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const firebaseData = snapshot.data() as T;
        setLocalData(firebaseData);
      }
    }, (error) => {
      console.error('Error listening to Firestore:', error);
    });

    return () => unsubscribe();
  }, [collectionName, documentId, isEnabled]);

  // Save local data to Firestore
  const saveToFirebase = async () => {
    if (!isEnabled) return;

    try {
      const docRef = doc(db, collectionName, documentId);
      await setDoc(docRef, localData as any, { merge: true });
    } catch (error) {
      console.error('Error saving to Firestore:', error);
    }
  };

  return { saveToFirebase };
};
