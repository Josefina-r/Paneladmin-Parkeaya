import React, { useState, useEffect } from 'react';
import './Violations.css';

function Violations() {
  const [violations, setViolations] = useState([]);
  const [filteredViolations, setFilteredViolations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedViolation, setSelectedViolation] = useState(null);

  // URLs de la API - ajusta según tus endpoints reales
  const API_BASE_URL = 'http://localhost:8000/api';
  const VIOLATIONS_URL = `${API_BASE_URL}/violations/`;

  // Tipos de infracciones y quejas (definidos según tu modelo)
  const violationTypes = {
    'estacionamiento_prohibido': 'Estacionamiento Prohibido',
    'tiempo_excedido': 'Tiempo Excedido',
    'plaza_incorrecta': 'Plaza Incorrecta',
    'obstruccion': 'Obstrucción de Vía',
    'sin_pago': 'Estacionamiento sin Pago',
    'reserva_incumplida': 'Reserva Incumplida',
    'danio_vehiculo': 'Daño a Vehículo',
    'servicio_deficiente': 'Servicio Deficiente',
    'conducta_inapropiada': 'Conducta Inapropiada',
    'falta_limpieza': 'Falta de Limpieza',
    'otros': 'Otros'
  };

  const complaintTypes = {
    'usuario_a_estacionamiento': 'Usuario → Estacionamiento',
    'estacionamiento_a_usuario': 'Estacionamiento → Usuario',
    'sistema_automatico': 'Sistema Automático'
  };

  const severityLevels = {
    'baja': { class: 'severity-low', text: 'Baja', icon: 'fas fa-info-circle' },
    'media': { class: 'severity-medium', text: 'Media', icon: 'fas fa-exclamation-triangle' },
    'alta': { class: 'severity-high', text: 'Alta', icon: 'fas fa-skull-crossbones' }
  };

  // Cargar infracciones desde la API
  const fetchViolations = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('access_token');
      
      if (!token) {
        throw new Error('No hay token de autenticación. Por favor inicia sesión.');
      }

      const response = await fetch(VIOLATIONS_URL, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });

      console.log('Violations response status:', response.status);
      
      if (response.status === 401) {
        throw new Error('No autorizado. Token inválido o expirado.');
      }
      
      if (!response.ok) {
        throw new Error(`Error del servidor: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Datos de infracciones recibidos:', data);
      
      setViolations(data);
      setFilteredViolations(data);
      
    } catch (err) {
      console.error('Error cargando infracciones:', err);
      setError(err.message);
      // En caso de error, dejar arrays vacíos
      setViolations([]);
      setFilteredViolations([]);
    } finally {
      setLoading(false);
    }
  };

  // Actualizar estado de infracción
  const updateViolationStatus = async (violationId, newStatus, resolutionNotes = '') => {
    try {
      const token = localStorage.getItem('access_token');
      const updateData = { 
        status: newStatus,
        ...(resolutionNotes && { resolution_notes: resolutionNotes })
      };

      const response = await fetch(`${VIOLATIONS_URL}${violationId}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        throw new Error('Error al actualizar la infracción');
      }

      return await response.json();
    } catch (err) {
      throw new Error('Error: ' + err.message);
    }
  };

  useEffect(() => {
    fetchViolations();
  }, []);

  useEffect(() => {
    filterViolations();
  }, [activeTab, searchTerm, selectedDate, violations]);

  const filterViolations = () => {
    let filtered = violations;

    if (activeTab !== 'all') {
      filtered = filtered.filter(violation => violation.status === activeTab);
    }

    if (searchTerm) {
      filtered = filtered.filter(violation =>
        (violation.license_plate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        violation.ticket_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        violation.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        violation.reported_by_user?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        violation.reported_by_parking?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (selectedDate) {
      filtered = filtered.filter(violation => 
        violation.created_at?.includes(selectedDate)
      );
    }

    setFilteredViolations(filtered);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pendiente: { class: 'status-pending', text: 'Pendiente', icon: 'fas fa-clock' },
      en_revision: { class: 'status-review', text: 'En Revisión', icon: 'fas fa-search' },
      resuelta: { class: 'status-resolved', text: 'Resuelta', icon: 'fas fa-check-circle' },
      rechazada: { class: 'status-rejected', text: 'Rechazada', icon: 'fas fa-times-circle' }
    };
    
    const config = statusConfig[status] || { class: 'status-default', text: status, icon: 'fas fa-circle' };
    return (
      <span className={`status-badge ${config.class}`}>
        <i className={config.icon}></i> {config.text}
      </span>
    );
  };

  const getSeverityBadge = (severity) => {
    const config = severityLevels[severity] || { class: 'severity-default', text: severity, icon: 'fas fa-circle' };
    return (
      <span className={`severity-badge ${config.class}`}>
        <i className={config.icon}></i> {config.text}
      </span>
    );
  };

  const getViolationTypeText = (type) => {
    return violationTypes[type] || type;
  };

  const getComplaintTypeText = (type) => {
    return complaintTypes[type] || type;
  };

  const handleResolveViolation = async (violationId) => {
    const resolutionNotes = prompt('Ingrese notas de resolución (opcional):');
    
    try {
      await updateViolationStatus(violationId, 'resuelta', resolutionNotes);
      alert('Infracción marcada como resuelta');
      fetchViolations(); // Recargar datos
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRejectViolation = async (violationId) => {
    const rejectionReason = prompt('Ingrese el motivo del rechazo:');
    if (!rejectionReason) {
      alert('Debe ingresar un motivo para rechazar la infracción');
      return;
    }
    
    try {
      await updateViolationStatus(violationId, 'rechazada', rejectionReason);
      alert('Infracción rechazada');
      fetchViolations(); // Recargar datos
    } catch (err) {
      alert(err.message);
    }
  };

  const handleReopenViolation = async (violationId) => {
    if (!window.confirm('¿Reabrir esta infracción para revisión?')) return;
    
    try {
      await updateViolationStatus(violationId, 'pendiente');
      alert('Infracción reabierta');
      fetchViolations(); // Recargar datos
    } catch (err) {
      alert(err.message);
    }
  };

  const exportReport = (format) => {
    alert(`Exportando reporte de infracciones en formato ${format.toUpperCase()}`);
    // Aquí iría la lógica de exportación a la API
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'PEN'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Función para obtener el nombre del reportante
  const getReporterName = (violation) => {
    if (violation.reported_by_user) {
      return violation.reported_by_user.username || `Usuario ${violation.reported_by_user.id}`;
    }
    if (violation.reported_by_parking) {
      return violation.reported_by_parking.nombre || `Estacionamiento ${violation.reported_by_parking.id}`;
    }
    return violation.reported_by || 'Sistema Automático';
  };

  // Función para obtener el tipo de queja
  const getComplaintDirection = (violation) => {
    if (violation.reported_by_user) {
      return 'usuario_a_estacionamiento';
    }
    if (violation.reported_by_parking) {
      return 'estacionamiento_a_usuario';
    }
    return 'sistema_automatico';
  };

  // Función para obtener la ubicación
  const getLocation = (violation) => {
    if (violation.parking_lot) {
      return violation.parking_lot.nombre || `Estacionamiento ${violation.parking_lot.id}`;
    }
    return violation.location || 'Ubicación no especificada';
  };

  if (loading) {
    return (
      <div className="section-container">
        <div className="loading-spinner">
          <i className="fas fa-spinner fa-spin fa-2x"></i>
          <p>Cargando infracciones...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="section-container">
        <div className="error-message">
          <i className="fas fa-exclamation-triangle fa-2x"></i>
          <h3>Error al cargar las infracciones</h3>
          <p>{error}</p>
          <button onClick={fetchViolations} className="btn-retry">
            <i className="fas fa-redo"></i> Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="section-container">
      <div className="section-header">
        <div className="header-content">
          <div className="header-title">
            <i className="fas fa-exclamation-triangle header-icon"></i>
            <div>
              <h2>Gestión de Infracciones y Quejas</h2>
              <p>Administra quejas de usuarios y estacionamientos</p>
            </div>
          </div>
          <div className="header-actions">
            <button className="btn btn-export" onClick={() => exportReport('csv')}>
              <i className="fas fa-file-export"></i> Exportar
            </button>
            <button className="btn btn-secondary" onClick={fetchViolations}>
              <i className="fas fa-redo"></i> Actualizar
            </button>
          </div>
        </div>
      </div>

      {/* Métricas con datos reales */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon total">
            <i className="fas fa-list"></i>
          </div>
          <div className="metric-content">
            <div className="metric-value">{violations.length}</div>
            <div className="metric-label">Total Reportes</div>
          </div>
        </div>
        
        <div className="metric-card">
          <div className="metric-icon pending">
            <i className="fas fa-clock"></i>
          </div>
          <div className="metric-content">
            <div className="metric-value">
              {violations.filter(v => v.status === 'pendiente').length}
            </div>
            <div className="metric-label">Pendientes</div>
          </div>
        </div>
        
        <div className="metric-card">
          <div className="metric-icon user-complaints">
            <i className="fas fa-user"></i>
          </div>
          <div className="metric-content">
            <div className="metric-value">
              {violations.filter(v => v.reported_by_user).length}
            </div>
            <div className="metric-label">Quejas de Usuarios</div>
          </div>
        </div>
        
        <div className="metric-card">
          <div className="metric-icon parking-complaints">
            <i className="fas fa-parking"></i>
          </div>
          <div className="metric-content">
            <div className="metric-value">
              {violations.filter(v => v.reported_by_parking).length}
            </div>
            <div className="metric-label">Quejas de Estacionamientos</div>
          </div>
        </div>
      </div>

      {/* Filtros y Búsqueda */}
      <div className="filters-section">
        <div className="search-box">
          <i className="fas fa-search search-icon"></i>
          <input
            type="text"
            placeholder="Buscar por placa, ticket, descripción o usuario..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="filter-controls">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="date-filter"
          />
          
          <select 
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
            className="status-filter"
          >
            <option value="all">Todos los estados</option>
            <option value="pendiente">Pendientes</option>
            <option value="en_revision">En Revisión</option>
            <option value="resuelta">Resueltas</option>
            <option value="rechazada">Rechazadas</option>
          </select>
        </div>
      </div>

      {/* Lista de Infracciones */}
      <div className="violations-table-container">
        <div className="table-header">
          <h3>
            <i className="fas fa-list"></i> Lista de Reportes
            <span className="table-count">({filteredViolations.length})</span>
          </h3>
        </div>
        
        {filteredViolations.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-exclamation-triangle fa-3x"></i>
            <h4>No se encontraron reportes</h4>
            <p>
              {violations.length === 0 
                ? 'No hay infracciones o quejas registradas en el sistema. Los datos se cargarán automáticamente desde la app móvil y el panel de estacionamientos.' 
                : 'No hay reportes que coincidan con los filtros aplicados'
              }
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="violations-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Placa</th>
                  <th>Tipo</th>
                  <th>Dirección</th>
                  <th>Descripción</th>
                  <th>Ubicación</th>
                  <th>Reportado por</th>
                  <th>Gravedad</th>
                  <th>Multa</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredViolations.map((violation) => (
                  <tr key={violation.id}>
                    <td className="ticket-number">
                      <i className="fas fa-ticket-alt"></i> {violation.ticket_number || `INF-${violation.id.toString().padStart(4, '0')}`}
                    </td>
                    <td className="license-plate">
                      <strong>{violation.license_plate || 'N/A'}</strong>
                    </td>
                    <td className="violation-type">
                      {getViolationTypeText(violation.violation_type)}
                    </td>
                    <td className="complaint-direction">
                      <span className={`direction-badge ${getComplaintDirection(violation)}`}>
                        {getComplaintTypeText(getComplaintDirection(violation))}
                      </span>
                    </td>
                    <td className="violation-description">
                      {violation.description || 'Sin descripción'}
                    </td>
                    <td className="location">
                      {getLocation(violation)}
                    </td>
                    <td className="reporter">
                      {getReporterName(violation)}
                    </td>
                    <td>{getSeverityBadge(violation.severity)}</td>
                    <td className="fine-amount">{formatCurrency(violation.fine_amount)}</td>
                    <td>{getStatusBadge(violation.status)}</td>
                    <td className="violation-date">
                      <i className="fas fa-calendar"></i> {formatDate(violation.created_at)}
                    </td>
                    <td className="actions">
                      <button 
                        className="btn-action btn-view"
                        onClick={() => setSelectedViolation(violation)}
                        title="Ver detalles"
                      >
                        <i className="fas fa-eye"></i>
                      </button>
                      
                      {violation.status === 'pendiente' && (
                        <>
                          <button 
                            className="btn-action btn-resolve"
                            onClick={() => handleResolveViolation(violation.id)}
                            title="Marcar como resuelta"
                          >
                            <i className="fas fa-check"></i>
                          </button>
                          <button 
                            className="btn-action btn-reject"
                            onClick={() => handleRejectViolation(violation.id)}
                            title="Rechazar infracción"
                          >
                            <i className="fas fa-times"></i>
                          </button>
                        </>
                      )}
                      
                      {(violation.status === 'resuelta' || violation.status === 'rechazada') && (
                        <button 
                          className="btn-action btn-reopen"
                          onClick={() => handleReopenViolation(violation.id)}
                          title="Reabrir infracción"
                        >
                          <i className="fas fa-redo"></i>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Detalles */}
      {selectedViolation && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Detalles del Reporte</h3>
              <button 
                className="modal-close"
                onClick={() => setSelectedViolation(null)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="violation-details">
                <div className="detail-row">
                  <label>Ticket:</label>
                  <span>{selectedViolation.ticket_number || `INF-${selectedViolation.id.toString().padStart(4, '0')}`}</span>
                </div>
                <div className="detail-row">
                  <label>Placa:</label>
                  <span>{selectedViolation.license_plate || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <label>Tipo de Infracción:</label>
                  <span>{getViolationTypeText(selectedViolation.violation_type)}</span>
                </div>
                <div className="detail-row">
                  <label>Dirección de Queja:</label>
                  <span className={`direction-badge ${getComplaintDirection(selectedViolation)}`}>
                    {getComplaintTypeText(getComplaintDirection(selectedViolation))}
                  </span>
                </div>
                <div className="detail-row">
                  <label>Descripción:</label>
                  <span>{selectedViolation.description || 'Sin descripción'}</span>
                </div>
                <div className="detail-row">
                  <label>Ubicación:</label>
                  <span>{getLocation(selectedViolation)}</span>
                </div>
                <div className="detail-row">
                  <label>Reportado por:</label>
                  <span>{getReporterName(selectedViolation)}</span>
                </div>
                <div className="detail-row">
                  <label>Gravedad:</label>
                  <span>{getSeverityBadge(selectedViolation.severity)}</span>
                </div>
                <div className="detail-row">
                  <label>Multa:</label>
                  <span className="fine-amount">{formatCurrency(selectedViolation.fine_amount)}</span>
                </div>
                <div className="detail-row">
                  <label>Estado:</label>
                  <span>{getStatusBadge(selectedViolation.status)}</span>
                </div>
                <div className="detail-row">
                  <label>Notas:</label>
                  <span>{selectedViolation.notes || 'Sin notas adicionales'}</span>
                </div>
                <div className="detail-row">
                  <label>Notas de Resolución:</label>
                  <span>{selectedViolation.resolution_notes || 'No hay notas de resolución'}</span>
                </div>
                <div className="detail-row">
                  <label>Fecha de creación:</label>
                  <span>{formatDate(selectedViolation.created_at)}</span>
                </div>
                {selectedViolation.updated_at && (
                  <div className="detail-row">
                    <label>Última actualización:</label>
                    <span>{formatDate(selectedViolation.updated_at)}</span>
                  </div>
                )}
                {selectedViolation.evidence && selectedViolation.evidence.length > 0 && (
                  <div className="detail-row">
                    <label>Evidencia:</label>
                    <div className="evidence-list">
                      {selectedViolation.evidence.map((file, index) => (
                        <span key={index} className="evidence-item">
                          <i className="fas fa-file-image"></i> {file}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary"
                onClick={() => setSelectedViolation(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Violations;