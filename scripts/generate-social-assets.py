from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOLS_PYTHON = Path(os.environ.get("DEEP_CUTS_PYTHON_TARGET", ROOT / ".tools" / "python")).resolve()
sys.path.insert(0, str(TOOLS_PYTHON))

try:
    from PIL import Image, ImageDraw, ImageFilter, ImageFont
except ModuleNotFoundError as error:
    raise SystemExit(
        "Deep Cuts image dependencies are unavailable. Run scripts/ensure-python-deps.py with the same Python interpreter first."
    ) from error

try:
    import zxingcpp
except ModuleNotFoundError:
    zxingcpp = None

SIZE = 1080
QR_HEIGHT = 1080
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


def fit_qr_title_font(draw: ImageDraw.ImageDraw, text: str, max_width: int, start: int, minimum: int = 48) -> ImageFont.FreeTypeFont:
    candidates = [Path("C:/Windows/Fonts/impact.ttf"), Path("/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf")]
    source = next((candidate for candidate in candidates if candidate.exists()), None)
    if source is None:
        return fit_font(draw, text, max_width, start, minimum)
    for size in range(start, minimum - 1, -2):
        selected = ImageFont.truetype(str(source), size=size)
        if draw.textbbox((0, 0), text, font=selected)[2] <= max_width:
            return selected
    return ImageFont.truetype(str(source), size=minimum)


def background(width: int = SIZE, height: int = SIZE) -> Image.Image:
    image = Image.new("RGB", (width, height))
    pixels = image.load()
    for y in range(height):
        for x in range(width):
            dx = (x - width / 2) / (width / 2)
            dy = (y - height * 0.42) / (width / 2)
            radius = min(1.0, (dx * dx + dy * dy) ** 0.5)
            vertical = y / height
            blue = int(31 * (1 - radius) + 7 * radius + 8 * (1 - vertical))
            pixels[x, y] = (1 + int(4 * (1 - radius)), 5 + int(12 * (1 - radius)), min(54, blue + 12))
    glow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    draw.ellipse((170, 140, width - 170, min(height - 120, 1060)), fill=(20, 91, 220, 74))
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


def centred_text(draw: ImageDraw.ImageDraw, text: str, y: int, selected_font: ImageFont.FreeTypeFont, fill=WHITE, stroke=0, canvas_width: int = SIZE) -> None:
    box = draw.textbbox((0, 0), text, font=selected_font, stroke_width=stroke)
    x = (canvas_width - (box[2] - box[0])) // 2 - box[0]
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


