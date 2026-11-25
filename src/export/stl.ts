/** STL binario. Vista (x, y arriba, z frente) -> impresión (x, -z, y), en mm y Z hacia arriba. */
import type { Mesh } from '../model/mesh';

export const STL_HEADER = 84;
export const STL_TRIANGLE = 50;

export function meshToStl(mesh: Mesh, pixelMm: number): Uint8Array<ArrayBuffer> {
  const triangles = mesh.faces * 2;
  const bytes = new Uint8Array(STL_HEADER + STL_TRIANGLE * triangles);
  const view = new DataView(bytes.buffer);
  // La cabecera no puede empezar por "solid": muchos programas lo tomarían por ASCII.
  bytes.set(new TextEncoder().encode('Pixelada STL binario, mm, Z arriba'));
  view.setUint32(80, triangles, true);

  const { positions: p, normals: n } = mesh;
  let o = STL_HEADER;
  const write = (x: number, y: number, z: number): void => {
    view.setFloat32(o, x, true);
    // `+ 0` convierte el -0 de negar un cero en 0.
    view.setFloat32(o + 4, -z + 0, true);
    view.setFloat32(o + 8, y, true);
    o += 12;
  };
  for (let t = 0; t < triangles; t++) {
    const i = t * 9;
    write(n[i], n[i + 1], n[i + 2]);
    for (let k = 0; k < 9; k += 3) {
      write(p[i + k] * pixelMm, p[i + k + 1] * pixelMm, p[i + k + 2] * pixelMm);
    }
    o += 2;
  }
  return bytes;
}
