/**
 * GÖREN Puan İyileştirme Önerileri Hesaplama Modülü
 *
 * Modül bazlı (BH, İLÇESM, ADSH vb.) gösterge verileri analiz edilerek
 * puan iyileştirme önerileri üretilir.
 *
 * - generateRecommendations(): BH modülü için (bhIndicatorDetails kullanır)
 * - generateGenericRecommendations(): Tüm modüller için (gpRules'dan kademeli analiz)
 */

import { BHTableRow } from '../src/services/gorenStorage';
import { IndicatorDefinition, ScoreRecommendation, RecommendationsSummary, InstitutionType } from '../components/goren/types/goren.types';
import { BH_INDICATOR_DETAILS, IndicatorDetail } from '../src/config/goren/bhIndicatorDetails';

// ========== YARDIMCI FONKSİYONLAR ==========

/**
 * Göstergenin GD azaltılması mı artırılması mı gerektiğini belirle
 * GD <= GO kuralı varsa → decrease (azaltmak iyi)
 * GD >= GO kuralı varsa → increase (artırmak iyi)
 */
function determineDirection(def: IndicatorDefinition): 'increase' | 'decrease' {
  if (def.gpRules.length === 0) return 'increase';
  const firstRule = def.gpRules[0];
  if (firstRule.operator === 'formula' && firstRule.formula) {
    if (firstRule.formula.includes('<=') || firstRule.formula.includes('<')) {
      return 'decrease';
    }
  }
  if (firstRule.operator === 'gte' || firstRule.operator === 'gt') {
    return 'increase';
  }
  if (firstRule.operator === 'lte' || firstRule.operator === 'lt') {
    return 'decrease';
  }
  return 'increase';
}

/**
 * Kural tipini belirle
 */
function determineRuleType(sira: number, def: IndicatorDefinition): ScoreRecommendation['ruleType'] {
  // BH-8: GO kademeli
  if (sira === 8) return 'go_tiered';

  // BH-12: Sabit eşik (%95/%85)
  // BH-13: Sabit eşik (%98)
  // BH-29: Sabit eşik (0.5/0.25)
  if (sira === 12 || sira === 13 || sira === 29) return 'fixed_threshold';

  // BH-1, BH-2, BH-4: bhIndicatorDetails'ten kural (detay kuralları)
  if (sira === 1 || sira === 2 || sira === 4) return 'detail_rules';

  // Geri kalan: GO tabanlı basit eşik
  return 'go_threshold';
}

/**
 * Detail rules (BH-1, BH-2, BH-4) için hedef GD ve potansiyel puan hesapla
 */
function analyzeDetailRules(
  sira: number,
  currentGD: number | null,
  currentGP: number,
  maxPoints: number,
  detail: IndicatorDetail
): { targetGD: number | null; targetGP: number; nextTierCondition: string; ruleDescription: string } {
  const rules = detail.scoringRules;

  if (sira === 1 || sira === 2) {
    // Hasta/Çalışan Memnuniyet: GD ≥ %70 → 3, %60≤GD<%70 → 2, %50≤GD<%60 → 1, GD<%50 → 0
    if (currentGP >= maxPoints) {
      return { targetGD: null, targetGP: maxPoints, nextTierCondition: 'Zaten tam puan', ruleDescription: rules.map(r => `${r.condition}: ${r.points}p`).join(' | ') };
    }
    if (currentGD === null) {
      return { targetGD: 70, targetGP: maxPoints, nextTierCondition: 'GD ≥ %70 yapın', ruleDescription: rules.map(r => `${r.condition}: ${r.points}p`).join(' | ') };
    }
    if (currentGD < 50) {
      return { targetGD: 50, targetGP: 1, nextTierCondition: 'GD ≥ %50 yapın (+1 puan)', ruleDescription: rules.map(r => `${r.condition}: ${r.points}p`).join(' | ') };
    }
    if (currentGD < 60) {
      return { targetGD: 60, targetGP: 2, nextTierCondition: 'GD ≥ %60 yapın (+1 puan)', ruleDescription: rules.map(r => `${r.condition}: ${r.points}p`).join(' | ') };
    }
    if (currentGD < 70) {
      return { targetGD: 70, targetGP: 3, nextTierCondition: 'GD ≥ %70 yapın (+1 puan)', ruleDescription: rules.map(r => `${r.condition}: ${r.points}p`).join(' | ') };
    }
    return { targetGD: null, targetGP: maxPoints, nextTierCondition: 'Zaten tam puan', ruleDescription: rules.map(r => `${r.condition}: ${r.points}p`).join(' | ') };
  }

  if (sira === 4) {
    // Randevulu Muayene: GD ≥ %70 → 3, %50≤GD<%70 → 2, %40≤GD<%50 → 1, GD<%40 → 0
    if (currentGP >= maxPoints) {
      return { targetGD: null, targetGP: maxPoints, nextTierCondition: 'Zaten tam puan', ruleDescription: rules.map(r => `${r.condition}: ${r.points}p`).join(' | ') };
    }
    if (currentGD === null) {
      return { targetGD: 70, targetGP: maxPoints, nextTierCondition: 'GD ≥ %70 yapın', ruleDescription: rules.map(r => `${r.condition}: ${r.points}p`).join(' | ') };
    }
    if (currentGD < 40) {
      return { targetGD: 40, targetGP: 1, nextTierCondition: 'GD ≥ %40 yapın (+1 puan)', ruleDescription: rules.map(r => `${r.condition}: ${r.points}p`).join(' | ') };
    }
    if (currentGD < 50) {
      return { targetGD: 50, targetGP: 2, nextTierCondition: 'GD ≥ %50 yapın (+1 puan)', ruleDescription: rules.map(r => `${r.condition}: ${r.points}p`).join(' | ') };
    }
    if (currentGD < 70) {
      return { targetGD: 70, targetGP: 3, nextTierCondition: 'GD ≥ %70 yapın (+1 puan)', ruleDescription: rules.map(r => `${r.condition}: ${r.points}p`).join(' | ') };
    }
    return { targetGD: null, targetGP: maxPoints, nextTierCondition: 'Zaten tam puan', ruleDescription: rules.map(r => `${r.condition}: ${r.points}p`).join(' | ') };
  }

  return { targetGD: null, targetGP: currentGP, nextTierCondition: '-', ruleDescription: '-' };
}

