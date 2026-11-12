import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, Lock, Key, AlertTriangle, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext.jsx';

export default function AdminLoginPage() {
  const { user, adminLogin, logout, showToast } = useMarketplace();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [challengeToken,setChallengeToken]=useState('');
  const [code,setCode]=useState('');

  useEffect(() => {
    if (user?.role === 'admin') {
      navigate('/admin', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password;

    if (!challengeToken && (!cleanEmail || !cleanPassword)) {
      const msg = 'Please enter both administrator email and password.';
      setErrorMsg(msg);
      showToast(msg, 'error');
      return;
    }

    try {
      setLoading(true);
      const result=await adminLogin(cleanEmail, cleanPassword,challengeToken,code.trim());
      if(result?.requiresMfa){setChallengeToken(result.challengeToken);setPassword('');return;}
      navigate('/admin', { replace: true });
    } catch (err) {
      const msg = err.message || 'Invalid administrator credentials.';
      setErrorMsg(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[82vh] flex items-center justify-center px-4 py-10 bg-slate-950 text-white">
      <div className="w-full max-w-md space-y-6">
        {/* Top Security Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-300 text-[11px] font-bold tracking-wider uppercase">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
            Restricted Platform Governance Portal
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            Yaans.lk Admin Console
          </h1>
          <p className="text-xs text-slate-400">
            Dedicated authentication gateway for authorized Marketplace Administrators only.
          </p>
        </div>

        {/* Non-admin logged-in notice */}
        {user && user.role !== 'admin' && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4 text-xs text-amber-200 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-amber-100">
                  Active Storefront Session Detected
                </div>
                <p className="text-amber-200/80 mt-0.5">
                  You are signed in as <strong>{user.name}</strong> ({user.role}). Signing in below will switch your session to the Admin Console.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={logout}
                className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 font-bold text-[11px] transition"
              >
                Sign Out Current Session
              </button>
            </div>
          </div>
        )}

        {/* Main Login Card */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 sm:p-7 shadow-2xl space-y-5">
          {errorMsg && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3.5 flex items-start gap-2.5 text-xs text-red-200">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {!challengeToken && <div>
              <label className="block font-bold text-slate-300 mb-1.5">
                Administrator Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@yaans.lk"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>
            </div>}

            {!challengeToken && <div>
              <label className="block font-bold text-slate-300 mb-1.5">
                Administrator Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>}
            {challengeToken && <div>
              <label htmlFor="admin-otp" className="block font-bold text-slate-300 mb-1.5">Authenticator or recovery code</label>
              <input id="admin-otp" autoComplete="one-time-code" required value={code} onChange={event=>setCode(event.target.value)} maxLength={32}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white" />
              <p className="mt-2 text-slate-400">Enter the current code from your authenticator, or one unused recovery code.</p>
              <button type="button" onClick={()=>{setChallengeToken('');setCode('');}} className="mt-2 underline">Start sign-in again</button>
            </div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-950 font-extrabold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              {loading ? 'Verifying Administrator Access...' : 'Sign In to Admin Console'}
            </button>
          </form>

          {/* Security Indicators */}
          <div className="pt-4 border-t border-slate-800 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>1-Hour Scoped Session</span>
            </div>
            <div className="flex items-center gap-1.5 justify-end">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>5-Attempt Lockout Active</span>
            </div>
          </div>
        </div>

        {/* Back to Storefront */}
        <div className="text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Return to Public Storefront
          </Link>
        </div>
      </div>
    </div>
  );
}
