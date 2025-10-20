import React, { useState, useEffect } from 'react';
import './Parking.css';

function Parking() {
  const [parkingLots, setParkingLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedParking, setSelectedParking] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const API_BASE = 'http://localhost:8000/api';

  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  // Cargar estacionamientos
  useEffect(() => {
    loadParkingLots();
  }, []);

  const loadParkingLots = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/parking/lots/`, {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setParkingLots(Array.isArray(data) ? data : data.results || data.parking_lots || []);
      } else {
        throw new Error('Error al cargar los estacionamientos');
      }
    } catch (error) {
      console.error('Error loading parking lots:', error);
      setError('No se pudieron cargar los estacionamientos');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar estacionamientos
  const filteredParkingLots = parkingLots.filter(parking => {
    const matchesSearch = 
      parking.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      parking.address?.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesFilter = true;
    switch (filter) {
      case 'active':
        matchesFilter = parking.is_active === true;
        break;
      case 'inactive':
        matchesFilter = parking.is_active === false;
        break;
      case 'available':
        matchesFilter = parking.available_spaces > 0;
        break;
      case 'full':
        matchesFilter = parking.available_spaces === 0;
        break;
      case 'visible':
        matchesFilter = parking.is_visible === true;
        break;
      case 'hidden':
        matchesFilter = parking.is_visible === false;
        break;
      default:
        matchesFilter = true;
    }

    return matchesSearch && matchesFilter;
  });

  // Estadísticas
  const stats = {
    total: parkingLots.length,
    active: parkingLots.filter(p => p.is_active).length,
    visible: parkingLots.filter(p => p.is_visible).length,
    totalSpaces: parkingLots.reduce((sum, p) => sum + (p.total_spaces || 0), 0),
    availableSpaces: parkingLots.reduce((sum, p) => sum + (p.available_spaces || 0), 0),
    occupancy: parkingLots.reduce((sum, p) => {
      if (p.total_spaces > 0) {
        return sum + ((p.total_spaces - p.available_spaces) / p.total_spaces);
      }
      return sum;
    }, 0) / parkingLots.length * 100 || 0
  };

  // Cambiar estado del estacionamiento
  const toggleParkingStatus = async (parkingId) => {
    try {
      setActionLoading(`status-${parkingId}`);
      
      const parking = parkingLots.find(p => p.id === parkingId);
      const response = await fetch(`${API_BASE}/parking/lots/${parkingId}/`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ is_active: !parking.is_active })
      });

      if (response.ok) {
        const updatedParking = await response.json();
        setParkingLots(parkingLots.map(p => 
          p.id === parkingId ? { ...p, ...updatedParking } : p
        ));
        alert(`Estacionamiento ${updatedParking.is_active ? 'activado' : 'desactivado'} correctamente`);
      } else {
        throw new Error('Error al actualizar el estacionamiento');
      }
    } catch (error) {
      console.error('Error updating parking:', error);
      alert('Error al actualizar el estacionamiento');
    } finally {
      setActionLoading(null);
    }
  };

  // Cambiar visibilidad en el mapa
  const toggleParkingVisibility = async (parkingId) => {
    try {
      setActionLoading(`visibility-${parkingId}`);
      
      const parking = parkingLots.find(p => p.id === parkingId);
      const response = await fetch(`${API_BASE}/parking/lots/${parkingId}/`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ is_visible: !parking.is_visible })
      });

      if (response.ok) {
        const updatedParking = await response.json();
        setParkingLots(parkingLots.map(p => 
          p.id === parkingId ? { ...p, ...updatedParking } : p
        ));
        alert(`Estacionamiento ${updatedParking.is_visible ? 'mostrado' : 'ocultado'} en el mapa correctamente`);
      } else {
        throw new Error('Error al actualizar la visibilidad');
      }
    } catch (error) {
      console.error('Error updating parking visibility:', error);
      alert('Error al actualizar la visibilidad');
    } finally {
      setActionLoading(null);
    }
  };

  // Actualizar estacionamiento
  const updateParkingLot = async (e) => {
    e.preventDefault();
    try {
      setActionLoading('update');
      
      const response = await fetch(`${API_BASE}/parking/lots/${selectedParking.id}/`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: formData.name,
          address: formData.address,
          total_spaces: parseInt(formData.total_spaces),
          available_spaces: parseInt(formData.available_spaces),
          hourly_rate: parseFloat(formData.hourly_rate),
          is_active: formData.is_active,
          is_visible: formData.is_visible
        })
      });

      if (response.ok) {
        const updatedParking = await response.json();
        setParkingLots(parkingLots.map(p => 
          p.id === selectedParking.id ? { ...p, ...updatedParking } : p
        ));
        setShowModal(false);
        alert('Estacionamiento actualizado correctamente');
      } else {
        throw new Error('Error al actualizar el estacionamiento');
      }
    } catch (error) {
      console.error('Error updating parking:', error);
      alert('Error al actualizar el estacionamiento');
    } finally {
      setActionLoading(null);
    }
  };

  // Eliminar estacionamiento
  const deleteParkingLot = async (parkingId) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este estacionamiento? Esta acción no se puede deshacer y se perderán todos los datos asociados.')) {
      return;
    }

    try {
      setActionLoading(`delete-${parkingId}`);
      
      const response = await fetch(`${API_BASE}/parking/lots/${parkingId}/`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        setParkingLots(parkingLots.filter(p => p.id !== parkingId));
        setShowModal(false);
        alert('Estacionamiento eliminado correctamente');
      } else {
        throw new Error('Error al eliminar el estacionamiento');
      }
    } catch (error) {
      console.error('Error deleting parking:', error);
      alert('Error al eliminar el estacionamiento');
    } finally {
      setActionLoading(null);
    }
  };

  // Ver detalles del estacionamiento
  const viewParkingDetails = (parking) => {
    setSelectedParking(parking);
    setFormData({
      name: parking.name || '',
      address: parking.address || '',
      total_spaces: parking.total_spaces || 0,
      available_spaces: parking.available_spaces || 0,
      hourly_rate: parking.hourly_rate || 0,
      is_active: parking.is_active || false,
      is_visible: parking.is_visible !== undefined ? parking.is_visible : true
    });
    setShowModal(true);
  };

  // Resetear formulario
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    total_spaces: 0,
    available_spaces: 0,
    hourly_rate: 0,
    is_active: true,
    is_visible: true
  });

  // Calcular porcentaje de ocupación
  const getOccupancyPercentage = (parking) => {
    if (!parking.total_spaces) return 0;
    return ((parking.total_spaces - parking.available_spaces) / parking.total_spaces) * 100;
  };

  // Obtener clase de ocupación
  const getOccupancyClass = (percentage) => {
    if (percentage >= 90) return 'occupancy-high';
    if (percentage >= 70) return 'occupancy-medium';
    return 'occupancy-low';
  };

  if (loading) {
    return (
      <div className="section-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Cargando estacionamientos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="section-container">
      <div className="section-header">
        <div className="header-content">
          <div>
            <h2>Gestión de Estacionamientos</h2>
            <p>Administra y monitorea los estacionamientos del sistema</p>
          </div>
          <button className="btn-primary" onClick={loadParkingLots}>
            <i className="fas fa-sync-alt"></i>
            Actualizar
          </button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="parking-stats">
        <div className="stat-card">
          <div className="stat-icon total">
            <i className="fas fa-parking"></i>
          </div>
          <div className="stat-content">
            <h3>Total Estacionamientos</h3>
            <div className="stat-number">{stats.total}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon active">
            <i className="fas fa-play-circle"></i>
          </div>
          <div className="stat-content">
            <h3>Activos</h3>
            <div className="stat-number">{stats.active}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon visible">
            <i className="fas fa-map-marker-alt"></i>
          </div>
          <div className="stat-content">
            <h3>Visibles en Mapa</h3>
            <div className="stat-number">{stats.visible}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon available">
            <i className="fas fa-car"></i>
          </div>
          <div className="stat-content">
            <h3>Espacios Disponibles</h3>
            <div className="stat-number">{stats.availableSpaces}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon occupancy">
            <i className="fas fa-chart-pie"></i>
          </div>
          <div className="stat-content">
            <h3>Ocupación Promedio</h3>
            <div className="stat-number">{stats.occupancy.toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {/* Barra de herramientas */}
      <div className="parking-toolbar">
        <div className="search-box">
          <i className="fas fa-search"></i>
          <input
            type="text"
            placeholder="Buscar por nombre o dirección..."
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
            <option value="all">Todos los estacionamientos</option>
            <option value="active">Solo activos</option>
            <option value="inactive">Solo inactivos</option>
            <option value="visible">Visibles en mapa</option>
            <option value="hidden">Ocultos en mapa</option>
            <option value="available">Con espacios disponibles</option>
            <option value="full">Completamente llenos</option>
          </select>
        </div>
      </div>

      {/* Información de resultados */}
      <div className="results-info">
        <p>
          Mostrando {filteredParkingLots.length} de {parkingLots.length} estacionamientos
          {searchTerm && ` para "${searchTerm}"`}
        </p>
      </div>

      {/* Grid de estacionamientos */}
      <div className="parking-grid-container">
        {error ? (
          <div className="error-message">
            <i className="fas fa-exclamation-triangle"></i>
            {error}
            <button onClick={loadParkingLots}>Reintentar</button>
          </div>
        ) : filteredParkingLots.length === 0 ? (
          <div className="no-data">
            <i className="fas fa-parking"></i>
            <p>No se encontraron estacionamientos</p>
            {searchTerm && <p>Intenta con otros términos de búsqueda</p>}
          </div>
        ) : (
          <div className="parking-grid">
            {filteredParkingLots.map(parking => {
              const occupancy = getOccupancyPercentage(parking);
              const occupancyClass = getOccupancyClass(occupancy);
              
              return (
                <div key={parking.id} className="parking-card">
                  <div className="parking-card-header">
                    <div className="parking-name">{parking.name}</div>
                    <div className="parking-badges">
                      <div className={`status-badge ${parking.is_active ? 'active' : 'inactive'}`}>
                        <i className={`fas ${parking.is_active ? 'fa-check-circle' : 'fa-times-circle'}`}></i>
                        {parking.is_active ? 'Activo' : 'Inactivo'}
                      </div>
                      <div className={`visibility-badge ${parking.is_visible ? 'visible' : 'hidden'}`}>
                        <i className={`fas ${parking.is_visible ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                        {parking.is_visible ? 'Visible' : 'Oculto'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="parking-address">
                    <i className="fas fa-map-marker-alt"></i>
                    {parking.address}
                  </div>
                  
                  <div className="parking-spaces">
                    <div className="spaces-info">
                      <div className="spaces-label">Espacios</div>
                      <div className="spaces-numbers">
                        {parking.available_spaces} / {parking.total_spaces} disponibles
                      </div>
                    </div>
                    <div className="occupancy-bar">
                      <div 
                        className={`occupancy-fill ${occupancyClass}`}
                        style={{ width: `${occupancy}%` }}
                      ></div>
                    </div>
                    <div className="occupancy-percentage">{occupancy.toFixed(0)}% ocupado</div>
                  </div>
                  
                  <div className="parking-rate">
                    <i className="fas fa-tag"></i>
                    ${parking.hourly_rate} / hora
                  </div>
                  
                  <div className="parking-card-actions">
                    <button 
                      className="btn-icon view"
                      onClick={() => viewParkingDetails(parking)}
                      title="Ver detalles y editar"
                    >
                      <i className="fas fa-edit"></i>
                    </button>
                    <button 
                      className={`btn-icon ${parking.is_active ? 'deactivate' : 'activate'}`}
                      onClick={() => toggleParkingStatus(parking.id)}
                      disabled={actionLoading === `status-${parking.id}`}
                      title={parking.is_active ? 'Desactivar estacionamiento' : 'Activar estacionamiento'}
                    >
                      <i className={`fas ${actionLoading === `status-${parking.id}` ? 'fa-spinner fa-spin' : parking.is_active ? 'fa-pause' : 'fa-play'}`}></i>
                    </button>
                    <button 
                      className={`btn-icon ${parking.is_visible ? 'hide' : 'show'}`}
                      onClick={() => toggleParkingVisibility(parking.id)}
                      disabled={actionLoading === `visibility-${parking.id}`}
                      title={parking.is_visible ? 'Ocultar en mapa' : 'Mostrar en mapa'}
                    >
                      <i className={`fas ${actionLoading === `visibility-${parking.id}` ? 'fa-spinner fa-spin' : parking.is_visible ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                    <button 
                      className="btn-icon delete"
                      onClick={() => deleteParkingLot(parking.id)}
                      disabled={actionLoading === `delete-${parking.id}`}
                      title="Eliminar estacionamiento"
                    >
                      <i className={`fas ${actionLoading === `delete-${parking.id}` ? 'fa-spinner fa-spin' : 'fa-trash'}`}></i>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de edición */}
      {showModal && selectedParking && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Editar Estacionamiento</h3>
              <button 
                className="close-btn"
                onClick={() => setShowModal(false)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={updateParkingLot}>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Nombre *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Dirección *</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Espacios Totales *</label>
                    <input
                      type="number"
                      value={formData.total_spaces}
                      onChange={(e) => setFormData({...formData, total_spaces: parseInt(e.target.value)})}
                      min="1"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Espacios Disponibles *</label>
                    <input
                      type="number"
                      value={formData.available_spaces}
                      onChange={(e) => setFormData({...formData, available_spaces: parseInt(e.target.value)})}
                      min="0"
                      max={formData.total_spaces}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Tarifa por Hora ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.hourly_rate}
                      onChange={(e) => setFormData({...formData, hourly_rate: parseFloat(e.target.value)})}
                      min="0"
                      required
                    />
                  </div>
                  <div className="form-group checkbox-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                      />
                      <span className="checkmark"></span>
                      Estacionamiento activo
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.is_visible}
                        onChange={(e) => setFormData({...formData, is_visible: e.target.checked})}
                      />
                      <span className="checkmark"></span>
                      Visible en el mapa para usuarios
                    </label>
                  </div>
                </div>
                <div className="modal-footer">
                  <button 
                    type="button"
                    className="btn-danger"
                    onClick={() => deleteParkingLot(selectedParking.id)}
                    disabled={actionLoading === `delete-${selectedParking.id}`}
                  >
                    {actionLoading === `delete-${selectedParking.id}` ? (
                      <>
                        <i className="fas fa-spinner fa-spin"></i>
                        Eliminando...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-trash"></i>
                        Eliminar Estacionamiento
                      </>
                    )}
                  </button>
                  <div className="modal-actions">
                    <button 
                      type="button"
                      className="btn-secondary"
                      onClick={() => setShowModal(false)}
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      className="btn-primary"
                      disabled={actionLoading === 'update'}
                    >
                      {actionLoading === 'update' ? (
                        <>
                          <i className="fas fa-spinner fa-spin"></i>
                          Actualizando...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-save"></i>
                          Actualizar
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Parking;