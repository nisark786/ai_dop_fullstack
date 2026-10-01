"""Service package for promoting verified staging records into production tables."""

from app.services.promotion.school_promotion_service import SchoolPromotionService

__all__ = ["SchoolPromotionService"]
