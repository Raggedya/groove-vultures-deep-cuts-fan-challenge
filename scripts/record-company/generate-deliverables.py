from __future__ import annotations

import csv
import json
import math
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import qrcode
import qrcode.image.svg
import zxingcpp
from openpyxl import Workbook
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
EXPORT = Path(sys.argv[1]) if len(sys.argv) > 1 else None
BASE_URL = (sys.argv[2] if len(sys.argv) > 2 else "").rstrip("/")
if not EXPORT or not EXPORT.exists() or not BASE_URL.startswith("https://"):
    raise SystemExit("Usage: generate-deliverables.py <build-export.json> <https://deep-cuts-base-url>")

def create_master(path: Path, company_name: str, items: list[dict], output_dir: Path) -> None:
    margin, cell, columns = 180, 650, min(5, max(1, len(items)))
    rows = math.ceil(len(items) / columns)
    width = max(3840, margin * 2 + columns * cell)
    header = 520
    height = header + rows * cell + margin
    image = Image.new("RGB", (width, height), "#080b12")
    draw = ImageDraw.Draw(image)
    title_font = font(118); sub_font = font(44); label_font = font(38)
    draw.text((width // 2, 110), company_name.upper(), fill="#f7f9fc", font=title_font, anchor="mm")
    draw.text((width // 2, 260), "DEEP CUTS — ARTIST DISCOVERY COLLECTION", fill="#61a9ff", font=sub_font, anchor="mm")
    draw.text((width // 2, 350), datetime.now().strftime("%d/%m/%Y"), fill="#aab6c8", font=font(26), anchor="mm")
    grid_width = columns * cell; x0 = (width - grid_width) // 2
    for index, item in enumerate(items):
        row, col = divmod(index, columns)
        cx, top = x0 + col * cell + cell // 2, header + row * cell
        qr = Image.open(output_dir / item["png"]).convert("RGB").resize((430, 430), Image.Resampling.NEAREST)
        qx, qy = cx - 215, top + 35
        if item["featured"]:
            draw.rounded_rectangle((qx - 22, qy - 22, qx + 452, qy + 522), 24, outline="#61a9ff", width=10)
        image.paste(qr, (qx, qy))
        label = wrap_label(item["label"], 25)
        draw.multiline_text((cx, qy + 465), label, fill="#f7f9fc", font=label_font, anchor="ma", align="center", spacing=5)
        crop = image.crop((qx, qy, qx + 430, qy + 430))
        decoded = zxingcpp.read_barcode(crop)
        if not decoded or decoded.text != item["trackingUrl"]:
            raise SystemExit(f"Master-grid scan verification failed for {item['label']}")
    image.save(path, format="PNG", optimize=False)


def write_csv_exports(output: Path, data: dict, qr_items: list[dict]) -> None:
    write_csv(output / "summary.csv", [{"Record Company": data["company"]["name"], "Source URL": data["company"]["official_url"], "Status": data["job"]["status"], "Started": data["job"]["started_at"], "Published Artists": len([a for a in data["artists"] if a["publication_status"] == "published"]), "Exceptions": len(data["exceptions"])}])
    write_csv(output / "artist-build-status.csv", data["artists"])
    write_csv(output / "exceptions.csv", data["exceptions"])
    write_csv(output / "qr-manifest.csv", qr_items)
    write_csv(output / "links.csv", data["links"])
    write_csv(output / "sources.csv", data["sources"])
    (output / "qr-manifest.json").write_text(json.dumps(qr_items, indent=2) + "\n", encoding="utf-8")


def write_xlsx(path: Path, data: dict, qr_items: list[dict]) -> None:
    workbook = Workbook(); workbook.remove(workbook.active)
    sheets = {
        "Summary": [{"Record Company": data["company"]["name"], "Source URL": data["company"]["official_url"], "Published Artists": len([a for a in data["artists"] if a["publication_status"] == "published"]), "Exceptions": len(data["exceptions"])}],
        "Record Company": [data["company"]], "Artist Build Status": data["artists"],
        "Published Artists": [a for a in data["artists"] if a["publication_status"] == "published"],
        "Exceptions": data["exceptions"], "QR Manifest": qr_items, "Button Links": data["links"],
        "Quiz Results": [], "Discovery Journeys": [], "Link Health": data["links"], "Sources": data["sources"],
    }
    for title, rows in sheets.items():
        sheet = workbook.create_sheet(title[:31])
        flattened = [flatten(row) for row in rows]
        headers = sorted({key for row in flattened for key in row}) if flattened else ["No data yet"]
        sheet.append(headers)
        for row in flattened: sheet.append([row.get(header, "") for header in headers])
        sheet.freeze_panes = "A2"
        for column in sheet.columns:
            letter = column[0].column_letter
            sheet.column_dimensions[letter].width = min(55, max(12, max(len(str(cell.value or "")) for cell in column) + 2))
    workbook.save(path)


def write_csv(path: Path, rows: list[dict]) -> None:
    flat = [flatten(row) for row in rows]
    headers = sorted({key for row in flat for key in row}) if flat else ["status"]
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=headers)
        writer.writeheader()
        for row in flat: writer.writerow(row)


def flatten(row: dict) -> dict:
    return {key: json.dumps(value, ensure_ascii=False) if isinstance(value, (dict, list)) else value for key, value in row.items()}


def font(size: int):
    candidates = [Path("C:/Windows/Fonts/arialbd.ttf"), Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")]
    selected = next((path for path in candidates if path.exists()), None)
    return ImageFont.truetype(str(selected), size) if selected else ImageFont.load_default(size=size)


def safe_name(value: str) -> str:
    return "".join(char.lower() if char.isalnum() else "-" for char in value).strip("-")[:80] or "artist"


def wrap_label(value: str, length: int) -> str:
    words, lines, line = value.split(), [], ""
    for word in words:
        candidate = f"{line} {word}".strip()
        if len(candidate) > length and line: lines.append(line); line = word
        else: line = candidate
    if line: lines.append(line)
    return "\n".join(lines[:3])


def main() -> None:
    bundle = json.loads(EXPORT.read_text(encoding="utf-8"))
    output = EXPORT.parent
    company = bundle["company"]
    published = sorted(
        [artist for artist in bundle["artists"] if artist["publication_status"] == "published"],
        key=lambda artist: artist["name"].casefold(),
    )
    qrs_by_entity = {(item["entity_type"], item["entity_id"]): item for item in bundle["qrs"]}
    entities = [("record_company", company["record_company_id"], company["name"], True)]
    entities += [("artist", artist["artist_id"], artist["name"], False) for artist in published]
    qr_dir = output / "qr"
    qr_dir.mkdir(parents=True, exist_ok=True)
    manifest_qrs = []
    for entity_type, entity_id, label, featured in entities:
        row = qrs_by_entity[(entity_type, entity_id)]
        tracking_url = f"{BASE_URL}/record-company/q/{row['tracking_code']}"
        stem = "record-company" if featured else safe_name(label)
        png_path, svg_path = qr_dir / f"{stem}.png", qr_dir / f"{stem}.svg"
        qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=14, border=4)
        qr.add_data(tracking_url); qr.make(fit=True)
        image = qr.make_image(fill_color="black", back_color="white").convert("RGB")
        image.save(png_path, format="PNG", optimize=False)
        svg = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=12, border=4)
        svg.add_data(tracking_url); svg.make(fit=True)
        svg.make_image(image_factory=qrcode.image.svg.SvgPathImage).save(svg_path)
        decoded = zxingcpp.read_barcode(image)
        if not decoded or decoded.text != tracking_url:
            raise SystemExit(f"QR verification failed for {label}")
        manifest_qrs.append({"entityType": entity_type, "entityId": entity_id, "label": label, "trackingUrl": tracking_url, "png": str(png_path.relative_to(output)).replace("\\", "/"), "svg": str(svg_path.relative_to(output)).replace("\\", "/"), "verified": True, "featured": featured})

    master_name = f"{company['slug']}-deep-cuts-qr-collection.png"
    create_master(output / master_name, company["name"], manifest_qrs, output)
    write_csv_exports(output, bundle, manifest_qrs)
    xlsx_name = f"{company['slug']}-deep-cuts-report.xlsx"
    write_xlsx(output / xlsx_name, bundle, manifest_qrs)
    zip_name = f"{company['slug']}-deep-cuts-reporting.zip"
    with zipfile.ZipFile(output / zip_name, "w", zipfile.ZIP_DEFLATED) as archive:
        for file in sorted(output.glob("*.csv")):
            archive.write(file, file.name)
        archive.write(output / "qr-manifest.json", "qr-manifest.json")
    manifest = {
        "version": 1, "recordCompany": company["name"], "recordCompanySlug": company["slug"],
        "generatedAt": datetime.now(timezone.utc).isoformat(), "masterQrFile": master_name,
        "xlsxFile": xlsx_name, "reportingZipFile": zip_name, "masterQrVerified": True,
        "reportsReconciled": bundle["reconciliation"]["valid"], "qrCodes": manifest_qrs,
    }
    (output / "delivery-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest))


if __name__ == "__main__":
    main()
