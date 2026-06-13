---
name: Nexum POS Design System
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#bbc9ca'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#859394'
  outline-variant: '#3c494a'
  surface-tint: '#3edae3'
  primary: '#45dee7'
  on-primary: '#003739'
  primary-container: '#00c2cb'
  on-primary-container: '#004a4e'
  inverse-primary: '#00696e'
  secondary: '#b6c6f0'
  on-secondary: '#1f3051'
  secondary-container: '#364669'
  on-secondary-container: '#a4b5dd'
  tertiary: '#2adef8'
  on-tertiary: '#00363e'
  tertiary-container: '#00c1d8'
  on-tertiary-container: '#004a54'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6bf6ff'
  primary-fixed-dim: '#3edae3'
  on-primary-fixed: '#002022'
  on-primary-fixed-variant: '#004f53'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#b6c6f0'
  on-secondary-fixed: '#071b3b'
  on-secondary-fixed-variant: '#364669'
  tertiary-fixed: '#9fefff'
  tertiary-fixed-dim: '#1edaf3'
  on-tertiary-fixed: '#001f24'
  on-tertiary-fixed-variant: '#004e59'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  headline-xl:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 40px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 64px
---

## Estilo y Personalidad de Marca
El sistema de diseño para Nexum POS se define por una estética **Corporativa Moderna** con influencias tecnológicas sutiles. La narrativa visual se centra en la eficiencia, la interconectividad y la precisión técnica, evocando una respuesta emocional de seguridad y vanguardia.

El diseño utiliza una base oscura premium para resaltar los datos críticos del punto de venta, permitiendo que los colores vibrantes del logotipo actúen como indicadores de acción y estado. Se prioriza la legibilidad y la reducción del ruido visual para optimizar la toma de decisiones en entornos operativos de ritmo rápido. La audiencia objetiva son empresas que buscan una solución de facturación robusta, profesional y visualmente impactante.

## Colores
La paleta se extrae directamente de la identidad visual de Nexum POS, utilizando un contraste intencional entre la profundidad del azul oscuro y la energía del cian.

- **Primario (#00C2CB):** Un cian vibrante utilizado para llamadas a la acción (CTAs), estados activos y elementos de marca principales.
- **Secundario (#1A2B4C):** Un azul profundo derivado del logotipo, utilizado para superficies de contenedores, barras de navegación y segmentación de UI.
- **Terciario (#38E5FF):** Un cian eléctrico para acentos ligeros, gradientes de conectividad y estados de hover.
- **Neutro (#0F172A):** El lienzo base. Un azul casi negro que proporciona el entorno premium necesario para que el contenido resalte sin fatiga visual.

El sistema de color debe aplicarse con una lógica de capas: el fondo más oscuro es la base, y cada nivel de elevación superior utiliza una versión ligeramente más clara del tono neutro o secundario.

## Tipografía
La tipografía refleja la precisión técnica del logotipo. Se utiliza **Hanken Grotesk** por su claridad contemporánea y geometría equilibrada, ideal para interfaces SaaS de alta densidad.

Para los elementos de datos, códigos de factura y etiquetas de sistema, se implementa **JetBrains Mono**. Esta elección monospaciada refuerza la naturaleza tecnológica de Nexum POS y garantiza que los valores numéricos se alineen perfectamente en tablas y reportes financieros. 

Todas las etiquetas deben utilizar una jerarquía clara, reservando los pesos más pesados (Bold/SemiBold) para títulos de sección y totales monetarios.

## Diseño y Espaciado
El sistema emplea una **cuadrícula fluida** basada en una unidad base de 8px. 

- **Escritorio:** Rejilla de 12 columnas con márgenes laterales de 64px para contenido centralizado. Las columnas se utilizan para organizar el panel de control (Dashboard) y las tablas de transacciones.
- **Tablet:** Rejilla de 8 columnas con márgenes de 32px. Los elementos laterales (como el menú de navegación) pueden colapsar en iconos para maximizar el área de trabajo.
- **Móvil:** Rejilla de 4 columnas con márgenes de 16px. El flujo es estrictamente vertical, con elementos táctiles de al menos 48px de altura.

El espaciado debe ser generoso alrededor de las cifras de ventas y totales para evitar errores de lectura.

## Elevación y Profundidad
En este sistema de diseño, la profundidad se comunica a través de **Capas Tonales** y **Bordes de Bajo Contraste**. 

No se utilizan sombras pesadas. En su lugar, los contenedores (Tarjetas, Paneles laterales) se distinguen del fondo mediante un ligero cambio de color hacia el tono `secondary_color_hex` o mediante un borde sutil de 1px con una opacidad del 10% en color cian.

Para elementos flotantes como modales o menús contextuales, se aplica un efecto de **Backdrop Blur** (desenfoque de fondo) que mantiene la conexión visual con la capa inferior mientras establece una jerarquía clara. Este enfoque mantiene la estética "limpia y simplificada" solicitada.

## Formas
La geometría de los elementos sigue el lenguaje del logotipo de Nexum POS, que presenta terminaciones redondeadas y fluidas. 

Se aplica un radio de curvatura de **0.5rem (8px)** para la mayoría de los componentes, como botones y campos de entrada. Las tarjetas de información y contenedores principales utilizan el nivel `rounded-lg` (16px) para suavizar la estructura general de la interfaz. Los elementos puramente funcionales como los "chips" de estado pueden utilizar el estilo pill-shaped para diferenciarse claramente de las acciones principales.

## Componentes
- **Botones:** El botón primario es de color sólido `primary_color_hex` con texto en negro o azul oscuro para máximo contraste. Los botones secundarios son delineados (outlined) en cian.
- **Campos de Entrada (Inputs):** Fondo oscuro sólido con un borde inferior o perimetral muy fino. Al recibir el foco, el borde se ilumina en cian con un resplandor sutil.
- **Tarjetas (Cards):** Superficies planas en azul secundario. Los encabezados de las tarjetas deben usar la tipografía `label-md` para consistencia.
- **Chips de Estado:** 
    - *Pagado:* Fondo cian traslúcido con texto cian sólido.
    - *Pendiente:* Fondo ámbar traslúcido.
    - *Cancelado:* Fondo carmesí traslúcido.
- **Listas de Transacciones:** Filas con separadores de 1px en baja opacidad. Los valores monetarios siempre en `JetBrains Mono` para alineación decimal perfecta.
- **Navegación:** Un panel lateral (Sidebar) persistente en el color neutro más oscuro, con iconos lineales que se rellenan de color cian cuando la sección está activa.