// Claude Gateway - Anthropic Claude API Entegrasyonu
import Anthropic from '@anthropic-ai/sdk';
import {
  AIServiceConfig,
  AIChatResponse,
  AIToolCall,
  AIToolDefinition
} from '../../types/ai';
import { getToolDefinitions, executeToolCall } from './aiToolService';

// Claude Client
let client: Anthropic | null = null;

// System Prompt - Sesli yanıtlar için optimize edilmiş
const SYSTEM_PROMPT_TR = `Sen MEDİS (MHRS Entegre Değerlendirme ve İzleme Sistemi) için geliştirilmiş bir sesli AI asistansın.

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
- Belirsiz durumlarda kullanıcıdan açıklama iste`;

// Default config
export const DEFAULT_CLAUDE_CONFIG: AIServiceConfig = {
  model: 'claude-3-5-sonnet-20241022' as any,
  maxTokens: 1024,
  temperature: 0.7,
  systemPrompt: SYSTEM_PROMPT_TR
};

// API Key yönetimi
const getApiKey = (): string => {
  // Önce environment variable kontrol et
  const envKey = import.meta.env.VITE_CLAUDE_API_KEY;
  if (envKey) return envKey;

  // Fallback: localStorage'dan (geliştirme için)
  const storedKey = localStorage.getItem('claude_api_key');
  if (storedKey) return storedKey;

  throw new Error('Claude API key bulunamadı. VITE_CLAUDE_API_KEY environment variable tanımlayın.');
};

// Client başlatma
export const initializeClaude = (config?: Partial<AIServiceConfig>): void => {
  try {
    const apiKey = getApiKey();

    client = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true // Frontend için gerekli
    });

    console.log('Claude AI başarıyla başlatıldı');
  } catch (error) {
    console.error('Claude AI başlatma hatası:', error);
    throw error;
  }
};

// Tool definitions'ı Claude formatına dönüştür
const convertToolsToClaudeFormat = (tools: AIToolDefinition[]): Anthropic.Tool[] => {
  return tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: 'object' as const,
      properties: Object.fromEntries(
        Object.entries(tool.parameters.properties).map(([key, value]) => [
          key,
          {
            type: value.type,
            description: value.description,
            enum: value.enum,
            items: value.items
          }
        ])
      ),
      required: tool.parameters.required
    }
  }));
};

// Claude mesaj formatına dönüştür
interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string | Anthropic.ContentBlockParam[];
}

// Chat history'yi Claude formatına dönüştür
const convertHistoryToClaudeFormat = (history: Array<{ role: string; content: string }>): ClaudeMessage[] => {
  return history
    .filter(msg => msg.role === 'user' || msg.role === 'assistant')
    .map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }));
};

// Chat mesajı gönder
export const sendMessage = async (
  message: string,
  history: Array<{ role: string; content: string }> = [],
  context?: {
    hospitalId: string;
    currentView?: string;
    selectedFilters?: Record<string, any>;
  }
): Promise<AIChatResponse> => {
  if (!client) {
    initializeClaude();
  }

  if (!client) {
    throw new Error('Claude client başlatılamadı');
  }

  try {
    // Tool definitions al
    const toolDefinitions = getToolDefinitions();
    const claudeTools = convertToolsToClaudeFormat(toolDefinitions);

    // Context'i mesaja ekle
    let enhancedMessage = message;
    if (context) {
      const contextInfo = [
        context.hospitalId ? `Hastane: ${context.hospitalId}` : '',
        context.currentView ? `Mevcut görünüm: ${context.currentView}` : '',
        context.selectedFilters ? `Seçili filtreler: ${JSON.stringify(context.selectedFilters)}` : ''
      ].filter(Boolean).join('\n');

      if (contextInfo) {
        enhancedMessage = `[Bağlam Bilgisi]\n${contextInfo}\n\n[Kullanıcı Sorusu]\n${message}`;
      }
    }

    // Mesaj geçmişini dönüştür
    const claudeHistory = convertHistoryToClaudeFormat(history);

    // Yeni mesajı ekle
    const messages: ClaudeMessage[] = [
      ...claudeHistory,
      { role: 'user' as const, content: enhancedMessage }
    ];

    // İlk API çağrısı
    let response = await client.messages.create({
      model: DEFAULT_CLAUDE_CONFIG.model as string,
      max_tokens: DEFAULT_CLAUDE_CONFIG.maxTokens,
      system: DEFAULT_CLAUDE_CONFIG.systemPrompt,
      tools: claudeTools,
      messages: messages as Anthropic.MessageParam[]
    });

    // Tool calls kontrol et ve işle
    const toolCalls: AIToolCall[] = [];
    let finalResponse = '';
    let currentMessages = [...messages];

    // Tool use loop - Claude tool kullanmak isteyebilir
    while (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      // Her tool call için
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        const toolCall: AIToolCall = {
          name: toolUse.name,
          arguments: toolUse.input as Record<string, any>,
          status: 'pending'
        };

        try {
          // Tool'u çalıştır
          const toolResult = await executeToolCall(
            toolUse.name,
            toolUse.input as Record<string, any>,
            context?.hospitalId || ''
          );

          toolCall.result = toolResult;
          toolCall.status = 'success';

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(toolResult)
          });
        } catch (error) {
          toolCall.status = 'error';
          toolCall.error = error instanceof Error ? error.message : 'Tool çalıştırma hatası';

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: `Hata: ${toolCall.error}`,
            is_error: true
          });
        }

        toolCalls.push(toolCall);
      }

      // Assistant mesajını ve tool results'ı ekle
      currentMessages.push({
        role: 'assistant',
        content: response.content as Anthropic.ContentBlockParam[]
      });

      currentMessages.push({
        role: 'user',
        content: toolResults
      });

      // Yeni API çağrısı
      response = await client.messages.create({
        model: DEFAULT_CLAUDE_CONFIG.model as string,
        max_tokens: DEFAULT_CLAUDE_CONFIG.maxTokens,
        system: DEFAULT_CLAUDE_CONFIG.systemPrompt,
        tools: claudeTools,
        messages: currentMessages as Anthropic.MessageParam[]
      });
    }

    // Final text response'u al
    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    );
    finalResponse = textBlocks.map(block => block.text).join('\n');

    return {
      chatId: '',
      messageId: '',
      response: finalResponse,
      toolResults: toolCalls.length > 0 ? toolCalls.map(tc => ({
        toolName: tc.name,
        success: tc.status === 'success',
        data: tc.result,
        error: tc.error,
        renderType: determineRenderType(tc.name)
      })) : undefined,
      suggestions: generateSuggestions(finalResponse, message),
      usage: response.usage ? {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens
      } : undefined
    };
  } catch (error) {
    console.error('Claude API hatası:', error);
    throw error;
  }
};

