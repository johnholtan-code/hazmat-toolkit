# The Hazmat Guys - Incident Mapper

A professional incident mapping and resource management application designed for hazardous materials response, emergency management, and incident command operations.

## Overview

The Incident Mapper is a web-based tool that enables incident commanders, trainers, and emergency responders to:
- Visualize incident locations and resource deployment on an interactive map
- Manage staging areas, equipment, and personnel
- Track operational periods and incident timelines
- Document incidents with comprehensive notes and annotations
- Export incident documentation for reporting

**Perfect for:** HazMat response training, incident simulations, emergency planning, and real-time incident management.

## What's New

### ✨ Recent UX & Scaling Improvements (2026)
- **Responsive Design** — Perfectly scales at 75%-150% browser zoom levels
- **Mobile-First Layout** — Tablet and mobile optimized with adaptive breakpoints
- **Mode Indicator Banner** — Clear visual feedback (blue for Draw, yellow for Review mode)
- **Draggable Cost Panel** — Move cost summary panel to avoid map obstruction (position saved to browser)
- **Mobile Palette Drawer** — Bottom sheet drawer for touch-friendly icon selection on small screens
- **Secondary Navigation Tabs** — Quick access to Timeline, Legend, and Shortcuts below appbar
- **Performance Optimizations** — Debounced search (300ms) and batched SVG rendering for smooth interactions
- **Enhanced Accessibility** — Keyboard navigation for palette, visible focus indicators, WCAG AA compliant

## Key Features

### 📍 Interactive Mapping
- **Drag-and-drop resource placement** — Simply drag icons from the palette onto the map
- **Multiple base maps** — Road, satellite, terrain, and dark mode options
- **Real-time positioning** — Rotate, duplicate, and move resources instantly
- **Overlay shapes** — Create visual zones for hazard areas, evacuation zones, and fire zones

### 🏢 Resource Management
- **Staging Assets** — Track response vehicles, equipment, and personnel
- **Equipment Catalog** — Comprehensive equipment library with billing rates
- **Consumables Tracking** — Track consumable materials and supplies
- **Custom Icon Library** — 1,300+ NAPSG icons across 13 categories

### 📋 Incident Documentation
- **Operational Periods** — Auto-populates current time + 12-hour standard operational period
- **Unit Logging** — ICS 214 unit log generation and export
- **Notes & Annotations** — Add detailed notes to each resource and timeline
- **Cost Tracking** — Automatic cost calculation for equipment and personnel

### 🎯 Operational Modes

#### Place Mode (Default)
- Drag icons from the palette onto the map
- Select items to add notes or view details
- Rotate items with 'R' key
- Delete with Delete/Backspace
- Duplicate with 'D' key

#### Draw Mode
- Create custom shapes and paths on the map
- Draw routes between locations
- Mark hazard areas and exclusion zones

#### Review Mode
- Pan and inspect the map without editing
- View complete incident picture
- Analyze resource positioning
- Read-only mode for presentations

#### Staging Mode
- Manage equipment billing and rates
- Track personnel deployment
- Monitor resource allocation
- Cost analysis and reporting

### 📊 Advanced Features
- **Timeline View** — Chronological log of all incident activities (accessible via secondary nav tab)
- **Persistent Legend** — Quick icon reference in secondary navigation
- **Mode Indicator Banner** — Automatic feedback showing current mode with descriptions
- **Usability Tracking** — Built-in metrics for training feedback
- **Theme Support** — Light/dark mode with automatic detection
- **Responsive Design** — Works perfectly on desktop (75%-150% zoom), tablet, and touch devices
- **Mobile-Optimized** — Bottom drawer palette, full-width layout on small screens
- **Draggable Cost Panel** — Reposition cost summary, location saved to localStorage
- **Keyboard Shortcuts** — Quick commands for power users (1/2/3/4 for modes, R/D for rotate/duplicate, Enter/Space for palette categories)

## Getting Started

### 1. Open the Application
Simply open `Hazmat Incident Map - Hot Wash Replay.html` in a modern web browser.

### 2. Create Your Incident
- Enter the **Incident Name** (e.g., "Rail Yard Tank Car Leak")
- The **Operational Period** auto-populates with current time + 12 hours
- Enter the **Location** (address or lat,lng coordinates)

### 3. Switch to Place Mode
The Place button pulses on startup to guide you. Click it to start placing resources.

### 4. Add Resources
- **Browse the Incident Controls** (left sidebar)
- **Drag icons** from any category onto the map
- **Click on placed items** to select them
- **Add notes** using the "Add Note" button

### 5. Document & Export
- Review the **Timeline** to see all activities
- Use **ICS 214** for formal incident documentation
- **Export** maps and logs for incident reports

## Resource Categories

### Staging Assets (Text Labels)
Vehicles and support equipment:
- Staging Area Marker
- Vacuum Truck
- Water Tanker
- Foam Trailer
- Excavator, Bulldozer, Loader
- Fire engines, Ambulances
- Command trailer, Mobile command bus
- And 20+ more

