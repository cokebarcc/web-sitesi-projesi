// VoiceChatButton - Mikrofon Butonu Komponenti
import React, { useState, useEffect, useCallback } from 'react';
import { VoiceChatStatus } from '../../types/voice';

interface VoiceChatButtonProps {
  status: VoiceChatStatus;
  isListening: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  onStartListening: () => void;
  onStopListening: () => void;
  onCancelListening: () => void;
  onStopSpeaking: () => void;
  onToggleMute: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const VoiceChatButton: React.FC<VoiceChatButtonProps> = ({
  status,
  isListening,
  isSpeaking,
  isMuted,
  onStartListening,
  onStopListening,
  onCancelListening,
  onStopSpeaking,
  onToggleMute,
  disabled = false,
  size = 'md',
  className = ''
}) => {
  const [isPressed, setIsPressed] = useState(false);

  // Push-to-talk: Mouse/Touch events
  const handleMouseDown = useCallback(() => {
    if (disabled) return;

    if (isSpeaking) {
      onStopSpeaking();
      return;
    }

    setIsPressed(true);
    onStartListening();
  }, [disabled, isSpeaking, onStartListening, onStopSpeaking]);

  const handleMouseUp = useCallback(() => {
    if (isPressed) {
      setIsPressed(false);
      onStopListening();
    }
  }, [isPressed, onStopListening]);

  const handleMouseLeave = useCallback(() => {
    if (isPressed) {
      setIsPressed(false);
      onCancelListening();
    }
  }, [isPressed, onCancelListening]);

  // Keyboard support (Space key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        if (!disabled && !isPressed) {
          setIsPressed(true);
          if (isSpeaking) {
            onStopSpeaking();
          } else {
            onStartListening();
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (isPressed) {
          setIsPressed(false);
          onStopListening();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [disabled, isPressed, isSpeaking, onStartListening, onStopListening, onStopSpeaking]);

  // Size classes
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-20 h-20'
  };

  const iconSizes = {
    sm: 'w-5 h-5',
    md: 'w-7 h-7',
    lg: 'w-10 h-10'
  };

  // Status-based styling
  const getButtonStyle = () => {
    if (disabled) {
      return 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed';
    }

    switch (status) {
      case 'listening':
        return 'bg-red-500 hover:bg-red-600 animate-pulse shadow-lg shadow-red-500/50';
      case 'processing':
        return 'bg-amber-500 hover:bg-amber-600 animate-pulse';
      case 'speaking':
        return 'bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/30';
      case 'error':
        return 'bg-red-600 hover:bg-red-700';
      default:
        return 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-lg';
    }
  };

  // Icon based on status
  const getIcon = () => {
    if (isSpeaking) {
      // Speaker icon (AI konuşuyor)
      return (
        <svg className={iconSizes[size]} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        </svg>
      );
    }

    if (isListening) {
      // Microphone active icon
      return (
        <svg className={iconSizes[size]} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
        </svg>
      );
    }

    if (status === 'processing') {
      // Loading spinner
      return (
        <svg className={`${iconSizes[size]} animate-spin`} fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      );
    }

    // Default microphone icon
    return (
      <svg className={iconSizes[size]} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    );
  };

  // Status text
  const getStatusText = () => {
    switch (status) {
      case 'listening':
        return 'Dinleniyor...';
      case 'processing':
        return 'Düşünüyor...';
      case 'speaking':
        return 'Konuşuyor...';
      case 'error':
        return 'Hata!';
      default:
        return 'Konuşmak için basılı tut';
    }
  };

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      {/* Ana buton */}
      <button
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
        disabled={disabled}
        className={`
          ${sizeClasses[size]}
          rounded-full
          flex items-center justify-center
          text-white
          transition-all duration-200
          focus:outline-none focus:ring-4 focus:ring-emerald-500/50
          ${getButtonStyle()}
        `}
        title={getStatusText()}
      >
        {getIcon()}
      </button>

      {/* Status text */}
      <span className={`text-xs text-center ${
        status === 'error' ? 'text-red-500' :
        status === 'listening' ? 'text-red-500 font-medium' :
        status === 'speaking' ? 'text-emerald-500' :
        'text-slate-500 dark:text-slate-400'
      }`}>
        {getStatusText()}
      </span>

      {/* Mute button (küçük) */}
      {!disabled && (
        <button
          onClick={onToggleMute}
          className={`
            p-1.5 rounded-full transition-colors
            ${isMuted
              ? 'text-red-500 bg-red-100 dark:bg-red-900/30'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }
          `}
          title={isMuted ? 'Sesi aç' : 'Sesi kapat'}
        >
          {isMuted ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          )}
        </button>
      )}

      {/* Keyboard hint */}
      <span className="text-[10px] text-slate-400 dark:text-slate-500">
        Space tuşu ile de kullanabilirsiniz
      </span>
    </div>
  );
};

export default VoiceChatButton;
