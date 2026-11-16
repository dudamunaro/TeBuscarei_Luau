# Configuração do Supabase

O servidor Express usa o PostgreSQL do Supabase para inscrições e o Supabase Auth para o login administrativo. As credenciais do banco e os tokens de sessão ficam no servidor; não configure uma chave `service_role` ou `secret` no navegador.

## 1. Criar e preparar o projeto

1. Crie um projeto no [Supabase](https://supabase.com/).
2. No **SQL Editor**, execute o conteúdo de [`supabase/schema.sql`](./supabase/schema.sql). A tabela fica protegida por RLS e sem acesso direto para os papéis `anon` e `authenticated`; as operações de dados passam pelo servidor Express.
3. Em **Authentication > Users**, convide/crie cada administrador com e-mail e senha.
4. Desative o cadastro público de usuários em **Authentication > Providers > Email**. Só os e-mails definidos em `ADMIN_EMAILS` poderão acessar o painel.

## 2. Configurar o servidor local

1. Copie `.env.example` para `.env`.
2. Em **Project Settings > API**, configure `SUPABASE_URL` e a chave pública `anon` (ou `publishable`) em `SUPABASE_ANON_KEY`.
3. Em **Project Settings > Database**, obtenha uma connection string PostgreSQL. Coloque-a em `DATABASE_URL`; substitua a senha e, se necessário, use a connection string do pooler indicada pelo Supabase.
4. Em `ADMIN_EMAILS`, informe os e-mails autorizados separados por vírgula.
5. Inicie o site com `npm start`.

Se a tabela já tiver sido criada com um esquema anterior, execute também [`supabase/migration-age-and-duplicate-protection.sql`](./supabase/migration-age-and-duplicate-protection.sql) no **SQL Editor** para exigir idade mínima de 11 anos e reforçar a prevenção de inscrições repetidas.

Não compartilhe nem publique o arquivo `.env`. Se a senha do banco tiver caracteres especiais, use a connection string fornecida pelo Supabase com a senha codificada corretamente.

## 3. Configurar o Render

No serviço do Render, adicione as variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DATABASE_URL` e `ADMIN_EMAILS` em **Environment**. Não as inclua no `render.yaml` nem no código. O cookie da sessão recebe o atributo `Secure` automaticamente em produção.

## 4. Login administrativo

O formulário aceita o usuário `Admin` (sem diferenciar maiúsculas de minúsculas) ou o e-mail autorizado. `Admin` representa o único e-mail configurado em `ADMIN_EMAILS`; a senha continua sendo a senha desse usuário no Supabase Auth. O servidor mantém os tokens em cookies `HttpOnly` e exige uma sessão válida para listar ou alterar inscrições. O navegador não guarda um indicador de login em `localStorage`.
