# Roadmap

## Fase prioritaria — Centro de Integraciones y API propia (28 nov 2026)
- [x] Conservado el procesador inbound existente y separadas las credenciales propias de Suite de las credenciales de proveedores externos.
- [x] Implementados contratos, generación criptográfica, cifrado backend, firma HMAC, expiración, permisos, mapeo exacto de habitaciones y catálogo extensible sin conexiones ficticias.
- [x] Implementados administrador de integraciones, creación/configuración/rotación/revocación, documentación de endpoints reales y resumen de actividad.
- [x] Añadidos endpoints propios de reservas y disponibilidad; escritura propia preparada para transacción huésped+reserva, idempotencia durable, límite y recuperación.
- [x] Pruebas locales: 14/14 nuevas y del procesador; 43/43 regresión Quendoo. Sin escrituras nuevas en hoteles durante esta fase.
- [x] Autorizado y aplicado esquema aditivo exacto como `0012_suite_own_api_integrations.sql`; tipos regenerados automáticamente, sin alterar filas existentes.
- [x] Validación real en P0: integración `2ec01ca6-f673-4f87-a0ce-ef7ea0981da6`; reserva `A-P0API-52CCC065` creada (101, 1–3 dic, 240 €), modificada (1–4 dic, 360 €) y cancelada. Cada estado leído en Reservas y tras recarga; replay y revisión duplicada sin duplicar filas; propiedad de otro hotel rechazada (422).
- [x] Probar credencial: 200; rotación invalida clave anterior (401), nueva clave acepta evento firmado (200); revocación persiste tras recarga y rechaza clave (401). Integración de prueba revocada; reserva cancelada conservada como evidencia.
- [x] Integridad: hashes de las 15 reservas, 17 huéspedes, 13 tareas, 10 incidencias y 5 operaciones anteriores de P0 intactos; hashes de entidades y configuración de Hotel Homeless intactos. Escrituras del mundo bloqueadas en navegador.
- [x] Suite 290 pasadas / 6 omitidas; build automático OK 12:42:26 UTC; git diff --check limpio. Reservas e Integraciones revisadas visualmente en PC; Integraciones móvil 390×844 sin overflow.
- [ ] Consultas reservas/disponibilidad BLOQUEADAS en P0 por registro histórico `R-mvv3vm96t50p` con entrada=salida=0: respuesta explícita 422 `invalid_pms_calendar` en lugar de 503 genérico. No inventar noches ni modificar registro existente sin autorización. Prueba nueva confirma detección sin mutación.
- [ ] Pendiente menor: optimizar tres políticas nuevas con `(select auth.uid())`, manteniendo exactamente permisos; advertencias del analizador documentadas, no certificado global de seguridad.
- [ ] Pendiente de proveedor real: credenciales sandbox y verificación externa; no se declara ninguna conexión OTA activa. No publicar ni tocar Hotel Homeless.

## Recepción de reservas externas por API — 28 nov 2026
- [x] Dirección pública `/api/public/quendoo/webhook`: firma oficial X-Qc-Signature-256 (HMAC sobre bytes originales, ±5 min), sin firma → 401, enrutado solo por asociación del servidor.
- [x] Procesador: formato oficial BookingRevision/getBookings, mapeo código externo → tipo Suite, asignación de habitación libre con reglas del PMS (sin sobreventa, capacidad), duplicados por revisión, modificaciones, cancelaciones, no-show, solicitudes sin bloqueo, estancias en curso a revisión manual.
- [x] Persistencia sin migración: filas `Q-<código>` en reservas/huéspedes existentes (identificador determinista = sin duplicados), lectura de comprobación antes de confirmar, registro de sincronización en audit_log sin datos personales.
- [x] Demostrado en «Validación P0» (entorno aislado, modo test): SBX-MKPLHB creada (hab. 101, llegada hoy) → Reservas, calendario, ficha, Huéspedes › Llegadas, Habitaciones → modificada (salida 1 dic, 360 €) → cancelada; una sola fila, versión 3. Ensayos SBX-BPTALH/SBX-ZR86OX cancelados por la misma vía. Hotel Homeless intacto.
- [x] Suite 281 pasadas / 6 omitidas; build OK.
- [ ] Quendoo real: falta client_id/client_secret de staging (office@quendoo.com), signing secret de la suscripción y la propiedad asociada (SUITE_QUENDOO_INBOUND, SUITE_QUENDOO_WEBHOOK_SECRETS, SUITE_QUENDOO_CREDENTIALS). Lectura del feed + ACK implementada sin probar contra el proveedor.
- [ ] Pendiente: reservas de varias habitaciones, cursor persistente del feed, monedas distintas de EUR.

