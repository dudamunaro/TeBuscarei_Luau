require("dotenv").config();

const express = require("express");
const path = require("path");
const { Pool } = require("pg");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const cookieNames = {
  access: "luau-admin-access",
  refresh: "luau-admin-refresh"
};
const adminEmails = new Set(
  (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

let supabase;

function getSupabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    throw new Error("Supabase Auth is not configured.");
  }

  if (!supabase) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false
        }
      }
    );
  }

  return supabase;
}

function getCookie(req, name) {
  const cookie = (req.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  if (!cookie) {
    return "";
  }

  try {
    return decodeURIComponent(cookie.slice(name.length + 1));
  } catch {
    return "";
  }
}

function setAuthCookies(res, session) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const accessMaxAge = Math.max(0, Number(session.expires_in) || 3600);
  const refreshMaxAge = 30 * 24 * 60 * 60;

  res.append("Set-Cookie", `${cookieNames.access}=${encodeURIComponent(session.access_token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${accessMaxAge}${secure}`);
  res.append("Set-Cookie", `${cookieNames.refresh}=${encodeURIComponent(session.refresh_token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${refreshMaxAge}${secure}`);
}

function clearAuthCookies(res) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  Object.values(cookieNames).forEach((name) => {
    res.append("Set-Cookie", `${name}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`);
  });
}

function isAdmin(user) {
  return Boolean(user.email && adminEmails.has(user.email.toLowerCase()));
}

async function requireAdmin(req, res, next) {
  if (adminEmails.size === 0) {
    return res.status(503).json({
      erro: "O acesso administrativo ainda não foi configurado."
    });
  }

  try {
    const auth = getSupabase().auth;
    const accessToken = getCookie(req, cookieNames.access);
    const refreshToken = getCookie(req, cookieNames.refresh);
    let user = null;
    let authError = null;

    if (accessToken) {
      const result = await auth.getUser(accessToken);
      user = result.data.user;
      authError = result.error;
    }

    if (!user && refreshToken) {
      const result = await auth.refreshSession({ refresh_token: refreshToken });
      authError = result.error;

      if (result.data.session && result.data.user) {
        user = result.data.user;
        setAuthCookies(res, result.data.session);
      }
    }

    if (authError && (!authError.status || authError.status >= 500)) {
      console.error("Supabase Auth is temporarily unavailable:", authError.message);
      return res.status(503).json({
        erro: "Não foi possível validar a sessão agora. Tente novamente."
      });
    }

    if (!user) {
      clearAuthCookies(res);
      return res.status(401).json({ erro: "Acesso não autenticado." });
    }

    if (!isAdmin(user)) {
      clearAuthCookies(res);
      return res.status(403).json({ erro: "Acesso administrativo não autorizado." });
    }

    req.admin = { email: user.email };
    return next();
  } catch (error) {
    console.error("Admin authentication failed:", error.message);
    return res.status(503).json({
      erro: "Não foi possível validar a sessão agora. Verifique a configuração do Supabase."
    });
  }
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  if (
    req.method === "GET" &&
    (
      req.path === "/" ||
      req.path === "/inscricao" ||
      req.path === "/admin" ||
      req.path === "/dashboard" ||
      req.path.endsWith(".html")
    )
  ) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }

  next();
});

app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    supabaseConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    adminConfigured: adminEmails.size > 0
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

app.get("/inscricao", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "inscricao.html"));
});

app.post("/login", async (req, res) => {
  const identifier = String(req.body?.usuario || req.body?.email || "").trim();
  const senha = String(req.body?.senha || "");
  const email = identifier.includes("@")
    ? identifier.toLowerCase()
    : identifier.toLowerCase() === "admin" && adminEmails.size === 1
      ? adminEmails.values().next().value
      : "";

  if (adminEmails.size === 0) {
    return res.status(503).json({
      sucesso: false,
      mensagem: "Configure os e-mails administradores antes de habilitar o acesso."
    });
  }

  if (!identifier || !senha) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Informe o usuário e a senha."
    });
  }

  if (!email || !adminEmails.has(email)) {
    return res.status(401).json({
      sucesso: false,
      mensagem: "Usuário ou senha inválidos."
    });
  }

  let auth;
  try {
    auth = getSupabase().auth;
  } catch (error) {
    console.error("Supabase Auth configuration error:", error.message);
    return res.status(503).json({
      sucesso: false,
      mensagem: "Configure o Supabase para habilitar o acesso administrativo."
    });
  }

  try {
    const { data, error } = await auth.signInWithPassword({
      email,
      password: senha
    });

    if (error) {
      if (error.status === 400 || error.status === 401) {
        return res.status(401).json({
          sucesso: false,
          mensagem: "Usuário ou senha inválidos."
        });
      }

      console.error("Supabase login failed:", error.message);
      return res.status(503).json({
        sucesso: false,
        mensagem: "Não foi possível validar o acesso agora. Tente novamente."
      });
    }

    if (!data.session || !data.user || !isAdmin(data.user)) {
      return res.status(401).json({
        sucesso: false,
        mensagem: "Usuário ou senha inválidos."
      });
    }

    setAuthCookies(res, data.session);
    return res.json({ sucesso: true });
  } catch (error) {
    console.error("Supabase login request failed:", error.message);
    return res.status(503).json({
      sucesso: false,
      mensagem: "Não foi possível conectar ao Supabase agora. Tente novamente."
    });
  }
});

