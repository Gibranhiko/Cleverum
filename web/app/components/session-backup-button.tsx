'use client';

import React, { useState, useEffect } from 'react';

interface SessionBackupButtonProps {
  clientId: string;
  clientName: string;
  onBackupSuccess?: () => void;
  onBackupError?: (error: string) => void;
}

interface BackupStatus {
  hasBackup: boolean;
  backup?: {
    id: string;
    backupDate: string;
    restoredAt?: string;
    hasKeys: boolean;
    dataSize: number;
  };
}

export default function SessionBackupButton({ 
  clientId, 
  clientName, 
  onBackupSuccess, 
  onBackupError 
}: SessionBackupButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    fetchBackupStatus();
  }, [clientId]);

  const fetchBackupStatus = async () => {
    try {
      const response = await fetch(`/api/sessions/backup?clientId=${clientId}`);
      if (response.ok) {
        const status = await response.json();
        setBackupStatus(status);
      }
    } catch (error) {
      console.error('Error fetching backup status:', error);
    }
  };

  const handleBackup = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/sessions/backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clientId }),
      });

      const result = await response.json();

      if (response.ok) {
        await fetchBackupStatus(); // Refresh status
        onBackupSuccess?.();
        
        // Show success message
        alert(`✅ Sesión respaldada exitosamente para ${clientName}`);
      } else {
        throw new Error(result.message || 'Error al respaldar sesión');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      onBackupError?.(errorMessage);
      alert(`❌ Error al respaldar sesión: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!confirm(`¿Estás seguro de que quieres restaurar la sesión de WhatsApp para ${clientName}?\n\nEsto sobrescribirá cualquier sesión activa.`)) {
      return;
    }

    setIsRestoring(true);
    try {
      const response = await fetch('/api/sessions/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          clientId,
          forceRestore: true 
        }),
      });

      const result = await response.json();

      if (response.ok) {
        await fetchBackupStatus(); // Refresh status
        alert(`✅ Sesión restaurada exitosamente para ${clientName}\n\nArchivos restaurados: ${result.restore.filesRestored}\n\nEl bot debería reconectarse automáticamente.`);
      } else {
        throw new Error(result.message || 'Error al restaurar sesión');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      alert(`❌ Error al restaurar sesión: ${errorMessage}`);
    } finally {
      setIsRestoring(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDataSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-2">
      {/* Main backup button */}
      <div className="flex items-center space-x-2">
        <button
          onClick={handleBackup}
          disabled={isLoading}
          className={`flex items-center space-x-1 px-3 py-1 text-xs rounded transition-colors ${
            isLoading
              ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
              : backupStatus?.hasBackup
              ? 'bg-green-500 text-white hover:bg-green-600'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
          title={backupStatus?.hasBackup ? 'Actualizar respaldo de sesión' : 'Crear respaldo de sesión'}
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
              <span>Respaldando...</span>
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span>{backupStatus?.hasBackup ? 'Actualizar' : 'Respaldar'}</span>
            </>
          )}
        </button>

        {/* Restore button (only show if backup exists) */}
        {backupStatus?.hasBackup && (
          <button
            onClick={handleRestore}
            disabled={isRestoring}
            className={`flex items-center space-x-1 px-3 py-1 text-xs rounded transition-colors ${
              isRestoring
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                : 'bg-orange-500 text-white hover:bg-orange-600'
            }`}
            title="Restaurar sesión desde respaldo"
          >
            {isRestoring ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                <span>Restaurando...</span>
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span>Restaurar</span>
              </>
            )}
          </button>
        )}

        {/* Details toggle button */}
        {backupStatus?.hasBackup && (
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="p-1 text-gray-500 hover:text-gray-700 rounded"
            title="Ver detalles del respaldo"
          >
            <svg className={`w-3 h-3 transition-transform ${showDetails ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Backup status indicator */}
      {backupStatus && (
        <div className="flex items-center space-x-1 text-xs">
          {backupStatus.hasBackup ? (
            <>
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-green-600">Respaldado</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
              <span className="text-gray-500">Sin respaldo</span>
            </>
          )}
        </div>
      )}

      {/* Backup details (expandable) */}
      {showDetails && backupStatus?.hasBackup && backupStatus.backup && (
        <div className="bg-gray-50 p-2 rounded text-xs space-y-1">
          <div className="font-medium text-gray-700">Detalles del Respaldo:</div>
          <div className="text-gray-600">
            <div>📅 Fecha: {formatDate(backupStatus.backup.backupDate)}</div>
            <div>📊 Tamaño: {formatDataSize(backupStatus.backup.dataSize)}</div>
            {backupStatus.backup.restoredAt && (
              <div>🔄 Última restauración: {formatDate(backupStatus.backup.restoredAt)}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}