## Plan completo de integraciones — ejecución 28 nov 2026
- [x] Leído el documento completo: Suite Hotel OS es el PMS central; los terceros son proveedores de conectividad, no sustitutos ni elección definitiva.
- [x] Incorporada la instrucción adicional: conservar lo ya creado y funcional; priorizar integraciones conectadas al PMS antes que módulos nuevos.
- [x] Primer bloque operativo sobre adaptador existente: dos RPCs autenticados, permisos módulo + owner/director, organización derivada del hotel, configuración segura hotel-scoped y prueba real de lectura propiedad/tipos/planes. Sin configuración devuelve bloqueo verdadero; sin conexión ficticia ni escritura.
- [x] Documentado privilegio insuficiente del borrador para transacción invoker PMS+mapeo+revisión. No listo para aplicar; corregir/probar en base aislada antes de solicitar autorización. Configuración segura y requisitos externos exactos: `docs/integrations-connection-checkpoint-2026-11-28.md`.
- [x] Suite 274 pasadas / 6 omitidas / cero fallos; 18 nuevas. Build automático/tipos OK 09:14:09 UTC. P0 PC/móvil: Conectar/Probar/recarga verificados, sin errores runtime/overflow; escrituras bloqueadas. Quendoo candidato, no elección definitiva: salida depende de su propio calendario/distribución legacy.
- [x] Demo móvil conserva catálogo separado, sin llamadas a funciones de conexión ni botones de prueba reales; último build automático OK 09:16:10 UTC.
- [ ] Flujo vertical externo → PMS → pantallas → ACK y salida durable: pendiente de sandbox, credenciales y persistencia autorizada; no declarar conseguido con pruebas aisladas.

## Misión maestra — bloque en ejecución (28 nov 2026)
- [x] Verificación puntual de la fuente PMS en código: store compartido + suite_load/apply_operations; no certificación nueva de escrituras/RLS. Conservados Sprint 05 y «A revisar».
- [x] Corregidas cifras/previsiones estáticas de Control en cuentas reales; Panel usa revenue.ts (noches, no-show/cancelación, ingresos no cobros); retiradas promesas de sincronización/actividad compartida y atribuciones demo en Integraciones reales. No es auditoría completa de todo el producto.
- [x] Comparados Quendoo Connect/Channex/Mews con fuentes oficiales. Quendoo elegido por costes publicados; implementado HTTP real, OAuth/token, propiedades/tipos/planes, feed/ACK tras guardado y read-back, ARI y verificación HMAC en el núcleo existente. Sin repositorio/escritor durable activo ni webhook desplegado.
- [x] Suite completa 256 pasadas / 6 omitidas / cero fallos; 36 adaptador + 5 ingresos nuevos. build automático/tipos OK 08:59:09 UTC; sin ejecución manual independiente. git diff --check limpio.
- [x] Visual PC 1072×831/móvil 390×844 en P0: Panel, Control, Reservas, Integraciones y Tareas, sin errores runtime/overflow. Demo Control conserva indicadores rotulados. Todas las escrituras bloqueadas (6 intentos company_worlds); no prueba de guardado.
- [ ] Bloqueado hasta autorización: migración aditiva y datos aislados P0; sandbox externo aún no disponible. No publicar ni escribir en hoteles reales.
- Prioridad de esta misión: API exclusivamente; no scraping, automatización de navegador ni CSV como sustituto de sincronización.
- [ ] Sandbox Quendoo: Franco confirmó «Todavía no». Cero reservas externas recibidas; cero pruebas contra proveedor; no se piden credenciales aún. Integraciones muestra NO CONECTADA.
- [ ] Siguiente bloque: completar/probar transacción PMS+mapeo+revisión y runs en base aislada; pedir autorización del esquema completo antes de aplicar; depois flujo sandbox guardado→pantallas→ACK, sin hoteles reales.
- Informe concreto, archivos, costes, fuentes y límites: `docs/master-mission-2026-11-28.md`. Revisión profunda previa sin hallazgos pero desactualizada; no certifica cambios nuevos. No se marca la misión ni Sprint 05 terminados.

## Bloque actual — validación API y primer proveedor (28 nov 2026)
- [x] Revisados los cuatro módulos API y sus pruebas; corregidos reintentos de errores permanentes, consistencia de fechas en disponibilidad y orden del hash. No se tocó Sprint 05.
- [x] Preparado `docs/api-persistence.draft.sql`: cinco tablas, GRANT/RLS, índices y relaciones de ámbito; parser PostgreSQL acepta 43 sentencias. NO aplicado ni probado con RLS real.
- [x] Channex staging recomendado por feed de revisiones/ACK e inventario; alternativa Mews comparada con fuentes oficiales. Requisitos y resultados en `docs/api-validation-2026-11-28.md`.
- [x] Suite completa 215 pasadas / 6 omitidas / cero fallos; API/PMS 40 pasadas. Compilación automática OK 08:21:50 UTC. Comprobación independiente de tipos NO ejecutada.
- [x] Revisión básica de seguridad sin hallazgos en sus comprobaciones; revisión profunda iniciada, resultado pendiente.
- [ ] Integración real BLOQUEADA: confirmado el 28 nov que todavía no existe acceso a un entorno privado de pruebas de Channex o Mews; no se solicitan credenciales ni se simula una conexión. También faltan autorización de migración y de datos aislados P0. No hay repositorio persistente, adaptador activo ni importación vertical; los mocks no demuestran persistencia ni aislamiento backend real.
- Pendiente después de autorización: funciones atómicas claim/journal/finish y PMS+mapeo+revisión, asignación por tipos, firma webhook/ACK, pruebas de dos hoteles y recuperación tras interrupción. No se publica ni se escriben datos reales; Hotel Homeless intacto.

