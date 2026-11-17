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

## V10.10 — Menos pasos y confirmaciones de acciones

- **Confirmaciones posteriores a la persistencia:** ventana pequeña y accesible al registrar gastos, ingresos, pagos de deuda, cobros, abonos, aportes a metas, movimientos desde formularios históricos y programaciones. Muestra tipo, importe y contexto; nunca debe abrirse antes de que `save()` termine. Se cierra con «Continuar», Escape o tocando fuera. Se mantienen las preguntas de confirmación previas para acciones destructivas, sin duplicarlas.
- **Piloto iPhone:** la ventana de éxito solo se abre tras la respuesta de recepción del Worker. Indica explícitamente «registro recibido para sincronizar», no «contabilizado en Daniel». En fallos de red se conserva el mismo identificador del borrador para reintentar; no hay confirmación falsa.
- **Metas cumplidas:** botón «Marcar cumplida» si el saldo actual es igual o superior al objetivo. Guarda el estado archivado y razón «Meta cumplida», conserva aportes, historial y saldos, y **no crea movimientos financieros**. El dinero reservado sigue en el fondo; para utilizarlo, la persona puede reactivar la meta y registrar un Uso objetivo. El filtro Archivadas distingue la etiqueta «Cumplida».
- **Movimientos frecuentes:** acceso «Repetir último» cuando existe un movimiento elegible; precarga datos y fecha actual sin registrar hasta pulsar Guardar. Las programaciones muestran «Revisar y registrar» cuando están pendientes, o «Preparar» para futuras. Nunca se ejecutan automáticamente y conservan protección idempotente para la misma fecha programada.
- **Deudas:** las próximas cuotas muestran fecha absoluta, tiempo restante o vencido, importes parciales asociados y una explicación de que los ciclos son estimaciones: pagos tardíos y cambios de mínimos deben verificarse contra el banco. Los cálculos y movimientos originales no se alteran.

Daniel y Lab comparten código pero no información financiera; Gloriana se mantiene en V9, sin cambios. No se añade servidor, base de datos ni módulo. QA comprueba que una acción no exitosa no muestra confirmación, que las metas no duplican asientos, que las programaciones no contabilizan movimientos y que el iPhone distingue recepción de importación.



## V10.10 — Menos esfuerzo cotidiano y confirmaciones claras

**Confirmaciones emergentes en escritorio.** Una ventana pequeña informa que se guardó un gasto, ingreso, pago de deuda, cobro pendiente, abono recibido, aporte/retiro de metas o programación recurrente. El aviso muestra tipo, monto y contexto, distinguiendo un cobro **pendiente** de un **ingreso recibido** y un aporte interno de un **gasto**. Los avisos se invocan **después** de `save()` y su verificación de almacenamiento; un formulario inválido o un guardado fallido nunca deben producir una confirmación de éxito. No hay confirmación adicional antes de cada movimiento: las confirmaciones previas siguen reservadas para operaciones delicadas y posibles duplicados.

**iPhone.** Tras la aceptación confirmada del Worker aparece «Registro recibido» con el importe y una aclaración: **todavía no fue contabilizado en Daniel**. Un fallo de red conserva el borrador y no abre la ventana. No se crean nuevos endpoints, claves ni registros financieros en Cloudflare.

**Metas.** Una meta activa cuyo saldo alcanza el monto objetivo puede marcarse **Cumplida**, diferenciándose de Archivada. Guarda la fecha y motivo de cierre y conserva íntegros fondo, aportes, historial y saldo en el patrimonio. Para utilizar posteriormente los fondos, se reactiva la meta y se registra un Uso objetivo o Retiro (no se crean ingresos/gastos automáticos).

**Movimientos frecuentes.** «Repetir último» prepara una copia editable del último gasto, ingreso o pago de deuda con categoría vigente, sin registrarlo hasta confirmar. Las programaciones existentes muestran **Revisar y registrar** si están vencidas y **Preparar** si son futuras; no se contabilizan solas.

**Deudas.** Los avisos muestran fecha y tiempo relativo hasta el vencimiento, cuota estimada, abonos asociados y diferencias parciales. En pagos tardíos o con cambios de mínimo se pide verificar el estado de cuenta. La agenda sigue siendo derivada y no modifica cuotas ni movimientos.

**Alcance:** versión publicada únicamente en Daniel y Lab, con almacenamiento separado, sin cambios a Gloriana y sin migración de bases de datos. Cobros, Metas, Deudas y demás cálculos se mantienen como ya estaban. Pruebas en CI: confirmación posterior al guardado, no éxito antes de confirmar la recepción, cierre sin doble contabilidad, repetición no automática y ciclos de deudas en distintos meses.

## V11.0 — Código fuente modular, sin cambiar la experiencia financiera

La aplicación se desarrolla ahora desde fuentes separadas en `src/app-shell.html` (interfaz), `src/styles/app.css` (diseño) y diez bloques de `src/modules/` en un orden explícito: estado/modelo, persistencia y moneda, dashboard/presupuesto, deudas y cobros, metas, reportes/movimientos, formularios/eventos, vistas/filtros, agenda de deuda, acciones rápidas e inicialización.