def create_qr(config: dict, aggits: Image.Image, destination: Path) -> str:
    platform = json.loads((ROOT / "platform.json").read_text(encoding="utf-8"))
    base_url = os.environ.get("DEEP_CUTS_BASE_URL", platform.get("publicBaseURL", "")).rstrip("/")
    if not base_url.startswith("https://") or ".example" in base_url:
        raise ValueError("A permanent HTTPS Deep Cuts publicBaseURL is required before QR artwork can be generated.")
    edition_id = config.get("editionId") or config.get("analytics", {}).get("editionId")
    if not edition_id:
        entry = next(item for item in platform["editions"] if item["slug"] == config["slug"])
        edition_id = entry["editionId"]
    url = f"{base_url}/q/{edition_id}"
    node = os.environ.get("DEEP_CUTS_NODE", "node")
    result = subprocess.run([node, str(ROOT / "scripts" / "qr-matrix.cjs"), url], cwd=ROOT, check=True, capture_output=True, text=True)
    matrix = json.loads(result.stdout)
    border = 4
    count = len(matrix) + border * 2
    module = 214 // count
    qr_size = module * count
    qr_image = Image.new("RGBA", (qr_size, qr_size), (255, 255, 255, 255))
    qr_draw = ImageDraw.Draw(qr_image)
    for row, values in enumerate(matrix):
        for column, dark in enumerate(values):
            if dark:
                x = (column + border) * module
                y = (row + border) * module
                qr_draw.rectangle((x, y, x + module - 1, y + module - 1), fill=(2, 7, 17, 255))

    master = Image.open(ROOT / "assets" / "aggits-qr-master-final.png").convert("RGBA").resize((SIZE, SIZE), Image.Resampling.LANCZOS)

    # The approved master remains the canvas. Only the artist-title field and
    # the QR modules are variable. A small protected head/shoulder layer lets
    # the replacement title remain behind Aggits without reconstructing or
    # distorting the character, card, body, glow or approved footer.
    head_mask = Image.new("L", (SIZE, SIZE), 0)
    protected_draw = ImageDraw.Draw(head_mask)
    protected_draw.polygon([(520,165),(595,165),(626,205),(642,300),(625,360),(600,400),(510,400),(480,350),(485,225)], fill=255)
    protected_draw.polygon([(490,345),(625,345),(705,410),(760,525),(405,525),(450,410)], fill=255)
    source_pixels = master.load()
    mask_pixels = head_mask.load()
    for y in range(150, 526):
        for x in range(390, 770):
            if not mask_pixels[x, y]:
                continue
            red, green, blue, _ = source_pixels[x, y]
            if blue > 60 and blue > red + 24 and blue > green + 18:
                mask_pixels[x, y] = 0
    head_mask = head_mask.filter(ImageFilter.GaussianBlur(0.8))
    head_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    head_layer.paste(master, (0, 0), head_mask)

    canvas = master.copy()
    replacement = background(SIZE, 535)
    fade_mask = Image.new("L", (SIZE, 535), 255)
    fade_pixels = fade_mask.load()
    for y in range(500, 535):
        alpha = int(255 * (1 - (y - 500) / 35))
        for x in range(SIZE):
            fade_pixels[x, y] = alpha
    canvas.paste(replacement, (0, 0), fade_mask)
    draw = ImageDraw.Draw(canvas)
    name = config["bandName"].upper()
    words = name.split()
    if len(words) > 1:
        split = min(range(1, len(words)), key=lambda index: abs(len(" ".join(words[:index])) - len(" ".join(words[index:]))))
        lines = [" ".join(words[:split]), " ".join(words[split:])]
    else:
        lines = [name]
    title_size = 190 if len(lines) == 1 else 170
    title_y = 14
    for line in lines:
        selected = fit_qr_title_font(draw, line, 950, title_size, 74)
        centred_text(draw, line, title_y, selected, fill=(5, 91, 218), stroke=1)
        title_y += selected.size + 5
    canvas.alpha_composite(head_layer)

    # Replace the placeholder only inside the approved white card.
    canvas.alpha_composite(Image.new("RGBA", (239, 253), (255, 255, 255, 255)), (241, 385))
    canvas.alpha_composite(qr_image, (253 + (214 - qr_size) // 2, 404 + (214 - qr_size) // 2))
    canvas.convert("RGB").save(destination, "PNG", optimize=True)

    if not matrix or len(matrix) != len(matrix[0]):
        raise SystemExit(f"QR matrix validation failed for {destination}")
    if zxingcpp is not None:
        scan = zxingcpp.read_barcode(Image.open(destination))
        if scan is None or scan.text != url:
            raise SystemExit(f"Rendered QR scan-back failed for {destination}")
        reduced = Image.open(destination).resize((540, 540), Image.Resampling.LANCZOS)
        reduced_scan = zxingcpp.read_barcode(reduced)
        if reduced_scan is None or reduced_scan.text != url:
            raise SystemExit(f"Reduced-size QR scan-back failed for {destination}")
    return url


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
    verified_url = create_qr(config, aggits, qr_path)
    manifest = {
        "slug": slug,
        "bandName": config["bandName"],
        "publicURL": verified_url,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "files": {
            "instagramImage": {"path": str(instagram.relative_to(ROOT)).replace("\\", "/"), "width": SIZE, "height": SIZE, "sha256": sha256(instagram)},
            "qrImage": {"path": str(qr_path.relative_to(ROOT)).replace("\\", "/"), "width": SIZE, "height": QR_HEIGHT, "sha256": sha256(qr_path), "verifiedDestination": verified_url},
        },
    }
    (output / "delivery-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()

