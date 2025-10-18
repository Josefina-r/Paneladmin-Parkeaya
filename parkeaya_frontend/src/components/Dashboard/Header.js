import React, { useState, useEffect } from 'react';
import './Header.css';

function Header({ user, onToggleSidebar, onLogout, stats }) {
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const API_BASE = 'http://localhost:8000/api';

  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  // Cargar notificaciones
  useEffect(() => {
    loadNotifications();
    
    // Simular notificaciones en tiempo real (puedes reemplazar con WebSockets)
    const interval = setInterval(loadNotifications, 30000); // Actualizar cada 30 segundos
    
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    try {
      // Aquí puedes conectar con tu API real de notificaciones
      // Por ahora simulamos datos
      const mockNotifications = [
        {
          id: 1,
          type: 'reservation',
          title: 'Nueva reserva',
          message: 'Juan Pérez ha realizado una reserva',
          time: 'Hace 5 min',
          read: false,
          icon: 'fas fa-calendar-check'
        },
        {
          id: 2,
          type: 'payment',
          title: 'Pago confirmado',
          message: 'Pago de $15 confirmado',
          time: 'Hace 15 min',
          read: false,
          icon: 'fas fa-dollar-sign'
        },
        {
          id: 3,
          type: 'warning',
          title: 'Estacionamiento lleno',
          message: 'Estacionamiento Centro está al 95% de capacidad',
          time: 'Hace 1 hora',
          read: true,
          icon: 'fas fa-exclamation-triangle'
        },
        {
          id: 4,
          type: 'info',
          title: 'Sistema actualizado',
          message: 'El sistema se ha actualizado correctamente',
          time: 'Hace 2 horas',
          read: true,
          icon: 'fas fa-info-circle'
        }
      ];

      setNotifications(mockNotifications);
      setUnreadCount(mockNotifications.filter(n => !n.read).length);
      
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
  };

  const markAsRead = (notificationId) => {
    const updatedNotifications = notifications.map(notification =>
      notification.id === notificationId ? { ...notification, read: true } : notification
    );
    setNotifications(updatedNotifications);
    setUnreadCount(updatedNotifications.filter(n => !n.read).length);
  };

  const markAllAsRead = () => {
    const updatedNotifications = notifications.map(notification => ({
      ...notification,
      read: true
    }));
    setNotifications(updatedNotifications);
    setUnreadCount(0);
  };

  const handleNotificationClick = (notification) => {
    markAsRead(notification.id);
    
    // Aquí puedes agregar acciones específicas según el tipo de notificación
    switch(notification.type) {
      case 'reservation':
        // Redirigir a reservas
        window.location.href = '/dashboard/reservations';
        break;
      case 'payment':
        // Redirigir a pagos
        window.location.href = '/dashboard/payments';
        break;
      case 'warning':
        // Redirigir a estacionamientos
        window.location.href = '/dashboard/parking';
        break;
      default:
        break;
    }
    
    setShowNotifications(false);
  };

  return (
    <header className="dashboard-header">
      <div className="header-left">
        <button className="sidebar-toggle" onClick={onToggleSidebar}>
          <i className="fas fa-bars"></i>
        </button>
        <h1 className="page-title">Panel de Administración</h1>
      </div>
      
      <div className="header-right">
        <div className="notifications-container">
          <button 
            className="notification-btn" 
            onClick={toggleNotifications}
          >
            <i className="fas fa-bell"></i>
            {unreadCount > 0 && (
              <span className="notification-badge">{unreadCount}</span>
            )}
          </button>

          {showNotifications && (
            <div className="notifications-dropdown">
              <div className="notifications-header">
                <h3>Notificaciones</h3>
                {unreadCount > 0 && (
                  <button 
                    className="mark-all-read"
                    onClick={markAllAsRead}
                  >
                    Marcar todas como leídas
                  </button>
                )}
              </div>
              
              <div className="notifications-list">
                {notifications.length > 0 ? (
                  notifications.map(notification => (
                    <div 
                      key={notification.id}
                      className={`notification-item ${!notification.read ? 'unread' : ''}`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="notification-icon">
                        <i className={notification.icon}></i>
                      </div>
                      <div className="notification-content">
                        <div className="notification-title">
                          {notification.title}
                        </div>
                        <div className="notification-message">
                          {notification.message}
                        </div>
                        <div className="notification-time">
                          {notification.time}
                        </div>
                      </div>
                      {!notification.read && (
                        <div className="unread-dot"></div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="no-notifications">
                    <i className="fas fa-bell-slash"></i>
                    <p>No hay notificaciones</p>
                  </div>
                )}
              </div>
              
              <div className="notifications-footer">
                <button 
                  className="view-all-btn"
                  onClick={() => window.location.href = '/dashboard/notifications'}
                >
                  Ver todas las notificaciones
                </button>
              </div>
            </div>
          )}
        </div>
        
        <div className="user-menu">
          <div className="user-greeting">
            Hola, <strong>{user?.username || 'Usuario'}</strong>
          </div>
          <button className="logout-btn" onClick={onLogout}>
            <i className="fas fa-sign-out-alt"></i>
            Cerrar Sesión
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;