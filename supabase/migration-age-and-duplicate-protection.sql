BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.inscritos
    WHERE idade < 11 OR idade > 120
  ) THEN
    RAISE EXCEPTION 'Existem inscrições com idade fora do intervalo permitido (11 a 120). Revise esses registros antes de aplicar a migração.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.inscritos
    GROUP BY lower(regexp_replace(btrim(nome), '[[:space:]]+', ' ', 'g')), idade
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Existem inscrições repetidas por nome e idade. Revise esses registros antes de aplicar a migração.';
  END IF;
END
$$;

ALTER TABLE public.inscritos
  DROP CONSTRAINT IF EXISTS inscritos_idade_check;

ALTER TABLE public.inscritos
  DROP CONSTRAINT IF EXISTS inscritos_idade_min_check;

ALTER TABLE public.inscritos
  ADD CONSTRAINT inscritos_idade_min_check
  CHECK (idade BETWEEN 11 AND 120);

CREATE UNIQUE INDEX IF NOT EXISTS inscritos_nome_idade_normalized_unique_idx
  ON public.inscritos (
    (lower(regexp_replace(btrim(nome), '[[:space:]]+', ' ', 'g'))),
    idade
  );

COMMIT;
