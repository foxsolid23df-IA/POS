# Análisis Profesional - Función de Inicio de Sesión

## 1. Overview del Sistema

El proyecto NEXUM POS implementa un sistema de autenticación dual:

| Plataforma | Método | Tecnología | Ubicación |
|------------|--------|-------------|------------|
| Web/Exe | Email + Password | Supabase Auth | Login.jsx + useAuth.jsx |
| POS Interno | PIN numérico | SQLite local + JWT | userRoutes.js + authService.js |

---

## 2. Flujo Actual - Login Web/Exe (Email + Password)

### 2.1 Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────────────────┐
│                        LOGIN WEB / EXE                              │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │  Login.jsx (UI)     │
                         │  - email            │
                         │  - password         │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │  useAuth.login()    │
                         │  (authService.js)   │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │  Supabase Auth       │
                         │  signInWithPassword │
                         └──────────┬──────────┘
                                    │
                          ┌─────────┴─────────┐
                          │                   │
                     ✓ SUCCESS            ✗ FAILED
                          │                   │
                          ▼                   ▼
                   ┌─────────────┐    ┌────────────────┐
                   │ JWT Token    │    │ Error Message  │
                   │ + User       │    │ + Audit Log    │
                   └─────────────┘    └────────────────┘
                          │
                          ▼
                   ┌─────────────┐
                   │ fetchProfile │
                   │ (tabla:      │
                   │  profiles)   │
                   └─────────────┘
```

### 2.2 Código Involucrado

| Archivo | Responsabilidad |
|---------|-----------------|
| `frontend/src/components/auth/Login.jsx` | UI del formulario |
| `frontend/src/hooks/useAuth.jsx:196-208` | Función login() |
| `frontend/src/utils/authService.js:4-17` | Llamada HTTP al API |
| `supabase` | Auth provider (email/password) |

---

## 3. Flujo Actual - Login POS (PIN)

### 3.1 Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────────────────┐
│                          LOGIN POS (PIN)                           │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │  LockScreen.jsx     │
                         │  - Input PIN        │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │  authService.login  │
                         │  (pin)              │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │  POST /api/users/   │
                         │  login              │
                         │  (userRoutes.js)    │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │  Rate Limiter       │
                         │  + Delay Anti-BF    │
                         └──────────┬──────────┘
                                    │
                          ┌─────────┴─────────┐
                          │                   │
                     ✓ SUCCESS            ✗ FAILED
                          │                   │
                          ▼                   ▼
                   ┌─────────────┐    ┌────────────────┐
                   │ JWT Token    │    │ SystemLog      │
                   │ + User Data  │    │ (AUDIT)        │
                   └─────────────┘    └────────────────┘
```

### 3.2 Código Involucrado

| Archivo | Responsabilidad |
|---------|-----------------|
| `backend/routes/userRoutes.js:21-87` | Endpoint POST /login |
| `backend/middleware/rateLimiter.js` | Rate limiting + delay |
| `backend/middleware/validation.js` | Validación de PIN |
| `backend/models/User.js` | Modelo con comparePin() |

---

## 4. Problemas Identificados

### 4.1 Seguridad

| # | Problema | Severidad | Impacto |
|---|----------|-----------|---------|
| 1 | **PIN en texto plano en DB** | ALTA | Si alguien accede a la DB, puede ver todos los PINs |
| 2 | **Iteración lineal en login PIN** | MEDIA | `for (const user of users)` evalúa uno por uno - lento con muchos usuarios |
| 3 | **Sin hashing de contraseña en frontend** | MEDIA | Dependencia total de Supabase |
| 4 | **JWT sin refresh token** | MEDIA | Token expira en 24h sin renovación automática |

### 4.2 UX/UI

| # | Problema | Severidad |
|---|----------|-----------|
| 1 | **Sin "Recordarme"** | BAJA |
| 2 | **Olvidé mi contraseña no implementado** | ALTA |
| 3 | **Sin 2FA/MFA** | MEDIA |

### 4.3 Arquitectura

| # | Problema | Severidad |
|---|----------|-----------|
| 1 | **Dos sistemas de auth diferentes** | MEDIA |
| 2 | **No hay logout global en Supabase** | BAJA |

---

## 5. Propuestas de Mejora - Pseudocódigo

### 5.1 Mejorar Seguridad del PIN (Hashing)

**PROBLEMA:** PIN almacenado sin hashing

**SOLUCIÓN:** Implementar bcrypt o similar

