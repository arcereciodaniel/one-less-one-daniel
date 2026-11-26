# One Less One · V16.0 · Protocolo de lanzamiento

Estado: candidata RC1, NO publicada. Base estable: main en cfe118524115750f376e01275cd98b296185b341. V15.6 aprobada visualmente; V15.7–V15.9 pendientes de aprobación visual. Ninguna prueba automatizada acredita el saldo privado real.

## Antes de publicar

- [ ] Abrir la demo y validar Inicio, Presupuesto, Movimientos, Metas, Proyectos y Futuro en claro y oscuro.
- [ ] Exportar el JSON real desde Daniel y comprobar que se descargó; conservar otra copia independiente. Repetir en Lab si hay datos que preservar.
- [ ] Abrir Auditoria-Local-V16.0-RC1.html y elegir el JSON de Daniel. Compartir solo recuentos y códigos. Resolver avisos y bloqueantes antes de autorizar.
- [ ] Verificar saldo operativo, presupuesto, deudas, metas y cobros actuales con sus fuentes reales. Anotar totales y recuentos de referencia; no introducirlos en GitHub.
- [ ] Comprobar la captura y sincronización desde iPhone físico con un movimiento real legítimo; confirmar que se importa una sola vez. No crear transacciones ficticias en producción.
- [ ] Confirmar que el candidato exacto pasó todas las pruebas de escritorio y Worker.
- [ ] Autorizar explícitamente publicar. Cambiar etiqueta RC a v16.0.0, reconstruir, validar y recién entonces abrir el merge para main. No ejecutar workflow de producción desde rama candidata.

## Al publicar

Mantener la misma URL y las claves locales de Daniel y Lab. No importar el respaldo como parte del lanzamiento. No activar calendario flexible en Daniel; seguirá limitado a Lab. No cambiar Gloriana, ni el Worker Cloudflare. Una vez desplegado, abrir desde el navegador original y cotejar recuentos y saldos con la referencia; probar el flujo móvil legítimo y su importación sin duplicación.

## Ante una diferencia

Detener nuevas escrituras y exportar el estado actual a otro archivo. Conservar tanto el respaldo anterior como el posterior. Investigar la causa antes de revertir código o restaurar datos. Un revert de código no revierte datos; un respaldo antiguo puede perder registros posteriores. No usar una versión antigua sobre un historial con calendario flexible activo. No compartir JSON privados en GitHub ni sobrescribir un historial para probar.

## Alcance

El paquete de demo usa únicamente datos ficticios y claves aisladas. El auditor local no almacena ni transmite el JSON. La auditoría estática no sustituye la verificación de saldos ni las pruebas visuales/físicas. Las previsiones de proyecto no se agregan automáticamente a Futuro para evitar doble contabilización.
