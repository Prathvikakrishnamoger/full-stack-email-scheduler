import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSuccess = async (credentialResponse) => {
    try {
      await login(credentialResponse);
      toast.success('Welcome! Redirecting to dashboard...');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.error || 'Login failed. Please try again.');
    }
  };

  const handleError = () => {
    toast.error('Google Sign-In was cancelled or failed.');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 w-full max-w-md text-center">
        {/* Logo / Icon */}
        <div className="mx-auto w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Email Scheduler</h1>
        <p className="text-gray-500 mb-8">
          Schedule and manage bulk email campaigns with precision timing and rate limiting.
        </p>

        {/* Google Login Button */}
        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={handleError}
            shape="rectangular"
            theme="outline"
            size="large"
            width="300"
          />
        </div>

        <p className="mt-6 text-xs text-gray-400">
          Sign in with your Google account to get started
        </p>
      </div>
    </div>
  );
}
