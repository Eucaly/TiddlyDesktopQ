(function(){

/*jslint browser: true */
"use strict";

var gui = require("nw.gui"),
	fs = require("fs");
var path = require("path"), 
	os = require("os");
var browserConfig = {};
//	browserConfig["TiddlyDesktop"] = {default: "dm-open-wiki"};
	browserConfig["== Default Browser =="] = {win32: "start", default: ""};
	browserConfig["Chrome"] = {win32: "start chrome", default: "chrome"};
	browserConfig["Firefox"] = {win32: "start firefox", default: "firefox"};
	browserConfig["IExplorer"] = {win32: "start iexplore", default: ""};
var openPathConfig = {win32: "start ", default: ""};
var osShellConfig = {win32: "start ", default: ""};

// ==== OS support ====
// the "default" seting is NOT effective yet
// * browser
//		set in variable "browserConfig"
// * open path / start node.js server
//		set shell prefix in variable "openPathConfig" or "osShellConfig"
// * open console window (bring console window to focus)
// 		need executable file as : bin/<platform>/focuspid

// ==== Information about each wiki we're tracking. Each entry is a hashmap with these fields:
// url: full file:// URI of the wiki
// title: last recorded title string for the wiki	=> changed to wikiTitle
// img: URI of thumbnail (usually a data URI)
// isOpen: true if these wiki is currently open

// ==== added for TiddlyDesktopQ
// title:	tiddler title, same as url
// wikiTitle:	last recorded title string for the wiki
// corePath:	the full path of tiddlywiki.js
// cwd:		working directory for node.js
// wikiPath:	TiddlyWikiFolder, which contains tiddlywiki.info file 
// initTime:	the time after "load-modules" -- OK to invoke $tw.wiki commands
// upTime:		the time after "commands" -- ready for serving (on node.js)
//			or last time opened in TiddlyDesktop
// argv:	full command line argv (calling OS to node.js)
// platform:	"node" to identify tiddlywiki on node.js

var wikiList = [];
//	saveWikiList();		// unmark list line, to force clear the wikiList in localStorage
var openedWindows = [];

// Get the main window
var mainWindow = gui.Window.get();
// mainWindow.showDevTools();		// unmark list line, to bring up dev tool at startup
// alert();						// unmark list line, to pause startup to allow dev tool to be ready

var shuttingDown = false;		// Hacky flag for when we're shutting down

// Get the current wikiList
loadWikiList();

// Close all windows when the current window is closed
mainWindow.on("close",function() {
	shuttingDown = true;
	gui.App.closeAllWindows();
	gui.App.quit();
});

// Show dev tools on F12
trapDevTools(mainWindow,document);

// ==== Begin of TiddlyWiki Section ====
// Load TiddlyWiki
var $tw = {};

// First part of boot process
require("../../TiddlyWiki5/boot/bootprefix.js").bootprefix($tw);
console.log("working direcory",process.cwd())

// Set command line
$tw.boot = $tw.boot || {};
$tw.boot.argv = ["./wiki"];

// Disable rendering
$tw.boot.disabledStartupModules = ["render"];

// Main part of boot process
require("../../TiddlyWiki5/boot/boot.js").TiddlyWiki($tw);

var PAGE_TEMPLATE_TITLE = "main";
var BROWSER_TIDDLER_TITLE = "browser";

var pageWidgetNode = $tw.wiki.makeTranscludeWidget(PAGE_TEMPLATE_TITLE,{document: document});
	
var pageContainer = document.getElementById("mainwidget");

pageWidgetNode.render(pageContainer,null);

$tw.wiki.addEventListener("change",function(changes) {
	pageWidgetNode.refresh(changes,pageContainer,null);
});

// Trap UI actions
trapUI(pageWidgetNode);

// ==== End of TiddlyWiki Section ====
$tw.wiki.addTiddler(new $tw.Tiddler({title: "process.platform", tags: "info", text: process.platform}));	// showing platform info for debug
$tw.wiki.addTiddler(new $tw.Tiddler({title: "os.platform", tags: "info", text: os.platform()}));

// Render the wiki list
//renderWikiList(document);		// old implementation, about to delete

// Open any windows that should be open
mainWindow.on("loaded",function() {
	wikiList.forEach(function(wikiInfo,index) {
		// reset tiddlywiki on node.js status, if still alive, "initTime" will back by next checkHook
		if ( (wikiInfo.platform === "node") && (wikiInfo.initTime) )
			delete wikiInfo.initTime;
		updateWikiInfoTW(wikiInfo);
		if(wikiInfo.isOpen) {
			openWiki(wikiInfo.url);
		}
	});
	// load browser dropdown list
	var list = "", defaultBrowser = "";
	for (var key in browserConfig) {
		defaultBrowser = defaultBrowser || key;
		list = list + "[[" + key  + "]] ";
		$tw.wiki.addTiddler(new $tw.Tiddler({title: BROWSER_TIDDLER_TITLE, list: list, text: defaultBrowser}));
	}
});

// ==== nodeStatus Hook portion ====
var hooktimer = {}, hook = {};
	hook.data = {};
	hook.userHome = process.env.USERPROFILE || process.env.HOME || process.env.HOMEPATH;
	hook.hookPath = path.join(hook.userHome, "tiddlywiki", "hook");
	hooktimer.running = false;
//	checkHook();

    hooktimer.ctrl = setInterval(function() {
		checkHook();
    }, 2000);

function checkHook() {
	if (hooktimer.running)
		return;
	hooktimer.running = true;
	var files = [], data;
	try {
		files = fs.readdirSync(hook.hookPath);
	} catch (e) {
		console.log(e + " #144");
		return;
	}
	for(var p=0; p<files.length; p++) {
		var fn = path.join(hook.hookPath, files[p]);
		var alive = false;
		try {
			var f1 = fs.openSync(fn, 'r');
			data = fs.readFileSync(fn,"utf8");
			fs.closeSync(f1);
			data = JSON.parse(data);
		} catch (e) {
		}
		try {
			if (data.pid)
			{
				process.kill(data.pid,0);
				alive = true;
			}
		} catch (e) {
			// process not exist => delete pid file
			try {
				stopNodeWiki(data);
				fs.unlinkSync(fn);
			} catch (e) {
			}
		}
		if (alive)
			updateNodeWiki(data);
	}
	hooktimer.running = false;
}

function updateNodeWiki(data) {
	// decode --server command parameter
	var p1 = data.argv.indexOf("--server");
	var isNew = true;
	if (p1>=0)
	{
		var params = data.argv.slice(p1+1);
		var port = params[0] || "8080",
//			rootTiddler = params[1] || "$:/core/save/all",
//			renderType = params[2] || "text/plain",
//			serveType = params[3] || "text/html",
			username = params[4],
//			password = params[5],
			host = params[6] || "127.0.0.1",
			pathprefix = params[7];
	var wikiUrl = "http://" + host + ":" + port + "/";		// todo: handling with and w/o ending "/"
	var wikiIndex = findwikiIndex(wikiUrl), wikiInfo = {};
	if (wikiIndex) {
		wikiInfo = wikiList[wikiIndex];
		isNew = true;
	} else
		wikiIndex = wikiList.length;
	var oldPassTime = wikiInfo.upTime;
		wikiInfo.argv = data.argv;
		wikiInfo.url = wikiUrl;
		wikiInfo.platform = "node";
		wikiInfo.corePath = data.argv[1];
		wikiInfo.cwd = data.cwd;
		wikiInfo.wikiPath = data.wikiPath;
		wikiInfo.initTime = data.initTime;
		wikiInfo.upTime = data.passTime;
		wikiInfo.pid = data.pid;
		// todo: pid, openserver ...  stopped
//	if (isNew)
		wikiList[wikiIndex] = wikiInfo;
	if (oldPassTime !== wikiInfo.upTime)
		mainWindow.focus();
	saveWikiList();
	updateWikiInfoTW(wikiInfo); 
	}
}

function stopNodeWiki(data) {
	var p1 = data.argv.indexOf("--server");
	if (p1>=0)
	{
		var params = data.argv.slice(p1+1);
		var port = params[0] || "8080",
			host = params[6] || "127.0.0.1";
		var wikiUrl = "http://" + host + ":" + port + "/";
		var wikiIndex = findwikiIndex(wikiUrl), wikiInfo = {};		// todo: handling with and w/o ending "/"
		if (wikiIndex) {
			wikiInfo = wikiList[wikiIndex];
			delete wikiInfo.initTime;
			saveWikiList();
			updateWikiInfoTW(wikiInfo);
		}
	}
}

function openConsole(wikiUrl) {
	var wikiInfo = findwikiInfo(wikiUrl);
	if((!wikiInfo)||(wikiInfo.platform !== "node"))
		return;
	var t = "focuspid " + wikiInfo.pid;
	var cp=require('child_process');
	cp.exec(t, {cwd: path.join(process.cwd(), "bin", os.platform())} );
}


function openBrowser(wikiUrl) {
	var wikiInfo = findwikiInfo(wikiUrl);
	var browser = $tw.wiki.getTextReference(BROWSER_TIDDLER_TITLE);
	var browser_byDefault = (browserConfig[browser]) ? browserConfig[browser]["default"] : "";
	var browser_byPlatform = (browserConfig[browser]) ? browserConfig[browser][os.platform()] : undefined;
	
	if(browser_byPlatform === undefined) {
		alert("need add support for OS : " + os.platform() + 
			"\n\nFor browser : " + browser);
	} else {
		var cp=require('child_process');
		cp.exec(browser_byPlatform + " " + wikiUrl);
	}
}

function startWikiServer(wikiUrl) {
	var wikiInfo = findwikiInfo(wikiUrl);
	if((!wikiInfo)||(wikiInfo.platform !== "node"))
		return;
	var t = osShellConfig[os.platform()];
	for (var i=0; i<wikiInfo.argv.length; i++)
		t = t + wikiInfo.argv[i] + " ";
	var cp=require('child_process');
	cp.exec(t, {cwd: wikiInfo.cwd});
}

function openPath(param) {
	var openPath_byPlatform = openPathConfig[os.platform()];
	var stats, p=param;
	try {
		stats = fs.lstatSync(p);
		if (stats.isFile()) {
			p=path.dirname(p)
		}
	}
	catch (e) {
		// ...
		return
	}
	
	if(openPath_byPlatform === undefined) {
		alert("need add support for OS : " + os.platform() + " to open path");
	} else {
		var cp=require('child_process');
		cp.exec(openPath_byPlatform + " " + p);
	}
}

function removeWikiInfoTW(title) {
	if (!title)
		return;
	$tw.wiki.deleteTiddler(title)
	return;
}

function updateWikiInfoTW(wikiInfo) {
	if (!wikiInfo.url)
		return;
	$tw.wiki.addTiddler(new $tw.Tiddler({title: wikiInfo.url, tags: "wikilist"}, wikiInfo, {img: null}));
	if (wikiInfo.img)
		$tw.wiki.addTiddler(new $tw.Tiddler({title: "img of " + wikiInfo.url, tags: "[[" + wikiInfo.url + "]]", type: "image/png", _canonical_uri: wikiInfo.img}));
	return;
}

// Helper to trap UI actions
function trapUI(dom) {
// todo: focus the window
	dom.addEventListener("dm-open-wiki",function(event) {
//alert(JSON.stringify(event));
		openWikiIfNotOpen(event.param);
		return false;
	},false);
	dom.addEventListener("dm-open-wiki-file",function(event) {
		for(var i=0;i<event.param.length;i++)
		{
			var target=event.param[i];
			openWikiIfNotOpen(convertPathToFileUrl(target.path));
		}
		return false;
	},false);
	dom.addEventListener("dm-open-browser",function(event) {
		openBrowser(event.param);
		return false;
	},false);
	dom.addEventListener("dm-open-path",function(event) {
		openPath(event.param);
		return false;
	},false);
	dom.addEventListener("dm-copy-path",function(event) {
		var clipboard = gui.Clipboard.get();
		clipboard.set(event.param, 'text');	
		return false;
	},false);
	dom.addEventListener("dm-start-server",function(event) {
		startWikiServer(event.param);
		return false;
	},false);
	dom.addEventListener("dm-open-console",function(event) {
		openConsole(event.param);
		return false;
	},false);	
	dom.addEventListener("dm-clear-wikilist",function(event) {
		wikiList=[];
		saveWikiList();	
		loadWikiList();
		return false;
	},false);
	dom.addEventListener("dm-remove-wiki",function(event) {
		var wikiInfo=findwikiInfo(event.param);
		if(!wikiInfo.isOpen) {
			var index = wikiList.indexOf(wikiInfo);
			if(index !== -1) {
				wikiList.splice(index,1);
			} else {
				throw "Cannot find item in wikiList";
			}
			saveWikiList();
			removeWikiInfoTW(event.param);
		}
		return false;
	},false);
}

 //	==== end of nodeStatus Hook portion ====

function convertPathToFileUrl(path) {
	// File prefix depends on platform
	var fileUriPrefix = "file://";
	if(process.platform.substr(0,3) === "win") {
		fileUriPrefix = fileUriPrefix + "/";
	}
	return fileUriPrefix + path.replace(/\\/g,"/");
}

function openWikiIfNotOpen(wikiUrl) {
	var wikiInfo = findwikiInfo(wikiUrl);

	if(!wikiInfo || !wikiInfo.isOpen) {
		console.log("Now opening wiki");
		openWiki(wikiUrl);
	} else if (wikiInfo.isOpen) {
		openedWindows[wikiUrl].focus();
	}
}

// Helper to open a TiddlyWiki in a new window
function openWiki(wikiUrl) {
    console.log("Opening wiki",wikiUrl);
	// Add the path to the wikiList if not already there
    var wikiInfo = findwikiInfo(wikiUrl);
	if(wikiInfo === null) {
		wikiInfo = {url: wikiUrl};
		wikiList[wikiList.length] = wikiInfo;
	}
	// Save the wiki list and update it in the DOM
	wikiInfo.isOpen = true;
	wikiInfo.upTime = $tw.utils.formatDateString(new Date(),"YYYY 0MM 0DD 0hh:0mm");
	saveWikiList();
//	renderWikiList();
	updateWikiInfoTW(wikiInfo);

	// Open the window
	var newWindow = gui.Window.open("./host.html",{
		toolbar: false,
		focus: true,
		width: 1024,
		height: 768,
		"min_width": 400,
		"min_height": 200
	});
    openedWindows[wikiUrl] = newWindow;
	// Trap close event
	newWindow.on("close",function() {
		if(!shuttingDown) {
			wikiInfo.isOpen = false;
			delete openedWindows[wikiInfo.url];
			saveWikiList();
//			renderWikiList();
			updateWikiInfoTW(wikiInfo);
		}
		this.close(true);
	});
	// Set up the new window when loaded
	var haveSetSrc = false,
		haveDisplayedError = false;
	newWindow.on("loaded",function() {
		// newWindow.showDevTools();
		var hostIframe = newWindow.window.document.getElementById("twFrame");
		if(hostIframe.src !== encodeURI(wikiUrl)) {
			hostIframe.addEventListener("load",function(event) {
				setTimeout(function() {
					newWindow.capturePage(function(imgDataUri) {
						wikiInfo.img = imgDataUri;
						var wikiTitle = hostIframe.contentWindow.document.title;
						newWindow.window.document.title = wikiTitle;
						wikiInfo.wikiTitle = wikiTitle;
						saveWikiList();
//						renderWikiList();
						updateWikiInfoTW(wikiInfo);
						},"png");
				},500);
				enableSaving(hostIframe.contentWindow,wikiUrl);
				trapDevTools(newWindow,hostIframe.contentWindow.document)
				trapLinks(hostIframe.contentWindow.document);
				saveWikiList();
				updateWikiInfoTW(wikiInfo);
//				renderWikiList();
				event.stopPropagation();
				event.preventDefault();
				return false;
			},false);
			if(!haveSetSrc) {
				hostIframe.src = wikiUrl;
				haveSetSrc = true;
			} else {
				if(!haveDisplayedError) {
					mainWindow.window.console.log("Filenotfound")
					newWindow.window.showError("File not found: " + wikiUrl)
					haveDisplayedError = true;
				}
			}
		}
	});
}

// Helper to enable TiddlyFox-style saving for a window
function enableSaving(win,wikiUrl) {
	// Create the message box
	var doc = win.document,
		messageBox = doc.createElement("div");
	messageBox.id = "tiddlyfox-message-box";
	doc.body.appendChild(messageBox);
	// Inject saving code into TiddlyWiki classic
	if(isTiddlyWikiClassic(doc)) {
		injectClassicOverrides(doc);
	}
	// Listen for save events
	messageBox.addEventListener("tiddlyfox-save-file",function(event) {
		// Get the details from the message
		var message = event.target,
			path = message.getAttribute("data-tiddlyfox-path"),
			content = message.getAttribute("data-tiddlyfox-content");
		// Save the file
		saveFile(path,content);
		// Remove the message element from the message box
		message.parentNode.removeChild(message);
		// Send a confirmation message
		var event = doc.createEvent("Events");
		event.initEvent("tiddlyfox-have-saved-file",true,false);
		event.savedFilePath = path;
		message.dispatchEvent(event);
		return false;
	},false);
}

// Helper to detect whether a document is a TiddlyWiki Classic
function isTiddlyWikiClassic(doc) {
	var versionArea = doc.getElementById("versionArea");
	return doc.getElementById("storeArea") &&
		(versionArea && /TiddlyWiki/.test(versionArea.text));
}

// Helper to inject overrides into TiddlyWiki Classic
function injectClassicOverrides(doc) {
	// Read inject.js
	var xhReq = new XMLHttpRequest();
	xhReq.open("GET","../js/inject.js",false);
	xhReq.send(null);
	// Inject it in a script tag
	var script = doc.createElement("script");
	script.appendChild(doc.createTextNode(xhReq.responseText));
	doc.getElementsByTagName("head")[0].appendChild(script);
}


// Helper function to save a file
function saveFile(path,content) {
	var fs = require("fs");
	fs.writeFileSync(path,content);
}

// Helper to find an entry in the wiki list
function findwikiInfo(url) {
	var wikiInfo = null;
	wikiList.forEach(function(listItem,index) {
		if(listItem.url === url) {
			wikiInfo = listItem;
		}
	});
	return wikiInfo;
}

function findwikiIndex(url) {
	var wikiIndex = null;
	wikiList.forEach(function(listItem,index) {
		if(listItem.url === url) {
			wikiIndex = index;
		}
	});
	return wikiIndex;
}

// Helper to trap dev tools opening within a window
function trapDevTools(window,document) {
	document.addEventListener("keyup",function(event) {
		if(event.keyCode === 123) {
			window.showDevTools();
			event.preventDefault();
			event.stopPropagation();
			return false;
		}
		return true;
	});
}

// Helper to trap wikilinks within a window
function trapLinks(doc) {
	doc.addEventListener("click",function(event) {
		// See if we're in an interwiki link
		var interwikiLink = findParentWithClass(event.target,"tc-interwiki-link");
		if(interwikiLink) {
			openWikiIfNotOpen(interwikiLink.href);
			event.preventDefault();
			event.stopPropagation();
			return false;
		}
		// See if we're in an external link
		// "tw-tiddlylink-external" is for TW5, "externallink" for TWC
		var externalLink = findParentWithClass(event.target,"tc-tiddlylink-external externalLink");
		if(externalLink) {
			gui.Shell.openExternal(externalLink.href);
			event.preventDefault();
			event.stopPropagation();
			return false;
		}
		return true;
	},false);
}

// Helper to re-render the wiki list	// retired !!
function renderWikiList(doc) {
	return;
}

// Helper to save the wikiList structure to localStorage
function saveWikiList() {
	localStorage.wikiList = JSON.stringify(wikiList);
}

// Helper to load the wikiList structure from localStorage
function loadWikiList() {
	wikiList = JSON.parse(localStorage.wikiList || "[]");
}

function findParentWithClass(node,classNames) {
	classNames = classNames.split(" ");
	while(node) {
		if(node.classList) {
			for(var t=0; t<classNames.length; t++) {
				if(node.classList.contains(classNames[t])) {
					return node;
				}
			}
		}
		node = node.parentNode;
	}
	return null;
}

})();
