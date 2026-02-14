import { HOSPITALS } from '../../constants';
import { KurumCategory, KurumInfo, KURUM_CATEGORY_LABELS } from '../types/user';

export const ILCE_SAGLIK_MUDURLUGU_LIST = [
  'Akçakale İlçe Sağlık Müdürlüğü',
  'Birecik İlçe Sağlık Müdürlüğü',
  'Bozova İlçe Sağlık Müdürlüğü',
  'Ceylanpınar İlçe Sağlık Müdürlüğü',
  'Eyyübiye İlçe Sağlık Müdürlüğü',
  'Halfeti İlçe Sağlık Müdürlüğü',
  'Haliliye İlçe Sağlık Müdürlüğü',
  'Harran İlçe Sağlık Müdürlüğü',
  'Hilvan İlçe Sağlık Müdürlüğü',
  'Karaköprü İlçe Sağlık Müdürlüğü',
  'Siverek İlçe Sağlık Müdürlüğü',
  'Suruç İlçe Sağlık Müdürlüğü',
  'Viranşehir İlçe Sağlık Müdürlüğü',
];

export const ADSH_LIST = [
  'Şanlıurfa ADSH',
  'Haliliye ADSH',
  'Eyyübiye ADSM',
  'Siverek ADSM',
];

export function getKurumSubList(category: KurumCategory): string[] | null {
  switch (category) {
    case 'KAMU_HASTANELERI':
      return HOSPITALS;
    case 'ILCE_SAGLIK_MUDURLUGU':
      return ILCE_SAGLIK_MUDURLUGU_LIST;
    case 'ADSH':
      return ADSH_LIST;
    case 'IL_SAGLIK_MUDURLUGU':
    case 'ACIL_SAGLIK_HIZMETLERI':
      return null;
    case 'OZEL_UNIVERSITE':
      return null;
    default:
      return null;
  }
}

export function getKurumDisplayText(kurum: KurumInfo): string {
  if (kurum.name) {
    return kurum.name;
  }
  return KURUM_CATEGORY_LABELS[kurum.category];
}
