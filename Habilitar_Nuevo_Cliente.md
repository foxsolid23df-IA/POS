# 🎫 Gestión de Licencias y Clientes

El sistema ahora cuenta con un **Portal Web de SuperAdministrador** profesional que permite generar códigos de invitación y extender licencias vencidas sin tener que entrar a la base de datos de Supabase.

## A. Acceder al Portal de SuperAdministración

1. Ingresa a la url: `http://tudominio.com/#/superadmin`
2. Si es la primera vez que configuras un Super Administrador, necesitas añadir el correo de ese administrador a la lista blanca de la base de datos (ver sección B).
3. Inicia sesión con el correo y la clave maestra.
4. Una vez dentro, verás un listado visual de clientes ("Directorio de Licencias"), donde podrás saber quién está activo y quién vencido.

## B. Configurar tu primer correo como Super Admin (Solo por única vez)

Para que un correo pueda entrar a este panel:

1. El correo ya debe existir en tu portal (puedes registrarte normalmente si no existe o usar alguno).
2. Entra a tu panel de **Supabase** -> **SQL Editor**.
3. Ejecuta el siguiente comando con tu correo electrónico personal real (el que usarás para loguearte como dueño/admin supremo):

```sql
INSERT INTO public.super_admins (email)
VALUES ('tu-correo-real@gmail.com');
```

## C. Habilitar a un Nuevo Cliente

1. Entra a `http://tudominio.com/#/superadmin`
2. Presiona el botón verde/azul **"Nuevo Cliente"**.
3. Ingresa un nombre para el código (ej. `NUEVO-CLIENTE-2026`) y su tiempo de validez (ej. 30 días o 1 año).
4. Entrega este código al cliente.
5. El cliente debe entrar a: `http://tudominio.com/#/register/NUEVO-CLIENTE-2026` y creará la cuenta principal de su tienda.

## D. Reactivar Licencia a Clientes Vencidos

1. Ve a la tabla de licencias en el Portal SuperAdmin (`/#/superadmin`).
2. Localiza al cliente con el texto en rojo **"Vencida"**.
3. Presiona el botón que dice **"Reactivar (30d)"** o utilízalo para añadirles tiempo preaprobado a su licencia. El portal hará todo automáticamente.
