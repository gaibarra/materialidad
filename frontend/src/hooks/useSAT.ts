import { useState, useCallback } from 'react';

// Use env var in production; fall back to relative path so Nginx proxies to the SAT service
const API_BASE_URL = process.env.NEXT_PUBLIC_SAT_API_URL || '/api/sat';
const SAT_REQUEST_TIMEOUT_MS = 15000;

export interface SATResult {
    rfc: string;
    encontrado: boolean;
    resultados: Array<{
        rfc: string;
        razon_social: string;
        estatus: string;
        articulo: string;
        fecha_inclusion: string;
        fecha_actualizacion: string;
    }>;
    fecha_actualizacion_bd: string | null;
}

export const useSAT = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const consultarRFC = useCallback(async (rfc: string, articulo: string | null = null): Promise<SATResult> => {
        setLoading(true);
        setError(null);
        try {
            const url = articulo
                ? `${API_BASE_URL}/consultar-rfc/${rfc}?articulo=${encodeURIComponent(articulo)}`
                : `${API_BASE_URL}/consultar-rfc/${rfc}`;

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), SAT_REQUEST_TIMEOUT_MS);

            const response = await fetch(url, {
                signal: controller.signal,
                cache: 'no-store',
            });
            clearTimeout(timeout);

            if (!response.ok) {
                throw new Error(`Error SAT ${response.status}: ${response.statusText || 'respuesta inválida'}`);
            }
            return await response.json();
        } catch (err) {
            let errorMessage = err instanceof Error ? err.message : 'Error desconocido';
            if (err instanceof DOMException && err.name === 'AbortError') {
                errorMessage = `La validación SAT tardó más de ${Math.floor(SAT_REQUEST_TIMEOUT_MS / 1000)}s. Intenta de nuevo.`;
            } else if (err instanceof TypeError) {
                errorMessage = 'No se pudo conectar con el servicio SAT. Verifica red y endpoint configurado.';
            }
            setError(errorMessage);
            throw new Error(errorMessage);
        } finally {
            setLoading(false);
        }
    }, []);

    const obtenerEstadisticas = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/estadisticas`);
            if (!response.ok) {
                throw new Error('Error al obtener estadísticas');
            }
            return await response.json();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
            setError(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { consultarRFC, obtenerEstadisticas, loading, error };
};
