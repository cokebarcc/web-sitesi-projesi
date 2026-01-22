/**
 * GÖREN Hesaplama Motoru Hook
 *
 * GD (Gösterge Değeri) ve GP (Gösterge Puanı) hesaplamalarını
 * konfigürasyon tabanlı olarak gerçekleştirir.
 */

import { useCallback } from 'react';
import {
  IndicatorDefinition,
  ParameterValues,
  IndicatorResult,
  ScoringRule,
  CalculationSummary,
  StatusIndicator,
  InstitutionResult,
  InstitutionType
} from '../../components/goren/types/goren.types';

/**
 * Formül string'ini parametre değerleriyle değerlendiren güvenli fonksiyon
 *
 * Desteklenen parametreler: A, B, C, D, E, F, GO, HD, ÖD
 * Desteklenen operatörler: +, -, *, /, (, )
 *
 * @param formula Formül string'i, örn: "(A / B) * 100"
 * @param params Parametre değerleri
 * @returns Hesaplanan değer veya null (hata durumunda)
 */
const evaluateFormula = (
  formula: string,
  params: ParameterValues
): number | null => {
  try {
    // Boş formül kontrolü
    if (!formula || formula.trim() === '') {
      return null;
    }

    // Parametre değerlerini yerine koy
    let expression = formula;

    // Tüm olası parametreleri kontrol et (uzundan kısaya sırala - ÖD önce)
    const paramKeys = ['ÖD', 'GO', 'HD', 'A', 'B', 'C', 'D', 'E', 'F'];

    for (const key of paramKeys) {
      const value = params[key];
      if (expression.includes(key)) {
        if (value === null || value === undefined) {
          // Eksik parametre
          return null;
        }
        // Global replace
        expression = expression.split(key).join(String(value));
      }
    }

    // Sıfıra bölme kontrolü
    // "/ 0" veya "/0" pattern'ini kontrol et
    if (/\/\s*0(?![0-9.])/.test(expression)) {
      return null;
    }

    // Güvenli değerlendirme - sadece matematiksel ifadeler
    // Sadece sayılar, operatörler ve parantezler kabul et
    const safePattern = /^[\d\s+\-*/().]+$/;
    if (!safePattern.test(expression)) {
      console.error('[GÖREN Calculator] Güvenli olmayan ifade:', expression);
      return null;
    }

    // Hesapla
    // eslint-disable-next-line no-new-func
    const result = new Function(`return ${expression}`)();

    // Sonuç kontrolü
    if (typeof result !== 'number' || !isFinite(result) || isNaN(result)) {
      return null;
    }

    return result;
  } catch (error) {
    console.error('[GÖREN Calculator] Formül değerlendirme hatası:', formula, error);
    return null;
  }
};

/**
 * GO parametreli dinamik eşik kuralını değerlendir
 *
 * @param gd Gösterge değeri
 * @param rule Puanlama kuralı
 * @param params Parametre değerleri (GO içerebilir)
 * @returns Kural eşleşti mi?
 */
const evaluateFormulaRule = (
  gd: number,
  rule: ScoringRule,
  params: ParameterValues
): boolean => {
  const GO = params['GO'] ?? 0;

  if (!rule.formula) {
    return false;
  }

  try {
    // Formülü değerlendir
    const formula = rule.formula
      .replace(/GD/g, String(gd))
      .replace(/GO/g, String(GO));

    // eslint-disable-next-line no-new-func
    return new Function(`return ${formula}`)() === true;
  } catch {
    return false;
  }
};

/**
 * GD değerini puanlama kurallarına göre değerlendirip GP hesapla
 *
 * @param gd Gösterge değeri
 * @param rules Puanlama kuralları
 * @param params Parametre değerleri (GO için)
 * @returns GP ve eşleşen kural
 */
