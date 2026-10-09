# Fazenda Boa

Jogo de fazenda aconchegante em pixel art, inspirado em Stardew Valley, feito para jogar **no navegador
do celular, em retrato, com uma mão**. Todos os sprites são desenhados por código (nenhum arquivo do
jogo original). Sem áudio nesta versão.

**Jogar:** https://mqzgames.github.io/FazendaBoa/

## Como jogar
- **Andar:** toque e arraste na metade esquerda inferior da tela (joystick invisível). Arrastar pouco anda, arrastar longe corre.
- **Ação:** botão redondo no canto inferior direito — o ícone muda conforme o alvo.
- **Hotbar:** toque num slot para selecionar; arraste para trocar; toque longo abre o inventário.
- **Desktop:** WASD/setas (Shift anda devagar), E ou Espaço = ação, 1–8 = hotbar.
- **Fazenda:** a ação escolhe a ferramenta certa sozinha (arar → plantar → regar → colher). Segure o botão
  e ande para regar/arar uma fileira inteira. Encha o regador na água. Durma na cama (dentro de casa).
- **Vender:** selecione um item e use a caixa de envio ao lado da casa — o dinheiro chega ao amanhecer.
- **Save:** automático ao dormir e ao sair. Menu (engrenagem) → Exportar/Importar save (código ou .json).
- **Debug:** toque 5 vezes no relógio (no dev ou com `?debug` na URL).

Dica: no iPhone, use *Compartilhar → Adicionar à Tela de Início* para tela cheia e mais segurança do save.

## Progresso por fases
- [x] Fase 0 — Arquitetura e plano técnico ([docs/PLANO_TECNICO.md](docs/PLANO_TECNICO.md))
- [x] Fase 1 — Fazenda com autotiling, personagem animado, joystick, câmera, colisão, HUD, desempenho e debug
- [x] Fase 2 — Agricultura, tempo, energia, dormir, save/exportar/importar
- [ ] Fase 3 — Caixa de envio, loja, inventário, mochila, baús
- [ ] Fase 4 — Árvores, mina, fornalha, carregar pedras
- [ ] Fase 5 — Crafting
- [ ] Fase 6 — Galinhas, vacas e construções
- [ ] Fase 7 — Pesca
- [ ] Fase 8 — Cavalo e ferreiro
- [ ] Fase 9 — Produtos artesanais
- [ ] Fase 10 — Funcionários
- [ ] Fase 11 — Casarão da Vila e estufa
- [ ] Fase 12 — Polimento gráfico, criação de personagem, pet, tutorial, configurações, PWA
- [ ] Fase 13 — Relacionamentos
- [ ] Fase 14 — Festivais

## Desenvolvimento
```bash
npm install
npm run dev       # http://localhost:5173
npm run host      # acessível pelo celular na mesma rede (use o IP local mostrado)
npm run build     # build de produção em dist/
npm run deploy    # build + publica no GitHub Pages (branch gh-pages)
```

Stack: Phaser 3.90 + TypeScript (strict) + Vite. Veja a arquitetura em [docs/PLANO_TECNICO.md](docs/PLANO_TECNICO.md).
