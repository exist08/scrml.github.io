/*
Some structure:
The worker holds all information about the SCRML file. The only thing not in the worker, beyond the structure needed to start the worker, is the DOM itself. The page calls to the worker to do things and the worker calls to the page to show/hide/manipulate DOM elements.
*/

onmessage = function onmessage(e) {
    let line = e.data.toString();
    try {
        let line = e.data.toString();
        guiLinkTickets.openProcess();
        functions[e.data.shift()](...e.data);
        guiLinkTickets.closeProcess();
    } catch (x) {
        postMessage(["errorOut", line + "\n" + x.message]);
        throw x;
    }
}

function fetched(type, id, dataName, ...data) {postMessage(["fetched", type, id, dataName, ...data])}

function getPageFromLinkId(linkId) {
    let returner = guiLinks.items[linkId];
    if (!returner.isPage) throw Error("link " + linkId + " is not a page");
    return returner;
}

let functions = {}, pages, pageProto = {}, chapterProto = Object.create(pageProto), statementProto = Object.create(pageProto), commentProto = Object.create(pageProto), movingPage = false, guiUnits = [], guiLinkSetups = {};

functions.log = console.log;

functions.printAll = function() {
    console.dir(pages);
};

pageProto.isPage = true;

function newPage(name, nickname = "", protoModel = pageProto) {
    let returner = Object.create(protoModel);
    pages.addItem(returner);
    returner.manager = newVarManager();
    returner.manager.setVarValue("name", name);
    returner.manager.linkProperty("name", returner);
    returner.manager.linkListener("name", function(newName) {returner.updateFullName()});
    returner.manager.linkListener("name", function() {returner.preSave()});
    returner.manager.setVarValue("nickname", nickname);
    returner.manager.linkProperty("nickname", returner);
    returner.manager.linkListener("nickname", function() {returner.preSave()});
    returner.manager.setVarValue("siblingNumber", 0);
    returner.manager.linkProperty("siblingNumber", returner);
    returner.manager.linkListener("siblingNumber", function(siblingNumber) {
        returner.updateFullPageNumber(siblingNumber);
        if (returner.nextPage) returner.nextPage.manager.setVarValue("siblingNumber", siblingNumber+1);
    });
    returner.manager.setVarValue("fullPageNumber", 0);
    returner.manager.linkProperty("fullPageNumber", returner);
    returner.manager.linkListener("fullPageNumber", function(fullPageNumber) {returner.updateFullName()});
    returner.manager.setVarValue("fullName", name);
    returner.manager.linkProperty("fullName", returner);
    returner.isOpen = false;
    returner.unlinks = [];
    //movePage(pageNumber, parentNumber, insertBeforeNumber);
    //returner.manager.setVarValue("isInUse", false);
    //returner.manager.linkListener("isInUse", function(inUse) {guiLinkTickets.addTicket(returner.pageNumber, "isInUse", inUse)}, true);
    //returner.manager.linkListener("isInUse", function() {returner.preSave()});
    returner.preSave();
    return returner;
}

function newChapter(name, nickname, protoModel = chapterProto) {
    let returner = newPage(name, nickname, protoModel);
    returner.pageType = "chapter";
    returner.childPages = [];
    return returner;
}

/*function newStatement(parentNumber, insertBeforeNumber, pageNumber, name, protoModel = statementProto) {
    let returner = newPage(parentNumber, insertBeforeNumber, pageNumber, name, protoModel);
    returner.pageType = "statement";
    return returner;
}

function newComment(parentNumber, insertBeforeNumber, pageNumber, name, protoModel = commentProto) {
    let returner = newPage(parentNumber, insertBeforeNumber, pageNumber, name, protoModel);
    returner.pageType = "comment";
    returner.manager.setVarValue("tex", "");
    returner.manager.linkProperty("tex", returner);
    returner.manager.linkListener("tex", function(tex) {fetched(returner.pageNumber, "tex", tex)});
    returner.manager.linkListener("tex", function() {returner.preSave()});
    return returner;
}*/

