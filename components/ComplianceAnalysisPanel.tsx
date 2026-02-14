import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import * as XLSX from 'xlsx';
import {
  ComplianceResult,
  ComplianceAnalysisSummary,
  AnalysisProgress,
  RuleLoadStatus,
  UygunlukDurumu,
  ParsedRuleType,
  RuleMasterEntry,
} from '../src/types/complianceTypes';
import { buildRulesMasterFromFirebase, buildRulesMasterHybridFromFirebase, runFullAuditFromFirebase, loadOrExtractRules } from '../src/services/complianceDataLoader';
import { FullAuditResult } from '../src/services/ruleExtractor';
import { getExtractedRulesMetadata } from '../src/services/ai/ruleExtractionAI';
import type { ExtractedRulesMetadata } from '../src/types/complianceTypes';
import { exportResultsToExcel, IslemSatiriLike, KurumBilgisiLike } from '../src/services/complianceEngine';
import type { ComplianceWorkerResponse, SerializedRulesMaster } from '../src/workers/workerProtocol';
import ComplianceDetailModal from './ComplianceDetailModal';

interface ComplianceAnalysisPanelProps {
  tableData: IslemSatiriLike[];
  kurumBilgisi: KurumBilgisiLike | undefined;
  extraColumnKeys?: string[];
}

const PAGE_SIZES = [50, 100, 250, 500];

type SortDirection = 'asc' | 'desc' | null;
type SortableColumn = 'durum' | 'gilKodu' | 'gilAdi' | 'doktor' | 'uzmanlik' | 'ihlal' | 'kaynak' | 'guven' | 'ihlalAciklama';

interface ColumnDef {
  key: SortableColumn;
  label: string;
  minW: string;
  align: 'left' | 'center';
  type: 'text' | 'number';
}

const TABLE_COLUMNS: ColumnDef[] = [
  { key: 'durum', label: 'Durum', minW: '90px', align: 'left', type: 'text' },
  { key: 'gilKodu', label: 'GİL Kodu', minW: '80px', align: 'left', type: 'text' },
  { key: 'gilAdi', label: 'GİL Adı', minW: '200px', align: 'left', type: 'text' },
  { key: 'doktor', label: 'Doktor', minW: '140px', align: 'left', type: 'text' },
  { key: 'uzmanlik', label: 'Uzmanlık', minW: '120px', align: 'left', type: 'text' },
  { key: 'ihlal', label: 'İhlal', minW: '50px', align: 'center', type: 'number' },
  { key: 'kaynak', label: 'Kaynak', minW: '60px', align: 'left', type: 'text' },
  { key: 'guven', label: 'Güven', minW: '60px', align: 'left', type: 'text' },
  { key: 'ihlalAciklama', label: 'İhlal Açıklaması', minW: '200px', align: 'left', type: 'text' },
];

function getColumnValue(result: ComplianceResult, row: IslemSatiriLike, key: SortableColumn): string | number {
  switch (key) {
    case 'durum': return result.uygunluk_durumu;
    case 'gilKodu': return row.gilKodu;
    case 'gilAdi': return row.gilAdi;
    case 'doktor': return row.doktor;
    case 'uzmanlik': return row.uzmanlik;
    case 'ihlal': return result.ihlaller.length;
    case 'kaynak': return result.eslesen_kural?.kaynak || '';
    case 'guven': return result.eslesme_guveni || '';
    case 'ihlalAciklama': return result.ihlaller.map(i => `[${i.ihlal_kodu}] ${i.ihlal_aciklamasi}`).join(' | ');
    default: return '';
  }
}

/* ═══════════════════════════════════════════════════════════════ */
/* Excel Tarzı Filtre Dropdown — Portal ile render edilir        */
/* ═══════════════════════════════════════════════════════════════ */
interface FilterDropdownProps {
  col: ColumnDef;
  anchorRect: DOMRect;
  uniqueVals: Map<string, number>;
  /** Seçili değerler. undefined = hepsi seçili (filtre yok). */
  selectedValues: Set<string> | undefined;
  sortColumn: SortableColumn | null;
  sortDirection: SortDirection;
  onSort: (dir: SortDirection) => void;
  onApply: (selected: Set<string> | undefined) => void;
  onClose: () => void;
}

