import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { AppUser, ADMIN_EMAIL, DEFAULT_PERMISSIONS } from '../types/user';

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
            displayName: 'Admin',
            role: 'admin',
            permissions: {
              allowedHospitals: [], // Tüm hastaneler
              modules: {
                efficiencyAnalysis: true,
                capacityAnalysis: true,
                presentation: true,
                reports: true,
              },
            },
            createdAt: new Date().toISOString(),
            createdBy: 'system',
          });
          setLoading(false);
          return;
        }

        // Diğer kullanıcılar için Firestore'dan izinleri çek
        const usersSnapshot = await getDoc(doc(db, 'users', userEmail));

        if (usersSnapshot.exists()) {
          setUserPermissions(usersSnapshot.data() as AppUser);
        } else {
          // Kullanıcı kaydı yoksa varsayılan izinler
          setUserPermissions({
            uid: userEmail,
            email: userEmail,
            displayName: userEmail.split('@')[0],
            role: 'user',
            permissions: DEFAULT_PERMISSIONS,
            createdAt: new Date().toISOString(),
            createdBy: 'system',
          });
        }
      } catch (error) {
        console.error('Kullanıcı izinleri yüklenemedi:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserPermissions();
  }, [userEmail]);

  const hasModuleAccess = (module: keyof AppUser['permissions']['modules']): boolean => {
    if (!userPermissions) return false;
    if (userPermissions.role === 'admin') return true;
    return userPermissions.permissions.modules[module];
  };

  const hasHospitalAccess = (hospital: string): boolean => {
    if (!userPermissions) return false;
    if (userPermissions.role === 'admin') return true;
    if (userPermissions.permissions.allowedHospitals.length === 0) return true;
    return userPermissions.permissions.allowedHospitals.includes(hospital);
  };

  const isAdmin = userPermissions?.role === 'admin';

  return {
    userPermissions,
    loading,
    hasModuleAccess,
    hasHospitalAccess,
    isAdmin,
  };
};
