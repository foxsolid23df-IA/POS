/**
 * Utilidad para manejar errores de Supabase de manera consistente
 */

/**
 * Verifica si un error es una señal abortada
 * @param {Error} error - El error a verificar
 * @returns {boolean} - true si es un error de señal abortada
 */
export const isAbortError = (error) => {
    if (!error) return false;
    return (
        error?.message?.includes('aborted') ||
        error?.message?.includes('abort') ||
        error?.name === 'AbortError' ||
        error?.code === 'ABORT_ERR'
    );
};

/**
 * Verifica si un error debe ser ignorado silenciosamente
 * @param {Error} error - El error a verificar
 * @returns {boolean} - true si el error debe ser ignorado
 */
export const shouldIgnoreError = (error) => {
    if (!error) return true;
    
    // Ignorar errores de señales abortadas
    if (isAbortError(error)) return true;
    
    // Ignorar errores de "no rows" de Supabase (PGRST116)
    if (error?.code === 'PGRST116') return true;
    
    return false;
};

/**
 * Maneja errores de autenticación de Supabase
 * @param {Object} authResult - Resultado de supabase.auth.getUser()
 * @param {string} context - Contexto para logging (ej: '[ServiceName]')
 * @returns {Object|null} - Usuario o null si hay error
 * @throws {Error} - Lanza error si no es un error de señal abortada
 */
export const handleAuthError = (authResult, context = '') => {
    const { data, error } = authResult;
    
    if (error) {
        if (isAbortError(error)) {
            // console.debug(`${context} Auth request aborted, ignoring`);
            return null;
        }
        console.error(`${context} Auth error:`, error);
        throw error;
    }
    
    return data?.user || null;
};

/**
 * Wrapper para ejecutar operaciones de Supabase con manejo de errores
 * @param {Function} operation - Función async que ejecuta la operación
 * @param {Object} options - Opciones de configuración
 * @returns {Promise<any>} - Resultado de la operación o null si hay error
 */
export const safeSupabaseOperation = async (operation, options = {}) => {
    const {
        context = '',
        defaultValue = null,
        throwOnError = false,
        ignoreAbort = true
    } = options;
    
    try {
        return await operation();
    } catch (error) {
        // Ignorar errores de señales abortadas si está habilitado
        if (ignoreAbort && isAbortError(error)) {
            // console.debug(`${context} Operation aborted, returning default value`);
            return defaultValue;
        }
        
        // Log del error
        console.error(`${context} Error:`, error.message || error);
        
        // Lanzar error si está configurado
        if (throwOnError) {
            throw error;
        }
        
        return defaultValue;
    }
};

/**
 * Crea un logger consistente para servicios
 * @param {string} serviceName - Nombre del servicio
 * @returns {Object} - Objeto con métodos de logging
 */
export const createServiceLogger = (serviceName) => {
    const prefix = `[${serviceName}]`;
    
    return {
        log: (...args) => console.log(prefix, ...args),
        warn: (...args) => console.warn(prefix, ...args),
        error: (...args) => console.error(prefix, ...args),
        info: (...args) => console.info(prefix, ...args),
    };
};
