# Misión maestra — resultado del primer bloque

## Estado funcional, no declaración de producto terminado

1. **Ya conectado al PMS:** Reservas, Huéspedes, Habitaciones, Hotel digital, Tareas y Revenue consumen la misma selección de hotel y las reservas del store. `suite_load_operations` sustituye las entidades operativas por filas compartidas; `suite_apply_operations` guarda cambios con comparación del estado previo. No se añadió otro motor ni otra base. La configuración de habitaciones tiene su guardado separado. Esta cadena se revisó en código; no se volvió a certificar escritura multiusuario en este bloque.
2. **Información ficticia encontrada:** Control mostraba 71%, ADR 162 €, RevPAR 115 €, pickup +36, previsión y gráficos predefinidos también en cuentas reales. Reservas afirmaba sincronización con canales inexistente. Integraciones atribuía reservas a pruebas sin verificar su origen. Panel empleaba nombres demo y llamaba «En vivo» al registro que no forma parte del historial operativo compartido.
3. **Problemas de cálculo:** Panel incluía checkout de hoy como noche vendida, no excluía no-show de ingresos mensuales y promediaba tarifas aunque hubiera desglose nocturno almacenado. «Facturación» no demuestra cobros: no existen registros de pagos/reembolsos para acreditarlos.
4. **Corregido:** cifras/previsiones/recomendaciones estáticas de Control solo en demo; Panel reutiliza las noches y exclusión de canceladas/no-show de `revenue.ts`; se corrigieron nombres, ingresos y etiquetas. Reservas ya no promete sincronización. Integraciones presenta proveedores desconectados y no ofrece un botón de solicitud que solo muestre un aviso.
5. **Archivos:** `src/lib/suite/api/quendoo-contracts.ts`, `quendoo.server.ts`, `src/test/quendoo.test.ts`, `src/test/dashboard-revenue.test.ts`, `src/lib/suite/revenue.ts`, `src/routes/index.tsx`, `control.tsx`, `reservas.tsx`, `integraciones.tsx`, `AGENTS.md`, `roadmap.md` y este informe.
6. **Operaciones del adaptador implementadas:** OAuth client_credentials o token hotelier; lectura de propiedades/tipos/planes; feed filtrado por propiedad; aplicación mediante escritor PMS inyectado; lectura durable de revisión antes de ACK; disponibilidad, tarifas y restricciones; HMAC de webhook sobre cuerpo original y ventana de cinco minutos. Cuerpos limitados, tiempos de espera, destinos fijos, redirecciones rechazadas y errores sanitizados. No hay endpoint webhook activo, repositorio persistente ni escritor PMS real conectado. No se implementaron cancelaciones salientes ni un endpoint genérico de modificación inventado.
7. **Proveedor elegido:** Quendoo Connect por sandbox/API/soporte/revisión gratuitos publicados y feed con ACK. Channex sigue siendo alternativa si el acceso real tarda. La selección no prueba que Quendoo nos conceda acceso antes ni que sus canales sean gratuitos para hoteles.
8. **Pruebas contra sandbox:** ninguna; Franco confirmó «Todavía no» al acceso de Quendoo. No se solicitó ni inventó una credencial. No se creó una conexión gestionada sin acceso.
9. **Reserva externa recibida y guardada en PMS:** NO. Las pruebas HTTP utilizan transportes aislados; el escritor de prueba no es un repositorio de producción. Se exige guardado atómico existente más mapeo/registro de revisiones antes de activar.
10. **Reserva sandbox en módulos:** NO comprobada; no existe todavía. Se verificó la lectura de las pantallas existentes con la cuenta de Validación P0.
11. **Pruebas ejecutadas:** suite completa final 256 pasadas, 6 omitidas, cero fallos; 36 del adaptador y 5 del cálculo del Panel. Se corrigieron el refinamiento que arrojaba excepción con fecha inválida, los tipos de pruebas y dos formatos de respuesta contrastados contra OpenAPI. Omitidas: integración de invitaciones sin PostgreSQL aislado. Advertencias previas de React `act` permanecen. Flujo aislado motor→HTTP→escritor→read-back→ACK→historial probado; no equivale a integración real, aislamiento RLS ni recuperación de servidor.
12. **Tipos y compilación:** comprobación automática final `build OK` 28/11/2026 08:59:09 UTC; incluye la comprobación de tipos que había detectado errores ahora corregidos. No se ejecutó compilación ni typecheck manual independiente. `git diff --check` limpio.
13. **Autorizaciones externas pendientes:** alta de sandbox Quendoo; luego credenciales por formulario seguro, propiedad/tipos/planes de prueba; autorización explícita de migración aditiva y de operaciones ficticias P0. No basta autorizar credenciales para autorizar hoteles reales. La propuesta existente `docs/api-persistence.draft.sql` sigue sin aplicar; hay que completar y probar funciones atómicas de runs/revisiones/PMS antes de pedir ejecutar el conjunto.
14. **Antes de vender:** escritor PMS durable con reglas/mapeos/versiones y asignación por tipo; aislamiento real de dos hoteles; nuevas/modificadas/canceladas/duplicadas/fuera de orden; recuperación después de PMS guardado y ACK fallido; cola de salida y reconciliación de respuestas parciales; gestión autenticada de conexiones/mapeos/historial; sandbox, certificación y autorización OTA/producción. Sprint 05 sigue abierto por su recorrido persistente P0 y no se modificó «A revisar». No se auditaron todos los módulos secundarios ni se declara eliminada toda información ficticia del producto.