function movePage(page, parent, insertBefore) {
    if (page === insertBefore) return;
    if (insertBefore && page.nextPage === insertBefore) return;
    else if (page.parent && page.parent === parent && insertBefore === null && !page.nextPage) return;
    if (page.parent) {
        let oldParent = page.parent, sn = page.siblingNumber, prev = page.previousPage, next = page.nextPage;
        page.previousPage = page.nextPage = undefined;
        if (prev) prev.nextPage = next;
        if (next) next.previousPage = prev;
        oldParent.childPages.splice(sn-1, 1);
        if (next) next.manager.setVarValue("siblingNumber", next.siblingNumber - 1);
        oldParent.preSave();
    }
    if (parent) {
        page.parent = parent;
        if (insertBefore) {
            page.nextPage = insertBefore;
            page.previousPage = insertBefore.previousPage;
            if (page.previousPage) page.previousPage.nextPage = page;
            insertBefore.previousPage = page;
            parent.childPages.splice(insertBefore.siblingNumber-1, 0, page);
            page.manager.setVarValue("siblingNumber", insertBefore.siblingNumber);
        } else {
            let prev = parent.childPages[parent.childPages.length - 1];
            parent.childPages.push(page);
            page.previousPage = prev;
            if (prev) prev.nextPage = page;
            page.manager.setVarValue("siblingNumber", parent.childPages.length);
        }
        parent.preSave();
    } else {
        if (pageNumber != 0) throw Error("only page 0 can not have a parent");
        page.manager.setVarValue("siblingNumber", 1);
    }
    if (page.unlinks.length > 0) {
        guiLinkTickets.addTicket(page.linkId, "moveTo", parent.linkId, insertBefore? insertBefore.linkId: null);
    }
}

functions.newChapter = function toldToMakeNewChapter(parentId, insertBeforeId, name, visible = false) {
    let chapter = newChapter(name);
    if (visible) {
        chapter.moveTo(parentId, insertBeforeId);
        guiLinkSetups.chapter(chapter);
        guiLinkTickets.addTicket(chapter.linkId, "moveTo", parentId, insertBeforeId, false);
    }
}

guiLinkSetups.chapter = function setupChapterGuiLink(chapter) {
    if (chapter.unlinks.length > 0) throw Error("gui link already set up for chapter id " + chapter.pageId);
    guiLinks.addItem(chapter);
    postMessage(["showChapter", chapter.linkId, chapter.name]);
    chapter.unlinks.push(chapter.manager.linkListener("name", function(name) {
        guiLinkTickets.addTicket(chapter.linkId, "name", name);
    }, true));
    chapter.unlinks.push(chapter.manager.linkListener("nickname", function(nickname) {
        guiLinkTickets.addTicket(chapter.linkId, "nickname", nickname);
    }, true));
    chapter.unlinks.push(chapter.manager.linkListener("fullName", function(fullName) {
        guiLinkTickets.addTicket(chapter.linkId, "fullName", fullName);
    }, true));
    if (chapter.isOpen) chapter.showToggle();
}

let preLoaders = [];

functions.preloadPageFromAutosave = function preloadPageFromAutosave(pageId, line) {
    preLoaders[pageId] = line;
}

functions.flushLoadPagesFromAutosave = function flushLoadPagesFromAutosave() {
    // create all pages
    for (let i = 0; i < preLoaders.length; ++i) {
        if (preLoaders[i] === "skip") {
            pages.skip();
            continue;
        }
        let lines = preLoaders[i] = preLoaders[i].split("\n");
        switch (lines[0]) {
            case "chapter":
                newChapter(lines[1], lines[2]);
            break; default: throw Error("do not recognize page type " + lines[0]);
        }
    }
    // set parent/child relationships
    for (let pageId = 0; pageId < preLoaders.length; ++pageId) if (preLoaders[pageId] === "skip") continue;
    else for (let childId of preLoaders[pageId][4].split(" ")) if (childId !== "") pages.items[childId].moveTo(pageId);
    // set toggles
    for (let pageId = 0; pageId < preLoaders.length; ++pageId) pages.items[pageId].togglePage(preLoaders[pageId][3] == "o");
    // set up guiLinks for visible pages
    guiLinkSetups.chapter(pages.items[0]);
    pageTickets.addTicket(0, "smoothMode", "true");
}

