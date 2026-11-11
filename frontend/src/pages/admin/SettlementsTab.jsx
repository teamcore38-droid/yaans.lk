import React from 'react';
import { apiRequest, formatLkr } from '../../utils/api.js';

export default function SettlementsTab({
  generalCfg,
  setGeneralCfg,
  sellers,
  subOrders,
  settlements,
  showToast,
  fetchOverview
}) {
  const handleSaveGeneralConfig = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/admin/config/general', {
        method: 'PUT',
        body: JSON.stringify(generalCfg)
      });
      showToast('Marketplace commissions & COD rules updated!');
      fetchOverview();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSettleSellerPayout = async (sellerId) => {
    try {
      const res = await apiRequest('/admin/settlements/payout', {
        method: 'POST',
        body: JSON.stringify({ sellerId })
      });
      showToast(res.message);
      fetchOverview();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: Global Commission & COD Rules (5 cols) */}
      <form
        onSubmit={handleSaveGeneralConfig}
        className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4 text-xs"
      >
        <h2 className="text-sm font-extrabold text-slate-900 border-b border-slate-200 pb-2.5">
          Marketplace Commission &amp; COD Configuration
        </h2>
        <div>
          <label className="block font-bold text-slate-700 mb-1">
            Standard Retail Seller Commission (%)
          </label>
          <input
            type="number"
            step="0.5"
            value={generalCfg.defaultCommissionPercent}
            onChange={(e) =>
              setGeneralCfg({ ...generalCfg, defaultCommissionPercent: Number(e.target.value) })
            }
            className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold"
          />
        </div>
        <div>
          <label className="block font-bold text-slate-700 mb-1">
            Homemade &amp; Cottage Vendor Commission (%)
          </label>
          <input
            type="number"
            step="0.5"
            value={generalCfg.homemadeCommissionPercent}
            onChange={(e) =>
              setGeneralCfg({ ...generalCfg, homemadeCommissionPercent: Number(e.target.value) })
            }
            className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold"
          />
        </div>
        <div>
          <label className="block font-bold text-slate-700 mb-1">
            Max Cash on Delivery (COD) Order Limit (LKR)
          </label>
          <input
            type="number"
            value={generalCfg.codMaxOrderLimitLkr}
            onChange={(e) =>
              setGeneralCfg({ ...generalCfg, codMaxOrderLimitLkr: Number(e.target.value) })
            }
            className="w-full px-3 py-2 rounded-lg border border-slate-300"
          />
        </div>
        <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
          <input
            type="checkbox"
            checked={generalCfg.codEnabledGlobally}
            onChange={(e) =>
              setGeneralCfg({ ...generalCfg, codEnabledGlobally: e.target.checked })
            }
            className="rounded border-slate-300"
          />
          <span>Enable Cash on Delivery (COD) Globally</span>
        </label>

        <button
          type="submit"
          className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold"
        >
          Save Commission &amp; COD Rules
        </button>
      </form>

      {/* Right: Seller Payout Reconciliation Queue (7 cols) */}
      <div className="lg:col-span-7 space-y-5">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-extrabold text-slate-900">
            Seller COD Payment Reconciliation &amp; Payout Queue
          </h2>
          <p className="text-xs text-slate-600">
            When a courier delivers a COD sub-order and remits cash, the seller&apos;s net earnings become eligible for bank payout below.
          </p>

          <div className="space-y-3 pt-2">
            {sellers
              .filter((s) => s.status === 'approved')
              .map((s) => {
                const eligibleSubs = subOrders.filter(
                  (sub) =>
                    sub.sellerId === s._id && sub.settlementStatus === 'eligible_for_payout'
                );
                const eligibleTotal = eligibleSubs.reduce(
                  (sum, sub) => sum + sub.netSellerEarningsLkr,
                  0
                );
                return (
                  <div
                    key={s._id}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{s.storeName}</div>
                      <div className="text-slate-500">
                        {s.bankDetails?.bankName} ({s.bankDetails?.accountNumber}) •{' '}
                        {eligibleSubs.length} delivered sub-order(s) ready
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-[11px] text-slate-500">Net Payable</div>
                        <div className="text-sm font-extrabold text-emerald-700">
                          {formatLkr(eligibleTotal)}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={eligibleSubs.length === 0}
                        onClick={() => handleSettleSellerPayout(s._id)}
                        className="px-3 py-2 rounded-lg bg-amber-400 hover:bg-amber-500 disabled:bg-slate-200 text-slate-950 font-bold"
                      >
                        Settle Payout
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Completed Settlements History */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-extrabold text-slate-900">
            Settled Bank Payout Ledger ({settlements.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2">Ref</th>
                  <th className="py-2">Seller</th>
                  <th className="py-2">Gross</th>
                  <th className="py-2">Commission</th>
                  <th className="py-2">Net Paid</th>
                  <th className="py-2">Bank Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {settlements.map((st) => (
                  <tr key={st._id}>
                    <td className="py-2 font-bold text-slate-900">{st.settlementReference}</td>
                    <td className="py-2">{st.sellerName}</td>
                    <td className="py-2">{formatLkr(st.grossOrderItemsLkr)}</td>
                    <td className="py-2 text-emerald-700 font-semibold">
                      +{formatLkr(st.platformCommissionLkr)}
                    </td>
                    <td className="py-2 font-extrabold text-slate-900">
                      {formatLkr(st.netPayoutLkr)}
                    </td>
                    <td className="py-2 font-mono text-slate-500">{st.bankReference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
