import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User,
  Store,
  ShieldCheck,
  MapPin,
  Plus,
  Trash2,
  Package,
  Heart,
  CheckCircle2
} from 'lucide-react';
import { apiRequest, formatLkr } from '../utils/api.js';
import { useMarketplace, DEFAULT_SL_DISTRICTS } from '../context/MarketplaceContext.jsx';
import ProductCard from '../components/ProductCard.jsx';

export function LoginPage() {
  const { login, showToast } = useMarketplace();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const loggedUser = await login(email, password);
      const searchParams = new URLSearchParams(window.location.search);
      const redirect = searchParams.get('redirect');

      if (redirect && redirect.startsWith('/')) {
        navigate(redirect);
      } else if (loggedUser.role === 'admin') {
        navigate('/admin');
      } else if (loggedUser.role === 'seller') {
        navigate('/seller/dashboard');
      } else {
        navigate('/account');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-10 space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">
        <div className="text-center">
          <img
            src="/brand/yaans-logo-horizontal-dark.png"
            alt="Yaans.lk"
            className="h-10 mx-auto object-contain mb-2"
          />
          <h1 className="text-lg font-extrabold text-slate-900">Sign In to Yaans.lk</h1>
          <p className="text-xs text-slate-500">
            Enter your credentials to access your isolated account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Email Address / Username</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.lk"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-950 font-extrabold text-xs sm:text-sm shadow-sm transition"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-xs">
          <Link to="/register" className="font-bold text-sky-700 hover:underline">
            Create Customer Account
          </Link>
          <Link to="/seller/register" className="font-bold text-slate-800 hover:underline">
            Apply as a Seller →
          </Link>
        </div>
      </div>
    </div>
  );
}

