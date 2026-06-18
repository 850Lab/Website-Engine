#!/usr/bin/env python3
"""
Transcribe a sales call recording and produce transcript.md + call-analysis.md.

Usage:
  python scripts/analyze_call_recording.py --audio "All-Phase Electric Supply.m4a"
  python scripts/analyze_call_recording.py --audio path/to/call.m4a --output-dir data/website-screenshots/all-phase-electric-supply

Requires:
  pip install -r scripts/requirements-call-analysis.txt
  OPENAI_API_KEY in .env
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_AUDIO_NAMES = [
    "All-Phase Electric Supply.m4a",
    "all-phase-electric-supply.m4a",
]
DEFAULT_AUDIO_SEARCH_DIRS = [
    Path.cwd(),
    ROOT,
    ROOT / "data" / "call-recordings",
    ROOT / "data" / "website-screenshots" / "all-phase-electric-supply",
    Path.home() / "OneDrive" / "Documents" / "Sound Recordings",
    Path.home() / "Documents" / "Sound Recordings",
]


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def slugify_business_name(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug[:72] or "business"


def resolve_audio_path(explicit: str | None) -> Path:
    if explicit:
        path = Path(explicit)
        if not path.is_absolute():
            candidates = [
                Path.cwd() / path,
                ROOT / path,
                ROOT / "data" / "call-recordings" / path.name,
            ]
            for candidate in candidates:
                if candidate.exists():
                    return candidate.resolve()
        if path.exists():
            return path.resolve()
        raise FileNotFoundError(f"Audio file not found: {explicit}")

    search_roots = DEFAULT_AUDIO_SEARCH_DIRS
    for name in DEFAULT_AUDIO_NAMES:
        for base in search_roots:
            candidate = base / name
            if candidate.exists():
                return candidate.resolve()

    raise FileNotFoundError(
        "Audio file not found. Pass --audio path/to/file.m4a "
        f"(searched for: {', '.join(DEFAULT_AUDIO_NAMES)})"
    )


def resolve_output_dir(audio_path: Path, explicit: str | None) -> Path:
    if explicit:
        out = Path(explicit)
        if not out.is_absolute():
            out = (ROOT / out).resolve()
        out.mkdir(parents=True, exist_ok=True)
        return out

    stem = audio_path.stem
    slug = slugify_business_name(stem)
    business_dir = ROOT / "data" / "website-screenshots" / slug
    if business_dir.exists():
        return business_dir

    out = audio_path.parent
    out.mkdir(parents=True, exist_ok=True)
    return out


def load_sales_brief_context(output_dir: Path) -> str:
    brief_path = output_dir / "sales-brief.md"
    if not brief_path.exists():
        return ""
    text = brief_path.read_text(encoding="utf-8")
    return text[:6000]


def transcribe_audio(client, audio_path: Path) -> dict:
    with audio_path.open("rb") as audio_file:
        result = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            response_format="verbose_json",
        )

    if hasattr(result, "model_dump"):
        return result.model_dump()
    if isinstance(result, dict):
        return result
    return json.loads(str(result))


def analyze_call(client, transcript_payload: dict, sales_brief: str, business_name: str) -> dict:
    segments = transcript_payload.get("segments") or []
    plain_text = transcript_payload.get("text") or ""

    segment_lines = []
    for idx, segment in enumerate(segments, start=1):
        segment_lines.append(
            f"[{idx}] ({segment.get('start', 0):.1f}s-{segment.get('end', 0):.1f}s) "
            f"{segment.get('text', '').strip()}"
        )

    system_prompt = (
        "You analyze cold-call sales recordings for Jaylan Brown's growth-first outreach. "
        "Do NOT score calls higher for pitching websites early. The first call goal is discovery: "
        "how they get customers, whether they want more, who decides growth, and trust gaps. "
        "The website is only a solution after discovery. "
        "When prospects deflect ('we don't use our website', referrals-only, not interested), "
        "score deflection handling on whether the caller pivoted to discovery instead of ending the call. "
        "Emergency fallback question: 'How are you guys getting new business today?' "
        "Return strict JSON only. Label the caller/seller as Me and the business contact as Prospect."
    )

    user_prompt = f"""
