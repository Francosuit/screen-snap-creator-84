# Motor API — estado verificable

## Auditoría concreta
- `engine.server.ts` está protegido por el límite de servidor, pero no está conectado a una función pública ni a un repositorio Cloud. `authorize`, `claim`, `attempt`, `finish` y resolución de credenciales son contratos, no implementación persistente.
- Las pruebas usan adaptadores y repositorios exclusivamente de prueba. No hay proveedor registrado en la aplicación ni conexión activa. La pantalla Integraciones dice que ninguna está conectada.
- La organización existente es `hotels.org_owner`. Los hoteles, miembros y datos PMS usan RLS; `suite_apply_operations` es SECURITY INVOKER, verifica membresía y aplica cambios bajo bloqueo de hotel y comparación de datos previos. No se sustituye por escrituras administrativas directas.
- Cloud contiene hoteles, miembros, reservas, huéspedes y operaciones; no contiene tablas de conexiones, ejecuciones API, eventos ni mapeos externos. Solo hay secretos gestionados de la plataforma, ninguno de Channex/Mews. No se leyeron valores secretos ni datos de huéspedes.

## Fallos corregidos
1. Un adaptador podía provocar reintentos de autenticación o datos inválidos al marcarlos como recuperables. Ahora solo `unavailable` y `rate_limit` pueden reintentarse, hasta tres intentos y únicamente en operaciones declaradas idempotentes.
2. La disponibilidad no comprobaba discrepancias entre fecha absoluta y offset, aunque las otras exportaciones sí. Ahora las rechaza antes de proyectar disponibilidad.
3. El hash ordenaba claves usando la configuración regional. Ahora usa orden determinista independiente del idioma.
- Pruebas añadidas para errores permanentes, fallo de credenciales y fallo de finalización del historial. Las ejecuciones inciertas no se relanzan automáticamente.
- Riesgo abierto: el contrato `execute(): Promise<void>` no entrega las reservas extraídas; antes de implementar `reservations.pull` debe definirse un resultado normalizado o una aplicación transaccional verificada. Hoy no existe importación vertical.
- El contrato de cancelación todavía exige habitación, fechas y precio: un adaptador real deberá cargar el mapeo/registro previo o introducir una variante mínima de cancelación. No se inventan esos campos.

## Persistencia preparada, NO aplicada
`docs/api-persistence.draft.sql` propone cinco tablas nuevas: conexiones, ejecuciones, intentos, eventos webhook y mapeos externos. Incluye GRANT, RLS, índices y claves compuestas para impedir mezclar organización/hotel/conexión. No altera tablas existentes ni contiene datos iniciales.
- Dueño o director activo con módulo Integraciones y usuario autorizado de la conexión: lectura. Sin permisos de escritura desde el navegador ni lectura anónima. Este alcance conserva el contrato actual de conexión por usuario; no habilita compartir credenciales entre empleados.
- Credenciales cifradas en el almacén gestionado de secretos/conectores, únicamente referencia en Cloud. Ninguna clave en tablas, historial, navegador o control de versiones. No se construye cifrado propio. La vinculación referencia→credencial será una lista autorizada en servidor, nunca un nombre arbitrario enviado por el cliente.
- Escrituras solo a través de servicios verificados; se requieren funciones atómicas de claim/historial y de aplicación PMS+mapeo+revisión antes de activar el repositorio. La estructura SQL sola NO demuestra aislamiento ni recuperación.
- Borrador comprobado con parser PostgreSQL: 43 sentencias de sintaxis válida; GRANT/RLS presentes para las cinco tablas. No ejecutado contra una base de datos: privilegios efectivos, triggers y políticas todavía necesitan prueba de integración aislada.
- En webhooks se verifica firma sobre bytes originales antes de parsear. Después se resuelve el hotel por el mapeo del proveedor y se comprueba organización, estado, usuario autorizado activo y permisos actuales; el proveedor no elige un hotel interno.
- Recuperación: no relanzar runs `running`/`uncertain` sin reconciliación. Un fallo después de guardar PMS y antes del ACK se resuelve con la revisión persistida, sin segunda reserva. Registrar códigos sanitizados, nunca cuerpos del proveedor con PII.

## Primer proveedor recomendado: Channex (staging)
Mejor encaje para Suite como PMS: entrega revisiones nuevas, modificadas y canceladas desde canales, y acepta disponibilidad/tarifas. Mews sirve como alternativa de importación desde otro PMS, no sustituye el motor propio.

