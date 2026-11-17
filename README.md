# One Less One — Daniel y Lab

Repositorio central de la aplicación One Less One para **Daniel** y el entorno de pruebas **Lab**. Las versiones comparten el código fuente principal, pero **NO** comparten claves de almacenamiento.

## Accesos

- Daniel (producción): https://arcereciodaniel.github.io/one-less-one-daniel/
- Lab (pruebas): https://arcereciodaniel.github.io/one-less-one-daniel/lab/
- Lab (enlace antiguo conservado temporalmente): https://arcereciodaniel.github.io/one-less-one-lab/

**Gloriana continúa en su repositorio y enlace actuales. No fue modificada.**

## Protección de datos

Los registros están en el almacenamiento local de cada navegador, NO en GitHub. Daniel utiliza la clave `daniel_finanzas_local_v1` y Lab la clave `rastro_lab_v7_1_data_v1`. Sus preferencias y claves de UI también son diferentes. Las rutas antigua y nueva de Lab pertenecen al mismo origen `https://arcereciodaniel.github.io`, por lo que pueden acceder a los mismos datos de Lab **si se abren en el mismo navegador y perfil**, sin exportar o importar JSON. Diferentes dispositivos/navegadores no comparten automáticamente esos registros.

**Antes de retirarlo, exportar un respaldo JSON desde Lab antiguo y comparar movimientos, presupuestos y saldos al abrir Lab nuevo.** Mantener el repositorio Lab original mientras se realiza esa comprobación. No ejecutar una restauración en Daniel con el JSON de Lab ni viceversa.

## Una sola fuente de código

`index.html` es el archivo principal de la aplicación Daniel. `scripts/build-lab.cjs` genera `lab/index.html` desde él, cambiando solo:
- Nombre/etiqueta visual Lab;
- 4 claves de almacenamiento/perfil y valor inicial de Cobros;
- Rutas de los archivos compartidos `mobile-pilot/desktop.css` y `mobile-pilot/desktop.js`.

El manifest de Lab se genera desde el manifest principal. No se modifica el Worker de Cloudflare: **el piloto móvil conectado continúa siendo únicamente Daniel**.

### Para actualizar la aplicación común

1. Modificar `index.html` en este repositorio.
2. Ejecutar `node scripts/build-lab.cjs` antes de guardar los cambios en Git.
3. Confirmar `node scripts/build-lab.cjs --check` y `node --test tests/lab-consolidation.test.cjs`.
4. Publicar en `main`. GitHub Pages publica tanto la raíz como la subcarpeta `lab/`, y las pruebas automáticas rechazan desajustes entre versiones.

No borrar la carpeta `lab/` ni el repositorio antiguo sin comprobar la equivalencia de datos desde el navegador usado para Lab. Si alguna vez se decide eliminar el repositorio antiguo, su dirección GitHub Pages dejará de funcionar, salvo que se configure un sitio/redireccionamiento alternativo.

## Seguridad y estabilidad V10.3

- `index-lab.html` (Lab V7.1) ahora redirige a `lab/` y no puede escribir en el mismo historial con un esquema anterior.
- Cada pestaña de Daniel y de Lab verifica su propia clave de datos antes de guardar. Si detecta cambios en otra pestaña o una falla de verificación, bloquea la escritura y presenta un aviso con opción de recargar. **Es una detección conservadora de conflictos, no una operación atómica de base de datos:** evitá editar simultáneamente en dos pestañas.
- Restaurar y restablecer pasan por la misma comprobación, sin mezclar perfiles.
- La operación **Respaldar** registra la fecha de solicitud localmente, pero la aplicación no puede garantizar que el archivo se haya guardado externamente. Confirmá su presencia en Descargas.
- La integración de Cloudflare se limita a Daniel y no se muestra en Lab.
- La publicación web con pruebas previas requiere elegir **GitHub Actions** en Settings → Pages → Build and deployment → Source, cuando el flujo de Pages verificado se encuentre configurado.


Referencia de activación de Pages V10.3: [publicación verificada](docs/pages-v10-3.md).


## V10.4 · Motor financiero verificable