```pseudocode
// ACTUAL (backend/models/User.js)
comparePin(inputPin) {
    return this.pin === inputPin;  // ❌ Peligroso
}

// MEJORADO
comparePin(inputPin) {
    return bcrypt.compare(inputPin, this.pin_hash);  // ✓ Seguro
}
```

**Migration necesaria:**
```pseudocode
PARA cada usuario EN users:
    pin_hash = bcrypt.hash(pin_actual, 12)
    actualizar(pin_hash)
```

---

### 5.2 Optimizar Búsqueda de Usuario (Índice)

**PROBLEMA:** Iteración lineal O(n)

**SOLUCIÓN:** Crear índice y buscar por ID único

```pseudocode
// ACTUAL (backend/routes/userRoutes.js)
PARA cada usuario EN users:
    SI user.comparePin(pin) == true:
        RETURN usuario  // O(n) - lento

// MEJORADO con hash look-up
buscarUsuarioPorPin(pin):
    pin_hash = bcrypt.hash(pin, 12)
    usuario = buscarEnDB("SELECT * FROM users WHERE pin_hash = ?", pin_hash)
    SI usuario:
        RETURN usuario
    RETURN null
```

---

### 5.3 Implementar "Olvidé mi Contraseña"

```pseudocode
FUNCION forgotPassword(email):
    usuario = buscarEnSupabasePorEmail(email)
    SI usuario EXISTE:
        generarTokenReset = crypto.randomBytes(32)
        guardarTokenEnDB(usuario.id, token, expira=1hora)
        enviarEmail(email, "reset-link.com?token=" + token)
        RETURN "Email enviado"
    SI NO:
        RETURN "Si el email existe, recibirá instrucciones"  // No revelar existencia

FUNCION resetPassword(token, nuevaPassword):
    datos = buscarTokenEnDB(token)
    SI datos.expira <ahora():
        RETURN "Token expirado"
    SI NO:
        actualizarPasswordSupabase(datos.usuario_id, nuevaPassword)
        eliminarTokenEnDB(token)
        RETURN "Password actualizado"
```

---

### 5.4 Implementar Refresh Token

```pseudocode
FUNCION refreshToken(refreshToken):
    decoded = jwt.verify(refreshToken, SECRET)
    usuario = buscarEnDB(decoded.userId)
    SI usuario AND refreshToken == usuario.refresh_token:
        nuevoAccessToken = jwt.sign(
            { id: usuario.id, role: usuario.role },
            SECRET,
            { expiresIn: "15m" }
        )
        RETURN { accessToken: nuevoAccessToken }
    SI NO:
        RETURN 401 Unauthorized
```

---

### 5.5 Unificar Sistema de Auth (Proposal)

**Problema:** Dos sistemas diferentes (email/password vs PIN)

**SOLUCIÓN:** Crear capa unificada

```pseudocode
INTERFACE AuthProvider:
    METODO authenticate(credentials) -> Token
    METODO validateToken(token) -> User
    METODO logout(token) -> Void

CLASE SupabaseAuth IMPLEMENTS AuthProvider:
    METODO authenticate({email, password}):
        resultado = supabase.auth.signInWithPassword(email, password)
        RETURN resultado.token

    METODO authenticate({pin, deviceId}):
        // Delegar al endpoint interno
        resultado = POST /api/users/login {pin}
        RETURN resultado.token

    METODO validateToken(token):
        resultado = supabase.auth.getUser(token)
        RETURN resultado.user

    METODO logout(token):
        supabase.auth.signOut(token)
```

---

## 6. Plan de Implementación Priorizado

| Prioridad | Tarea | Complejidad | Impacto |
|-----------|-------|-------------|---------|
| 🔴 ALTA | Implementar hashing de PIN (bcrypt) | Media | Seguridad |
| 🔴 ALTA | "Olvidé mi contraseña" | Alta | UX |
| 🟡 MEDIA | Índice para búsqueda de PIN | Baja | Performance |
| 🟡 MEDIA | Refresh tokens | Media | UX |
| 🟢 BAJA | Unificar sistemas de auth | Alta | Arquitectura |

---

## 7. Recomendaciones Finales

1. **Para el Login Web/Exe:** El flujo actual con Supabase Auth es correcto. Añadir "Olvidé mi contraseña" es prioritario.

2. **Para el Login POS (PIN):** La validación en servidor está bien pero el hashing es crítico.

3. **Documentación:** Crear un AUTH.md separando las responsabilidades de cada sistema.

---

*Documento generado: 2026-05-08*
*Proyecto: NEXUM POS*