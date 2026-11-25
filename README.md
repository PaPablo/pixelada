# Pixelada

Editor web local de figuras pixel art para imprimir en 3D: dibujas el frente y la espalda, la figura se extruye en vóxeles sobre una base redonda y se exporta a STL, entera o por colores. Todo ocurre en el navegador; no hay servidor ni se envía nada.

## Arrancar

Hace falta Node 22 o posterior.

```
npm install
npm run dev
```

Abre la dirección que muestra Vite (por defecto http://localhost:5173). La primera vez aparece un caballero de ejemplo. El trabajo se guarda solo en el navegador; usa **Guardar JSON** para tener una copia en un archivo.

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Comprueba tipos y genera `dist/`, que sirve cualquier servidor estático |
| `npm run preview` | Sirve `dist/` |
| `npm test` | Pruebas de la lógica (Vitest, en Node) |
| `npm run e2e` | Pruebas en navegador y capturas en `e2e/shots/` (Playwright) |
| `npm run typecheck` | Solo tipos |

Antes del primer `npm run e2e`: `npx playwright install chromium`. La prueba del ZIP usa el `unzip` del sistema; en Windows encuentra el que trae Git.

## Dibujar

- **Frente y espalda a la vez.** La espalda se ve como la vería alguien desde detrás. Tab alterna la cara activa cuando el foco está en un lienzo; Escape sale de él.
- **Silueta compartida** (por defecto). Lo que dibujas en una cara aparece en la otra con el mismo color, y lo sigue hasta que lo pintas distinto. Borrar en una cara borra en ambas.
- **Copiar frente a espalda** fija los colores de la otra cara, que deja de heredarlos. Con *Espejar* y silueta compartida solo se recolorea lo que ya existe.
- **Silueta independiente por cara**: cada cara tiene su forma, y cada mitad del grosor existe solo donde su cara está dibujada.
- **Pintar en 3D**: lápiz y borrador sobre el modelo. Para girar, arrastra fuera de la figura, con Mayús o con dos dedos.
- **Importar imagen**: PNG, JPG o GIF (primer fotograma). Se ajusta a la rejilla, abajo y centrada. Si la aplicas a la espalda, se interpreta como vista desde detrás.
- Todo se puede deshacer (200 pasos). El botón **Atajos** tiene la lista de teclas.

## Exportar

- **Descargar STL**: la figura completa en una pieza.
- **STL por color (ZIP)**: un sólido cerrado por color, más la pieza completa. Las piezas se tocan sin solaparse y comparten origen. Dos entradas de paleta con el mismo color, o la base si coincide, van en la misma pieza.
- **PNG frente / espalda**: 16 px por celda, con transparencia.
- **Guardar JSON / Copiar proyecto**: el proyecto completo.

Las unidades del STL son milímetros, con Z hacia arriba y la base en Z = 0.

### Avisos

| Aviso | Qué hacer |
| --- | --- |
| Partes sueltas | Une los píxeles por un lado. En diagonal comparten solo una arista y no se sostienen. También sale si la base no cubre los pies. |
| Grosor menor de 1,2 mm | Añade capas o agranda el píxel. |
| Píxel menor de 0,4 mm | Imprime en resina: una boquilla de 0,4 mm no resuelve ese detalle. |
| Base descentrada medio píxel | Haz que el diámetro, el ancho y el grosor sean todos pares o todos impares. |

## Imprimir

1. **Orientación.** Importa el STL sin girarlo: sale de pie sobre la base y mirando hacia delante. Para figuras sin base o muy finas, túmbalas sobre la espalda: ganan resistencia y casi no necesitan soportes.
2. **Escala.** Déjala al 100 %. El píxel de 0,8 mm equivale a dos pasadas de una boquilla de 0,4 mm; si cambias de boquilla, usa un múltiplo de su diámetro y ajústalo en la app, no en el laminador.
3. **Altura de capa.** 0,16 mm o 0,2 mm con boquilla de 0,4 mm: con píxeles de 0,8 mm ambas caben un número entero de veces (5 y 4 capas) y los escalones quedan nítidos. En resina, 0,05 mm.
4. **Paredes y relleno.** 2 o 3 perímetros y 15-20 % de relleno. Las partes de 2 píxeles de ancho quedarán macizas.
5. **Soportes.** De pie, actívalos solo para lo que cuelga: brazos, empuñaduras o viseras. Los soportes de árbol dejan menos marca. Los huecos de 1 o 2 píxeles suelen salir como puente sin ayuda.
6. **Adherencia.** Con base de 20 mm o más no suele hacer falta borde. Sin base, añade uno de 3-5 mm.

**Varios colores:** descomprime el ZIP, selecciona a la vez todas las piezas numeradas (no la `_completa`) y, cuando el laminador pregunte, acepta cargarlas como **un solo objeto con varias partes**. Así conservan su posición. Asigna un filamento a cada parte; el nombre del archivo incluye el color.

## Modelo de datos

Un proyecto (`src/model/types.ts`) contiene:

| Campo | Significado |
| --- | --- |
| `format`, `version` | `"pixelada"`, `1` |
| `name` | Nombre de la figura |
| `w`, `h` | Rejilla: 8-96 × 8-128 |
| `palette` | De 1 a 32 colores `#rrggbb` |
| `front`, `back` | `w × h` enteros por filas desde arriba: 0 vacío, n = color n de la paleta (desde 1) |
| `independent` | Silueta independiente por cara |
| `depth` | Capas de grosor, 1-32 |
| `skin` | Capas de piel por cara, de 1 a `depth / 2` |
| `pixelMm` | Tamaño del píxel en mm |
| `base` | `enabled`, `diameter`, `height` (1-8), `bevel`, `color` |

**Las dos capas están en coordenadas del frente**: x crece hacia la derecha vista desde delante. El panel de la espalda convierte con `xModelo = w - 1 - xVista`.

**Herencia.** Con silueta compartida, un 0 en una cara donde la otra tiene color significa «hereda». Se resuelve al leer, no se guarda.

**Profundidad.** La mitad delantera de las capas es del frente y la trasera de la espalda; si el grosor es impar, la central es del frente. Con menos capas de piel, solo las traseras más exteriores llevan el color de la espalda.

**Vóxeles.** Figura y base comparten una rejilla `NX = max(w, Ø)`, `NZ = max(grosor, Ø)`, `NY = altura de la base + alto dibujado` (sin filas vacías, para que los pies apoyen). El bisel necesita una base de 2 capas o más.

**Malla.** Una cara por cada lado de vóxel expuesto. La vista 3D y el STL usan la misma malla. Al leer un JSON se valida todo; si algo no cuadra, se explica y no se abre.

## Código

```
src/model/     datos y lógica pura (sin DOM)
src/export/    STL, ZIP, piezas por color, PNG, descargas
src/editor2d/  paneles 2D
src/view3d/    escena, cámara y pintura 3D
src/ui/        interfaz
tests/  e2e/   pruebas
```

## Licencia

[MIT](LICENSE).
