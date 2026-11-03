# Fase P0: persistencia multiusuario de datos operativos

## Diagnóstico (confirmado en el código)

1. **Reservas, huéspedes, tareas e incidencias solo viven en el documento `company_worlds.state`** (un blob JSON por propietario). No existen tablas relacionales para ellos.
2. **Las políticas de `company_worlds` solo dejan leer y escribir al propietario** (`owner_id = auth.uid()` y el alta exige rol `owner`). Un empleado no puede leer ni guardar ese documento.
3. **El guardado automático solo persiste los hoteles cuyo `owner` es el usuario conectado** (`store.tsx`, efecto de guardado). Los cambios de un empleado nunca salen de su navegador.
4. **El guardado del blob completo es "el último gana"**: dos usuarios simultáneos se pisarían los cambios.

Conclusión: no es un fallo puntual, es que los datos operativos no tienen vía de persistencia compartida. La solución mínima y segura es darles tablas propias por hotel, con las reglas de acceso ya existentes (`is_hotel_member` / `has_hotel_role`).

## Solución mínima

### 1. Migración nueva (una sola, aditiva, sin borrar nada)

Tablas nuevas, cada una con `hotel_id` y GRANT + RLS en la misma migración:

- `hotel_guests` — datos del huésped (nombre, documento, contacto, idioma, acompañantes, notas).
- `hotel_reservations` — habitación, fechas (entrada/salida), canal, importe, estado de reserva y de estancia, huésped.
- `hotel_tasks` — título, habitación, departamento, prioridad, estado, asignado, horas.
- `hotel_incidents` — habitación, categoría, descripción, bloqueante, estado, reporta/asigna, horas.

Reglas de acceso (sin abrir nada a terceros):

- **Lectura**: cualquier miembro activo del hotel (`is_hotel_member`).
- **Reservas y huéspedes (escritura)**: owner, director, recepción.
- **Tareas**: crean owner/director/recepción; el asignado (housekeeping/mantenimiento) puede actualizar estado y horas de sus tareas.
- **Incidencias**: cualquier miembro puede reportar; owner/director/mantenimiento actualizan.
- Nadie fuera del hotel ve ni toca nada; `service_role` conserva acceso total.

Sin cambios destructivos: no se toca `company_worlds` ni datos existentes.

### 2. Cambios en la app (sin tocar diseño ni mapa 3D)

- `src/lib/suite/cloud.ts`: cargar/guardar reservas, huéspedes, tareas e incidencias por hotel autorizado (misma pauta que `loadConfig`).
- `src/lib/suite/store.tsx`: al hidratar, fusionar los datos operativos de la nube en cada hotel autorizado (propietario y empleados ven lo mismo); las acciones (`addReservation`, `checkIn`, `startTask`, `finishTask`, `reportIssue`, etc.) escriben en la nube además del estado local, con el estado de guardado honesto ("Guardado en la nube" / "Error al guardar").
- El modo demo (sin sesión) sigue igual: solo navegador.
- `company_worlds` se mantiene para el mundo/isla del propietario; los datos operativos dejan de depender del blob.

### 3. Concurrencia

Al ser filas por entidad (no un blob), dos usuarios pueden trabajar a la vez sin pisarse: cada reserva/tarea/incidencia es una fila independiente. Las actualizaciones usan la fila concreta, no el documento completo.

## Pruebas

- Tests unitarios de las nuevas reglas de mapeo/permisos (vitest, junto a los existentes).
- Tests de integración contra la base (misma pauta que `cloud-owner.integration.test.ts`): miembro autorizado lee/escribe en su hotel; usuario ajeno no; recepción no edita configuración; limpieza completa su tarea.
- Compilación y suite completa de tests.
- Verificación con sesión real si hay cuenta disponible: crear reserva como propietario, recargar y comprobar que persiste.

## Limitaciones conocidas (se dirán en la entrega)

- Las notificaciones operativas se derivan de los datos; no se crea tabla propia en esta fase.
- Los datos operativos que hoy existan solo en el blob de `company_worlds` no se migran (no hay datos reales que migrar; el demo sigue local).
- Sin cuentas reales de empleado, la prueba extremo a extremo con dos usuarios quedará descrita para verificación manual.

## Archivos previstos

- Nueva migración `0010_operational_tables` (única).
- `src/lib/suite/cloud.ts`, `src/lib/suite/store.tsx` (hidratación y escritura).
- Tests nuevos en `src/test/`.
- `AGENTS.md` / `roadmap.md` (registro de la decisión).
