import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '../../firebase';
import { AppUser, UserPermissions, DEFAULT_PERMISSIONS, ADMIN_EMAIL } from '../types/user';
import './AdminPanel.css';

interface AdminPanelProps {
  currentUserEmail: string;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ currentUserEmail }) => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [allowedHospitals, setAllowedHospitals] = useState<string>('');
  const [permissions, setPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

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
          allowedHospitals: allowedHospitals ? allowedHospitals.split(',').map(h => h.trim()) : [],
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
      setError(err.message || 'Kullanıcı oluşturulamadı');
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setError('');
    setSuccess('');

    try {
      const userData: Partial<AppUser> = {
        displayName: displayName,
        permissions: {
          ...permissions,
          allowedHospitals: allowedHospitals ? allowedHospitals.split(',').map(h => h.trim()) : [],
        },
      };

      await setDoc(doc(db, 'users', editingUser.uid), userData, { merge: true });

      setSuccess('Kullanıcı başarıyla güncellendi!');
      setEditingUser(null);
      resetForm();
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'Kullanıcı güncellenemedi');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Bu kullanıcıyı silmek istediğinizden emin misiniz?')) return;

    try {
      await deleteDoc(doc(db, 'users', userId));
      setSuccess('Kullanıcı silindi!');
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

  const startEdit = (user: AppUser) => {
    setEditingUser(user);
    setEmail(user.email);
    setDisplayName(user.displayName);
    setAllowedHospitals(user.permissions.allowedHospitals.join(', '));
    setPermissions(user.permissions);
    setShowAddModal(true);
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setDisplayName('');
    setAllowedHospitals('');
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
        <button className="btn-add-user" onClick={() => setShowAddModal(true)}>
          + Yeni Kullanıcı Ekle
        </button>
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
                <label>İzinli Hastaneler (virgülle ayırın, boş bırakırsanız tümü):</label>
                <input
                  type="text"
                  value={allowedHospitals}
                  onChange={(e) => setAllowedHospitals(e.target.value)}
                  placeholder="Örn: Hastane A, Hastane B"
                />
                <small>Boş bırakırsanız tüm hastaneleri görebilir</small>
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
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={handleCloseModal}>
                  İptal
                </button>
                <button type="submit" className="btn-submit">
                  {editingUser ? 'Güncelle' : 'Ekle'}
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