const FilterDropdown: React.FC<FilterDropdownProps> = ({
  col, anchorRect, uniqueVals, selectedValues, sortColumn, sortDirection,
  onSort, onApply, onClose,
}) => {
  // Dropdown içi local state — "Tamam"a basılana kadar ana state'i etkilemez
  const [localSelected, setLocalSelected] = useState<Set<string>>(() => {
    if (!selectedValues) {
      // Hepsi seçili → tüm değerleri kopyala
      return new Set(uniqueVals.keys());
    }
    return new Set(selectedValues);
  });
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Tüm unique key'ler
  const allKeys = useMemo(() => new Set(uniqueVals.keys()), [uniqueVals]);

  // Arama ile filtrelenmiş + sıralanmış liste
  const sortedEntries = useMemo(() => {
    const term = search.toLowerCase();
    return [...uniqueVals.entries()]
      .filter(([v]) => !term || v.toLowerCase().includes(term))
      .sort((a, b) => col.type === 'number'
        ? Number(a[0]) - Number(b[0])
        : a[0].localeCompare(b[0], 'tr'));
  }, [uniqueVals, search, col.type]);

  const allChecked = localSelected.size === allKeys.size;
  const noneChecked = localSelected.size === 0;

  // Dropdown pozisyonu — ekranın dışına taşmasın
  const style = useMemo((): React.CSSProperties => {
    const dropW = 300;
    let left = anchorRect.left;
    let top = anchorRect.bottom + 4;
    if (left + dropW > window.innerWidth) left = window.innerWidth - dropW - 8;
    if (left < 8) left = 8;
    // Kullanılabilir dikey alan
    const spaceBelow = window.innerHeight - anchorRect.bottom - 8;
    const spaceAbove = anchorRect.top - 8;
    let maxH: number;
    if (spaceBelow >= 340) {
      maxH = Math.min(spaceBelow, 440);
    } else if (spaceAbove > spaceBelow) {
      top = Math.max(8, anchorRect.top - Math.min(spaceAbove, 440));
      maxH = Math.min(spaceAbove, 440);
    } else {
      maxH = Math.min(spaceBelow, 440);
    }
    return { position: 'fixed', left, top, width: dropW, maxHeight: maxH, zIndex: 9999 };
  }, [anchorRect]);

  // Autofocus arama input'u
  useEffect(() => { searchInputRef.current?.focus(); }, []);

  // Dropdown dışına tıklama → kapat
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Bir tick bekle — yoksa açan tıklama hemen kapatır
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler); };
  }, [onClose]);

  // ESC ile kapat
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const toggle = (val: string) => {
    setLocalSelected(prev => {
      const next = new Set(prev);
      if (next.has(val)) next.delete(val);
      else next.add(val);
      return next;
    });
  };

  const selectAll = () => setLocalSelected(new Set(allKeys));
  const deselectAll = () => setLocalSelected(new Set());

  const handleApply = () => {
    // Hepsi seçiliyse → filtre yok (undefined)
    if (localSelected.size === allKeys.size) {
      onApply(undefined);
    } else {
      onApply(new Set(localSelected));
    }
    onClose();
  };

  const isSortAsc = sortColumn === col.key && sortDirection === 'asc';
  const isSortDesc = sortColumn === col.key && sortDirection === 'desc';

  return ReactDOM.createPortal(
    <div ref={dropdownRef} style={{ ...style, background: 'var(--surface-1)', borderColor: 'var(--border-2)' }}
      className="border rounded-xl shadow-2xl shadow-black/60 flex flex-col overflow-hidden"
    >
      {/* Sıralama */}
      <div className="px-3 pt-3 pb-1 flex gap-1">
        <button
          onClick={() => onSort(isSortAsc ? null : 'asc')}
          className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${isSortAsc ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'border-transparent'}`}
          style={!isSortAsc ? { color: 'var(--text-3)' } : undefined}
          onMouseEnter={e => { if (!isSortAsc) { e.currentTarget.style.background = 'var(--input-bg)'; e.currentTarget.style.color = 'var(--text-1)'; }}}
          onMouseLeave={e => { if (!isSortAsc) { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--text-3)'; }}}
        >
          <span>▲</span> {col.type === 'number' ? 'Küçük→Büyük' : 'A→Z'}
        </button>
        <button
          onClick={() => onSort(isSortDesc ? null : 'desc')}
          className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${isSortDesc ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'border-transparent'}`}
          style={!isSortDesc ? { color: 'var(--text-3)' } : undefined}
          onMouseEnter={e => { if (!isSortDesc) { e.currentTarget.style.background = 'var(--input-bg)'; e.currentTarget.style.color = 'var(--text-1)'; }}}
          onMouseLeave={e => { if (!isSortDesc) { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--text-3)'; }}}
        >
          <span>▼</span> {col.type === 'number' ? 'Büyük→Küçük' : 'Z→A'}
        </button>
      </div>

      <div className="border-t mx-2" style={{ borderColor: 'var(--border-2)' }} />

      {/* Arama */}
      <div className="px-3 py-2">
        <input
          ref={searchInputRef}
          type="text" value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`${col.label} ara...`}
          className="w-full border text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
          style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--input-text)' }}
        />
      </div>

      {/* Tümünü Seç / Kaldır */}
      <div className="px-3 pb-1 flex items-center gap-2">
        <button onClick={selectAll} className={`text-[10px] font-bold transition-colors ${allChecked ? 'text-cyan-400' : 'hover:text-cyan-400'}`} style={!allChecked ? { color: 'var(--text-muted)' } : undefined}>
          Tümünü Seç
        </button>
        <span style={{ color: 'var(--border-2)' }}>|</span>
        <button onClick={deselectAll} className={`text-[10px] font-bold transition-colors ${noneChecked ? 'text-red-400' : 'hover:text-red-400'}`} style={!noneChecked ? { color: 'var(--text-muted)' } : undefined}>
          Tümünü Kaldır
        </button>
        <span className="ml-auto text-[9px]" style={{ color: 'var(--text-muted)' }}>{sortedEntries.length} / {uniqueVals.size}</span>
      </div>

      {/* Checkbox listesi */}
      <div className="overflow-y-auto px-1 flex-1 min-h-0">
        {sortedEntries.map(([val, count]) => {
          const checked = localSelected.has(val);
          return (
            <label key={val}
              className="flex items-center gap-2 px-2 py-[3px] rounded-md cursor-pointer transition-colors text-xs"
              style={{ color: checked ? 'var(--text-2)' : 'var(--text-muted)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = ''; }}
            >
              <input type="checkbox" checked={checked} onChange={() => toggle(val)}
                className="w-3 h-3 rounded text-cyan-500 focus:ring-cyan-500/30 focus:ring-1 cursor-pointer accent-cyan-500"
                style={{ borderColor: 'var(--input-border)', background: 'var(--input-bg)' }}
              />
              <span className="truncate flex-1">{val || '(Boş)'}</span>
              <span className="text-[9px] tabular-nums" style={{ color: 'var(--text-muted)' }}>{count}</span>
            </label>
          );
        })}
        {sortedEntries.length === 0 && (
          <div className="text-center text-xs py-3" style={{ color: 'var(--text-muted)' }}>Sonuç bulunamadı</div>
        )}
      </div>

      {/* Alt butonlar: Tamam / İptal */}
      <div className="border-t px-3 py-2 flex items-center gap-2" style={{ borderColor: 'var(--border-2)' }}>
        <button onClick={handleApply}
          className="flex-1 px-3 py-1.5 text-[11px] font-bold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-all"
        >
          Tamam
        </button>
        <button onClick={onClose}
          className="flex-1 px-3 py-1.5 text-[11px] font-bold rounded-lg border transition-all"
          style={{ color: 'var(--text-3)', borderColor: 'var(--border-2)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-1)'; e.currentTarget.style.background = 'var(--surface-2)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.background = ''; }}
        >
          İptal
        </button>
      </div>
    </div>,
    document.body
  );
};

const statusStyles: Record<string, { label: string; color: string; bg: string; border: string; borderL: string }> = {
  UYGUN: { label: 'UYGUN', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', borderL: 'border-l-emerald-500' },
  UYGUNSUZ: { label: 'UYGUNSUZ', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', borderL: 'border-l-red-500' },
  MANUEL_INCELEME: { label: 'MANUEL', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', borderL: 'border-l-amber-500' },
  ESLESEMEDI: { label: 'EŞLEŞMEDİ', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/30', borderL: 'border-l-slate-500' },
};

function formatNumber(val: number, decimals = 0): string {
  return val.toLocaleString('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

const ComplianceAnalysisPanel: React.FC<ComplianceAnalysisPanelProps> = ({ tableData, kurumBilgisi, extraColumnKeys }) => {
  const [ruleLoadStatus, setRuleLoadStatus] = useState<RuleLoadStatus | null>(null);
  const [rulesMaster, setRulesMaster] = useState<Map<string, RuleMasterEntry> | null>(null);
  const [results, setResults] = useState<ComplianceResult[]>([]);
  const [summary, setSummary] = useState<ComplianceAnalysisSummary | null>(null);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [filterDurum, setFilterDurum] = useState<UygunlukDurumu | 'TUMU'>('TUMU');
  const [filterEsleme, setFilterEsleme] = useState<'TUMU' | 'ESLESTI' | 'ESLESEMEDI'>('TUMU');
  const [filterKuralTipi, setFilterKuralTipi] = useState<ParsedRuleType | 'TUMU'>('TUMU');
  const [filterMuaf, setFilterMuaf] = useState<'TUMU' | 'MUAF' | 'MUAF_DEGIL'>('TUMU');
  const [searchTerm, setSearchTerm] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  // ── Sütun sıralama ve filtreleme ──
  const [sortColumn, setSortColumn] = useState<SortableColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  // columnFilters: key → Set<string> (seçili değerler). Key yoksa filtre yok.
  const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>({});
  // Açık dropdown bilgisi: { key, rect } veya null
  const [openFilter, setOpenFilter] = useState<{ key: SortableColumn; rect: DOMRect } | null>(null);

  // Her sütundaki benzersiz değerleri hesapla
  const columnUniqueValues = useMemo(() => {
    const map: Record<string, Map<string, number>> = {};
    for (const col of TABLE_COLUMNS) {
      const valMap = new Map<string, number>();
      for (const r of results) {
        const row = tableData[r.satirIndex];
        if (!row) continue;
        const val = String(getColumnValue(r, row, col.key));
        valMap.set(val, (valMap.get(val) || 0) + 1);
      }
      map[col.key] = valMap;
    }
    return map;
  }, [results, tableData]);

  const handleFilterApply = useCallback((colKey: string, selected: Set<string> | undefined) => {
    setColumnFilters(prev => {
      if (!selected) {
        // Filtre kaldırıldı
        const next = { ...prev };
        delete next[colKey];
        return next;
      }
      return { ...prev, [colKey]: selected };
    });
    setCurrentPage(1);
  }, []);

  const handleSortFromDropdown = useCallback((colKey: SortableColumn, dir: SortDirection) => {
    setSortColumn(dir ? colKey : null);
    setSortDirection(dir);
    setCurrentPage(1);
  }, []);

  const [detailRow, setDetailRow] = useState<IslemSatiriLike | null>(null);
  const [detailResult, setDetailResult] = useState<ComplianceResult | null>(null);

  // Full Audit state
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<FullAuditResult | null>(null);

  // AI API Key state
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasApiKey, setHasApiKey] = useState(() => !!localStorage.getItem('claude_api_key'));
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  const handleSaveApiKey = useCallback(() => {
    if (apiKeyInput.trim()) {
      localStorage.setItem('claude_api_key', apiKeyInput.trim());
      setHasApiKey(true);
      setShowApiKeyInput(false);
      setApiKeyInput('');
    }
  }, [apiKeyInput]);

  const handleRemoveApiKey = useCallback(() => {
    localStorage.removeItem('claude_api_key');
    setHasApiKey(false);
  }, []);

  const tableRef = useRef<HTMLDivElement>(null);

  // Kayıtlı kural metadata'sı
  const [rulesMetadata, setRulesMetadata] = useState<ExtractedRulesMetadata | null>(null);

  const handleLoadRules = useCallback(async (forceExtract: boolean = false) => {
    // Kayıtlı kurallar yoksa ve AI kullanılacaksa API key kontrolü
    if (!localStorage.getItem('claude_api_key')) {
      // Önce kayıtlı kural var mı kontrol et
      const metadata = await getExtractedRulesMetadata();
      if (!metadata && !forceExtract) {
        setShowApiKeyInput(true);
        setProgress({ phase: 'error', current: 0, total: 0, message: 'Kayıtlı kural bulunamadı. İlk çıkarma için Claude API Key gerekli.' });
        return;
      }
    }

    setIsLoading(true);
    setProgress({ phase: 'loading', current: 0, total: 4, message: 'Başlatılıyor...' });
    try {
      const result = await loadOrExtractRules(forceExtract, (p) => setProgress(p));
      setRulesMaster(result.rulesMaster);
      setRuleLoadStatus(result.loadStatus);
      if (result.extractedJSON) {
        const meta = await getExtractedRulesMetadata();
        setRulesMetadata(meta);
      }
      setProgress({
        phase: 'complete', current: 1, total: 1,
        message: `${result.rulesMaster.size.toLocaleString('tr-TR')} kural yüklendi (AI v2.0)`,
      });
    } catch (err: any) {
      console.error('[COMPLIANCE] Kural yükleme hatası:', err);
      const errMsg = String(err?.message || err);
      if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('authentication') || errMsg.includes('401')) {
        setProgress({ phase: 'error', current: 0, total: 0, message: 'API Key geçersiz veya süresi dolmuş. Lütfen yeni bir API Key girin.' });
        setShowApiKeyInput(true);
        // Geçersiz key'i sil
        localStorage.removeItem('claude_api_key');
        setHasApiKey(false);
      } else {
        setProgress({ phase: 'error', current: 0, total: 0, message: `Hata: ${errMsg}` });
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleStartAnalysis = useCallback(async () => {
    if (!rulesMaster || tableData.length === 0) return;
    setIsAnalyzing(true);
    setResults([]);
    setSummary(null);
    setCurrentPage(1);
    try {
      const { results: analysisResults, summary: analysisSummary } = await new Promise<{
        results: ComplianceResult[];
        summary: ComplianceAnalysisSummary;
      }>((resolve, reject) => {
        const worker = new Worker(
          new URL('../src/workers/complianceWorker.ts', import.meta.url),
          { type: 'module' }
        );

        worker.onmessage = (e: MessageEvent<ComplianceWorkerResponse>) => {
          const msg = e.data;
          switch (msg.type) {
            case 'ANALYSIS_PROGRESS':
              setProgress(msg.progress);
              break;
            case 'ANALYSIS_SUCCESS':
              worker.terminate();
              resolve({ results: msg.results, summary: msg.summary });
              break;
            case 'ANALYSIS_ERROR':
              worker.terminate();
              reject(new Error(msg.error));
              break;
          }
        };

        worker.onerror = (err) => {
          worker.terminate();
          reject(new Error(`Worker hatası: ${err.message}`));
        };

        const rulesMasterEntries: SerializedRulesMaster = Array.from(rulesMaster.entries());
        worker.postMessage({
          type: 'RUN_ANALYSIS',
          rows: tableData,
          rulesMasterEntries,
          kurumBilgisi,
        });
      });

      setResults(analysisResults);
      (window as any).__COMPLIANCE_RESULTS__ = analysisResults;
      (window as any).__COMPLIANCE_ROWS__ = tableData;
      setSummary(analysisSummary);
    } catch (err: any) {
      console.error('[COMPLIANCE] Analiz hatası:', err);
      setProgress({ phase: 'error', current: 0, total: 0, message: `Analiz hatası: ${err?.message || err}` });
    } finally {
      setIsAnalyzing(false);
    }
  }, [rulesMaster, tableData, kurumBilgisi]);

  const handleFullAudit = useCallback(async () => {
    if (!localStorage.getItem('claude_api_key')) {
      setShowApiKeyInput(true);
      setProgress({ phase: 'error', current: 0, total: 0, message: 'Full Audit icin Claude API Key gerekli.' });
      return;
    }
    setIsAuditing(true);
    setAuditResult(null);
    setProgress({ phase: 'loading', current: 0, total: 4, message: 'Full Audit baslatiliyor...' });
    try {
      const result = await runFullAuditFromFirebase((p) => setProgress(p));
      setAuditResult(result);
      setProgress({
        phase: 'complete', current: 1, total: 1,
        message: `FULL AUDIT tamamlandi. Eslesen: ${result.matchCount}, AI fazladan: ${result.aiOnlyCount}, Celiski: ${result.conflictCount}`
      });
    } catch (err) {
      console.error('[FULL AUDIT] Hata:', err);
      setProgress({ phase: 'error', current: 0, total: 0, message: `Full Audit hatasi: ${err}` });
    } finally {
      setIsAuditing(false);
    }
  }, []);

  const handleExportAudit = useCallback(() => {
    if (!auditResult) return;
    const jsonStr = JSON.stringify(auditResult, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Full_Audit_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [auditResult]);

  const handleClearAnalysis = useCallback(() => {
    setResults([]);
    setSummary(null);
    setProgress(null);
    setCurrentPage(1);
    setFilterDurum('TUMU');
    setFilterEsleme('TUMU');
    setFilterKuralTipi('TUMU');
    setSearchTerm('');
    setSortColumn(null);
    setSortDirection(null);
    setColumnFilters({});
    setOpenFilter(null);
    setUygunsuzSearchTerm('');
    setUygunsuzCurrentPage(1);
    setSelectedDoktor('TUMU');
  }, []);

  // ─── Hekim Bazlı Uygunsuz İşlemler State ───
  const [uygunsuzSearchTerm, setUygunsuzSearchTerm] = useState('');
  const [uygunsuzCurrentPage, setUygunsuzCurrentPage] = useState(1);
  const [selectedDoktor, setSelectedDoktor] = useState<string>('TUMU');
  const uygunsuzPageSize = 50;
  const uygunsuzTableRef = useRef<HTMLDivElement>(null);

  // Uygunsuz işlem satırlarını oluştur
  const uygunsuzIslemler = useMemo(() => {
    if (results.length === 0) return [];
    const items: {
      row: IslemSatiriLike;
      result: ComplianceResult;
      ihlalDetay: string;
      ihlalKodlari: string;
      referansMetin: string;
    }[] = [];
    for (const r of results) {
      if (r.uygunluk_durumu !== 'UYGUNSUZ') continue;
      const row = tableData[r.satirIndex];
      if (!row) continue;
      items.push({
        row,
        result: r,
        ihlalDetay: r.ihlaller.map(i => `[${i.ihlal_kodu}] ${i.ihlal_aciklamasi}`).join(' | '),
        ihlalKodlari: r.ihlaller.map(i => i.ihlal_kodu).join(', '),
        referansMetin: r.ihlaller.map(i => i.referans_kural_metni).filter(Boolean).join(' | '),
      });
    }
    return items;
  }, [results, tableData]);

  // Doktor listesi (uygunsuz olanlar)
  const doktorListesi = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of uygunsuzIslemler) {
      const dr = item.row.doktor || 'Bilinmeyen';
      map.set(dr, (map.get(dr) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [uygunsuzIslemler]);

  // Filtrelenmiş uygunsuz işlemler
  const filteredUygunsuz = useMemo(() => {
    let filtered = uygunsuzIslemler;
    if (selectedDoktor !== 'TUMU') {
      filtered = filtered.filter(item => item.row.doktor === selectedDoktor);
    }
    if (uygunsuzSearchTerm.trim()) {
      const term = uygunsuzSearchTerm.toLowerCase();
      filtered = filtered.filter(item => {
        return (
          item.row.islemNo.toLowerCase().includes(term) ||
          item.row.adiSoyadi.toLowerCase().includes(term) ||
          item.row.hastaTc.includes(term) ||
          item.row.doktor.toLowerCase().includes(term) ||
          item.row.gilKodu.toLowerCase().includes(term) ||
          item.row.gilAdi.toLowerCase().includes(term) ||
          item.row.uzmanlik.toLowerCase().includes(term) ||
          item.ihlalDetay.toLowerCase().includes(term)
        );
      });
    }
    return filtered;
  }, [uygunsuzIslemler, selectedDoktor, uygunsuzSearchTerm]);

  const uygunsuzTotalPages = Math.ceil(filteredUygunsuz.length / uygunsuzPageSize);
  const paginatedUygunsuz = useMemo(() => {
    const start = (uygunsuzCurrentPage - 1) * uygunsuzPageSize;
    return filteredUygunsuz.slice(start, start + uygunsuzPageSize);
  }, [filteredUygunsuz, uygunsuzCurrentPage, uygunsuzPageSize]);

  const goToUygunsuzPage = (page: number) => {
    setUygunsuzCurrentPage(page);
    uygunsuzTableRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Hekim Bazlı Uygunsuz İşlemler Excel Export
  const handleExportUygunsuz = useCallback(() => {
    if (filteredUygunsuz.length === 0) return;
    const exportData: any[][] = [];
    exportData.push([
      'İşlem No', 'Hasta Adı Soyadı', 'Hasta TC', 'Tarih', 'Saat',
      'Doktor Adı', 'Uzmanlık', 'GİL Kodu', 'GİL Adı',
      'İhlal Kodları', 'İhlal Açıklaması', 'Referans Kural Metni'
    ]);
    for (const item of filteredUygunsuz) {
      exportData.push([
        item.row.islemNo,
        item.row.adiSoyadi,
        item.row.hastaTc,
        item.row.tarih,
        item.row.saat,
        item.row.doktor,
        item.row.uzmanlik,
        item.row.gilKodu,
        item.row.gilAdi,
        item.ihlalKodlari,
        item.ihlalDetay,
        item.referansMetin,
      ]);
    }
    const ws = XLSX.utils.aoa_to_sheet(exportData);
    // Sütun genişlikleri
    ws['!cols'] = [
      { wch: 14 }, { wch: 24 }, { wch: 14 }, { wch: 12 }, { wch: 8 },
      { wch: 22 }, { wch: 28 }, { wch: 12 }, { wch: 40 },
      { wch: 16 }, { wch: 60 }, { wch: 60 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Uygunsuz İşlemler');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const doktorSuffix = selectedDoktor !== 'TUMU' ? `_${selectedDoktor.replace(/\s+/g, '_')}` : '';
    a.download = `Uygunsuz_Islemler${doktorSuffix}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredUygunsuz, selectedDoktor]);

  const handleExport = useCallback(() => {
    if (results.length === 0) return;
    const ab = exportResultsToExcel(tableData, results, extraColumnKeys);
    const blob = new Blob([ab], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Uygunluk_Analizi_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }, [results, tableData]);

  const filteredResults = useMemo(() => {
    let filtered = results;
    if (filterDurum !== 'TUMU') filtered = filtered.filter(r => r.uygunluk_durumu === filterDurum);
    if (filterEsleme !== 'TUMU') filtered = filtered.filter(r => r.eslesmeDurumu === filterEsleme);
    if (filterKuralTipi !== 'TUMU') filtered = filtered.filter(r => r.ihlaller.some(i => i.kural_tipi === filterKuralTipi));
    if (filterMuaf === 'MUAF') filtered = filtered.filter(r => r.isMuaf === true);
    else if (filterMuaf === 'MUAF_DEGIL') filtered = filtered.filter(r => r.isMuaf !== true);
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r => {
        const row = tableData[r.satirIndex];
        if (!row) return false;
        return row.gilKodu.toLowerCase().includes(term) || row.gilAdi.toLowerCase().includes(term) || row.doktor.toLowerCase().includes(term) || row.uzmanlik.toLowerCase().includes(term) || row.hastaTc.includes(term) || row.adiSoyadi.toLowerCase().includes(term);
      });
    }
    // Sütun bazlı filtreler (Excel tarzı checkbox seçim)
    const activeColFilters = Object.entries(columnFilters);
    if (activeColFilters.length > 0) {
      filtered = filtered.filter(r => {
        const row = tableData[r.satirIndex];
        if (!row) return false;
        return activeColFilters.every(([colKey, allowedSet]) => {
          if (allowedSet.size === 0) return false; // Hiçbir şey seçili değil
          const val = String(getColumnValue(r, row, colKey as SortableColumn));
          return allowedSet.has(val);
        });
      });
    }
    // Sıralama
    if (sortColumn && sortDirection) {
      filtered = [...filtered].sort((a, b) => {
        const rowA = tableData[a.satirIndex];
        const rowB = tableData[b.satirIndex];
        if (!rowA || !rowB) return 0;
        const valA = getColumnValue(a, rowA, sortColumn);
        const valB = getColumnValue(b, rowB, sortColumn);
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        }
        const cmp = String(valA).localeCompare(String(valB), 'tr');
        return sortDirection === 'asc' ? cmp : -cmp;
      });
    }
    return filtered;
  }, [results, filterDurum, filterEsleme, filterKuralTipi, filterMuaf, searchTerm, tableData, columnFilters, sortColumn, sortDirection]);

  const totalPages = Math.ceil(filteredResults.length / pageSize);
  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredResults.slice(start, start + pageSize);
  }, [filteredResults, currentPage, pageSize]);

  const goToPage = (page: number) => {
    setCurrentPage(page);
    tableRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const progressPercent = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  const canAnalyze = rulesMaster && rulesMaster.size > 0 && tableData.length > 0 && !isAnalyzing;

  return (
    <div className="space-y-4">

      {/* Kural Yükleme Durumu */}
      <div className="backdrop-blur-xl rounded-2xl border p-5" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Kural Veritabanı</span>
          </div>
          {/* API Key Yönetimi */}
          {!hasApiKey && !showApiKeyInput && (
            <button
              onClick={() => setShowApiKeyInput(true)}
              className="px-3 py-1.5 text-xs font-bold rounded-lg border bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-all flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              API Key
            </button>
          )}
          {hasApiKey && (
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-1 text-xs font-bold rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">Key Aktif</span>
              <button onClick={handleRemoveApiKey} className="p-1 hover:text-red-400 transition-colors" style={{ color: 'var(--text-muted)' }} title="API Key Sil">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          )}
          <button onClick={() => handleLoadRules(false)} disabled={isLoading} className="px-4 py-1.5 text-xs font-bold bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
            {isLoading ? (
              <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>Yükleniyor...</>
            ) : ruleLoadStatus ? (
              <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>Yenile</>
            ) : (
              <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>Kuralları Yükle</>
            )}
          </button>
          {ruleLoadStatus && (
            <button onClick={() => handleLoadRules(true)} disabled={isLoading} className="px-3 py-1.5 text-xs font-bold bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5" title="Kuralları AI ile sıfırdan yeniden oluştur">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              Yeniden Oluştur
            </button>
          )}
        </div>

        {/* API Key Input */}
        {showApiKeyInput && (
          <div className="mt-3 flex items-center gap-2 p-3 rounded-lg border border-blue-500/20" style={{ background: 'var(--surface-2)' }}>
            <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey()}
              placeholder="Claude API Key (sk-ant-...)"
              className="flex-1 px-3 py-1.5 text-xs border rounded-md focus:outline-none focus:border-blue-500/50"
              style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text-2)' }}
            />
            <button onClick={handleSaveApiKey} className="px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-all">Kaydet</button>
            <button onClick={() => { setShowApiKeyInput(false); setApiKeyInput(''); }} className="px-3 py-1.5 text-xs font-bold rounded-md transition-all" style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}>İptal</button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {[
            { key: 'ek2b', label: 'EK-2B', status: ruleLoadStatus?.ek2b },
            { key: 'ek2c', label: 'EK-2C', status: ruleLoadStatus?.ek2c },
            { key: 'ek2cd', label: 'EK-2Ç', status: ruleLoadStatus?.ek2cd },
            { key: 'gil', label: 'GİL', status: ruleLoadStatus?.gil },
            { key: 'sut', label: 'SUT', status: ruleLoadStatus?.sut },
          ].map(src => (
            <div key={src.key} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border ${src.status?.loaded ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : ''}`} style={!src.status?.loaded ? { background: 'var(--surface-2)', borderColor: 'var(--border-2)', color: 'var(--text-muted)' } : undefined}>
              {src.status?.loaded ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
              )}
              {src.label}
              {src.status?.loaded && <span className="text-[10px] font-normal ml-1" style={{ color: 'var(--text-muted)' }}>({src.status.count.toLocaleString('tr-TR')})</span>}
            </div>
          ))}
          {rulesMaster && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-500/10 border border-purple-500/20 text-purple-400 ml-auto">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>
              {rulesMaster.size.toLocaleString('tr-TR')} benzersiz kural
            </div>
          )}
        </div>

        {/* Kayıtlı Kural Metadata Bilgisi */}
        {rulesMetadata && (
          <div className="mt-3 p-3 rounded-lg border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border-2)' }}>
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Kayıtlı Kural Bilgisi</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
              <span>Versiyon: <span className="font-bold" style={{ color: 'var(--text-2)' }}>{rulesMetadata.version}</span></span>
              <span>Oluşturulma: <span className="font-bold" style={{ color: 'var(--text-2)' }}>{new Date(rulesMetadata.createdAt).toLocaleDateString('tr-TR')} {new Date(rulesMetadata.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span></span>
              <span>Toplam İşlem: <span className="font-bold" style={{ color: 'var(--text-2)' }}>{rulesMetadata.stats.totalProcedures.toLocaleString('tr-TR')}</span></span>
              <span>Çıkarılan Kural: <span className="font-bold" style={{ color: 'var(--text-2)' }}>{rulesMetadata.stats.rulesExtracted.toLocaleString('tr-TR')}</span></span>
              {rulesMetadata.stats.crossRefsResolved > 0 && (
                <span>Çapraz Referans: <span className="font-bold" style={{ color: 'var(--text-2)' }}>{rulesMetadata.stats.crossRefsResolved.toLocaleString('tr-TR')}</span></span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Analiz Kontrol */}
      <div className="backdrop-blur-xl rounded-2xl border p-5" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }}>
        <div className="flex items-center gap-3">
          <button onClick={handleStartAnalysis} disabled={!canAnalyze} className="px-6 py-2.5 text-sm font-black bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl hover:from-amber-500 hover:to-orange-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
            Analiz Baslat
          </button>
          <button onClick={handleFullAudit} disabled={isAuditing || isLoading} className="px-5 py-2.5 text-sm font-bold bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:from-violet-500 hover:to-purple-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-violet-500/20 flex items-center gap-2">
            {isAuditing ? (
              <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>Denetim...</>
            ) : (
              <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>Tam Denetim (AI)</>
            )}
          </button>
          {results.length > 0 && (
            <>
              <button onClick={handleClearAnalysis} className="px-4 py-2.5 text-sm font-semibold rounded-xl transition-all flex items-center gap-2" style={{ color: 'var(--text-3)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-1)'; e.currentTarget.style.background = 'var(--surface-2)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.background = ''; }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Temizle
              </button>
              <button onClick={handleExport} className="px-4 py-2.5 text-sm font-semibold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-xl transition-all flex items-center gap-2 ml-auto">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Excel İndir
              </button>
            </>
          )}
        </div>
        {(isLoading || isAnalyzing || isAuditing) && progress && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>{progress.message}</span>
              <span className="text-xs font-bold text-amber-400">{progressPercent}%</span>
            </div>
            <div className="w-full rounded-full h-2" style={{ background: 'var(--surface-3)' }}>
              <div className={`h-2 rounded-full transition-all duration-300 ${
                progress.phase === 'ai-extraction'
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500'
              }`} style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        )}
        {!rulesMaster && !isLoading && (
          <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>Önce kuralları yükleyin, sonra analiz başlatın.</p>
        )}
      </div>

      {/* Özet Dashboard */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <SummaryCard label="Toplam Analiz" value={formatNumber(summary.toplamAnaliz)} color="--text-1" />
          <SummaryCard label="Uygun" value={formatNumber(summary.uygunSayisi)} color="text-emerald-400" sub={`%${summary.toplamAnaliz > 0 ? Math.round(summary.uygunSayisi / summary.toplamAnaliz * 100) : 0}`} />
          <SummaryCard label="Uygunsuz" value={formatNumber(summary.uygunsuzSayisi)} color="text-red-400" sub={`%${summary.toplamAnaliz > 0 ? Math.round(summary.uygunsuzSayisi / summary.toplamAnaliz * 100) : 0}`} />
          <SummaryCard label="Manuel İnceleme" value={formatNumber(summary.manuelIncelemeSayisi)} color="text-amber-400" sub={`%${summary.toplamAnaliz > 0 ? Math.round(summary.manuelIncelemeSayisi / summary.toplamAnaliz * 100) : 0}`} />
          <SummaryCard label="Eşleşen" value={formatNumber(summary.eslesenSayisi)} color="text-blue-400" />
          <SummaryCard label="Eşleşmeyen" value={formatNumber(summary.eslesemeyenSayisi)} color="--text-3" />
          <SummaryCard label="Muaf İşlem" value={formatNumber(summary.muafIslemSayisi)} color="text-violet-400" />
        </div>
      )}

      {/* Full Audit Sonuçları */}
      {auditResult && (
        <div className="backdrop-blur-xl rounded-2xl border border-violet-500/30 p-5 space-y-4" style={{ background: 'var(--surface-1)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              <span className="text-sm font-bold text-violet-400">Full Audit Sonuclari</span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>({auditResult.timestamp.slice(0, 10)})</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleExportAudit} className="px-3 py-1.5 text-xs font-bold text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 rounded-lg transition-all flex items-center gap-1.5 border border-violet-500/20">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                JSON Indir
              </button>
              <button onClick={() => setAuditResult(null)} className="px-3 py-1.5 text-xs font-bold rounded-lg transition-all" style={{ color: 'var(--text-muted)' }}>
                Kapat
              </button>
            </div>
          </div>

          {/* Özet Kartları */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            <div className="rounded-lg p-3 border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border-2)' }}>
              <p className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Toplam Entry</p>
              <p className="text-lg font-black" style={{ color: 'var(--text-1)' }}>{auditResult.totalEntries.toLocaleString('tr-TR')}</p>
            </div>
            <div className="rounded-lg p-3 border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border-2)' }}>
              <p className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>AI Analiz</p>
              <p className="text-lg font-black text-blue-400">{auditResult.uniqueTextsAnalyzed.toLocaleString('tr-TR')}</p>
            </div>
            <div className="bg-emerald-500/5 rounded-lg p-3 border border-emerald-500/20">
              <p className="text-[10px] font-bold text-emerald-500 uppercase">Eslesen</p>
              <p className="text-lg font-black text-emerald-400">{auditResult.matchCount.toLocaleString('tr-TR')}</p>
            </div>
            <div className="bg-cyan-500/5 rounded-lg p-3 border border-cyan-500/20">
              <p className="text-[10px] font-bold text-cyan-500 uppercase">AI Fazladan</p>
              <p className="text-lg font-black text-cyan-400">{auditResult.aiOnlyCount.toLocaleString('tr-TR')}</p>
            </div>
            <div className="bg-red-500/5 rounded-lg p-3 border border-red-500/20">
              <p className="text-[10px] font-bold text-red-500 uppercase">Celiski</p>
              <p className="text-lg font-black text-red-400">{auditResult.conflictCount.toLocaleString('tr-TR')}</p>
            </div>
            <div className="bg-amber-500/5 rounded-lg p-3 border border-amber-500/20">
              <p className="text-[10px] font-bold text-amber-500 uppercase">Regex Fazladan</p>
              <p className="text-lg font-black text-amber-400">{auditResult.regexOnlyCount.toLocaleString('tr-TR')}</p>
            </div>
          </div>

          {/* Regex'in Kaçırdığı Pattern'ler */}
          {auditResult.regexMissedPatterns.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">AI'in Bulup Regex'in Kacirdigi Pattern'ler (Regex'e eklenecek)</h4>
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto custom-scrollbar-compliance">
                {auditResult.regexMissedPatterns.slice(0, 20).map((p, i) => (
                  <div key={i} className="rounded-lg p-2.5 border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border-2)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-cyan-400">{p.pattern}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: 'var(--text-muted)', background: 'var(--surface-3)' }}>{p.count}x</span>
                    </div>
                    <div className="space-y-0.5">
                      {p.examples.map((ex, j) => (
                        <p key={j} className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{ex}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Çelişkiler (en önemli) */}
          {auditResult.entries.filter(e => e.status === 'conflict').length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2">Celiskiler — Regex ve AI farkli sonuc uretti ({auditResult.entries.filter(e => e.status === 'conflict').length} adet)</h4>
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto custom-scrollbar-compliance">
                {auditResult.entries.filter(e => e.status === 'conflict').slice(0, 30).map((entry, i) => (
                  <div key={i} className="bg-red-500/5 rounded-lg p-2.5 border border-red-500/20">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-red-400">{entry.islem_kodu}</span>
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{entry.kaynak}</span>
                      <span className="text-xs truncate flex-1" style={{ color: 'var(--text-3)' }}>{entry.islem_adi}</span>
                    </div>
                    <p className="text-[10px] mb-1 truncate" style={{ color: 'var(--text-muted)' }}>{entry.aciklama_raw.substring(0, 150)}</p>
                    {entry.diffs.filter(d => d.source === 'conflict').map((d, j) => (
                      <p key={j} className="text-[10px] text-red-300">{d.description}</p>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Fazladan Bulunanlar */}
          {auditResult.entries.filter(e => e.status === 'ai_only').length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">AI Fazladan Buldugu Kurallar — Regex kaciyor ({auditResult.entries.filter(e => e.status === 'ai_only').length} adet)</h4>
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto custom-scrollbar-compliance">
                {auditResult.entries.filter(e => e.status === 'ai_only').slice(0, 30).map((entry, i) => (
                  <div key={i} className="bg-cyan-500/5 rounded-lg p-2.5 border border-cyan-500/20">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-cyan-400">{entry.islem_kodu}</span>
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{entry.kaynak}</span>
                      <span className="text-xs truncate flex-1" style={{ color: 'var(--text-3)' }}>{entry.islem_adi}</span>
                    </div>
                    <p className="text-[10px] mb-1 truncate" style={{ color: 'var(--text-muted)' }}>{entry.aciklama_raw.substring(0, 150)}</p>
                    {entry.diffs.filter(d => d.source === 'ai_only').map((d, j) => (
                      <p key={j} className="text-[10px] text-cyan-300">{d.description}</p>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filtre Bar */}
      {results.length > 0 && (
        <div className="backdrop-blur-xl rounded-2xl border p-4 flex flex-wrap gap-3 items-center" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }}>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Durum:</label>
            <select value={filterDurum} onChange={e => { setFilterDurum(e.target.value as any); setCurrentPage(1); }} className="border text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500/50" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--input-text)' }}>
              <option value="TUMU">Tümü</option>
              <option value="UYGUN">Uygun</option>
              <option value="UYGUNSUZ">Uygunsuz</option>
              <option value="MANUEL_INCELEME">Manuel</option>
              <option value="ESLESEMEDI">Eşleşmedi</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Eşleşme:</label>
            <select value={filterEsleme} onChange={e => { setFilterEsleme(e.target.value as any); setCurrentPage(1); }} className="border text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500/50" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--input-text)' }}>
              <option value="TUMU">Tümü</option>
              <option value="ESLESTI">Eşleşti</option>
              <option value="ESLESEMEDI">Eşleşemedi</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Kural:</label>
            <select value={filterKuralTipi} onChange={e => { setFilterKuralTipi(e.target.value as any); setCurrentPage(1); }} className="border text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500/50" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--input-text)' }}>
              <option value="TUMU">Tümü</option>
              <option value="BASAMAK_KISITI">Basamak</option>
              <option value="BRANS_KISITI">Branş</option>
              <option value="BIRLIKTE_YAPILAMAZ">Birlikte</option>
              <option value="SIKLIK_LIMIT">Sıklık</option>
              <option value="TANI_KOSULU">Tanı</option>
              <option value="YAS_KISITI">Yaş</option>
              <option value="DIS_TEDAVI">Diş</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Muaf:</label>
            <select value={filterMuaf} onChange={e => { setFilterMuaf(e.target.value as any); setCurrentPage(1); }} className="border text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500/50" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--input-text)' }}>
              <option value="TUMU">Tümü</option>
              <option value="MUAF">Muaf</option>
              <option value="MUAF_DEGIL">Muaf Değil</option>
            </select>
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <svg className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} placeholder="GİL kodu, doktor, hasta..." className="flex-1 border text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500/50" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--input-text)' }} />
          </div>
          <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>{filteredResults.length.toLocaleString('tr-TR')} sonuç</span>
        </div>
      )}

      {/* Sonuç Tablosu */}
      {results.length > 0 && (
        <>
          <div className="backdrop-blur-xl rounded-t-2xl border border-b-0 px-5 py-3 flex items-center justify-between" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }}>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{filteredResults.length.toLocaleString('tr-TR')} sonuç / {results.length.toLocaleString('tr-TR')} toplam</span>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Göster:</span>
              <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} className="border text-xs rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-500/50" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--input-text)' }}>
                {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div ref={tableRef} className="border overflow-auto max-h-[500px] custom-scrollbar-compliance" style={{ background: 'var(--bg-app)', borderColor: 'var(--border-2)' }}>
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="border-b" style={{ background: 'var(--surface-2)', borderColor: 'var(--border-2)' }}>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold text-amber-400 uppercase tracking-wider w-[40px]">#</th>
                  {TABLE_COLUMNS.map(col => {
                    const hasFilter = !!columnFilters[col.key];
                    const isActive = sortColumn === col.key || hasFilter;

                    return (
                      <th key={col.key} className={`px-3 py-2.5 text-${col.align} text-[10px] font-bold uppercase tracking-wider min-w-[${col.minW}] ${isActive ? 'text-cyan-400' : 'text-amber-400'}`}>
                        <button
                          onClick={(e) => {
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setOpenFilter(prev => prev?.key === col.key ? null : { key: col.key, rect });
                          }}
                          className="flex items-center gap-1 hover:text-white transition-colors w-full"
                        >
                          <span>{col.label}</span>
                          {sortColumn === col.key && sortDirection === 'asc' && <span className="text-cyan-400 text-[8px]">▲</span>}
                          {sortColumn === col.key && sortDirection === 'desc' && <span className="text-cyan-400 text-[8px]">▼</span>}
                          {hasFilter && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />}
                          <svg className={`w-2.5 h-2.5 ${isActive ? 'opacity-80' : 'opacity-40'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              {/* Excel filtre dropdown — Portal ile body'ye render edilir */}
              {openFilter && (() => {
                const col = TABLE_COLUMNS.find(c => c.key === openFilter.key)!;
                const uniqueVals = columnUniqueValues[col.key] || new Map();
                return (
                  <FilterDropdown
                    key={col.key}
                    col={col}
                    anchorRect={openFilter.rect}
                    uniqueVals={uniqueVals}
                    selectedValues={columnFilters[col.key]}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    onSort={(dir) => handleSortFromDropdown(col.key, dir)}
                    onApply={(selected) => handleFilterApply(col.key, selected)}
                    onClose={() => setOpenFilter(null)}
                  />
                );
              })()}
              <tbody>
                {paginatedResults.map((result, idx) => {
                  const row = tableData[result.satirIndex];
                  if (!row) return null;
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  const st = statusStyles[result.uygunluk_durumu] || statusStyles.UYGUN;
                  return (
                    <tr key={idx} onClick={() => { setDetailRow(row); setDetailResult(result); }} className={`border-b transition-colors cursor-pointer border-l-2 ${st.borderL}`} style={{ borderBottomColor: 'var(--border-2)', background: idx % 2 === 0 ? 'var(--table-row-alt-bg)' : 'var(--bg-app)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--table-row-hover)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = idx % 2 === 0 ? 'var(--table-row-alt-bg)' : 'var(--bg-app)'; }}
                    >
                      <td className="px-3 py-1.5 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{globalIdx}</td>
                      <td className="px-3 py-1.5"><span className={`text-[10px] font-black px-2 py-0.5 rounded ${st.color} ${st.bg} border ${st.border}`}>{st.label}</span></td>
                      <td className="px-3 py-1.5 text-xs font-mono" style={{ color: 'var(--text-2)' }}>{row.gilKodu}</td>
                      <td className="px-3 py-1.5 text-xs truncate max-w-[250px]" style={{ color: 'var(--text-3)' }}>{row.gilAdi}</td>
                      <td className="px-3 py-1.5 text-xs truncate max-w-[160px]" style={{ color: 'var(--text-3)' }}>{row.doktor}</td>
                      <td className="px-3 py-1.5 text-xs truncate max-w-[140px]" style={{ color: 'var(--text-muted)' }}>{row.uzmanlik}</td>
                      <td className="px-3 py-1.5 text-xs text-center">{result.ihlaller.length > 0 ? <span className="text-red-400 font-bold">{result.ihlaller.length}</span> : <span style={{ color: 'var(--text-muted)' }}>0</span>}</td>
                      <td className="px-3 py-1.5 text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>{result.eslesen_kural?.kaynak || '—'}</td>
                      <td className="px-3 py-1.5" title={result.guvenNedeni || ''}><span className={`text-[10px] font-bold ${result.eslesme_guveni === 'Yüksek' ? 'text-emerald-400' : result.eslesme_guveni === 'Orta' ? 'text-amber-400' : 'text-red-400'}`}>{result.eslesme_guveni}</span></td>
                      <td className="px-3 py-1.5 text-xs truncate max-w-[250px]" style={{ color: 'var(--text-muted)' }}>
                        {result.ihlaller.length > 0
                          ? result.ihlaller.map(i => `[${i.ihlal_kodu}] ${i.ihlal_aciklamasi}`).join(' | ').substring(0, 120) + (result.ihlaller.map(i => i.ihlal_aciklamasi).join('').length > 120 ? '...' : '')
                          : result.eslesmeDurumu === 'ESLESEMEDI' ? 'Kural eşleşmesi bulunamadı' : '—'
                        }
                      </td>
                    </tr>
                  );
                })}
                {paginatedResults.length === 0 && (
                  <tr>
                    <td colSpan={TABLE_COLUMNS.length + 1} className="px-4 py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                      Filtre kriterlerine uygun sonuç bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Sayfalama */}
          {totalPages > 1 && (
            <div className="backdrop-blur-xl rounded-b-2xl border border-t-0 px-5 py-3 flex items-center justify-between" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{((currentPage - 1) * pageSize + 1).toLocaleString('tr-TR')} - {Math.min(currentPage * pageSize, filteredResults.length).toLocaleString('tr-TR')} / {filteredResults.length.toLocaleString('tr-TR')} sonuç</p>
              <div className="flex items-center gap-1">
                <button onClick={() => goToPage(1)} disabled={currentPage === 1} className="px-2 py-1 text-xs rounded disabled:opacity-30 disabled:cursor-not-allowed transition-all" style={{ color: 'var(--text-3)' }}>{'««'}</button>
                <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} className="px-2 py-1 text-xs rounded disabled:opacity-30 disabled:cursor-not-allowed transition-all" style={{ color: 'var(--text-3)' }}>{'«'}</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let page: number;
                  if (totalPages <= 5) page = i + 1;
                  else if (currentPage <= 3) page = i + 1;
                  else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
                  else page = currentPage - 2 + i;
                  return (
                    <button key={page} onClick={() => goToPage(page)} className={`px-2.5 py-1 text-xs rounded transition-all ${currentPage === page ? 'bg-amber-600 text-white font-bold' : ''}`} style={currentPage !== page ? { color: 'var(--text-3)' } : undefined}>{page}</button>
                  );
                })}
                <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} className="px-2 py-1 text-xs rounded disabled:opacity-30 disabled:cursor-not-allowed transition-all" style={{ color: 'var(--text-3)' }}>{'»'}</button>
                <button onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages} className="px-2 py-1 text-xs rounded disabled:opacity-30 disabled:cursor-not-allowed transition-all" style={{ color: 'var(--text-3)' }}>{'»»'}</button>
              </div>
            </div>
          )}
          {totalPages <= 1 && <div className="backdrop-blur-xl rounded-b-2xl border border-t-0 h-2" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }} />}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* Hekim Bazlı Uygunsuz İşlemler Tablosu */}
      {/* ═══════════════════════════════════════════════════════ */}
      {uygunsuzIslemler.length > 0 && (
        <div className="space-y-0">
          {/* Başlık + Kontroller */}
          <div className="backdrop-blur-xl rounded-t-2xl border border-b-0 border-red-500/20 p-5" style={{ background: 'var(--surface-1)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-black text-red-400 uppercase tracking-wider">Hekim Bazlı Uygunsuz İşlemler</h3>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {uygunsuzIslemler.length.toLocaleString('tr-TR')} uygunsuz işlem · {doktorListesi.length} hekim
                  </p>
                </div>
              </div>
              <button
                onClick={handleExportUygunsuz}
                className="px-4 py-2 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all flex items-center gap-2 border border-red-500/20"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Excel İndir
              </button>
            </div>

            {/* Filtreler */}
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Hekim:</label>
                <select
                  value={selectedDoktor}
                  onChange={e => { setSelectedDoktor(e.target.value); setUygunsuzCurrentPage(1); }}
                  className="border text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-500/50 max-w-[220px]"
                  style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--input-text)' }}
                >
                  <option value="TUMU">Tüm Hekimler ({uygunsuzIslemler.length})</option>
                  {doktorListesi.map(([dr, count]) => (
                    <option key={dr} value={dr}>{dr} ({count})</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <svg className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={uygunsuzSearchTerm}
                  onChange={e => { setUygunsuzSearchTerm(e.target.value); setUygunsuzCurrentPage(1); }}
                  placeholder="İşlem no, hasta, GİL kodu, doktor, ihlal..."
                  className="flex-1 border text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-500/50"
                  style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--input-text)' }}
                />
              </div>
              <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>{filteredUygunsuz.length.toLocaleString('tr-TR')} sonuç</span>
            </div>
          </div>

          {/* Tablo */}
          <div ref={uygunsuzTableRef} className="border border-red-500/20 border-t-0 overflow-auto max-h-[500px] custom-scrollbar-compliance" style={{ background: 'var(--bg-app)' }}>
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-red-500/20" style={{ background: 'var(--surface-2)' }}>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold text-red-400 uppercase tracking-wider w-[40px]">#</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold text-red-400 uppercase tracking-wider min-w-[100px]">İşlem No</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold text-red-400 uppercase tracking-wider min-w-[160px]">Hasta Adı Soyadı</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold text-red-400 uppercase tracking-wider min-w-[110px]">Hasta TC</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold text-red-400 uppercase tracking-wider min-w-[85px]">Tarih</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold text-red-400 uppercase tracking-wider min-w-[55px]">Saat</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold text-red-400 uppercase tracking-wider min-w-[140px]">Doktor Adı</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold text-red-400 uppercase tracking-wider min-w-[120px]">Uzmanlık</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold text-red-400 uppercase tracking-wider min-w-[80px]">GİL Kodu</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold text-red-400 uppercase tracking-wider min-w-[200px]">GİL Adı</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold text-red-400 uppercase tracking-wider min-w-[250px]">İhlal Detayı</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUygunsuz.map((item, idx) => {
                  const globalIdx = (uygunsuzCurrentPage - 1) * uygunsuzPageSize + idx + 1;
                  return (
                    <tr
                      key={idx}
                      onClick={() => { setDetailRow(item.row); setDetailResult(item.result); }}
                      className="border-b hover:bg-red-500/5 transition-colors cursor-pointer border-l-2 border-l-red-500"
                      style={{ borderBottomColor: 'var(--border-2)', background: idx % 2 === 0 ? 'var(--table-row-alt-bg)' : 'var(--bg-app)' }}
                    >
                      <td className="px-3 py-1.5 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{globalIdx}</td>
                      <td className="px-3 py-1.5 text-xs font-mono" style={{ color: 'var(--text-2)' }}>{item.row.islemNo}</td>
                      <td className="px-3 py-1.5 text-xs" style={{ color: 'var(--text-2)' }}>{item.row.adiSoyadi}</td>
                      <td className="px-3 py-1.5 text-xs font-mono" style={{ color: 'var(--text-3)' }}>{item.row.hastaTc}</td>
                      <td className="px-3 py-1.5 text-xs" style={{ color: 'var(--text-3)' }}>{item.row.tarih}</td>
                      <td className="px-3 py-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>{item.row.saat}</td>
                      <td className="px-3 py-1.5 text-xs truncate max-w-[160px]" style={{ color: 'var(--text-2)' }}>{item.row.doktor}</td>
                      <td className="px-3 py-1.5 text-xs truncate max-w-[140px]" style={{ color: 'var(--text-muted)' }}>{item.row.uzmanlik}</td>
                      <td className="px-3 py-1.5 text-xs font-mono" style={{ color: 'var(--text-2)' }}>{item.row.gilKodu}</td>
                      <td className="px-3 py-1.5 text-xs truncate max-w-[250px]" style={{ color: 'var(--text-3)' }}>{item.row.gilAdi}</td>
                      <td className="px-3 py-1.5 text-xs text-red-400/80 truncate max-w-[300px]" title={item.ihlalDetay}>
                        {item.ihlalDetay.length > 120 ? item.ihlalDetay.substring(0, 120) + '...' : item.ihlalDetay}
                      </td>
                    </tr>
                  );
                })}
                {paginatedUygunsuz.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                      Filtre kriterlerine uygun uygunsuz işlem bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Sayfalama */}
          {uygunsuzTotalPages > 1 && (
            <div className="backdrop-blur-xl rounded-b-2xl border border-t-0 border-red-500/20 px-5 py-3 flex items-center justify-between" style={{ background: 'var(--surface-1)' }}>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {((uygunsuzCurrentPage - 1) * uygunsuzPageSize + 1).toLocaleString('tr-TR')} - {Math.min(uygunsuzCurrentPage * uygunsuzPageSize, filteredUygunsuz.length).toLocaleString('tr-TR')} / {filteredUygunsuz.length.toLocaleString('tr-TR')} sonuç
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => goToUygunsuzPage(1)} disabled={uygunsuzCurrentPage === 1} className="px-2 py-1 text-xs rounded disabled:opacity-30 disabled:cursor-not-allowed transition-all" style={{ color: 'var(--text-3)' }}>{'««'}</button>
                <button onClick={() => goToUygunsuzPage(uygunsuzCurrentPage - 1)} disabled={uygunsuzCurrentPage === 1} className="px-2 py-1 text-xs rounded disabled:opacity-30 disabled:cursor-not-allowed transition-all" style={{ color: 'var(--text-3)' }}>{'«'}</button>
                {Array.from({ length: Math.min(5, uygunsuzTotalPages) }, (_, i) => {
                  let page: number;
                  if (uygunsuzTotalPages <= 5) page = i + 1;
                  else if (uygunsuzCurrentPage <= 3) page = i + 1;
                  else if (uygunsuzCurrentPage >= uygunsuzTotalPages - 2) page = uygunsuzTotalPages - 4 + i;
                  else page = uygunsuzCurrentPage - 2 + i;
                  return (
                    <button key={page} onClick={() => goToUygunsuzPage(page)} className={`px-2.5 py-1 text-xs rounded transition-all ${uygunsuzCurrentPage === page ? 'bg-red-600 text-white font-bold' : ''}`} style={uygunsuzCurrentPage !== page ? { color: 'var(--text-3)' } : undefined}>{page}</button>
                  );
                })}
                <button onClick={() => goToUygunsuzPage(uygunsuzCurrentPage + 1)} disabled={uygunsuzCurrentPage === uygunsuzTotalPages} className="px-2 py-1 text-xs rounded disabled:opacity-30 disabled:cursor-not-allowed transition-all" style={{ color: 'var(--text-3)' }}>{'»'}</button>
                <button onClick={() => goToUygunsuzPage(uygunsuzTotalPages)} disabled={uygunsuzCurrentPage === uygunsuzTotalPages} className="px-2 py-1 text-xs rounded disabled:opacity-30 disabled:cursor-not-allowed transition-all" style={{ color: 'var(--text-3)' }}>{'»»'}</button>
              </div>
            </div>
          )}
          {uygunsuzTotalPages <= 1 && <div className="backdrop-blur-xl rounded-b-2xl border border-t-0 border-red-500/20 h-2" style={{ background: 'var(--surface-1)' }} />}

          {/* Doktor Bazlı Özet Kartları */}
          {doktorListesi.length > 0 && (
            <div className="backdrop-blur-xl rounded-2xl border border-red-500/20 p-5 mt-3" style={{ background: 'var(--surface-1)' }}>
              <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-3">Hekimlere Göre Uygunsuz İşlem Dağılımı</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {doktorListesi.slice(0, 20).map(([dr, count]) => (
                  <button
                    key={dr}
                    onClick={() => { setSelectedDoktor(selectedDoktor === dr ? 'TUMU' : dr); setUygunsuzCurrentPage(1); }}
                    className={`text-left p-3 rounded-lg border transition-all ${
                      selectedDoktor === dr
                        ? 'bg-red-500/10 border-red-500/30 ring-1 ring-red-500/20'
                        : ''
                    }`}
                    style={selectedDoktor !== dr ? { background: 'var(--surface-2)', borderColor: 'var(--border-2)' } : undefined}
                  >
                    <p className={`text-xs font-bold truncate ${selectedDoktor === dr ? 'text-red-400' : ''}`} style={selectedDoktor !== dr ? { color: 'var(--text-2)' } : undefined}>{dr}</p>
                    <p className="text-lg font-black text-red-400 mt-0.5">{count}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>uygunsuz işlem</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <ComplianceDetailModal isOpen={!!detailRow} onClose={() => { setDetailRow(null); setDetailResult(null); }} row={detailRow} result={detailResult} />

      <style>{`
        .custom-scrollbar-compliance::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar-compliance::-webkit-scrollbar-track { background: var(--bg-app); }
        .custom-scrollbar-compliance::-webkit-scrollbar-thumb { background: var(--border-2); border-radius: 4px; }
        .custom-scrollbar-compliance::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }
        .custom-scrollbar-compliance::-webkit-scrollbar-corner { background: var(--bg-app); }
      `}</style>
    </div>
  );
};

const SummaryCard: React.FC<{ label: string; value: string; color: string; sub?: string }> = ({ label, value, color, sub }) => {
  const isVar = color.startsWith('--');
  return (
    <div className="backdrop-blur-xl rounded-xl border p-3" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }}>
      <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <div className="flex items-baseline gap-1.5">
        <p className={`text-lg font-black ${isVar ? '' : color}`} style={isVar ? { color: `var(${color})` } : undefined}>{value}</p>
        {sub && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{sub}</span>}
      </div>
    </div>
  );
};

export default ComplianceAnalysisPanel;
