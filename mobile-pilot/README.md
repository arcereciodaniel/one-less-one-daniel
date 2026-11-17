# One Less One · Mobile Capture — piloto V10 (Daniel)

## Alcance y límites
- **Un mismo formulario** desde iPhone bloqueado (control de Atajos) o desbloqueado (widget de Atajos / botón Acción / Centro de Control).
- Registra: **Gasto**, **Ingreso**, **Pago deuda**, **Cobro pendiente** y **Aporte a meta**.
- El teléfono envía únicamente nuevos registros a una bandeja temporal D1; el historial financiero principal continúa en el navegador de One Less One.
- Piloto **solo CRC**; USD, abonos recibidos en Cobros, gastos divididos y registro sin conexión se reservaron para una segunda fase.
- **Publicación automática disponible:** tras guardar las credenciales de CI en GitHub, los cambios del móvil en main pueden desplegarse automáticamente al Worker existente; el primer despliegue requiere la configuración personal de Cloudflare.
- El repositorio público no debe contener secretos ni respaldos de finanzas personales.

## Preparar Cloudflare Workers + D1 (plan Free, sin tarjeta si la cuenta lo permite)

Desde el directorio `mobile-pilot` de este repositorio:

```bash
npm install
npx wrangler login
npx wrangler d1 create one-less-one-mobile-daniel
```

Copiar el `database_id` devuelto por Wrangler en `d1_databases[0].database_id` dentro de `wrangler.jsonc`.

En ese mismo archivo reemplazar `ALLOWED_DESKTOP_ORIGINS` por **el origen HTTPS real** de One Less One (solo esquema + host, sin ruta). Por ejemplo, `https://arcereciodaniel.github.io` si el sitio se publica allí. Pueden indicarse varios orígenes separados por coma.

```bash
npm run schema
npm run deploy
```

Generar **dos secretos distintos**, aleatorios, de al menos 32 caracteres. En macOS se pueden crear con `openssl rand -hex 32` (dos ejecuciones). Guardarlos en un gestor de contraseñas.

```bash
npx wrangler secret put MOBILE_WRITE_KEY
npx wrangler secret put DESKTOP_SYNC_KEY
```

Wrangler solicitará pegar los valores; **nunca escribirlos en el código, en `wrangler.jsonc`, en GitHub ni en un enlace URL**.

Conservar la URL desplegada, por ejemplo `https://one-less-one-mobile-daniel.<subdominio>.workers.dev` (se trata de un **ejemplo**, no una URL ya creada).

## Conectar la computadora

1. Abrir One Less One Daniel en la URL habitual y asegurarse de contar con un respaldo JSON actualizado.
2. Ir a **Movimientos → Registro desde iPhone (Piloto)**.
3. Colocar la URL de Workers desplegada y la clave **DESKTOP_SYNC_KEY**.
4. Pulsar **Guardar conexión**. Esta acción publica únicamente la lista de categorías de gastos/ingresos, deudas activas y metas activas; después revisa la bandeja móvil.
5. Cuando el navegador esté abierto, sincronizará al entrar, al recuperar el foco y aproximadamente cada 90 segundos; también existe **Sincronizar ahora**.

Si un registro no tiene categoría válida, meta activa o período presupuestario válido, se deja **pendiente** para evitar movimientos mal contabilizados. Nunca se confirma ante Cloudflare antes de verificar la persistencia local.

El `DESKTOP_SYNC_KEY` se almacena en el navegador local, **fuera del JSON de respaldos**. Solo usar en dispositivos privados. Desvincular borra esta configuración, sin borrar datos financieros.

## Conectar el iPhone

1. Abrir en Safari la URL real del Worker desplegado (sin tokens en el enlace).
2. Pegar **MOBILE_WRITE_KEY** en la pantalla «Conectar iPhone». El valor se almacena solamente en el navegador de ese iPhone.
3. Seleccionar Gasto / Ingreso / Cobro, monto CRC, categoría o persona, fecha y detalle opcional.
4. Pulsar Registrar. Solo si Cloudflare confirma la recepción aparecerá «Recibido». Una conexión fallida permite **Reintentar** el mismo identificador sin duplicar.
5. Volver a One Less One Daniel para sincronizar y verificar la incorporación.

## Acceso con el teléfono desbloqueado **y** bloqueado

Crear en **Atajos** un atajo llamado «Registrar · One Less One» con una única acción:
- **URL**: la dirección HTTPS real del formulario móvil
- **Abrir URL**: abrir la URL anterior en Safari

