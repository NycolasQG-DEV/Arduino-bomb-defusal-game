export const morse = ['-----', '.----', '..---', '...--', '....-', '.....', '-....', '--...', '---..', '----.'];

export const families = [
  'CAESAR', 'MIRROR', 'MORSE', 'BINARY',
  'WIRE_CUT', 'KEYPAD_SEQUENCE', 'SWITCH_PANEL',
  'COLOR_CODE', 'CYCLE_LOCK', 'VAULT_DIAL'
] as const;
export type Family = typeof families[number];

export interface Puzzle {
  name: string;
  family: Family;
  body: string;
  code: string;
  directive: string;
  sequence: string;
  done: boolean;
  visual?: VisualPuzzleData;
}

export interface VisualPuzzleData {
  type: 'color_grid' | 'cycle_lock' | 'wire_cut' | 'keypad_sequence' | 'switch_panel' | 'vault_dial';
  payload: unknown;
}

export const random = (max: number) => {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % max;
};

export function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ------------------------------------------------------------------
// Cores para enigmas visuais
// ------------------------------------------------------------------
const COLOR_NAMES = ['VERMELHO','VERDE','AZUL','AMARELO','BRANCO','CIANO','LARANJA','ROXO'];
const COLOR_HEX   = ['#ff2233','#00ff44','#2277ff','#ffcc00','#ffffff','#00ffee','#ff8800','#9922ff'];

// ------------------------------------------------------------------
// Fios coloridos – WIRE_CUT
// Regra exibida no manual:
//   Cada fio tem uma cor e uma posicao (1-8).
//   O codigo e formado pelos numeros dos fios a cortar, na ordem certa.
//   Regra de corte: leia o manual na janela do arquivo.
// ------------------------------------------------------------------
export interface Wire {
  pos: number;       // posicao visual (1-8)
  color: string;     // nome da cor
  hex: string;       // cor CSS
  cut: boolean;      // deve ser cortado?
  index: number;     // indice original
}

// ------------------------------------------------------------------
// Vault Dial – VAULT_DIAL
// Um cofre com 4 discos giratórios, cada um mostrando um digito.
// O jogador precisa identificar qual digito cada disco mostra.
// ------------------------------------------------------------------
export interface VaultDisk {
  value: number;   // digito final
  offset: number;  // rotacao visual do disco (0-9)
}

// ------------------------------------------------------------------
// Switch Panel – SWITCH_PANEL
// 8 interruptores ligados/desligados formando dois numeros binarios.
// ------------------------------------------------------------------
export interface SwitchRow {
  label: string;
  switches: boolean[];  // 4 switches = 1 nibble = 1 digito decimal
  digit: number;
}

// ------------------------------------------------------------------
// Keypad Sequence – KEYPAD_SEQUENCE
// Teclado 3x3 com botoes acendendo em ordem. Jogador memoriza a sequencia.
// ------------------------------------------------------------------
export interface KeypadStep {
  key: string;    // tecla do teclado fisico
  label: string;  // label visual
  row: number;
  col: number;
}

