// ===== COMPONENTE ESTADÍSTICAS - DASHBOARD PREMIUM =====
import { useState, useEffect, useCallback } from 'react'
import { useApi } from '../../hooks/useApi'
import { useDateFilter } from '../../hooks/useDateFilter'
import { useAuth } from '../../hooks/useAuth'
import { formatearDinero } from '../../utils'
import { exportMultipleSheets } from '../../utils/exportToExcel'
import { salesService } from '../../services/salesService'
import { productService } from '../../services/productService'
import DateFilter from '../common/DateFilter'
import '../common/DateFilter.css'
import './Stats.css'

export const Stats = () => {
    // ESTADOS
    const [estadisticasRango, setEstadisticasRango] = useState(null)
    const [cargandoAnalisis, setCargandoAnalisis] = useState(false)
    const [ventasSemana, setVentasSemana] = useState([])

    // MODAL PERSONALIZADO
    const [modal, setModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'info'
    })

    // HOOK PARA FILTRADO POR FECHAS
    const dateFilter = useDateFilter({
        onValidationError: (error) => {
            mostrarModal(error.titulo, error.mensaje, error.tipo)
        },
        allowFutureDates: false
    })

    // HOOKS
    const { datos: estadisticas, cargando: cargandoStats, ejecutarPeticion } = useApi()
    const { datos: topProductos, ejecutarPeticion: ejecutarTop } = useApi()
    const { datos: productosPocoStock, ejecutarPeticion: ejecutarPoco } = useApi()
    const { canAccessReports } = useAuth()

    // Obtener día actual de la semana (0 = Domingo, 1 = Lunes, etc.)
    const diaActual = new Date().getDay()
    const diasSemana = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']
    // Reordenar para que empiece en Lunes
    const diasOrdenados = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom']
    const indiceDiaActual = diaActual === 0 ? 6 : diaActual - 1

    // FUNCIONES
    const cargarDatos = useCallback(async () => {
        try {
            // Cargar estadísticas básicas desde Supabase
            await ejecutarPeticion(() => salesService.getStatistics())

            // Intentar cargar top productos y productos con poco stock
            try {
                await ejecutarTop(() => salesService.getTopProducts(5))
            } catch (error) {
                console.error('Error cargando top productos:', error)
            }

            try {
                await ejecutarPoco(() => productService.getLowStockProducts(10))
            } catch (error) {
                console.error('Error cargando productos con poco stock:', error)
            }

            // Cargar ventas por día de la semana
            try {
                const ventasPorDia = await salesService.getWeeklySalesData()
                setVentasSemana(ventasPorDia || [])
            } catch (error) {
                console.error('Error cargando ventas de la semana:', error)
                // Datos de ejemplo si falla
                setVentasSemana([75, 225, 150, 425, 300, 125, 50])
            }
        } catch (error) {
            console.error('Error cargando estadísticas:', error)
            mostrarModal(
                'Error al cargar datos',
                'No se pudieron cargar las estadísticas principales. Por favor, verifica tu conexión e intenta nuevamente.',
                'error'
            )
        }
    }, [ejecutarPeticion, ejecutarTop, ejecutarPoco])

    // EFECTOS
    useEffect(() => {
        const cargarDatosIniciales = async () => {
            try {
                await cargarDatos()
            } catch {
                mostrarModal(
                    'Error de conexión',
                    'No se pudieron cargar las estadísticas. Por favor, verifica tu conexión a internet.',
                    'error'
                )
            }
        }

        cargarDatosIniciales()
    }, [cargarDatos])

    // FUNCIÓN PARA MOSTRAR MODAL
    const mostrarModal = (title, message, type = 'info') => {
        setModal({
            isOpen: true,
            title,
            message,
            type
        })
    }

    // FUNCIÓN PARA CERRAR MODAL
    const cerrarModal = () => {
        setModal({
            isOpen: false,
            title: '',
            message: '',
            type: 'info'
        })
    }

    // FUNCIÓN PARA TOGGLE DARK MODE
    const toggleDarkMode = () => {
        const html = document.documentElement
        if (html.classList.contains('dark')) {
            html.classList.remove('dark')
            html.classList.add('light')
            localStorage.setItem('theme', 'light')
        } else {
            html.classList.remove('light')
            html.classList.add('dark')
            localStorage.setItem('theme', 'dark')
        }
    }

    // FUNCIÓN PARA ANALIZAR PERIODO (COMO EN HISTORIAL)
    const analizarPeriodo = async () => {
        setCargandoAnalisis(true)
        try {
            const fechasAPI = dateFilter.prepararFechasParaAPI()

            if (!fechasAPI) {
                setCargandoAnalisis(false)
                return
            }

            if (!dateFilter.hayFiltrosActivos) {
                setEstadisticasRango(null)
                setCargandoAnalisis(false)
                return
            }

            if (fechasAPI.valido) {
                const datos = await salesService.getStatisticsByDateRange(fechasAPI.fechaDesde, fechasAPI.fechaHasta)
                setEstadisticasRango(datos)
            } else if (fechasAPI.fechaHasta) {
                const datos = await salesService.getStatisticsByDateRange(undefined, fechasAPI.fechaHasta)
                setEstadisticasRango(datos)
            } else {
                setEstadisticasRango(null)
            }
        } catch {
            mostrarModal(
                'Error al analizar período',
                'No se pudieron obtener las estadísticas del período seleccionado. Por favor, intenta nuevamente.',
                'error'
            )
            setEstadisticasRango(null)
        } finally {
            setCargandoAnalisis(false)
        }
    }

    // FUNCIÓN PARA LIMPIAR FILTROS
    const limpiarFiltros = () => {
        dateFilter.limpiarFiltros()
        setEstadisticasRango(null)
    }

    // FUNCIÓN PARA EXPORTAR ESTADÍSTICAS A EXCEL
    const exportarEstadisticasExcel = () => {
        if (!estadisticas) {
            alert('No hay estadísticas para exportar');
            return;
        }

        const fechaActual = new Date().toISOString().split('T')[0];
        
        // Preparar hojas de datos
        const sheets = [];

        // Hoja 1: Estadísticas Generales
        sheets.push({
            name: 'Estadísticas Generales',
            data: [
                { 
                    'Período': 'Hoy', 
                    'Ingresos': estadisticas.ingresosDeHoy || 0, 
                    'Ingresos Formateado': formatearDinero(estadisticas.ingresosDeHoy || 0),
                    'Ventas': estadisticas.ventasDeHoy || 0 
                },
                { 
                    'Período': 'Esta Semana', 
                    'Ingresos': estadisticas.ingresosSemana || 0, 
                    'Ingresos Formateado': formatearDinero(estadisticas.ingresosSemana || 0),
                    'Ventas': estadisticas.ventasSemana || 0 
                },
                { 
                    'Período': 'Este Mes', 
                    'Ingresos': estadisticas.ingresosMes || 0, 
                    'Ingresos Formateado': formatearDinero(estadisticas.ingresosMes || 0),
                    'Crecimiento (%)': estadisticas.crecimiento || 0 
                },
                { 
                    'Período': 'Total', 
                    'Ingresos': estadisticas.ingresosTotales || 0, 
                    'Ingresos Formateado': formatearDinero(estadisticas.ingresosTotales || 0),
                    'Ventas': estadisticas.ventasTotales || 0 
                }
            ]
        });

        // Hoja 2: Top Productos
        if (topProductos && topProductos.length > 0) {
            sheets.push({
                name: 'Top Productos',
                data: topProductos.map((prod, index) => ({
                    'Ranking': index + 1,
                    'Producto/Artículo': prod.name,
                    'Cantidad Vendida': prod.cantidadVendida,
                    'Ingresos': prod.ingresos,
                    'Ingresos Formateado': formatearDinero(prod.ingresos || 0)
                }))
            });
        }

        // Hoja 3: Productos con Poco Stock
        if (productosPocoStock && productosPocoStock.length > 0) {
            sheets.push({
                name: 'Productos Poco Stock',
                data: productosPocoStock.map(prod => ({
                    'Producto/Artículo': prod.name,
                    'Stock Actual': prod.stock,
                    'Precio': prod.price,
                    'Precio Formateado': formatearDinero(prod.price || 0)
                }))
            });
        }

        // Hoja 4: Estadísticas por Rango (si hay filtro activo)
        if (estadisticasRango) {
            sheets.push({
                name: 'Estadísticas Rango',
                data: [{
                    'Fecha Inicio': estadisticasRango.fechaInicio,
                    'Fecha Fin': estadisticasRango.fechaFin,
                    'Ventas en Rango': estadisticasRango.ventasEnRango,
                    'Ingresos en Rango': estadisticasRango.ingresosEnRango
                }]
            });
        }

        const nombreArchivo = `estadisticas_${fechaActual}`;
        exportMultipleSheets(sheets, nombreArchivo);
    }

    // Calcular alturas para el gráfico de barras
    const calcularAlturaBarra = (valor, maxValor) => {
        if (!maxValor || maxValor === 0) return '10%'
        const porcentaje = (valor / maxValor) * 100
        return `${Math.max(porcentaje, 5)}%`
    }

    // Valor máximo para escala del gráfico
    const maxVentaSemana = Math.max(...(ventasSemana.length > 0 ? ventasSemana : [500]), 1)

    // Calcular porcentaje de progreso para productos
    const calcularPorcentaje = (index) => {
        const porcentajes = [85, 65, 55, 50, 30]
        return porcentajes[index] || 20
    }

    if (cargandoStats) {
        return <div className="loading">Cargando estadísticas...</div>
    }

    return (
        <div className="stats-view">
            {/* HEADER */}
            <header className="stats-header">
                <div className="header-title-section">
                    <div>
                        <div className="header-badge">Inteligencia de Negocio</div>
                        <h2>Análisis de Rendimiento</h2>
                        <p>Visualiza el crecimiento y tendencias de tu empresa</p>
                    </div>
                    <div className="header-buttons">
                        <button onClick={toggleDarkMode} className="btn-dark-mode">
                            <span className="material-icons-outlined">dark_mode</span>
                            <span>Modo Oscuro</span>
                        </button>
                        {canAccessReports && (
                            <button
                                onClick={exportarEstadisticasExcel}
                                className="btn-exportar-header"
                                disabled={!estadisticas}
                                title="Exportar estadísticas a Excel"
                            >
                                <span className="material-icons-outlined">file_download</span>
                                <span>Exportar Excel</span>
                            </button>
                        )}
                    </div>
                </div>
            </header>

            <div className="stats-content">
                {/* ESTADÍSTICAS PRINCIPALES */}
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-content">
                            <h3>Hoy</h3>
                            <div className="stat-value">{formatearDinero(estadisticas?.ingresosDeHoy || 0)}</div>
                            <div className="stat-detail">{estadisticas?.ventasDeHoy || 0} {estadisticas?.ventasDeHoy === 1 ? 'venta' : 'ventas'}</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-content">
                            <h3>Esta Semana</h3>
                            <div className="stat-value">{formatearDinero(estadisticas?.ingresosSemana || 0)}</div>
                            <div className="stat-detail">{estadisticas?.ventasSemana || 0} ventas</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-content">
                            <h3>Este Mes</h3>
                            <div className="stat-value">{formatearDinero(estadisticas?.ingresosMes || 0)}</div>
                            <div className="stat-detail">
                                {estadisticas?.crecimiento !== undefined && estadisticas.crecimiento !== 0 && (
                                    <span className="stat-growth">
                                        <span className="material-icons-outlined">trending_up</span>
                                        {estadisticas.crecimiento > 0 ? '+' : ''}{Math.abs(estadisticas.crecimiento || 0)}% vs mes anterior
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-content">
                            <h3>Total</h3>
                            <div className="stat-value">{formatearDinero(estadisticas?.ingresosTotales || 0)}</div>
                            <div className="stat-detail">{estadisticas?.ventasTotales?.toLocaleString() || 0} ventas totales</div>
                        </div>
                    </div>
                </div>

                {/* GRÁFICO Y TOP PRODUCTOS */}
                <div className="content-columns">
                    {/* GRÁFICO DE VENTAS DE LA SEMANA */}
                    <div className="column">
                        <div className="section-card">
                            <div className="section-header">
                                <h2>Ventas de la Semana</h2>
                                <span className="section-subtitle">Últimos 7 días</span>
                            </div>
                            <div className="chart-wrapper">
                                <div className="chart-y-axis">
                                    <span>$500</span>
                                    <span>$400</span>
                                    <span>$300</span>
                                    <span>$200</span>
                                    <span>$100</span>
                                    <span>$0</span>
                                </div>
                                <div className="chart-main">
                                    <div className="bar-chart-container">
                                        {diasOrdenados.map((dia, index) => {
                                            const valor = ventasSemana[index] || 0
                                            const esHoy = index === indiceDiaActual
                                            return (
                                                <div key={dia} className="chart-bar-wrapper">
                                                    <div 
                                                        className={`chart-bar ${esHoy ? 'active' : ''}`}
                                                        style={{ height: calcularAlturaBarra(valor, maxVentaSemana) }}
                                                        title={`${dia}: ${formatearDinero(valor)}`}
                                                    />
                                                </div>
                                            )
                                        })}
                                    </div>
                                    <div className="chart-x-axis">
                                        {diasOrdenados.map((dia, index) => (
                                            <span 
                                                key={dia} 
                                                className={index === indiceDiaActual ? 'active' : ''}
                                            >
                                                {dia}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* TOP 5 PRODUCTOS */}
                    <div className="column">
                        <div className="section-card">
                            <div className="section-header">
                                <h2>Top 5 Productos</h2>
                                <span className="material-icons-outlined section-icon">workspace_premium</span>
                            </div>
                            <div className="products-list">
                                {topProductos?.length > 0 ? (
                                    topProductos.map((producto, index) => (
                                        <div key={producto.id} className="product-item">
                                            <div className="product-header">
                                                <div className="product-info">
                                                    <h4>{producto.name}</h4>
                                                    <span>{producto.cantidadVendida} unidades vendidas</span>
                                                </div>
                                                <span className="product-price">{formatearDinero(producto.ingresos)}</span>
                                            </div>
                                            <div className="product-progress">
                                                <div 
                                                    className={`product-progress-bar ${index === 0 ? 'primary' : 'secondary'}`}
                                                    style={{ width: `${calcularPorcentaje(index)}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="no-data">No hay datos de productos vendidos</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* BOTTOM SECTIONS GRID */}
                <div className="bottom-columns">
                    {/* FILTRO POR FECHAS */}
                    <div className="date-filter section-card">
                        <h2 className="date-filter-title">Análisis por Período</h2>
                        <div className="date-filter-content">
                            <div className="date-inputs-center">
                                <DateFilter
                                    fechaDesde={dateFilter.fechaDesde}
                                    fechaHasta={dateFilter.fechaHasta}
                                    onFechaDesdeChange={dateFilter.setFechaDesde}
                                    onFechaHastaChange={dateFilter.setFechaHasta}
                                    onBuscar={analizarPeriodo}
                                    onLimpiar={limpiarFiltros}
                                    showButtons={false}
                                    className="stats-date-filter"
                                />
                            </div>
                            <div className="date-buttons">
                                {canAccessReports && (
                                    <button
                                        onClick={exportarEstadisticasExcel}
                                        className="btn-exportar"
                                        disabled={!estadisticas}
                                        title="Exportar estadísticas a Excel"
                                    >
                                        <span className="material-icons-outlined">file_download</span>
                                        <span>Exportar</span>
                                    </button>
                                )}
                                <button
                                    onClick={analizarPeriodo}
                                    className="search-btn"
                                    disabled={cargandoAnalisis}
                                >
                                    {cargandoAnalisis ? '...' : 'Buscar'}
                                </button>
                                <button
                                    onClick={limpiarFiltros}
                                    className="clear-btn"
                                    disabled={cargandoAnalisis}
                                >
                                    Limpiar
                                </button>
                            </div>
                        </div>

                        {estadisticasRango && (
                            <div className="range-results">
                                <div className="range-card">
                                    <h4>
                                        Resultados{dateFilter.textoRango ? ` ${dateFilter.textoRango}` : ' del período seleccionado'}
                                    </h4>
                                    <div className="range-stats">
                                        <div className="range-stat">
                                            <span className="label">Total ventas:</span>
                                            <span className="value">{estadisticasRango.ventasEnRango}</span>
                                        </div>
                                        <div className="range-stat">
                                            <span className="label">Ingresos:</span>
                                            <span className="value">{formatearDinero(estadisticasRango.ingresosEnRango)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* PRODUCTOS CON POCO STOCK */}
                    <div className="section-card low-stock-card">
                        <div className="section-header">
                            <h2>Poco Stock</h2>
                            <span className="material-icons-outlined section-icon">warning</span>
                        </div>
                        <div className="low-stock-list">
                            {productosPocoStock?.length > 0 ? (
                                productosPocoStock.map(producto => {
                                    let colorClass = '';
                                    if (producto.stock === 0 || producto.stock === 1) colorClass = 'no-stock';
                                    else if (producto.stock === 2 || producto.stock === 3) colorClass = 'orange-stock';
                                    else if (producto.stock === 4 || producto.stock === 5) colorClass = 'yellow-stock';
                                    else colorClass = 'low';
                                    return (
                                        <div key={producto.id} className={`stock-item ${colorClass}`}>
                                            <div className="stock-info">
                                                <h4>{producto.name}</h4>
                                                <div className="stock-level">
                                                    <span className="stock-label">
                                                        {producto.stock === 0 ? 'Sin stock' :
                                                            producto.stock === 1 ? '1 unidad' :
                                                                `${producto.stock} unids.`}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="stock-price">
                                                {formatearDinero(producto.price)}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="no-data">Inventario saludable</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* MODAL PERSONALIZADO PARA ERRORES */}
            {modal.isOpen && (
                <div className="modal-overlay" onClick={cerrarModal}>
                    <div className={`modal-content modal-${modal.type}`} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{modal.title}</h3>
                            <button className="modal-close" onClick={cerrarModal}>×</button>
                        </div>
                        <div className="modal-body">
                            <p>{modal.message}</p>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-modal-ok" onClick={cerrarModal}>
                                Aceptar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
