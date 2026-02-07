/**
 * GÖREN Gösterge Registry - Merkezi Birleştirici
 *
 * Tüm kurum türlerinin göstergelerini tek noktadan erişilebilir yapar.
 */

import { IndicatorDefinition, InstitutionType } from '../../../components/goren/types/goren.types';
import { ILSM_INDICATORS, ILSM_INDICATOR_COUNT, ILSM_MAX_TOTAL_POINTS } from './ilsm.registry';
import { BH_INDICATORS, BH_INDICATOR_COUNT, BH_MAX_TOTAL_POINTS } from './bh.registry';
import { ILCESM_INDICATORS, ILCESM_INDICATOR_COUNT, ILCESM_MAX_TOTAL_POINTS } from './ilcesm.registry';
import { ADSH_INDICATORS, ADSH_INDICATOR_COUNT, ADSH_MAX_TOTAL_POINTS } from './adsh.registry';
import { ASH_INDICATORS, ASH_INDICATOR_COUNT, ASH_MAX_TOTAL_POINTS } from './ash.registry';

/**
 * Tüm göstergelerin registry'si
 */
export const GOREN_INDICATOR_REGISTRY: Record<InstitutionType, IndicatorDefinition[]> = {
  ILSM: ILSM_INDICATORS,
  ILCESM: ILCESM_INDICATORS,
  BH: BH_INDICATORS,
  ADSH: ADSH_INDICATORS,
  ASH: ASH_INDICATORS,
};

/**
 * Kurum türü başına gösterge sayıları
 */
export const INDICATOR_COUNTS: Record<InstitutionType, number> = {
  ILSM: ILSM_INDICATOR_COUNT,
  ILCESM: ILCESM_INDICATOR_COUNT,
  BH: BH_INDICATOR_COUNT,
  ADSH: ADSH_INDICATOR_COUNT,
  ASH: ASH_INDICATOR_COUNT,
};

/**
 * Kurum türü başına maksimum puanlar
 */
export const MAX_POINTS: Record<InstitutionType, number> = {
  ILSM: ILSM_MAX_TOTAL_POINTS,
  ILCESM: ILCESM_MAX_TOTAL_POINTS,
  BH: BH_MAX_TOTAL_POINTS,
  ADSH: ADSH_MAX_TOTAL_POINTS,
  ASH: ASH_MAX_TOTAL_POINTS,
};

/**
 * Tüm göstergeleri düz liste olarak getir
 */
export const getAllIndicators = (): IndicatorDefinition[] => {
  return Object.values(GOREN_INDICATOR_REGISTRY).flat();
};

/**
 * Kurum türüne göre göstergeleri getir
 */
export const getIndicatorsByCategory = (category: InstitutionType): IndicatorDefinition[] => {
  return GOREN_INDICATOR_REGISTRY[category] || [];
};

/**
 * Gösterge koduna göre tanım getir
 */
export const getIndicatorByCode = (code: string): IndicatorDefinition | undefined => {
  return getAllIndicators().find(ind => ind.code === code);
};

/**
 * Kurum türünün aktif olup olmadığını kontrol et
 */
export const isInstitutionTypeActive = (type: InstitutionType): boolean => {
  return GOREN_INDICATOR_REGISTRY[type].length > 0;
};

/**
 * Aktif kurum türlerini getir
 */
export const getActiveInstitutionTypes = (): InstitutionType[] => {
  return (Object.keys(GOREN_INDICATOR_REGISTRY) as InstitutionType[])
    .filter(type => GOREN_INDICATOR_REGISTRY[type].length > 0);
};

/**
 * Kurum türü etiketleri
 */
export const INSTITUTION_TYPE_LABELS: Record<InstitutionType, string> = {
  ILSM: 'İl Sağlık Müdürlüğü',
  ILCESM: 'İlçe Sağlık Müdürlüğü',
  BH: 'Başhekimlik',
  ADSH: 'Ağız ve Diş Sağlığı Hastanesi',
  ASH: 'Acil Sağlık Hizmetleri'
};

/**
 * Kurum türü kısa etiketleri
 */
export const INSTITUTION_TYPE_SHORT_LABELS: Record<InstitutionType, string> = {
  ILSM: 'İLSM',
  ILCESM: 'İLÇESM',
  BH: 'BH',
  ADSH: 'ADSH',
  ASH: 'ASH'
};

// Re-export individual registries
export { ILSM_INDICATORS, ILSM_INDICATOR_COUNT, ILSM_MAX_TOTAL_POINTS };
export { ILCESM_INDICATORS, ILCESM_INDICATOR_COUNT, ILCESM_MAX_TOTAL_POINTS };
export { BH_INDICATORS, BH_INDICATOR_COUNT, BH_MAX_TOTAL_POINTS };
export { ADSH_INDICATORS, ADSH_INDICATOR_COUNT, ADSH_MAX_TOTAL_POINTS };
export { ASH_INDICATORS, ASH_INDICATOR_COUNT, ASH_MAX_TOTAL_POINTS };
