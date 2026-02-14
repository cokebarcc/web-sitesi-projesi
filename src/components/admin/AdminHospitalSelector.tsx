import React, { useMemo, useState } from 'react';
import { HOSPITALS } from '../../../constants';

interface AdminHospitalSelectorProps {
  selectedHospitals: string[];
  onChange: (hospitals: string[]) => void;
}

const AdminHospitalSelector: React.FC<AdminHospitalSelectorProps> = ({ selectedHospitals, onChange }) => {
  const [search, setSearch] = useState('');

  const filteredHospitals = useMemo(() => {
    if (!search.trim()) return HOSPITALS;
    const q = search.toLowerCase();
    return HOSPITALS.filter(h => h.toLowerCase().includes(q));
  }, [search]);

  const toggleHospital = (hospital: string) => {
    if (selectedHospitals.includes(hospital)) {
      onChange(selectedHospitals.filter(h => h !== hospital));
    } else {
      onChange([...selectedHospitals, hospital]);
    }
  };

  const selectAll = () => onChange([...HOSPITALS]);
  const clearAll = () => onChange([]);

  return (
    <div>
      {/* Info badge when no hospitals selected */}
      {selectedHospitals.length === 0 && (
        <div className="a-hospital-info">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          Hic secim yapmazsaniz tum hastaneleri gorebilir
        </div>
      )}

      {/* Selected chips */}
      {selectedHospitals.length > 0 && (
        <div className="a-hospital-chips">
          {selectedHospitals.map(h => (
            <span key={h} className="a-hospital-chip">
              {h}
              <button
                type="button"
                className="a-hospital-chip-remove"
                onClick={() => toggleHospital(h)}
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="a-hospital-actions">
        <button type="button" className="a-btn a-btn-sm a-btn-secondary" onClick={selectAll}>
          Tumunu Sec
        </button>
        <button type="button" className="a-btn a-btn-sm a-btn-ghost" onClick={clearAll}>
          Temizle
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        className="a-hospital-search"
        placeholder="Hastane ara..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Hospital list */}
      <div className="a-hospital-list">
        {filteredHospitals.map(hospital => (
          <label key={hospital} className="a-hospital-option">
            <input
              type="checkbox"
              checked={selectedHospitals.includes(hospital)}
              onChange={() => toggleHospital(hospital)}
            />
            {hospital}
          </label>
        ))}
      </div>
    </div>
  );
};

export default AdminHospitalSelector;
