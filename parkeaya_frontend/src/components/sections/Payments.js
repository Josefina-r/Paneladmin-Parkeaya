import React, { useState, useEffect } from 'react';
import './Payments.css';

function Payments() {
  const [payments, setPayments] = useState([]);
  const [filteredPayments, setFilteredPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  // URL para tu API de pagos
  const API_BASE_URL = 'http://localhost:8000';
  const PAYMENTS_URL = `${API_BASE_URL}/api/payments/`;

  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('access_token');
      
      if (!token) {
        throw new Error('No hay token de autenticación. Por favor inicia sesión.');
      }

      const response = await fetch(PAYMENTS_URL, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });

      console.log('Response status:', response.status);
      
      if (response.status === 401) {
        throw new Error('No autorizado. Token inválido o expirado.');
      }
      
      if (!response.ok) {
        throw new Error(`Error del servidor: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Datos recibidos de API:', data);
      
      // Mapear los datos de Django según TU modelo
      const formattedPayments = data.map(payment => ({
        id: payment.id,
        transactionId: `PAY-${payment.id.toString().padStart(6, '0')}`,
        // Asumiendo que tu Reservation tiene relación con User
        customerName: payment.reserva?.usuario?.username || 
                     payment.reserva?.user?.first_name || 
                     payment.reserva?.cliente?.nombre || 
                     'Cliente',
        amount: parseFloat(payment.monto) || 0,
        paymentDate: payment.fecha_pago,
        paymentMethod: mapPaymentMethod(payment.metodo), // Mapear métodos
        status: mapPaymentStatus(payment.estado), // Mapear estados
        invoiceNumber: `INV-${payment.id.toString().padStart(4, '0')}`,
        // Datos originales para referencia
        originalData: payment
      }));
      
      setPayments(formattedPayments);
      setFilteredPayments(formattedPayments);
      
    } catch (err) {
      console.error('Error cargando pagos:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Mapear métodos de pago de Django al formato del frontend
  const mapPaymentMethod = (metodo) => {
    const methodMap = {
      'tarjeta': 'credit_card',
      'yape': 'digital_wallet', 
      'plin': 'digital_wallet',
      'efectivo': 'cash'
    };
    return methodMap[metodo] || metodo;
  };

  // Mapear estados de Django al formato del frontend
  const mapPaymentStatus = (estado) => {
    const statusMap = {
      'pagado': 'completed',
      'pendiente': 'pending', 
      'fallido': 'failed',
      'reembolsado': 'refunded'
    };
    return statusMap[estado] || 'pending';
  };

  // Función para mostrar el nombre del método en español
  const getMethodDisplayName = (method) => {
    const displayNames = {
      'credit_card': 'Tarjeta',
      'digital_wallet': 'Billetera Digital', 
      'cash': 'Efectivo',
      'tarjeta': 'Tarjeta',
      'yape': 'Yape',
      'plin': 'Plin',
      'efectivo': 'Efectivo'
    };
    return displayNames[method] || method;
  };

  const processRefund = async (paymentId) => {
    if (!window.confirm('¿Estás seguro de que deseas procesar el reembolso?')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${PAYMENTS_URL}${paymentId}/refund/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });

      if (response.status === 404) {
        throw new Error('Endpoint de reembolso no disponible');
      }

      if (!response.ok) {
        throw new Error('Error al procesar el reembolso');
      }

      alert('Reembolso procesado exitosamente');
      fetchPayments();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const exportReport = async (format = 'csv') => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${PAYMENTS_URL}export/?format=${format}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
      });

      if (response.status === 404) {
        alert('Función de exportación no disponible aún');
        return;
      }

      if (!response.ok) {
        throw new Error('Error al exportar el reporte');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte-pagos.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert('Error al exportar: ' + err.message);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  // Filtros
  useEffect(() => {
    let filtered = payments;

    if (activeTab !== 'all') {
      filtered = filtered.filter(payment => payment.status === activeTab);
    }

    if (searchTerm) {
      filtered = filtered.filter(payment =>
        payment.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.transactionId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedDate) {
      filtered = filtered.filter(payment => 
        payment.paymentDate?.includes(selectedDate)
      );
    }

    setFilteredPayments(filtered);
  }, [activeTab, searchTerm, selectedDate, payments]);

  const getStatusBadge = (status) => {
    const statusConfig = {
      completed: { 
        class: 'status-completed', 
        text: 'Completado',
        icon: 'fas fa-check-circle'
      },
      pending: { 
        class: 'status-pending', 
        text: 'Pendiente',
        icon: 'fas fa-clock'
      },
      failed: { 
        class: 'status-failed', 
        text: 'Fallido',
        icon: 'fas fa-times-circle'
      },
      refunded: { 
        class: 'status-refunded', 
        text: 'Reembolsado',
        icon: 'fas fa-undo-alt'
      }
    };
    
    const config = statusConfig[status] || { 
      class: 'status-default', 
      text: status,
      icon: 'fas fa-circle'
    };
    
    return (
      <span className={`status-badge ${config.class}`}>
        <i className={config.icon}></i> {config.text}
      </span>
    );
  };

  const getMethodIcon = (method) => {
    const methodIcons = {
      'credit_card': { icon: 'fas fa-credit-card', text: 'Tarjeta' },
      'digital_wallet': { icon: 'fas fa-mobile-alt', text: 'Billetera Digital' },
      'cash': { icon: 'fas fa-money-bill-wave', text: 'Efectivo' },
      'tarjeta': { icon: 'fas fa-credit-card', text: 'Tarjeta' },
      'yape': { icon: 'fas fa-mobile-alt', text: 'Yape' },
      'plin': { icon: 'fas fa-mobile-alt', text: 'Plin' },
      'efectivo': { icon: 'fas fa-money-bill-wave', text: 'Efectivo' }
    };
    
    const config = methodIcons[method] || { icon: 'fas fa-wallet', text: getMethodDisplayName(method) };
    return (
      <span className="payment-method">
        <i className={config.icon}></i> {config.text}
      </span>
    );
  };

  const getTotalAmount = () => {
    return filteredPayments
      .filter(p => p.status === 'completed')
      .reduce((total, payment) => total + (payment.amount || 0), 0);
  };

  const getCompletedCount = () => {
    return payments.filter(p => p.status === 'completed').length;
  };

  const getPendingCount = () => {
    return payments.filter(p => p.status === 'pending').length;
  };

  const getFailedCount = () => {
    return payments.filter(p => p.status === 'failed').length;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'PEN' // Cambié a soles peruanos
    }).format(amount);
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

  if (loading) {
    return (
      <div className="section-container">
        <div className="loading-spinner">
          <i className="fas fa-spinner fa-spin fa-2x"></i>
          <p>Cargando pagos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="section-container">
        <div className="error-message">
          <i className="fas fa-exclamation-triangle fa-2x"></i>
          <h3>Error al cargar los pagos</h3>
          <p>{error}</p>
          <button onClick={fetchPayments} className="btn-retry">
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
            <i className="fas fa-money-check-alt header-icon"></i>
            <div>
              <h2>Gestión de Pagos</h2>
              <p>Administra y monitorea todos los pagos del sistema</p>
            </div>
          </div>
          <div className="header-actions">
            <button 
              className="btn btn-export"
              onClick={() => exportReport('csv')}
            >
              <i className="fas fa-file-export"></i> Exportar CSV
            </button>
          </div>
        </div>
      </div>

      {/* Métricas */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon revenue">
            <i className="fas fa-chart-line"></i>
          </div>
          <div className="metric-content">
            <div className="metric-value">{formatCurrency(getTotalAmount())}</div>
            <div className="metric-label">Total Recaudado</div>
          </div>
        </div>
        
        <div className="metric-card">
          <div className="metric-icon completed">
            <i className="fas fa-check-circle"></i>
          </div>
          <div className="metric-content">
            <div className="metric-value">{getCompletedCount()}</div>
            <div className="metric-label">Pagos Completados</div>
          </div>
        </div>
        
        <div className="metric-card">
          <div className="metric-icon pending">
            <i className="fas fa-clock"></i>
          </div>
          <div className="metric-content">
            <div className="metric-value">{getPendingCount()}</div>
            <div className="metric-label">Pagos Pendientes</div>
          </div>
        </div>
        
        <div className="metric-card">
          <div className="metric-icon failed">
            <i className="fas fa-exclamation-triangle"></i>
          </div>
          <div className="metric-content">
            <div className="metric-value">{getFailedCount()}</div>
            <div className="metric-label">Pagos Fallidos</div>
          </div>
        </div>
      </div>

      {/* Filtros y Búsqueda */}
      <div className="filters-section">
        <div className="search-box">
          <i className="fas fa-search search-icon"></i>
          <input
            type="text"
            placeholder="Buscar por cliente, transacción o factura..."
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
            <option value="completed">Completados</option>
            <option value="pending">Pendientes</option>
            <option value="failed">Fallidos</option>
            <option value="refunded">Reembolsados</option>
          </select>
        </div>
      </div>

      {/* Lista de Pagos */}
      <div className="payments-table-container">
        <div className="table-header">
          <h3>
            <i className="fas fa-list"></i> Lista de Pagos
            <span className="table-count">({filteredPayments.length})</span>
          </h3>
        </div>
        
        {filteredPayments.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-receipt fa-3x"></i>
            <h4>No se encontraron pagos</h4>
            <p>No hay pagos que coincidan con los filtros aplicados</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="payments-table">
              <thead>
                <tr>
                  <th>ID Transacción</th>
                  <th>Cliente</th>
                  <th>Monto</th>
                  <th>Fecha</th>
                  <th>Método</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="transaction-id">
                      <i className="fas fa-receipt"></i> {payment.transactionId}
                    </td>
                    <td className="customer-name">{payment.customerName}</td>
                    <td className="amount">{formatCurrency(payment.amount)}</td>
                    <td className="payment-date">
                      <i className="fas fa-calendar"></i> {formatDate(payment.paymentDate)}
                    </td>
                    <td className="payment-method-cell">
                      {getMethodIcon(payment.paymentMethod)}
                    </td>
                    <td>{getStatusBadge(payment.status)}</td>
                    <td className="actions">
                      <button 
                        className="btn-action btn-view"
                        title="Ver detalles"
                        onClick={() => console.log('Ver detalles:', payment.originalData)}
                      >
                        <i className="fas fa-eye"></i>
                      </button>
                      
                      {payment.status === 'completed' && (
                        <button 
                          className="btn-action btn-refund"
                          onClick={() => processRefund(payment.id)}
                          title="Procesar reembolso"
                        >
                          <i className="fas fa-undo-alt"></i>
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

      {/* Resumen */}
      <div className="summary-section">
        <div className="summary-card">
          <h4>
            <i className="fas fa-chart-pie"></i> Resumen
          </h4>
          <div className="summary-content">
            <div className="summary-item">
              <span>Total de pagos mostrados:</span>
              <strong>{filteredPayments.length}</strong>
            </div>
            <div className="summary-item">
              <span>Monto total mostrado:</span>
              <strong>{formatCurrency(getTotalAmount())}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Payments;