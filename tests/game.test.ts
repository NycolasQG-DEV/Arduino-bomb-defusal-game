import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate, timerSpeed, buzzerProfile, type SwitchRow, type VaultDisk } from '../src/game';
import { createMiniGames, checkInput, checkTimedInput, qteExpired, KEY_LAYOUT, memoryDuration, MEMORY_BEAT_MS, MODULE_COUNT, QTE_OPEN_MS, QTE_CLOSE_MS, QTE_ROUND_MS } from '../src/minigames';

test('1000 partidas: 3, 5 ou 7 módulos com códigos únicos e enigmas resolvíveis', () => {
  for (let run = 0; run < 1000; run++) {
    const count = [3,5,7][run % 3];
    const puzzles = generate(count);
    assert.equal(puzzles.length, count);
    assert.equal(new Set(puzzles.map(p => p.family)).size, count);
    assert.equal(new Set(puzzles.map(p => p.code)).size, count);
    for (const puzzle of puzzles) {
      assert.match(puzzle.code, /^\d{5}$/);

      let result = '';
      if (puzzle.visual?.type === 'color_grid') {
        const { cells } = puzzle.visual!.payload as { cells: { color: string }[] };
        const table = new Map([...puzzle.body.matchAll(/([A-Z]+)\s*=\s*(\d)/g)].map(match => [match[1], match[2]]));
        result = cells.map(cell => table.get(cell.color)).join('');
      } else if (puzzle.visual?.type === 'switch_panel') {
        const { rows } = puzzle.visual!.payload as { rows: SwitchRow[] };
        result = rows.map(row => row.switches.reduce((sum, on, i) => sum + (on ? [8, 4, 2, 1][i] : 0), 0)).join('');
      } else if (puzzle.visual?.type === 'vault_dial') {
        const { disks } = puzzle.visual!.payload as { disks: VaultDisk[] };
        result = disks.map(disk => ((disk.value + disk.offset) % 10 - disk.offset + 10) % 10).join('');
      }
      if (puzzle.family === 'CAESAR') {
        const shift = Number(puzzle.body.match(/aplicado: ([+-]\d+)/)![1]);
        const encoded = puzzle.body.match(/cifrados:\n  ([\d ]+)/)![1].trim().split(/\s+/);
        result = encoded.map(digit => (Number(digit) - shift + 10) % 10).join('');
      } else if (puzzle.family === 'MIRROR') result = puzzle.body.match(/exibidos:\n  ([\d ]+)/)![1].trim().split(/\s+/).map(digit => 9 - Number(digit)).join('');
      else if (puzzle.family === 'MORSE') { const table = ['-----','.----','..---','...--','....-','.....','-....','--...','---..','----.']; result = [...puzzle.body.matchAll(/SINAL \d: ([.-]{5})/g)].map(match => table.indexOf(match[1])).join(''); }
      else if (puzzle.family === 'BINARY') result = [...puzzle.body.matchAll(/\[ ([01]{4}) \]/g)].map(match => parseInt(match[1],2)).join('');
      assert.equal(result, puzzle.code);
    }
  }
});

test('catálogo de sete desafios físicos distintos e validação imediata em 1000 operações', () => {
  for (let i = 0; i < 1000; i++) {
    const count = [3,5,7][i % 3];
    const games = createMiniGames(count);
    assert.ok(games.some(game => game.kind === 'qte'));
    assert.equal(games.length, count);
    assert.equal(new Set(games.map(game => game.kind)).size, count);
    for (const game of games) {
      assert.match(game.sequence, /^[0-9ABCD*#]+$/);
      let prefix = '';
      for (const [index, key] of [...game.sequence].entries()) {
        assert.equal(checkInput(game, prefix, key), index === game.sequence.length - 1 ? 'complete' : 'progress');
        assert.equal(checkInput(game, prefix, key === 'A' ? 'B' : 'A'), 'error');
        prefix += key;
      }
      if (game.kind === 'wires') assert.equal(game.sequence, game.order.map(color => game.wires.find(wire => wire.color === color)!.key).join(''));
      if (game.kind === 'route') {
        assert.equal(game.sequence, game.cells.map(cell => KEY_LAYOUT[cell]).join(''));
        assert.equal(new Set(game.cells).size, game.cells.length);
        for (let k = 1; k < game.cells.length; k++) {
          const a = game.cells[k - 1], b = game.cells[k];
          assert.equal(Math.abs(a % 4 - b % 4) + Math.abs(Math.floor(a / 4) - Math.floor(b / 4)), 1);
        }
      }
      assert.equal(memoryDuration(game), game.kind === 'memory' ? 5 * MEMORY_BEAT_MS : 0);
    }
  }
});
test('velocidade e prioridade de perigo mantidas', () => {
  assert.equal(timerSpeed(3), 1); assert.equal(timerSpeed(2), 1.4); assert.equal(timerSpeed(1), 1.9);
  assert.equal(buzzerProfile(3, 300), 'NORMAL'); assert.equal(buzzerProfile(2, 300), 'ALERT');
  assert.equal(buzzerProfile(3, 60), 'FAST'); assert.equal(buzzerProfile(3, 30), 'CRITICAL'); assert.equal(buzzerProfile(1, 300), 'CRITICAL');
});

test('QTE: entradas precoces, atrasadas e teclas erradas são rejeitadas', () => {
  const game = { kind: 'qte' as const, sequence: 'ABC' };
  assert.equal(checkTimedInput(game,'','A',QTE_OPEN_MS - 1),'error');
  assert.equal(checkTimedInput(game,'','A',QTE_OPEN_MS),'progress');
  assert.equal(checkTimedInput(game,'A','B',QTE_CLOSE_MS),'progress');
  assert.equal(checkTimedInput(game,'AB','C',QTE_OPEN_MS),'complete');
  assert.equal(checkTimedInput(game,'','A',QTE_CLOSE_MS + 1),'error');
  assert.equal(checkTimedInput(game,'','A',QTE_ROUND_MS + 1),'error');
  assert.equal(checkTimedInput(game,'','D',QTE_OPEN_MS),'error');
  assert.equal(qteExpired(game,0,999999),false);
  assert.equal(qteExpired(game,1000,1000 + QTE_ROUND_MS),false);
  assert.equal(qteExpired(game,1000,1001 + QTE_ROUND_MS),true);
});
test('novos desafios geram respostas conforme as regras visíveis', () => {
  for (let i = 0; i < 100; i++) for (const game of createMiniGames(7)) {
    if(game.kind === 'reverse') assert.equal(game.sequence,[...game.shown].reverse().join(''));
    if(game.kind === 'balance') assert.equal(game.sequence,game.sums.map(([a,b])=>a+b).join(''));
    if(game.kind === 'symbols') assert.equal(game.sequence,game.targets.map(symbol=>game.mapping.find(item=>item.symbol === symbol)!.key).join(''));
  }
});
