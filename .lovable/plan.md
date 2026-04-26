# Refinamentos visuais e de visualização de conteúdos

## 1. Formulário de envio (`src/routes/upload.tsx`)

- Adicionar borda destacada ao redor do `<Card>` principal: usar `border-2 border-primary/40 shadow-[var(--shadow-elegant)]`.
- Aplicar destaque aos inputs e selects do formulário (Título, Autor, Descrição, Categoria, PDF, Áudio, Imagens):
  - Adicionar classe utilitária comum: `border-2 border-primary/30 focus:border-primary focus:ring-2 focus:ring-primary/30 bg-background`.
  - Aplicar a `<Input>`, `<Textarea>` e `<SelectTrigger>`.
- Reforçar o `<Label>` com `font-semibold text-foreground` para melhor leitura.

## 2. Leitor de PDF inline (`src/routes/track.$id.tsx`)

- O PDF já é mostrado num `<iframe>`, mas o utilizador pode receber download direto em alguns navegadores móveis. Substituir por um leitor mais robusto:
  - Manter `<iframe>` no desktop com `#toolbar=1&view=FitH`.
  - Em ecrãs pequenos (mobile), embutir via `<object>` com fallback para um link "Abrir em nova aba". Isto evita que o iOS Safari force download.
- Acrescentar barra de controlo simples (zoom in/out via `transform: scale` num wrapper opcional — manter mínimo).

## 3. Leitor de áudio inline (`src/routes/track.$id.tsx`)

- Já existe `<audio controls>`. Melhorar:
  - Forçar `preload="metadata"` para iniciar mais rápido sem baixar o ficheiro inteiro.
  - Wrap num cartão com nome da peça e botão opcional de descarga separado (oculto por defeito).
  - Garantir `controlsList="nodownload"` para esconder o botão "guardar" do navegador.

## 4. Leitor de imagens (lightbox) (`src/routes/track.$id.tsx`)

- Atualmente as imagens são apenas miniaturas com link para o PNG/JPG (provoca download em alguns dispositivos).
- Implementar lightbox simples baseado em `<Dialog>` (shadcn) já existente:
  - Clicar numa miniatura abre modal full-screen com a imagem em `max-h-[90vh] object-contain`.
  - Setas "Anterior/Seguinte" para navegar entre imagens do mesmo conteúdo.
  - Tecla Esc fecha (já é nativo do Dialog).
  - Mostrar contador (ex.: "2 / 5").
- Sem dependências novas — usar componentes existentes (`Dialog`, `Button`, ícones `ChevronLeft/Right`).

## 5. Texto do autor

Em `src/routes/track.$id.tsx` (abaixo do título), substituir:
```
por <Link>{author}</Link>
```
por:
```
Arranjado pelo: <Link>{author}</Link>
```

Manter o link clicável que leva à página `/author/$name`.

## 6. Título da categoria maior

Em `src/routes/track.$id.tsx` e nos cartões da `library.tsx` / `author.$name.tsx`:
- O `<Badge>` da categoria é actualmente texto pequeno. Aumentar especificamente a categoria no topo de cada hino:
  - Em `track.$id.tsx`: trocar o `<Badge variant="secondary">` por um título destacado: `<h2 className="text-base sm:text-lg font-semibold text-primary uppercase tracking-wide mb-2">{categoryLabel(category)}</h2>`.
  - Nos cartões da biblioteca/autor: aumentar a Badge da categoria para `text-sm px-3 py-1`.

## Ficheiros a editar

- `src/routes/upload.tsx` — destaque do formulário e inputs.
- `src/routes/track.$id.tsx` — leitor PDF/áudio/imagens, texto "Arranjado pelo:", categoria maior.
- `src/routes/library.tsx` — categoria maior nos cartões.
- `src/routes/author.$name.tsx` — categoria maior nos cartões.

## Notas técnicas

- Sem novas dependências; usar shadcn/ui (Dialog, Button) e Tailwind.
- `controlsList="nodownload"` e atributo `download` removido para reforçar visualização inline.
- O lightbox respeita acessibilidade (DialogTitle oculto via `sr-only` se necessário).