functions.resetName = function resetName(pageNumber) {
    fetched(pageNumber, "name", pages[pageNumber].name);
}

functions.resetNickname = function resetNickname(pageNumber) {
    fetched(pageNumber, "nickname", pages[pageNumber].nickname);
}

functions.setName = function setName(pageNumber, name) {
    let page = pages[pageNumber];
    if (!page.parent) return page.manager.setVarValue("name", name);
    let sibling = page.previousPage;
    while (sibling) {
        if (sibling.name == name) return postMessage(["errorOut", pageNumber, "name", name]);
        sibling = sibling.previousPage;
    }
    sibling = page.nextPage;
    while (sibling) {
        if (sibling.name == name) return postMessage(["errorOut", pageNumber, "name", name]);
        sibling = sibling.nextPage;
    }
    page.manager.setVarValue("name", name);
    guiLinkTickets.addTicket(pageNumber, "save");
}

functions.setNickname = function setNickname(pageNumber, nickname) {
    pages[pageNumber].manager.setVarValue("nickname", nickname);
    guiLinkTickets.addTicket(pageNumber, "save");
}

functions.fetch = function fetch(type, linkId, dataName) {
    let link = getPageFromLinkId(linkId), data;
    switch (type) {
        case "page":
            switch (dataName) {
                case "name": data = [link.name];
                break; default: throw Error("do not recognize dataName " + dataName);
            }
        break; default: throw Error("do not recognize type " + type);
    }
    fetched(type, linkId, dataName, ...data);
}

functions.ask = function ask(type, linkId, questionType, proposedValue) {
    switch (type) {
        case "page":
            switch (questionType) {
                case "name": getPageFromLinkId(linkId).tryChangePageName(proposedValue);
                break; default: throw Error("do not recognize dataName " + dataName);
            }
        break; default: throw Error("do not recognize type " + type);
    }
}

functions.togglePage = function togglePage(linkId, open) {
    getPageFromLinkId(linkId).togglePage(open);
}

functions.setTex = function setTex(pageNumber, tex) {
    pages[pageNumber].manager.setVarValue("tex", tex);
}

functions.startMoveModeChecks = function startMoveModeChecks(linkId) {
    movingPage = getPageFromLinkId(linkId);
    for (let page of guiLinks.items) if (page.isChapter) postMessage(["canAcceptMove", page.linkId, page.canAcceptMove(movingPage)]);
}

functions.endMoveMode = function endMoveMode() {
    movingPage = false;
}

functions.movePage = function movePageTranslation(movingPageLinkId, parentLinkId, insertBeforeLinkId) {
    movePage(getPageFromLinkId(movingPageLinkId), getPageFromLinkId(parentLinkId), insertBeforeLinkId == +insertBeforeLinkId? getPageFromLinkId(insertBeforeLinkId): null);
    guiLinkTickets.addTicket(movingPageLinkId, "moveModeOff");
}

functions.newPageNameCheck = function newPageNameCheck(parentLinkId, line, insertBeforeLinkId, pageMode) {
    let parent = getPageFromLinkId(parentLinkId);
    if (!parent.isChapter) throw Error("page " + page.pageId + " is not a chapter");
    for (let child of parent.childPages) if (child.name == line) return guiLinkTickets.addTicket(parentLinkId, "newPageNameCheckFail");
    guiLinkTickets.addTicket(parentLinkId, "clearPageGap");
    switch (pageMode) {
        case "chapter":
            functions.newChapter(parentLinkId, insertBeforeLinkId, line, true);
        break; default: throw Error("do not recognize page mode " + pageMode);
    }
}

functions.openPageProcess = function openPageProcess() {pageTickets.openProcess()};

functions.closePageProcess = function closePageProcess() {pageTickets.closeProcess()};

