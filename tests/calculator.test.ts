import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from '../src/calculationEngine';

test('calculadora: precedência, funções e módulo positivo', () => {
  assert.equal(calculate('2 + 3 * 4'), 14);
  assert.equal(calculate('(2 + 3) * 4'), 20);
  assert.equal(calculate('2 ^ 3 ^ 2'), 512);
  assert.equal(calculate('-2 ^ 2'), -4);
  assert.equal(calculate('2 ^ -2'), .25);
  assert.equal(calculate('-3 mod 10'), 7);
  assert.equal(calculate('17 % 5'), 2);
  assert.equal(calculate('-3 mod -10'), 7);
  assert.equal(calculate('sqrt(81) + abs(-4)'), 13);
  assert.equal(calculate('log(100) + floor(2.9)'), 4);
  assert.equal(calculate('1,5 + .5'), 2);
  assert.ok(Math.abs(calculate('sin(pi / 2)') - 1) < 1e-12);
});
test('calculadora rejeita expressões incompletas e resultados inválidos sem executar código', () => {
  for (const text of ['', '2 +', 'sqrt(-1)', '1/0', '1 mod 0', '(2 + 3', '2) + 3', 'alert(1)', '1;2', '2foo', 'Infinity', '2^9999']) assert.throws(() => calculate(text), Error, text);
});
