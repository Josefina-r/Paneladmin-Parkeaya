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
  const [dashboardData, setDashboardData] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const API_BASE = 'http://localhost:8000/api';

  // ✅ CORRECCIÓN: Usar JWT Bearer token
  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    console.log('🔐 JWT Token encontrado:', token ? 'Sí' : 'No');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}` // ← JWT usa Bearer
    };
  };

  useEffect(() => {
    console.log('=== 🔍 DEBUG COMPLETO DEL LOCALSTORAGE ===');
    console.log('access_token:', localStorage.getItem('access_token'));
    console.log('refresh_token:', localStorage.getItem('refresh_token'));
    console.log('user:', localStorage.getItem('user'));
    
    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('access_token');
    
    console.log('Verificando autenticación:', { 
      userData: userData ? 'Presente' : 'Faltante',
      token: token ? 'Presente' : 'Faltante'
    });

    if (userData && token) {
      setUser(JSON.parse(userData));
      loadDashboardData();
    } else {
      console.log('❌ Redirigiendo a login - falta token o usuario');
      navigate('/login');
    }
  }, [navigate]);

  const loadDashboardData = async () => {
    try {
      console.log('🔄 Cargando datos del dashboard con JWT...');
      
      // PRIMERO: Verificar autenticación con endpoint de usuarios
      console.log('🔐 Testeando autenticación JWT con /users/users/');
      const authTest = await fetch(`${API_BASE}/users/users/`, {
        headers: getAuthHeaders()
      });
      
      console.log('👤 Auth test status:', authTest.status);
      
      if (authTest.ok) {
        console.log('✅ Autenticación JWT confirmada, cargando dashboard...');
        
        // Ahora cargar dashboard
        const response = await fetch(`${API_BASE}/parking/dashboard/data/`, {
          method: 'GET',
          headers: getAuthHeaders()
        });

        console.log('📊 Dashboard response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ Datos del dashboard recibidos:', data);
          setDashboardData(data);
          
          if (data.stats) {
            setGlobalStats({
              totalUsers: data.stats.total_users || 0,
              availableParkings: data.stats.active_parkings || 0,
              totalRevenue: data.stats.today_revenue || 0,
              activeReservations: data.stats.active_reservations || 0
            });
          }
        } else if (response.status === 401) {
          console.error('❌ Error 401 - JWT token inválido o expirado');
          handleAuthError();
        } else {
          console.error('❌ Error loading dashboard:', response.status);
          await loadGlobalStats(); // Fallback
        }
      } else {
        console.error('❌ Auth test failed:', authTest.status);
        handleAuthError();
      }
    } catch (error) {
      console.error('💥 Error loading dashboard data:', error);
      await loadGlobalStats(); // Fallback
    }
  };

  const loadGlobalStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/parking/admin/dashboard-stats/`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        setGlobalStats(data);
      } else if (response.status === 401) {
        handleAuthError();
      }
    } catch (error) {
      console.error('💥 Error loading global stats:', error);
    }
  };

  const handleAuthError = () => {
    console.log('🔐 Error de autenticación JWT, limpiando datos...');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
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
        userRole={dashboardData?.user?.role}
      />
      
      <div className={`dashboard-main ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <Header 
          user={user}
          dashboardData={dashboardData}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onLogout={handleLogout}
          stats={globalStats}
        />
        
        <div className="dashboard-content">
          <Routes>
            <Route 
              path="/" 
              element={<Home stats={globalStats} dashboardData={dashboardData} />} 
            />
            <Route 
              path="/home" 
              element={<Home stats={globalStats} dashboardData={dashboardData} />} 
            />
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