import os
import xml.etree.ElementTree as ET
from collections import defaultdict

def get_colors_from_svg(file_path):
    """Extract color values from an SVG file."""
    try:
        tree = ET.parse(file_path)
        root = tree.getroot()
        # Extract color attributes (e.g., 'fill' and 'stroke')
        colors = {elem.attrib.get('fill') for elem in root.iter()}
        colors |= {elem.attrib.get('stroke') for elem in root.iter()}
        # Remove 'None' and other non-color values
        colors = {color for color in colors if color and color.startswith('#')}
        return colors
    except ET.ParseError:
        return set()

def analyze_svgs_in_folder(folder_path):
    """Analyze SVG files in a folder and categorize them by colors."""
    color_dict = defaultdict(list)

    for filename in os.listdir(folder_path):
        if filename.endswith('.svg'):
            file_path = os.path.join(folder_path, filename)
            colors = get_colors_from_svg(file_path)

            # Create a key from sorted color list and update the dictionary
            if colors:
                key = '-'.join(sorted(colors))
                color_dict[key].append(filename)

    return dict(color_dict)

# Folder containing SVG files
folder_path = 'svg_images'

# Analyzing SVG files and categorizing by colors
color_categorization = analyze_svgs_in_folder(folder_path)
print(color_categorization)
