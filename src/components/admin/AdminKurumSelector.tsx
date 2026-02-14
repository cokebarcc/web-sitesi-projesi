import React from 'react';
import { KurumCategory, KURUM_CATEGORY_LABELS } from '../../types/user';
import { getKurumSubList } from '../../constants/kurumConstants';

interface AdminKurumSelectorProps {
  category: KurumCategory | '';
  name: string;
  onCategoryChange: (category: KurumCategory | '') => void;
  onNameChange: (name: string) => void;
}

const KURUM_CATEGORIES = Object.keys(KURUM_CATEGORY_LABELS) as KurumCategory[];

const AdminKurumSelector: React.FC<AdminKurumSelectorProps> = ({
  category,
  name,
  onCategoryChange,
  onNameChange,
}) => {
  const subList = category ? getKurumSubList(category) : null;
  const isFreeText = category === 'OZEL_UNIVERSITE';

  return (
    <div className="a-form-group">
      <label className="a-form-label">KURUM</label>
      <select
        className="a-form-input a-form-select"
        value={category}
        onChange={(e) => onCategoryChange(e.target.value as KurumCategory | '')}
      >
        <option value="">Kurum Seçiniz</option>
        {KURUM_CATEGORIES.map((cat) => (
          <option key={cat} value={cat}>
            {KURUM_CATEGORY_LABELS[cat]}
          </option>
        ))}
      </select>

      {/* Alt kurum seçimi — liste varsa dropdown */}
      {category && subList && (
        <div className="a-form-group" style={{ marginTop: 10 }}>
          <label className="a-form-label">
            {KURUM_CATEGORY_LABELS[category]} - Seçim
          </label>
          <select
            className="a-form-input a-form-select"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
          >
            <option value="">Seçiniz</option>
            {subList.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Özel/Üniversite — serbest metin girişi */}
      {isFreeText && (
        <div className="a-form-group" style={{ marginTop: 10 }}>
          <label className="a-form-label">Kurum Adı</label>
          <input
            type="text"
            className="a-form-input"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Hastane adını giriniz"
          />
        </div>
      )}
    </div>
  );
};

export default AdminKurumSelector;
