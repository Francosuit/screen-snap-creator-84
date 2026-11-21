# Sprint 03 — PMS y recepción: auditoría y plan (21/11/2026)

## Auditoría (solo lectura)
| Área | Estado | Dónde |
|---|---|---|
| Reservas: crear manual | Funciona (valida fechas, pax, solapamiento, OOS) | store.tsx `createReservation` |
| Reservas: editar | Incompleto: solo cambia salida (`changeStay`); no fechas de entrada, habitación, pax ni notas | store.tsx `changeStay`, reservas.tsx |
| Cancelación / no-show | Falta: el estado `cancelled` se muestra pero no hay acción | store.tsx L104, reservas.tsx |
| Huéspedes | Incompleto: edición OK (`updateGuest`); la reserva manual crea huésped vacío y no permite elegir uno existente | store.tsx `createReservation`/`updateGuest`, huespedes.tsx |
| Habitaciones | Funciona configuración y estados derivados; falta mover reserva de habitación | habitaciones.tsx, panels.tsx |
| Disponibilidad | Parcial: solo como validación al crear; no hay vista de habitaciones libres por rango | store.tsx L700 |
| Ocupación | Funciona en Panel/Revenue con día compartido | index.tsx, revenue.ts |
| Check-in / checkout | Funciona (vigencia, limpieza sin duplicar) | store.tsx `checkIn`/`checkOut` |
| Persistencia | Funciona con comando atómico por entidad | operations.ts |
| Historial | Parcial: actividad por hotel y auditoría de configuración de habitación; sin historial por reserva | panels.tsx, audit_log |

## Tareas propuestas (una por turno)
1. Cancelación y no-show — acción central en store, bloquea check-in, libera disponibilidad, registra actividad. Prueba: cancelar libera la habitación para una nueva reserva.
2. Edición completa de reserva — fechas de entrada, habitación, pax, notas, revalidando solapamiento y fechas absolutas. Depende de 1.
3. Huésped existente en reserva manual — buscar y vincular; evitar huéspedes vacíos.
4. Cambio de habitación en estancia — con regla de limpieza de la habitación anterior.
5. Vista de disponibilidad por rango de fechas en Reservas.
6. Historial por reserva — eventos persistidos (creación, edición, cancelación, check-in/out).
7. Validación final de Sprint 03 — pruebas, compilación, navegador PC/móvil.

## Riesgos
- Cambios de estado deben pasar por el comando atómico existente (conflictos multiusuario).
- No convertir reservas antiguas sin fecha absoluta; seguir con lectura dual.
- Demo debe seguir con fecha fija.

## Criterios y pruebas por tarea
Prueba unitaria de la regla (valores concretos), suite completa, compilación, recorrido en navegador sobre «Validación P0» con escrituras solo en registros ficticios marcados «PRUEBA», y comparación de conteos de Hotel Homeless antes/después.

## Protección de hoteles reales
Sin migraciones sin aprobación; nunca usar Hotel Homeless; pruebas destructivas solo en registros ficticios del hotel de validación.
