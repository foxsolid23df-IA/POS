# Integración de API Facturador.com (Facturación Electrónica CFDI 4.0)

Este plan detalla la arquitectura para integrar la emisión de facturas CFDI 4.0 usando **NEXUM POS** y la API de **Facturador.com** en un modelo JSON RESTful. Todo el proceso está planeado para la fase de Sandbox usando las credenciales demo.

## User Review Required

> [!IMPORTANT]
> - **Autenticación en la Nube**: Facturador.com usa un esquema seguro de OAuth (Access Token) con vigencia de 1 hora (3600s) y soporte para Refresh Tokens. Necesitaremos almacenar eficientemente el `access_token` temporal, el `refresh_token` de larga vida y el `emisorid`. Todo esto se guardará cifrado en la configuración de la sucursal de tu BD en Supabase.
> - **Transformación de Datos**: Las notas (tickets) de NEXUM POS que generan ventas, tendrán que empatarse correctamente con los nodos del requerimiento 4.0 (Ingreso o Público en General).

## Proposed Changes

### Database (Supabase)

#### [MODIFY] `profiles`
Añadir y extender campos para el manejo de sesión continua de Facturador.com:
- `emisor_rfc` (text - Ej. GOYA780416GM0 para pruebas)
- `emisor_id_facturador` (bigint - Obtenido de `/connect/userinfo`)
- `facturador_api_user` (text)
- `facturador_api_pass_md5` (text)
- `facturador_client_id` (text)
- `facturador_client_secret` (text)
- `facturador_refresh_token` (text - Se actualiza en cada sesión de factura expirada)

#### [NEW] `clients`
Tabla para clientes a facturarles:
- Campos: `id`, `rfc`, `razon_social`, `uso_cfdi`, `regimen_fiscal`, `codigo_postal`, `email`.

#### [NEW] `invoices` (Facturas)
Relación Venta a Factura:
- Campos: `id`, `sale_id`, `uuid_cfdi`, `emisor_rfc`, `cliente_rfc`, `pdf_url`, `xml_url`, `status`.

---

### Backend (Supabase Edge Functions)
El núcleo de la integración se ejecutará en las Edge Functions para proteger las claves maestras.

#### Flujo Lógico de las Funciones Serverless:
1. **Helper `getFacturadorToken()`**:
   - Revisa si hay un token válido en caché (o base de datos).
   - Sí la vigencia (3600s) expiró, llama a `https://authcli.stagefacturador.com/connect/token` mediante `grant_type=refresh_token`. Al obtenerlo, actualiza en la tabla `profiles`.
2. **Helper `getEmisorId()`**:
   - Si no está guardado, llama a `https://authcli.stagefacturador.com/connect/userinfo` inyectando `Authorization: Bearer <access_token>` para capturar el `emisorid`.
3. **Función Principal `timbrar-cfdi`**:
   - Recibe la venta completa desde el POS (`sale_id`, arreglo de items, total_impuestos).
   - Consume ambos Helpers para conseguir los tokens.
   - Construye dinámicamente el `JSON` con el layout oficial CFDI 4.0.
   - Ejecuta el envío al endpoint de timbrado.
   - Guarda el Response (PDF (Base64), XML (String) en un repositorio del *Supabase Storage* como un archivo estático).
   - Vincula las URLs retornadas en la tabla `invoices`.

---

### Frontend (React + Vite)
El usuario manejará facturación sin interrumpir su punto de venta.

#### 1. Módulo "Ajustes > Facturación" (`TerminalSetup.jsx`)
- Integrar la UI para vaciar los datos de acceso (Usuario, Password, Client ID, Client Secret, Modo Pruebas/Productivo).

#### 2. Módulo "Clientes Fiscales"
- Pequeño CRUD visual para ir poblando el catálogo de receptores o "Público General".

#### 3. Modal Emitir Módulo "Ventas / Historial"
- Botón "Emitir Factura" que:
  - Presente Autocompletado del Cliente.
  - Valide si los datos totales del Ticket vs el Catálogo SAT (Método de de Pago: PUE).
  - Lanzar el "Loading..." pidiendo respuesta a Supabase Edge Functions.

#### 4. Módulo de Archivo Fiscal ("Facturas Emitidas")
- Listado que lee de la tabla `invoices`.
- Opción rápida para "Mostrar XML", "Imprimir Ticket PDF del SAT".
- Disponer de "Solicitar Cancelación" (La cual no descuenta folios según la documentación).

## Verification Plan

### Ambiente de Pruebas (Test Enviroment)
Utilizaremos las credenciales exactas proporcionadas para validar:
- **Usuario**: `GOYA780416GM0`, **Pass**: `20b03da6247eb1ba4a04c3bda7285c94`. 
- Nos aseguraremos que las respuestas HTTP 200 de la petición POST entreguen el access token. Se construirá un script local para validar que la conexión base esté certificada antes de construir los componentes de React a su alrededor.
