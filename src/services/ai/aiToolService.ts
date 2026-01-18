// AI Tool Definitions ve Executor
import { AIToolDefinition, AIToolName, AITableConfig, AIChartConfig } from '../../types/ai';
import { loadAllDetailedScheduleData } from '../detailedScheduleStorage';
import { loadAllMuayeneData, loadAllAmeliyatData } from '../physicianDataStorage';
import { loadMultipleDatesData } from '../greenAreaStorage';

// ==================== Tool Definitions ====================

export const getToolDefinitions = (): AIToolDefinition[] => [
  {
    name: 'read_schedule_data',
    description: 'Detaylı cetvel verilerini oku. Hekim programları, poliklinik ve ameliyat cetvelleri.',
    parameters: {
      type: 'object',
      properties: {
        hospital: { type: 'string', description: 'Hastane adı' },
        month: { type: 'string', description: 'Ay (ör: Ocak, Şubat)' },
        year: { type: 'number', description: 'Yıl (ör: 2024)' },
        branch: { type: 'string', description: 'Branş filtresi (opsiyonel)', optional: true },
        physician: { type: 'string', description: 'Hekim adı filtresi (opsiyonel)', optional: true }
      },
      required: ['hospital']
    }
  },
  {
    name: 'read_muayene_data',
    description: 'Muayene (HBYS) verilerini oku. MHRS ve ayaktan muayene sayıları.',
    parameters: {
      type: 'object',
      properties: {
        hospital: { type: 'string', description: 'Hastane adı' },
        period: { type: 'string', description: 'Dönem (ör: 2024-Kasım)' },
        physician: { type: 'string', description: 'Hekim adı filtresi (opsiyonel)', optional: true }
      },
      required: ['hospital']
    }
  },
  {
    name: 'read_ameliyat_data',
    description: 'Ameliyat verilerini oku. Ameliyat sayıları ve türleri.',
    parameters: {
      type: 'object',
      properties: {
        hospital: { type: 'string', description: 'Hastane adı' },
        period: { type: 'string', description: 'Dönem (ör: 2024-Kasım)' },
        physician: { type: 'string', description: 'Hekim adı filtresi (opsiyonel)', optional: true }
      },
      required: ['hospital']
    }
  },
  {
    name: 'compare_periods',
    description: 'İki dönemi karşılaştır. Muayene, ameliyat ve verimlilik değişimlerini hesapla.',
    parameters: {
      type: 'object',
      properties: {
        hospital: { type: 'string', description: 'Hastane adı' },
        period1: { type: 'string', description: 'Birinci dönem (ör: 2024-Ekim)' },
        period2: { type: 'string', description: 'İkinci dönem (ör: 2024-Kasım)' },
        metrics: {
          type: 'array',
          items: { type: 'string' },
          description: 'Karşılaştırılacak metrikler (muayene, ameliyat, kapasite)'
        }
      },
      required: ['hospital', 'period1', 'period2']
    }
  },
  {
    name: 'calculate_efficiency',
    description: 'Verimlilik metriklerini hesapla. Kapasite kullanımı, MHRS oranı vb.',
    parameters: {
      type: 'object',
      properties: {
        hospital: { type: 'string', description: 'Hastane adı' },
        period: { type: 'string', description: 'Dönem (ör: 2024-Kasım)' },
        branch: { type: 'string', description: 'Branş filtresi (opsiyonel)', optional: true }
      },
      required: ['hospital']
    }
  },
  {
    name: 'get_green_area_rates',
    description: 'Yeşil alan (acil servis) oranlarını getir.',
    parameters: {
      type: 'object',
      properties: {
        hospital: { type: 'string', description: 'Hastane adı filtresi (opsiyonel)', optional: true },
        startDate: { type: 'string', description: 'Başlangıç tarihi (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'Bitiş tarihi (YYYY-MM-DD)' }
      },
      required: ['startDate', 'endDate']
    }
  },
  {
    name: 'generate_table',
    description: 'Veri tablosu oluştur ve formatla.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Tablo başlığı' },
        columns: {
          type: 'array',
          items: { type: 'string' },
          description: 'Sütun başlıkları'
        },
        data: {
          type: 'array',
          items: { type: 'object' },
          description: 'Tablo verileri'
        }
      },
      required: ['title', 'columns', 'data']
    }
  },
  {
    name: 'generate_chart_config',
    description: 'Grafik konfigürasyonu oluştur (frontend tarafından render edilecek).',
    parameters: {
      type: 'object',
      properties: {
        chartType: {
          type: 'string',
          enum: ['bar', 'line', 'pie', 'area'],
          description: 'Grafik türü'
        },
        title: { type: 'string', description: 'Grafik başlığı' },
        data: {
          type: 'array',
          items: { type: 'object' },
          description: 'Grafik verileri'
        },
        xAxisKey: { type: 'string', description: 'X ekseni için kullanılacak alan' },
        yAxisKey: { type: 'string', description: 'Y ekseni için kullanılacak alan' }
      },
      required: ['chartType', 'title', 'data', 'xAxisKey', 'yAxisKey']
    }
  }
];