## Evidencia visual y protección
- Navegador real: identidad y hotel «Validación P0 — prueba de persistencia» visibles antes de recorrer Panel, Control, Reservas, Integraciones y Tareas, en PC 1072×831 y móvil 390×844.
- Dos recorridos, último tras corregir Integraciones: sin errores de ejecución ni overflow horizontal. Quendoo desconectada; ninguna solicitud habilitada; Control sin KPI demo. Panel móvil: ingresos habitaciones mes 2460 €, hoy 0 €, según las reservas leídas; no son cifras de sandbox.
- Demo separada: Control conserva 71% y aviso de demostración. No se alteraron sus entidades.
- Escrituras bloqueadas a nivel navegador; seis intentos de guardar `company_worlds` bloqueados en el último recorrido, únicamente se permitió el RPC de lectura `suite_load_operations`. «Guardando…» en las capturas refleja esa protección, no prueba guardado exitoso.
- Hotel Homeless no utilizado. Sin migraciones, publicación, borrado ni escrituras de hoteles; ninguna llamada autenticada a Quendoo.
- Seguridad consultada: revisión profunda previa sin hallazgos, pero marcada desactualizada; NO certifica este adaptador ni una integración activa.

## Comparación oficial consultada el 28/11/2026

| Aspecto | Quendoo Connect | Channex | Mews |
| --- | --- | --- | --- |
| Coste API/sandbox | Publica gratuito, sin fee de partner/certificación/llamada | Staging gratuito; producción publica $130/mes plataforma + $7/hotel base, extras y descuentos | API gratuita; demo pública, certificación |
| Encaje | PMS propio con inventario y feed de reservas | PMS propio conectado a OTAs | Integrar con otro PMS; no sustituir nuestro núcleo |
| Auth | OAuth client_credentials (token 1h) o hotelier token; scopes/propiedades | API key, propiedades autorizadas | ClientToken/AccessToken, autorización de propiedad |
| Reservas | Feed: created/modified/cancelled/no_show/confirmed/requested/approved + ACK | Feed: new/modified/cancelled + ACK | Connector API y eventos propios |
| Salida | Inventario, tarifas, restricciones; cancelar/no-show oficial. No asumir modificación genérica | Inventario, tarifas y restricciones; no asumir cambios de reserva en cualquier OTA | Operaciones según contrato/use case |
| Límites | Lecturas 300/min, 100000/día; ARI 60/min/propiedad; otros writes 120/min; lotes 1000 filas/20000 noches | ARI restricciones 10/min/propiedad, disponibilidad 10/min aparte | No se evaluaron límites en profundidad en este bloque |
| Webhooks | HMAC-SHA256 timestamp+cuerpo, ±5min; feed como fuente | Firma y feed de respaldo | No implementados aquí |
| Producción/OTAs | Alta y revisión proveedor; autorización hotel/scopes. Listado contractual de canales/coste hotel no confirmado | Certificación, autorización OTA; publica Booking.com, Expedia, Airbnb y 78 canales | Certificación/piloto; no es garantía de distribución OTA propia |

Fuentes:
- https://developers.quendoo.com/connect
- https://developers.quendoo.com/start
- https://api.quendoo.com/v1/qc/openapi.yaml
- https://api.quendoo.com/v1/qc/docs/authentication.md
- https://api.quendoo.com/v1/qc/docs/receiving-bookings.md
- https://api.quendoo.com/v1/qc/docs/prices-availability.md
- https://channex.io/pricing
- https://docs.channex.io/guides/pms-integration-guide
- https://docs.channex.io/api-v.1-documentation/ari/update-restrictions-api
- https://docs.mews.com/connector-api/your-journey/certification

## Próximo bloque único
Completar y probar el guardado atómico PMS + mapeo + revisión en un entorno de base aislado, preparar la migración aditiva completa y pedir autorización antes de aplicarla; después recibir una reserva de sandbox, leerla en todas las pantallas y solo entonces enviar ACK. Sin acceso externo, avanzar en esa persistencia aislada, no activar botones ni simular conexión.