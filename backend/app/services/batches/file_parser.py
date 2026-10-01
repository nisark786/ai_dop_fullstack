"""Excel and CSV file parser for Batch Intake.

Pure parsing logic with zero database dependencies.
"""

import csv
import io
from typing import Any

import openpyxl

MAX_INTAKE_ROWS = 5_000
MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB


class BatchFileParser:
    """Parses Excel and CSV files without database dependencies."""

    @staticmethod
    def parse_excel(contents: bytes) -> list[dict[str, Any]]:
        wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
        sheet = wb.active
        rows = list(sheet.iter_rows(values_only=True))
        if not rows or len(rows) < 2:
            return []

        headers = [str(h).strip().lower() if h else "" for h in rows[0]]
        parsed_data = []
        for row in rows[1:]:
            if all(cell is None for cell in row):
                continue
            row_dict = {}
            for col_idx, header in enumerate(headers):
                if not header:
                    continue
                val = row[col_idx] if col_idx < len(row) else None
                row_dict[header] = str(val).strip() if val is not None else None
            parsed_data.append(row_dict)
        return parsed_data

    @staticmethod
    def parse_csv(contents: bytes) -> list[dict[str, Any]]:
        text_data = contents.decode("utf-8-sig", errors="replace")
        reader = csv.DictReader(io.StringIO(text_data))
        parsed_data = []
        for row in reader:
            if not any(row.values()):
                continue
            cleaned_row = {
                (k.strip().lower() if k else ""): (v.strip() if v else None) for k, v in row.items()
            }
            parsed_data.append(cleaned_row)
        return parsed_data
