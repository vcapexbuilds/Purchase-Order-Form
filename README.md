# Apex PO System

## Power Automate Integration

**⚠️ CRITICAL:** When working with Power Automate integration, always reference:
- `POWER_AUTOMATE_GUIDE.md` - Complete integration guide with exact JSON structure requirements

The Power Automate schema validation is strict and requires exact data types and structure.

## Quick Start

1. Open `index.html` to access the system
2. Use `pages/form.html` for PO creation
3. Use `pages/admin.html` for admin functions
4. Use `pages/tracking.html` for PO tracking

## Testing Power Automate

Use the admin dashboard to manually sync POs to Power Automate for testing.

## Project Structure

- `pages/` - HTML pages (form, admin, tracking)
- `js/core/` - Core functionality (API, auth, storage)
- `js/pages/` - Page-specific JavaScript
- `js/Module/` - Reusable components
- `css/` - Stylesheets
- `components/` - Reusable HTML components

## Last Updated
August 22, 2025