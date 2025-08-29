-- Простые Storage политики для bucket task-proofs
-- Только основные политики без дополнительных проверок

-- Удаляем старые политики
DROP POLICY IF EXISTS "task_proofs_upload_policy" ON storage.objects;
DROP POLICY IF EXISTS "task_proofs_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "task_proofs_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "task_proofs_delete_policy" ON storage.objects;

-- Создаем новые политики
CREATE POLICY "task_proofs_upload_policy" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'task-proofs' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "task_proofs_select_policy" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'task-proofs');

CREATE POLICY "task_proofs_update_policy" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'task-proofs' AND auth.uid() = owner::uuid)
  WITH CHECK (bucket_id = 'task-proofs' AND auth.uid() = owner::uuid);

CREATE POLICY "task_proofs_delete_policy" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'task-proofs' AND auth.uid() = owner::uuid);

-- Готово
SELECT 'SIMPLE_STORAGE_POLICIES_CREATED' as status;
