import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { AppUser, ADMIN_EMAIL, UserPermissions } from '../types/user';

// Varsayılan olarak hiçbir modüle erişim YOK - güvenlik için
const NO_PERMISSIONS: UserPermissions = {
  allowedHospitals: [],
  modules: {
    detailedSchedule: false,
    physicianData: false,
    changeAnalysis: false,
    efficiencyAnalysis: false,
    serviceAnalysis: false,
    aiChatbot: false,
    gorenBashekimlik: false,
    analysisModule: false,
    schedulePlanning: false,
    performancePlanning: false,
    presentation: false,
    emergencyService: false,
    activeDemand: false,
    etikKurul: false,
    hekimIslemListesi: false,
    ekListeTanimlama: false,
    sutMevzuati: false,
    gil: false,
  },
  canUpload: {
    detailedSchedule: false,
    physicianData: false,
    emergencyService: false,
    activeDemand: false,
  },
};

export const useUserPermissions = (userEmail: string | null) => {
  const [userPermissions, setUserPermissions] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserPermissions = async () => {
      if (!userEmail) {
        setUserPermissions(null);
        setLoading(false);
        return;
      }

      try {
        // Admin için özel izinler
        if (userEmail === ADMIN_EMAIL) {
          setUserPermissions({
            uid: 'admin',
            email: userEmail,
            displayName: 'Yakup Çağlın',
            role: 'admin',
            permissions: {
              allowedHospitals: [], // Tüm hastaneler
              modules: {
                detailedSchedule: true,
                physicianData: true,
                changeAnalysis: true,
                efficiencyAnalysis: true,
                serviceAnalysis: true,
                aiChatbot: true,
                gorenBashekimlik: true,
                analysisModule: true,
                schedulePlanning: true,
                performancePlanning: true,
                presentation: true,
                emergencyService: true,
                activeDemand: true,
                etikKurul: true,
                hekimIslemListesi: true,
                ekListeTanimlama: true,
                sutMevzuati: true,
                gil: true,
              },
              canUpload: {
                detailedSchedule: true,
                physicianData: true,
                emergencyService: true,
                activeDemand: true,
              },
            },
            createdAt: new Date().toISOString(),
            createdBy: 'system',
          });
          setLoading(false);
          return;
        }

        // Diğer kullanıcılar için Firestore'dan izinleri çek (email ile query)
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', userEmail));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const userData = querySnapshot.docs[0].data() as AppUser;
          console.log('✅ Kullanıcı izinleri yüklendi:', userData);
          setUserPermissions(userData);
        } else {
          // Kullanıcı kaydı yoksa - HİÇBİR modüle erişim yok
          console.warn('⚠️ Kullanıcı kaydı bulunamadı, erişim engellendi:', userEmail);
          setUserPermissions({
            uid: userEmail,
            email: userEmail,
            displayName: userEmail.split('@')[0],
            role: 'user',
            permissions: NO_PERMISSIONS,
            createdAt: new Date().toISOString(),
            createdBy: 'system',
          });
        }
      } catch (error) {
        console.error('Kullanıcı izinleri yüklenemedi:', error);
        // Hata durumunda erişim engelle
        setUserPermissions({
          uid: userEmail,
          email: userEmail,
          displayName: userEmail.split('@')[0],
          role: 'user',
          permissions: NO_PERMISSIONS,
          createdAt: new Date().toISOString(),
          createdBy: 'system',
        });
      } finally {
        setLoading(false);
      }
    };

    loadUserPermissions();
  }, [userEmail]);

  const hasModuleAccess = (module: string): boolean => {
    if (!userPermissions) return false;
    if (userPermissions.role === 'admin') return true;

    // Modülün izin listesinde olup olmadığını kontrol et
    const modules = userPermissions.permissions?.modules;
    if (!modules) return false;

    // Modül adı geçerli mi kontrol et
    if (!(module in modules)) {
      console.warn(`⚠️ Bilinmeyen modül: ${module}`);
      return false;
    }

    return modules[module as keyof typeof modules] === true;
  };

  const hasHospitalAccess = (hospital: string): boolean => {
    if (!userPermissions) return false;
    if (userPermissions.role === 'admin') return true;
    if (userPermissions.permissions.allowedHospitals.length === 0) return true;
    return userPermissions.permissions.allowedHospitals.includes(hospital);
  };

  const canUploadData = (module: string): boolean => {
    if (!userPermissions) return false;
    if (userPermissions.role === 'admin') return true;

    const canUpload = userPermissions.permissions?.canUpload;
    if (!canUpload) return false;

    if (!(module in canUpload)) {
      return false;
    }

    return canUpload[module as keyof typeof canUpload] === true;
  };

  const isAdmin = userPermissions?.role === 'admin';

  return {
    userPermissions,
    loading,
    hasModuleAccess,
    hasHospitalAccess,
    canUploadData,
    isAdmin,
  };
};