Ubicar **ese mismo atajo** en los puntos que prefirás:
- **Desbloqueado:** widget de Atajos en la pantalla de inicio, o Centro de Control; también puede ser un acceso desde la pantalla de inicio.
- **Bloqueado:** control Atajos de la pantalla bloqueada (si la versión instalada de iOS lo admite).
- **Opcional:** asignarlo al botón de Acción del iPhone.

El acceso inicia desde el estado bloqueado, pero iOS puede solicitar Face ID/desbloqueo antes de mostrar Safari y completar el formulario. No se garantiza captura de datos con el dispositivo totalmente bloqueado.

## Modelo de seguridad y contabilidad

- Dos secretos distintos: el teléfono **solo envía** movimientos y lee catálogos; el escritorio **publica catálogos, lee pendientes y confirma**.
- Los secretos viajan por HTTPS en la cabecera `Authorization`, no en URLs ni en Git.
- El servidor valida datos, montos, tipos y destinos; D1 usa IDs únicos para prevenir dobles envíos.
- Los cinco tipos se convierten con las mismas reglas de One Less One:
  - Gasto: disminuye liquidez.
  - Ingreso: aumenta liquidez.
  - Pago deuda: disminuye liquidez y actualiza el seguimiento de esa deuda.
  - Cobro pendiente: **no** crea ingresos ficticios.
  - Aporte: traslada liquidez hacia una meta, **sin** crear un gasto.
- El escritorio guarda primero y confirma después; si la confirmación falla, reconocerá el ID ya importado en un reintento.
- No se envían al servidor saldos bancarios, movimientos antiguos, archivos de respaldo ni configuraciones del presupuesto.
- Cloudflare D1 sí almacena los importes y detalles de los registros móviles recibidos. Los ya importados se eliminan después de 30 días al ejecutar una sincronización posterior; los pendientes permanecen hasta que se importen. Es un piloto privado, no un producto terminado.

## Pruebas automatizadas
```bash
node --test mobile-pilot/tests/worker.test.mjs
node ../tests/mobile-pilot-v10.test.cjs
```

Las pruebas de interfaz requieren `jsdom@26` instalado por el workflow del repositorio.

## Costo esperado
Cloudflare Workers y D1 ofrecen cuotas gratuitas; este piloto personal está diseñado para mantenerse dentro del plan **Free**. El precio esperado es **$0/mes mientras se respeten los límites**, pero no se ha hecho una prueba de facturación ni un despliegue real en una cuenta Cloudflare.


## V10.1 — captura móvil simplificada
La interfaz de iPhone ahora ofrece únicamente Gasto, Ingreso y Cobro. Fecha, categorías y demás campos tienen el mismo tamaño, con tema oscuro uniforme y monto en texto claro. La fecha incorpora una acción Hoy.

La clave guardada en el iPhone, la base de datos D1 y la URL pública permanecen intactas. El servidor y el importador de escritorio siguen admitiendo envíos anteriores de Pago deuda y Aporte que ya estuvieran pendientes; el nuevo formulario no permite crear esos registros. Ningún histórico se elimina.

### Publicar V10.1 desde una Mac ya configurada
El commit de GitHub NO actualiza automáticamente el Worker de Cloudflare. Si ya tenés un piloto funcionando:
1. Conservá una copia del archivo local mobile-pilot/wrangler.jsonc; allí está tu database_id real y el dominio autorizado.
2. Descargá el ZIP actualizado del repositorio one-less-one-daniel.
3. Copiá solamente los tres archivos nuevos de mobile-pilot/public (index.html, style.css y app.js) encima de los de tu carpeta mobile-pilot local.
4. No sobrescribás el archivo wrangler.jsonc local con el del repositorio: su database_id es un marcador de posición.
5. Desde tu carpeta mobile-pilot local, ejecutá npm run deploy. No creés otra base D1 ni reinstalés las claves.
6. Abrí nuevamente el formulario en Safari y probá un Gasto, Ingreso y Cobro. El atajo y el widget existentes siguen utilizando la misma URL.


## V10.2 — marca One Less One y fecha consistente en iPhone
- El encabezado utiliza **One Less One**, sin guiones ni texto extra.
- El formulario reduce títulos, etiquetas y texto accesorio; se mantienen Gasto, Ingreso y Cobro.
- La fecha se muestra en una capa de texto centrada dentro de un control del mismo tamaño que Categoría y Detalle, mientras que un input nativo transparente y accesible permite utilizar el selector de fecha de iOS. Esto evita depender del posicionamiento visual nativo que Safari hacía aparecer arriba.
- Se aplica el mismo tratamiento a la fecha esperada de Cobro y se mantiene la acción Hoy.
- No se cambia la API, la base D1, el identificador de reintento ni las claves existentes.
- La implementación en GitHub no cambia automáticamente el Worker ya publicado. En la Mac configurada hay que actualizar los archivos public/index.html, public/style.css y public/app.js y ejecutar npm run deploy, sin reemplazar wrangler.jsonc.


