> Atualização posterior: a interface da TV/celular foi redesenhada e partidas novas usam 48 casas (v5). Consulte [Interface e 48 casas](INTERFACE_E_48_CASAS_2026-09-24.md). Salas anteriores preservam 36 casas.

# Teste com TV e celulares — 24/09/2026

## Abrir

TV: https://sunday-funday-three.vercel.app/?remote=tv
Criar sala NOVA, entrar pelo QR code em dois celulares e iniciar. Salas antigas preservam mapa/regras anteriores. Atualizar a página da TV se estava aberta antes da publicação.

## Implementado

Mapa v4 com fundo aprovado sem casas pintadas; 36 plataformas SVG em relevo: 1 início, 10 positivas, 6 negativas, 8 sorte, 8 azar, 3 duelo. Paradas entre casas com piso de 13 unidades de diâmetro contra 26 das casas; sem gasto de passo. Árvore do Alto na rota externa e Iagugu com cabana/bandeira na interna; quatro árvores e duas lojas. Banana/brilho em camada dinâmica.

+10 ao alcançar o Início em movimento normal para frente, inclusive ao terminar nele, uma vez por passagem. Sem bônus no spawn/recuo/troca. Colheita 20 moedas, uma por turno. Iagugu: uma ação por visita, moedas gratuitas (até 5, provisório para teste), banana por 50. Roubo transfere a banana entre jogadores, sem mudar a árvore ativa. Duelo: adversário sorteado, aposta limitada ao menor saldo, anfitrião registra vencedor/empate. Sem saldo: duelo amistoso de aposta zero, provisório para teste. Prova rápida combinada presencialmente. Rodada mantém sua prova normal depois de todos jogarem.

Sorte/Azar ainda usam catálogo mínimo de teste, aguardando Milena. Preços de poderes e economia ainda sem simulação completa após estas alterações. Teste do almoço não substitui o ensaio amplo de 8–10 participantes.

## Evidência

187 testes passaram (incluindo casos novos de volta, Iagugu, duelo, persistência, autorização e concorrência); build frontend/servidor aprovado. Integração local com API e banco reais: dois jogadores, dados/decisões pelos jogadores, WebSocket para TV, recarga, bloqueio de outro jogador, duplo clique, resultado presencial aplicado uma vez e avanço de rodada. Revisão visual da TV 1920×1080 e celular 390px; interação com Iagugu e aposta de duelo no celular. Capturas em output/mapa-v4-jogavel.png, output/tv-duelo-v4.png, output/celular-iagugu-v4.png.

Deploy dpl_DR3ShYSAnkymbhv73s5DsSgeaRUg, promovido e alias sunday-funday-three.vercel.app associado explicitamente. Alias entrega assets/index-lN-YXcrk.js contendo mapa v4 e imagem ilha-v4.png com HTTP 200. Verificação de rodada completa no ambiente publicado registrada ao fim deste documento após conclusão.

## Roteiro de teste do usuário

1. Conectar os dois celulares, jogar dados e escolher caminhos.
2. Visitar loja ou árvore e conferir os passos restantes ao continuar.
3. Experimentar Iagugu pela rota interna e duelo ao cair nas espadas.
4. Registrar resultados presenciais na TV e seguir mais uma rodada.

Alterações de arte foram feitas somente no fundo derivado; referências aprovadas originais foram preservadas. Sem commit automático; trabalho anterior do projeto preservado.

Verificação final em produção: `TEST_REMOTE_URL=https://sunday-funday-three.vercel.app node scripts/check-board.mjs` passou. Sala isolada SC7ADJ: dois jogadores, comandos pelo dono da vez, WebSocket para TV, recarga sem repetir dado, cliques concorrentes sem duplicar, rodada completa, resultado aplicado uma vez e rodada seguinte. Sala de QA não deve ser reutilizada pelo usuário; criar nova sala pelo fluxo normal.