/**
 * Sabit eşik (BH-12, BH-13, BH-29) için hedef hesapla
 */
function analyzeFixedThreshold(
  sira: number,
  currentGD: number | null,
  currentGP: number,
  maxPoints: number
): { targetGD: number | null; targetGP: number; nextTierCondition: string; ruleDescription: string } {
  if (sira === 12) {
    // E-Reçete: ≥95% → 2, 85-95% → 1, <85% → 0
    if (currentGP >= maxPoints) {
      return { targetGD: null, targetGP: 2, nextTierCondition: 'Zaten tam puan', ruleDescription: 'GD ≥ %95: 2p | %85 ≤ GD < %95: 1p | GD < %85: 0p' };
    }
    if (currentGD === null) {
      return { targetGD: 95, targetGP: 2, nextTierCondition: 'GD ≥ %95 yapın', ruleDescription: 'GD ≥ %95: 2p | %85 ≤ GD < %95: 1p | GD < %85: 0p' };
    }
    if (currentGD < 85) {
      return { targetGD: 85, targetGP: 1, nextTierCondition: 'GD ≥ %85 yapın (+1 puan)', ruleDescription: 'GD ≥ %95: 2p | %85 ≤ GD < %95: 1p | GD < %85: 0p' };
    }
    if (currentGD < 95) {
      return { targetGD: 95, targetGP: 2, nextTierCondition: 'GD ≥ %95 yapın (+1 puan)', ruleDescription: 'GD ≥ %95: 2p | %85 ≤ GD < %95: 1p | GD < %85: 0p' };
    }
    return { targetGD: null, targetGP: 2, nextTierCondition: 'Zaten tam puan', ruleDescription: 'GD ≥ %95: 2p | %85 ≤ GD < %95: 1p | GD < %85: 0p' };
  }

  if (sira === 13) {
    // Veri Gönderme: ≥98% → 2, <98% → 0
    if (currentGP >= maxPoints) {
      return { targetGD: null, targetGP: 2, nextTierCondition: 'Zaten tam puan', ruleDescription: 'GD ≥ %98: 2p | GD < %98: 0p' };
    }
    return { targetGD: 98, targetGP: 2, nextTierCondition: 'GD ≥ %98 yapın (+2 puan)', ruleDescription: 'GD ≥ %98: 2p | GD < %98: 0p' };
  }

  if (sira === 29) {
    // EAHB: ≥0.5 → 2, 0.25-0.5 → 1, <0.25 → 0
    if (currentGP >= maxPoints) {
      return { targetGD: null, targetGP: 2, nextTierCondition: 'Zaten tam puan', ruleDescription: 'GD ≥ 0.5: 2p | 0.25 ≤ GD < 0.5: 1p | GD < 0.25: 0p' };
    }
    if (currentGD === null) {
      return { targetGD: 0.5, targetGP: 2, nextTierCondition: 'GD ≥ 0.5 yapın', ruleDescription: 'GD ≥ 0.5: 2p | 0.25 ≤ GD < 0.5: 1p | GD < 0.25: 0p' };
    }
    if (currentGD < 0.25) {
      return { targetGD: 0.25, targetGP: 1, nextTierCondition: 'GD ≥ 0.25 yapın (+1 puan)', ruleDescription: 'GD ≥ 0.5: 2p | 0.25 ≤ GD < 0.5: 1p | GD < 0.25: 0p' };
    }
    if (currentGD < 0.5) {
      return { targetGD: 0.5, targetGP: 2, nextTierCondition: 'GD ≥ 0.5 yapın (+1 puan)', ruleDescription: 'GD ≥ 0.5: 2p | 0.25 ≤ GD < 0.5: 1p | GD < 0.25: 0p' };
    }
    return { targetGD: null, targetGP: 2, nextTierCondition: 'Zaten tam puan', ruleDescription: 'GD ≥ 0.5: 2p | 0.25 ≤ GD < 0.5: 1p | GD < 0.25: 0p' };
  }

  return { targetGD: null, targetGP: currentGP, nextTierCondition: '-', ruleDescription: '-' };
}

/**
 * GO kademeli (BH-8) için hedef hesapla
 */
function analyzeGoTiered(
  currentGD: number | null,
  currentGO: number | null,
  currentGP: number,
  maxPoints: number
): { targetGD: number | null; targetGP: number; nextTierCondition: string; ruleDescription: string } {
  const ruleDesc = 'GD ≤ GO: 4p | GO < GD ≤ GO×1.15: 2p | GO×1.15 < GD ≤ GO×1.30: 1p | GD > GO×1.30: 0p';

  if (currentGP >= maxPoints) {
    return { targetGD: null, targetGP: maxPoints, nextTierCondition: 'Zaten tam puan', ruleDescription: ruleDesc };
  }

  if (currentGO === null || currentGD === null) {
    return { targetGD: null, targetGP: maxPoints, nextTierCondition: 'GO değeri gerekli', ruleDescription: ruleDesc };
  }

  const go = currentGO;
  const go115 = go * 1.15;
  const go130 = go * 1.30;

  if (currentGD > go130) {
    return { targetGD: go130, targetGP: 1, nextTierCondition: `GD ≤ ${go130.toFixed(1)} yapın (+1 puan)`, ruleDescription: ruleDesc };
  }
  if (currentGD > go115) {
    return { targetGD: go115, targetGP: 2, nextTierCondition: `GD ≤ ${go115.toFixed(1)} yapın (+1 puan)`, ruleDescription: ruleDesc };
  }
  if (currentGD > go) {
    return { targetGD: go, targetGP: 4, nextTierCondition: `GD ≤ ${go.toFixed(1)} yapın (+2 puan)`, ruleDescription: ruleDesc };
  }

  return { targetGD: null, targetGP: maxPoints, nextTierCondition: 'Zaten tam puan', ruleDescription: ruleDesc };
}

