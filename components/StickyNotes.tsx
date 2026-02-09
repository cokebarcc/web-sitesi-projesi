import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

interface Note {
  id: string;
  text: string;
  color: string;
  createdAt: any;
  updatedAt: any;
}

interface StickyNotesProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  theme?: 'dark' | 'light';
}

const NOTE_COLORS = [
  { name: 'Sarı', bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-900', value: 'amber' },
  { name: 'Mavi', bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-900', value: 'blue' },
  { name: 'Yeşil', bg: 'bg-emerald-100', border: 'border-emerald-300', text: 'text-emerald-900', value: 'green' },
  { name: 'Mor', bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-900', value: 'purple' },
  { name: 'Pembe', bg: 'bg-pink-100', border: 'border-pink-300', text: 'text-pink-900', value: 'pink' },
];

const getColorClasses = (color: string) => {
  return NOTE_COLORS.find(c => c.value === color) || NOTE_COLORS[0];
};

const StickyNotes: React.FC<StickyNotesProps> = ({ isOpen, onClose, userEmail, theme = 'dark' }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [selectedColor, setSelectedColor] = useState('amber');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const isDark = theme === 'dark';

  // Load notes from Firestore
  useEffect(() => {
    if (!userEmail) return;

    const notesRef = collection(db, 'sticky_notes');
    const q = query(
      notesRef,
      where('userEmail', '==', userEmail),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedNotes: Note[] = [];
      snapshot.forEach((doc) => {
        loadedNotes.push({ id: doc.id, ...doc.data() } as Note);
      });
      setNotes(loadedNotes);
    }, (error) => {
      console.error('Not yükleme hatası:', error);
      // Fallback to localStorage
      try {
        const saved = localStorage.getItem(`medis_notes_${userEmail}`);
        if (saved) setNotes(JSON.parse(saved));
      } catch {}
    });

    return () => unsubscribe();
  }, [userEmail]);

  // Save to localStorage as backup
  useEffect(() => {
    if (notes.length > 0 && userEmail) {
      try {
        localStorage.setItem(`medis_notes_${userEmail}`, JSON.stringify(notes));
      } catch {}
    }
  }, [notes, userEmail]);

  const addNote = useCallback(async () => {
    if (!newNoteText.trim() || !userEmail) return;

    try {
      await addDoc(collection(db, 'sticky_notes'), {
        text: newNoteText.trim(),
        color: selectedColor,
        userEmail,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewNoteText('');
    } catch (error) {
      console.error('Not ekleme hatası:', error);
      // Fallback: add locally
      const newNote: Note = {
        id: Date.now().toString(),
        text: newNoteText.trim(),
        color: selectedColor,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setNotes(prev => [newNote, ...prev]);
      setNewNoteText('');
    }
  }, [newNoteText, selectedColor, userEmail]);

  const updateNote = useCallback(async (noteId: string) => {
    if (!editText.trim()) return;

    try {
      await updateDoc(doc(db, 'sticky_notes', noteId), {
        text: editText.trim(),
        updatedAt: serverTimestamp(),
      });
    } catch {
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, text: editText.trim() } : n));
    }
    setEditingId(null);
    setEditText('');
  }, [editText]);

  const deleteNote = useCallback(async (noteId: string) => {
    try {
      await deleteDoc(doc(db, 'sticky_notes', noteId));
    } catch {
      setNotes(prev => prev.filter(n => n.id !== noteId));
    }
  }, []);

  const startEdit = useCallback((note: Note) => {
    setEditingId(note.id);
    setEditText(note.text);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[400] w-80 max-h-[520px] flex flex-col animate-in slide-in-from-bottom-4">
      {/* Panel */}
      <div className={`rounded-2xl overflow-hidden flex flex-col max-h-[520px] ${
        isDark
          ? 'bg-[#131d33]/95 border border-[#2d4163]/40 shadow-2xl shadow-black/30'
          : 'bg-white/95 border border-slate-200/60 shadow-2xl shadow-black/10'
      } backdrop-blur-xl`}>

        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 border-b ${
          isDark ? 'border-[#2d4163]/30' : 'border-slate-200/60'
        }`}>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
              <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
            </svg>
            <h3 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}>
              Hızlı Notlar
            </h3>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              isDark ? 'bg-slate-700/50 text-slate-400' : 'bg-slate-100 text-slate-500'
            }`}>
              {notes.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded-lg transition-colors ${
              isDark ? 'hover:bg-slate-700/50 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* New Note Input */}
        <div className={`px-4 py-3 border-b ${isDark ? 'border-[#2d4163]/20' : 'border-slate-100'}`}>
          <div className="flex gap-2 mb-2">
            <textarea
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  addNote();
                }
              }}
              placeholder="Not ekle... (Enter ile kaydet)"
              rows={2}
              className={`flex-1 text-sm rounded-xl px-3 py-2 outline-none resize-none transition-colors ${
                isDark
                  ? 'bg-[#0f1729]/60 text-white placeholder-[#556a85] border border-[#2d4163]/30 focus:border-[#5b9cff]/40'
                  : 'bg-slate-50 text-slate-800 placeholder-slate-400 border border-slate-200 focus:border-blue-300'
              }`}
            />
          </div>
          <div className="flex items-center justify-between">
            {/* Color Selector */}
            <div className="flex gap-1.5">
              {NOTE_COLORS.map(color => (
                <button
                  key={color.value}
                  onClick={() => setSelectedColor(color.value)}
                  className={`w-5 h-5 rounded-full ${color.bg} border-2 transition-all ${
                    selectedColor === color.value
                      ? `${color.border} scale-110 ring-2 ring-offset-1 ${isDark ? 'ring-offset-[#131d33]' : 'ring-offset-white'} ring-${color.value === 'amber' ? 'amber' : color.value === 'blue' ? 'blue' : color.value === 'green' ? 'emerald' : color.value === 'purple' ? 'purple' : 'pink'}-300`
                      : 'border-transparent hover:scale-105'
                  }`}
                  title={color.name}
                />
              ))}
            </div>
            <button
              onClick={addNote}
              disabled={!newNoteText.trim()}
              className="px-3 py-1 text-xs font-medium rounded-lg bg-[#5b9cff] text-white hover:bg-[#4388f5] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Ekle
            </button>
          </div>
        </div>

        {/* Notes List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar" style={{ maxHeight: '320px' }}>
          {notes.length === 0 ? (
            <div className={`text-center py-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <svg className="w-10 h-10 mx-auto mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <p className="text-xs">Henüz not yok</p>
              <p className="text-[10px] mt-1 opacity-60">Yukarıdan yeni not ekleyin</p>
            </div>
          ) : (
            notes.map(note => {
              const colorClasses = getColorClasses(note.color);
              const isEditing = editingId === note.id;

              return (
                <div
                  key={note.id}
                  className={`group rounded-xl p-3 ${colorClasses.bg} ${colorClasses.border} border transition-all hover:shadow-md`}
                >
                  {isEditing ? (
                    <div>
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            updateNote(note.id);
                          }
                          if (e.key === 'Escape') {
                            setEditingId(null);
                            setEditText('');
                          }
                        }}
                        rows={3}
                        autoFocus
                        className={`w-full text-sm rounded-lg px-2 py-1.5 outline-none resize-none ${colorClasses.text} bg-white/60 border border-white/40 focus:border-white/70`}
                      />
                      <div className="flex gap-1.5 mt-2 justify-end">
                        <button
                          onClick={() => { setEditingId(null); setEditText(''); }}
                          className="px-2 py-0.5 text-[10px] rounded-md bg-white/50 text-slate-600 hover:bg-white/80"
                        >
                          İptal
                        </button>
                        <button
                          onClick={() => updateNote(note.id)}
                          className="px-2 py-0.5 text-[10px] rounded-md bg-white/80 text-blue-700 font-medium hover:bg-white"
                        >
                          Kaydet
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className={`text-sm whitespace-pre-wrap break-words ${colorClasses.text}`}>
                        {note.text}
                      </p>
                      <div className="flex items-center justify-between mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className={`text-[9px] ${colorClasses.text} opacity-50`}>
                          {note.createdAt?.toDate
                            ? note.createdAt.toDate().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                            : ''}
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => startEdit(note)}
                            className={`p-1 rounded-md hover:bg-white/50 ${colorClasses.text} opacity-60 hover:opacity-100`}
                            title="Düzenle"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => deleteNote(note.id)}
                            className={`p-1 rounded-md hover:bg-red-100 text-red-400 opacity-60 hover:opacity-100`}
                            title="Sil"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default StickyNotes;
