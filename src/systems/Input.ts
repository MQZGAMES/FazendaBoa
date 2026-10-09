/** Estado de entrada compartilhado (joystick/botões escrevem, mundo lê). Zero alocações. */
export const input = {
  /** vetor de movimento analógico (-1..1), magnitude ≤ 1 */
  mx: 0,
  my: 0,
  /** magnitude bruta 0..1 do joystick */
  mag: 0,
  /** botão de ação */
  actionHeld: false,
  actionPressed: false,
  actionReleased: false,
  /** tempo segurando a ação (s) */
  actionHoldT: 0,
  /** última interação (para detectar jogador parado) */
  lastActive: 0,
  /** toque direto no mundo (coords do mundo) */
  tapX: 0,
  tapY: 0,
  tapPending: false,
  /** bloqueio de movimento (menus abertos) */
  locked: false,
};

export function consumeEdges(): void {
  input.actionPressed = false;
  input.actionReleased = false;
}