functions.deletePage = function deletePage(pageNumber) {
    let page = pages[pageNumber];
    if (page.isInUse) throw Error("page " + pageNumber + " is still in use");
    page.preSave();
    pages[pageNumber] = "skipped";
    let prev = page.previousPage, next = page.nextPage;
    if (prev) {
        prev.nextPage = next;
        prev.manager.setVarValue("siblingNumber", prev.siblingNumber);
    } else if (next) next.manager.setVarValue("siblingNumber", page.siblingNumber);
    if (next) next.previousPage = prev;
    page.parent.childPages.splice(page.siblingNumber - 1, 1);
    page.parent.preSave();
}

function getPageIdFromGuiLinkId(linkId) {
    return getPageFromLinkId(linkId).pageId;
}

pageProto.computeFullPageNumber = function computeFullPageNumber(siblingNumber) {
    if (this.parent) {
        if (this.parent.parent) return this.parent.fullPageNumber + "." + siblingNumber;
        else return siblingNumber;
    } else return "";
}

pageProto.updateFullPageNumber = function updateFullPageNumber(siblingNumber) {
    this.manager.setVarValue("fullPageNumber", this.computeFullPageNumber(siblingNumber));
}

pageProto.computeFullName = function computeFullName() {
    if (this.parent) return this.parent.fullName + "." + this.name;
    else return this.name;
}

pageProto.updateFullName = function updateFullName() {
    this.manager.setVarValue("fullName", this.computeFullName());
}

pageProto.tryChangePageName = function tryChangePageName(proposedName) {
    if (this.parent) for (let childPage of this.parent.childPages) if (childPage !== this && childPage.name == proposedName) return guiLinkTickets.addTicket(this.linkId, "pageNameCheckFail", proposedName);
    this.manager.setVarValue("name", proposedName);
}

pageProto.moveTo = function moveTo(parentId, insertBefore = false) {
    movePage(this, pages.items[parentId], insertBefore? pages.items[insertBefore]: null);
}

pageProto.togglePage = function togglePage(open = false) {
    if (this.isOpen == open) return;
    this.isOpen = open;
    this.preSave();
    if (this.unlinks.length === 0) return;
    if (open) this.showToggle();
    else if (this.isChapter) for (let child of this.childPages) child.unlinkGuiLinks();
    //if (open && movingPage) postMessage(["canAcceptMove", this.linkId, this.canAcceptMove(movingPage)]);
}

pageProto.showToggle = function showToggle() {
    if (this.unlinks.length === 0 || !this.isOpen) throw Error("cannot showToggle page " + this.pageId);
    guiLinkTickets.addTicket(this.linkId, "setOpen", true);
    if (this.isChapter) {
        postMessage(["smoothMode", false]);
        for (let childPage of this.childPages) {
            childPage.ensureVisible();
            guiLinkTickets.addTicket(childPage.linkId, "moveTo", this.linkId, null, false);
        }
        postMessage(["smoothMode", true]);
    }
}

pageProto.ensureVisible = function ensureVisible() {
    if (this.unlinks.length === 0) guiLinkSetups[this.pageType](this);
}

pageProto.setLinkId = function setLinkId(newLinkId) {
    let oldLinkId = this.linkId;
    this.linkId = newLinkId;
    if (oldLinkId == +oldLinkId && oldLinkId !== newLinkId) postMessage(["changeLinkId", oldLinkId, newLinkId]);
    guiLinkTickets.items[newLinkId] = guiLinkTickets.items[oldLinkId];
}

pageProto.unlinkGuiLinks = function unlinkGuiLinks() {
    for (let unlink of this.unlinks) unlink();
    postMessage(["eraseLink", this.linkId]);
    guiLinks.eraseItem(this.linkId);
    delete this.linkId;
    this.unlinks.splice(0);
}

pageProto.preSave = function preSave() {pageTickets.addTicket(this.pageId, "save")};
chapterProto.isChapter = true;

chapterProto.isAncestorOf = function isAncestorOf(page) {
    while (page) {
        if (this === page) return true;
        page = page.parent;
    }
    return false;
}