### Equipment (Text Labels)
Specialized response equipment from your rate catalog:
- HazMat monitoring equipment
- Air monitoring trailers
- Generators
- Decontamination equipment
- Booming and containment devices
- Custom equipment rates and billing

### Consumables (Text Labels)
Consumable materials and supplies:
- Absorbent materials
- Decontamination agents
- Personal protective equipment
- Neutralizers and foam agents
- Custom consumable inventory

### Hazards & Overlays (1,300+ NAPSG Icons)
Pre-defined incident elements:
- **Access Hazards** — Road blocks, clearance issues
- **Hazardous Materials** — DOT placarding classes
- **Incident Resources** — Personnel and teams
- **Natural Hazards** — Avalanche, earthquake, flooding
- **Infrastructure** — Utilities, lifelines
- **And 8 more categories**

## Keyboard Shortcuts

| Key | Function |
|-----|----------|
| `1` | Switch to Place Mode |
| `2` | Switch to Draw Mode |
| `3` | Switch to Review Mode |
| `4` | Switch to Staging Mode |
| `R` | Rotate selected item |
| `D` | Duplicate selected item |
| `Delete` / `Backspace` | Delete selected item |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Enter` / `Space` | Toggle palette category collapse (when focused on header) |
| `Escape` | Close all modals and menus |
| `?` | Open keyboard shortcuts guide |

## Map Controls

- **Pan** — Click and drag to move around the map
- **Zoom** — Scroll wheel or pinch on touch devices
- **Browser Zoom** — Use Ctrl/Cmd +/- to scale the entire interface (perfectly responsive at 75%-150%)
- **Grid Snap** — Enable/disable in settings to align icons to road grid
- **Icon Size** — Adjust global icon scale (36-72px)
- **Theme** — Switch between light, dark, or auto mode
- **Cost Panel** — Drag from header (≡ icon) to reposition; position persists in browser storage
- **Secondary Navigation** — Access Timeline, Legend, Shortcuts tabs directly below appbar

## Data & Storage

- **Local Storage** — Your palette and settings are saved automatically
- **Not Cloud-Based** — All data stays on your device
- **Export Options** — Generate ICS 214 unit logs as PDF
- **Browser Compatible** — Chrome, Firefox, Safari, Edge

## Responsive Design & Device Support

### Browser Zoom Scaling
The application is fully responsive at any browser zoom level:
- **75% Zoom** — Map and controls fit perfectly on laptop screens
- **100% Zoom** — Optimized for standard browser view
- **125-150% Zoom** — Ideal for accessibility needs and large displays

All elements scale proportionally with:
- Responsive appbar heights and widths
- Sidebar that adapts from side-panel to full-width
- Cost panel and overlays positioned relative to viewport
- Touch targets that meet accessibility standards (44px minimum)

### Device Breakpoints
- **Desktop (1024px+)** — Two-column layout with persistent sidebar
- **Tablet (768px-1023px)** — Narrower sidebar, readable controls
- **Mobile (<768px)** — Full-width layout with mobile palette drawer, appbar collapses to essentials

**Mobile Features:**
- Bottom sheet palette drawer for icon selection
- Simplified appbar with quick-access mode buttons
- Full-width responsive map
- Touch-friendly tap targets

## Settings & Customization

### Icon Library
- **Reset to NAPSG** — Restore default icon library
- **Custom Icons** — Add your own icons to the palette
- **Icon Search** — Search by name in the palette

### Appearance
- **Icon Size** — 36-72 pixels (affects all icons globally)
- **Theme Mode** — Auto, Light, or Dark
- **Grid Snap** — Align icons to 40px grid on roads

### Incident Details
- **Incident Name** — Customize for your scenario
- **Operational Period** — Edit the default time window
- **Location** — Enter address or coordinates (map auto-centers)

### Cost Panel Management
- **Draggable Panel** — Click the ≡ (hamburger) icon on the cost summary header to drag
- **Persistent Position** — Panel location automatically saved to browser localStorage
- **Reset Position** — Double-click the drag handle to return panel to default location
- **Minimize Toggle** — Click the − / + button to collapse/expand the panel

### Mode Indicator Feedback
- **Visual Banner** — See active mode with color-coded banner (blue for Draw, yellow for Review)
- **Mode Description** — Each mode shows helpful tips for what you can do
- **Quick Switch** — Click "Switch to Place" button in banner to return to Place mode
- **Palette Control** — Icon palette automatically disabled/grayed in Draw and Review modes

## Training & Learning

Perfect for:
- **HazMat Response Training** — Practice resource deployment
- **Incident Command System (ICS)** — Learn unified command structure
- **Emergency Planning** — Pre-position resources for scenarios
- **Personnel Training** — Visual incident management skills
- **Hot Wash Reviews** — Record and replay incident responses

Built-in **Usability Metrics** help trainers measure:
- Time per task
- Resource placement accuracy
- Mode switching efficiency
- Note-taking frequency

## Technical Details

- **Framework** — Vanilla JavaScript (no dependencies)
- **Mapping** — Leaflet.js for interactive maps
- **Icons** — 1,300+ SVG icons (NAPSG library, CC BY 4.0)
- **Storage** — LocalStorage for persistence
- **Export** — PDF generation via html2canvas & jsPDF

## Browser Requirements

- **Minimum** — Modern browser with ES6 support
- **Recommended** — Chrome, Firefox, Safari, or Edge (latest versions)
- **Mobile** — Touch-enabled devices supported
- **Offline** — Fully functional offline (no internet required)

## Files & Assets

```
hazmat-toolkit/
├── Hazmat Incident Map - Hot Wash Replay.html    [Main application]
├── README.md                                       [This file]
├── napsig_palette.js                              [Icon library data]
├── staging_rates.js                               [Equipment/consumables catalog]
├── icons/                                          [Custom staging asset icons]
└── NAPSG Icons/                                    [1,300+ hazard & resource icons]
    ├── Access_Hazards/
    ├── Hazardous_Materials/
    ├── Human_Caused_Hazards/
    ├── Incident/
    ├── Lifelines/
    ├── NIMS_Positions/
    ├── Natural_Hazards/
    ├── Public Alert/
    ├── Resources/
    ├── USAR-2/
    ├── infrastructure/
    └── preplan/
