import json
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
GENERATOR = ROOT / "scripts" / "record-company" / "generate-deliverables.py"


def main():
    with tempfile.TemporaryDirectory(prefix="deep-cuts-record-company-") as directory:
        output = Path(directory) / "midnight-harbour-records"
        output.mkdir()
        bundle = {
            "company": {
                "id": "company-1",
                "record_company_id": "company-1",
                "name": "Midnight Harbour Records",
                "slug": "midnight-harbour-records",
                "official_url": "https://midnightharbour.example/",
            },
            "job": {"job_id": "job-1", "status": "ready_for_delivery", "started_at": "2026-07-25T00:00:00Z"},
            "artists": [
                {
                    "artist_id": "artist-2",
                    "record_company_id": "company-1",
                    "name": "Paper Moons",
                    "slug": "paper-moons",
                    "publication_status": "published",
                    "confidence_score": 0.99,
                },
                {
                    "artist_id": "artist-1",
                    "record_company_id": "company-1",
                    "name": "Neon Tide",
                    "slug": "neon-tide",
                    "publication_status": "published",
                    "confidence_score": 0.99,
                },
            ],
            "links": [],
            "sources": [],
            "exceptions": [],
            "qrs": [
                {
                    "entity_type": "record_company",
                    "entity_id": "company-1",
                    "tracking_code": "label-code",
                    "destination_url": "https://deep-cuts.example/record-company/midnight-harbour-records",
                },
                {
                    "entity_type": "artist",
                    "entity_id": "artist-1",
                    "tracking_code": "neon-code",
                    "destination_url": "https://deep-cuts.example/record-company/midnight-harbour-records/artists/neon-tide",
                },
                {
                    "entity_type": "artist",
                    "entity_id": "artist-2",
                    "tracking_code": "paper-code",
                    "destination_url": "https://deep-cuts.example/record-company/midnight-harbour-records/artists/paper-moons",
                },
            ],
            "reconciliation": {
                "valid": True,
                "publishedArtists": 2,
                "publishedArtistQrCodes": 2,
                "companyQrCodes": 1,
            },
        }
        export_path = output / "build-export.json"
        export_path.write_text(json.dumps(bundle), encoding="utf-8")
        subprocess.run(
            [sys.executable, str(GENERATOR), str(export_path), "https://deep-cuts.example"],
            check=True,
        )

        manifest = json.loads((output / "delivery-manifest.json").read_text(encoding="utf-8"))
        assert manifest["masterQrVerified"] is True
        assert manifest["reportsReconciled"] is True
        assert [item["label"] for item in manifest["qrCodes"]] == [
            "Midnight Harbour Records",
            "Neon Tide",
            "Paper Moons",
        ]
        assert all(item["verified"] is True for item in manifest["qrCodes"])
        assert (output / "midnight-harbour-records-deep-cuts-qr-collection.png").exists()
        assert (output / "midnight-harbour-records-deep-cuts-report.xlsx").exists()
        assert (output / "midnight-harbour-records-deep-cuts-reporting.zip").exists()
        with Image.open(output / "midnight-harbour-records-deep-cuts-qr-collection.png") as image:
            assert image.width >= 3840
            assert image.format == "PNG"
        print("Record Company deliverables test passed: individual and master QR codes decoded, labels sorted, UHD PNG/XLSX/ZIP created.")


if __name__ == "__main__":
    main()
