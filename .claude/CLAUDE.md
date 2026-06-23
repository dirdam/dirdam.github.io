# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a personal portfolio website hosted on GitHub Pages at https://dirdam.github.io/. It's a static website built with vanilla HTML, CSS, and JavaScript, featuring multiple sections including projects, games, fonts, and personal information.

## Architecture

The website follows a traditional static site structure:
- Individual HTML pages for each section (index.html, about.html, projects.html, games.html, etc.)
- Shared assets in `/assets/` directory:
  - `/assets/css/` - Stylesheets including sections.css (main styling), knots.css (custom font), flags.css
  - `/assets/js/` - JavaScript files including main.js (site functionality), jquery.min.js, skel.min.js (responsive framework)
  - `/assets/flags/` - Country flag images for language selection and others
- `/images/` - Image assets used throughout the site
- `/games/` - Interactive game implementations
- `/projects/` - Individual project folders with their own resources

## Development Commands

This is a static website with no build process. To develop:
- Open HTML files directly in a browser for quick testing
- Use a local web server for proper testing (e.g., `python -m http.server` or any static file server)
- No compilation, bundling, or preprocessing required

## Key Technical Details

- Uses Bootstrap 3.3.7 and Font Awesome 5.3.1 from CDN
- Responsive design handled by skel.js framework with defined breakpoints
- Multi-language support (English, Spanish, Japanese) implemented via JavaScript and URL hash routing
- Custom "KnotFont" used for stylized text elements
- jQuery-based interactions and animations
- No package.json or build configuration - pure static files