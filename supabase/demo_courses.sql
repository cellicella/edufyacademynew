-- ==============================================================================
-- Edufy Academy - 10 High-Quality Demo Courses Seed Script
-- File: supabase/demo_courses.sql
-- Compatible with: PostgreSQL 14+ / Supabase Database
-- Schema Migration: supabase/migrations/20261024000001_edufy_schema.sql
-- ==============================================================================
-- INSTRUCTIONS FOR EXECUTION:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard/project/<your-project-id>
-- 2. Navigate to "SQL Editor" on the left navigation bar.
-- 3. Click "New query", paste the entire contents of this file, and click "Run".
-- 4. To verify:
--    - Go to "Table Editor" -> "courses" table to see all 10 courses.
--    - Open your Edufy Academy web app to browse all courses live in the catalog.
--
-- SAFETY GUARANTEES:
-- - Uses "ON CONFLICT (id) DO NOTHING" on all tables (safe to run multiple times).
-- - Zero deletion, zero truncation, and zero modification of existing records.
-- - Respects foreign keys: dynamically links to existing instructor profiles in public.profiles.
--   If no instructor account exists yet, instructor_id remains NULL (fully allowed by schema).
-- - Zero fake students, zero dummy payments, zero mock enrollments, and zero fake reviews.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. INSERT 10 DEMO COURSES
-- ------------------------------------------------------------------------------
INSERT INTO public.courses (
    id, slug, title, subtitle, description,
    category, category_slug, level, language,
    price, original_price, rating, review_count, enrolled_count,
    duration_hours, total_lessons, thumbnail_url, banner_url,
    featured, bestseller, trending, instructor_id,
    learning_outcomes, prerequisites, is_published
)
VALUES
-- Course 1: Complete Web Development Bootcamp — ₹999
(
    'course-demo-01',
    'complete-web-development-bootcamp',
    'Complete Web Development Bootcamp: HTML, CSS, JavaScript, React & Node',
    'Become a confident full-stack web developer by building real-world projects from scratch with modern tooling.',
    'A comprehensive, beginner-friendly curriculum covering every facet of modern web engineering. From fundamental semantic HTML5 and responsive CSS Grid/Flexbox to reactive component architecture with React and scalable RESTful APIs with Node.js and Express. Learn industry standards, Git collaboration, and automated deployments.',
    'Web Development',
    'web-development',
    'Beginner',
    'English',
    999.00,
    3999.00,
    4.92,
    0,
    0,
    14.5,
    12,
    'https://images.unsplash.com/photo-1547658719-da2b51169166?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1600&auto=format&fit=crop&q=80',
    true,
    true,
    true,
    (SELECT id FROM public.profiles WHERE role = 'instructor' ORDER BY created_at ASC LIMIT 1 OFFSET 0),
    '[
        "Master modern HTML5 semantics, CSS3 Flexbox, Grid, and responsive layout systems",
        "Write clean, asynchronous JavaScript with ES6+ syntax, Promises, and DOM manipulation",
        "Build interactive single-page applications with React 19, hooks, and component state",
        "Develop scalable REST APIs with Node.js, Express, and PostgreSQL database storage",
        "Deploy production-ready web applications to cloud platforms with CI/CD workflows"
    ]'::jsonb,
    '[
        "No prior coding experience required; beginner-friendly step-by-step curriculum",
        "A computer (Windows, macOS, or Linux) with Google Chrome and VS Code installed",
        "[Demo Course] Full comprehensive curriculum curated for Edufy Academy learners"
    ]'::jsonb,
    true
),

-- Course 2: Full Stack MERN Development — ₹1,499
(
    'course-demo-02',
    'full-stack-mern-development',
    'Full Stack MERN Development: MongoDB, Express, React, Node & Next.js',
    'Architect production-grade MERN applications with authentication, state management, and cloud deployment.',
    'Deep-dive into production-grade full-stack architecture with the MERN stack. Learn schema design and indexing in MongoDB, resilient REST and GraphQL microservices with Express, state management with React Query and Redux Toolkit, JWT/session security, and Docker containerization.',
    'Web Development',
    'web-development',
    'Intermediate',
    'English',
    1499.00,
    4999.00,
    4.95,
    0,
    0,
    16.0,
    12,
    'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1600&auto=format&fit=crop&q=80',
    true,
    false,
    true,
    COALESCE(
        (SELECT id FROM public.profiles WHERE role = 'instructor' ORDER BY created_at ASC LIMIT 1 OFFSET 1),
        (SELECT id FROM public.profiles WHERE role = 'instructor' ORDER BY created_at ASC LIMIT 1 OFFSET 0)
    ),
    '[
        "Design robust schema models with MongoDB, Mongoose, and indexing strategies",
        "Construct secure RESTful APIs in Express with JWT authentication and middleware",
        "Manage client-side state using Redux Toolkit, React Query, and TypeScript",
        "Implement file uploads, image optimization, and third-party webhook integrations",
        "Deploy MERN stacks using Docker containers and cloud server environments"
    ]'::jsonb,
    '[
        "Basic understanding of JavaScript ES6 syntax and web fundamentals",
        "Familiarity with basic React components and npm package management",
        "[Demo Course] Full comprehensive curriculum curated for Edufy Academy learners"
    ]'::jsonb,
    true
),

-- Course 3: Artificial Intelligence & Generative AI — ₹1,299
(
    'course-demo-03',
    'artificial-intelligence-generative-ai',
    'Artificial Intelligence & Generative AI: LLMs, Prompting & Autonomous Agents',
    'Build next-generation AI applications using foundation models, vector embeddings, and LangChain pipelines.',
    'Explore the frontier of Generative AI engineering. Learn transformer architectures, multi-shot prompt engineering, Retrieval Augmented Generation (RAG) with vector databases, embedding spaces, and autonomous agent loops that interface with external APIs and databases.',
    'Artificial Intelligence',
    'ai-data-science',
    'All Levels',
    'English',
    1299.00,
    4499.00,
    4.96,
    0,
    0,
    15.0,
    12,
    'https://images.unsplash.com/photo-1677442136019-21780efad99a?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=1600&auto=format&fit=crop&q=80',
    true,
    true,
    true,
    COALESCE(
        (SELECT id FROM public.profiles WHERE role = 'instructor' ORDER BY created_at ASC LIMIT 1 OFFSET 2),
        (SELECT id FROM public.profiles WHERE role = 'instructor' ORDER BY created_at ASC LIMIT 1 OFFSET 0)
    ),
    '[
        "Understand transformer architectures, self-attention, and large language model capabilities",
        "Engineer advanced prompts with few-shot learning, chain-of-thought, and system framing",
        "Build Retrieval Augmented Generation (RAG) pipelines with vector search",
        "Develop autonomous multi-tool AI agents using modern LLM APIs",
        "Evaluate LLM outputs, reduce hallucinations, and monitor API costs"
    ]'::jsonb,
    '[
        "Curiosity about artificial intelligence and basic computer literacy",
        "Basic programming knowledge in Python or JavaScript is helpful but not mandatory",
        "[Demo Course] Full comprehensive curriculum curated for Edufy Academy learners"
    ]'::jsonb,
    true
),

