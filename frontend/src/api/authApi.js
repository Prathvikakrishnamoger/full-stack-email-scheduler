import api from './axios';

export async function googleLogin(credential) {
  const response = await api.post('/api/auth/google', { credential });
  return response.data;
}

export async function getMe() {
  const response = await api.get('/api/auth/me');
  return response.data;
}
