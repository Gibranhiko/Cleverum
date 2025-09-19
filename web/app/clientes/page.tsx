'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Client {
  _id: string;
  name: string;
  description?: string;
  whatsappPhone?: string;
  email?: string;
  isActive: boolean;
  createdAt: string;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    whatsappPhone: '',
    email: ''
  });
  const router = useRouter();

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const response = await fetch('/api/clients');
      if (response.ok) {
        const data = await response.json();
        setClients(data);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setFormData({ name: '', description: '', whatsappPhone: '', email: '' });
        setShowCreateForm(false);
        fetchClients();
      }
    } catch (error) {
      console.error('Error creating client:', error);
    }
  };

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    // Store selected client in localStorage for persistence
    localStorage.setItem('selectedClientId', client._id);
    localStorage.setItem('selectedClientName', client.name);
    // Redirect to dashboard or main page
    router.push('/');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Gestión de Clientes</h1>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
        >
          Nuevo Cliente
        </button>
      </div>

      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Crear Nuevo Cliente</h2>
            <form onSubmit={handleCreateClient}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={3}
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono WhatsApp
                </label>
                <input
                  type="tel"
                  value={formData.whatsappPhone}
                  onChange={(e) => setFormData({ ...formData, whatsappPhone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  Crear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clients.map((client) => (
          <div
            key={client._id}
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => handleSelectClient(client)}
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-semibold text-gray-900">{client.name}</h3>
              <span className={`px-2 py-1 rounded-full text-xs ${
                client.isActive
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {client.isActive ? 'Activo' : 'Inactivo'}
              </span>
            </div>

            {client.description && (
              <p className="text-gray-600 mb-4">{client.description}</p>
            )}

            <div className="space-y-2 text-sm text-gray-500">
              {client.whatsappPhone && (
                <p>📱 {client.whatsappPhone}</p>
              )}
              {client.email && (
                <p>✉️ {client.email}</p>
              )}
            </div>

            <div className="mt-4 text-xs text-gray-400">
              Creado: {new Date(client.createdAt).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>

      {clients.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No hay clientes registrados</p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg"
          >
            Crear Primer Cliente
          </button>
        </div>
      )}
    </div>
  );
}