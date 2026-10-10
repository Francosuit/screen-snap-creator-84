# Mi Isla — primera versión funcional

## Dirección visual
- Adoptar tus referencias: una maqueta de ciudad hotelera premium, con costa, calles, árboles, jardines y hoteles reconocibles.
- Interfaz compacta negra y dorada de SUITE SOLUTIONS, con el mundo como protagonista y actividad operativa al lado.
- No utilizar la captura como fondo fijo: los edificios serán seleccionables y responderán a los datos de Suite.

## Lo que ya existe
- Registro, inicio de sesión y constructor de hoteles en modo demo, guardados únicamente en este navegador.
- Vista de ciudad en 2D isométrica; hotel por plantas y fichas de habitación.
- Reservas, limpieza, incidencias, tareas, notificaciones e historial conectados mediante un estado compartido.
- No hay una conexión de Cloud en el código actual: todavía no existe aislamiento seguro entre empresas ni sincronización entre dispositivos.

## Primera entrega
1. **Cuentas y empresa:** conectar Lovable Cloud, sustituir el acceso demo por cuentas reales y guardar perfil, empresa e identidad de su isla. Conservar la confirmación de correo; no migrar contraseñas del navegador. Separar expresamente los hoteles DEMO de los hoteles de cada empresa.
2. **Mi Isla:** evolucionar la ciudad actual a una escena 3D interactiva con costa, calles, parcelas y vegetación. Mostrar los hoteles propios como edificios generados desde su configuración. Incluir zoom, giro, vista cenital/isométrica y alternativa 2D.
3. **Construcciones:** catálogo inicial de hotel, mantenimiento, housekeeping, lavandería, almacén y proveedores. Elegir nombre, apariencia y parcela; añadir, mover y guardar sin superposiciones. Las operaciones no implementadas mostrarán únicamente su configuración disponible.
4. **Operación conectada:** seleccionar un hotel para ver sus indicadores y entrar en sus plantas y habitaciones existentes. Los centros de mantenimiento y housekeeping mostrarán las tareas e incidencias del hotel al que estén vinculados. Las conexiones visuales representarán asignaciones registradas, nunca seguimiento físico inventado.
5. **Acceso y edición:** añadir «Mi Isla» al menú y «Ver mi hotel» al inicio. Permitir editar apariencia sin regenerar habitaciones ni alterar reservas o tareas.
6. **Guardado y estados:** reconstruir la isla al volver a entrar; indicar si los cambios están guardados, pendientes o fallaron. No mostrar una conexión en tiempo real hasta que exista una suscripción funcionando.

## Siguientes entregas
- Distribución editable de gimnasio, spa, restaurante y otras zonas por planta.
- Mobiliario interior y personal representativo asociado a tareas, con capas activables.
- Cuentas de personal, permisos por hotel y reglas configurables de limpieza/mantenimiento.
- Historial empresarial completo y sincronización de las operaciones entre sesiones autorizadas.

## Detalles técnicos
- Reutilizar el constructor, las fichas, las reglas operativas y el store compartido; no sustituir los módulos actuales.
- Three.js con React Three Fiber para la isla; modelos locales de licencia CC0 para elementos reconocibles y geometría generada para la estructura configurable de los hoteles.
- Separar configuración visual, representación espacial y operación hotelera. La cámara y las animaciones no producirán eventos empresariales.
- Cloud: empresas, perfiles, membresías/roles separados, islas, parcelas y construcciones con permisos comprobados en los datos, no solo filtros visuales.
- No presentar la persistencia de la isla como persistencia completa del sistema: los módulos operativos actuales seguirán identificados como demo hasta su migración posterior.

## Comprobación de la entrega
- Crear una cuenta, confirmar el correo, crear un hotel y verlo en su isla.
- Añadir un centro de mantenimiento, cambiar su parcela y apariencia, recargar y recuperar los cambios.
- Comprobar que otra empresa no puede leer ni modificar la isla.
- Abrir hotel → planta → habitación sin perder las funciones actuales.
- Verificar escena visible, controles y alternativa 2D en pantallas grandes y pequeñas.

## Coste y alcance
Trabajo por entregas verificables para evitar una reconstrucción innecesaria. El desarrollo consume créditos; no puedo prometer coste cero. Cloud puede tener costes de uso y se activará mediante su autorización correspondiente.