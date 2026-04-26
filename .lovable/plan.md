## Problema

O login falha com "Invalid login credentials" porque **não existe nenhum utilizador** na base de dados (tabela `auth.users` está vazia). A conta `manobv511@gmail.com` não está registada, então não há password para validar.

O trigger `handle_new_user` já está configurado corretamente: assim que esse e-mail se registar, recebe automaticamente os papéis `admin` + `uploader` e `upload_status = 'approved'`. Só falta criar a conta.

## Solução

Oferecer dois caminhos — escolha um:

### Opção A (recomendada): Registar a conta pelo formulário
1. Abrir `/auth` → separador **Registar**
2. Inserir nome, e-mail `manobv511@gmail.com` e a password desejada (mín. 6 caracteres)
3. Confirmar o e-mail (clicar no link enviado para a caixa de entrada)
4. Voltar a `/auth` → **Entrar** com as mesmas credenciais
5. O trigger atribui admin automaticamente

Para evitar a etapa de confirmação por e-mail (mais rápido para testes), ativar **auto-confirm signups** nas definições de auth antes do registo.

### Opção B: Criar a conta admin diretamente via SQL (sem confirmação de e-mail)
Executar uma migração que:
1. Insere a conta em `auth.users` já confirmada, com a password definida pelo utilizador (via `crypt()` com bcrypt)
2. O trigger `handle_new_user` cria automaticamente o profile e atribui os papéis admin/uploader

Esta opção precisa que o utilizador me forneça a password desejada (não a mostro nem a guardo em logs).

## Detalhes técnicos

- A tabela `auth.users` está vazia → trigger nunca disparou para o admin
- Trigger `handle_new_user` já trata de: profile, role `user`, role `admin` (se e-mail = manobv511@gmail.com), role `uploader`, `upload_status = 'approved'`
- Migração da Opção B usaria `crypt(<password>, gen_salt('bf'))` e definiria `email_confirmed_at = now()`

## Pergunta

Qual opção prefere? Se for a B, qual password definir?
