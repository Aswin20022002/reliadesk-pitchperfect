// ROI model behind the deck numbers. All inputs are assumptions a plant would replace with its own
// figures from the free Alert Audit. Defaults reproduce the 250-asset reference plant on the slides.
export interface RoiInput {
  assets: number
  pricePerAssetMonth: number // rupees
  downtimeHrsPerAssetYear: number // unplanned downtime hours per asset per year
  costPerHour: number // rupees lost per hour of unplanned downtime
  cutPct: number // unplanned downtime removed, percent
  labourHrsWeekPerAsset: number // supervisor and technician hours freed per asset per week
  labourRate: number // loaded rupees per hour
  labourShare: number // share of the labour gain realised, 0 to 1
}

export const REFERENCE: RoiInput = {
  assets: 250,
  pricePerAssetMonth: 4000,
  downtimeHrsPerAssetYear: 324 / 250, // 27 hours a month across 250 assets
  costPerHour: 1_000_000, // Rs 10 lakh, conservative; the ABB India typical is about Rs 70 lakh
  cutPct: 30,
  labourHrsWeekPerAsset: 144 / 250, // 80% of 180 hours a week
  labourRate: 600,
  labourShare: 1,
}

export function computeRoi(i: RoiInput) {
  const price = i.assets * i.pricePerAssetMonth * 12
  const downtimeHrs = i.assets * i.downtimeHrsPerAssetYear
  const avoidedHrs = (downtimeHrs * i.cutPct) / 100
  const downtimeBenefit = avoidedHrs * i.costPerHour
  const labourHrsYear = i.assets * i.labourHrsWeekPerAsset * 52
  const labourBenefit = labourHrsYear * i.labourRate * i.labourShare
  const total = downtimeBenefit + labourBenefit
  return {
    price,
    downtimeHrs,
    avoidedHrs,
    labourHrsYear,
    downtimeBenefit,
    labourBenefit,
    total,
    multiple: price ? total / price : 0,
    paybackMonths: total ? (price / total) * 12 : Infinity,
    breakEvenCutPct: downtimeHrs * i.costPerHour ? (price / (downtimeHrs * i.costPerHour)) * 100 : Infinity,
  }
}

export const crore = (rupees: number) => `₹${(rupees / 1e7).toFixed(rupees >= 1e8 ? 1 : 2)} crore`
export const lakh = (rupees: number) => `₹${(rupees / 1e5).toFixed(0)} lakh`
