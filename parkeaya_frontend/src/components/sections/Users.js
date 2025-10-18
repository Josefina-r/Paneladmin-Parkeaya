import React, { useState, useEffect } from 'react';
import './Users.css';

function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [filter, setFilter] = useState('all');

  const API_BASE = 'http://localhost:8000/api';

  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  // Cargar usuarios
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/users/users/`, {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(Array.isArray(data) ? data : data.results || data.users || []);
      } else {
        throw new Error('Error al cargar usuarios');
      }
    } catch (error) {
      console.error('Error loading users:', error);
      setError('No se pudieron cargar los usuarios');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar usuarios basado en búsqueda y filtros
  const filteredUsers = users.filter(user => {
    // Filtro de búsqueda
    const matchesSearch = 
      user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.last_name?.toLowerCase().includes(searchTerm.toLowerCase());

    // Filtro de estado
    let matchesFilter = true;
    switch (filter) {
      case 'active':
        matchesFilter = user.is_active === true;
        break;
      case 'inactive':
        matchesFilter = user.is_active === false;
        break;
      case 'staff':
        matchesFilter = user.is_staff === true || user.is_superuser === true;
        break;
      case 'superuser':
        matchesFilter = user.is_superuser === true;
        break;
      default:
        matchesFilter = true;
    }

    return matchesSearch && matchesFilter;
  });

  // Contadores para estadísticas
  const stats = {
    total: users.length,
    active: users.filter(u => u.is_active).length,
    inactive: users.filter(u => !u.is_active).length,
    staff: users.filter(u => u.is_staff && !u.is_superuser).length,
    superusers: users.filter(u => u.is_superuser).length,
    regular: users.filter(u => !u.is_staff && !u.is_superuser).length
  };

  // Bloquear/Desbloquear usuario
  const toggleUserStatus = async (user) => {
    try {
      setActionLoading(user.id);
      
      // Preparar datos para la actualización
      const updateData = {
        is_active: !user.is_active
      };

      console.log('Actualizando usuario:', user.id, 'con datos:', updateData);

      const response = await fetch(`${API_BASE}/users/users/${user.id}/`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        const updatedUser = await response.json();
        
        // Actualizar lista local con los datos del servidor
        setUsers(users.map(u => 
          u.id === user.id ? { ...u, ...updatedUser } : u
        ));
        
        // Mostrar confirmación
        alert(`Usuario ${updatedUser.is_active ? 'activado' : 'desactivado'} correctamente. ${!updatedUser.is_active ? 'El usuario no podrá iniciar sesión.' : ''}`);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || errorData.message || 'Error al actualizar usuario');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // No permitir modificar superusuarios (protección)
  const canModifyUser = (user) => {
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    
    // No permitir modificar superusuarios a menos que seas superusuario
    if (user.is_superuser && !currentUser.is_superuser) {
      return false;
    }
    
    // No permitir modificar tu propia cuenta
    if (user.id === currentUser.id) {
      return false;
    }
    
    return true;
  };

  // Ver detalles del usuario
  const viewUserDetails = (user) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  // Formatear fecha
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Obtener badge de rol
  const getRoleBadge = (user) => {
    if (user.is_superuser) {
      return { text: 'Super Admin', class: 'role-superuser', icon: 'fa-crown' };
    } else if (user.is_staff) {
      return { text: 'Staff', class: 'role-staff', icon: 'fa-user-shield' };
    } else {
      return { text: 'Usuario', class: 'role-user', icon: 'fa-user' };
    }
  };

  if (loading) {
    return (
      <div className="section-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Cargando usuarios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="section-container">
      <div className="section-header">
        <div className="header-content">
          <div>
            <h2>Gestión de Usuarios</h2>
            <p>Administra los usuarios del sistema Parkeaya</p>
          </div>
          <button className="btn-primary" onClick={loadUsers}>
            <i className="fas fa-sync-alt"></i>
            Actualizar
          </button>
        </div>
      </div>

      {/* Estadísticas rápidas */}
      <div className="users-stats">
        <div className="stat-card">
          <div className="stat-icon total">
            <i className="fas fa-users"></i>
          </div>
          <div className="stat-content">
            <h3>Total Usuarios</h3>
            <div className="stat-number">{stats.total}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon active">
            <i className="fas fa-user-check"></i>
          </div>
          <div className="stat-content">
            <h3>Activos</h3>
            <div className="stat-number">{stats.active}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon inactive">
            <i className="fas fa-user-slash"></i>
          </div>
          <div className="stat-content">
            <h3>Inactivos</h3>
            <div className="stat-number">{stats.inactive}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon staff">
            <i className="fas fa-user-shield"></i>
          </div>
          <div className="stat-content">
            <h3>Administradores</h3>
            <div className="stat-number">{stats.staff + stats.superusers}</div>
            <div className="stat-subtitle">
              {stats.superusers} super, {stats.staff} staff
            </div>
          </div>
        </div>
      </div>

      {/* Barra de búsqueda y filtros */}
      <div className="users-toolbar">
        <div className="search-box">
          <i className="fas fa-search"></i>
          <input
            type="text"
            placeholder="Buscar usuarios por nombre, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="toolbar-actions">
          <select 
            className="filter-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Todos los usuarios</option>
            <option value="active">Solo activos</option>
            <option value="inactive">Solo inactivos</option>
            <option value="staff">Staff y Administradores</option>
            <option value="superuser">Solo Super Admins</option>
          </select>
        </div>
      </div>

      {/* Información de resultados */}
      <div className="results-info">
        <p>
          Mostrando {filteredUsers.length} de {users.length} usuarios
          {searchTerm && ` para "${searchTerm}"`}
          {filter !== 'all' && ` (filtro: ${document.querySelector(`.filter-select option[value="${filter}"]`)?.textContent})`}
        </p>
      </div>

      {/* Tabla de usuarios */}
      <div className="users-table-container">
        {error ? (
          <div className="error-message">
            <i className="fas fa-exclamation-triangle"></i>
            {error}
            <button onClick={loadUsers}>Reintentar</button>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="no-data">
            <i className="fas fa-users-slash"></i>
            <p>No se encontraron usuarios</p>
            {searchTerm && <p>Intenta con otros términos de búsqueda</p>}
          </div>
        ) : (
          <table className="users-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Email</th>
                <th>Nombre Completo</th>
                <th>Rol</th>
                <th>Fecha Registro</th>
                <th>Último Login</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(user => {
                const role = getRoleBadge(user);
                const canModify = canModifyUser(user);
                
                return (
                  <tr key={user.id} className={!canModify ? 'row-protected' : ''}>
                    <td>
                      <div className="user-avatar">
                        <i className={`fas ${role.icon}`}></i>
                        <div>
                          <span className="username">{user.username}</span>
                          {!canModify && (
                            <span className="protected-badge">Protegido</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      {user.first_name || user.last_name 
                        ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                        : 'No especificado'
                      }
                    </td>
                    <td>
                      <span className={`role-badge ${role.class}`}>
                        <i className={`fas ${role.icon}`}></i>
                        {role.text}
                      </span>
                    </td>
                    <td>{formatDate(user.date_joined)}</td>
                    <td>{formatDate(user.last_login) || 'Nunca'}</td>
                    <td>
                      <span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
                        <i className={`fas ${user.is_active ? 'fa-check-circle' : 'fa-times-circle'}`}></i>
                        {user.is_active ? 'Activo' : 'Bloqueado'}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          className="btn-icon view"
                          onClick={() => viewUserDetails(user)}
                          title="Ver detalles"
                        >
                          <i className="fas fa-eye"></i>
                        </button>
                        <button 
                          className={`btn-icon ${user.is_active ? 'deactivate' : 'activate'}`}
                          onClick={() => toggleUserStatus(user)}
                          disabled={actionLoading === user.id || !canModify}
                          title={
                            !canModify ? 'Usuario protegido' : 
                            user.is_active ? 'Bloquear usuario (no podrá iniciar sesión)' : 
                            'Desbloquear usuario'
                          }
                        >
                          <i className={`fas ${actionLoading === user.id ? 'fa-spinner fa-spin' : user.is_active ? 'fa-user-slash' : 'fa-user-check'}`}></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de detalles del usuario */}
      {showUserModal && selectedUser && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Detalles del Usuario</h3>
              <button 
                className="close-btn"
                onClick={() => setShowUserModal(false)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="user-details-grid">
                <div className="detail-item">
                  <label>Usuario:</label>
                  <span>{selectedUser.username}</span>
                </div>
                <div className="detail-item">
                  <label>Email:</label>
                  <span>{selectedUser.email}</span>
                </div>
                <div className="detail-item">
                  <label>Nombre:</label>
                  <span>{selectedUser.first_name || 'No especificado'}</span>
                </div>
                <div className="detail-item">
                  <label>Apellido:</label>
                  <span>{selectedUser.last_name || 'No especificado'}</span>
                </div>
                <div className="detail-item">
                  <label>Rol:</label>
                  <span className={`role-badge ${getRoleBadge(selectedUser).class}`}>
                    <i className={`fas ${getRoleBadge(selectedUser).icon}`}></i>
                    {getRoleBadge(selectedUser).text}
                  </span>
                </div>
                <div className="detail-item">
                  <label>Estado:</label>
                  <span className={`status-badge ${selectedUser.is_active ? 'active' : 'inactive'}`}>
                    <i className={`fas ${selectedUser.is_active ? 'fa-check-circle' : 'fa-times-circle'}`}></i>
                    {selectedUser.is_active ? 'Activo - Puede iniciar sesión' : 'Bloqueado - No puede iniciar sesión'}
                  </span>
                </div>
                <div className="detail-item">
                  <label>Fecha de registro:</label>
                  <span>{formatDate(selectedUser.date_joined)}</span>
                </div>
                <div className="detail-item">
                  <label>Último login:</label>
                  <span>{formatDate(selectedUser.last_login) || 'Nunca ha iniciado sesión'}</span>
                </div>
                <div className="detail-item">
                  <label>Staff:</label>
                  <span>{selectedUser.is_staff ? 'Sí' : 'No'}</span>
                </div>
                <div className="detail-item">
                  <label>Superusuario:</label>
                  <span>{selectedUser.is_superuser ? 'Sí' : 'No'}</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-secondary"
                onClick={() => setShowUserModal(false)}
              >
                Cerrar
              </button>
              {canModifyUser(selectedUser) && (
                <button 
                  className={`btn-primary ${selectedUser.is_active ? 'warning' : 'success'}`}
                  onClick={() => {
                    toggleUserStatus(selectedUser);
                    setShowUserModal(false);
                  }}
                >
                  {selectedUser.is_active ? 'Bloquear Usuario' : 'Desbloquear Usuario'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Users;