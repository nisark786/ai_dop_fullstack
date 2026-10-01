"""Generates standardized intake templates for Excel uploads."""

import io

import openpyxl


class TemplateGenerator:
    """Generates standard Excel template for batch intake."""

    @staticmethod
    def create_intake_template() -> bytes:
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "School Intake"

        ws.append(["Name", "Website", "Address", "District", "State"])
        ws.append(
            [
                "Sample High School",
                "https://www.samplehs.edu",
                "123 Main St",
                "Sample District",
                "TX",
            ]
        )

        output = io.BytesIO()
        wb.save(output)
        return output.getvalue()
