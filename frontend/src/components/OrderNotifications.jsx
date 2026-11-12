import React, { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { apiRequest, formatLkr } from '../utils/api.js';

export default function OrderNotifications({ onViewOrders }) {
  const [inbox, setInbox] = useState({ notifications: [], unreadCount: 0 });
  const [open, setOpen] = useState(false);
  const [sound, setSound] = useState(false);
  const [error, setError] = useState('');
  const audio = useRef(null);
  const soundEnabled = useRef(false);
  const seen = useRef(new Set());
  const initialized = useRef(false);

  useEffect(() => {
    let stopped = false, timer, busy = false, failures = 0;
    async function poll() {
      if (stopped || busy || document.hidden) return;
      clearTimeout(timer);
      busy = true;
      try {
        const result = await apiRequest('/notifications');
        if (stopped) return;
        const fresh = result.notifications.some(item => !seen.current.has(item._id));
        if (initialized.current && fresh && soundEnabled.current && audio.current) {
          try {
            const context = audio.current;
            await context.resume();
            const oscillator = context.createOscillator(), gain = context.createGain();
            oscillator.connect(gain); gain.connect(context.destination);
            gain.gain.setValueAtTime(0.08, context.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.3);
            oscillator.frequency.value = 660;
            oscillator.start(); oscillator.stop(context.currentTime + 0.3);
            oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
          } catch { /* Browser audio restrictions must not block notifications. */ }
        }
        seen.current = new Set(result.notifications.map(item => item._id));
        initialized.current = true;
        setInbox(result); setError(''); failures = 0;
      } catch {
        if (!stopped) setError('Notifications are unavailable. Retrying automatically.');
        failures++;
      } finally {
        busy = false;
        if (!stopped) timer = setTimeout(poll, Math.min(30000 * 2 ** failures, 240000));
      }
    }
    const visible = () => { if (!document.hidden) poll(); };
    poll(); document.addEventListener('visibilitychange', visible);
    return () => { stopped = true; clearTimeout(timer); document.removeEventListener('visibilitychange', visible); };
  }, []);
  useEffect(() => () => { audio.current?.close().catch(() => {}); }, []);

  function toggleSound() {
    const enabled = !sound;
    if (enabled && !audio.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) { setError('Sound is unavailable in this browser.'); return; }
      try { audio.current = new AudioContext(); } catch { setError('Sound is unavailable in this browser.'); return; }
    }
    if (enabled) audio.current.resume().catch(() => {});
    soundEnabled.current = enabled; setSound(enabled);
  }
  async function view(item) {
    try {
      await apiRequest(`/notifications/${encodeURIComponent(item._id)}/read`, { method: 'POST' });
      setInbox(previous => ({ unreadCount: Math.max(0, previous.unreadCount - 1), notifications: previous.notifications.filter(n => n._id !== item._id) }));
      onViewOrders();
    } catch { setError('Unable to mark notification as read. Please try again.'); }
  }
  return <section className="bg-white border border-slate-200 rounded-xl p-4 text-sm space-y-3" aria-label="Order notifications">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <button type="button" className="flex items-center gap-2 font-bold" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        <Bell size={20} aria-hidden="true" /> Notifications <span className="rounded-full bg-sky-100 text-sky-900 px-2" aria-label={`${inbox.unreadCount} unread notifications`}>{inbox.unreadCount}</span>
      </button>
      <button type="button" aria-pressed={sound} onClick={toggleSound}>Sound: {sound ? 'on' : 'off'}</button>
    </div>
    <p role="status">{inbox.unreadCount > 0 ? `New order received — ${inbox.unreadCount} unread notification${inbox.unreadCount === 1 ? '' : 's'}.` : 'No unread order notifications.'}</p>
    {error && <p role="alert" className="text-amber-800">{error}</p>}
    {open && <ul className="space-y-3 max-h-80 overflow-y-auto">
      {inbox.notifications.map(item => <li key={item._id} className="border-t pt-3">
        <p className="font-bold">{item.orderNumber} · {formatLkr(item.totalLkr)}</p>
        <p>{item.items.map(line => `${line.title} × ${line.quantity}`).join(', ')}</p>
        <button type="button" className="text-sky-800 underline" onClick={() => view(item)}>View orders and mark as read</button>
      </li>)}
      {inbox.unreadCount > 20 && <li>Showing the latest 20. Read these to see earlier notifications.</li>}
    </ul>}
  </section>;
}