/**
 * GO tabanlı basit eşik (çoğu gösterge) için hedef hesapla
 */
function analyzeGoThreshold(
  currentGD: number | null,
  currentGO: number | null,
  currentGP: number,
  maxPoints: number,
  direction: 'increase' | 'decrease'
): { targetGD: number | null; targetGP: number; nextTierCondition: string; ruleDescription: string } {
  if (currentGP >= maxPoints) {
    const ruleDesc = direction === 'decrease' ? `GD ≤ GO: ${maxPoints}p | GD > GO: 0p` : `GD ≥ GO: ${maxPoints}p | GD < GO: 0p`;
    return { targetGD: null, targetGP: maxPoints, nextTierCondition: 'Zaten tam puan', ruleDescription: ruleDesc };
  }

  if (currentGO === null) {
    const ruleDesc = direction === 'decrease' ? `GD ≤ GO: ${maxPoints}p | GD > GO: 0p` : `GD ≥ GO: ${maxPoints}p | GD < GO: 0p`;
    return { targetGD: null, targetGP: maxPoints, nextTierCondition: 'GO değeri gerekli', ruleDescription: ruleDesc };
  }

  const go = currentGO;
  if (direction === 'decrease') {
    const ruleDesc = `GD ≤ ${go}: ${maxPoints}p | GD > ${go}: 0p`;
    return { targetGD: go, targetGP: maxPoints, nextTierCondition: `GD ≤ ${go} yapın (+${maxPoints} puan)`, ruleDescription: ruleDesc };
  } else {
    const ruleDesc = `GD ≥ ${go}: ${maxPoints}p | GD < ${go}: 0p`;
    return { targetGD: go, targetGP: maxPoints, nextTierCondition: `GD ≥ ${go} yapın (+${maxPoints} puan)`, ruleDescription: ruleDesc };
  }
}

/**
 * A parametresinin birimine göre aksiyon ipucu sözcüğünü belirle.
 *
 * Dikkat: GD birimi ile A birimi farklı olabilir.
 * Örn: BH-34 GD birimi %, ama A "Nöbet ücreti toplamı" → TL cinsinden.
 * Bu yüzden sıra numarasına göre A parametresinin gerçek birimini döndürürüz.
 */
function getUnitWord(def: IndicatorDefinition, sira: number): string {
  // A parametresi TL cinsinden olan göstergeler
  if (sira === 30 || sira === 32 || sira === 34 || sira === 35) return 'TL';

  // A parametresi puan cinsinden olan göstergeler
  if (sira === 1 || sira === 2 || sira === 19 || sira === 20) return 'puan';

  // A parametresi gün cinsinden olan göstergeler
  if (sira === 25 || sira === 27 || sira === 33) return 'gün';

  // A parametresi dakika cinsinden olan göstergeler
  if (sira === 37) return 'dakika';

  // A parametresi hasta sayısı olan göstergeler
  if (sira === 16 || sira === 17) return 'hasta';

  // Geri kalan: adet (sayısal)
  return 'adet';
}

/**
 * GD formülünden geriye doğru hesaplama yaparak somut aksiyon önerisi üret
 *
 * Formüller:
 * - (A / B) * 100 → hedefGD için: hedefA = hedefGD * B / 100
 * - A / B          → hedefGD için: hedefA = hedefGD * B
 * - ((A - B) / B) * 100 → hedefGD için: hedefA = B * (1 + hedefGD/100)
 */
function generateActionHint(
  row: BHTableRow,
  def: IndicatorDefinition,
  targetGD: number | null,
  direction: 'increase' | 'decrease',
  detail: IndicatorDetail | undefined
): string | null {
  if (targetGD === null) return null;

  const a = typeof row.a === 'number' ? row.a : null;
  const b = typeof row.b === 'number' ? row.b : null;

  // A veya B yoksa somut öneri üretemeyiz
  if (a === null || b === null || b === 0) return null;

  const formula = def.gdFormula;
  const sira = row.sira;

  // Parametre adlarını al
  const paramA = detail?.parameters?.[0]?.name || def.parameters?.[0]?.label || 'A değeri';
  const paramB = detail?.parameters?.[1]?.name || def.parameters?.[1]?.label || 'B değeri';

  // Parametre adını olduğu gibi kullan (kesmeden)
  const shortParamA = paramA;

  // Gösterge birimine uygun sözcük
  const unitWord = getUnitWord(def, sira);

  let requiredA: number;

  // BH-9 özel formül: ((A - B) / B) * 100
  // Bu gösterge Robson sınıflamasına göre çalışır
  if (sira === 9) {
    // hedefGD = ((hedefA - B) / B) * 100  →  hedefA = B * (1 + hedefGD/100)
    requiredA = b * (1 + targetGD / 100);
    const diff = Math.ceil(a - requiredA);
    if (diff > 0) {
      return `Robson Grup 1, 2 ve 3 gibi düşük riskli gruplarda sezaryen endikasyonları gözden geçirilmeli. Özellikle nullipar tekil sefalik (Grup 1) ve indüksiyon/elektif sezaryen (Grup 2) oranları değerlendirilmeli`;
    }
    return null;
  }

  // (A / B) * 100 formülü
  if (formula.includes('* 100') || formula.includes('× 100')) {
    // hedefGD = (hedefA / B) * 100  →  hedefA = hedefGD * B / 100
    requiredA = targetGD * b / 100;

    if (direction === 'decrease') {
      // GD azalmalı → A azalmalı: a'dan requiredA'ya düşürmek lazım
      const diff = Math.ceil(a - requiredA);
      if (diff <= 0) return null;
      return `${shortParamA} ${diff.toLocaleString('tr-TR')} ${unitWord} azaltılmalı`;
    } else {
      // GD artmalı → A artmalı: a'dan requiredA'ya çıkarmak lazım
      const diff = Math.ceil(requiredA - a);
      if (diff <= 0) return null;
      return `${shortParamA} ${diff.toLocaleString('tr-TR')} ${unitWord} artırılmalı`;
    }
  }

  // A / B formülü (çarpmasız)
  if (formula.includes('A / B') || formula.includes('A/B')) {
    // hedefGD = hedefA / B  →  hedefA = hedefGD * B
    requiredA = targetGD * b;

    if (direction === 'increase') {
      // GD artmalı → A artmalı
      const diff = Math.ceil(requiredA - a);
      if (diff <= 0) return null;
      return `${shortParamA} ${diff.toLocaleString('tr-TR')} ${unitWord} artırılmalı`;
    } else {
      // GD azalmalı → A azalmalı
      const diff = Math.ceil(a - requiredA);
      if (diff <= 0) return null;
      return `${shortParamA} ${diff.toLocaleString('tr-TR')} ${unitWord} azaltılmalı`;
    }
  }

  return null;
}

