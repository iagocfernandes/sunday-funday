> Atualização de 24/09: impressão passou a ser 100% opcional. Quantidades e baralhos físicos abaixo são histórico de planejamento; não limitam o jogo digital. Ver `DIRECAO_VISUAL_APROVADA.md`.

# Materiais físicos — proposta para aprovação, 23/09/2026

Status: planejamento editorial e de quantidades. NÃO é arquivo final para impressão. Números e regras novos abaixo não estão aprovados nem implementados. Evento previsto para 27/09/2026.

Atualização do usuário: já existe gráfica escolhida e o prazo informado é HOJE, 23/09, às 18h. Ainda falta saber se é envio ou retirada e obter formato/gabarito. Moedas provavelmente serão peças amarelas do War: pequenas = 1, grandes = 5 ou 10. Recomendo grandes = 5, sujeito à confirmação e contagem das peças disponíveis. Retirar moedas da cotação de impressos. Base submetida para decisão: 178 cartas, incluindo 80 bananas e 40 poderes com estoque finito ainda a aprovar/implementar. Não considerar essa base aprovada por silêncio.

## Estado do aplicativo conferido nesta rodada

139 testes e build passaram novamente. O checkout mantém o mesmo diff da revisão anterior e só o commit inicial. As correções solicitadas na etapa 1 não aparecem aqui: readKey ainda migra fora do catch, renovação de lock não confere proprietário, setTeams aceita participantes incompletos, submitResults não valida formato/vencedor integralmente e ladrão permanece selecionável. Não há evidência local de conclusão; eventual execução em outra pasta/branch precisa ser localizada antes de duplicar trabalho.

## Kit recomendado

| Material | Quantidade para orçamento | Uso |
|---|---:|---|
| Sorte | 24, seis tipos com quatro cópias | Comprar uma carta ao cair na casa; revelar, registrar código, resolver e descartar |
| Azar | 24, seis tipos com quatro cópias | Mesmo fluxo; efeitos atingem quem comprou |
| Poderes | 40, dez de cada um dos quatro tipos | Estoque da loja/banco; guardar até a janela permitida |
| Bananas douradas | 40 para estimativa; até 80 para cobertura máxima do cenário abaixo | Uma carta representa uma banana; conservar à vista |
| Identidade + ajuda rápida | 10, frente com gorila/nome/símbolo e verso com regras | Identificar cada participante e consultar janelas de uso |

Base para cotação: 138 cartas (24 + 24 + 40 + 40 + 10). Com 80 bananas: 178. Opcional: seis cartas em branco identificadas como reserva, sem validade automática, levando a 144 ou 184 cartas. As cartas em branco não criam novos efeitos aceitos pelo app.

As quantidades de banana e poder ainda precisam de fechamento. Com oito rodadas, dez jogadores e no máximo uma compra de banana por turno, o teto é 80 bananas, desde que não sejam adicionadas outras fontes. Quarenta é estimativa, não garantia; não limitar compras por acabar papel. Escolher entre imprimir o teto ou incluir certificados de cinco bananas para troca no banco.

Para poderes, o app atual não tem estoque global: dez cópias por tipo NÃO garantem cobertura. Com dez participantes e limite de três itens, até trinta cópias de um único tipo podem estar nas mãos. Opções: (recomendação sujeita a aprovação) implementar estoque finito de dez por tipo e informar indisponibilidade; ou imprimir trinta por tipo para manter oferta atual sem restrição. Não imprimir dez assumindo que o software já limita estoque.

## Moedas

Preferência sugerida: fichas reutilizáveis, com valores 1, 5 e 10, visualmente distintos e número legível. Se a escolha for uma ficha por moeda, dimensionar pela quantidade total de moedas, não pelo número de participantes. Valores 5/10/15 sozinhos não servem: existem compras de 4 e 6, perdas de 3 e premiações de 3, 6 e 8.

Uma base para cotação de fichas de valores mistos seria 100 de valor 1, 60 de valor 5 e 40 de valor 10: duzentas peças, capacidade de oitocentas moedas. É uma estimativa a validar na simulação; não é teto de saldo do jogo. Trocas no banco não alteram saldo. Se optar por cartas de moeda, usar os mesmos valores e contar esse lote separadamente do baralho.

O app é o registro oficial; moedas, bananas e poderes físicos espelham esse registro. Um banqueiro entrega/recolhe após a confirmação no app e confere no fim da rodada. Isso acrescenta trabalho operacional e precisa ser testado com a rodada automática. Perder uma ficha não deve apagar saldo digital. Desfazer/importar exige reconciliar também os objetos físicos.

