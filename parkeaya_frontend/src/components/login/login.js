import React, { useState } from 'react';
import './login.css';

function Login() {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('Enviando datos a:', 'http://127.0.0.1:8000/api/users/admin-login/');
      console.log('Datos:', formData);

      const response = await fetch('http://127.0.0.1:8000/api/users/admin-login/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      console.log('Status de respuesta:', response.status);

      const data = await response.json();
      console.log('Datos recibidos:', data);

      if (response.ok) {
        // Guardar tokens en localStorage
        localStorage.setItem('access_token', data.access);
        localStorage.setItem('refresh_token', data.refresh);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        console.log('Login exitoso, redirigiendo...');
        window.location.href = '/Dashboard';
      } else {
        setError(data.error || 'Error en el inicio de sesión');
      }
    } catch (error) {
      console.error('Error completo:', error);
      setError('Error de conexión con el servidor. Verifica que la URL sea correcta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="brand-header">
          <h1 className="brand-name">Parkea Ya</h1>
          <p className="brand-tagline">Gestión de Estacionamientos</p>
        </div>
        
        <div className="login-form">
          <h2>Panel de Administración</h2>
          <p className="welcome-text">Bienvenido </p>
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="username">Usuario</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                placeholder="Ingresa tu usuario"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Contraseña</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="Ingresa tu contraseña"
              />
            </div>
            
            {error && <div className="error-message">{error}</div>}
            
            <button 
              type="submit" 
              className="login-btn"
              disabled={loading}
            >
              {loading ? 'Ingresando...' : 'Acceder'}
            </button>
          </form>
          
        </div>
      </div>
    </div>
  );
}

export default Login;