Se amplían las pruebas de Movimientos, Deudas, Cobros, Metas, conciliaciones y CRC/USD con casos de saldos esperados. Los nuevos abonos en USD registran la tasa de conversión al cobrar. Los abonos anteriores y los historiales existentes se conservan. Las conciliaciones antiguas sin secuencia de operaciones dejan de duplicar movimientos del mismo día sin posterioridad verificable.

## V10.5 — Cobros compartidos en CRC/USD

En **Cobros → Dividir gasto** registrá un gasto pagado por vos (ej. hotel por **$328**) y distribuí el total por partes iguales o montos personalizados. Podés asignar varias partes a una sola persona: si vos cubrís 1 parte, Charlie cubre 2 y Ana 1, se generan **Charlie: $164**, **Ana: $82**, **tu parte: $82**. La herramienta crea **un grupo** y **un cobro pendiente individual por persona**, con moneda original, fecha y el importe exacto. La propia parte NO genera un cobro.

One Less One Móvil conserva las tres acciones principales y añade en **Cobro** la selección CRC/USD y el control **Dividir entre varias personas**. El iPhone envía un único paquete idempotente al Worker D1 y Daniel crea todos los cargos al sincronizar. Un reintento no duplica el grupo.

Este reparto **no registra automáticamente un Gasto ni un Ingreso** en Movimientos: si pagaste un hotel de $328 y todavía no registraste ese gasto, registralo una vez por separado. Los pagos posteriores se anotan en cada cobro y, opcionalmente, como ingreso o reembolso vinculado al movimiento. Lab solo utiliza la interfaz local: Cloudflare permanece exclusivo para Daniel. Los registros históricos siguen intactos y Gloriana no fue modificada.

Los cálculos de reparto se hacen en unidades monetarias mínimas (centavos), con validación de sumas exactas y sin permitir deudores repetidos. La función está cubierta por pruebas del Worker, el reparto y la interfaz de escritorio.

## V10.6 — Gastos sucesivos dentro de un mismo grupo

En **Cobros → Dividir gasto** podés elegir **Crear grupo nuevo** o un grupo activo existente, como **Viaje a Santa Teresa**. Al elegir un grupo ya creado aparecen las personas asociadas, pero **no se incluyen automáticamente**: escogé solo quienes participaron en cada gasto. Los cobros anteriores permanecen intactos; se agrega un cobro independiente por cada persona y concepto, con fecha y moneda original.

Ejemplo: un hotel de $720 entre vos, Charlie, Cardona y Joshua (cada uno $180), seguido de una cena de $60 que pagaste para vos, Charlie y Cardona (cada uno $20). Solo se crean dos nuevos cobros por la cena: Charlie queda con $200 ($180 hotel + $20 cena), Cardona con $200 y Joshua conserva $180.

La pestaña **Grupos** incluye un resumen **por persona** con cobros de todos los meses y desglose por concepto. Si un grupo tiene cobros en colones y dólares, conserva subtotales separados por moneda (sin mezclar montos originales); los indicadores generales de la aplicación mantienen sus equivalencias CRC de presentación.

Desde **One Less One Móvil → Cobro** también podés elegir un grupo vigente, seleccionar participantes habituales y registrar el reparto o un cobro individual. Solo se sincronizan el ID/nombre del grupo y nombres de personas; no se envían balances, importes anteriores, notas ni respaldos. Se requiere haber sincronizado Daniel para actualizar el catálogo antes de reutilizar grupos en el teléfono.

**Integridad:** una cena nueva no sobrescribe el hotel ni recrea el grupo; los reintentos móviles no duplican cargos. Ningún reparto agrega otro gasto o ingreso en Movimientos. Los abonos posteriores se registran individualmente como antes. Gloriana queda sin cambios.

## V10.7 — Cobros individuales desde iPhone y CRC/USD en las tres acciones

**Gasto, Ingreso y Cobro** aceptan CRC o USD desde el formulario móvil. Recibir $120 se captura como 120 USD, sin conversión manual. Daniel conserva importe y moneda originales; al importar aplica la tasa de **compra** confirmada para Ingreso y la de **venta** para Gasto, guardando una instantánea del TC. Si el navegador de Daniel no tiene TC confirmado, el registro USD permanece pendiente.

