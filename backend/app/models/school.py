"""
Backward compatibility re-export for School models.
"""

from app.models.schools import School, SchoolModel, Schools

__all__ = ["Schools", "School", "SchoolModel"]
