import { useEffect, useRef, useState, useCallback } from 'react';
import type { Wire, KeypadStep, SwitchRow, VaultDisk } from './game';

// -----------------------------------------------------------------------
// COLOR GRID – Células coloridas
// -----------------------------------------------------------------------
interface ColorCell { hex: string; color: string; digit: number }

export function ColorGridViewer({ cells }: { cells: ColorCell[] }) {
  return (
    <div style={{ marginTop: '16px' }}>
      <p style={{ color: '#88ffaa', fontSize: '15px', marginBottom: '10px' }}>
        VISOR CROMATICO — leia cada celula e consulte a tabela acima:
      </p>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {cells.map((cell, i) => (
          <div key={i} style={{
            width: '76px', height: '76px',
            background: cell.hex,
            border: '2px solid #00ff66',
            boxShadow: `0 0 20px ${cell.hex}88`,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            fontSize: '15px', fontWeight: 700,
            color: '#000', gap: '4px', borderRadius: '4px',
          }}>
            <span style={{ fontSize: '13px', opacity: 0.8 }}>POS.{i + 1}</span>
            <span>{cell.color.slice(0, 3)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------
// WIRE CUT – Fios coloridos no painel
// -----------------------------------------------------------------------
export function WireCutViewer({ wires, cutPositions }: { wires: Wire[]; cutPositions: number[] }) {
  const [cut, setCut] = useState<Set<number>>(new Set());

  const sorted = [...wires].sort((a, b) => a.pos - b.pos);
  const isCutTarget = (pos: number) => cutPositions.includes(pos);

  return (
    <div style={{ marginTop: '16px' }}>
      <p style={{ color: '#ffcc00', fontSize: '15px', marginBottom: '12px', letterSpacing: '2px' }}>
        PAINEL DE FIOS — identifique os 5 fios a cortar:
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {sorted.map((wire) => {
          const isCut = cut.has(wire.pos);
          return (
            <div
              key={wire.pos}
              onClick={() => setCut(prev => {
                const next = new Set(prev);
                if (next.has(wire.pos)) next.delete(wire.pos); else next.add(wire.pos);
                return next;
              })}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                cursor: 'pointer', opacity: isCut ? 0.35 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              <span style={{
                fontSize: '14px', color: '#669977', width: '18px', textAlign: 'right', flexShrink: 0
              }}>{wire.pos}</span>
              {/* Fio visual */}
              <div style={{ flex: 1, height: '14px', position: 'relative', display: 'flex', alignItems: 'center' }}>
                {/* Ponta esquerda */}
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#333', border: '2px solid #555', flexShrink: 0 }} />
                {/* Linha do fio */}
                <div style={{
                  flex: 1, height: isCut ? '2px' : '6px',
                  background: isCut
                    ? `repeating-linear-gradient(90deg, ${wire.hex} 0, ${wire.hex} 6px, transparent 6px, transparent 12px)`
                    : wire.hex,
                  boxShadow: isCut ? 'none' : `0 0 10px ${wire.hex}88`,
                  borderRadius: '2px',
                  transition: 'all 0.15s',
                  position: 'relative',
                }}>
                  {isCut && (
                    <div style={{
                      position: 'absolute', left: '50%', top: '50%',
                      transform: 'translate(-50%, -50%)',
                      color: '#ff4444', fontSize: '14px', letterSpacing: '1px',
                      fontWeight: 700, whiteSpace: 'nowrap',
                    }}>✂ CORTADO</div>
                  )}
                </div>
                {/* Ponta direita */}
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#333', border: '2px solid #555', flexShrink: 0 }} />
              </div>
              <span style={{ fontSize: '14px', color: wire.hex, width: '64px', flexShrink: 0, textShadow: `0 0 6px ${wire.hex}` }}>
                {wire.color}
              </span>
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: '14px', color: '#669977', marginTop: '12px' }}>
        O codigo sao as POSICOES dos fios a cortar, em ordem crescente. Clique nos fios para marcar.
      </p>
      {cut.size > 0 && (
        <p style={{ fontSize: '15px', color: '#ffcc00', marginTop: '6px' }}>
          Cortados: {[...cut].sort((a, b) => a - b).join(', ')} → codigo: <b>{[...cut].sort((a, b) => a - b).map(p => p % 10).join('')}</b>
        </p>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------
// KEYPAD SEQUENCE – Botões que acendem em sequência
// -----------------------------------------------------------------------
export function KeypadSequenceViewer({ steps, code }: { steps: KeypadStep[]; code: string }) {
  const [phase, setPhase] = useState<'idle' | 'showing' | 'done'>('idle');
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [shownSoFar, setShownSoFar] = useState<string[]>([]);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const startSequence = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    setPhase('showing');
    setActiveKey(null);
    setShownSoFar([]);
    let delay = 400;
    const shown: string[] = [];
    steps.forEach((step, idx) => {
      // Acende
      timeoutsRef.current.push(setTimeout(() => {
        setActiveKey(step.key);
        shown.push(step.key);
        setShownSoFar([...shown]);
      }, delay));
      delay += 700;
      // Apaga
      timeoutsRef.current.push(setTimeout(() => {
        setActiveKey(null);
      }, delay - 100));
      if (idx === steps.length - 1) {
        timeoutsRef.current.push(setTimeout(() => setPhase('done'), delay + 200));
      }
    });
  }, [steps]);

  useEffect(() => () => { timeoutsRef.current.forEach(clearTimeout); }, []);

  // Grid 3x3 de teclas
  const gridKeys = ['1','2','3','4','5','6','7','8','9'];

  return (
    <div style={{ marginTop: '16px' }}>
      <p style={{ color: '#88ffaa', fontSize: '15px', marginBottom: '12px', letterSpacing: '2px' }}>
        SEQUENCIA DO TECLADO — memorize a ordem dos botoes:
      </p>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 60px)',
        gap: '8px', marginBottom: '14px'
      }}>
        {gridKeys.map(k => {
          const isActive = activeKey === k;
          const stepIdx = shownSoFar.lastIndexOf(k);
          return (
            <div key={k} style={{
              width: '60px', height: '60px',
              background: isActive ? '#00ff66' : '#0a1a0a',
              border: `2px solid ${isActive ? '#00ff66' : '#1a3d1f'}`,
              boxShadow: isActive ? '0 0 24px #00ff66, inset 0 0 14px rgba(0,255,102,0.5)' : 'none',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              borderRadius: '4px', transition: 'all 0.1s',
              fontSize: '22px', fontWeight: 700,
              color: isActive ? '#000' : '#1a3d1f',
              fontFamily: 'Fira Code, monospace',
              position: 'relative',
            }}>
              {k}
              {stepIdx >= 0 && phase === 'done' && (
                <span style={{
                  position: 'absolute', top: '2px', right: '4px',
                  fontSize: '12px', color: '#ffcc00',
                }}>{stepIdx + 1}</span>
              )}
            </div>
          );
        })}
      </div>

      {phase === 'done' && (
        <p style={{ color: '#ffcc00', fontSize: '15px', marginBottom: '10px' }}>
          Sequencia: <b>{steps.map(s => s.key).join(' → ')}</b><br />
          Codigo: <b>{code}</b>
        </p>
      )}

      <button onClick={startSequence} style={{ fontSize: '14px', padding: '6px 16px' }}>
        {phase === 'idle' ? 'INICIAR SEQUENCIA' : phase === 'showing' ? 'AGUARDE...' : 'REPETIR SEQUENCIA'}
      </button>
      {phase !== 'idle' && (
        <p style={{ fontSize: '14px', color: '#669977', marginTop: '8px' }}>
          Anote a ordem dos botoes acesos. O codigo sao os numeros na ordem que acenderam.
        </p>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------
// SWITCH PANEL – Interruptores binários
// -----------------------------------------------------------------------
export function SwitchPanelViewer({ rows }: { rows: SwitchRow[] }) {
  return (
    <div style={{ marginTop: '16px' }}>
      <p style={{ color: '#88ffaa', fontSize: '15px', marginBottom: '12px', letterSpacing: '2px' }}>
        PAINEL DE INTERRUPTORES — pesos: 8 · 4 · 2 · 1:
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {rows.map((row, ri) => {
          const value = row.switches.reduce((acc, on, bi) => acc + (on ? [8, 4, 2, 1][bi] : 0), 0);
          return (
            <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '14px', color: '#669977', width: '54px', flexShrink: 0 }}>
                {row.label}
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {row.switches.map((on, bi) => (
                  <div key={bi} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px'
                  }}>
                    <span style={{ fontSize: '12px', color: '#445544' }}>{[8, 4, 2, 1][bi]}</span>
                    <div style={{
                      width: '36px', height: '52px',
                      background: on ? '#002a00' : '#0a0a0a',
                      border: `2px solid ${on ? '#00ff66' : '#1a2a1a'}`,
                      boxShadow: on ? '0 0 12px #00ff66, inset 0 0 8px rgba(0,255,102,0.3)' : 'none',
                      borderRadius: '4px',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'space-between',
                      padding: '4px 0',
                      position: 'relative',
                    }}>
                      {/* Alavanca */}
                      <div style={{
                        width: '14px', height: '22px',
                        background: on ? '#00ff66' : '#223322',
                        borderRadius: '3px',
                        transition: 'all 0.15s',
                        marginTop: on ? '0' : 'auto',
                        marginBottom: on ? 'auto' : '0',
                        boxShadow: on ? '0 0 8px #00ff66' : 'none',
                      }} />
                    </div>
                    <span style={{ fontSize: '12px', color: on ? '#00ff66' : '#334433', fontWeight: 700 }}>
                      {on ? 'ON' : 'OFF'}
                    </span>
                  </div>
                ))}
              </div>
              <span style={{
                fontSize: '13px', color: '#ffcc00', marginLeft: '6px',
                fontFamily: 'Fira Code, monospace', fontWeight: 700,
              }}>
                = {value}
              </span>
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: '14px', color: '#669977', marginTop: '12px' }}>
        Some os pesos de cada interruptor LIGADO (aceso) em cada bloco.
      </p>
    </div>
  );
}

// -----------------------------------------------------------------------
// VAULT DIAL – Discos giratórios
// -----------------------------------------------------------------------
export function VaultDialViewer({ disks }: { disks: VaultDisk[] }) {
  return (
    <div style={{ marginTop: '16px' }}>
      <p style={{ color: '#88ffaa', fontSize: '15px', marginBottom: '12px', letterSpacing: '2px' }}>
        COFRE DE DISCOS — calcule o numero real de cada disco:
      </p>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {disks.map((disk, i) => {
          const visible = (disk.value + disk.offset) % 10;
          // Gera os numeros ao redor do disco
          const dialNums = Array.from({ length: 10 }, (_, n) => n);
          return (
            <div key={i} style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '13px', color: '#669977', display: 'block', marginBottom: '6px' }}>
                DISCO {i + 1}
              </span>
              <div style={{
                width: '90px', height: '90px', borderRadius: '50%',
                background: 'radial-gradient(circle, #0a1a0a 60%, #001500)',
                border: '3px solid #00ff66',
                boxShadow: '0 0 20px #00ff6644',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', margin: '0 auto',
              }}>
                {/* Marcadores ao redor */}
                {dialNums.map(n => {
                  const angle = (n * 36 + disk.offset * 36) * (Math.PI / 180);
                  const r = 32;
                  const x = 45 + r * Math.sin(angle);
                  const y = 45 - r * Math.cos(angle);
                  const isVisible = n === visible;
                  return (
                    <span key={n} style={{
                      position: 'absolute',
                      left: `${x}px`, top: `${y}px`,
                      transform: 'translate(-50%, -50%)',
                      fontSize: isVisible ? '14px' : '8px',
                      color: isVisible ? '#ffcc00' : '#1a3d1f',
                      fontWeight: isVisible ? 700 : 400,
                      textShadow: isVisible ? '0 0 8px #ffcc00' : 'none',
                      transition: 'all 0.2s',
                      fontFamily: 'Fira Code, monospace',
                    }}>
                      {n}
                    </span>
                  );
                })}
                {/* Indicador */}
                <div style={{
                  position: 'absolute', top: '4px', left: '50%',
                  transform: 'translateX(-50%)',
                  width: '0', height: '0',
                  borderLeft: '5px solid transparent',
                  borderRight: '5px solid transparent',
                  borderTop: '10px solid #ff4444',
                }} />
              </div>
              <span style={{ fontSize: '13px', color: '#ffcc00', display: 'block', marginTop: '6px' }}>
                Visivel: <b>{visible}</b> / Giros: <b>{disk.offset}</b>
              </span>
              <span style={{ fontSize: '13px', color: '#669977', display: 'block' }}>
                Real = ({visible} - {disk.offset} + 10) % 10 = <b style={{ color: '#00ff66' }}>?</b>
              </span>
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: '14px', color: '#669977', marginTop: '14px' }}>
        REAL = (VISIVEL - GIROS + 10) mod 10. Some 10 se der negativo.
      </p>
    </div>
  );
}

// -----------------------------------------------------------------------
// CYCLE LOCK – Visor ciclico (mantido do original)
// -----------------------------------------------------------------------
interface CyclePos { final: number; cycles: number }

export function CycleLockViewer({ positions }: { positions: CyclePos[] }) {
  const [digits, setDigits] = useState<number[]>(positions.map(() => 0));
  const [locked, setLocked] = useState<boolean[]>(positions.map(() => false));
  const countersRef = useRef<number[]>(positions.map(() => 0));
  const intervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);

  const start = useCallback(() => {
    setDigits(positions.map(() => 0));
    setLocked(positions.map(() => false));
    countersRef.current = positions.map(() => 0);
    intervalsRef.current.forEach(id => clearInterval(id));
    intervalsRef.current = [];

    positions.forEach((pos, i) => {
      const startDelay = setTimeout(() => {
        const id = setInterval(() => {
          countersRef.current[i]++;
          const current = countersRef.current[i];
          if (current >= pos.cycles) {
            setDigits(prev => { const n = [...prev]; n[i] = pos.final; return n; });
            setLocked(prev => { const n = [...prev]; n[i] = true; return n; });
            clearInterval(id);
          } else {
            setDigits(prev => { const n = [...prev]; n[i] = (prev[i] + 1) % 10; return n; });
          }
        }, 150);
        intervalsRef.current[i] = id;
      }, i * 600);
      void startDelay;
    });
  }, [positions]);

  useEffect(() => {
    start();
    return () => { intervalsRef.current.forEach(id => clearInterval(id)); };
  }, [start]);

  return (
    <div style={{ marginTop: '16px' }}>
      <p style={{ color: '#88ffaa', fontSize: '15px', marginBottom: '10px' }}>
        TRAVA DE CICLO — aguarde cada posicao travar e anote o digito:
      </p>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {digits.map((d, i) => (
          <div key={i} style={{
            width: '70px', height: '80px',
            background: locked[i] ? '#001a08' : '#050e05',
            border: `2px solid ${locked[i] ? '#00ff66' : '#1a3d1f'}`,
            boxShadow: locked[i] ? '0 0 15px #00ff66, inset 0 0 10px rgba(0,255,102,0.3)' : 'none',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: '4px', transition: 'all 0.2s ease', borderRadius: '4px',
          }}>
            <span style={{ fontSize: '13px', color: locked[i] ? '#00ff66' : '#335533' }}>POS.{i + 1}</span>
            <span style={{
              fontSize: '32px', fontWeight: 700,
              color: locked[i] ? '#00ff66' : '#227733',
              textShadow: locked[i] ? '0 0 12px #00ff66' : 'none',
              fontFamily: 'Fira Code, monospace',
            }}>{d}</span>
            <span style={{ fontSize: '12px', color: locked[i] ? '#00ff66' : '#224422' }}>
              {locked[i] ? 'TRAVADO' : 'CICLANDO'}
            </span>
          </div>
        ))}
      </div>
      <button onClick={start} style={{ marginTop: '14px', fontSize: '14px', padding: '6px 14px' }}>
        REINICIAR CICLO
      </button>
    </div>
  );
}
