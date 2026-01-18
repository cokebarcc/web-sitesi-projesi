// AI Asistan Type Definitions

// ==================== Chat Types ====================

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolCalls?: AIToolCall[];
  feedback?: AIFeedback;
}

export interface AIToolCall {
  name: string;
  arguments: Record<string, any>;
  result?: any;
  status: 'pending' | 'success' | 'error';
  error?: string;
}

export interface AIFeedback {
  helpful: boolean;
  rating?: 1 | 2 | 3 | 4 | 5;
  correctedResponse?: string;
  submittedAt?: Date;
}

export interface AIChat {
  id: string;
  userId: string;
  hospitalId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'archived';
  messageCount: number;
}

// ==================== Memory Types ====================

export interface AIUserPreference {
  preferredLanguage: 'tr' | 'en';
  reportFormat: 'detailed' | 'summary';
  favoriteCharts: string[];
  lastUsedFilters: Record<string, any>;
  updatedAt: Date;
}

export interface AICustomTerm {
  standardName: string;
  aliases: string[];
  category: 'branch' | 'action' | 'metric' | 'hospital' | 'other';
  addedBy: string;
  addedAt: Date;
}

export interface AIApprovedResponse {
  query: string;
  response: string;
  approvedBy: string;
  approvedAt: Date;
  useCount: number;
  lastUsed?: Date;
}

export interface AIFrequentQuery {
  query: string;
  count: number;
  lastUsed: Date;
  category: string;
}

export interface AIMemory {
  hospitalId: string;
  userPreferences: Record<string, AIUserPreference>;
  customTerms: Record<string, AICustomTerm>;
  approvedResponses: Record<string, AIApprovedResponse>;
  frequentQueries: Record<string, AIFrequentQuery>;
}

// ==================== Tool Types ====================

export type AIToolName =
  | 'read_schedule_data'
  | 'read_muayene_data'
  | 'read_ameliyat_data'
  | 'compare_periods'
  | 'calculate_efficiency'
  | 'get_green_area_rates'
  | 'generate_table'
  | 'generate_chart_config'
  | 'export_report';

export interface AIToolDefinition {
  name: AIToolName;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
      items?: { type: string };
      optional?: boolean;
    }>;
    required: string[];
  };
}

// ==================== Request/Response Types ====================

export interface AIChatRequest {
  hospitalId: string;
  chatId?: string;
  message: string;
  attachments?: AIAttachment[];
  context?: AIContext;
}

export interface AIAttachment {
  type: 'excel' | 'pdf' | 'image';
  fileUrl: string;
  fileName: string;
}

export interface AIContext {
  currentView: string;
  selectedFilters: {
    hospital?: string;
    years?: number[];
    months?: number[];
    branch?: string;
  };
  availableData?: {
    hasScheduleData: boolean;
    hasMuayeneData: boolean;
    hasAmeliyatData: boolean;
    hasGreenAreaData: boolean;
  };
}

