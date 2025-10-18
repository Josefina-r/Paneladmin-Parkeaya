import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import Home from '../sections/Home';
import Users from '../sections/Users';
import Parking from '../sections/Parking';
import Reservations from '../sections/Reservations';
import Payments from '../sections/Payments';
import Violations from '../sections/Violations';
import './Dashboard.css';

function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState(null);
  const [globalStats, setGlobalStats] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const API_BASE = 'http://localhost:8000/api';

  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
      loadGlobalStats();
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const loadGlobalStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/parking/admin/dashboard-stats/`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        setGlobalStats(data);
      }
    } catch (error) {
      console.error('Error loading global stats:', error);
    }
  };

  const handleLogout = () => {
    // Limpiar todos los datos de autenticación
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    
    // Usar window.location.href para recargar completamente la página
    // Esto asegura que App.js reevalúe la autenticación
    window.location.href = '/login';
  };

  if (!user) {
    return <div className="loading">Cargando...</div>;
  }

  return (
    <div className="dashboard">
      <Sidebar 
        isOpen={sidebarOpen} 
        currentPath={location.pathname}
        onNavigate={navigate}
        stats={globalStats}
      />
      
      <div className={`dashboard-main ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <Header 
          user={user}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onLogout={handleLogout}
          stats={globalStats}
        />
        
        <div className="dashboard-content">
          <Routes>
            <Route path="/" element={<Home stats={globalStats} />} />
            <Route path="/home" element={<Home stats={globalStats} />} />
            <Route path="/users" element={<Users />} />
            <Route path="/parking" element={<Parking />} />
            <Route path="/reservations" element={<Reservations />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/violations" element={<Violations />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;