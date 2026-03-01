const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Acceso denegado. Token no proporcionado.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key_123');
        req.user = decoded;
        next();
    } catch (error) {
        res.status(403).json({ message: 'Token inválido o expirado.' });
    }
};

const isAdmin = (req, res, next) => {
    if (req.user && req.user.profile === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Acceso denegado. Se requiere perfil de administrador.' });
    }
};

module.exports = { authMiddleware, isAdmin };