-- Course 4: Python Programming Masterclass — ₹799
(
    'course-demo-04',
    'python-programming-masterclass',
    'Python Programming Masterclass: From Beginner to Professional',
    'Master Python 3 from zero: object-oriented programming, data structures, automation, and API scripting.',
    'The definitive guide to Python programming. Master core data structures, functional patterns, object-oriented software engineering, file handling, web scraping, and third-party API integration. Learn to write clean, idiomatic PEP 8 Python code used across data science, web backends, and DevOps.',
    'Web Development',
    'web-development',
    'Beginner',
    'English',
    799.00,
    2999.00,
    4.91,
    0,
    0,
    12.5,
    12,
    'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=1600&auto=format&fit=crop&q=80',
    false,
    true,
    false,
    (SELECT id FROM public.profiles WHERE role = 'instructor' ORDER BY created_at ASC LIMIT 1 OFFSET 0),
    '[
        "Write readable, idiomatic Python using standard PEP 8 conventions",
        "Apply Object-Oriented Programming (OOP) with inheritance, encapsulation, and polymorphism",
        "Automate repetitive file management, spreadsheet parsing, and web scraping tasks",
        "Handle complex exceptions, write unit tests, and manage virtual environments",
        "Interact with cloud APIs and create lightweight backend microservices"
    ]'::jsonb,
    '[
        "No programming background necessary",
        "A computer with any modern operating system capable of running Python 3",
        "[Demo Course] Full comprehensive curriculum curated for Edufy Academy learners"
    ]'::jsonb,
    true
),

-- Course 5: Digital Marketing Masterclass — ₹999
(
    'course-demo-05',
    'digital-marketing-masterclass',
    'Digital Marketing Masterclass: SEO, Performance Ads, Social & Analytics',
    'Drive customer acquisition and revenue growth with data-driven marketing funnels and ad strategies.',
    'Learn how modern brands generate millions in organic and paid digital revenue. Master technical SEO, Google Search & Performance Max ads, Meta (Facebook & Instagram) advertising, automated email sequences, and customer journey analytics using Google Analytics 4 (GA4).',
    'Business & Leadership',
    'business-leadership',
    'All Levels',
    'English',
    999.00,
    3499.00,
    4.88,
    0,
    0,
    13.0,
    12,
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?w=1600&auto=format&fit=crop&q=80',
    false,
    false,
    true,
    COALESCE(
        (SELECT id FROM public.profiles WHERE role = 'instructor' ORDER BY created_at ASC LIMIT 1 OFFSET 1),
        (SELECT id FROM public.profiles WHERE role = 'instructor' ORDER BY created_at ASC LIMIT 1 OFFSET 0)
    ),
    '[
        "Execute comprehensive on-page and technical Search Engine Optimization (SEO)",
        "Launch high-converting Google Ads and Meta campaign structures with budget efficiency",
        "Build automated email nurture sequences that convert cold traffic into buyers",
        "Measure ROI and customer lifetime value using Google Analytics 4 (GA4)",
        "Establish authentic social media brand narratives that drive viral reach"
    ]'::jsonb,
    '[
        "Basic internet browsing knowledge and willingness to learn marketing psychology",
        "No prior marketing degree required",
        "[Demo Course] Full comprehensive curriculum curated for Edufy Academy learners"
    ]'::jsonb,
    true
),

-- Course 6: Ethical Hacking Fundamentals — ₹1,499
(
    'course-demo-06',
    'ethical-hacking-fundamentals',
    'Ethical Hacking Fundamentals: Penetration Testing & Cybersecurity Defense',
    'Learn offensive security techniques, network vulnerabilities, and defensive counter-strategies.',
    'Build practical cybersecurity skills through hands-on penetration testing labs. Discover how ethical hackers assess vulnerabilities, perform network reconnaissance with Nmap and Wireshark, exploit OWASP Top 10 vulnerabilities (SQLi, XSS, CSRF), crack hashes, and write defensive security audits.',
    'Cybersecurity',
    'cybersecurity',
    'Intermediate',
    'English',
    1499.00,
    5499.00,
    4.94,
    0,
    0,
    18.0,
    12,
    'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1600&auto=format&fit=crop&q=80',
    true,
    false,
    true,
    COALESCE(
        (SELECT id FROM public.profiles WHERE role = 'instructor' ORDER BY created_at ASC LIMIT 1 OFFSET 2),
        (SELECT id FROM public.profiles WHERE role = 'instructor' ORDER BY created_at ASC LIMIT 1 OFFSET 0)
    ),
    '[
        "Set up isolated penetration testing virtual labs using Kali Linux and vulnerable machines",
        "Conduct passive and active network reconnaissance using Nmap, Wireshark, and OSINT",
        "Identify and exploit OWASP Top 10 web vulnerabilities including SQLi and XSS",
        "Understand wireless security protocols, encryption flaws, and password cracking ethics",
        "Draft actionable vulnerability assessment reports for security compliance"
    ]'::jsonb,
    '[
        "Fundamental understanding of TCP/IP networking concepts (IP, DNS, ports)",
        "Basic familiarity with Linux command-line terminal navigation",
        "[Demo Course] Full comprehensive curriculum curated for Edufy Academy learners"
    ]'::jsonb,
    true
),