app.post("/logout", (req, res) => {
  clearAuthCookies(res);
  return res.json({ sucesso: true });
});

app.get("/admin/session", requireAdmin, (req, res) => {
  res.json({ autenticado: true, email: req.admin.email });
});

app.post("/inscricao", async (req, res) => {
  const {
    nome,
    idade,
    nome_responsavel,
    telefone_responsavel,
    telefone_participante,
    ja_fez_retiro,
    qual_retiro,
    restricao_saude,
    medicacao
  } = req.body || {};
  const nomeLimpo = String(nome || "").trim().replace(/\s+/g, " ");
  const idadeNumero = Number(idade);

  if (
    !nomeLimpo ||
    !Number.isInteger(idadeNumero) ||
    idadeNumero > 120
  ) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Informe um nome e uma idade válida para continuar."
    });
  }

  if (idadeNumero < 11) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "A inscrição é permitida somente para pessoas com 11 anos ou mais."
    });
  }

  try {
    const existente = await db.query(
      `SELECT id
       FROM inscritos
       WHERE LOWER(REGEXP_REPLACE(BTRIM(nome), '[[:space:]]+', ' ', 'g')) =
             LOWER(REGEXP_REPLACE(BTRIM($1), '[[:space:]]+', ' ', 'g'))
       AND idade = $2`,
      [nomeLimpo, idadeNumero]
    );

    if (existente.rows.length > 0) {
      return res.status(409).json({
        sucesso: false,
        mensagem: "Já existe uma inscrição semelhante para este participante. Verifique os dados antes de enviar novamente."
      });
    }

    const result = await db.query(
      `INSERT INTO inscritos (
        nome,
        idade,
        nome_responsavel,
        telefone_responsavel,
        telefone_participante,
        ja_fez_retiro,
        qual_retiro,
        restricao_saude,
        medicacao,
        status_pagamento
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pendente')
      RETURNING id`,
      [
        nomeLimpo,
        idadeNumero,
        nome_responsavel || null,
        telefone_responsavel || null,
        telefone_participante || null,
        ja_fez_retiro || null,
        qual_retiro || null,
        restricao_saude || null,
        medicacao || null
      ]
    );

    return res.json({
      sucesso: true,
      mensagem: "Inscrição realizada com sucesso!",
      id: result.rows[0].id
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        sucesso: false,
        mensagem: "Já existe uma inscrição semelhante para este participante."
      });
    }

    console.error("Failed to save registration:", error.message);
    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao salvar inscrição."
    });
  }
});

app.get("/admin/inscritos", requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM inscritos ORDER BY nome ASC"
    );
    const rows = result.rows;
    const normalizeAge = (value) => {
      const age = Number(value);
      return Number.isFinite(age) ? age : null;
    };

    res.json({
      todos: rows,
      faixa11a14: rows.filter((person) => {
        const age = normalizeAge(person.idade);
        return age !== null && age >= 11 && age <= 14;
      }),
      faixa15Mais: rows.filter((person) => {
        const age = normalizeAge(person.idade);
        return age !== null && age >= 15;
      })
    });
  } catch (error) {
    console.error("Failed to load registrations:", error.message);
    res.status(500).json({ erro: "Não foi possível carregar as inscrições." });
  }
});

app.put("/admin/pagar/:id", requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      "UPDATE inscritos SET status_pagamento = 'pago' WHERE id = $1 RETURNING id",
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ erro: "Inscrição não encontrada." });
    }

    return res.json({ mensagem: "Pagamento atualizado!" });
  } catch (error) {
    console.error("Failed to update payment:", error.message);
    return res.status(500).json({ erro: "Não foi possível atualizar o pagamento." });
  }
});

app.delete("/admin/inscritos/:id", requireAdmin, async (req, res) => {
  const id = String(req.params.id);

  if (!/^[1-9]\d*$/.test(id)) {
    return res.status(400).json({ erro: "Identificador de inscrição inválido." });
  }

  try {
    const result = await db.query(
      "DELETE FROM inscritos WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ erro: "Inscrição não encontrada." });
    }

    return res.json({ mensagem: "Inscrição apagada com sucesso." });
  } catch (error) {
    console.error("Failed to delete registration:", error.message);
    return res.status(500).json({ erro: "Não foi possível apagar a inscrição." });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