## Trabajo autorizado — 24 nov 2026
- [ ] Cerrar Sprint 03: persistencia en «Validación P0», pruebas completas, tipos/compilación y recorrido visual en PC y móvil, sin escribir en hoteles reales.
- [ ] Consultar Plan Maestro y auditar una sola vez el alcance de Sprint 04; implementar en bloques lo validable con datos aislados.
- [ ] Validar Sprint 04 y documentar únicamente pendientes reales; no iniciar Sprint 05 si no puede probarse.

## Cierre solicitado — Sprint 02 (20 nov 2026)
- [ ] Corregir duplicaciones y terminar únicamente la integración temporal esencial, con zona horaria por hotel y demo separada.
- [ ] Comprobar reservas, check-in, checkout, habitaciones y tareas; repetir validación visual demo/real en escritorio y móvil.
- [ ] Ejecutar pruebas específicas, suite completa y compilación; sin migraciones, escrituras reales ni uso de Hotel Homeless.
- [ ] Registrar pendientes menores sin ampliar alcance y dejar identificado el objetivo exacto del Sprint 03, sin implementarlo.
- [ ] Leer «Documento Maestro Suite Hotel OS Demo Enero 2027» y usarlo como referencia para avanzar después paso por paso.

## En curso — Sprint 02: núcleo temporal compartido (16 nov 2026)
- Recuperar el diseño aditivo de Tarea 06 y comprobar el almacenamiento real de reservas/tareas.
- Implementar y probar de forma aislada el núcleo de calendario, zona horaria, conversión y lectura compatible.
- Preparar backup, migración, validación y rollback verificables; NO ejecutar migraciones ni escribir en hoteles reales.
- Mantener la demo fija en 10/11/2026 y conservar los campos antiguos hasta validar la conversión.

- [x] Sprint 02 — Tarea 08 (13 nov 2026): ficha individual conectada a `hotelToday` en cabecera, entrada, salida y desglose por noche. Conserva fechas almacenadas, estados y demás módulos. 8 pruebas nuevas y 48 comprobaciones relacionadas pasan; compilación OK. Verificación visual en «Validación P0 — prueba de persistencia»: entrada real «Hoy», desglose correcto y ficha idéntica tras recarga, sin acciones operativas. Hotel Homeless no utilizado. Pendiente para cerrar Sprint 02: conectar las pantallas restantes y validación multiusuario Cloud ya registrada.

- [x] Sprint 02: revisión estática de Reservas, Habitaciones, Huéspedes y Limpieza completada. No repetir esta auditoría al retomar.
- [ ] Sprint 02 — Tarea 01: implementada; 6 pruebas aisladas pasan (demo, identidad simulada, cambios y recarga). Validación cloud real pendiente en hotel independiente autorizado.
- [ ] Sprint 02 — Tarea 02: implementada; 2 pruebas aisladas pasan, habitación actual y descripción obligatorias, formulario real vacío. Validación Cloud pendiente.
- [ ] Sprint 02 — Tarea 03: implementada; reutilización de tareas abiertas, guardas contra inicio/finalización/checkout repetidos, nueva limpieza tras completar la anterior. Pruebas en curso.
- [ ] Sprint 02 — Tarea 04: implementada con `updateGuest` y editor de los seis campos; 2 pruebas de acción/recarga aislada pasan. Comprobación formulario en curso; Cloud real pendiente.
- [ ] Sprint 02 — Tarea 05: bienvenida/envíos/adjuntos ficticios desactivados en cuentas reales. Fechas BLOQUEADAS: días relativos a `DEMO_DATE` sin origen por reserva; cambiar el origen desplazaría reservas existentes. Requiere migración compatible fuera del alcance autorizado; no se modificó la base de fechas.

## Reanudación — 10 de noviembre de 2026

- Tarea 01: `store.tsx` crea nuevas tareas/incidencias reales sin responsables inventados; inicia con nombre del perfil verificado (correo/UID como respaldo). Conserva responsables demo y elimina afirmaciones reales de asignación/notificación no confirmadas.
- Pruebas ejecutadas: `sprint02.test.tsx` 6/6 y `auth-flow.test.tsx` 7/7. Recarga mediante almacenamiento simulado, no Cloud real. Error de tipos detectado en la prueba y corregido; siguiente comprobación pendiente.
- Sin escrituras en Cloud ni modificaciones de Hotel Homeless; sin cambios de autenticación, roles, guardado atómico ni configuración.
- Archivos hasta este punto: `store.tsx`, `sprint02.test.tsx`, `panels.tsx`, `roadmap.md`.
- El punto de pausa siguiente se registra aquí; las secciones anteriores se conservan como historial, no describen el estado actual.
- Tarea 02: `sprint02.test.tsx` 8/8 y `calendar.test.ts` 13/13; compilación OK tras corregir acceso de índices en la prueba.
- Tarea 03: 11/11 pruebas de Sprint pasan; compilación OK. Caso demo corregido para usar una habitación sin tarea abierta. Sin cambios en el guardado atómico.
- Tarea 04: 13/13 pruebas de Sprint y 28 de regresión (acceso, calendario, revenue) pasan; compilación OK. `GuestEditor.tsx` nuevo, conectado a `huespedes.tsx`; regla registrada en `AGENTS.md`.

## Punto exacto de pausa — Sprint 02 (9 de noviembre de 2026)

### Revisión realizada y hallazgos

Revisión de código, no prueba funcional real. El informe del agente de revisión ha sido recuperado; no modificó archivos.

