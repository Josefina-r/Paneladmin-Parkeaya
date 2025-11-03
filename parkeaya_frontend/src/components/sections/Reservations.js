import React, { useState, useEffect } from 'react';
import './Reservations.css';

// URLs de las APIs
const DJANGO_API_BASE = 'http://localhost:8000/api';
const SPRING_BOOT_API_BASE = 'http://localhost:8080/api';

function Reservations() {
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState('todas');
  const [fechaFiltro, setFechaFiltro] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [origenFiltro, setOrigenFiltro] = useState('');

  useEffect(() => {
    cargarReservasCombinadas();
  }, []);

  // Cargar reservas de ambas APIs
  const cargarReservasCombinadas = async () => {
    try {
      setLoading(true);
      
      // Cargar desde Django
      const [reservasDjango, reservasSpring] = await Promise.all([
        fetchReservasDjango(),
        fetchReservasSpringBoot()
      ]);

      // Combinar y normalizar datos
      const todasLasReservas = [
        ...reservasDjango.map(r => ({ ...r, origen: 'django' })),
        ...reservasSpring.map(r => ({ ...r, origen: 'spring' }))
      ];

      setReservas(todasLasReservas);
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch desde Django
  const fetchReservasDjango = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${DJANGO_API_BASE}/reservations/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Error Django API');
      const data = await response.json();
      
      // Normalizar datos de Django
      return Array.isArray(data) ? data : data.results || [];
    } catch (error) {
      console.error('Error Django:', error);
      return [];
    }
  };

  // Fetch desde Spring Boot
  const fetchReservasSpringBoot = async () => {
    try {
      const response = await fetch(`${SPRING_BOOT_API_BASE}/reservas`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Error Spring Boot API');
      const data = await response.json();
      
      // Normalizar datos de Spring Boot
      return Array.isArray(data) ? data : data.content || [];
    } catch (error) {
      console.error('Error Spring Boot:', error);
      return [];
    }
  };

  // Cambiar estado de reserva (Django)
  const cambiarEstadoReservaDjango = async (id, nuevoEstado) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${DJANGO_API_BASE}/reservations/${id}/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ estado: nuevoEstado })
      });

      if (!response.ok) throw new Error('Error al actualizar');
      
      // Actualizar lista local
      setReservas(prev => prev.map(r => 
        r.id === id && r.origen === 'django' 
          ? { ...r, estado: nuevoEstado } 
          : r
      ));
    } catch (err) {
      setError(err.message);
    }
  };

  // Cambiar estado de reserva (Spring Boot)
  const cambiarEstadoReservaSpring = async (id, nuevoEstado) => {
    try {
      const response = await fetch(`${SPRING_BOOT_API_BASE}/reservas/${id}/estado`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ estado: nuevoEstado })
      });

      if (!response.ok) throw new Error('Error al actualizar');
      
      setReservas(prev => prev.map(r => 
        r.id === id && r.origen === 'spring' 
          ? { ...r, estado: nuevoEstado } 
          : r
      ));
    } catch (err) {
      setError(err.message);
    }
  };

  // Función universal para cambiar estado
  const cambiarEstadoReserva = async (id, nuevoEstado, origen) => {
    if (origen === 'django') {
      await cambiarEstadoReservaDjango(id, nuevoEstado);
    } else {
      await cambiarEstadoReservaSpring(id, nuevoEstado);
    }
  };

  // Eliminar reserva
  const eliminarReserva = async (id, origen) => {
    if (!window.confirm('¿Estás seguro de eliminar esta reserva?')) return;

    try {
      const baseUrl = origen === 'django' ? DJANGO_API_BASE : SPRING_BOOT_API_BASE;
      const endpoint = origen === 'django' 
        ? `${baseUrl}/reservations/${id}/`
        : `${baseUrl}/reservas/${id}`;

      const options = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      };

      // Agregar token para Django
      if (origen === 'django') {
        const token = localStorage.getItem('access_token');
        options.headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(endpoint, options);
      if (!response.ok) throw new Error('Error al eliminar');

      setReservas(prev => prev.filter(r => !(r.id === id && r.origen === origen)));
    } catch (err) {
      setError(err.message);
    }
  };

  // Filtrar reservas
  const reservasFiltradas = reservas.filter(reserva => {
    const coincideEstado = !estadoFiltro || reserva.estado === estadoFiltro;
    const coincideFecha = !fechaFiltro || reserva.fecha?.includes(fechaFiltro);
    const coincideOrigen = !origenFiltro || reserva.origen === origenFiltro;
    
    return coincideEstado && coincideFecha && coincideOrigen;
  });

  // Clases para estados
  const obtenerClaseEstado = (estado) => {
    const estados = {
      'confirmada': 'estado-confirmada',
      'pendiente': 'estado-pendiente',
      'cancelada': 'estado-cancelada',
      'completada': 'estado-completada',
      'active': 'estado-confirmada',
      'cancelled': 'estado-cancelada',
      'completed': 'estado-completada'
    };
    return estados[estado] || 'estado-pendiente';
  };

  // Estadísticas
  const estadisticas = {
    total: reservas.length,
    pendientes: reservas.filter(r => 
      r.estado === 'pendiente' || r.estado === 'active'
    ).length,
    confirmadas: reservas.filter(r => 
      r.estado === 'confirmada' || r.estado === 'active'
    ).length,
    django: reservas.filter(r => r.origen === 'django').length,
    spring: reservas.filter(r => r.origen === 'spring').length
  };

  if (loading) {
    return (
      <div className="section-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Cargando reservas desde ambas APIs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="section-container">
      <div className="section-header">
        <h2>Gestión de Reservas</h2>
        <p>Reservas desde Django y Spring Boot</p>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={cargarReservasCombinadas} className="btn-reintentar">
            Reintentar
          </button>
        </div>
      )}

      {/* Filtros */}
      <div className="filtros-container">
        <div className="filtro-group">
          <label>Fecha:</label>
          <input
            type="date"
            value={fechaFiltro}
            onChange={(e) => setFechaFiltro(e.target.value)}
            className="filtro-input"
          />
        </div>
        <div className="filtro-group">
          <label>Estado:</label>
          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
            className="filtro-select"
          >
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="active">Activa</option>
            <option value="confirmada">Confirmada</option>
            <option value="completada">Completada</option>
            <option value="completed">Completed</option>
            <option value="cancelada">Cancelada</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="filtro-group">
          <label>Origen:</label>
          <select
            value={origenFiltro}
            onChange={(e) => setOrigenFiltro(e.target.value)}
            className="filtro-select"
          >
            <option value="">Todos</option>
            <option value="django">Django</option>
            <option value="spring">Spring Boot</option>
          </select>
        </div>
        <button 
          onClick={() => { 
            setFechaFiltro(''); 
            setEstadoFiltro(''); 
            setOrigenFiltro(''); 
          }} 
          className="btn-limpiar"
        >
          Limpiar Filtros
        </button>
      </div>

      {/* Estadísticas */}
      <div className="estadisticas-container">
        <div className="estadistica-card">
          <h3>Total Reservas</h3>
          <span className="estadistica-numero">{estadisticas.total}</span>
        </div>
        <div className="estadistica-card">
          <h3>Pendientes</h3>
          <span className="estadistica-numero">{estadisticas.pendientes}</span>
        </div>
        <div className="estadistica-card">
          <h3>Django</h3>
          <span className="estadistica-numero">{estadisticas.django}</span>
        </div>
        <div className="estadistica-card">
          <h3>Spring Boot</h3>
          <span className="estadistica-numero">{estadisticas.spring}</span>
        </div>
      </div>

      {/* Tabla de Reservas */}
      <div className="table-container">
        <table className="reservas-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Cliente</th>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Personas</th>
              <th>Estado</th>
              <th>Origen</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {reservasFiltradas.map(reserva => (
              <tr key={`${reserva.origen}-${reserva.id}`}>
                <td className="reserva-id">#{reserva.id}</td>
                <td>{reserva.cliente_nombre || reserva.user?.name || 'N/A'}</td>
                <td>{reserva.fecha || reserva.reservationDate}</td>
                <td>{reserva.hora || reserva.reservationTime}</td>
                <td>{reserva.numero_personas || reserva.peopleCount || 1}</td>
                <td>
                  <span className={`estado-badge ${obtenerClaseEstado(reserva.estado)}`}>
                    {reserva.estado}
                  </span>
                </td>
                <td>
                  <span className={`origen-badge ${reserva.origen === 'django' ? 'origen-django' : 'origen-spring'}`}>
                    {reserva.origen === 'django' ? '🐍 Django' : '☕ Spring'}
                  </span>
                </td>
                <td>
                  <div className="acciones-container">
                    {(reserva.estado === 'pendiente' || reserva.estado === 'active') && (
                      <>
                        <button
                          onClick={() => cambiarEstadoReserva(
                            reserva.id, 
                            reserva.origen === 'django' ? 'confirmada' : 'active', 
                            reserva.origen
                          )}
                          className="btn-confirmar"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => cambiarEstadoReserva(
                            reserva.id, 
                            reserva.origen === 'django' ? 'cancelada' : 'cancelled', 
                            reserva.origen
                          )}
                          className="btn-cancelar"
                        >
                          Cancelar
                        </button>
                      </>
                    )}
                    {(reserva.estado === 'confirmada' || reserva.estado === 'active') && (
                      <button
                        onClick={() => cambiarEstadoReserva(
                          reserva.id, 
                          reserva.origen === 'django' ? 'completada' : 'completed', 
                          reserva.origen
                        )}
                        className="btn-completar"
                      >
                        Completar
                      </button>
                    )}
                    <button
                      onClick={() => eliminarReserva(reserva.id, reserva.origen)}
                      className="btn-eliminar"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {reservasFiltradas.length === 0 && (
          <div className="no-data">
            <p>No se encontraron reservas con los filtros aplicados</p>
          </div>
        )}
      </div>

      {/* Botón de actualización */}
      <div className="footer-actions">
        <button onClick={cargarReservasCombinadas} className="btn-actualizar">
          🔄 Actualizar Reservas
        </button>
      </div>
    </div>
  );
}

export default Reservations;