// AIToolResult - Tool Sonuç Gösterimi
import React, { useState } from 'react';
import { AIToolCall, AIChartConfig, AITableConfig } from '../../types/ai';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';

interface AIToolResultProps {
  toolCall: AIToolCall;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const AIToolResult: React.FC<AIToolResultProps> = ({ toolCall }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (toolCall.status === 'pending') {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        {getToolLabel(toolCall.name)} çalıştırılıyor...
      </div>
    );
  }

  if (toolCall.status === 'error') {
    return (
      <div className="flex items-center gap-2 text-sm text-red-500">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {toolCall.error || 'Bir hata oluştu'}
      </div>
    );
  }

  const result = toolCall.result;

  // Render based on tool type
  if (toolCall.name === 'generate_chart_config' && result) {
    return renderChart(result as AIChartConfig);
  }

  if (toolCall.name === 'generate_table' && result) {
    return renderTable(result as AITableConfig);
  }

  // Default: render as summary
  if (result?.summary) {
    return (
      <div className="mt-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 w-full"
        >
          <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
          {getToolLabel(toolCall.name)}
          {result.message && (
            <span className="text-xs text-slate-500 dark:text-slate-400 font-normal ml-2">
              ({result.message})
            </span>
          )}
        </button>

        {isExpanded && (
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(result.summary).map(([key, value]) => (
              <div key={key} className="bg-white dark:bg-slate-800 rounded-lg p-2">
                <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                  {formatKey(key)}
                </p>
                <p className="text-sm font-semibold text-slate-800 dark:text-white">
                  {formatValue(value)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
};

// Chart render
const renderChart = (config: AIChartConfig) => {
  const { chartType, title, data, xAxisKey, yAxisKey, colors = COLORS } = config;

  return (
    <div className="mt-2 bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
      <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">{title}</h4>
      <ResponsiveContainer width="100%" height={250}>
        {chartType === 'bar' ? (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey={xAxisKey} tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12px'
              }}
            />
            <Legend />
            <Bar dataKey={yAxisKey as string} fill={colors[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : chartType === 'line' ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey={xAxisKey} tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12px'
              }}
            />
            <Legend />
            <Line type="monotone" dataKey={yAxisKey as string} stroke={colors[0]} strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        ) : chartType === 'pie' ? (
          <PieChart>
            <Pie
              data={data}
              dataKey={yAxisKey as string}
              nameKey={xAxisKey}
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        ) : null}
      </ResponsiveContainer>
    </div>
  );
};

// Table render
const renderTable = (config: AITableConfig) => {
  const { title, columns, data, summary } = config;

  return (
    <div className="mt-2 bg-white dark:bg-slate-800 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">{title}</h4>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-700/50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''
                  }`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {data.slice(0, 10).map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-2 text-slate-700 dark:text-slate-300 ${
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''
                    }`}
                  >
                    {formatCellValue(row[col.key], col.format)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {summary && (
            <tfoot className="bg-slate-100 dark:bg-slate-700 font-medium">
              <tr>
                {columns.map((col, index) => (
                  <td
                    key={col.key}
                    className={`px-4 py-2 text-slate-800 dark:text-white ${
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''
                    }`}
                  >
                    {index === 0 ? 'Toplam' : formatCellValue(summary[col.key], col.format)}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {data.length > 10 && (
        <div className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700">
          {data.length - 10} satır daha...
        </div>
      )}
    </div>
  );
};

// Helper functions
const getToolLabel = (name: string): string => {
  const labels: Record<string, string> = {
    'read_schedule_data': 'Cetvel Verileri',
    'read_muayene_data': 'Muayene Verileri',
    'read_ameliyat_data': 'Ameliyat Verileri',
    'compare_periods': 'Dönem Karşılaştırması',
    'calculate_efficiency': 'Verimlilik Analizi',
    'get_green_area_rates': 'Yeşil Alan Oranları',
    'generate_table': 'Tablo',
    'generate_chart_config': 'Grafik'
  };
  return labels[name] || name;
};

const formatKey = (key: string): string => {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim();
};

const formatValue = (value: any): string => {
  if (typeof value === 'number') {
    return value.toLocaleString('tr-TR');
  }
  return String(value);
};

const formatCellValue = (value: any, format?: string): string => {
  if (value === null || value === undefined) return '-';

  switch (format) {
    case 'number':
      return typeof value === 'number' ? value.toLocaleString('tr-TR') : String(value);
    case 'percent':
      return typeof value === 'number' ? `%${value.toFixed(1)}` : String(value);
    case 'currency':
      return typeof value === 'number' ? `₺${value.toLocaleString('tr-TR')}` : String(value);
    case 'date':
      return value instanceof Date ? value.toLocaleDateString('tr-TR') : String(value);
    default:
      return String(value);
  }
};

export default AIToolResult;
