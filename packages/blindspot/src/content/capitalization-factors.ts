// The stated assumptions of the instrument, in one place.
//
// Two kinds of numbers live here, and both are CANOPTICON constructions
// documented in the method paper's honesty boxes — not official
// statistics. The operator can tune them without touching any other
// code; the method paper reads them so the published assumptions and
// the running assumptions never drift apart.
//
//   1. CAPITALIZATION_FACTORS — the income → wealth-stock multipliers
//      the capitalization method applies per asset class. A factor is
//      1 / (rate of return): $1 of dividend income at a 4% dividend
//      yield implies $25 of underlying equity. Drawn from the
//      Saez–Zucman / Kopczuk–Smith–Zidar–Zwick methodology; the exact
//      returns are a modelling choice.
//
//   2. INDEX_PARAMS — how the Invisibility Index (the total dollar gap
//      between the top and bottom method at the very top) is split into
//      the four channels. These shares are the instrument's stated
//      hypothesis about WHERE the missing wealth hides. They sum to 1.

export interface CapitalizationFactor {
  assetClass: string;
  /** Multiplier applied to the capital income flow to recover the stock. */
  factor: number;
  /** Implied rate of return (1 / factor), shown for legibility. */
  impliedReturn: number;
  sourceNote: string;
}

// Illustrative working factors. The capitalization method is only as
// good as these; the method paper is explicit that they are assumptions.
export const CAPITALIZATION_FACTORS: CapitalizationFactor[] = [
  {
    assetClass: "Interest-bearing (deposits, bonds)",
    factor: 40,
    impliedReturn: 0.025,
    sourceNote: "Capitalized at a 2.5% blended interest yield.",
  },
  {
    assetClass: "Dividends (listed equity)",
    factor: 25,
    impliedReturn: 0.04,
    sourceNote: "Capitalized at a 4% dividend yield.",
  },
  {
    assetClass: "Business + professional income",
    factor: 12.5,
    impliedReturn: 0.08,
    sourceNote: "Capitalized at an 8% return on closely-held business equity.",
  },
  {
    assetClass: "Realized capital gains (proxy)",
    factor: 20,
    impliedReturn: 0.05,
    sourceNote: "Capitalized at a 5% total return; a weak proxy for the underlying stock.",
  },
];

export interface IndexParams {
  /** Share of the gap attributed to unrealized capital gains. */
  unrealizedShare: number;
  /** Share attributed to closely-held / private-equity valuation. */
  privateEquityShare: number;
  /** Share attributed to offshore wealth. */
  offshoreShare: number;
  /** Share attributed to survey non-response at the top. */
  nonresponseShare: number;
  /** Recovery-ratio target: below this, a period is flagged unreliable. */
  recoveryTarget: number;
}

// The stated decomposition. Unrealized gains dominate (the buy–borrow–die
// channel); private equity is the residual after the other three; offshore
// and non-response are the smaller, better-bounded channels. Sum = 1.0.
export const INDEX_PARAMS: IndexParams = {
  unrealizedShare: 0.55,
  privateEquityShare: 0.33,
  offshoreShare: 0.08,
  nonresponseShare: 0.04,
  recoveryTarget: 0.8,
};

/** The four channel shares, in decomposition order, for rendering. */
export const CHANNELS: Array<{ key: keyof IndexParams; label: string; blurb: string }> = [
  {
    key: "unrealizedShare",
    label: "Unrealized capital gains",
    blurb:
      "Wealth that has grown but never been sold, so it never appears as income and never gets capitalized. The buy–borrow–die channel.",
  },
  {
    key: "privateEquityShare",
    label: "Private equity",
    blurb:
      "Closely-held and private business value, which has no market price and is systematically undervalued by income-based methods.",
  },
  {
    key: "offshoreShare",
    label: "Offshore wealth",
    blurb:
      "Assets held through foreign structures that report no domestic income and fall outside every domestic survey frame.",
  },
  {
    key: "nonresponseShare",
    label: "Survey non-response",
    blurb:
      "The richest households are least likely to answer a household survey, and their absence pulls the survey estimate down hardest at the top.",
  },
];

// Sanity: the decomposition must partition the gap. Guarded at module
// load so a bad edit fails loudly rather than silently mis-attributing.
const _sum =
  INDEX_PARAMS.unrealizedShare +
  INDEX_PARAMS.privateEquityShare +
  INDEX_PARAMS.offshoreShare +
  INDEX_PARAMS.nonresponseShare;
if (Math.abs(_sum - 1) > 1e-9) {
  throw new Error(`INDEX_PARAMS channel shares must sum to 1 (got ${_sum})`);
}