/**
 * Kategori adını sıra numarasına göre belirle
 */
function getCategoryName(sira: number): string {
  if (sira <= 2) return 'Memnuniyet';
  if (sira <= 5) return 'Poliklinik ve Acil';
  if (sira <= 9) return 'Doğum ve Sezaryen';
  if (sira <= 13) return 'İlaç ve Reçete';
  if (sira <= 17) return 'Yatak ve Yoğun Bakım';
  if (sira <= 20) return 'Ameliyathane ve Cerrahi';
  if (sira <= 28) return 'Görüntüleme';
  return 'Finansal ve İdari';
}

/**
 * Öncelik belirle
 * pointsGainable yüksek + gdGap düşük = yüksek öncelik
 */
function determinePriority(
  pointsGainable: number,
  gdGap: number | null,
  maxPoints: number,
  currentGP: number
): ScoreRecommendation['priority'] {
  if (pointsGainable <= 0) return 'low';

  // Sıfır puan alanlar her zaman yüksek öncelik
  if (currentGP === 0 && pointsGainable >= 3) return 'critical';
  if (currentGP === 0 && pointsGainable >= 2) return 'high';

  // Yüksek kazanım potansiyeli
  if (pointsGainable >= 4) return 'critical';
  if (pointsGainable >= 3) return 'high';

  // Düşük GD gap = kolay kazanım
  if (gdGap !== null && Math.abs(gdGap) < 5 && pointsGainable >= 1) return 'high';

  if (pointsGainable >= 2) return 'medium';
  return 'low';
}

// ========== ANA FONKSİYON ==========

/**
 * BH gösterge verileri için puan iyileştirme önerileri üret
 */