`index.html` y `lab/index.html` son **archivos generados**, no los archivos fuente a editar. No se introdujeron bibliotecas, endpoints, migraciones ni cargas adicionales en el navegador; el contenido generado es el mismo de V10.10 excepto por la etiqueta de versión. Los navegadores siguen ejecutando el JavaScript en el mismo orden y contexto.

**Flujo de mantenimiento:**

1. Editar el bloque correspondiente en `src/` (sin editar directamente los HTML generados).
2. Ejecutar `node scripts/build-lab.cjs` para regenerar Daniel y Lab.
3. Comprobar `node scripts/build-app.cjs --check` y `node scripts/build-lab.cjs --check`.
4. Ejecutar pruebas; GitHub Actions verifica automáticamente coherencia, finanzas, privacidad y comportamiento antes de publicar.

El despliegue sigue incluyendo únicamente los HTML y recursos públicos necesarios. Los archivos de origen `src/` no se envían a GitHub Pages. Las claves de `localStorage`, los respaldos y los datos reales se conservan. Gloriana no se modifica. El formulario del iPhone y Cloudflare permanecen sin cambios.

## V11.1 — Configuración y tipos de deuda

- Se agregó **Configuración** desde el encabezado para acceder a categorías, tipos de deuda, tipo de cambio, calendario salarial, respaldo/restauración y mantenimiento local. Los días salariales reutilizan su formulario y reglas existentes.
- Los tipos de deuda son un catálogo **local**, con nombre y estructura (`card`, `loan`, `installments`, `family`, `other`). Se pueden crear, editar, archivar y reactivar; no se permite cambiar la estructura si tiene deudas vinculadas ni archivar tipos en uso. El campo histórico `debt.type` permanece para clasificación y cálculos, y los registros nuevos pueden guardar `typeId`.
- El formulario de Deudas presenta campos específicos según la estructura (corte y límite para tarjetas, entidad/plazo para préstamos, número de cuotas en compras a plazos). No crea pagos, ingresos ni gastos adicionales; los saldos, pagos y conciliaciones existentes se conservan.
- Daniel y Lab comparten el código y mantienen datos locales separados. Gloriana y el Worker del iPhone no se modificaron. Proyectos y Futuro quedan para las próximas betas.

## V11.2 — Proyectos Beta 1.0

- Herramienta opcional en `+` → **Proyectos** para administrar viajes, eventos y planes financieros sin crear un segundo libro contable. Disponible en Daniel y Lab, con datos locales separados; Gloriana permanece sin cambios.
- Proyecto con nombre, inicio/fin opcionales, moneda CRC/USD, presupuesto total y conceptos internos con presupuesto individual. La suma de conceptos puede diferir del total, con advertencia explícita.
- **Gastos reales:** referencias en `projectLinks` que apuntan a IDs de `movements` existentes de tipo `Gasto`. Un movimiento puede aparecer en un único proyecto. Desde Movimientos se puede asignar durante el registro o edición, y desde Proyectos vincular un gasto ya existente. Desvincular NO borra el movimiento; eliminar el gasto desde Movimientos retira su referencia.
- **Gastos previstos:** `projectPlans` son anotaciones independientes sin efecto en liquidez, metas, presupuesto general ni movimientos. Se pueden resolver/reabrir manualmente para evitar que una previsión se sume a un gasto ya realizado.
- Conversiones dentro del proyecto respetan importe original y tasa histórica guardada en el movimiento. Si falta tasa, se usa referencia actual únicamente como estimación de visualización. No se recalculan los asientos históricos.
- Los proyectos archivados conservan presupuestos, previsiones y gastos vinculados; pueden reactivarse sin migración.
- Respaldos y restauraciones incluyen `projects`, `projectLinks` y `projectPlans`, con validación de referencias, monedas y duplicados. Diagnóstico no destructivo añadido para vínculos huérfanos o duplicados.
- Sin base de datos nueva, endpoints, cargas del teléfono ni cambios en Cloudflare. **V11.3 — Futuro** queda como siguiente beta.

## V11.3 — Futuro Beta 1.0