| Módulo | Hallazgos de la revisión |
| --- | --- |
| Reservas | Las mutaciones usan el guardado compartido existente. Checkout finaliza la estancia, marca la habitación sucia y crea una tarea, pero asigna «María López» también en cuentas reales. El modelo de fechas sigue anclado a la fecha demo; queda fuera de Tarea 01. |
| Habitaciones | Los estados se derivan de estancia, limpieza y mantenimiento; configuración y estado operativo tienen guardados separados. La limpieza directa crea tareas con «María López» y anuncia asignación. Repetir la solicitud de limpieza puede generar tareas abiertas duplicadas; queda fuera de Tarea 01. |
| Huéspedes | Las reservas crean huéspedes y el guardado compartido incluye sus registros. La ficha permite consultar, pero no completar posteriormente sus datos; queda fuera de Tarea 01. |
| Tareas / Limpieza / Incidencias | Inicio y finalización actualizan tareas y habitación; las incidencias están enlazadas con tareas. `startTask` ya usa `x.assignee || actor`. Crear incidencia asigna «Carlos Ruiz» y afirma que se le notificó sin entrega real confirmada. El formulario tiene valores demo y foto simulada; cambiar esos controles queda fuera de Tarea 01. |

La cola de escrituras, recarga tras errores, actualización cada ocho segundos y protección atómica están implementadas en código. Esto no equivale a verificar dos cuentas reales simultáneas.

### Mejora seleccionada y motivo

**SPRINT 02 — TAREA 01: eliminar asignaciones de personal ficticio en operaciones reales.**

Es la primera mejora seleccionada por su alcance reducido: evita introducir responsables inventados en operaciones nuevas sin cambiar arquitectura, permisos ni el mecanismo de guardado. No se abordarán las demás mejoras detectadas.

Reglas de implementación:
- Cuenta real: tareas nuevas pendientes de checkout, limpieza directa e incidencias sin asignatario ficticio; conservar la convención existente de asignatario vacío.
- Demo: conservar las asignaciones y comportamiento actuales.
- Al iniciar una tarea sin responsable, registrar al usuario real mediante el comportamiento existente de `startTask`.
- Cubrir también limpieza directa que empieza sin tarea previa: actualmente crea una tarea ya iniciada sin pasar por `startTask`; debe registrar al iniciador real sin inventar un responsable.
- No afirmar que una incidencia se ha asignado o notificado si ninguna operación real lo confirma; revisar también el mensaje de resolución de incidencias que afirma «Responsables notificados».
- No modificar ni corregir retroactivamente filas existentes, especialmente las de Hotel Homeless.

### Archivos y componentes implicados

- `src/lib/suite/store.tsx`: `checkOut` (aprox. 454–483), `startTask` (485–500), `finishTask` (503–530, solo afirmación de notificación de incidencias), `reportIssue` (533–553) y `roomOp` (594–613). Archivo previsto para el cambio funcional.
- `src/components/suite/panels.tsx`: `ReportIssueDialog` y accesos operativos de habitación; puntos de comprobación, no rediseño autorizado.
- `src/components/suite/RoleHomes.tsx`: pantallas de tareas por rol; comprobación de inicio de tarea, sin ampliar su alcance.
- `src/routes/tareas.tsx`: inicio/finalización desde el listado; punto de comprobación.
- `src/lib/suite/operations.ts`: verificar que las diferencias incluyan el responsable correcto; no modificar el guardado atómico.
- `src/test/`: añadir pruebas pequeñas junto a las existentes, con datos aislados para los tres caminos y para el inicio de tareas. Aún no hay un archivo de pruebas de Tarea 01 creado.
- `roadmap.md`: punto de pausa y seguimiento de esta tarea.

### Pasos pendientes, en orden

1. Cuando haya créditos, continuar directamente con Tarea 01; no repetir la auditoría general.
2. Leer únicamente el contexto mínimo del indicador de demo/cuenta real, identidad `actor` y patrón existente de pruebas para aplicar la distinción sin tocar autenticación.
3. Cambiar las asignaciones de los tres caminos en `store.tsx`, conservar demo y registrar al iniciador en la limpieza directa ya iniciada.
4. Ajustar las afirmaciones de asignación/notificación pertinentes en cuentas reales, sin alterar la entrega de operaciones ni otros módulos.
5. Añadir y ejecutar pruebas aisladas; comprobar la señal de compilación disponible y las pantallas implicadas.
6. Informar archivos, cambios, resultados efectivamente ejecutados y bloqueos; cerrar Tarea 01 solo con evidencia suficiente. No avanzar a Tarea 02 automáticamente.

### Pruebas pendientes (ninguna ejecutada para Tarea 01)

- Checkout en cuenta real: tarea nueva sin «María López» ni otro responsable inventado; estancia finalizada y habitación sucia como antes.
- Solicitar limpieza directa en cuenta real: tarea pendiente sin responsable; iniciar después registra al usuario real.
- Iniciar limpieza directa sin tarea previa en cuenta real: tarea en proceso con el iniciador real.
- Crear incidencia en cuenta real: incidencia y tarea sin «Carlos Ruiz»; iniciar la tarea registra al actor real según el comportamiento existente.
- Demo: checkout y limpieza conservan «María López»; incidencias conservan «Carlos Ruiz».
- Mensajes de incidencias en cuenta real: no presentar asignación ni entrega de notificación no confirmadas (verificación funcional, no tests de copy).
- Ejecutar los escenarios con fixtures/locales aislados y comprobar diferencias operativas. Una prueba con escritura cloud solo podrá realizarse en un hotel de prueba autorizado y separado; nunca en Hotel Homeless.
- Recarga/lectura compartida con cuentas reales y permisos existentes: pendiente si no hay entorno aislado autorizado disponible; no simular un resultado exitoso.