export function generateRecommendations(
  bhTableData: BHTableRow[],
  definitions: IndicatorDefinition[],
  totalGP: number
): RecommendationsSummary {
  const recommendations: ScoreRecommendation[] = [];
  let zeroPointIndicators = 0;
  let partialPointIndicators = 0;
  let fullPointIndicators = 0;

  for (const row of bhTableData) {
    const sira = row.sira;
    const def = definitions.find(d => d.code === `SYPG-BH-${sira}`);
    if (!def) continue;

    const isExempt = row.muaf === 1;
    const hasData = typeof row.donemIciPuan === 'number';
    const currentGP = hasData ? (row.donemIciPuan as number) : 0;
    const maxPoints = def.maxPoints;

    // Muaf olmayan göstergeler için sayaçları güncelle
    // Muaf olmayan ve puanı boş olan göstergeler de sıfır puanlı sayılır
    if (!isExempt) {
      if (hasData && currentGP >= maxPoints) {
        fullPointIndicators++;
      } else if (hasData && currentGP > 0 && currentGP < maxPoints) {
        partialPointIndicators++;
      } else {
        // hasData && currentGP === 0  VEYA  !hasData (muaf değil ama puan yok → 0)
        zeroPointIndicators++;
      }
    }

    // Muaf veya tam puan alanları öneriden hariç tut
    if (isExempt || (hasData && currentGP >= maxPoints)) {
      continue;
    }

    // GD ve GO değerlerini parse et
    const currentGD = typeof row.donemIci === 'number' ? row.donemIci : null;
    const currentGO = typeof row.trRolOrtalama === 'number' ? row.trRolOrtalama : null;

    const direction = determineDirection(def);
    const ruleType = determineRuleType(sira, def);

    let targetGD: number | null = null;
    let targetGP = maxPoints;
    let nextTierCondition = '';
    let ruleDescription = '';

    const detail = BH_INDICATOR_DETAILS[sira];

    switch (ruleType) {
      case 'detail_rules': {
        if (detail) {
          const result = analyzeDetailRules(sira, currentGD, currentGP, maxPoints, detail);
          targetGD = result.targetGD;
          targetGP = result.targetGP;
          nextTierCondition = result.nextTierCondition;
          ruleDescription = result.ruleDescription;
        }
        break;
      }
      case 'fixed_threshold': {
        const result = analyzeFixedThreshold(sira, currentGD, currentGP, maxPoints);
        targetGD = result.targetGD;
        targetGP = result.targetGP;
        nextTierCondition = result.nextTierCondition;
        ruleDescription = result.ruleDescription;
        break;
      }
      case 'go_tiered': {
        const result = analyzeGoTiered(currentGD, currentGO, currentGP, maxPoints);
        targetGD = result.targetGD;
        targetGP = result.targetGP;
        nextTierCondition = result.nextTierCondition;
        ruleDescription = result.ruleDescription;
        break;
      }
      case 'go_threshold':
      default: {
        const result = analyzeGoThreshold(currentGD, currentGO, currentGP, maxPoints, direction);
        targetGD = result.targetGD;
        targetGP = result.targetGP;
        nextTierCondition = result.nextTierCondition;
        ruleDescription = result.ruleDescription;
        break;
      }
    }

    const pointsGainable = targetGP - currentGP;
    if (pointsGainable <= 0) continue;

    // GD gap hesapla
    let gdGap: number | null = null;
    if (currentGD !== null && targetGD !== null) {
      gdGap = targetGD - currentGD;
    }

    const priority = determinePriority(pointsGainable, gdGap, maxPoints, currentGP);

    // Somut aksiyon önerisi üret
    const actionHint = generateActionHint(row, def, targetGD, direction, detail);

    recommendations.push({
      indicatorCode: `SYPG-BH-${sira}`,
      sira,
      indicatorName: row.gostergeAdi,
      categoryName: getCategoryName(sira),
      currentGD,
      currentGO,
      currentGP,
      maxPoints,
      targetGD,
      targetGP,
      pointsGainable,
      gdGap,
      direction,
      ruleType,
      ruleDescription,
      nextTierCondition,
      priority,
      isExempt,
      hasData,
      actionHint
    });
  }

  // Öncelik sırasına göre sırala
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  recommendations.sort((a, b) => {
    const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pDiff !== 0) return pDiff;
    return b.pointsGainable - a.pointsGainable;
  });

  const totalPotentialGain = recommendations.reduce((sum, r) => sum + r.pointsGainable, 0);
  const estimatedTotalGP = totalGP + totalPotentialGain;
  const maxPossibleGP = definitions.reduce((sum, d) => sum + d.maxPoints, 0);

  // Quick wins: Hedefe en yakın göstergeler (en az GD değişimi gerektirenler)
  // GD gap yüzdesel olarak normalize edilir ki farklı birimdeki göstergeler karşılaştırılabilsin
  const quickWins = [...recommendations]
    .filter(r => r.pointsGainable > 0 && r.gdGap !== null && r.targetGD !== null)
    .sort((a, b) => {
      // Birincil: GD gap yüzdesel yakınlık (hedefe en yakın önce)
      const aTarget = Math.abs(a.targetGD || 1);
      const bTarget = Math.abs(b.targetGD || 1);
      const aGapPct = Math.abs(a.gdGap!) / (aTarget || 1);
      const bGapPct = Math.abs(b.gdGap!) / (bTarget || 1);
      const gapDiff = aGapPct - bGapPct;
      if (Math.abs(gapDiff) > 0.01) return gapDiff;
      // İkincil: Kazanılacak puan (yüksek önce)
      return b.pointsGainable - a.pointsGainable;
    })
    .slice(0, 3);

  // Kolay ulaşılabilir hedefler: hedefe yakın göstergeler
  // GD gap yüzdesel olarak %20'den az VEYA verisi olmayıp GO threshold ile 1 kademe atlayabilenler
  const easyTargets = [...recommendations]
    .filter(r => {
      if (r.pointsGainable <= 0) return false;

      // GD verisi olan göstergeler: gap yüzdesine bak
      if (r.gdGap !== null && r.targetGD !== null) {
        const targetAbs = Math.abs(r.targetGD) || 1;
        const gapPct = Math.abs(r.gdGap) / targetAbs;
        return gapPct < 0.20; // Hedefe %20'den az fark
      }

      // GD verisi olmayan ama 1 puan kazanılabilecek göstergeler (düşük risk)
      if (r.pointsGainable === 1) return true;

      return false;
    })
    .sort((a, b) => {
      // Birincil: Kazanılacak puan (yüksek önce)
      const pDiff = b.pointsGainable - a.pointsGainable;
      if (pDiff !== 0) return pDiff;
      // İkincil: GD gap yakınlığı (küçük önce)
      const aGap = a.gdGap !== null ? Math.abs(a.gdGap) : 999;
      const bGap = b.gdGap !== null ? Math.abs(b.gdGap) : 999;
      return aGap - bGap;
    });

  const easyTargetGain = easyTargets.reduce((sum, r) => sum + r.pointsGainable, 0);
  const easyTargetTotalGP = totalGP + easyTargetGain;

  // Tahmini eşit ağırlıklı başarı oranı: öneriler uygulanırsa her gösterge bazında
  // Muaf olmayan tüm göstergeler dahil (puanı boş olanlar 0 olarak sayılır)
  const recMap = new Map(recommendations.map(r => [r.sira, r.pointsGainable]));
  const eligibleRows = bhTableData.filter(r => r.muaf !== 1);
  let estimatedAchievementRate = 0;
  if (eligibleRows.length > 0) {
    const totalPct = eligibleRows.reduce((sum, r) => {
      const maxP = r.maxPuan || 4;
      const gp = typeof r.donemIciPuan === 'number' ? r.donemIciPuan : 0;
      const gain = recMap.get(r.sira) || 0;
      return sum + (maxP > 0 ? (Math.min(gp + gain, maxP) / maxP) * 100 : 0);
    }, 0);
    estimatedAchievementRate = totalPct / eligibleRows.length;
  }

  return {
    recommendations,
    totalPotentialGain,
    currentTotalGP: totalGP,
    estimatedTotalGP,
    estimatedAchievementRate,
    quickWins,
    easyTargets,
    easyTargetGain,
    easyTargetTotalGP,
    zeroPointIndicators,
    partialPointIndicators,
    fullPointIndicators
  };
}

// ========== İLÇESM / ADSH / GENERIC MODÜL ÖNERİLERİ ==========

/**
 * İLÇESM kategori adlarını sıra numarasına göre belirle
 */
function getILCESMCategoryName(sira: number): string {
  if (sira <= 2) return 'Memnuniyet';
  if (sira <= 4) return 'Aşılama';
  if (sira === 8) return 'Kronik Hastalık Takibi';
  if (sira === 10 || sira === 11) return 'Kanser Taraması';
  if (sira === 12) return 'Anne-Bebek Sağlığı';
  if (sira === 13 || sira === 15) return 'Birinci Basamak';
  if (sira === 14) return 'Tütün Denetimi';
  if (sira === 16 || sira === 17) return 'İlaç ve Reçete';
  return 'Diğer';
}

