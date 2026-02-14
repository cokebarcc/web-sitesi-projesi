import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, db } from '../../../firebase';
import { AppUser, UserPermissions, DEFAULT_PERMISSIONS, ADMIN_EMAIL, KurumCategory } from '../../types/user';
import AdminKurumSelector from './AdminKurumSelector';
import AdminKPICards from './AdminKPICards';
import AdminUserTable from './AdminUserTable';
import AdminSlidePanel from './AdminSlidePanel';
import AdminPanelTabs, { AdminTab } from './AdminPanelTabs';
import AdminModulePermissions from './AdminModulePermissions';
import AdminHospitalSelector from './AdminHospitalSelector';
import AdminToast from './AdminToast';
import AdminConfirmDialog from './AdminConfirmDialog';
import './admin-premium.css';

interface AdminPanelProps {
  currentUserEmail: string;
  onNavigate?: (view: string) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ currentUserEmail, onNavigate }) => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [showSlidePanel, setShowSlidePanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<AdminTab>('info');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedHospitals, setSelectedHospitals] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS);
  const [kurumCategory, setKurumCategory] = useState<KurumCategory | ''>('');
  const [kurumName, setKurumName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Notification & Confirm
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    variant: 'danger' | 'warning' | 'info';
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  const isAdmin = currentUserEmail === ADMIN_EMAIL;

  const showNotification = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  // ============ DATA LOADING ============

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      const usersData = snapshot.docs.map(d => ({
        uid: d.id,
        ...d.data()
      } as AppUser));

      usersData.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      setUsers(usersData);
    } catch (err) {
      console.error('Kullanicilar yuklenemedi:', err);
      showNotification('error', 'Kullanicilar yuklenemedi: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // ============ COMPUTED ============

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(u =>
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  const kpiData = useMemo(() => ({
    total: users.length,
    admins: users.filter(u => u.role === 'admin').length,
    recentCount: users.filter(u => {
      if (!u.createdAt) return false;
      const d = new Date(u.createdAt);
      return (Date.now() - d.getTime()) < 7 * 24 * 60 * 60 * 1000;
    }).length,
    unrestrictedCount: users.filter(u => u.permissions.allowedHospitals.length === 0).length,
  }), [users]);

  // ============ FORM HELPERS ============

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setDisplayName('');
    setSelectedHospitals([]);
    setPermissions(DEFAULT_PERMISSIONS);
    setKurumCategory('');
    setKurumName('');
    setActiveTab('info');
  };

  const startEdit = (user: AppUser) => {
    setEditingUser(user);
    setEmail(user.email);
    setDisplayName(user.displayName);
    setSelectedHospitals(user.permissions.allowedHospitals || []);
    // Merge with defaults to handle missing keys from old Firestore data
    setPermissions({
      ...DEFAULT_PERMISSIONS,
      ...user.permissions,
      modules: { ...DEFAULT_PERMISSIONS.modules, ...user.permissions.modules },
      canUpload: { ...DEFAULT_PERMISSIONS.canUpload, ...user.permissions.canUpload },
    });
    setKurumCategory(user.kurum?.category || '');
    setKurumName(user.kurum?.name || '');
    setActiveTab('info');
    setShowSlidePanel(true);
  };

  const handleClosePanel = () => {
    setShowSlidePanel(false);
    setEditingUser(null);
    resetForm();
  };

  const openNewUserPanel = () => {
    setEditingUser(null);
    resetForm();
    setShowSlidePanel(true);
  };

  // ============ CRUD OPERATIONS ============

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;

      const userData: AppUser = {
        uid: newUser.uid,
        email: email,
        displayName: displayName,
        role: 'user',
        permissions: {
          ...permissions,
          allowedHospitals: selectedHospitals,
        },
        ...(kurumCategory ? {
          kurum: {
            category: kurumCategory as KurumCategory,
            ...(kurumName ? { name: kurumName } : {}),
          },
        } : {}),
        createdAt: new Date().toISOString(),
        createdBy: currentUserEmail,
      };

      await setDoc(doc(db, 'users', newUser.uid), userData);

      showNotification('success', 'Kullanici basariyla olusturuldu!');
      handleClosePanel();
      loadUsers();
    } catch (err: any) {
      console.error('Kullanici olusturma hatasi:', err);

      if (err.code === 'auth/email-already-in-use') {
        setConfirmDialog({
          title: 'Kullaniciyi Yeniden Etkinlestir',
          message: 'Bu e-posta adresi Firebase Authentication\'da zaten mevcut.\n\nBu kullanici daha once silinmis olabilir (sadece Firestore\'dan).\n\nKullaniciyi girdiginiz sifre ile yeniden etkinlestirmek ister misiniz?',
          variant: 'warning',
          confirmLabel: 'Yeniden Etkinlestir',
          onConfirm: async () => {
            setConfirmDialog(null);
            try {
              const userCredential = await signInWithEmailAndPassword(auth, email, password);
              const existingUser = userCredential.user;

              const userData: AppUser = {
                uid: existingUser.uid,
                email: email,
                displayName: displayName,
                role: 'user',
                permissions: {
                  ...permissions,
                  allowedHospitals: selectedHospitals,
                },
                ...(kurumCategory ? {
                  kurum: {
                    category: kurumCategory as KurumCategory,
                    ...(kurumName ? { name: kurumName } : {}),
                  },
                } : {}),
                createdAt: new Date().toISOString(),
                createdBy: currentUserEmail,
              };

              await setDoc(doc(db, 'users', existingUser.uid), userData);
              await signOut(auth);

              showNotification('success', 'Kullanici basariyla yeniden etkinlestirildi! Lutfen tekrar giris yapin.');
              handleClosePanel();
              loadUsers();

              setTimeout(() => window.location.reload(), 1500);
            } catch (reactivateErr: any) {
              console.error('Yeniden etkinlestirme hatasi:', reactivateErr);
              if (reactivateErr.code === 'auth/wrong-password' || reactivateErr.code === 'auth/invalid-credential') {
                showNotification('error', 'Sifre hatali! Firebase Auth\'daki mevcut sifre ile eslesmedi.');
              } else {
                showNotification('error', 'Yeniden etkinlestirme basarisiz: ' + reactivateErr.message);
              }
            }
          },
        });
      } else if (err.code === 'auth/invalid-email') {
        showNotification('error', 'Gecersiz e-posta adresi!');
      } else if (err.code === 'auth/weak-password') {
        showNotification('error', 'Sifre en az 6 karakter olmalidir!');
      } else if (err.code === 'auth/operation-not-allowed') {
        showNotification('error', 'E-posta/sifre girisi etkin degil. Firebase konsolunda etkinlestirin.');
      } else {
        showNotification('error', err.message || 'Kullanici olusturulamadi');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsSubmitting(true);

    try {
      // Build clean permissions with only known keys
      const cleanPermissions: UserPermissions = {
        allowedHospitals: selectedHospitals,
        modules: { ...DEFAULT_PERMISSIONS.modules },
        canUpload: { ...DEFAULT_PERMISSIONS.canUpload },
      };
      // Copy only known module keys from current form state
      for (const key of Object.keys(DEFAULT_PERMISSIONS.modules) as (keyof typeof DEFAULT_PERMISSIONS.modules)[]) {
        cleanPermissions.modules[key] = permissions.modules[key] ?? false;
      }
      // Copy only known canUpload keys
      if (DEFAULT_PERMISSIONS.canUpload) {
        for (const key of Object.keys(DEFAULT_PERMISSIONS.canUpload) as (keyof NonNullable<typeof DEFAULT_PERMISSIONS.canUpload>)[]) {
          cleanPermissions.canUpload![key] = permissions.canUpload?.[key] ?? false;
        }
      }

      const userData: AppUser = {
        uid: editingUser.uid,
        email: editingUser.email,
        displayName: displayName,
        role: editingUser.role,
        permissions: cleanPermissions,
        ...(kurumCategory ? {
          kurum: {
            category: kurumCategory as KurumCategory,
            ...(kurumName ? { name: kurumName } : {}),
          },
        } : {}),
        createdAt: editingUser.createdAt,
        createdBy: editingUser.createdBy,
      };

      // Full overwrite (no merge) to remove stale keys from Firestore
      await setDoc(doc(db, 'users', editingUser.uid), userData);

      showNotification('success', 'Kullanici basariyla guncellendi!');
      handleClosePanel();
      loadUsers();
    } catch (err: any) {
      console.error('Guncelleme hatasi:', err);
      showNotification('error', err.message || 'Kullanici guncellenemedi');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = (userId: string) => {
    setConfirmDialog({
      title: 'Kullaniciyi Sil',
      message: 'Bu kullaniciyi silmek istediginizden emin misiniz?\n\nNOT: Bu islem sadece Firestore kaydini siler. Firebase Authentication\'daki kullanici kalir.\nAyni email ile tekrar kayit icin Firebase Console\'dan manuel silme gerekebilir.',
      variant: 'danger',
      confirmLabel: 'Sil',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await deleteDoc(doc(db, 'users', userId));
          showNotification('success', 'Kullanici Firestore\'dan silindi!');
          loadUsers();
        } catch (err: any) {
          showNotification('error', err.message || 'Kullanici silinemedi');
        }
      },
    });
  };

  const handleResetPassword = (userEmail: string) => {
    setConfirmDialog({
      title: 'Sifre Sifirlama',
      message: `${userEmail} adresine sifre sifirlama linki gonderilsin mi?`,
      variant: 'info',
      confirmLabel: 'Gonder',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await sendPasswordResetEmail(auth, userEmail);
          showNotification('success', `Sifre sifirlama linki ${userEmail} adresine gonderildi!`);
        } catch (err: any) {
          showNotification('error', err.message || 'Sifre sifirlama linki gonderilemedi');
        }
      },
    });
  };

  const handleClearPhysicianData = () => {
    setConfirmDialog({
      title: 'Hekim Verilerini Temizle',
      message: 'UYARI: Tum hekim muayene ve ameliyat verileri silinecek! Bu islem geri alinamaz.\n\nDevam etmek istiyor musunuz?',
      variant: 'danger',
      confirmLabel: 'Temizle',
      onConfirm: () => {
        setConfirmDialog(null);
        // Second confirmation
        setConfirmDialog({
          title: 'Son Onay',
          message: 'Son kez soruyorum: Firestore\'daki TUM hekim verilerini silmek istediginize emin misiniz?',
          variant: 'danger',
          confirmLabel: 'Evet, Sil',
          onConfirm: async () => {
            setConfirmDialog(null);
            try {
              showNotification('info', 'Hekim verileri temizleniyor...');

              const dataRef = doc(db, 'appData', 'mainData');
              await setDoc(dataRef, {
                muayeneByPeriod: {},
                ameliyatByPeriod: {},
                muayeneMetaByPeriod: {},
                ameliyatMetaByPeriod: {},
                lastUpdated: new Date().toISOString()
              }, { merge: true });

              showNotification('success', 'Tum hekim verileri basariyla temizlendi! Sayfayi yenileyin.');
            } catch (err: any) {
              showNotification('error', 'Temizleme hatasi: ' + (err.message || 'Bilinmeyen hata'));
            }
          },
        });
      },
    });
  };

  // ============ RENDER ============

  if (!isAdmin) {
    return (
      <div className="admin-module">
        <div className="a-access-denied">
          <div className="a-access-denied-icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h2>Erisim Reddedildi</h2>
          <p>Bu sayfaya erisim yetkiniz bulunmamaktadir.</p>
        </div>
      </div>
    );
  }

  const handleFormSubmit = editingUser ? handleUpdateUser : handleAddUser;

  return (
    <div className="admin-module">
      {/* Toast */}
      <AdminToast notification={notification} onDismiss={() => setNotification(null)} />

      {/* Confirm Dialog */}
      {confirmDialog && (
        <AdminConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          variant={confirmDialog.variant}
          confirmLabel={confirmDialog.confirmLabel}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {/* Header */}
      <div className="a-header">
        <div className="a-header-content">
          <div>
            <h1>Kullanici Yonetimi</h1>
            <div className="a-header-subtitle">Kullanicilari yonetin, izinleri duzenleyin</div>
          </div>
          <div className="a-header-actions">
            <button className="a-btn a-btn-primary" onClick={openNewUserPanel}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Yeni Kullanici
            </button>
            {onNavigate && (
              <button className="a-btn a-btn-cyan" onClick={() => onNavigate('session-management')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                </svg>
                Oturum Yonetimi
              </button>
            )}
            <button className="a-btn a-btn-danger" onClick={handleClearPhysicianData}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              Hekim Verilerini Temizle
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <AdminKPICards data={kpiData} loading={loading} />

      {/* User Table */}
      <AdminUserTable
        users={filteredUsers}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onEdit={startEdit}
        onDelete={handleDeleteUser}
        onResetPassword={handleResetPassword}
        loading={loading}
      />

      {/* Slide Panel */}
      {showSlidePanel && (
        <AdminSlidePanel
          title={editingUser ? 'Kullaniciyi Duzenle' : 'Yeni Kullanici Ekle'}
          onClose={handleClosePanel}
          footer={
            <>
              <button
                className="a-btn a-btn-secondary"
                onClick={handleClosePanel}
                disabled={isSubmitting}
              >
                Iptal
              </button>
              <button
                className="a-btn a-btn-primary"
                onClick={(e) => handleFormSubmit(e as any)}
                disabled={isSubmitting || (!editingUser && (!email || !password || !displayName)) || (!!editingUser && !displayName)}
              >
                {isSubmitting ? 'Isleniyor...' : (editingUser ? 'Guncelle' : 'Olustur')}
              </button>
            </>
          }
        >
          <AdminPanelTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            isEditing={!!editingUser}
          />
          <div className="a-slide-body">
            {/* Tab: Basic Info */}
            {activeTab === 'info' && (
              <form onSubmit={handleFormSubmit}>
                <div className="a-form-group">
                  <label className="a-form-label">E-POSTA</label>
                  <input
                    type="email"
                    className="a-form-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={!!editingUser}
                    required
                    placeholder="ornek@email.com"
                  />
                  {editingUser && (
                    <div className="a-form-hint">E-posta adresi degistirilemez</div>
                  )}
                </div>

                {!editingUser && (
                  <div className="a-form-group">
                    <label className="a-form-label">SIFRE</label>
                    <input
                      type="password"
                      className="a-form-input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={6}
                      required
                      placeholder="En az 6 karakter"
                    />
                  </div>
                )}

                <div className="a-form-group">
                  <label className="a-form-label">AD SOYAD</label>
                  <input
                    type="text"
                    className="a-form-input"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    placeholder="Kullanici adi"
                  />
                </div>

                <AdminKurumSelector
                  category={kurumCategory}
                  name={kurumName}
                  onCategoryChange={(cat) => {
                    setKurumCategory(cat);
                    setKurumName('');
                  }}
                  onNameChange={setKurumName}
                />
              </form>
            )}

            {/* Tab: Module Permissions */}
            {activeTab === 'modules' && (
              <AdminModulePermissions
                permissions={permissions}
                onChange={setPermissions}
              />
            )}

            {/* Tab: Hospital Access */}
            {activeTab === 'hospitals' && (
              <AdminHospitalSelector
                selectedHospitals={selectedHospitals}
                onChange={setSelectedHospitals}
              />
            )}
          </div>
        </AdminSlidePanel>
      )}
    </div>
  );
};

export default AdminPanel;
