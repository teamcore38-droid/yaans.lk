import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateSellerDeliveryFee as quote, SRI_LANKA_DISTRICTS } from '../src/config/sriLankaDistricts.js';

test('all 25 districts have unique codes/names and usable district-to-district quotes', () => {
  assert.equal(SRI_LANKA_DISTRICTS.length, 25);
  assert.equal(new Set(SRI_LANKA_DISTRICTS.map((d) => d.code)).size, 25);
  assert.equal(new Set(SRI_LANKA_DISTRICTS.map((d) => d.name)).size, 25);
  for (const origin of SRI_LANKA_DISTRICTS) {
    for (const destination of SRI_LANKA_DISTRICTS) {
      const result = quote({ sellerDistrict: origin.name, destinationDistrict: destination.name });
      assert.ok(Number.isFinite(result.deliveryFeeLkr) && result.deliveryFeeLkr >= 0);
      assert.equal(result.originDistrict, origin.name);
      assert.equal(result.destinationDistrict, destination.name);
      assert.equal(result.codAvailable, destination.codAvailable);
    }
  }
});

for (const [origin, destination, expected] of [
  ['Colombo', 'Colombo', 280], ['Colombo', 'Kandy', 380], ['Kandy', 'Colombo', 420], ['Kandy', 'Matale', 400]
]) {
  test(`courier from ${origin} to ${destination} costs Rs. ${expected}`, () => {
    assert.equal(quote({ sellerDistrict: origin, destinationDistrict: destination }).deliveryFeeLkr, expected);
  });
}

test('quantity surcharge begins at the fourth item and is charged per extra unit', () => {
  for (const [totalItemCount, expected] of [[1, 280], [3, 280], [4, 320], [6, 400]]) {
    assert.equal(quote({ totalItemCount }).deliveryFeeLkr, expected);
  }
});

test('seller free shipping applies exactly at its threshold', () => {
  const sellerShippingPolicy = { freeShippingThresholdLkr: 5000 };
  assert.equal(quote({ sellerShippingPolicy, sellerSubtotalLkr: 4999 }).isFreeShipping, false);
  assert.equal(quote({ sellerShippingPolicy, sellerSubtotalLkr: 5000, totalItemCount: 8 }).deliveryFeeLkr, 0);
});

test('global free shipping applies at its threshold and zero disables it', () => {
  assert.equal(quote({ globalFreeShippingMinLkr: 3000, sellerSubtotalLkr: 2999 }).isFreeShipping, false);
  assert.equal(quote({ globalFreeShippingMinLkr: 3000, sellerSubtotalLkr: 3000 }).deliveryFeeLkr, 0);
  assert.equal(quote({ globalFreeShippingMinLkr: 0, sellerSubtotalLkr: 99999 }).deliveryFeeLkr, 280);
});

test('flat rate bypasses district differences and quantity surcharges', () => {
  for (const destinationDistrict of ['Colombo', 'Jaffna', 'Kandy']) {
    assert.equal(quote({ shippingMode: 'flat', flatShippingRateLkr: 225, destinationDistrict, totalItemCount: 12 }).deliveryFeeLkr, 225);
  }
  assert.equal(quote({ shippingMode: 'flat', flatShippingRateLkr: 0 }).deliveryFeeLkr, 0);
});

test('seller intra-district override does not change inter-district quotes', () => {
  const sellerShippingPolicy = { flatRateIntraLkr: 180 };
  assert.equal(quote({ sellerShippingPolicy }).deliveryFeeLkr, 180);
  assert.equal(quote({ sellerShippingPolicy, destinationDistrict: 'Kandy' }).deliveryFeeLkr, 380);
});

test('free shipping and flat-rate mode preserve disabled district COD', () => {
  const districtConfigs = SRI_LANKA_DISTRICTS.map((d) => ({ ...d, codAvailable: false }));
  for (const options of [{}, { shippingMode: 'flat' }, { sellerSubtotalLkr: 5000, globalFreeShippingMinLkr: 5000 }]) {
    assert.equal(quote({ ...options, districtConfigs }).codAvailable, false);
  }
});