Business: {business_name}

Sales brief context (growth-first scripts):
{sales_brief or "No sales brief provided."}

Raw transcript:
{plain_text}

Timestamped segments:
{chr(10).join(segment_lines) if segment_lines else plain_text}

Return JSON with this shape:
{{
  "labeled_transcript": [
    {{"speaker": "Me|Prospect|Unknown", "text": "...", "start": 0.0, "end": 0.0}}
  ],
  "analysis": {{
    "scores": {{
      "opening": {{"score": 1, "notes": "..."}},
      "confidence": {{"score": 1, "notes": "..."}},
      "permission_control": {{"score": 1, "notes": "..."}},
      "discovery": {{"score": 1, "notes": "..."}},
      "deflection_handling": {{"score": 1, "notes": "..."}},
      "offer_timing": {{"score": 1, "notes": "..."}},
      "golden_question": {{"score": 1, "notes": "..."}},
      "close_next_step": {{"score": 1, "notes": "..."}}
    }},
    "prospect_useful_information": ["..."],
    "followed_trail": {{"yes": true, "notes": "..."}},
    "best_missed_question": "...",
    "best_next_response": "...",
    "website_too_early": {{"yes": false, "notes": "..."}},
    "prospect_talked_about_business": {{"yes": true, "notes": "..."}},
    "objections": ["..."],
    "missed_opportunities": ["..."],
    "suggested_improvements": ["..."]
  }}
}}

Score each dimension 1-5. Use the emergency question as the benchmark when discovery was weak.
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
    )

    content = response.choices[0].message.content or "{}"
    return json.loads(content)


def format_timestamp(seconds: float | None) -> str:
    if seconds is None:
        return "00:00"
    total = max(0, int(seconds))
    minutes, secs = divmod(total, 60)
    return f"{minutes:02d}:{secs:02d}"


def render_transcript_md(
    business_name: str,
    audio_path: Path,
    labeled_transcript: list[dict],
    plain_text: str,
) -> str:
    lines = [
        f"# Call Transcript: {business_name}",
        "",
        f"**Audio file:** `{audio_path.name}`",
        f"**Processed:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        "",
        "## Transcript",
        "",
    ]

    if labeled_transcript:
        for entry in labeled_transcript:
            speaker = entry.get("speaker") or "Unknown"
            text = (entry.get("text") or "").strip()
            if not text:
                continue
            start = format_timestamp(entry.get("start"))
            end = format_timestamp(entry.get("end"))
            lines.append(f"**[{start}-{end}] {speaker}:** {text}")
            lines.append("")
    else:
        lines.append(plain_text.strip() or "_No transcript text returned._")
        lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def render_analysis_md(business_name: str, analysis: dict) -> str:
    def bullet_list(items: list[str]) -> str:
        cleaned = [str(item).strip() for item in (items or []) if str(item).strip()]
        if not cleaned:
            return "_None identified._"
        return "\n".join(f"- {item}" for item in cleaned)

    def render_score(label: str, key: str) -> str:
        scores = analysis.get("scores") or {}
        entry = scores.get(key) or {}
        score = entry.get("score", "—")
        notes = entry.get("notes") or "_No notes._"
        return f"### {label}\n**Score:** {score}/5\n\n{notes}"

    def render_bool_entry(label: str, block: dict | None) -> str:
        if not block:
            return f"- **{label}:** _Not assessed._"
        yes = block.get("yes")
        yes_label = "Yes" if yes else "No" if yes is False else "Unknown"
        notes = block.get("notes") or ""
        line = f"- **{label}:** {yes_label}"
        if notes:
            line += f" — {notes}"
        return line

    return f"""# Call Analysis: {business_name}

## Scorecard

{render_score("1. Opening", "opening")}

{render_score("2. Confidence", "confidence")}

{render_score("3. Permission / Control", "permission_control")}

{render_score("4. Discovery", "discovery")}

{render_score("5. Deflection Handling", "deflection_handling")}

{render_score("6. Offer Timing", "offer_timing")}

{render_score("7. Golden Question", "golden_question")}

{render_score("8. Close / Next Step", "close_next_step")}

## Prospect Intelligence
{bullet_list(analysis.get("prospect_useful_information") or [])}

## Call Trail
{render_bool_entry("Followed the trail", analysis.get("followed_trail"))}

**Best missed question:** {analysis.get("best_missed_question") or "_None identified._"}

**Best next response:** {analysis.get("best_next_response") or "_None identified._"}

## Website Timing
{render_bool_entry("Talked about website too early", analysis.get("website_too_early"))}

## Engagement
{render_bool_entry("Got prospect talking about their business", analysis.get("prospect_talked_about_business"))}

## Objections & Deflections
{bullet_list(analysis.get("objections") or [])}

## Missed Opportunities
{bullet_list(analysis.get("missed_opportunities") or [])}

## Suggested Improvements
{bullet_list(analysis.get("suggested_improvements") or [])}

## Emergency Question Reminder
If discovery stalls on the next call, ask: **How are you guys getting new business today?**
"""