-- Course 7: UI/UX Design with Figma — ₹899
(
    'course-demo-07',
    'ui-ux-design-with-figma',
    'UI/UX Design with Figma: Wireframing, Prototyping & Design Systems',
    'Create sleek, user-centric digital experiences with Figma variables, auto-layout, and interactive flows.',
    'Transform ideas into intuitive digital products. Master user research, wireframing, high-fidelity UI design, and interactive prototyping in Figma. Learn design systems, design tokens, Auto Layout 5, WCAG AAA accessibility standards, and seamless developer handoff protocols.',
    'UI/UX Design',
    'ui-ux-design',
    'All Levels',
    'English',
    899.00,
    3299.00,
    4.93,
    0,
    0,
    14.0,
    12,
    'https://images.unsplash.com/photo-1581291518655-9523c93269c4?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=1600&auto=format&fit=crop&q=80',
    true,
    true,
    false,
    COALESCE(
        (SELECT id FROM public.profiles WHERE role = 'instructor' ORDER BY created_at ASC LIMIT 1 OFFSET 1),
        (SELECT id FROM public.profiles WHERE role = 'instructor' ORDER BY created_at ASC LIMIT 1 OFFSET 0)
    ),
    '[
        "Conduct effective user interviews, synthesize empathy maps, and define UX personas",
        "Create low-fidelity wireframes that clearly communicate information architecture",
        "Master Figma Auto Layout, dynamic components, interactive variants, and variables",
        "Build cohesive design systems with typographic scales, tokens, and accessible palettes",
        "Prepare clean developer handoffs with annotated specs and asset exports"
    ]'::jsonb,
    '[
        "Free Figma account on web or desktop application",
        "Passion for visual design, digital product experiences, and problem-solving",
        "[Demo Course] Full comprehensive curriculum curated for Edufy Academy learners"
    ]'::jsonb,
    true
),

-- Course 8: Data Analytics with Excel and Power BI — ₹1,199
(
    'course-demo-08',
    'data-analytics-with-excel-power-bi',
    'Data Analytics with Excel and Power BI: Dashboards, DAX & Business Insights',
    'Transform raw spreadsheets into executive dashboards and actionable business intelligence.',
    'Master end-to-end data analytics for modern enterprise business intelligence. Learn data modeling, Power Query transformations, advanced Excel formulas (XLOOKUP, Dynamic Arrays), star schema database designs, and DAX calculations in Power BI to build interactive executive dashboards.',
    'Artificial Intelligence',
    'ai-data-science',
    'Beginner',
    'English',
    1199.00,
    4199.00,
    4.89,
    0,
    0,
    15.5,
    12,
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1600&auto=format&fit=crop&q=80',
    false,
    false,
    true,
    (SELECT id FROM public.profiles WHERE role = 'instructor' ORDER BY created_at ASC LIMIT 1 OFFSET 0),
    '[
        "Clean, reshape, and normalize untidy datasets using Excel Power Query",
        "Write advanced Excel functions (XLOOKUP, INDEX/MATCH, Dynamic Arrays, Nested Logic)",
        "Model multi-table star schema relationships and calculate metrics with Power BI DAX",
        "Design interactive visual dashboards with drill-downs, slicers, and KPI cards",
        "Communicate data findings effectively to non-technical business stakeholders"
    ]'::jsonb,
    '[
        "Basic computer skills and access to Microsoft Excel (2016 or newer / Office 365)",
        "Power BI Desktop (Free download on Windows or virtual machine)",
        "[Demo Course] Full comprehensive curriculum curated for Edufy Academy learners"
    ]'::jsonb,
    true
),

-- Course 9: WordPress Website Development — ₹699
(
    'course-demo-09',
    'wordpress-website-development',
    'WordPress Website Development: Build Custom Sites Without Coding',
    'Create responsive corporate websites, blogs, and WooCommerce e-commerce stores from scratch.',
    'Build professional, dynamic websites without writing a single line of code. Learn domain and hosting configuration, WordPress core architecture, modern block builders (Gutenberg and Elementor), e-commerce catalog setup with WooCommerce, payment gateway setup, and speed/security optimization.',
    'Web Development',
    'web-development',
    'Beginner',
    'English',
    699.00,
    2499.00,
    4.87,
    0,
    0,
    11.0,
    12,
    'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?w=1600&auto=format&fit=crop&q=80',
    false,
    false,
    false,
    COALESCE(
        (SELECT id FROM public.profiles WHERE role = 'instructor' ORDER BY created_at ASC LIMIT 1 OFFSET 1),
        (SELECT id FROM public.profiles WHERE role = 'instructor' ORDER BY created_at ASC LIMIT 1 OFFSET 0)
    ),
    '[
        "Set up domain names, DNS records, hosting servers, and SSL certificates",
        "Design dynamic web pages using Gutenberg block editor and Elementor page builder",
        "Configure WooCommerce stores with product catalogs, shopping carts, and payment gateways",
        "Implement essential WordPress security, caching, backup plugins, and speed optimization",
        "Maintain and migrate live WordPress installations with zero downtime"
    ]'::jsonb,
    '[
        "No programming or HTML/CSS knowledge required",
        "A computer with standard internet connection",
        "[Demo Course] Full comprehensive curriculum curated for Edufy Academy learners"
    ]'::jsonb,
    true
),

-- Course 10: Freelancing and Client Acquisition — ₹599
(
    'course-demo-10',
    'freelancing-and-client-acquisition',
    'Freelancing and Client Acquisition: Proposals, High-Ticket Pricing & Retention',
    'Turn your creative or technical skills into a thriving independent freelance business.',
    'A tactical roadmap for building a sustainable, high-income freelance career. Master niche positioning, irresistible portfolio presentation, inbound and outbound client outreach, proposal copywriting that wins deals on Upwork and LinkedIn, value-based pricing, and client retention contracts.',
    'Business & Leadership',
    'business-leadership',
    'All Levels',
    'English',
    599.00,
    2199.00,
    4.90,
    0,
    0,
    10.0,
    12,
    'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1600&auto=format&fit=crop&q=80',
    false,
    false,
    true,
    COALESCE(
        (SELECT id FROM public.profiles WHERE role = 'instructor' ORDER BY created_at ASC LIMIT 1 OFFSET 2),
        (SELECT id FROM public.profiles WHERE role = 'instructor' ORDER BY created_at ASC LIMIT 1 OFFSET 0)
    ),
    '[
        "Position yourself as an indispensable specialist rather than a commodity generalist",
        "Write winning proposals that stand out and get opened on Upwork, LinkedIn, and cold email",
        "Structure value-based pricing proposals instead of trading hours for low rates",
        "Draft client agreements, protect intellectual property, and guarantee timely payouts",
        "Develop recurring retainer contracts that create predictable monthly revenue"
    ]'::jsonb,
    '[
        "At least one marketable skill (coding, design, writing, marketing, video editing, etc.)",
        "Commitment to professional communication and reliability",
        "[Demo Course] Full comprehensive curriculum curated for Edufy Academy learners"
    ]'::jsonb,
    true
)
ON CONFLICT (id) DO NOTHING;


