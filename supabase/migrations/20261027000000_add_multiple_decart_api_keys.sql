ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS decart_api_keys text[] NOT NULL DEFAULT ARRAY[]::text[];

UPDATE public.settings
SET decart_api_keys = CASE
  WHEN decart_api_key IS NULL OR trim(decart_api_key) = '' THEN ARRAY[]::text[]
  ELSE ARRAY[trim(decart_api_key)]
END
WHERE decart_api_keys IS NULL OR array_length(decart_api_keys, 1) IS NULL;
