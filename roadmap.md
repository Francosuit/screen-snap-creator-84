# Roadmap

- [x] Sprint 02: revisión estática de Reservas, Habitaciones, Huéspedes y Limpieza completada. No repetir esta auditoría al retomar.
- [ ] Sprint 02 — Tarea 01: eliminar asignaciones de personal ficticio en operaciones reales. **PAUSADA antes de implementar; no continuar hasta disponer de créditos.**

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
