import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_BUSINESS_SETTINGS, businessSettings, returnPolicy } from '../../shared/businessSettings.js';
import { validateBusinessSettings } from '../src/services/businessSettings.js';
import { calculateSellerDeliveryFee, SRI_LANKA_DISTRICTS } from '../src/config/sriLankaDistricts.js';
const fresh=()=>structuredClone(DEFAULT_BUSINESS_SETTINGS);
test('business settings default safely and reject unbounded or unsafe configurations',()=>{
  assert.deepEqual(validateBusinessSettings(fresh()),fresh());
  for(const mutate of [s=>s.pricing.maxQuantityPerSelection=100,s=>s.pricing.maxCartSelections=51,s=>s.home.homemade.limit=100,s=>s.home.intervalMs=10,s=>s.navigation.mobileLinks[0].href='//evil.invalid',s=>s.identity.logo='javascript:alert(1)',s=>s.returns.cancelStatuses=['shipped'],s=>s.returns.days=0,s=>s.references.sellerTypes[0].commissionPercent=101,s=>s.returns.cancelReasons=[''],s=>s.references.banks=[''],s=>s.extraSecret='unsupported']){
    const settings=fresh();mutate(settings);assert.throws(()=>validateBusinessSettings(settings),error=>error.status===400);
  }
  assert.equal(businessSettings({businessSettings:{identity:{name:'Custom'}}}).identity.supportEmail,'support@yaans.lk');
});
test('same-district windows, preparation and surcharge use the configured rules',()=>{
  const districts=structuredClone(SRI_LANKA_DISTRICTS);districts[0].estimatedDays='4-6 business days';
  const delivery={...fresh().delivery,surchargeAfterItems:1,surchargePerItemLkr:25};
  const quote=calculateSellerDeliveryFee({sellerDistrict:'Colombo',destinationDistrict:'Colombo',totalItemCount:3,districtConfigs:districts,deliveryRules:delivery,sellerShippingPolicy:{preparationDays:2}});
  assert.equal(quote.deliveryFeeLkr,330);assert.match(quote.estimatedDays,/2 business day\(s\) preparation/);assert.match(quote.estimatedDays,/4-6 business days/);
  assert.equal(calculateSellerDeliveryFee({districtConfigs:districts,deliveryRules:{...delivery,sameDistrictDays:'Next business day'}}).estimatedDays,'Next business day');
});
test('return eligibility uses product overrides before category overrides',()=>{
  const settings=fresh();settings.returns.categoryOverrides=[{slug:'food',eligible:false,days:2}];settings.returns.productOverrides=[{id:'product',eligible:true,days:14}];
  assert.deepEqual(returnPolicy(settings,{_id:'product',categorySlug:'food'}),{enabled:true,days:14});
  assert.equal(returnPolicy(settings,{_id:'other',categorySlug:'food'}).enabled,false);
  settings.returns.enabled=false;assert.equal(returnPolicy(settings,{_id:'product',categorySlug:'food'}).enabled,false);
});
