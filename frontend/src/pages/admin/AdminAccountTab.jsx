import React, { useState, useEffect } from 'react';
import { ShieldCheck } from 'lucide-react';
import { apiRequest } from '../../utils/api.js';

export default function AdminAccountTab({ user, refreshUser, showToast }) {
  const [adminProfileForm, setAdminProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    currentPasswordForEmail: ''
  });
  const [adminPasswordForm, setAdminPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [savingAdminProfile, setSavingAdminProfile] = useState(false);
  const [savingAdminPassword, setSavingAdminPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setAdminProfileForm((prev) => ({
        ...prev,
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || ''
      }));
    }
  }, [user]);

  const handleUpdateAdminProfile = async (e) => {
    e.preventDefault();
    try {
      setSavingAdminProfile(true);
      const isEmailChanging =
        adminProfileForm.email.toLowerCase().trim() !== (user.email || '').toLowerCase().trim();
      if (isEmailChanging && !adminProfileForm.currentPasswordForEmail) {
        showToast('Please enter your current password to confirm email/username change.', 'error');
        return;
      }
      const res = await apiRequest('/auth/update-credentials', {
        method: 'PUT',
        body: JSON.stringify({
          newName: adminProfileForm.name,
          newEmail: adminProfileForm.email,
          newPhone: adminProfileForm.phone,
          currentPassword: adminProfileForm.currentPasswordForEmail || undefined
        })
      });
      localStorage.setItem('yaans_token', res.token);
      localStorage.setItem('yaans_user', JSON.stringify(res.user));
      await refreshUser();
      setAdminProfileForm((prev) => ({ ...prev, currentPasswordForEmail: '' }));
      showToast('Admin profile and username updated successfully!');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingAdminProfile(false);
    }
  };

  const handleUpdateAdminPassword = async (e) => {
    e.preventDefault();
    if (adminPasswordForm.newPassword !== adminPasswordForm.confirmPassword) {
      showToast('New passwords do not match.', 'error');
      return;
    }
    if (adminPasswordForm.newPassword.length < 6) {
      showToast('New password must be at least 6 characters.', 'error');
      return;
    }
    try {
      setSavingAdminPassword(true);
      const res = await apiRequest('/auth/update-credentials', {
        method: 'PUT',
        body: JSON.stringify({
          currentPassword: adminPasswordForm.currentPassword,
          newPassword: adminPasswordForm.newPassword
        })
      });
      localStorage.setItem('yaans_token', res.token);
      localStorage.setItem('yaans_user', JSON.stringify(res.user));
      await refreshUser();
      setAdminPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showToast('Admin password changed successfully!');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingAdminPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Admin Identity Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-sky-400" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Yaans.lk Master Administrator Account
              </h2>
              <p className="text-xs text-slate-500">
                Highest administrative authority on Yaans.lk marketplace
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-sky-100 text-sky-900 text-xs font-extrabold uppercase tracking-wide">
            Active Super Admin
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 block text-[11px]">Admin Identifier</span>
            <span className="font-mono font-bold text-slate-900">{user.id || user._id}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 block text-[11px]">Current Username / Email</span>
            <span className="font-bold text-slate-900">{user.email}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 block text-[11px]">Display Name</span>
            <span className="font-bold text-slate-900">{user.name}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 block text-[11px]">Contact Phone</span>
            <span className="font-bold text-slate-900">{user.phone || '0771002000'}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Update Username & Profile Form */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">
              Update Admin Username &amp; Contact Info
            </h3>
            <p className="text-xs text-slate-500">
              Change the admin login email / username or phone number
            </p>
          </div>

          <form onSubmit={handleUpdateAdminProfile} className="space-y-3.5 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Admin Display Name</label>
              <input
                type="text"
                required
                value={adminProfileForm.name}
                onChange={(e) => setAdminProfileForm({ ...adminProfileForm, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Admin Username / Email Address
              </label>
              <input
                type="email"
                required
                value={adminProfileForm.email}
                onChange={(e) => setAdminProfileForm({ ...adminProfileForm, email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Contact Phone</label>
              <input
                type="tel"
                value={adminProfileForm.phone}
                onChange={(e) => setAdminProfileForm({ ...adminProfileForm, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            {adminProfileForm.email.toLowerCase().trim() !== (user.email || '').toLowerCase().trim() && (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-1">
                <label className="block font-bold text-amber-900 text-xs">
                  Enter Current Password to Confirm Email Change
                </label>
                <input
                  type="password"
                  required
                  value={adminProfileForm.currentPasswordForEmail}
                  onChange={(e) =>
                    setAdminProfileForm({
                      ...adminProfileForm,
                      currentPasswordForEmail: e.target.value
                    })
                  }
                  placeholder="Current password"
                  className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-white"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={savingAdminProfile}
              className="px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition disabled:opacity-50"
            >
              {savingAdminProfile ? 'Saving Details...' : 'Save Profile Changes'}
            </button>
          </form>
        </div>

        {/* Change Password Form */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">
              Change Admin Password
            </h3>
            <p className="text-xs text-slate-500">
              Update your secret administrator password for portal security
            </p>
          </div>

          <form onSubmit={handleUpdateAdminPassword} className="space-y-3.5 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Current Password *</label>
              <input
                type="password"
                required
                value={adminPasswordForm.currentPassword}
                onChange={(e) =>
                  setAdminPasswordForm({ ...adminPasswordForm, currentPassword: e.target.value })
                }
                placeholder="••••••••"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">New Password *</label>
              <input
                type="password"
                required
                minLength={6}
                value={adminPasswordForm.newPassword}
                onChange={(e) =>
                  setAdminPasswordForm({ ...adminPasswordForm, newPassword: e.target.value })
                }
                placeholder="Minimum 6 characters"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Confirm New Password *</label>
              <input
                type="password"
                required
                minLength={6}
                value={adminPasswordForm.confirmPassword}
                onChange={(e) =>
                  setAdminPasswordForm({
                    ...adminPasswordForm,
                    confirmPassword: e.target.value
                  })
                }
                placeholder="Repeat new password"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <button
              type="submit"
              disabled={savingAdminPassword}
              className="px-5 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-950 font-extrabold text-xs shadow-sm transition disabled:opacity-50"
            >
              {savingAdminPassword ? 'Updating Password...' : 'Update Admin Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
