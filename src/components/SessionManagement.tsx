import React, { useState, useEffect } from 'react';
import { subscribeToSessions, subscribeToSessionLogs, terminateSession, cleanupStaleSessions, getCurrentSessionId, ActiveSession, SessionLog } from '../services/sessionService';
import { ADMIN_EMAIL } from '../types/user';

interface SessionManagementProps {
  currentUserEmail: string;
}

type Tab = 'active' | 'history';

const SessionManagement: React.FC<SessionManagementProps> = ({ currentUserEmail }) => {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [sessionLogs, setSessionLogs] = useState<SessionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [terminatingId, setTerminatingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('active');
  const [cleaning, setCleaning] = useState(false);

  const isAdmin = currentUserEmail === ADMIN_EMAIL;
  const currentSessionId = getCurrentSessionId();

  useEffect(() => {
    const unsub1 = subscribeToSessions((data) => {
      setSessions(data);
      setLoading(false);
    });
    const unsub2 = subscribeToSessionLogs((data) => {
      setSessionLogs(data);
      setLogsLoading(false);
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  const handleTerminate = async (sessionId: string, email: string) => {
    if (sessionId === currentSessionId) {
      if (!window.confirm('Kendi oturumunuzu kapatmak istediğinize emin misiniz? Sayfayı yenilemeniz gerekecektir.')) return;
    } else {
      if (!window.confirm(`${email} kullanıcısının oturumunu kapatmak istediğinize emin misiniz?`)) return;
    }

    setTerminatingId(sessionId);
    try {
      await terminateSession(sessionId);
    } catch (err) {
      console.error('Oturum kapatma hatası:', err);
    } finally {
      setTerminatingId(null);
    }
  };

  const handleCleanup = async () => {
    if (!window.confirm('Tüm çevrimdışı oturumları temizlemek istediğinize emin misiniz?')) return;
    setCleaning(true);
    try {
      const count = await cleanupStaleSessions();
      alert(`${count} eski oturum temizlendi.`);
    } catch (err) {
      console.error('Temizleme hatası:', err);
    } finally {
      setCleaning(false);
    }
  };

  const filteredSessions = sessions.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.email?.toLowerCase().includes(q) ||
      s.displayName?.toLowerCase().includes(q) ||
      s.deviceInfo?.toLowerCase().includes(q) ||
      s.browser?.toLowerCase().includes(q) ||
      s.os?.toLowerCase().includes(q)
    );
  });

  const filteredLogs = sessionLogs.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.email?.toLowerCase().includes(q) ||
      s.displayName?.toLowerCase().includes(q) ||
      s.deviceInfo?.toLowerCase().includes(q) ||
      s.browser?.toLowerCase().includes(q) ||
      s.os?.toLowerCase().includes(q)
    );
  });

  const uniqueUsers = new Set(sessions.map(s => s.email));

  const formatTime = (timestamp: { toDate?: () => Date } | null) => {
    if (!timestamp || !timestamp.toDate) return '-';
    const date = timestamp.toDate();
    return date.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTimeDiff = (timestamp: { toDate?: () => Date; toMillis?: () => number } | null) => {
    if (!timestamp || !timestamp.toDate) return '';
    const now = new Date();
    const last = timestamp.toDate();
    const diffMs = now.getTime() - last.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'Az önce';
    if (diffMin < 60) return `${diffMin} dk önce`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} saat önce`;
    return `${Math.floor(diffHour / 24)} gün önce`;
  };

  const getDuration = (loginAt: { toDate?: () => Date } | null, logoutAt: { toDate?: () => Date } | null) => {
    if (!loginAt?.toDate || !logoutAt?.toDate) return '-';
    const diffMs = logoutAt.toDate().getTime() - loginAt.toDate().getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return '< 1 dk';
    if (diffMin < 60) return `${diffMin} dk`;
    const diffHour = Math.floor(diffMin / 60);
    const remainMin = diffMin % 60;
    if (diffHour < 24) return `${diffHour} sa ${remainMin} dk`;
    const diffDay = Math.floor(diffHour / 24);
    return `${diffDay} gün ${diffHour % 24} sa`;
  };

  const getLogoutReasonLabel = (reason: string) => {
    switch (reason) {
      case 'tab_closed': return { text: 'Sekme Kapatıldı', color: 'var(--text-muted)' };
      case 'admin_terminated': return { text: 'Admin Kapattı', color: '#ef4444' };
      case 'logout': return { text: 'Çıkış Yapıldı', color: '#3b82f6' };
      default: return { text: 'Bilinmeyen', color: 'var(--text-muted)' };
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center">
        <p style={{ color: 'var(--text-2)' }}>Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>
            Oturum Yönetimi
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Aktif ve geçmiş kullanıcı oturumlarını görüntüleyin ve yönetin
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-3">
            <div className="px-4 py-2 rounded-xl text-center" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)' }}>
              <div className="text-lg font-bold status-success">{sessions.length}</div>
              <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>Aktif</div>
            </div>
            <div className="px-4 py-2 rounded-xl text-center" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)' }}>
              <div className="text-lg font-bold status-info">{uniqueUsers.size}</div>
              <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>Kullanıcı</div>
            </div>
            <div className="px-4 py-2 rounded-xl text-center" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)' }}>
              <div className="text-lg font-bold status-accent">{sessionLogs.length}</div>
              <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>Geçmiş</div>
            </div>
          </div>
          <button
            onClick={handleCleanup}
            disabled={cleaning}
            className="px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200"
            style={{
              background: 'var(--surface-2)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-2)',
              cursor: cleaning ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-2)'; }}
          >
            {cleaning ? 'Temizleniyor...' : 'Eski Oturumları Temizle'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 p-1 rounded-xl w-fit" style={{ background: 'var(--surface-2)' }}>
        <button
          onClick={() => setActiveTab('active')}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
          style={{
            background: activeTab === 'active' ? 'var(--surface-1)' : 'transparent',
            color: activeTab === 'active' ? 'var(--text-1)' : 'var(--text-muted)',
            boxShadow: activeTab === 'active' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
          }}
        >
          Aktif Oturumlar ({sessions.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
          style={{
            background: activeTab === 'history' ? 'var(--surface-1)' : 'transparent',
            color: activeTab === 'history' ? 'var(--text-1)' : 'var(--text-muted)',
            boxShadow: activeTab === 'history' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
          }}
        >
          Oturum Geçmişi ({sessionLogs.length})
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Kullanıcı, cihaz veya tarayıcı ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2.5 rounded-xl text-sm"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border-2)',
            color: 'var(--text-1)',
            outline: 'none',
          }}
        />
      </div>

      {/* Active Sessions Tab */}
      {activeTab === 'active' && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Oturumlar yükleniyor...</div>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-2xl"
                 style={{ background: 'var(--surface-2)', border: '2px dashed var(--border-2)' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                   className="mb-4 opacity-40" style={{ color: 'var(--text-muted)' }}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="9" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="font-bold text-sm uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {search ? 'Sonuç bulunamadı' : 'Aktif oturum yok'}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)' }}>
              <table className="w-full">
                <thead>
                  <tr style={{ background: 'var(--surface-3)' }}>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Durum</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Kullanıcı</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Cihaz / Tarayıcı</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Giriş Zamanı</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Son Aktivite</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.map((session) => {
                    const isCurrent = session.sessionId === currentSessionId;

                    return (
                      <tr
                        key={session.sessionId}
                        className="transition-colors duration-150"
                        style={{ borderTop: '1px solid var(--border-2)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2.5 h-2.5 rounded-full"
                              style={{
                                background: session.status === 'online' ? '#34d399'
                                  : session.status === 'idle' ? '#fbbf24'
                                  : '#ef4444'
                              }}
                              title={
                                session.status === 'online' ? 'Aktif'
                                : session.status === 'idle' ? 'Pasif (heartbeat gecikmiş)'
                                : 'Çevrimdışı'
                              }
                            />
                            <span className="text-[10px] font-semibold uppercase" style={{
                              color: session.status === 'online' ? '#34d399'
                                : session.status === 'idle' ? '#fbbf24'
                                : '#ef4444'
                            }}>
                              {session.status === 'online' ? 'Aktif'
                                : session.status === 'idle' ? 'Pasif'
                                : 'Çevrimdışı'}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                                Bu oturum
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div>
                            <div className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
                              {session.displayName || '-'}
                            </div>
                            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {session.email}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="text-sm" style={{ color: 'var(--text-2)' }}>
                            {session.os}
                          </div>
                          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {session.browser}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="text-sm" style={{ color: 'var(--text-2)' }}>
                            {formatTime(session.loginAt)}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className={`text-sm ${
                            session.status === 'online' ? 'status-success'
                            : session.status === 'idle' ? 'status-warning'
                            : ''
                          }`} style={session.status === 'offline' ? { color: '#ef4444' } : undefined}>
                            {getTimeDiff(session.lastActivity)}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleTerminate(session.sessionId, session.email)}
                            disabled={terminatingId === session.sessionId}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
                            style={{
                              background: terminatingId === session.sessionId ? 'var(--surface-3)' : 'rgba(239,68,68,0.15)',
                              color: terminatingId === session.sessionId ? 'var(--text-muted)' : '#ef4444',
                              border: '1px solid rgba(239,68,68,0.2)',
                              cursor: terminatingId === session.sessionId ? 'not-allowed' : 'pointer',
                            }}
                            onMouseEnter={(e) => {
                              if (terminatingId !== session.sessionId) {
                                e.currentTarget.style.background = 'rgba(239,68,68,0.25)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (terminatingId !== session.sessionId) {
                                e.currentTarget.style.background = 'rgba(239,68,68,0.15)';
                              }
                            }}
                          >
                            {terminatingId === session.sessionId ? 'Kapatılıyor...' : 'Oturumu Kapat'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Session History Tab */}
      {activeTab === 'history' && (
        <>
          {logsLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Geçmiş oturumlar yükleniyor...</div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-2xl"
                 style={{ background: 'var(--surface-2)', border: '2px dashed var(--border-2)' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                   className="mb-4 opacity-40" style={{ color: 'var(--text-muted)' }}>
                <rect width="18" height="18" x="3" y="4" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M16 2v4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 2v4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3 10h18" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="font-bold text-sm uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {search ? 'Sonuç bulunamadı' : 'Henüz oturum geçmişi yok'}
              </p>
              <p className="text-xs mt-2" style={{ color: 'var(--text-3)' }}>
                Oturumlar kapatıldığında burada görünecektir
              </p>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)' }}>
              <table className="w-full">
                <thead>
                  <tr style={{ background: 'var(--surface-3)' }}>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Kullanıcı</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Cihaz / Tarayıcı</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Giriş</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Çıkış</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Süre</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Neden</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log, i) => {
                    const reason = getLogoutReasonLabel(log.logoutReason);
                    return (
                      <tr
                        key={`${log.sessionId}-${i}`}
                        className="transition-colors duration-150"
                        style={{ borderTop: '1px solid var(--border-2)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <td className="px-4 py-3">
                          <div>
                            <div className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
                              {log.displayName || '-'}
                            </div>
                            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {log.email}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="text-sm" style={{ color: 'var(--text-2)' }}>
                            {log.os}
                          </div>
                          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {log.browser}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="text-sm" style={{ color: 'var(--text-2)' }}>
                            {formatTime(log.loginAt)}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="text-sm" style={{ color: 'var(--text-2)' }}>
                            {formatTime(log.logoutAt)}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="text-sm" style={{ color: 'var(--text-2)' }}>
                            {getDuration(log.loginAt, log.logoutAt)}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className="text-xs font-semibold px-2 py-1 rounded-lg"
                            style={{
                              color: reason.color,
                              background: log.logoutReason === 'admin_terminated' ? 'rgba(239,68,68,0.15)' : 'var(--surface-3)',
                            }}
                          >
                            {reason.text}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Info */}
      <div className="mt-4 flex items-start gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 flex-shrink-0">
          <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
        </svg>
        <span>
          Oturumlar her 30 saniyede bir güncellenir. Yeşil = aktif, sarı = pasif (2-10 dk), kırmızı = çevrimdışı (10 dk+).
          Çevrimdışı oturumlar listede kalır ve admin tarafından kapatılabilir. "Eski Oturumları Temizle" sadece çevrimdışı oturumları kaldırır.
        </span>
      </div>
    </div>
  );
};

export default SessionManagement;
