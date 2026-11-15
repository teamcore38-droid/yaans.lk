import React, { useState } from 'react';
import { Check, Truck, Ban, MapPin, AlertTriangle } from 'lucide-react';
import { apiRequest } from '../../utils/api.js';

export default function DistrictShippingTab({
  districtsState,
  setDistrictsState,
  shippingMode,
  setShippingMode,
  flatShippingRate,
  setFlatShippingRate,
  showToast,
  fetchOverview
}) {
  const [savingDistricts, setSavingDistricts] = useState(false);
  const [savingShippingMode, setSavingShippingMode] = useState(false);

  const handleSaveDistricts = async () => {
    try {
      setSavingDistricts(true);
      await apiRequest('/admin/config/districts', {
        method: 'PUT',
        body: JSON.stringify({
          districts: districtsState,
          shippingMode,
          flatShippingRateLkr: Number(flatShippingRate)
        })
      });
      showToast(
        shippingMode === 'flat'
          ? `Flat Islandwide Shipping active at Rs. ${Number(flatShippingRate).toLocaleString()} (Custom district charges disabled).`
          : 'All 25 Sri Lankan district delivery fees & COD settings saved!'
      );
      fetchOverview();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingDistricts(false);
    }
  };

  const handleToggleShippingMode = async (targetMode) => {
    try {
      setSavingShippingMode(true);
      const res = await apiRequest('/admin/config/shipping-mode', {
        method: 'PUT',
        body: JSON.stringify({
          shippingMode: targetMode,
          flatShippingRateLkr: Number(flatShippingRate)
        })
      });
      setShippingMode(targetMode);
      showToast(res.message);
      fetchOverview();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingShippingMode(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Banner: Marketplace Shipping Strategy & Mode Controller */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Platform Delivery Configuration
              </span>
              {shippingMode === 'flat' ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1.5 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  One Shipping Charge Active (Rs. {Number(flatShippingRate).toLocaleString()} for All Places)
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1.5 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Custom 25-District Matrix Active
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 mt-1">
              Shipping Fee Control &amp; Universal Override
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Temporarily disable individual district charges and set one flat shipping rate for all places, or switch to the full 25-district matrix. Only one mode can be active at a time.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveDistricts}
              disabled={savingDistricts || savingShippingMode}
              className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-950 font-extrabold text-xs shadow-sm transition inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              {savingDistricts ? 'Saving All Settings...' : 'Save All 25 District Configs'}
            </button>
          </div>
        </div>

        {/* Mutually Exclusive Mode Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Option 1: One Unified Shipping Charge (Flat Rate for All Places) */}
          <div
            className={`relative rounded-xl border p-4 transition ${
              shippingMode === 'flat'
                ? 'border-amber-400 bg-amber-50/50 shadow-sm ring-2 ring-amber-400/30'
                : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-amber-600" />
                    One Shipping Charge (All Places)
                  </h3>
                  {shippingMode === 'flat' ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-500 text-slate-950">
                      ACTIVE
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 text-slate-600">
                      DISABLED
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600">
                  Temporarily <strong>disables all district shipping charges</strong> and applies a single unified fee for every order to any place in Sri Lanka.
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-700 whitespace-nowrap">
                  Unified Fee:
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                    Rs.
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={flatShippingRate}
                    onChange={(e) => setFlatShippingRate(Number(e.target.value))}
                    disabled={shippingMode !== 'flat'}
                    className={`w-28 pl-9 pr-3 py-1.5 rounded-lg border font-bold text-xs ${
                      shippingMode === 'flat'
                        ? 'border-amber-400 bg-white text-slate-900'
                        : 'border-slate-300 bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                    placeholder="350"
                  />
                </div>
                <span className="text-[11px] text-slate-500">LKR</span>
              </div>

              {shippingMode === 'flat' ? (
                <button
                  type="button"
                  onClick={() => handleToggleShippingMode('custom')}
                  disabled={savingShippingMode}
                  className="px-3.5 py-1.5 rounded-lg border border-red-300 bg-white text-red-700 hover:bg-red-50 text-xs font-bold transition inline-flex items-center gap-1.5 shadow-xs"
                >
                  <Ban className="w-3.5 h-3.5" />
                  {savingShippingMode ? 'Switching...' : 'Deactivate One Charge'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleToggleShippingMode('flat')}
                  disabled={savingShippingMode}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold shadow-xs transition inline-flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  {savingShippingMode ? 'Switching...' : 'Activate One Charge for All Places'}
                </button>
              )}
            </div>
          </div>

          {/* Option 2: Custom 25-District Matrix */}
          <div
            className={`relative rounded-xl border p-4 transition ${
              shippingMode === 'custom'
                ? 'border-emerald-500 bg-emerald-50/40 shadow-sm ring-2 ring-emerald-400/30'
                : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    Custom 25-District Shipping Charges
                  </h3>
                  {shippingMode === 'custom' ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-600 text-white">
                      ACTIVE
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 text-slate-600">
                      DISABLED
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600">
                  Calculates delivery dynamically per district based on <strong>intra-district, standard, and outstation courier fees</strong>.
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-slate-500">
                25 Individual District Rate Values
              </span>

              {shippingMode === 'custom' ? (
                <span className="text-xs font-extrabold text-emerald-700 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" /> Custom Matrix Active
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleToggleShippingMode('custom')}
                  disabled={savingShippingMode}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-xs transition inline-flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  {savingShippingMode ? 'Switching...' : 'Re-enable Custom District Charges'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">
              25 Sri Lankan Administrative Districts — Courier Fee &amp; COD Matrix
            </h2>
            <p className="text-xs text-slate-500">
              Configure Same-District (Intra), Standard, and Outstation courier fees in LKR (Rs.) + Cash on Delivery toggle per district.
            </p>
          </div>

          {shippingMode === 'flat' && (
            <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs">
              Rates Below Temporarily Disabled (Flat Rs. {Number(flatShippingRate).toLocaleString()} Active)
            </span>
          )}
        </div>

        {/* Warning banner when Flat Rate is active */}
        {shippingMode === 'flat' && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-xs text-amber-900">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="flex-1">
              <strong className="font-bold">District Shipping Fees Are Currently Disabled:</strong>
              <span className="ml-1">
                One universal shipping charge of <strong>Rs. {Number(flatShippingRate).toLocaleString()}</strong> is currently being applied for all places. The district-specific custom rate inputs below are locked. To resume using individual district fees, click <strong>&quot;Re-enable Custom District Charges&quot;</strong> above.
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleToggleShippingMode('custom')}
              disabled={savingShippingMode}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shrink-0 transition"
            >
              Re-enable Custom Rates
            </button>
          </div>
        )}

        <div className="overflow-x-auto max-h-[540px]">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-2 px-2">District</th>
                <th className="py-2 px-2">Province</th>
                <th className="py-2 px-2">
                  Same-District Fee (Rs.)
                  {shippingMode === 'flat' && <span className="block text-[10px] text-amber-700 font-normal">(Disabled)</span>}
                </th>
                <th className="py-2 px-2">
                  Standard Fee (Rs.)
                  {shippingMode === 'flat' && <span className="block text-[10px] text-amber-700 font-normal">(Disabled)</span>}
                </th>
                <th className="py-2 px-2">
                  Outstation Fee (Rs.)
                  {shippingMode === 'flat' && <span className="block text-[10px] text-amber-700 font-normal">(Disabled)</span>}
                </th>
                <th className="py-2 px-2">Est. Delivery Window</th>
                <th className="py-2 px-2">COD Enabled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {districtsState.map((d, idx) => (
                <tr
                  key={d.code || d.name}
                  className={shippingMode === 'flat' ? 'bg-slate-50/40' : ''}
                >
                  <td className="py-2 px-2 font-bold text-slate-900">{d.name}</td>
                  <td className="py-2 px-2 text-slate-500">{d.province}</td>
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      value={d.intraDistrictFee}
                      disabled={shippingMode === 'flat'}
                      onChange={(e) => {
                        const next = [...districtsState];
                        next[idx] = { ...next[idx], intraDistrictFee: Number(e.target.value) };
                        setDistrictsState(next);
                      }}
                      className={`w-20 px-2 py-1 rounded border font-semibold ${
                        shippingMode === 'flat'
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          : 'bg-white border-slate-300'
                      }`}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      value={d.standardFee}
                      disabled={shippingMode === 'flat'}
                      onChange={(e) => {
                        const next = [...districtsState];
                        next[idx] = { ...next[idx], standardFee: Number(e.target.value) };
                        setDistrictsState(next);
                      }}
                      className={`w-20 px-2 py-1 rounded border font-semibold ${
                        shippingMode === 'flat'
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          : 'bg-white border-slate-300'
                      }`}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      value={d.outstationFee}
                      disabled={shippingMode === 'flat'}
                      onChange={(e) => {
                        const next = [...districtsState];
                        next[idx] = { ...next[idx], outstationFee: Number(e.target.value) };
                        setDistrictsState(next);
                      }}
                      className={`w-20 px-2 py-1 rounded border font-semibold ${
                        shippingMode === 'flat'
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          : 'bg-white border-slate-300'
                      }`}
                    />
                  </td>
                  <td className="py-2 px-2"><input aria-label={`Delivery window ${d.name}`} className="border p-1 w-36" maxLength={100} value={d.estimatedDays || ''} onChange={e => { const next = [...districtsState]; next[idx] = { ...d, estimatedDays: e.target.value }; setDistrictsState(next); }} /></td>
                  <td className="py-2 px-2">
                    <input
                      type="checkbox"
                      checked={d.codAvailable !== false}
                      onChange={(e) => {
                        const next = [...districtsState];
                        next[idx] = { ...next[idx], codAvailable: e.target.checked };
                        setDistrictsState(next);
                      }}
                      className="rounded border-slate-300"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
