from __future__ import annotations

import hashlib
import json
import math
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


def centred_wrapped_text(draw: ImageDraw.ImageDraw, text: str, y: int, max_width: int, selected_font: ImageFont.FreeTypeFont, fill=WHITE, line_gap: int = 10) -> int:
    lines: list[str] = []
    current = ""
    for word in text.split():
        candidate = f"{current} {word}".strip()
        if current and draw.textbbox((0, 0), candidate, font=selected_font)[2] > max_width:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    for line in lines[:3]:
        centred_text(draw, line, y, selected_font, fill=fill)
        y += selected_font.size + line_gap
    return y


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
    footer_label = {"car": "DEEP CUTS CARS", "club": "DEEP CUTS CLUBS"}.get(config.get("editionType"), "OFFICIAL FAN CHALLENGE")
    challenge_font = fit_font(draw, footer_label, 820, 54, 38)
    centred_text(draw, footer_label, 961, challenge_font, fill=(173, 210, 255), stroke=1)
    canvas.convert("RGB").save(destination, "PNG", optimize=True)


def school_palette(config: dict) -> tuple[tuple[int, int, int], ...]:
    theme = config.get("theme", {})
    def rgb(key: str, fallback: str) -> tuple[int, int, int]:
        value = str(theme.get(key) or fallback).lstrip("#")
        if len(value) != 6:
            raise SystemExit(f"School theme colour {key} is invalid.")
        return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4))
    return rgb("accent", "#CE2029"), rgb("navy", "#0A2342"), rgb("accentSecondary", "#00C4B4"), rgb("contentBackground", "#F8FAFC")


