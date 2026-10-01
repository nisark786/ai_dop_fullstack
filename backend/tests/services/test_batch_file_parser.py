"""
Unit tests for BatchFileParser (pure parsing logic with zero database dependencies).

Service:
    app.services.batches.file_parser.BatchFileParser
"""

import io

import openpyxl

from app.services.batches.file_parser import BatchFileParser


class TestBatchFileParserCSV:
    """Tests for BatchFileParser.parse_csv."""

    def test_parse_csv_valid_content(self) -> None:
        """Parses basic CSV bytes into lowercased dictionary rows."""
        csv_bytes = (
            b"Name,Website,Address,District\nOak Academy,https://oak.edu,123 Main St,Austin ISD\n"
        )
        results = BatchFileParser.parse_csv(csv_bytes)

        assert len(results) == 1
        assert results[0] == {
            "name": "Oak Academy",
            "website": "https://oak.edu",
            "address": "123 Main St",
            "district": "Austin ISD",
        }

    def test_parse_csv_handles_utf8_bom(self) -> None:
        """UTF-8-SIG byte order mark is stripped without corrupting the first header."""
        csv_bytes = "\ufeffName,City\nPine School,Dallas\n".encode("utf-8")
        results = BatchFileParser.parse_csv(csv_bytes)

        assert len(results) == 1
        assert "name" in results[0]
        assert results[0]["name"] == "Pine School"
        assert results[0]["city"] == "Dallas"

    def test_parse_csv_strips_whitespace(self) -> None:
        """Leading and trailing whitespace on headers and values is trimmed."""
        csv_bytes = b"  School Name  ,  State  \n   Cedar Prep   ,   TX   \n"
        results = BatchFileParser.parse_csv(csv_bytes)

        assert len(results) == 1
        assert "school name" in results[0]
        assert results[0]["school name"] == "Cedar Prep"
        assert results[0]["state"] == "TX"

    def test_parse_csv_skips_empty_rows(self) -> None:
        """Blank lines in CSV are excluded from results."""
        csv_bytes = b"name,state\nSchool 1,TX\n\n\nSchool 2,CA\n"
        results = BatchFileParser.parse_csv(csv_bytes)

        assert len(results) == 2
        assert results[0]["name"] == "School 1"
        assert results[1]["name"] == "School 2"

    def test_parse_csv_empty_content_returns_empty_list(self) -> None:
        """Empty or headerless CSV bytes return an empty list."""
        assert BatchFileParser.parse_csv(b"") == []
        assert BatchFileParser.parse_csv(b"\n\n") == []


class TestBatchFileParserExcel:
    """Tests for BatchFileParser.parse_excel."""

    def _create_xlsx_bytes(self, rows: list[list]) -> bytes:
        """Helper to create XLSX binary bytes from 2D data list."""
        wb = openpyxl.Workbook()
        ws = wb.active
        for row in rows:
            ws.append(row)
        buf = io.BytesIO()
        wb.save(buf)
        return buf.getvalue()

    def test_parse_excel_valid_rows(self) -> None:
        """Parses valid Excel rows into lowercased dictionaries."""
        data = [
            ["Name", "Website", "District"],
            ["Maple High", "https://maple.org", "Houston ISD"],
            ["Birch Middle", "https://birch.org", "Dallas ISD"],
        ]
        xlsx_bytes = self._create_xlsx_bytes(data)
        results = BatchFileParser.parse_excel(xlsx_bytes)

        assert len(results) == 2
        assert results[0] == {
            "name": "Maple High",
            "website": "https://maple.org",
            "district": "Houston ISD",
        }
        assert results[1]["name"] == "Birch Middle"

    def test_parse_excel_skips_blank_rows(self) -> None:
        """Rows where all cells are None are skipped."""
        data = [
            ["Name", "Address"],
            ["School Alpha", "100 Road"],
            [None, None],
            ["School Beta", "200 Road"],
        ]
        xlsx_bytes = self._create_xlsx_bytes(data)
        results = BatchFileParser.parse_excel(xlsx_bytes)

        assert len(results) == 2
        assert results[0]["name"] == "School Alpha"
        assert results[1]["name"] == "School Beta"

    def test_parse_excel_header_only_returns_empty_list(self) -> None:
        """Excel with only header row returns an empty list."""
        data = [["Name", "Address", "City"]]
        xlsx_bytes = self._create_xlsx_bytes(data)
        results = BatchFileParser.parse_excel(xlsx_bytes)

        assert results == []

    def test_parse_excel_empty_workbook_returns_empty_list(self) -> None:
        """Completely empty workbook returns empty list."""
        xlsx_bytes = self._create_xlsx_bytes([])
        results = BatchFileParser.parse_excel(xlsx_bytes)
        assert results == []