/**
 * ADSH kategori adlarını sıra numarasına göre belirle
 */
function getADSHCategoryName(sira: number): string {
  if (sira <= 2) return 'Memnuniyet';
  if (sira <= 5) return 'Randevu ve Veri';
  if (sira <= 8) return 'Tedavi Kalitesi';
  if (sira <= 11) return 'Protez ve Yer Tutucu';
  return 'Finansal';
}

/**
 * Modül tipine göre kategori adı belirle
 */
function getGenericCategoryName(sira: number, moduleType: InstitutionType): string {
  switch (moduleType) {
    case 'ILCESM': return getILCESMCategoryName(sira);
    case 'ADSH': return getADSHCategoryName(sira);
    default: return getCategoryName(sira); // BH fallback
  }
}

/**
 * gpRules dizisinden mevcut GD'ye göre bir sonraki kademeyi bul.
 *
 * Mantık:
 * 1. gpRules'ı puana göre sırala (yüksekten düşüğe)
 * 2. Mevcut GP'nin bir üst kademesini bul
 * 3. O kademeye ulaşmak için gereken GD hedefini hesapla
 *
 * Ters yönlü göstergeler (lte/lt operatörü ile başlayan) için
 * GD'nin azaltılması gerekir.
 */
function analyzeGpRulesForNextTier(
  def: IndicatorDefinition,
  currentGD: number | null,
  currentGP: number,
  maxPoints: number,
  row: BHTableRow
): {
  targetGD: number | null;
  targetGP: number;
  nextTierCondition: string;
  ruleDescription: string;
  direction: 'increase' | 'decrease';
} {
  const rules = def.gpRules;
  if (!rules || rules.length === 0) {
    return { targetGD: null, targetGP: currentGP, nextTierCondition: '-', ruleDescription: '-', direction: 'increase' };
  }

  // Kural açıklamasını oluştur
  const ruleDescription = rules
    .filter(r => r.points > 0 || rules.length <= 4)
    .map(r => `${r.condition}: ${r.points}p`)
    .join(' | ');

  // Zaten tam puan alıyorsa
  if (currentGP >= maxPoints) {
    return { targetGD: null, targetGP: maxPoints, nextTierCondition: 'Zaten tam puan', ruleDescription, direction: 'increase' };
  }

  // İLÇESM-14 özel durum: çift formüllü gösterge (GP = GP1 + GP2)
  // Bu göstergenin analizi basitleştirilmiştir
  if (def.gpFormula && def.gpFormula.includes('GP1 + GP2')) {
    return {
      targetGD: null,
      targetGP: maxPoints,
      nextTierCondition: 'Müdahale hızı ve usulsüzlük oranı birlikte değerlendirilir',
      ruleDescription,
      direction: 'increase'
    };
  }

  // İLÇESM-13 özel durum: HD/ÖD parametreli dinamik eşik
  // Formula kuralları varsa ve GD formülü ile çözülemiyorsa
  const hasFormulaOnly = rules.every(r => r.operator === 'formula');
  if (hasFormulaOnly) {
    // GO/HD/OD parametreli kurallar: BH fonksiyonundaki gibi analiz et
    const go = typeof row.trRolOrtalama === 'number' ? row.trRolOrtalama : null;
    if (go !== null && currentGD !== null) {
      // Basit GO threshold: GD >= GO ise puan
      const direction = determineDirection(def);
      if (direction === 'decrease' && currentGD > go) {
        return {
          targetGD: go,
          targetGP: maxPoints,
          nextTierCondition: `GD ≤ ${go.toFixed(1)} yapın (+${maxPoints - currentGP} puan)`,
          ruleDescription,
          direction: 'decrease'
        };
      }
      if (direction === 'increase' && currentGD < go) {
        return {
          targetGD: go,
          targetGP: maxPoints,
          nextTierCondition: `GD ≥ ${go.toFixed(1)} yapın (+${maxPoints - currentGP} puan)`,
          ruleDescription,
          direction: 'increase'
        };
      }
    }
    // HD/ÖD parametreli veya çözülemez formula kurallar
    return {
      targetGD: null,
      targetGP: maxPoints,
      nextTierCondition: 'Hedef değere ulaşılmalı',
      ruleDescription,
      direction: 'increase'
    };
  }

  // Yönü belirle: ilk kural lte/lt ise → decrease (antibiyotik gibi göstergeler)
  const firstHighRule = [...rules].sort((a, b) => b.points - a.points)[0];
  const isDecreasing = firstHighRule?.operator === 'lte' || firstHighRule?.operator === 'lt';
  const direction: 'increase' | 'decrease' = isDecreasing ? 'decrease' : 'increase';

  // Kuralları puana göre sırala (düşükten yükseğe)
  const sortedRules = [...rules]
    .filter(r => r.operator !== 'formula') // formula kuralları hariç
    .sort((a, b) => a.points - b.points);

  // Mevcut GP'nin bulunduğu kademenin bir üstünü bul
  // currentGP'den daha yüksek puan veren ilk kuralı al
  let nextTierRule = null;
  for (const rule of sortedRules) {
    if (rule.points > currentGP) {
      nextTierRule = rule;
      break;
    }
  }

  if (!nextTierRule) {
    return { targetGD: null, targetGP: maxPoints, nextTierCondition: 'Tam puana ulaşılmalı', ruleDescription, direction };
  }

  // Hedef GD değerini belirle
  let targetGD: number | null = null;
  const pointsGainable = nextTierRule.points - currentGP;

  if (isDecreasing) {
    // Ters yönlü: lte → maxValue, lt → maxValue eşiği
    if (nextTierRule.operator === 'lte' && nextTierRule.maxValue !== undefined) {
      targetGD = nextTierRule.maxValue;
    } else if (nextTierRule.operator === 'between' && nextTierRule.minValue !== undefined) {
      // Ters yönlü between: minValue ile maxValue arasında → minValue'a düşür
      targetGD = nextTierRule.maxValue !== undefined ? nextTierRule.maxValue : nextTierRule.minValue;
    }
  } else {
    // Normal yönlü: gte → minValue, between → minValue
    if (nextTierRule.operator === 'gte' && nextTierRule.minValue !== undefined) {
      targetGD = nextTierRule.minValue;
    } else if (nextTierRule.operator === 'between' && nextTierRule.minValue !== undefined) {
      targetGD = nextTierRule.minValue;
    }
  }

  const conditionText = targetGD !== null
    ? (isDecreasing
        ? `GD ≤ ${targetGD} yapın (+${pointsGainable} puan)`
        : `GD ≥ ${targetGD} yapın (+${pointsGainable} puan)`)
    : `${nextTierRule.condition} sağlayın (+${pointsGainable} puan)`;

  return {
    targetGD,
    targetGP: nextTierRule.points,
    nextTierCondition: conditionText,
    ruleDescription,
    direction
  };
}

