import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isValidSupabaseUrl = (() => {
  if (!supabaseUrl) return false;

  try {
    const url = new URL(supabaseUrl);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
})();

export const supabaseConfigured = Boolean(isValidSupabaseUrl && supabaseAnonKey);
export const supabaseConfigurationError = !supabaseUrl || !supabaseAnonKey
  ? 'O banco compartilhado ainda não foi configurado. Preencha as variáveis do arquivo .env e reinicie o servidor.'
  : !isValidSupabaseUrl
    ? 'A URL do Supabase é inválida. Use a Project URL completa, começando com https://.'
    : '';

export const supabase = supabaseConfigured
  ? createClient(supabaseUrl.trim(), supabaseAnonKey.trim())
  : null;
