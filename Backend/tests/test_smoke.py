from __future__ import annotations

import contextlib
import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from Backend import main
from Backend.paths import (
    ADMIN_BUURTEN_DIR,
    ADMIN_MUNICIPALITIES_BY_PROVINCE_DIR,
    ADMIN_WIJKEN_DIR,
    BAG_FEATURE_CACHE_DIR,
)


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

    def test_municipalities_for_province_uses_per_province_cache(self) -> None:
        response = self.client.get("/api/areas/municipalities?province_statcode=PV24")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["type"], "FeatureCollection")
        features = body["features"]
        self.assertEqual(len(features), 6)
        self.assertTrue(
            all(f["properties"]["_pvstatcode"] == "PV24" for f in features)
        )

        cache_file = ADMIN_MUNICIPALITIES_BY_PROVINCE_DIR / "PV24.json"
        self.assertTrue(cache_file.exists())

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

    def test_bag_feature_cache_skipped_for_province_level(self) -> None:
        cache_dir = BAG_FEATURE_CACHE_DIR / "pand" / "province"

        with patch(
            "Backend.main.fetch_all_features",
            new_callable=AsyncMock,
        ) as mock_fetch:
            mock_fetch.return_value = {"type": "FeatureCollection", "features": []}
            response = self.client.get(
                "/api/bag/pand?level=province&statcode=PV24"
            )

        self.assertEqual(response.status_code, 200)
        if cache_dir.exists():
            self.assertEqual(list(cache_dir.glob("*.json")), [])

    @unittest.skipUnless(
        (ADMIN_WIJKEN_DIR / "0014.json").exists(),
        "cached wijk data for GM0014 is not available",
    )
    def test_bag_feature_cache_round_trip_for_wijk(self) -> None:
        wijk_statcode = "WK001403"
        cache_file = BAG_FEATURE_CACHE_DIR / "pand" / "wijk" / f"{wijk_statcode}.json"

        def cleanup() -> None:
            with contextlib.suppress(FileNotFoundError):
                cache_file.unlink()

        cleanup()
        self.addCleanup(cleanup)

        fake_fc = {"type": "FeatureCollection", "features": []}

        with patch(
            "Backend.main.fetch_all_features",
            new_callable=AsyncMock,
        ) as mock_fetch:
            mock_fetch.return_value = fake_fc
            response = self.client.get(
                f"/api/bag/pand?level=wijk&statcode={wijk_statcode}"
            )

        self.assertEqual(response.status_code, 200)
        first_features = response.json()["features"]
        self.assertTrue(cache_file.exists())

        with patch(
            "Backend.main.fetch_all_features",
            new_callable=AsyncMock,
        ) as mock_fetch:
            mock_fetch.side_effect = AssertionError(
                "upstream should not be called when BAG feature cache exists"
            )
            response2 = self.client.get(
                f"/api/bag/pand?level=wijk&statcode={wijk_statcode}"
            )

        self.assertEqual(response2.status_code, 200)
        self.assertEqual(response2.json()["features"], first_features)

    @unittest.skipUnless(
        (ADMIN_WIJKEN_DIR / "0014.json").exists(),
        "cached wijk data for GM0014 is not available",
    )
    def test_cached_wijken_for_municipality(self) -> None:
        response = self.client.get("/api/areas/wijken?municipality_gmcode=0014")

        self.assertEqual(response.status_code, 200)
        self.assertGreater(len(response.json()["features"]), 0)

    @unittest.skipUnless(
        (ADMIN_BUURTEN_DIR / "0014.json").exists(),
        "cached buurt data for GM0014 is not available",
    )
    def test_cached_buurten_for_municipality(self) -> None:
        response = self.client.get("/api/areas/buurten?municipality_gmcode=0014")

        self.assertEqual(response.status_code, 200)
        self.assertGreater(len(response.json()["features"]), 0)

    def test_rebuild_endpoint_returns_404_when_disabled(self) -> None:
        # By default, settings.enable_rebuild_endpoint is False.
        # The route should respond with 404 like a nonexistent endpoint.
        response = self.client.post("/api/bag/pand/summary/rebuild")

        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
