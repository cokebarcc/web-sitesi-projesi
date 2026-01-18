import React from 'react';

interface SchedulePlanningProps {
  selectedHospital: string;
  allowedHospitals: string[];
  onHospitalChange: (hospital: string) => void;
}

const SchedulePlanning: React.FC<SchedulePlanningProps> = ({
  selectedHospital,
  allowedHospitals,
  onHospitalChange
}) => {
  return (
    <div className="space-y-6 pb-20">
      {/* Başlık */}
      <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-8 rounded-[24px] border border-[var(--glass-border)] shadow-lg">
        <h1 className="text-2xl font-black text-[var(--text-1)] uppercase tracking-tight">
          Cetvel Planlama
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-2">
          Hekim çalışma cetvellerini planlayın ve optimize edin.
        </p>
      </div>

      {/* Boş İçerik Alanı */}
      <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-32 rounded-[56px] border-4 border-dashed border-[var(--glass-border)] text-center flex flex-col items-center gap-8 shadow-inner">
        <div className="w-24 h-24 bg-[var(--surface-2)] rounded-[40px] flex items-center justify-center text-[var(--text-muted)] shadow-inner group">
          <svg className="w-12 h-12 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h4 className="text-2xl font-black text-[var(--text-2)] uppercase tracking-[0.2em]">
            YAKINDA GELECEK
          </h4>
          <p className="text-[var(--text-muted)] font-medium max-w-md mx-auto mt-3 italic">
            Cetvel planlama modülü geliştirme aşamasındadır.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SchedulePlanning;