### Archivos modificados y estado

- Hasta la pausa previa: únicamente `roadmap.md` para registrar el Sprint 02; ningún cambio funcional implementado.
- En este cierre documental: actualizado únicamente `roadmap.md` dentro del proyecto; se registra también la restricción de Tarea 01 en la memoria del proyecto.
- No se han añadido ni ejecutado pruebas de Tarea 01. No se han ejecutado migraciones ni operaciones de escritura en el hotel real.
- Bloqueo: implementación detenida por la condición del usuario de esperar créditos disponibles; no se ha consultado ni confirmado el saldo actual.
- Permanecen intactos autenticación, permisos/roles, persistencia atómica, configuración de habitaciones y los datos reales de Hotel Homeless.

## Otras tareas existentes (fuera del alcance de Tarea 01)

- [ ] P1 solicitado: tablas operativas por hotel, guardado atómico compartido, permisos por rol, protección de concurrencia y pruebas; conservar interfaz/demo/mundo.

- [x] P0 registro: no continuar sin sesión; esperar perfil/hoteles y conservar invitación; 21 pruebas pasan, confirmación simulada y recarga autenticada verificadas. Pendiente externo: confirmar correo y aceptar una invitación reales.

- [ ] P0: corregir propietario legítimo sin permitir escalada de empleados
- [ ] P0: separar demo, cuentas reales y hoteles de empleados; preservar guardados
- [ ] P0: ejecutar todas las pruebas y verificar persistencia real y aislamiento disponible

- [x] Acceso directo al editor existente, guardado autorizado Owner/Director y pruebas automáticas de bloqueo a Recepción
- [ ] Verificar edición, recarga, historial y aislamiento en Cloud con Owner/Director y Recepción reales (bloqueado: no hay sesión autenticada disponible para el usuario)

- [ ] Mi Isla: premium black-and-gold shell and interactive city with coast, streets, greenery and selectable hotels
- [ ] Secure Cloud accounts and company-isolated island/configuration persistence (replace browser-only demo authentication)
- [ ] Building catalog, non-overlapping plots, add/configure/move/save/reload flow
- [ ] Operational building panels and event-based connections; explicit DEMO and synchronization states
- [ ] Hotel appearance editor and floor-level zone assignment; preserve operational data
- [ ] Staff accounts, permissions and configurable housekeeping/maintenance automations
- [ ] Hotel Builder wizard (hotel → floors → rooms with type/capacity/beds/bath/terrace/view/m²/price/position/orientation → generate animation)
- [ ] Isometric building view (all floors, floor focus, zoom/reset/rotate, tooltips, live states) using shared room data
- [ ] Floor plan view (rooms, corridor, lifts, stairs, common areas) + room interior view
- [ ] Live Hotel on dashboard + activity side-by-side
- [ ] Simulate activity button (real state changes)
- [x] Edición completa de cada cuarto desde el mapa: ocupación (doble/triple), camas separadas, extras; visible en mapa y ficha
- [x] Detalle de cada habitación (ducha, escritorio, baño, ventana y lado) editable y también en Crear hotel
- [x] Animación en bucle de entrada a la app Suite Solutions

## Auditoría Sprint 02 — 11 nov 2026 (solo lectura)
- Ejecución completa hoy: 108 pruebas → 101 pasan, 6 omitidas (integración invitaciones sin PostgreSQL local), 1 falla (`cloud-owner.integration.test.ts:39`, devuelve XX000 en vez de 42501; prueba previa, no de Sprint 02 — PENDIENTE DE REVISIÓN).
- `src/test/sprint02.test.tsx`: 13 pruebas, todas pasan (personal 6, incidencias 2, limpieza 1+, huéspedes 3, simulaciones 1). Las "65" del informe anterior eran un subconjunto, no el total.
- Tareas 01–04 y simulaciones: IMPLEMENTADO, PENDIENTE DE VALIDACIÓN en Cloud (verificado solo en pruebas aisladas).
- Hotel Homeless: 25 huéspedes, 25 reservas, 66 tareas, 53 incidencias, 12 habitaciones; última escritura 04-11-2026 → sin alteraciones.
- NO IMPLEMENTADO: compatibilidad DEMO_DATE con fecha real (store.tsx, data.ts, RevenueBoard.tsx), zona horaria por hotel.
- PENDIENTE DE VALIDACIÓN: persistencia Cloud real, circuito reserva→check-in→checkout→limpieza, ficha tras recarga y tras cerrar sesión.

