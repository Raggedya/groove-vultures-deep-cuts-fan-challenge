from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
local_packages = ROOT / ".tools" / "python"
if local_packages.exists() and str(local_packages) not in sys.path:
    # Append rather than prepend so a managed runtime can use its readable,
    # maintained packages before the optional project-local fallback.
    sys.path.append(str(local_packages))

from PIL import Image, ImageDraw, ImageFilter, ImageFont

SIZE = 1080
WHITE = (245, 249, 255)
BLUE = (47, 128, 255)


def load_edition(slug: str) -> dict:
    platform = json.loads((ROOT / "platform.json").read_text(encoding="utf-8"))
    entry = next((item for item in platform["editions"] if item["slug"] == slug and item.get("active")), None)
    if not entry:
        raise SystemExit(f"Unknown active edition: {slug}")
    return json.loads((ROOT / entry["config"]).read_text(encoding="utf-8"))


def font(size: int) -> ImageFont.FreeTypeFont:
    candidates = [Path("C:/Windows/Fonts/arialbd.ttf"), Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default(size=size)


def fit_font(draw: ImageDraw.ImageDraw, text: str, max_width: int, start: int, minimum: int = 36) -> ImageFont.FreeTypeFont:
    for size in range(start, minimum - 1, -2):
        candidate = font(size)
        if draw.textbbox((0, 0), text, font=candidate)[2] <= max_width:
            return candidate
    return font(minimum)


def background() -> Image.Image:
    image = Image.new("RGB", (SIZE, SIZE))
    pixels = image.load()
    for y in range(SIZE):
        for x in range(SIZE):
            dx = (x - SIZE / 2) / (SIZE / 2)
            dy = (y - SIZE * 0.46) / (SIZE / 2)
            radius = min(1.0, (dx * dx + dy * dy) ** 0.5)
            vertical = y / SIZE
            blue = int(31 * (1 - radius) + 7 * radius + 8 * (1 - vertical))
            pixels[x, y] = (1 + int(4 * (1 - radius)), 5 + int(12 * (1 - radius)), min(54, blue + 12))
    glow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    draw.ellipse((170, 140, 910, 960), fill=(20, 91, 220, 74))
    glow = glow.filter(ImageFilter.GaussianBlur(90))
    return Image.alpha_composite(image.convert("RGBA"), glow)


def aggits_crop(source: Image.Image, fraction: float) -> Image.Image:
    bbox = source.getbbox()
    if not bbox:
        raise SystemExit("Aggits master has no visible pixels.")
    left, top, right, bottom = bbox
    crop_bottom = top + int((bottom - top) * fraction)
    return source.crop((left, top, right, crop_bottom))


def contain(image: Image.Image, width: int, height: int) -> Image.Image:
    copy = image.copy()
    copy.thumbnail((width, height), Image.Resampling.LANCZOS)
    return copy


def centred_text(draw: ImageDraw.ImageDraw, text: str, y: int, selected_font: ImageFont.FreeTypeFont, fill=WHITE, stroke=0) -> None:
    box = draw.textbbox((0, 0), text, font=selected_font, stroke_width=stroke)
    x = (SIZE - (box[2] - box[0])) // 2
    draw.text((x, y), text, font=selected_font, fill=fill, stroke_width=stroke, stroke_fill=(2, 9, 23))


def create_instagram(config: dict, aggits: Image.Image, destination: Path) -> None:
    canvas = background()
    draw = ImageDraw.Draw(canvas)
    name = config["bandName"].upper()
    name_font = fit_font(draw, name, 930, 112, 54)
    centred_text(draw, name, 62, name_font, stroke=2)
    draw.rounded_rectangle((100, 192, 980, 197), radius=2, fill=(68, 143, 255, 125))

    portrait = contain(aggits_crop(aggits, 0.64), 790, 760)
    canvas.alpha_composite(portrait, ((SIZE - portrait.width) // 2, 218))

    footer = Image.new("RGBA", (SIZE, 154), (1, 6, 16, 214))
    canvas.alpha_composite(footer, (0, SIZE - 154))
    draw = ImageDraw.Draw(canvas)
    challenge_font = fit_font(draw, "OFFICIAL FAN CHALLENGE", 820, 54, 38)
    centred_text(draw, "OFFICIAL FAN CHALLENGE", 961, challenge_font, fill=(173, 210, 255), stroke=1)
    canvas.convert("RGB").save(destination, "PNG", optimize=True)


def create_qr(config: dict, aggits: Image.Image, destination: Path) -> None:
    url = config["publicURL"]
    node = os.environ.get("DEEP_CUTS_NODE", "node")
    result = subprocess.run([node, str(ROOT / "scripts" / "qr-matrix.cjs"), url], cwd=ROOT, check=True, capture_output=True, text=True)
    matrix = json.loads(result.stdout)
    border = 4
    count = len(matrix) + border * 2
    module = 314 // count
    qr_size = module * count
    qr_image = Image.new("RGBA", (qr_size, qr_size), (255, 255, 255, 255))
    qr_draw = ImageDraw.Draw(qr_image)
    for row, values in enumerate(matrix):
        for column, dark in enumerate(values):
            if dark:
                x = (column + border) * module
                y = (row + border) * module
                qr_draw.rectangle((x, y, x + module - 1, y + module - 1), fill=(2, 7, 17, 255))

    approved = Image.open(ROOT / "assets" / "aggits-qr-holder-approved.png").convert("RGBA")
    approved = approved.resize((SIZE, 1440), Image.Resampling.LANCZOS)
    canvas = background()
    # Discard the reference headline completely; retain only the approved
    # character and card, then compose a clean edition-specific header.
    character_scene = approved.crop((0, 330, SIZE, 1410))
    canvas.alpha_composite(character_scene, (0, 300))
    draw = ImageDraw.Draw(canvas)
    name = config["bandName"].upper()
    header = Image.new("RGBA", (SIZE, 300), (1, 6, 16, 255))
    header_glow = Image.new("RGBA", (SIZE, 300), (0, 0, 0, 0))
    ImageDraw.Draw(header_glow).ellipse((210, 20, 870, 400), fill=(15, 106, 255, 85))
    header = Image.alpha_composite(header, header_glow.filter(ImageFilter.GaussianBlur(60)))
    canvas.alpha_composite(header, (0, 0))
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 300, 445, 365), fill=(1, 6, 16, 255))
    draw.rectangle((690, 300, SIZE, 365), fill=(1, 6, 16, 255))
    name_font = fit_font(draw, name, 930, 104, 48)
    centred_text(draw, name, 50, name_font, stroke=2)
    action_font = fit_font(draw, "SCAN TO DISCOVER", 900, 62, 40)
    centred_text(draw, "SCAN TO DISCOVER", 183, action_font, fill=(61, 159, 255), stroke=1)

    # The approved source artwork already places a blank QR card in Aggits' hand.
    # Cover its placeholder exactly with the edition's deterministic, scan-tested QR.
    white_plate = Image.new("RGBA", (334, 334), (255, 255, 255, 255))
    canvas.alpha_composite(white_plate, (171, 552))
    canvas.alpha_composite(qr_image, (181 + (314 - qr_size) // 2, 562 + (314 - qr_size) // 2))
    canvas.convert("RGB").save(destination, "PNG", optimize=True)

    if not matrix or len(matrix) != len(matrix[0]):
        raise SystemExit(f"QR matrix validation failed for {destination}")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    slug = sys.argv[1] if len(sys.argv) > 1 else json.loads((ROOT / "platform.json").read_text(encoding="utf-8"))["defaultEdition"]
    config = load_edition(slug)
    output = ROOT / "output" / slug
    output.mkdir(parents=True, exist_ok=True)
    aggits = Image.open(ROOT / config["characterArtwork"]).convert("RGBA")
    instagram = output / "instagram-discovery.png"
    qr_path = output / "instagram-qr.png"
    create_instagram(config, aggits, instagram)
    create_qr(config, aggits, qr_path)
    manifest = {
        "slug": slug,
        "bandName": config["bandName"],
        "publicURL": config["publicURL"],
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "files": {
            "instagramImage": {"path": str(instagram.relative_to(ROOT)).replace("\\", "/"), "width": SIZE, "height": SIZE, "sha256": sha256(instagram)},
            "qrImage": {"path": str(qr_path.relative_to(ROOT)).replace("\\", "/"), "width": SIZE, "height": SIZE, "sha256": sha256(qr_path), "verifiedDestination": config["publicURL"]},
        },
    }
    (output / "delivery-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