/**
 * A parametresinin birimine uygun sözcüğü belirle (generic modüller için)
 * Parametre adından ve gösterge biriminden çıkarım yapar.
 */
function getGenericUnitWord(def: IndicatorDefinition): string {
  const paramALabel = (def.parameters?.[0]?.label || '').toLowerCase();

  // Parametre adından birim çıkarımı
  if (paramALabel.includes('puan') || paramALabel.includes('memnuniyet')) return 'puan';
  if (paramALabel.includes('kişi') || paramALabel.includes('hasta') || paramALabel.includes('bebek') || paramALabel.includes('çocuk') || paramALabel.includes('lohusa')) return 'kişi';
  if (paramALabel.includes('reçete')) return 'reçete';
  if (paramALabel.includes('ilaç') || paramALabel.includes('antibiyotik')) return 'adet';
  if (paramALabel.includes('başvuru') || paramALabel.includes('müracaat')) return 'başvuru';
  if (paramALabel.includes('randevu')) return 'randevu';
  if (paramALabel.includes('ihbar') || paramALabel.includes('müdahale')) return 'ihbar';
  if (paramALabel.includes('aşı') || paramALabel.includes('doz')) return 'doz';
  if (paramALabel.includes('tarama')) return 'tarama';

  // Gösterge biriminden çıkarım
  if (def.unit === 'ratio') return 'kişi';
  if (def.unit === 'percentage') return 'adet';

  return 'adet';
}

/**
 * Generic aksiyon önerisi üret (İLÇESM ve diğer modüller için)
 * GD formülünden geriye doğru hesaplama yapar.
 */
function generateGenericActionHint(
  row: BHTableRow,
  def: IndicatorDefinition,
  targetGD: number | null,
  direction: 'increase' | 'decrease'
): string | null {
  if (targetGD === null) return null;

  const a = typeof row.a === 'number' ? row.a : null;
  const b = typeof row.b === 'number' ? row.b : null;

  if (a === null || b === null || b === 0) return null;

  const formula = def.gdFormula;
  const paramA = def.parameters?.[0]?.label || 'A değeri';
  const unitWord = getGenericUnitWord(def);

  let requiredA: number;

  // ((A + B) / 2) formülü (İLÇESM-8)
  if (formula.includes('A + B') || formula.includes('(A+B)')) {
    // hedefGD = (hedefA + B) / 2  →  hedefA = hedefGD * 2 - B
    requiredA = targetGD * 2 - b;
    const diff = Math.ceil(requiredA - a);
    if (diff <= 0) return null;
    return `${paramA} ${diff.toLocaleString('tr-TR')} ${unitWord} artırılmalı`;
  }

  // (A / B) * 100 formülü
  if (formula.includes('* 100') || formula.includes('× 100')) {
    requiredA = targetGD * b / 100;

    if (direction === 'decrease') {
      const diff = Math.ceil(a - requiredA);
      if (diff <= 0) return null;
      return `${paramA} ${diff.toLocaleString('tr-TR')} ${unitWord} azaltılmalı`;
    } else {
      const diff = Math.ceil(requiredA - a);
      if (diff <= 0) return null;
      return `${paramA} ${diff.toLocaleString('tr-TR')} ${unitWord} artırılmalı`;
    }
  }

  // A / B formülü (çarpmasız - oran cinsinden, İLÇESM-10, 11)
  if (formula.includes('A / B') || formula.includes('A/B')) {
    requiredA = targetGD * b;

    if (direction === 'increase') {
      const diff = Math.ceil(requiredA - a);
      if (diff <= 0) return null;
      return `${paramA} ${diff.toLocaleString('tr-TR')} ${unitWord} artırılmalı`;
    } else {
      const diff = Math.ceil(a - requiredA);
      if (diff <= 0) return null;
      return `${paramA} ${diff.toLocaleString('tr-TR')} ${unitWord} azaltılmalı`;
    }
  }

  // GD = A formülü (İLÇESM-1)
  if (formula.trim() === 'A') {
    if (direction === 'increase') {
      const diff = targetGD - a;
      if (diff <= 0) return null;
      return `${paramA} ${diff.toFixed(2)} ${unitWord} artırılmalı`;
    }
  }

  return null;
}

/**
 * Generic modül için puan iyileştirme önerileri üret
 * İLÇESM, ADSH ve diğer modüller için kullanılır.
 * gpRules'daki kademe yapısını analiz ederek bir sonraki
 * ulaşılabilir kademeyi ve gerekli GD değişimini hesaplar.
 */