## Sprint 02 — Tarea 05 Fechas reales (11 nov 2026) — PARCIALMENTE IMPLEMENTADO
- Hallazgo: todas las fechas (reservas inDay/outDay, tareas day) son desplazamientos en días respecto a DEMO_DATE = 10-11-2026; no hay fechas absolutas ni zona horaria en `hotels`. "Hoy" = 0 está fijo en ~100 comparaciones (store.tsx, reservas, index, huéspedes, panels, mundo…). Hotel Homeless (escrito el 04-11) usa los mismos desplazamientos.
- Decisión: los desplazamientos pasan a ser absolutos con época 10-11-2026 (sin migrar datos: conservan exactamente la fecha que mostraba la app al crearlos). Demo: hoy = 0 fijo. Real: hoy = fecha del hotel en su zona horaria. Aritmética por día de calendario en UTC (sin desfases).
- Hecho: `src/lib/suite/clock.ts` + `src/test/clock.test.ts` (7 pruebas: histórica, futura, check-in, checkout, 1/2/varias noches, medianoche, zonas, horario de verano, demo independiente). 37/37 pasan junto a calendario y Sprint 02.
- BLOQUEADO hasta aprobación: (1) migración aditiva `hotels.timezone text default 'Europe/Madrid'` (toca el esquema de hoteles reales, incl. Homeless); (2) sustituir "0 = hoy" por `todayOffset` en store y pantallas. Sin esto las cuentas reales siguen en DEMO_DATE.
- Pendiente de prueba: recarga y persistencia con cuenta real.

## Sprint 02 — Tarea 06 (auditoría y diseño de fechas) — 14-11-2026
Solo diagnóstico. Sin cambios de código, datos ni migraciones.
- Auditadas: Dashboard (index.tsx + RoleHomes), Habitaciones, Tareas, Control, RevenueBoard/revenue.ts.
- Fechas fijas: Dashboard (inDay/outDay 0 y 1, mes [-9,1), "1–10 nov"); store nextArrival (inDay>=0), alertas, checkOut (day:0, "Mañana", min(outDay,0)); Habitaciones/RoomSheet fmtDay sin hoy; Tareas/RoleHomes "Hoy" literal; RevenueBoard today=DEMO_DATE; Control previsión 0–20 (demo).
- Campos relativos: reservas inDay/outDay/createdDay; tareas day; horas como texto (deadline, eta, createdAt) sin fecha.
- Diseño propuesto (pendiente de aprobación): columnas aditivas check_in_date/check_out_date/created_date y task_date, backfill = 2026-11-10 + offset, tabla de respaldo, lectura dual, sin borrar offsets.
- Siguiente tarea mínima: conectar hotelToday en Tareas (etiqueta fmtDay(t.day, hoy)).

## Sprint 02 — Tarea 07 (fechas en Tareas) — 15-11-2026
- Código implementado (etiqueta de fecha en Tareas vía task-date.ts). Pruebas unitarias: 23/23.
- Validación visual cuenta real (hotel de validación, no Hotel Homeless): 10 tareas muestran «Fecha sin validar · límite HH:MM», ninguna «Hoy» engañosa; filtros Housekeeping/Mantenimiento funcionan; sin errores de consola; no se guardó nada (escrituras bloqueadas en la prueba).
- No verificado en navegador: modo demostración (sin sesión la app redirige a /login; no hay acceso demo desde la interfaz) y botones Iniciar/Finalizar (no había tareas pendientes visibles y no se pulsaron para no alterar datos). Cubierto solo por pruebas unitarias.
- Fechas reales en cuentas reales: pendientes de la migración diseñada en Tarea 06 (requiere aprobación).
- Estado: COMPLETADA el 16-11-2026; validación funcional y evidencias en la sección posterior «Validación funcional Tarea 07».

## Sprint 02 — Validación funcional Tarea 07 — 16-11-2026
- [x] COMPLETADA: validación Cloud y navegador en «Validación P0 — prueba de persistencia», hotel aislado con propietario `3bb2396f-77b9-4263-bc2d-6d3899511546` y sin acceso a Hotel Homeless.
- Creada desde «Reportar problema» la tarea ficticia `T-mwizr3vxcypj` e incidencia asociada `I-mwizr3vxe17m`, habitación 101, descripción «PRUEBA T07 2026-11-16», sin responsable inicial, foto ni bloqueo.
- Iniciar: «Pendiente» → «En proceso»; tras recarga persisten estado, responsable real Franco Albornoz e inicio 14:10. Cloud confirma versión 2 e incidencia en proceso.
- Finalizar: «En proceso» → «Completada»; tras segunda recarga persisten estado, inicio 14:10 y fin 14:11, sin botones de acción. Cloud confirma versión 3 e incidencia resuelta.
- Integridad: las 10 tareas y 9 incidencias anteriores conservan exactamente sus hashes iniciales; sin cambios en 6 reservas, 6 huéspedes ni 5 operaciones de habitación. Hotel Homeless conserva 66 tareas, 53 incidencias, 25 reservas y 25 huéspedes, últimas escrituras 04-11-2026 y 0 eventos de auditoría durante la prueba.
- Navegador sin errores de consola; compilación OK. No se repitieron los 26 tests ya aprobados ni se ejecutaron migraciones. No se modificó código de aplicación.
- La tarea ficticia y su incidencia resuelta se conservan como evidencia: no existe una acción segura de borrado en la interfaz y no se hizo ninguna eliminación directa en la base.
- Siguiente trabajo Sprint 02: núcleo temporal compartido y conversión segura de días relativos de reservas/tareas a fechas reales; requiere aprobación de la migración diseñada en Tarea 06.

