'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '../context/AppContext';
import Navbar from '../components/navbar';

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
  const { state, setState } = useAppContext();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
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

    // Update AppContext state
    setState((prevState) => ({
      ...prevState,
      selectedClient: { id: client._id, name: client.name },
    }));

    // Store selected client in localStorage for persistence
    localStorage.setItem('selectedClientId', client._id);
    localStorage.setItem('selectedClientName', client.name);

    // Redirect to dashboard or main page
    router.push('/');
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      description: client.description || '',
      whatsappPhone: client.whatsappPhone || '',
      email: client.email || ''
    });
    setShowEditForm(true);
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;

    try {
      const response = await fetch('/api/clients', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editingClient._id,
          ...formData
        }),
      });

      if (response.ok) {
        setFormData({ name: '', description: '', whatsappPhone: '', email: '' });
        setShowEditForm(false);
        setEditingClient(null);
        fetchClients();

        // If editing the currently selected client, update the context
        if (state.selectedClient?.id === editingClient._id) {
          setState((prevState) => ({
            ...prevState,
            selectedClient: { id: editingClient._id, name: formData.name },
          }));
          localStorage.setItem('selectedClientName', formData.name);
        }
      }
    } catch (error) {
      console.error('Error updating client:', error);
    }
  };

  const handleDeleteClient = async (client: Client) => {
    if (!confirm(`¿Estás seguro de que quieres desactivar el cliente "${client.name}"? Esto ocultará todos sus datos pero no los eliminará permanentemente.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/clients?id=${client._id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchClients();

        // If deleting the currently selected client, clear selection
        if (state.selectedClient?.id === client._id) {
          setState((prevState) => ({
            ...prevState,
            selectedClient: null,
          }));
          localStorage.removeItem('selectedClientId');
          localStorage.removeItem('selectedClientName');
        }
      }
    } catch (error) {
      console.error('Error deleting client:', error);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', whatsappPhone: '', email: '' });
    setEditingClient(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <>
      <Navbar />
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

      {(showCreateForm || showEditForm) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {showEditForm ? 'Editar Cliente' : 'Crear Nuevo Cliente'}
            </h2>
            <form onSubmit={showEditForm ? handleUpdateClient : handleCreateClient}>
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
                  onClick={() => {
                    if (showEditForm) {
                      setShowEditForm(false);
                      resetForm();
                    } else {
                      setShowCreateForm(false);
                    }
                  }}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  {showEditForm ? 'Actualizar' : 'Crear'}
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
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-semibold text-gray-900">{client.name}</h3>
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 rounded-full text-xs ${
                  client.isActive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {client.isActive ? 'Activo' : 'Inactivo'}
                </span>
                <div className="flex space-x-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditClient(client);
                    }}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                    title="Editar cliente"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClient(client);
                    }}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                    title="Desactivar cliente"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {client.description && (
              <p className="text-gray-600 mb-4">{client.description}</p>
            )}

            <div className="space-y-2 text-sm text-gray-500 mb-4">
              {client.whatsappPhone && (
                <p>📱 {client.whatsappPhone}</p>
              )}
              {client.email && (
                <p>✉️ {client.email}</p>
              )}
            </div>

            <div className="flex justify-between items-center">
              <div className="text-xs text-gray-400">
                Creado: {new Date(client.createdAt).toLocaleDateString()}
              </div>
              <button
                onClick={() => handleSelectClient(client)}
                className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
              >
                Seleccionar
              </button>
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
    </>
  );
}