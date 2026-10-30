import { describeDeposit } from './deposit';
import { ExchangeRates, GoldType, PortfolioAsset } from '../types/portfolio';

export interface GoldDefinition {
  type: GoldType;
  name: string;
  shortName: string;
  /** Name shown in lists instead of the type code */
  displayName: string;
  /** One-line detail shown under displayName */
  detail: string;
  weightGrams: number;
  karat: number;
  purity: number; // pure gold equivalent ratio
  mintingPremiumRatio: number; // Darphane basım & piyasa marjı
  description: string;
  isUnitPiece: boolean; // True if traded by count (adet), false if by weight (gram)
}

export const TURKISH_GOLD_DEFINITIONS: Record<GoldType, GoldDefinition> = {
  GRAM_24: {
    type: 'GRAM_24',
    name: 'Gram Altın (24 Ayar Has)',
    shortName: 'Gram (24K)',
    displayName: 'Gram Altın',
    detail: '24 ayar · gram',
    weightGrams: 1.0,
    karat: 24,
    purity: 1.0,
    mintingPremiumRatio: 1.0,
    description: '1.000 gram 995/1000 has altın',
    isUnitPiece: false,
  },
  CEYREK: {
    type: 'CEYREK',
    name: 'Çeyrek Altın (Eski/Yeni Tarihli)',
    shortName: 'Çeyrek Altın',
    displayName: 'Çeyrek Altın',
    detail: 'Eski/yeni tarihli · adet',
    weightGrams: 1.754,
    karat: 22,
    purity: 0.916,
    mintingPremiumRatio: 1.035, // ~1.606g has + darphane payı
    description: '1.75 gram 22 ayar (1.606g has altın)',
    isUnitPiece: true,
  },
  YARIM: {
    type: 'YARIM',
    name: 'Yarım Altın',
    shortName: 'Yarım Altın',
    displayName: 'Yarım Altın',
    detail: 'adet',
    weightGrams: 3.508,
    karat: 22,
    purity: 0.916,
    mintingPremiumRatio: 1.035,
    description: '3.50 gram 22 ayar (3.213g has altın)',
    isUnitPiece: true,
  },
  TAM: {
    type: 'TAM',
    name: 'Tam Altın (Ziynet)',
    shortName: 'Tam Ziynet',
    displayName: 'Tam Altın',
    detail: 'Ziynet · adet',
    weightGrams: 7.016,
    karat: 22,
    purity: 0.916,
    mintingPremiumRatio: 1.035,
    description: '7.016 gram 22 ayar (6.426g has altın)',
    isUnitPiece: true,
  },
  ATA_CUMHURIYET: {
    type: 'ATA_CUMHURIYET',
    name: 'Cumhuriyet / Ata Altını',
    shortName: 'Ata Altın',
    displayName: 'Ata Altın',
    detail: 'Cumhuriyet · adet',
    weightGrams: 7.216,
    karat: 22,
    purity: 0.916,
    mintingPremiumRatio: 1.04, // 6.620g has + cumhuriyet marjı
    description: '7.216 gram 22 ayar (6.620g has altın)',
    isUnitPiece: true,
  },
  BILEZIK_22: {
    type: 'BILEZIK_22',
    name: '22 Ayar Bilezik / Hurda Gram',
    shortName: '22 Ayar Gram',
    displayName: '22 Ayar Bilezik',
    detail: 'gram',
    weightGrams: 1.0,
    karat: 22,
    purity: 0.916,
    mintingPremiumRatio: 1.0,
    description: '1.000 gram 916/1000 altın',
    isUnitPiece: false,
  },
  ONS_GOLD: {
    type: 'ONS_GOLD',
    name: 'Ons Altın (XAU / Troy Ounce)',
    shortName: 'Ons Altın',
    displayName: 'Ons Altın',
    detail: 'XAU · ons',
    weightGrams: 31.1035,
    karat: 24,
    purity: 1.0,
    mintingPremiumRatio: 1.0,
    description: '31.1035 gram has altın (USD bazlı)',
    isUnitPiece: false,
  },
  GUMUS_GRAM: {
    type: 'GUMUS_GRAM',
    name: 'Gümüş Gram (Has Gümüş)',
    shortName: 'Gümüş (Gram)',
    displayName: 'Gümüş',
    detail: 'Has gümüş · gram',
    weightGrams: 1.0,
    karat: 24,
    purity: 1.0,
    mintingPremiumRatio: 1.0,
    description: '1.000 gram 999 ayar has gümüş',
    isUnitPiece: false,
  },
};

