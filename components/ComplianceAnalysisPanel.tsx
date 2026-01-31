import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  ComplianceResult,
  ComplianceAnalysisSummary,
  AnalysisProgress,
  RuleLoadStatus,
  UygunlukDurumu,
  ParsedRuleType,
  RuleMasterEntry,
} from '../src/types/complianceTypes';
import { buildRulesMasterFromFirebase } from '../src/services/complianceDataLoader';
import { runComplianceAnalysis, generateSummary, exportResultsToExcel, IslemSatiriLike, KurumBilgisiLike } from '../src/services/complianceEngine';
import ComplianceDetailModal from './ComplianceDetailModal';

interface ComplianceAnalysisPanelProps {
  tableData: IslemSatiriLike[];
  kurumBilgisi: KurumBilgisiLike | undefined;
}

const PAGE_SIZES = [50, 100, 250, 500];

const statusStyles: Record<string, { label: string; color: string; bg: string; border: string; borderL: string }> = {
  UYGUN: { label: 'UYGUN', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', borderL: 'border-l-emerald-500' },
  UYGUNSUZ: { label: 'UYGUNSUZ', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', borderL: 'border-l-red-500' },
  MANUEL_INCELEME: { label: 'MANUEL', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', borderL: 'border-l-amber-500' },
};

function formatNumber(val: number, decimals = 0): string {
  return val.toLocaleString('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

const ComplianceAnalysisPanel: React.FC<ComplianceAnalysisPanelProps> = ({ tableData, kurumBilgisi }) => {
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
  const [searchTerm, setSearchTerm] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  const [detailRow, setDetailRow] = useState<IslemSatiriLike | null>(null);
  const [detailResult, setDetailResult] = useState<ComplianceResult | null>(null);

  const tableRef = useRef<HTMLDivElement>(null);

  const handleLoadRules = useCallback(async () => {
    setIsLoading(true);
    setProgress({ phase: 'loading', current: 0, total: 4, message: 'Başlatılıyor...' });
    try {
      const { rulesMaster: rm, loadStatus } = await buildRulesMasterFromFirebase((p) => setProgress(p));
      setRulesMaster(rm);
      setRuleLoadStatus(loadStatus);
      setProgress({ phase: 'complete', current: 1, total: 1, message: `${rm.size.toLocaleString('tr-TR')} kural yüklendi.` });
    } catch (err) {
      console.error('[COMPLIANCE] Kural yükleme hatası:', err);
      setProgress({ phase: 'error', current: 0, total: 0, message: `Hata: ${err}` });
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
    const start = Date.now();
    try {
      const analysisResults = await runComplianceAnalysis(tableData, rulesMaster, kurumBilgisi, (p) => setProgress(p));
      setResults(analysisResults);
      setSummary(generateSummary(analysisResults, Date.now() - start));
    } catch (err) {
      console.error('[COMPLIANCE] Analiz hatası:', err);
      setProgress({ phase: 'error', current: 0, total: 0, message: `Analiz hatası: ${err}` });
    } finally {
      setIsAnalyzing(false);
    }
  }, [rulesMaster, tableData, kurumBilgisi]);

  const handleClearAnalysis = useCallback(() => {
    setResults([]);
    setSummary(null);
    setProgress(null);
    setCurrentPage(1);
    setFilterDurum('TUMU');
    setFilterEsleme('TUMU');
    setFilterKuralTipi('TUMU');
    setSearchTerm('');
  }, []);

  const handleExport = useCallback(() => {
    if (results.length === 0) return;
    const ab = exportResultsToExcel(tableData, results);
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
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r => {
        const row = tableData[r.satirIndex];
        if (!row) return false;
        return row.gilKodu.toLowerCase().includes(term) || row.gilAdi.toLowerCase().includes(term) || row.doktor.toLowerCase().includes(term) || row.uzmanlik.toLowerCase().includes(term) || row.hastaTc.includes(term) || row.adiSoyadi.toLowerCase().includes(term);
      });
    }
    return filtered;
  }, [results, filterDurum, filterEsleme, filterKuralTipi, searchTerm, tableData]);

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
      <div className="bg-[#12121a]/80 backdrop-blur-xl rounded-2xl border border-slate-700/30 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Kural Veritabanı</span>
          </div>
          <button onClick={handleLoadRules} disabled={isLoading} className="px-4 py-1.5 text-xs font-bold bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
            {isLoading ? (
              <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>Yükleniyor...</>
            ) : ruleLoadStatus ? (
              <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>Yenile</>
            ) : (
              <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>Kuralları Yükle</>
            )}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { key: 'ek2b', label: 'EK-2B', status: ruleLoadStatus?.ek2b },
            { key: 'ek2c', label: 'EK-2C', status: ruleLoadStatus?.ek2c },
            { key: 'ek2cd', label: 'EK-2Ç', status: ruleLoadStatus?.ek2cd },
            { key: 'gil', label: 'GİL', status: ruleLoadStatus?.gil },
            { key: 'sut', label: 'SUT', status: ruleLoadStatus?.sut },
          ].map(src => (
            <div key={src.key} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border ${src.status?.loaded ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-slate-800/50 border-slate-700/30 text-slate-500'}`}>
              {src.status?.loaded ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
              )}
              {src.label}
              {src.status?.loaded && <span className="text-[10px] font-normal text-slate-500 ml-1">({src.status.count.toLocaleString('tr-TR')})</span>}
            </div>
          ))}
          {rulesMaster && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-500/10 border border-purple-500/20 text-purple-400 ml-auto">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>
              {rulesMaster.size.toLocaleString('tr-TR')} benzersiz kural
            </div>
          )}
        </div>
      </div>

      {/* Analiz Kontrol */}
      <div className="bg-[#12121a]/80 backdrop-blur-xl rounded-2xl border border-slate-700/30 p-5">
        <div className="flex items-center gap-3">
          <button onClick={handleStartAnalysis} disabled={!canAnalyze} className="px-6 py-2.5 text-sm font-black bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl hover:from-amber-500 hover:to-orange-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
            Analiz Başlat
          </button>
          {results.length > 0 && (
            <>
              <button onClick={handleClearAnalysis} className="px-4 py-2.5 text-sm font-semibold text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-xl transition-all flex items-center gap-2">
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
        {(isLoading || isAnalyzing) && progress && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-400">{progress.message}</span>
              <span className="text-xs font-bold text-amber-400">{progressPercent}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2">
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 h-2 rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        )}
        {!rulesMaster && !isLoading && (
          <p className="mt-2 text-xs text-slate-500">Önce kuralları yükleyin, sonra analiz başlatın.</p>
        )}
      </div>

      {/* Özet Dashboard */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <SummaryCard label="Toplam Analiz" value={formatNumber(summary.toplamAnaliz)} color="text-white" />
          <SummaryCard label="Uygun" value={formatNumber(summary.uygunSayisi)} color="text-emerald-400" sub={`%${summary.toplamAnaliz > 0 ? Math.round(summary.uygunSayisi / summary.toplamAnaliz * 100) : 0}`} />
          <SummaryCard label="Uygunsuz" value={formatNumber(summary.uygunsuzSayisi)} color="text-red-400" sub={`%${summary.toplamAnaliz > 0 ? Math.round(summary.uygunsuzSayisi / summary.toplamAnaliz * 100) : 0}`} />
          <SummaryCard label="Manuel İnceleme" value={formatNumber(summary.manuelIncelemeSayisi)} color="text-amber-400" sub={`%${summary.toplamAnaliz > 0 ? Math.round(summary.manuelIncelemeSayisi / summary.toplamAnaliz * 100) : 0}`} />
          <SummaryCard label="Eşleşen" value={formatNumber(summary.eslesenSayisi)} color="text-blue-400" />
          <SummaryCard label="Eşleşmeyen" value={formatNumber(summary.eslesemeyenSayisi)} color="text-slate-400" />
        </div>
      )}

      {/* Filtre Bar */}
      {results.length > 0 && (
        <div className="bg-[#12121a]/80 backdrop-blur-xl rounded-2xl border border-slate-700/30 p-4 flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Durum:</label>
            <select value={filterDurum} onChange={e => { setFilterDurum(e.target.value as any); setCurrentPage(1); }} className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500/50">
              <option value="TUMU">Tümü</option>
              <option value="UYGUN">Uygun</option>
              <option value="UYGUNSUZ">Uygunsuz</option>
              <option value="MANUEL_INCELEME">Manuel</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Eşleşme:</label>
            <select value={filterEsleme} onChange={e => { setFilterEsleme(e.target.value as any); setCurrentPage(1); }} className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500/50">
              <option value="TUMU">Tümü</option>
              <option value="ESLESTI">Eşleşti</option>
              <option value="ESLESEMEDI">Eşleşemedi</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Kural:</label>
            <select value={filterKuralTipi} onChange={e => { setFilterKuralTipi(e.target.value as any); setCurrentPage(1); }} className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500/50">
              <option value="TUMU">Tümü</option>
              <option value="BASAMAK_KISITI">Basamak</option>
              <option value="BRANS_KISITI">Branş</option>
              <option value="BIRLIKTE_YAPILAMAZ">Birlikte</option>
              <option value="SIKLIK_LIMIT">Sıklık</option>
              <option value="TANI_KOSULU">Tanı</option>
              <option value="DIS_TEDAVI">Diş</option>
            </select>
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} placeholder="GİL kodu, doktor, hasta..." className="flex-1 bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500/50 placeholder-slate-600" />
          </div>
          <span className="text-xs text-slate-500 ml-auto">{filteredResults.length.toLocaleString('tr-TR')} sonuç</span>
        </div>
      )}

      {/* Sonuç Tablosu */}
      {filteredResults.length > 0 && (
        <>
          <div className="bg-[#12121a]/80 backdrop-blur-xl rounded-t-2xl border border-b-0 border-slate-700/30 px-5 py-3 flex items-center justify-between">
            <span className="text-xs text-slate-500">{filteredResults.length.toLocaleString('tr-TR')} sonuç / {results.length.toLocaleString('tr-TR')} toplam</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Göster:</span>
              <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-500/50">
                {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div ref={tableRef} className="bg-[#0a0a14] border border-slate-700/30 overflow-auto max-h-[500px] custom-scrollbar-compliance">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#1a1a2e] border-b border-slate-700/50">
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold text-amber-400 uppercase tracking-wider w-[40px]">#</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold text-amber-400 uppercase tracking-wider min-w-[90px]">Durum</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold text-amber-400 uppercase tracking-wider min-w-[80px]">GİL Kodu</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold text-amber-400 uppercase tracking-wider min-w-[200px]">GİL Adı</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold text-amber-400 uppercase tracking-wider min-w-[140px]">Doktor</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold text-amber-400 uppercase tracking-wider min-w-[120px]">Uzmanlık</th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-bold text-amber-400 uppercase tracking-wider min-w-[50px]">İhlal</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold text-amber-400 uppercase tracking-wider min-w-[60px]">Kaynak</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold text-amber-400 uppercase tracking-wider min-w-[60px]">Güven</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold text-amber-400 uppercase tracking-wider min-w-[200px]">İhlal Açıklaması</th>
                </tr>
              </thead>
              <tbody>
                {paginatedResults.map((result, idx) => {
                  const row = tableData[result.satirIndex];
                  if (!row) return null;
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  const st = statusStyles[result.uygunluk_durumu] || statusStyles.UYGUN;
                  return (
                    <tr key={idx} onClick={() => { setDetailRow(row); setDetailResult(result); }} className={`border-b border-slate-800/30 hover:bg-slate-700/20 transition-colors cursor-pointer border-l-2 ${st.borderL} ${idx % 2 === 0 ? 'bg-[#0d0d1a]' : 'bg-[#0a0a14]'}`}>
                      <td className="px-3 py-1.5 text-xs text-slate-600 font-mono">{globalIdx}</td>
                      <td className="px-3 py-1.5"><span className={`text-[10px] font-black px-2 py-0.5 rounded ${st.color} ${st.bg} border ${st.border}`}>{st.label}</span></td>
                      <td className="px-3 py-1.5 text-xs text-slate-300 font-mono">{row.gilKodu}</td>
                      <td className="px-3 py-1.5 text-xs text-slate-400 truncate max-w-[250px]">{row.gilAdi}</td>
                      <td className="px-3 py-1.5 text-xs text-slate-400 truncate max-w-[160px]">{row.doktor}</td>
                      <td className="px-3 py-1.5 text-xs text-slate-500 truncate max-w-[140px]">{row.uzmanlik}</td>
                      <td className="px-3 py-1.5 text-xs text-center">{result.ihlaller.length > 0 ? <span className="text-red-400 font-bold">{result.ihlaller.length}</span> : <span className="text-slate-600">0</span>}</td>
                      <td className="px-3 py-1.5 text-[10px] text-slate-500 font-bold">{result.eslesen_kural?.kaynak || '—'}</td>
                      <td className="px-3 py-1.5"><span className={`text-[10px] font-bold ${result.eslesme_guveni === 'Yüksek' ? 'text-emerald-400' : result.eslesme_guveni === 'Orta' ? 'text-amber-400' : 'text-red-400'}`}>{result.eslesme_guveni}</span></td>
                      <td className="px-3 py-1.5 text-xs text-slate-500 truncate max-w-[250px]">
                        {result.ihlaller.length > 0
                          ? result.ihlaller.map(i => `[${i.ihlal_kodu}] ${i.ihlal_aciklamasi}`).join(' | ').substring(0, 120) + (result.ihlaller.map(i => i.ihlal_aciklamasi).join('').length > 120 ? '...' : '')
                          : result.eslesmeDurumu === 'ESLESEMEDI' ? 'Kural eşleşmesi bulunamadı' : '—'
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Sayfalama */}
          {totalPages > 1 && (
            <div className="bg-[#12121a]/80 backdrop-blur-xl rounded-b-2xl border border-t-0 border-slate-700/30 px-5 py-3 flex items-center justify-between">
              <p className="text-xs text-slate-500">{((currentPage - 1) * pageSize + 1).toLocaleString('tr-TR')} - {Math.min(currentPage * pageSize, filteredResults.length).toLocaleString('tr-TR')} / {filteredResults.length.toLocaleString('tr-TR')} sonuç</p>
              <div className="flex items-center gap-1">
                <button onClick={() => goToPage(1)} disabled={currentPage === 1} className="px-2 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-700/50 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-all">{'««'}</button>
                <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} className="px-2 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-700/50 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-all">{'«'}</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let page: number;
                  if (totalPages <= 5) page = i + 1;
                  else if (currentPage <= 3) page = i + 1;
                  else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
                  else page = currentPage - 2 + i;
                  return (
                    <button key={page} onClick={() => goToPage(page)} className={`px-2.5 py-1 text-xs rounded transition-all ${currentPage === page ? 'bg-amber-600 text-white font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>{page}</button>
                  );
                })}
                <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} className="px-2 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-700/50 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-all">{'»'}</button>
                <button onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages} className="px-2 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-700/50 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-all">{'»»'}</button>
              </div>
            </div>
          )}
          {totalPages <= 1 && <div className="bg-[#12121a]/80 backdrop-blur-xl rounded-b-2xl border border-t-0 border-slate-700/30 h-2" />}
        </>
      )}

      <ComplianceDetailModal isOpen={!!detailRow} onClose={() => { setDetailRow(null); setDetailResult(null); }} row={detailRow} result={detailResult} />

      <style>{`
        .custom-scrollbar-compliance::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar-compliance::-webkit-scrollbar-track { background: #0a0a14; }
        .custom-scrollbar-compliance::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
        .custom-scrollbar-compliance::-webkit-scrollbar-thumb:hover { background: #475569; }
        .custom-scrollbar-compliance::-webkit-scrollbar-corner { background: #0a0a14; }
      `}</style>
    </div>
  );
};

const SummaryCard: React.FC<{ label: string; value: string; color: string; sub?: string }> = ({ label, value, color, sub }) => (
  <div className="bg-[#12121a]/80 backdrop-blur-xl rounded-xl border border-slate-700/30 p-3">
    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
    <div className="flex items-baseline gap-1.5">
      <p className={`text-lg font-black ${color}`}>{value}</p>
      {sub && <span className="text-xs text-slate-500">{sub}</span>}
    </div>
  </div>
);

export default ComplianceAnalysisPanel;
