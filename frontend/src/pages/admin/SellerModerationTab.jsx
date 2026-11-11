import React from 'react';
import { Store } from 'lucide-react';

export default function SellerModerationTab({ sellers, generalCfg, handleSellerModeration }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
      <h2 className="text-sm font-extrabold text-slate-900">
        Seller Applications, Verification &amp; Commission Overrides
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2.5">Storefront &amp; Type</th>
              <th className="py-2.5">District &amp; NIC/BR</th>
              <th className="py-2.5">Bank Account</th>
              <th className="py-2.5">Commission %</th>
              <th className="py-2.5">Status</th>
              <th className="py-2.5 text-right">Moderation Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sellers.length === 0 ? (
              <tr>
                <td colSpan="6" className="py-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
                    <Store className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-800">No Seller Applications Found</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    New seller registrations will appear here for review, district verification, and custom commission overrides.
                  </p>
                </td>
              </tr>
            ) : (
              sellers.map((s) => (
                <tr key={s._id}>
                  <td className="py-3 pr-3">
                    <div className="font-bold text-slate-900">{s.storeName}</div>
                    <div className="text-slate-500">
                      {s.sellerType} • {s.contactEmail} ({s.contactPhone})
                    </div>
                  </td>
                  <td className="py-3 pr-3">
                    <div className="font-semibold text-slate-800">
                      {s.city}, {s.district}
                    </div>
                    <div className="text-slate-500">NIC/BR: {s.nicOrBrNumber}</div>
                  </td>
                  <td className="py-3 pr-3">
                    <div className="text-slate-800">{s.bankDetails?.bankName}</div>
                    <div className="text-slate-500 font-mono">{s.bankDetails?.accountNumber}</div>
                  </td>
                  <td className="py-3 pr-3">
                    <span className="font-bold text-slate-900">
                      {s.commissionRateOverride !== null && s.commissionRateOverride !== undefined
                        ? `${s.commissionRateOverride}% (Custom)`
                        : s.isHomemadeVendor
                        ? `${generalCfg.homemadeCommissionPercent}% (Homemade)`
                        : `${generalCfg.defaultCommissionPercent}% (Default)`}
                    </span>
                  </td>
                  <td className="py-3 pr-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        s.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : s.status === 'pending'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="py-3 text-right space-x-1.5 whitespace-nowrap">
                    {s.status !== 'approved' && (
                      <button
                        type="button"
                        onClick={() =>
                          handleSellerModeration(s._id, 'approved', s.commissionRateOverride)
                        }
                        className="px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                      >
                        Approve Seller
                      </button>
                    )}
                    {s.status !== 'rejected' && (
                      <button
                        type="button"
                        onClick={() =>
                          handleSellerModeration(s._id, 'rejected', s.commissionRateOverride)
                        }
                        className="px-2.5 py-1.5 rounded border border-red-300 text-red-700 hover:bg-red-50 font-semibold"
                      >
                        Reject
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
