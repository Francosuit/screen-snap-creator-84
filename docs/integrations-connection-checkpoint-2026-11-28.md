# Integraciones del PMS propio — checkpoint 28/11/2026

## Enfoque y conservación
- Fuente de instrucciones: `Plan_Completo_Integraciones_Suite_Hotel_OS_para_Lovable.docx` (leído completo, 7 páginas).
- Suite Hotel OS es el PMS central. No se cambió el motor de reservas, la navegación, Housekeeping ni los estados operativos.
- Se reutilizaron el cliente Quendoo, sus contratos y la autorización existente. No se instaló otro PMS, repositorio de reservas ni sistema de fechas.
- El adaptador anterior se conserva, pero Quendoo queda como **candidato**, no proveedor definitivo. Ninguna OTA está conectada por tener ese adaptador.

## Diagnóstico corto y encaje oficial
La documentación oficial admite OAuth para sistemas asociados, lectura de propiedades, revisiones de reservas y salida de inventario, tarifas y restricciones. Sin embargo, dice expresamente que los envíos de inventario aterrizan en el calendario propio de Quendoo y que la distribución posterior depende de su sincronización legacy; no demuestra conectividad independiente ni canales contratados para Suite.

Por tanto, se conserva y prueba el cliente existente sin presentarlo como el PMS principal ni confirmar idoneidad comercial definitiva. Channex continúa como candidato alternativo de conectividad, no otro PMS obligatorio.

Fuentes consultadas nuevamente:
- https://api.quendoo.com/v1/qc/openapi.yaml — autenticación, scopes, dirección de escritura y propiedad.
- https://api.quendoo.com/v1/qc/docs/authentication.md — acceso de partner, credenciales, límites y entornos separados.
- https://developers.quendoo.com/connect — producto/API.
- Alternativa pendiente de validación comercial: https://docs.channex.io/guides/pms-integration-guide

## Código conectado en este bloque
| Acción | Operación efectiva | Límite |
| --- | --- | --- |
| Abrir Integraciones | RPC autenticado; comprueba módulo y rol en la base; deriva organización del hotel visible; consulta configuración segura por hotel | No escribe hotel ni conexión |
| Actualizar configuración | Repite esa consulta en servidor | No sustituye errores por datos demo |
| Conectar | Abre pasos oficiales y enlace de solicitud de acceso al proveedor | No es OAuth authorization-code: Quendoo entrega credenciales de servicio por solicitud |
| Probar conexión | Reautoriza; si está configurada, OAuth/token real → GET propiedad → GET tipos y planes | En el estado actual responde bloqueo real antes de contactar al proveedor |

Una prueba satisfactoria muestra **Autenticación de pruebas verificada**, con fecha, propiedad y catálogo. No cambia el estado a Conectada ni activa entrada/salida. El resultado es puntual y no constituye auditoría durable ni última sincronización guardada. Un refresh exige repetir la prueba.

## Configuración exacta pendiente
Se puede completar el diagnóstico y la prueba de lectura sin migración. Configuración exclusiva de servidor:

- `SUITE_QUENDOO_BINDINGS`: JSON de asociaciones autorizadas, con esta estructura (descripción, no valores ficticios para cargar):
  - Array de objetos con `hotelId` (UUID interno), `organizationId` (org_owner del hotel), `propertyId` (ID autorizado Quendoo) y `environment` exactamente `staging`.
  - Un hotel y una propiedad no pueden aparecer dos veces; una organización contradictoria se rechaza.
- `SUITE_QUENDOO_CREDENTIALS`: secreto gestionado, JSON cuyas claves son UUIDs internos de hoteles; cada valor es **o** `{clientId, clientSecret}` **o** `{token}` del entorno staging.
  - Cargar por Ajustes del proyecto → Secrets; nunca por chat, navegador/localStorage o columna de credenciales.
  - En el despliegue se resuelve exclusivamente dentro del servidor; sin cache global, devolución ni logs de secretos.
  - Administración de altas, rotación y revocación sigue siendo manual por el propietario del proyecto; todavía no existe autoservicio seguro por cada hotel.

