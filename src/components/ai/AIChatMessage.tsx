// AIChatMessage - Mesaj Komponenti
import React, { useState } from 'react';
import { AIMessage, AIFeedback } from '../../types/ai';
import AIToolResult from './AIToolResult';

interface AIChatMessageProps {
  message: AIMessage;
  onFeedback?: (feedback: AIFeedback) => void;
}

const AIChatMessage: React.FC<AIChatMessageProps> = ({ message, onFeedback }) => {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<boolean | null>(
    message.feedback?.helpful ?? null
  );

  const isUser = message.role === 'user';

  const handleFeedback = (helpful: boolean) => {
    setFeedbackGiven(helpful);
    setShowFeedback(false);
    onFeedback?.({
      helpful,
      submittedAt: new Date()
    });
  };

  // Markdown-like formatting
  const formatContent = (content: string): React.ReactNode => {
    // Split by code blocks
    const parts = content.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      if (part.startsWith('```')) {
        // Code block
        const code = part.replace(/```(\w*)\n?/, '').replace(/```$/, '');
        return (
          <pre
            key={index}
            className="bg-slate-800 dark:bg-slate-900 text-slate-100 rounded-lg p-3 my-2 overflow-x-auto text-xs font-mono"
          >
            <code>{code}</code>
          </pre>
        );
      }

      // Regular text with basic formatting
      const linesArray = part.split('\n');
      const formattedLines = linesArray.map((line, lineIndex) => {
        // Bold
        let formattedLine: string = line.replace(
          /\*\*(.*?)\*\*/g,
          '<strong>$1</strong>'
        );

        // Italic
        formattedLine = formattedLine.replace(
          /\*(.*?)\*/g,
          '<em>$1</em>'
        );

        // Inline code
        formattedLine = formattedLine.replace(
          /`(.*?)`/g,
          '<code class="bg-slate-200 dark:bg-slate-700 px-1 rounded text-sm">$1</code>'
        );

        // List items
        if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
          return (
            <li key={lineIndex} className="ml-4 list-disc">
              <span dangerouslySetInnerHTML={{ __html: line.replace(/^[-•]\s*/, '') }} />
            </li>
          );
        }

        // Numbered list
        const numberedMatch = line.trim().match(/^(\d+)\.\s/);
        if (numberedMatch) {
          return (
            <li key={lineIndex} className="ml-4 list-decimal">
              <span dangerouslySetInnerHTML={{ __html: line.replace(/^\d+\.\s*/, '') }} />
            </li>
          );
        }

        // Headers
        if (line.startsWith('### ')) {
          return <h4 key={lineIndex} className="font-semibold text-base mt-3 mb-1">{line.replace('### ', '')}</h4>;
        }
        if (line.startsWith('## ')) {
          return <h3 key={lineIndex} className="font-semibold text-lg mt-3 mb-1">{line.replace('## ', '')}</h3>;
        }
        if (line.startsWith('# ')) {
          return <h2 key={lineIndex} className="font-bold text-xl mt-3 mb-1">{line.replace('# ', '')}</h2>;
        }

        // Empty line = paragraph break
        if (!line.trim()) {
          return <br key={lineIndex} />;
        }

        return (
          <span key={lineIndex}>
            <span dangerouslySetInnerHTML={{ __html: formattedLine }} />
            {lineIndex < linesArray.length - 1 && <br />}
          </span>
        );
      });

      return <React.Fragment key={index}>{formattedLines}</React.Fragment>;
    });
  };

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`
        w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
        ${isUser
          ? 'bg-slate-200 dark:bg-slate-700'
          : 'bg-gradient-to-br from-emerald-500 to-teal-600'
        }
      `}>
        {isUser ? (
          <svg className="w-4 h-4 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        )}
      </div>

      {/* Message Content */}
      <div className={`
        flex-1 max-w-[85%]
        ${isUser ? 'text-right' : ''}
      `}>
        <div className={`
          inline-block text-left rounded-2xl px-4 py-3 shadow-sm
          ${isUser
            ? 'bg-emerald-600 text-white rounded-tr-md'
            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-tl-md border border-slate-200 dark:border-slate-700'
          }
        `}>
          <div className="text-sm whitespace-pre-wrap">
            {formatContent(message.content)}
          </div>

          {/* Tool Results */}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className="mt-3 space-y-2">
              {message.toolCalls.map((toolCall, index) => (
                <AIToolResult
                  key={index}
                  toolCall={toolCall}
                />
              ))}
            </div>
          )}
        </div>

        {/* Timestamp & Feedback */}
        <div className={`flex items-center gap-2 mt-1 ${isUser ? 'justify-end' : ''}`}>
          <span className="text-xs text-slate-400">
            {message.timestamp.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
          </span>

          {/* Feedback buttons (only for assistant messages) */}
          {!isUser && (
            <div className="flex items-center gap-1">
              {feedbackGiven === null ? (
                <>
                  <button
                    onClick={() => handleFeedback(true)}
                    className="p-1 text-slate-400 hover:text-emerald-500 rounded transition-colors"
                    title="Faydalı"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleFeedback(false)}
                    className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                    title="Faydalı değil"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                    </svg>
                  </button>
                </>
              ) : (
                <span className={`text-xs ${feedbackGiven ? 'text-emerald-500' : 'text-red-500'}`}>
                  {feedbackGiven ? '✓ Teşekkürler!' : '✓ Geri bildirim alındı'}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIChatMessage;
