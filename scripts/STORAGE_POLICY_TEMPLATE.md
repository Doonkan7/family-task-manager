# 📦 Storage Policy Template для bucket `task-proofs`

## 🚀 Быстрая настройка (копируйте и вставляйте)

### ⚡ Базовые политики (рекомендуемые)

```sql
-- 🔐 UPLOAD: Аутентифицированные пользователи могут загружать
CREATE POLICY "task_proofs_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'task-proofs' 
    AND auth.role() = 'authenticated'
  );

-- 👀 SELECT: Все могут просматривать (для родителей и детей)
CREATE POLICY "task_proofs_select" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'task-proofs');

-- ✏️ UPDATE: Владельцы могут обновлять метаданные
CREATE POLICY "task_proofs_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'task-proofs' AND auth.uid()::text = owner)
  WITH CHECK (bucket_id = 'task-proofs' AND auth.uid()::text = owner);

-- 🗑️ DELETE: Владельцы могут удалять свои файлы
CREATE POLICY "task_proofs_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'task-proofs' AND auth.uid()::text = owner);
```

## 🔒 Улучшенные политики (для повышенной безопасности)

### Вариант 1: Только семейный доступ

```sql
-- SELECT: Только члены семьи видят фото своих задач
CREATE POLICY "task_proofs_family_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'task-proofs' 
    AND EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.users u ON t.family_id = u.family_id
      WHERE u.id = auth.uid()
        AND t.proof_url LIKE '%' || objects.name || '%'
    )
  );
```

### Вариант 2: Структурированный доступ по папкам

```sql
-- UPLOAD: С проверкой структуры папок (family_id/task_id/filename)
CREATE POLICY "task_proofs_structured_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'task-proofs'
    AND auth.role() = 'authenticated'
    -- Проверяем что пользователь загружает в папку своей семьи
    AND split_part(name, '/', 1)::uuid IN (
      SELECT family_id::text FROM public.users WHERE id = auth.uid()
    )
  );
```

## 🛠️ Настройка bucket через SQL

```sql
-- Ограничение размера файлов (10MB)
UPDATE storage.buckets 
SET file_size_limit = 10485760 
WHERE id = 'task-proofs';

-- Только изображения
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
WHERE id = 'task-proofs';

-- Включить публичный доступ
UPDATE storage.buckets 
SET public = true 
WHERE id = 'task-proofs';
```

## 📋 Проверка настроек

```sql
-- Проверить bucket
SELECT id, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE id = 'task-proofs';

-- Проверить политики
SELECT policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%task_proofs%';
```

## 💻 Использование в JavaScript

```javascript
// Загрузка файла
const filePath = `${familyId}/${taskId}/${Date.now()}_${file.name}`
const { data, error } = await supabase.storage
  .from('task-proofs')
  .upload(filePath, file)

// Получение публичной ссылки
const { data: { publicUrl } } = supabase.storage
  .from('task-proofs')
  .getPublicUrl(filePath)

// Удаление файла
const { error } = await supabase.storage
  .from('task-proofs')
  .remove([filePath])
```

## 🚨 Устранение ошибок

### "new row violates RLS policy"
- Проверьте что пользователь аутентифицирован
- Убедитесь что bucket_id = 'task-proofs'

### "permission denied for table objects"
- Создайте политики SELECT/INSERT/UPDATE/DELETE
- Проверьте права доступа в Dashboard

### "bucket does not exist"
- Создайте bucket через Dashboard или SQL:
```sql
INSERT INTO storage.buckets (id, name, public) 
VALUES ('task-proofs', 'task-proofs', true);
```

## ✅ Готовые команды

**Создать все базовые политики одной командой:**
```sql
-- Скопируйте и выполните весь блок
\i scripts/storage_policies_task_proofs.sql
```
