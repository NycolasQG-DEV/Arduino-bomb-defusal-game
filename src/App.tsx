import { useEffect, useRef, useState } from 'react';
import { SerialController, serialAvailable } from './serial';
import { generate, buzzerProfile, timerSpeed, morse, type Puzzle } from './game';
import { sound } from './audio';
import { Window } from './Window';
import { ColorGridViewer, SwitchPanelViewer, VaultDialViewer } from './PuzzleVisuals';
import { createMiniGames, checkTimedInput, memoryDuration, qteExpired, type MiniGame } from './minigames';
import { PhysicalMiniGame } from './PhysicalMiniGame';
import { Calculator } from './Calculator';
import { DEFAULT_MODULE_COUNT, MODULE_OPTIONS } from './config';
import type { SwitchRow, VaultDisk } from './game';

type Phase = 'IDLE' | 'INTRO' | 'CODE' | 'PHYSICAL' | 'FINAL' | 'VICTORY' | 'DEFEAT' | 'LOST';
const mock = new URLSearchParams(location.search).get('mock') === '1' && import.meta.env.DEV;

export function App() {
  const serial = useRef(new SerialController()).current;
  const [connection, setConnection] = useState<'OFFLINE' | 'CONNECTING' | 'ONLINE' | 'ERROR'>('OFFLINE');
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<Phase>('IDLE');
  const [time, setTime] = useState(300);
  const [lives, setLives] = useState(3);
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [active, setActive] = useState(-1);
  const [prefix, setPrefix] = useState('');

  // Suporte a Múltiplas Janelas Abertas
  const [openWindows, setOpenWindows] = useState<string[]>([]);
  const [code, setCode] = useState('');
  const [log, setLog] = useState('RECOVERY TERMINAL / AGUARDANDO CÓDIGO');
  const [muted, setMuted] = useState(false);
  const [intro, setIntro] = useState(0);

  // Buffer de entrada do teclado físico em tempo real
  const [bombInput, setBombInput] = useState('');
  const [miniGames, setMiniGames] = useState<MiniGame[]>([]);
  const [previewAt, setPreviewAt] = useState(0);
  const [stepAt, setStepAt] = useState(0);
  const [moduleCount, setModuleCount] = useState<number>(DEFAULT_MODULE_COUNT);
  const [success, setSuccess] = useState<{ module: number; until: number } | null>(null);

  const live = useRef({ phase, time, lives, puzzles, active, prefix, bombInput, code, miniGames, previewAt, stepAt });
  live.current = { phase, time, lives, puzzles, active, prefix, bombInput, code, miniGames, previewAt, stepAt };

  const playing = ['CODE', 'PHYSICAL', 'FINAL'].includes(phase);

  const send = (command: string) => {
    if (!mock) void serial.send(command).catch(() => lost());
  };

  function lost() {
    setConnection('OFFLINE');
    if (['INTRO', 'CODE', 'PHYSICAL', 'FINAL'].includes(live.current.phase)) {
      live.current.phase = 'LOST';
      setPhase('LOST');
    }
    setError('Sinal interrompido. Reconecte o dispositivo para iniciar uma nova operação.');
  }

  function finish(win: boolean) {
    live.current.phase = win ? 'VICTORY' : 'DEFEAT';
    setPhase(live.current.phase);
    send(win ? 'DEFUSED' : 'EXPLODE');
    sound.cancel();
    if (win) sound.victory(); else sound.play(90, 1);
    setOpenWindows([]);
  }

  function mistake() {
    const next = live.current.lives - 1;
    live.current.lives = next;
    live.current.prefix = '';
    setLives(next);
    setPrefix('');
    live.current.bombInput = '';
    setBombInput('');
    live.current.previewAt = performance.now();
    setPreviewAt(live.current.previewAt);
    live.current.stepAt = live.current.active >= 0 && live.current.miniGames[live.current.active]?.kind === 'qte' ? 0 : performance.now();
    setStepAt(live.current.stepAt);
    send(`LIVES|${next}`);
    send('EVENT|ERROR');
    sound.play(110, 0.25);
    setLog('ENTRADA INCORRETA / UMA VIDA PERDIDA\nO desafio foi reiniciado. Confira a ordem no painel visual e tente novamente.');
    if (next === 0) finish(false);
  }

  // Gerenciamento de Janelas
  function toggleWindow(id: string) {
    sound.play();
    setOpenWindows(prev => {
      if (prev.includes(id)) {
        // Traz para a frente se já estiver aberta
        return [...prev.filter(w => w !== id), id];
      } else {
        // Abre nova janela
        return [...prev, id];
      }
    });
  }

  function closeWindow(id: string) {
    setOpenWindows(prev => prev.filter(w => w !== id));
  }

  // ENTRADA DO TECLADO FÍSICO DO ARDUINO:
  function physical(key: string) {
    sound.play(1600, 0.055);
    const current = live.current;
    const inGame = ['CODE', 'PHYSICAL', 'FINAL'].includes(current.phase);
    if (!inGame) return;

    // Todos os módulos seguros: confirmação física final.
    if (current.phase === 'FINAL') {
      if (key === '#') {
        finish(true);
      }
      return;
    }

    if (current.phase === 'PHYSICAL' && current.active >= 0) {
      const game = current.miniGames[current.active];
      const now = performance.now();
      if (game.kind === 'qte' && current.stepAt === 0) {
        if (key === '#') { current.stepAt = now; setStepAt(now); }
        return;
      }
      if (now < current.previewAt + memoryDuration(game)) return;
      if (game.kind === 'memory' && key === '#' && !current.bombInput) {
        current.previewAt = now;
        setPreviewAt(now);
        return;
      }
      const result = checkTimedInput(game, current.bombInput, key, now - current.stepAt);
      if (result === 'error') { mistake(); return; }
      current.bombInput += key;
      setBombInput(current.bombInput);
      if (result !== 'complete') {
        if (game.kind === 'qte') { current.stepAt = now; setStepAt(now); }
        return;
      }
      const disarmedIndex = current.active;
      const updated = current.puzzles.map((p, i) => i === disarmedIndex ? { ...p, done: true } : p);
      current.puzzles = updated;
      setPuzzles(updated);
      current.bombInput = ''; setBombInput('');
      current.active = -1; setActive(-1);
      current.code = ''; setCode('');
      current.phase = updated.every(p => p.done) ? 'FINAL' : 'CODE';
      setPhase(current.phase);
      setOpenWindows(prev => prev.filter(w => w !== String(disarmedIndex)));
      setLog(current.phase === 'FINAL'
        ? 'TODOS OS MÓDULOS SEGUROS / FINAL OVERRIDE\nPressione # na bomba para concluir.'
        : `MÓDULO 0${disarmedIndex + 1} SEGURO.\nResolva o próximo arquivo e envie o código na bomba.`);
      setSuccess({ module: disarmedIndex + 1, until: performance.now() + 4500 });
      send('EVENT|SUCCESS');
      sound.success();
      return;
    }

    // FASE 3: NENHUM MÓDULO ATIVO (FASE 'CODE')
    // Digitação do Código de 5 Dígitos para selecionar o próximo módulo
    if (key === '*') {
      current.code = '';
      setCode('');
      setLog('CÓDIGO DE SELEÇÃO LIMPO (*)');
      return;
    }
    if (key === '#') {
      submitCode(current.code);
      return;
    }
    if (/^[0-9]$/.test(key) && current.code.length < 5) {
      const nextCode = current.code + key;
      current.code = nextCode;
      setCode(nextCode);
    }
  }

  useEffect(() => {
    serial.onKey = physical;
    serial.onLost = lost;
    return () => {
      serial.onKey = () => {};
      serial.onLost = () => {};
    };
  });

  useEffect(() => () => { void serial.close(); }, [serial]);

  useEffect(() => {
    if (!playing) return;
    let previous = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const current = live.current;
      if (!['CODE', 'PHYSICAL', 'FINAL'].includes(current.phase)) return;
      const remaining = Math.max(0, current.time - (now - previous) / 1000 * timerSpeed(current.lives));
      previous = now;
      current.time = remaining;
      setTime(remaining);
      if (remaining === 0) { finish(false); return; }
      if (current.phase === 'PHYSICAL' && current.active >= 0 && qteExpired(current.miniGames[current.active], current.stepAt, now)) mistake();
    }, 50);
    return () => clearInterval(id);
  }, [playing]);

  const profile = buzzerProfile(lives, time);
  useEffect(() => {
    if (playing) send(`BUZZ|${profile}`);
  }, [profile, playing]);

  useEffect(() => {
    if (phase === 'INTRO') setIntro(0);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'INTRO') return;
    function onKey(e: KeyboardEvent) {
      if (intro >= 4) return;
      if (e.key === 'Enter') { e.preventDefault(); setIntro(4); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); setIntro(n => Math.min(3, n + 1)); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setIntro(n => Math.max(0, n - 1)); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, intro]);

  useEffect(() => {
    if (phase !== 'INTRO' || intro !== 4) return;
    let cancelled = false;
    void (async () => {
      try {
        if (!mock) await serial.start();
        if (cancelled || live.current.phase !== 'INTRO') return;
        setTime(300); setPhase('CODE'); sound.play(160, .4);
      } catch { if (!cancelled) lost(); }
    })();
    return () => { cancelled = true; };
  }, [intro, phase]);

  async function connect() {
    sound.init();
    setError('');
    setConnection('CONNECTING');
    setStep(0);
    try {
      if (mock) {
        setStep(4);
      } else await serial.connect(setStep);
      setConnection('ONLINE');
      sound.play(780, 0.18);
    } catch (e) {
      setConnection('ERROR');
      setStep(0);
      setError(e instanceof DOMException && e.name === 'NotFoundError' ? 'Seleção cancelada. Clique em conectar para tentar novamente.' : e instanceof Error ? e.message : 'Não foi possível conectar.');
    }
  }

  async function start() {
    if (connection !== 'ONLINE') return;
    sound.init();
    setError('');
    setConnection('CONNECTING');
    try {
      if (!mock) await serial.reset();
      sound.cancel();
      setPuzzles(generate(moduleCount));
      setMiniGames(createMiniGames(moduleCount));
      setSuccess(null);
      setStepAt(0);
      setPreviewAt(0);
      setLives(3);
      setTime(300);
      setPrefix('');
      setCode('');
      setActive(-1);
      setOpenWindows([]);
      live.current.bombInput = '';
      setBombInput('');
      setLog('RECOVERY TERMINAL / AGUARDANDO CÓDIGO');
      setConnection('ONLINE');
      setPhase('INTRO');
    } catch (e) {
      setConnection('ERROR');
      setError(e instanceof Error ? e.message : 'Falha ao reiniciar dispositivo.');
    }
  }

  function submitCode(targetCode?: string, e?: React.FormEvent) {
    if (e) e.preventDefault();
    const current = live.current;
    if (current.phase !== 'CODE') return;
    const finalCode = targetCode !== undefined ? targetCode : current.code || code;
    if (finalCode.length !== 5) {
      setLog(`CÓDIGO INCOMPLETO (${finalCode.length}/5 DÍGITOS)\nDigite os 5 dígitos no teclado da bomba e pressione (#).`);
      sound.play(300, 0.1);
      return;
    }
    const currentPuzzles = current.puzzles;
    const index = currentPuzzles.findIndex(p => p.code === finalCode);
    setCode('');
    current.code = '';
    if (index >= 0 && currentPuzzles[index].done) {
      setLog(`MÓDULO 0${index + 1} JÁ SEGURO / Módulo desarmado.`);
      sound.play(300, 0.1);
      return;
    }
    if (index < 0) {
      setLog(`CÓDIGO INVÁLIDO (${finalCode})\nNenhum módulo encontrado com este código. Integridade reduzida.`);
      mistake();
      return;
    }
    current.bombInput = '';
    setBombInput('');
    current.active = index;
    setActive(index);
    current.prefix = '';
    setPrefix('');
    current.phase = 'PHYSICAL';
    setPhase('PHYSICAL');
    current.previewAt = performance.now();
    setPreviewAt(current.previewAt);
    current.stepAt = current.miniGames[index].kind === 'qte' ? 0 : current.previewAt;
    setStepAt(current.stepAt);

    // O painel físico fica visível assim que o código é aceito.
    setOpenWindows([]);
    setLog(`CÓDIGO ACEITO / MÓDULO 0${index + 1}\nO painel visual está ativo. Use exclusivamente o teclado da bomba. Cada etapa é validada imediatamente.`);
    sound.play(780, 0.16);
  }

  const minutes = String(Math.floor(Math.ceil(time) / 60)).padStart(2, '0');
  const seconds = String(Math.ceil(time) % 60).padStart(2, '0');
  // setup = tela de conexao/idle; durante INTRO nao mostramos nem setup nem desktop
  const setup = phase === 'IDLE' || phase === 'LOST';
  const inIntro = phase === 'INTRO';

  return (
    <main className={`crt ${time <= 30 && playing ? 'critical' : ''}`}>
      <div className="scanlines" />

      {/* ============================================================
          FASE INTRO: Tela preta com slides cinemáticos.
          NADA do game é renderizado aqui — nem header, nem desktop.
          ============================================================ */}
      {inIntro && (
        <div className="intro-stage">
          <div className="intro-slide" key={intro}>
            <p className="intro-eyebrow">INSTRUÇÃO {Math.min(intro + 1, 4)} DE 4</p>
            <h2 className="intro-title">{['CINCO MINUTOS. TRÊS VIDAS.', 'RECUPERE OS CÓDIGOS', 'CONTROLE OS MINIGAMES', 'PRONTO PARA A CONTENÇÃO?'][Math.min(intro, 3)]}</h2>
            <p className="intro-body">{[
              `Esta operação tem ${moduleCount} módulos. Resolva os arquivos e complete seus desafios antes do tempo acabar. Cada erro custa uma vida.`,
              'Cada arquivo tem suas próprias regras. Descubra o código de cinco dígitos e digite na bomba. Use * para limpar o código e # para enviar. A calculadora está disponível no desktop.',
              'Após o código correto, o terminal abre um desafio visual. As regras estão no próprio minigame. No quick time event, pressione a tecla mostrada quando o marcador estiver na faixa verde.',
              'Ao concluir todos os módulos, pressione # na bomba. O relógio só começa quando você iniciar. Use as setas para revisar ou Enter para pular as instruções.'
            ][Math.min(intro, 3)]}</p>
            <nav className="intro-navigation" aria-label="Navegar pelas instruções">
              <button disabled={intro === 0 || intro === 4} onClick={() => setIntro(n => Math.max(0, n - 1))} aria-label="Instrução anterior">← VOLTAR</button>
              <span>{Math.min(intro + 1, 4)} / 4</span>
              <button disabled={intro === 4} onClick={() => setIntro(n => n === 3 ? 4 : n + 1)}>{intro >= 3 ? 'INICIAR OPERAÇÃO' : 'AVANÇAR →'}</button>
            </nav>
            <p className="intro-skip">← → NAVEGAR / ENTER PULA</p>
          </div>
        </div>
      )}

      {/* ============================================================
          FORA DO INTRO: header + conteúdo normal
          ============================================================ */}
      {!inIntro && (
        <>
          <header className="topbar">
            <span>
              <b className="brand-square">R</b> RECOVERY OS <small>v.1.04 / BOMB CONTROL SYSTEM</small>
            </span>
            <button className="sound" onClick={() => { sound.enabled = muted; setMuted(!muted); }}>
              SOM: {muted ? 'OFF' : 'ON'}
            </button>
          </header>
          <div className="system-line">
            <span>OPERACAO 001 / ACESSO LOCAL</span>
            <span className={connection === 'ONLINE' ? 'online' : ''}>
              HARDWARE: {({ OFFLINE: 'DESCONECTADO', CONNECTING: 'CONECTANDO', ONLINE: 'ONLINE', ERROR: 'ERRO' })[connection]}
            </span>
          </div>
        </>
      )}
      {!inIntro && setup ? (
        <div className="setup">
          <section className="brief">
            <p className="eyebrow">PROTOCOLO DE CONTENÇÃO / {String(moduleCount).padStart(2, '0')} MÓDULOS</p>
            <h1>DESARMAR<br />A BOMBA<span className="cursor">_</span></h1>
            <p className="lead">{moduleCount} arquivos. Três chances.<br />Cinco minutos para recuperar o controle.</p>
            <div className="specs">
              <div><b>05:00</b><span>TEMPO INICIAL</span></div>
              <div><b>{String(moduleCount).padStart(2, '0')}</b><span>ENIGMAS</span></div>
              <div><b>03</b><span>VIDAS</span></div>
            </div>
            <p className="fiction">SIMULAÇÃO INTERATIVA / DISPOSITIVO CENOGRÁFICO</p>
          </section>
          <section className="connect-panel">
            <div className="panel-title">
              <span>01 / ESTABELECER CONEXÃO</span>
              <span>USB / SERIAL</span>
            </div>
            <div className="hardware-art" aria-hidden="true">
              <div className="board">
                <i /><i /><i />
                <div className="chip">BOMB<br />V1</div>
                <div className="pins" />
              </div>
              <div className="cable" />
              <div className="usb">USB</div>
            </div>
            <h2>{connection === 'ONLINE' ? 'Dispositivo autorizado.' : 'Conecte o dispositivo.'}</h2>
            <p className="help">Conecte o Arduino Uno por USB. Em seguida, selecione a porta COM do dispositivo na janela do navegador.</p>
            <ol className="connection-steps">
              {['Selecionar porta COM', 'Abrir canal em 115200 baud', 'Validar firmware BOMB_V1', 'Confirmar RESET do dispositivo'].map((text, i) => (
                <li className={step > i ? 'completed' : step === i + 1 ? 'current' : ''} key={text}>
                  <span>{step > i ? 'OK' : String(i + 1).padStart(2, '0')}</span>{text}
                </li>
              ))}
            </ol>
            <div aria-live="polite">
              {error && <p className="error">{error}</p>}
              {!serialAvailable() && !mock && <p className="error">Web Serial indisponível. Abra em Chrome ou Edge, via localhost ou HTTPS.</p>}
            </div>
            <button
              className="primary"
              disabled={connection === 'CONNECTING' || connection === 'ONLINE' || (!serialAvailable() && !mock)}
              onClick={() => void connect()}
            >
              {connection === 'CONNECTING' ? 'ESTABELECENDO CONEXÃO...' : connection === 'ONLINE' ? 'DISPOSITIVO CONECTADO' : 'CONECTAR DISPOSITIVO'}
              <span>{connection === 'ONLINE' ? 'OK' : '→'}</span>
            </button>
            <label className="module-select">MÓDULOS NESTA OPERAÇÃO<select value={moduleCount} disabled={connection === 'CONNECTING'} onChange={e => setModuleCount(Number(e.target.value))}>{MODULE_OPTIONS.map(count => <option key={count} value={count}>{count} módulos</option>)}</select></label>
            <button className="start" disabled={connection !== 'ONLINE'} onClick={() => void start()}>
              INICIAR JOGO <span>→</span>
            </button>
            <p className="gate">
              {connection === 'ONLINE' ? 'Canal validado. Operação liberada.' : 'INÍCIO BLOQUEADO ATÉ A VALIDAÇÃO DO HARDWARE'}
            </p>
          </section>
        </div>
      ) : !inIntro ? (
        <div className={`desktop ${phase === 'CODE' ? 'desktop-fadein' : ''}`}>
          <div className="mission-bar">
            <span>
              CONTENÇÃO ATIVA<br />
              <small>{phase === 'PHYSICAL' ? 'AGUARDANDO TECLADO FÍSICO' : phase === 'FINAL' ? 'FINAL OVERRIDE' : 'RECUPERE OS CÓDIGOS'}</small>
            </span>
            <strong className="timer">{minutes}:{seconds}</strong>
            <span className="integrity">
              INTEGRIDADE<br />
              <b>{Array.from({ length: 3 }, (_, i) => <i className={i < lives ? 'lit' : ''} key={i} />)}</b>
            </span>
          </div>

          <div className="desktop-workspace">
            {/* ÁREA DA ESQUERDA: ÍCONES E ARQUIVOS FLUTUANTES */}
            <div className="desktop-main-area">
              <div className="desktop-icons">
                {puzzles.map((p, i) => (
                  <button
                    key={p.name}
                    className={`file-icon ${p.done ? 'secured dark-out' : ''}`}
                    disabled={p.done}
                    onClick={() => !p.done && toggleWindow(String(i))}
                  >
                    <span className="file-drawing">{p.done ? 'OFF' : String(i + 1).padStart(2, '0')}</span>
                    {p.name}
                    <small>{p.done ? 'DESATIVADO / SEGURO' : 'ARQUIVO RECUPERADO'}</small>
                  </button>
                ))}
              </div>

              <div className="tools"><button onClick={() => toggleWindow('calculator')}><span className="tool-symbol">[=]</span>CALCULADORA<small>MOD / RAIZ / POTÊNCIA</small></button></div>
              {openWindows.filter(id => id !== 'terminal').map((winId, index) => {
                const isCalculator = winId === 'calculator';
                const puzzle = isCalculator ? null : puzzles[Number(winId)];
                return <Window key={winId} title={isCalculator ? 'CALCULADORA.EXE' : puzzle?.name || 'ARQUIVO'} onClose={() => closeWindow(winId)} onFocus={() => toggleWindow(winId)} style={{ zIndex: 10 + index, top: `${100 + index * 20}px`, left: '10px' }}>
                  {isCalculator ? <Calculator/> : puzzle && <>
                    <p className="eyebrow">REGRAS DESTE ARQUIVO / {puzzle.family}</p>
                    <pre>{puzzle.body}</pre>
                    {puzzle.family === 'MORSE' && <div className="morse-table">{morse.map((signal, i) => <span key={i}>{i} = {signal}</span>)}</div>}
                    {puzzle.visual?.type === 'color_grid' && <ColorGridViewer cells={(puzzle.visual.payload as { cells: { hex: string; color: string; digit: number }[] }).cells}/>}
                    {puzzle.visual?.type === 'switch_panel' && <SwitchPanelViewer rows={(puzzle.visual.payload as { rows: SwitchRow[] }).rows}/>}
                    {puzzle.visual?.type === 'vault_dial' && <VaultDialViewer disks={(puzzle.visual.payload as { disks: VaultDisk[] }).disks}/>}
                    <p className="game-help">Digite o código de cinco dígitos na bomba e pressione <kbd>#</kbd>.</p>
                  </>}
                </Window>;
              })}
            </div>

            {/* PAINEL FIXO OBRIGATÓRIO DO TERMINAL NO CANTO DIREITO */}
            <aside className="fixed-terminal-panel">
              <div className="terminal-header">
                <span className="terminal-title">
                  <i className="term-dot" /> TERMINAL / RECOVERY SHELL
                </span>
                <span className="terminal-badge">OBRIGATÓRIO</span>
              </div>
              <div className="terminal-body">
                <div className="modules">
                  {puzzles.map((p, i) => (
                    <span className={p.done ? 'done' : ''} key={i}>
                      M0{i + 1} / {p.done ? 'OK' : '--'}
                    </span>
                  ))}
                </div>

                <pre aria-live="polite">{log}</pre>
                {phase === 'PHYSICAL' && active >= 0 && miniGames[active] && <PhysicalMiniGame game={miniGames[active]} progress={bombInput.length} previewAt={previewAt} stepAt={stepAt} now={performance.now()} />}
                {phase === 'FINAL' && <p className="final-directive">Todos os módulos seguros. Pressione <kbd>#</kbd> na bomba para concluir.</p>}

                {active >= 0 && phase === 'PHYSICAL' && (
                  <div className="terminal-live-box">
                    <span className="live-label">TECLAS DIGITADAS NA BOMBA (MÓDULO 0{active + 1}):</span>
                    <div className="live-value">{bombInput || '(nenhuma)'}</div>
                    <small>Etapas validadas imediatamente. Não é necessário confirmar ou apagar.</small>
                  </div>
                )}

                {phase === 'CODE' && (
                  <div className="terminal-live-box">
                    <span className="live-label">CÓDIGO DE 5 DÍGITOS DIGITADO NA BOMBA:</span>
                    <div className="live-value">{code || '_ _ _ _ _'}</div>
                    <small>Digite os 5 dígitos no teclado da bomba e pressione # para enviar.</small>
                  </div>
                )}

                {phase === 'CODE' && <form onSubmit={e => submitCode(undefined, e)}>
                  <label htmlFor="code">CÓDIGO DE ACESSO / 5 DÍGITOS (TECLADO FÍSICO DA BOMBA)</label>
                  <div className="code-input">
                    <span>&gt;</span>
                    <input
                      id="code"
                      autoFocus
                      autoComplete="off"
                      inputMode="numeric"
                      maxLength={5}
                      value={active >= 0 ? bombInput : code}
                      readOnly
                      disabled={phase !== 'CODE' && phase !== 'PHYSICAL'}
                      placeholder={active >= 0 ? "DIGITANDO SEQUÊNCIA NA BOMBA..." : "DIGITE NA BOMBA..."}
                    />
                    <button disabled={(phase !== 'CODE' && phase !== 'PHYSICAL') || (active < 0 ? code.length !== 5 : !bombInput)}>ENVIAR (#)</button>
                  </div>
                </form>}
              </div>
            </aside>
          </div>
        </div>
      ) : null}

      {success && playing && performance.now() < success.until && <aside className="module-success" role="status"><strong>MÓDULO {String(success.module).padStart(2,'0')} CONCLUÍDO</strong><span>CONTENÇÃO CONFIRMADA / {puzzles.filter(p => p.done).length} DE {puzzles.length} SEGUROS</span></aside>}

      {/* VISOR DESENHADO DA BOMBA NO CANTO INFERIOR DA TELA */}
      {playing && (
        <aside className="bomb-widget" aria-live="polite">
          <div className="bomb-header">
            <span className="bomb-title">
              <i className="bomb-icon" /> BOMBA FÍSICA
            </span>
            <small>{phase === 'FINAL' ? 'FINAL OVERRIDE' : active >= 0 ? `MÓDULO 0${active + 1}` : 'STANDBY'}</small>
          </div>
          <div className="bomb-visor">
            <span className="bomb-visor-label">CÓDIGO EM TEMPO REAL</span>
            <div className={`bomb-visor-screen ${!bombInput ? 'empty' : ''}`}>
              {phase === 'CODE' ? code || '_ _ _ _ _' : bombInput || '_ _ _ _'}
            </div>
          </div>
          <div className="bomb-controls-help">
            {phase === 'CODE' ? <><span><b>[*]</b> LIMPAR CÓDIGO</span><span><b>[#]</b> ENVIAR</span></> : <span>{phase === 'FINAL' ? '[#] CONTENÇÃO FINAL' : 'ETAPAS VALIDADAS EM TEMPO REAL'}</span>}
          </div>
        </aside>
      )}

      {/* O bloco de INTRO foi movido para intro-stage acima */}

      {(phase === 'VICTORY' || phase === 'LOST' || phase === 'DEFEAT') && (
        <div className={`overlay result ${phase !== 'VICTORY' ? 'failure' : ''}`}>
          <p className="eyebrow">
            {phase === 'VICTORY' ? 'SISTEMA DE CONTENCAO / EXITO' : 'FALHA CRITICA DE CONTENCAO'}
          </p>

          {phase !== 'VICTORY' && (
            <pre className="explosion-art" aria-hidden="true">
              {'////// DETONACAO DETECTADA //////\n\n  [ SINAL FISICO PERDIDO ]\n  [ A BOMBA EXPLODIU     ]\n\n  *** MISSAO FRACASSADA ***'}
            </pre>
          )}

          <h2>{phase === 'VICTORY' ? 'BOMBA DESARMADA' : 'BOMBA DETONADA'}</h2>
          <p>
            {phase === 'VICTORY'
              ? 'Todos os modulos foram seguros com sucesso. A bomba foi totalmente desativada.'
              : 'A sequencia de contencao falhou ou o tempo se esgotou. A bomba explodiu.'}
          </p>
          <p style={{ color: 'var(--amber)', fontSize: '13px' }}>
            TEMPO DECORRIDO: {minutes}:{seconds} / MODULOS RECUPERADOS: {puzzles.filter(p => p.done).length} de {puzzles.length}
          </p>

          <button className="primary" disabled={connection !== 'ONLINE'} onClick={() => void start()}>
            INICIAR NOVA OPERACAO <span>→</span>
          </button>
          <button onClick={() => setPhase('IDLE')}>VOLTAR A CONEXAO</button>
        </div>
      )}

      {mock && (
        <aside className="mock">
          DEV MOCK MODE / TECLADO VIRTUAL BOMB {' '}
          {playing && '123A456B789C*0#D'.split('').map(k => (
            <button key={k} onClick={() => physical(k)}>{k}</button>
          ))}
        </aside>
      )}

      <footer className="bottom">
        <span>RECOVERY SYSTEMS / LOCAL DEVICE CONTROL</span>
        <span>{playing ? `${timerSpeed(lives).toFixed(1)}x / ${profile}` : 'AGUARDANDO AUTORIZAÇÃO'} <i className="status-dot" /></span>
      </footer>
    </main>
  );
}
