import React, { useState } from 'react';

interface FloatingSidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  userEmail?: string;
  onLogout: () => void;
  isAdmin?: boolean;
  hasModuleAccess: (module: string) => boolean;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

const FloatingSidebar: React.FC<FloatingSidebarProps> = ({
  currentView,
  onNavigate,
  userEmail,
  onLogout,
  isAdmin = false,
  hasModuleAccess,
  theme = 'dark',
  onToggleTheme
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['mhrs']);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  // Menu Items
  const menuItems = [
    {
      id: 'home',
      label: 'Ana Sayfa',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      view: 'welcome',
      hasAccess: true
    },
    {
      id: 'library',
      label: 'Arşiv',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      view: 'detailed-schedule',
      hasAccess: hasModuleAccess('detailedSchedule')
    }
  ];

  const menuGroups = [
    {
      id: 'emergency',
      label: 'Acil Servis',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      iconColor: 'text-red-400',
      items: [
        { id: 'emergency-service', label: 'Yeşil Alan Oranları', view: 'emergency-service', hasAccess: hasModuleAccess('emergencyService') }
      ]
    },
    {
      id: 'mhrs',
      label: 'MHRS',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
      items: [
        { id: 'active-demand', label: 'Aktif Talep', view: 'active-demand', hasAccess: hasModuleAccess('activeDemand') },
        { id: 'detailed-schedule', label: 'Detaylı Cetveller', view: 'detailed-schedule', hasAccess: hasModuleAccess('detailedSchedule') },
        { id: 'physician-data', label: 'Hekim Verileri', view: 'physician-data', hasAccess: hasModuleAccess('physicianData') },
        { id: 'change-analysis', label: 'Değişim Analizleri', view: 'change-analysis', hasAccess: hasModuleAccess('changeAnalysis') },
        { id: 'efficiency-analysis', label: 'Verimlilik Analizleri', view: 'efficiency-analysis', hasAccess: hasModuleAccess('efficiencyAnalysis') }
      ]
    },
    {
      id: 'financial',
      label: 'Finansal',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      items: [
        { id: 'service-analysis', label: 'Hizmet Girişim', view: 'service-analysis', hasAccess: hasModuleAccess('serviceAnalysis') }
      ]
    },
    {
      id: 'preparation',
      label: 'Hazırlama',
      badge: 'BETA',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
        </svg>
      ),
      items: [
        { id: 'analysis-module', label: 'Analiz Modülü', view: 'analysis-module', hasAccess: hasModuleAccess('analysisModule') },
        { id: 'schedule-planning', label: 'Cetvel Planlama', view: 'schedule-planning', hasAccess: hasModuleAccess('schedulePlanning') },
        { id: 'presentation', label: 'Sunum', view: 'presentation', hasAccess: hasModuleAccess('presentation') }
      ]
    }
  ];

  const supportItems = [
    {
      id: 'ai-chatbot',
      label: 'AI Sohbet',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      view: 'ai-chatbot',
      hasAccess: hasModuleAccess('aiChatbot')
    },
    {
      id: 'goren',
      label: 'GÖREN Başarı',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      view: 'goren',
      hasAccess: hasModuleAccess('gorenBashekimlik')
    }
  ];

  // GÖREN Performans menü grubu
  const gorenMenuGroup = {
    id: 'goren-perf',
    label: 'GÖREN Performans',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    iconColor: 'text-purple-400',
    items: [
      { id: 'goren-ilsm', label: 'İl Sağlık Müdürlüğü', view: 'goren-ilsm', hasAccess: true },
      { id: 'goren-ilcesm', label: 'İlçe Sağlık Müdürlüğü', view: 'goren-ilcesm', hasAccess: true, disabled: true },
      { id: 'goren-bh', label: 'Başhekimlik', view: 'goren-bh', hasAccess: true },
      { id: 'goren-adsh', label: 'ADSH', view: 'goren-adsh', hasAccess: true, disabled: true },
      { id: 'goren-ash', label: 'Acil Sağlık', view: 'goren-ash', hasAccess: true, disabled: true }
    ]
  };

  const isViewActive = (view: string) => currentView === view;
  const isGroupActive = (groupId: string) => {
    const group = menuGroups.find(g => g.id === groupId);
    return group?.items?.some(item => isViewActive(item.view));
  };

  const isDark = theme === 'dark';

  return (
    <>
      {/* Floating Sidebar */}
      <div
        className={`
          fixed left-4 top-4 bottom-4 z-[500]
          backdrop-blur-2xl
          rounded-3xl border
          shadow-2xl
          transition-all duration-300 ease-out
          flex flex-col overflow-hidden
          ${isExpanded ? 'w-64' : 'w-[72px]'}
          ${isDark
            ? 'bg-[#0a0a14] border-slate-700/30 shadow-black/50'
            : 'bg-white/95 border-slate-200/60 shadow-slate-300/50'
          }
        `}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
      >
        {/* Logo */}
        <div className={`p-4 border-b ${isDark ? 'border-slate-700/30' : 'border-slate-200/60'}`}>
          <button
            onClick={() => onNavigate('welcome')}
            className="flex items-center gap-3 group"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-all shrink-0">
              <span className="text-white font-bold text-lg">M</span>
            </div>
            {isExpanded && (
              <div className="flex flex-col overflow-hidden">
                <span className={`text-lg font-bold tracking-tight whitespace-nowrap ${isDark ? 'text-white' : 'text-slate-800'}`}>MEDİS</span>
                <span className={`text-[9px] whitespace-nowrap ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Merkezi Dijital Sağlık</span>
              </div>
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-1 custom-scrollbar">
          {/* Main Items */}
          {menuItems.filter(item => item.hasAccess).map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.view)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                ${isViewActive(item.view)
                  ? isDark ? 'bg-slate-700/50 text-white' : 'bg-blue-50 text-blue-700'
                  : isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }
              `}
              title={!isExpanded ? item.label : undefined}
            >
              <div className={`shrink-0 ${isViewActive(item.view) ? 'text-blue-400' : ''}`}>
                {item.icon}
              </div>
              {isExpanded && (
                <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
              )}
            </button>
          ))}

          {/* Divider */}
          <div className={`h-px my-3 ${isDark ? 'bg-slate-700/30' : 'bg-slate-200/60'}`} />

          {/* Groups */}
          {menuGroups.map(group => {
            const hasActiveChild = isGroupActive(group.id);
            const visibleItems = group.items?.filter(item => item.hasAccess) || [];
            const isOpen = expandedGroups.includes(group.id);

            if (visibleItems.length === 0) return null;

            return (
              <div key={group.id}>
                <button
                  onClick={() => isExpanded && toggleGroup(group.id)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                    ${hasActiveChild
                      ? isDark ? 'bg-slate-800/50 text-white' : 'bg-blue-50 text-blue-700'
                      : isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800/30' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }
                  `}
                  title={!isExpanded ? group.label : undefined}
                >
                  <div className={`shrink-0 ${(group as any).iconColor || (hasActiveChild ? 'text-blue-400' : '')}`}>
                    {group.icon}
                  </div>
                  {isExpanded && (
                    <>
                      <span className="text-sm font-medium flex-1 text-left whitespace-nowrap">{group.label}</span>
                      {group.badge && (
                        <span className="px-1.5 py-0.5 text-[8px] font-bold bg-amber-500/20 text-amber-400 rounded">
                          {group.badge}
                        </span>
                      )}
                      <svg
                        className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </>
                  )}
                </button>

                {/* Sub Items */}
                {isExpanded && (
                  <div className={`
                    overflow-hidden transition-all duration-300
                    ${isOpen ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'}
                  `}>
                    <div className={`ml-5 pl-3 border-l mt-1 space-y-0.5 ${isDark ? 'border-slate-700/30' : 'border-slate-200/60'}`}>
                      {visibleItems.map(item => (
                        <button
                          key={item.id}
                          onClick={() => onNavigate(item.view)}
                          className={`
                            w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 whitespace-nowrap
                            ${isViewActive(item.view)
                              ? isDark ? 'text-white bg-slate-700/30 font-medium' : 'text-blue-700 bg-blue-50 font-medium'
                              : isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/30' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
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
          <div className={`h-px my-3 ${isDark ? 'bg-slate-700/30' : 'bg-slate-200/60'}`} />

          {/* GÖREN Performans Group */}
          {(() => {
            const group = gorenMenuGroup;
            const hasActiveChild = group.items?.some(item => isViewActive(item.view));
            const visibleItems = group.items?.filter(item => item.hasAccess) || [];
            const isOpen = expandedGroups.includes(group.id);

            if (visibleItems.length === 0) return null;

            return (
              <div>
                <button
                  onClick={() => isExpanded && toggleGroup(group.id)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                    ${hasActiveChild
                      ? isDark ? 'bg-slate-800/50 text-white' : 'bg-purple-50 text-purple-700'
                      : isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800/30' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }
                  `}
                  title={!isExpanded ? group.label : undefined}
                >
                  <div className={`shrink-0 ${group.iconColor || (hasActiveChild ? 'text-purple-400' : '')}`}>
                    {group.icon}
                  </div>
                  {isExpanded && (
                    <>
                      <span className="text-sm font-medium flex-1 text-left whitespace-nowrap">{group.label}</span>
                      <svg
                        className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </>
                  )}
                </button>

                {/* Sub Items */}
                {isExpanded && (
                  <div className={`
                    overflow-hidden transition-all duration-300
                    ${isOpen ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'}
                  `}>
                    <div className={`ml-5 pl-3 border-l mt-1 space-y-0.5 ${isDark ? 'border-slate-700/30' : 'border-slate-200/60'}`}>
                      {visibleItems.map(item => (
                        <button
                          key={item.id}
                          onClick={() => !(item as any).disabled && onNavigate(item.view)}
                          disabled={(item as any).disabled}
                          className={`
                            w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 whitespace-nowrap
                            ${(item as any).disabled
                              ? 'text-slate-600 cursor-not-allowed opacity-50'
                              : isViewActive(item.view)
                                ? isDark ? 'text-white bg-purple-500/20 font-medium' : 'text-purple-700 bg-purple-50 font-medium'
                                : isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/30' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                            }
                          `}
                        >
                          {item.label}
                          {(item as any).disabled && (
                            <span className="ml-2 text-[9px] text-slate-500">(Yakında)</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Divider */}
          <div className={`h-px my-3 ${isDark ? 'bg-slate-700/30' : 'bg-slate-200/60'}`} />

          {/* Support */}
          <div className="space-y-1">
            {isExpanded && (
              <p className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                Destek
              </p>
            )}
            {supportItems.filter(item => item.hasAccess).map(item => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.view)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                  ${isViewActive(item.view)
                    ? isDark ? 'bg-slate-700/50 text-white' : 'bg-blue-50 text-blue-700'
                    : isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }
                `}
                title={!isExpanded ? item.label : undefined}
              >
                <div className={`shrink-0 ${isViewActive(item.view) ? 'text-blue-400' : ''}`}>
                  {item.icon}
                </div>
                {isExpanded && (
                  <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
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
                    ? isDark ? 'bg-slate-700/50 text-white' : 'bg-blue-50 text-blue-700'
                    : isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }
                `}
                title={!isExpanded ? 'Kullanıcı Yönetimi' : undefined}
              >
                <div className={`shrink-0 ${isViewActive('admin') ? 'text-rose-400' : ''}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                {isExpanded && (
                  <span className="text-sm font-medium whitespace-nowrap">Kullanıcı Yönetimi</span>
                )}
              </button>
            )}
          </div>
        </nav>

        {/* Footer */}
        <div className={`p-3 border-t ${isDark ? 'border-slate-700/30' : 'border-slate-200/60'}`}>
          {/* Theme Toggle - iOS Style */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 mb-2 ${
                isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title={!isExpanded ? (theme === 'dark' ? 'Açık Mod' : 'Koyu Mod') : undefined}
            >
              {/* Toggle Switch */}
              <div className="relative shrink-0">
                <div
                  className={`
                    w-10 h-6 rounded-full transition-all duration-300 flex items-center
                    ${theme === 'dark' ? 'bg-slate-600' : 'bg-amber-400'}
                  `}
                >
                  <div
                    className={`
                      w-5 h-5 rounded-full shadow-md transition-all duration-300 flex items-center justify-center
                      ${theme === 'dark'
                        ? 'translate-x-0.5 bg-slate-300'
                        : 'translate-x-[18px] bg-white'
                      }
                    `}
                  >
                    {theme === 'dark' ? (
                      <svg className="w-3 h-3 text-slate-700" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                      </svg>
                    ) : (
                      <svg className="w-3 h-3 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </div>
              </div>
              {isExpanded && (
                <span className="text-sm font-medium">
                  {theme === 'dark' ? 'Koyu Mod' : 'Açık Mod'}
                </span>
              )}
            </button>
          )}

          {/* Settings */}
          <button
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 mb-2 ${
              isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title={!isExpanded ? 'Ayarlar' : undefined}
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {isExpanded && <span className="text-sm font-medium">Ayarlar</span>}
          </button>

          {/* User */}
          <div className={`
            flex items-center gap-3 px-3 py-2.5 rounded-xl
            ${!isExpanded ? 'justify-center' : ''}
            ${isDark ? 'bg-slate-800/30' : 'bg-slate-100'}
          `}>
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shrink-0">
              <span className="text-white font-semibold text-sm">
                {userEmail?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            {isExpanded && (
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  {userEmail || 'Kullanıcı'}
                </p>
                <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Oturum açık</p>
              </div>
            )}
          </div>

          {/* Logout */}
          <button
            onClick={onLogout}
            className={`w-full flex items-center justify-center gap-2 mt-2 px-3 py-2 rounded-xl transition-all duration-200 border ${
              isDark
                ? 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border-slate-700/30 hover:border-rose-500/30'
                : 'text-slate-600 hover:text-rose-600 hover:bg-rose-50 border-slate-200 hover:border-rose-300'
            }`}
            title={!isExpanded ? 'Çıkış Yap' : undefined}
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {isExpanded && <span className="text-sm font-medium">Çıkış</span>}
          </button>
        </div>
      </div>

      {/* Scrollbar styles */}
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
    </>
  );
};

export default FloatingSidebar;