def school_background(config: dict) -> Image.Image:
    primary, navy, secondary, content = school_palette(config)
    canvas = Image.new("RGBA", (SIZE, SIZE), navy + (255,))
    glow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse((-120, -220, 1200, 760), fill=primary + (125,))
    glow_draw.ellipse((520, 600, 1250, 1260), fill=secondary + (50,))
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    canvas = Image.alpha_composite(canvas, glow)
    draw = ImageDraw.Draw(canvas)
    for offset in range(0, 210, 18):
        draw.arc((90 + offset // 3, 80 + offset // 4, 990 - offset // 3, 980 - offset // 6), 198, 338, fill=content + (24,), width=2)
    return canvas


def create_school_instagram(config: dict, destination: Path) -> None:
    canvas = school_background(config)
    draw = ImageDraw.Draw(canvas)
    primary, _, secondary, _ = school_palette(config)
    centred_text(draw, "DISCOVER OUR SCHOOL", 120, fit_font(draw, "DISCOVER OUR SCHOOL", 880, 62, 42), fill=WHITE, stroke=1)
    draw.rounded_rectangle((165, 225, 915, 235), radius=5, fill=secondary + (255,))
    name = config["bandName"].upper()
    selected = fit_font(draw, name, 900, 112, 54)
    centred_text(draw, name, 360, selected, fill=WHITE, stroke=2)
    bio = str(config.get("description") or "A school community to discover.")
    bio_font = font(30)
    centred_wrapped_text(draw, bio, 545, 820, bio_font, fill=(225, 235, 244), line_gap=12)
    draw.rounded_rectangle((230, 720, 850, 860), radius=28, outline=secondary + (255,), width=4, fill=(10, 35, 66, 235))
    centred_text(draw, "SCHOOL DISCOVERY", 764, fit_font(draw, "SCHOOL DISCOVERY", 560, 42, 34), fill=WHITE)
    centred_text(draw, "copyright Clearlight Creative", 1014, font(22), fill=(177, 196, 214))
    canvas.convert("RGB").save(destination, "PNG", optimize=True)


def create_school_qr(config: dict, destination: Path) -> str:
    platform = json.loads((ROOT / "platform.json").read_text(encoding="utf-8"))
    base_url = os.environ.get("DEEP_CUTS_BASE_URL", platform.get("publicBaseURL", "")).rstrip("/")
    if not base_url.startswith("https://") or ".example" in base_url:
        raise ValueError("A permanent HTTPS publicBaseURL is required before School Discovery QR artwork can be generated.")
    edition_id = config.get("analytics", {}).get("editionId")
    url = f"{base_url}/q/{edition_id}"
    node = os.environ.get("DEEP_CUTS_NODE", "node")
    result = subprocess.run([node, str(ROOT / "scripts" / "qr-matrix.cjs"), url], cwd=ROOT, check=True, capture_output=True, text=True)
    matrix = json.loads(result.stdout)
    border = 4
    module = 520 // (len(matrix) + border * 2)
    qr_size = module * (len(matrix) + border * 2)
    qr_image = Image.new("RGBA", (qr_size, qr_size), (255, 255, 255, 255))
    qr_draw = ImageDraw.Draw(qr_image)
    for row, values in enumerate(matrix):
        for column, dark in enumerate(values):
            if dark:
                x, y = (column + border) * module, (row + border) * module
                qr_draw.rectangle((x, y, x + module - 1, y + module - 1), fill=(5, 14, 28, 255))
    canvas = school_background(config)
    draw = ImageDraw.Draw(canvas)
    primary, _, secondary, _ = school_palette(config)
    centred_text(draw, "DISCOVER OUR SCHOOL", 64, fit_font(draw, "DISCOVER OUR SCHOOL", 900, 68, 46), fill=WHITE, stroke=1)
    draw.rounded_rectangle((150, 160, 930, 168), radius=4, fill=secondary + (255,))
    name = config["bandName"].upper()
    centred_text(draw, name, 205, fit_font(draw, name, 900, 72, 42), fill=WHITE, stroke=1)
    card_size = qr_size + 42
    card_x, card_y = (SIZE - card_size) // 2, 350
    draw.rounded_rectangle((card_x, card_y, card_x + card_size, card_y + card_size), radius=32, fill=(255, 255, 255), outline=primary + (255,), width=5)
    canvas.alpha_composite(qr_image, (card_x + 21, card_y + 21))
    centred_text(draw, "SCHOOL DISCOVERY", 935, fit_font(draw, "SCHOOL DISCOVERY", 720, 42, 32), fill=(225, 235, 244))
    centred_text(draw, "copyright Clearlight Creative", 1015, font(21), fill=(177, 196, 214))
    canvas.convert("RGB").save(destination, "PNG", optimize=True)
    if zxingcpp is not None:
        scan = zxingcpp.read_barcode(Image.open(destination))
        if scan is None or scan.text != url:
            raise SystemExit(f"Rendered School Discovery QR scan-back failed for {destination}")
        reduced_scan = zxingcpp.read_barcode(Image.open(destination).resize((540, 540), Image.Resampling.LANCZOS))
        if reduced_scan is None or reduced_scan.text != url:
            raise SystemExit(f"Reduced-size School Discovery QR scan-back failed for {destination}")
    return url


def laneway_logo() -> Image.Image:
    source = Image.open(ROOT / "assets" / "laneway-music-logo-source.jpg").convert("L")
    source = source.point(lambda value: 255 if value < 205 else 0)
    white_logo = Image.new("RGBA", source.size, (245, 245, 245, 0))
    white_logo.putalpha(source)
    return white_logo


def business_colour(config: dict, key: str, fallback: tuple[int, int, int]) -> tuple[int, int, int]:
    value = str(config.get("theme", {}).get(key, "")).lstrip("#")
    if len(value) == 6:
        try:
            return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4))
        except ValueError:
            pass
    return fallback


def business_background(config: dict) -> Image.Image:
    accent = business_colour(config, "accent", (47, 128, 195))
    secondary = business_colour(config, "accentSecondary", (244, 122, 52))
    surface = business_colour(config, "surface", (8, 13, 21))
    canvas = Image.new("RGBA", (SIZE, SIZE), (*surface, 255))
    glow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    draw.ellipse((-120, -180, 880, 820), fill=accent + (72,))
    draw.ellipse((480, 420, 1260, 1250), fill=secondary + (42,))
    return Image.alpha_composite(canvas, glow.filter(ImageFilter.GaussianBlur(120)))


def business_logo(config: dict) -> Image.Image:
    logo_path = config.get("business", {}).get("logoArtwork", "")
    if not logo_path:
        raise ValueError("Business editions require a verified logoArtwork.")
    return Image.open(ROOT / logo_path).convert("RGBA")


def business_delivery_logo(config: dict, max_width: int, max_height: int, preferred_width: int = 0) -> Image.Image:
    logo = contain(business_logo(config), max_width, max_height)
    if preferred_width and logo.width < preferred_width:
        scale = preferred_width / logo.width
        target_height = round(logo.height * scale)
        if target_height <= max_height:
            logo = logo.resize((preferred_width, target_height), Image.Resampling.LANCZOS)
    return logo


