# Design Guidelines: Android Studio Web Platform

## Design Approach

**Selected Approach**: Design System (Material Design 3) with IDE-specific customizations

**Rationale**: This is a utility-focused developer tool requiring consistency, efficiency, and professional aesthetics. Material Design 3 aligns perfectly with Android development context while providing robust patterns for complex interfaces.

**Reference Inspiration**: VS Code (interface layout), Android Studio (workflow patterns), Linear (typography and spacing), GitHub (project management UI)

**Core Principles**:
- Dark-first interface (developer preference)
- Information density without clutter
- Clear visual hierarchy for nested content
- Instant visual feedback for actions
- Professional, non-distracting aesthetic

---

## Color Palette

### Dark Mode (Primary Theme)
- **Background Layers**: 
  - Base: 220 15% 8%
  - Elevated: 220 15% 12%
  - Overlay: 220 15% 16%
- **Primary**: 217 91% 60% (Material Blue)
- **Success**: 142 71% 45% (Build success, compile done)
- **Warning**: 38 92% 50% (Warnings in code)
- **Error**: 0 84% 60% (Build errors, syntax errors)
- **Text Primary**: 220 9% 96%
- **Text Secondary**: 220 9% 70%
- **Border**: 220 15% 20%

### Light Mode (Secondary Theme)
- **Background**: 0 0% 100%
- **Surface**: 220 14% 96%
- **Primary**: 217 91% 50%
- **Text**: 220 15% 10%

---

## Typography

**Primary Font**: 'Inter', system-ui, sans-serif (UI elements, headings)
**Monospace Font**: 'JetBrains Mono', 'Fira Code', Consolas, monospace (code editor, logs, terminal)

### Scale
- **Headings**: 
  - H1: text-3xl font-bold (Dashboard titles)
  - H2: text-2xl font-semibold (Section headers)
  - H3: text-xl font-semibold (Panel titles)
- **Body**: text-sm (Primary interface text)
- **Code**: text-sm font-mono (Editor content)
- **Small**: text-xs (Metadata, timestamps, status indicators)

---

## Layout System

**Spacing Primitives**: Tailwind units of 2, 4, 6, 8 (p-2, m-4, gap-6, h-8)

### Application Structure
- **Navigation Sidebar**: w-16 (collapsed) / w-64 (expanded) - Icon-based with tooltips
- **Main Content Area**: flex-1 with nested panels
- **Resizable Panels**: Draggable borders between code editor, file tree, preview
- **Status Bar**: h-8 fixed at bottom with build status, line/column, language

### Grid System
- Dashboard project cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- File explorer: Single column tree with indentation pl-4 per level
- Editor layout: Multi-panel flex layout with dynamic widths

---

## Component Library

### Navigation Components
**Top Navigation Bar** (h-14):
- Logo/branding (left)
- Project selector dropdown (center-left)
- Build/Run/Deploy action buttons (center-right)
- User profile menu (right)
- Background: Elevated layer with border-b

**Side Navigation** (Collapsible):
- Icon-only mode: Large icons with tooltips
- Expanded mode: Icon + label
- Active state: Primary color accent with subtle background
- Items: Dashboard, Projects, Templates, Settings, Documentation

### Editor Components
**Code Editor Panel**:
- Monaco Editor integration (VS Code engine)
- Line numbers in muted text
- Syntax highlighting following Material theme
- Minimap on right side
- Tab bar for multiple files (text-sm, scrollable)

**File Explorer**:
- Tree structure with folder/file icons
- Indent pl-4 per level
- Hover state: subtle background change
- Context menu on right-click
- Search/filter input at top

**Terminal/Console Panel** (h-64, resizable):
- Monospace font
- Command history
- Color-coded output (errors in red, success in green)
- Clear button, resize handle

### Project Management
**Project Cards** (Dashboard):
- Card with elevated background
- Project thumbnail/icon top
- Title (text-lg font-semibold)
- Metadata: Last modified, framework, status
- Quick actions: Open, Settings, Delete
- Hover: subtle elevation increase

**Build Status Component**:
- Progress bar with percentage
- Real-time log streaming
- Color-coded stages (pending, building, success, failed)
- Expandable/collapsible sections

### Form Components
**Input Fields**:
- Height h-10
- Border border with elevated background
- Focus: primary color border, subtle glow
- Labels: text-sm font-medium mb-2

**Buttons**:
- Primary: bg-primary text-white (Build, Deploy)
- Secondary: border variant with elevated bg (Cancel, Settings)
- Icon buttons: p-2 square with icon
- Height h-10 for standard, h-8 for compact

**Select/Dropdown**:
- Framework selector
- Android version selector
- Consistent height h-10
- Custom styling matching input fields

### Data Display
**Build Logs**:
- Monospace text-xs
- Auto-scroll to bottom
- Timestamps in muted color
- Filterable by log level
- Search functionality

**Device Preview Panel**:
- Phone frame mockup
- Aspect ratio selector (different devices)
- Rotation control
- Refresh/reload button
- Console output below preview

---

## Interaction Patterns

**Panel Resizing**: Draggable borders with 2px hover indicator

**Keyboard Shortcuts**: Visual indicator overlay (Ctrl/Cmd+K command palette)

**Loading States**: 
- Skeleton screens for project list
- Spinner for build processes
- Progress bars for uploads/downloads

**Notifications**:
- Toast notifications (top-right)
- Build complete, errors, warnings
- Auto-dismiss after 5s (or manual close)

---

## Animations

**Use Sparingly**:
- Panel expand/collapse: 200ms ease
- Navigation transitions: 150ms ease
- Toast slide-in: 300ms ease-out
- Button hover: No transition (instant feedback)
- **No animations** on code editor typing/interaction

---

## Authentication & User Flow

**Login Page**:
- Centered card (max-w-md)
- Logo at top
- Email/password inputs
- "Continue with GitHub/Google" buttons
- Minimal, focused design

**Dashboard Landing**:
- Welcome message with user name
- Recent projects grid
- "New Project" CTA button (prominent, primary color)
- Quick start templates section

---

## Images

**No hero images required** - this is a utility application, not a marketing site.

**Icon Usage**:
- Material Icons via CDN for all UI icons
- File type icons in explorer (code, folder, image, etc.)
- Framework logos (React Native, Flutter) in project cards

**Placeholder Graphics**:
- Empty state illustrations (SVG) for "No projects yet"
- Device mockup frames for preview panel
- Error state graphics for failed builds

---

## Responsive Behavior

**Desktop-First**: Primary target is desktop developers (1920x1080+)

**Tablet** (768px-1024px):
- Collapsible sidebar default
- Stack panels vertically when width < 1024px

**Mobile** (< 768px):
- Code editor not fully functional (display read-only preview)
- Focus on project management and build monitoring
- Bottom navigation bar instead of sidebar

---

## Accessibility

- All interactive elements keyboard navigable
- ARIA labels for icon buttons
- Focus indicators (2px primary color ring)
- Dark mode as default (with light mode toggle)
- Font size adjustable in settings