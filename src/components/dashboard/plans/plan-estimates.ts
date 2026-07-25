
interface PricingItemLike {
  category: string;
  service: string;
  metric: string;
  priceMicros: number;
}

const TTS_CHARS_PER_MINUTE = 900;
const STT_SECONDS_PER_MINUTE = 8.5;
const SECONDS_PER_HOUR = 3600;
const MICROS = 1_000_000;

const VOICE_ACTIVITY_RATIO = 0.60;

export interface MessageEstimate {
  service: string;       
  category: string;      
  count: number;
  priceUSD: number;
}

export function estimateMessagesByType(
  basePriceBRLCents: number,
  items: PricingItemLike[],
  exchangeRate: number,
): MessageEstimate[] {
  if (exchangeRate <= 0) return [];

  const basePriceUSD = basePriceBRLCents / 100 / exchangeRate;

  return items
    .filter(
      (i) =>
        i.category === "whatsapp" &&
        i.metric === "per_message" &&
        i.priceMicros > 0,
    )
    .map((i) => {
      const priceUSD = i.priceMicros / MICROS;
      return {
        service: i.service,
        category: i.category,
        count: Math.floor(basePriceUSD / priceUSD),
        priceUSD,
      };
    })
    .sort((a, b) => b.count - a.count);
}

export function hasTelephonyCapability(items: PricingItemLike[]): boolean {
  return items.some(
    (i) =>
      i.category === "telephony" ||
      i.category === "tts" ||
      i.category === "stt",
  );
}

export function estimateCostPerMinuteUSD(
  items: PricingItemLike[],
): number | null {
  const sip = items.find(
    (i) => i.category === "telephony" && i.metric === "per_minute",
  );
  const tts = items.find(
    (i) => i.category === "tts" && i.priceMicros > 0,
  );
  const stt = items.find(
    (i) => i.category === "stt" && i.priceMicros > 0,
  );

  if (!sip && !tts && !stt) return null;

  let total = 0;

  if (sip) {
    total += sip.priceMicros / MICROS;
  }

  if (tts) {
    const ttsPerChar = tts.priceMicros / MICROS / 1_000_000;
    total += ttsPerChar * TTS_CHARS_PER_MINUTE * VOICE_ACTIVITY_RATIO;
  }

  if (stt) {
    const sttPerSecond = stt.priceMicros / MICROS / SECONDS_PER_HOUR;
    total += sttPerSecond * STT_SECONDS_PER_MINUTE * VOICE_ACTIVITY_RATIO;
  }

  return total > 0 ? total : null;
}

export function estimateCallMinutesFromPlan(
  basePriceBRLCents: number,
  items: PricingItemLike[],
  exchangeRate: number,
): number | null {
  const costPerMin = estimateCostPerMinuteUSD(items);
  if (!costPerMin || exchangeRate <= 0) return null;

  const basePriceUSD = basePriceBRLCents / 100 / exchangeRate;
  return Math.floor(basePriceUSD / costPerMin);
}

export function formatEstimateNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale === "pt" ? "pt-BR" : locale).format(
    value,
  );
}

export function formatMicroCostAsBRL(
  usdValue: number,
  exchangeRate: number,
): string {
  const brl = usdValue * exchangeRate;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(brl);
}
