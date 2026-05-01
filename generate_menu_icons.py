from PIL import Image, ImageDraw
import os

def generate_check_circle_icon():
    # 32x32 for Retina compatibility (rumps will scale it)
    size = (32, 32)
    # Create a transparent image
    img = Image.new('RGBA', size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Draw a circle (black, to be used as a template)
    margin = 4
    draw.ellipse([margin, margin, size[0] - margin, size[1] - margin], outline='black', width=3)
    
    # Draw a checkmark
    # Coordinates for a checkmark inside the 32x32 circle
    # (10, 16) -> (14, 20) -> (22, 12)
    draw.line([(10, 16), (14, 20), (22, 12)], fill='black', width=3)
    
    # Save to resources/
    res_dir = os.path.join(os.path.dirname(__file__), 'resources')
    os.makedirs(res_dir, exist_ok=True)
    img.save(os.path.join(res_dir, 'check_circle.png'))
    print("Generated check_circle.png")

def generate_info_circle_icon():
    size = (32, 32)
    img = Image.new('RGBA', size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    margin = 4
    # Draw a circle
    draw.ellipse([margin, margin, size[0] - margin, size[1] - margin], outline='black', width=3)
    
    # Draw an 'i'
    # Dot
    draw.ellipse([14, 10, 18, 14], fill='black')
    # Stem
    draw.line([(16, 16), (16, 22)], fill='black', width=3)
    
    res_dir = os.path.join(os.path.dirname(__file__), 'resources')
    os.makedirs(res_dir, exist_ok=True)
    img.save(os.path.join(res_dir, 'info_circle.png'))
    print("Generated info_circle.png")

def generate_settings_gear_icon():
    size = (32, 32)
    img = Image.new('RGBA', size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    center = (16, 16)
    outer_radius = 10
    inner_radius = 5
    tooth_width = 4
    tooth_length = 3
    
    # Draw gear teeth
    import math
    num_teeth = 8
    for i in range(num_teeth):
        angle = (i * 2 * math.pi) / num_teeth
        # Tooth points
        p1 = (center[0] + (outer_radius + tooth_length) * math.cos(angle - 0.2),
              center[1] + (outer_radius + tooth_length) * math.sin(angle - 0.2))
        p2 = (center[0] + (outer_radius + tooth_length) * math.cos(angle + 0.2),
              center[1] + (outer_radius + tooth_length) * math.sin(angle + 0.2))
        p3 = (center[0] + outer_radius * math.cos(angle + 0.4),
              center[1] + outer_radius * math.sin(angle + 0.4))
        p4 = (center[0] + outer_radius * math.cos(angle - 0.4),
              center[1] + outer_radius * math.sin(angle - 0.4))
        draw.polygon([p1, p2, p3, p4], fill='black')
    
    # Draw main circle
    draw.ellipse([center[0]-outer_radius, center[1]-outer_radius, 
                  center[0]+outer_radius, center[1]+outer_radius], outline='black', width=3)
    
    # Draw inner hole
    # To make it transparent, we could use a mask or just draw a small circle
    # But since it's a template, black is what shows up.
    # To have a hole, we actually need to NOT draw there or draw transparency.
    # Pillow's transparency is tricky with ellipse.
    # Let's just draw the outer ring and teeth.
    
    res_dir = os.path.join(os.path.dirname(__file__), 'resources')
    os.makedirs(res_dir, exist_ok=True)
    img.save(os.path.join(res_dir, 'settings_gear.png'))
    print("Generated settings_gear.png")

if __name__ == "__main__":
    generate_check_circle_icon()
    generate_info_circle_icon()
    generate_settings_gear_icon()