Acciones del propietario:
1. Solicitar a `office@quendoo.com` acceso partner de pruebas, `client_id` y `client_secret`, una propiedad sandbox y catálogo autorizado; confirmar distribución para PMS externo, canales, costes y requisitos de alta. No se redactó ni envió una solicitud en su nombre.
2. Con acceso real, asociar únicamente el hotel de pruebas autorizado y cargar credenciales por el canal seguro anterior.
3. Ejecutar Probar conexión. La lectura del catálogo confirma esos permisos, **no** `bookings.read` ni `inventory.write`; esos scopes requieren prueba del flujo posterior.
4. Autorizar el esquema completo solo cuando esté corregido y validado en base aislada. El borrador actual no está listo para aplicar.

## Bloqueo crítico de guardado externo detectado
La base existente guarda PMS con una sola llamada `suite_apply_operations` y el bloqueo `pg_advisory_xact_lock(hashtextextended(_hotel::text,0))`. Los cambios comparan el estado previo y conservan aislamiento de entidades.

El borrador `docs/api-persistence.draft.sql` concede a usuarios autenticados solo SELECT sobre mapeos. Por ello, **no basta envolver el PMS en una función SECURITY INVOKER**: no podría guardar el mapeo/revisión. Usar administración privilegiada sin identidad del usuario tampoco satisface las guardas del PMS.

Antes de autorizar persistencia hay que resolver ese privilegio de forma acotada, implementar el registro de revisión/digest/resultado y adquirir el mismo bloqueo antes de leer mapeos. Reserva + huésped + mapeo + revisión deben confirmar juntos; después se realiza read-back y ACK. No se encadenaron escrituras separadas ni se activó un escritor incompleto.

Pendientes concretos: funciones claim/journal/finish, transacción PMS/mapeos/revisiones, correspondencias de tipos/planes, privacidad/deduplicación de huéspedes, orden de eventos, outbox durable sin bucles, recepción oficial y reautorización, desconexión/auditoría persistentes, dos identidades/hoteles aislados y recuperación commit→ACK.

## Validación ejecutada
- **Unitarias/integración aislada:** suite completa **274 pasadas, 6 omitidas, 0 fallos**; incluye **18 nuevas** de conexión y las 36 anteriores Quendoo. Las omitidas siguen siendo pruebas previas de invitaciones sin su entorno PostgreSQL; no se omitieron pruebas nuevas.
- Se prueban rechazo de otra organización/hotel, binding ambiguo, entorno producción, propiedades inconsistentes, errores sanitizados, zona horaria distinta, ausencia de secreto, catálogo incoherente y que la prueba solo lee (sin feed, ACK ni inventario).
- **Compilación automática:** build OK 28/11/2026 09:14:09 UTC, tras corregir sintaxis de un test y modificadores override. No se ejecutó compilación/typecheck manual.
- **Navegador autenticado P0:** PC 1072×831 y móvil 390×844; Conectar abre pasos oficiales, Probar conexión devuelve el bloqueo verdadero `binding_missing`, recarga mantiene desconectada, sin errores runtime ni desbordamiento de página/modal. Un intento automático previo de guardar company_worlds fue bloqueado por la protección de la prueba; el toast de error en la captura móvil corresponde a esa protección, no a la conexión.
- **Demo móvil verificada:** acceso optativo desde login, catálogo conservado; cero botones Probar conexión, cero llamadas a funciones de conexión y sin desbordamiento. Última compilación automática OK 09:16:10 UTC.
- **Sandbox proveedor:** 0 llamadas autenticadas; no hay acceso ni credenciales. Ninguna reserva externa recibida, modificada o cancelada, ninguna sincronización saliente ni ACK probado contra proveedor.
- Entrada/salida: cliente y contratos existentes conservados, no activados. Módulos PMS no requieren otro motor; la reserva externa aún no existe para comprobarla en sus pantallas.

## Archivos
- Nuevos: `connection-contracts.ts`, `connection.server.ts`, `connection.functions.ts` en `src/lib/suite/api/`; `src/components/suite/IntegrationConsole.tsx`; `src/test/api-connection.test.ts`; este informe.
- Modificados: `src/routes/integraciones.tsx`, `AGENTS.md`, `roadmap.md`.
- Demo conserva su catálogo separado; ninguna conexión real se autentica en modo demo. No se auditaron nuevamente todos los módulos del producto ni se afirma haber eliminado todo dato ficticio.
- Sin migraciones, publicación, escrituras de hoteles, borrado ni cambios en Hotel Homeless. No se marca terminado el hito externo ni Sprint 05.