export function RegisterCustomerPage() {
  const { registerCustomer, showToast } = useMarketplace();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [defaultDistrict, setDefaultDistrict] = useState('Colombo');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await registerCustomer({ name, email, phone, defaultDistrict, password });
      navigate('/');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h1 className="text-lg font-extrabold text-slate-900">Create Your Yaans.lk Account</h1>
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Dilshan Silva"
              className="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Sri Lankan Mobile Number *</label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="077 123 4567"
              className="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Email Address *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="dilshan@example.com"
              className="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Your District (Sri Lanka)</label>
            <select
              value={defaultDistrict}
              onChange={(e) => setDefaultDistrict(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
            >
              {DEFAULT_SL_DISTRICTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Password *</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-950 font-extrabold text-xs sm:text-sm"
          >
            {loading ? 'Creating Account...' : 'Create Customer Account'}
          </button>
        </form>
        <div className="text-xs text-center text-slate-600 pt-2 border-t border-slate-100">
          Already have an account?{' '}
          <Link to="/login" className="text-sky-700 font-bold hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export function SellerRegisterPage() {
  const { registerSeller, showToast } = useMarketplace();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    storeName: '',
    sellerType: 'Homemade & Cottage',
    district: 'Kandy',
    city: '',
    businessAddress: '',
    nicOrBrNumber: '',
    description: '',
    bankName: 'Sampath Bank',
    branchName: '',
    accountHolderName: '',
    accountNumber: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await registerSeller(form);
      navigate('/seller/dashboard');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-6 py-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-8 shadow-sm space-y-6">
        <div className="border-b border-slate-200 pb-4">
          <span className="px-2.5 py-0.5 rounded bg-amber-100 text-amber-900 text-xs font-bold">
            Yaans.lk Seller Onboarding
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
            Become a Verified Sri Lankan Marketplace Seller
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Whether you make homemade food & spices from home, craft handloom/pottery, or run an electronics store — sell across all 25 Sri Lankan districts with automated COD courier calculation.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Owner Full Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Malini Rajapaksha"
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Mobile / WhatsApp Number *</label>
              <input
                type="tel"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="e.g., 071 456 7890"
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Business Login Email *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="store@example.lk"
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Account Password *</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Create a strong password"
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Storefront Name *</label>
              <input
                type="text"
                required
                value={form.storeName}
                onChange={(e) => setForm({ ...form, storeName: e.target.value })}
                placeholder="e.g., Matara Cinnamon & Sweet Kitchen"
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Seller Category Type *</label>
              <select
                value={form.sellerType}
                onChange={(e) => setForm({ ...form, sellerType: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
              >
                <option value="Homemade & Cottage">Homemade & Cottage Producer (5% Commission)</option>
                <option value="Artisan & Craft">Artisan, Pottery & Handloom (6% Commission)</option>
                <option value="Small Business">Small Business (8% Standard Commission)</option>
                <option value="Verified Retail Vendor">Verified Retail / Electronics Vendor (8% Commission)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Origin District (For Courier Calculation) *
              </label>
              <select
                value={form.district}
                onChange={(e) => setForm({ ...form, district: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
              >
                {DEFAULT_SL_DISTRICTS.map((d) => (
                  <option key={d} value={d}>{d} District</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Town / Pickup City *</label>
              <input
                type="text"
                required
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="e.g., Peradeniya / Nugegoda / Nallur"
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Sri Lankan NIC Number or BR Number *
              </label>
              <input
                type="text"
                required
                value={form.nicOrBrNumber}
                onChange={(e) => setForm({ ...form, nicOrBrNumber: e.target.value })}
                placeholder="e.g., 199012345678 or PV-0012345"
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Pickup Address *</label>
              <input
                type="text"
                required
                value={form.businessAddress}
                onChange={(e) => setForm({ ...form, businessAddress: e.target.value })}
                placeholder="Full street address for courier pickup"
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">
                Store Description & Specialties
              </label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Tell customers about your homemade recipes, craftsmanship, or product range..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Sri Lankan Bank (For Payouts)</label>
              <select
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
              >
                <option value="Bank of Ceylon (BOC)">Bank of Ceylon (BOC)</option>
                <option value="Sampath Bank">Sampath Bank</option>
                <option value="Commercial Bank of Ceylon">Commercial Bank of Ceylon</option>
                <option value="Hatton National Bank (HNB)">Hatton National Bank (HNB)</option>
                <option value="Peoples Bank">People&apos;s Bank</option>
                <option value="Nations Trust Bank">Nations Trust Bank</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Branch Name</label>
              <input
                type="text"
                value={form.branchName}
                onChange={(e) => setForm({ ...form, branchName: e.target.value })}
                placeholder="e.g., Kandy City Branch"
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Bank Account Number</label>
              <input
                type="text"
                value={form.accountNumber}
                onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                placeholder="e.g., 102944819201"
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-sm"
          >
            {submitting ? 'Submitting Seller Application...' : 'Submit Seller Application'}
          </button>
        </form>
      </div>
    </div>
  );
}

export function CustomerAccountPage() {
  const { user, refreshUser, showToast } = useMarketplace();
  const [orders, setOrders] = useState([]);
  const [addrForm, setAddrForm] = useState({
    label: 'Home',
    recipientName: user?.name || '',
    phone: user?.phone || '',
    addressLine1: '',
    city: '',
    district: user?.defaultDistrict || 'Colombo',
    postalCode: ''
  });
  const [custProfile, setCustProfile] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    defaultDistrict: user?.defaultDistrict || 'Colombo'
  });
  const [custPasswordForm, setCustPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [savingCustProfile, setSavingCustProfile] = useState(false);
  const [savingCustPassword, setSavingCustPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setCustProfile({
        name: user.name || '',
        phone: user.phone || '',
        defaultDistrict: user.defaultDistrict || 'Colombo'
      });
      apiRequest('/orders/my-orders')
        .then((res) => setOrders(res.orders || []))
        .catch(() => {});
    }
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 space-y-4 shadow-sm">
          <User className="w-10 h-10 text-slate-700 mx-auto" />
          <h1 className="text-base font-extrabold text-slate-900">Please sign in to view your account</h1>
          <p className="text-xs text-slate-500">Access your order history, delivery addresses and personal settings</p>
          <Link
            to="/login?redirect=/account"
            className="inline-block px-5 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs"
          >
            Sign In to Your Account
          </Link>
        </div>
      </div>
    );
  }

  const handleUpdateCustProfile = async (e) => {
    e.preventDefault();
    try {
      setSavingCustProfile(true);
      await apiRequest('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(custProfile)
      });
      await refreshUser();
      showToast('Profile settings updated!');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingCustProfile(false);
    }
  };

  const handleUpdateCustPassword = async (e) => {
    e.preventDefault();
    if (custPasswordForm.newPassword !== custPasswordForm.confirmPassword) {
      showToast('New passwords do not match.', 'error');
      return;
    }
    if (custPasswordForm.newPassword.length < 6) {
      showToast('Password must be at least 6 characters.', 'error');
      return;
    }
    try {
      setSavingCustPassword(true);
      await apiRequest('/auth/update-credentials', {
        method: 'PUT',
        body: JSON.stringify({
          currentPassword: custPasswordForm.currentPassword,
          newPassword: custPasswordForm.newPassword
        })
      });
      setCustPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showToast('Password changed successfully!');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingCustPassword(false);
    }
  };

  const handleAddAddress = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/auth/addresses', {
        method: 'POST',
        body: JSON.stringify(addrForm)
      });
      await refreshUser();
      setAddrForm({ ...addrForm, addressLine1: '', city: '', postalCode: '' });
      showToast('Sri Lankan delivery address saved!');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteAddress = async (id) => {
    try {
      await apiRequest(`/auth/addresses/${id}`, { method: 'DELETE' });
      await refreshUser();
      showToast('Address removed');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5 space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900">{user.name}</h1>
          <p className="text-xs text-slate-600">
            {user.email} • {user.phone} • Default District: <strong>{user.defaultDistrict}</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {user.role === 'seller' && (
            <Link
              to="/seller/dashboard"
              className="px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold"
            >
              Open Seller Portal
            </Link>
          )}
          {user.role === 'admin' && (
            <Link
              to="/admin"
              className="px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold"
            >
              Open Admin Dashboard
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Saved Sri Lankan Addresses */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-extrabold text-slate-900">
            Saved Sri Lankan Delivery Addresses
          </h2>
          <div className="space-y-2.5">
            {(user.addresses || []).map((a) => (
              <div
                key={a._id}
                className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-start justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900">
                    {a.label} — {a.district} District
                  </div>
                  <div className="text-slate-600">
                    {a.recipientName} ({a.phone})
                  </div>
                  <div className="text-slate-500">
                    {a.addressLine1}, {a.city}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteAddress(a._id)}
                  className="text-slate-400 hover:text-red-600 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddAddress} className="space-y-2.5 pt-3 border-t border-slate-200 text-xs">
            <div className="font-bold text-slate-800">Add New Delivery Address</div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                required
                placeholder="Recipient Name"
                value={addrForm.recipientName}
                onChange={(e) => setAddrForm({ ...addrForm, recipientName: e.target.value })}
                className="px-2.5 py-1.5 rounded border border-slate-300"
              />
              <input
                type="text"
                required
                placeholder="07X Phone"
                value={addrForm.phone}
                onChange={(e) => setAddrForm({ ...addrForm, phone: e.target.value })}
                className="px-2.5 py-1.5 rounded border border-slate-300"
              />
            </div>
            <input
              type="text"
              required
              placeholder="Street Address / Lane"
              value={addrForm.addressLine1}
              onChange={(e) => setAddrForm({ ...addrForm, addressLine1: e.target.value })}
              className="w-full px-2.5 py-1.5 rounded border border-slate-300"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                required
                placeholder="Town / City"
                value={addrForm.city}
                onChange={(e) => setAddrForm({ ...addrForm, city: e.target.value })}
                className="px-2.5 py-1.5 rounded border border-slate-300"
              />
              <select
                value={addrForm.district}
                onChange={(e) => setAddrForm({ ...addrForm, district: e.target.value })}
                className="px-2.5 py-1.5 rounded border border-slate-300 bg-white font-semibold"
              >
                {DEFAULT_SL_DISTRICTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-slate-900 text-white font-bold text-xs"
            >
              Save Address
            </button>
          </form>

          {/* Account Security & Password */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Account Security & Password
            </h3>
            <form onSubmit={handleUpdateCustPassword} className="space-y-2 text-xs">
              <input
                type="password"
                required
                placeholder="Current password"
                value={custPasswordForm.currentPassword}
                onChange={(e) =>
                  setCustPasswordForm({ ...custPasswordForm, currentPassword: e.target.value })
                }
                className="w-full px-2.5 py-1.5 rounded border border-slate-300"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="password"
                  required
                  placeholder="New password (min 6)"
                  value={custPasswordForm.newPassword}
                  onChange={(e) =>
                    setCustPasswordForm({ ...custPasswordForm, newPassword: e.target.value })
                  }
                  className="px-2.5 py-1.5 rounded border border-slate-300"
                />
                <input
                  type="password"
                  required
                  placeholder="Confirm password"
                  value={custPasswordForm.confirmPassword}
                  onChange={(e) =>
                    setCustPasswordForm({ ...custPasswordForm, confirmPassword: e.target.value })
                  }
                  className="px-2.5 py-1.5 rounded border border-slate-300"
                />
              </div>
              <button
                type="submit"
                disabled={savingCustPassword}
                className="w-full py-2 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs disabled:opacity-50"
              >
                {savingCustPassword ? 'Updating...' : 'Change Password'}
              </button>
            </form>
          </div>
        </div>

        {/* Customer Orders */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-extrabold text-slate-900">Your Orders ({orders.length})</h2>
          {orders.length === 0 ? (
            <p className="text-xs text-slate-500">No orders placed yet.</p>
          ) : (
            <div className="space-y-3">
              {orders.map((ord) => (
                <div
                  key={ord._id}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-extrabold text-slate-900 text-sm">
                      Order #{ord.orderNumber}
                    </span>
                    <span className="font-bold text-slate-900">
                      {formatLkr(ord.grandTotalLkr)} ({ord.paymentMethod})
                    </span>
                  </div>
                  <div className="text-slate-600">
                    Split into <strong>{ord.subOrders?.length || ord.sellerCount} seller package(s)</strong> • Status:{' '}
                    <strong className="uppercase">{ord.overallStatus?.replace(/_/g, ' ')}</strong>
                  </div>
                  <Link
                    to={`/track-order?orderNumber=${ord.orderNumber}`}
                    className="inline-block text-sky-700 font-bold hover:underline"
                  >
                    Inspect Seller Packages & Tracking →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function WishlistPage() {
  const { wishlistIds } = useMarketplace();
  const [products, setProducts] = useState([]);

  useEffect(() => {
    apiRequest('/marketplace/products?limit=48')
      .then((res) => {
        const all = res.products || [];
        setProducts(all.filter((p) => wishlistIds.includes(p._id)));
      })
      .catch(() => {});
  }, [wishlistIds]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5 space-y-4">
      <h1 className="text-lg sm:text-xl font-extrabold text-slate-900">
        Saved Wishlist ({products.length})
      </h1>
      {products.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-3">
          <p className="text-xs text-slate-600">No products saved in your wishlist yet.</p>
          <Link
            to="/products"
            className="inline-block px-4 py-2 rounded-lg bg-amber-400 text-slate-950 font-bold text-xs"
          >
            Explore Products
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((p) => (
            <ProductCard key={p._id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