## Siguiente prioridad
Implementar el núcleo temporal compartido (hotelToday en store y todas las pantallas) y la conversión segura de días relativos de reservas y tareas a fechas reales, con migración aprobada.

### Núcleo temporal — validación (17/11/2026)
- [x] temporal.test.ts 8/8, suite completa 140/140, compilación OK.
- [x] Corregido: syncReservationCalendar recalcula fechas tras editar desplazamientos.
- [ ] Pendiente de autorización: conectar Operaciones, Dashboard, Habitaciones, Tareas, Revenue.
- [ ] Guardar zona horaria al crear hotel; procedimientos de backup/migración/rollback; migración real.

### Operaciones y conexión de pantallas — 18/11/2026
- [x] PRIORIDAD 1 validada sin escrituras reales: revisados `store.tsx`, `clock.ts`, `temporal.ts`, `data.ts` y `operations.ts`; este último conserva el guardado atómico sin cambios.
- [x] Nuevas pruebas aisladas `operations-temporal.test.tsx`: checkout/limpieza, incidencia, hotel digital, alertas, reserva manual, cambio de estancia, recarga y separación demo/real. 46/46 pruebas específicas y suite completa 146/146 antes de conectar pantallas; compilación OK.
- [x] Confirmado en operaciones reales simuladas: nuevas tareas/reservas guardan fecha absoluta y desplazamiento; registros antiguos no se convierten implícitamente; checkout no duplica limpieza; demo fija 10/11/2026 y no añade campos de producción.
- [x] Conectados al día compartido: Panel principal (incluido mes en curso), Habitaciones, Hotel digital, Huéspedes, Tareas, Revenue y estados/arrastre de Reservas; fichas compartidas y acción de check-in usan el mismo día.
- [x] Tareas reales nuevas muestran Hoy/Mañana/fecha solo si `taskDate` coincide con `day`; tareas antiguas sin validar conservan «Fecha sin validar». Inicios de Limpieza/Mantenimiento usan la misma regla.
- [x] 47/47 pruebas específicas de pantalla y operaciones tras la integración.
- [ ] Pendiente: suite completa posterior a pantallas, compilación final y validación visual demo/real de solo lectura.
- [ ] Después: zona horaria individual, validaciones estrictas de fechas/horas y procedimientos de backup/migración/rollback. NO ejecutar migraciones ni escribir en hoteles reales.

## Cierre Sprint 02 — 21/11/2026 — CERRADO
- [x] Suite completa 162 pasadas / 6 omitidas (integración sin PostgreSQL local); typecheck OK.
- [x] Aislamiento «Validación P0» confirmado por consulta: único hotel de la cuenta de validación, 1 miembro, propietario propio; la sesión no ve Hotel Homeless.
- [x] Recorrido visual con escrituras bloqueadas (solo se permitió la lectura `suite_load_operations`, verificada como de solo lectura): Panel, Reservas, Control, Habitaciones, Huéspedes, Tareas y Hotel en PC (1280) y móvil (390); sin desbordamiento horizontal.
- [x] Demo: cabecera «Martes, 10 de nov de 2026» fija. Real: «Sábado, 21 de nov de 2026 · 10:46» (hora local Madrid), calendario de Control empieza en sáb 21.
- [x] Hotel Homeless sin cambios: 25 huéspedes, 25 reservas, 66 tareas, última escritura 04-11-2026 antes y después.
- Criterio de cierre: pruebas + compilación + recorrido visual demo/real + aislamiento verificado. Cumplido.
### Pendientes no críticos
- Saludo del Panel fijo «Buenas tardes» y nombre del rol de demo («Juan») en cuenta real.
- Al cargar, la app intenta guardar el mundo (company_worlds) aunque no haya cambios.
- Zona horaria vacía en los 3 hoteles: usan Europe/Madrid por defecto hasta que el dueño la configure.
- Indicadores superiores de Control siguen siendo de demostración (rotulados como tal).
- Migración de fechas absolutas de registros antiguos: pendiente de aprobación.

## Sprint 03 — PMS y recepción — PREPARADO, NO INICIADO
- Auditoría y plan: `docs/sprint03-plan.md`. Esperando aprobación para la Tarea 1 (cancelación y no-show).

## Resultados 25 nov 2026 — cierre Sprint 03 / Sprint 04
- Sprint 03 CERRADO (validado 24 nov en Validación P0 con recargas): crear/editar reserva, huésped existente, check-in, traslado, check-out, cancelación, disponibilidad liberada, no-show, historial.
- Sprint 04 validado en navegador (Validación P0, PC 1280 y móvil 390, sin errores de consola ni desbordamiento):
  - [x] Enlace directo `/hotel?room=102` abre la ficha. Corregido: el número llegaba como valor numérico y se descartaba.
  - [x] Editor de mobiliario: añadir, mover, girar, guardar → persiste tras recargar; eliminar y guardar restauró las 3 piezas originales.
  - [x] Plantas leídas de los datos del hotel (P1/P2) en Habitaciones y mapa.
  - [x] Estados Llegada hoy / Salida hoy / Ocupada / Lista coinciden en Habitaciones, mapa y ficha (hab. 203).
  - [x] Plantas personalizadas persisten: las 2 plantas creadas con Validación P0 siguen cargándose desde la nube en sesiones distintas (24 y 25 nov), en PC y móvil.
  - Nota: las plantas solo se definen al crear el hotel; añadir/renombrar plantas en un hotel existente no existe aún (mejora futura, no bloqueante).
