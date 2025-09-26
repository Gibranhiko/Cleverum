'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '../context/AppContext';
import Navbar from '../components/navbar';
import ClientFormModal from '../components/client-form-modal';

interface Client {
  _id: string;
  name: string;
  description?: string;
  whatsappPhone?: string;
  email?: string;
  isActive: boolean;
  createdAt: string;
  // Profile fields
  adminName?: string;
  companyName?: string;
  companyType?: string;
  companyAddress?: string;
  companyEmail?: string;
  facebookLink?: string;
  instagramLink?: string;
  imageUrl?: string;
  useAi?: boolean;
}

export default function ClientsPage() {
  const { state, setState } = useAppContext();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
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

  const handleCreateClient = async (formData: any): Promise<Client> => {
    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const createdClient = await response.json();
        setShowCreateForm(false);
        fetchClients();
        return createdClient;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error creating client');
      }
    } catch (error) {
      console.error('Error creating client:', error);
      throw error;
    }
  };

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);

    // Update AppContext state
    setState((prevState) => ({
      ...prevState,
      selectedClient: {
        id: client._id,
        name: client.name,
        imageUrl: client.imageUrl
      },
    }));

    // Store selected client in localStorage for persistence
    localStorage.setItem('selectedClientId', client._id);
    localStorage.setItem('selectedClientName', client.name);
    if (client.imageUrl) {
      localStorage.setItem('selectedClientImageUrl', client.imageUrl);
    } else {
      localStorage.removeItem('selectedClientImageUrl');
    }

    // Redirect to dashboard or main page
    router.push('/');
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setShowEditForm(true);
  };

  const handleUpdateClient = async (formData: any): Promise<Client> => {
    if (!editingClient) throw new Error('No client being edited');

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
        const updatedClient = await response.json();
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
        return updatedClient;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error updating client');
      }
    } catch (error) {
      console.error('Error updating client:', error);
      throw error;
    }
  };

  const handleDeleteClient = async (client: Client) => {
    if (!confirm(`¿Estás seguro de que quieres borrar el cliente "${client.name}"?`)) {
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
          localStorage.removeItem('selectedClientImageUrl');
        }
      }
    } catch (error) {
      console.error('Error deleting client:', error);
    }
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
        {clients.length > 0 && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            Nuevo Cliente
          </button>
        )}
      </div>

      {(showCreateForm || showEditForm) && (
        <ClientFormModal
          isOpen={showCreateForm || showEditForm}
          isEditing={showEditForm}
          clientData={editingClient}
          onSave={showEditForm ? handleUpdateClient : handleCreateClient}
          onClose={() => {
            if (showEditForm) {
              setShowEditForm(false);
              setEditingClient(null);
            } else {
              setShowCreateForm(false);
            }
          }}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clients.map((client) => {
          const isSelected = state.selectedClient?.id === client._id;
          return (
            <div
              key={client._id}
              className={`bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow ${
                isSelected ? 'border-2 border-blue-500 bg-blue-50' : ''
              }`}
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
                  {isSelected && (
                    <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                      Seleccionado
                    </span>
                  )}
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
              {client.adminName && (
                <p>👤 Admin: {client.adminName}</p>
              )}
              {client.companyName && (
                <p>🏢 Empresa: {client.companyName}</p>
              )}
              {client.companyType && (
                <p>📋 Tipo: {client.companyType}</p>
              )}
              {client.companyAddress && (
                <p>📍 Dirección: {client.companyAddress}</p>
              )}
              {client.companyEmail && (
                <p>💼 Email Empresa: {client.companyEmail}</p>
              )}
              {client.facebookLink && (
                <p>📘 Facebook: <a href={client.facebookLink} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Ver</a></p>
              )}
              {client.instagramLink && (
                <p>📷 Instagram: <a href={client.instagramLink} target="_blank" rel="noopener noreferrer" className="text-pink-500 hover:underline">Ver</a></p>
              )}
              {client.useAi !== undefined && (
                <p>🤖 IA: {client.useAi ? 'Activada' : 'Desactivada'}</p>
              )}
            </div>

            {/* Company Logo */}
            {client.imageUrl && (
              <div className="mb-4 flex justify-center">
                <img
                  src={client.imageUrl}
                  alt={`Logo de ${client.companyName || client.name}`}
                  className="h-12 w-12 object-contain rounded"
                />
              </div>
            )}

            <div className="flex justify-between items-center">
              <div className="text-xs text-gray-400">
                Creado: {new Date(client.createdAt).toLocaleDateString()}
              </div>
              <button
                onClick={() => handleSelectClient(client)}
                disabled={isSelected}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  isSelected ? 'bg-gray-400 text-gray-200 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                {isSelected ? 'Seleccionado' : 'Seleccionar'}
              </button>
            </div>
          </div>
        )})}
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