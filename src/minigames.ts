import { random, shuffle } from './game';

export { DEFAULT_MODULE_COUNT as MODULE_COUNT } from './config';
export const QTE_ROUND_MS = 3000;
export const QTE_OPEN_MS = 1100;
export const QTE_CLOSE_MS = 2400;
export const MEMORY_BEAT_MS = 850;
export const COLORS = [
  { name: 'AZUL', hex: '#86c9ff', key: 'A' },
  { name: 'ÂMBAR', hex: '#ffcf73', key: 'B' },
  { name: 'VIOLETA', hex: '#c8a6ff', key: 'C' },
  { name: 'CORAL', hex: '#ff9c91', key: 'D' },
] as const;
export const KEY_LAYOUT = '123A456B789C*0#D';
export type MiniGame =
  | { kind: 'wires'; sequence: string; wires: { key: string; color: number }[]; order: number[] }
  | { kind: 'memory'; sequence: string }
  | { kind: 'route'; sequence: string; cells: number[] }
  | { kind: 'qte'; sequence: string }
  | { kind: 'reverse'; sequence: string; shown: string }
  | { kind: 'balance'; sequence: string; sums: [number, number][] }
  | { kind: 'symbols'; sequence: string; mapping: { symbol: string; key: string }[]; targets: string[] };

export function createMiniGames(count = 5): MiniGame[] {
  if (![3, 5, 7].includes(count)) throw new Error('Quantidade de módulos inválida.');
  const order = shuffle([0, 1, 2, 3]).slice(0, 3);
  const wires = shuffle([0, 1, 2, 3]).map((color, i) => ({ key: String(i + 1), color }));
  const wireGame: MiniGame = { kind: 'wires', wires, order, sequence: order.map(color => wires.find(w => w.color === color)!.key).join('') };
  const memory: MiniGame = { kind: 'memory', sequence: Array.from({ length: 4 }, () => COLORS[random(4)].key).join('') };
  // Uma rota contínua, sem cruzamentos, nas nove teclas numéricas superiores.
  const paths = [[0,1,2,6,5], [8,4,0,1,5], [2,1,5,9,10], [10,9,8,4,5]];
  const cells = [...paths[random(paths.length)]];
  if (random(2)) cells.reverse();
  const route: MiniGame = { kind: 'route', cells, sequence: cells.map(i => KEY_LAYOUT[i]).join('') };
  const qte: MiniGame = { kind: 'qte', sequence: Array.from({ length: 3 }, () => COLORS[random(4)].key).join('') };
  const shown = Array.from({ length: 4 }, () => String(random(10))).join('');
  const reverse: MiniGame = { kind: 'reverse', shown, sequence: [...shown].reverse().join('') };
  const sums: [number, number][] = Array.from({ length: 3 }, () => { const a = random(6); return [a, random(10 - a)]; });
  const balance: MiniGame = { kind: 'balance', sums, sequence: sums.map(([a,b]) => a + b).join('') };
  const mapping = shuffle(['CÍRCULO', 'TRIÂNGULO', 'QUADRADO', 'LOSANGO']).map((symbol, i) => ({ symbol, key: COLORS[i].key }));
  const targets = Array.from({ length: 4 }, () => mapping[random(4)].symbol);
  const symbols: MiniGame = { kind: 'symbols', mapping, targets, sequence: targets.map(symbol => mapping.find(item => item.symbol === symbol)!.key).join('') };
  // Toda partida inclui o QTE e não repete tipos de minigame.
  return shuffle([qte, ...shuffle([wireGame, memory, route, reverse, balance, symbols]).slice(0, count - 1)]);
}

export function checkInput(game: MiniGame, prefix: string, key: string): 'error' | 'progress' | 'complete' {
  if (key !== game.sequence[prefix.length]) return 'error';
  return prefix.length + 1 === game.sequence.length ? 'complete' : 'progress';
}

export function memoryDuration(game: MiniGame) {
  return game.kind === 'memory' ? (game.sequence.length + 1) * MEMORY_BEAT_MS : 0;
}

export function checkTimedInput(game: MiniGame, prefix: string, key: string, elapsed: number) {
  if (game.kind === 'qte' && (elapsed < QTE_OPEN_MS || elapsed > QTE_CLOSE_MS)) return 'error';
  return checkInput(game, prefix, key);
}

export function qteExpired(game: MiniGame, stepAt: number, now: number) {
  return game.kind === 'qte' && stepAt > 0 && now - stepAt > QTE_ROUND_MS;
}

export const GAME_TITLES: Record<MiniGame['kind'], string> = {
  wires: 'CORTE SELETIVO', memory: 'MEMÓRIA DE PULSOS', route: 'ROTA DO CIRCUITO',
  qte: 'JANELA DE SINCRONIA', reverse: 'ECO INVERTIDO', balance: 'CARGA DO REATOR', symbols: 'CHAVE DE SÍMBOLOS',
};