- Estado: Sprint 03 CERRADO · Sprint 04 CERRADO · Sprint 05 PENDIENTE, sin iniciar.
- Mejora menor: cabecera de «Hotel digital» apretada en móvil.
- Comprobaciones: 173 pruebas pasadas, 6 omitidas; tipos OK; compilación de producción OK.
- Sin migraciones; sin escrituras en Hotel Homeless.

## Sprint 05 — revisión inicial (25 nov 2026)
- Ya existe y se reutiliza: estado de limpieza `hk` (sucia/en limpieza/a revisar/limpia) guardado aparte de la ocupación; checkout deja la habitación sucia; iniciar tarea de limpieza → en limpieza; completar → limpia.
- Sin código nuevo en esta sesión (sin créditos). Sprint 05 NO iniciado.
- Siguiente paso: botón directo para cambiar el estado de limpieza en la ficha de la habitación, con pruebas de transición y persistencia en Validación P0.

## Sprint 05 — estado 27 nov 2026
- Checkpoint guardado (commits df6877c / 4e2cf03) antes de continuar.
- Corregida la prueba del ciclo de limpieza (reloj controlado en cada paso). Verificado por prueba: inicio con responsable y hora exacta, fin y duración (inicio→fin), bloqueo de ciclo duplicado, devolución con motivo conservando el ciclo anterior, nuevo ciclo independiente, aprobación con fecha, reservas intactas, cronómetro desde horas guardadas.
- Suite completa: 175 pasadas, 6 omitidas. Typecheck limpio.
- PENDIENTE (Sprint 05 sigue ABIERTO): aprobar/devolver desde Tareas con las acciones centrales; acceso a ficha desde Tareas para «A revisar»; validación visual PC/móvil; recorrido P0 con recargas (check-in bloqueado en sucia/en limpieza/a revisar, zona horaria); revisión de la demo.
- Operación 1 ya implementada el 27 nov: sección «A revisar» en Tareas con ficha/aprobar/devolver reutilizando acciones centrales; 175 pasadas / 6 omitidas. Pendientes Operaciones 2 y 3; no se declara cerrado.

## Motor central API — bloque seguro autorizado 28 nov 2026
- Implementación aislada: registro de adaptadores, contratos de conexión por organización/hotel/usuario, autorización inyectada antes de acceso, resolución de credenciales solo servidor, historial sin payloads, claim atómico requerido, hash de idempotencia y reintentos limitados a operaciones declaradas idempotentes.
- PMS: proyecciones de disponibilidad, tarifas, reservas y noches Revenue reutilizan reglas existentes; normalización de cambios externos sin escribir entidades. Restricciones no se inventan.
- Inteligencia competitiva: observaciones con fuente/fecha y comparación solo de condiciones equivalentes; sin precios ni conexiones ficticias.
- BLOQUEADO para conexión real: autorización de esquema/persistencia (conexiones, mapeos externos y ejecuciones), repositorio backend con permisos verificables, proveedor y credenciales, adaptador real y llamadas PMS atómicas. No hay endpoints instalados ni webhooks activos; contrato de verificación preparado.
- Sprint 05 permanece ABIERTO, sin cambiar sus módulos. Sin migraciones ni lecturas/escrituras de datos de hoteles en este bloque.
- Validación final: 35 pruebas nuevas del bloque API/PMS/comparaciones; suite completa 210 pasadas / 6 omitidas (integración de invitaciones, ya omitida). Fallos de entorno y concurrencia de la prueba corregidos con Web Crypto aislado y barrera determinista; no se modificó el setup ni funcionalidades previas.
- Compilación automática observada: build OK, 28 nov 08:01:20 UTC; no se ejecutó un build ni typecheck manual. `git diff --check` sin errores.
- Flujo aislado probado: autorización → claim → ejecución → historial → replay; petición concurrente bloqueada, reutilización de clave con otro payload rechazada, reintentos acotados y sin credenciales en resultados/historial. Esto NO valida un proveedor real ni persistencia en producción.
- Pendientes: selección/provisión del primer proveedor y almacenamiento autorizado; conectar comandos entrantes a operaciones PMS existentes con mapeo externo/versiones y conflictos; aplicar monedas/unidades del proveedor; comprobación real de conexión, webhooks firmados y reconciliación manual de operaciones inciertas. Pickup/forecast/ADR/RevPAR y alertas competitivas no se implementaron en este bloque; se preparó únicamente su fuente de datos, sin inventar valores.

## Etapa post-auditoría — Prioridad 1 (28 nov 2026)
- [x] R-mvv3vm96t50p (P0, 0 noches, finalizada): sin modificar fila. Lecturas API excluyen estancias sin noches y las informan en `excludedZeroNight`; otras incoherencias siguen bloqueando (422).
- [x] Funciones internas de base sin ejecución anónima (migración 0013).
- [x] Zona horaria por hotel ya implementada; los 3 hoteles siguen sin elegirla (decisión de cada dueño, no se escribió).
- [ ] Verificar GET reservas/disponibilidad con credencial activa en P0 (la integración de prueba está revocada; crear una nueva desde la interfaz).
- [ ] Prioridad 2: validación visual PC/móvil/tablet. Prioridad 3–5 pendientes.
