import { DEFAULT_BUSINESS_SETTINGS } from '../../../shared/businessSettings.js';
/**
 * All 25 Administrative Districts of Sri Lanka with default delivery fee configuration in LKR (Rs.)
 * - intraDistrictFee: Delivery fee when Seller District === Customer District
 * - standardFee: Delivery fee when Seller is in Colombo/Western Province or neighboring district
 * - outstationFee: Delivery fee when shipping across distant provinces
 * - codAvailable: Whether Cash on Delivery (COD) is enabled for this district
 * - estimatedDays: Typical courier delivery window
 */
export const SRI_LANKA_DISTRICTS = [
  { code: 'CMB', name: 'Colombo', province: 'Western', intraDistrictFee: 280, standardFee: 350, outstationFee: 420, codAvailable: true, estimatedDays: '1-2 business days' },
  { code: 'GMP', name: 'Gampaha', province: 'Western', intraDistrictFee: 300, standardFee: 350, outstationFee: 420, codAvailable: true, estimatedDays: '1-2 business days' },
  { code: 'KLT', name: 'Kalutara', province: 'Western', intraDistrictFee: 300, standardFee: 360, outstationFee: 430, codAvailable: true, estimatedDays: '1-3 business days' },
  { code: 'KDY', name: 'Kandy', province: 'Central', intraDistrictFee: 300, standardFee: 380, outstationFee: 450, codAvailable: true, estimatedDays: '2-3 business days' },
  { code: 'MTL', name: 'Matale', province: 'Central', intraDistrictFee: 320, standardFee: 400, outstationFee: 460, codAvailable: true, estimatedDays: '2-3 business days' },
  { code: 'NWE', name: 'Nuwara Eliya', province: 'Central', intraDistrictFee: 320, standardFee: 420, outstationFee: 480, codAvailable: true, estimatedDays: '2-4 business days' },
  { code: 'GLE', name: 'Galle', province: 'Southern', intraDistrictFee: 300, standardFee: 380, outstationFee: 450, codAvailable: true, estimatedDays: '2-3 business days' },
  { code: 'MTR', name: 'Matara', province: 'Southern', intraDistrictFee: 300, standardFee: 390, outstationFee: 460, codAvailable: true, estimatedDays: '2-3 business days' },
  { code: 'HMB', name: 'Hambantota', province: 'Southern', intraDistrictFee: 320, standardFee: 420, outstationFee: 480, codAvailable: true, estimatedDays: '2-4 business days' },
  { code: 'JFN', name: 'Jaffna', province: 'Northern', intraDistrictFee: 320, standardFee: 450, outstationFee: 520, codAvailable: true, estimatedDays: '3-5 business days' },
  { code: 'KIL', name: 'Kilinochchi', province: 'Northern', intraDistrictFee: 350, standardFee: 460, outstationFee: 520, codAvailable: true, estimatedDays: '3-5 business days' },
  { code: 'MNR', name: 'Mannar', province: 'Northern', intraDistrictFee: 350, standardFee: 460, outstationFee: 520, codAvailable: true, estimatedDays: '3-5 business days' },
  { code: 'VAV', name: 'Vavuniya', province: 'Northern', intraDistrictFee: 320, standardFee: 440, outstationFee: 500, codAvailable: true, estimatedDays: '2-4 business days' },
  { code: 'MLT', name: 'Mullaitivu', province: 'Northern', intraDistrictFee: 350, standardFee: 470, outstationFee: 540, codAvailable: true, estimatedDays: '3-5 business days' },
  { code: 'BTC', name: 'Batticaloa', province: 'Eastern', intraDistrictFee: 320, standardFee: 440, outstationFee: 500, codAvailable: true, estimatedDays: '2-4 business days' },
  { code: 'AMP', name: 'Ampara', province: 'Eastern', intraDistrictFee: 320, standardFee: 440, outstationFee: 500, codAvailable: true, estimatedDays: '2-4 business days' },
  { code: 'TRN', name: 'Trincomalee', province: 'Eastern', intraDistrictFee: 320, standardFee: 440, outstationFee: 500, codAvailable: true, estimatedDays: '2-4 business days' },
  { code: 'KRN', name: 'Kurunegala', province: 'North Western', intraDistrictFee: 300, standardFee: 380, outstationFee: 440, codAvailable: true, estimatedDays: '2-3 business days' },
  { code: 'PTL', name: 'Puttalam', province: 'North Western', intraDistrictFee: 320, standardFee: 400, outstationFee: 460, codAvailable: true, estimatedDays: '2-4 business days' },
  { code: 'ADP', name: 'Anuradhapura', province: 'North Central', intraDistrictFee: 320, standardFee: 410, outstationFee: 470, codAvailable: true, estimatedDays: '2-4 business days' },
  { code: 'PLN', name: 'Polonnaruwa', province: 'North Central', intraDistrictFee: 320, standardFee: 420, outstationFee: 480, codAvailable: true, estimatedDays: '2-4 business days' },
  { code: 'BDL', name: 'Badulla', province: 'Uva', intraDistrictFee: 320, standardFee: 420, outstationFee: 480, codAvailable: true, estimatedDays: '2-4 business days' },
  { code: 'MNG', name: 'Monaragala', province: 'Uva', intraDistrictFee: 340, standardFee: 440, outstationFee: 500, codAvailable: true, estimatedDays: '3-4 business days' },
  { code: 'RTN', name: 'Ratnapura', province: 'Sabaragamuwa', intraDistrictFee: 300, standardFee: 390, outstationFee: 450, codAvailable: true, estimatedDays: '2-3 business days' },
  { code: 'KGL', name: 'Kegalle', province: 'Sabaragamuwa', intraDistrictFee: 300, standardFee: 380, outstationFee: 440, codAvailable: true, estimatedDays: '2-3 business days' }
];

