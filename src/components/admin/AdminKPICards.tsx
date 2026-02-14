import React from 'react';

interface KPIData {
  total: number;
  admins: number;
  recentCount: number;
  unrestrictedCount: number;
}

interface AdminKPICardsProps {
  data: KPIData;
  loading?: boolean;
}

const AdminKPICards: React.FC<AdminKPICardsProps> = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="a-kpi-grid">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="a-kpi-skeleton" />
        ))}
      </div>
    );
  }

  const cards = [
    { label: 'TOPLAM KULLANICI', value: data.total, variant: 'indigo' },
    { label: 'ADMIN', value: data.admins, variant: 'purple' },
    { label: 'SON 7 GUN', value: data.recentCount, variant: 'emerald' },
    { label: 'KISITLAMASIZ', value: data.unrestrictedCount, variant: 'amber' },
  ];

  return (
    <div className="a-kpi-grid">
      {cards.map(card => (
        <div key={card.label} className={`a-kpi-card a-kpi-card--${card.variant}`}>
          <div className="a-kpi-label">{card.label}</div>
          <div className="a-kpi-value">{card.value}</div>
        </div>
      ))}
    </div>
  );
};

export default AdminKPICards;
