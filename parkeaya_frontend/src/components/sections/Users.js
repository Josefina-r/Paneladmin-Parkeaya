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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

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
        console.log('Datos completos de la API:', data);
        
        // DEBUG: Ver la estructura del primer usuario
        if (data.length > 0) {
          const firstUser = data[0];
          console.log('🔍 ESTRUCTURA DEL PRIMER USUARIO:');
          console.log('Todos los campos:', Object.keys(firstUser));
          console.log('fecha_registro:', firstUser.fecha_registro);
          console.log('date_joined:', firstUser.date_joined);
          console.log('last_login:', firstUser.last_login);
          console.log('is_active:', firstUser.is_active);
        }
        
        // Asegurar que tenemos un array
        const usersArray = Array.isArray(data) ? data : data.results || data.users || [];
        
        // OBTENER EL USUARIO ACTUAL LOGUEADO
        const currentUserData = JSON.parse(localStorage.getItem('user') || '{}');
        const currentUserId = currentUserData.id;
        const currentUserEmail = currentUserData.email;
        
        console.log('Usuario actual:', currentUserEmail, 'ID:', currentUserId);
        
        // FILTRADO MEJORADO - Excluir usuarios específicos
        const normalUsers = usersArray.filter(user => {
          // Excluir por emails específicos
          const excludedEmails = [
            'admin@parkesya.com', 
            'parking@gmail.com',
            'admin@parteasya.com',
            'admin@gmail.com'
          ];
          
          // Excluir el usuario actualmente logueado
          const isCurrentUser = user.id === currentUserId || user.email === currentUserEmail;
          
          // Excluir usuarios admin/staff
          const isAdminUser = user.is_staff || user.is_superuser;
          
          // También excluir por nombre de usuario que contenga "admin"
          const hasAdminName = user.username?.toLowerCase().includes('admin');
          
          return !excludedEmails.includes(user.email?.toLowerCase()) && 
                 !isCurrentUser && 
                 !isAdminUser &&
                 !hasAdminName;
        });
        
        console.log('Usuarios después del filtrado:', normalUsers);
        
        // Procesar usuarios con valores por defecto
        const processedUsers = normalUsers.map(user => ({
          ...user,
          is_active: user.is_active !== undefined ? user.is_active : true,
          username: user.username || user.email || 'N/A',
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          // USAR fecha_registro que es tu campo personalizado
          fecha_registro: user.fecha_registro || user.date_joined || null,
          last_login: user.last_login || null
        }));
        
        setUsers(processedUsers);
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
    const matchesSearch = 
      user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.last_name?.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesFilter = true;
    switch (filter) {
      case 'active':
        matchesFilter = user.is_active === true;
        break;
      case 'inactive':
        matchesFilter = user.is_active === false;
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
    inactive: users.filter(u => !u.is_active).length
  };

  // Bloquear/Desbloquear usuario
  const toggleUserStatus = async (user) => {
    try {
      setActionLoading(`status_${user.id}`);
      
      const updateData = {
        is_active: !user.is_active
      };

      console.log('Actualizando estado del usuario:', user.id, 'con datos:', updateData);

      const response = await fetch(`${API_BASE}/users/users/${user.id}/`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        const updatedUser = await response.json();
        
        // Actualizar lista local
        setUsers(users.map(u => 
          u.id === user.id ? { ...u, is_active: updatedUser.is_active } : u
        ));
        
        alert(`Usuario ${updatedUser.is_active ? 'desbloqueado' : 'bloqueado'} correctamente.`);
      } else {
        try {
          const errorData = await response.json();
          throw new Error(errorData.detail || errorData.message || 'Error al actualizar usuario');
        } catch {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
      }
    } catch (error) {
      console.error('Error updating user status:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // ELIMINAR USUARIO - VERSIÓN MEJORADA
  const deleteUser = async (user) => {
    try {
      setActionLoading(`delete_${user.id}`);
      
      console.log('Eliminando usuario ID:', user.id, 'Email:', user.email);
      
      // PRIMERO intentar desactivar el usuario en lugar de eliminar
      // Esto evita problemas con relaciones en la base de datos
      const updateData = {
        is_active: false
      };

      console.log('Intentando desactivar usuario primero...');

      // Intentar PATCH para desactivar
      const patchResponse = await fetch(`${API_BASE}/users/users/${user.id}/`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(updateData)
      });

      if (patchResponse.ok) {
        console.log('Usuario desactivado exitosamente');
        
        // Ahora intentar eliminar
        console.log('Intentando eliminar usuario...');
        const deleteResponse = await fetch(`${API_BASE}/users/users/${user.id}/`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });

        if (deleteResponse.ok || deleteResponse.status === 204) {
          // Eliminar de la lista local
          setUsers(users.filter(u => u.id !== user.id));
          setShowDeleteModal(false);
          setUserToDelete(null);
          alert('Usuario eliminado correctamente.');
        } else {
          // Si no se puede eliminar, al menos lo mantenemos desactivado
          console.log('No se pudo eliminar, pero el usuario fue desactivado');
          
          // Actualizar lista local para mostrar desactivado
          setUsers(users.map(u => 
            u.id === user.id ? { ...u, is_active: false } : u
          ));
          
          setShowDeleteModal(false);
          setUserToDelete(null);
          alert('El usuario fue desactivado pero no se pudo eliminar completamente debido a datos asociados.');
        }
      } else {
        throw new Error('No se pudo desactivar el usuario');
      }
      
    } catch (error) {
      console.error('Error en proceso de eliminación:', error);
      
      // Alternativa: Intentar eliminar directamente (método anterior)
      try {
        console.log('Intentando eliminación directa...');
        const directDeleteResponse = await fetch(`${API_BASE}/users/users/${user.id}/`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });

        if (directDeleteResponse.ok || directDeleteResponse.status === 204) {
          setUsers(users.filter(u => u.id !== user.id));
          setShowDeleteModal(false);
          setUserToDelete(null);
          alert('Usuario eliminado correctamente.');
          return;
        }
      } catch (directError) {
        console.error('Error en eliminación directa:', directError);
      }
      
      alert('Error: No se pudo eliminar el usuario. Es posible que tenga reservas o datos asociados.');
    } finally {
      setActionLoading(null);
    }
  };

  // Preparar eliminación de usuario
  const confirmDeleteUser = (user) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  // Verificar si se puede modificar el usuario
  const canModifyUser = (user) => {
    try {
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      
      // No permitir modificar tu propia cuenta
      if (user.id === currentUser.id || user.email === currentUser.email) {
        return false;
      }
      
      // No permitir modificar usuarios protegidos
      const protectedEmails = [
        'admin@parkesya.com', 
        'parking@gmail.com',
        'admin@parteasya.com',
        'admin@gmail.com'
      ];
      
      if (protectedEmails.includes(user.email?.toLowerCase())) {
        return false;
      }
      
      // No permitir modificar usuarios admin
      if (user.is_staff || user.is_superuser || user.username?.toLowerCase().includes('admin')) {
        return false;
      }
      
      return true;
    } catch {
      return true;
    }
  };

  // Ver detalles del usuario
  const viewUserDetails = (user) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  // Formatear fecha - VERSIÓN MEJORADA CON MÁS DEBUG
  const formatDate = (dateString) => {
    console.log('Formateando fecha:', dateString); // Para debug
    
    if (!dateString || dateString === 'N/A' || dateString === 'null' || dateString === 'undefined') {
      return 'N/A';
    }
    
    try {
      const date = new Date(dateString);
      
      if (isNaN(date.getTime())) {
        console.log('Fecha inválida, intentando parsear:', dateString);
        return 'N/A';
      }
      
      const formatted = date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      console.log('Fecha formateada:', formatted);
      return formatted;
      
    } catch (error) {
      console.error('Error formateando fecha:', error, 'Valor:', dateString);
      return 'N/A';
    }
  };

  // Obtener nombre completo de forma segura
  const getFullName = (user) => {
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || 'No especificado';
  };

  // Obtener badge de rol
  const getRoleBadge = (user) => {
    // Si pasa todos los filtros, es usuario normal
    return { text: 'Usuario', class: 'role-user', icon: 'fa-user' };
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
          </select>
        </div>
      </div>

      {/* Información de resultados */}
      <div className="results-info">
        <p>
          Mostrando {filteredUsers.length} de {users.length} usuarios
          {searchTerm && ` para "${searchTerm}"`}
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
                const fullName = getFullName(user);
                
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
                    <td>{fullName}</td>
                    <td>
                      <span className={`role-badge ${role.class}`}>
                        <i className={`fas ${role.icon}`}></i>
                        {role.text}
                      </span>
                    </td>
                    <td>{formatDate(user.fecha_registro)}</td>
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
                          disabled={actionLoading === `status_${user.id}` || !canModify}
                          title={
                            !canModify ? 'No puedes modificar este usuario' : 
                            user.is_active ? 'Bloquear usuario' : 
                            'Desbloquear usuario'
                          }
                        >
                          <i className={`fas ${
                            actionLoading === `status_${user.id}` ? 'fa-spinner fa-spin' : 
                            user.is_active ? 'fa-lock' : 'fa-unlock'
                          }`}></i>
                        </button>
                        <button 
                          className="btn-icon delete"
                          onClick={() => confirmDeleteUser(user)}
                          disabled={!canModify}
                          title={!canModify ? 'No puedes eliminar este usuario' : 'Eliminar usuario'}
                        >
                          <i className="fas fa-trash"></i>
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
                    {selectedUser.is_active ? 'Activo - Puede usar la app' : 'Bloqueado - No puede usar la app'}
                  </span>
                </div>
                <div className="detail-item">
                  <label>Fecha de registro:</label>
                  <span>{formatDate(selectedUser.fecha_registro)}</span>
                </div>
                <div className="detail-item">
                  <label>Último login:</label>
                  <span>{formatDate(selectedUser.last_login) || 'Nunca ha iniciado sesión'}</span>
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

      {/* Modal de confirmación para eliminar usuario */}
      {showDeleteModal && userToDelete && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Confirmar Eliminación</h3>
              <button 
                className="close-btn"
                onClick={() => {
                  setShowDeleteModal(false);
                  setUserToDelete(null);
                }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="delete-warning">
                <i className="fas fa-exclamation-triangle"></i>
                <p>¿Estás seguro de que quieres eliminar al usuario <strong>{userToDelete.username}</strong>?</p>
                <p>Esta acción no se puede deshacer y se perderán todos los datos asociados a este usuario.</p>
                <p style={{color: '#e74c3c', fontSize: '14px', marginTop: '10px'}}>
                  <strong>Nota:</strong> Si el usuario tiene reservas activas, primero será desactivado.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-secondary"
                onClick={() => {
                  setShowDeleteModal(false);
                  setUserToDelete(null);
                }}
              >
                Cancelar
              </button>
              <button 
                className="btn-danger"
                onClick={() => deleteUser(userToDelete)}
                disabled={actionLoading === `delete_${userToDelete.id}`}
              >
                {actionLoading === `delete_${userToDelete.id}` ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    Eliminando...
                  </>
                ) : (
                  <>
                    <i className="fas fa-trash"></i>
                    Eliminar Usuario
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Users;