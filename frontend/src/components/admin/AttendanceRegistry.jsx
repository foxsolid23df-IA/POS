import React, { useState, useEffect } from "react";
import { attendanceService } from "../../services/attendanceService";
import * as XLSX from "xlsx";
import "./AttendanceRegistry.css";

export const AttendanceRegistry = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setHours(0, 0, 0, 0))
      .toISOString()
      .split("T")[0],
    endDate: new Date(new Date().setHours(23, 59, 59, 999))
      .toISOString()
      .split("T")[0],
  });

  useEffect(() => {
    loadLogs();
  }, [dateRange]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const start = dateRange.startDate
        ? new Date(dateRange.startDate).toISOString()
        : null;

      let end = null;
      if (dateRange.endDate) {
        const endDate = new Date(dateRange.endDate);
        endDate.setHours(23, 59, 59, 999);
        end = endDate.toISOString();
      }

      const data = await attendanceService.getLogs(start, end);
      setLogs(data);
    } catch (error) {
      console.error("Error al cargar historial de asistencia:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (logs.length === 0) return;

    const filteredLogs = logs.filter((log) => {
      if (!searchTerm) return true;
      const fullName =
        `${log.staff?.name || ""} ${log.staff?.last_name || ""}`.toLowerCase();
      return fullName.includes(searchTerm.toLowerCase());
    });

    const dataToExport = filteredLogs.map((log) => ({
      Fecha: new Date(log.timestamp).toLocaleDateString(),
      Hora: new Date(log.timestamp).toLocaleTimeString(),
      Empleado: `${log.staff?.name} ${log.staff?.last_name || ""}`.trim(),
      Rol: log.staff?.role,
      Acción: log.action === "check_in" ? "Entrada" : "Salida",
      Método: log.auth_method_used === "fingerprint" ? "Huella" : "PIN",
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dataToExport);

    // Estilos básicos de columnas
    const colWidths = [
      { wch: 12 }, // Fecha
      { wch: 10 }, // Hora
      { wch: 25 }, // Empleado
      { wch: 12 }, // Rol
      { wch: 10 }, // Acción
      { wch: 10 }, // Método
    ];
    ws["!cols"] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, "Asistencia");

    const fileName = `Asistencia_${dateRange.startDate}_al_${dateRange.endDate}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const filteredLogs = logs.filter((log) => {
    if (!searchTerm) return true;
    const fullName =
      `${log.staff?.name || ""} ${log.staff?.last_name || ""}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="attendance-registry">
      <header className="registry-header">
        <div>
          <h2>Registro de Asistencia</h2>
          <p style={{ color: "var(--text-muted)" }}>
            Historial de entradas y salidas del personal
          </p>
        </div>

        <div className="registry-controls flex gap-3">
          <div className="search-container">
            <span className="material-icons-outlined search-icon">search</span>
            <input
              type="text"
              className="search-input"
              placeholder="Buscar por empleado..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="date-filters">
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, startDate: e.target.value }))
              }
            />
            <span>hasta</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, endDate: e.target.value }))
              }
            />
          </div>

          <button
            className="btn-export-excel"
            onClick={handleExportExcel}
            disabled={logs.length === 0}
          >
            <span className="material-icons-outlined">download</span>
            Exportar Excel
          </button>
        </div>
      </header>

      <div className="registry-content">
        {loading ? (
          <div className="loading-state">Cargando registros...</div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            No hay registros de asistencia en estas fechas
          </div>
        ) : (
          <table className="registry-table">
            <thead>
              <tr>
                <th>Fecha y Hora</th>
                <th>Empleado</th>
                <th>Acción</th>
                <th>Método</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan="4"
                    className="text-center py-4 text-gray-500 dark:text-gray-400"
                  >
                    No se encontraron coincidencias
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <div className="datetime">
                        <span className="date">
                          {new Date(log.timestamp).toLocaleDateString()}
                        </span>
                        <span className="time">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="staff-info">
                        <span className="name">
                          {log.staff?.name} {log.staff?.last_name}
                        </span>
                        <span className="badge-role">{log.staff?.role}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge-action ${log.action}`}>
                        {log.action === "check_in" ? "Entrada" : "Salida"}
                      </span>
                    </td>
                    <td>
                      {log.auth_method_used === "fingerprint"
                        ? "👆 Huella"
                        : "🔢 PIN"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
