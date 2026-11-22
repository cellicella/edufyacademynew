#!/usr/bin/env python3
"""
Builds the Edufy course import from the Adilo audit and validates it.

  python3 build.py            → validate + write courses.json, reconciliation.md, import.sql
  (import.sql refuses to run until every new course has a price: fill PRICES below first)

Rules enforced (the build stops on any violation):
  - every Adilo video of an included project is used exactly once, in the course of its own project;
  - a lesson's number is the number at the start of its original Adilo title ("Intro" for the unnumbered course intro);
  - lessons keep the original Adilo order inside and across sections; no extra, missing or duplicate videos.
"""
import json, re, math, sys, datetime
from pathlib import Path
from content import COURSES, CATEGORIES

HERE = Path(__file__).parent
INV = json.loads((HERE / "adilo-inventory.raw.json").read_text())

# Prices for NEW courses are the owner's decision (INR). Leave None until decided; existing courses keep their prices.
PRICES = {
    "fbczR6R5": (199, 2499),  # Crafting the Perfect Resume
    "55eC1c7Z": (199, 2499),  # Complete Guide to Job Interviews
    "39NiTmwA": (199, 2499),  # How to Land Your First Internship
    "zLXq61yX": (199, 2499),  # Mastering Salary Negotiation
    "7wENqs4i": (199, 2499),  # Mastering Phone Conversations
    "IK69hQ6B": (199, 2499),  # Mastering the Art of Communication
    "uPmKnymT": (199, 2499),  # Public Speaking for Beginners
    "Wqvdq40t": (199, 2499),  # Personal Branding
}  # (price, original price) in INR — set by the owner on 22 Nov 2026

PLATFORM_INSTRUCTOR = "d5d4606d-d686-4c86-8a0f-c58a8cf9d368"  # account used by the existing Edufy courses
# Existing lesson rows (from the database audit): Adilo file id → lesson id. These rows are updated in place so
# student progress, which references lesson ids, is preserved.
EXISTING_LESSONS = {
    "ZjEkIFzV": "les-06f8a654d6", "TzRAwDeA": "les-a018b34a20", "f3eWm9Dk": "les-53f68d9c85", "1vZFkR_R": "les-cb283b75dc",
    "xJM_qg0i": "les-98c91b814a", "Su52gYGw": "les-b11d98291b", "0WrrpQgi": "les-c482407c2b", "Jk_g9tRm": "les-48df9cf7d2",
    "WEJZRoH9": "les-d41234478c", "5Qs78cxU": "les-76eb64b4ee", "w9JfCKD3": "les-b426a9b32d", "K5WadXoZ": "les-8f31f7b894",
    "el8Z8TTI": "les-1ab27beb8a", "zoCsU4Io": "les-ae6cc1d30b", "FPq7jqQb": "les-50880787ed", "3j1VYCVd": "les-884fe96d14",
    "iizC3BhU": "les-a5bb7e67e5",
    "S024TXD2": "les-dea1d55b58", "49ragFyA": "les-3eefd44b39", "b6ZUdfhi": "les-50b908f14c", "DR6S35HZ": "les-9d6d7af78c",
}
# Lessons in the database that are not Adilo videos (kept; reported for the owner to review).
NON_ADILO_LESSONS = [{"course": "course-3bda155b", "lesson": "les-83f80361ea", "section": "sec-8f3b4fff34", "title": "Course Welcome & Learning Path Roadmap", "note": "No video (87 characters of text); not part of the Adilo course. Kept as is — owner to decide."}]

ORDER_KEY = lambda n: (-1, 0, "") if n == "Intro" else (int(re.match(r"\d+", n).group()), 1, n)


def original_number(title: str) -> str:
    m = re.match(r"^\s*(\d+[A-Za-z]?)\s*[\.\s]", title)
    return m.group(1).upper() if m else "Intro"


def fail(msg):
    print("BUILD FAILED:", msg)
    sys.exit(1)


