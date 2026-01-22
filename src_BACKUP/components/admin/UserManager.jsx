import React, { useState, useEffect } from 'react';
import { staffService } from '../../services/staffService';
import Swal from 'sweetalert2';
import './UserManager.css';

export const UserManager = () => {
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingStaff, setEditingStaff] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        role: 'cajero',
        pin: ''
    });

    useEffect(() => {
        loadStaff();
    }, []);

    const loadStaff = async () => {
        try {
            setLoading(true);
            const data = await staffService.getStaff();
            setStaff(data);
        } catch (error) {
            console.error('Error al cargar empleados:', error);
            Swal.fire('Error', 'No se pudieron cargar los empleados', 'error');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({ name: '', role: 'cajero', pin: '' });
        setEditingStaff(null);
    };

    const handleOpenModal = (staffMember = null) => {
        if (staffMember) {
            setEditingStaff(staffMember);
            setFormData({
                name: staffMember.name,
                role: staffMember.role,
                pin: staffMember.pin
            });
        } else {
            resetForm();
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        resetForm();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name || !formData.pin) {
            Swal.fire('Error', 'Nombre y PIN son obligatorios', 'warning');
            return;
        }

        if (formData.pin.length < 4 || formData.pin.length > 6) {
            Swal.fire('Error', 'El PIN debe tener entre 4 y 6 dígitos', 'warning');
            return;
        }

        try {
            if (editingStaff) {
                await staffService.updateStaff(editingStaff.id, formData);
                Swal.fire('Actualizado', 'Empleado actualizado correctamente', 'success');
            } else {
                await staffService.createStaff(formData);
                Swal.fire('Creado', 'Empleado creado correctamente', 'success');
            }
            handleCloseModal();
            loadStaff();
        } catch (error) {
            console.error('Error al guardar:', error);
            Swal.fire('Error', 'Error al guardar el empleado', 'error');
        }
    };

    const handleDelete = async (id, name) => {
        const result = await Swal.fire({
            title: '¿Eliminar empleado?',
            text: `Se eliminará a "${name}" del sistema`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            try {
                await staffService.deleteStaff(id);
                Swal.fire('Eliminado', 'Empleado eliminado', 'success');
                loadStaff();
            } catch (error) {
                console.error('Error al eliminar:', error);
                Swal.fire('Error', 'No se pudo eliminar el empleado', 'error');
            }
        }
    };

    const toggleActive = async (staffMember) => {
        try {
            await staffService.updateStaff(staffMember.id, {
                ...staffMember,
                active: !staffMember.active
            });
            loadStaff();
        } catch (error) {
            console.error('Error al cambiar estado:', error);
        }
    };

    const getRoleBadge = (role) => {
        const roles = {
            admin: { icon: '⭐', label: 'Administrador', class: 'role-admin' },
            gerente: { icon: '👔', label: 'Gerente', class: 'role-gerente' },
            cajero: { icon: '🛒', label: 'Cajero', class: 'role-cajero' }
        };
        return roles[role] || roles.cajero;
    };

    if (loading) return <div className="loading-state">Cargando empleados...</div>;

    return (
        <div className="user-manager-container">
            <header className="manager-header">
                <div>
                    <div className="header-badge">Control de Personal</div>
                    <h2>Gestión de Usuarios</h2>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        Administra los accesos y roles del sistema
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => {
                            document.documentElement.classList.toggle('dark');
                            localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
                        }}
                        className="hidden md:flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md transition-all text-slate-600 dark:text-slate-300 font-bold text-xs"
                    >
                        <span className="material-icons-outlined text-[18px]">dark_mode</span>
                        <span>Modo Oscuro</span>
                    </button>
                    <button className="btn-primary" onClick={() => handleOpenModal()}>
                        + Nuevo Empleado
                    </button>
                </div>
            </header>

            <div className="user-list-card">
                {staff.length === 0 ? (
                    <div className="empty-state">
                        <p>No hay empleados registrados</p>
                        <small>Haz clic en "Nuevo Empleado" para agregar uno</small>
                    </div>
                ) : (
                    <table className="user-table">
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Rol</th>
                                <th>PIN</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {staff.map(s => {
                                const roleBadge = getRoleBadge(s.role);
                                return (
                                    <tr key={s.id}>
                                        <td>{s.name}</td>
                                        <td>
                                            <span className={`role-badge ${roleBadge.class}`}>
                                                {roleBadge.icon} {roleBadge.label}
                                            </span>
                                        </td>
                                        <td>
                                            <code className="pin-display">****</code>
                                        </td>
                                        <td>
                                            <span
                                                className={`status-badge ${s.active ? 'active' : 'inactive'}`}
                                                onClick={() => toggleActive(s)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                {s.active ? '✓ Activo' : '✗ Inactivo'}
                                            </span>
                                        </td>
                                        <td className="actions-cell">
                                            <button
                                                className="btn-edit"
                                                onClick={() => handleOpenModal(s)}
                                            >
                                                Editar
                                            </button>
                                            <button
                                                className="btn-delete"
                                                onClick={() => handleDelete(s.id, s.name)}
                                            >
                                                Eliminar
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>{editingStaff ? 'Editar Empleado' : 'Nuevo Empleado'}</h3>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Nombre completo *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: Juan Pérez"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Rol</label>
                                <select
                                    value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                                >
                                    <option value="cajero">🛒 Cajero (Solo ventas)</option>
                                    <option value="gerente">👔 Gerente (Ventas + Reportes)</option>
                                    <option value="admin">⭐ Administrador (Acceso total)</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>PIN de acceso * (4-6 dígitos)</label>
                                <input
                                    type="password"
                                    required
                                    maxLength="6"
                                    placeholder="Ej: 1234"
                                    value={formData.pin}
                                    onChange={e => setFormData({
                                        ...formData,
                                        pin: e.target.value.replace(/\D/g, '')
                                    })}
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={handleCloseModal}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn-primary">
                                    {editingStaff ? 'Guardar Cambios' : 'Crear Empleado'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
