import { bool_ref, FontRef, IImGui, InputTextFlags, number_ref, string_ref } from 'modloader64_api/Sylvain/ImGui';
import IMemory from 'modloader64_api/IMemory';
import { ImGuiStyle, ImGuiStyleManager, MemorySymbols } from './CommonUtils';
import { MemoryViewer, MemoryViewerTab } from './MemoryViewer';
import { StyleEditor } from './StyleEditor';
import { bus, EventHandler, setupEventHandlers } from 'modloader64_api/EventHandler';
import { MemoryUtils3Events, MemoryUtils3Events_AddTabEvent } from './MemoryUtilsAPI';
import { xy } from 'modloader64_api/Sylvain/vec';
import { MemoryCommandViewer, MemoryCommandViewerTab } from './MemoryCommandViewer';
import { MemorySearch } from './MemorySearch';

export class MemoryUtilsManager {
    emulator!: IMemory;
    ImGui!: IImGui;
    fontBig!: FontRef;
    fontNormal!: FontRef;
    fontSmall!: FontRef;

    symbols: MemorySymbols;
    memorySearch: MemorySearch[] = []
    memoryViewer: MemoryViewer[] = []
    commandViewer: MemoryCommandViewer[] = []
    memoryViewerName: string_ref = [""]
    commandViewerName: string_ref = [""]

    styleManager: ImGuiStyleManager;
    styleEditor: StyleEditor = new StyleEditor;
    styleCurrentRef: number_ref = [0];
    styleChanged: boolean = false;

    constructor(emulator: IMemory, ImGui: IImGui) {
        this.emulator = emulator;
        this.ImGui = ImGui;
        this.symbols = new MemorySymbols();
        this.memoryViewer = [new MemoryViewer()];
        this.memorySearch = [new MemorySearch()]
        this.commandViewer = [new MemoryCommandViewer()];
        this.styleManager = new ImGuiStyleManager();
        setupEventHandlers(this, bus)
        // default to a style?
        //this.styleChanged = true
        //this.styleCurrentRef[0] = 6
        ImGui.styleColorsDark()
    }

    // open and focus tab, will focus tab if it already exists
    @EventHandler(MemoryUtils3Events.AddTab)
    onAddTabEvent(evt: MemoryUtils3Events_AddTabEvent) {
        if (evt !== undefined) {
            let tabIndex = -1;
            let index = 0;
            for (index = 0; index < this.memoryViewer[0].tabs.length; index++) {
                if (this.memoryViewer[0].tabs[index].address === evt.address) {
                    tabIndex = index;
                    break
                }
            }

            this.memoryViewer[0]._selected[0] = true
            if (tabIndex !== -1) {
                this.memoryViewer[0].tab = tabIndex;
                this.memoryViewer[0].next_tab = tabIndex;
                this.memoryViewer[0].tabs[tabIndex].open = true;
            }
            else {
                this.memoryViewer[0].tabs.push(new MemoryViewerTab(evt.address, true))
                this.memoryViewer[0].tab = this.memoryViewer[0].tabs.length - 1;
                this.memoryViewer[0].next_tab = this.memoryViewer[0].tabs.length - 1;
            }
        }
    }

    SetFonts(big: FontRef, normal: FontRef, small: FontRef) {
        this.fontBig = big;
        this.fontNormal = normal;
        this.fontSmall = small;
    }

    Update() {
        if (this.styleChanged) {
            this.styleChanged = false;
            this.styleManager.ChangeStyle(this.ImGui, this.styleCurrentRef[0]);
        }

        this.memorySearch[0].OnTick(this.emulator)
    }