export function generateGenericRecommendations(
  bhTableData: BHTableRow[],
  definitions: IndicatorDefinition[],
  totalGP: number,
  moduleType: InstitutionType
): RecommendationsSummary {
  const recommendations: ScoreRecommendation[] = [];
  let zeroPointIndicators = 0;
  let partialPointIndicators = 0;
  let fullPointIndicators = 0;

  // Gösterge kodundan modül prefix'ini belirle
  const codePrefix = moduleType === 'ILCESM' ? 'SYPG-İLÇESM-'
    : moduleType === 'ADSH' ? 'SYPG-ADSH-'
    : moduleType === 'ASH' ? 'SYPG-ASH-'
    : moduleType === 'ILSM' ? 'SYPG-İLSM-'
    : 'SYPG-BH-';

  for (const row of bhTableData) {
    const sira = row.sira;
    const def = definitions.find(d => d.code === `${codePrefix}${sira}`);
    if (!def) continue;

    const isExempt = row.muaf === 1;
    const hasData = typeof row.donemIciPuan === 'number';
    const currentGP = hasData ? (row.donemIciPuan as number) : 0;
    const maxPoints = def.maxPoints;

    // Sayaçları güncelle
    if (!isExempt) {
      if (hasData && currentGP >= maxPoints) {
        fullPointIndicators++;
      } else if (hasData && currentGP > 0 && currentGP < maxPoints) {
        partialPointIndicators++;
      } else {
        zeroPointIndicators++;
      }
    }

    // Muaf veya tam puan alanları hariç tut
    if (isExempt || (hasData && currentGP >= maxPoints)) {
      continue;
    }

    const currentGD = typeof row.donemIci === 'number' ? row.donemIci : null;
    const currentGO = typeof row.trRolOrtalama === 'number' ? row.trRolOrtalama : null;

    // gpRules'dan bir sonraki kademeyi analiz et
    const analysis = analyzeGpRulesForNextTier(def, currentGD, currentGP, maxPoints, row);

    const pointsGainable = analysis.targetGP - currentGP;
    if (pointsGainable <= 0) continue;

    // GD gap hesapla
    let gdGap: number | null = null;
    if (currentGD !== null && analysis.targetGD !== null) {
      gdGap = analysis.targetGD - currentGD;
    }

    const priority = determinePriority(pointsGainable, gdGap, maxPoints, currentGP);

    // Aksiyon önerisi
    const actionHint = generateGenericActionHint(row, def, analysis.targetGD, analysis.direction);

    recommendations.push({
      indicatorCode: `${codePrefix}${sira}`,
      sira,
      indicatorName: row.gostergeAdi,
      categoryName: getGenericCategoryName(sira, moduleType),
      currentGD,
      currentGO,
      currentGP,
      maxPoints,
      targetGD: analysis.targetGD,
      targetGP: analysis.targetGP,
      pointsGainable,
      gdGap,
      direction: analysis.direction,
      ruleType: 'go_threshold', // Generic modüllerde sadeleştirilmiş
      ruleDescription: analysis.ruleDescription,
      nextTierCondition: analysis.nextTierCondition,
      priority,
      isExempt,
      hasData,
      actionHint
    });
  }

  // Öncelik sırasına göre sırala
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  recommendations.sort((a, b) => {
    const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pDiff !== 0) return pDiff;
    return b.pointsGainable - a.pointsGainable;
  });

  const totalPotentialGain = recommendations.reduce((sum, r) => sum + r.pointsGainable, 0);
  const estimatedTotalGP = totalGP + totalPotentialGain;

  // Quick wins
  const quickWins = [...recommendations]
    .filter(r => r.pointsGainable > 0 && r.gdGap !== null && r.targetGD !== null)
    .sort((a, b) => {
      const aTarget = Math.abs(a.targetGD || 1);
      const bTarget = Math.abs(b.targetGD || 1);
      const aGapPct = Math.abs(a.gdGap!) / (aTarget || 1);
      const bGapPct = Math.abs(b.gdGap!) / (bTarget || 1);
      const gapDiff = aGapPct - bGapPct;
      if (Math.abs(gapDiff) > 0.01) return gapDiff;
      return b.pointsGainable - a.pointsGainable;
    })
    .slice(0, 3);

  // Kolay ulaşılabilir hedefler
  const easyTargets = [...recommendations]
    .filter(r => {
      if (r.pointsGainable <= 0) return false;
      if (r.gdGap !== null && r.targetGD !== null) {
        const targetAbs = Math.abs(r.targetGD) || 1;
        const gapPct = Math.abs(r.gdGap) / targetAbs;
        return gapPct < 0.20;
      }
      if (r.pointsGainable === 1) return true;
      return false;
    })
    .sort((a, b) => {
      const pDiff = b.pointsGainable - a.pointsGainable;
      if (pDiff !== 0) return pDiff;
      const aGap = a.gdGap !== null ? Math.abs(a.gdGap) : 999;
      const bGap = b.gdGap !== null ? Math.abs(b.gdGap) : 999;
      return aGap - bGap;
    });

  const easyTargetGain = easyTargets.reduce((sum, r) => sum + r.pointsGainable, 0);
  const easyTargetTotalGP = totalGP + easyTargetGain;

  // Tahmini başarı oranı
  const recMap = new Map(recommendations.map(r => [r.sira, r.pointsGainable]));
  const eligibleRows = bhTableData.filter(r => r.muaf !== 1);
  let estimatedAchievementRate = 0;
  if (eligibleRows.length > 0) {
    const totalPct = eligibleRows.reduce((sum, r) => {
      const maxP = r.maxPuan || 4;
      const gp = typeof r.donemIciPuan === 'number' ? r.donemIciPuan : 0;
      const gain = recMap.get(r.sira) || 0;
      return sum + (maxP > 0 ? (Math.min(gp + gain, maxP) / maxP) * 100 : 0);
    }, 0);
    estimatedAchievementRate = totalPct / eligibleRows.length;
  }

  return {
    recommendations,
    totalPotentialGain,
    currentTotalGP: totalGP,
    estimatedTotalGP,
    estimatedAchievementRate,
    quickWins,
    easyTargets,
    easyTargetGain,
    easyTargetTotalGP,
    zeroPointIndicators,
    partialPointIndicators,
    fullPointIndicators
  };
}
