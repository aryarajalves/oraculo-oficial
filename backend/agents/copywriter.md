# CONFIG — [NOME DO CLIENTE]
### Template de Calibração de Duplicata
> Copiar este arquivo para `clientes/[nome]/CONFIG.md` e preencher todos os campos.
> Este arquivo é a fonte de verdade de todos os 13 agentes para este cliente.


---


## IDENTIFICAÇÃO


```yaml
cliente:
  nome_completo: ""
  nome_curto: ""          # como os agentes vão se referir a ele internamente
  handle_principal: ""    # @handle do Instagram principal
  handle_escola: ""       # @handle da escola/produto, se houver
  metodo_proprio: ""      # nome do método proprietário, se houver
  missao: ""              # missão em 1 frase
```


---


## IDENTIDADE FUNDADORA


```yaml
ferida_fundadora: |
  [Descreva em 2-4 linhas: o padrão central que moldou a pessoa,
  o momento de virada, o que ela viu quando olhou para si mesma.]


transmutacao: |
  [Como a ferida foi transmutada em método/vocação.
  O método é autobiográfico? Descrever a jornada de cada elemento/fase.]


arquetipo: ""  # ex: "Iniciadora/Sábia", "Guerreiro/Profeta", "Mentor/Curador"


sonho_real: |
  [O sonho profundo — não o declarado, o real.
  O que ele/ela quer que não é o produto ou a missão.]
```


---


## AVATAR (alimenta o AG01 — Arqueólogo)


```yaml
avatar:
  perfil_demografico: ""    # idade, gênero, perfil geral
 
  dor_atual: |
    [Situação concreta — onde está agora]
 
  desejo_profundo_real: |
    [Não o declarado — o real, o que nunca admite em voz alta]
 
  frustracoes_acumuladas: |
    [O que já tentou e não funcionou — com exemplos específicos]
 
  camadas_de_dor:
    superficie: ""     # "Não consigo manter consistência"
    media: ""          # "Sei o que preciso fazer mas não faço"
    profunda: ""       # "Sinto que não mereço"
    nuclear: ""        # A que ele/ela nunca chega sozinha
 
  crenca_falsa_nuclear: |
    [A narrativa que conta para si mesmo para justificar o não-movimento]
 
  verdade_oculta: |
    [O que o conteúdo vai revelar — contradiz diretamente a crença falsa]
 
  raiva_coletiva: |
    [O sistema, instituição ou força responsável — nomeável com evidência]
 
  imagem_avatar: |
    [Uma frase que captura quem é essa pessoa de forma visceral.
    Ex: "Uma mulher de 30 anos que já foi em retiro e ainda chora às quartas-feiras sem saber por quê."]
```


---


## BIG IDEA (alimenta o AG02 — Arquiteto)


```yaml
big_idea: ""   # 1 frase — verificável, contraintuitiva, falsificável


big_idea_filtros:
  contraintuitiva: ""    # O que contradiz — e por quê
  verificavel: ""        # A evidência disponível
  muda_visao_de_mundo: "" # O antes e depois de ler isso
  desejo_profundo: ""    # Como conecta ao desejo real


lacuna_de_mercado: |
  [O que o mercado vende. O que o cliente vende que ninguém mais posiciona.
  Qual é o terceiro produto — o que está ausente na concorrência.]
```


---


## DNA DE VOZ (alimenta o AG07 — Destilador)


```yaml
voz:
  arquetipo: ""          # ex: "Iniciadora/Sábia"
  tom_central: ""        # 1 frase que captura o tom
 
  pilares:
    - nome: ""
      descricao: ""
    # repetir para cada pilar de voz
 
  mecanismo_de_hook:
    tipo_1:
      nome: ""           # ex: "Confronto-Espelho"
      descricao: ""
      exemplo: ""
    tipo_2:
      nome: ""
      descricao: ""
      exemplo: ""
    tipo_3:
      nome: ""
      descricao: ""
      exemplo: ""
 
  teste_de_voz: |
    [A frase de teste: "Uma pessoa X que Y — essa frase vai fazê-la sentir Z ou W?"]


vocabulario_nuclear:
  conceituais: []        # lista de palavras
  especificos: []        # palavras únicas do cliente (tokens)
  elementos: {}          # se houver sistema de elementos


vocabulario_proibido:
  rejeitado_pelo_cliente: []   # palavras que ele/ela explicitamente rejeita
  cliche_de_mercado: []        # virados para clichê no nicho
  linguagem_marketing: []      # linguagem de venda que contradiz a voz
  sintatico: []                # construções proibidas


regras_sintaticas:
  max_travessoes_por_slide: 1
  max_nao_e_x_e_y_por_slide: 2
  max_subordinadas_por_frase: 3
  paragrafo_max_linhas: 3
```


