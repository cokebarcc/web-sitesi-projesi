import React from 'react';
import { AppUser } from '../../types/user';
import AdminUserRow from './AdminUserRow';

interface AdminUserTableProps {
  users: AppUser[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onEdit: (user: AppUser) => void;
  onDelete: (userId: string) => void;
  onResetPassword: (email: string) => void;
  loading?: boolean;
}

const AdminUserTable: React.FC<AdminUserTableProps> = ({
  users,
  searchQuery,
  onSearchChange,
  onEdit,
  onDelete,
  onResetPassword,
  loading,
}) => {
  if (loading) {
    return (
      <div className="a-loading-container">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="a-skeleton-row" />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Search */}
      <div className="a-search-container">
        <div className="a-search-wrapper">
          <span className="a-search-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </span>
          <input
            type="text"
            className="a-search-input"
            placeholder="Kullanici ara (isim veya email)..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      {users.length === 0 ? (
        <div className="a-empty-state">
          <div className="a-empty-state-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            </svg>
          </div>
          <div className="a-empty-state-text">
            {searchQuery ? 'Aramayla eslesen kullanici bulunamadi' : 'Henuz kullanici eklenmemis'}
          </div>
        </div>
      ) : (
        <div className="a-table-container">
          <table className="a-table">
            <thead>
              <tr>
                <th>KULLANICI</th>
                <th>ROL</th>
                <th>IZINLER</th>
                <th>HASTANE</th>
                <th>KURUM</th>
                <th style={{ textAlign: 'right' }}>ISLEMLER</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <AdminUserRow
                  key={user.uid}
                  user={user}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onResetPassword={onResetPassword}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminUserTable;