// ==================== Tool Executors ====================

export const executeToolCall = async (
  toolName: string,
  args: Record<string, any>,
  hospitalId: string
): Promise<any> => {
  console.log(`Tool çağrısı: ${toolName}`, args);

  switch (toolName as AIToolName) {
    case 'read_schedule_data':
      return await readScheduleData(args, hospitalId);

    case 'read_muayene_data':
      return await readMuayeneData(args, hospitalId);

    case 'read_ameliyat_data':
      return await readAmeliyatData(args, hospitalId);

    case 'compare_periods':
      return await comparePeriods(args, hospitalId);

    case 'calculate_efficiency':
      return await calculateEfficiency(args, hospitalId);

    case 'get_green_area_rates':
      return await getGreenAreaRates(args);

    case 'generate_table':
      return generateTable(args);

    case 'generate_chart_config':
      return generateChartConfig(args);

    default:
      throw new Error(`Bilinmeyen tool: ${toolName}`);
  }
};

// ==================== Tool Implementations ====================

async function readScheduleData(
  args: { hospital: string; month?: string; year?: number; branch?: string; physician?: string },
  hospitalId: string
): Promise<any> {
  try {
    const hospital = args.hospital || hospitalId;
    const scheduleData = await loadAllDetailedScheduleData(hospital, args.month, args.year);

    if (!scheduleData || scheduleData.length === 0) {
      return {
        success: false,
        message: `${hospital} için ${args.year || ''} ${args.month || ''} döneminde cetvel verisi bulunamadı.`,
        data: []
      };
    }

    // Filtreleme
    let filteredData = scheduleData;

    if (args.branch) {
      filteredData = filteredData.filter(d =>
        d.specialty?.toLowerCase().includes(args.branch!.toLowerCase())
      );
    }

    if (args.physician) {
      filteredData = filteredData.filter(d =>
        d.doctorName?.toLowerCase().includes(args.physician!.toLowerCase())
      );
    }

    // Özet istatistikler
    const uniquePhysicians = new Set(filteredData.map(d => d.doctorName));
    const uniqueBranches = new Set(filteredData.map(d => d.specialty));
    const totalCapacity = filteredData.reduce((sum, d) => sum + (d.capacity || 0), 0);

    return {
      success: true,
      summary: {
        hekimSayisi: uniquePhysicians.size,
        bransSayisi: uniqueBranches.size,
        toplamKapasite: totalCapacity,
        kayitSayisi: filteredData.length
      },
      data: filteredData.slice(0, 100), // İlk 100 kayıt
      message: `${hospital} için ${filteredData.length} cetvel kaydı bulundu.`
    };
  } catch (error) {
    console.error('Cetvel verisi okuma hatası:', error);
    return {
      success: false,
      message: `Cetvel verisi okunamadı: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
      data: []
    };
  }
}

async function readMuayeneData(
  args: { hospital: string; period?: string; physician?: string },
  hospitalId: string
): Promise<any> {
  try {
    const hospital = args.hospital || hospitalId;

    // Period'u parse et (2024-Kasım -> year: 2024, month: 'Kasım')
    let year: number | undefined;
    let month: string | undefined;

    if (args.period) {
      const parts = args.period.split('-');
      if (parts.length === 2) {
        year = parseInt(parts[0]);
        month = parts[1];
      }
    }

    const muayeneData = await loadAllMuayeneData(hospital, month, year);

    if (!muayeneData || Object.keys(muayeneData).length === 0) {
      return {
        success: false,
        message: `${hospital} için muayene verisi bulunamadı.`,
        data: {}
      };
    }

    // Period key oluştur
    const periodKey = args.period || Object.keys(muayeneData)[0];
    const periodData = muayeneData[periodKey] || {};

    // Filtreleme
    let physicians = Object.entries(periodData);

    if (args.physician) {
      physicians = physicians.filter(([name]) =>
        name.toLowerCase().includes(args.physician!.toLowerCase())
      );
    }

    // Özet hesapla
    let totalMhrs = 0;
    let totalAyaktan = 0;
    let totalToplam = 0;

    physicians.forEach(([_, data]: [string, any]) => {
      totalMhrs += data.mhrs || 0;
      totalAyaktan += data.ayaktan || 0;
      totalToplam += data.toplam || 0;
    });

    return {
      success: true,
      summary: {
        hekimSayisi: physicians.length,
        toplamMHRS: totalMhrs,
        toplamAyaktan: totalAyaktan,
        toplamMuayene: totalToplam,
        mhrsOrani: totalToplam > 0 ? ((totalMhrs / totalToplam) * 100).toFixed(1) + '%' : '0%'
      },
      data: Object.fromEntries(physicians.slice(0, 50)),
      period: periodKey,
      message: `${hospital} için ${periodKey} döneminde ${physicians.length} hekim muayene verisi bulundu.`
    };
  } catch (error) {
    console.error('Muayene verisi okuma hatası:', error);
    return {
      success: false,
      message: `Muayene verisi okunamadı: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
      data: {}
    };
  }
}

