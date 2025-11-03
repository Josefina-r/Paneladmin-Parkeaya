import React from 'react';
import './Sidebar.css';

const menuItems = [
  { path: '/dashboard/home', icon: 'fas fa-home', label: 'Inicio', color: '#4299e1' },
  { path: '/dashboard/reservations', icon: 'fas fa-calendar-alt', label: 'Gestión de Reservas', color: '#48bb78' },
  { path: '/dashboard/users', icon: 'fas fa-users', label: 'Usuarios', color: '#ed8936' },
  { path: '/dashboard/parking', icon: 'fas fa-parking', label: 'Estacionamientos', color: '#9f7aea' },
  { path: '/dashboard/payments', icon: 'fas fa-money-bill', label: 'Pagos', color: '#38b2ac' },
  { path: '/dashboard/violations', icon: 'fas fa-exclamation-triangle', label: 'Infracciones', color: '#f56565' },
];

function Sidebar({ isOpen, currentPath, onNavigate, stats }) {
  return (
    <div className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
      <div className="sidebar-header">
        <div className="logo">
          <span className="logo-icon"><i className="fas fa-car"></i></span>
          {isOpen && <span className="logo-text">Parkeaya Admin</span>}
        </div>
      </div>
      
      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <button
            key={item.path}
            className={`nav-item ${currentPath === item.path ? 'active' : ''}`}
            onClick={() => onNavigate(item.path)}
            style={{ 
              '--accent-color': item.color,
              borderLeftColor: currentPath === item.path ? item.color : 'transparent'
            }}
          >
            <span className="nav-icon">
              <i className={item.icon}></i>
            </span>
            {isOpen && <span className="nav-label">{item.label}</span>}
          </button>
        ))}
      </nav>
      
      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">
            <i className="fas fa-user"></i>
          </div>
          {isOpen && (
            <div className="user-details">
              <div className="user-name">Administrador</div>
              <div className="user-role">Super Admin</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Sidebar;