## Catálogo de sorte proposto — quatro cópias por linha

| Código | Título proposto | Texto funcional para a frente | Estado no app |
|---|---|---|---|
| S01 | Tesouro escondido | Receba 5 moedas do banco. | Efeito já existe; título atual é Cacho escondido |
| S02 | Proteção da selva | Receba 1 Escudo e guarde-o entre seus poderes. | Já existe; título atual é Casco de tartaruga |
| S03 | Presente escorregadio | Receba 1 Casca de banana e guarde-a entre seus poderes. | Já existe; título atual é Troca justa |
| S04 | Achado na trilha | Receba 3 moedas do banco. | Novo cadastro; efeito já suportado |
| S05 | Baú da selva | Receba 8 moedas do banco. | Novo cadastro; efeito já suportado |
| S06 | Energia de gorila | Receba 1 Dado duplo e guarde-o entre seus poderes. | Novo cadastro; efeito já suportado |

Rodapé comum: “SORTE · Resolva agora · Depois descarte”. Nas cartas que dão itens: “Inventário cheio: não recebe o item.” Essa é a regra atual, sem compensação em moedas. Se for adotado estoque finito, acrescentar “Sem estoque: não recebe o item”, ou aprovar outra regra e implementá-la antes de fechar o texto.

A carta de sorte não vira poder: S02 volta ao descarte e o banco entrega uma carta física de Escudo. Assim o baralho de sorte não vai desaparecendo nas mãos.

## Catálogo de azar proposto — quatro cópias por linha

| Código | Título proposto | Texto funcional para a frente | Estado no app |
|---|---|---|---|
| A01 | Pisou na casca | Devolva até 3 moedas ao banco. | Já existe |
| A02 | Volta por onde veio | Recue até 3 casas pelo caminho que percorreu. | Já existe |
| A04 | Pedágio da selva | Devolva até 2 moedas ao banco. | Novo cadastro; efeito já suportado |
| A05 | Mochila furada | Devolva até 5 moedas ao banco. | Novo cadastro; efeito já suportado |
| A06 | Passo em falso | Recue até 2 casas pelo caminho que percorreu. | Novo cadastro; efeito já suportado |
| A07 | Trilha errada | Recue até 5 casas pelo caminho que percorreu. | Novo cadastro; efeito já suportado |

Rodapé comum: “AZAR · Resolva agora · Depois descarte”. Perdas nunca tornam saldo negativo. Nos recuos: “Pare se não houver mais caminho anterior. Não ative as casas atravessadas nem a casa de destino.” Escudo e Reverse não evitam esses azares no modelo atual.

A03, Emboscada da selva, atualmente permite atacar outra pessoa quando se compra um azar. Proposta: não imprimir nem sortear A03 na edição física. Preservar identificação/compatibilidade para backups antigos; não reutilizar seu código com efeito diferente. A interação ofensiva fica no poder Casca.

## Poderes propostos — dez cópias por linha, sujeitos à regra de estoque

| Referência impressa | Nome | Momento | Texto funcional |
|---|---|---|---|
| P01 | Dado duplo | Antes do seu dado | Dobre o resultado do dado deste turno. Depois devolva esta carta ao banco. |
| P02 | Casca de banana | Antes do seu dado | Escolha outro gorila. Ele perde até 3 moedas. Pode usar Escudo ou Reverse. Depois devolva esta carta ao banco. |
| P03 | Escudo | Ao receber ataque elegível | Cancele o ataque recebido. Depois devolva esta carta ao banco. Não protege de casas negativas nem destas cartas de azar. |
| P04 | Reverse | Ao receber ataque reversível | Devolva o ataque ao atacante. Ele não pode defender nem devolver novamente. Depois devolva esta carta ao banco. |

P01–P04 são referências editoriais propostas: o aplicativo usa itemIds e seleção de inventário, não aceita esses códigos no campo de cartas de sorte/azar. Fazer o vínculo explícito no catálogo; não apresentar o código como funcional antes de implementar suporte, se necessário.

“Dado duplo” significa multiplicar um dado por dois, não rolar dois dados. Recomenda-se mostrar “Dado ×2” em destaque para eliminar ambiguidade.

Regra proposta para imprimir na ajuda: até três poderes guardados; no máximo um poder ativo antes do dado por turno; defesas quando o app oferecer; nenhum poder pode ser jogado em qualquer momento. A janela de cinco segundos inicia a escolha; uma vez aberta, a decisão não expira. Inventário e limite por turno são configuráveis hoje: precisam ser congelados para corresponder à ajuda impressa.

