import React from 'react';
import { AppUser, ADMIN_EMAIL } from '../../types/user';
import { countActiveModules, MODULE_TOTAL, getAvatarColor, getInitials } from './adminConstants';
import { HOSPITALS } from '../../../constants';
import { getKurumDisplayText } from '../../constants/kurumConstants';

interface AdminUserRowProps {
  user: AppUser;
  onEdit: (user: AppUser) => void;
  onDelete: (userId: string) => void;
  onResetPassword: (email: string) => void;
}

const AdminUserRow: React.FC<AdminUserRowProps> = ({ user, onEdit, onDelete, onResetPassword }) => {
  const activeCount = countActiveModules(user.permissions.modules);
  const percentage = (activeCount / MODULE_TOTAL) * 100;
  const barClass = activeCount > 14 ? 'a-perm-bar--high' : activeCount > 7 ? 'a-perm-bar--mid' : 'a-perm-bar--low';

  const hospitalCount = user.permissions.allowedHospitals.length;
  const isAllHospitals = hospitalCount === 0;

  return (
    <tr onClick={() => onEdit(user)}>
      {/* User */}
      <td>
        <div className="a-user-cell">
          <div
            className="a-avatar"
            style={{ background: getAvatarColor(user.email) }}
          >
            {getInitials(user.displayName)}
          </div>
          <div className="a-user-info">
            <span className="a-user-name">{user.displayName}</span>
            <span className="a-user-email">{user.email}</span>
          </div>
        </div>
      </td>

      {/* Role */}
      <td>
        <span className={`a-role-badge a-role-badge--${user.role === 'admin' ? 'admin' : 'user'}`}>
          {user.role === 'admin' ? 'Admin' : 'Kullanici'}
        </span>
      </td>

      {/* Permissions progress */}
      <td>
        <div className="a-perm-progress">
          <div className="a-perm-bar-container">
            <div
              className={`a-perm-bar ${barClass}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="a-perm-count">{activeCount}/{MODULE_TOTAL}</span>
        </div>
      </td>

      {/* Hospital */}
      <td>
        <span className={`a-hospital-badge ${isAllHospitals ? 'a-hospital-badge--all' : 'a-hospital-badge--limited'}`}>
          {isAllHospitals ? 'Tumu' : `${hospitalCount}/${HOSPITALS.length}`}
        </span>
      </td>

      {/* Kurum */}
      <td>
        {user.kurum ? (
          <span className="a-kurum-badge a-kurum-badge--assigned" title={getKurumDisplayText(user.kurum)}>
            {getKurumDisplayText(user.kurum)}
          </span>
        ) : (
          <span className="a-kurum-badge a-kurum-badge--unassigned">
            Belirtilmemis
          </span>
        )}
      </td>

      {/* Actions */}
      <td>
        <div className="a-actions" onClick={(e) => e.stopPropagation()}>
          <button
            className="a-action-btn a-action-btn--edit"
            onClick={() => onEdit(user)}
            title="Duzenle"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button
            className="a-action-btn a-action-btn--reset"
            onClick={() => onResetPassword(user.email)}
            title="Sifre Sifirla"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </button>
          {user.email !== ADMIN_EMAIL && (
            <button
              className="a-action-btn a-action-btn--delete"
              onClick={() => onDelete(user.uid)}
              title="Sil"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};

export default AdminUserRow;
