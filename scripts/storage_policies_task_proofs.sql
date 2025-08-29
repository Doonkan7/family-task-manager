-- Политики безопасности для Storage Bucket: task-proofs
-- Эти политики настраивают доступ к фото-доказательствам выполнения задач
-- 
-- ⚠️ ВАЖНО: Выполните этот скрипт ПОСЛЕ создания bucket 'task-proofs'

-- ========================================
-- ЭТАП 1: УДАЛЕНИЕ СУЩЕСТВУЮЩИХ ПОЛИТИК
-- ========================================

-- Удаляем старые политики если есть
DROP POLICY IF EXISTS "task_proofs_upload_policy" ON storage.objects;
DROP POLICY IF EXISTS "task_proofs_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "task_proofs_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "task_proofs_delete_policy" ON storage.objects;

-- Альтернативные названия политик (на случай если создавались раньше)
DROP POLICY IF EXISTS "task_proofs_upload" ON storage.objects;
DROP POLICY IF EXISTS "task_proofs_select" ON storage.objects;
DROP POLICY IF EXISTS "task_proofs_update" ON storage.objects;
DROP POLICY IF EXISTS "task_proofs_delete" ON storage.objects;

SELECT 'CLEANUP_COMPLETED' as status, 'Старые политики удалены' as message;

-- ========================================
-- ЭТАП 2: СОЗДАНИЕ ПОЛИТИК ДОСТУПА
-- ========================================

-- 2.1) Политика UPLOAD - Загрузка фото-доказательств
-- Разрешает аутентифицированным пользователям загружать файлы
CREATE POLICY "task_proofs_upload_policy" ON storage.objects
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    bucket_id = 'task-proofs' 
    AND auth.role() = 'authenticated'
  );

-- 2.2) Политика SELECT - Просмотр фото-доказательств  
-- Разрешает ВСЕМ просматривать загруженные фото (для родителей и детей)
CREATE POLICY "task_proofs_select_policy" ON storage.objects
  FOR SELECT 
  TO public
  USING (bucket_id = 'task-proofs');

-- 2.3) Политика UPDATE - Обновление метаданных файлов
-- Разрешает владельцам файлов обновлять метаданные
CREATE POLICY "task_proofs_update_policy" ON storage.objects
  FOR UPDATE 
  TO authenticated
  USING (
    bucket_id = 'task-proofs' 
    AND auth.uid() = owner::uuid
  )
  WITH CHECK (
    bucket_id = 'task-proofs' 
    AND auth.uid() = owner::uuid
  );

-- 2.4) Политика DELETE - Удаление файлов
-- Разрешает владельцам файлов удалять свои фото
CREATE POLICY "task_proofs_delete_policy" ON storage.objects
  FOR DELETE 
  TO authenticated
  USING (
    bucket_id = 'task-proofs' 
    AND auth.uid() = owner::uuid
  );

SELECT 'POLICIES_CREATED' as status, 'Политики Storage созданы' as message;

-- ========================================
-- ЭТАП 3: ПРОВЕРКА BUCKET И НАСТРОЕК
-- ========================================

-- Проверяем существование bucket
SELECT 'BUCKET_CHECK' as check_type,
       CASE 
         WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'task-proofs') 
         THEN 'Bucket task-proofs существует ✅'
         ELSE 'Bucket task-proofs НЕ НАЙДЕН ❌'
       END as status;

-- Проверяем настройки bucket
SELECT 'BUCKET_SETTINGS' as check_type,
       id as bucket_name,
       public as is_public,
       file_size_limit,
       allowed_mime_types
FROM storage.buckets 
WHERE id = 'task-proofs';

-- Проверяем созданные политики
SELECT 'STORAGE_POLICIES' as check_type,
       policyname,
       cmd as operation,
       CASE 
         WHEN qual IS NOT NULL THEN 'С условиями'
         ELSE 'Без условий'
       END as conditions
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%task_proofs%'
ORDER BY policyname;

SELECT 'STORAGE_SETUP_COMPLETED' as status, 
       'Storage политики для task-proofs настроены! 📦' as message;

-- ========================================
-- ДОПОЛНИТЕЛЬНЫЕ НАСТРОЙКИ (ОПЦИОНАЛЬНО)
-- ========================================

/*
ДОПОЛНИТЕЛЬНЫЕ ОПЦИИ для настройки bucket:

1. 📏 Ограничение размера файлов (например, 10MB):
UPDATE storage.buckets 
SET file_size_limit = 10485760 
WHERE id = 'task-proofs';

2. 🖼️ Ограничение типов файлов (только изображения):
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
WHERE id = 'task-proofs';

3. 🔐 Расширенная политика для семейного доступа:
-- Только члены семьи могут видеть фото своей семьи
CREATE POLICY "task_proofs_family_only" ON storage.objects
  FOR SELECT 
  TO authenticated
  USING (
    bucket_id = 'task-proofs' 
    AND EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.users u ON t.family_id = u.family_id
      WHERE u.id = auth.uid()
        AND t.proof_url LIKE '%' || objects.name || '%'
    )
  );

4. 🗂️ Организация файлов по папкам:
-- Структура: task-proofs/family_id/task_id/filename
-- Пример пути: task-proofs/123e4567-e89b-12d3-a456-426614174000/789e0123-e89b-12d3-a456-426614174001/proof.jpg

ИСПОЛЬЗОВАНИЕ В КОДЕ:

// Загрузка файла
const filePath = `${familyId}/${taskId}/${file.name}`
const { data, error } = await supabase.storage
  .from('task-proofs')
  .upload(filePath, file)

// Получение публичной ссылки
const { data: { publicUrl } } = supabase.storage
  .from('task-proofs')
  .getPublicUrl(filePath)
*/
