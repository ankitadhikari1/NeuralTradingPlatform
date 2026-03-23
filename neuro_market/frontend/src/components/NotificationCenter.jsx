import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Bell, CheckCheck, Trash2, RefreshCcw, AlertTriangle } from 'lucide-react';

const NotificationCenter = ({ onClose }) => {
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [data, setData] = useState({ total: 0, unread: 0, items: [] });
  const [error, setError] = useState('');

  const fetchAll = useCallback(async () => {
    setError('');
    try {
      const [n] = await Promise.all([
        axios.get('/trading/notifications', { params: { limit: 50, offset: 0 } }),
      ]);
      setData(n.data);
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (!alive) return;
      await fetchAll();
    };
    run();
    const interval = setInterval(run, 30000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [fetchAll]);

  const markAllRead = async () => {
    setWorking(true);
    setError('');
    try {
      await axios.post('/trading/notifications/mark_all_read');
      await fetchAll();
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to mark all as read');
    } finally {
      setWorking(false);
    }
  };

  const clearAll = async () => {
    setWorking(true);
    setError('');
    try {
      await axios.delete('/trading/notifications/clear');
      await fetchAll();
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to clear notifications');
    } finally {
      setWorking(false);
    }
  };

  const items = useMemo(() => data?.items || [], [data]);

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden w-[92vw] md:w-[520px] max-h-[80vh] flex flex-col">
      <div className="p-4 border-b border-slate-700 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-blue-400" />
            <h3 className="text-lg font-black text-white uppercase tracking-wider">Notifications</h3>
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-slate-800 text-slate-300">
              {Number(data?.unread || 0)} unread
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Price targets, stop-loss triggers, volatility alerts</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-white text-xl leading-none"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="p-3 border-b border-slate-700 flex items-center justify-between gap-2 bg-slate-950/20">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={markAllRead}
            disabled={working || loading}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-black uppercase tracking-widest flex items-center gap-2"
          >
            <CheckCheck size={14} /> Mark all read
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={working || loading}
            className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-xs font-black uppercase tracking-widest text-white flex items-center gap-2"
          >
            <Trash2 size={14} /> Clear
          </button>
        </div>
        <button
          type="button"
          onClick={async () => {
            setWorking(true);
            await fetchAll();
            setWorking(false);
          }}
          disabled={working || loading}
          className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-black uppercase tracking-widest text-white flex items-center gap-2"
        >
          <RefreshCcw size={14} className={working ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error ? (
        <div className="m-4 p-4 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 text-sm flex items-start gap-3">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-bold">Notification Center Error</p>
            <p className="text-slate-300 break-words">{error}</p>
          </div>
        </div>
      ) : null}

      <div className="flex-grow overflow-y-auto">
        <div className="p-4">
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Recent Alerts</h4>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
            </div>
          ) : items.length ? (
            <div className="space-y-2">
              {items.map((n) => (
                <div key={n.id} className={`p-4 rounded-xl border ${n.read_at ? 'border-slate-800 bg-slate-950/30' : 'border-blue-500/30 bg-blue-500/10'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{n.title}</p>
                      <p className="text-xs text-slate-300 mt-1 break-words">{n.message}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-2">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                    {!n.read_at ? <span className="h-2 w-2 rounded-full bg-blue-500 mt-1.5 shrink-0" /> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center text-slate-500">
              No notifications yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationCenter;
