# Sprint 02 — implementación secuencial

Retomar los hallazgos registrados sin repetir la auditoría. Mantener intactos Hotel Homeless, autenticación, roles, configuración de habitaciones y guardado atómico.

## Orden de trabajo

1. **Personal ficticio:** crear tareas e incidencias reales sin responsables inventados; registrar al iniciador de tareas sin asignar; mantener la demo y eliminar afirmaciones de notificación no confirmadas.
2. **Informes de incidencias:** quitar habitación y descripción demo en cuentas reales, exigir habitación del hotel actual y descripción no vacía antes de guardar.
3. **Limpieza:** reutilizar tareas abiertas, impedir inicio/finalización repetidos y conservar estados sincronizados; permitir nuevas limpiezzas tras completar la anterior.
4. **Huéspedes:** editar nombre, documento, teléfono, correo, idioma y notas desde la ficha usando `updateGuest` y el guardado compartido existente.
5. **Operaciones reales:** conservar la base de fechas mientras no esté resuelta su compatibilidad; no simular bienvenida enviada ni adjuntos en cuentas reales. Documentar el bloqueo de fechas si requiere una migración o decisión fuera del alcance autorizado.

## Validación y protección

- Ejecutar pruebas aisladas después de cada tarea, para demo y contexto autenticado simulado, incluyendo creación de reserva, check-in/out, limpieza, incidencia, edición y recarga.
- Comprobar las pantallas modificadas; no escribir en Hotel Homeless ni usar sus operaciones como datos de prueba.
- Una prueba real compartida requiere un hotel de prueba autorizado independiente. Si no existe, indicar que la persistencia cloud real queda pendiente, sin inventar resultados.
- Actualizar `roadmap.md` tras cada tarea con cambios, pruebas y siguiente paso; continuar las tareas independientes ante bloqueos concretos.

## Detalles técnicos

- Cambios concentrados en `src/lib/suite/store.tsx`, `src/components/suite/panels.tsx`, `src/routes/huespedes.tsx` y pruebas en `src/test/`.
- Reutilizar `setS`, `operationChanges` y la cola actual sin crear otro sistema de persistencia.
- Mantener los permisos existentes y confirmaciones de guardado emitidas tras la escritura atómica.
- No ejecutar migraciones ni correcciones retroactivas de datos.