chapterProto.updateFullPageNumber = function updateFullPageNumber(siblingNumber) {
    pageProto.updateFullPageNumber.call(this, siblingNumber);
    for (let child of this.childPages) child.updateFullPageNumber(child.siblingNumber);
}

chapterProto.canAcceptMove = function canAcceptMove(page) {
    if (page.isChapter && page.isAncestorOf(this)) return false;
    for (let child of this.childPages) if (page !== child && child.name === page.name) return false;
    return true;
}

chapterProto.unlinkGuiLinks = function unlinkGuiLinks() {
    if (this.isOpen) for (let child of this.childPages) child.unlinkGuiLinks();
    pageProto.unlinkGuiLinks.call(this);
}

pageProto.saveToString = function saveToString() {
    return this.pageType + "\n" + this.name + "\n" + this.nickname + "\n" + (this.isOpen? "o": "c");
}

chapterProto.saveToString = function saveToString() {
    let line = pageProto.saveToString.call(this) + "\n";
    for (let child of this.childPages) line += child.pageId + " ";
    if (this.childPages.length > 0) line = line.substring(0, line.length - 1);
    return line;
}

statementProto.saveToString = function saveToString() {
    let line = pageProto.saveToString.call(this);
    return line;
}

commentProto.saveToString = function saveToString() {
    let line = pageProto.saveToString.call(this);
    return line;
}

function emptyFunction() {}

// Workers don't have a way of importing js except modules, but modules don't work on locally hosted sites, so we just put copy/paste all the modules here.

