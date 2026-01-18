import React, { useState } from 'react';

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  badgeColor?: string;
  onClick: () => void;
  isActive?: boolean;
  subItems?: {
    id: string;
    label: string;
    onClick: () => void;
    isActive?: boolean;
  }[];
}

interface DarkSidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  userEmail?: string;
  onLogout: () => void;
  isAdmin?: boolean;
  hasModuleAccess: (module: string) => boolean;
}

const DarkSidebar: React.FC<DarkSidebarProps> = ({
  currentView,
  onNavigate,
  userEmail,
  onLogout,
  isAdmin = false,
  hasModuleAccess
}) => {
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['mhrs']);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  // Icon Components
  const HomeIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );

  const LibraryIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );

  const ChartIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );

  const TableIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );

  const UserIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );

  const RefreshIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );

  const EmergencyIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );

  const FinanceIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  const PuzzleIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
    </svg>
  );

  const ChatIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );

  const PresentationIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
    </svg>
  );

  const SettingsIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );

  const UsersIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );

  const ChevronIcon = ({ isOpen }: { isOpen: boolean }) => (
    <svg
      className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
    </svg>
  );

  const LogoutIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );

  const menuGroups = [
    {
      id: 'main',
      items: [
        {
          id: 'home',
          label: 'Ana Sayfa',
          icon: <HomeIcon />,
          view: 'welcome',
          hasAccess: true
        },
        {
          id: 'library',
          label: 'Arşiv',
          icon: <LibraryIcon />,
          view: 'detailed-schedule',
          hasAccess: hasModuleAccess('detailedSchedule')
        }
      ]
    },
    {
      id: 'mhrs',
      label: 'MHRS',
      icon: <TableIcon />,
      items: [
        { id: 'detailed-schedule', label: 'Detaylı Cetveller', view: 'detailed-schedule', hasAccess: hasModuleAccess('detailedSchedule') },
        { id: 'physician-data', label: 'Hekim Verileri', view: 'physician-data', hasAccess: hasModuleAccess('physicianData') },
        { id: 'change-analysis', label: 'Değişim Analizleri', view: 'change-analysis', hasAccess: hasModuleAccess('changeAnalysis') },
        { id: 'efficiency-analysis', label: 'Verimlilik Analizleri', view: 'efficiency-analysis', hasAccess: hasModuleAccess('efficiencyAnalysis') }
      ]
    },
    {
      id: 'financial',
      label: 'Finansal',
      icon: <FinanceIcon />,
      items: [
        { id: 'service-analysis', label: 'Hizmet Girişim', view: 'service-analysis', hasAccess: hasModuleAccess('serviceAnalysis') }
      ]
    },
    {
      id: 'emergency',
      label: 'Acil Servis',
      icon: <EmergencyIcon />,
      iconColor: 'text-red-400',
      items: [
        { id: 'emergency-service', label: 'Yeşil Alan Oranları', view: 'emergency-service', hasAccess: hasModuleAccess('emergencyService') }
      ]
    },
    {
      id: 'preparation',
      label: 'Hazırlama',
      icon: <PuzzleIcon />,
      badge: 'BETA',
      items: [
        { id: 'analysis-module', label: 'Analiz Modülü', view: 'analysis-module', hasAccess: hasModuleAccess('analysisModule') },
        { id: 'performance-planning', label: 'AI Planlama', view: 'performance-planning', hasAccess: hasModuleAccess('performancePlanning') },
        { id: 'presentation', label: 'Sunum', view: 'presentation', hasAccess: hasModuleAccess('presentation') }
      ]
    }
  ];

  const supportItems = [
    { id: 'ai-chatbot', label: 'AI Sohbet', icon: <ChatIcon />, view: 'ai-chatbot', hasAccess: hasModuleAccess('aiChatbot') },
    { id: 'goren', label: 'GÖREN Başarı', icon: <PresentationIcon />, view: 'goren', hasAccess: hasModuleAccess('gorenBashekimlik') }
  ];

  const isViewActive = (view: string) => currentView === view;
  const isGroupActive = (groupId: string) => {
    const group = menuGroups.find(g => g.id === groupId);
    if (!group || !('items' in group)) return false;
    return group.items?.some(item => isViewActive(item.view));
  };

  return (
    <aside className={`
      h-screen sticky top-0 bg-[#0d0d1a] text-white flex flex-col shrink-0 no-print
      transition-all duration-300 ease-in-out
      ${isCollapsed ? 'w-20' : 'w-60'}
      border-r border-slate-800/50
    `}>
      {/* Logo Area */}
      <div className="p-5 border-b border-slate-800/50">
        <button
          onClick={() => onNavigate('welcome')}
          className="flex items-center gap-3 group"
        >
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-shadow">
            <span className="text-white font-bold text-lg">M</span>
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="text-lg font-bold text-white tracking-tight">MEDİS</span>
              <span className="text-[9px] text-slate-500 leading-tight">Merkezi Dijital Sağlık</span>
            </div>
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 custom-scrollbar">
        {/* Main Items */}
        <div className="space-y-1 mb-4">
          {menuGroups[0].items?.filter(item => item.hasAccess).map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.view)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                ${isViewActive(item.view)
                  ? 'bg-slate-700/50 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }
              `}
            >
              <div className={`
                w-8 h-8 rounded-lg flex items-center justify-center transition-colors
                ${isViewActive(item.view) ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500'}
              `}>
                {item.icon}
              </div>
              {!isCollapsed && (
                <span className="text-sm font-medium">{item.label}</span>
              )}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="h-px bg-slate-800/50 my-4" />

        {/* Grouped Items */}
        {menuGroups.slice(1).map(group => {
          const isExpanded = expandedGroups.includes(group.id);
          const hasActiveChild = isGroupActive(group.id);
          const visibleItems = group.items?.filter(item => item.hasAccess) || [];

          if (visibleItems.length === 0) return null;

          return (
            <div key={group.id} className="mb-2">
              <button
                onClick={() => toggleGroup(group.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                  ${hasActiveChild
                    ? 'bg-slate-800/50 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/30'
                  }
                `}
              >
                <div className={`
                  w-8 h-8 rounded-lg flex items-center justify-center transition-colors
                  ${hasActiveChild ? 'bg-blue-500/20' : ''}
                  ${(group as any).iconColor || 'text-slate-500'}
                `}>
                  {group.icon}
                </div>
                {!isCollapsed && (
                  <>
                    <span className="text-sm font-medium flex-1 text-left">{group.label}</span>
                    {group.badge && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-500/20 text-amber-400 rounded">
                        {group.badge}
                      </span>
                    )}
                    <ChevronIcon isOpen={isExpanded} />
                  </>
                )}
              </button>

              {/* Sub Items */}
              {!isCollapsed && (
                <div className={`
                  overflow-hidden transition-all duration-300
                  ${isExpanded ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'}
                `}>
                  <div className="ml-5 pl-4 border-l border-slate-800/50 mt-1 space-y-0.5">
                    {visibleItems.map(item => (
                      <button
                        key={item.id}
                        onClick={() => onNavigate(item.view)}
                        className={`
                          w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200
                          ${isViewActive(item.view)
                            ? 'text-white bg-slate-700/30 font-medium'
                            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'
                          }
                        `}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Divider */}
        <div className="h-px bg-slate-800/50 my-4" />

        {/* Support Section */}
        <div className="space-y-1">
          <p className="px-3 py-2 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
            Destek
          </p>
          {supportItems.filter(item => item.hasAccess).map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.view)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                ${isViewActive(item.view)
                  ? 'bg-slate-700/50 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }
              `}
            >
              <div className={`
                w-8 h-8 rounded-lg flex items-center justify-center
                ${isViewActive(item.view) ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500'}
              `}>
                {item.icon}
              </div>
              {!isCollapsed && (
                <span className="text-sm font-medium">{item.label}</span>
              )}
            </button>
          ))}

          {/* Admin */}
          {isAdmin && (
            <button
              onClick={() => onNavigate('admin')}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                ${isViewActive('admin')
                  ? 'bg-slate-700/50 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }
              `}
            >
              <div className={`
                w-8 h-8 rounded-lg flex items-center justify-center
                ${isViewActive('admin') ? 'bg-rose-500/20 text-rose-400' : 'text-slate-500'}
              `}>
                <UsersIcon />
              </div>
              {!isCollapsed && (
                <span className="text-sm font-medium">Kullanıcı Yönetimi</span>
              )}
            </button>
          )}
        </div>
      </nav>

      {/* Footer - User & Settings */}
      <div className="p-4 border-t border-slate-800/50">
        {/* Settings */}
        <button
          onClick={() => {}}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all duration-200 mb-2"
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500">
            <SettingsIcon />
          </div>
          {!isCollapsed && <span className="text-sm font-medium">Ayarlar</span>}
        </button>

        {/* User Info */}
        <div className={`
          flex items-center gap-3 px-3 py-3 rounded-xl bg-slate-800/30
          ${isCollapsed ? 'justify-center' : ''}
        `}>
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-white font-semibold text-sm">
              {userEmail?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">
                {userEmail || 'Kullanıcı'}
              </p>
              <p className="text-[10px] text-slate-500">Oturum açık</p>
            </div>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 mt-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-200 border border-slate-800/50 hover:border-rose-500/30"
        >
          <LogoutIcon />
          {!isCollapsed && <span className="text-sm font-medium">Çıkış Yap</span>}
        </button>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-slate-800 rounded-full border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all z-50"
      >
        <svg
          className={`w-3 h-3 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Custom scrollbar styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #475569;
        }
      `}</style>
    </aside>
  );
};

export default DarkSidebar;
