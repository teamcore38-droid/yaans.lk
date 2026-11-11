import React from 'react';
import { AlertTriangle, RefreshCw, Home, ShieldAlert } from 'lucide-react';

/**
 * Enterprise React Error Boundary
 * Catches unhandled JavaScript exceptions in child components and prevents blank white screens.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // In production, errors can also be reported to an observability service (e.g., Sentry, LogRocket, Datadog)
    console.error('ErrorBoundary caught an unhandled rendering error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback({
              error: this.state.error,
              reset: this.handleReset,
              reload: this.handleReload
            })
          : this.props.fallback;
      }

      return (
        <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
          <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-7 text-center space-y-4 shadow-sm">
            <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h1 className="text-base sm:text-lg font-extrabold text-slate-900">
                {this.props.title || 'Something went wrong'}
              </h1>
              <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                {this.props.message ||
                  'An unexpected rendering issue occurred in this section. Your account session, data, and orders remain completely safe.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reload Page
              </button>
              <a
                href="/"
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs inline-flex items-center gap-1.5 transition"
              >
                <Home className="w-3.5 h-3.5" />
                Back to Storefront
              </a>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
              <span>Session protected by Yaans.lk fault tolerance</span>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
