TiddlyDesktopQ
==============

an unofficial variant or the original TiddlyDesktop

### Introduction

[TiddlyDesktop](https://github.com/Jermolene/TiddlyDesktop) is a custom browser for TiddlyWiki, based on node-webkit

*   [https://github.com/Jermolene/TiddlyDesktop](https://github.com/Jermolene/TiddlyDesktop)

**TiddlyDesktopQ** is an unofficial variant (porting from the original version) with below differences:

1.  User interface achieved by tiddlers of TiddlyWiki
2.  Central control of Node.js TiddlyWiki server instances
3.  More features

### Feature

**TiddlyDesktopQ** has below features

*   choose to open different browser
*   central control of Node.js TiddlyWiki server instances
*   auto popup main window when new console detected
*   open Node.js console
*   start Node.js server
*   copy path / open path in file explorer

### Usage

You will need below to run [TiddlyDesktopQ](#TiddlyDesktopQ)

1.  [TiddlyDesktopQ](#TiddlyDesktopQ) source code
  *   [https://github.com/Eucaly/TiddlyDesktopQ](https://github.com/Eucaly/TiddlyDesktopQ)
2.  **TiddlyWiki5** source code in parallel to it (see folder structure as below).
  *   [https://github.com/Jermolene/TiddlyWiki5](https://github.com/Jermolene/TiddlyWiki5)
3.  Install **nodeStatus** module to your Node.js [TiddlyWiki](#TiddlyWiki) instances
  *   available in ../[TiddlyDesktopQ](#TiddlyDesktopQ)/tw5-module
4.  Config external browser list and some OS shell dependent settings
5.  **node-webkit** binary
  *   [https://github.com/rogerwang/node-webkit](https://github.com/rogerwang/node-webkit)
  *   the executable binary can resident in the same folder as [TiddlyDesktopQ](#TiddlyDesktopQ), or
  *   running from somewhere else with parameter pointing to [TiddlyDesktopQ](#TiddlyDesktopQ) folder, such as
    
    `nw <absolute or relative path to TiddlyDesktopQ>`
    
*   tested under
  *   `node-webkit v0.8.4` - win32
  *   `node-webkit v0.10.5` - win32

### Folder structure
* **TiddlyDesktopQ**
  *   html
    *   main.html
    *   host.html
  *   js
    *   main.js
* **TiddlyWiki5**
  * boot
    *   bootprefix.js
    *   boot.js
  *   core

### Screenshot
![screenshot-win32](https://github.com/Eucaly/TiddlyDesktopQ/blob/master/screenshot/2014-10-11%2022.39-win32.png)
