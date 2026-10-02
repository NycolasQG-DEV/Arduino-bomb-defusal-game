import { useEffect, useRef, type CSSProperties } from 'react';
import { sound } from './audio';
import { COLORS, KEY_LAYOUT, MEMORY_BEAT_MS, memoryDuration, GAME_TITLES, QTE_ROUND_MS, QTE_OPEN_MS, QTE_CLOSE_MS, type MiniGame } from './minigames';

export function PhysicalMiniGame({ game, progress, previewAt, stepAt, now }: { game: MiniGame; progress: number; previewAt: number; stepAt: number; now: number }) {
  const panel = useRef<HTMLElement>(null);
  const observing = game.kind === 'memory' && now < previewAt + memoryDuration(game);
  const beat = Math.floor((now - previewAt) / MEMORY_BEAT_MS);
  const flash = observing && beat >= 0 && beat < game.sequence.length && (now - previewAt) % MEMORY_BEAT_MS < 620 ? game.sequence[beat] : '';
  useEffect(() => {
    panel.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [game]);
  useEffect(() => {
    if (flash) sound.play(440 + COLORS.findIndex(color => color.key === flash) * 110, .12);
  }, [flash]);
  const elapsed = stepAt > 0 ? now - stepAt : 0;
  const ready = stepAt > 0 && elapsed >= QTE_OPEN_MS && elapsed <= QTE_CLOSE_MS;
  const symbol = (name: string) => ({ 'CÍRCULO': '○', 'TRIÂNGULO': '△', 'QUADRADO': '□', 'LOSANGO': '◇' })[name];
  return <section ref={panel} className={`physical-game game-${game.kind}`} aria-label={GAME_TITLES[game.kind]}>
    <div className="game-heading"><span className="action-tag">TECLADO DA BOMBA</span><span className="progress-tag">{progress} / {game.sequence.length} ETAPAS</span></div>
    <h2>{GAME_TITLES[game.kind]}</h2>
    <p className="game-instruction">
      {game.kind === 'wires' && <>Corte os fios na <strong className="mark-order">ordem das cores abaixo</strong>. Pressione o <strong className="mark-key">número do fio</strong> na bomba.</>}
      {game.kind === 'memory' && <>Observe os pulsos. Depois repita a ordem usando <strong className="mark-key">A, B, C e D</strong> na bomba.</>}
      {game.kind === 'route' && <>Siga a linha de <strong className="mark-order">INÍCIO até FIM</strong>. Pressione a <strong className="mark-key">tecla de cada ponto</strong> na bomba.</>}
      {game.kind === 'qte' && <>Espere o marcador entrar na <strong className="mark-success">faixa verde</strong>. Aperte a <strong className="mark-key">tecla mostrada</strong> na bomba. Cedo, tarde ou tecla errada custa uma vida.</>}
      {game.kind === 'reverse' && <>O eco voltou invertido. Digite os números da <strong className="mark-order">direita para a esquerda</strong> na bomba.</>}
      {game.kind === 'balance' && <>Some as duas cargas. Digite o <strong className="mark-key">resultado de cada soma</strong> na bomba, de cima para baixo.</>}
      {game.kind === 'symbols' && <>Consulte a legenda. Digite a <strong className="mark-key">letra de cada símbolo</strong>, na <strong className="mark-order">ordem dos alvos</strong>.</>}
    </p>
    {game.kind === 'qte' && <div className={`qte-panel ${ready ? 'ready' : ''}`}>
      <span className="qte-status">{stepAt === 0 ? 'PRESSIONE # NA BOMBA PARA INICIAR' : ready ? 'APERTE AGORA' : 'AGUARDE O MARCADOR'}</span>
      <kbd className="qte-key">{game.sequence[progress]}</kbd>
      <div className="qte-track" role="meter" aria-label="Tempo da rodada" aria-valuenow={Math.round(Math.min(100, elapsed / QTE_ROUND_MS * 100))} aria-valuemin={0} aria-valuemax={100}>
        <span className="qte-zone" style={{ left: `${QTE_OPEN_MS / QTE_ROUND_MS * 100}%`, width: `${(QTE_CLOSE_MS - QTE_OPEN_MS) / QTE_ROUND_MS * 100}%` }}>APERTE</span>
        <i className="qte-marker" style={{ left: `${Math.min(100, Math.max(0, elapsed / QTE_ROUND_MS * 100))}%` }}/>
      </div>
      <p className="game-help">Rodada {progress + 1} de {game.sequence.length}. Três segundos por rodada; a faixa aceita a tecla por 1,3 segundo.</p>
    </div>}
    {game.kind === 'reverse' && <div className="reverse-digits">{[...game.shown].map((digit, i) => <span key={i} className={i >= game.shown.length - progress ? 'accepted' : ''}><kbd>{digit}</kbd></span>)}<strong>← LEIA NESTE SENTIDO</strong></div>}
    {game.kind === 'balance' && <ol className="reactor-sums">{game.sums.map(([a,b], i) => <li key={i} className={i < progress ? 'accepted' : ''}><span>CARGA {i + 1}</span><b>{a} + {b}</b><span>{i < progress ? 'ESTABILIZADA' : 'AGUARDANDO'}</span></li>)}</ol>}
    {game.kind === 'symbols' && <>
      <div className="symbol-legend">{game.mapping.map(item => <div key={item.key}><span className="symbol-shape">{symbol(item.symbol)}</span><small>{item.symbol}</small><kbd>{item.key}</kbd></div>)}</div>
      <ol className="symbol-targets">{game.targets.map((target,i) => <li key={i} className={i < progress ? 'accepted' : ''}><b>{i + 1}</b><span className="symbol-shape">{symbol(target)}</span><small>{target}</small></li>)}</ol>
    </>}
    {game.kind === 'wires' && <>
      <ol className="wire-order">{game.order.map((color, i) => <li style={{ '--signal': COLORS[color].hex } as CSSProperties} className={i < progress ? 'finished' : ''} key={color}><b>{i + 1}</b>{COLORS[color].name}<span>{i < progress ? 'CORTADO' : 'ALVO'}</span></li>)}</ol>
      <div className="wire-board">{game.wires.map(w => <div className={`wire-row ${game.sequence.slice(0, progress).includes(w.key) ? 'cut' : ''}`} key={w.key} style={{ '--signal': COLORS[w.color].hex } as CSSProperties}><kbd>{w.key}</kbd><span className="wire-line"/><span className="wire-name">{COLORS[w.color].name}</span></div>)}</div>
    </>}
    {game.kind === 'memory' && <>
      <p className={`memory-state ${observing ? 'watch' : 'respond'}`} role="status">{observing ? `OBSERVE / PULSO ${Math.min(beat + 1, game.sequence.length)} DE ${game.sequence.length}` : 'SUA VEZ / REPITA NA BOMBA'}</p>
      <div className="memory-pads">{COLORS.map(color => <div key={color.key} className={`memory-pad ${flash === color.key ? 'flash' : ''}`} style={{ '--signal': color.hex } as CSSProperties}><kbd>{color.key}</kbd><span>{color.name}</span><small>{flash === color.key ? 'PULSO ATIVO' : 'CANAL'}</small></div>)}</div>
      <p className="game-help">{observing ? 'As entradas ficam bloqueadas durante a demonstração.' : progress === 0 ? 'Pressione # na bomba para rever os pulsos.' : 'Continue a sequência. Cada tecla é validada imediatamente.'}</p>
    </>}
    {game.kind === 'route' && <div className="route-board">
      <svg viewBox="0 0 400 400" aria-hidden="true"><polyline points={game.cells.map(i => `${(i % 4) * 100 + 50},${Math.floor(i / 4) * 100 + 50}`).join(' ')} fill="none" stroke="#ffcf73" strokeWidth="5" strokeLinejoin="round"/></svg>
      {[...KEY_LAYOUT].map((key, i) => {const step = game.cells.indexOf(i);return <div key={key} className={`route-cell ${step >= 0 ? 'on-route' : ''} ${step >= 0 && step < progress ? 'visited' : ''}`}><kbd>{key}</kbd><small>{step === 0 ? 'INÍCIO' : step === game.cells.length - 1 ? 'FIM' : step >= 0 ? `PASSO ${step + 1}` : 'FORA DA ROTA'}</small></div>;})}
    </div>}
    <div className="game-progress" aria-label={`${progress} de ${game.sequence.length} etapas concluídas`}>{[...game.sequence].map((_, i) => <span key={i} className={i < progress ? 'accepted' : ''}>{i < progress ? 'OK' : String(i + 1).padStart(2, '0')}</span>)}</div>
    <p className="game-help"><strong className="mark-success">VERDE = ETAPA CONCLUÍDA</strong> / Um erro custa uma vida e reinicia este desafio. A última tecla correta conclui o módulo.</p>
  </section>;
}
