# Fazenda Boa — Plano técnico (Fase 0)

Clone de Stardew Valley **mobile-first, retrato, navegador**, jogável com uma mão.
Stack: **Phaser 3.90** (WebGL com fallback Canvas) + **TypeScript strict** + **Vite**, publicado no GitHub Pages.

## Arquitetura

```
src/
  main.ts, config.ts, state.ts        jogo Phaser, constantes, estado global (G)
  scenes/   Boot (gera arte + barra), Title (benchmark 2 s), World (mapa atual), UI (overlay)
  systems/  Display, EventBus (tipado), Input, Time, Performance, Save (IndexedDB + export/import),
            Settings, Haptics, idb
  entities/ Player (…próximas fases: Horse, Pet, Cow, Chicken, Worker, NPC)
  world/    Location (dados), LocationView (render + culling), genFarm, locations (registro)
  ui/       Joystick, Hotbar, HUD (dinheiro, relógio, energia), Toast, DebugPanel, widgets
  art/      geradores procedurais: palette, pixel, atlas, font, terrain, nature, buildings,
            character, icons
  data/     items, objects (…crops, tools, animals, shops, fish, recipes…)
```

- **Uma única cena de mundo** ativa por vez (o mapa atual); ao trocar de mapa a cena é reiniciada.
  Os outros mapas ficam só como dados (`Location`) e são simulados em lote ao amanhecer.
- **Dados separados da renderização**: `Location` guarda terreno (`Uint8Array`), solo, objetos (`Map`),
  ocupação e colisão; `LocationView` cria tilemap e sprites só do que está na câmera (+ margem).
- **Event bus tipado** (`systems/EventBus.ts`) entre sistemas e UI; dados por quadro (ícone da ação,
  joystick) passam por objetos compartilhados lidos por *polling* (zero alocação).
- **Balanceamento em `data/`** — nada hardcoded na lógica.

## Arte 100% procedural
- `art/pixel.ts`: buffer `Uint32Array` com primitivas (linhas, elipses, moldes ASCII, contorno
  colorido automático, sombreamento).
- `art/atlas.ts`: empacotamento em prateleiras num atlas 2048 de largura, gerado aos poucos
  (barra de progresso fluida). O PNG resultante é **cacheado no IndexedDB** com versão (`ART_VERSION`).
- Terreno: **autotile de 47 tiles** (bitmask de 8 vizinhos reduzida) gerado a partir de um campo de
  distância até a borda, com cantos arredondados e bordas orgânicas. Tileset com extrusão de 1 px.
- Personagem 16x32 montado em camadas (pernas, tronco, braços, cabeça, cabelo) num "mapa de papéis";
  troca de pele/cabelo/roupa = troca de paleta. 6 penteados.
- Fonte pixel art proporcional com acentos do português (BitmapText).

## Desempenho (metas da seção 2)
- DPR limitado a 2; zoom inteiro do mundo (~9 tiles na largura).
- Culling de objetos com *pool* de sprites; água em TileSprite só no retângulo visível.
- Loop com limite de 60 fps; **30 fps** com menu aberto ou jogador parado 10 s; pausa total com aba oculta.
- `PerformanceSystem`: média de fps contínua; desce de nível após 3 s abaixo de 50 fps, sobe após 20 s acima de 58.
  Benchmark de 2 s na tela de título define o nível inicial.
- Medição: ~0,3 ms de CPU por quadro (update + render) na fazenda.

## Controles
Joystick invisível (metade esquerda, parte inferior), botão de ação contextual de 80 px,
hotbar de 8 slots (toque/arrastar/toque longo), botões secundários em arco, teclado no desktop
(WASD/setas, Shift anda, E/Espaço ação, 1–8 hotbar).

## Save
JSON versionado (`SAVE_SCHEMA` + migrações) no IndexedDB com backup automático; exportar como arquivo
`.json` ou código de texto comprimido (`CompressionStream`), importar com validação.

## Fases
Cada fase termina com uma versão jogável publicada em https://mqzgames.github.io/FazendaBoa/
