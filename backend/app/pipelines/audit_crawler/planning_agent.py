import json
import logging
from urllib.parse import urlparse

from tavily import TavilyClient

from app.core.config import settings
from app.cost_tracking.client import CostTrackingOpenAIClient
from app.pipelines.audit_crawler.rate_limiter import tavily_limiter
from app.pipelines.audit_crawler.schemas import (
    CampusChoice,
    SchemaKnowledgeBase,
    TargetPlan,
    WebsiteSelection,
)

logger = logging.getLogger(__name__)

DIRECTORY_DOMAINS = [
    "facebook.com",
    "fb.com",
    "greatschools.org",
    "niche.com",
    "yelp.com",
    "schooldigger.com",
    "privateschoolreview.com",
    "yellowpages.com",
    "mapquest.com",
    "winnie.com",
]


def is_directory_or_aggregator_url(url: str | None) -> bool:
    """Checks if a URL belongs to a directory, aggregator, or social network

    that should be replaced with the school's actual official portal.
    """
    if not url:
        return False
    url_lower = url.lower()
    return any(domain in url_lower for domain in DIRECTORY_DOMAINS)


class PlanningAgent:
    """Planning Agent:

    1. Detects aggregators or missing URLs and uses Tavily + configured LLM to discover official school websites.
    2. Detects generic ISD district portals and discovers campus-specific subpages.
    3. Maps website subpages to find high-yield URLs (Admissions, Academics, Tuition, Early Childhood).
    4. Produces a TargetPlan selecting the top 3-5 pages for targeted scraping.
    """

    def __init__(self):
        self.openai_client = CostTrackingOpenAIClient()
        self.tavily_client = TavilyClient(api_key=settings.tavily_api_key)

    def is_district_portal(self, url: str) -> bool:
        """Checks if a URL belongs to a school district portal rather than a specific campus."""
        if not url:
            return False
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        if domain.startswith("www."):
            domain = domain[4:]
        path = parsed.path.strip("/")

        # If it has a specific campus subdomain (e.g. spicewoodpark.swisd.net), it is already campus-specific
        domain_parts = domain.split(".")
        if len(domain_parts) > 2 and domain_parts[0] not in ["www", "mail", "portal", "district"]:
            return False

        district_indicators = ["isd", "district", "schools.net", "k12.tx.us"]
        is_district_domain = any(ind in domain for ind in district_indicators)
        is_root_or_generic = path == "" or path in ["home", "default.aspx", "index.html", "main"]
        return is_district_domain and is_root_or_generic

    def find_campus_in_isd_directory(self, district_url: str, school_name: str) -> str | None:
        """Crawls the district directory using Tavily scoped to the district domain

        to locate the exact campus-specific URL or subdomain for the school.
        """
        try:
            domain = urlparse(district_url).netloc
            if domain.startswith("www."):
                domain = domain[4:]

            if not domain:
                return None

            query = f'"{school_name}" schools campuses directory'
            tavily_limiter.wait()
            response = self.tavily_client.search(
                query=query,
                include_domains=[domain],
                search_depth="advanced",
                max_results=10,
            )

            results = response.get("results", [])
            if not results:
                return None

            system_prompt = (
                "You are an expert school data assistant finding the specific campus URL for a school within a district website.\n"
                "Given search results from the district's website, identify the URL that belongs specifically to the individual campus.\n"
                "Rules:\n"
                "1. Choose the school's specific subdomain (e.g., 'spicewoodpark.swisd.net') or subpath (e.g., 'schools.saisd.net/page/023.homepage' or 'nisd.net/may').\n"
                "2. DO NOT return the district homepage itself (e.g., 'swisd.net' or 'saisd.net').\n"
                "3. If none of the results belong specifically to this campus, return null."
            )

            user_prompt = f"Target Campus Name: {school_name}\nDistrict Domain: {domain}\nSearch Results:\n{json.dumps(results, indent=2)}"

            completion = self.openai_client.beta.chat.completions.parse(
                model=settings.openai_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                response_format=CampusChoice,
            )

            campus_url = completion.choices[0].message.parsed.campus_url
            if campus_url:
                logger.info("Resolved campus URL: %s", campus_url)
            return campus_url

        except Exception as err:
            logger.error("Error finding campus in district directory: %s", err)
            return None

    def map_website(self, url: str) -> list[str]:
        """Uses Tavily to run a targeted site-search to find key subpages instantly.

        Includes early childhood, daycare, and classroom keywords.
        """
        try:
            domain = urlparse(url).netloc
            if domain.startswith("www."):
                domain = domain[4:]

            if not domain:
                return [url]

            tavily_limiter.wait()
            response = self.tavily_client.search(
                query="admissions academics tuition contact about programs infant toddler preschool early childhood classrooms ages",
                include_domains=[domain],
                search_depth="advanced",
                max_results=15,
            )
            discovered = [r.get("url") for r in response.get("results", []) if r.get("url")]

            if not discovered:
                return [url]

            # Always ensure the homepage is included
            if url not in discovered:
                discovered.insert(0, url)

            return discovered
        except Exception as err:
            logger.warning("Tavily subpage discovery warning for %s: %s", url, err)
            return [url]

    def find_correct_website(self, school_name: str, address: str, email: str = "") -> str | None:
        """Searches Tavily to find the correct official website if the database one is wrong.

        Uses multi-step search, email domain matching, and LLM structured choice.
        """
        try:
            email_domain = ""
            if email and "@" in email:
                domain_part = email.split("@")[1].strip().lower()
                generic_domains = {
                    "gmail.com",
                    "yahoo.com",
                    "hotmail.com",
                    "outlook.com",
                    "aol.com",
                    "icloud.com",
                    "msn.com",
                    "sbcglobal.net",
                    "att.net",
                    "comcast.net",
                }
                if domain_part not in generic_domains and "." in domain_part:
                    email_domain = domain_part

            if email_domain:
                query = f'"{school_name}" "{email_domain}" {address}'
            else:
                query = f'"{school_name}" {address} official school website'

            tavily_limiter.wait()
            response = self.tavily_client.search(
                query=query, search_depth="advanced", max_results=15
            )

            results = response.get("results", [])

            # Fallback if 0 results: broader location search
            if not results:
                addr_parts = [p.strip() for p in address.split(",") if p.strip()]
                city_context = addr_parts[-2] if len(addr_parts) >= 2 else "Texas"
                broad_query = f'"{school_name}" {city_context} school'
                tavily_limiter.wait()
                fallback_resp = self.tavily_client.search(
                    query=broad_query, search_depth="advanced", max_results=15
                )
                results = fallback_resp.get("results", [])

            if not results:
                return None

            system_prompt = (
                "You are a strict Data QA assistant finding the official website for a school or daycare. "
                "You will be given search results for a school name and address. Your job is to select the OFFICIAL website. "
                "CRITICAL RULES:\n"
                "1. DO NOT select directory sites, review sites, aggregators, or maps (e.g., GreatSchools, Facebook, Yelp, Niche, SchoolDigger, PrivateSchoolReview, Maptons, Mapquest, YellowPages, Winnie). These are NOT official school websites.\n"
                "2. PREFER SCHOOL-SPECIFIC SITES: If you see both a district website and a school-specific page or subdomain (e.g., 'elementary.swisd.net', 'schools.saisd.net/page/123'), choose the school-specific site. District homepages are only acceptable if no school-specific alternative exists.\n"
                "3. MUST MATCH LOCATION: You must verify that the website you choose belongs to the exact school at the provided address/city. If a search result is for a similarly named school in a completely different city or state, DO NOT pick it.\n"
                "4. If you cannot confidently confirm the website belongs to the exact school requested, you MUST return null. False positives are unacceptable."
            )

            user_prompt = f"School Name: {school_name}\nAddress: {address}\n\nSearch Results:\n{json.dumps(results, indent=2)}"

            completion = self.openai_client.beta.chat.completions.parse(
                model=settings.openai_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                response_format=WebsiteSelection,
            )

            return completion.choices[0].message.parsed.official_url

        except Exception as err:
            logger.warning("Tavily search error for %s: %s", school_name, err)
            return None

    def create_execution_plan(
        self,
        school_id: str,
        sitemap_urls: list[str],
        schema_kb_or_fields: SchemaKnowledgeBase | list[str],
    ) -> TargetPlan:
        """Asks configured LLM to select top 3-5 URLs from sitemap to satisfy schema fields."""
        if isinstance(schema_kb_or_fields, SchemaKnowledgeBase):
            fields_desc = {
                name: {"type": f.type, "description": f.description}
                for name, f in schema_kb_or_fields.fields.items()
            }
            fields_context = f"Database Fields to Verify:\n{json.dumps(fields_desc, indent=2)}"
        else:
            fields_context = f"Fields to verify: {', '.join(schema_kb_or_fields)}"

        system_prompt = (
            "You are the Planning Agent for a School Data Quality Assurance system.\n"
            "Your job is to look at a list of URLs from a school's website and select the top 3 to 5 URLs "
            "that are most likely to contain the information needed to verify the database fields.\n\n"
            "Rules:\n"
            "1. Only select URLs that exist in the provided sitemap.\n"
            "2. Prioritize pages like 'About', 'Admissions', 'Academics', 'Special Education', 'Contact' depending on the fields.\n"
            "3. Always include the homepage (usually the shortest URL) as a baseline.\n"
            "4. Do NOT look for data that is not in the schema."
        )

        user_prompt = (
            f"School ID: {school_id}\n\n"
            f"{fields_context}\n\n"
            f"Available Sitemap URLs:\n{json.dumps(sitemap_urls, indent=2)}\n\n"
            "Select the best URLs to scrape."
        )

        completion = self.openai_client.beta.chat.completions.parse(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format=TargetPlan,
        )

        return completion.choices[0].message.parsed
