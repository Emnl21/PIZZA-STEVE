# Instrucciones para agregar un GIF de carga

## Ubicación del GIF

Coloca tu archivo GIF en una de estas ubicaciones:

- **Página principal (Index.html)**: `assets/images/loading.gif`
- **Paneles (admin, vendedor, usuario)**: `assets/images/loading.gif` (se accede desde `../../assets/images/loading.gif`)

## Tamaños recomendados

- **Pequeño**: 80x80 píxeles
- **Normal**: 120x120 píxeles (recomendado)
- **Grande**: 150x150 píxeles

## Formato

- Formato: GIF animado
- Fondo: Transparente (recomendado) o con fondo sólido
- Tamaño de archivo: Intenta mantenerlo bajo 500KB para mejor rendimiento

## Ejemplos de GIFs que puedes usar

1. Pizza girando
2. Pizza cortándose
3. Logo animado
4. Cualquier animación relacionada con comida/pizza

## Nota

Si el GIF no se encuentra, el sistema automáticamente mostrará el spinner CSS como respaldo.

## Cambiar el tamaño del GIF

Si quieres cambiar el tamaño del GIF, modifica la clase en el HTML:

```html
<!-- Tamaño pequeño -->
<img src="assets/images/loading.gif" class="loading-gif small" alt="Cargando...">

<!-- Tamaño normal (por defecto) -->
<img src="assets/images/loading.gif" class="loading-gif" alt="Cargando...">

<!-- Tamaño grande -->
<img src="assets/images/loading.gif" class="loading-gif large" alt="Cargando...">
```

