import json
import re
import time

from firecrawl import FirecrawlApp

from app.core.config import settings
from app.cost_tracking.client import CostTrackingOpenAIClient
from app.pipelines.audit_crawler.rate_limiter import firecrawl_limiter
from app.pipelines.audit_crawler.schemas import DQAReport, SchemaKnowledgeBase
from app.services.scraper.cache_service import ScraperCacheService


class ExtractionAgent:
    """Extraction Agent:

    1. Scrapes target URLs using Firecrawl with strict rate limiting (6s interval).
    2. Cleans text aggressively (removing navigation, footers, image links, table menus) to minimize token footprint.
    3. Validates school data against website text using structured outputs via configured LLM (gpt-6-luna)
       with a strict 9-rule domain knowledge prompt.
    """

    def __init__(self):
        self.openai_client = CostTrackingOpenAIClient()
        self.firecrawl = FirecrawlApp(api_key=settings.firecrawl_api_key)

    def clean_scraped_text(self, markdown_text: str) -> str:
        """Aggressively cleans scraped text to remove navigation menus and keep only

        informational content like school description, contact info, and announcements.
        """
        lines = markdown_text.split("\n")
        cleaned_lines = []
        seen_lines = set()
        in_table = False
        in_nav_section = False

        skip_section_headers = [
            "campuses",
            "main menu",
            "quick links",
            "navigation",
            "breadcrumb",
            "follow us",
            "facebook feed",
            "social media",
            "background follow",
            "we are southwest",
            "main shuffle",
            "campus happenings",
        ]

        for line in lines:
            line_stripped = line.strip()

            if not line_stripped:
                if cleaned_lines and cleaned_lines[-1] != "":
                    cleaned_lines.append("")
                continue

            line_lower = line_stripped.lower()

            # Detect and skip navigation section headers
            if line_stripped.startswith(("# ", "## ", "### ")):
                header_text = re.sub(r"^#+\s*", "", line_stripped).lower()
                if any(skip in header_text for skip in skip_section_headers):
                    in_nav_section = True
                    continue
                else:
                    in_nav_section = False
                    cleaned_lines.append(line)
                    seen_lines.add(line_stripped)
                    continue

            # Skip content if we're in a navigation section
            if in_nav_section:
                if not line_stripped.startswith(("- [", "[", "|")) and len(line_stripped) > 50:
                    in_nav_section = False
                else:
                    continue

            # Remove ALL markdown link lists (navigation menus)
            if line_stripped.startswith(("- [", "  - [", "   - [")):
                continue

            # Remove image markdown
            if re.match(r"!\[.*?\]\(.*?\)", line_stripped):
                continue

            # Remove table rows (markdown tables with |)
            if line_stripped.startswith("|") or re.match(r"^\|.*\|$", line_stripped):
                in_table = True
                continue
            elif in_table and not line_stripped.startswith("|"):
                in_table = False

            # Remove standalone links like [Text](url) on their own line
            if re.match(r"^\[.+?\]\(.+?\)$", line_stripped):
                continue

            # Remove navigation keywords
            skip_keywords = [
                "skip to",
                "main menu toggle",
                "previous",
                "next",
                "show all news",
                "show all events",
                "read more",
                "find us on",
                "powered by edlio",
                "edlio login",
                "toggle",
                "share",
            ]
            if any(kw in line_lower for kw in skip_keywords):
                continue

            # Remove duplicate lines
            if line_stripped in seen_lines:
                continue

            # Keep this line - it's actual content
            cleaned_lines.append(line)
            seen_lines.add(line_stripped)

        cleaned_text = "\n".join(cleaned_lines)
        cleaned_text = re.sub(r"\n{3,}", "\n\n", cleaned_text)
        cleaned_text = re.sub(r"\?[^\s)]+", "", cleaned_text)
        cleaned_text = re.sub(r"https?://[^\s)]+(?:\))?", "", cleaned_text)

        return cleaned_text.strip()

    def scrape_website(
        self,
        url: str,
        max_retries: int = 3,
        force_refresh: bool = False,
        school_id=None,
    ) -> str:
        """Scrapes a website using Firecrawl or retrieves cached markdown if already crawled.

        Throttled to stay under API limits and auto-retries on 429 rate limits.
        """
        # Step 1: Check cache unless force_refresh requested
        if not force_refresh:
            cached_text = ScraperCacheService.get_cached_page(url)
            if cached_text:
                return cached_text

        # Step 2: Live Firecrawl scrape
        for attempt in range(1, max_retries + 1):
            try:
                firecrawl_limiter.wait()

                result = self.firecrawl.scrape_url(
                    url,
                    formats=["markdown"],
                    only_main_content=False,
                    wait_for=3000,
                    timeout=80000,
                )

                if isinstance(result, dict):
                    markdown = result.get("markdown", "")
                else:
                    markdown = getattr(result, "markdown", "")

                if not markdown:
                    return ""

                # Two-stage cleaning
                cleaned = re.sub(r" +", " ", markdown)
                cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()
                final_text = self.clean_scraped_text(cleaned)

                # Step 3: Cache result for subsequent runs
                if final_text:
                    ScraperCacheService.store_page(
                        url=url,
                        markdown=markdown,
                        cleaned_text=final_text,
                        scraper_source="firecrawl",
                        school_id=school_id,
                    )

                return final_text

            except Exception as e:
                error_msg = str(e).lower()
                print(f"[ExtractionAgent] Firecrawl error for {url}: {e}")

                # Rate limit hit -> backoff and retry
                if "rate limit" in error_msg or "429" in error_msg:
                    if attempt < max_retries:
                        backoff = 30 * attempt
                        print(
                            f"[ExtractionAgent] Rate Limit 429: Waiting {backoff}s before retry ({attempt}/{max_retries}) for {url}..."
                        )
                        time.sleep(backoff)
                        continue
                    else:
                        return ""

                return ""

        return ""

    def validate_school(
        self,
        school_id: str,
        current_data: dict,
        website_text: str,
        schema_kb: SchemaKnowledgeBase | None = None,
    ) -> DQAReport:
        """Runs the LLM validation against the schema and website content using the strict 9-rule prompt."""
        schema_definition = (
            schema_kb.model_dump_json(indent=2)
            if schema_kb
            else (
                "Priority fields: name, address, website, phone, email, grades, type, description, "
                "extracurricular_programs, learning_models, open_enrollment."
            )
        )

        system_prompt = (
            "You are the Data Quality Assurance (DQA) Validation Agent for a school database.\n"
            "Your job is to compare the CURRENT database row with the NEW TEXT extracted from the school's website.\n"
            "You MUST output a DQAReport in strictly valid JSON.\n\n"
            f"Here is the database schema definitions for allowed fields and enums:\n"
            f"{schema_definition}\n\n"
            "Rules:\n"
            "0. IDENTITY CHECK: First, carefully review the extracted website text. If the website clearly does NOT belong to the school (e.g., domain squatter, completely different business, unrelated logistics company), you MUST set overall_score to 0, and for ALL priority fields recommend null with reason 'Website does not belong to the school'. Do NOT hallucinate evidence.\n"
            "1. For most fields, you MUST generate a Recommendation object ONLY if the field needs to be edited (Missing or Incorrect).\n"
            "2. EXCEPTION FOR PRIORITY FIELDS: For 'name', 'address', 'type', 'grades', 'website', 'phone', and 'email', you MUST ALWAYS output a Recommendation object for every single one of them. If the DB value is already perfectly correct, set the recommended value to perfectly match the current value, and write 'Verified correct' in the reason.\n"
            "2b. ADDITIONAL ENRICHMENT FIELDS: Look for and extract information for these fields whenever mentioned on the website:\n"
            "   - 'description': Provide a concise, factual 1-3 sentence summary of the school or daycare from its website.\n"
            "   - 'extracurricular_programs': Extract arts, music, dance, athletics, or clubs that match the allowed values in the schema.\n"
            "   - 'learning_models': Extract educational philosophies (e.g. 'play_based', 'montessori', 'child_centered_learning') matching schema allowed values.\n"
            "   - 'open_enrollment': Recommend boolean true if enrolling now or spots available, false if waitlist only or enrollment closed.\n"
            "3. SCHEMA ALLOWED VALUES: If a field has allowed_values defined in the schema (even if it's an array like grades or extracurriculars), you MUST ONLY use exact matches from that list. Do NOT invent new string values like '18 months' or 'two-year-olds'.\n"
            "4. Make sure to provide exact verbatim quotes in the evidence source.\n"
            "5. HIGHEST PRIORITY: You must thoroughly verify all basic details, especially 'name', 'address', 'type', 'grades', 'website', 'phone', and 'email'.\n"
            "6. STRICT ENUM CONSTRAINT: The 'type' field MUST exactly match one of these values: 'private', 'public', 'charter', 'magnet', or 'partnership'.\n"
            "7. GRADES RESOLUTION HIERARCHY (3-TIER PROCESS):\n"
            "   When determining the 'grades' offered, you MUST follow this strict 3-tier priority order:\n\n"
            "   TIER 1 - FORMAL GRADE NAMES (Highest Priority):\n"
            "     If the website explicitly lists formal K-12 or Pre-K grade levels (e.g., 'Kindergarten through 5th grade', 'Pre-K 3', 'Pre-K 4', '6th to 8th grade'), extract and use them directly.\n"
            "     NOTE ON 'Pre-K': 'Pre-K' is a broad category. If the website mentions generic 'Pre-K' without specifying 3 or 4, map it to BOTH 'Pre-K 3' and 'Pre-K 4'.\n\n"
            "   TIER 2 - NAMED PROGRAM OFFERINGS (Primary for Early Learning & Daycare Centers):\n"
            "     If formal K-12 grade names are not listed, or for early childhood centers, look directly at the names of programs/classrooms offered on the website:\n"
            "       - 'Infant' program / room              --> 'Infant'\n"
            "       - 'Toddler' program / room             --> 'Toddler'\n"
            "       - 'Preschool' / 'Pre-K 2' / 'Twos'     --> 'Preschool'\n"
            "       - 'Pre-K 3' / 'Threes'                 --> 'Pre-K 3'\n"
            "       - 'Pre-K 4' / 'Fours'                  --> 'Pre-K 4'\n"
            "       - 'Kindergarten' program               --> 'Kindergarten'\n\n"
            "   TIER 3 - AGE CRITERIA FALLBACK (Last Resort Only):\n"
            "     ONLY if the website lists NEITHER formal grade names NOR named programs, and ONLY specifies student ages or months (e.g., 'Accepting children 6 weeks to 5 years'):\n"
            "       - 0 to 18 months (or 6 weeks+)         --> 'Infant'\n"
            "       - 1 to 2 years (or 12 to 24 months)    --> 'Toddler'\n"
            "       - 2 years old (or 24 to 36 months)     --> 'Preschool'\n"
            "       - 3 years old (or 36 to 48 months)     --> 'Pre-K 3'\n"
            "       - 4 years old (or 48 to 60 months)     --> 'Pre-K 4'\n"
            "       - 5 years old                          --> 'Kindergarten'\n"
            "     MANDATORY IN REASON: If you derived grades from Tier 3 age criteria, you MUST explicitly write in the recommendation reason:\n"
            "     'Grades derived from age criteria because no formal grades or program names were found on the website.'\n\n"
            "   TIER 4 - SCHOOL LEVEL INFERENCE (Fallback for K-12 Schools):\n"
            "     If explicit grade numbers are not listed on the website, but the school level is established (or current DB values already have grades):\n"
            "       - Elementary School: ['Kindergarten', '1st grade', '2nd grade', '3rd grade', '4th grade', '5th grade'] (include 'Pre-K 3', 'Pre-K 4' if Pre-K is mentioned)\n"
            "       - Middle School / Junior High: ['6th grade', '7th grade', '8th grade']\n"
            "       - High School / Senior High: ['9th grade', '10th grade', '11th grade', '12th grade']\n"
            "     If the current DB values already contain valid grades for this school, retain them as 'Verified correct' under Rule 2 rather than leaving them blank.\n"
            "     MANDATORY IN REASON: If you inferred grades from school classification, state: 'Inferred standard grade span based on verified school classification.'\n\n"
            "8. CRITICAL: AGE IN YEARS IS NEVER EQUAL TO GRADE NUMBER!\n"
            "   A 12-year-old child is in 6th Grade, NOT 12th Grade! 12th graders are 17-18 years old.\n"
            "   Age-to-Grade Reference Guide:\n"
            "     - Age 5 yrs  --> Kindergarten\n"
            "     - Age 6 yrs  --> 1st grade       - Age 10 yrs --> 5th grade\n"
            "     - Age 7 yrs  --> 2nd grade       - Age 11-12 yrs --> 6th grade\n"
            "     - Age 8 yrs  --> 3rd grade       - Age 13 yrs --> 7th grade\n"
            "     - Age 9 yrs  --> 4th grade       - Age 14 yrs --> 8th grade\n"
            "     - Ages 15-18 yrs --> 9th grade to 12th grade (High School)\n"
            "   Rule: If a website says 'Serving Pre-K to 12 years' or 'Ages 4 - 12', the output MUST end at 6th grade:\n"
            "   ['Pre-K 3', 'Pre-K 4', 'Kindergarten', '1st grade', '2nd grade', '3rd grade', '4th grade', '5th grade', '6th grade']\n"
            "   Do NOT include 7th through 12th grade unless the text explicitly states the words '12th grade' or 'High School'!\n"
            "9. WEBSITE RULE - SCHOOL-SPECIFIC SITES ONLY: If you find the website is a DISTRICT website (e.g., 'swisd.net') rather than a school-specific website, look for the school's specific page or subdomain. Always prefer recommending the school-specific site over the district homepage."
        )

        user_prompt = (
            f"School ID: {school_id}\n\n"
            f"Current Database Values (JSON):\n{json.dumps(current_data, indent=2, default=str)}\n\n"
            f"Extracted Website Text (truncated to 80,000 chars):\n{website_text[:80000]}...\n\n"
            "Please generate the DQAReport."
        )

        completion = self.openai_client.beta.chat.completions.parse(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format=DQAReport,
        )

        report = completion.choices[0].message.parsed
        return report