En Cobro móvil se distingue entre **Sin grupo**, **+ Crear grupo nuevo** y **un grupo existente**. Se puede crear «Mamá» con su primer cobro individual sin activar Dividir gasto. Crear el grupo y el cobro se confirma en un único guardado local, sin duplicarlos por reintentos. El reparto V10.6 permanece intacto.

El teléfono solo recibe el catálogo mínimo (categorías, grupos, nombres), nunca el historial de gastos, saldos ni respaldos. El tipo de cambio utilizado es el disponible en Daniel **al sincronizar**, no necesariamente el del día en que el iPhone capturó la operación si se sincronizó después. Cloudflare continúa siendo exclusivo de Daniel; Gloriana no se modifica.

## V10.8 — Sincronización entendible y TC histórico

El registro de **Gasto, Ingreso y Cobro** del iPhone conserva CRC/USD originales. Al importar USD, Daniel utiliza una tasa **verificable y registrada** en `settings.fxHistory` o en la cotización confirmada actual: primero la de la fecha del movimiento; si no existe, la más reciente **anterior, con máximo siete días de antigüedad** para fines de semana y feriados. **Nunca se aplica una cotización posterior al registro**. La instantánea compra/venta y la fecha seleccionada quedan guardadas en cada movimiento o cobro, incluso en el reparto compartido. Ingresos usan compra y gastos venta. Sin tasa adecuada, el registro continúa en D1 como pendiente hasta añadir la tasa y volver a sincronizar. Los registros históricos ya guardados no se recalculan.

La configuración **Movimientos → Registro desde iPhone** muestra las incidencias por operación en un detalle desplegable: fecha, tipo, descripción y error con acceso a la pantalla pertinente. No se modifican respaldos, historial ni saldos del teléfono y se mantiene la importación idempotente. El formulario móvil añade una breve explicación solo al seleccionar USD y conserva la fecha cuando vuelve a estar visible en Safari.

**Despliegue:** V10.8 aplica a Daniel y Lab con almacenamiento independiente. Gloriana permanece sin cambios. Las pruebas automáticas verifican TC exacto/anterior, cobros compartidos, falta de histórico, corrección de incidencias y reintentos tras fallos de confirmación. No sustituye la comprobación manual en el iPhone de pantalla bloqueada, Safari, teclado y Atajos.


## V10.9 — Protección y claridad financiera (Daniel + Lab)

**Estado de tus datos y respaldos:** dentro de Inicio → Conciliación de saldo, ahora existe un detalle pequeño, optativo y 100 % local con diagnóstico no destructivo de IDs duplicados, referencias huérfanas entre categorías/deudas/metas/cobros, fechas y montos inválidos y movimientos USD antiguos sin tipo de cambio histórico. No reescribe registros, ni envía información, ni garantiza haber detectado todos los problemas. Las advertencias sirven para orientar una revisión manual y conservar un JSON antes de cualquier reparación.

**Respaldar:** el botón ahora diferencia claramente *solicitar descarga* de *confirmar archivo*. Se indica que el usuario debe comprobar el JSON en Descargas y guardarlo fuera del navegador; la fecha local es solo «última descarga solicitada». Se impide descargar inadvertidamente una copia de la pestaña desactualizada ante conflictos detectados; se mantienen las protecciones de V10.3 para escritura y restauración. El recordatorio es discreto dentro de Estado de datos (ninguna copia se sube a un servidor).

**Conciliación:** se distinguen saldos calculados y confirmados. Antes de guardar, la vista indica si el ajuste aumenta o reduce el saldo y recuerda que conciliar no crea ingreso, gasto ni pago de deuda. No permite fechas futuras o fuera del período al confirmar.

**Inicio:** la variación de 30 días se identifica explícitamente como variación del *saldo operativo*, no del gasto, y ya no colorea automáticamente una subida/bajada como buena o mala; el indicador de consumo de presupuesto aclara que no compara el tiempo transcurrido.

**Alcance y límites:** misma arquitectura localStorage y mismos registros/IDs; ningún nuevo módulo ni servidor. Lab mantiene almacenamiento aislado y Gloriana no se modifica. Las pruebas de V10.9 se ejecutan también antes de publicar GitHub Pages. El diagnóstico no sustituye un respaldo externo comprobado ni una conciliación con saldos reales.
