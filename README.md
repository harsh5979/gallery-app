# 🖼️ IOGallery ✨

A high-performance, aesthetically pleasing media gallery application built with **Next.js 14**, **Tailwind CSS**, and **Framer Motion**. Features simplified management for both files and directories, image/video previews, and a robust code viewer for developer assets.

## ✨ Features

- **Dynamic Grid Layout**: Responsive masonry-like grid for images and folders.
- **File Management**: Create folders, upload files, delete items, and download assets.
- **Media Lightbox**:
  - Zoom/Pan support for images.
  - Video playback.
  - **Code Viewer** with syntax highlighting (Monaco Editor) for developer files.
  - Infinite scrolling support.
- **Admin Tools**: Protected edit/delete capabilities for admin users.
- **Glassmorphism UI**: Modern, premium design with blur effects and smooth animations.
- **Optimized Performance**:
  - Server Actions for file operations.
  - Lazy loading and caching for fast navigation.
  - Mobile-responsive controls.

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- Yarn or npm

### Installation

1.  **Clone the repository**:

    ```bash
    git clone https://github.com/your-username/gallery-app.git
    cd gallery-app
    ```

2.  **Install dependencies**:

    ```bash
    yarn install
    # or
    npm install
    ```

3.  **Run the development server**:

    ```bash
    yarn dev
    # or
    npm run dev
    ```

4.  Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📂 Project Structure

```
src/
├── app/
│   ├── actions.js        # Server Actions (FileSystem logic)
│   ├── api/              # API Routes (Image serving)
│   ├── globals.css       # Global styles & Tailwind config
│   ├── layout.js         # Root layout
│   └── page.js           # Main gallery page
├── components/
│   ├── admin/            # Admin-specific tools
│   ├── gallery/          # Core gallery components
│   │   ├── GalleryClient.js    # Main client-side logic
│   │   ├── GridItem.js         # Single media item
│   │   ├── Lightbox.js         # Fullscreen media viewer
│   │   ├── CodeViewer.js       # Monaco editor integration
│   │   ├── ItemActionsMenu.js  # Context menu (3-dots)
│   │   └── LightboxControls.js # Overlay controls
│   ├── layout/           # Layout components (Breadcrumbs, Navbar)
│   └── ui/               # Reusable UI (GlassButton, etc.)
└── hooks/                # Custom React hooks
```

---

## 🛠️ Implementation & Architecture

### 1. Server-Side Foundation

- **Next.js App Router**: Utilizes React Server Components (RSC) for initial data fetching.
- **Server Actions**: `actions.js` handles sensitive file system operations (read, write, delete) securely on the server.

### 2. Client-Side Interactivity (`GalleryClient.js`)

- **State Management**: Manages the list of images/folders, pagination, and selection state.
- **Infinite Scroll**: Uses `IntersectionObserver` to load more images as the user scrolls.
- **Caching**: Implements `sessionStorage` caching to restore scroll position and data when navigating back.

### 3. Lightbox & Media Viewer

- **Polymorphic Viewing**: Detecting file types to render:
  - `<Image>` for pictures (with `react-zoom-pan-pinch`).
  - `<video>` for media.
  - `Monaco Editor` for code files.
- **Animation**: `Framer Motion` handles smooth open/close/slide transitions.

### 4. Code Splitting & Optimization

- **Modular Components**: Controls and reusable UI elements (like `GlassButton`) are split for maintainability.
- **Conditional Loading**: Heavy components (like the Code Editor) are loaded lazily.
- **Role-Based Access**: Edit/Delete features are conditionally rendered based on the user's role.

---

## 📝 Usage

- **Navigation**: Click folders to navigate. Use breadcrumbs to go back.
- **Viewing**: Click any item to open the Lightbox.
- **Actions**:
  - **Hover**: Reveal action buttons on cards.
  - **Menu**: Use the three-dot menu for specialized actions (Delete, Rename, etc.).
- **Editing Files**: If logged in as Admin, open a code file in the Lightbox and click "Edit" to modify it directly.

---

## 🤝 Contributing

1.  Fork the repository.
2.  Create a feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

---

## 📄 License

Distributed under the MIT License.