| Aspecto | Channex | Mews |
| --- | --- | --- |
| API | Feed de revisiones y ACK; inventario/tarifas | Connector API, lectura y gestión de reservas |
| Autenticación | API key creada en cuenta staging | ClientToken + AccessToken + Client en cuerpo; tokens por entorno |
| Sandbox | Registro gratuito staging; propiedad/tipos/tarifas de prueba propios | Demo pública documentada; no usar datos reales ni asumir aislamiento privado |
| Webhooks | Eventos por propiedad o globales, HMAC-SHA256 recomendado; pull de respaldo requerido | General/Integration webhooks; completar revisión específica de seguridad antes de implementar |
| Producción | Pruebas/certificación y autorización de cuentas OTA | Certificación y tokens por propiedad |

Documentación oficial consultada:
- [Channex: inicio y requisitos](https://channex.io/start-integration)
- [Channex: reservas, revisiones y ACK](https://docs.channex.io/api-v.1-documentation/bookings-collection)
- [Channex: webhooks](https://docs.channex.io/api-v.1-documentation/webhook-collection)
- [Channex: HMAC](https://docs.channex.io/api-v.1-documentation/webhook-collection/hmac-signing) — identificado; implementación de firma aún pendiente.
- [Mews: autenticación](https://docs.mews.com/connector-api/guidelines/authentication)
- [Mews: entornos](https://docs.mews.com/connector-api/guidelines/environments)
- [Mews: certificación](https://docs.mews.com/connector-api/your-journey/certification)
- [Mews: reservas](https://docs.mews.com/connector-api/operations/reservations)
- [Mews: eventos](https://docs.mews.com/connector-api/events)

## Impedimentos exactos para el recorrido real
1. Confirmado el 28/11/2026: todavía no hay acceso a un entorno privado de pruebas de Channex o Mews. Para continuar harán falta cuenta staging, API key por canal seguro, property ID, tipos de habitación y planes tarifarios ficticios. Ninguna credencial se solicita en el chat; la integración real permanece en pausa y no se simula como conectada.
2. Autorizar migración aditiva, exclusivamente después de probar el borrador y funciones transaccionales en entorno aislado; aplicar no equivale a autorizar escritura en hoteles reales.
3. Autorizar datos ficticios únicamente en Validación P0, verificar propietario y aislamiento antes de escribir y enlazar explícitamente esa propiedad de pruebas.
4. Implementar repositorio duradero y adaptador con endpoints/firmas documentados. No registrar el proveedor como conectado antes de una prueba real.
5. Decidir asignación de habitación: Channex entrega tipo/plan y puede incluir varias habitaciones; Suite requiere una habitación local. Se necesita mapeo, asignación disponible y tratamiento explícito de sobreventa, moneda, impuestos y huéspedes; no escoger una habitación ficticia por defecto.
6. Aplicar nuevas/modificadas/canceladas mediante reglas PMS existentes y una única transacción con revisión y mapeo. ACK después de guardar; disponibilidad desde `reservations.ts`.
7. Probar sandbox real: nueva, duplicada, modificada, cancelada, webhook repetido/firma inválida, dos hoteles, proveedor caído, reintentos y recuperación tras interrupción. Ninguno de estos flujos externos está declarado terminado.

## Validación ejecutada
- Dos archivos API/PMS: 40 pruebas pasan.
- Suite completa: 215 pasadas, 6 omitidas (integración invitaciones sin entorno PostgreSQL local), cero fallos.
- Compilación automática observada: `build OK`, 28/11/2026 08:21:50 UTC. No se ejecutó compilación manual ni comprobación de tipos independiente; la plataforma ejecuta sus comprobaciones automáticamente.
- Pruebas exclusivamente aisladas: los mocks verifican el contrato, no RLS real ni persistencia tras reinicio del servidor. No se realizó recorrido de importación en navegador porque no existe conexión/repositorio activo.
- Sin migraciones, publicación, operaciones de hoteles reales ni cambios en Sprint 05/A revisar.
- Revisión básica de seguridad ejecutada: sin hallazgos en sus comprobaciones. Revisión profunda iniciada; resultado pendiente, no se declara seguridad integral verificada.

## Archivos modificados en este bloque
- `src/lib/suite/api/engine.server.ts`, `pms.ts`: correcciones concretas.
- `src/test/api-engine.test.ts`, `api-pms.test.ts`: regresiones y manejo de errores.
- `docs/api-persistence.draft.sql`: preparación estructural no aplicada.
- `docs/api-validation-2026-11-28.md`: resultados, fuentes y bloqueos.
- `AGENTS.md`, `roadmap.md`: reglas de arquitectura y estado real.