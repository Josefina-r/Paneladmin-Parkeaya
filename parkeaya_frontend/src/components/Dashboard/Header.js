import React, { useState, useEffect, useRef } from 'react';
import './Header.css';

function Header({ user, onToggleSidebar, onLogout, stats }) {
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const notificationsRef = useRef(null);

  const API_BASE = 'http://localhost:8000/api';

  // Cerrar notificaciones al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  // Cargar notificaciones reales
  useEffect(() => {
    loadNotifications();
    
    // Polling cada 30 segundos para nuevas notificaciones
    const interval = setInterval(loadNotifications, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}/notifications/`, {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count || 0);
      } else if (response.status === 401) {
        setError('Sesión expirada. Por favor, inicia sesión nuevamente.');
        // Redirigir al login si el token es inválido
        setTimeout(() => {
          localStorage.removeItem('access_token');
          window.location.href = '/login';
        }, 2000);
      } else {
        setError('Error al cargar notificaciones');
        console.error('Error cargando notificaciones:', response.status);
      }
    } catch (error) {
      console.error('Error cargando notificaciones:', error);
      setError('Error de conexión al cargar notificaciones');
      // No cargar notificaciones mock para evitar confusión en producción
    } finally {
      setLoading(false);
    }
  };

  const toggleNotifications = () => {
    if (!showNotifications) {
      // Recargar notificaciones al abrir el dropdown
      loadNotifications();
    }
    setShowNotifications(!showNotifications);
  };

  const markAsRead = async (notificationId) => {
    try {
      const response = await fetch(`${API_BASE}/notifications/${notificationId}/read/`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        // Actualizar estado local
        const updatedNotifications = notifications.map(notification =>
          notification.id === notificationId ? { ...notification, read: true } : notification
        );
        setNotifications(updatedNotifications);
        setUnreadCount(prev => Math.max(0, prev - 1));
      } else {
        console.error('Error marcando notificación como leída:', response.status);
      }
    } catch (error) {
      console.error('Error marcando como leída:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch(`${API_BASE}/notifications/mark-all-read/`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const updatedNotifications = notifications.map(notification => ({
          ...notification,
          read: true
        }));
        setNotifications(updatedNotifications);
        setUnreadCount(0);
      } else {
        console.error('Error marcando todas como leídas:', response.status);
      }
    } catch (error) {
      console.error('Error marcando todas como leídas:', error);
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    
    // Navegar según la acción definida
    if (notification.action_url) {
      window.location.href = notification.action_url;
    } else {
      // Acciones por defecto según el tipo
      switch(notification.type) {
        case 'reservation':
          window.location.href = '/dashboard/reservations';
          break;
        case 'payment':
          window.location.href = '/dashboard/payments';
          break;
        case 'violation':
          window.location.href = '/dashboard/violations';
          break;
        case 'ticket':
          window.location.href = '/dashboard/tickets';
          break;
        case 'parking':
          window.location.href = '/dashboard/parking';
          break;
        default:
          // No redirigir si no hay acción específica
          break;
      }
    }
    
    setShowNotifications(false);
  };

  const deleteNotification = async (notificationId, event) => {
    event.stopPropagation(); // Evitar que active el click de la notificación
    
    try {
      const response = await fetch(`${API_BASE}/notifications/${notificationId}/`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const updatedNotifications = notifications.filter(n => n.id !== notificationId);
        setNotifications(updatedNotifications);
        // Actualizar contador si no estaba leída
        const deletedNotification = notifications.find(n => n.id === notificationId);
        if (deletedNotification && !deletedNotification.read) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      } else {
        console.error('Error eliminando notificación:', response.status);
      }
    } catch (error) {
      console.error('Error eliminando notificación:', error);
    }
  };

  const getNotificationIcon = (type) => {
    const icons = {
      reservation: 'fas fa-calendar-check',
      payment: 'fas fa-dollar-sign',
      warning: 'fas fa-exclamation-triangle',
      info: 'fas fa-info-circle',
      success: 'fas fa-check-circle',
      error: 'fas fa-times-circle',
      violation: 'fas fa-exclamation-circle',
      ticket: 'fas fa-ticket-alt',
      parking: 'fas fa-parking',
      user: 'fas fa-user',
      system: 'fas fa-cog'
    };
    return icons[type] || 'fas fa-bell';
  };

  const formatSource = (source) => {
    const sources = {
      'mobile': 'App Móvil',
      'web': 'Panel Web',
      'system': 'Sistema'
    };
    return sources[source] || source;
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
        <div className="notifications-container" ref={notificationsRef}>
          <button 
            className={`notification-btn ${loading ? 'loading' : ''}`}
            onClick={toggleNotifications}
            disabled={loading}
            title="Notificaciones"
          >
            <i className="fas fa-bell"></i>
            {unreadCount > 0 && (
              <span className="notification-badge">{unreadCount}</span>
            )}
            {loading && (
              <span className="notification-loading">
                <i className="fas fa-spinner fa-spin"></i>
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="notifications-dropdown">
              <div className="notifications-header">
                <h3>
                  Notificaciones 
                  {unreadCount > 0 && (
                    <span className="unread-count">({unreadCount})</span>
                  )}
                </h3>
                <div className="notifications-actions">
                  {unreadCount > 0 && (
                    <button 
                      className="mark-all-read"
                      onClick={markAllAsRead}
                      title="Marcar todas como leídas"
                    >
                      <i className="fas fa-check-double"></i>
                      Marcar todas
                    </button>
                  )}
                  <button 
                    className="refresh-notifications"
                    onClick={loadNotifications}
                    title="Actualizar notificaciones"
                    disabled={loading}
                  >
                    <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
                  </button>
                </div>
              </div>
              
              {error && (
                <div className="notifications-error">
                  <i className="fas fa-exclamation-circle"></i>
                  <span>{error}</span>
                  <button onClick={() => setError(null)}>
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              )}
              
              <div className="notifications-list">
                {notifications.length > 0 ? (
                  notifications.map(notification => (
                    <div 
                      key={notification.id}
                      className={`notification-item ${!notification.read ? 'unread' : ''} ${notification.type}`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="notification-icon">
                        <i className={notification.icon || getNotificationIcon(notification.type)}></i>
                      </div>
                      <div className="notification-content">
                        <div className="notification-title">
                          <span>{notification.title}</span>
                          <button 
                            className="delete-notification"
                            onClick={(e) => deleteNotification(notification.id, e)}
                            title="Eliminar notificación"
                          >
                            <i className="fas fa-times"></i>
                          </button>
                        </div>
                        <div className="notification-message">
                          {notification.message}
                        </div>
                        <div className="notification-meta">
                          <span className="notification-time">
                            {notification.time_display || 
                             new Date(notification.created_at).toLocaleTimeString('es-ES', {
                               hour: '2-digit',
                               minute: '2-digit'
                             })}
                          </span>
                          {notification.source && (
                            <span className={`notification-source ${notification.source}`}>
                              {formatSource(notification.source)}
                            </span>
                          )}
                        </div>
                      </div>
                      {!notification.read && (
                        <div className="unread-dot" title="No leída"></div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="no-notifications">
                    <i className="fas fa-bell-slash"></i>
                    <p>No hay notificaciones</p>
                    <small>Todas las notificaciones aparecerán aquí</small>
                  </div>
                )}
              </div>
              
              <div className="notifications-footer">
                <button 
                  className="view-all-btn"
                  onClick={() => window.location.href = '/dashboard/notifications'}
                  title="Ver historial completo"
                >
                  <i className="fas fa-history"></i>
                  Ver historial completo
                </button>
              </div>
            </div>
          )}
        </div>
        
        <div className="user-menu">
          <div className="user-info">
            <div className="user-avatar">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="user-details">
              <div className="user-greeting">
                Hola, <strong>{user?.username || 'Usuario'}</strong>
              </div>
              <div className="user-role">
                {user?.role || 'Administrador'}
              </div>
            </div>
          </div>
          <button 
            className="logout-btn" 
            onClick={onLogout}
            title="Cerrar sesión"
          >
            <i className="fas fa-sign-out-alt"></i>
            <span className="logout-text">Salir</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;