import React from 'react';
import { UserPermissions } from '../../types/user';
import { MODULE_GROUPS, PERMISSION_PRESETS } from './adminConstants';

interface AdminModulePermissionsProps {
  permissions: UserPermissions;
  onChange: (permissions: UserPermissions) => void;
}

const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  small?: boolean;
}> = ({ checked, onChange, small }) => (
  <label className={`a-toggle ${small ? 'a-toggle-sm' : ''}`}>
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
    <span className="a-toggle-track" />
  </label>
);

const AdminModulePermissions: React.FC<AdminModulePermissionsProps> = ({ permissions, onChange }) => {
  const updateModule = (key: string, value: boolean) => {
    const newModules = { ...permissions.modules, [key]: value } as UserPermissions['modules'];
    const newUpload = { ...permissions.canUpload } as NonNullable<UserPermissions['canUpload']>;
    // If module turned off, also turn off its upload permission
    if (!value) {
      const group = Object.values(MODULE_GROUPS).find(g =>
        g.modules.some(m => m.key === key)
      );
      const mod = group?.modules.find(m => m.key === key);
      if (mod?.uploadKey && newUpload) {
        (newUpload as any)[mod.uploadKey] = false;
      }
    }
    onChange({ ...permissions, modules: newModules, canUpload: newUpload });
  };

  const updateUpload = (uploadKey: string, value: boolean) => {
    const newUpload = {
      ...(permissions.canUpload || {}),
      [uploadKey]: value,
    } as NonNullable<UserPermissions['canUpload']>;
    onChange({ ...permissions, canUpload: newUpload });
  };

  const applyPreset = (presetKey: string) => {
    const preset = PERMISSION_PRESETS[presetKey as keyof typeof PERMISSION_PRESETS];
    if (!preset) return;
    const newModules = preset.apply();
    onChange({
      ...permissions,
      modules: { ...permissions.modules, ...newModules } as UserPermissions['modules'],
    });
  };

  const toggleGroupAll = (groupKey: string) => {
    const group = MODULE_GROUPS[groupKey];
    if (!group) return;
    const allEnabled = group.modules.every(m => (permissions.modules as any)[m.key]);
    const newModules = { ...permissions.modules } as any;
    const newUpload = { ...(permissions.canUpload || {}) } as any;
    group.modules.forEach(m => {
      newModules[m.key] = !allEnabled;
      // If turning off, also turn off upload
      if (allEnabled && m.uploadKey) {
        newUpload[m.uploadKey] = false;
      }
    });
    onChange({ ...permissions, modules: newModules, canUpload: newUpload });
  };

  const isGroupAllEnabled = (groupKey: string): boolean => {
    const group = MODULE_GROUPS[groupKey];
    if (!group) return false;
    return group.modules.every(m => (permissions.modules as any)[m.key]);
  };

  return (
    <div>
      {/* Presets */}
      <div className="a-presets">
        {Object.entries(PERMISSION_PRESETS).map(([key, preset]) => (
          <button
            key={key}
            type="button"
            className="a-preset-chip"
            onClick={() => applyPreset(key)}
            title={preset.description}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Permission Groups */}
      <div className="a-perm-grid">
        {Object.entries(MODULE_GROUPS).map(([groupKey, group]) => (
          <div className="a-perm-card" key={groupKey}>
            <div className="a-perm-card-header">
              <div className="a-perm-card-title">
                <span
                  className="a-perm-card-icon"
                  style={{ background: group.color }}
                />
                {group.label}
              </div>
              <button
                type="button"
                className="a-perm-card-toggle-all"
                onClick={() => toggleGroupAll(groupKey)}
              >
                {isGroupAllEnabled(groupKey) ? 'Tumunu Kapat' : 'Tumunu Ac'}
              </button>
            </div>
            <div className="a-perm-list">
              {group.modules.map(mod => (
                <div className="a-perm-item" key={mod.key}>
                  <span className="a-perm-item-label">{mod.label}</span>
                  <div className="a-perm-item-right">
                    {/* Upload sub-toggle */}
                    {mod.uploadKey && (permissions.modules as any)[mod.key] && (
                      <div className="a-upload-sub">
                        <span>Yukle</span>
                        <ToggleSwitch
                          small
                          checked={(permissions.canUpload as any)?.[mod.uploadKey] || false}
                          onChange={(v) => updateUpload(mod.uploadKey!, v)}
                        />
                      </div>
                    )}
                    <ToggleSwitch
                      checked={(permissions.modules as any)[mod.key]}
                      onChange={(v) => updateModule(mod.key, v)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminModulePermissions;
