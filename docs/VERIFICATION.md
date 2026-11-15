# Verificación vigente — Earth Explorer inmersivo

La corrección actual se documenta en [INFORME_EXPLORER_INMERSIVO.md](../INFORME_EXPLORER_INMERSIVO.md).

- Build Angular de producción correcto, sin advertencias de presupuesto.
- 37 pruebas frontend aprobadas y 45 pruebas backend aprobadas.
- Probados estados de paneles, conservación de componentes y coordenadas, selección A/B y geometría de cámara para seis relaciones de aspecto.
- **Pendiente:** inspección visual y WebGL real. El navegador remoto no pudo acceder al servidor local. No se declara comprobado el centrado en una captura ni la ausencia de desbordamientos reales.
- APIs externas no consultadas de nuevo en esta corrección; véase la evidencia de la entrega anterior abajo.

## Registro de la entrega anterior (histórico)

# Verificación de la entrega — 15 de noviembre de 2026

Este documento describe la verificación de esta versión, no una certificación visual o de dispositivos.

## Resultados ejecutados

| Comprobación | Resultado |
| --- | --- |
| Instalación frontend, `npm ci --no-audit --no-fund` | Correcta, lockfile conservado |
| `npm run build` de producción | Correcta, sin errores ni advertencias de presupuesto Angular |
| `npm test -- --watch=false` | 33 pruebas, 9 archivos; todas correctas |
| Instalación de `backend/requirements.txt` | Correcta, Python 3.12 |
| `python -m pytest -q` | 45 pruebas correctas; una advertencia de deprecación Starlette/httpx |
| FastAPI TestClient → `/health` | HTTP 200 |
| FastAPI TestClient → `/api/v1/thermal/sources` | HTTP 200; NOAA disponible, MERRA-2 no importado |
| FastAPI TestClient → NOAA, 2024-06-15 | HTTP 200; 18 048 celdas válidas, cuadrícula real incluida en el proyecto |
| FastAPI TestClient → NASA POWER, 19.845 / −90.523, 2020–2023 | HTTP 200; serie anual recibida y análisis calculado sin mocks |

La consulta corta a NASA POWER es una comprobación técnica, no una conclusión climática. El paquete auxiliar `socksio` se instaló solo para el proxy del entorno de verificación; no es una nueva dependencia de la aplicación.

## Alcance de las pruebas

Se conservaron las pruebas de calidad de datos, análisis estadístico, comparaciones, exportación, raster térmico, coordenadas y ciclo de vida de las texturas. Se corrigió la configuración del test raíz para proporcionar el router. Se añadieron pruebas de controles térmicos plegables/Retry y limpieza del estado al editar coordenadas. Las pruebas con servicios simulados comprueban comportamiento de software; no demuestran disponibilidad de proveedores.

## Limitaciones pendientes

- No se completó inspección visual del resultado en navegador. Chromium local falló al crear un socket (`Operation not permitted`), el servidor de desarrollo encontró un error al enumerar interfaces de red y el navegador remoto no pudo acceder a localhost. No se generaron capturas del rediseño ni se presentan las capturas antiguas como evidencia nueva.
- No están comprobados de extremo a extremo el arrastre WebGL, zoom, picking A/B, long-press, render térmico, pantalla completa, descarga CSV/PNG ni los menús en un dispositivo real. La lógica existente y sus pruebas unitarias se conservan; eso no sustituye la revisión visual.
- El diseño incluye breakpoints para móvil, tablet y escritorio, pero no se certifica ausencia de desbordamientos sin inspección real.
- NOAA se comprobó con un día real ya incluido; no se comprobó la descarga remota de un nuevo día NOAA.
- MERRA-2 sigue requiriendo importación de datos por el mecanismo existente. No se habilita ficticiamente.
- No se desplegó ni modificó Render o Vercel. La prueba FastAPI fue en proceso, no una prueba HTTP desde el navegador ni una comprobación de CORS desplegado.

## Revisión manual reproducible

1. Iniciar backend y frontend según el README; abrir `/`, `/explorer` y `/dashboard`.
2. Probar anchos 390, 768, 1024 y 1440 px; verificar scroll, textos, menú móvil y foco con Tab/Escape.
3. En Explorer, alternar Surface/Thermal; abrir Source, date & opacity; variar fecha y opacidad, comprobar error y Retry.
4. Arrastrar, ampliar, restablecer vista; seleccionar A y B por doble clic y long-press. Comparar coordenadas con los campos del formulario.
5. Ejecutar una serie histórica; comparar periodos y ubicaciones, ampliar gráfica, usar pantalla completa, descargar CSV/PNG.
6. Activar reducción de movimiento del sistema y comprobar video, animaciones y nubes.
7. Probar las APIs desde el despliegue real, incluida su configuración CORS.

La entrega queda técnicamente compilada y probada dentro de este alcance. Los criterios de aceptación visual e interacción real siguen pendientes de esta revisión.