export interface AIChatResponse {
  chatId: string;
  messageId: string;
  response: string;
  toolResults?: AIToolResult[];
  suggestions?: string[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AIToolResult {
  toolName: string;
  success: boolean;
  data?: any;
  error?: string;
  renderType?: 'table' | 'chart' | 'text' | 'markdown';
}

// ==================== Chart Config Types ====================

export interface AIChartConfig {
  chartType: 'bar' | 'line' | 'pie' | 'scatter' | 'area';
  title: string;
  data: any[];
  xAxisKey: string;
  yAxisKey: string | string[];
  colors?: string[];
  legend?: boolean;
}

export interface AITableConfig {
  title: string;
  columns: {
    key: string;
    header: string;
    align?: 'left' | 'center' | 'right';
    format?: 'number' | 'percent' | 'currency' | 'date';
  }[];
  data: Record<string, any>[];
  summary?: Record<string, any>;
}

// ==================== Quick Command Types ====================

export interface AIQuickCommand {
  id: string;
  label: string;
  prompt: string;
  icon: string;
  category: 'analysis' | 'report' | 'comparison' | 'trend';
  requiredData?: ('schedule' | 'muayene' | 'ameliyat' | 'greenArea')[];
}

// ==================== State Types ====================

export interface AIChatState {
  chatId: string | null;
  messages: AIMessage[];
  isLoading: boolean;
  isTyping: boolean;
  error: string | null;
  suggestions: string[];
}

export interface AIServiceConfig {
  apiKey?: string;
  model: 'claude-sonnet-4-20250514' | 'claude-3-5-sonnet-20241022' | 'claude-3-haiku-20240307';
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
}

// ==================== Default Values ====================

export const DEFAULT_AI_CONFIG: AIServiceConfig = {
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  temperature: 0.7,
  systemPrompt: `Sen MEDİS (MHRS Entegre Değerlendirme ve İzleme Sistemi) için geliştirilmiş bir sesli AI asistansın.

Görevlerin:
- Hastane yönetimi ve sağlık verilerini analiz etmek
- Detaylı cetveller, muayene ve ameliyat verilerini yorumlamak
- Hekim performansı, verimlilik ve yeşil alan oranlarını değerlendirmek
- Kullanıcıyla Türkçe sesli sohbet etmek

Kurallar:
- Her zaman Türkçe konuş
- Kısa ve net yanıtlar ver (sesli okuma için optimize et)
- Büyük sayıları yuvarlayarak söyle (örn: 1234 yerine "yaklaşık bin iki yüz")
- Uzun listeleri özetle, en önemli 3-5 maddeyi vurgula
- Tablolar ve grafikler için sesli açıklama yap
- Gizli bilgileri (TC Kimlik, telefon vb.) asla paylaşma
- Belirsiz durumlarda kullanıcıdan açıklama iste`
};

export const QUICK_COMMANDS: AIQuickCommand[] = [
  {
    id: 'monthly-summary',
    label: 'Bu Ayın Özeti',
    prompt: 'Bu ay için genel bir özet hazırla. Toplam muayene sayısı, ameliyat sayısı ve hekim performanslarını özetle.',
    icon: 'calendar',
    category: 'report',
    requiredData: ['schedule', 'muayene', 'ameliyat']
  },
  {
    id: 'top-physicians',
    label: 'En Verimli 10 Hekim',
    prompt: 'En yüksek verimlilik oranına sahip 10 hekimi listele. Muayene sayısı, kapasite kullanımı ve MHRS oranlarını göster.',
    icon: 'trophy',
    category: 'analysis',
    requiredData: ['muayene']
  },
  {
    id: 'green-area-trend',
    label: 'Yeşil Alan Trendi',
    prompt: 'Son 30 günlük yeşil alan oranları trendini analiz et. Artış/azalış eğilimini ve kritik günleri belirle.',
    icon: 'chart-line',
    category: 'trend',
    requiredData: ['greenArea']
  },
  {
    id: 'branch-comparison',
    label: 'Branş Karşılaştırması',
    prompt: 'Tüm branşların performansını karşılaştır. Muayene, ameliyat ve kapasite kullanım oranlarını branş bazında göster.',
    icon: 'chart-bar',
    category: 'comparison',
    requiredData: ['schedule', 'muayene']
  },
  {
    id: 'capacity-analysis',
    label: 'Kapasite Analizi',
    prompt: 'Mevcut kapasite kullanımını analiz et. Boş kapasiteler ve aşırı yüklenmiş hekimleri belirle.',
    icon: 'gauge',
    category: 'analysis',
    requiredData: ['schedule']
  },
  {
    id: 'period-comparison',
    label: 'Dönem Karşılaştırması',
    prompt: 'Bu ayı geçen ayla karşılaştır. Muayene, ameliyat ve verimlilik değişimlerini göster.',
    icon: 'arrows-compare',
    category: 'comparison',
    requiredData: ['muayene', 'ameliyat']
  },
  {
    id: 'anomaly-detection',
    label: 'Anomali Tespiti',
    prompt: 'Verilerde anormal durumları tespit et. Beklenenden düşük/yüksek performans gösteren hekimler ve branşları belirle.',
    icon: 'alert-triangle',
    category: 'analysis',
    requiredData: ['schedule', 'muayene']
  },
  {
    id: 'schedule-summary',
    label: 'Cetvel Özeti',
    prompt: 'Detaylı cetvellerin özetini çıkar. Hekim dağılımı, branş bazlı cetvel sayıları ve toplam kapasiteyi göster.',
    icon: 'table',
    category: 'report',
    requiredData: ['schedule']
  },
  {
    id: 'surgery-analysis',
    label: 'Ameliyat Analizi',
    prompt: 'Ameliyat verilerini analiz et. Branş bazlı ameliyat sayıları, ABC gruplaması ve ameliyat sürelerini göster.',
    icon: 'scalpel',
    category: 'analysis',
    requiredData: ['ameliyat']
  },
  {
    id: 'mhrs-performance',
    label: 'MHRS Performansı',
    prompt: 'MHRS kapasite kullanım oranlarını analiz et. Düşük MHRS oranına sahip hekimleri ve iyileştirme önerilerini sun.',
    icon: 'chart-pie',
    category: 'analysis',
    requiredData: ['muayene']
  }
];
