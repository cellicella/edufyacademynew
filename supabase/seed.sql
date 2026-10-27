-- Edufy Academy - Supabase PostgreSQL Initial Seed Data
-- Seed: supabase/seed.sql

-- 1. Insert seed instructors and admin into profiles (with fixed UUIDs for referential integrity)
INSERT INTO public.profiles (id, email, full_name, avatar_url, role, headline, bio)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'sarah.chen@edufy.test', 'Dr. Sarah Chen', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80', 'instructor', 'Principal Software Architect & Lead Instructor', 'Former Google Staff Architect and author of enterprise React & TypeScript engineering courses with over 140,000 learners globally.'),
    ('a0000000-0000-0000-0000-000000000002', 'marcus.vance@edufy.test', 'Marcus Vance', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80', 'instructor', 'VP of Product Design, Ex-Stripe', 'Specializing in design systems, micro-interactions, Figma architectures, and high-conversion software UX.'),
    ('a0000000-0000-0000-0000-000000000003', 'elena.rostova@edufy.test', 'Elena Rostova', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=300&auto=format&fit=crop&q=80', 'instructor', 'Head of AI Research & Deep Learning Lead', 'Doctorate in Neural Networks from Stanford. 12+ years deploying production transformer and generative AI architectures.'),
    ('a0000000-0000-0000-0000-000000000004', 'admin@edufy.academy', 'Platform Administrator', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&auto=format&fit=crop&q=80', 'admin', 'Edufy Platform Governance Lead', 'Platform administration, course governance, and enterprise certification integrity.')
ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    headline = EXCLUDED.headline,
    bio = EXCLUDED.bio;

-- 2. Insert Courses
INSERT INTO public.courses (
    id, slug, title, subtitle, description, category, category_slug, level, language,
    price, original_price, rating, review_count, enrolled_count, duration_hours, total_lessons,
    thumbnail_url, banner_url, featured, bestseller, trending, instructor_id,
    learning_outcomes, prerequisites, is_published
)
VALUES
(
    'course-1',
    'modern-react-19-masterclass',
    'Modern React 19: Full-Stack Architecture, Server Actions & High Performance',
    'Master Concurrent Mode, Server Components, React Compiler, and advanced state architectures with TypeScript & Vite.',
    'A masterclass designed for developers who want to command modern React 19 production architecture. Learn concurrent features, Suspense patterns, Server Actions, resilient hydration, and state machines with real-world enterprise architectures.',
    'Web Development',
    'development',
    'Intermediate',
    'English',
    34.99,
    149.99,
    4.94,
    4280,
    38450,
    42.5,
    168,
    'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1600&auto=format&fit=crop&q=80',
    true,
    true,
    true,
    'a0000000-0000-0000-0000-000000000001',
    '["Architect production-grade React 19 applications using Server Components & Actions", "Master TypeScript types for complex components, generics, and compound patterns", "Build zero-layout-shift UIs with modern CSS and Tailwind v4", "Implement resilient authentication, caching layers, and optimistic mutations"]'::jsonb,
    '["Proficiency with JavaScript ES6+", "Basic knowledge of React component lifecycles", "Node.js and modern terminal tooling"]'::jsonb,
    true
),
(
    'course-2',
    'advanced-ui-ux-design-systems',
    'Advanced UI/UX Product Design Systems with Figma & Token Architecture',
    'Design consistent, scalable design systems from atomic foundations to interactive micro-prototypes and developer handoffs.',
    'Designed by leading Silicon Valley design engineers. This deep dive covers token structures, WCAG AAA accessibility, multi-brand theming, variable-driven Figma components, and automated code generation workflows.',
    'UI/UX Design',
    'design',
    'All Levels',
    'English',
    29.99,
    119.99,
    4.89,
    3150,
    29400,
    36.0,
    142,
    'https://images.unsplash.com/photo-1581291518655-9523c93269c4?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=1600&auto=format&fit=crop&q=80',
    true,
    false,
    true,
    'a0000000-0000-0000-0000-000000000002',
    '["Structure enterprise design token hierarchies for dark/light themes", "Construct responsive, bulletproof Figma component libraries using Auto Layout 5", "Conduct usability testing and translate findings into quantifiable UX heuristics", "Export design specifications directly to CSS variables and Tailwind themes"]'::jsonb,
    '["Basic familiarity with Figma interface", "Enthusiasm for aesthetic refinement and user psychology"]'::jsonb,
    true
),
(
    'course-3',
    'generative-ai-llm-engineering',
    'Generative AI & LLM Engineering: Agents, RAG Pipelines & Vector Databases',
    'Build production agents, Retrieval Augmented Generation pipelines with embeddings, LangChain, and high-performance vector stores.',
    'Step beyond prompt engineering into production AI engineering. Discover how to build autonomous agentic loops, fine-tune models, index millions of documents with hybrid vector search, and build observable LLM applications.',
    'Artificial Intelligence',
    'ai-data',
    'Advanced',
    'English',
    39.99,
    189.99,
    4.96,
    5890,
    46200,
    54.0,
    210,
    'https://images.unsplash.com/photo-1677442136019-21780efad99a?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=1600&auto=format&fit=crop&q=80',
    true,
    true,
    true,
    'a0000000-0000-0000-0000-000000000003',
    '["Deploy end-to-end RAG systems with rerankers and chunking strategies", "Implement multi-agent workflows using function calling and structured outputs", "Vector database indexing and semantic search at enterprise scale", "Evaluation benchmarks, hallucination mitigation, and cost telemetry"]'::jsonb,
    '["Intermediate Python or TypeScript skills", "Basic concepts of vector spaces and APIs"]'::jsonb,
    true
)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    price = EXCLUDED.price,
    thumbnail_url = EXCLUDED.thumbnail_url;

-- 3. Course Sections
INSERT INTO public.course_sections (id, course_id, title, section_order)
VALUES
    ('sec-1-1', 'course-1', '1. Modern React 19 Paradigm Shift & Architectural Foundations', 1),
    ('sec-1-2', 'course-1', '2. Server Components, Server Actions & Optimistic Hydration', 2),
    ('sec-1-3', 'course-1', '3. State Architecture & Custom Hook Design Patterns', 3),
    ('sec-2-1', 'course-2', '1. Design System Foundations & Atomic Design Heuristics', 1),
    ('sec-2-2', 'course-2', '2. Design Tokens, Theming & Accessibility Standards', 2),
    ('sec-3-1', 'course-3', '1. Foundation Models, Prompt Chaining & Structured Outputs', 1),
    ('sec-3-2', 'course-3', '2. Production RAG Architecture, Hybrid Search & Vector Indexing', 2)
ON CONFLICT (id) DO NOTHING;

-- 4. Lessons
INSERT INTO public.lessons (
    id, section_id, course_id, title, duration_minutes, type, video_url, is_free_preview, lesson_order
)
VALUES
    ('les-1-1', 'sec-1-1', 'course-1', 'Welcome to Edufy Academy React 19 Engineering', 12, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', true, 1),
    ('les-1-2', 'sec-1-1', 'course-1', 'Deep Dive: React Compiler vs Traditional Memoization', 24, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', true, 2),
    ('les-1-3', 'sec-1-1', 'course-1', 'Architectural Blueprint: Project Setup & Monorepo Structure', 18, 'article', null, false, 3),
    ('les-1-4', 'sec-1-2', 'course-1', 'Server Actions with Progressive Enhancement', 32, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', false, 1),
    ('les-1-5', 'sec-1-2', 'course-1', 'useActionState and useOptimistic in Practice', 28, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', false, 2),
    ('les-1-6', 'sec-1-3', 'course-1', 'Module Mastery Assessment: React 19 Core Engineering', 15, 'quiz', null, false, 1),
    
    ('les-2-1', 'sec-2-1', 'course-2', 'Principles of Enterprise UI Engineering', 15, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', true, 1),
    ('les-2-2', 'sec-2-2', 'course-2', 'Design Tokens in Action: Light, Dark & High Contrast Modes', 25, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', false, 1),
    
    ('les-3-1', 'sec-3-1', 'course-3', 'The Modern LLM Stack & Latency Tradeoffs', 22, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', true, 1),
    ('les-3-2', 'sec-3-2', 'course-3', 'Vector Embeddings, HNSW Indexing & Cosine Distance', 34, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', false, 1)
ON CONFLICT (id) DO NOTHING;

-- 5. Quizzes & Questions
INSERT INTO public.quizzes (id, course_id, lesson_id, title, description, passing_score_percentage, time_limit_minutes)
VALUES
    ('quiz-react-1', 'course-1', 'les-1-6', 'React 19 Architecture & Concurrency Certification Exam', 'Comprehensive evaluation of React 19 core mental models, Server Actions, Compiler dynamics, and Suspense patterns.', 80, 20)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.quiz_questions (id, quiz_id, question, options, correct_option_index, explanation, question_order)
VALUES
(
    'q-react-1',
    'quiz-react-1',
    'What primary architectural challenge does the React Compiler solve automatically?',
    '["Replaces JSX with raw virtual DOM strings", "Eliminates manual memoization (useMemo, useCallback) by computing fine-grained reactive dependencies at build time", "Bypasses the browser rendering engine entirely", "Converts client components into Web Workers"]'::jsonb,
    1,
    'The React Compiler analyzes code semantics and automatically memoizes component outputs and computed variables without manual hook wrappers.',
    1
),
(
    'q-react-2',
    'quiz-react-2',
    'How does Server Actions handle form submission when JavaScript has not yet loaded on the client?',
    '["The form cannot be submitted and stays disabled", "It falls back to a standard HTTP POST form submission to the server endpoint, preserving progressive enhancement", "It crashes with a hydration mismatch error", "It requires a full browser reload before submit is allowed"]'::jsonb,
    1,
    'React 19 Server Actions embrace progressive enhancement; standard HTML form POST occurs seamlessly even before JavaScript completes hydration.',
    2
),
(
    'q-react-3',
    'quiz-react-3',
    'Which React hook is designed for updating UI optimistically before an asynchronous action resolves?',
    '["useTransition", "useDeferredValue", "useOptimistic", "useId"]'::jsonb,
    2,
    'useOptimistic provides a temporary speculative state that displays immediately while an asynchronous Server Action is underway.',
    3
)
ON CONFLICT (id) DO NOTHING;

-- 6. Sample Verified Certificate
INSERT INTO public.certificates (
    certificate_code, user_id, course_id, student_name, course_title, instructor_name, issue_date, grade_percentage, verification_hash
)
VALUES
    ('EDFY-2026-REACT99', 'a0000000-0000-0000-0000-000000000001', 'course-1', 'Alex Jordan', 'Modern React 19: Full-Stack Architecture, Server Actions & High Performance', 'Dr. Sarah Chen', '2026-03-15', 96, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
ON CONFLICT (certificate_code) DO NOTHING;
