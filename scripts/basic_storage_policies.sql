-- Базовые Storage политики для bucket task-proofs
-- Минимальные политики без проверки владельца

-- Удаляем старые политики
DROP POLICY IF EXISTS "task_proofs_upload_policy" ON storage.objects;
DROP POLICY IF EXISTS "task_proofs_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "task_proofs_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "task_proofs_delete_policy" ON storage.objects;

-- 1. Политика загрузки (INSERT) - любой авторизованный пользователь
CREATE POLICY "task_proofs_upload_policy" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-proofs');

-- 2. Политика просмотра (SELECT) - все могут просматривать
CREATE POLICY "task_proofs_select_policy" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'task-proofs');

-- 3. Политика обновления (UPDATE) - любой авторизованный
CREATE POLICY "task_proofs_update_policy" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'task-proofs')
  WITH CHECK (bucket_id = 'task-proofs');

-- 4. Политика удаления (DELETE) - любой авторизованный
CREATE POLICY "task_proofs_delete_policy" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'task-proofs');

-- Готово
SELECT 'BASIC_STORAGE_POLICIES_CREATED' as status;
