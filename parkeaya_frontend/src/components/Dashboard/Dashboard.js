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
      const response = await fetch(`${API_BASE}/dashboard/stats/`, {
        headers: getAuthHeaders()
      });
      
      console.log('Dashboard stats response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Dashboard stats data:', data);
        
        // TRANSFORMAR LOS DATOS al formato que espera tu frontend
        const transformedStats = transformStatsData(data);
        setGlobalStats(transformedStats);
      } else {
        console.error('Error response:', response.status, response.statusText);
        setGlobalStats(getDefaultStats());
      }
    } catch (error) {
      console.error('Error loading global stats:', error);
      setGlobalStats(getDefaultStats());
    }
  };

  // Función para transformar los datos de la API al formato del frontend
  const transformStatsData = (apiData) => {
    return {
      reservations: {
        total: apiData.activeReservations || 0,
        active: apiData.activeReservations || 0,
        completed: 0 // No disponible en tu API actual
      },
      payments: {
        total: 0, // No disponible en tu API actual
        revenue: apiData.totalRevenue || 0,
        completed: 0, // No disponible en tu API actual
        pending: 0 // No disponible en tu API actual
      },
      parking: {
        total: apiData.availableParkings || 0, // Asumiendo que availableParkings es el total
        available: apiData.availableParkings || 0
      },
      users: {
        total: apiData.totalUsers || 0
      },
      // Datos adicionales que tu API proporciona
      additionalData: {
        vehicleDistribution: apiData.vehicleDistribution,
        weeklyReservations: apiData.weeklyReservations
      }
    };
  };

  // Stats por defecto en caso de error
  const getDefaultStats = () => {
    return {
      reservations: {
        total: 0,
        active: 0,
        completed: 0
      },
      payments: {
        total: 0,
        revenue: 0,
        completed: 0,
        pending: 0
      },
      parking: {
        total: 0,
        available: 0
      },
      users: {
        total: 0
      },
      additionalData: {
        vehicleDistribution: { cars: 100 },
        weeklyReservations: []
      }
    };
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