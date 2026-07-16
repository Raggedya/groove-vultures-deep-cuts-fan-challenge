from pathlib import Path
import hashlib

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "button-approval-preview-sonic-signature-v9-1080x1920.png"
W, H = 1080, 1920


def font(size: int, bold: bool = False):
    name = "arialbd.ttf" if bold else "arial.ttf"
    return ImageFont.truetype(str(Path("C:/Windows/Fonts") / name), size)


def centre(draw, text, y, selected_font, fill):
    box = draw.textbbox((0, 0), text, font=selected_font)
    draw.text(((W - (box[2] - box[0])) / 2 - box[0], y), text, font=selected_font, fill=fill)


def sonic_signature(canvas, artist_name, centre_y):
    """Draw a deterministic, artist-specific audio signature."""
    digest = hashlib.sha256(artist_name.encode("utf-8")).digest()
    bars = 47
    spacing = 10
    centre_x = W // 2
    start_x = centre_x - ((bars - 1) * spacing) // 2

    halo = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    halo_draw = ImageDraw.Draw(halo)
    sharp = ImageDraw.Draw(canvas)

    for index in range(bars):
        distance = abs(index - (bars - 1) / 2) / ((bars - 1) / 2)
        envelope = max(0.18, 1 - distance ** 1.55)
        source = digest[index % len(digest)] / 255
        height = int(7 + envelope * (12 + source * 28))
        x = start_x + index * spacing
        halo_draw.line((x, centre_y - height, x, centre_y + height), fill=(20, 137, 255, 115), width=4)
        sharp.line((x, centre_y - height, x, centre_y + height), fill=(47, 158, 244, 210), width=2)

    canvas.alpha_composite(halo.filter(ImageFilter.GaussianBlur(12)))
    sharp = ImageDraw.Draw(canvas)
    sharp.line((180, centre_y, start_x - 22, centre_y), fill=(21, 109, 188, 85), width=1)
    sharp.line((start_x + (bars - 1) * spacing + 22, centre_y, 900, centre_y), fill=(21, 109, 188, 85), width=1)


def card(canvas, box, title, subtitle, colour, icon, glow=False, enabled=True):
    x1, y1, x2, y2 = box
    if glow:
        halo = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        hd = ImageDraw.Draw(halo)
        hd.rounded_rectangle((x1 - 3, y1 - 3, x2 + 3, y2 + 3), 26, fill=(20, 116, 205, 26))
        canvas.alpha_composite(halo.filter(ImageFilter.GaussianBlur(34)))
    draw = ImageDraw.Draw(canvas)
    surface = (4, 24, 49, 250) if enabled else (5, 11, 20, 245)
    outline = (119, 161, 203, 88) if enabled else (103, 118, 137, 52)
    title_fill = (246, 250, 255) if enabled else (103, 118, 137)
    subtitle_fill = (160, 185, 213) if enabled else (75, 87, 102)
    draw.rounded_rectangle(box, 24, fill=surface, outline=outline, width=1)
    draw.line((x1 + 28, y1 + 1, x2 - 28, y1 + 1), fill=(191, 220, 246, 32) if enabled else (130, 145, 162, 18), width=1)
    cy = (y1 + y2) // 2
    content_x = (x1 + x2) // 2
    draw.text((content_x, cy - 27), title, font=font(21, True), fill=title_fill, anchor="ma")
    draw.text((content_x, cy + 6), subtitle, font=font(14), fill=subtitle_fill, anchor="ma")
    if enabled:
        draw.text((x2 - 40, cy - 21), ">", font=font(34), fill=(121, 166, 210))


