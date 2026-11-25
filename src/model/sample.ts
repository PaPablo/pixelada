/** Figura de ejemplo original: caballero con casco, capa roja y espada (24 x 32). */
import { DEFAULT_PALETTE, emptyProject, type Project } from './types';

const KEY: Record<string, number> = {
  '.': 0, k: 1, w: 2, s: 3, S: 4, d: 5, r: 6, R: 7, g: 8, b: 9,
};

// prettier-ignore
const FRONT = [
  '........krrk............',
  '.......krrrrk...........',
  '......kkrrrRkk..........',
  '.....kSSsrRssdk.........',
  '....kSSSsrRsssdk...kk...',
  '....kSSssggsssdk..kSsk..',
  '....kSggggggggdk..kSsk..',
  '....kSkkkkkkkkdk..kSsk..',
  '....kSkwwkkwwkdk..kSsk..',
  '....kSskkggkksdk..kSsk..',
  '....kSsksggsksdk..kSsk..',
  '.....ksssggssdk...kSsk..',
  '....krrkkkkkkRRk..kSsk..',
  '...krrkSSsggsdkRk.kSsk..',
  '..kSSskSSsggsdkSsdkSsk..',
  '..kSsdkssrggrsksddkSsk..',
  '..kssdkrrrggrrkssdkSsk..',
  '..kssdkrggggggkssdkSsk..',
  '..kdskrrrrggrrrksdkSsk..',
  '..ksskrrrrggrrkkggggggk.',
  '..kddkbbbggggbkdssssk...',
  '...kkrrrRrggrRrkkbbk....',
  '...krrrrRrggrRrk.kbbk...',
  '...krrrRRkkkkRrk.kggk...',
  '...kRrrkssksSskk..kk....',
  '...kRrkSsdkkSsdk........',
  '...kRrkSsdkkSsdk........',
  '...kRrkSsdkkSsdk........',
  '...kRRkSsdkkSsdk........',
  '...kRkSssdkkSssdk.......',
  '...kkSsssdkkSsssdk......',
  '...kkkkkkkkkkkkkkk......',
];

// '.' hereda del frente: aquí solo se dibuja lo que cambia por detrás.
// prettier-ignore
const BACK = [
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '.........rR.............',
  '......sssrRsss..........',
  '......sssrRsss..........',
  '......sssrRsss..........',
  '......sssssssd..........',
  '......ssssssdd..........',
  '......sssssdd...........',
  '.....rrrrrrrrRR.........',
  '....rrrrrrRrrrRR........',
  '.....kRrrrrRrrrRk.......',
  '.....krrrrrRrrrRk.......',
  '.....krrrRrrrRrRk.......',
  '.....krrrRrrrRrRk.......',
  '.....krrrRrrrRrRk.......',
  '.....krrrRrrrRrRk.......',
  '.....krrrRrrrRrRk.......',
  '.....rrrRrrrrRrR........',
  '....rrrrRrrrrRrR........',
  '....rrrRrrrRrrRR........',
  '....rrrRrrrRrrR.........',
  '....rrrRrrrRrrR.........',
  '....rrrRrrrRrrR.........',
  '....rrRrrrrRrRR.........',
  '....rrRrrrrRrRR.........',
  '....gggggggggggg........',
  '........................',
  '........................',
];

function layer(rows: readonly string[]): Uint8Array {
  return Uint8Array.from(rows.join(''), (c) => KEY[c]);
}

export function sampleProject(): Project {
  const p = emptyProject(24, 32, 'Caballero');
  return {
    ...p,
    palette: DEFAULT_PALETTE,
    front: layer(FRONT),
    back: layer(BACK),
    base: { ...p.base, color: '#6b6470' },
  };
}