## Publicación automática en Cloudflare — activación única

Ahora existe el workflow **Publicar One Less One Movil en Cloudflare** en GitHub Actions. Sus pruebas se ejecutan en cada cambio del código móvil de la rama main. Para que pueda publicar en tu Worker real, configurá los siguientes **tres secretos** en el repositorio Daniel (jamás en un archivo de código o en el chat):

- CLOUDFLARE_API_TOKEN — un API token de Cloudflare con privilegios de despliegue, creado con la plantilla Edit Cloudflare Workers y limitado a tu cuenta/Worker.
- CLOUDFLARE_ACCOUNT_ID — Account ID de la cuenta donde ya publicaste el Worker de Daniel.
- CLOUDFLARE_D1_DATABASE_ID — el UUID de la misma base D1 existente llamada one-less-one-mobile-daniel.

### Cómo encontrar los datos
- Account ID: Cloudflare Dashboard → seleccioná tu cuenta → información de la cuenta o Workers & Pages.
- Database ID: en la Mac, abrí el archivo local mobile-pilot/wrangler.jsonc, que ya contiene el database_id auténtico después de la configuración inicial; también podés verlo desde Cloudflare D1.
- API token: Cloudflare Dashboard → API Tokens → Create Token → Edit Cloudflare Workers. Otorgá solo el alcance necesario. No utilicés la clave global de API.

### Dónde guardarlos en GitHub
Abrí el repositorio arcereciodaniel/one-less-one-daniel → Settings → Secrets and variables → Actions → New repository secret. Agregá los tres nombres indicados, uno a uno.

### Primera ejecución y operaciones futuras
Tras guardar los secretos, entrá en GitHub → Actions → Publicar One Less One Movil en Cloudflare → Run workflow → rama main. Cuando finalice en verde, el formulario de la URL workers.dev que ya usás habrá recibido los cambios. Las siguientes modificaciones en mobile-pilot/public, src, scripts o configuración se publicarán automáticamente al subirlas a main si pasan las pruebas.

**Seguridad:** si falta uno de los tres secretos, se omite el despliegue y el Worker que ya funciona no se toca. El workflow genera su archivo wrangler.ci.jsonc temporal en el ejecutor de GitHub, no lo versiona, y no imprime el UUID. Las claves MOBILE_WRITE_KEY y DESKTOP_SYNC_KEY permanecen únicamente en los secretos del Worker existente y **NO** deben agregarse a GitHub. No se recrea D1, no se ejecuta schema.sql y no se modifican Lab ni Gloriana. El nombre del Worker y la dirección para los widgets y Atajos continúan iguales.

**Atención:** la plantilla wrangler.jsonc de GitHub sigue teniendo un database_id de ejemplo, para evitar publicar el real. Si trabajás en tu Mac, conservá tu copia local con el ID correcto, aunque descargués nuevos archivos del repositorio.


## V10.5 — Cobros divididos en CRC y USD

Desde **Cobros → Dividir gasto** se puede crear un grupo y repartir el total pagado por partes iguales o por montos personalizados. Ejemplo: hotel por $328, Daniel paga 1 parte, Charlie asume 2 partes y Ana 1. Se crean un grupo con Charlie ($164), Ana ($82) y una parte propia informativa ($82). Cada persona tiene su propio cobro pendiente y puede registrar abonos.

One Less One Móvil continúa con Gasto, Ingreso y Cobro: en Cobro se puede seleccionar CRC/USD y activar **Dividir entre varias personas**. El móvil envía un solo registro, el escritorio importa el grupo y todos los cobros, y el identificador evita duplicaciones durante reintentos. Los grupos nuevos no generan un movimiento de gasto ni ingreso adicional en Movimientos: si pagaste la reserva, registrá el gasto solo una vez en Movimientos para reflejar la salida de dinero. Los reembolsos se pueden vincular posteriormente mediante los abonos de cada cobro.

La distribución se calcula en centavos y se verifica que la suma sea exacta. No se tocan historiales de Daniel o Lab, ni la versión de Gloriana. El piloto Cloudflare sigue reservado para Daniel.
