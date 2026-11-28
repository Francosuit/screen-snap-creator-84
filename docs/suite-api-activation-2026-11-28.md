# Activación autorizada de API propia — 28 noviembre 2026

## Resultado
Migración aditiva exacta aplicada: `drizzle/migrations/0012_suite_own_api_integrations.sql`; tipos regenerados automáticamente. Cuatro tablas nuevas, funciones atómicas y permisos del borrador. Sin backfill ni modificaciones de filas existentes.

## Recorrido real verificado
- Cuenta del propietario de «Validación P0 — prueba de persistencia», hotel `8acd9d61-1519-4083-bce4-b22288f36344`, aislada de Hotel Homeless.
- Integración creada desde la interfaz: `2ec01ca6-f673-4f87-a0ce-ef7ea0981da6`, correspondencia P0-101 → 101.
- POST firmado al endpoint real: reserva `A-P0API-52CCC065`, 1–3 diciembre, 240 €; modificación 1–4 diciembre, 360 €; cancelación. Los tres estados aparecen en Reservas y sobreviven recarga.
- Mismo evento reproducido y nueva entrega con igual revisión: una sola reserva. Petición con propiedad de otro hotel: 422 property_mismatch.
- Prueba de credencial: 200. Rotación: clave vieja 401, nueva firma 200. Revocación: 401 y estado revocado tras recarga. No se guardaron secretos en scripts, documentos ni capturas.
- Reserva ficticia cancelada e integración revocada conservadas como evidencia; no se eliminaron filas.

## Bloqueo real de consultas
GET reservas y disponibilidad detectaron una reserva histórica de P0 (`R-mvv3vm96t50p`) con entrada y salida iguales a cero. El exportador existente rechaza estancias sin noches. La corrección mínima devuelve 422 `invalid_pms_calendar` y los identificadores afectados, en lugar de un fallo 503 opaco; no excluye silenciosamente registros ni inventa fechas.

El recorrido de escritura está validado; el recorrido completo de lectura NO está cerrado. Resolver la historia requiere autorización específica o verificar las consultas en otro hotel aislado con calendarios válidos. Ningún proveedor externo queda confirmado por estas pruebas.

## Integridad y pruebas
- Hashes anteriores de P0 intactos excluyendo únicamente el nuevo huésped y reserva: 15 reservas, 17 huéspedes, 13 tareas, 10 incidencias y 5 operaciones de habitación.
- Hotel Homeless: mismos hashes de 25 reservas, 25 huéspedes, 66 tareas, 53 incidencias, 12 habitaciones y 12 operaciones, y configuración del hotel intacta.
- Navegador bloquea escrituras de company_worlds; no acciones sobre hoteles reales.
- Suite: 290 pasadas, 6 omitidas (integración previa sin PostgreSQL local); build automático OK 12:42:26 UTC. Sin build/typecheck manual.
- Capturas revisadas: reserva cancelada, Integraciones PC y móvil 390×844; sin overflow horizontal móvil.

## Seguridad y pendientes
Tablas nuevas con RLS; funciones de administración, claims y escritura reservadas a service_role. Rate buckets sin políticas para usuarios: intencionadamente solo servidor. El analizador muestra también funciones SECURITY DEFINER anteriores: no se afirma una certificación global ni se modifican permisos ajenos a esta tarea.

Tres avisos nuevos de rendimiento por auth.uid() en políticas: optimización pendiente, sin cambiar acceso. No publicado; faltan credenciales y verificación oficial de proveedor externo.