// ticket system
{
    /*
        A ticket system is a way of deferring action until a process is complete. It starts by opening a process. Tickets are added while processes are open. A ticket is stored in a (name, function) pair, both strings, where name is intended to be the id of an object and function refers to a function which can be performed on that object. The tickets pile up as a process continues, but only by name and function. That is, no matter how many times a ticket is added for a given (name, function) pair, that function will evaluate for that name only once at the end. The tickets are all automatically evaluated and flushed once the processes are all closed. If there are no open processes, the ticket is executed immediately.
    */
    
    var ticketSystem = {};
    
    var ticketProto = {};
    
    ticketSystem.newTicketSystem = function newTicketSystem(protoModel = ticketProto) {
        let returner = Object.create(protoModel);
        returner.items = {};
        returner.ticketFunctions = {};
        returner.openProcesses = 0;
        return returner;
    }
    
    ticketProto.addTicketFunction = function addTicketFunction(name, func) {
        if (this.ticketFunctions[name]) throw Error(name + " is already a ticket function");
        this.ticketFunctions[name] = func
    }
    
    ticketProto.openProcess = function openProcess() {
        ++this.openProcesses;
    }
    
    ticketProto.closeProcess = function closeProcess() {
        if (--this.openProcesses == 0) {
            for (let item in this.items) for (let ticketFunction in this.items[item]) this.ticketFunctions[ticketFunction](item, ...this.items[item][ticketFunction]);
            this.items = {};
            this.closeProcessHook();
        }
    }
    
    ticketProto.closeProcessHook = emptyFunction;
    
    ticketProto.addTicket = function addTicket(item, ticketFunction, ...data) {
        if (this.openProcesses == 0) return this.ticketFunctions[ticketFunction](item, ...data);
        if (!this.items[item]) this.items[item] = {};
        this.items[item][ticketFunction] = data;
    }
    
    var pageTickets = ticketSystem.newTicketSystem();
    pageTickets.name = "page tickets";
    pageTickets.saveTheseObject = {};
    
    pageTickets.addTicketFunction("save", function(pageId) {
        pageTickets.saveTheseObject[pageId] = undefined;
    });
    
    pageTickets.addTicketFunction("smoothMode", function(pageId, smoothMode){
        postMessage(["smoothMode", smoothMode]);
    });
    
    pageTickets.addTicket = function addTicket(pageId, ticketFunction, ...data) {
        postMessage(["setLoadingScreen", pages.items[pageId].name + " " + ticketFunction + " " + data]);
        ticketProto.addTicket.call(this, pageId, ticketFunction, ...data);
    }
    
    pageTickets.openProcess = function openProcess() {
        ticketProto.openProcess.call(this);
    }
    
    pageTickets.closeProcessHook = function closeProcessHook() {
        this.save();
        postMessage(["closeLoadingScreen"]);
    }
    
    pageTickets.save = function save() {
        for (let pageId in this.saveTheseObject) postMessage(["save", pageId, pages.items[pageId].saveToString()]);
        this.saveTheseObject = {};
    }
    
    var guiLinkTickets = ticketSystem.newTicketSystem();
    guiLinkTickets.name = "guiLink tickets";
    
    guiLinkTickets.addTicket = function addTicket(linkId, ticketFunction, ...data) {
        postMessage(["setLoadingScreen", getPageFromLinkId(linkId).name + " " + ticketFunction + " " + data]);
        ticketProto.addTicket.call(this, linkId, ticketFunction, ...data);
    }
    
    guiLinkTickets.openProcess = function openProcess() {
        pageTickets.openProcess();
        ticketProto.openProcess.call(this);
    }
    
    guiLinkTickets.closeProcessHook = function closeProcessHook() {
        pageTickets.closeProcess();
    }
    
    guiLinkTickets.addTicketFunction("name", function(linkId, name) {
        fetched("page", linkId, "name", name);
    });
    
    guiLinkTickets.addTicketFunction("nickname", function(linkId, nickname) {
        fetched("page", linkId, "nickname", nickname);
    });
    
    guiLinkTickets.addTicketFunction("fullName", function(linkId, fullName) {
        fetched("page", linkId, "fullName", fullName);
    });
    
    guiLinkTickets.addTicketFunction("pageNameCheckFail", function(pageId, proposedValue) {
        postMessage(["pageNameCheckFail", pageId, proposedValue]);
    });
    
    guiLinkTickets.addTicketFunction("siblingNumber", function(pageNumber, siblingNumber) {
        fetched(pageNumber, "siblingNumber", siblingNumber);
    });
    
    guiLinkTickets.addTicketFunction("fullPageNumber", function(pageNumber, fullPageNumber) {
        fetched(pageNumber, "fullPageNumber", fullPageNumber);
    });
    
    guiLinkTickets.addTicketFunction("setOpen", function(linkId, open) {
        fetched("page", linkId, "setOpen", open);
    });
    
    guiLinkTickets.addTicketFunction("moveTo", function(linkId, parentId, insertBeforeId, doSmoothly) {
        postMessage(["movePage", linkId, parentId, insertBeforeId, doSmoothly]);
    });
    
    guiLinkTickets.addTicketFunction("moveModeOff", function() {
        postMessage(["moveModeOff"]);
    });
    
    guiLinkTickets.addTicketFunction("newPageNameCheckFail", function(linkId) {
        postMessage(["newPageNameCheckFail", linkId]);
    });
    
    guiLinkTickets.addTicketFunction("clearPageGap", function() {
        postMessage(["clearPageGap"]);
    })
}

