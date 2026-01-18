// LLM Gateway - Gemini API Entegrasyonu
import { GoogleGenerativeAI, GenerativeModel, Content, Part, FunctionDeclaration, Tool } from '@google/generative-ai';
import {
  AIServiceConfig,
  DEFAULT_AI_CONFIG,
  AIChatResponse,
  AIToolCall,
  AIToolDefinition
} from '../../types/ai';
import { getToolDefinitions, executeToolCall } from './aiToolService';

// Gemini Client
let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;

// API Key yönetimi - Environment variable veya Firebase config'den alınacak
const getApiKey = (): string => {
  // Önce environment variable kontrol et
  const envKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (envKey) return envKey;

  // Fallback: localStorage'dan (geliştirme için)
  const storedKey = localStorage.getItem('gemini_api_key');
  if (storedKey) return storedKey;

  throw new Error('Gemini API key bulunamadı. VITE_GEMINI_API_KEY environment variable tanımlayın.');
};

// Client başlatma
export const initializeGemini = (config?: Partial<AIServiceConfig>): void => {
  try {
    const apiKey = getApiKey();
    genAI = new GoogleGenerativeAI(apiKey);

    const modelConfig = { ...DEFAULT_AI_CONFIG, ...config };

    model = genAI.getGenerativeModel({
      model: modelConfig.model,
      generationConfig: {
        maxOutputTokens: modelConfig.maxTokens,
        temperature: modelConfig.temperature,
      },
      systemInstruction: modelConfig.systemPrompt,
    });

    console.log('Gemini AI başarıyla başlatıldı:', modelConfig.model);
  } catch (error) {
    console.error('Gemini AI başlatma hatası:', error);
    throw error;
  }
};

// Tool definitions'ı Gemini formatına dönüştür
const convertToolsToGeminiFormat = (tools: AIToolDefinition[]): Tool[] => {
  const functionDeclarations: FunctionDeclaration[] = tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: {
      type: 'object' as const,
      properties: Object.fromEntries(
        Object.entries(tool.parameters.properties).map(([key, value]) => [
          key,
          {
            type: value.type,
            description: value.description,
            enum: value.enum,
          }
        ])
      ),
      required: tool.parameters.required,
    },
  }));

  return [{ functionDeclarations }];
};

// Chat mesajı gönder
export const sendMessage = async (
  message: string,
  history: Content[] = [],
  context?: {
    hospitalId: string;
    currentView?: string;
    selectedFilters?: Record<string, any>;
  }
): Promise<AIChatResponse> => {
  if (!model) {
    initializeGemini();
  }

  if (!model) {
    throw new Error('Gemini model başlatılamadı');
  }

  try {
    // Tool definitions al
    const toolDefinitions = getToolDefinitions();
    const geminiTools = convertToolsToGeminiFormat(toolDefinitions);

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

    // Chat session başlat
    const chat = model.startChat({
      history,
      tools: geminiTools,
    });

    // Mesaj gönder
    const result = await chat.sendMessage(enhancedMessage);
    const response = result.response;

    // Tool calls kontrol et
    const toolCalls: AIToolCall[] = [];
    let finalResponse = '';

    // Function call varsa işle
    const functionCalls = response.functionCalls();
    if (functionCalls && functionCalls.length > 0) {
      for (const call of functionCalls) {
        const toolCall: AIToolCall = {
          name: call.name,
          arguments: call.args as Record<string, any>,
          status: 'pending'
        };

        try {
          // Tool'u çalıştır
          const toolResult = await executeToolCall(
            call.name,
            call.args as Record<string, any>,
            context?.hospitalId || ''
          );

          toolCall.result = toolResult;
          toolCall.status = 'success';

          // Tool sonucunu modele gönder
          const functionResponse = await chat.sendMessage([{
            functionResponse: {
              name: call.name,
              response: toolResult
            }
          }]);

          finalResponse = functionResponse.response.text();
        } catch (error) {
          toolCall.status = 'error';
          toolCall.error = error instanceof Error ? error.message : 'Tool çalıştırma hatası';
        }

        toolCalls.push(toolCall);
      }
    } else {
      finalResponse = response.text();
    }

    // Kullanım bilgisi
    const usageMetadata = response.usageMetadata;

    return {
      chatId: '', // Caller tarafından set edilecek
      messageId: '', // Caller tarafından set edilecek
      response: finalResponse,
      toolResults: toolCalls.length > 0 ? toolCalls.map(tc => ({
        toolName: tc.name,
        success: tc.status === 'success',
        data: tc.result,
        error: tc.error,
        renderType: determineRenderType(tc.name)
      })) : undefined,
      suggestions: generateSuggestions(finalResponse, message),
      usage: usageMetadata ? {
        promptTokens: usageMetadata.promptTokenCount || 0,
        completionTokens: usageMetadata.candidatesTokenCount || 0,
        totalTokens: usageMetadata.totalTokenCount || 0
      } : undefined
    };
  } catch (error) {
    console.error('Gemini API hatası:', error);
    throw error;
  }
};

// Streaming mesaj gönder
export const sendMessageStream = async (
  message: string,
  history: Content[] = [],
  onChunk: (text: string) => void,
  context?: {
    hospitalId: string;
    currentView?: string;
    selectedFilters?: Record<string, any>;
  }
): Promise<AIChatResponse> => {
  if (!model) {
    initializeGemini();
  }

  if (!model) {
    throw new Error('Gemini model başlatılamadı');
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

    const chat = model.startChat({ history });
    const result = await chat.sendMessageStream(enhancedMessage);

    let fullResponse = '';

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullResponse += chunkText;
      onChunk(chunkText);
    }

    return {
      chatId: '',
      messageId: '',
      response: fullResponse,
      suggestions: generateSuggestions(fullResponse, message)
    };
  } catch (error) {
    console.error('Gemini streaming hatası:', error);
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

  // Basit kural tabanlı öneriler
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

  // Maksimum 3 öneri
  return suggestions.slice(0, 3);
};

// API key'i güvenli şekilde ayarla (geliştirme için)
export const setApiKey = (apiKey: string): void => {
  localStorage.setItem('gemini_api_key', apiKey);
  // Yeniden başlat
  genAI = null;
  model = null;
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
    // Her zaman yeniden başlat
    genAI = null;
    model = null;

    const apiKey = getApiKey();
    console.log('API Key test ediliyor... (ilk 10 karakter):', apiKey.substring(0, 10) + '...');

    genAI = new GoogleGenerativeAI(apiKey);

    // Basit model kullan (daha hızlı test için)
    const testModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await testModel.generateContent('Say only: OK');
    const text = result.response.text();
    console.log('Gemini yanıtı:', text);

    // Başarılıysa asıl modeli de başlat
    if (text.length > 0) {
      initializeGemini();
      return true;
    }
    return false;
  } catch (error: any) {
    console.error('Bağlantı testi başarısız:', error);
    console.error('Hata detayı:', error?.message || error);
    return false;
  }
};