Não imprimir preços nas cartas de poderes: exibir na loja digital ou numa única tabela substituível. Hoje os preços de teste são 5 (Dado), 4 (Casca), 5 (Escudo) e 6 (Reverse).

## Outros materiais úteis

Identidade/ajuda combinadas evitam mais um baralho. Usar personagens genéricos onde não houver arte individual aprovada; não prometer dez retratos personalizados.

Separadores ou etiquetas: Sorte/Descarte, Azar/Descarte, Loja/Poderes e Banco. Podem ser impressos numa folha comum. Um guia A4 do anfitrião reúne resolução, registro, devolução e recuperação.

Cartas para Dixit e papéis de Cidade Dorme são kits separados, condicionados à escolha dessas provas; não estão incluídos nas quantidades acima. Time’s Up também pode precisar de cartas de palavras, se não usarem um jogo existente. Não misturar esses materiais com sorte/azar/poderes.

Não acrescentar missão secreta, bônus de pontuação final ou companheiro com habilidade nesta edição sem definir e testar regras. Esses materiais mudariam a competição, além da impressão.

## Fluxo físico e digital a fechar

Embaralhar sorte e azar separadamente; comprar do topo quando o app pedir; anfitrião digita o código, confere prévia e confirma uma vez. Revelar/descarregar somente após resolver. Quando um monte acabar, embaralhar seu descarte para recompor. Esse protocolo é físico; o app atual não controla ordem nem descarte dos montes.

Poderes vêm da loja ou de recompensas específicas, não de um monte aleatório. Comprar/ganhar no app precede receber a carta. Usar no app precede devolver ao estoque. Na proposta de estoque finito, restauração e Desfazer também restauram a disponibilidade e exigem reconciliação física.

Versos iguais dentro de cada família, sem nomes/códigos do efeito no verso. Diferenciar famílias por ícone e texto, além da cor: Sorte, Azar, Poder e Banana de ouro. Poderes têm o mesmo verso entre si. Definir se ficam abertos: proposta é inventário público, coerente com o aplicativo atual.

## Briefing técnico para cotação, ainda dependente do gabarito

Formato sugerido: 63 × 88 mm, frente e verso coloridos, papel opaco próximo de 300 g/m², cantos arredondados e acabamento fosco, se a gráfica conseguir entregar no prazo. Solicitar alternativa simples de corte reto caso o acabamento atrase. Não assumir disponibilidade de tamanho, material ou produção de múltiplas frentes num único lote.

Solicitar confirmação de: entrega até 26/09; quantidade total e variedade de frentes/versos; gabarito de corte/sangria/área segura; perfil de cor e PDF exigido; prova frente/verso e orçamento incluindo corte/acabamento. A sangria depende do produto e da gráfica — não fechar arquivo só por uma medida genérica. Referência consultada: https://sua.printi.com.br/central-de-ajuda-printi .

Preparar arte em camadas: ilustração sem texto, moldura por família e textos/códigos vetoriais. Imagens com resolução suficiente no tamanho final; conferir leitura em prova a 100%. Dourado pode ser representado em cor impressa; metalizado é acabamento separado a cotar, não requisito do jogo.

Arquivo de controle deve listar código, versão, quantidade, frente e verso correspondente. Entregar PDFs no formato solicitado, sem montar folhas por conta própria se a gráfica fizer imposição. Não enviar este documento como se fosse arte final.

## Próximas execuções

1. Confirmar onde a etapa 1 foi executada, ou concluí-la neste checkout. Estimativa anterior: 60–90 minutos; rever após localizar alterações.
2. Fechar moeda, catálogo, estoque de poderes e quantidade de bananas; obter gabarito e prazo. Conversa de decisão: 20–30 minutos; resposta da gráfica depende do fornecedor.
3. Atualizar catálogo do app e implementar somente as regras físicas aprovadas. Testar códigos, itens cheios, estoque se adotado, ataque/defesa, recarga e sincronização. Estimativa de 1–2 horas, aumentando se houver novas mecânicas.
4. Produzir layouts e prova de cada tipo antes de replicar cópias. Congelar textos após revisar contra o app. Estimativa de 2–4 horas com artes existentes; depende da quantidade de ilustrações novas.
5. Fechar PDFs, conferir quantidades/frentes/versos e encaminhar à gráfica após aprovação do conteúdo. Integrar tabuleiro em seguida e reservar ensaio físico de 45–60 minutos antes do evento.

Prioridade de prazo: resolver definições que bloqueiam a gráfica antes de acabamento adicional do livro. Este planejamento não enviou mensagem, não fez pedido e não gerou artes finais.
