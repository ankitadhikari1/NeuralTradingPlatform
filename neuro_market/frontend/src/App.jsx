import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Portfolio from './pages/Portfolio';
import TradeHistory from './pages/TradeHistory';
import StockDetail from './pages/StockDetail';
import Analytics from './pages/Analytics';
import EmotionMonitor from './pages/EmotionMonitor';
import Admin from './pages/Admin';
import DatabaseExplorer from './pages/DatabaseExplorer';
import Practice from './pages/Practice';
import SessionHistory from './pages/SessionHistory';
import SessionDetail from './pages/SessionDetail';
import Leaderboard from './pages/Leaderboard';
import Navbar from './components/Navbar';
import FloatingRuleTester from './components/FloatingRuleTester';
import CameraOverlay from './components/CameraOverlay';
import MonitoringShortcut from './components/MonitoringShortcut';
import axios from 'axios';

// Configure axios
axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
axios.defaults.timeout = 10000;

const ProtectedRoute = ({ user, children }) => {
  if (!user) return <Navigate to="/login" />;
  return children;
};

const AdminRoute = ({ user, children }) => {
  if (!user) return <Navigate to="/login" />;
  if (!user.is_admin) return <Navigate to="/dashboard" />;
  return children;
};

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchCurrentUser = useCallback(async () => {
    try {
      const response = await axios.get('/auth/me');
      setUser(response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch user:', error);
      // Only clear token if we specifically got a 401
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchCurrentUser();
    } else {
      setLoading(false);
    }
  }, [fetchCurrentUser]);

  const handleLogin = useCallback((token, userData) => {
    localStorage.setItem('token', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(userData);
    navigate('/dashboard', { replace: true });
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {user && <Navbar user={user} onLogout={handleLogout} />}
      <main className="flex-grow container mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />
          <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login onLogin={handleLogin} />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<ProtectedRoute user={user}><Dashboard onRefreshUser={fetchCurrentUser} /></ProtectedRoute>} />
          <Route path="/portfolio" element={<ProtectedRoute user={user}><Portfolio onRefreshUser={fetchCurrentUser} /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute user={user}><TradeHistory /></ProtectedRoute>} />
          <Route path="/stock/:symbol" element={<ProtectedRoute user={user}><StockDetail onRefreshUser={fetchCurrentUser} /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute user={user}><Analytics /></ProtectedRoute>} />
          <Route path="/monitor" element={<ProtectedRoute user={user}><EmotionMonitor /></ProtectedRoute>} />
          <Route path="/practice" element={<ProtectedRoute user={user}><Practice /></ProtectedRoute>} />
          <Route path="/sessions" element={<ProtectedRoute user={user}><SessionHistory /></ProtectedRoute>} />
          <Route path="/sessions/:id" element={<ProtectedRoute user={user}><SessionDetail /></ProtectedRoute>} />
          <Route path="/leaderboard" element={<ProtectedRoute user={user}><Leaderboard /></ProtectedRoute>} />
          <Route path="/admin" element={<AdminRoute user={user}><Admin onRefreshUser={fetchCurrentUser} /></AdminRoute>} />
          <Route path="/admin/explorer" element={<AdminRoute user={user}><DatabaseExplorer /></AdminRoute>} />
        </Routes>
      </main>
      {user && <CameraOverlay />}
      {user && <FloatingRuleTester />}
      {user && <MonitoringShortcut />}
    </div>
  );
}

export default App;
