# Electron Starter Template

A modern, production-ready Electron starter template built with security and best practices in mind.

**Author:** [Tanvir Ahmed](https://github.com/nettanvirdev) | **Location:** Dhaka, Bangladesh 🇧🇩

## 📋 About

This is a minimal yet comprehensive Electron starter template for building cross-platform desktop applications. It includes a proper project structure, security configurations (preload scripts), and npm scripts for development, building, and packaging.

## ✨ Features

- ⚡ Modern Electron setup with latest versions
- 🔒 Security-first approach with preload scripts
- 📦 Built-in packaging scripts using electron-builder and electron-packager
- 🔄 Hot reload support with nodemon
- 💻 Cross-platform compatibility (Windows, macOS, Linux)
- 🛠️ Multiple build and distribution options

## 📁 Project Structure

```
electron-learn-1/
├── main.js              # Main process - creates window and handles app lifecycle
├── preload.js           # Preload script - secure API bridge between main and renderer
├── renderer.js          # Renderer process - UI logic and interactions
├── index.html           # Main application window HTML
├── package.json         # Project dependencies and scripts
├── .gitignore          # Git ignore rules
└── README.md           # This file
```

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher)
- npm (comes with Node.js)

### Installation

1. Clone this repository:

```bash
git clone https://github.com/nettanvirdev/electron-starter.git
cd electron-starter
```

1. Install dependencies:

```bash
npm install
```

1. Start the development server:

```bash
npm start
```

## 📜 Available Scripts

### Development

```bash
npm start        # Run the app in development mode
npm run watch    # Auto-reload on file changes using nodemon
```

### Building & Packaging

```bash
npm run pack           # Create a distributable package (directory only)
npm run dist           # Create installers/packages for distribution
npm run pack-local     # Package for Windows 32-bit (local)
```

### Utilities

```bash
npm run reset    # Reset repository to last commit state
```

## 🔧 Configuration

### Main Process Configuration

Edit `main.js` to modify:

- Window size and properties
- Application menu
- IPC handlers

### Security Configuration

Edit `preload.js` to:

- Expose safe APIs to the renderer process
- Define secure communication channels

### Renderer Process

Edit `renderer.js` to add your application logic and UI interactions.

## 📦 Dependencies

### Development Dependencies

- **electron** ^26.0.0 - Electron framework
- **electron-builder** ^24.0.0 - Building installers
- **electron-packager** ^17.1.0 - Packaging tool
- **nodemon** ^2.0.22 - Auto-reload during development

### Runtime Dependencies

- **form-data** ^4.0.5 - Form data handling

## 🌐 Connect

- **GitHub:** [@nettanvirdev](https://github.com/nettanvirdev)
- **LinkedIn:** [nettanvirdev](https://www.linkedin.com/in/nettanvirdev)
- **Instagram:** [@nettanvirdev](https://www.instagram.com/nettanvirdev)
- **Website:** [levelpixel.net](https://nettanvir.dev/)

**Happy coding!** ⚡ Building scalable applications, one commit at a time.
