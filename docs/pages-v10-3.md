# Publicación web verificada — One Less One V10.3

El workflow `.github/workflows/pages-gated.yml` ejecuta pruebas de Daniel y Lab antes de publicar el sitio. Solo publica la raíz web, Lab, una redirección histórica y los dos assets CSS/JS. No modifica el Worker de Cloudflare ni la versión Gloriana.

## Única configuración de GitHub Pages pendiente

1. Entrar a https://github.com/arcereciodaniel/one-less-one-daniel/settings/pages
2. En **Build and deployment → Source**, seleccionar **GitHub Actions** (no Deploy from a branch).
3. Abrir https://github.com/arcereciodaniel/one-less-one-daniel/actions/workflows/pages-gated.yml
4. Seleccionar **Run workflow** sobre `main` y comprobar el éxito de las pruebas y la publicación.

Después los cambios a `main` se validarán antes de publicarse.

**Hasta completar el cambio de Source, GitHub Pages puede seguir desplegando desde la rama aunque fallen las pruebas.**

## Seguridad de los datos

Daniel usa `daniel_finanzas_local_v1` y Lab usa `rastro_lab_v7_1_data_v1`. La detección de cambios en otra pestaña evita muchas sobrescrituras accidentales, pero no proporciona una transacción atómica entre pestañas. Evitar ediciones simultáneas y mantener copias JSON externas.
