# Cierre Sprint 02 y auditoría Sprint 03

## Fase 1 — Cerrar Sprint 02 (sin escrituras reales)
1. Revisar el estado real: cambios temporales en reloj, zona horaria, cabecera, calendario de Control, reservas, check-in, checkout y Tareas móvil.
2. Ejecutar la suite completa y la compilación; registrar resultados exactos.
3. Resolver el bloqueo de aislamiento de «Validación P0»:
   - Confirmar por consulta de solo lectura que el hotel pertenece solo a la cuenta de validación y que esa cuenta no ve Hotel Homeless.
   - Iniciar sesión en el navegador con bloqueo de escrituras activo y comprobar que el hotel activo es «Validación P0» antes de abrir pantallas.
   - Si no se puede garantizar, detenerse y reportarlo.
4. Validación visual en PC y móvil: demo (fecha fija 10/11/2026) y cuenta de validación (fecha local del hotel) en Panel, Reservas, Control, Habitaciones, Huéspedes, Tareas y Revenue.
5. Comprobar regresiones: consola sin errores, Hotel Homeless sin cambios (conteos y fechas de última escritura).
6. Corregir solo problemas críticos; los menores quedan como pendientes.
7. Actualizar roadmap con estado real y criterios de cierre.

## Fase 2 — Auditoría Sprint 03 (solo lectura)
Revisar reservas, huéspedes, habitaciones, disponibilidad, ocupación, check-in, checkout, edición y cancelación, persistencia, historial y trazabilidad. Clasificar cada punto como funciona / incompleto / falta / por integrar, con referencias a archivos.

## Fase 3 — Plan técnico Sprint 03
Tareas numeradas con archivos afectados, dependencias, riesgos, criterios de aceptación, pruebas, validación visual y protección de hoteles reales. Se presenta para aprobación; no se implementa nada del Sprint 03.

## Informe final
Estado de Sprint 02, pruebas y compilación, validación visual, problemas, auditoría PMS, plan Sprint 03 y cambios en roadmap.

## Reglas
Sin migraciones, sin escrituras en hoteles reales, sin usar Hotel Homeless, sin borrar campos antiguos, nada marcado como terminado sin prueba real.