- Herramienta opcional en `+` para visualizar el saldo operativo **estimado** a **30, 60 y 90 días**, con eje diario y hitos financieros; se mantiene apagada inicialmente.
- Parte de `actualBalanceAt(hoy)` y respeta conciliaciones, movimientos históricos y transferencias reales a metas. Este saldo puede ser aproximado sin conciliación.
- Ingresos: únicamente se incorporan presupuestos de categorías de ingreso con automatización **y fechas concretas** de cobro; los ingresos manuales/irregulares sin fecha no se inventan. Los ingresos ya registrados a futuro en su fecha se descuentan del monto proyectado para no duplicar.
- Gastos: presupuesto restante por categoría de tipo `Gasto`, menos gastos ya registrados y aportes a metas vinculados; se prorratea por día hasta el fin del período, sin atribuir fechas bancarias inexistentes. Los movimientos con fecha futura se muestran por separado y descuentan el importe del presupuesto pendiente.
- Deudas: vencimientos y pagos mínimos estimados desde la información existente en Deudas; una cuota ya abonada se reduce y se prioriza frente al presupuesto de `Pago deuda`. Solo se agrega el **excedente** del presupuesto cuando supera las cuotas estimadas, evitando duplicar el mismo compromiso.
- Cobros pendientes y previsiones de Proyectos no se incorporan al flujo por no constituir operaciones financieras confirmadas y por riesgo de duplicación; tampoco se suma el patrimonio protegido como liquidez.
- La proyección señala períodos sin presupuesto, ingresos sin fecha, deudas sin día/cuota y saldos sin conciliación. No pronostica intereses, comisiones, inflación ni TC futuros y no sustituye la consulta bancaria.
- No se crea ningún movimiento ni registro financiero al visualizar/cambiar de ventana; la configuración del módulo está separada en preferencias locales UI. Daniel y Lab continúan aislados, Gloriana no se modifica, sin backend nuevo ni costo añadido.

## V11.4 — Proyectos Beta 1.1 conectado a Metas y Cobros

- Cada Proyecto permite **relacionar opcionalmente una Meta de ahorro y un grupo de Cobros existentes** desde Editar proyecto. Las conexiones son identificadores en el mismo registro `projects`: `goalId` y `cobroGroupId`. No se crea ningún movimiento ni se duplica un aporte o abono.
- La vista del proyecto presenta el **saldo acumulado de la meta** y su objetivo, además de **cobros pendientes/recuperados** del grupo. Todos son indicadores separados: no incrementan el presupuesto disponible, no reducen gastos del proyecto ni crean ingresos efectivos.
- Una Meta y un grupo de Cobros solo pueden vincularse a **un proyecto a la vez**, incluidos los archivados. La vinculación puede editarse o retirarse sin tocar fondos, cobros o movimientos. Los vínculos a registros archivados siguen visibles; los registros eliminados se señalan en el diagnóstico sin borrado automático.
- Conversión de visualización a moneda del proyecto mediante TC de referencia actual: los movimientos originales conservan su moneda e histórico. Los abonos de Cobros usan su registro financiero original cuando esté vinculado.
- Los respaldos antiguos sin vínculos siguen siendo compatibles. El validador protege tipos y duplicados; el diagnóstico informa relaciones huérfanas. Daniel y Lab mantienen almacenamiento separado, no se modificó Gloriana ni el piloto móvil, y no se incorpora ningún servicio de pago.
- Esta beta no permite gastos financiados automáticamente desde metas ni convierte cobros pendientes en efectivo: esas operaciones deben realizarse explícitamente en sus herramientas.

## V11.5 — Simulación financiera en Futuro Beta 1.1

- Panel **Simulá otro camino** dentro de Futuro, cerrado por defecto para mantener la interfaz minimalista. Compara visualmente una proyección base con un escenario hipotético a 30, 60 o 90 días.
- Tres controles: **porcentaje de reducción de gasto ordinario pendiente (0–50%)**, **aporte extra mensual a ahorro** y **abono extra mensual a deuda**, en CRC o USD. Todos comienzan en 0 y la simulación puede restablecerse.
- El recorte se aplica solamente a presupuestos aún no gastados de categorías ordinarias de `Gasto`. NO altera movimientos futuros ya confirmados, categorías de ahorro, aportes a metas vinculadas, ni cuotas de préstamo. Se muestra el total de gasto que se evitaría.
- Ahorro adicional: resta efectivo hipotético del saldo operativo y lo muestra por separado como monto apartado. No crea ni financia ninguna Meta real y es **adicional** a los aportes ya presupuestados.
- Abono de deuda adicional: resta efectivo hipotético en la fecha del segundo día de pago mensual configurado, con tope al saldo de deuda observado menos mínimos estimados anteriores. **No** recalcula amortización, intereses, penalidades ni vencimientos de deuda; se conservan las cuotas base y se advierte esta limitación.
- El motor usa `oneFutureForecast` (V11.3) como fuente de una sola verdad y aplica cambios en memoria exclusivamente; no invoca `save`, ni escribe en localStorage, no actualiza Movimientos, Deudas, Cobros, Metas, Proyectos ni el piloto móvil. Los controles se restablecen tras recargar; jamás se exportan como transacciones.
- El cambio de CRC/USD para los controles conserva montos canónicos en CRC y utiliza el TC actual de venta únicamente para estimación visual. Los saldos del escenario se expresan según la moneda de visualización de OLO.
- Pruebas automatizadas de cálculo, rangos, doble conteo, ausencia de deudas, cambio de moneda y conservación exacta del respaldo original. Daniel y Lab conservan la separación de datos. Gloriana permanece sin cambios; no se añadieron servicios de pago.
