import React from 'react';

export type AdminTab = 'info' | 'modules' | 'hospitals';

interface AdminPanelTabsProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  isEditing: boolean;
}

const tabs: { key: AdminTab; label: string }[] = [
  { key: 'info', label: 'Temel Bilgiler' },
  { key: 'modules', label: 'Modul Izinleri' },
  { key: 'hospitals', label: 'Hastane Erisimi' },
];

const AdminPanelTabs: React.FC<AdminPanelTabsProps> = ({ activeTab, onTabChange, isEditing: _isEditing }) => {
  return (
    <div className="a-tabs">
      {tabs.map(tab => (
        <button
          key={tab.key}
          className={`a-tab ${activeTab === tab.key ? 'a-tab--active' : ''}`}
          onClick={() => onTabChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export default AdminPanelTabs;