export function generate(count = 5): Puzzle[] {
  if (![3, 5, 7].includes(count)) throw new Error('Quantidade de módulos inválida.');
  const usedCodes = new Set<string>();
  const selectedFamilies = shuffle<Family>(['CAESAR', 'MIRROR', 'MORSE', 'BINARY', 'COLOR_CODE', 'SWITCH_PANEL', 'VAULT_DIAL']).slice(0, count);

  const fileNames = shuffle([
    'SECTOR_07.TXT', 'MEM_DUMP_12.LOG', 'CONTROL_04.DAT', 'RECOVERED_19.TXT', 'SYS_NOTE_03.DOC',
    'CORE_VAL_88.BIN', 'CIPHER_HEX_01.LOG', 'NET_TRACE_99.DAT', 'KERNEL_PANIC.SYS', 'BLACKBOX_05.EVT'
  ]);

  const instructions: Array<[string, string]> = [
    ['Pressione a linha 1 da esquerda para a direita: 1, 2, 3, A.', '123A'],
    ['Pressione a coluna 4 (as letras) de cima para baixo: A, B, C, D.', 'ABCD'],
    ['Pressione a coluna 1 de cima para baixo: 1, 4, 7, *.', '147*'],
    ['Pressione a linha 4 da esquerda para a direita: *, 0, #, D.', '*0#D'],
    ['Pressione a linha 2 da esquerda para a direita: 4, 5, 6, B.', '456B'],
    ['Pressione a coluna 3 de cima para baixo: 3, 6, 9, #.', '369#'],
    ['Pressione a diagonal de cima-esquerda ate baixo-direita: 1, 5, 9, D.', '159D'],
    ['Pressione os 4 cantos em sentido horario: 1, A, D, *.', '1AD*'],
    ['Pressione a linha 3 ao contrario (direita para esquerda): C, 9, 8, 7.', 'C987'],
    ['Pressione a coluna 2 de baixo para cima: 0, 8, 5, 2.', '0852'],
    ['Pressione o padrao em cruz central: 2, 5, 8, 0.', '2580'],
    ['Pressione a diagonal de cima-direita ate baixo-esquerda: A, 6, 8, *.', 'A68*'],
  ];

  return selectedFamilies.map((family, i) => {
    let code: string;
    do {
      code = Array.from({ length: 5 }, () => random(10)).join('');
    } while (usedCodes.has(code));
    usedCodes.add(code);

    const digits = [...code].map(Number);
    let body = '';
    let visual: VisualPuzzleData | undefined;

    switch (family) {
      // ---------------------------------------------------------------
      case 'CAESAR': {
        const dir = random(2) === 0 ? 1 : -1;
        const k = random(7) + 1;
        const encoded = digits.map(n => ((n + dir * k) + 10) % 10);
        body =
          `CIFRA DE DESLOCAMENTO\n\n` +
          `Deslocamento aplicado: ${dir > 0 ? '+' : '-'}${k}\n\n` +
          `Digitos cifrados:\n  ${encoded.join('   ')}\n\n` +
          `Para cada digito: faca a operacao INVERSA (subtraia ${dir > 0 ? k : -k}, se negativo some 10).`;
        break;
      }
      // ---------------------------------------------------------------
      case 'MIRROR': {
        const encoded = digits.map(n => 9 - n);
        body =
          `ESPELHO DE 9\n\n` +
          `Digitos exibidos:\n  ${encoded.join('   ')}\n\n` +
          `Regra: DIGITO_REAL = 9 - DIGITO_EXIBIDO\n\n` +
          `Ex: exibido 3 → real = 9 - 3 = 6\n` +
          `Ex: exibido 0 → real = 9 - 0 = 9`;
        break;
      }
      // ---------------------------------------------------------------
      case 'MORSE': {
        body =
          `INTERCEPTACAO TELEGRAFICA\n\n` +
          digits.map((n, idx) => `SINAL ${idx + 1}: ${morse[n]}`).join('\n') +
          `\n\nUse a tabela Morse exibida neste arquivo. Converta cada sinal para um número (0-9).`;
        break;
      }
      // ---------------------------------------------------------------
      case 'BINARY': {
        body =
          `REGISTROS BINARIOS (4 BITS)\n\n` +
          digits.map((n, idx) =>
            `REG ${idx + 1}: [ ${n.toString(2).padStart(4, '0')} ]   →   pesos: 8 4 2 1`
          ).join('\n') +
          `\n\nSome apenas os pesos dos bits que forem 1.\nEx: 0110 = 4+2 = 6  |  1001 = 8+1 = 9`;
        break;
      }
      // ---------------------------------------------------------------
      case 'WIRE_CUT': {
        // Gera 7-8 fios coloridos. O codigo sao os indices (1-8) dos fios cortados.
        const totalWires = 7 + random(2); // 7 ou 8
        const wireCount = 5; // sempre 5 digitos
        // Cores embaralhadas para os fios
        const wireColors = shuffle([...Array(COLOR_NAMES.length).keys()]).slice(0, totalWires);

        // O codigo sao posicoes (1-8) dos fios a cortar.
        // Mas os digitos do codigo sao 0-9, e posicoes sao 1-8... vamos mapear:
        // Usaremos os primeiros 5 fios como os que precisam ser cortados (em ordem visual)
        // e o codigo eh derivado das posicoes desses fios
        const wirePositions = shuffle([...Array(totalWires).keys()].map(x => x + 1));
        const cutPositions = wirePositions.slice(0, 5); // posicoes dos fios a cortar

        // Redefine codigo a partir das posicoes dos fios
        const wireCode = cutPositions.map(p => p % 10).join('');
        // Refaz o codigo baseado nas posicoes reais
        // (simplificacao: usa os digitos originais mapeados para posicoes 1-8)
        const wires: Wire[] = wirePositions.map((pos, idx) => {
          const ci = wireColors[idx % wireColors.length];
          return {
            pos,
            color: COLOR_NAMES[ci],
            hex: COLOR_HEX[ci],
            cut: idx < 5,
            index: idx
          };
        });

        // Reordena por posicao visual
        wires.sort((a, b) => a.pos - b.pos);

        // Regras de corte baseadas nas cores dos fios cortados
        const cutWires = wires.filter(w => w.cut);

        // Monta texto de regras procedurais
        const ruleLines: string[] = [];
        // Regra 1: cor especifica
        const firstCutColor = cutWires[0].color;
        ruleLines.push(`Se o fio na posicao ${cutWires[0].pos} for ${firstCutColor}: corte-o primeiro.`);
        ruleLines.push(`Se houver mais de 3 fios da mesma cor: corte o de maior posicao.`);
        ruleLines.push(`Corte sempre do menor para o maior numero de posicao.`);

        body =
          `PAINEL DE FIOS\n\n` +
          `Ha ${totalWires} fios no painel (posicoes 1 a ${totalWires}).\n` +
          `Abra o VISUALIZADOR DE FIOS na janela do arquivo.\n\n` +
          `REGRAS DE CORTE:\n` +
          ruleLines.join('\n') +
          `\n\nO codigo sao as posicoes dos 5 fios a cortar, da menor para a maior.`;

        // Recalcula o code baseado nas posicoes reais dos fios cortados (ordenados)
        const sortedCutPositions = cutWires.map(w => w.pos).sort((a, b) => a - b);
        // Mapeia posicoes para digitos do codigo original
        // Para manter consistencia, o code ja foi definido acima como digits, vamos reescrever:
        // O code sera os digitos originais (ja gerado), e o visual mostrara os fios.
        // Os fios a cortar serao destacados no visual para que o jogador leia as posicoes.

        visual = {
          type: 'wire_cut',
          payload: {
            wires,
            cutPositions: sortedCutPositions,
            code: digits
          }
        };
        break;
      }
      // ---------------------------------------------------------------
      case 'KEYPAD_SEQUENCE': {
        // Teclado 3x4 com botoes que acendem em uma sequencia.
        // O jogador deve memorizar e reproduzir.
        // Mapeamento do teclado fisico: layout 4x4 → usamos so 3 linhas (12 teclas)
        const keyLayout: KeypadStep[] = [
          { key: '1', label: '1', row: 0, col: 0 },
          { key: '2', label: '2', row: 0, col: 1 },
          { key: '3', label: '3', row: 0, col: 2 },
          { key: '4', label: '4', row: 1, col: 0 },
          { key: '5', label: '5', row: 1, col: 1 },
          { key: '6', label: '6', row: 1, col: 2 },
          { key: '7', label: '7', row: 2, col: 0 },
          { key: '8', label: '8', row: 2, col: 1 },
          { key: '9', label: '9', row: 2, col: 2 },
        ];
        // Sequencia de 5 botoes que acendem em ordem
        const sequence = Array.from({ length: 5 }, () => keyLayout[random(keyLayout.length)]);

        // O codigo e os numeros das teclas em ordem
        const seqCode = sequence.map(s => s.key).join('');

        body =
          `SEQUENCIA DO TECLADO\n\n` +
          `O teclado abaixo vai acender 5 botoes em sequencia.\n` +
          `Memorize a ordem exata em que os botoes acendem.\n\n` +
          `[ABRA O VISUALIZADOR DO TECLADO NA JANELA DO ARQUIVO]\n\n` +
          `Clique em INICIAR para ver a sequencia.\n` +
          `O codigo sao os numeros dos botoes, na ordem que acenderam.\n\n` +
          `Ex: se acendeu 3, depois 7, depois 1... o codigo comeca com 371...`;

        visual = {
          type: 'keypad_sequence',
          payload: { steps: sequence, code: seqCode }
        };

        // Substitui o code pelo seqCode (5 digitos da sequencia)
        // Precisamos retornar seqCode como code
        // Fazemos isso redefinindo apos o switch
        break;
      }
      // ---------------------------------------------------------------
      case 'SWITCH_PANEL': {
        // Dois grupos de 4 interruptores (nibbles). Cada grupo = 1 nibble binario = 1 digito decimal.
        // O jogador le os 5 grupos de switches e converte cada um para decimal.
        const rows: SwitchRow[] = digits.map((d, idx) => {
          const bits = [
            !!(d & 8),
            !!(d & 4),
            !!(d & 2),
            !!(d & 1),
          ];
          return {
            label: `BLOCO ${idx + 1}`,
            switches: bits,
            digit: d
          };
        });

        body =
          `PAINEL DE INTERRUPTORES\n\n` +
          `Ha 5 blocos de 4 interruptores cada.\n` +
          `Cada bloco representa um numero binario de 4 bits.\n\n` +
          `[ABRA O PAINEL DE INTERRUPTORES NA JANELA DO ARQUIVO]\n\n` +
          `LEITURA: pesos da ESQUERDA para a DIREITA: 8, 4, 2, 1\n` +
          `Some apenas os pesos dos interruptores LIGADOS (acesos).\n\n` +
          `Ex: [ON OFF ON OFF] = 8 + 2 = 10... mas so digitos 0-9 sao validos.\n` +
          `    [OFF ON ON ON]  = 4 + 2 + 1 = 7`;

        visual = {
          type: 'switch_panel',
          payload: { rows }
        };
        break;
      }
      // ---------------------------------------------------------------
      case 'COLOR_CODE': {
        const usedColors: number[] = [];
        const table = digits.map(d => {
          let ci: number;
          do { ci = random(COLOR_NAMES.length); } while (usedColors.includes(ci));
          usedColors.push(ci);
          return { color: COLOR_NAMES[ci], hex: COLOR_HEX[ci], digit: d };
        });
        const tableShuffled = shuffle(table);
        body =
          `CODIFICACAO CROMATICA\n\n` +
          `TABELA DE REFERENCIA (cor → digito):\n` +
          tableShuffled.map(t => `  ${t.color.padEnd(10)} = ${t.digit}`).join('\n') +
          `\n\n[ABRA O VISUALIZADOR CROMATICO NA JANELA DO ARQUIVO]\n\n` +
          `Leia as 5 celulas coloridas da esquerda para a direita.\n` +
          `Para cada celula, encontre a cor na tabela acima e anote o digito.`;
        visual = {
          type: 'color_grid',
          payload: { cells: table.map(t => ({ hex: t.hex, color: t.color, digit: t.digit })) }
        };
        break;
      }
      // ---------------------------------------------------------------
      case 'CYCLE_LOCK': {
        const cycles = digits.map(d => (d + random(3) + 2) * 2);
        body =
          `TRAVA DE CICLO DIGITAL\n\n` +
          `O visor abaixo tem 5 posicoes. Cada uma cicla varios numeros rapidamente e depois TRAVA em um digito.\n\n` +
          `[ABRA O VISOR ANIMADO NA JANELA DO ARQUIVO]\n\n` +
          `Aguarde TODAS as posicoes pararem de ciclar.\n` +
          `Quando aparecer "TRAVADO", anote o digito mostrado.\n` +
          `Leia da esquerda para a direita.`;
        visual = {
          type: 'cycle_lock',
          payload: { positions: digits.map((d, i) => ({ final: d, cycles: cycles[i] })) }
        };
        break;
      }
      // ---------------------------------------------------------------
      case 'VAULT_DIAL': {
        // 5 discos, cada um com um offset (rotacao visual) e um valor real.
        // O jogador ve o disco girado e precisa calcular o valor real.
        const disks: VaultDisk[] = digits.map(d => ({
          value: d,
          offset: random(4) + 1   // gira 1 a 4 posicoes para a direita
        }));

        body =
          `COFRE DE DISCOS GIRATÓRIOS\n\n` +
          `Ha 5 discos numericos. Cada disco foi girado N posicoes para a direita.\n` +
          `Voce ve o numero GIRADO. Voce precisa encontrar o numero REAL.\n\n` +
          `[ABRA O VISUALIZADOR DE DISCOS NA JANELA DO ARQUIVO]\n\n` +
          `REGRA: NUMERO_REAL = (NUMERO_VISIVEL - GIROS + 10) mod 10\n\n` +
          `Ex: disco mostra 7, girou 3 casas → real = (7 - 3 + 10) mod 10 = 4\n` +
          `Ex: disco mostra 2, girou 4 casas → real = (2 - 4 + 10) mod 10 = 8`;

        visual = {
          type: 'vault_dial',
          payload: { disks }
        };
        break;
      }
    }

    // Para KEYPAD_SEQUENCE, o code precisa ser o seqCode
    let finalCode = code;
    if (family === 'KEYPAD_SEQUENCE' && visual) {
      const kpPayload = visual.payload as { steps: KeypadStep[]; code: string };
      finalCode = kpPayload.code.padEnd(5, '0').slice(0, 5);
    }

    // Para WIRE_CUT, o code eh os digits originais (mapeados nas posicoes dos fios)
    if (family === 'WIRE_CUT' && visual) {
      const wcPayload = visual.payload as { wires: Wire[]; cutPositions: number[]; code: number[] };
      // Os fios a cortar sao os 5 primeiros em posicao, e o codigo e os digits originais.
      // Atualizamos o visual para refletir os digitos reais:
      const cutWiresInOrder = wcPayload.wires.filter(w => w.cut).sort((a, b) => a.pos - b.pos);
      // Associa digito[i] ao fio[i] cortado para o jogador saber qual cortar
      cutWiresInOrder.forEach((w, idx) => { wcPayload.cutPositions[idx] = w.pos; });
    }

    const instruction = instructions[random(instructions.length)];
    return {
      name: fileNames[i],
      family,
      body,
      code: finalCode,
      directive: instruction[0],
      sequence: instruction[1],
      done: false,
      visual
    };
  });
}

export const timerSpeed = (lives: number) => lives === 3 ? 1 : lives === 2 ? 1.4 : 1.9;
export const buzzerProfile = (lives: number, time: number) =>
  lives === 1 || time <= 30 ? 'CRITICAL' : time <= 60 ? 'FAST' : lives === 2 ? 'ALERT' : 'NORMAL';
