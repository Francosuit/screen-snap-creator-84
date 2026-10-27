# Suite Hotel OS — completar todas las mejoras del documento maestro

Se construye sobre la app actual, sin rehacerla ni borrar datos. Se entrega por fases y cada una se prueba antes de pasar a la siguiente. Si se acaban los créditos a mitad, lo terminado queda funcionando y se indica qué falta.

## Ya hecho
- Fichas separadas de hotel, plantas y habitaciones en la nube, con historial.
- Permisos por puesto y accesos del personal por correo.
- Edición completa de cada cuarto: ocupación, camas, equipamiento.

## Fase 1 (cierre)
- Guardar el equipamiento de cada cuarto también en su ficha y en el historial.
- El personal invitado ve las reservas y tareas del hotel según su puesto: recepción ve reservas, housekeeping sus limpiezas y mantenimiento sus incidencias.
- Probar con dos cuentas de prueba que una empresa no ve los datos de la otra.

## Fase 2 — Reservas y estancias
- Arrastrar en el calendario para crear una reserva con la habitación y las fechas ya puestas.
- Estirar una reserva para alargar o acortar la estancia; bloqueo si choca con otra.
- Al alargar: recalcula el importe y mueve la limpieza de salida. Al acortar: avisa del cambio de importe, adelanta la limpieza y libera las noches.
- Editar y cancelar reservas, con historial.
- Importe = tarifa por noche × noches, visible en la reserva.

## Fase 3 — Limpieza y mantenimiento
- Dos tipos de limpieza: de salida (completa) y durante la estancia (repaso, respetando «no molestar»).
- Lista de tareas configurable por tipo de habitación.
- Fotos antes y después guardadas en la nube.
- Estados: pendiente, en curso, limpia, revisada, bloqueada.
- Cada camarera ve solo sus cuartos y recibe aviso cuando su cuarto ya puede limpiarse.
- Incidencias con prioridad; si bloquean el cuarto, este deja de venderse hasta cerrarlas.

## Fase 4 — Zonas, actividades e integraciones
- Seleccionar zonas comunes (piscina, gimnasio, spa…) en el mapa y crear actividades con horario y plazas.
- Avisos e incidencias de zonas comunes.
- Integraciones con estados verdaderos: disponible, pendiente de credenciales, conectado, error, modo demo. Ninguna aparece como «Conectado» sin estarlo.
- WhatsApp como integración que se activa solo cuando haya cuenta oficial.

## Fase 5 — Métricas y presupuesto
- Ingresos de este año comparados con el anterior.
- Presupuesto anual por mes y desviación.
- Gráfico de tarifa media por noche de cada mes.
- Todo calculado desde las reservas guardadas; los datos de prueba se marcan como DEMO.

## Fase 6 — Mapa 3D
- Ciudad 3D low-poly con calles, árboles y el hotel generado desde sus plantas y cuartos.
- Ventanas con el estado real de cada cuarto; plantas seleccionables; entrar al cuarto.
- Base de mantenimiento y zonas solo si existen en tu hotel.
- La versión 2D actual queda como respaldo si el 3D falla.

## Pruebas de cada fase
- Pruebas automáticas de las reglas (importes, solapes, permisos, limpiezas).
- Recorrido real en la vista previa con una cuenta de prueba: crear, editar, recargar y comprobar.
- Informe al final: qué funciona, qué falta, qué sigue siendo de prueba.

## Detalles técnicos
- Nuevas tablas en la nube para reservas, huéspedes, tareas, incidencias, actividades, integraciones y presupuestos, con permisos por puesto; los datos actuales se copian sin borrar el guardado anterior.
- La lectura pasa a esas tablas poco a poco, como se hizo con hoteles y cuartos.
- Fotos en un almacén privado por hotel.
- 3D con las librerías ya instaladas y carga diferida; el 2D se mantiene.
- Para pruebas con sesión hace falta una cuenta de prueba (se pedirá al empezar).
