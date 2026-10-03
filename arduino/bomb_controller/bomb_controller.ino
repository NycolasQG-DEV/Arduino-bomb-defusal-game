// Arduino Uno: controlador de um dispositivo exclusivamente cenográfico.
// Portas utilizadas: D3 a D10 para teclado, A0 a A2 para LEDs e A3 para buzzer.

// -------------------------------------------------------------------
// MAPEAMENTO UTILIZADO PELO FIRMWARE:
// D3, D4, D5, D6   -> Colunas 1, 2, 3, 4 do teclado (C1, C2, C3, C4)
// D7, D8, D9, D10  -> Linhas 1, 2, 3, 4 do teclado (R1, R2, R3, R4)
// A0               -> LED amarelo (LED_YELLOW)
// A1               -> LED verde (LED_GREEN)
// A2               -> LED vermelho (LED_RED)
// A3               -> Buzzer
// -------------------------------------------------------------------

const byte ROW_PINS[4] = {7, 8, 9, 10};
const byte COL_PINS[4] = {3, 4, 5, 6};

const byte LED_RED = A2;
const byte LED_YELLOW = A0;
const byte LED_GREEN = A1;
const byte BUZZER = A3;

// Matriz de teclas padrão 4x4 (Linhas x Colunas)
const char KEYS[4][4] = {
  {'1', '2', '3', 'A'},
  {'4', '5', '6', 'B'},
  {'7', '8', '9', 'C'},
  {'*', '0', '#', 'D'}
};

const unsigned long DEBOUNCE_MS = 35;
const unsigned int KEY_BEEP_HZ = 1600;
const unsigned long KEY_BEEP_MS = 55;
enum Mode { IDLE, RUNNING, WON, LOST };
Mode mode = IDLE;
byte lives = 3;
unsigned long pulseInterval = 1800, lastPulse = 0, eventStart = 0, errorStart = 0;
bool errorActive = false;
bool keyBeepActive = false;
unsigned long keyBeepStart = 0;
bool successActive = false;
unsigned long successStart = 0;
const unsigned int VICTORY_NOTES[] = {659, 784, 988, 1319, 988, 1319, 1568, 1319};
const unsigned int VICTORY_DURATIONS[] = {250, 250, 250, 250, 250, 250, 250, 750};
const byte VICTORY_NOTE_COUNT = sizeof(VICTORY_NOTES) / sizeof(VICTORY_NOTES[0]);
byte victoryNote = 0;
unsigned long victoryNoteStart = 0;
bool ledsDirty = true;  // flag: precisa atualizar LEDs
char serialBuffer[48];
byte serialLength = 0;
bool overflow = false;

char stable = 0;
char lastRawKey = 0;
unsigned long lastDebounceTime = 0;

void showLives() {
  digitalWrite(LED_GREEN, lives >= 3);
  digitalWrite(LED_YELLOW, lives >= 2);
  digitalWrite(LED_RED, lives >= 1);
}

void allLights(bool on) {
  digitalWrite(LED_GREEN, on);
  digitalWrite(LED_YELLOW, on);
  digitalWrite(LED_RED, on);
}

void command(const char* line) {
  if (strcmp(line, "RESET") == 0) {
    mode = IDLE; lives = 3; pulseInterval = 1800; errorActive = false; keyBeepActive = false; successActive = false;
    stable = lastRawKey = 0; noTone(BUZZER); allLights(false); ledsDirty = true;
    Serial.println(F("ACK|RESET"));

  } else if (strcmp(line, "START") == 0) {
    // Inicia o jogo: 3 vidas, todos os LEDs acesos
    mode = RUNNING; lives = 3; lastPulse = millis() - pulseInterval;
    errorActive = false; successActive = false; keyBeepActive = false; ledsDirty = true;
    showLives();  // Verde + Amarelo + Vermelho acesos
    Serial.println(F("ACK|START"));

  } else if (strncmp(line, "LIVES|", 6) == 0 && strlen(line) == 7 && line[6] >= '0' && line[6] <= '3') {
    // Atualiza vidas e LEDs imediatamente:
    // 3 vidas = Verde + Amarelo + Vermelho
    // 2 vidas = Amarelo + Vermelho (Verde apagado)
    // 1 vida  = apenas Vermelho
    // 0 vidas = todos apagados (chama explode)
    byte newLives = line[6] - '0';
    if (newLives != lives) { lives = newLives; showLives(); }

  } else if (strcmp(line, "BUZZ|NORMAL") == 0)   pulseInterval = 1800;
  else if (strcmp(line, "BUZZ|ALERT") == 0)    pulseInterval = 1200;
  else if (strcmp(line, "BUZZ|FAST") == 0)     pulseInterval = 900;
  else if (strcmp(line, "BUZZ|CRITICAL") == 0) pulseInterval = 600;

  else if (strcmp(line, "EVENT|ERROR") == 0) {
    keyBeepActive = false;
    successActive = false;
    errorActive = true; errorStart = millis();

  } else if (strcmp(line, "EVENT|SUCCESS") == 0 && mode == RUNNING) {
    successActive = true; successStart = millis(); keyBeepActive = false;
    tone(BUZZER, 1319, 120);

  } else if (strcmp(line, "DEFUSED") == 0) {
    // Melodia e LEDs sincronizados, sem bloquear o teclado ou a serial.
    mode = WON; eventStart = millis(); errorActive = false; successActive = false; keyBeepActive = false;
    victoryNote = 0; victoryNoteStart = eventStart;
    tone(BUZZER, VICTORY_NOTES[0], VICTORY_DURATIONS[0] - 35);

  } else if (strcmp(line, "EXPLODE") == 0) {
    // DERROTA: apaga todos os LEDs, buzzer grave por 6 segundos
    mode = LOST; eventStart = millis(); errorActive = false; successActive = false; keyBeepActive = false;
    allLights(false);
    tone(BUZZER, 110);

  } else if (strcmp(line, "PING") == 0) Serial.println(F("PONG"));
}

