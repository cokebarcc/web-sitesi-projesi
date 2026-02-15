
import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import pptxgen from "pptxgenjs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, Legend, ComposedChart, Line
} from 'recharts';
import { AppointmentData, HBYSData, ScheduleProposal } from '../types';
import { MONTHS, YEARS } from '../constants';
import { GlassCard, GlassSection } from './ui';

interface AnalysisModuleProps {
  appointmentData: AppointmentData[];
  hbysData: HBYSData[];
  planningProposals: ScheduleProposal[];
  pastChangesInitialData: { [key: string]: any[] } | null;
  pastChangesFinalData: { [key: string]: any[] } | null;
  onClearPastChanges: () => void;
  selectedHospital: string;
  theme?: 'dark' | 'light';
}

interface ActionDiff {
  initial: number;
  final: number;
  diff: number;
}

const CustomizedAxisTick = (props: any) => {
  const { x, y, payload } = props;
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={4}
        textAnchor="end"
        fill="var(--text-2)"
        fontSize={10}
        fontWeight={800}
        transform="rotate(-90)"
        className="uppercase"
      >
        {payload.value}
      </text>
    </g>
  );
};

const AnalysisModule: React.FC<AnalysisModuleProps> = ({
  appointmentData,
  hbysData,
  selectedHospital,
  planningProposals,
  pastChangesInitialData,
  pastChangesFinalData,
  onClearPastChanges,
  theme = 'dark'
}) => {
  const isDark = theme === 'dark';
  const [selectedMonth, setSelectedMonth] = useState<string>('Aralık');
  const [selectedYear, setSelectedYear] = useState<number>(2025);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingCards, setIsExportingCards] = useState(false);
  const [isExportingPptx, setIsExportingPptx] = useState(false);
  
  // Refs for capturing
  const consolidatedPanelRef = useRef<HTMLDivElement>(null);
  const statsGridRef = useRef<HTMLDivElement>(null);
  const chart1Ref = useRef<HTMLDivElement>(null);
  const chart2Ref = useRef<HTMLDivElement>(null);
  const aiPlanningTableRef = useRef<HTMLDivElement>(null);
  const hospitalSummaryRef = useRef<HTMLDivElement>(null);
  const branchGridRef = useRef<HTMLDivElement>(null);
  const consolidatedTableRef = useRef<HTMLDivElement>(null);
  const aiAnalysisBoxRef = useRef<HTMLDivElement>(null);

  // AI Analysis State
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const downloadAsPng = async (ref: React.RefObject<HTMLDivElement>, fileName: string) => {
    if (!ref.current) return;
    try {
      const canvas = await html2canvas(ref.current, {
        scale: 3, 
        useCORS: true,
        backgroundColor: '#f8fafc',
        logging: false,
        onclone: (clonedDoc) => {
          const elements = clonedDoc.getElementsByTagName('*');
          for (let i = 0; i < elements.length; i++) {
            const el = elements[i] as HTMLElement;
            el.style.fontFamily = "'Inter', sans-serif";
          }
        }
      });
      const link = document.createElement('a');
      link.download = `${fileName}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error("PNG download error:", err);
    }
  };

  const downloadElementByIdAsPng = async (id: string, fileName: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    try {
      const canvas = await html2canvas(el, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc) => {
           const target = clonedDoc.getElementById(id);
           if (target) {
              target.style.overflow = "visible";
           }
        }
      });
      const link = document.createElement('a');
      link.download = `${fileName}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error("PNG download error:", err);
    }
  };

  const normalizeStr = (str: any) => {
    if (!str) return "";
    return String(str).toLocaleLowerCase('tr-TR').trim()
      .replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ğ/g, 'g')
      .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/\s+/g, '') 
      .replace(/dr\.|uzm\.|op\.|doc\.|prof\.|dt\.|ecz\.|yt\./g, '');
  };

  const normalize = (str: any) => String(str || "").trim().toLocaleUpperCase('tr-TR');

  // --- DASHBOARD VERİSİ ---
  const filteredAppointments = useMemo(() => 
    appointmentData.filter(d => 
      d.month === selectedMonth && 
      d.year === selectedYear &&
      normalizeStr(d.hospital) === normalizeStr(selectedHospital)
    ),
    [appointmentData, selectedMonth, selectedYear, selectedHospital]
  );

  const filteredHbys = useMemo(() => 
    hbysData.filter(d => 
      d.month === selectedMonth && 
      d.year === selectedYear &&
      normalizeStr(d.hospital) === normalizeStr(selectedHospital)
    ),
    [hbysData, selectedMonth, selectedYear, selectedHospital]
  );

  const baseData = useMemo(() => {
    const docNames = Array.from(new Set(filteredAppointments.map(a => `${a.doctorName}|${a.specialty}`)));
    return docNames.map((id: string) => {
      const [name, specialty] = id.split('|');
      const normalizedName = normalizeStr(name);
      const docAppts = filteredAppointments.filter(a => normalizeStr(a.doctorName) === normalizedName);
      const docHbysRecords = filteredHbys.filter(h => normalizeStr(h.doctorName) === normalizedName);
      const planCapacity = docAppts.reduce((acc, curr) => acc + (curr.totalSlots || 0), 0);
      const actualExams = docHbysRecords.reduce((acc, curr) => acc + (curr.totalExams || 0), 0);
      const planSurgeryDays = docAppts.filter(a => normalizeStr(a.actionType).includes('ameliyat')).reduce((acc, curr) => acc + (curr.daysCount || 0), 0);
      const actualSurgeryABC = docHbysRecords.reduce((acc, curr) => acc + (curr.surgeryABC || 0), 0);
      const usageRate = planCapacity > 0 ? (actualExams / planCapacity) : 0;
      const surgeryEfficiency = planSurgeryDays > 0 ? (actualSurgeryABC / planSurgeryDays) : 0;

      return {
        name,
        specialty,
        PlanMuayene: planCapacity,
        GercekMuayene: actualExams,
        UsageRate: usageRate,
        UsageRatePercent: Math.round(usageRate * 100),
        PlanSurgeryDays: planSurgeryDays,
        ActualSurgeryABC: actualSurgeryABC,
        SurgeryEfficiency: parseFloat(surgeryEfficiency.toFixed(2))
      };
    });
  }, [filteredAppointments, filteredHbys]);

  const capacityUsageData = useMemo(() => 
    baseData.filter(d => d.PlanMuayene > 0).sort((a, b) => a.UsageRate - b.UsageRate),
    [baseData]
  );

  const surgeryEfficiencyData = useMemo(() => 
    baseData.filter(d => d.PlanSurgeryDays > 0 || d.ActualSurgeryABC > 0).sort((a, b) => b.SurgeryEfficiency - a.SurgeryEfficiency),
    [baseData]
  );

  const totalCapacity = capacityUsageData.reduce((acc, curr) => acc + curr.PlanMuayene, 0);
  const totalActualExams = capacityUsageData.reduce((acc, curr) => acc + curr.GercekMuayene, 0);
  const totalSurgeryDays = surgeryEfficiencyData.reduce((acc, curr) => acc + curr.PlanSurgeryDays, 0);
  const totalSurgeryABC = surgeryEfficiencyData.reduce((acc, curr) => acc + curr.ActualSurgeryABC, 0);
  const hospitalSurgeryAverage = totalSurgeryDays > 0 ? totalSurgeryABC / totalSurgeryDays : 0;

  // --- GEÇMİŞ DÖNEM ANALİZ MANTIĞI ---
  const pastAnalysis = useMemo(() => {
    if (!pastChangesInitialData || !pastChangesFinalData) return null;
    
    let trueHospitalInitial = 0;
    let trueHospitalFinal = 0;
    
    const branchResults: any[] = [];
    const allSheetNames = Array.from(new Set([...Object.keys(pastChangesInitialData), ...Object.keys(pastChangesFinalData)]));

    allSheetNames.forEach(sheetName => {
      const initRows = pastChangesInitialData[sheetName] || [];
      const finalRows = pastChangesFinalData[sheetName] || [];
      
      let branchLossInitialCap = 0;
      let branchLossFinalCap = 0;
      
      const doctors: any[] = [];

      const docNames = Array.from(new Set([
        ...initRows.map(r => normalize(r["Hekim Adı"] || r["Hekim"])),
        ...finalRows.map(r => normalize(r["Hekim Adı"] || r["Hekim"]))
      ])).filter(n => n && n !== "TOPLAM" && n !== "0" && n !== "UNDEFINED");

      docNames.forEach(name => {
        const iRow = initRows.find(r => normalize(r["Hekim Adı"] || r["Hekim"]) === name) || {};
        const fRow = finalRows.find(r => normalize(r["Hekim Adı"] || r["Hekim"]) === name) || {};
        const iCap = Number(iRow["Randevu Kapasitesi"] || 0);
        const fCap = Number(fRow["Randevu Kapasitesi"] || 0);
        
        trueHospitalInitial += iCap;
        trueHospitalFinal += fCap;

        if (fCap < iCap) {
          branchLossInitialCap += iCap;
          branchLossFinalCap += fCap;
          
          const actions: { [key: string]: ActionDiff } = {};
          const allKeys = Array.from(new Set([...Object.keys(iRow), ...Object.keys(fRow)]));
          allKeys.forEach(key => {
            if (["Hekim Adı", "Hekim", "Randevu Kapasitesi", "Poliklinik Değişikliği"].includes(key)) return;
            const iVal = Number(iRow[key] || 0);
            const fVal = Number(fRow[key] || 0);
            if (!isNaN(iVal) && !isNaN(fVal) && (iVal !== 0 || fVal !== 0)) {
              actions[key] = { initial: iVal, final: fVal, diff: fVal - iVal };
            }
          });
          doctors.push({
            doctorName: name,
            capacity: { initial: iCap, final: fCap, diff: fCap - iCap },
            actions,
            hasCapacityDrop: true
          });
        }
      });

      branchResults.push({
        name: sheetName,
        capacity: { 
          initial: branchLossInitialCap, 
          final: branchLossFinalCap, 
          diff: branchLossFinalCap - branchLossInitialCap 
        },
        doctors: doctors.sort((a, b) => a.capacity.diff - b.capacity.diff),
        hasDropInBranch: doctors.length > 0
      });
    });

    return {
      capacity: { 
        initial: trueHospitalInitial, 
        final: trueHospitalFinal, 
        diff: trueHospitalFinal - trueHospitalInitial 
      },
      branchResults: branchResults
        .filter(br => br.capacity.diff < 0)
        .sort((a, b) => a.capacity.diff - b.capacity.diff)
    };
  }, [pastChangesInitialData, pastChangesFinalData]);

  const allDroppedDoctorsTableData = useMemo(() => {
    if (!pastAnalysis) return [];
    const flat: any[] = [];
    pastAnalysis.branchResults.forEach(br => {
      br.doctors.forEach(doc => {
        const actionSummary = Object.entries(doc.actions)
          .filter(([_, m]: any) => m.diff !== 0)
          .map(([name, m]: any) => `${name}: ${m.diff > 0 ? '+' : ''}${m.diff}G`)
          .join(', ');
        flat.push({
          branch: br.name,
          name: doc.doctorName,
          initial: doc.capacity.initial,
          final: doc.capacity.final,
          diff: doc.capacity.diff,
          actions: actionSummary
        });
      });
    });
    return flat.sort((a, b) => a.branch.localeCompare(b.branch, 'tr-TR'));
  }, [pastAnalysis]);

  const tableTotals = useMemo(() => {
    return allDroppedDoctorsTableData.reduce((acc, curr) => ({
      initial: acc.initial + curr.initial,
      final: acc.final + curr.final,
      diff: acc.diff + curr.diff
    }), { initial: 0, final: 0, diff: 0 });
  }, [allDroppedDoctorsTableData]);

  const changedProposals = useMemo(() => 
    planningProposals.filter(p => (p.polyDiff !== 0 || p.surgDiff !== 0)),
    [planningProposals]
  );

  const handleDownloadExcelGlobal = () => {
    if (allDroppedDoctorsTableData.length === 0) return;
    const excelRows = allDroppedDoctorsTableData.map(row => ({
      "Hekim Adı": row.name,
      "Branş": row.branch,
      "Eski Kapasite": row.initial,
      "Yeni Kapasite": row.final,
      "FARK": row.diff,
      "Başlıca Aksiyon Değişimleri": row.actions
    }));
    excelRows.push({
      "Hekim Adı": "GENEL ANALİZ TOPLAMI (TÜM KAYIPLAR)",
      "Branş": "",
      "Eski Kapasite": tableTotals.initial,
      "Yeni Kapasite": tableTotals.final,
      "FARK": tableTotals.diff,
      "Başlıca Aksiyon Değişimleri": "Kayıp yaşayan hekimlerin kümülatif verisidir."
    });
    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Değişim Listesi");
    XLSX.writeFile(workbook, `Analiz_Degisim_Raporu_${selectedMonth}_${selectedYear}.xlsx`);
  };

  const handleDownloadPlanningExcel = () => {
    if (changedProposals.length === 0) return;
    const excelRows = changedProposals.map(prop => ({
      "Hekim Adı": prop.doctorName,
      "Branş": prop.specialty,
      "Poliklinik Farkı (GÜN)": (prop.polyDiff! > 0 ? '+' : '') + prop.polyDiff,
      "Ameliyat Farkı (GÜN)": (prop.surgDiff! > 0 ? '+' : '') + prop.surgDiff,
      "Analiz Özeti": prop.decSummary
    }));
    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Planlama Önerileri");
    XLSX.writeFile(workbook, `AI_Planlama_Onerileri_${selectedMonth}_${selectedYear}.xlsx`);
  };

  const handleDownloadPdfGlobal = async () => {
    if (allDroppedDoctorsTableData.length === 0) return;
    setIsExporting(true);
    try {
      const pdf = new jsPDF('l', 'mm', 'a4');
      const margin = 10;
      const imgWidth = pdf.internal.pageSize.getWidth() - (2 * margin);
      const chunkSize = 12;
      for (let i = 0; i < allDroppedDoctorsTableData.length; i += chunkSize) {
        const chunk = allDroppedDoctorsTableData.slice(i, i + chunkSize);
        const printContainer = document.createElement('div');
        printContainer.style.width = '1200px';
        printContainer.style.padding = '40px';
        printContainer.style.background = 'white';
        printContainer.innerHTML = `
          <h2 style="font-size: 24pt; font-weight: 900; margin-bottom: 10px; line-height: 1.2;">CETVEL DEĞİŞİM RAPORU - SAYFA ${Math.floor(i/chunkSize) + 1}</h2>
          <p style="margin-bottom: 30px; font-weight: 800; line-height: 1.4;">${selectedMonth} ${selectedYear} | ${selectedHospital}</p>
          <table style="width: 100%; border-collapse: collapse; font-weight: bold;">
            <tr style="background: #f1f5f9; border: 2px solid black;">
              <th style="padding: 15px; border: 1px solid black; text-align: left;">HEKİM ADI</th>
              <th style="padding: 15px; border: 1px solid black; text-align: left;">BRANŞ</th>
              <th style="padding: 15px; border: 1px solid black; text-align: center;">ESKİ</th>
              <th style="padding: 15px; border: 1px solid black; text-align: center;">YENİ</th>
              <th style="padding: 15px; border: 1px solid black; text-align: center;">FARK</th>
              <th style="padding: 15px; border: 1px solid black;">AKSIYONLAR</th>
            </tr>
            ${chunk.map(row => `
              <tr style="border: 1px solid black;">
                <td style="padding: 12px; border: 1px solid black; line-height: 1.2;">${row.name}</td>
                <td style="padding: 12px; border: 1px solid black; line-height: 1.2;">${row.branch}</td>
                <td style="padding: 12px; border: 1px solid black; text-align: center;">${row.initial}</td>
                <td style="padding: 12px; border: 1px solid black; text-align: center;">${row.final}</td>
                <td style="padding: 12px; border: 1px solid black; text-align: center; color: red;">${row.diff}</td>
                <td style="padding: 12px; border: 1px solid black; font-size: 9pt; line-height: 1.2;">${row.actions}</td>
              </tr>
            `).join('')}
          </table>
        `;
        document.body.appendChild(printContainer);
        const canvas = await html2canvas(printContainer, { scale: 3 });
        const imgData = canvas.toDataURL('image/png');
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, (canvas.height * imgWidth) / canvas.width);
        document.body.removeChild(printContainer);
      }
      pdf.save(`Degisim_Raporu_${selectedMonth}_${selectedYear}.pdf`);
    } catch (err) { alert("PDF hatası."); }
    finally { setIsExporting(false); }
  };

  const handleDownloadPptx = async () => {
    if (!aiReport) return;
    setIsExportingPptx(true);
    try {
      const pres = new pptxgen();
      let slide1 = pres.addSlide();
      slide1.background = { color: "0F172A" };
      slide1.addText(selectedHospital.toUpperCase(), { x: 0.5, y: 1.5, w: 9, fontSize: 36, bold: true, color: "FFFFFF", align: "center" });
      slide1.addText("STRATEJİK YÖNETİCİ ANALİZ VE PLANLAMA SUNUMU", { x: 0.5, y: 2.2, w: 9, fontSize: 24, bold: true, color: "6366F1", align: "center" });
      slide1.addText(`${selectedMonth} ${selectedYear} DÖNEMİ`, { x: 0.5, y: 3.0, w: 9, fontSize: 18, color: "94A3B8", align: "center" });

      if (chart1Ref.current) {
        const canvas1 = await html2canvas(chart1Ref.current, { scale: 3 });
        let slide3 = pres.addSlide();
        slide3.addImage({ data: canvas1.toDataURL('image/png'), x: 0.5, y: 1.0, w: 9.0, h: 4.5 });
      }

      pres.writeFile({ fileName: `${selectedHospital}_Stratejik_Sunum_${selectedMonth}_${selectedYear}.pptx` });
    } catch (err) { alert("PPTX hatası."); }
    finally { setIsExportingPptx(false); }
  };

  const handleDownloadCardsPdf = async () => {
    const allDoctors = pastAnalysis?.branchResults.flatMap(br => 
      br.doctors.map((doc: any) => ({ ...doc, branchName: br.name }))
    ) || [];

    if (allDoctors.length === 0) return;
    setIsExportingCards(true);

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 10;
      const imgWidth = pageWidth - (2 * margin);

      const chunkSize = 6;
      const chunks = [];
      for (let i = 0; i < allDoctors.length; i += chunkSize) {
        chunks.push(allDoctors.slice(i, i + chunkSize));
      }

      const printContainer = document.createElement('div');
      printContainer.style.position = 'absolute';
      printContainer.style.left = '-9999px';
      printContainer.style.width = '1000px'; 
      printContainer.style.backgroundColor = 'white';
      document.body.appendChild(printContainer);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        printContainer.innerHTML = '';
        
        const pageDiv = document.createElement('div');
        pageDiv.style.padding = '40px';
        pageDiv.style.color = 'black';
        pageDiv.style.fontFamily = "'Inter', sans-serif";

        const title = document.createElement('h2');
        title.style.fontSize = '18pt';
        title.style.fontWeight = '900';
        title.style.marginBottom = '20px';
        title.style.borderBottom = '4px solid black';
        title.style.paddingBottom = '10px';
        title.style.lineHeight = "1.2";
        title.innerText = `HEKİM ANALİZ KARTLARI - SAYFA ${i + 1} / ${chunks.length}`;
        pageDiv.appendChild(title);

        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = '1fr 1fr';
        grid.style.gap = '20px';

        chunk.forEach(doc => {
          const card = document.createElement('div');
          card.style.border = '2px solid black';
          card.style.borderRadius = '20px';
          card.style.padding = '20px';
          card.style.backgroundColor = '#f8fafc';
          
          card.innerHTML = `
            <div style="background: black; color: white; padding: 12px; border-radius: 12px; margin-bottom: 15px;">
              <div style="font-size: 13pt; font-weight: 800; text-transform: uppercase; line-height: 1.2;">${doc.doctorName}</div>
              <div style="font-size: 10pt; font-weight: 600; opacity: 0.8; line-height: 1.2;">${doc.branchName}</div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 13pt; font-weight: 800; color: black; line-height: 1.2;">
              <span>KAYIP ORANI:</span>
              <span style="color: #e11d48;">%${Math.round((doc.capacity.final / (doc.capacity.initial || 1)) * 100 - 100)}</span>
            </div>
            <div style="margin-bottom: 15px;">
              <div style="display: flex; justify-content: space-between; font-size: 11pt; font-weight: 800; margin-bottom: 5px; color: black; line-height: 1.2;">
                <span>KAPASİTE SEYRİ</span>
                <span>${doc.capacity.initial} → ${doc.capacity.final}</span>
              </div>
              <div style="width: 100%; height: 12px; background: #e2e8f0; border-radius: 6px; border: 1px solid black;">
                <div style="width: ${(doc.capacity.final / doc.capacity.initial) * 100}%; height: 100%; background: black; border-radius: 4px;"></div>
              </div>
            </div>
            <div style="border-top: 1px solid black; padding-top: 10px;">
              <div style="font-size: 10pt; font-weight: 800; margin-bottom: 8px; color: black; text-transform: uppercase; line-height: 1.2;">Aksiyon Değişimleri:</div>
              ${(Object.entries(doc.actions) as [string, ActionDiff][]).filter(([_, m]) => m.diff !== 0).map(([act, m]) => `
                <div style="display: flex; justify-content: space-between; font-size: 11pt; font-weight: 800; color: black; margin-bottom: 4px; line-height: 1.2;">
                  <span style="padding-right: 10px;">${act}</span>
                  <span style="color: ${m.diff < 0 ? '#e11d48' : '#059669'}">${m.diff > 0 ? '+' : ''}${m.diff}G</span>
                </div>
              `).join('')}
            </div>
          `;
          grid.appendChild(card);
        });

        pageDiv.appendChild(grid);
        printContainer.appendChild(pageDiv);

        const canvas = await html2canvas(pageDiv, {
          scale: 3,
          useCORS: true,
          backgroundColor: '#ffffff',
          windowWidth: 1000
        });

        const imgData = canvas.toDataURL('image/png');
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);
      }

      pdf.save(`Hekim_Analiz_Kartları_${selectedMonth}_${selectedYear}.pdf`);
      document.body.removeChild(printContainer);
    } catch (err) {
      console.error(err);
      alert("Hata oluştu.");
    } finally {
      setIsExportingCards(false);
    }
  };

  const getCapacityColor = (rate: number) => {
    if (rate < 1.0) return '#e11d48'; 
    if (rate >= 1.2) return '#059669'; 
    return '#f59e0b'; 
  };

  const runFullAIAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      // AI functionality has been disabled
      setAiReport("AI analiz özelliği devre dışı bırakıldı. Lütfen manuel analiz modüllerini kullanın.");
    } catch (err) { setAiReport("AI özelliği devre dışı."); }
    finally { setIsAnalyzing(false); }
  };

  const PngButton = ({ onClick, label = "PNG", className = "" }: { onClick: () => void, label?: string, className?: string }) => (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`no-print flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-black border shadow-md transition-all active:scale-95 ${className}`}
      style={{ background: 'var(--surface-1)', color: 'var(--text-2)', borderColor: 'var(--border-1)' }}
      title="Görsel Olarak İndir"
    >
      <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h14a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
      {label}
    </button>
  );

  return (
    <div className="space-y-4 pb-32 animate-in fade-in duration-500">
      
      {/* 1. SEKSİYON: KONSOLİDE ANALİZ PANELİ (TÜM ÜST PANEL) */}
      <div ref={consolidatedPanelRef} className="relative group/mainpanel">
        <div className="absolute top-6 right-6 opacity-0 group-hover/mainpanel:opacity-100 transition-opacity z-40">
           <PngButton onClick={() => downloadAsPng(consolidatedPanelRef, 'Konsolide_Analiz_Paneli')} label="PANELİ PNG İNDİR" />
        </div>
        
        <GlassCard isDark={isDark} hover={false} padding="p-8" className="mb-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
              <h2 className="text-3xl font-black tracking-tight flex items-center gap-3 uppercase leading-normal" style={{ color: 'var(--text-1)' }}>
                <span className="w-2.5 h-10 bg-indigo-600 rounded-full"></span>
                KONSOLİDE ANALİZ PANELİ
              </h2>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] mt-1" style={{ color: 'var(--text-3)' }}>
                GÖRSELLEŞTİRME • AI PLANLAMA • GEÇMİŞ DÖNEM KIYASLAMA
              </p>
            </div>
            <div className="flex items-center gap-2 p-1.5 rounded-2xl border no-print" style={{ background: 'var(--surface-3)', borderColor: 'var(--border-2)' }}>
               <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="px-4 py-2.5 rounded-xl text-[10px] font-black border outline-none uppercase cursor-pointer" style={{ background: 'var(--surface-2)', borderColor: 'var(--border-1)', color: 'var(--text-1)' }}>
                 {MONTHS.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
               </select>
               <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="px-4 py-2.5 rounded-xl text-[10px] font-black border outline-none cursor-pointer" style={{ background: 'var(--surface-2)', borderColor: 'var(--border-1)', color: 'var(--text-1)' }}>
                 {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
               </select>
            </div>
          </div>
        </GlassCard>

        <div ref={statsGridRef} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <StatCard title="PLANLANAN MHRS" value={totalCapacity} color="blue" subtitle="Cetvel Kapasitesi" />
          <StatCard title="GERÇEKLEŞEN MUAYENE" value={totalActualExams} color="amber" subtitle={`Verim: %${totalCapacity > 0 ? Math.round((totalActualExams/totalCapacity)*100) : 0}`} />
          <StatCard title="PLAN. AMELİYAT GÜN" value={totalSurgeryDays} color="purple" subtitle="Tahsis Edilen Blok" />
          <StatCard title="TOPLAM ABC VAKA" value={totalSurgeryABC} color="emerald" subtitle={`Cerrahi Ort: ${hospitalSurgeryAverage.toFixed(1)} v/g`} />
        </div>
      </div>

      {/* 2. SEKSİYON: DASHBOARD GRAFİKLERİ */}
      <div className="grid grid-cols-1 gap-12">
        <div ref={chart1Ref} className="group/chart1">
        <GlassCard isDark={isDark} hover={false} padding="p-12" className="relative flex flex-col h-[700px]">
          <PngButton 
            onClick={() => downloadAsPng(chart1Ref, 'Kapasite_Kullanim_Analizi')} 
            className="absolute top-8 right-8 opacity-0 group-hover/chart1:opacity-100 z-20" 
          />
          <div className="flex flex-col sm:flex-row justify-between items-center mb-10 gap-4">
            <h4 className="text-xl font-black uppercase tracking-tighter italic underline decoration-indigo-500 decoration-4 underline-offset-8 leading-relaxed" style={{ color: 'var(--text-1)' }}>Kapasite Kullanım Analizi</h4>
            <div className="flex gap-6 items-center flex-wrap justify-center">
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#e11d48] rounded-full"></div><span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>KAPASİTE ALTI</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#f59e0b] rounded-full"></div><span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>NORMAL</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#059669] rounded-full"></div><span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>KAPASİTE ÜSTÜ</span></div>
            </div>
          </div>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="95%">
              <BarChart data={capacityUsageData} margin={{ bottom: 120 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-1)" />
                <XAxis dataKey="name" interval={0} height={120} tick={<CustomizedAxisTick />} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} stroke="var(--text-muted)" />
                <Tooltip 
                  cursor={{fill: 'var(--surface-hover)'}} 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="p-6 rounded-[20px] shadow-2xl border min-w-[200px] backdrop-blur-xl" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-1)' }}>
                          <p className="font-black text-sm mb-1 uppercase leading-normal" style={{ color: 'var(--text-1)' }}>{label}</p>
                          <p className="text-[10px] font-black text-indigo-600 uppercase mb-4 tracking-widest leading-normal">{data.specialty}</p>
                          <div className="space-y-2 border-t pt-4" style={{ borderColor: 'var(--border-1)' }}>
                            <div className="flex justify-between items-center gap-4">
                              <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Planlanan:</span>
                              <span className="text-xs font-black" style={{ color: 'var(--text-2)' }}>{data.PlanMuayene}</span>
                            </div>
                            <div className="flex justify-between items-center gap-4">
                              <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Gerçekleşen:</span>
                              <span className="text-xs font-black" style={{ color: 'var(--text-2)' }}>{data.GercekMuayene}</span>
                            </div>
                            <div className="mt-2 pt-2 border-t flex justify-between items-center" style={{ borderColor: 'var(--border-1)' }}>
                              <span className="text-[10px] font-black uppercase" style={{ color: 'var(--text-muted)' }}>Verim:</span>
                              <span className={`text-sm font-black ${data.UsageRate >= 1.2 ? 'text-emerald-600' : data.UsageRate < 1.0 ? 'text-rose-600' : 'text-amber-600'}`}>
                                %{data.UsageRatePercent}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }} 
                />
                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{paddingBottom: '20px', fontSize: '10px', fontWeight: 'bold'}} />
                <Bar name="Cetvel Kapasitesi" dataKey="PlanMuayene" fill="var(--border-1)" radius={[6, 6, 0, 0]} barSize={20} />
                <Bar name="Gerçekleşen Muayene" dataKey="GercekMuayene" radius={[8, 8, 0, 0]} barSize={20}>
                  {capacityUsageData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getCapacityColor(entry.UsageRate)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
        </div>

        <div ref={chart2Ref} className="group/chart2">
        <GlassCard isDark={isDark} hover={false} padding="p-12" className="relative h-[750px] flex flex-col">
          <PngButton 
            onClick={() => downloadAsPng(chart2Ref, 'Cerrahi_Verimlilik_Matrisi')} 
            className="absolute top-8 right-8 opacity-0 group-hover/chart2:opacity-100 z-20" 
          />
          <div className="flex flex-col sm:flex-row justify-between items-start mb-10 gap-4">
            <div>
              <h4 className="text-xl font-black uppercase tracking-tighter italic underline decoration-emerald-500 decoration-4 underline-offset-8 leading-relaxed" style={{ color: 'var(--text-1)' }}>Cerrahi Verimlilik Matrisi</h4>
              <p className="text-[10px] font-bold mt-2 uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>KURUM ORTALAMASI: {hospitalSurgeryAverage.toFixed(1)} VAKA/GÜN</p>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#3b82f6] rounded"></div><span className="text-[10px] font-black uppercase" style={{ color: 'var(--text-3)' }}>PLAN DIŞI GİRİŞ</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#ef4444] rounded"></div><span className="text-[10px] font-black uppercase" style={{ color: 'var(--text-3)' }}>ORTALAMA ALTI</span></div>
            </div>
          </div>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="95%">
              <ComposedChart data={surgeryEfficiencyData} margin={{ bottom: 120 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-1)" />
                <XAxis dataKey="name" interval={0} height={120} tick={<CustomizedAxisTick />} />
                <YAxis yAxisId="left" fontSize={10} axisLine={false} tickLine={false} stroke="var(--text-muted)" />
                <YAxis yAxisId="right" orientation="right" fontSize={10} axisLine={false} tickLine={false} stroke="#ef4444" />
                <Tooltip 
                  cursor={{fill: 'var(--surface-hover)'}} 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="p-6 rounded-[20px] shadow-2xl border min-w-[200px] backdrop-blur-xl" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-1)' }}>
                          <p className="font-black text-sm mb-1 uppercase leading-normal" style={{ color: 'var(--text-1)' }}>{label}</p>
                          <p className="text-[10px] font-black text-emerald-600 uppercase mb-4 tracking-widest leading-normal">{data.specialty}</p>
                          <div className="space-y-2 border-t pt-4" style={{ borderColor: 'var(--border-1)' }}>
                            <div className="flex justify-between items-center gap-4">
                              <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Planlanan Gün:</span>
                              <span className="text-xs font-black" style={{ color: 'var(--text-2)' }}>{data.PlanSurgeryDays} G</span>
                            </div>
                            <div className="flex justify-between items-center gap-4">
                              <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Vaka Sayısı:</span>
                              <span className="text-xs font-black" style={{ color: 'var(--text-2)' }}>{data.ActualSurgeryABC}</span>
                            </div>
                            <div className="mt-2 pt-2 border-t flex justify-between items-center" style={{ borderColor: 'var(--border-1)' }}>
                              <span className="text-[10px] font-black uppercase" style={{ color: 'var(--text-muted)' }}>Günlük Ort:</span>
                              <span className={`text-sm font-black ${data.SurgeryEfficiency < hospitalSurgeryAverage ? 'text-rose-600' : 'text-emerald-600'}`}>
                                {data.SurgeryEfficiency}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }} 
                />
                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{paddingBottom: '20px', fontSize: '10px', fontWeight: 'bold'}} />
                <Bar yAxisId="left" name="Ameliyat Günü (Plan)" dataKey="PlanSurgeryDays" fill="#818cf8" radius={[4, 4, 0, 0]} barSize={15} />
                <Bar yAxisId="left" name="Ameliyat Sayısı (Vaka)" dataKey="ActualSurgeryABC" radius={[6, 6, 0, 0]} barSize={15}>
                  {surgeryEfficiencyData.map((entry, index) => {
                    const isUnplanned = entry.PlanSurgeryDays === 0 && entry.ActualSurgeryABC > 0;
                    const isBelowAverage = entry.SurgeryEfficiency < hospitalSurgeryAverage;
                    let barColor = '#10b981'; 
                    if (isUnplanned) barColor = '#3b82f6'; 
                    else if (isBelowAverage) barColor = '#ef4444'; 
                    return <Cell key={`cell-surg-${index}`} fill={barColor} />;
                  })}
                </Bar>
                <Line yAxisId="right" name="Verimlilik (Vaka/Gün)" type="monotone" dataKey="SurgeryEfficiency" stroke="#ef4444" strokeWidth={4} dot={{ r: 5, fill: '#ef4444', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
        </div>
      </div>

      {/* 3. SEKSİYON: AI PLANLAMA ÖZET DEĞİŞİM TABLOSU */}
      {changedProposals.length > 0 && (
        <div ref={aiPlanningTableRef} className="group/planning">
        <GlassCard isDark={isDark} hover={false} padding="p-0" className="relative overflow-hidden animate-in slide-in-from-bottom-8">
            <PngButton 
              onClick={() => downloadAsPng(aiPlanningTableRef, 'AI_Planlama_Ozet_Tablo')} 
              className="absolute top-10 right-48 z-20 opacity-0 group-hover/planning:opacity-100" 
            />
            <div className="p-10 border-b flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6" style={{ background: 'var(--bg-app)', borderColor: 'var(--border-2)' }}>
              <div>
                <h4 className="text-2xl font-black uppercase tracking-tight leading-normal" style={{ color: 'var(--text-1)' }}>AI Planlama: Özet Değişim Tablosu</h4>
                <p className="text-xs mt-1 font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Planlama Modülü Tarafından Önerilen Net Değişimler</p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                 <button onClick={handleDownloadPlanningExcel} className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-black text-[10px] shadow-lg hover:bg-emerald-700 transition-all active:scale-95 uppercase tracking-widest whitespace-nowrap">
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                   EXCEL İNDİR
                 </button>
                 <div className="bg-indigo-600 text-white px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-500/20 whitespace-nowrap">
                  {changedProposals.length} ÖNERİLEN DEĞİŞİKLİK
                 </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left table-auto">
                <thead className="sticky top-0 z-10 border-b backdrop-blur-xl" style={{ background: 'var(--surface-2)', borderColor: 'var(--border-1)' }}>
                  <tr>
                    <th className="px-10 py-6 text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Hekim Adı</th>
                    <th className="px-10 py-6 text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Branş</th>
                    <th className="px-10 py-6 text-[11px] font-black uppercase tracking-widest text-center" style={{ color: 'var(--text-muted)' }}>Poliklinik Farkı</th>
                    <th className="px-10 py-6 text-[11px] font-black uppercase tracking-widest text-center" style={{ color: 'var(--text-muted)' }}>Ameliyat Farkı</th>
                    <th className="px-10 py-6 text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Analiz Özeti</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border-1)' }}>
                  {changedProposals.map((prop, idx) => (
                    <tr key={idx} className="transition-colors min-h-[44px]" style={{ background: idx % 2 === 0 ? 'transparent' : 'var(--surface-hover)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'} onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'var(--surface-hover)'}>
                      <td className="px-10 py-6"><p className="font-black uppercase text-sm leading-normal" style={{ color: 'var(--text-1)' }}>{prop.doctorName}</p></td>
                      <td className="px-10 py-6"><p className="text-[10px] font-bold uppercase leading-normal" style={{ color: 'var(--text-muted)' }}>{prop.specialty}</p></td>
                      <td className="px-10 py-6 text-center">
                        <span className={`px-4 py-2 rounded-xl text-[10px] font-black border tracking-wider uppercase ${prop.polyDiff! > 0 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
                          {prop.polyDiff! > 0 ? '+' : ''}{prop.polyDiff} Gün
                        </span>
                      </td>
                      <td className="px-10 py-6 text-center">
                        <span className={`px-4 py-2 rounded-xl text-[10px] font-black border tracking-wider uppercase ${prop.surgDiff! > 0 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
                          {prop.surgDiff! > 0 ? '+' : ''}{prop.surgDiff} Gün
                        </span>
                      </td>
                      <td className="px-10 py-6 min-w-[300px]"><p className="text-[10px] font-bold italic leading-snug" style={{ color: 'var(--text-3)' }}>{prop.decSummary}</p></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        </GlassCard>
        </div>
      )}

      {/* 4. SEKSİYON: GEÇMİŞ DÖNEM DEĞİŞİMLERİ */}
      <div className="space-y-12">
        <div className="px-4 py-2 border-l-8 border-[#e11d48] flex justify-between items-center">
            <h3 className="text-4xl font-black tracking-tighter uppercase italic leading-none" style={{ color: 'var(--text-1)' }}>
              GEÇMİŞ DÖNEM ANALİZ MERKEZİ
            </h3>
        </div>

        {pastAnalysis ? (
          <div className="space-y-12">
            {/* Özet Siyah Bar */}
            <div ref={hospitalSummaryRef} className="relative group/hsummary p-16 rounded-[20px] shadow-2xl overflow-hidden flex flex-col md:flex-row justify-between items-center gap-12 border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border-1)', color: 'var(--text-1)' }}>
              <PngButton 
                onClick={() => downloadAsPng(hospitalSummaryRef, 'Hastane_Kapasite_Ozet_Bar')} 
                className="absolute top-8 right-8 opacity-0 group-hover/hsummary:opacity-100 z-20" 
              />
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full -mr-48 -mt-48 blur-[100px]"></div>
              <div className="relative z-10 text-center md:text-left flex-1">
                <p className="text-indigo-400 font-black text-[11px] uppercase tracking-[0.4em] mb-6">HASTANE GENEL KAPASİTE DEĞİŞİMİ</p>
                <div className="flex items-center justify-center md:justify-start gap-8">
                   <h3 className="text-7xl font-black tracking-tighter leading-none">{pastAnalysis.capacity.initial.toLocaleString('tr-TR')}</h3>
                   <svg className="w-12 h-12" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
                   <h3 className="text-7xl font-black tracking-tighter leading-none">{pastAnalysis.capacity.final.toLocaleString('tr-TR')}</h3>
                </div>
              </div>
              <div className={`relative z-10 px-12 py-8 rounded-[40px] border-4 text-center min-w-[300px] ${pastAnalysis.capacity.diff >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-[#e11d48]/10 border-[#e11d48]/30 shadow-[0_0_50px_rgba(225,29,72,0.1)]'}`}>
                <p className="text-[11px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-3)' }}>NET FARK</p>
                <p className={`text-6xl font-black leading-none ${pastAnalysis.capacity.diff >= 0 ? 'text-emerald-400' : 'text-[#e11d48]'}`}>
                  {pastAnalysis.capacity.diff.toLocaleString('tr-TR')}
                </p>
              </div>
            </div>

            {/* Branş Kartları Grid */}
            <div className="space-y-6 relative group/branchgrid">
                <div className="flex justify-between items-center px-4">
                  <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-3 leading-normal" style={{ color: 'var(--text-1)' }}>
                      <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                      Branş Bazlı Kapasite Değişimleri (Sadece Kayıp Portföyü)
                  </h3>
                  <PngButton onClick={() => downloadAsPng(branchGridRef, 'Brans_Bazli_Kapasite_Degisimleri')} label="GRİDİ İNDİR" />
                </div>
                <div ref={branchGridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 p-4" style={{ background: 'var(--surface-1)' }}>
                {pastAnalysis.branchResults.map((br, idx) => (
                    <GlassCard key={idx} isDark={isDark} hover={true} padding="p-12 pt-14" className="relative group">
                    <div className="flex justify-between items-start mb-8">
                        <h4 className="text-sm font-black uppercase tracking-tighter line-clamp-1 pr-12 leading-relaxed" style={{ color: 'var(--text-1)' }}>{br.name}</h4>
                        <span className={`absolute top-8 right-8 text-white text-[10px] font-black px-3 py-1.5 rounded-xl shadow-lg ${br.capacity.diff >= 0 ? 'bg-emerald-600 shadow-emerald-200' : 'bg-[#e11d48] shadow-rose-200'}`}>
                          {br.capacity.diff > 0 ? '+' : ''}{br.capacity.diff}
                        </span>
                    </div>
                    <div className="space-y-4">
                        <div className="flex justify-between text-[11px] font-black uppercase tracking-widest leading-normal" style={{ color: 'var(--text-3)' }}>
                            <span>NET KAPASİTE DEĞİŞİMİ</span>
                            <span className={br.capacity.diff >= 0 ? 'text-emerald-600' : 'text-[#e11d48]'}>%{Math.round((br.capacity.final / (br.capacity.initial || 1)) * 100 - 100)}</span>
                        </div>
                        <div className="w-full h-2.5 rounded-full overflow-hidden border" style={{ background: 'var(--surface-3)', borderColor: 'var(--border-2)' }}>
                            <div className={`h-full transition-all duration-1000 ${br.capacity.diff >= 0 ? 'bg-emerald-500' : 'bg-gradient-to-r from-[#e11d48] to-[#fb7185]'}`}
                                style={{ width: `${Math.min(100, (br.capacity.final / (br.capacity.initial || 1)) * 100)}%` }}></div>
                        </div>
                    </div>
                    </GlassCard>
                ))}
                </div>
            </div>

            {/* Kayıp Analiz Kartları */}
            <div className="space-y-10 mt-16">
              <div className="flex justify-between items-center px-4">
                <h3 className="text-2xl font-black uppercase tracking-tighter italic flex items-center gap-4 leading-normal" style={{ color: 'var(--text-1)' }}>
                  <div className="w-2 h-8 bg-[#e11d48] rounded-full"></div>
                  KAYIP ANALİZ KARTLARI
                </h3>
                <button 
                  onClick={handleDownloadCardsPdf} 
                  disabled={isExportingCards}
                  className="bg-[#e11d48] text-white px-8 py-4 rounded-2xl font-black text-[10px] shadow-xl hover:bg-rose-700 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 uppercase tracking-widest"
                >
                  {isExportingCards ? 'HAZIRLANIYOR...' : 'ANALİZ KARTLARINI PDF İNDİR'}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {pastAnalysis.branchResults.flatMap(br => 
                  br.doctors.map((doc: any) => ({ ...doc, branchName: br.name }))
                ).map((doc, idx) => (
                  <div id={`doc-card-${idx}`} key={idx}>
                  <GlassCard isDark={isDark} hover={true} padding="p-0" className="relative flex flex-col group">
                    <PngButton
                      onClick={() => downloadElementByIdAsPng(`doc-card-${idx}`, `Hekim_Karti_${normalizeStr(doc.doctorName)}`)}
                      className="absolute top-2 right-2 z-30 opacity-0 group-hover:opacity-100 border-white/20 bg-black/40 text-white hover:bg-black/60"
                    />
                    <div className="p-6 flex justify-between items-center" style={{ background: 'var(--bg-app)' }}>
                      <div className="truncate pr-4">
                        <h4 className="text-[12px] font-black uppercase truncate leading-normal" style={{ color: 'var(--text-1)' }}>{doc.doctorName}</h4>
                        <p className="text-[9px] font-bold uppercase tracking-tighter truncate mt-1 leading-normal" style={{ color: 'var(--text-3)' }}>{doc.branchName}</p>
                      </div>
                      <span className="bg-[#e11d48] text-white text-[9px] font-black px-2 py-1 rounded-lg uppercase whitespace-nowrap shadow-lg">Kayıp</span>
                    </div>
                    <div className="p-8 space-y-6 flex-1">
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-[10px] font-black uppercase mb-1 leading-normal" style={{ color: 'var(--text-3)' }}>Düşüş Oranı</p>
                          <p className="text-2xl font-black text-[#e11d48] leading-none">%{Math.round((doc.capacity.final / (doc.capacity.initial || 1)) * 100 - 100)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black uppercase mb-1 leading-normal" style={{ color: 'var(--text-3)' }}>Net Kayıp</p>
                          <p className="text-xl font-black leading-none" style={{ color: 'var(--text-1)' }}>{doc.capacity.diff}</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between text-[10px] font-black uppercase leading-normal" style={{ color: 'var(--text-3)' }}>
                          <span>Seyir</span>
                          <span>{doc.capacity.initial} → {doc.capacity.final}</span>
                        </div>
                        <div className="w-full h-2.5 rounded-full overflow-hidden border" style={{ background: 'var(--surface-3)', borderColor: 'var(--border-2)' }}>
                          <div className="h-full rounded-full transition-all duration-1000" style={{ background: 'var(--text-1)', width: `${(doc.capacity.final / doc.capacity.initial) * 100}%` }}></div>
                        </div>
                      </div>
                      <div className="pt-4 border-t" style={{ borderColor: 'var(--border-2)' }}>
                        <p className="text-[10px] font-black uppercase mb-3 tracking-widest leading-normal" style={{ color: 'var(--text-3)' }}>Aksiyon Bazlı Farklar</p>
                        <div className="space-y-2">
                          {Object.entries(doc.actions).filter(([_, m]: any) => m.diff !== 0).map(([act, m]: any, actIdx) => (
                            <div key={actIdx} className="flex justify-between items-center text-[11px] font-bold leading-normal">
                              <span className="uppercase truncate pr-2 leading-normal" style={{ color: 'var(--text-muted)' }}>{act}</span>
                              <span className={`font-black whitespace-nowrap px-2 py-0.5 rounded leading-normal ${m.diff < 0 ? 'text-[#e11d48] bg-rose-50' : 'text-emerald-600 bg-emerald-50'}`}>{m.diff > 0 ? '+' : ''}{m.diff}G</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                  </div>
                ))}
              </div>
            </div>

            {/* Konsolide Liste Tablosu */}
            <div className="space-y-8 mt-16 group/ctable relative">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-4">
                 <h3 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-4 leading-normal" style={{ color: 'var(--text-1)' }}>
                   <div className="w-2 h-10 rounded-full" style={{ background: 'var(--text-1)' }}></div>
                   Konsolide Değişim Listesi
                 </h3>
                 <div className="flex flex-wrap gap-4">
                   <PngButton onClick={() => downloadAsPng(consolidatedTableRef, 'Konsolide_Degisim_Listesi')} label="TABLOYU PNG İNDİR" />
                   <button onClick={onClearPastChanges} className="px-8 py-5 rounded-xl text-[11px] font-black text-[#e11d48] hover:bg-rose-50 border-2 border-rose-100 transition-all uppercase tracking-[0.2em]">Veriyi Sıfırla</button>
                   <button onClick={handleDownloadExcelGlobal} className="flex items-center gap-3 bg-emerald-600 text-white px-8 py-5 rounded-xl font-black text-xs shadow-2xl hover:bg-emerald-700 transition-all active:scale-95 uppercase tracking-widest">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      EXCEL OLARAK İNDİR
                   </button>
                   <button onClick={handleDownloadPdfGlobal} disabled={isExporting} className="px-10 py-5 rounded-xl font-black text-xs shadow-2xl transition-all disabled:opacity-50 uppercase tracking-widest" style={{ background: 'var(--surface-2)', color: 'var(--text-1)' }}>
                     {isExporting ? 'HAZIRLANIYOR...' : 'TABLOYU PDF İNDİR'}
                   </button>
                 </div>
              </div>
              <div ref={consolidatedTableRef}>
              <GlassCard isDark={isDark} hover={false} padding="p-0" className="overflow-hidden" variant="elevated">
                <div className="overflow-x-auto">
                  <table className="w-full text-left table-auto">
                    <thead className="sticky top-0 z-10 border-b backdrop-blur-xl" style={{ background: 'var(--surface-2)', borderColor: 'var(--border-1)' }}>
                      <tr>
                        <th className="px-12 py-8 text-[12px] font-black uppercase tracking-[0.2em] leading-normal" style={{ color: 'var(--text-muted)' }}>Hekim Adı</th>
                        <th className="px-12 py-8 text-[12px] font-black uppercase tracking-[0.2em] leading-normal" style={{ color: 'var(--text-muted)' }}>Branş</th>
                        <th className="px-10 py-8 text-[12px] font-black uppercase tracking-[0.2em] text-center leading-normal" style={{ color: 'var(--text-muted)' }}>Eski Kap</th>
                        <th className="px-10 py-8 text-[12px] font-black uppercase tracking-[0.2em] text-center leading-normal" style={{ color: 'var(--text-muted)' }}>Yeni Kap</th>
                        <th className="px-10 py-8 text-[12px] font-black uppercase tracking-[0.2em] text-center leading-normal" style={{ color: 'var(--text-muted)' }}>Fark</th>
                        <th className="px-12 py-8 text-[12px] font-black uppercase tracking-[0.2em] leading-normal" style={{ color: 'var(--text-muted)' }}>Aksiyon Değişimleri</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: 'var(--border-1)' }}>
                      {allDroppedDoctorsTableData.map((row, idx) => (
                        <tr key={idx} className="transition-colors min-h-[44px]" style={{ cursor: 'default', background: idx % 2 === 0 ? 'transparent' : 'var(--surface-hover)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'} onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'var(--surface-hover)'}>
                          <td className="px-12 py-8 font-black uppercase text-sm leading-normal" style={{ color: 'var(--text-1)' }}>{row.name}</td>
                          <td className="px-12 py-8 text-[11px] font-bold uppercase leading-normal" style={{ color: 'var(--text-muted)' }}>{row.branch}</td>
                          <td className="px-10 py-8 text-center text-xs font-bold leading-normal" style={{ color: 'var(--text-3)' }}>{row.initial}</td>
                          <td className="px-10 py-8 text-center text-xs font-black leading-normal" style={{ color: 'var(--text-2)' }}>{row.final}</td>
                          <td className="px-10 py-8 text-center leading-normal"><span className="bg-rose-100 text-[#e11d48] px-5 py-2 rounded-2xl font-black text-[11px] border border-rose-200 leading-normal">{row.diff}</span></td>
                          <td className="px-12 py-8 min-w-[300px] leading-normal"><p className="text-[11px] font-bold text-indigo-600 italic leading-snug">{row.actions || 'Kapasite düşüşü aksiyon değişikliği ile açıklanmıyor.'}</p></td>
                        </tr>
                      ))}
                      <tr className="font-black" style={{ background: 'var(--bg-app)', color: 'var(--text-1)' }}>
                        <td className="px-12 py-10 text-[13px] uppercase tracking-[0.3em] leading-normal" colSpan={2}>GENEL ANALİZ TOPLAMI (TÜM KAYIPLAR)</td>
                        <td className="px-10 py-10 text-center text-base leading-normal">{tableTotals.initial.toLocaleString('tr-TR')}</td>
                        <td className="px-10 py-10 text-center text-base leading-normal">{tableTotals.final.toLocaleString('tr-TR')}</td>
                        <td className="px-10 py-10 text-center leading-normal"><span className="bg-[#e11d48] text-white px-8 py-3 rounded-2xl text-sm border border-rose-400 shadow-2xl leading-normal">{tableTotals.diff.toLocaleString('tr-TR')}</span></td>
                        <td className="px-12 py-10 text-[10px] italic leading-normal" style={{ color: 'var(--text-3)' }}>Kayıp yaşayanların toplam kümülatif verisidir.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </GlassCard>
              </div>
            </div>

            {/* AI STRATEJİK ANALİZ BUTONU VE SONUÇ ALANI */}
            <div className="mt-20 space-y-10 no-print">
               <div className="flex flex-col items-center gap-6">
                 <button 
                   onClick={runFullAIAnalysis}
                   disabled={isAnalyzing}
                   className="group relative px-16 py-8 rounded-[20px] font-black text-xl hover:scale-105 transition-all active:scale-95 disabled:opacity-50 overflow-hidden"
                   style={{ background: 'var(--surface-2)', color: 'var(--text-1)', boxShadow: '0 20px 50px rgba(0,0,0,0.15)' }}
                 >
                   <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/20 to-emerald-600/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                   <div className="relative flex items-center gap-4">
                     {isAnalyzing ? (
                        <div className="w-8 h-8 border-4 border-indigo-400 border-t-white rounded-full animate-spin"></div>
                     ) : (
                        <div className="w-12 h-12 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-500/40">
                           <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                     )}
                     <span className="tracking-tight uppercase">STRATEJİK AI ANALİZİ BAŞLAT</span>
                   </div>
                 </button>
                 <p className="font-bold uppercase text-[10px] tracking-[0.3em]" style={{ color: 'var(--text-3)' }}>TÜM MODÜL VERİLERİNİ İNCELEYEREK YÖNETİCİ RAPORU OLUŞTURUR</p>
               </div>

               {aiReport && (
                 <div ref={aiAnalysisBoxRef} className="group/aireport">
                 <GlassCard isDark={isDark} hover={false} padding="p-12" className="relative animate-in slide-in-from-bottom-10 duration-700" variant="elevated">
                    <PngButton 
                      onClick={() => downloadAsPng(aiAnalysisBoxRef, 'AI_Stratejik_Rapor_Gorseli')} 
                      className="absolute top-10 right-10 z-20 opacity-0 group-hover/aireport:opacity-100" 
                    />
                    <div className="absolute top-0 right-0 w-96 h-96 rounded-full -mr-48 -mt-48 blur-3xl opacity-60" style={{ background: 'var(--accent-primary)', opacity: 0.08 }}></div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-6 mb-12">
                        <div className="w-20 h-20 bg-indigo-600 rounded-[32px] flex items-center justify-center font-black text-3xl text-white shadow-2xl shadow-indigo-200">AI</div>
                        <div>
                          <h3 className="text-3xl font-black tracking-tighter uppercase leading-normal" style={{ color: 'var(--text-1)' }}>STRATEJİK YÖNETİCİ ANALİZ RAPORU</h3>
                          <p className="text-indigo-600 font-bold text-xs uppercase tracking-widest mt-1">VERİ ODAKLI KURUMSAL KARAR DESTEK SİSTEMİ</p>
                        </div>
                      </div>
                      <div className="prose prose-indigo max-w-none prose-p:leading-relaxed prose-li:font-bold prose-headings:font-black" style={{ '--tw-prose-body': 'var(--text-2)' } as React.CSSProperties}>
                        {aiReport.split('\n').map((line, lineIdx) => (
                           <p key={lineIdx} className="mb-4 text-lg font-medium leading-normal" style={{ color: 'var(--text-2)' }}>
                             {line.startsWith('-') || line.startsWith('*') ? (
                               <span className="flex gap-4">
                                 <span className="text-indigo-500 mt-1.5 shrink-0">●</span>
                                 <span>{line.substring(1).trim()}</span>
                               </span>
                             ) : line.trim()}
                           </p>
                        ))}
                      </div>
                      <div className="mt-12 pt-10 border-t flex justify-end items-center gap-4 no-print" style={{ borderColor: 'var(--border-2)' }}>
                         <button 
                           onClick={handleDownloadPptx}
                           disabled={isExportingPptx}
                           className="bg-orange-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-orange-700 transition-all flex items-center gap-2"
                         >
                           {isExportingPptx ? (
                             <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                           ) : (
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414a1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                           )}
                           SUNUM OLARAK İNDİR (.PPTX)
                         </button>
                         <button onClick={() => window.print()} className="px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all" style={{ background: 'var(--surface-2)', color: 'var(--text-1)' }}>RAPORU YAZDIR</button>
                      </div>
                    </div>
                 </GlassCard>
                 </div>
               )}
            </div>
          </div>
        ) : (
          <GlassCard isDark={isDark} hover={false} padding="p-32" className="text-center flex flex-col items-center gap-10" variant="outlined">
             <div className="w-24 h-24 rounded-full flex items-center justify-center shadow-inner" style={{ background: 'var(--surface-3)', color: 'var(--text-muted)' }}>
               <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
             </div>
             <div>
               <h4 className="text-2xl font-black uppercase tracking-[0.3em] leading-normal" style={{ color: 'var(--text-3)' }}>Karşılaştırmalı Veri Bekleniyor</h4>
               <p className="font-medium max-w-xl mx-auto mt-4 italic leading-relaxed text-sm" style={{ color: 'var(--text-3)' }}>Analiz yapmak için lütfen "Geçmiş Dönem Değişimleri" sekmesinden ilk ve son cetvelleri yükleyiniz. Veriler buraya otomatik yansıyacaktır.</p>
             </div>
          </GlassCard>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ title, value, color, subtitle }: any) => {
  const getLabelColor = (c: string) => {
    if (c === 'blue') return 'text-blue-600';
    if (c === 'amber') return 'text-amber-600';
    if (c === 'purple') return 'text-purple-600';
    if (c === 'emerald') return 'text-emerald-600';
    return '';
  };
  return (
    <div className="p-10 rounded-[20px] border flex flex-col justify-between hover:shadow-xl transition-all group" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-1)', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.2em] mb-2 transition-colors leading-normal" style={{ color: 'var(--text-3)' }}>{title}</p>
        <h3 className={`text-4xl font-black tracking-tighter leading-none ${getLabelColor(color)}`} style={!getLabelColor(color) ? { color: 'var(--text-1)' } : undefined}>{value.toLocaleString('tr-TR')}</h3>
      </div>
      <p className="text-[11px] font-bold mt-6 border-t pt-4 uppercase tracking-tight italic leading-normal" style={{ color: 'var(--text-3)', borderColor: 'var(--border-2)' }}>{subtitle}</p>
    </div>
  );
};

export default AnalysisModule;