/**
 * Calculates the exact delivery fee for a specific seller's shipment to a customer's district.
 * Takes into account:
 * 1. District config (intra-district vs same-province vs inter-province/outstation)
 * 2. Seller's custom shipping settings (freeShippingThresholdLkr, flatFeeOverrideLkr)
 * 3. Item weight/quantity surcharge for bulk orders
 */
export function calculateSellerDeliveryFee({
  sellerDistrict = 'Colombo',
  destinationDistrict = 'Colombo',
  sellerSubtotalLkr = 0,
  totalItemCount = 1,
  sellerShippingPolicy = {},
  districtConfigs = SRI_LANKA_DISTRICTS,
  globalFreeShippingMinLkr = 0,
  shippingMode = 'custom',
  deliveryRules = DEFAULT_BUSINESS_SETTINGS.delivery,
  flatShippingRateLkr = 350
}) {
  const destConfig =
    districtConfigs.find((d) => d.name.toLowerCase() === String(destinationDistrict).toLowerCase()) ||
    districtConfigs[0];
  const originConfig =
    districtConfigs.find((d) => d.name.toLowerCase() === String(sellerDistrict).toLowerCase()) ||
    districtConfigs[0];

  const transit = originConfig.name === destConfig.name && deliveryRules.sameDistrictDays ? deliveryRules.sameDistrictDays : destConfig.estimatedDays;
  const preparationDays = Math.min(30, Math.max(0, Number(sellerShippingPolicy.preparationDays || 0)));
  const estimate = preparationDays ? `${preparationDays} business day(s) preparation + ${transit} transit` : transit;
  // Check seller-level free shipping threshold first
  if (
    sellerShippingPolicy?.freeShippingThresholdLkr > 0 &&
    sellerSubtotalLkr >= sellerShippingPolicy.freeShippingThresholdLkr
  ) {
    return {
      deliveryFeeLkr: 0,
      isFreeShipping: true,
      freeShippingReason: `Free delivery from seller on orders over Rs. ${sellerShippingPolicy.freeShippingThresholdLkr.toLocaleString()}`,
      originDistrict: originConfig.name,
      destinationDistrict: destConfig.name,
      estimatedDays: estimate,
      codAvailable: destConfig.codAvailable !== false
    };
  }

  // Check global free shipping threshold if enabled by Admin
  if (globalFreeShippingMinLkr > 0 && sellerSubtotalLkr >= globalFreeShippingMinLkr) {
    return {
      deliveryFeeLkr: 0,
      isFreeShipping: true,
      freeShippingReason: `Platform free delivery promo over Rs. ${globalFreeShippingMinLkr.toLocaleString()}`,
      originDistrict: originConfig.name,
      destinationDistrict: destConfig.name,
      estimatedDays: estimate,
      codAvailable: destConfig.codAvailable !== false
    };
  }

  // SINGLE FLAT RATE MODE (Islandwide Unified Rate)
  // When active, all district-specific custom rates are completely bypassed
  if (shippingMode === 'flat') {
    const flatRate = Math.max(0, Number(flatShippingRateLkr) || 0);
    return {
      deliveryFeeLkr: flatRate,
      baseFeeLkr: flatRate,
      weightSurchargeLkr: 0,
      rateTier: `Islandwide Flat Rate (Rs. ${flatRate.toLocaleString()})`,
      isFreeShipping: flatRate === 0,
      originDistrict: originConfig.name,
      destinationDistrict: destConfig.name,
      estimatedDays: estimate,
      codAvailable: destConfig.codAvailable !== false
    };
  }

  let baseFee = destConfig.standardFee;
  let rateTier = 'Standard Courier';

  if (originConfig.name === destConfig.name) {
    baseFee = destConfig.intraDistrictFee;
    rateTier = `Same-District (${destConfig.name})`;
  } else if (originConfig.province === destConfig.province || originConfig.province === 'Western') {
    baseFee = destConfig.standardFee;
    rateTier = `${originConfig.name} to ${destConfig.name} Standard`;
  } else {
    baseFee = destConfig.outstationFee;
    rateTier = `${originConfig.name} to ${destConfig.name} Inter-Province`;
  }

  // Optional seller flat rate override if lower/configured
  if (
    typeof sellerShippingPolicy?.flatRateIntraLkr === 'number' &&
    sellerShippingPolicy.flatRateIntraLkr > 0 &&
    originConfig.name === destConfig.name
  ) {
    baseFee = sellerShippingPolicy.flatRateIntraLkr;
  }

  // Additional item weight step: +Rs. 40 per extra item beyond 3 items from the same seller
  const extraUnits = Math.max(0, totalItemCount - deliveryRules.surchargeAfterItems);
  const weightSurcharge = extraUnits * deliveryRules.surchargePerItemLkr;
  const finalFee = Math.round(baseFee + weightSurcharge);

  return {
    deliveryFeeLkr: finalFee,
    baseFeeLkr: baseFee,
    weightSurchargeLkr: weightSurcharge,
    rateTier,
    isFreeShipping: false,
    originDistrict: originConfig.name,
    destinationDistrict: destConfig.name,
    estimatedDays: estimate,
    codAvailable: destConfig.codAvailable !== false
  };
}