void readSerial() {
  byte processed = 0;
  while (Serial.available() && processed++ < 64) {
    char c = Serial.read();
    if (c == '\n') {
      if (!overflow) { serialBuffer[serialLength] = 0; command(serialBuffer); }
      serialLength = 0; overflow = false;
    } else if (c != '\r') {
      if (serialLength < sizeof(serialBuffer) - 1) serialBuffer[serialLength++] = c;
      else overflow = true;
    }
  }
}

char scanKeypad() {
  char found = 0;
  byte count = 0;

  for (byte r = 0; r < 4; r++) {
    pinMode(ROW_PINS[r], OUTPUT);
    digitalWrite(ROW_PINS[r], LOW);
    delayMicroseconds(10);

    for (byte c = 0; c < 4; c++) {
      if (digitalRead(COL_PINS[c]) == LOW) {
        found = KEYS[r][c];
        count++;
      }
    }

    digitalWrite(ROW_PINS[r], LOW);
    pinMode(ROW_PINS[r], INPUT);
  }

  return (count == 1) ? found : 0;
}

void readKeypad(unsigned long now) {
  char rawKey = scanKeypad();

  if (rawKey != lastRawKey) {
    lastRawKey = rawKey;
    lastDebounceTime = now;
  }

  if ((now - lastDebounceTime) >= DEBOUNCE_MS) {
    if (rawKey != stable) {
      char previous = stable;
      stable = rawKey;
      if (stable != 0 && previous == 0) {
        if ((mode == IDLE || mode == RUNNING) && !errorActive) {
          keyBeepActive = true;
          keyBeepStart = now;
          tone(BUZZER, KEY_BEEP_HZ, KEY_BEEP_MS);
        }
        Serial.print(F("KEY|"));
        Serial.println(stable);
      }
    }
  }
}

void updateOutputs(unsigned long now) {

  // --- DERROTA: apaga tudo, buzzer grave, dura 6s ---
  if (mode == LOST) {
    if (now - eventStart >= 6000) {
      noTone(BUZZER);
      allLights(false);
      mode = IDLE;
    }
    // LEDs já foram apagados no comando EXPLODE
    return;
  }

  // --- VITÓRIA: melodia finita com os LEDs acompanhando cada nota ---
  if (mode == WON) {
    if (now - victoryNoteStart >= VICTORY_DURATIONS[victoryNote]) {
      victoryNote++;
      if (victoryNote >= VICTORY_NOTE_COUNT) {
        noTone(BUZZER); allLights(false); mode = IDLE; return;
      }
      victoryNoteStart = now;
      tone(BUZZER, VICTORY_NOTES[victoryNote], VICTORY_DURATIONS[victoryNote] - 35);
    }
    bool on = (now - victoryNoteStart) < VICTORY_DURATIONS[victoryNote] - 35;
    digitalWrite(LED_RED, on && (victoryNote % 3 == 0 || victoryNote == VICTORY_NOTE_COUNT - 1));
    digitalWrite(LED_YELLOW, on && (victoryNote % 3 == 1 || victoryNote == VICTORY_NOTE_COUNT - 1));
    digitalWrite(LED_GREEN, on && (victoryNote % 3 == 2 || victoryNote == VICTORY_NOTE_COUNT - 1));
    return;
  }

  if (mode != RUNNING && mode != IDLE) return;

  // --- ERRO DE ENTRADA: pisca rápido 2x e toca buzzer agudo ---
  if (errorActive) {
    unsigned long elapsed = now - errorStart;
    if (elapsed < 120 || (elapsed >= 240 && elapsed < 360)) {
      tone(BUZZER, 190);
      allLights(false);
    } else {
      noTone(BUZZER);
      showLives();  // restaura LEDs de acordo com as vidas
    }
    if (elapsed >= 420) {
      errorActive = false;
      lastPulse = now;
      showLives();  // garante LEDs corretos ao sair do erro
    }
    return;
  }

  if (successActive) {
    unsigned long elapsed = now - successStart;
    allLights(elapsed < 140 || (elapsed >= 280 && elapsed < 420));
    if (elapsed >= 560) { successActive = false; showLives(); lastPulse = now; }
    return;
  }

  // O toque de tecla tem prioridade sobre o pulso periódico, sem bloquear a leitura.
  if (keyBeepActive) {
    if (now - keyBeepStart < KEY_BEEP_MS) return;
    keyBeepActive = false;
  }

  // --- RUNNNING normal: beep periódico do contador ---
  if (mode == RUNNING && now - lastPulse >= pulseInterval) {
    lastPulse = now;
    tone(BUZZER, 900, 65);
  }
}

void setup() {
  Serial.begin(115200);

  for (byte i = 0; i < 4; i++) {
    pinMode(ROW_PINS[i], INPUT);
    pinMode(COL_PINS[i], INPUT_PULLUP);
  }

  pinMode(LED_RED, OUTPUT);
  pinMode(LED_YELLOW, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(BUZZER, OUTPUT);

  showLives();
  Serial.println(F("READY|BOMB_V1"));
}

void loop() {
  unsigned long now = millis();
  readSerial();
  readKeypad(now);
  updateOutputs(now);
}
