import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, query, where } from 'firebase/firestore';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, db } from '../../firebase';
import { AppUser, UserPermissions, DEFAULT_PERMISSIONS, ADMIN_EMAIL } from '../types/user';
import { HOSPITALS } from '../../constants';
import './AdminPanel.css';

interface AdminPanelProps {
  currentUserEmail: string;
  onNavigate?: (view: string) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ currentUserEmail, onNavigate }) => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedHospitals, setSelectedHospitals] = useState<string[]>([]);
  const [hospitalSearch, setHospitalSearch] = useState('');
  const [showHospitalDropdown, setShowHospitalDropdown] = useState(false);
  const [permissions, setPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Admin kontrolü
  const isAdmin = currentUserEmail === ADMIN_EMAIL;

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      const usersData = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      } as AppUser));

      // Sort by createdAt if available
      usersData.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      setUsers(usersData);
      console.log('Loaded users:', usersData);
    } catch (err) {
      console.error('Kullanıcılar yüklenemedi:', err);
      setError('Kullanıcılar yüklenemedi: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Filtrelenmiş hastane listesi
  const filteredHospitals = useMemo(() => {
    if (!hospitalSearch) return HOSPITALS;
    return HOSPITALS.filter(h =>
      h.toLowerCase().includes(hospitalSearch.toLowerCase())
    );
  }, [hospitalSearch]);

  const toggleHospital = (hospital: string) => {
    setSelectedHospitals(prev =>
      prev.includes(hospital)
        ? prev.filter(h => h !== hospital)
        : [...prev, hospital]
    );
  };

  const selectAllHospitals = () => {
    setSelectedHospitals([...HOSPITALS]);
  };

  const clearAllHospitals = () => {
    setSelectedHospitals([]);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      // Firebase Authentication'da kullanıcı oluştur
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;

      // Firestore'da kullanıcı bilgilerini kaydet
      const userData: AppUser = {
        uid: newUser.uid,
        email: email,
        displayName: displayName,
        role: 'user',
        permissions: {
          ...permissions,
          allowedHospitals: selectedHospitals,
        },
        createdAt: new Date().toISOString(),
        createdBy: currentUserEmail,
      };

      await setDoc(doc(db, 'users', newUser.uid), userData);

      setSuccess('Kullanıcı başarıyla oluşturuldu!');
      resetForm();
      setShowAddModal(false);
      loadUsers();
    } catch (err: any) {
      console.error('Kullanıcı oluşturma hatası:', err);
      // Daha anlaşılır hata mesajları
      if (err.code === 'auth/email-already-in-use') {
        // Email zaten Firebase Auth'da var - kullanıcıyı yeniden etkinleştirmeyi öner
        const reactivate = window.confirm(
          'Bu e-posta adresi Firebase Authentication\'da zaten mevcut.\n\n' +
          'Bu kullanıcı daha önce silinmiş olabilir (sadece Firestore\'dan).\n\n' +
          'Kullanıcıyı girdiğiniz şifre ile yeniden etkinleştirmek ister misiniz?'
        );

        if (reactivate) {
          try {
            // Mevcut admin oturumunu kaydet
            const currentUser = auth.currentUser;

            // Kullanıcı şifresi ile giriş yapmayı dene
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const existingUser = userCredential.user;

            // Firestore'da kullanıcı kaydını oluştur
            const userData: AppUser = {
              uid: existingUser.uid,
              email: email,
              displayName: displayName,
              role: 'user',
              permissions: {
                ...permissions,
                allowedHospitals: selectedHospitals,
              },
              createdAt: new Date().toISOString(),
              createdBy: currentUserEmail,
            };

            await setDoc(doc(db, 'users', existingUser.uid), userData);

            // Admin oturumunu geri yükle (eğer farklıysa)
            await signOut(auth);

            setSuccess('Kullanıcı başarıyla yeniden etkinleştirildi! Lütfen tekrar giriş yapın.');
            resetForm();
            setShowAddModal(false);
            loadUsers();

            // Sayfayı yenile (admin oturumunu yeniden başlatmak için)
            setTimeout(() => window.location.reload(), 1500);
          } catch (reactivateErr: any) {
            console.error('Yeniden etkinleştirme hatası:', reactivateErr);
            if (reactivateErr.code === 'auth/wrong-password' || reactivateErr.code === 'auth/invalid-credential') {
              setError('Şifre hatalı! Firebase Auth\'daki mevcut şifre ile eşleşmiyor. Firebase Console\'dan kullanıcıyı silin veya doğru şifreyi girin.');
            } else {
              setError('Yeniden etkinleştirme başarısız: ' + reactivateErr.message);
            }
          }
        } else {
          setError('Bu e-posta zaten kullanımda. Firebase Console > Authentication\'dan kullanıcıyı manuel olarak silebilirsiniz.');
        }
      } else if (err.code === 'auth/invalid-email') {
        setError('Geçersiz e-posta adresi!');
      } else if (err.code === 'auth/weak-password') {
        setError('Şifre en az 6 karakter olmalıdır!');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('E-posta/şifre girişi etkin değil. Firebase konsolunda etkinleştirin.');
      } else {
        setError(err.message || 'Kullanıcı oluşturulamadı');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      const userData: Partial<AppUser> = {
        displayName: displayName,
        permissions: {
          ...permissions,
          allowedHospitals: selectedHospitals,
        },
      };

      await setDoc(doc(db, 'users', editingUser.uid), userData, { merge: true });

      setSuccess('Kullanıcı başarıyla güncellendi!');
      setEditingUser(null);
      resetForm();
      setShowAddModal(false);
      loadUsers();
    } catch (err: any) {
      console.error('Güncelleme hatası:', err);
      setError(err.message || 'Kullanıcı güncellenemedi');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const confirmed = window.confirm(
      '⚠️ Bu kullanıcıyı silmek istediğinizden emin misiniz?\n\n' +
      'NOT: Bu işlem sadece Firestore kaydını siler. Firebase Authentication\'daki kullanıcı kalır.\n' +
      'Aynı email ile tekrar kayıt için Firebase Console\'dan manuel silme gerekebilir.'
    );
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, 'users', userId));
      setSuccess('Kullanıcı Firestore\'dan silindi! (Auth kaydı hala mevcut olabilir)');
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'Kullanıcı silinemedi');
    }
  };

  const handleResetPassword = async (email: string) => {
    if (!window.confirm(`${email} adresine şifre sıfırlama linki gönderilsin mi?`)) return;

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess(`Şifre sıfırlama linki ${email} adresine gönderildi!`);
    } catch (err: any) {
      setError(err.message || 'Şifre sıfırlama linki gönderilemedi');
    }
  };

  const handleClearPhysicianData = async () => {
    if (!window.confirm('⚠️ UYARI: Tüm hekim muayene ve ameliyat verileri silinecek! Bu işlem geri alınamaz. Devam etmek istiyor musunuz?')) return;

    if (!window.confirm('Son kez soruyorum: Firestore\'daki TÜM hekim verilerini silmek istediğinize emin misiniz?')) return;

    try {
      setError('');
      setSuccess('Hekim verileri temizleniyor...');

      const dataRef = doc(db, 'appData', 'mainData');

      // Clear physician data fields
      await setDoc(dataRef, {
        muayeneByPeriod: {},
        ameliyatByPeriod: {},
        muayeneMetaByPeriod: {},
        ameliyatMetaByPeriod: {},
        lastUpdated: new Date().toISOString()
      }, { merge: true });

      setSuccess('✅ Tüm hekim verileri başarıyla temizlendi! Sayfayı yenileyin.');
      console.log('✅ Hekim verileri Firestore\'dan temizlendi');
    } catch (err: any) {
      setError('❌ Temizleme hatası: ' + (err.message || 'Bilinmeyen hata'));
      console.error('❌ Temizleme hatası:', err);
    }
  };

  const startEdit = (user: AppUser) => {
    setEditingUser(user);
    setEmail(user.email);
    setDisplayName(user.displayName);
    setSelectedHospitals(user.permissions.allowedHospitals || []);
    setPermissions(user.permissions);
    setShowAddModal(true);
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setDisplayName('');
    setSelectedHospitals([]);
    setHospitalSearch('');
    setShowHospitalDropdown(false);
    setPermissions(DEFAULT_PERMISSIONS);
    setError('');
    setSuccess('');
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingUser(null);
    resetForm();
  };

  if (!isAdmin) {
    return (
      <div className="admin-panel">
        <div className="access-denied">
          <h2>Erişim Reddedildi</h2>
          <p>Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="admin-panel loading">Yükleniyor...</div>;
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1>Kullanıcı Yönetimi</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-add-user" onClick={() => setShowAddModal(true)}>
            + Yeni Kullanıcı Ekle
          </button>
          {onNavigate && (
            <button
              className="btn-add-user"
              onClick={() => onNavigate('session-management')}
              style={{ background: '#06b6d4' }}
            >
              Oturum Yönetimi
            </button>
          )}
          <button
            className="btn-delete"
            onClick={handleClearPhysicianData}
            style={{ backgroundColor: '#dc2626' }}
          >
            🗑️ Hekim Verilerini Temizle
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="users-table">
        <table>
          <thead>
            <tr>
              <th>İsim</th>
              <th>Email</th>
              <th>Rol</th>
              <th>İzinli Hastaneler</th>
              <th>Modül İzinleri</th>
              <th>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.uid}>
                <td>{user.displayName}</td>
                <td>{user.email}</td>
                <td>
                  <span className={`role-badge ${user.role}`}>
                    {user.role === 'admin' ? 'Admin' : 'Kullanıcı'}
                  </span>
                </td>
                <td>
                  {user.permissions.allowedHospitals.length === 0
                    ? 'Tüm Hastaneler'
                    : user.permissions.allowedHospitals.join(', ')}
                </td>
                <td>
                  <div className="module-permissions">
                    {user.permissions.modules.detailedSchedule && <span className="perm-badge">Detaylı Cetvel</span>}
                    {user.permissions.modules.physicianData && <span className="perm-badge">Hekim</span>}
                    {user.permissions.modules.changeAnalysis && <span className="perm-badge">Değişim</span>}
                    {user.permissions.modules.efficiencyAnalysis && <span className="perm-badge">Verimlilik</span>}
                    {user.permissions.modules.serviceAnalysis && <span className="perm-badge">Hizmet</span>}
                    {user.permissions.modules.aiChatbot && <span className="perm-badge">AI Chat</span>}
                    {user.permissions.modules.gorenBashekimlik && <span className="perm-badge">GÖREN</span>}
                    {user.permissions.modules.analysisModule && <span className="perm-badge">Analiz</span>}
                    {user.permissions.modules.performancePlanning && <span className="perm-badge">Planlama</span>}
                    {user.permissions.modules.presentation && <span className="perm-badge">Sunum</span>}
                    {user.permissions.modules.emergencyService && <span className="perm-badge">Acil</span>}
                    {user.permissions.modules.activeDemand && <span className="perm-badge">Aktif Talep</span>}
                    {user.permissions.modules.etikKurul && <span className="perm-badge">Etik Kurul</span>}
                    {user.permissions.modules.hekimIslemListesi && <span className="perm-badge">Hekim İşlem</span>}
                    {user.permissions.modules.ekListeTanimlama && <span className="perm-badge">Ek Liste</span>}
                    {user.permissions.modules.sutMevzuati && <span className="perm-badge">SUT</span>}
                    {user.permissions.modules.gil && <span className="perm-badge">GİL</span>}
                    {user.permissions.canUpload?.detailedSchedule && <span className="upload-badge">📤 Cetvel Yükle</span>}
                    {user.permissions.canUpload?.physicianData && <span className="upload-badge">📤 Hekim Yükle</span>}
                    {user.permissions.canUpload?.emergencyService && <span className="upload-badge">📤 Acil Yükle</span>}
                    {user.permissions.canUpload?.activeDemand && <span className="upload-badge">📤 Talep Yükle</span>}
                  </div>
                </td>
                <td>
                  <div className="action-buttons">
                    <button className="btn-edit" onClick={() => startEdit(user)}>Düzenle</button>
                    <button className="btn-reset" onClick={() => handleResetPassword(user.email)}>Şifre Sıfırla</button>
                    {user.email !== ADMIN_EMAIL && (
                      <button className="btn-delete" onClick={() => handleDeleteUser(user.uid)}>Sil</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingUser ? 'Kullanıcıyı Düzenle' : 'Yeni Kullanıcı Ekle'}</h2>

            <form onSubmit={editingUser ? handleUpdateUser : handleAddUser}>
              <div className="form-group">
                <label>Email:</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!!editingUser}
                  required
                />
              </div>

              {!editingUser && (
                <div className="form-group">
                  <label>Şifre:</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label>İsim:</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>İzinli Hastaneler:</label>
                <div className="hospital-selector">
                  <div className="hospital-selector-header">
                    <input
                      type="text"
                      value={hospitalSearch}
                      onChange={(e) => setHospitalSearch(e.target.value)}
                      onFocus={() => setShowHospitalDropdown(true)}
                      placeholder="Hastane ara..."
                      className="hospital-search"
                    />
                    <div className="hospital-actions">
                      <button type="button" onClick={selectAllHospitals} className="btn-small">Tümünü Seç</button>
                      <button type="button" onClick={clearAllHospitals} className="btn-small btn-clear">Temizle</button>
                    </div>
                  </div>

                  {selectedHospitals.length > 0 && (
                    <div className="selected-hospitals">
                      {selectedHospitals.map(h => (
                        <span key={h} className="hospital-tag">
                          {h}
                          <button type="button" onClick={() => toggleHospital(h)}>&times;</button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="hospital-dropdown">
                    {filteredHospitals.map(hospital => (
                      <label key={hospital} className="hospital-option">
                        <input
                          type="checkbox"
                          checked={selectedHospitals.includes(hospital)}
                          onChange={() => toggleHospital(hospital)}
                        />
                        {hospital}
                      </label>
                    ))}
                  </div>
                </div>
                <small>Hiç seçim yapmazsanız tüm hastaneleri görebilir</small>
              </div>

              <div className="form-group">
                <label>Modül İzinleri:</label>
                <div className="checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={permissions.modules.detailedSchedule}
                      onChange={(e) => setPermissions({
                        ...permissions,
                        modules: { ...permissions.modules, detailedSchedule: e.target.checked }
                      })}
                    />
                    Detaylı Cetveller
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={permissions.modules.physicianData}
                      onChange={(e) => setPermissions({
                        ...permissions,
                        modules: { ...permissions.modules, physicianData: e.target.checked }
                      })}
                    />
                    Hekim Verileri
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={permissions.modules.changeAnalysis}
                      onChange={(e) => setPermissions({
                        ...permissions,
                        modules: { ...permissions.modules, changeAnalysis: e.target.checked }
                      })}
                    />
                    Değişim Analizleri
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={permissions.modules.efficiencyAnalysis}
                      onChange={(e) => setPermissions({
                        ...permissions,
                        modules: { ...permissions.modules, efficiencyAnalysis: e.target.checked }
                      })}
                    />
                    Verimlilik Analizleri
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={permissions.modules.serviceAnalysis}
                      onChange={(e) => setPermissions({
                        ...permissions,
                        modules: { ...permissions.modules, serviceAnalysis: e.target.checked }
                      })}
                    />
                    Hizmet Girişim Analizi
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={permissions.modules.aiChatbot}
                      onChange={(e) => setPermissions({
                        ...permissions,
                        modules: { ...permissions.modules, aiChatbot: e.target.checked }
                      })}
                    />
                    AI Sohbet
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={permissions.modules.gorenBashekimlik}
                      onChange={(e) => setPermissions({
                        ...permissions,
                        modules: { ...permissions.modules, gorenBashekimlik: e.target.checked }
                      })}
                    />
                    GÖREN Başhekimlik
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={permissions.modules.analysisModule}
                      onChange={(e) => setPermissions({
                        ...permissions,
                        modules: { ...permissions.modules, analysisModule: e.target.checked }
                      })}
                    />
                    Analiz Modülü
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={permissions.modules.performancePlanning}
                      onChange={(e) => setPermissions({
                        ...permissions,
                        modules: { ...permissions.modules, performancePlanning: e.target.checked }
                      })}
                    />
                    AI Planlama
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={permissions.modules.presentation}
                      onChange={(e) => setPermissions({
                        ...permissions,
                        modules: { ...permissions.modules, presentation: e.target.checked }
                      })}
                    />
                    Sunum
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={permissions.modules.emergencyService}
                      onChange={(e) => setPermissions({
                        ...permissions,
                        modules: { ...permissions.modules, emergencyService: e.target.checked }
                      })}
                    />
                    Acil Servis
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={permissions.modules.activeDemand}
                      onChange={(e) => setPermissions({
                        ...permissions,
                        modules: { ...permissions.modules, activeDemand: e.target.checked }
                      })}
                    />
                    Aktif Talep
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={permissions.modules.etikKurul}
                      onChange={(e) => setPermissions({
                        ...permissions,
                        modules: { ...permissions.modules, etikKurul: e.target.checked }
                      })}
                    />
                    Etik Kurul
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={permissions.modules.hekimIslemListesi}
                      onChange={(e) => setPermissions({
                        ...permissions,
                        modules: { ...permissions.modules, hekimIslemListesi: e.target.checked }
                      })}
                    />
                    Hekim İşlem Listesi
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={permissions.modules.ekListeTanimlama}
                      onChange={(e) => setPermissions({
                        ...permissions,
                        modules: { ...permissions.modules, ekListeTanimlama: e.target.checked }
                      })}
                    />
                    Ek Liste Tanımlama
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={permissions.modules.sutMevzuati}
                      onChange={(e) => setPermissions({
                        ...permissions,
                        modules: { ...permissions.modules, sutMevzuati: e.target.checked }
                      })}
                    />
                    SUT Mevzuatı
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={permissions.modules.gil}
                      onChange={(e) => setPermissions({
                        ...permissions,
                        modules: { ...permissions.modules, gil: e.target.checked }
                      })}
                    />
                    GİL
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label>Veri Yükleme İzinleri:</label>
                <small style={{ display: 'block', marginBottom: '8px' }}>
                  Seçili modüllere veri yükleyebilir (Excel/dosya yükleme)
                </small>
                <div className="checkbox-group upload-permissions">
                  <label>
                    <input
                      type="checkbox"
                      checked={permissions.canUpload?.detailedSchedule || false}
                      onChange={(e) => setPermissions({
                        ...permissions,
                        canUpload: {
                          ...permissions.canUpload,
                          detailedSchedule: e.target.checked,
                          physicianData: permissions.canUpload?.physicianData || false,
                          emergencyService: permissions.canUpload?.emergencyService || false,
                          activeDemand: permissions.canUpload?.activeDemand || false,
                        }
                      })}
                    />
                    Detaylı Cetveller Yükle
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={permissions.canUpload?.physicianData || false}
                      onChange={(e) => setPermissions({
                        ...permissions,
                        canUpload: {
                          ...permissions.canUpload,
                          detailedSchedule: permissions.canUpload?.detailedSchedule || false,
                          physicianData: e.target.checked,
                          emergencyService: permissions.canUpload?.emergencyService || false,
                          activeDemand: permissions.canUpload?.activeDemand || false,
                        }
                      })}
                    />
                    Hekim Verileri Yükle
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={permissions.canUpload?.emergencyService || false}
                      onChange={(e) => setPermissions({
                        ...permissions,
                        canUpload: {
                          ...permissions.canUpload,
                          detailedSchedule: permissions.canUpload?.detailedSchedule || false,
                          physicianData: permissions.canUpload?.physicianData || false,
                          emergencyService: e.target.checked,
                          activeDemand: permissions.canUpload?.activeDemand || false,
                        }
                      })}
                    />
                    Acil Servis Verileri Yükle
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={permissions.canUpload?.activeDemand || false}
                      onChange={(e) => setPermissions({
                        ...permissions,
                        canUpload: {
                          ...permissions.canUpload,
                          detailedSchedule: permissions.canUpload?.detailedSchedule || false,
                          physicianData: permissions.canUpload?.physicianData || false,
                          emergencyService: permissions.canUpload?.emergencyService || false,
                          activeDemand: e.target.checked,
                        }
                      })}
                    />
                    Aktif Talep Verileri Yükle
                  </label>
                </div>
              </div>

              {error && <div className="alert alert-error" style={{ marginTop: '16px' }}>{error}</div>}

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={handleCloseModal} disabled={isSubmitting}>
                  İptal
                </button>
                <button type="submit" className="btn-submit" disabled={isSubmitting}>
                  {isSubmitting ? 'İşleniyor...' : (editingUser ? 'Güncelle' : 'Ekle')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
