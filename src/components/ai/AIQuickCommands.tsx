// AIQuickCommands - Hazır Komutlar Komponenti
import React from 'react';
import { AIQuickCommand } from '../../types/ai';

interface AIQuickCommandsProps {
  commands: AIQuickCommand[];
  onCommandClick: (command: AIQuickCommand) => void;
}

const AIQuickCommands: React.FC<AIQuickCommandsProps> = ({ commands, onCommandClick }) => {
  // Kategori ikonları
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'analysis':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        );
      case 'report':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'comparison':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        );
      case 'trend':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
    }
  };

  // Kategori renkleri
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'analysis':
        return 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40';
      case 'report':
        return 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/40';
      case 'comparison':
        return 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40';
      case 'trend':
        return 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40';
      default:
        return 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700';
    }
  };

  // Kategorilere göre grupla
  const groupedCommands = commands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) {
      acc[cmd.category] = [];
    }
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, AIQuickCommand[]>);

  const categoryLabels: Record<string, string> = {
    analysis: 'Analiz',
    report: 'Rapor',
    comparison: 'Karşılaştırma',
    trend: 'Trend'
  };

  return (
    <div className="w-full max-w-2xl">
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 text-center">
        Hızlı başlangıç için bir komut seçin:
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {commands.slice(0, 9).map((command) => (
          <button
            key={command.id}
            onClick={() => onCommandClick(command)}
            className={`
              flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all
              ${getCategoryColor(command.category)}
            `}
          >
            <span className="flex-shrink-0">
              {getCategoryIcon(command.category)}
            </span>
            <span className="text-sm font-medium truncate">
              {command.label}
            </span>
          </button>
        ))}
      </div>

      {/* Kategoriler */}
      <div className="flex items-center justify-center gap-4 mt-4">
        {Object.entries(categoryLabels).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className={`w-2 h-2 rounded-full ${
              key === 'analysis' ? 'bg-blue-500' :
              key === 'report' ? 'bg-purple-500' :
              key === 'comparison' ? 'bg-amber-500' :
              'bg-emerald-500'
            }`}></span>
            {label}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AIQuickCommands;
