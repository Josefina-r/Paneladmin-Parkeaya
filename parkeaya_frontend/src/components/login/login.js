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

    // Limpiar localStorage antes del login
    localStorage.clear();
    console.log('🔄 localStorage limpiado');

    try {
      console.log('🔐 Intentando login con JWT...');
      console.log('URL:', 'http://127.0.0.1:8000/api/users/admin-login/');
      console.log('Credenciales:', { username: formData.username, password: '***' });

      const response = await fetch('http://127.0.0.1:8000/api/users/admin-login/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      console.log('📡 Response status:', response.status);

      const data = await response.json();
      console.log('📦 Response data COMPLETA:', data);

      if (response.ok) {
        // ✅ JWT: El token viene en data.access
        const token = data.access;
        
        console.log('🔑 JWT Token encontrado:', token);
        console.log('👤 User data:', data.user);
        
        if (token) {
          // Guardar JWT token
          localStorage.setItem('access_token', token);
          localStorage.setItem('refresh_token', data.refresh || '');
          localStorage.setItem('user', JSON.stringify(data.user));
          
          // VERIFICAR QUE SE GUARDÓ
          console.log('💾 Verificando localStorage:');
          console.log('  access_token:', localStorage.getItem('access_token'));
          console.log('  user:', localStorage.getItem('user'));
          
          console.log('✅ Login exitoso con JWT, redirigiendo...');
          window.location.href = '/dashboard';
        } else {
          const errorMsg = 'No se recibió token JWT en la respuesta';
          setError(errorMsg);
          console.error('❌', errorMsg);
        }
      } else {
        const errorMsg = data.error || data.detail || `Error ${response.status} en el login`;
        setError(errorMsg);
        console.error('❌ Error en login:', errorMsg);
      }
    } catch (error) {
      console.error('💥 Error de conexión:', error);
      setError('Error de conexión con el servidor.');
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
          <p className="welcome-text">Bienvenido</p>
          
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