async function readAmeliyatData(
  args: { hospital: string; period?: string; physician?: string },
  hospitalId: string
): Promise<any> {
  try {
    const hospital = args.hospital || hospitalId;

    let year: number | undefined;
    let month: string | undefined;

    if (args.period) {
      const parts = args.period.split('-');
      if (parts.length === 2) {
        year = parseInt(parts[0]);
        month = parts[1];
      }
    }

    const ameliyatData = await loadAllAmeliyatData(hospital, month, year);

    if (!ameliyatData || Object.keys(ameliyatData).length === 0) {
      return {
        success: false,
        message: `${hospital} için ameliyat verisi bulunamadı.`,
        data: {}
      };
    }

    const periodKey = args.period || Object.keys(ameliyatData)[0];
    const periodData = ameliyatData[periodKey] || {};

    let physicians = Object.entries(periodData);

    if (args.physician) {
      physicians = physicians.filter(([name]) =>
        name.toLowerCase().includes(args.physician!.toLowerCase())
      );
    }

    let totalSurgeries = 0;
    physicians.forEach(([_, count]: [string, any]) => {
      totalSurgeries += typeof count === 'number' ? count : 0;
    });

    return {
      success: true,
      summary: {
        hekimSayisi: physicians.length,
        toplamAmeliyat: totalSurgeries
      },
      data: Object.fromEntries(physicians.slice(0, 50)),
      period: periodKey,
      message: `${hospital} için ${periodKey} döneminde ${physicians.length} hekim ameliyat verisi bulundu.`
    };
  } catch (error) {
    console.error('Ameliyat verisi okuma hatası:', error);
    return {
      success: false,
      message: `Ameliyat verisi okunamadı: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
      data: {}
    };
  }
}

async function comparePeriods(
  args: { hospital: string; period1: string; period2: string; metrics?: string[] },
  hospitalId: string
): Promise<any> {
  try {
    const hospital = args.hospital || hospitalId;

    // Her iki dönem için veri çek
    const [muayene1, muayene2] = await Promise.all([
      loadAllMuayeneData(hospital),
      loadAllMuayeneData(hospital)
    ]);

    const data1 = muayene1[args.period1] || {};
    const data2 = muayene2[args.period2] || {};

    // Karşılaştırma hesapla
    const comparison: any = {
      period1: args.period1,
      period2: args.period2,
      changes: {}
    };

    // Toplam muayene karşılaştırması
    const total1 = Object.values(data1).reduce((sum: number, d: any) => sum + (d.toplam || 0), 0);
    const total2 = Object.values(data2).reduce((sum: number, d: any) => sum + (d.toplam || 0), 0);

    comparison.changes.muayene = {
      period1: total1,
      period2: total2,
      difference: total2 - total1,
      percentChange: total1 > 0 ? (((total2 - total1) / total1) * 100).toFixed(1) + '%' : 'N/A'
    };

    // MHRS karşılaştırması
    const mhrs1 = Object.values(data1).reduce((sum: number, d: any) => sum + (d.mhrs || 0), 0);
    const mhrs2 = Object.values(data2).reduce((sum: number, d: any) => sum + (d.mhrs || 0), 0);

    comparison.changes.mhrs = {
      period1: mhrs1,
      period2: mhrs2,
      difference: mhrs2 - mhrs1,
      percentChange: mhrs1 > 0 ? (((mhrs2 - mhrs1) / mhrs1) * 100).toFixed(1) + '%' : 'N/A'
    };

    return {
      success: true,
      comparison,
      message: `${hospital} için ${args.period1} ve ${args.period2} dönemleri karşılaştırıldı.`
    };
  } catch (error) {
    console.error('Dönem karşılaştırma hatası:', error);
    return {
      success: false,
      message: `Dönem karşılaştırması yapılamadı: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`
    };
  }
}

async function calculateEfficiency(
  args: { hospital: string; period?: string; branch?: string },
  hospitalId: string
): Promise<any> {
  try {
    const hospital = args.hospital || hospitalId;

    // Muayene ve cetvel verilerini çek
    const [muayeneData, scheduleData] = await Promise.all([
      loadAllMuayeneData(hospital),
      loadAllDetailedScheduleData(hospital)
    ]);

    const periodKey = args.period || Object.keys(muayeneData)[0];
    const muayene = muayeneData[periodKey] || {};

    // Verimlilik hesapla
    const efficiency: any[] = [];

    Object.entries(muayene).forEach(([physician, data]: [string, any]) => {
      const totalMuayene = data.toplam || 0;
      const mhrs = data.mhrs || 0;
      const mhrsOrani = totalMuayene > 0 ? (mhrs / totalMuayene) * 100 : 0;

      efficiency.push({
        hekim: physician,
        toplamMuayene: totalMuayene,
        mhrs,
        ayaktan: data.ayaktan || 0,
        mhrsOrani: mhrsOrani.toFixed(1) + '%',
        verimlilik: mhrsOrani >= 70 ? 'Yüksek' : mhrsOrani >= 50 ? 'Orta' : 'Düşük'
      });
    });

    // Sırala (verimlilik yüksek olanlar önce)
    efficiency.sort((a, b) => parseFloat(b.mhrsOrani) - parseFloat(a.mhrsOrani));

    return {
      success: true,
      summary: {
        toplamHekim: efficiency.length,
        yuksekVerimlilik: efficiency.filter(e => e.verimlilik === 'Yüksek').length,
        ortaVerimlilik: efficiency.filter(e => e.verimlilik === 'Orta').length,
        dusukVerimlilik: efficiency.filter(e => e.verimlilik === 'Düşük').length
      },
      data: efficiency.slice(0, 20),
      period: periodKey,
      message: `${hospital} için verimlilik analizi tamamlandı.`
    };
  } catch (error) {
    console.error('Verimlilik hesaplama hatası:', error);
    return {
      success: false,
      message: `Verimlilik hesaplanamadı: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`
    };
  }
}

async function getGreenAreaRates(
  args: { hospital?: string; startDate: string; endDate: string }
): Promise<any> {
  try {
    // Tarih aralığındaki günleri hesapla
    const start = new Date(args.startDate);
    const end = new Date(args.endDate);
    const dates: string[] = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }

    const greenAreaData = await loadMultipleDatesData(dates);

    if (!greenAreaData || Object.keys(greenAreaData).length === 0) {
      return {
        success: false,
        message: `${args.startDate} - ${args.endDate} aralığında yeşil alan verisi bulunamadı.`,
        data: []
      };
    }

    // Hastane filtresi uygula
    let hospitalData = greenAreaData;
    if (args.hospital) {
      const filteredData: Record<string, any> = {};
      Object.entries(greenAreaData).forEach(([hospital, data]) => {
        if (hospital.toLowerCase().includes(args.hospital!.toLowerCase())) {
          filteredData[hospital] = data;
        }
      });
      hospitalData = filteredData;
    }

    // Özet hesapla
    let totalGreen = 0;
    let totalAll = 0;

    Object.values(hospitalData).forEach((hospital: any) => {
      Object.values(hospital).forEach((day: any) => {
        totalGreen += day.greenAreaCount || 0;
        totalAll += day.totalCount || 0;
      });
    });

    return {
      success: true,
      summary: {
        hastaneSayisi: Object.keys(hospitalData).length,
        toplamYesilAlan: totalGreen,
        toplamBasvuru: totalAll,
        yesilAlanOrani: totalAll > 0 ? ((totalGreen / totalAll) * 100).toFixed(1) + '%' : '0%'
      },
      data: hospitalData,
      dateRange: { start: args.startDate, end: args.endDate },
      message: `${args.startDate} - ${args.endDate} aralığında yeşil alan verileri getirildi.`
    };
  } catch (error) {
    console.error('Yeşil alan verisi okuma hatası:', error);
    return {
      success: false,
      message: `Yeşil alan verisi okunamadı: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
      data: []
    };
  }
}

function generateTable(args: { title: string; columns: any[]; data: any[] }): AITableConfig {
  return {
    title: args.title,
    columns: args.columns.map(col => ({
      key: typeof col === 'string' ? col : col.key,
      header: typeof col === 'string' ? col : col.header,
      align: 'left' as const
    })),
    data: args.data
  };
}

function generateChartConfig(args: {
  chartType: string;
  title: string;
  data: any[];
  xAxisKey: string;
  yAxisKey: string;
}): AIChartConfig {
  return {
    chartType: args.chartType as 'bar' | 'line' | 'pie' | 'area',
    title: args.title,
    data: args.data,
    xAxisKey: args.xAxisKey,
    yAxisKey: args.yAxisKey,
    colors: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'],
    legend: true
  };
}