canvas = Image.new("RGBA", (W, H), (0, 0, 0, 255))
pixels = canvas.load()
for y in range(H):
    for x in range(W):
        dx = (x - W / 2) / (W / 2)
        dy = (y - 270) / 540
        radius = min(1, (dx * dx + dy * dy) ** 0.5)
        blue = int(8 + 40 * (1 - radius) * max(0, 1 - y / 1200))
        pixels[x, y] = (0, 4 + blue // 4, 12 + blue, 255)

glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
gd.ellipse((230, 30, 850, 610), fill=(0, 111, 255, 150))
canvas.alpha_composite(glow.filter(ImageFilter.GaussianBlur(85)))

aggits = Image.open(ROOT / "assets" / "aggits-original-cutout-v4.png").convert("RGBA")
aggits.thumbnail((320, 430), Image.Resampling.LANCZOS)
canvas.alpha_composite(aggits, ((W - aggits.width) // 2, 22))

draw = ImageDraw.Draw(canvas)
draw.line((105, 463, 330, 463), fill=(18, 132, 226), width=2)
draw.line((750, 463, 975, 463), fill=(18, 132, 226), width=2)
centre(draw, "GROOVE VULTURES", 435, font(42, True), (42, 151, 239))
centre(draw, "Melbourne garage rock driven by hard rock, metal and funk-infused grooves.", 502, font(18), (162, 189, 217))

sonic_signature(canvas, "Groove Vultures", 557)
draw = ImageDraw.Draw(canvas)

features = [(190, "LISTEN"), (420, "WATCH"), (650, "FOLLOW"), (880, "BUY STUFF")]
for x, label in features:
    draw.text((x, 611), label, font=font(19, True), fill=(222, 234, 247), anchor="mm")
for x in (305, 535, 765):
    draw.line((x, 593, x, 628), fill=(18, 121, 205), width=1)

button_blue = (18, 108, 201)
card(canvas, (70, 664, 1010, 754), "BUY MUSIC", "Purchase music via Bandcamp", button_blue, "", True)
card(canvas, (70, 771, 1010, 861), "LISTEN ON SPOTIFY", "Open the artist on Spotify", button_blue, "", True)
card(canvas, (70, 878, 525, 968), "INSTAGRAM", "Latest updates", button_blue, "")
card(canvas, (555, 878, 1010, 968), "BANDCAMP", "Listen directly", button_blue, "")
card(canvas, (70, 985, 525, 1075), "YOUTUBE", "Official videos", button_blue, "")
card(canvas, (555, 985, 1010, 1075), "FACEBOOK", "Not currently available", button_blue, "", enabled=False)
card(canvas, (70, 1092, 525, 1182), "BAND WEBSITE", "Not currently available", button_blue, "", enabled=False)
card(canvas, (555, 1092, 1010, 1182), "BUY MERCH", "Not currently available", button_blue, "", enabled=False)

# Demonstration of the optional CTA. It is rendered only when a verified
# artist-controlled payment URL exists in the edition configuration.
draw = ImageDraw.Draw(canvas)
tip_box = (70, 1199, 1010, 1294)
draw.rounded_rectangle(tip_box, 24, fill=(5, 11, 20), outline=(103, 118, 137, 52), width=1)
draw.line((98, 1200, 982, 1200), fill=(130, 145, 162, 18), width=1)
draw.text((540, 1236), "TIP THE BAND", font=font(22, True), fill=(103, 118, 137), anchor="mm")
draw.text((540, 1267), "Not currently available", font=font(14), fill=(75, 87, 102), anchor="mm")

# Editorial discovery link: the best recent, credible interview, review or
# feature. It remains visible but disabled when no verified coverage exists.
card(canvas, (70, 1311, 1010, 1401), "NEWS & REVIEWS", "Latest interview: Lelahel Metal", button_blue, "", True)

draw = ImageDraw.Draw(canvas)
draw.rounded_rectangle((420, 1436, 660, 1496), 18, fill=(6, 44, 84), outline=(102, 157, 207, 72), width=1)
draw.text((540, 1466), "SHARE", font=font(15, True), fill=(239, 246, 253), anchor="mm")

centre(draw, "POWERED BY DEEP CUTS", 1589, font(17, True), (166, 188, 211))
centre(draw, "copyright Clearlight Creative", 1627, font(14), (79, 103, 130))
centre(draw, "1080 × 1920 MOBILE APPROVAL PREVIEW — NOT PUBLISHED", 1845, font(15, True), (70, 105, 145))

canvas.convert("RGB").save(OUT, "PNG", optimize=True)
print(OUT)