---


## DNA VISUAL (alimenta o AG10 — Curador)


```yaml
visual:
  paleta:
    primarias: []        # cores principais com nome e hex
    neutros: []
    acento: ""
 
  tipografia:
    estilo: ""           # ex: "Serifada clássica ou manuscrita"
    sensacao: ""         # ex: "Papiro, carta escrita à mão"
    proibido: ""         # ex: "Sans-serif limpa"
 
  elementos_permitidos: []    # o que pode aparecer nas imagens
  elementos_proibidos: []     # o que nunca aparece
 
  criterio_3_tempos:
    0_3s: ""             # sensação que deve gerar ao parar o scroll
    2s: ""               # o que deve revelar em 2 segundos
    5s: ""               # o que recompensa quem olha mais tempo
 
  prompt_base: |
    [Prompt-template para geração de imagens via gpt-image-2.
    Deve conter: estilo, paleta, elementos fixos, qualidade, anti-elementos.]
 
  referencias_visuais: []     # 3-5 referências de estilo visual


preset_visual_por_pilar: {}  # se houver mapeamento pilar → preset
```


---


## ESTRUTURA DE CONTEÚDO (alimenta AG04 — Maestro e AG05 — Escriba)


```yaml
curva_dramatica:
  arquetipo: ""         # ex: "Espelho/Descida/Iniciação" ou "Paradoxo/Confronto/Provocação"
 
  slides:
    s1:
      nome: ""          # ex: "ESPELHO"
      funcao: ""        # o que deve fazer
      sensacao_corporal: ""
    s2:
      nome: ""
      funcao: ""
      sensacao_corporal: ""
    # ... continuar até S10
 
  regras_criticas: []   # regras que nunca podem ser violadas na curva


pilares_de_conteudo:
  - pilar: ""
    territorio_narrativo: ""
    elemento_ancora: ""   # se houver sistema de elementos


temas_prioritarios: []  # 5-8 temas com maior potencial viral para este cliente
```


---


## REGRAS DO SISTEMA (alimenta todos os agentes)


```yaml
leis_inviolaveis:
  - ""   # máximo 5-7 leis que todos os agentes devem obedecer


lei_maxima: ""    # a lei mais importante — 1 frase


coerencia_vivida: |
  [Como verificar se o conteúdo é coerente com quem o cliente realmente é.
  O teste de coerência — o filtro final antes de qualquer publicação.]


gate_de_qualidade:
  score_minimo: 12    # score mínimo /15 para aprovação pelo Guardião
  criterios: []       # os 5 critérios específicos para este cliente
```


---


## PRODUTO E POSICIONAMENTO


```yaml
produto_core:
  nome: ""
  descricao_1_linha: ""
  o_que_nao_e: ""     # importante: o que ele explicitamente não é
  ticket: ""          # estimativa de faixa de preço


cta_padrao:
  palavra_chave: ""   # a palavra do "Comente X"
  formula: ""         # template do CTA completo
  o_que_nunca_usar: [] # linguagem proibida no CTA


distribuicao:
  contas: []          # lista de contas onde publica
  frequencia: ""      # ex: "3x por semana"
  horarios: []        # ex: ["09h", "13h", "20h"]
```


---


## DIFERENCIAL COMPETITIVO


```yaml
diferencial:
  vs_mercado: |
    [O que o mercado faz. O que o cliente faz diferente.
    Por que é impossível confundir um com o outro.]
 
  outros_clientes_sistema: []  # lista de outros clientes na plataforma
  # Importante: como garantir que as vozes não se contaminem
  teste_cruzado: |
    [Como verificar se um slide está soando como o cliente certo e não como outro]
```


---


## ONBOARDING — VALIDAÇÕES PENDENTES


```yaml
onboarding_status:
  formulario_recebido: false
  sessao_realizada: false
  ferida_fundadora_validada: false
  avatar_calibrado: false
  voz_testada_ao_vivo: false
  tokens_unicos_coletados: false
  visual_dna_confirmado: false
  primeiro_carrossel_aprovado: false


tokens_unicos: []
  # Frases e expressões espontâneas do cliente
  # que nenhum outro criador usa da mesma forma.
  # Coletados durante o onboarding — Módulo 4.
```
