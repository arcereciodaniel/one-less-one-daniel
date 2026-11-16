# One Less One · Mobile Capture — piloto V10 (Daniel)

## Alcance y límites
- **Un mismo formulario** desde iPhone bloqueado (control de Atajos) o desbloqueado (widget de Atajos / botón Acción / Centro de Control).
- Registra: **Gasto**, **Ingreso**, **Pago deuda**, **Cobro pendiente** y **Aporte a meta**.
- El teléfono envía únicamente nuevos registros a una bandeja temporal D1; el historial financiero principal continúa en el navegador de One Less One.
- Piloto **solo CRC**; USD, abonos recibidos en Cobros, gastos divididos y registro sin conexión se reservaron para una segunda fase.
- **No hay publicación automática ni despliegue** sin iniciar sesión en una cuenta Cloudflare y configurar credenciales personales.
- El repositorio público no debe contener secretos ni respaldos de finanzas personales.

## Preparar Cloudflare Workers + D1 (plan Free, sin tarjeta si la cuenta lo permite)

Desde el directorio \`mobile-pilot\` de este repositorio:

\`\`\`bash
npm install
npx wrangler login
npx wrangler d1 create one-less-one-mobile-daniel
\`\`\`

Copiar el \`database_id\` devuelto por Wrangler en \`d1_databases[0].database_id\` dentro de \`wrangler.jsonc\`.

En ese mismo archivo reemplazar \`ALLOWED_DESKTOP_ORIGINS\` por **el origen HTTPS real** de One Less One (solo esquema + host, sin ruta). Por ejemplo, \`https://arcereciodaniel.github.io\` si el sitio se publica allí. Pueden indicarse varios orígenes separados por coma.

\`\`\`bash
npm run schema
npm run deploy
\`\`\`

Generar **dos secretos distintos**, aleatorios, de al menos 32 caracteres. En macOS se pueden crear con \`openssl rand -hex 32\` (dos ejecuciones). Guardarlos en un gestor de contraseñas.

\`\`\`bash
npx wrangler secret put MOBILE_WRITE_KEY
npx wrangler secret put DESKTOP_SYNC_KEY
\`\`\`

Wrangler solicitará pegar los valores; **nunca escribirlos en el código, en \`wrangler.jsonc\`, en GitHub ni en un enlace URL**.

Conservar la URL desplegada, por ejemplo \`https://one-less-one-mobile-daniel.<subdominio>.workers.dev\` (se trata de un **ejemplo**, no una URL ya creada).

## Conectar la computadora

1. Abrir One Less One Daniel en la URL habitual y asegurarse de contar con un respaldo JSON actualizado.
2. Ir a **Movimientos → Registro desde iPhone (Piloto)**.
3. Colocar la URL de Workers desplegada y la clave **DESKTOP_SYNC_KEY**.
4. Pulsar **Guardar conexión**. Esta acción publica únicamente la lista de categorías de gastos/ingresos, deudas activas y metas activas; después revisa la bandeja móvil.
5. Cuando el navegador esté abierto, sincronizará al entrar, al recuperar el foco y aproximadamente cada 90 segundos; también existe **Sincronizar ahora**.

Si un registro no tiene categoría válida, meta activa o período presupuestario válido, se deja **pendiente** para evitar movimientos mal contabilizados. Nunca se confirma ante Cloudflare antes de verificar la persistencia local.

El \`DESKTOP_SYNC_KEY\` se almacena en el navegador local, **fuera del JSON de respaldos**. Solo usar en dispositivos privados. Desvincular borra esta configuración, sin borrar datos financieros.

## Conectar el iPhone

1. Abrir en Safari la URL real del Worker desplegado (sin tokens en el enlace).
2. Pegar **MOBILE_WRITE_KEY** en la pantalla «Conectar iPhone». El valor se almacena solamente en el navegador de ese iPhone.
3. Seleccionar Gasto / Ingreso / Deuda / Cobro / Ahorro, monto CRC, categoría o destino, fecha y detalle opcional.
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
- Los secretos viajan por HTTPS en la cabecera \`Authorization\`, no en URLs ni en Git.
- El servidor valida datos, montos, tipos y destinos; D1 usa IDs únicos para prevenir dobles envíos.
- Los cinco tipos se convierten con las mismas reglas de One Less One:
  - Gasto: disminuye liquidez.
  - Ingreso: aumenta liquidez.
  - Pago deuda: disminuye liquidez y actualiza el seguimiento de esa deuda.
  - Cobro pendiente: **no** crea ingresos ficticios.
  - Aporte: traslada liquidez hacia una meta, **sin** crear un gasto.
- El escritorio guarda primero y confirma después; si la confirmación falla, reconocerá el ID ya importado en un reintento.
- No se envían al servidor saldos bancarios, movimientos antiguos, archivos de respaldo ni configuraciones del presupuesto.
- Cloudflare D1 sí almacena los importes y detalles de los registros móviles recibidos, incluidos los ya importados. Se debe definir una política de retención antes de pasar a producción. Es un piloto privado, no un producto terminado.

## Pruebas automatizadas
\`\`\`bash
node --test mobile-pilot/tests/worker.test.mjs
node ../tests/mobile-pilot-v10.test.cjs
\`\`\`

Las pruebas de interfaz requieren \`jsdom@26\` instalado por el workflow del repositorio.

## Costo esperado
Cloudflare Workers y D1 ofrecen cuotas gratuitas; este piloto personal está diseñado para mantenerse dentro del plan **Free**. El precio esperado es **$0/mes mientras se respeten los límites**, pero no se ha hecho una prueba de facturación ni un despliegue real en una cuenta Cloudflare.