    Draw() {
        let styleBefore = this.styleCurrentRef[0];
        let indexesToDelete: number[] = []
        let index = 0

        if (this.ImGui.beginMainMenuBar()) {
            if (this.ImGui.beginMenu("DebuggerV3###MemMenuBarMenu")) {
                if (this.ImGui.beginMenu("Memory Viewers###MenuBarMemViewers")) {
                    for (index = 0; index  < this.memoryViewer.length; index++) {
                        if (this.ImGui.menuItem(this.memoryViewer[index].title + "###MemviewMenuItem" + this.memoryViewer[index].title, undefined, this.memoryViewer[index].selected, this.memoryViewer[index].open)) {
                            if (index !== 0) {
                                this.ImGui.sameLine();
                                if (this.ImGui.button("X", xy(this.ImGui.calcTextSize("F").x, this.ImGui.calcTextSize("F").y))) {
                                    indexesToDelete.push(index);
                                }
                            }
                            this.memoryViewer[index].selected = !this.memoryViewer[index].selected;
                        }
                    }


                    if (this.ImGui.button("new###newmemview", xy(this.ImGui.calcTextSize("FFFFFF").x, this.ImGui.calcTextSize("FFFFFF").y))) {
                        let push = new MemoryViewer();
                        if (this.memoryViewerName[0] === "") {
                            push.title = "Memory Viewer " + this.memoryViewer.length + "###MemView-" + (Math.random() * 0x7FFFFFFF).toString(16);
                        }
                        else {
                            push.title = this.memoryViewerName[0] + "###MemView-" + (Math.random() * 0x7FFFFFFF).toString(16);
                        }
                        push.selected = true
                        this.memoryViewer.push(push);
                    }

                    this.ImGui.endMenu();
                }

                for (index = 0; index < indexesToDelete.length; index++) {
                    if (indexesToDelete[index] !== 0) {
                        this.memoryViewer.splice(indexesToDelete[index], 1);
                    }
                }
                indexesToDelete = []

                if (this.ImGui.beginMenu("Command Viewers###MenuBarComViewers")) {
                    for (index = 0; index  < this.commandViewer.length; index++) {
                        if (this.ImGui.menuItem(this.commandViewer[index].title + "###ComviewMenuItem" + this.commandViewer[index].title, undefined, this.commandViewer[index].selected, this.commandViewer[index].open)) {
                            if (index !== 0) {
                                this.ImGui.sameLine();
                                if (this.ImGui.button("X", xy(this.ImGui.calcTextSize("F").x, this.ImGui.calcTextSize("F").y))) {
                                    indexesToDelete.push(index);
                                }
                            }
                            this.commandViewer[index].selected = !this.commandViewer[index].selected;
                        }
                    }


                    if (this.ImGui.button("new###newcomview", xy(this.ImGui.calcTextSize("FFFFFF").x, this.ImGui.calcTextSize("FFFFFF").y))) {
                        let push = new MemoryCommandViewer();
                        if (this.commandViewerName[0] === "") {
                            push.title = "Command Viewer " + this.commandViewer.length + "###MemView-" + (Math.random() * 0x7FFFFFFF).toString(16);
                        }
                        else {
                            push.title = this.commandViewerName[0] + "###MemView-" + (Math.random() * 0x7FFFFFFF).toString(16);
                        }
                        push.selected = true
                        this.commandViewer.push(push);
                    }

                    this.ImGui.endMenu();
                }

                for (index = 0; index < indexesToDelete.length; index++) {
                    if (indexesToDelete[index] !== 0) {
                        this.commandViewer.splice(indexesToDelete[index], 1);
                    }
                }
                indexesToDelete = []

                if (this.ImGui.menuItem("Style Editor###MemStyleEditor", undefined, this.styleEditor._selected[0], this.styleEditor._open[0])) {
                    this.styleEditor._selected[0] = !this.styleEditor._selected[0];
                }

                this.styleManager.QueryNames();
                if (this.ImGui.listBox("Custom Imgui Styles##ImguiStylesCustom", this.styleCurrentRef, this.styleManager.names, this.styleManager.styles.length)) {
                    this.styleChanged = true;
                }

                this.ImGui.endMenu();
            }

            this.ImGui.endMainMenuBar();
        }

        for (index = 0; index < this.memoryViewer.length; index++) {
            if (this.memoryViewer[index].selected) {
                this.memoryViewer[index].Draw(this.emulator, this.ImGui, this.fontBig, this.fontSmall);
            }
        }

        for (index = 0; index < this.commandViewer.length; index++) {
            if (this.commandViewer[index].selected) {
                this.commandViewer[index].Draw(this.emulator, this.ImGui, this.fontBig, this.fontSmall);
            }
        }

        //this.memorySearch[0].Draw(this.emulator, this.ImGui)

        if (this.styleEditor._selected[0]) {
            this.styleEditor.Draw(this.ImGui, this.styleManager)
        }
    }
}


