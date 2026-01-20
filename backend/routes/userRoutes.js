const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { authMiddleware, isAdmin } = require('../middleware/authMiddleware');

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_123';

// Login con PIN
router.post('/login', async (req, res) => {
    try {
        const { pin } = req.body;
        console.log(`🔑 Intento de login con PIN: ${pin}`);

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
            return res.status(401).json({ message: 'PIN incorrecto' });
        }

        const token = jwt.sign(
            { id: authenticatedUser.id, name: authenticatedUser.name, profile: authenticatedUser.profile },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

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
router.post('/', authMiddleware, isAdmin, async (req, res) => {
    try {
        const { name, profile, pin } = req.body;

        if (!name || !profile || !pin) {
            return res.status(400).json({ message: 'Faltan campos obligatorios' });
        }

        if (pin.length < 4 || pin.length > 6) {
            return res.status(400).json({ message: 'El PIN debe tener entre 4 y 6 dígitos' });
        }

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
router.delete('/:id', authMiddleware, isAdmin, async (req, res) => {
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

module.exports = router;