const calculateGP = (
  gd: number | null,
  rules: ScoringRule[],
  params: ParameterValues
): { gp: number; matchedRule?: ScoringRule } => {
  if (gd === null) {
    return { gp: 0 };
  }

  // Kuralları puana göre büyükten küçüğe sırala
  const sortedRules = [...rules].sort((a, b) => b.points - a.points);

  for (const rule of sortedRules) {
    let matches = false;

    switch (rule.operator) {
      case 'gte':
        matches = gd >= (rule.minValue ?? 0);
        break;

      case 'gt':
        matches = gd > (rule.minValue ?? 0);
        break;

      case 'lte':
        matches = gd <= (rule.maxValue ?? Infinity);
        break;

      case 'lt':
        matches = gd < (rule.maxValue ?? Infinity);
        break;

      case 'between':
        // minValue dahil, maxValue hariç: minValue <= x < maxValue
        matches = gd >= (rule.minValue ?? 0) && gd < (rule.maxValue ?? Infinity);
        break;

      case 'eq':
        matches = gd === rule.minValue;
        break;

      case 'formula':
        // GO parametreli dinamik eşik
        matches = evaluateFormulaRule(gd, rule, params);
        break;

      default:
        matches = false;
    }

    if (matches) {
      return { gp: rule.points, matchedRule: rule };
    }
  }

  // Hiçbir kural eşleşmezse 0 puan
  return { gp: 0 };
};

/**
 * GP formülü ile doğrudan puan hesapla (eşik kullanmayan göstergeler için)
 *
 * @param gd Gösterge değeri
 * @param gpFormula GP formülü, örn: "GD * 0.25"
 * @param maxPoints Maksimum puan
 * @returns Hesaplanan GP (maxPoints'i aşamaz)
 */
const calculateGPFromFormula = (
  gd: number,
  gpFormula: string,
  maxPoints: number
): number => {
  try {
    const formula = gpFormula.replace(/GD/g, String(gd));

    // eslint-disable-next-line no-new-func
    const result = new Function(`return ${formula}`)();

    if (typeof result !== 'number' || !isFinite(result) || isNaN(result)) {
      return 0;
    }

    // Maksimum puanı aşamaz, negatif olamaz
    return Math.max(0, Math.min(result, maxPoints));
  } catch {
    return 0;
  }
};

/**
 * Başarı yüzdesine göre durum göstergesi belirle
 */
const getStatusIndicator = (achievementPercent: number): StatusIndicator => {
  if (achievementPercent >= 90) return 'excellent';
  if (achievementPercent >= 70) return 'good';
  if (achievementPercent >= 50) return 'average';
  if (achievementPercent >= 30) return 'poor';
  if (achievementPercent > 0) return 'critical';
  return 'unknown';
};

/**
 * GÖREN Hesaplama Hook'u
 */
