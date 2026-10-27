# Primera intervención: editar una habitación y guardarla

## Estado actual
- Cada habitación ya tiene: número, planta, tipo, tarifa, estado de limpieza, fuera de servicio, capacidad, camas, baño, terraza, vista y metros.
- La ficha de habitación existe (se abre desde Habitaciones) pero es solo de consulta. No hay forma de editar sus características.
- El mapa del hotel permite seleccionar una habitación y ver su interior, pero no abre esa ficha.
- Las habitaciones se guardan dentro del mundo privado de la empresa en la nube. Ese guardado aún no se ha probado con una cuenta real.
- Ocupación (reservas/estancias) y estado operativo (limpieza, mantenimiento, fuera de servicio) ya se calculan por separado.

## Qué se hará
1. **Botón «Editar» en la ficha de habitación** con: tipo/categoría, tarifa base, capacidad, camas, baño, vista, metros, terraza y observaciones internas.
2. **Validación:** tarifa mayor que 0, capacidad entre 1 y 10, metros positivos, tipo obligatorio.
3. **Aviso de consecuencias:** si cambias el tipo o la tarifa y la habitación tiene reservas futuras, se avisa de cuántas son y que sus importes no cambian.
4. **Historial:** cada cambio queda registrado con quién y cuándo, y qué campos cambiaron; se ve en la ficha.
5. **Desde el mapa:** al elegir una habitación aparece «Abrir ficha», que abre la misma ficha editable.
6. Los cambios se reflejan a la vez en la ficha, el listado y el mapa.

## Qué NO se hará ahora
- No se cambia el número de habitación ni la planta (podría romper reservas e incidencias; necesita su propia intervención).
- No se borran habitaciones; el «fuera de servicio» actual sigue siendo la forma de retirarlas.
- No se tocan reservas, precios, gráficos, tablas ni seguridad.

## Pruebas
- Prueba automática: la validación rechaza valores incorrectos y editar una habitación no altera sus reservas, tareas ni incidencias.
- Compilación y pruebas existentes.
- Prueba manual pendiente: editar, recargar con una cuenta real y comprobar que el cambio sigue.

## Detalles técnicos
- `src/lib/suite/data.ts`: campo opcional `notes` en `Room`; función pura `validateRoomEdit`.
- `src/lib/suite/store.tsx`: acción `updateRoom(number, patch)` que solo modifica campos permitidos y añade entrada al historial existente (`push`).
- `src/components/suite/panels.tsx`: modo edición en `RoomSheet`.
- `src/routes/hotel.tsx`: botón «Abrir ficha» que monta `RoomSheet`.
- Test nuevo en `src/test/`. Sin migraciones.
