import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  Search,
  Download,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  User,
  Sliders,
  DollarSign,
  Package,
  Store,
  Truck,
  FileText
} from 'lucide-react';

export default function AdminAuditLogTab({ auditLogs = [] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      // Category filter
      if (selectedFilter === 'logins' && !log.action.startsWith('admin_login')) return false;
      if (selectedFilter === 'sellers' && !log.action.startsWith('seller_status')) return false;
      if (selectedFilter === 'products' && !log.action.startsWith('product_')) return false;
      if (selectedFilter === 'shipping' && !log.action.startsWith('shipping_')) return false;
      if (selectedFilter === 'payouts' && log.action !== 'seller_payout') return false;
      if (selectedFilter === 'rules' && !log.action.includes('commission')) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesAction = (log.action || '').toLowerCase().includes(q);
        const matchesDetails = (log.details || '').toLowerCase().includes(q);
        const matchesEmail = (log.adminEmail || '').toLowerCase().includes(q);
        const matchesIp = (log.ip || '').toLowerCase().includes(q);
        if (!matchesAction && !matchesDetails && !matchesEmail && !matchesIp) {
          return false;
        }
      }

      return true;
    });
  }, [auditLogs, selectedFilter, searchQuery]);

  const handleExportCsv = () => {
    if (!filteredLogs.length) return;

    const headers = ['Timestamp', 'Action', 'Admin Email', 'IP Address', 'Details'];
    const rows = filteredLogs.map((l) => [
      `"${new Date(l.timestamp).toLocaleString()}"`,
      `"${l.action}"`,
      `"${l.adminEmail || ''}"`,
      `"${l.ip || ''}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `yaans_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getActionBadge = (action) => {
    if (action === 'admin_login_success') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Login Success
        </span>
      );
    }
    if (action === 'admin_login_failed') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
          <AlertTriangle className="w-3 h-3 text-amber-600" /> Failed Login
        </span>
      );
    }
    if (action === 'admin_login_locked') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
          <XCircle className="w-3 h-3 text-red-600" /> Account Locked
        </span>
      );
    }
    if (action === 'seller_status_change') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
          <Store className="w-3 h-3 text-sky-600" /> Seller Moderation
        </span>
      );
    }
    if (action === 'product_moderation' || action === 'product_override') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
          <Package className="w-3 h-3 text-purple-600" /> Product Override
        </span>
      );
    }
    if (action === 'product_delete') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
          <XCircle className="w-3 h-3 text-red-500" /> Product Delisted
        </span>
      );
    }
    if (action.startsWith('shipping_')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
          <Truck className="w-3 h-3 text-amber-600" /> Shipping Control
        </span>
      );
    }
    if (action === 'seller_payout') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <DollarSign className="w-3 h-3 text-emerald-600" /> Bank Settlement
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
        <FileText className="w-3 h-3 text-slate-600" /> {action}
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* Top Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Security &amp; Operational Governance
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-slate-100 text-slate-800 border border-slate-300">
                {auditLogs.length} Recorded Events
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 mt-1 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-slate-800" />
              Administrative Audit Logs &amp; Security Ledger
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tracks high-privilege activities including admin portal logins, brute-force attempts, seller approvals, catalog overrides, shipping changes, and payout settlements.
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredLogs.length === 0}
            className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Export Audit Trail (CSV)
          </button>
        </div>

        {/* Filter Toolbar & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          {/* Action Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {[
              { id: 'all', label: 'All Events' },
              { id: 'logins', label: 'Logins & Security' },
              { id: 'sellers', label: 'Sellers' },
              { id: 'products', label: 'Products' },
              { id: 'shipping', label: 'Delivery Fees' },
              { id: 'payouts', label: 'Payouts' },
              { id: 'rules', label: 'Rules' }
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                  selectedFilter === f.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[240px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by action, email, IP, or details..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600 font-bold z-10">
              <tr>
                <th className="py-2.5 px-3 whitespace-nowrap">Timestamp</th>
                <th className="py-2.5 px-3">Event Type</th>
                <th className="py-2.5 px-3">Details &amp; Action Summary</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Admin User</th>
                <th className="py-2.5 px-3 whitespace-nowrap">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
                      <ShieldAlert className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-slate-800">No Audit Events Found</p>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                      {searchQuery
                        ? 'No events match your current search query or filter.'
                        : 'Administrative actions and security logins will be recorded here automatically.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id || log.timestamp} className="hover:bg-slate-50/50 transition">
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      <div className="font-semibold text-slate-800">
                        {new Date(log.timestamp).toLocaleDateString()}
                      </div>
                      <div className="text-[10px]">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">{getActionBadge(log.action)}</td>
                    <td className="py-2.5 px-3 text-slate-800 font-medium">
                      <p className="leading-snug">{log.details || log.action}</p>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                      <div className="font-bold text-slate-900">{log.adminEmail || 'admin@yaans.lk'}</div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-500">
                      {log.ip || '127.0.0.1'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
