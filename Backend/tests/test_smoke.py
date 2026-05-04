from __future__ import annotations

import sys
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import main


class BackendSmokeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(main.app)

    def test_health(self) -> None:
        response = self.client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["ok"], True)

    def test_provinces_load_from_cache(self) -> None:
        response = self.client.get("/api/areas/provinces")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["type"], "FeatureCollection")
        self.assertEqual(len(response.json()["features"]), 12)

    def test_municipalities_can_be_filtered_by_province(self) -> None:
        response = self.client.get("/api/areas/municipalities?province_statcode=PV24")

        self.assertEqual(response.status_code, 200)
        features = response.json()["features"]
        self.assertEqual(len(features), 6)
        self.assertTrue(
            all(f["properties"]["_pvstatcode"] == "PV24" for f in features)
        )

    def test_bag_pand_province_summary_uses_store(self) -> None:
        response = self.client.get("/api/bag/pand/summary?level=province&statcode=PV24")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["count"], 300971)

    def test_bag_pand_municipality_summary_uses_store(self) -> None:
        response = self.client.get(
            "/api/bag/pand/summary?level=municipality&statcode=GM0034"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["count"], 132547)

    @unittest.skipUnless(
        (main.ADMIN_WIJKEN_DIR / "0014.json").exists(),
        "cached wijk data for GM0014 is not available",
    )
    def test_cached_wijken_for_municipality(self) -> None:
        response = self.client.get("/api/areas/wijken?municipality_gmcode=0014")

        self.assertEqual(response.status_code, 200)
        self.assertGreater(len(response.json()["features"]), 0)

    @unittest.skipUnless(
        (main.ADMIN_BUURTEN_DIR / "0014.json").exists(),
        "cached buurt data for GM0014 is not available",
    )
    def test_cached_buurten_for_municipality(self) -> None:
        response = self.client.get("/api/areas/buurten?municipality_gmcode=0014")

        self.assertEqual(response.status_code, 200)
        self.assertGreater(len(response.json()["features"]), 0)


if __name__ == "__main__":
    unittest.main()
