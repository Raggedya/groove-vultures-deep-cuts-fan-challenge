from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOLS_PYTHON = Path(os.environ.get("DEEP_CUTS_PYTHON_TARGET", ROOT / ".tools" / "python")).resolve()
sys.path.insert(0, str(TOOLS_PYTHON))

try:
    from PIL import Image
    import zxingcpp
except ModuleNotFoundError as error:
    raise SystemExit(
        "Delivery-artwork verification dependencies are unavailable. "
        "Install requirements.txt with the same Python interpreter first."
    ) from error


def main() -> None:
    arguments = parse_arguments()
    platform = json.loads((ROOT / "platform.json").read_text(encoding="utf-8"))
    editions = [item for item in platform["editions"] if item.get("active")]
    if arguments.slug:
        editions = [item for item in editions if item["slug"] == arguments.slug]
        if not editions:
            raise SystemExit(f"Unknown active edition: {arguments.slug}")

    for index, edition in enumerate(editions, start=1):
        verify_edition(platform, edition)
        print(f"[{index}/{len(editions)}] VERIFIED — {edition['slug']}")
    print(f"Delivery artwork verification passed for {len(editions)} active edition(s).")


def verify_edition(platform: dict, edition: dict) -> None:
    slug = edition["slug"]
    output = ROOT / "output" / slug
    manifest_path = output / "delivery-manifest.json"
    if not manifest_path.is_file():
        fail(slug, "delivery-manifest.json is missing")

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    config = json.loads((ROOT / edition["config"]).read_text(encoding="utf-8"))
    expected_url = f"{platform['publicBaseURL'].rstrip('/')}/q/{edition['editionId']}"
    if manifest.get("slug") != slug:
        fail(slug, "manifest slug does not match the edition")
    if manifest.get("bandName") != config.get("bandName"):
        fail(slug, "manifest band name does not match the edition")
    if manifest.get("publicURL") != expected_url:
        fail(slug, f"manifest destination must be {expected_url}")

    instagram = verify_image(slug, manifest, "instagramImage", (1080, 1080))
    if config.get("editionType") == "bar_jukebox":
        qr_size = (1920, 1080)
    elif config.get("editionType") == "jukebox" and config.get("jookBox", {}).get("qrArtworkVariant") == "aggits-character-poster/1":
        qr_size = (1254, 1254)
    else:
        qr_size = (1080, 1080)
    qr_image = verify_image(slug, manifest, "qrImage", qr_size)
    if instagram == qr_image:
        fail(slug, "discovery and QR artwork paths must remain distinct")

    verify_qr(slug, qr_image, expected_url, compact_required=qr_size == (1254, 1254))


def verify_image(slug: str, manifest: dict, key: str, expected_size: tuple[int, int]) -> Path:
    record = manifest.get("files", {}).get(key)
    if not isinstance(record, dict):
        fail(slug, f"manifest file record {key} is missing")
    relative = str(record.get("path", "")).replace("\\", "/")
    expected_prefix = f"output/{slug}/"
    if not relative.startswith(expected_prefix):
        fail(slug, f"{key} must remain inside {expected_prefix}")
    path = (ROOT / relative).resolve()
    if ROOT not in path.parents or not path.is_file():
        fail(slug, f"{key} file is missing")
    with Image.open(path) as image:
        if image.size != expected_size:
            fail(slug, f"{key} must be {expected_size[0]} × {expected_size[1]}")
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if digest != record.get("sha256"):
        fail(slug, f"{key} SHA-256 does not match its manifest")
    if record.get("width") != expected_size[0] or record.get("height") != expected_size[1]:
        fail(slug, f"{key} manifest dimensions are incorrect")
    return path


def verify_qr(slug: str, path: Path, expected_url: str, compact_required: bool = False) -> None:
    with Image.open(path) as image:
        original = zxingcpp.read_barcode(image)
        reduced_size = (960, 540) if image.width > image.height else (540, 540)
        reduced = zxingcpp.read_barcode(image.resize(reduced_size, Image.Resampling.LANCZOS))
        compact = (
            zxingcpp.read_barcode(image.resize((360, 360), Image.Resampling.LANCZOS))
            if compact_required
            else None
        )
    if original is None or original.text != expected_url:
        fail(slug, "full-size QR scan-back failed")
    if reduced is None or reduced.text != expected_url:
        fail(slug, "reduced-size QR scan-back failed")
    if compact_required and (compact is None or compact.text != expected_url):
        fail(slug, "compact-phone QR scan-back failed")


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Verify cached Deep Cuts delivery artwork.")
    parser.add_argument("--slug", help="Verify one active edition instead of the complete registry.")
    return parser.parse_args()


def fail(slug: str, message: str) -> None:
    raise SystemExit(f"{slug}: {message}.")


if __name__ == "__main__":
    main()
