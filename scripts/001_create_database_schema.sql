-- =====================================================
-- Schema do Banco de Dados - Sistema de Disparo WhatsApp
-- =====================================================

-- 1. Perfis de usuários (referencia auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  company_name TEXT,
  plan TEXT DEFAULT 'free',
  max_sessions INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Sessões WhatsApp (números conectados)
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  session_name TEXT,
  is_connected BOOLEAN DEFAULT FALSE,
  qr_code TEXT,
  last_activity TIMESTAMPTZ,
  dispatch_count INTEGER DEFAULT 0,
  daily_dispatch_count INTEGER DEFAULT 0,
  last_dispatch_reset TIMESTAMPTZ DEFAULT NOW(),
  auth_state JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, phone_number)
);

-- 3. Contatos/Clientes importados
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  name TEXT,
  data JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  is_starred BOOLEAN DEFAULT FALSE,
  bank TEXT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, phone_number)
);

-- 4. Mensagens do chat (histórico)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id UUID REFERENCES whatsapp_sessions(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  wa_message_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Fila de disparos
CREATE TABLE IF NOT EXISTS dispatch_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES whatsapp_sessions(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  message_template TEXT NOT NULL,
  message_rendered TEXT,
  priority INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Logs de disparo
CREATE TABLE IF NOT EXISTS dispatch_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  queue_id UUID REFERENCES dispatch_queue(id) ON DELETE SET NULL,
  session_phone TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_name TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Templates de mensagem
CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  category TEXT DEFAULT 'general',
  is_active BOOLEAN DEFAULT TRUE,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- 8. Configurações de disparo
CREATE TABLE IF NOT EXISTS dispatch_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  dispatches_per_number INTEGER DEFAULT 30,
  interval_minutes INTEGER DEFAULT 30,
  numbers_per_batch INTEGER DEFAULT 5,
  delay_min_seconds INTEGER DEFAULT 10,
  delay_max_seconds INTEGER DEFAULT 20,
  pause_after_messages INTEGER DEFAULT 5,
  pause_duration_minutes INTEGER DEFAULT 3,
  is_active BOOLEAN DEFAULT FALSE,
  current_session_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 9. Webhook logs para debug
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  source TEXT,
  processed BOOLEAN DEFAULT FALSE,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Índices para Performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_messages_user_contact ON messages(user_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_queue_status ON dispatch_queue(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_dispatch_queue_user ON dispatch_queue(user_id, status);
CREATE INDEX IF NOT EXISTS idx_contacts_user_status ON contacts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone_number);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON whatsapp_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_phone ON whatsapp_sessions(phone_number);
CREATE INDEX IF NOT EXISTS idx_dispatch_logs_user ON dispatch_logs(user_id, created_at DESC);

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_configs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS Policies
-- =====================================================

-- Profiles
DROP POLICY IF EXISTS "users_own_profile_select" ON profiles;
DROP POLICY IF EXISTS "users_own_profile_insert" ON profiles;
DROP POLICY IF EXISTS "users_own_profile_update" ON profiles;
DROP POLICY IF EXISTS "users_own_profile_delete" ON profiles;

CREATE POLICY "users_own_profile_select" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_own_profile_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users_own_profile_update" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "users_own_profile_delete" ON profiles FOR DELETE USING (auth.uid() = id);

-- WhatsApp Sessions
DROP POLICY IF EXISTS "users_own_sessions_select" ON whatsapp_sessions;
DROP POLICY IF EXISTS "users_own_sessions_insert" ON whatsapp_sessions;
DROP POLICY IF EXISTS "users_own_sessions_update" ON whatsapp_sessions;
DROP POLICY IF EXISTS "users_own_sessions_delete" ON whatsapp_sessions;

CREATE POLICY "users_own_sessions_select" ON whatsapp_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_own_sessions_insert" ON whatsapp_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_sessions_update" ON whatsapp_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_own_sessions_delete" ON whatsapp_sessions FOR DELETE USING (auth.uid() = user_id);

-- Contacts
DROP POLICY IF EXISTS "users_own_contacts_select" ON contacts;
DROP POLICY IF EXISTS "users_own_contacts_insert" ON contacts;
DROP POLICY IF EXISTS "users_own_contacts_update" ON contacts;
DROP POLICY IF EXISTS "users_own_contacts_delete" ON contacts;

CREATE POLICY "users_own_contacts_select" ON contacts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_own_contacts_insert" ON contacts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_contacts_update" ON contacts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_own_contacts_delete" ON contacts FOR DELETE USING (auth.uid() = user_id);

-- Messages
DROP POLICY IF EXISTS "users_own_messages_select" ON messages;
DROP POLICY IF EXISTS "users_own_messages_insert" ON messages;
DROP POLICY IF EXISTS "users_own_messages_update" ON messages;
DROP POLICY IF EXISTS "users_own_messages_delete" ON messages;

CREATE POLICY "users_own_messages_select" ON messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_own_messages_insert" ON messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_messages_update" ON messages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_own_messages_delete" ON messages FOR DELETE USING (auth.uid() = user_id);

-- Dispatch Queue
DROP POLICY IF EXISTS "users_own_queue_select" ON dispatch_queue;
DROP POLICY IF EXISTS "users_own_queue_insert" ON dispatch_queue;
DROP POLICY IF EXISTS "users_own_queue_update" ON dispatch_queue;
DROP POLICY IF EXISTS "users_own_queue_delete" ON dispatch_queue;

CREATE POLICY "users_own_queue_select" ON dispatch_queue FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_own_queue_insert" ON dispatch_queue FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_queue_update" ON dispatch_queue FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_own_queue_delete" ON dispatch_queue FOR DELETE USING (auth.uid() = user_id);

-- Dispatch Logs
DROP POLICY IF EXISTS "users_own_logs_select" ON dispatch_logs;
DROP POLICY IF EXISTS "users_own_logs_insert" ON dispatch_logs;

CREATE POLICY "users_own_logs_select" ON dispatch_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_own_logs_insert" ON dispatch_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Message Templates
DROP POLICY IF EXISTS "users_own_templates_select" ON message_templates;
DROP POLICY IF EXISTS "users_own_templates_insert" ON message_templates;
DROP POLICY IF EXISTS "users_own_templates_update" ON message_templates;
DROP POLICY IF EXISTS "users_own_templates_delete" ON message_templates;

CREATE POLICY "users_own_templates_select" ON message_templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_own_templates_insert" ON message_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_templates_update" ON message_templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_own_templates_delete" ON message_templates FOR DELETE USING (auth.uid() = user_id);

-- Dispatch Configs
DROP POLICY IF EXISTS "users_own_configs_select" ON dispatch_configs;
DROP POLICY IF EXISTS "users_own_configs_insert" ON dispatch_configs;
DROP POLICY IF EXISTS "users_own_configs_update" ON dispatch_configs;
DROP POLICY IF EXISTS "users_own_configs_delete" ON dispatch_configs;

CREATE POLICY "users_own_configs_select" ON dispatch_configs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_own_configs_insert" ON dispatch_configs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_configs_update" ON dispatch_configs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_own_configs_delete" ON dispatch_configs FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- Trigger: Criar perfil automaticamente no signup
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Criar config de disparo padrão
  INSERT INTO public.dispatch_configs (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- Trigger: Atualizar updated_at automaticamente
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
DROP TRIGGER IF EXISTS update_dispatch_configs_updated_at ON dispatch_configs;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dispatch_configs_updated_at
  BEFORE UPDATE ON dispatch_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Function: Resetar contadores diários de disparo
-- =====================================================

CREATE OR REPLACE FUNCTION reset_daily_dispatch_counts()
RETURNS void AS $$
BEGIN
  UPDATE whatsapp_sessions
  SET 
    daily_dispatch_count = 0,
    last_dispatch_reset = NOW()
  WHERE last_dispatch_reset < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Function: Obter próxima sessão para disparo (rotação)
-- =====================================================

CREATE OR REPLACE FUNCTION get_next_dispatch_session(p_user_id UUID, p_max_daily INTEGER DEFAULT 30)
RETURNS TABLE(
  session_id UUID,
  phone_number TEXT,
  daily_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ws.id,
    ws.phone_number,
    ws.daily_dispatch_count
  FROM whatsapp_sessions ws
  WHERE ws.user_id = p_user_id
    AND ws.is_connected = TRUE
    AND ws.daily_dispatch_count < p_max_daily
  ORDER BY ws.daily_dispatch_count ASC, ws.last_activity ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Realtime: Habilitar para mensagens
-- =====================================================

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE dispatch_queue;