export const useGorenCalculator = () => {
  /**
   * Tek bir gösterge için hesaplama yap
   */
  const calculateIndicator = useCallback((
    definition: IndicatorDefinition,
    paramValues: ParameterValues
  ): IndicatorResult => {
    // 1. Zorunlu parametreleri kontrol et
    const missingParams = definition.parameters
      .filter(p => p.required && (paramValues[p.key] === null || paramValues[p.key] === undefined));

    if (missingParams.length > 0) {
      return {
        code: definition.code,
        name: definition.name,
        parameterValues: paramValues,
        gd: null,
        gdFormatted: '-',
        gp: 0,
        maxPoints: definition.maxPoints,
        status: 'insufficient_data',
        statusMessage: `Eksik parametreler: ${missingParams.map(p => p.key).join(', ')}`,
        statusIndicator: 'unknown',
        achievementPercent: 0
      };
    }

    // 2. B=0 kontrolü (sıfıra bölme)
    if (paramValues['B'] === 0) {
      return {
        code: definition.code,
        name: definition.name,
        parameterValues: paramValues,
        gd: null,
        gdFormatted: '-',
        gp: 0,
        maxPoints: definition.maxPoints,
        status: 'error',
        statusMessage: 'B parametresi sıfır olamaz (sıfıra bölme hatası)',
        statusIndicator: 'unknown',
        achievementPercent: 0
      };
    }

    // 3. GD hesapla
    const gd = evaluateFormula(definition.gdFormula, paramValues);

    if (gd === null) {
      return {
        code: definition.code,
        name: definition.name,
        parameterValues: paramValues,
        gd: null,
        gdFormatted: '-',
        gp: 0,
        maxPoints: definition.maxPoints,
        status: 'error',
        statusMessage: 'Hesaplama hatası (geçersiz değer veya formül)',
        statusIndicator: 'unknown',
        achievementPercent: 0
      };
    }

    // 4. GP hesapla
    let gp: number;
    let matchedRule: ScoringRule | undefined;

    if (definition.gpFormula) {
      // Formül tabanlı GP (İLSM-3, İLSM-4, İLSM-6)
      gp = calculateGPFromFormula(gd, definition.gpFormula, definition.maxPoints);
    } else if (definition.gpRules.length > 0) {
      // Eşik tabanlı GP
      const result = calculateGP(gd, definition.gpRules, paramValues);
      gp = result.gp;
      matchedRule = result.matchedRule;
    } else {
      gp = 0;
    }

    // 5. GD'yi formatla
    let gdFormatted: string;
    switch (definition.unit) {
      case 'percentage':
        gdFormatted = `%${gd.toFixed(1)}`;
        break;
      case 'ratio':
        gdFormatted = gd.toFixed(2);
        break;
      case 'count':
      case 'person':
        gdFormatted = Math.round(gd).toLocaleString('tr-TR');
        break;
      case 'score':
        gdFormatted = gd.toFixed(2);
        break;
      default:
        gdFormatted = gd.toFixed(2);
    }

    // 6. Başarı yüzdesi ve durum göstergesi
    const achievementPercent = definition.maxPoints > 0
      ? (gp / definition.maxPoints) * 100
      : 0;
    const statusIndicator = getStatusIndicator(achievementPercent);

    return {
      code: definition.code,
      name: definition.name,
      parameterValues: paramValues,
      gd,
      gdFormatted,
      gp: Math.round(gp * 100) / 100, // 2 ondalık
      maxPoints: definition.maxPoints,
      status: 'success',
      matchedRule,
      statusIndicator,
      achievementPercent: Math.round(achievementPercent * 10) / 10
    };
  }, []);

  /**
   * Tüm göstergeler için hesaplama yap
   */
  const calculateAllIndicators = useCallback((
    definitions: IndicatorDefinition[],
    allParamValues: Record<string, ParameterValues>
  ): IndicatorResult[] => {
    return definitions.map(def => {
      const params = allParamValues[def.code] || {};
      return calculateIndicator(def, params);
    });
  }, [calculateIndicator]);

  /**
   * Hesaplama özetini oluştur
   */
  const calculateSummary = useCallback((
    results: IndicatorResult[]
  ): CalculationSummary => {
    const completedResults = results.filter(r => r.status === 'success');
    const incompleteResults = results.filter(r => r.status !== 'success');

    const totalGP = completedResults.reduce((sum, r) => sum + r.gp, 0);
    const maxPossibleGP = results.reduce((sum, r) => sum + r.maxPoints, 0);
    const achievementRate = maxPossibleGP > 0 ? (totalGP / maxPossibleGP) * 100 : 0;

    // En yüksek ve en düşük 5 gösterge
    const sortedByAchievement = [...completedResults].sort(
      (a, b) => b.achievementPercent - a.achievementPercent
    );

    const topIndicators = sortedByAchievement.slice(0, 5);
    const bottomIndicators = sortedByAchievement.slice(-5).reverse();

    return {
      totalGP: Math.round(totalGP * 100) / 100,
      maxPossibleGP,
      achievementRate: Math.round(achievementRate * 10) / 10,
      completedIndicators: completedResults.length,
      totalIndicators: results.length,
      incompleteIndicators: incompleteResults.length,
      topIndicators,
      bottomIndicators
    };
  }, []);

  /**
   * Tam kurum sonucu oluştur
   */
  const createInstitutionResult = useCallback((
    institutionId: string,
    institutionName: string,
    institutionType: InstitutionType,
    year: number,
    month: number,
    results: IndicatorResult[],
    calculatedBy: string
  ): InstitutionResult => {
    const summary = calculateSummary(results);

    return {
      institutionId,
      institutionName,
      institutionType,
      period: { year, month },
      indicators: results,
      summary,
      calculatedAt: Date.now(),
      calculatedBy
    };
  }, [calculateSummary]);

  return {
    calculateIndicator,
    calculateAllIndicators,
    calculateSummary,
    createInstitutionResult,
    // Yardımcı fonksiyonları da dışa aktar (test için)
    evaluateFormula,
    calculateGP,
    calculateGPFromFormula
  };
};

export default useGorenCalculator;
