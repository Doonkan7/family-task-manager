# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

---

# Family Task Manager — Supabase Setup

Ниже — быстрые инструкции для настройки Supabase (функция-триггер и RLS политики), которые обеспечивают корректную регистрацию и управление семьями.

## 1) Применить SQL-скрипт

В проекте добавлен файл `scripts/supabase_policies.sql`. Он:

- создаёт безопасную функцию-триггер `public.handle_new_user()` для синхронизации `auth.users` → `public.users` без жёсткого проставления `family_id`;
- корректирует ограничения таблицы `public.users` (убирает `UNIQUE(email)` и допускает `NULL` в `family_id`);
- включает и создаёт минимально безопасные RLS‑политики для `public.families` и `public.users`;
- оставляет подсказки для триггеров на `auth.users`.

Как применить:

1. Откройте Supabase → SQL Editor.
2. Скопируйте содержимое файла `scripts/supabase_policies.sql` и выполните.
3. Убедитесь, что ошибок нет. Повторный запуск допустим (скрипт идемпотентен по максимуму).

## 2) Поток регистрации

- Регистрация выполняется только с email и паролем.
- После входа приложение создаёт/находит семью и обновляет `users.family_id` на стороне клиента (см. `src/App.jsx`, `ensureProfile`).
- Это устраняет RLS‑ошибки при signup и делает поток стабильным.

## 3) Запуск локально

```bash
npm install
npm run dev
```

Убедитесь, что `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` заданы в `.env`.

## 4) Полезные заметки

- Изменения в Supabase (функции/политики) не фиксируются автоматически в Git, поэтому SQL‑скрипт хранится в `scripts/` и документирован здесь.
- Если у вас включены pre-commit хуки, при необходимости используйте `--no-verify`.

