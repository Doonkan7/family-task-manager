# ⚡ Быстрая настройка родительской панели

## 🚀 5-минутная настройка

### ⚠️ Если есть ошибки с БД - используйте ЧИСТУЮ УСТАНОВКУ!

**При любых ошибках "column does not exist":**
1. **ЧИСТАЯ УСТАНОВКА** (удалит старые данные): `scripts/clean_install_database.sql`
2. **Всё в одном** - создаст ВСЮ схему БД сразу

### Шаг 1: ЧИСТАЯ установка БД (3 мин)
1. **Supabase Dashboard** → **SQL Editor**
2. Скопируйте `scripts/clean_install_database.sql`
3. **Run** ▶️ - создаст ВСЮ схему БД
4. ✅ **БД готова** - ParentDashboard сразу работает!

### Шаг 2: Storage bucket (1 мин)  
1. **Storage** → **Buckets** → **New bucket**
2. Name: `task-proofs`, Public: ✅
3. **SQL Editor** → скопируйте `scripts/storage_policies_task_proofs.sql`
4. **Run** ▶️ - создаст все политики автоматически

**🚨 Если ошибки:**
- `scripts/simple_storage_policies.sql` (с владельцем)
- `scripts/basic_storage_policies.sql` (без владельца)

**📋 Или вручную через Dashboard:**
- Upload: `auth.role() = 'authenticated'`
- Select: `bucket_id = 'task-proofs'`

## ✅ Готово за 4 минуты!

**Функционал доступен:**
- 👑 Кнопка "Управление" для родителей
- ➕ Создание задач
- ✅ Подтверждение выполнения  
- 📊 Статистика семьи

## 🚨 Возможные проблемы:

**"column does not exist"** → Используйте `scripts/clean_install_database.sql`

**"Доступ запрещен"** → Проверьте `role = 'parent'`

**Не видно детей** → Проверьте одинаковый `family_id`

**Ошибки Storage** → Создайте bucket `task-proofs`

**📚 Файлы документации:**
- `scripts/PARENT_DASHBOARD_SETUP.md` - Подробная настройка
- `scripts/STORAGE_POLICY_TEMPLATE.md` - Storage политики  
- `scripts/clean_install_database.sql` - Чистая установка БД
- `scripts/storage_policies_task_proofs.sql` - Автоматические Storage политики
