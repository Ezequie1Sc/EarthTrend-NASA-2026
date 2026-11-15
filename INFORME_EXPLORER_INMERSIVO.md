# Earth Explorer inmersivo — corrección del 15 de noviembre de 2026

## Cambios de esta entrega

Se trabajó sobre el proyecto rediseñado de la entrega anterior. Se conservan Home, Dashboard, servicios, contratos API, datos, métodos científicos y recursos originales.

### Escena y cámara

- Sustituida la cuadrícula de tres columnas por una sola escena de ancho completo. El canvas ocupa exactamente el contenedor de la escena en todos los estados.
- Eliminados el límite de 1100 px, `left: 50%`, `translateX` y las reglas responsive que reconstruían columnas en modo inmersivo. No hay transformaciones CSS sobre el renderer.
- Cámara calculada mediante la proyección tangente de la esfera: diámetro inicial equivalente al 84% de la dimensión limitante. En escritorio horizontal es el 84% de la altura; en móvil vertical se limita por el ancho para no recortar el planeta. La atmósfera conserva margen.
- Se mantiene ResizeObserver, actualización de aspect ratio/proyección, DPR limitado a 2 y el factor de zoom relativo en cambios reales de tamaño.
- Ocultar paneles no cambia las dimensiones del canvas ni crea otra instancia Three.js. Los formularios y comparaciones tampoco se destruyen al entrar en modo inmersivo.

### Espacio y paneles

- Fondo negro continuo con un SVG estático de 480 estrellas pequeñas, distribuidas sin un patrón repetido. Se aplica al conjunto de la escena, incluidos paneles y controles.
- Renderer transparente y eliminación del anterior campo de estrellas Three.js: un único WebGLRenderer, sin segundo canvas ni un bucle extra de animación.
- Paneles flotantes con fondo negro al 38% de opacidad, blur de 9 px, bordes blancos sutiles y esquinas suaves.
- Signals independientes para izquierda y derecha; botones persistentes para ocultar/mostrar cada uno y entrar/restaurar desde Immersive View. `[hidden]` conserva el DOM y su información.
- En pantallas de hasta 900 px los paneles empiezan cerrados y, al abrirlos, aparecen debajo del planeta. Así los bloques informativos no cubren el globo en móvil.

### Controles y selección

- Thermal/Surface siempre accesibles en un panel pequeño en la esquina superior derecha. Settings despliega título, fuente, fecha, opacidad e información científica.
- Carga, errores y Retry siguen accesibles con Settings cerrado. La leyenda conserva exactamente su escala cromática; procedencia y explicación se pueden desplegar.
- A/B permanecen accesibles en la barra superior aunque los paneles estén ocultos.
- Corregida la actualización directa del marcador A dentro del doble clic: ahora los marcadores siguen únicamente las coordenadas A/B que administra el padre. Seleccionar B no mueve A ni requiere dos dobles clics.

## Archivos principales

- `frontend/src/app/features/earth-explorer/pages/earth-explorer/earth-explorer.ts`, `.html`, `.css`, `.spec.ts`.
- `frontend/src/app/features/earth-explorer/components/earth-globe/earth-globe.ts`, `.html`, `.css`, `.spec.ts`.
- `frontend/src/app/features/earth-explorer/components/thermal-controls/thermal-controls.ts`, `.html`, `.css`, `.spec.ts`.
- `frontend/src/styles/scientific.css`.
- `frontend/public/textures/space-stars.svg`.
- Documentación de entrega y verificación.

## Verificación

- Angular: build de producción correcto, sin errores ni advertencias de presupuesto.
- Frontend: 37 pruebas correctas en 9 archivos.
- Backend: 45 pruebas correctas; advertencia de deprecación Starlette/httpx, sin fallos.
- Nuevas comprobaciones: estados independientes; ocultar/restaurar ambos; conservación de coordenadas; A/B en una sola emisión; misma instancia Angular del globo, mismos nodos de panel y formulario después de alternar modos; proyección al 84% y atmósfera sin recorte en 1920×1000, 1440×800, 1024×768, 768×900, 390×700 y 320×630.
- La prueba de ciclo de vida sustituye únicamente la inicialización WebGL para poder ejecutarse en jsdom. Comprueba que Angular no recrea el componente; no demuestra renderizado real de GPU.

## Límites pendientes

No fue posible inspeccionar visualmente la aplicación: el servidor de desarrollo llegó a indicar que escuchaba en 127.0.0.1:4200, pero el navegador remoto devolvió `ERR_CONNECTION_REFUSED`. No se certifican capturas, consola del navegador, glass real, arrastre/zoom/picking WebGL, ausencia de solapamientos ni rendimiento en un dispositivo físico. Las pruebas geométricas usan dimensiones matemáticas, no screenshots.

En esta corrección no se repitieron consultas externas NASA/NOAA; se conservan los resultados históricos de la entrega anterior como tales. MERRA-2 sigue dependiendo de datos importados. No se cambió el despliegue en Render/Vercel.

## Ejecución

Los comandos siguen siendo los del README: backend con `python -m uvicorn app.main:app --reload --port 8000`; frontend con `npm ci` y `npm start` desde sus respectivas carpetas. El ZIP no incluye dependencias, entornos, cachés, dist, .git ni archivos .env.