-- ------------------------------------------------------------------------------
-- 2. INSERT COURSE SECTIONS (4 sections per course = 40 sections)
-- ------------------------------------------------------------------------------
INSERT INTO public.course_sections (id, course_id, title, section_order)
VALUES
-- Course 1: Complete Web Development Bootcamp
('sec-demo-01-1', 'course-demo-01', '1. Modern HTML5 Semantics & Accessible Web Architecture', 1),
('sec-demo-01-2', 'course-demo-01', '2. CSS3 Foundations, Flexbox & Responsive Grid Layouts', 2),
('sec-demo-01-3', 'course-demo-01', '3. Modern JavaScript (ES6+), DOM & Asynchronous APIs', 3),
('sec-demo-01-4', 'course-demo-01', '4. Full-Stack Integration with React 19, Node.js & Cloud Deploy', 4),

-- Course 2: Full Stack MERN Development
('sec-demo-02-1', 'course-demo-02', '1. MERN Architecture & Express REST API Engineering', 1),
('sec-demo-02-2', 'course-demo-02', '2. Data Modeling & Relational Documents with MongoDB', 2),
('sec-demo-02-3', 'course-demo-02', '3. Client State Management with React, Redux & TypeScript', 3),
('sec-demo-02-4', 'course-demo-02', '4. Production Deployment, Docker & DevOps Automation', 4),

-- Course 3: Artificial Intelligence & Generative AI
('sec-demo-03-1', 'course-demo-03', '1. Foundations of Modern AI, Transformers & Large Language Models', 1),
('sec-demo-03-2', 'course-demo-03', '2. Advanced Prompt Engineering & Structured Outputs', 2),
('sec-demo-03-3', 'course-demo-03', '3. Retrieval-Augmented Generation (RAG) & Vector Databases', 3),
('sec-demo-03-4', 'course-demo-03', '4. Autonomous Multi-Tool Agents & Production LLMOps', 4),

-- Course 4: Python Programming Masterclass
('sec-demo-04-1', 'course-demo-04', '1. Python Syntax, Variables, Types & Control Flow', 1),
('sec-demo-04-2', 'course-demo-04', '2. Data Structures: Lists, Dictionaries, Tuples & Sets', 2),
('sec-demo-04-3', 'course-demo-04', '3. Object-Oriented Programming (OOP) & Modular Architecture', 3),
('sec-demo-04-4', 'course-demo-04', '4. Automation Scripting, Web Scraping & REST API Calls', 4),

-- Course 5: Digital Marketing Masterclass
('sec-demo-05-1', 'course-demo-05', '1. Digital Strategy & Audience Persona Definition', 1),
('sec-demo-05-2', 'course-demo-05', '2. Search Engine Optimization (SEO) & Content Strategy', 2),
('sec-demo-05-3', 'course-demo-05', '3. Paid Media Advertising: Google Ads & Meta Performance', 3),
('sec-demo-05-4', 'course-demo-05', '4. Conversion Rate Optimization, Email Automation & GA4', 4),

-- Course 6: Ethical Hacking Fundamentals
('sec-demo-06-1', 'course-demo-06', '1. Ethical Hacking Foundations & Isolated Lab Setup', 1),
('sec-demo-06-2', 'course-demo-06', '2. Network Reconnaissance, Port Scanning & Traffic Analysis', 2),
('sec-demo-06-3', 'course-demo-06', '3. Web Application Security & OWASP Top 10 Exploitation', 3),
('sec-demo-06-4', 'course-demo-06', '4. System Hardening, Remediation & Executive Audit Reports', 4),

-- Course 7: UI/UX Design with Figma
('sec-demo-07-1', 'course-demo-07', '1. User Research, Information Architecture & Empathy Mapping', 1),
('sec-demo-07-2', 'course-demo-07', '2. Figma Essentials: Frames, Shapes, Typography & Auto Layout', 2),
('sec-demo-07-3', 'course-demo-07', '3. Design Systems, Variables, Tokens & Reusable Components', 3),
('sec-demo-07-4', 'course-demo-07', '4. Interactive Micro-Prototyping & Developer Handoffs', 4),

-- Course 8: Data Analytics with Excel and Power BI
('sec-demo-08-1', 'course-demo-08', '1. Advanced Excel Analysis, Dynamic Formulas & Power Query', 1),
('sec-demo-08-2', 'course-demo-08', '2. Data Modeling & Relational Star Schemas in Power BI', 2),
('sec-demo-08-3', 'course-demo-08', '3. DAX Calculations: Calculated Columns, Measures & Time Intelligence', 3),
('sec-demo-08-4', 'course-demo-08', '4. Executive Dashboard Architecture, Visual Storytelling & KPI Cards', 4),

-- Course 9: WordPress Website Development
('sec-demo-09-1', 'course-demo-09', '1. WordPress Foundations, Hosting Configuration & Domain Setup', 1),
('sec-demo-09-2', 'course-demo-09', '2. Visual Page Building with Gutenberg Blocks & Elementor', 2),
('sec-demo-09-3', 'course-demo-09', '3. WooCommerce Setup, Product Catalogs & Checkout Gateways', 3),
('sec-demo-09-4', 'course-demo-09', '4. Performance Optimization, Caching & Security Hardening', 4),

-- Course 10: Freelancing and Client Acquisition
('sec-demo-10-1', 'course-demo-10', '1. Niche Positioning, Personal Branding & Service Packaging', 1),
('sec-demo-10-2', 'course-demo-10', '2. High-Converting Proposals, Inbound Funnels & Cold Outreach', 2),
('sec-demo-10-3', 'course-demo-10', '3. Value-Based Pricing, Scope Negotiation & Legal Contracts', 3),
('sec-demo-10-4', 'course-demo-10', '4. Client Onboarding, Smooth Project Delivery & Monthly Retainers', 4)
ON CONFLICT (id) DO NOTHING;