// Streaming mesaj gönder
export const sendMessageStream = async (
  message: string,
  history: Array<{ role: string; content: string }> = [],
  onChunk: (text: string) => void,
  context?: {
    hospitalId: string;
    currentView?: string;
    selectedFilters?: Record<string, any>;
  }
): Promise<AIChatResponse> => {
  if (!client) {
    initializeClaude();
  }

  if (!client) {
    throw new Error('Claude client başlatılamadı');
  }

  try {
    // Context'i mesaja ekle
    let enhancedMessage = message;
    if (context) {
      const contextInfo = [
        context.hospitalId ? `Hastane: ${context.hospitalId}` : '',
        context.currentView ? `Mevcut görünüm: ${context.currentView}` : '',
        context.selectedFilters ? `Seçili filtreler: ${JSON.stringify(context.selectedFilters)}` : ''
      ].filter(Boolean).join('\n');

      if (contextInfo) {
        enhancedMessage = `[Bağlam Bilgisi]\n${contextInfo}\n\n[Kullanıcı Sorusu]\n${message}`;
      }
    }

    // Mesaj geçmişini dönüştür
    const claudeHistory = convertHistoryToClaudeFormat(history);

    const messages: ClaudeMessage[] = [
      ...claudeHistory,
      { role: 'user' as const, content: enhancedMessage }
    ];

    // Streaming API çağrısı
    const stream = await client.messages.stream({
      model: DEFAULT_CLAUDE_CONFIG.model as string,
      max_tokens: DEFAULT_CLAUDE_CONFIG.maxTokens,
      system: DEFAULT_CLAUDE_CONFIG.systemPrompt,
      messages: messages as Anthropic.MessageParam[]
    });

    let fullResponse = '';

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const text = event.delta.text;
        fullResponse += text;
        onChunk(text);
      }
    }

    const finalMessage = await stream.finalMessage();

    return {
      chatId: '',
      messageId: '',
      response: fullResponse,
      suggestions: generateSuggestions(fullResponse, message),
      usage: finalMessage.usage ? {
        promptTokens: finalMessage.usage.input_tokens,
        completionTokens: finalMessage.usage.output_tokens,
        totalTokens: finalMessage.usage.input_tokens + finalMessage.usage.output_tokens
      } : undefined
    };
  } catch (error) {
    console.error('Claude streaming hatası:', error);
    throw error;
  }
};

// Render tipi belirle
const determineRenderType = (toolName: string): 'table' | 'chart' | 'text' | 'markdown' => {
  if (toolName === 'generate_table') return 'table';
  if (toolName === 'generate_chart_config') return 'chart';
  if (toolName.startsWith('read_') || toolName.startsWith('get_')) return 'markdown';
  return 'text';
};

// Takip soruları öner
const generateSuggestions = (response: string, originalMessage: string): string[] => {
  const suggestions: string[] = [];

  if (response.includes('hekim') || response.includes('doktor')) {
    suggestions.push('Bu hekimlerin detaylı performansını göster');
  }
  if (response.includes('branş')) {
    suggestions.push('En iyi performans gösteren branşları karşılaştır');
  }
  if (response.includes('ay') || response.includes('dönem')) {
    suggestions.push('Geçen ayla karşılaştır');
  }
  if (response.includes('muayene')) {
    suggestions.push('MHRS ve ayaktan muayene dağılımını göster');
  }
  if (response.includes('ameliyat')) {
    suggestions.push('Ameliyat türlerine göre dağılımı göster');
  }

  return suggestions.slice(0, 3);
};

// API key'i güvenli şekilde ayarla
export const setApiKey = (apiKey: string): void => {
  localStorage.setItem('claude_api_key', apiKey);
  // Yeniden başlat
  client = null;
};

// API key kontrol et
export const hasApiKey = (): boolean => {
  try {
    getApiKey();
    return true;
  } catch {
    return false;
  }
};

// Bağlantıyı test et
export const testConnection = async (): Promise<boolean> => {
  try {
    client = null;

    const apiKey = getApiKey();
    console.log('Claude API Key test ediliyor...');

    client = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true
    });

    const response = await client.messages.create({
      model: DEFAULT_CLAUDE_CONFIG.model as string,
      max_tokens: 50,
      messages: [{ role: 'user', content: 'Say only: OK' }]
    });

    const textContent = response.content.find(c => c.type === 'text');
    console.log('Claude yanıtı:', textContent?.text);

    return response.content.length > 0;
  } catch (error: any) {
    console.error('Bağlantı testi başarısız:', error);
    return false;
  }
};
