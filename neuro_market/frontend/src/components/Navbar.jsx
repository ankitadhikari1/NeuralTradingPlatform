import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Wallet, History, BarChart3, Camera, CameraOff, LogOut, TrendingUp, UserCog, Menu, X } from 'lucide-react';
import { useEmotion } from '../context/EmotionContext';

const Navbar = ({ user, onLogout }) => {
  const location = useLocation();
  const { active, wsStatus, wsCloseInfo, start, stop, emotion } = useEmotion();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const primaryNavItems = useMemo(
    () => [
      { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { name: 'Practice', path: '/practice', icon: BarChart3 },
    ],
    []
  );

  const menuNavItems = useMemo(
    () => [
      { name: 'Portfolio', path: '/portfolio', icon: Wallet },
      { name: 'Trades', path: '/history', icon: History },
      { name: 'Sessions', path: '/sessions', icon: History },
      { name: 'Leaderboard', path: '/leaderboard', icon: TrendingUp },
      { name: 'Monitor', path: '/monitor', icon: Camera },
      { name: 'Analytics', path: '/analytics', icon: BarChart3 },
      ...(user?.is_admin ? [{ name: 'Admin', path: '/admin', icon: UserCog }] : []),
    ],
    [user?.is_admin]
  );

  const initials = (user?.username || 'U')
    .trim()
    .slice(0, 2)
    .toUpperCase();

  return (
    <nav className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/dashboard" className="flex items-center gap-2 text-xl font-bold text-blue-500">
            <TrendingUp size={28} />
            <span>NeuroMarket <span className="text-slate-100 font-light">Lite</span></span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {primaryNavItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  location.pathname === item.path
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                <item.icon size={18} />
                <span>{item.name}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className={`p-2 rounded-lg transition-colors border ${
              menuOpen ? 'text-white border-slate-600 bg-slate-700' : 'text-slate-300 border-slate-600/40 bg-slate-700/30 hover:bg-slate-700/60'
            }`}
            title="Menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-[60]">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute top-16 right-4 left-4 md:left-auto md:w-96">
            <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-100 font-semibold">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{user.username}</p>
                    <p className="text-xs text-slate-400 truncate">{user.email}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Cash balance</span>
                  <span className="text-emerald-400 font-mono">${Number(user.cash_balance || 0).toLocaleString()}</span>
                </div>
              </div>

              <div className="p-2">
                {menuNavItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      location.pathname === item.path
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-200 hover:bg-slate-700/60'
                    }`}
                  >
                    <item.icon size={18} className={location.pathname === item.path ? 'text-blue-300' : 'text-slate-300'} />
                    <span className="text-sm">{item.name}</span>
                  </Link>
                ))}
              </div>

              <div className="p-2 border-t border-slate-700">
                <button
                  type="button"
                  onClick={active ? stop : start}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-700/60 transition-colors"
                  title={
                    active
                      ? `Monitoring ON • ${emotion.state} • WS:${wsStatus}${wsStatus === 'closed' && wsCloseInfo?.code ? ` (${wsCloseInfo.code}${wsCloseInfo.reason ? `:${wsCloseInfo.reason}` : ''})` : ''}`
                      : 'Start emotion monitoring'
                  }
                >
                  <div className="flex items-center gap-3">
                    {active ? <CameraOff size={18} className="text-emerald-300" /> : <Camera size={18} className="text-slate-300" />}
                    <span className="text-sm">Emotion monitoring</span>
                  </div>
                  <span className={`text-xs font-medium ${active ? 'text-emerald-300' : 'text-slate-400'}`}>
                    {active ? 'On' : 'Off'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onLogout}
                  className="w-full mt-1 flex items-center gap-3 px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-700/60 transition-colors"
                >
                  <LogOut size={18} className="text-rose-300" />
                  <span className="text-sm">Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