def create_business_instagram(config: dict, aggits: Image.Image, destination: Path) -> None:
    accent = business_colour(config, "accent", (47, 128, 195))
    secondary = business_colour(config, "accentSecondary", (244, 122, 52))
    canvas = business_background(config)
    draw = ImageDraw.Draw(canvas)
    square_logo = config.get("business", {}).get("logoShape") == "square"
    logo = business_delivery_logo(config, 140 if square_logo else 790, 140 if square_logo else 190, 0 if square_logo else 360)
    logo_x, logo_y = (SIZE - logo.width) // 2, 18 if square_logo else 38
    if config.get("business", {}).get("logoSurface") == "light":
        draw.rounded_rectangle((logo_x - 30, logo_y - 15, logo_x + logo.width + 30, logo_y + logo.height + 15), radius=22, fill=(255, 255, 255, 255))
    canvas.alpha_composite(logo, (logo_x, logo_y))
    if square_logo:
        centred_text(draw, config["bandName"].upper(), 169, fit_font(draw, config["bandName"].upper(), 500, 38, 28), fill=WHITE)
    draw.rounded_rectangle((60, 225, 1020, 232), radius=3, fill=accent + (255,))
    portrait = contain(aggits, 520, 710)
    canvas.alpha_composite(portrait, (45 + (500 - portrait.width) // 2, 250))
    draw.rounded_rectangle((535, 322, 1025, 765), radius=30, fill=(14, 24, 37, 238), outline=(97, 127, 151, 180), width=3)
    draw.text((585, 370), "FIND YOUR", font=font(54), fill=(245, 249, 255))
    draw.text((585, 430), "NEXT JOB", font=font(73), fill=secondary)
    role_labels = config.get("business", {}).get("socialRoleLabels") or ["AUTO ELECTRICAL", "HEAVY DUTY FITTING", "BOILERMAKING", "FIELD SERVICE"]
    for index, label in enumerate(role_labels[:4]):
        draw.text((585, 530 + index * 45), str(label).upper(), font=fit_font(draw, str(label).upper(), 390, 27, 20), fill=(190, 207, 221))
    centred_text(draw, "DEEP CUTS", 960, font(32), fill=(225, 234, 242))
    centred_text(draw, "Copyright Clearlight Creative", 1010, font(20), fill=(139, 159, 177))
    canvas.convert("RGB").save(destination, "PNG", optimize=True)


def create_business_qr(config: dict, aggits: Image.Image, destination: Path) -> str:
    platform = json.loads((ROOT / "platform.json").read_text(encoding="utf-8"))
    base_url = os.environ.get("DEEP_CUTS_BASE_URL", platform.get("publicBaseURL", "")).rstrip("/")
    if not base_url.startswith("https://") or ".example" in base_url:
        raise ValueError("A permanent HTTPS publicBaseURL is required before Business QR artwork can be generated.")
    edition_id = config.get("analytics", {}).get("editionId")
    url = f"{base_url}/q/{edition_id}"
    node = os.environ.get("DEEP_CUTS_NODE", "node")
    result = subprocess.run([node, str(ROOT / "scripts" / "qr-matrix.cjs"), url], cwd=ROOT, check=True, capture_output=True, text=True)
    matrix = json.loads(result.stdout)
    border = 4
    module = 490 // (len(matrix) + border * 2)
    qr_size = module * (len(matrix) + border * 2)
    qr_image = Image.new("RGBA", (qr_size, qr_size), (255, 255, 255, 255))
    qr_draw = ImageDraw.Draw(qr_image)
    for row, values in enumerate(matrix):
        for column, dark in enumerate(values):
            if dark:
                x, y = (column + border) * module, (row + border) * module
                qr_draw.rectangle((x, y, x + module - 1, y + module - 1), fill=(8, 13, 21, 255))
    accent = business_colour(config, "accent", (47, 128, 195))
    secondary = business_colour(config, "accentSecondary", (244, 122, 52))
    canvas = business_background(config)
    draw = ImageDraw.Draw(canvas)
    square_logo = config.get("business", {}).get("logoShape") == "square"
    logo = business_delivery_logo(config, 150 if square_logo else 730, 150 if square_logo else 175, 0 if square_logo else 340)
    logo_x, logo_y = (SIZE - logo.width) // 2, 22 if square_logo else 28
    if config.get("business", {}).get("logoSurface") == "light":
        draw.rounded_rectangle((logo_x - 26, logo_y - 12, logo_x + logo.width + 26, logo_y + logo.height + 12), radius=20, fill=(255, 255, 255, 255))
    canvas.alpha_composite(logo, (logo_x, logo_y))
    short_name = str(config.get("business", {}).get("shortName") or config["bandName"]).upper()
    qr_heading = f"SCAN TO EXPLORE {short_name} JOBS"
    centred_text(draw, qr_heading, 206, fit_font(draw, qr_heading, 900, 48, 34), fill=(245, 249, 255))
    portrait = contain(aggits, 360, 690)
    canvas.alpha_composite(portrait, (42 + (320 - portrait.width) // 2, 300))
    card_size = qr_size + 34
    card_x, card_y = 482, 350
    draw.rounded_rectangle((card_x, card_y, card_x + card_size, card_y + card_size), radius=26, fill=(255, 255, 255), outline=secondary, width=5)
    canvas.alpha_composite(qr_image, (card_x + 17, card_y + 17))
    centred_text(draw, "DEEP CUTS", 965, font(30), fill=(225, 234, 242))
    centred_text(draw, "Copyright Clearlight Creative", 1012, font(19), fill=(139, 159, 177))
    canvas.convert("RGB").save(destination, "PNG", optimize=True)
    if zxingcpp is not None:
        scan = zxingcpp.read_barcode(Image.open(destination))
        if scan is None or scan.text != url:
            raise SystemExit(f"Rendered Business QR scan-back failed for {destination}")
        reduced_scan = zxingcpp.read_barcode(Image.open(destination).resize((540, 540), Image.Resampling.LANCZOS))
        if reduced_scan is None or reduced_scan.text != url:
            raise SystemExit(f"Reduced-size Business QR scan-back failed for {destination}")
    return url


def laneway_background() -> Image.Image:
    canvas = Image.new("RGBA", (SIZE, SIZE), (14, 14, 14, 255))
    glow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    draw.ellipse((120, -210, 960, 620), fill=(255, 255, 255, 24))
    return Image.alpha_composite(canvas, glow.filter(ImageFilter.GaussianBlur(120)))


def indie_wheel_logo(config: dict) -> Image.Image:
    logo_path = config.get("indieWheel", {}).get("logoArtwork", "")
    if not logo_path:
        raise ValueError("Indie Wheel editions require their own configured logoArtwork.")
    return Image.open(ROOT / logo_path).convert("RGBA")


def indie_wheel_colour(config: dict, key: str, fallback: tuple[int, int, int]) -> tuple[int, int, int]:
    value = str(config.get("theme", {}).get(key, "")).lstrip("#")
    if len(value) == 6:
        try:
            return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4))
        except ValueError:
            pass
    return fallback


def indie_wheel_background(config: dict) -> Image.Image:
    paper = indie_wheel_colour(config, "accentSecondary", (242, 242, 236))
    canvas = Image.new("RGBA", (SIZE, SIZE), (*paper, 255))
    texture = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(texture)
    draw.ellipse((100, -240, 980, 580), fill=(255, 255, 255, 180))
    draw.ellipse((300, 670, 1180, 1340), fill=(0, 0, 0, 18))
    return Image.alpha_composite(canvas, texture.filter(ImageFilter.GaussianBlur(105)))


def create_indie_wheel_instagram(config: dict, destination: Path) -> None:
    canvas = indie_wheel_background(config)
    draw = ImageDraw.Draw(canvas)
    ink = indie_wheel_colour(config, "accent", (17, 17, 17))
    logo = contain(indie_wheel_logo(config), 610, 420)
    canvas.alpha_composite(logo, ((SIZE - logo.width) // 2, 55))
    name = config["bandName"].upper()
    centred_text(draw, name, 500, fit_font(draw, name, 900, 78, 42), fill=ink, stroke=1)
    draw.rounded_rectangle((110, 650, 970, 830), radius=22, outline=ink, width=5, fill=(250, 250, 246, 245))
    centred_text(draw, "10 DEEP-CUT QUESTIONS", 685, fit_font(draw, "10 DEEP-CUT QUESTIONS", 760, 43, 32), fill=ink)
    destination_label = str(config.get("indieWheel", {}).get("destination", {}).get("label", "MUSIC")).upper()
    descriptor = f"ARTISTS • MUSIC • {destination_label}"
    centred_text(draw, descriptor, 760, fit_font(draw, descriptor, 720, 29, 22), fill=(70, 70, 70))
    centred_text(draw, "INDIE WHEEL", 930, fit_font(draw, "INDIE WHEEL", 520, 42, 32), fill=ink)
    tagline = str(config.get("indieWheel", {}).get("tagline", "SPIN THE INDIE WHEEL")).upper()
    centred_text(draw, tagline, 995, fit_font(draw, tagline, 650, 24, 18), fill=(75, 75, 75))
    canvas.convert("RGB").save(destination, "PNG", optimize=True)


def create_indie_wheel_qr(config: dict, destination: Path) -> str:
    platform = json.loads((ROOT / "platform.json").read_text(encoding="utf-8"))
    base_url = os.environ.get("DEEP_CUTS_BASE_URL", platform.get("publicBaseURL", "")).rstrip("/")
    if not base_url.startswith("https://") or ".example" in base_url:
        raise ValueError("A permanent HTTPS publicBaseURL is required before Indie Wheel QR artwork can be generated.")
    edition_id = config.get("analytics", {}).get("editionId")
    url = f"{base_url}/q/{edition_id}"
    node = os.environ.get("DEEP_CUTS_NODE", "node")
    result = subprocess.run([node, str(ROOT / "scripts" / "qr-matrix.cjs"), url], cwd=ROOT, check=True, capture_output=True, text=True)
    matrix = json.loads(result.stdout)
    border = 4
    module = 520 // (len(matrix) + border * 2)
    qr_size = module * (len(matrix) + border * 2)
    qr_image = Image.new("RGBA", (qr_size, qr_size), (255, 255, 255, 255))
    qr_draw = ImageDraw.Draw(qr_image)
    for row, values in enumerate(matrix):
        for column, dark in enumerate(values):
            if dark:
                x, y = (column + border) * module, (row + border) * module
                qr_draw.rectangle((x, y, x + module - 1, y + module - 1), fill=(17, 17, 17, 255))
    canvas = indie_wheel_background(config)
    draw = ImageDraw.Draw(canvas)
    ink = indie_wheel_colour(config, "accent", (17, 17, 17))
    logo = contain(indie_wheel_logo(config), 410, 260)
    canvas.alpha_composite(logo, ((SIZE - logo.width) // 2, 25))
    name = config["bandName"].upper()
    centred_text(draw, name, 275, fit_font(draw, name, 900, 66, 38), fill=ink, stroke=1)
    card_size = qr_size + 42
    card_x, card_y = (SIZE - card_size) // 2, 390
    draw.rounded_rectangle((card_x, card_y, card_x + card_size, card_y + card_size), radius=24, fill=(255, 255, 255), outline=ink, width=5)
    canvas.alpha_composite(qr_image, (card_x + 21, card_y + 21))
    centred_text(draw, "SPIN • DISCOVER • LISTEN", 968, fit_font(draw, "SPIN • DISCOVER • LISTEN", 650, 29, 22), fill=ink)
    centred_text(draw, "INDIE WHEEL", 1017, fit_font(draw, "INDIE WHEEL", 420, 25, 19), fill=(75, 75, 75))
    canvas.convert("RGB").save(destination, "PNG", optimize=True)
    if zxingcpp is not None:
        scan = zxingcpp.read_barcode(Image.open(destination))
        if scan is None or scan.text != url:
            raise SystemExit(f"Rendered Indie Wheel QR scan-back failed for {destination}")
        reduced_scan = zxingcpp.read_barcode(Image.open(destination).resize((540, 540), Image.Resampling.LANCZOS))
        if reduced_scan is None or reduced_scan.text != url:
            raise SystemExit(f"Reduced-size Indie Wheel QR scan-back failed for {destination}")
    return url


def create_laneway_instagram(config: dict, destination: Path) -> None:
    canvas = laneway_background()
    draw = ImageDraw.Draw(canvas)
    logo = contain(laneway_logo(), 470, 270)
    canvas.alpha_composite(logo, ((SIZE - logo.width) // 2, 82))
    name = config["bandName"].upper()
    centred_text(draw, name, 410, fit_font(draw, name, 900, 98, 52), fill=(250, 250, 250), stroke=1)
    draw.rounded_rectangle((120, 595, 960, 765), radius=24, outline=(255, 255, 255, 92), width=3, fill=(38, 38, 38, 245))
    challenge = "EIGHT POSITIVE QUESTIONS" if config.get("editionType") == "laneway_company" else "FIVE POSITIVE QUESTIONS"
    descriptor = "ARTISTS • MUSIC • DISCOVERY" if config.get("editionType") == "laneway_company" else "MUSIC • STORY • DISCOVERY"
    centred_text(draw, challenge, 632, fit_font(draw, challenge, 740, 44, 34), fill=(245, 245, 245))
    centred_text(draw, descriptor, 704, fit_font(draw, descriptor, 700, 30, 24), fill=(184, 184, 184))
    centred_text(draw, "DEEP CUTS", 936, fit_font(draw, "DEEP CUTS", 500, 42, 34), fill=(220, 220, 220))
    centred_text(draw, "copyright Clearlight Creative", 1015, font(21), fill=(132, 132, 132))
    canvas.convert("RGB").save(destination, "PNG", optimize=True)


def create_laneway_qr(config: dict, destination: Path) -> str:
    platform = json.loads((ROOT / "platform.json").read_text(encoding="utf-8"))
    base_url = os.environ.get("DEEP_CUTS_BASE_URL", platform.get("publicBaseURL", "")).rstrip("/")
    if not base_url.startswith("https://") or ".example" in base_url:
        raise ValueError("A permanent HTTPS publicBaseURL is required before Laneway QR artwork can be generated.")
    edition_id = config.get("analytics", {}).get("editionId")
    url = f"{base_url}/q/{edition_id}"
    node = os.environ.get("DEEP_CUTS_NODE", "node")
    result = subprocess.run([node, str(ROOT / "scripts" / "qr-matrix.cjs"), url], cwd=ROOT, check=True, capture_output=True, text=True)
    matrix = json.loads(result.stdout)
    border = 4
    module = 520 // (len(matrix) + border * 2)
    qr_size = module * (len(matrix) + border * 2)
    qr_image = Image.new("RGBA", (qr_size, qr_size), (255, 255, 255, 255))
    qr_draw = ImageDraw.Draw(qr_image)
    for row, values in enumerate(matrix):
        for column, dark in enumerate(values):
            if dark:
                x, y = (column + border) * module, (row + border) * module
                qr_draw.rectangle((x, y, x + module - 1, y + module - 1), fill=(12, 12, 12, 255))
    canvas = laneway_background()
    draw = ImageDraw.Draw(canvas)
    logo = contain(laneway_logo(), 370, 205)
    canvas.alpha_composite(logo, ((SIZE - logo.width) // 2, 46))
    name = config["bandName"].upper()
    centred_text(draw, name, 255, fit_font(draw, name, 900, 72, 42), fill=(250, 250, 250), stroke=1)
    card_size = qr_size + 42
    card_x, card_y = (SIZE - card_size) // 2, 380
    draw.rounded_rectangle((card_x, card_y, card_x + card_size, card_y + card_size), radius=28, fill=(255, 255, 255), outline=(190, 190, 190), width=3)
    canvas.alpha_composite(qr_image, (card_x + 21, card_y + 21))
    centred_text(draw, "DEEP CUTS", 972, fit_font(draw, "DEEP CUTS", 500, 40, 32), fill=(220, 220, 220))
    centred_text(draw, "copyright Clearlight Creative", 1025, font(19), fill=(132, 132, 132))
    canvas.convert("RGB").save(destination, "PNG", optimize=True)
    if zxingcpp is not None:
        scan = zxingcpp.read_barcode(Image.open(destination))
        if scan is None or scan.text != url:
            raise SystemExit(f"Rendered Laneway QR scan-back failed for {destination}")
        reduced_scan = zxingcpp.read_barcode(Image.open(destination).resize((540, 540), Image.Resampling.LANCZOS))
        if reduced_scan is None or reduced_scan.text != url:
            raise SystemExit(f"Reduced-size Laneway QR scan-back failed for {destination}")
    return url


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

    # Preserve the naturally curled foreground fingers from the approved
    # master. The variable white card and QR are painted next, then this
    # skin-only layer is restored so the card is visibly gripped rather than
    # appearing to float in front of the hand.
    hand_mask = Image.new("L", (SIZE, SIZE), 0)
    hand_pixels = hand_mask.load()
    for y in range(560, 701):
        for x in range(170, 366):
            red, green, blue, alpha = master.getpixel((x, y))
            if alpha and red > 72 and green > 34 and red > green * 1.12 and green > blue * 1.08:
                hand_pixels[x, y] = 255
    hand_mask = hand_mask.filter(ImageFilter.GaussianBlur(0.55))
    foreground_hand = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    foreground_hand.paste(master, (0, 0), hand_mask)

    # Replace the placeholder only inside the approved white card.
    canvas.alpha_composite(Image.new("RGBA", (239, 253), (255, 255, 255, 255)), (241, 385))
    canvas.alpha_composite(qr_image, (253 + (214 - qr_size) // 2, 404 + (214 - qr_size) // 2))
    canvas.alpha_composite(foreground_hand)
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


def jookbox_colour(config: dict, key: str, fallback: tuple[int, int, int]) -> tuple[int, int, int]:
    value = str(config.get("theme", {}).get(key, "")).lstrip("#")
    if len(value) == 6:
        try:
            return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4))
        except ValueError:
            pass
    return fallback


def jookbox_background(config: dict) -> Image.Image:
    surface = jookbox_colour(config, "surface", (9, 19, 33))
    cyan = jookbox_colour(config, "accent", (85, 217, 255))
    orange = jookbox_colour(config, "accentSecondary", (255, 102, 64))
    canvas = Image.new("RGBA", (SIZE, SIZE), (*surface, 255))
    glow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse((-80, -180, 1160, 780), fill=cyan + (62,))
    glow_draw.ellipse((470, 570, 1250, 1280), fill=orange + (44,))
    return Image.alpha_composite(canvas, glow.filter(ImageFilter.GaussianBlur(125)))


def draw_jookbox(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], config: dict, screen_text: str = "") -> None:
    left, top, right, bottom = box
    width = right - left
    cyan = jookbox_colour(config, "accent", (85, 217, 255))
    orange = jookbox_colour(config, "accentSecondary", (255, 102, 64))
    gold = jookbox_colour(config, "gold", (255, 214, 107))
    draw.rounded_rectangle(box, radius=width // 2, fill=(16, 27, 41, 255), outline=gold, width=12)
    draw.rounded_rectangle((left + 18, top + 18, right - 18, bottom - 18), radius=max(28, width // 2 - 18), outline=(225, 236, 244, 225), width=5)
    draw.rounded_rectangle((left + 34, top + 34, right - 34, bottom - 34), radius=max(24, width // 2 - 34), outline=orange, width=7)
    centre_x = (left + right) // 2
    radius_x = width * 0.42
    radius_y = width * 0.37
    for index in range(18):
        angle = math.radians(198 + index * (144 / 17))
        x = int(centre_x + math.cos(angle) * radius_x)
        y = int(top + width * 0.46 + math.sin(angle) * radius_y)
        colour = cyan if index % 2 else orange
        draw.ellipse((x - 7, y - 7, x + 7, y + 7), fill=colour, outline=(255, 255, 255), width=2)
    screen = (left + 74, top + int(width * 0.51), right - 74, top + int(width * 0.91))
    draw.rounded_rectangle(screen, radius=16, fill=(3, 7, 12, 255), outline=cyan, width=4)
    if screen_text:
        selected = fit_font(draw, screen_text, screen[2] - screen[0] - 34, 35, 22)
        centred_text(draw, screen_text, screen[1] + 52, selected, fill=WHITE, canvas_width=left + right)
    grille_top = screen[3] + 24
    draw.rounded_rectangle((left + 66, grille_top, right - 66, bottom - 48), radius=16, fill=(5, 8, 12, 255), outline=orange, width=4)
    for x in range(left + 87, right - 72, 22):
        draw.line((x, grille_top + 18, x, bottom - 66), fill=(73, 89, 102), width=5)


def create_jookbox_instagram(config: dict, destination: Path) -> None:
    canvas = jookbox_background(config)
    draw = ImageDraw.Draw(canvas)
    orange = jookbox_colour(config, "accentSecondary", (255, 102, 64))
    gold = jookbox_colour(config, "gold", (255, 214, 107))
    centred_text(draw, "JOOKBOX", 54, fit_font(draw, "JOOKBOX", 760, 74, 50), fill=orange, stroke=1)
    name = str(config["bandName"]).upper()
    centred_text(draw, name, 142, fit_font(draw, name, 910, 76, 44), fill=WHITE, stroke=2)
    draw_jookbox(draw, (252, 250, 828, 865), config, "PLAY")
    centred_text(draw, "WATCH • LISTEN • FOLLOW • SHOP", 897, fit_font(draw, "WATCH • LISTEN • FOLLOW • SHOP", 780, 32, 23), fill=gold)
    centred_text(draw, "Deep Cuts", 970, font(31), fill=(225, 234, 242))
    centred_text(draw, "Copyright Clearlight Creative", 1016, font(20), fill=(139, 159, 177))
    canvas.convert("RGB").save(destination, "PNG", optimize=True)


def create_jookbox_qr(config: dict, destination: Path) -> str:
    platform = json.loads((ROOT / "platform.json").read_text(encoding="utf-8"))
    base_url = os.environ.get("DEEP_CUTS_BASE_URL", platform.get("publicBaseURL", "")).rstrip("/")
    if not base_url.startswith("https://") or ".example" in base_url:
        raise ValueError("A permanent HTTPS publicBaseURL is required before JookBox QR artwork can be generated.")
    edition_id = config.get("analytics", {}).get("editionId")
    url = f"{base_url}/q/{edition_id}"
    node = os.environ.get("DEEP_CUTS_NODE", "node")
    result = subprocess.run([node, str(ROOT / "scripts" / "qr-matrix.cjs"), url], cwd=ROOT, check=True, capture_output=True, text=True)
    matrix = json.loads(result.stdout)
    border = 4
    module = 500 // (len(matrix) + border * 2)
    qr_size = module * (len(matrix) + border * 2)
    qr_image = Image.new("RGBA", (qr_size, qr_size), (255, 255, 255, 255))
    qr_draw = ImageDraw.Draw(qr_image)
    for row, values in enumerate(matrix):
        for column, dark in enumerate(values):
            if dark:
                x, y = (column + border) * module, (row + border) * module
                qr_draw.rectangle((x, y, x + module - 1, y + module - 1), fill=(5, 11, 19, 255))
    canvas = jookbox_background(config)
    draw = ImageDraw.Draw(canvas)
    orange = jookbox_colour(config, "accentSecondary", (255, 102, 64))
    gold = jookbox_colour(config, "gold", (255, 214, 107))
    centred_text(draw, "SCAN TO PLAY THE JOOKBOX", 42, fit_font(draw, "SCAN TO PLAY THE JOOKBOX", 920, 60, 42), fill=WHITE, stroke=1)
    name = str(config["bandName"]).upper()
    centred_text(draw, name, 120, fit_font(draw, name, 920, 68, 40), fill=orange, stroke=1)
    card_size = qr_size + 42
    card_x, card_y = (SIZE - card_size) // 2, 245
    draw.rounded_rectangle((card_x, card_y, card_x + card_size, card_y + card_size), radius=30, fill=(255, 255, 255), outline=gold, width=6)
    canvas.alpha_composite(qr_image, (card_x + 21, card_y + 21))
    centred_text(draw, "WATCH • LISTEN • FOLLOW • SHOP", 868, fit_font(draw, "WATCH • LISTEN • FOLLOW • SHOP", 780, 31, 22), fill=gold)
    centred_text(draw, "Deep Cuts", 948, font(31), fill=(225, 234, 242))
    centred_text(draw, "Copyright Clearlight Creative", 998, font(20), fill=(139, 159, 177))
    canvas.convert("RGB").save(destination, "PNG", optimize=True)
    if not matrix or len(matrix) != len(matrix[0]):
        raise SystemExit(f"JookBox QR matrix validation failed for {destination}")
    if zxingcpp is not None:
        scan = zxingcpp.read_barcode(Image.open(destination))
        if scan is None or scan.text != url:
            raise SystemExit(f"Rendered JookBox QR scan-back failed for {destination}")
        reduced_scan = zxingcpp.read_barcode(Image.open(destination).resize((540, 540), Image.Resampling.LANCZOS))
        if reduced_scan is None or reduced_scan.text != url:
            raise SystemExit(f"Reduced-size JookBox QR scan-back failed for {destination}")
    return url


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    slug = sys.argv[1] if len(sys.argv) > 1 else json.loads((ROOT / "platform.json").read_text(encoding="utf-8"))["defaultEdition"]
    config = load_edition(slug)
    output = ROOT / "output" / slug
    output.mkdir(parents=True, exist_ok=True)
    instagram = output / "instagram-discovery.png"
    qr_path = output / "instagram-qr.png"
    if config.get("editionType") == "school":
        create_school_instagram(config, instagram)
        verified_url = create_school_qr(config, qr_path)
    elif config.get("editionType") == "jukebox":
        create_jookbox_instagram(config, instagram)
        verified_url = create_jookbox_qr(config, qr_path)
    elif config.get("editionType") == "laneway":
        create_laneway_instagram(config, instagram)
        verified_url = create_laneway_qr(config, qr_path)
    elif config.get("editionType") == "laneway_company":
        create_laneway_instagram(config, instagram)
        verified_url = create_laneway_qr(config, qr_path)
    elif config.get("editionType") == "indie_wheel":
        create_indie_wheel_instagram(config, instagram)
        verified_url = create_indie_wheel_qr(config, qr_path)
    elif config.get("editionType") == "business":
        aggits = Image.open(ROOT / config["characterArtwork"]).convert("RGBA")
        create_business_instagram(config, aggits, instagram)
        verified_url = create_business_qr(config, aggits, qr_path)
    else:
        aggits = Image.open(ROOT / config["characterArtwork"]).convert("RGBA")
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