// varManager
{
    let unitProto = {
        unlink: function() {
            this.next.previous = this.previous;
            this.previous.next = this.next;
        }
    }
    let changeProto = {
        addUnit: function(lastOne, unit) {
            lastOne.previous.next = unit;
            unit.previous = lastOne.previous;
            lastOne.previous = unit;
            unit.next = lastOne;
        }
    };
    let varManagerProtoModel = {
        setVarValue: function setVarValue(name, value) {
            if (!(name in this.vars)) {
                let linkedLists = Object.create(changeProto);
                this.vars[name] = linkedLists;
                linkedLists.firstProperty = {};
                linkedLists.lastProperty = {previous: linkedLists.firstProperty, object: linkedLists, propertyName: "value"};
                linkedLists.firstProperty.next = linkedLists.lastProperty;
                linkedLists.firstListener = {};
                linkedLists.lastListener = {previous: linkedLists.firstListener, listener: emptyFunction};
                linkedLists.firstListener.next = linkedLists.lastListener;
                linkedLists.firstUnlink = {};
                linkedLists.lastUnlink = {previous: linkedLists.firstUnlink, unlink: emptyFunction};
                linkedLists.firstUnlink.next = linkedLists.lastUnlink;
            }
            let change = this.vars[name], unit = change.firstProperty, oldValue = change.value;
            while (unit = unit.next) unit.object[unit.propertyName] = value;
            unit = change.firstListener;
            while (unit = unit.next) unit.listener(value, oldValue);
        },
        deleteVar: function deleteVar(varName) {
            let unit = this.vars[varName].firstUnlink;
            while (unit = unit.next) unit.unlink();
            delete this.vars[varName];
        },
        linkProperty: function linkProperty(varName, object, propertyName = varName) {
            let change = this.vars[varName];
            object[propertyName] = change.value;
            let unit = Object.create(unitProto);
            unit.object = object;
            unit.propertyName = propertyName;
            change.addUnit(change.lastProperty, unit);
            let unlinkUnit = {};
            unlinkUnit.unlink = function() {
                unit.unlink();
                unit.unlink.call(unlinkUnit);
            }
            change.addUnit(change.lastUnlink, unlinkUnit);
            return unlinkUnit.unlink;
        },
        linkListener: function linkListener(varName, listener, fireWith = undefined) {
            let change = this.vars[varName];
            if (typeof fireWith != "undefined") listener(change.value, fireWith);
            let unit = Object.create(unitProto);
            unit.listener = listener;
            change.addUnit(change.lastListener, unit);
            let unlinkUnit = {};
            unlinkUnit.unlink = function() {
                unit.unlink();
                unit.unlink.call(unlinkUnit);
            }
            change.addUnit(change.lastUnlink, unlinkUnit);
            return unlinkUnit.unlink;
        },
        clearAll: function clearAll() {
            for (let v in this.vars) this.deleteVar(v);
        },
        numLinkeds: function numLinkeds(varName) {
            let returner = 0;
            if (varName === undefined) {
                for (let name in this.vars) returner += this.numLinkeds(name);
                return returner;
            }
            let change = this.vars[varName];
            let unit = change.firstProperty.next;
            while (unit) {
                ++returner;
                unit = unit.next;
            }
            unit = change.firstListener.next;
            while (unit) {
                ++returner;
                unit = unit.next;
            }
            unit = change.firstUnlink.next;
            while (unit) {
                ++returner;
                unit = unit.next;
            }
            return returner;
        },
        numAllLinkeds: function numAllLinkeds() {
            let returner = 0;
            for (let name in this.vars) returner += this.numLinkeds(name);
            return returner;
        }
    };

    function newVarManager(protoModel = varManagerProtoModel) {
        let returner = Object.create(varManagerProtoModel);
        returner.vars = {};
        return returner;
    }
}

// idSystem
{
    function capitalizeFirstLetter(line) {
        if (line.length == 0) return line;
        return line.charAt(0).toUpperCase() + line.slice(1);
    }
    
    var idManager = {};

    idManager.protoModel = {};

    idManager.newManager = function newManager(idName = "id", protoModel = idManager.protoModel) {
        let returner = Object.create(protoModel);
        returner.items = [];
        returner.idName = idName;
        returner.setIdName = "set"+capitalizeFirstLetter(idName);
        returner.defaultSetIdName = function(id) {this[idName] = id};
        return returner;
    }

    idManager.protoModel.addItem = function addItem(item) {
        if (this.idName in item) throw Error("item already has property " + this.idName + ": " + item[this.idName]);
        if (!item[this.setIdName]) item[this.setIdName] = this.defaultSetIdName;
        item[this.setIdName](this.items.length);
        this.items.push(item);
    }

    idManager.protoModel.eraseItem = function eraseItem(id) {
        this.items[id] = this.items[this.items.length-1];
        this.items[id][this.setIdName](id);
        this.items.pop();
        this.eraseItemHook(id);
    }
    
    idManager.protoModel.eraseItemHook = emptyFunction;
    
    pages = idManager.newManager("pageId");
    guiLinks = idManager.newManager("linkId");
    guiLinks.eraseItemHook = function(id) {
        delete guiLinkTickets.items[id];
    }
}

postMessage(["errorOut", ""]);