def build():
    videos = {}
    by_project = {}
    for pid, vid, title, dur in INV["rows"]:
        if vid in videos:
            fail(f"video {vid} listed twice in the inventory")
        videos[vid] = {"project": pid, "title": title, "duration": dur, "number": original_number(title)}
        by_project.setdefault(pid, []).append(vid)
    project_titles = {p[0]: p[1] for p in INV["projects"]}

    used = {}
    out = []
    for c in COURSES:
        pid = c["project"]
        if pid not in project_titles:
            fail(f"unknown project {pid}")
        course_id = c.get("existing_id") or f"course-adilo-{pid.lower()}"
        lessons_by_num = c["lessons"]
        # every lesson: right project, right number, used once
        for num, (vid, _t) in lessons_by_num.items():
            v = videos.get(vid) or fail(f"{course_id}: video {vid} not in Adilo inventory")
            if v["project"] != pid:
                fail(f"{course_id}: video {vid} belongs to project {v['project']}, not {pid}")
            if v["number"] != (num if num == "Intro" else num.upper()):
                fail(f"{course_id}: lesson {num} uses video {vid} whose Adilo number is {v['number']}")
            if vid in used:
                fail(f"video {vid} used twice ({used[vid]} and {course_id})")
            used[vid] = course_id
        missing = [v for v in by_project[pid] if v not in used]
        if missing:
            fail(f"{course_id}: Adilo videos not mapped: {missing}")
        # sections cover every lesson once, in original order
        seq = [n for s in c["sections"] for n in s["lessons"]]
        if sorted(seq, key=ORDER_KEY) != seq:
            fail(f"{course_id}: sections change the original order: {seq}")
        if len(seq) != len(set(seq)) or set(seq) != set(lessons_by_num):
            fail(f"{course_id}: sections do not cover every lesson exactly once")
        for s in c["sections"]:
            if re.match(r"(?i)^(section \d+|other topics|misc)", s["title"]):
                fail(f"{course_id}: generic section title {s['title']!r}")

        sections = []
        total = 0
        for si, s in enumerate(c["sections"], start=1):
            sid = s.get("id") or f"sec-adilo-{pid.lower()}-{si:02d}"
            lessons = []
            for li, num in enumerate(s["lessons"], start=1):
                vid, clean = lessons_by_num[num]
                v = videos[vid]
                total += v["duration"]
                lessons.append({
                    "id": EXISTING_LESSONS.get(vid) or f"les-adilo-{vid}",
                    "existing": vid in EXISTING_LESSONS,
                    "number": num,
                    "title": clean if num == "Intro" else f"{num}. {clean}",
                    "order": li,
                    "adiloFileId": vid,
                    "adiloProjectId": pid,
                    "embedUrl": f"https://adilo.bigcommand.com/watch/{vid}",
                    "originalTitle": v["title"],
                    "durationSeconds": v["duration"],
                    "durationMinutes": max(1, math.ceil(v["duration"] / 60)),
                    "freePreview": num in c.get("free_preview", []),
                })
            sections.append({"id": sid, "order": si, "title": s["title"], "description": s["description"], "lessons": lessons})

        cat = next((x for x in CATEGORIES if x["slug"] == c["category"]), None) or fail(f"{course_id}: unknown category")
        price = PRICES.get(pid)
        out.append({
            "id": course_id,
            "existing": "existing_id" in c,
            "adiloProject": pid,
            "adiloProjectTitle": project_titles[pid],
            "title": c["title"],
            "slug": c["slug"],
            "subtitle": c["subtitle"],
            "seoTitle": c["seo"]["title"],
            "seoDescription": c["seo"]["description"],
            "description": "\n\n".join(c["description"]),
            "category": cat["name"],
            "categorySlug": cat["slug"],
            "level": c["level"],
            "language": "English",
            "keywords": c["keywords"],
            "learningOutcomes": c["outcomes"],
            "prerequisites": c["prerequisites"],
            "targetAudience": c["audience"],
            "thumbnail": f"https://edufyacademy.com/images/courses/{c['slug']}.jpg",
            "price": None if "existing_id" in c else (price[0] if price else None),
            "originalPrice": None if "existing_id" in c else (price[1] if price else None),
            "durationSeconds": total,
            "videoCount": len(lessons_by_num),
            "sections": sections,
        })

    # slugs unique and readable
    slugs = [c["slug"] for c in out]
    if len(set(slugs)) != len(slugs) or any(not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", s) for s in slugs):
        fail("course slugs must be unique lowercase words separated by hyphens")
    titles = [c["title"] for c in out]
    if len(set(titles)) != len(titles):
        fail("duplicate course titles")
    return out, videos, by_project


def sql_str(v):
    if v is None:
        return "null"
    return "'" + str(v).replace("'", "''") + "'"


def sql_json(v):
    return sql_str(json.dumps(v, ensure_ascii=False)) + "::jsonb"


def write_sql(courses):
    stamp = "20261122"
    L = [
        "-- Edufy Academy: Adilo course import (generated by production/content/adilo/build.py — do not edit by hand)",
        "-- Safe to run more than once: rows are matched by their ids and updated, never duplicated.",
        "-- Existing enrollments, payments, reviews and lesson progress are not touched. Nothing is deleted.",
        "begin;",
        "",
        "-- 0. Backup of the tables this import changes",
        f"create schema if not exists backup_{stamp};",
    ]
    for t in ["courses", "course_sections", "lessons", "categories"]:
        L.append(f"create table if not exists backup_{stamp}.{t} as table public.{t};")
    L += [
        "",
        "-- 1. New optional columns: section overviews and per-course SEO title/description (the website uses them when present)",
        "alter table public.course_sections add column if not exists description text;",
        "alter table public.courses add column if not exists seo_title text;",
        "alter table public.courses add column if not exists seo_description text;",
        "",
        "-- 2. Categories",
    ]
    from content import CATEGORIES as CATS
    for i, cat in enumerate(CATS):
        L.append(
            f"insert into public.categories (name, slug, description, is_active, position) select {sql_str(cat['name'])}, {sql_str(cat['slug'])}, {sql_str(cat['description'])}, true, {10 + i} "
            f"where not exists (select 1 from public.categories where slug = {sql_str(cat['slug'])});"
        )
    L.append("")
    for c in courses:
        L.append(f"-- ===== {c['title']}  ({c['id']}, Adilo project {c['adiloProject']}, {c['videoCount']} videos)")
        hours = round(c["durationSeconds"] / 3600, 1)
        common = dict(
            slug=c["slug"], title=c["title"], subtitle=c["subtitle"], description=c["description"], category=c["category"],
            category_slug=c["categorySlug"], level=c["level"], language=c["language"], seo_title=c["seoTitle"], seo_description=c["seoDescription"],
        )
        if c["existing"]:
            sets = ", ".join(f"{k} = {sql_str(v)}" for k, v in common.items())
            # keep the admin draft/published marker (stored as a "__status:" entry in prerequisites)
            L.append(
                f"update public.courses set {sets}, learning_outcomes = {sql_json(c['learningOutcomes'])}, "
                f"prerequisites = coalesce((select jsonb_agg(p) from jsonb_array_elements(prerequisites) p where p #>> '{{}}' like '\\_\\_status:%'), '[]'::jsonb) || {sql_json(c['prerequisites'])}, "
                f"target_audience = {sql_json(c['targetAudience'])}, updated_at = now() where id = {sql_str(c['id'])};"
            )
        else:
            if c["price"] is None:
                L.append(f"do $$ begin raise exception 'Set a price for {c['title']} in build.py (PRICES[\"{c['adiloProject']}\"]) and rebuild'; end $$;")
            cols = ["id", *common.keys(), "price", "original_price", "thumbnail_url", "learning_outcomes", "prerequisites", "target_audience", "instructor_id", "is_published", "duration_hours", "total_lessons"]
            vals = [sql_str(c["id"]), *[sql_str(v) for v in common.values()], str(c["price"] or 0), str(c["originalPrice"] or c["price"] or 0), sql_str(c["thumbnail"]),
                    sql_json(c["learningOutcomes"]), sql_json(["__status:draft", *c["prerequisites"]]), sql_json(c["targetAudience"]), sql_str(PLATFORM_INSTRUCTOR), "false", str(hours), str(c["videoCount"])]
            upd = ", ".join(f"{k} = excluded.{k}" for k in [*common.keys(), "learning_outcomes", "target_audience"])
            L.append(f"insert into public.courses ({', '.join(cols)}) values ({', '.join(vals)}) on conflict (id) do update set {upd}, updated_at = now();")
        for s in c["sections"]:
            L.append(
                f"insert into public.course_sections (id, course_id, title, section_order, description) values ({sql_str(s['id'])}, {sql_str(c['id'])}, {sql_str(s['title'])}, {s['order'] + 100}, {sql_str(s['description'])}) "
                f"on conflict (id) do update set title = excluded.title, section_order = excluded.section_order, description = excluded.description;"
            )
        for s in c["sections"]:
            for l in s["lessons"]:
                cols = "id, section_id, course_id, title, duration_minutes, type, is_free_preview, lesson_order, adilo_file_id, adilo_project_id, adilo_embed_url, video_title, video_duration, video_status"
                vals = ", ".join([sql_str(l["id"]), sql_str(s["id"]), sql_str(c["id"]), sql_str(l["title"]), str(l["durationMinutes"]), "'video'", "true" if l["freePreview"] else "false",
                                  str(l["order"]), sql_str(l["adiloFileId"]), sql_str(l["adiloProjectId"]), sql_str(l["embedUrl"]), sql_str(l["originalTitle"]), str(l["durationSeconds"]), "'library'"])
                upd = "section_id = excluded.section_id, course_id = excluded.course_id, title = excluded.title, duration_minutes = excluded.duration_minutes, is_free_preview = excluded.is_free_preview, lesson_order = excluded.lesson_order, adilo_file_id = excluded.adilo_file_id, adilo_project_id = excluded.adilo_project_id, adilo_embed_url = excluded.adilo_embed_url, video_title = excluded.video_title, video_duration = excluded.video_duration"
                L.append(f"insert into public.lessons ({cols}) values ({vals}) on conflict (id) do update set {upd};")
        # final section order 1..n (the +100 above avoids clashes with current orders while updating)
        for s in c["sections"]:
            L.append(f"update public.course_sections set section_order = {s['order']} where id = {sql_str(s['id'])};")
        # course totals from the lessons actually stored
        L.append(
            f"update public.courses set total_lessons = (select count(*) from public.lessons where course_id = {sql_str(c['id'])}), "
            f"duration_hours = round(coalesce((select sum(coalesce(video_duration, duration_minutes * 60)) from public.lessons where course_id = {sql_str(c['id'])}), 0) / 3600.0, 1) where id = {sql_str(c['id'])};"
        )
        L.append("")
    # the non-Adilo placeholder section keeps its place after the Adilo sections of its course
    for n in NON_ADILO_LESSONS:
        L.append(f"update public.course_sections set section_order = 99 where id = {sql_str(n['section'])};  -- {n['title']} (not an Adilo video; kept, placed after the Adilo sections; review)")
    L += ["", "commit;", ""]
    (HERE / "import.sql").write_text("\n".join(L))


def write_reports(courses, videos, by_project):
    data = {"generatedAt": datetime.date.today().isoformat(), "courses": courses, "excludedProjects": INV["excludedProjects"], "nonAdiloLessons": NON_ADILO_LESSONS}
    (HERE / "courses.json").write_text(json.dumps(data, indent=1, ensure_ascii=False))

    def mins(s):
        return f"{s // 3600}h {s % 3600 // 60:02d}m" if s >= 3600 else f"{s // 60}m {s % 60:02d}s"

    L = ["# Adilo course import — reconciliation report", "", f"Generated by `production/content/adilo/build.py` from the Adilo library audit ({INV['retrievedAt']}).", ""]
    tv = sum(len(by_project[c["adiloProject"]]) for c in courses)
    L += [
        "## Summary",
        "",
        f"- Adilo projects found: {len(INV['projects']) + len(INV['excludedProjects'])} ({len(INV['rows']) + sum(p['videos'] for p in INV['excludedProjects'])} videos)",
        f"- Excluded: " + "; ".join(f"{p['title']} ({p['videos']} videos) — {p['reason']}" for p in INV["excludedProjects"]),
        f"- Courses prepared: {len(courses)} ({sum(c['existing'] for c in courses)} existing updated, {sum(not c['existing'] for c in courses)} new)",
        f"- Adilo videos in these courses: {tv}; lessons mapped: {sum(c['videoCount'] for c in courses)}; missing: 0; duplicates: 0",
        f"- Sections: {sum(len(c['sections']) for c in courses)}",
        "",
        "## Per course",
        "",
        "| Course | Status | Adilo videos | Lessons | Missing | Duplicates | Sequence | Sections | Duration | Thumbnail | SEO metadata | Description |",
        "|---|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    for c in courses:
        L.append(f"| {c['title']} | {'existing — updated' if c['existing'] else 'new (draft)'} | {len(by_project[c['adiloProject']])} | {c['videoCount']} | 0 | 0 | original order kept | {len(c['sections'])} | {mins(c['durationSeconds'])} | {'existing design + Edufy logo' if c['existing'] else 'new branded thumbnail'} | title, description, keywords, slug | written from the lesson topics |")
    L += ["", "## Notes and items for the owner", ""]
    notes = [
        ("Wqvdq40t", "UpazhCAB", "Video 2 is only 5 seconds long in Adilo — probably an incomplete upload. Imported as is; please check it in Adilo."),
        ("39NiTmwA", "dDaj9BSw", "Video \"28A. How to Land Your First Internship\" has a letter in its number; kept as 28A at the end of the course."),
        ("39NiTmwA", "uBQM6GoS", "Videos 22 and 23 have the same Adilo title; shown as (Part 1) and (Part 2)."),
        ("zLXq61yX", "jocCGCr2", "Videos 21, 22 and 23 have the same (cut-off) Adilo title; shown as (Part 1), (Part 2), (Part 3)."),
        ("*", "*", "Adilo stores many titles cut off at 50 characters. Lesson titles end at the last complete phrase; the original Adilo title of every video is kept in the database (lessons.video_title)."),
        ("*", "*", "Course introduction videos (\"Course Intro of …\") have no number in Adilo; they are shown first as \"Course Introduction\" and counted once."),
    ]
    for _, _, n in notes:
        L.append(f"- {n}")
    for n in NON_ADILO_LESSONS:
        L.append(f"- {n['course']}: lesson \"{n['title']}\" ({n['lesson']}) is not an Adilo video. {n['note']}")
    L += ["", "## Lesson map", ""]
    for c in courses:
        L += [f"### {c['title']}", "", f"`{c['id']}` · Adilo project `{c['adiloProject']}` ({c['adiloProjectTitle']}) · /courses/{c['slug']}", ""]
        for s in c["sections"]:
            L.append(f"**{s['order']}. {s['title']}** — {s['description']}")
            L.append("")
            for l in s["lessons"]:
                flag = " · free preview" if l["freePreview"] else ""
                L.append(f"- {l['title']} — `{l['adiloFileId']}` · {mins(l['durationSeconds'])}{flag}  ")
                L.append(f"  <sub>Adilo: {l['originalTitle']}</sub>")
            L.append("")
    (HERE / "reconciliation.md").write_text("\n".join(L))


if __name__ == "__main__":
    courses, videos, by_project = build()
    write_reports(courses, videos, by_project)
    write_sql(courses)
    missing_prices = [c["title"] for c in courses if not c["existing"] and c["price"] is None]
    print(f"OK: {len(courses)} courses, {sum(c['videoCount'] for c in courses)} lessons, {sum(len(c['sections']) for c in courses)} sections — every Adilo video mapped once, original order kept.")
    if missing_prices:
        print(f"Prices still needed for {len(missing_prices)} new courses (import.sql stops until set): " + "; ".join(missing_prices))
