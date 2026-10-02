import { useState } from 'react';
import { calculate } from './calculationEngine';

export function Calculator() {
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState('0');
  const [error, setError] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  function solve() {
    try {
      const answer = Number(calculate(expression).toPrecision(12)).toString();
      setResult(answer); setError(''); setHistory(items => [`${expression} = ${answer}`, ...items].slice(0, 5));
    } catch (e) { setError(e instanceof Error ? e.message : 'Expressão inválida.'); }
  }
  return <section className="calculator">
    <label htmlFor="calculator-expression">EXPRESSÃO / TECLADO DO COMPUTADOR</label>
    <form onSubmit={e => { e.preventDefault(); solve(); }}>
      <input id="calculator-expression" autoComplete="off" value={expression} maxLength={250} onChange={e => setExpression(e.target.value)} placeholder="(7 - 3) mod 10" />
      <output aria-live="polite">{result}</output>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="calculator-keys">{['7','8','9','/','sqrt(', '4','5','6','*','^', '1','2','3','-','mod', '0','.','(',')','+', 'abs(','pi','sin(','cos(','log('].map(key => <button type="button" key={key} onClick={() => setExpression(text => text + (key === 'mod' ? ' mod ' : key))}>{key}</button>)}</div>
      <div className="calculator-actions"><button type="button" onClick={() => setExpression(text => text.slice(0,-1))}>APAGAR</button><button type="button" onClick={() => { setExpression(''); setResult('0'); setError(''); }}>LIMPAR</button><button className="primary" type="submit">CALCULAR =</button></div>
    </form>
    <p className="game-help"><strong className="mark-order">MOD</strong> retorna o módulo positivo: <code>-3 mod 10 = 7</code>. Use parênteses, potência (^), raiz, log, abs e funções trigonométricas em radianos. Enter calcula.</p>
    <ol className="calculator-history">{history.map((line, i) => <li key={i}>{line}</li>)}</ol>
  </section>;
}
