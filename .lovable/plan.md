# Validar y consolidar el guardado real del hotel

## Lo ya confirmado (sin cambios)
- Cada empresa tiene un único registro privado del mundo; la base de datos impide que una cuenta tenga dos.
- Las reglas de seguridad ya limitan leer, crear y actualizar ese registro a su propio dueño. No se tocan.
- Hoteles, plantas y habitaciones se guardan hoy dentro de ese único registro, no como entidades separadas.
- Ahora mismo hay 0 mundos guardados en la nube: nunca se ha completado un guardado real.

## Defectos a corregir (solo en el archivo central de datos)
1. **Guardados desordenados:** un guardado lento puede terminar después de uno más reciente y dejar en la nube una versión antigua. Se numera cada guardado y solo cuenta el último.
2. **Cambio de cuenta:** si la sesión se cierra fuera del botón «Cerrar sesión» (por ejemplo, al caducar), la app sigue mostrando al usuario anterior. Al detectar el cierre se limpia el usuario activo.
3. **Datos de otra cuenta:** al entrar con una cuenta distinta en el mismo navegador, se asegura que solo se muestren los hoteles de la cuenta autenticada.
4. **Estado honesto:** «Guardado en la nube» solo aparece tras confirmar la escritura; si falla se muestra «Error al guardar» con el motivo.

No se borran ni migran datos. La carga inicial nunca sustituye un mundo existente por uno vacío.

## Pruebas
- Prueba automática pequeña de la regla «solo cuenta el último guardado» y de «al cambiar de cuenta no se ven hoteles ajenos».
- Compilación y pruebas existentes.
- Recorrido real en la vista previa con una sesión de prueba: crear hotel, esperar «Guardado en la nube», recargar y comprobar que plantas y habitaciones siguen; captura del mapa.

## Comprobación manual para ti (aislamiento)
Con dos cuentas reales: crea un hotel con la cuenta A, cierra sesión, entra con la B y confirma que no ves el hotel de A; vuelve a A y confirma que sigue intacto.

## Siguiente mejora propuesta (no se hará ahora)
Guardar hoteles, plantas y habitaciones como registros propios, añadiéndolos junto al registro actual y copiando los datos sin borrar nada, para después leer de ellos poco a poco.

## Detalles técnicos
- Archivo: `src/lib/suite/store.tsx` (contador de secuencia en ref para upsert; en `SIGNED_OUT` vaciar `root.user`; filtrar por email de la sesión).
- Test nuevo en `src/test/` con funciones puras extraídas si es necesario.
- Sin migraciones ni cambios de RLS.
