> Registro de la primera entrega. Para la versión actual del Explorer, consultar [INFORME_EXPLORER_INMERSIVO.md](INFORME_EXPLORER_INMERSIVO.md).

# EarthTrend NASA — Rediseño integral

Equipo Feynman · Entrega del 15 de noviembre de 2026

## Trabajo realizado

Se modificó el proyecto adjunto, conservando Angular standalone, las rutas Home/Explorer/Dashboard, los servicios HTTP, modelos, worker térmico, Three.js, Chart.js y el backend científico. No se cambiaron contratos API ni se añadieron datos climáticos simulados.

### Identidad y estructura

- Sistema visual carbón `#101212`, grafito `#191c1c`, texto suave `#f1f2ed` y acento discreto `#c4cdb5`. Tokens en `frontend/src/styles.css` y componentes científicos compartidos en `src/styles/scientific.css`.
- Tipografía de sistema sin dependencia de Google Fonts, divisores finos, formularios legibles, foco visible y reducción de movimiento.
- Navegación y footer únicos para todas las rutas. Estado activo accesible, menú móvil y cierre con Escape. Se elimina la suscripción de navegación al destruir el componente.
- Plantillas y estilos grandes extraídos de TypeScript a archivos HTML/CSS para conservar responsabilidades separadas. Código frontend formateado con Prettier.

### Home

Portada editorial cinematográfica con el video existente, selección de video móvil y un póster extraído del propio video. Control de pausa y respeto a reducción de movimiento. Secciones nuevas sobre exploración, proceso de análisis y fuentes. Se conserva el Explorer real con carga diferida. El dashboard tiene ahora una entrada editorial y acceso a su ruta completa, evitando montar dos espacios de análisis repetidos en la misma portada.

### Explorer

Composición en tres columnas: paneles oscuros semitransparentes y área central dedicada al globo, sin paneles superpuestos permanentemente sobre el planeta. En tablet/móvil los paneles pasan debajo. El modo inmersivo mantiene el canvas centrado y permite restaurar paneles.

La cámara se ajusta matemáticamente al ángulo de visión vertical/horizontal y al radio de la esfera. ResizeObserver actualiza cámara y renderer y conserva el factor de zoom relativo. No se estira el canvas con transformaciones CSS. Se conservan las texturas, nubes, atmósfera, fronteras, selección y marcadores A/B. Los colores cyan/naranja de esos marcadores distinguen datos y corresponden a las series científicas.

Los controles térmicos son un panel flotante compacto con opciones plegables. Fuente, fecha y opacidad siguen disponibles; errores y Retry permanecen accesibles fuera del desplegable. La escala científica, unidades, extremos saturados, ausencia de datos y procedencia se conservan. No se modificó el mapeo de temperaturas a colores.

Se alinea la coordenada inicial mostrada con el marcador existente de Campeche. Cambiar coordenadas manualmente cancela peticiones antiguas y limpia resultados previos para no atribuir un análisis a otra ubicación.

### Dashboard y análisis

Composición más abierta, gráfica y métricas separadas por divisores, formularios y comparaciones con el mismo sistema visual. Se conservan consultas NASA POWER, análisis, comparación temporal y A/B, expansión, pantalla completa y exportaciones. Los colores de series y leyendas permanecen científicos; se retiraron fondos y bordes azules decorativos. La animación Chart.js respeta reducción de movimiento.

## Pruebas y límites

Producción Angular compilada sin errores ni advertencias de presupuesto. 33 pruebas frontend y 45 backend correctas. Verificación en proceso de health, fuentes, cuadrícula NOAA incluida y consulta NASA POWER real. El detalle y las limitaciones están en [docs/VERIFICATION.md](docs/VERIFICATION.md).

No se declara completada la validación visual ni la interacción real de WebGL: los navegadores disponibles no pudieron ejecutar/acceder a la aplicación local. Es necesario hacer la revisión manual indicada antes de aceptar todos los criterios visuales del encargo.

## Instalación

Se conservan `package.json`, ambos lockfiles, configuración Angular, proxy local, archivos Vercel, requisitos Python, videos, texturas y ejemplos NOAA reales. No se añadieron dependencias de producción.

Desde la carpeta del proyecto, PowerShell:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

En otra terminal:

```powershell
cd frontend
npm ci
npm start
```

Abrir `http://localhost:4200`. La API local se enruta mediante el proxy existente; en producción sigue usando la URL Render definida en `frontend/src/app/core/services/api-url.ts`.

## Contenido de entrega

ZIP completo con frontend, backend, recursos, pruebas e informe. Se excluyen node_modules, .angular, .git, .venv, __pycache__, dist, cachés, archivos .env y materiales temporales de la verificación. Las capturas antiguas en `public/prueba` pertenecían al ZIP de entrada; no son capturas del nuevo diseño.
