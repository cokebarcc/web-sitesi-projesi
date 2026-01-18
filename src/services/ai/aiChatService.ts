// AI Chat Service - Firestore Persistence
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../../../firebase';
import { AIChat, AIMessage, AIFeedback } from '../../types/ai';

const CHATS_COLLECTION = 'aiChats';
const MESSAGES_SUBCOLLECTION = 'messages';

// ==================== Chat Operations ====================

/**
 * Yeni chat oluştur
 */
export const createChat = async (
  userId: string,
  hospitalId: string,
  initialTitle?: string
): Promise<string> => {
  const chatData = {
    userId,
    hospitalId,
    title: initialTitle || 'Yeni Sohbet',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    status: 'active',
    messageCount: 0
  };

  const docRef = await addDoc(collection(db, CHATS_COLLECTION), chatData);
  return docRef.id;
};

/**
 * Chat bilgilerini getir
 */
export const getChat = async (chatId: string): Promise<AIChat | null> => {
  const docRef = doc(db, CHATS_COLLECTION, chatId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  const data = docSnap.data();
  return {
    id: docSnap.id,
    userId: data.userId,
    hospitalId: data.hospitalId,
    title: data.title,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
    status: data.status,
    messageCount: data.messageCount || 0
  };
};

/**
 * Kullanıcının chat listesini getir
 */
export const getUserChats = async (
  userId: string,
  hospitalId?: string,
  limitCount: number = 20
): Promise<AIChat[]> => {
  const constraints = [
    where('userId', '==', userId),
    where('status', '==', 'active'),
    orderBy('updatedAt', 'desc'),
    limit(limitCount)
  ];

  if (hospitalId) {
    constraints.splice(1, 0, where('hospitalId', '==', hospitalId));
  }

  const q = query(collection(db, CHATS_COLLECTION), ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      userId: data.userId,
      hospitalId: data.hospitalId,
      title: data.title,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      status: data.status,
      messageCount: data.messageCount || 0
    };
  });
};

/**
 * Chat başlığını güncelle
 */
export const updateChatTitle = async (chatId: string, title: string): Promise<void> => {
  const docRef = doc(db, CHATS_COLLECTION, chatId);
  await updateDoc(docRef, {
    title,
    updatedAt: Timestamp.now()
  });
};

/**
 * Chat'i arşivle (soft delete)
 */
export const archiveChat = async (chatId: string): Promise<void> => {
  const docRef = doc(db, CHATS_COLLECTION, chatId);
  await updateDoc(docRef, {
    status: 'archived',
    updatedAt: Timestamp.now()
  });
};

/**
 * Chat'i tamamen sil
 */
export const deleteChat = async (chatId: string): Promise<void> => {
  // Önce mesajları sil
  const messagesRef = collection(db, CHATS_COLLECTION, chatId, MESSAGES_SUBCOLLECTION);
  const messagesSnap = await getDocs(messagesRef);

  const deletePromises = messagesSnap.docs.map(doc => deleteDoc(doc.ref));
  await Promise.all(deletePromises);

  // Sonra chat'i sil
  await deleteDoc(doc(db, CHATS_COLLECTION, chatId));
};

// ==================== Message Operations ====================

/**
 * Mesaj ekle
 */
export const addMessage = async (
  chatId: string,
  message: Omit<AIMessage, 'id'>
): Promise<string> => {
  const messagesRef = collection(db, CHATS_COLLECTION, chatId, MESSAGES_SUBCOLLECTION);

  const messageData = {
    ...message,
    timestamp: Timestamp.fromDate(message.timestamp)
  };

  const docRef = await addDoc(messagesRef, messageData);

  // Chat'in updatedAt ve messageCount güncelle
  const chatRef = doc(db, CHATS_COLLECTION, chatId);
  const chatSnap = await getDoc(chatRef);

  if (chatSnap.exists()) {
    await updateDoc(chatRef, {
      updatedAt: Timestamp.now(),
      messageCount: (chatSnap.data().messageCount || 0) + 1
    });
  }

  return docRef.id;
};

/**
 * Chat mesajlarını getir
 */
export const getChatMessages = async (
  chatId: string,
  limitCount: number = 100
): Promise<AIMessage[]> => {
  const messagesRef = collection(db, CHATS_COLLECTION, chatId, MESSAGES_SUBCOLLECTION);
  const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(limitCount));
  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      role: data.role,
      content: data.content,
      timestamp: data.timestamp?.toDate() || new Date(),
      toolCalls: data.toolCalls,
      feedback: data.feedback
    };
  });
};

/**
 * Mesajları real-time dinle
 */
export const subscribeToMessages = (
  chatId: string,
  callback: (messages: AIMessage[]) => void
): (() => void) => {
  const messagesRef = collection(db, CHATS_COLLECTION, chatId, MESSAGES_SUBCOLLECTION);
  const q = query(messagesRef, orderBy('timestamp', 'asc'));

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        role: data.role,
        content: data.content,
        timestamp: data.timestamp?.toDate() || new Date(),
        toolCalls: data.toolCalls,
        feedback: data.feedback
      };
    });
    callback(messages);
  });
};

/**
 * Mesaja feedback ekle
 */
export const addMessageFeedback = async (
  chatId: string,
  messageId: string,
  feedback: AIFeedback
): Promise<void> => {
  const messageRef = doc(db, CHATS_COLLECTION, chatId, MESSAGES_SUBCOLLECTION, messageId);
  await updateDoc(messageRef, {
    feedback: {
      ...feedback,
      submittedAt: Timestamp.now()
    }
  });
};

// ==================== Title Generation ====================

/**
 * İlk mesajdan chat başlığı oluştur
 */
export const generateChatTitle = (firstMessage: string): string => {
  // İlk 50 karakteri al ve temizle
  let title = firstMessage.trim();

  // Çok uzunsa kısalt
  if (title.length > 50) {
    title = title.substring(0, 47) + '...';
  }

  // Satır sonlarını kaldır
  title = title.replace(/\n/g, ' ');

  return title || 'Yeni Sohbet';
};

// ==================== Statistics ====================

/**
 * Kullanıcının chat istatistiklerini getir
 */
export const getChatStats = async (userId: string, hospitalId?: string): Promise<{
  totalChats: number;
  totalMessages: number;
  lastActivity: Date | null;
}> => {
  const chats = await getUserChats(userId, hospitalId, 1000);

  let totalMessages = 0;
  let lastActivity: Date | null = null;

  chats.forEach(chat => {
    totalMessages += chat.messageCount;
    if (!lastActivity || chat.updatedAt > lastActivity) {
      lastActivity = chat.updatedAt;
    }
  });

  return {
    totalChats: chats.length,
    totalMessages,
    lastActivity
  };
};
