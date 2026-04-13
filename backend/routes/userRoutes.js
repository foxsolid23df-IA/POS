const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { authMiddleware, isAdmin } = require('../middleware/authMiddleware');
const { loginRateLimiter, loginDelay } = require('../middleware/rateLimiter');
const SystemLog = require('../models/SystemLog');
const {
    validateLoginPin,
    validateCreateUser,
    validatePinChange,
    validateAdminResetPin,
    validateId
} = require('../middleware/validation');

// JWT_SECRET se obtiene exclusivamente de variables de entorno
// (validado en index.js al iniciar el servidor)
const JWT_SECRET = process.env.JWT_SECRET;

// Login con PIN (con rate limiting y delay anti-fuerza bruta)
router.post('/login', loginRateLimiter, loginDelay, validateLoginPin, async (req, res) => {
    try {
        const { pin } = req.body;
        // Log seguro: nunca registrar el PIN completo
        console.log('🔑 Intento de login recibido');

        if (!pin) return res.status(400).json({ message: 'Se requiere un PIN' });

        const users = await User.findAll({ where: { active: true } });
        let authenticatedUser = null;

        for (const user of users) {
            const match = await user.comparePin(pin);
            if (match) {
                authenticatedUser = user;
                break;
            }
        }

        if (!authenticatedUser) {
            // Registrar intento fallido en auditoría
            try {
                await SystemLog.create({
                    action: 'LOGIN_FAILED',
                    module: 'AUTH',
                    details: JSON.stringify({ reason: 'PIN incorrecto' }),
                    ip: req.ip || req.connection?.remoteAddress || 'unknown',
                    userAgent: req.headers['user-agent'] || 'unknown'
                });
            } catch (logErr) {
                // No interrumpir el flujo si falla el log de auditoría
                console.error('⚠️ Error registrando login fallido:', logErr.message);
            }
            return res.status(401).json({ message: 'PIN incorrecto' });
        }

        const token = jwt.sign(
            { id: authenticatedUser.id, name: authenticatedUser.name, profile: authenticatedUser.profile },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Registrar login exitoso en auditoría
        try {
            await SystemLog.create({
                action: 'LOGIN_SUCCESS',
                module: 'AUTH',
                details: JSON.stringify({ userId: authenticatedUser.id, profile: authenticatedUser.profile }),
                ip: req.ip || req.connection?.remoteAddress || 'unknown',
                userAgent: req.headers['user-agent'] || 'unknown'
            });
        } catch (logErr) {
            console.error('⚠️ Error registrando login exitoso:', logErr.message);
        }

        res.json({
            token,
            user: {
                name: authenticatedUser.name,
                profile: authenticatedUser.profile
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// Listar usuarios (Admin only)
router.get('/', authMiddleware, isAdmin, async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: ['id', 'name', 'profile', 'active', 'createdAt']
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener usuarios' });
    }
});

// Crear usuario (Admin only)
router.post('/', authMiddleware, isAdmin, validateCreateUser, async (req, res) => {
    try {
        const { name, profile, pin } = req.body;

        const newUser = await User.create({ name, profile, pin });
        res.status(201).json({
            id: newUser.id,
            name: newUser.name,
            profile: newUser.profile
        });
    } catch (error) {
        res.status(500).json({ message: 'Error al crear usuario' });
    }
});

// Eliminar/Desactivar usuario (Admin only)
router.delete('/:id', authMiddleware, isAdmin, validateId, async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

        // No permitir eliminarse a sí mismo
        if (user.id === req.user.id) {
            return res.status(400).json({ message: 'No puedes eliminar tu propio perfil' });
        }

        await user.destroy();
        res.json({ message: 'Usuario eliminado' });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar usuario' });
    }
});

// ── Cambiar PIN propio (autenticado) ──────────────────────────
router.put('/me/pin', authMiddleware, validatePinChange, async (req, res) => {
    try {
        const { currentPin, newPin } = req.body;

        const user = await User.findByPk(req.user.id);
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

        const match = await user.comparePin(currentPin);
        if (!match) {
            return res.status(401).json({ message: 'PIN actual incorrecto' });
        }

        user.pin = newPin;
        await user.save();
        res.json({ message: 'PIN actualizado correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al cambiar el PIN' });
    }
});

// ── Resetear PIN de un usuario (Admin only) ───────────────────
router.put('/:id/pin', authMiddleware, isAdmin, validateId, validateAdminResetPin, async (req, res) => {
    try {
        const { newPin } = req.body;

        const targetUser = await User.findByPk(req.params.id);
        if (!targetUser) return res.status(404).json({ message: 'Usuario no encontrado' });

        targetUser.pin = newPin;
        await targetUser.save();
        res.json({ message: `PIN del usuario ${targetUser.name} actualizado correctamente` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al resetear el PIN' });
    }
});

module.exports = router;
