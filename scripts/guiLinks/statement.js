let pageType = scrmljs.mainLink.types.page, statementType, gui = scrmljs.gui, editor = scrmljs.editor;

let hostInitializer = function hostInitializer() {
    scrmljs.loadCSS("styles/guiLinks/statement.css");
    let extension = pageType.extensions.statement, statementProto = Object.create(pageType.linkProto);
    statementProto.isType = "statement";
    statementProto.isStatement = true;
    statementType = extension.type = Object.create(pageType);
    statementType.linkProto = statementProto;
    statementType.createLink = function createLink(linkId, type = statementType) {
        let page = pageType.createLink(linkId, type);
        page.simple = gui.element("div", page.div, ["class", "simple", "genesis", ""]);
        page.emptySpan = gui.textShell("This statement is empty (Genesis)", "p", page.simple, ["class", "genesis"]);
        page.members = {};
        page.newMemberButton = gui.screenedInput(page.simple, {
            atts: ["class", "newmemberbutton", "disguise", ""],
            placeholder: "new term",
            onchange: statementType.newMemberAction
        });
    }
    
    statementProto.showMember = function showMember(line) {
        console.log("page " + this.linkId + " showing member " + line);
    }
    
    statementType.newMemberAction = function newMemberAction(line, page) {
        page = pageType.getLinkFromEvent(page);
        page.newMemberButton.value = "checking " + line + "...";
        page.dm("newMember", line);
    }
}

let hostReceivingFunctions = {
    showStatement: function showStatement(linkId) {
        statementType.createLink(linkId, statementType);
    }, showMember: function showMember(linkId, line) {
        let page = pageType.getPageFromLinkId(linkId);
        page.showMember(line);
    }
}

let workerInitializer = function workerInitializer() {
    let extension = pageType.extensions.statement, statementProto = Object.create(pageType.linkProto);
    statementProto.isType = "statement";
    statementProto.isStatement = true;
    statementType = extension.statementType = Object.create(pageType);
    statementType.showPage = "showStatement";
    statementType.linkProto = statementProto;
    extension.createLink = function createLink(page, type = extension.statementType) {
        pageType.createLink(page, type);
        let link = page.guiLink;
        for (let member of page.graph.members.items) if (member.id) link.dm("showMember", member.saveToAutosaveString());
    }
}

let workerReceivingFunctions = {
    newMember: function newMember(linkId, name) {
        let page = getPageFromLinkId(linkId), graph = page.graph;
        // need to know type and prototype. prototype can probably come from type, but need to know type.
    }
}

pageType.extensions.statement = {
    initializers: {
        host: hostInitializer,
        worker: workerInitializer
    }, receivingFunctions: {
        host: hostReceivingFunctions,
        worker: workerReceivingFunctions
    }
}