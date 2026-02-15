
import React, { useState } from 'react';
import { PerformanceData } from '../types';
// Import constants for month and year selection
import { MONTHS, YEARS } from '../constants';
import { GlassCard } from './ui';

interface DataEntryProps {
  onAdd: (data: PerformanceData) => void;
  selectedHospital: string;
  departments: string[];
  theme?: 'dark' | 'light';
}

const DataEntry: React.FC<DataEntryProps> = ({ onAdd, selectedHospital, departments, theme = 'dark' }) => {
  const isDark = theme === 'dark';
  const [formData, setFormData] = useState({
    doctorName: '',
    specialty: '',
    month: 'Kasım',
    year: 2025,
    pDays: 0,
    pExams: 0,
    pMhrs: 0,
    sDays: 0,
    sTotal: 0,
    otherDays: 0,
    constraints: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.doctorName || !formData.specialty) return;

    // Fixed: Added missing year property to satisfy PerformanceData interface requirement
    const newData: PerformanceData = {
      id: Math.random().toString(36).substr(2, 9),
      doctorName: formData.doctorName,
      specialty: formData.specialty,
      hospital: selectedHospital,
      month: formData.month,
      year: formData.year,
      polyclinic: {
        days: formData.pDays,
        totalExams: formData.pExams,
        mhrsCapacity: formData.pMhrs,
        noShowRate: 0 
      },
      surgery: {
        days: formData.sDays,
        totalSurgeries: formData.sTotal,
        groupABC: "N/A"
      },
      ward: {
        days: 0,
        bedOccupancy: 0
      },
      otherDays: formData.otherDays,
      // Calculate allActions based on current form inputs
      allActions: [
        { type: 'Poliklinik', days: formData.pDays },
        { type: 'Ameliyat', days: formData.sDays },
        { type: 'Diğer', days: formData.otherDays }
      ],
      constraints: formData.constraints
    };

    onAdd(newData);
    setFormData({
      doctorName: '',
      specialty: '',
      month: 'Kasım',
      year: 2025,
      pDays: 0,
      pExams: 0,
      pMhrs: 0,
      sDays: 0,
      sTotal: 0,
      otherDays: 0,
      constraints: ''
    });
    alert(`${formData.doctorName} verileri ${selectedHospital} için başarıyla kaydedildi.`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <GlassCard isDark={isDark} hover={false} padding="p-8">
        <div className="flex justify-between items-start mb-8">
           <div>
              <h2 className="text-2xl font-black mb-2" style={{ color: 'var(--text-1)' }}>Hekim Performans Veri Girişi</h2>
              <p className="font-medium" style={{ color: 'var(--text-muted)' }}>Lütfen hekimin fiilî çalışma verilerini giriniz.</p>
           </div>
           <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl border border-blue-100 text-xs font-black uppercase">
              {selectedHospital}
           </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-10">
          {/* Temel Bilgiler */}
          <GlassCard isDark={isDark} variant="flat" hover={false} padding="p-6" className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Hekim Ad Soyad</label>
              <input 
                required
                className="w-full border rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-blue-100 outline-none transition" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--input-text)' }}
                placeholder="Örn: Dr. Mehmet Öz"
                value={formData.doctorName}
                onChange={e => setFormData({...formData, doctorName: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Branş</label>
              <select 
                required
                className="w-full border rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-blue-100 outline-none transition" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--input-text)' }}
                value={formData.specialty}
                onChange={e => setFormData({...formData, specialty: e.target.value})}
              >
                <option value="">Branş Seçiniz...</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            {/* Added Month Selection */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Ay</label>
              <select 
                required
                className="w-full border rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-blue-100 outline-none transition" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--input-text)' }}
                value={formData.month}
                onChange={e => setFormData({...formData, month: e.target.value})}
              >
                {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            {/* Added Year Selection */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Yıl</label>
              <select 
                required
                className="w-full border rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-blue-100 outline-none transition" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--input-text)' }}
                value={formData.year}
                onChange={e => setFormData({...formData, year: Number(e.target.value)})}
              >
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </GlassCard>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Poliklinik */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-blue-600 mb-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                <h4 className="font-bold uppercase text-xs tracking-tighter">Poliklinik Verileri</h4>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Poliklinik Gün Sayısı</label>
                  <input type="number" className="w-full border rounded-lg p-2.5 text-sm" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--input-text)' }} value={formData.pDays} onChange={e => setFormData({...formData, pDays: Number(e.target.value)})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>MHRS Kapasite Sayısı</label>
                  <input type="number" className="w-full border rounded-lg p-2.5 text-sm" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--input-text)' }} value={formData.pMhrs} onChange={e => setFormData({...formData, pMhrs: Number(e.target.value)})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Toplam Muayene Sayısı</label>
                  <input type="number" className="w-full border rounded-lg p-2.5 text-sm" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--input-text)' }} value={formData.pExams} onChange={e => setFormData({...formData, pExams: Number(e.target.value)})} />
                </div>
              </div>
            </div>

            {/* Ameliyat */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-600 mb-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                <h4 className="font-bold uppercase text-xs tracking-tighter">Ameliyat Verileri</h4>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Ameliyat Gün Sayısı</label>
                  <input type="number" className="w-full border rounded-lg p-2.5 text-sm" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--input-text)' }} value={formData.sDays} onChange={e => setFormData({...formData, sDays: Number(e.target.value)})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Yapılan Ameliyat Sayısı</label>
                  <input type="number" className="w-full border rounded-lg p-2.5 text-sm" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--input-text)' }} value={formData.sTotal} onChange={e => setFormData({...formData, sTotal: Number(e.target.value)})} />
                </div>
              </div>
            </div>

            {/* Diğer */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-purple-600 mb-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <h4 className="font-bold uppercase text-xs tracking-tighter">Diğer Aksiyonlar</h4>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Diğer Aksiyon Gün Sayısı</label>
                  <input type="number" className="w-full border rounded-lg p-2.5 text-sm" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--input-text)' }} value={formData.otherDays} onChange={e => setFormData({...formData, otherDays: Number(e.target.value)})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Ek Kısıtlar / Notlar</label>
                  <textarea 
                    className="w-full border rounded-lg p-2.5 text-sm h-24 resize-none"
                    style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--input-text)' }}
                    placeholder="Tek hekim branşı, cihaz arızası vb..."
                    value={formData.constraints}
                    onChange={e => setFormData({...formData, constraints: e.target.value})}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-6">
            <button 
              type="submit"
              className="text-white px-12 py-4 rounded-2xl font-black transition shadow-xl active:scale-95 hover:opacity-90"
              style={{ background: 'var(--bg-app)', boxShadow: '0 20px 25px -5px color-mix(in srgb, var(--bg-app) 20%, transparent)' }}
            >
              Hekim Verisini Kaydet
            </button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
};

export default DataEntry;
