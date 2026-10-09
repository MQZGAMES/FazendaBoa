/** Estado compartilhado entre mundo e interface (lido por polling, sem eventos por quadro). */
export const uiState = {
  /** ícone do botão de ação contextual */
  actionIcon: 'icon_hand',
  /** ação disponível (botão aceso) */
  actionEnabled: true,
  /** algum painel aberto (bloqueia movimento) */
  panelOpen: false,
  debug: false,
  showCollision: false,
  /** contagem de objetos/sprites para debug */
  objCount: 0,
};
