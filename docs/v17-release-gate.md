# V17 — Puerta de validación (RC8)
No es autorización para publicar. No modificar main, Daniel, Lab ni Gloriana. Usar el artefacto técnico generado y un respaldo local, nunca subir un respaldo real al chat ni a GitHub.

## Verificación automática
- Build de Daniel y Lab sin cambios, pruebas específicas y regresión general (incluye mobile-pilot).
- Chromium: 8 módulos × 2 temas × 3 tamaños; navegación compartida, sin overflow de página, botón +, preferencias de módulos y tema/moneda después de recarga, cero solicitudes HTTP, sin cambios del ledger por navegación. Verificar resultados del workflow, no confundir su configuración con su aprobación.
- Registros ficticios: distribuir, asignar y redistribuir, recarga; movimiento nativo, programación, proyecto, cuota, cobro, restauración y simulación de importación móvil. 
- Capturas y resultado JSON generados por el workflow. Solo fixtures.

## Revisión manual en la candidata local
1. Abrir HTML aislado y verificar Inicio, Presupuesto, Movimientos; habilitar las herramientas que se usan mediante +. Probar semanal, quincenal, mensual y volver a Actual. Validar apariencia claro/oscuro y navegación.
2. Distribuir un presupuesto ficticio, registrar un movimiento y verificar Inicio/Presupuesto; recargar. No confundir fecha simulada con hoy real. Revisar disponible y saldo operativo por separado.
3. En Configuración > Revisar respaldo V16.0 (solo lectura), seleccionar un respaldo local original. Compartir exclusivamente estado y códigos/conteos, si se desea. No restaurar datos reales en la candidata.
4. Confirmar la regla de negocio: asignaciones nuevas se planifican por fecha calendario y la estimación salarial usa período original que contiene esa fecha. El mes salarial histórico nunca se reescribe. Quincenas calendario 1–15/16–fin pueden diferir de quincenas salariales.
5. La prueba de iPhone real queda para Lab aislado con autorización y configuración de piloto de prueba, no reutilizar credenciales productivas en HTML offline.

## Bloqueos de publicación
- RC8 es un HTML técnico aislado que monta vistas nuevas sobre calculadores y formularios originales. No está ensamblado como la aplicación publicada ni conectado a Worker real.
- Falta una estrategia de migración/activación y vuelta atrás para el ledger real que preserve overlays y preferencias; validar en Lab con copia privada y sin sincronizar bandeja de producción. No hacer downgrade silencioso a una versión que ignora nuevas asignaciones.
- Conciliar completamente Futuro (90 días, excluye obligaciones sin vínculo, reembolsos y cuotas USD sin equivalencia explícita) y revisar disponible con datos reales.
- Paridad de operaciones: administración/archivo/restauración, edición de grupos y cobros, proyectos, reportes/exportación y configuración del calendario salarial requieren revisión funcional integral. No afirmar paridad completa solo por abrir formularios o pasar pruebas de módulos.
- Aprobación explícita de UX y saldos reales, iPhone y publicación. Hasta entonces V16.0 es estable.
