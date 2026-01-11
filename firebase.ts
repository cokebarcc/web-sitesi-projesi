import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBnP_A2Ubvmi8y6vkcrUpdn5oDSOEwWqWY",
  authDomain: "mhrs-analiz.firebaseapp.com",
  projectId: "mhrs-analiz",
  storageBucket: "mhrs-analiz.firebasestorage.app",
  messagingSenderId: "719575328088",
  appId: "1:719575328088:web:bff7a5a795dbeb0c7bb12d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Initialize Cloud Firestore
export const db = getFirestore(app);

export default app;
