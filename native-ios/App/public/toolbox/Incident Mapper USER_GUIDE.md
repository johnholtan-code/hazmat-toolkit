# Incident Mapper - Complete User Guide

A comprehensive guide to using the Incident Mapper for emergency response training, incident planning, and resource management.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Interface Overview](#interface-overview)
3. [Responsive Design & Mobile](#responsive-design--mobile)
4. [Working with the Map](#working-with-the-map)
5. [Resource Management](#resource-management)
6. [Operational Modes](#operational-modes)
7. [Advanced Features](#advanced-features)
8. [Incident Documentation](#incident-documentation)
9. [Training Scenarios](#training-scenarios)
10. [Frequently Asked Questions](#frequently-asked-questions)

---

## Getting Started

### First Time Setup

1. **Open the application** in your web browser
2. **Fill in incident details:**
   - **Incident Name** — Descriptive name for your scenario (e.g., "Tanker Truck Spill at I-95")
   - **Operational Period** — Auto-populated with current time + 12 hours (edit as needed)
   - **Location** — Street address or latitude/longitude coordinates

3. **The Place button pulses** to guide you to the starting point
4. **Click Place button** to enter placement mode
5. **You're ready to start mapping!**

### Typical Workflow

```
1. Enter Incident Info → 2. Click Place Mode → 3. Drag Resources → 
4. Add Notes → 5. Review Timeline → 6. Export Documentation
```

---

## Interface Overview

### Header Section (Top)
```
Row 1: [Incident Name] [Status] [Log Button]
Row 2: [Operational Period] [Location Search] [Category Search] [More Menu]
Secondary Nav: [Incident] [Palette] [Timeline] [Legend] [Shortcuts] [More]
```

- **Incident Name Input** — Name your incident scenario
- **Operational Period** — Timeframe for the incident (auto-calculated)
- **Location Search** — Enter address to navigate map to that location
- **Category Search** — Find icons by name (debounced for smooth performance)
- **Mode Buttons** — Switch between Place, Draw, Review, and Staging modes
- **Secondary Navigation Tabs** — Direct access to Timeline, Legend, Shortcuts, and Settings

### Mode Indicator Banner
When in Draw or Review mode, a color-coded banner appears below the appbar:
- **Blue Banner (Draw Mode)** — Shows "Drawing tools active. Drag on map to draw."
- **Yellow Banner (Review Mode)** — Shows "Map is read-only. Pan and inspect without editing."
- **Quick Switch** — Click "Switch to Place" button in banner to return to Place mode

### Left Sidebar (Incident Controls)
- **Incident Controls** — Toggle to show/hide resource categories
- **Category List** — Staging Assets, Equipment, Consumables, Hazards, and more
- **Icon Search** — Find specific resources by name
- **Settings Button** — Configure appearance and preferences

### Main Area (Map)
- **Interactive Map** — Central workspace for incident mapping
- **Placed Icons** — Draggable resources on the map
- **Map Controls** — Zoom, pan, grid snap, and style options
- **Status Indicator** — Current mode and helpful tips

### Cost Summary Panel (Draggable)
- **Location** — Fixed top-right by default, but **fully draggable**
- **Drag Handle** — Click the ≡ (hamburger) icon on the panel header to drag
- **Reposition** — Drag anywhere on the map to avoid obstruction
- **Persist** — Position automatically saves to browser (even after closing)
- **Reset** — Double-click the drag handle to return to default position
- **Minimize** — Click − to collapse, + to expand

**Cost Tracking Shows:**
- Equipment costs and rates
- Personnel hours and billing
- Consumable quantities and prices
- Total incident cost estimate

### Additional Panels (Accessible via Tabs)
- **Timeline Tab** — Chronological log of all activities (click "Timeline" in secondary nav)
- **Legend Tab** — Icon reference guide (click "Legend" in secondary nav)
- **Shortcuts Tab** — Keyboard commands and tips (click "Shortcuts" in secondary nav)
- **Settings** — Theme, icons, map styles (click "⚙️ More" → "Settings")
- **Inspector** — Details for selected items (appears when you click map items)

---

## Responsive Design & Mobile

### Browser Zoom Scaling

The Incident Mapper is fully responsive and adapts to any browser zoom level:

**Using Browser Zoom:**
- **Zoom In** — Press `Ctrl++` (Windows/Linux) or `Cmd++` (Mac)
- **Zoom Out** — Press `Ctrl+-` (Windows/Linux) or `Cmd+-` (Mac)
- **Reset** — Press `Ctrl+0` (Windows/Linux) or `Cmd+0` (Mac)

**Supported Zoom Levels:**
- **75% Zoom** — Perfect for fitting entire incident map on laptop screens
- **100% Zoom** — Default, optimized viewing
- **125% Zoom** — Accessibility-friendly, easier to read
- **150% Zoom** — Maximum readability for vision accessibility

All controls, text, and map elements scale proportionally at any zoom level.

### Mobile & Tablet Usage

**On Tablets (768px-1023px):**
- Sidebar remains accessible alongside the map
- All buttons and controls are touch-friendly
- Swipe to pan the map
- Pinch to zoom

**On Mobile Phones (<768px):**
- **Layout:** Single-column, full-width map view
- **Palette Access:** Bottom sheet drawer
  - Tap the "Palette" button to open icon selection drawer
  - Scroll through categories and drag to map
  - Tap outside or swipe down to close
- **Controls:** Simplified appbar with mode buttons
- **Secondary Nav:** Swipe or tap tabs for Timeline, Legend, Shortcuts

**Touch Interactions:**
- **Drag** — Click and hold, then drag icons or pan map
- **Tap** — Select items, activate buttons
- **Pinch** — Zoom in/out on map
- **Double Tap** — Zoom in on map location
- **Swipe Down** — Close bottom sheet drawers

### Accessibility Features

**Keyboard Navigation:**
- **Tab** — Move focus between interactive elements
- **Shift+Tab** — Move focus backward
- **Enter/Space** — Activate buttons and toggle palette categories
- **Escape** — Close modals and drawers
- **?** — Open keyboard shortcuts guide

**Visual Feedback:**
- **Focus Indicators** — Clear outline appears when navigating with keyboard
- **Mode Banner** — Color-coded indicator (blue for Draw, yellow for Review)
- **Palette Status** — Grayed out when not available in current mode

---

## Working with the Map

### Navigating the Map

**Panning (Moving Around)**
- Click and drag anywhere on the map
- Use arrow keys (if available)
- Touch devices: swipe to pan

**Zooming In/Out**
- Scroll wheel to zoom
- Touch devices: pinch to zoom
- Map controls: +/- buttons (if available)

**Changing Map Style**
- Click map style chip (top-right corner)
- Options: Road, Satellite, Terrain, Dark
- Choose based on your background visibility needs

### Grid Snap Feature

In Settings, enable **"Snap to road grid"** to:
- Align all icons to a 40px grid
- Create organized, professional-looking maps
- Useful for formal incident documentation

**Usage:**
- Drag icons onto map — they'll snap to nearest grid point
- Disable for free-form placement over specific coordinates

---

## Resource Management

### Placing Resources

**Method 1: Drag and Drop**
1. Locate resource in left sidebar categories
2. Click and drag icon onto the map
3. Release to place
4. Icon automatically snaps to grid (if enabled)

**Method 2: Search**
1. Type resource name in "Search icons" field
2. Find your resource in filtered results
3. Drag to map

**Customizing Placement**
After placing a resource:
- **Rotate** — Press 'R' key (rotate 90° increments)
- **Move** — Drag to new location
- **Delete** — Press Delete/Backspace
- **Duplicate** — Press 'D' key

### Selecting Resources

**Click to Select**
- Click any placed icon on the map
- Selected item highlights with blue outline
- Details appear in right panel (if open)

**Keyboard Selection**
- Use Tab/Shift+Tab to cycle through items
- Arrow keys to move selected item

### Adding Information

**Add Notes to Selected Item**
1. Select the resource (click it)
2. Click "Add Note" button
3. Type your note (decision rationale, observations, etc.)
4. Notes appear on hover and in timeline

**View Item Details**
- Click item to see full details in right panel
- For Staging/Equipment: shows billing, costs, personnel
- For Consumables: shows inventory information

---

## Operational Modes

### 🟡 Place Mode (Default)

**Purpose** — Add resources to the map

**Controls:**
- Click and drag icons from palette to map
- Click placed items to select
- Press 'R' to rotate (90° increments)
- Press 'D' to duplicate
- Press Delete to remove

**Best For:**
- Initial incident response planning
- Training exercises
- Resource deployment visualization

**Tips:**
- Use Grid Snap for organized placement
- Add notes while placing for context
- Duplicate to show multiple units quickly

---

### 🔴 Draw Mode

**Purpose** — Create custom shapes, zones, and annotations

**Controls:**
- Click and drag to draw paths
- Various shape tools: rectangle, circle, polygon
- Press Escape to finish drawing

**Shape Types:**
- **Generic Area** — Any rectangular or oval zone
- **Circle Zone** — Circular hazard areas
- **Triangle Zone** — Triangular danger zones
- **Spill Pool** — Contamination areas
- **Fire Area** — Active fire zones
- **Gas Cloud** — Vapor/gas plumes
- **Vapor Plume** — Wind-blown vapor zones

**Customizing Shapes:**
- Click to select drawn shape
- Adjust fill color, stroke, and opacity
- Resize by dragging handles
- Delete with Delete key

**Best For:**
- Marking hazard zones
- Delineating evacuation areas
- Showing plume direction
- Highlighting resource staging areas

---

### 🔵 Review Mode

**Purpose** — Inspect and present incident without editing

**Controls:**
- Pan and zoom only (no placing/editing)
- Click items to view details (read-only)
- All resources visible but locked

**Features:**
- Perfect for presentations
- Shows complete incident picture
- No accidental changes possible
- Slide-show ready

**Best For:**
- Incident briefings
- Hot wash debriefs
- Stakeholder presentations
- Formal incident review

---

### ⚙️ Staging Mode

**Purpose** — Manage equipment, personnel, and costs

**Controls:**
- View equipment by staging area
- Enter cost rates and billing info
- Track personnel deployment
- Calculate total incident costs

**Staging Area Details:**
- Unit Name and Designation
- Company/Organization
- Cost Rate (hourly or per unit)
- Personnel assignments
- Availability status

**Cost Tracking:**
- Automatic calculation for each unit
- Total costs displayed in summary panel
- Export for incident billing
- Track by category (personnel, equipment, consumables)

**Best For:**
- Resource budgeting
- Cost accounting
- Personnel management
- Equipment tracking

---

## Advanced Features

### Timeline View

**Access:** Click "Timeline" tab in secondary navigation (below appbar)

**Displays:**
- Chronological list of all activities
- Timestamps for each action
- Resource placements and deletions
- Notes and annotations
- Mode changes and state transitions

**Uses:**
- Review incident progression
- Identify decision points
- Hot wash debrief documentation
- After-action report generation

**Features:**
- Scroll through timeline
- Click items to navigate to map
- Export timeline to documentation

---

### Icon Legend

**Access:** Click "Legend" tab in secondary navigation (below appbar)

**Displays:**
- Visual reference of all icon categories
- Icon names and descriptions
- Quick search and filtering

---

### ICS 214 Unit Log Export

**Access:** Click "⚙️ More" menu → "Export" (or ICS 214 button if available)

**Generates:**
- Formal ICS 214 incident unit log
- Incident name and operational period
- All placed resources and details
- Timeline of all activities
- Personnel and equipment inventory

**Output Formats:**
- Interactive PDF (fillable)
- Print-ready format
- Compatible with standard incident reporting

**Usage:**
- Formal incident documentation
- Agency reporting requirements
- Training evaluation records
- Incident archives

---

### Theme & Appearance

**Access:** Settings → Theme

**Options:**
- **Auto** — Match system dark/light preference
- **Light** — White background, dark text
- **Dark** — Dark background, light text

**Benefits:**
- Reduces eye strain
- Adapts to lighting conditions
- Better screen visibility outdoors
- Personal preference

**Affects:**
- Map background and controls
- Text and sidebar colors
- Overall interface appearance

---

### Icon Library Management

**Access:** Settings → "Reset to NAPSG"

**Features:**
- 1,300+ professional incident icons
- 13 organized categories
- Search functionality
- Customizable palette

**Customization:**
1. Search for resource in palette
2. Drag custom icon to palette
3. Changes saved to browser storage
4. Use "Reset to NAPSG" to restore defaults

---

### Map Styles

**Access:** Map style chip (top-right)

**Available Styles:**
- **Road** — Street map (best for reference)
- **Satellite** — Aerial imagery (good for terrain)
- **Terrain** — Topographic view (shows elevation)
- **Dark** — Dark map tiles (good with light theme)

**Tips:**
- Use Satellite for terrain understanding
- Road map best for address reference
- Terrain shows evacuation route difficulty

---

## Incident Documentation

### Creating a Complete Incident Record

**Step 1: Set Up Incident**
- Enter incident name
- Set operational period (or use auto-populated default)
- Enter location (map will center)

**Step 2: Place Resources**
- Drag resources from palette
- Organize by staging areas
- Use Grid Snap for alignment

**Step 3: Add Context**
- Draw hazard zones
- Add notes to key resources
- Document decision points

**Step 4: Document Decisions**
- Select each key resource
- Add detailed notes explaining rationale
- Include timing information

**Step 5: Review & Export**
- Check Timeline for completeness
- Switch to Review mode for visual check
- Export ICS 214 for formal documentation

---

### Hot Wash Review Process

**Immediate Debrief (on-site)**
1. Use Review mode to present incident map
2. Walk through timeline with team
3. Discuss decision points and outcomes

**Formal Documentation (office)**
1. Export ICS 214 from mapper
2. Combine with photos and video
3. Include in incident file
4. Archive for future reference

---

## Training Scenarios

### Scenario Type 1: Hazmat Spill Response

**Setup:**
- Incident Name: "Chemical Spill at Industrial Park"
- Location: [real or fictional address]
- Operational Period: 0600-1800

**Training Focus:**
- Proper staging area placement
- Decontamination zone layout
- Resource coordination
- Personnel safety positioning

**Debrief Questions:**
- Why did you place staging area there?
- How would weather affect response?
- What resources were missing?
- How would you handle extensions?

---

### Scenario Type 2: Multi-Site Incident

**Setup:**
- Incident Name: "Highway Pipeline Rupture"
- Multiple locations: primary and secondaries
- Extended operational period: 24+ hours

**Training Focus:**
- Resource distribution
- Coordination between sites
- Equipment prioritization
- Cost management

---

### Scenario Type 3: Urban Confined Space

**Setup:**
- Incident Name: "Building Collapse - Downtown"
- Urban environment (use Road/Satellite map)
- Limited staging area options

**Training Focus:**
- Space utilization
- Traffic control
- Resource constraint management
- Creative problem-solving

---

## Frequently Asked Questions

### Q: How do I save my incident?
**A:** Incidents are saved automatically to browser storage. They persist even if you close the browser (unless you clear cache). To permanently archive, export as ICS 214 PDF.

### Q: Can I work offline?
**A:** Yes! The mapper works completely offline. The only online requirement is the initial map tile load. After that, you can disconnect and continue working.

### Q: How do I print the map?
**A:** Use your browser's Print function (Ctrl+P or Cmd+P). Switch to Review mode first for cleaner output. Choose "Background graphics" in print settings to include map.

### Q: Can I import my own icons?
**A:** Yes. Drag custom SVG files onto the palette or use the Settings to add images. They're stored in browser storage.

### Q: How do I share my incident with others?
**A:** Export as PDF (ICS 214) and share the file. Or use screen sharing during training. Browser storage is device-specific—not cloud synced.

### Q: What's the maximum number of items I can place?
**A:** Theoretically unlimited, but performance degrades with 100+ items. For optimal performance, keep under 50 placed items.

### Q: Can I undo/redo?
**A:** Yes! Use Ctrl+Z (undo) and Ctrl+Y (redo). Full undo history is maintained during your session.

### Q: How do I reset everything and start fresh?
**A:** Click Settings → scroll down and look for "Reset" or "Clear" button. Or clear browser cache for this site.

### Q: What if the map doesn't load?
**A:** 
1. Check internet connection (map tiles load from OpenStreetMap)
2. Try a different map style
3. Clear browser cache and reload
4. Try a different browser

### Q: Can I customize the grid size?
**A:** Currently fixed at 40px. Grid snap can be toggled on/off in settings.

### Q: Does the app work with browser zoom?
**A:** Yes! The app is fully responsive at 75%-150% browser zoom. Use `Ctrl++` to zoom in, `Ctrl+-` to zoom out, or `Ctrl+0` to reset. All elements scale proportionally.

### Q: Can I move the cost panel if it's covering the map?
**A:** Yes! Click the ≡ (hamburger) icon at the top of the cost panel to drag it to a new position. The position is saved automatically. Double-click the handle to reset to default position.

### Q: What does the blue/yellow banner mean?
**A:** The color-coded banner below the appbar shows your current mode:
- **Blue Banner** — Draw Mode active (drawing tools enabled)
- **Yellow Banner** — Review Mode active (map is read-only)
- No banner — Place Mode (normal operating mode)
Click "Switch to Place" in the banner to quickly return to Place mode.

### Q: How do I access Timeline and Legend now?
**A:** Look for the secondary navigation tabs directly below the appbar. You'll see tabs for Incident, Palette, Timeline, Legend, Shortcuts, and More. Click the tab you want!

### Q: Are there keyboard shortcuts?
**A:** Yes!
- **1/2/3/4** — Mode selection (Place/Draw/Review/Staging)
- **R** — Rotate selected item
- **D** — Duplicate selected item
- **Delete** — Delete selected item
- **Ctrl+Z** — Undo
- **Ctrl+Y** — Redo
- **Enter/Space** — Toggle palette category collapse (when focused on category header)
- **Escape** — Close all modals and menus
- **?** — Open keyboard shortcuts guide

### Q: What's the difference between staging area and other resources?
**A:** Staging areas are centralized command locations where equipment and personnel are held. Other resources (equipment, consumables) are deployed FROM staging areas to incident sites.

### Q: How do I calculate incident costs?
**A:** Switch to Staging mode. Each unit shows hourly rate × duration. Total costs appear in the cost summary panel. Consumables show unit cost × quantity.

---

## Tips for Success

### For Effective Training
✓ Pre-populate incident name and location  
✓ Set custom timeframes for different shifts  
✓ Use Grid Snap for professional-looking maps  
✓ Add detailed notes explaining decisions  
✓ Use secondary nav tabs to quickly show Timeline and Legend  
✓ Export for hot wash debrief documentation  
✓ Review timeline to understand progression  
✓ Show mode indicator banner to trainees to reinforce mode awareness  

### For Incident Command
✓ Use auto-populated timeframe to save setup time  
✓ Enable Grid Snap for organized deployment  
✓ Track costs in Staging mode for budgeting  
✓ Drag cost panel to avoid map obstruction  
✓ Document decisions with notes as you go  
✓ Watch the mode indicator banner for safety confirmation  
✓ Export ICS 214 for incident file  

### For Presentations
✓ Switch to Review mode for read-only viewing  
✓ Drag cost panel to the side if presenting cost information  
✓ Use secondary nav tabs for quick access to Timeline and Legend  
✓ Use Satellite map for terrain understanding  
✓ Choose Dark theme for projection visibility  
✓ Adjust browser zoom for visibility on projectors (125%-150% recommended)  
✓ Export PDF for handouts  
✓ Practice navigation before presenting

### For Mobile/Tablet Use
✓ Use the bottom sheet palette drawer to select icons  
✓ Take advantage of touch pinch-to-zoom  
✓ Enable browser zoom to 125% for better visibility  
✓ Use portrait orientation on phones for better layout  
✓ Landscape orientation better for tablets  
✓ Use keyboard shortcuts (Enter/Space) to collapse palette categories  

---

## Advanced Tips

### Creating Reusable Scenarios
1. Set up your scenario completely
2. Export as PDF for reference
3. Use as template for future training
4. Recreate in mapper for new trainees

### Performance Optimization
- Keep map zoomed to incident area
- Remove completed resources
- Use Draw mode for zones instead of many icons
- Close unused side panels

### Documentation Best Practices
- Add timestamp notes at decision points
- Document resource rationale
- Include personnel assignments
- Track weather/environmental changes
- Record unexpected changes or challenges

---

**Master the Incident Mapper and elevate your incident response training and management!**

The 2026 update brings comprehensive UX improvements including responsive scaling, draggable panels, mobile optimization, and accessibility enhancements. Whether you're on a desktop at 75% zoom or a mobile device, the mapper adapts perfectly to your needs.

Questions? See the main README.md for support and additional resources.

Last updated: May 2026 (UX & Scaling Update)