/**
 * Calculates current unit price in TRY for a specific Turkish gold variety
 * Prioritizes direct live market prices when available from live feed
 */
export function calculateGoldUnitPrice(
  goldType: GoldType,
  gramGoldTRY: number,
  silverGramTRY: number,
  rates?: Partial<ExchangeRates>
): number {
  if (rates) {
    if (goldType === 'GRAM_24' && rates.GRAM_GOLD_TRY && rates.GRAM_GOLD_TRY > 0) {
      return rates.GRAM_GOLD_TRY;
    }
    if (goldType === 'CEYREK' && rates.CEYREK_GOLD_TRY && rates.CEYREK_GOLD_TRY > 0) {
      return rates.CEYREK_GOLD_TRY;
    }
    if (goldType === 'YARIM' && rates.YARIM_GOLD_TRY && rates.YARIM_GOLD_TRY > 0) {
      return rates.YARIM_GOLD_TRY;
    }
    if (goldType === 'TAM' && rates.TAM_GOLD_TRY && rates.TAM_GOLD_TRY > 0) {
      return rates.TAM_GOLD_TRY;
    }
    if (goldType === 'ATA_CUMHURIYET' && rates.ATA_GOLD_TRY && rates.ATA_GOLD_TRY > 0) {
      return rates.ATA_GOLD_TRY;
    }
    if (goldType === 'BILEZIK_22' && rates.BILEZIK_22_TRY && rates.BILEZIK_22_TRY > 0) {
      return rates.BILEZIK_22_TRY;
    }
    if (goldType === 'GUMUS_GRAM' && rates.SILVER_GRAM_TRY && rates.SILVER_GRAM_TRY > 0) {
      return rates.SILVER_GRAM_TRY;
    }
    if (goldType === 'ONS_GOLD' && rates.ONS_GOLD_USD && rates.USD_TRY) {
      return Math.round(rates.ONS_GOLD_USD * rates.USD_TRY * 100) / 100;
    }
  }

  if (goldType === 'GUMUS_GRAM') {
    return silverGramTRY > 0 ? silverGramTRY : 86.2;
  }

  const def = TURKISH_GOLD_DEFINITIONS[goldType];
  if (!def) return gramGoldTRY;

  if (goldType === 'GRAM_24') {
    return gramGoldTRY;
  }

  if (goldType === 'ONS_GOLD') {
    return Math.round(gramGoldTRY * 31.1034768 * 100) / 100;
  }

  // Weight * purity * has gram price * minting premium
  const pureWeight = def.weightGrams * def.purity;
  const rawValue = pureWeight * gramGoldTRY;
  return Math.round(rawValue * def.mintingPremiumRatio * 100) / 100;
}

export function getGoldDisplayDetails(goldType: GoldType) {
  return TURKISH_GOLD_DEFINITIONS[goldType] || TURKISH_GOLD_DEFINITIONS.GRAM_24;
}

/**
 * Title and subtitle for lists. Gold and silver are stored with their type
 * code as symbol (GRAM_24, ATA_CUMHURIYET); show a readable name instead, and
 * the user's own name underneath when they renamed it.
 */
export function getAssetDisplay(asset: Pick<PortfolioAsset, 'category' | 'goldType' | 'symbol' | 'name' | 'deposit'>): {
  title: string;
  subtitle: string;
} {
  if (asset.category === 'COMMODITY' && asset.goldType) {
    const def = getGoldDisplayDetails(asset.goldType);
    const renamed = asset.name.trim() && asset.name !== def.name;
    return { title: def.displayName, subtitle: renamed ? asset.name : def.detail };
  }
  if (asset.category === 'CASH' && asset.deposit) {
    const title = asset.deposit.termDays <= 1 ? 'Günlük Mevduat' : 'Vadeli Mevduat';
    return { title, subtitle: describeDeposit(asset.deposit) };
  }
  return { title: asset.symbol, subtitle: asset.name };
}
