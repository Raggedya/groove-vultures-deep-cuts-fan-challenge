from __future__ import annotations

import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ".tools" / "python"))

from PIL import Image, ImageDraw, ImageFilter, ImageFont
import qrcode
from qrcode.constants import ERROR_CORRECT_H
import zxingcpp

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
    qr = qrcode.QRCode(error_correction=ERROR_CORRECT_H, box_size=14, border=4)
    qr.add_data(url)
    qr.make(fit=True)
    qr_image = qr.make_image(fill_color="#020711", back_color="#ffffff").convert("RGBA")
    qr_image = qr_image.resize((720, 720), Image.Resampling.NEAREST)

    canvas = background()
    draw = ImageDraw.Draw(canvas)
    name = config["bandName"].upper()
    name_font = fit_font(draw, name, 900, 88, 50)
    centred_text(draw, name, 42, name_font, stroke=2)
    canvas.alpha_composite(qr_image, (180, 174))

    head = contain(aggits_crop(aggits, 0.38), 128, 152)
    plate = Image.new("RGBA", (158, 174), (3, 12, 28, 255))
    plate_draw = ImageDraw.Draw(plate)
    plate_draw.rounded_rectangle((2, 2, 155, 171), radius=24, outline=(91, 159, 255, 255), width=5)
    plate.alpha_composite(head, ((158 - head.width) // 2, (174 - head.height) // 2))
    canvas.alpha_composite(plate, ((SIZE - 158) // 2, 447))

    footer_font = fit_font(draw, "SCAN TO TAKE THE OFFICIAL FAN CHALLENGE", 900, 36, 28)
    centred_text(draw, "SCAN TO TAKE THE OFFICIAL FAN CHALLENGE", 938, footer_font, fill=(181, 215, 255), stroke=1)
    canvas.convert("RGB").save(destination, "PNG", optimize=True)

    decoded = zxingcpp.read_barcode(Image.open(destination))
    if decoded is None or decoded.text != url:
        raise SystemExit(f"QR scan-back failed for {destination}")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    slug = sys.argv[1] if len(sys.argv) > 1 else json.loads((ROOT / "platform.json").read_text(encoding="utf-8"))["defaultEdition"]
    config = load_edition(slug)
    output = ROOT / "output" / slug
    output.mkdir(parents=True, exist_ok=True)
    aggits = Image.open(ROOT / config["characterArtwork"]).convert("RGBA")
    instagram = output / "instagram-fan-challenge.png"
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