def main() -> int:
    parser = argparse.ArgumentParser(description="Transcribe and analyze a sales call recording.")
    parser.add_argument("--audio", help="Path to audio file (.m4a, .mp3, .wav, etc.)")
    parser.add_argument(
        "--output-dir",
        help="Directory for transcript.md and call-analysis.md (defaults to matching business folder)",
    )
    parser.add_argument(
        "--business-name",
        help="Business name for headings (defaults from audio filename)",
    )
    parser.add_argument(
        "--api-key",
        help="OpenAI API key (overrides OPENAI_API_KEY from .env)",
    )
    args = parser.parse_args()

    load_env_file(ROOT / ".env")
    load_env_file(ROOT / ".env.local")

    if args.api_key:
        os.environ["OPENAI_API_KEY"] = args.api_key.strip()

    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        print("ERROR: OPENAI_API_KEY is missing. Add it to .env and retry.", file=sys.stderr)
        return 1

    try:
        from openai import OpenAI
    except ImportError:
        print(
            "ERROR: openai package not installed. Run:\n"
            "  pip install -r scripts/requirements-call-analysis.txt",
            file=sys.stderr,
        )
        return 1

    try:
        audio_path = resolve_audio_path(args.audio)
    except FileNotFoundError as err:
        print(f"ERROR: {err}", file=sys.stderr)
        return 1

    output_dir = resolve_output_dir(audio_path, args.output_dir)
    business_name = args.business_name or audio_path.stem
    sales_brief = load_sales_brief_context(output_dir)

    print(f"Audio: {audio_path}")
    print(f"Output: {output_dir}")
    print("Transcribing...")

    client = OpenAI(api_key=api_key)
    transcript_payload = transcribe_audio(client, audio_path)

    print("Analyzing speakers and call structure...")
    parsed = analyze_call(client, transcript_payload, sales_brief, business_name)

    labeled_transcript = parsed.get("labeled_transcript") or []
    analysis = parsed.get("analysis") or {}

    transcript_md = render_transcript_md(
        business_name,
        audio_path,
        labeled_transcript,
        transcript_payload.get("text") or "",
    )
    analysis_md = render_analysis_md(business_name, analysis)

    transcript_path = output_dir / "transcript.md"
    analysis_path = output_dir / "call-analysis.md"

    transcript_path.write_text(transcript_md, encoding="utf-8")
    analysis_path.write_text(analysis_md, encoding="utf-8")

    print(f"Wrote {transcript_path}")
    print(f"Wrote {analysis_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
