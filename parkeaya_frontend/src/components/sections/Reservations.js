import React, { useState, useEffect } from 'react';
import './Reservations.css';

function Reservations() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedReservation, setSelectedReservation] = useState(null);
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

  // Cargar reservas
  useEffect(() => {
    loadReservations();
  }, []);

  const loadReservations = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/reservations/`, {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setReservations(Array.isArray(data) ? data : data.results || data.reservations || []);
      } else {
        throw new Error('Error al cargar las reservas');
      }
    } catch (error) {
      console.error('Error loading reservations:', error);
      setError('No se pudieron cargar las reservas');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar reservas
  const filteredReservations = reservations.filter(reservation => {
    const matchesSearch = 
      reservation.user?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reservation.user?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reservation.parking_lot?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reservation.license_plate?.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesFilter = true;
    switch (filter) {
      case 'active':
        matchesFilter = reservation.status === 'active' || reservation.status === 'confirmed';
        break;
      case 'pending':
        matchesFilter = reservation.status === 'pending';
        break;
      case 'completed':
        matchesFilter = reservation.status === 'completed' || reservation.status === 'finished';
        break;
      case 'cancelled':
        matchesFilter = reservation.status === 'cancelled';
        break;
      default:
        matchesFilter = true;
    }

    return matchesSearch && matchesFilter;
  });

  // Estadísticas
  const stats = {
    total: reservations.length,
    active: reservations.filter(r => r.status === 'active' || r.status === 'confirmed').length,
    pending: reservations.filter(r => r.status === 'pending').length,
    completed: reservations.filter(r => r.status === 'completed' || r.status === 'finished').length,
    cancelled: reservations.filter(r => r.status === 'cancelled').length
  };

  // Cambiar estado de reserva
  const updateReservationStatus = async (reservationId, newStatus) => {
    try {
      setActionLoading(reservationId);
      
      const response = await fetch(`${API_BASE}/reservations/${reservationId}/`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        const updatedReservation = await response.json();
        setReservations(reservations.map(r => 
          r.id === reservationId ? { ...r, ...updatedReservation } : r
        ));
        setShowModal(false);
        alert(`Reserva ${getStatusText(newStatus).toLowerCase()} correctamente`);
      } else {
        throw new Error('Error al actualizar la reserva');
      }
    } catch (error) {
      console.error('Error updating reservation:', error);
      alert('Error al actualizar la reserva');
    } finally {
      setActionLoading(null);
    }
  };

  // Cancelar reserva
  const cancelReservation = async (reservationId) => {
    try {
      setActionLoading(reservationId);
      
      const response = await fetch(`${API_BASE}/reservations/${reservationId}/cancel/`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const cancelledReservation = await response.json();
        setReservations(reservations.map(r => 
          r.id === reservationId ? { ...r, ...cancelledReservation } : r
        ));
        setShowModal(false);
        alert('Reserva cancelada correctamente');
      } else {
        throw new Error('Error al cancelar la reserva');
      }
    } catch (error) {
      console.error('Error cancelling reservation:', error);
      alert('Error al cancelar la reserva');
    } finally {
      setActionLoading(null);
    }
  };

  // Ver detalles de reserva
  const viewReservationDetails = (reservation) => {
    setSelectedReservation(reservation);
    setShowModal(true);
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

  // Obtener texto del estado
  const getStatusText = (status) => {
    const statusMap = {
      'pending': 'Pendiente',
      'confirmed': 'Confirmada',
      'active': 'Activa',
      'completed': 'Completada',
      'cancelled': 'Cancelada',
      'finished': 'Finalizada'
    };
    return statusMap[status] || status;
  };

  // Obtener clase del estado
  const getStatusClass = (status) => {
    const statusClassMap = {
      'pending': 'status-pending',
      'confirmed': 'status-confirmed',
      'active': 'status-active',
      'completed': 'status-completed',
      'cancelled': 'status-cancelled',
      'finished': 'status-completed'
    };
    return statusClassMap[status] || 'status-pending';
  };

  // Obtener icono del estado
  const getStatusIcon = (status) => {
    const statusIconMap = {
      'pending': 'fa-clock',
      'confirmed': 'fa-check-circle',
      'active': 'fa-play-circle',
      'completed': 'fa-flag-checkered',
      'cancelled': 'fa-times-circle',
      'finished': 'fa-flag-checkered'
    };
    return statusIconMap[status] || 'fa-clock';
  };

  if (loading) {
    return (
      <div className="section-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Cargando reservas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="section-container">
      <div className="section-header">
        <div className="header-content">
          <div>
            <h2>Gestión de Reservas</h2>
            <p>Administra las reservas de estacionamiento del sistema</p>
          </div>
          <button className="btn-primary" onClick={loadReservations}>
            <i className="fas fa-sync-alt"></i>
            Actualizar
          </button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="reservations-stats">
        <div className="stat-card">
          <div className="stat-icon total">
            <i className="fas fa-calendar-alt"></i>
          </div>
          <div className="stat-content">
            <h3>Total Reservas</h3>
            <div className="stat-number">{stats.total}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon active">
            <i className="fas fa-play-circle"></i>
          </div>
          <div className="stat-content">
            <h3>Activas</h3>
            <div className="stat-number">{stats.active}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon pending">
            <i className="fas fa-clock"></i>
          </div>
          <div className="stat-content">
            <h3>Pendientes</h3>
            <div className="stat-number">{stats.pending}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon completed">
            <i className="fas fa-flag-checkered"></i>
          </div>
          <div className="stat-content">
            <h3>Completadas</h3>
            <div className="stat-number">{stats.completed}</div>
          </div>
        </div>
      </div>

      {/* Barra de herramientas */}
      <div className="reservations-toolbar">
        <div className="search-box">
          <i className="fas fa-search"></i>
          <input
            type="text"
            placeholder="Buscar por usuario, email, estacionamiento o placa..."
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
            <option value="all">Todas las reservas</option>
            <option value="active">Solo activas</option>
            <option value="pending">Solo pendientes</option>
            <option value="completed">Solo completadas</option>
            <option value="cancelled">Solo canceladas</option>
          </select>
        </div>
      </div>

      {/* Información de resultados */}
      <div className="results-info">
        <p>
          Mostrando {filteredReservations.length} de {reservations.length} reservas
          {searchTerm && ` para "${searchTerm}"`}
        </p>
      </div>

      {/* Tabla de reservas */}
      <div className="reservations-table-container">
        {error ? (
          <div className="error-message">
            <i className="fas fa-exclamation-triangle"></i>
            {error}
            <button onClick={loadReservations}>Reintentar</button>
          </div>
        ) : filteredReservations.length === 0 ? (
          <div className="no-data">
            <i className="fas fa-calendar-times"></i>
            <p>No se encontraron reservas</p>
            {searchTerm && <p>Intenta con otros términos de búsqueda</p>}
          </div>
        ) : (
          <table className="reservations-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Estacionamiento</th>
                <th>Placa</th>
                <th>Fecha/Hora Inicio</th>
                <th>Fecha/Hora Fin</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredReservations.map(reservation => (
                <tr key={reservation.id}>
                  <td>
                    <div className="user-info">
                      <div className="user-avatar">
                        <i className="fas fa-user"></i>
                      </div>
                      <div>
                        <div className="username">{reservation.user?.username || 'N/A'}</div>
                        <div className="user-email">{reservation.user?.email || 'N/A'}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="parking-info">
                      <div className="parking-name">{reservation.parking_lot?.name || 'N/A'}</div>
                      <div className="parking-address">{reservation.parking_lot?.address || 'N/A'}</div>
                    </div>
                  </td>
                  <td>
                    <span className="license-plate">{reservation.license_plate || 'N/A'}</span>
                  </td>
                  <td>{formatDate(reservation.start_time)}</td>
                  <td>{formatDate(reservation.end_time)}</td>
                  <td>
                    <span className={`status-badge ${getStatusClass(reservation.status)}`}>
                      <i className={`fas ${getStatusIcon(reservation.status)}`}></i>
                      {getStatusText(reservation.status)}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button 
                        className="btn-icon view"
                        onClick={() => viewReservationDetails(reservation)}
                        title="Ver detalles"
                      >
                        <i className="fas fa-eye"></i>
                      </button>
                      
                      {reservation.status === 'pending' && (
                        <button 
                          className="btn-icon confirm"
                          onClick={() => updateReservationStatus(reservation.id, 'confirmed')}
                          disabled={actionLoading === reservation.id}
                          title="Confirmar reserva"
                        >
                          <i className={`fas ${actionLoading === reservation.id ? 'fa-spinner fa-spin' : 'fa-check'}`}></i>
                        </button>
                      )}
                      
                      {(reservation.status === 'pending' || reservation.status === 'confirmed') && (
                        <button 
                          className="btn-icon cancel"
                          onClick={() => cancelReservation(reservation.id)}
                          disabled={actionLoading === reservation.id}
                          title="Cancelar reserva"
                        >
                          <i className={`fas ${actionLoading === reservation.id ? 'fa-spinner fa-spin' : 'fa-times'}`}></i>
                        </button>
                      )}
                      
                      {reservation.status === 'active' && (
                        <button 
                          className="btn-icon complete"
                          onClick={() => updateReservationStatus(reservation.id, 'completed')}
                          disabled={actionLoading === reservation.id}
                          title="Marcar como completada"
                        >
                          <i className={`fas ${actionLoading === reservation.id ? 'fa-spinner fa-spin' : 'fa-flag-checkered'}`}></i>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de detalles de reserva */}
      {showModal && selectedReservation && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Detalles de la Reserva</h3>
              <button 
                className="close-btn"
                onClick={() => setShowModal(false)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="reservation-details-grid">
                <div className="detail-section">
                  <h4>Información del Usuario</h4>
                  <div className="detail-item">
                    <label>Usuario:</label>
                    <span>{selectedReservation.user?.username || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <label>Email:</label>
                    <span>{selectedReservation.user?.email || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <label>Teléfono:</label>
                    <span>{selectedReservation.user?.phone_number || 'N/A'}</span>
                  </div>
                </div>

                <div className="detail-section">
                  <h4>Información del Estacionamiento</h4>
                  <div className="detail-item">
                    <label>Nombre:</label>
                    <span>{selectedReservation.parking_lot?.name || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <label>Dirección:</label>
                    <span>{selectedReservation.parking_lot?.address || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <label>Precio por hora:</label>
                    <span>${selectedReservation.parking_lot?.hourly_rate || 'N/A'}</span>
                  </div>
                </div>

                <div className="detail-section">
                  <h4>Detalles de la Reserva</h4>
                  <div className="detail-item">
                    <label>Placa del vehículo:</label>
                    <span className="license-plate">{selectedReservation.license_plate || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <label>Fecha/hora inicio:</label>
                    <span>{formatDate(selectedReservation.start_time)}</span>
                  </div>
                  <div className="detail-item">
                    <label>Fecha/hora fin:</label>
                    <span>{formatDate(selectedReservation.end_time)}</span>
                  </div>
                  <div className="detail-item">
                    <label>Estado:</label>
                    <span className={`status-badge ${getStatusClass(selectedReservation.status)}`}>
                      <i className={`fas ${getStatusIcon(selectedReservation.status)}`}></i>
                      {getStatusText(selectedReservation.status)}
                    </span>
                  </div>
                  <div className="detail-item">
                    <label>Precio total:</label>
                    <span className="total-price">${selectedReservation.total_price || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-secondary"
                onClick={() => setShowModal(false)}
              >
                Cerrar
              </button>
              <div className="modal-actions">
                {selectedReservation.status === 'pending' && (
                  <button 
                    className="btn-primary success"
                    onClick={() => updateReservationStatus(selectedReservation.id, 'confirmed')}
                    disabled={actionLoading === selectedReservation.id}
                  >
                    <i className="fas fa-check"></i>
                    Confirmar Reserva
                  </button>
                )}
                {(selectedReservation.status === 'pending' || selectedReservation.status === 'confirmed') && (
                  <button 
                    className="btn-primary warning"
                    onClick={() => cancelReservation(selectedReservation.id)}
                    disabled={actionLoading === selectedReservation.id}
                  >
                    <i className="fas fa-times"></i>
                    Cancelar Reserva
                  </button>
                )}
                {selectedReservation.status === 'active' && (
                  <button 
                    className="btn-primary success"
                    onClick={() => updateReservationStatus(selectedReservation.id, 'completed')}
                    disabled={actionLoading === selectedReservation.id}
                  >
                    <i className="fas fa-flag-checkered"></i>
                    Marcar como Completada
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Reservations;