-- ------------------------------------------------------------------------------
-- 3. INSERT LESSONS (3 lessons per section = 12 lessons per course = 120 lessons)
-- ------------------------------------------------------------------------------
INSERT INTO public.lessons (
    id, section_id, course_id, title, duration_minutes, type,
    video_url, content_text, is_free_preview, lesson_order
)
VALUES
-- Course 1: Complete Web Development Bootcamp (12 lessons)
('les-demo-01-1-1', 'sec-demo-01-1', 'course-demo-01', 'Welcome to the Web Development Bootcamp & Development Environment Setup', 15, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', null, true, 1),
('les-demo-01-1-2', 'sec-demo-01-1', 'course-demo-01', 'Semantic HTML5 Elements, Document Outlines & Search Accessibility', 22, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', null, true, 2),
('les-demo-01-1-3', 'sec-demo-01-1', 'course-demo-01', 'Architecture Guide: Web Standards, Browser Rendering Engines & The DOM', 18, 'article', null, 'Learn how browser rendering engines parse HTML, build the DOM tree, compute CSSOM stylesheets, and execute script tags efficiently.', false, 3),

('les-demo-01-2-1', 'sec-demo-01-2', 'course-demo-01', 'CSS Box Model, Modern Selectors & Specificity Mastery', 25, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', null, false, 1),
('les-demo-01-2-2', 'sec-demo-01-2', 'course-demo-01', 'Mastering Flexbox Alignment, Nesting & Common UI Components', 30, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', null, false, 2),
('les-demo-01-2-3', 'sec-demo-01-2', 'course-demo-01', 'CSS Grid Systems: Creating Fluid 12-Column Responsive Layouts', 35, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', null, false, 3),

('les-demo-01-3-1', 'sec-demo-01-3', 'course-demo-01', 'JavaScript Variables, Scope, Arrow Functions & Array Methods', 35, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', null, false, 1),
('les-demo-01-3-2', 'sec-demo-01-3', 'course-demo-01', 'Event Handling, Dynamic DOM Manipulation & Form Validation', 40, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', null, false, 2),
('les-demo-01-3-3', 'sec-demo-01-3', 'course-demo-01', 'Asynchronous Programming: Fetch API, Promises & Async/Await', 45, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', null, false, 3),

('les-demo-01-4-1', 'sec-demo-01-4', 'course-demo-01', 'React 19 Foundations: Components, Props & Reusable State', 45, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', null, false, 1),
('les-demo-01-4-2', 'sec-demo-01-4', 'course-demo-01', 'Building Backend REST Endpoints with Node.js & Express', 50, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', null, false, 2),
('les-demo-01-4-3', 'sec-demo-01-4', 'course-demo-01', 'End-to-End Capstone Project: Full Stack Deployment to Production Cloud', 60, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', null, false, 3),

-- Course 2: Full Stack MERN Development (12 lessons)
('les-demo-02-1-1', 'sec-demo-02-1', 'course-demo-02', 'Architectural Overview of Enterprise MERN Stacks', 20, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', null, true, 1),
('les-demo-02-1-2', 'sec-demo-02-1', 'course-demo-02', 'Express REST API Design, Route Controllers & Error Middleware', 35, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', null, false, 2),
('les-demo-02-1-3', 'sec-demo-02-1', 'course-demo-02', 'JWT Authentication, Refresh Tokens & Password Hashing with Bcrypt', 40, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', null, false, 3),

('les-demo-02-2-1', 'sec-demo-02-2', 'course-demo-02', 'MongoDB Atlas Cluster Configuration & Connection Pooling', 25, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', null, false, 1),
('les-demo-02-2-2', 'sec-demo-02-2', 'course-demo-02', 'Mongoose Schemas, Relationships, Virtuals & Aggregation Pipelines', 45, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', null, false, 2),
('les-demo-02-2-3', 'sec-demo-02-2', 'course-demo-02', 'Database Performance: Indexes, Compounding & Query Execution Plans', 30, 'article', null, 'In-depth overview of indexing strategies in MongoDB to maintain sub-10ms query times at scale.', false, 3),

('les-demo-02-3-1', 'sec-demo-02-3', 'course-demo-02', 'TypeScript Configuration for Robust React Applications', 35, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', null, false, 1),
('les-demo-02-3-2', 'sec-demo-02-3', 'course-demo-02', 'Server State Synchronization with TanStack React Query', 40, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', null, false, 2),
('les-demo-02-3-3', 'sec-demo-02-3', 'course-demo-02', 'Global UI State Management Using Redux Toolkit & Custom Selectors', 45, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', null, false, 3),

('les-demo-02-4-1', 'sec-demo-02-4', 'course-demo-02', 'Containerizing Full-Stack Applications with Multi-Stage Dockerfiles', 40, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', null, false, 1),
('les-demo-02-4-2', 'sec-demo-02-4', 'course-demo-02', 'Setting Up Continuous Integration & Automated Linting via GitHub Actions', 35, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', null, false, 2),
('les-demo-02-4-3', 'sec-demo-02-4', 'course-demo-02', 'Cloud Deployment: Nginx Reverse Proxy, SSL Certificates & Domain Setup', 50, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', null, false, 3),

-- Course 3: Artificial Intelligence & Generative AI (12 lessons)
('les-demo-03-1-1', 'sec-demo-03-1', 'course-demo-03', 'Introduction to Generative AI, LLMs & Industry Landscape', 20, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', null, true, 1),
('les-demo-03-1-2', 'sec-demo-03-1', 'course-demo-03', 'Demystifying Transformers: Self-Attention Mechanisms & Tokenization', 30, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', null, false, 2),
('les-demo-03-1-3', 'sec-demo-03-1', 'course-demo-03', 'Foundation Models Compared: Open-Weight vs Commercial API Tradeoffs', 25, 'article', null, 'Comprehensive analysis of open-source models versus API endpoints regarding latency, cost, and fine-tuning control.', false, 3),

('les-demo-03-2-1', 'sec-demo-03-2', 'course-demo-03', 'System Instructions, Few-Shot Demonstrations & Output Control', 35, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', null, false, 1),
('les-demo-03-2-2', 'sec-demo-03-2', 'course-demo-03', 'JSON Schemas & Enforcing Deterministic Structured Outputs', 30, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', null, false, 2),
('les-demo-03-2-3', 'sec-demo-03-2', 'course-demo-03', 'Chain-of-Thought, ReAct Prompting & Defensive Guardrails', 35, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', null, false, 3),

('les-demo-03-3-1', 'sec-demo-03-3', 'course-demo-03', 'Embeddings Math: High-Dimensional Cosine Similarity & Dense Vectors', 35, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', null, false, 1),
('les-demo-03-3-2', 'sec-demo-03-3', 'course-demo-03', 'Document Ingestion: Semantic Chunking, Metadata Filtering & Reranking', 45, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', null, false, 2),
('les-demo-03-3-3', 'sec-demo-03-3', 'course-demo-03', 'Production RAG: Integrating Vector Databases with Real-Time Context', 50, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', null, false, 3),

('les-demo-03-4-1', 'sec-demo-03-4', 'course-demo-03', 'Function Calling & Granting Models Real-Time Web & Database Tools', 45, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', null, false, 1),
('les-demo-03-4-2', 'sec-demo-03-4', 'course-demo-03', 'Building Autonomous Multi-Step Reasoning Agents with LangGraph', 55, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', null, false, 2),
('les-demo-03-4-3', 'sec-demo-03-4', 'course-demo-03', 'Monitoring, Evaluation Benchmarks & Cost Telemetry in Production', 35, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', null, false, 3),

-- Course 4: Python Programming Masterclass (12 lessons)
('les-demo-04-1-1', 'sec-demo-04-1', 'course-demo-04', 'Installing Python 3, Visual Studio Code & The Interactive REPL', 15, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', null, true, 1),
('les-demo-04-1-2', 'sec-demo-04-1', 'course-demo-04', 'Variables, Primitive Types, String Interpolation & Mathematical Logic', 25, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', null, false, 2),
('les-demo-04-1-3', 'sec-demo-04-1', 'course-demo-04', 'Control Flow: Conditional Branching (if/elif/else) & Loop Structures', 30, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', null, false, 3),

('les-demo-04-2-1', 'sec-demo-04-2', 'course-demo-04', 'Python Lists: Slicing, Sorting, Indexing & List Comprehensions', 30, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', null, false, 1),
('les-demo-04-2-2', 'sec-demo-04-2', 'course-demo-04', 'Dictionaries, Hash Maps, Nested Data & Key Lookups', 35, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', null, false, 2),
('les-demo-04-2-3', 'sec-demo-04-2', 'course-demo-04', 'Tuples, Sets, Memory Immutability & Set Operations', 25, 'article', null, 'Discover why tuples and sets provide faster hashing performance and how immutability safeguards thread safety.', false, 3),

('les-demo-04-3-1', 'sec-demo-04-3', 'course-demo-04', 'Defining Functions, Default Arguments, *args, and **kwargs', 30, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', null, false, 1),
('les-demo-04-3-2', 'sec-demo-04-3', 'course-demo-04', 'Classes, Constructors (__init__), Self & Instance Methods', 40, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', null, false, 2),
('les-demo-04-3-3', 'sec-demo-04-3', 'course-demo-04', 'Inheritance, Dunder Methods & Clean Code Architecture', 35, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', null, false, 3),

('les-demo-04-4-1', 'sec-demo-04-4', 'course-demo-04', 'File Operations: Reading & Writing Text, CSV & JSON Datasets', 30, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', null, false, 1),
('les-demo-04-4-2', 'sec-demo-04-4', 'course-demo-04', 'Automating Web Data Extraction Using BeautifulSoup & Requests', 40, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', null, false, 2),
('les-demo-04-4-3', 'sec-demo-04-4', 'course-demo-04', 'Building a REST API Client Script with Authentication & Error Handling', 45, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', null, false, 3),

-- Course 5: Digital Marketing Masterclass (12 lessons)
('les-demo-05-1-1', 'sec-demo-05-1', 'course-demo-05', 'The Digital Marketing Ecosystem: Channels, Funnels & Unit Economics', 20, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', null, true, 1),
('les-demo-05-1-2', 'sec-demo-05-1', 'course-demo-05', 'Building Buyer Personas, Customer Journey Maps & Core Value Propositions', 30, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', null, false, 2),
('les-demo-05-1-3', 'sec-demo-05-1', 'course-demo-05', 'Marketing Strategy Framework: CAC, LTV, ROAS & Channel Prioritization', 25, 'article', null, 'A strategic guide to balancing Customer Acquisition Cost against Lifetime Value across digital channels.', false, 3),

('les-demo-05-2-1', 'sec-demo-05-2', 'course-demo-05', 'Keyword Research Strategies, Search Intent & Competitor Gap Analysis', 35, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', null, false, 1),
('les-demo-05-2-2', 'sec-demo-05-2', 'course-demo-05', 'On-Page SEO Optimization: Title Tags, Semantic Headings & Internal Linking', 30, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', null, false, 2),
('les-demo-05-2-3', 'sec-demo-05-2', 'course-demo-05', 'Technical SEO: Core Web Vitals, Crawlability, Sitemaps & Schema Markup', 35, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', null, false, 3),

('les-demo-05-3-1', 'sec-demo-05-3', 'course-demo-05', 'Meta Ads Manager: Campaign Objectives, Custom Audiences & Lookalikes', 40, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', null, false, 1),
('les-demo-05-3-2', 'sec-demo-05-3', 'course-demo-05', 'Google Search & Performance Max Campaigns: High-Intent Bidding Strategies', 45, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', null, false, 2),
('les-demo-05-3-3', 'sec-demo-05-3', 'course-demo-05', 'Creative Ad Copywriting & High-Converting Video Hook Frameworks', 35, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', null, false, 3),

('les-demo-05-4-1', 'sec-demo-05-4', 'course-demo-05', 'Landing Page Conversion Rate Optimization (CRO) & A/B Testing', 35, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', null, false, 1),
('les-demo-05-4-2', 'sec-demo-05-4', 'course-demo-05', 'Email Marketing Automation: Welcome Sequences, Abandoned Carts & Triggers', 40, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', null, false, 2),
('les-demo-05-4-3', 'sec-demo-05-4', 'course-demo-05', 'Google Analytics 4 (GA4): Conversion Events, Custom Funnels & Attribution', 45, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', null, false, 3),

-- Course 6: Ethical Hacking Fundamentals (12 lessons)
('les-demo-06-1-1', 'sec-demo-06-1', 'course-demo-06', 'Introduction to Ethical Hacking, Legal Ethics & Vulnerability Disclosures', 25, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', null, true, 1),
('les-demo-06-1-2', 'sec-demo-06-1', 'course-demo-06', 'Virtualization & Setting Up a Kali Linux Penetration Testing Lab', 40, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', null, false, 2),
('les-demo-06-1-3', 'sec-demo-06-1', 'course-demo-06', 'The Hacker Methodology: Reconnaissance, Scanning, Gaining Access & Reporting', 30, 'article', null, 'A detailed overview of the penetration testing phases and standard operating procedures.', false, 3),

('les-demo-06-2-1', 'sec-demo-06-2', 'course-demo-06', 'Passive Reconnaissance: OSINT Tools, Whois, DNS Enumeration & Shodan', 45, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', null, false, 1),
('les-demo-06-2-2', 'sec-demo-06-2', 'course-demo-06', 'Active Scanning with Nmap: Port Flags, Service Fingerprinting & NSE Scripts', 50, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', null, false, 2),
('les-demo-06-2-3', 'sec-demo-06-2', 'course-demo-06', 'Network Traffic Sniffing, Packet Inspection & Wireshark Analysis', 45, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', null, false, 3),

('les-demo-06-3-1', 'sec-demo-06-3', 'course-demo-06', 'OWASP Top 10 Deep Dive: Threat Profiles & Impact Assessment', 35, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', null, false, 1),
('les-demo-06-3-2', 'sec-demo-06-3', 'course-demo-06', 'SQL Injection (SQLi): Authentication Bypasses & Data Extraction', 50, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', null, false, 2),
('les-demo-06-3-3', 'sec-demo-06-3', 'course-demo-06', 'Cross-Site Scripting (XSS): Stored, Reflected & DOM-Based Payloads', 45, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', null, false, 3),

('les-demo-06-4-1', 'sec-demo-06-4', 'course-demo-06', 'Password Cracking Fundamentals: Hashes, Salt, Rainbow Tables & Hashcat', 45, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', null, false, 1),
('les-demo-06-4-2', 'sec-demo-06-4', 'course-demo-06', 'Defensive Hardening: Firewall Rules, Least Privilege & Patch Governance', 40, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', null, false, 2),
('les-demo-06-4-3', 'sec-demo-06-4', 'course-demo-06', 'Professional Penetration Test Reporting & CVSS Vulnerability Scoring', 45, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', null, false, 3),

-- Course 7: UI/UX Design with Figma (12 lessons)
('les-demo-07-1-1', 'sec-demo-07-1', 'course-demo-07', 'Introduction to User Experience Principles & Product Thinking', 20, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', null, true, 1),
('les-demo-07-1-2', 'sec-demo-07-1', 'course-demo-07', 'User Research Methodologies, Heuristic Analysis & Persona Creation', 30, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', null, false, 2),
('les-demo-07-1-3', 'sec-demo-07-1', 'course-demo-07', 'Information Architecture: User Flows, Site Maps & Wireframing', 25, 'article', null, 'Step-by-step techniques for structuring complex application hierarchies before designing visual UI.', false, 3),

('les-demo-07-2-1', 'sec-demo-07-2', 'course-demo-07', 'Figma Interface Tour: Canvases, Vector Tools & Layout Grids', 30, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', null, false, 1),
('les-demo-07-2-2', 'sec-demo-07-2', 'course-demo-07', 'Auto Layout 5: Direction, Padding, Alignment & Absolute Positioning', 40, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', null, false, 2),
('les-demo-07-2-3', 'sec-demo-07-2', 'course-demo-07', 'Typography Scales, Visual Hierarchy & Color Theory Accessibility', 35, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', null, false, 3),

('les-demo-07-3-1', 'sec-demo-07-3', 'course-demo-07', 'Atomic Component Architecture: Atoms, Molecules & Complex Organisms', 40, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', null, false, 1),
('les-demo-07-3-2', 'sec-demo-07-3', 'course-demo-07', 'Component Variants, Boolean Properties & Nested State Switches', 45, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', null, false, 2),
('les-demo-07-3-3', 'sec-demo-07-3', 'course-demo-07', 'Figma Variables & Design Tokens: Color, Spacing, Radius & Multi-Theming', 45, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', null, false, 3),

('les-demo-07-4-1', 'sec-demo-07-4', 'course-demo-07', 'Interactive Prototyping: Smart Animate, Triggers & Delay Transitions', 35, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', null, false, 1),
('les-demo-07-4-2', 'sec-demo-07-4', 'course-demo-07', 'Conducting Moderated Usability Testing with Live Interactive Prototypes', 30, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', null, false, 2),
('les-demo-07-4-3', 'sec-demo-07-4', 'course-demo-07', 'Developer Handoff: Inspect Mode, Variable Mapping & Asset Exporting', 35, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', null, false, 3),

-- Course 8: Data Analytics with Excel and Power BI (12 lessons)
('les-demo-08-1-1', 'sec-demo-08-1', 'course-demo-08', 'Data Analytics Foundations: Types of Analysis, KPIs & Metrics', 20, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', null, true, 1),
('les-demo-08-1-2', 'sec-demo-08-1', 'course-demo-08', 'Advanced Formulas: XLOOKUP, INDEX/MATCH, SUMIFS & Nested Logic', 35, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', null, false, 2),
('les-demo-08-1-3', 'sec-demo-08-1', 'course-demo-08', 'Power Query: Extract, Transform & Load (ETL) Dirty Spreadsheet Data', 45, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', null, false, 3),

('les-demo-08-2-1', 'sec-demo-08-2', 'course-demo-08', 'Introduction to Power BI Desktop, Data Connectors & Canvas Layouts', 30, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', null, false, 1),
('les-demo-08-2-2', 'sec-demo-08-2', 'course-demo-08', 'Relational Data Modeling: Fact Tables, Dimension Tables & Star Schemas', 40, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', null, false, 2),
('les-demo-08-2-3', 'sec-demo-08-2', 'course-demo-08', 'Managing Relationship Cardinality (1-to-Many) & Bidirectional Cross-Filtering', 35, 'article', null, 'Best practices for avoiding ambiguous relationships and circular dependencies in analytical models.', false, 3),

('les-demo-08-3-1', 'sec-demo-08-3', 'course-demo-08', 'DAX Fundamentals: Row Context vs Filter Context Explained', 40, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', null, false, 1),
('les-demo-08-3-2', 'sec-demo-08-3', 'course-demo-08', 'Mastering the CALCULATE Function & Filter Overrides in DAX', 45, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', null, false, 2),
('les-demo-08-3-3', 'sec-demo-08-3', 'course-demo-08', 'Time Intelligence in DAX: Year-to-Date (YTD), Year-over-Year (YoY) Growth', 40, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', null, false, 3),

('les-demo-08-4-1', 'sec-demo-08-4', 'course-demo-08', 'Visualizing Data: Charts, Cards, Matrix Tables & Geospatial Maps', 35, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', null, false, 1),
('les-demo-08-4-2', 'sec-demo-08-4', 'course-demo-08', 'Interactive Elements: Slicers, Bookmarks, Drill-Throughs & Tooltips', 40, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', null, false, 2),
('les-demo-08-4-3', 'sec-demo-08-4', 'course-demo-08', 'Publishing Reports to Power BI Service & Automated Scheduled Refreshes', 35, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', null, false, 3),

-- Course 9: WordPress Website Development (12 lessons)
('les-demo-09-1-1', 'sec-demo-09-1', 'course-demo-09', 'How WordPress Works: Apache, MySQL, PHP & Content Management', 20, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', null, true, 1),
('les-demo-09-1-2', 'sec-demo-09-1', 'course-demo-09', 'Domain Registration, DNS Nameservers & Cloud Hosting Configuration', 25, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', null, false, 2),
('les-demo-09-1-3', 'sec-demo-09-1', 'course-demo-09', 'WordPress Admin Dashboard Settings, Permalinks & Core Security Tweaks', 25, 'article', null, 'Essential initial settings to configure before launching any public WordPress installation.', false, 3),

('les-demo-09-2-1', 'sec-demo-09-2', 'course-demo-09', 'The Gutenberg Block Editor: Layout Blocks, Reusable Blocks & Patterns', 30, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', null, false, 1),
('les-demo-09-2-2', 'sec-demo-09-2', 'course-demo-09', 'Designing Responsive Hero Sections & Landing Pages with Elementor', 40, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', null, false, 2),
('les-demo-09-2-3', 'sec-demo-09-2', 'course-demo-09', 'Navigation Menus, Headers, Footers & Mobile Responsive Breakpoints', 35, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', null, false, 3),

('les-demo-09-3-1', 'sec-demo-09-3', 'course-demo-09', 'Installing WooCommerce & Initial Store Wizard Configuration', 30, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', null, false, 1),
('les-demo-09-3-2', 'sec-demo-09-3', 'course-demo-09', 'Configuring Physical, Digital & Variable Product Variations', 35, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', null, false, 2),
('les-demo-09-3-3', 'sec-demo-09-3', 'course-demo-09', 'Setting Up Razorpay, Stripe, Shipping Zones & Tax Calculations', 40, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', null, false, 3),

('les-demo-09-4-1', 'sec-demo-09-4', 'course-demo-09', 'Speed Optimization: Caching Plugins, Asset Minification & Image CDN', 30, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', null, false, 1),
('les-demo-09-4-2', 'sec-demo-09-4', 'course-demo-09', 'Security Hardening: Login Limiters, 2FA & Malware Scanning', 30, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', null, false, 2),
('les-demo-09-4-3', 'sec-demo-09-4', 'course-demo-09', 'Automated Daily Backups, Migration & Disaster Recovery Workflows', 35, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', null, false, 3),

-- Course 10: Freelancing and Client Acquisition (12 lessons)
('les-demo-10-1-1', 'sec-demo-10-1', 'course-demo-10', 'The Modern Freelancer Mindset: Shifting from Worker to Strategic Partner', 20, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', null, true, 1),
('les-demo-10-1-2', 'sec-demo-10-1', 'course-demo-10', 'Defining Your High-Income Niche & Packaging Services for Maximum Value', 30, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', null, false, 2),
('les-demo-10-1-3', 'sec-demo-10-1', 'course-demo-10', 'Building a Proof-Driven Portfolio: Case Studies That Sell Your Expertise', 25, 'article', null, 'How to frame past work as business outcomes and ROI rather than plain visual mockups.', false, 3),

('les-demo-10-2-1', 'sec-demo-10-2', 'course-demo-10', 'Upwork Mastery: Optimizing Profiles, JSS Scores & Winning Job Searches', 35, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', null, false, 1),
('les-demo-10-2-2', 'sec-demo-10-2', 'course-demo-10', 'Proposal Copywriting: The 3-Sentence Hook That Compels Clients to Reply', 30, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', null, false, 2),
('les-demo-10-2-3', 'sec-demo-10-2', 'course-demo-10', 'Cold Email & LinkedIn Outreach: Finding Decision-Makers and Pitching Value', 35, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', null, false, 3),

('les-demo-10-3-1', 'sec-demo-10-3', 'course-demo-10', 'Value-Based Pricing vs Hourly Billing: How to Price Based on Client ROI', 30, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', null, false, 1),
('les-demo-10-3-2', 'sec-demo-10-3', 'course-demo-10', 'Sales Discovery Calls: Asking Diagnosing Questions & Closing with Confidence', 35, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', null, false, 2),
('les-demo-10-3-3', 'sec-demo-10-3', 'course-demo-10', 'Bulletproof Freelance Contracts, Milestone Schedules & Upfront Deposits', 30, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', null, false, 3),

('les-demo-10-4-1', 'sec-demo-10-4', 'course-demo-10', 'Client Onboarding: Setting Expectations, Communication Rules & Kickoffs', 25, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', null, false, 1),
('les-demo-10-4-2', 'sec-demo-10-4', 'course-demo-10', 'Project Delivery, Over-Delivering & Generating 5-Star Testimonials', 30, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', null, false, 2),
('les-demo-10-4-3', 'sec-demo-10-4', 'course-demo-10', 'Turning One-Off Projects into Predictable Monthly Retainer Contracts', 35, 'video', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', null, false, 3)
ON CONFLICT (id) DO NOTHING;

COMMIT;
