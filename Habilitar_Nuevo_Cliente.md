# 🎫 Generación de Nuevo Código de Invitación

Tras realizar un **Reset de Fábrica**, el sistema queda totalmente vacío. Para que un nuevo cliente pueda registrar su cuenta de administrador, debes generar un código de invitación directamente en la base de datos de Supabase.

## Pasos para habilitar un nuevo cliente:

1. Entra a tu panel de **Supabase** -> **SQL Editor**.
2. Ejecuta el siguiente comando (puedes cambiar `NUEVO-CLIENTE-2026` por el código que desees):

```sql
INSERT INTO public.invitation_codes (code, expires_at)
VALUES ('NUEVO-CLIENTE-2026', now() + interval '30 days');
```

3. Entrega este código al cliente.
4. El cliente debe entrar a: `http://tudominio.com/#/register/NUEVO-CLIENTE-2026`
5. Al completar el registro, esa nueva cuenta será la **Administradora** del sistema.

---

_Nota: Recuerda que tras un Reset de Fábrica, la cuenta anterior (admin@admin.com) ya no existe._