```

## Tips & Best Practices

### For Trainers
1. **Use Review Mode** for presenting incident overviews
2. **Pre-populate** incident name and location for trainees
3. **Set custom timeframes** for different operational shifts
4. **Export timelines** for hot wash debrief documentation

### For Trainees
1. **Read the Quick Legend** (More menu) for keyboard shortcuts
2. **Use Grid Snap** for alignment when placing resources
3. **Add detailed notes** for decision-making rationale
4. **Review your timeline** to understand incident progression

### For Incident Commanders
1. **Auto-populated timeframe** saves setup time
2. **Cost tracking** helps with resource budgeting
3. **Icon library search** finds resources quickly
4. **Map export** useful for incident reports

## Troubleshooting

### Layout Issues at Different Zoom Levels
- **If elements are cut off:** Use Ctrl/Cmd ± to adjust browser zoom (try 90% or 100%)
- **On mobile:** Check that you're in portrait orientation (landscape works best with tablet mode)
- **Cost panel overlapping:** Drag the cost panel (click ≡ icon) to reposition it

### Icons Not Showing
- Click **"Reset to NAPSG"** in Settings to reload the icon library
- Check that NAPSG Icons folder is in the public directory
- Verify browser allows file access (may need local server for some browsers)
- Try refreshing the page (Ctrl+R or Cmd+R)

### Map Not Loading
- Check your internet connection (needs OpenStreetMap tiles for initial load)
- Try a different map style (Road, Satellite, Terrain)
- Clear browser cache and reload

### Data Not Persisting
- Check browser localStorage is enabled
- Some private/incognito modes don't support storage
- Try a different browser
- Check that "Cost Panel Position" is saved in localStorage (inspect with browser dev tools)

### Timeline, Legend, or Shortcuts Not Opening
- Look for secondary navigation tabs below the main appbar
- Click the appropriate tab button (Timeline, Legend, Shortcuts)
- Try refreshing the page if buttons don't respond

### Performance Issues
- Reduce number of items on map (>100 may be slow)
- Disable grid snap if it causes lag
- Close other browser tabs to free memory
- Try disabling browser extensions that modify page styles

## Support & Feedback

For issues, feature requests, or feedback:
- Report bugs with detailed steps to reproduce
- Include browser/OS information
- Attach screenshots of the issue
- Describe the expected vs. actual behavior

## License & Attribution

- **Application** — Developed for The Hazmat Guys
- **Icons** — NAPSG Library (CC BY 4.0)
- **Libraries** — Leaflet.js, html2canvas, jsPDF

## Version History

### Current Release (2026 - UX & Scaling Update)
**New Features:**
- ✅ Full responsive scaling at 75%-150% browser zoom
- ✅ Mobile-optimized with tablet/phone breakpoints
- ✅ Draggable cost panel with localStorage persistence
- ✅ Mobile palette drawer (bottom sheet on small screens)
- ✅ Color-coded mode indicator banner
- ✅ Secondary navigation tabs for Timeline, Legend, Shortcuts
- ✅ Performance optimizations (debounced search, batched SVG rendering)
- ✅ Accessibility enhancements (keyboard nav, visible focus, WCAG AA colors)

**Existing Features:**
- ✅ Full interactive mapping
- ✅ 1,300+ NAPSG icons
- ✅ Staging, equipment, consumables tracking
- ✅ ICS 214 export
- ✅ Timeline logging
- ✅ Pulsing Place button tutorial
- ✅ Auto-populated 12-hour operational periods
- ✅ Multiple map styles and themes

---

**Built with precision for professional incident response.**

Last updated: May 2026
