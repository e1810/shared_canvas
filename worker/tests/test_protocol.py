import json
import unittest

from src.protocol import cell_storage_key, parse_draw_message


class ParseDrawMessageTest(unittest.TestCase):
    def test_accepts_valid_draw_and_ignores_client_timestamp(self):
        value = json.dumps(
            {
                "type": "draw",
                "x": 12,
                "y": 34,
                "color": "#ff0000",
                "updatedAt": 1,
            }
        )

        self.assertEqual(
            parse_draw_message(value),
            {"type": "draw", "x": 12, "y": 34, "color": "#ff0000"},
        )

    def test_rejects_invalid_inputs(self):
        values = [
            "not json",
            json.dumps({"type": "erase", "x": 1, "y": 2, "color": "#fff"}),
            json.dumps({"type": "draw", "x": -1, "y": 0, "color": "#fff"}),
            json.dumps({"type": "draw", "x": 128, "y": 0, "color": "#fff"}),
            json.dumps({"type": "draw", "x": 0, "y": 128, "color": "#fff"}),
            json.dumps({"type": "draw", "x": 1.5, "y": 2, "color": "#fff"}),
            json.dumps({"type": "draw", "x": True, "y": 2, "color": "#fff"}),
            json.dumps({"type": "draw", "x": 1, "y": 2, "color": ""}),
        ]

        for value in values:
            with self.subTest(value=value):
                self.assertIsNone(parse_draw_message(value))


class CellStorageKeyTest(unittest.TestCase):
    def test_sorts_cells_by_row_then_column(self):
        keys = [
            cell_storage_key(10, 1),
            cell_storage_key(2, 10),
            cell_storage_key(2, 1),
        ]

        self.assertEqual(
            sorted(keys),
            ["cell:001:002", "cell:001:010", "cell:010:002"],
        )


if __name__ == "__main__":
    unittest.main()
