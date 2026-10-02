type Token = string;
const FUNCTIONS: Record<string, (value: number) => number> = {
  sqrt: Math.sqrt, abs: Math.abs, sin: Math.sin, cos: Math.cos, tan: Math.tan,
  ln: Math.log, log: Math.log10, floor: Math.floor, ceil: Math.ceil,
};
export function calculate(expression: string): number {
  if (expression.length > 250) throw new Error('Expressão muito longa.');
  const input = expression.toLowerCase().replace(/,/g, '.');
  const tokens: Token[] = [];
  let rest = input;
  while (rest.trim()) {
    const match = rest.match(/^\s*(\d+(?:\.\d*)?|\.\d+|[a-z]+|[()+\-*/%^])/);
    if (!match) throw new Error('Símbolo inválido.');
    tokens.push(match[1]); rest = rest.slice(match[0].length);
  }
  let index = 0;
  const finite = (value: number) => { if (!Number.isFinite(value)) throw new Error('Resultado indefinido. Confira a divisão ou função.'); return value; };
  function atom(): number {
    const token = tokens[index++];
    if (token === '+' || token === '-') return (token === '-' ? -1 : 1) * parse(3);
    if (token === '(') { const value = parse(0); if (tokens[index++] !== ')') throw new Error('Feche os parênteses.'); return value; }
    if (token === 'pi') return Math.PI;
    if (token === 'e') return Math.E;
    if (FUNCTIONS[token]) {
      if (tokens[index++] !== '(') throw new Error('Use a função com parênteses.');
      const value = parse(0); if (tokens[index++] !== ')') throw new Error('Feche os parênteses.');
      return finite(FUNCTIONS[token](value));
    }
    if (!token || !/^\d*\.?\d+$|^\d+\.$/.test(token)) throw new Error('Expressão incompleta.');
    return Number(token);
  }
  function parse(minimum: number): number {
    let value = atom();
    while (index < tokens.length) {
      const op = tokens[index];
      const priority = op === '+' || op === '-' ? 1 : ['*','/','%','mod'].includes(op) ? 2 : op === '^' ? 4 : 0;
      if (!priority || priority < minimum) break;
      index++;
      const rhs = parse(op === '^' ? priority : priority + 1);
      if ((op === '/' || op === '%' || op === 'mod') && rhs === 0) throw new Error('Não é possível dividir por zero.');
      if (op === '+') value += rhs;
      else if (op === '-') value -= rhs;
      else if (op === '*') value *= rhs;
      else if (op === '/') value /= rhs;
      else if (op === '^') value **= rhs;
      else value = ((value % Math.abs(rhs)) + Math.abs(rhs)) % Math.abs(rhs);
      finite(value);
    }
    return value;
  }
  const result = parse(0);
  if (index !== tokens.length) throw new Error('Operador ou parêntese inesperado.');
  return finite(result);
}
