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
