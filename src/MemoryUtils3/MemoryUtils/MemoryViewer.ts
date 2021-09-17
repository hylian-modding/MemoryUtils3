import IMemory from "modloader64_api/IMemory";
import { bool_ref, Col, FontRef, IImGui, InputTextFlags, MouseButton, number_ref, string_ref, StyleVar, TabBarFlags, TabItemFlags, WindowFlags } from "modloader64_api/Sylvain/ImGui"
import { Scancode } from "modloader64_api/Sylvain/Keybd";
import { vec2, vec4, xy, xywh } from "modloader64_api/Sylvain/vec";
import * as CommonUtils from "./CommonUtils"
import { bus, EventHandler, setupEventHandlers } from "modloader64_api/EventHandler";

export class MemoryViewerTab {
    // is tab currently focused?
    _open: bool_ref = [false];

    // base address
    _address: number_ref = [0x80000000];

    // inputInt is signed and 32 bit! aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaahhhhhhhhhhhhhhh! Why?!
    _addressRef: string_ref = ["80000000"]

    // left-hand-side of cursor in nibble-space
    _cursorStart: number_ref = [CommonUtils.AddressToNibble(0x80000000)];

    // right-hand-side of cursor in nibble-space
    _cursorEnd: number_ref = [CommonUtils.AddressToNibble(0x80000000)];

    // user comment
    _note: string_ref = [""];

    open!: boolean
    address!: number
    addressRef!: string
    cursorStart!: number
    cursorEnd!: number
    note!: string

    constructor(address: number = 0x80000000, open: boolean = true) {
        CommonUtils.MacroScriptTM(this);
        this.address = address;
        this.addressRef = address.toString(16)
        this.cursorStart = CommonUtils.AddressToNibble(address);
        this.cursorEnd = this.cursorStart;
        this.open = open;
    }

    get cursorAddress(): number {
        return Math.floor(this._cursorStart[0] / 2);
    }

    set cursorAddress(value: number) {
        this._cursorStart[0] = value * 2;
    }

    get cursorStartNibble(): number {
        return this._cursorStart[0] % 2;
    }

    get cursorEndNibble(): number {
        return this._cursorEnd[0] % 2;
    }

    get cursorNibble(): number {
        return this._cursorStart[0] % 2;
    }
}

export class MemoryViewerSettings {
    _uppercaseHex: bool_ref = [true];
    _showText: bool_ref = [true];
    _altColorColumns: bool_ref = [true];
    _altColorRows: bool_ref = [true];
    _darkZero: bool_ref = [true];
    _groupDarkZero: bool_ref = [true];
    _alignColumns: bool_ref = [true];
    _visualizeDebug: bool_ref = [false];
    _byteGrouping: number_ref = [4];
    _forceColumns: number_ref = [0];
    _forceRows: number_ref = [0];
    _charSizePadding: number_ref = [1];
    _cellSizePadding: number_ref = [4];
    _cellGroupPadding: number_ref = [6];
    _horizontalPadding: number_ref = [6];
    _verticalPadding: number_ref = [2];
    _invalidAddrString: string_ref = ["********"];
    _invalidHexString: string_ref = ["**"];
    _invalidTextString: string_ref = ["."];

    uppercaseHex!: boolean;
    showText!: boolean;
    altColorColumns!: boolean;
    altColorRows!: boolean;
    darkZero!: boolean;
    groupDarkZero!: boolean;
    alignColumns!: boolean;
    visualizeDebug!: boolean;
    byteGrouping!: number;
    forceColumns!: number;
    forceRows!: number;
    charSizePadding!: number;
    cellSizePadding!: number;
    cellGroupPadding!: number;
    horizontalPadding!: number;
    verticalPadding!: number;
    invalidAddrString!: string;
    invalidHexString!: string;
    invalidTextString!: string;

    byteCheckBuffer: Buffer = Buffer.alloc(4)

    constructor() {
        CommonUtils.MacroScriptTM(this);
    }
}

export class MemoryViewer {
    _open: bool_ref = [true];
    _selected: bool_ref = [false];
    _openSettings: bool_ref = [false]
    tabs: MemoryViewerTab[] = [new MemoryViewerTab()];
    tab: number = 0;
    next_tab: number = -1;
    settings: MemoryViewerSettings = new MemoryViewerSettings();
    initial: boolean = true;

    open!: boolean
    selected!: boolean
    openSettings!: boolean

    settingsDrawnThisFrame: boolean = false
    title: string = "Memory Viewer";

    constructor() {
        CommonUtils.MacroScriptTM(this);
    }

    GetHexColumnOffset(column: number, cellSizeX: number, cellGroupPadding: number): number {
        return Math.ceil(column * cellSizeX) + (Math.floor(column / this.settings.byteGrouping) * cellGroupPadding);
    }

    DrawOptionsMenu(ImGui: IImGui) {
        if (ImGui.begin("Memory Viewer Settings###" + this.title + "settings", this._openSettings)) {
            ImGui.checkbox("Uppercase Hex", this.settings._uppercaseHex);
            ImGui.checkbox("Display Text", this.settings._showText);
            ImGui.checkbox("Alternating Column Colors", this.settings._altColorColumns);
            ImGui.checkbox("Alternating Row Colors", this.settings._altColorRows);
            ImGui.checkbox("Darken Zeroes", this.settings._darkZero);
            ImGui.checkbox("Use grouping for Darken Zeroes", this.settings._groupDarkZero);
            ImGui.checkbox("Align Columns", this.settings._alignColumns);
            ImGui.checkbox("Visualize Debug", this.settings._visualizeDebug);
            if (ImGui.inputInt("Byte Grouping", this.settings._byteGrouping, 2, undefined,
            InputTextFlags.CharsHexadecimal
            | InputTextFlags.CharsNoBlank
            | (this.settings.uppercaseHex ? InputTextFlags.CharsUppercase : InputTextFlags.None)
            | InputTextFlags.NoHorizontalScroll
            )) {
                if (this.settings.byteGrouping === 0) this.settings.byteGrouping = 1;

                this.settings.byteCheckBuffer = Buffer.alloc(this.settings.byteGrouping)
            }

            if (ImGui.inputInt("Force Column Amount (0 = auto)", this.settings._forceColumns)) {
                if (this.settings._forceColumns[0] < 0) this.settings._forceColumns[0] = 0;
            }

            if (ImGui.inputInt("Force Row Amount", this.settings._forceRows)) {
                if (this.settings._forceRows[0] < 0) this.settings._forceRows[0] = 0;
            }

            ImGui.inputInt("Character Size Padding", this.settings._charSizePadding);
            ImGui.inputInt("Cell Size Padding", this.settings._cellSizePadding);
            ImGui.inputInt("Cell Group Padding", this.settings._cellGroupPadding);
            ImGui.inputInt("Horizontal Padding", this.settings._horizontalPadding);
            ImGui.inputInt("Vertical Padding", this.settings._verticalPadding);
            ImGui.inputText("Invalid Address Text", this.settings._invalidAddrString);
            ImGui.inputText("Invalid Hex Text", this.settings._invalidHexString);
            ImGui.inputText("Invalid Text Text", this.settings._invalidTextString);
        }
        ImGui.end();
    }

    DrawTab(memory: IMemory, ImGui:  IImGui, fontNorm: FontRef, fontSmall: FontRef, tabIndex: number) {
        let index: number = 0;
        let jndex: number = 0;
        let address: number = 0;
        let bddress: number = 0;
        let posX: number = 0;
        let posY: number = 0;
        let charSizeX: number = 0;
        let charSizeY: number = 0;
        let cellSizeX: number = 0;
        let cellSizeY: number = 0;
        let headerSizeY: number = 0;
        let footerSizeY: number = 0;
        let groupSizeX: number = 0;
        let columnAddressSize: number = 0;
        let columnHexSize: number = 0;
        let columnTextSize: number = 0;
        let columnAddressStart: number = 0;
        let columnHexStart: number = 0;
        let columnTextStart: number = 0;
        let rows: number = 0;
        let columns: number = 0;
        let bytesPerRow: number = 0;
        let rdramSize: number = 0x03E00000;
        let windowSize: vec2 = xy(0, 0)
        let bodySize: vec2 = xy(0, 0)
        let bodyPosY = 0;
        let tempString: string = "";
        let tempNum: number = 0;
        let currentTab: MemoryViewerTab = this.tabs[tabIndex]

        windowSize = ImGui.calcTextSize("F");
        charSizeX = windowSize.x + this.settings.charSizePadding;
        charSizeY = windowSize.y + this.settings.charSizePadding;
        windowSize = ImGui.getWindowContentRegionMax()

        posY = ImGui.getCursorScreenPos().y;
        ImGui.setNextItemWidth(10 * charSizeX);
        if (ImGui.inputText("Address", currentTab._addressRef,
                InputTextFlags.CharsHexadecimal
                | InputTextFlags.CharsNoBlank
                | (this.settings.uppercaseHex ? InputTextFlags.CharsUppercase : InputTextFlags.None)
                | InputTextFlags.EnterReturnsTrue
                | InputTextFlags.NoHorizontalScroll)) {
                // initialize stuff here
                currentTab.address = parseInt(currentTab._addressRef[0], 16);
                currentTab.cursorStart = (currentTab.address * 2);
                currentTab.cursorEnd = (currentTab.address * 2);
                console.log("Address changed to " + currentTab.address.toString(16));
            }

            ImGui.sameLine();
            if (ImGui.button("Settings", xy(10 * charSizeX, ImGui.getTextLineHeightWithSpacing()))) {
                this.openSettings = !this.openSettings;
            }
            if (this.openSettings && !this.settingsDrawnThisFrame) {
                this.settingsDrawnThisFrame = true
                this.DrawOptionsMenu(ImGui);
            }

            headerSizeY = (ImGui.getCursorScreenPos().y - posY) + this.settings.verticalPadding;
            footerSizeY = cellSizeY + 80; // dunno where the 80 comes from, I guess there's empty space below this? Other windows have this at the top? Shit is so weird.

            bodySize = xy(windowSize.x, windowSize.y - footerSizeY - headerSizeY)
            bodyPosY = ImGui.getCursorPosY()
            ImGui.beginChildFrame(1, bodySize, WindowFlags.NoScrollWithMouse | WindowFlags.NoScrollbar | WindowFlags.NoTitleBar | WindowFlags.NoSavedSettings | WindowFlags.NoMove | WindowFlags.NoResize);
            ImGui.pushFont(fontNorm);

            windowSize = ImGui.calcTextSize("F");
            charSizeX = windowSize.x + this.settings.charSizePadding;
            charSizeY = windowSize.y + this.settings.charSizePadding;
            cellSizeX = (charSizeX * 2) + this.settings.cellSizePadding;
            cellSizeY = charSizeY;
            groupSizeX = (cellSizeX * this.settings.byteGrouping) + this.settings.cellGroupPadding;
            windowSize = ImGui.getWindowContentRegionMax();

            tempString = currentTab.address.toString(16);
            ImGui.pushStyleVar(StyleVar.FramePadding, xy(0, 0));
            ImGui.pushStyleVar(StyleVar.ItemSpacing, xy(0, 0));
            ImGui.pushStyleVar(StyleVar.ItemInnerSpacing, xy(0 ,0));

            columnAddressSize = (8 * charSizeX) + this.settings.horizontalPadding;
            columnAddressStart = this.settings.charSizePadding + ImGui.getStyle().windowPadding.x;
            columnHexStart = columnAddressStart + columnAddressSize;

            if (this.settings.forceColumns !== 0) {
                columns = this.settings.forceColumns;
                columnHexSize = this.GetHexColumnOffset(columns, cellSizeX, this.settings.cellGroupPadding);
            }
            else {
                // BUG: I am doing some char size-relevant math incorrectly somewhere, this outrageous padding is a shitty temporary fix for that
                columnHexSize = windowSize.x - (columnAddressSize * 2);
            }

            if (this.settings.showText) {
                if (columns === 0) {
                    columns = Math.floor(columnHexSize / (this.GetHexColumnOffset(1, cellSizeX, this.settings.cellGroupPadding) + charSizeX));
                    if (this.settings.alignColumns && this.settings.forceColumns === 0) {
                        columns = Math.floor(columns / this.settings.byteGrouping) * this.settings.byteGrouping
                    }
                    columnHexSize = this.GetHexColumnOffset(columns, cellSizeX, this.settings.cellGroupPadding);
                }

                columnTextSize = charSizeX + (columns * charSizeX);
                columnTextStart = columnHexStart + columnHexSize;
            }
            else {
                if (columns === 0) {
                    columns = Math.floor(columnHexSize / this.GetHexColumnOffset(1, cellSizeX, this.settings.cellGroupPadding));
                    if (this.settings.alignColumns && this.settings.forceColumns === 0) {
                        columns = Math.floor(columns / this.settings.byteGrouping) * this.settings.byteGrouping
                    }
                }

                columnTextSize = 0;
                columnTextStart = columnHexStart + columnHexSize;
            }

            bytesPerRow = columns;

            if (this.settings._forceRows[0] == 0) rows = Math.floor(bodySize.y / cellSizeY) - 1;
            else rows = this.settings._forceRows[0];

            if (columns < 0) columns = 0;
            if (rows < 0) rows = 0;

            ImGui.separator();

            // Draw column offset
            ImGui.newLine()
            ImGui.sameLine(columnAddressStart, 0);
            ImGui.textDisabled(columns.toString() + ", " + rows.toString())
            for (index = 0; index < columns; index++) {
                posX = columnHexStart + this.GetHexColumnOffset(index, cellSizeX, this.settings.cellGroupPadding);
                tempString = CommonUtils.PadAddress(index);
                ImGui.sameLine(posX, 0);
                if (index % 2) ImGui.textDisabled(tempString);
                else ImGui.textDisabled(tempString);

                if (this.settings.visualizeDebug) {
                    // debug view offset columns (reddish-grey)
                    ImGui.getWindowDrawList().addLine(
                        xy(posX - (charSizeX / 2), 0),
                        xy(posX - (charSizeX / 2), bodySize.y),
                        xywh(0.75, 0.5, 0.5, 0.25 * (index % this.settings.byteGrouping ? 0.5 : 1))
                    );

                    // debig view end-of-bytegroup (pink)
                    if ((index % this.settings.byteGrouping) === 0) {
                        ImGui.getWindowDrawList().addLine(
                            xy((posX - (charSizeX / 2)) + groupSizeX, 0),
                            xy((posX - (charSizeX / 2)) + groupSizeX, bodySize.y),
                            xywh(1.0, 0.65, 0.65, 0.75 * (index % this.settings.byteGrouping ? 0.5 : 1))
                        );
                    }
                }
            }

            ImGui.separator();

            // vertical line for address columns and hex column
            ImGui.getWindowDrawList().addLine(
                xy(columnHexStart - (charSizeX / 2), 0),
                xy(columnHexStart - (charSizeX / 2), bodySize.y),
                ImGui.getColor(Col.Separator)
            );

            if (this.settings.visualizeDebug) {
                // debug view start of hex (blue)
                ImGui.getWindowDrawList().addLine(
                    xy(columnHexStart, 0),
                    xy(columnHexStart, bodySize.y),
                    xywh(0, 0, 1, 1)
                );

                // debug view end of hex (red)
                ImGui.getWindowDrawList().addLine(
                    xy((columnHexStart + columnHexSize), 0),
                    xy((columnHexStart + columnHexSize), bodySize.y),
                    xywh(1, 0, 0, 1)
                );
            }

            if (this.settings.showText) {
                ImGui.getWindowDrawList().addLine(
                    xy(columnTextStart, 0),
                    xy(columnTextStart, bodySize.y),
                    ImGui.getColor(Col.Separator)
                );

                if (this.settings.visualizeDebug) {
                    // debug view start of text (green)
                    ImGui.getWindowDrawList().addLine(
                        xy(columnTextStart, 0),
                        xy(columnTextStart, bodySize.y),
                        xywh(0, 1, 0, 1),
                    );

                    // debug view end of text (pink)
                    ImGui.getWindowDrawList().addLine(
                        xy((columnTextStart + columnTextSize), 0),
                        xy((columnTextStart + columnTextSize), bodySize.y),
                        xywh(1, 0, 1, 1)
                    );
                }
            }

            for (index = 0; index < rows; index++) {
                address = currentTab.address + (bytesPerRow * index);

                if (address >= 0x80000000) tempString = CommonUtils.PadAddress(address);
                else tempString = this.settings._invalidAddrString[0];

                ImGui.sameLine(columnAddressStart, 0);
                ImGui.textDisabled(tempString);

                for (jndex = 0; jndex < columns; jndex++) {
                    bddress = address + jndex;
                    posX = columnHexStart + this.GetHexColumnOffset(jndex, cellSizeX, this.settings.cellGroupPadding);
                    // posY being used as text pos
                    posY = columnTextStart + charSizeX + (charSizeX * jndex)
                    tempNum = 0;
                    ImGui.sameLine(posX);

                    let absoluteRow = Math.floor((address - 0x80000000) / bytesPerRow)
                    let absoluteColumn = Math.floor((bddress - 0x80000000) / this.settings.byteGrouping)

                    if (this.settings.altColorColumns) tempNum ^= absoluteColumn % 2
                    if (this.settings.altColorRows) tempNum ^= absoluteRow % 2

                    if (bddress == Math.floor(currentTab.cursorAddress)) {
                        ImGui.getWindowDrawList().addLine(
                            xy(ImGui.getCursorPosX() + (currentTab.cursorStartNibble * charSizeX), ImGui.getCursorPosY()),
                            xy(ImGui.getCursorPosX() + (currentTab.cursorStartNibble * charSizeX), ImGui.getCursorPosY() + cellSizeY),
                            xywh(1, 1, 1, 1),
                            1
                        );
                    }

                    let maskedAddr = bddress & 0x0FFFFFFF;

                    if (maskedAddr < rdramSize && bddress >= 0x80000000) {
                        let value = memory.rdramRead8(bddress);
                        tempString = CommonUtils.PadAddress(value);

                        let col0 = ImGui.getStyleColor(Col.Text)
                        let col1 = ImGui.getStyleColor(Col.TextDisabled)
                        col0.w *= 0.5
                        col1.w *= 0.5

                        // if you are in a byte grouping, and it is equal to zero, and you have these options enabled
                        if (this.settings.darkZero && this.settings.groupDarkZero && memory.rdramReadBuffer(bddress & ~(this.settings.byteGrouping - 1), this.settings.byteGrouping).compare(this.settings.byteCheckBuffer) === 0) {
                            if (tempNum) ImGui.textColored(tempString, col0)
                            else ImGui.textColored(tempString, col1)
                        }
                        else {
                            if (this.settings.darkZero && !this.settings.groupDarkZero && value === 0) {
                                if (tempNum) ImGui.textColored(tempString, col0)
                                else ImGui.textColored(tempString, col1)
                            }
                            else {
                                if (tempNum) ImGui.textDisabled(tempString)
                                else ImGui.text(tempString);
                            }
                        }
                    }
                    else ImGui.textDisabled(this.settings._invalidHexString[0]);

                    if (this.settings.showText) {
                        ImGui.sameLine(posY)
                        if (maskedAddr < rdramSize && bddress >= 0x80000000) {
                            let value = memory.rdramReadBuffer(bddress, 1);
                            tempString = value.toString("ascii");

                            if (value.readUInt8(0) === 0 && this.settings.darkZero) ImGui.textDisabled(this.settings._invalidTextString[0]);
                            else {
                                if (tempNum) ImGui.textDisabled(tempString)
                                else ImGui.text(tempString);
                            }
                        }
                        else ImGui.textDisabled(this.settings._invalidTextString[0]);
                    }
                }

                ImGui.newLine();
            }

            ImGui.popStyleVar(3);
            ImGui.popFont();
            ImGui.endChildFrame()

            // Input
            let mpos = ImGui.getMousePos();
            let wpos = xy(mpos.x, mpos.y)
            let rpos: vec2 = xy(0, 0)
            let col = -1;
            let ro = -1;
            let nib = 0;
            let cell = 0;

            wpos.x -= ImGui.getWindowPos().x;
            wpos.y -= ImGui.getWindowPos().y;

            rpos = xy(wpos.x, wpos.y)
            rpos.y -= bodyPosY
            if (rpos.y > 0 && rpos.y < bodySize.y && rpos.x > 0 && rpos.x < windowSize.x) {
                ro = Math.floor((rpos.y - cellSizeY + this.settings.verticalPadding) / cellSizeY) // FIXME: line spacing shit is off by 2??

                if (rpos.x > columnHexStart && rpos.x < columnTextStart) {
                    rpos.x -= columnHexStart;

                    // get group
                    col = Math.floor(rpos.x / ((cellSizeX * this.settings.byteGrouping) + this.settings.cellGroupPadding));

                    // get offset of 0th cell in group
                    cell = this.GetHexColumnOffset(col * this.settings.byteGrouping, cellSizeX, this.settings.cellGroupPadding);

                    // get relative cell that mouse is in
                    // (pos - offset) / cell width // (relative cell index)
                    // + group * bytes per group // (add offset from origin)
                    col = Math.floor(((rpos.x - cell) / cellSizeX) + (col * this.settings.byteGrouping));
                    nib = Math.floor((rpos.x - this.GetHexColumnOffset(col, cellSizeX, this.settings.cellGroupPadding)) / charSizeX) % 2
                }
                else if (rpos.x > columnTextStart) {
                    rpos.x -= columnTextStart;

                    col = Math.floor(rpos.x / charSizeX);
                }
            }

            // FIXME: can't find a way to make this work well without having the mouse in the body
            rpos = xy(wpos.x, wpos.y)
            rpos.y -= bodyPosY
            if (rpos.y > 0 && rpos.y < bodySize.y && rpos.x > 0 && rpos.x < windowSize.x) {
                let horz = 0;
                let vert = 0;
                let page = 0;
                let deltaNibbles = 0;
                let space = ImGui.isKeyPressed(Scancode.Space)
                let n = ImGui.isKeyPressed(Scancode.N)
                let t = ImGui.isKeyPressed(Scancode.T)
                let home = ImGui.isKeyPressed(Scancode.Home)
                let end = ImGui.isKeyPressed(Scancode.End)
                let ctrl = ImGui.isKeyDown(Scancode.LeftCtrl) || ImGui.isKeyDown(Scancode.RightCtrl);
                let alt = ImGui.isKeyDown(Scancode.LeftAlt) || ImGui.isKeyDown(Scancode.RightAlt);
                let shift = ImGui.isKeyDown(Scancode.LeftShift) || ImGui.isKeyDown(Scancode.RightShift);
                let click = ImGui.isMouseClicked(MouseButton.Left, false);
                let byte = 0;
                let offsetAddr = (currentTab.cursorAddress - currentTab.address);

                if (ImGui.isKeyPressed(Scancode.Right)) horz += 1;
                if (ImGui.isKeyPressed(Scancode.Left)) horz -= 1;
                if (ImGui.isKeyPressed(Scancode.Up)) vert -= 1;
                if (ImGui.isKeyPressed(Scancode.Down)) vert += 1;
                if (ImGui.isKeyPressed(Scancode.PageUp)) page -= 1;
                if (ImGui.isKeyPressed(Scancode.PageDown)) page += 1;

                currentTab.address += (-ImGui.getIo().mouseWheel.y) * (bytesPerRow * 2)

                deltaNibbles = horz + (vert * (bytesPerRow * 2)) + (page * ((bytesPerRow * rows) * 2));

                if (click && (col != -1 || ro != -1)) {
                    let cursorCol = 0;
                    let cursorRow = 0;


                    cursorRow = Math.floor(offsetAddr / bytesPerRow);
                    cursorCol = offsetAddr % bytesPerRow;
                    console.log("Cursor row " + cursorRow + " col " + cursorCol + " nib " + nib);

                    deltaNibbles = ((ro - cursorRow) * bytesPerRow * 2) + ((col - cursorCol) * 2) + nib;
                    console.log("Mouse click delta nibbles: " + deltaNibbles + " (" + Math.floor(deltaNibbles / 2).toString(16) + " bytes)");
                }

                if (!shift && deltaNibbles) {
                    currentTab._cursorStart[0] += deltaNibbles;
                    currentTab._cursorEnd[0] += deltaNibbles;
                }

                if (ctrl && space) {
                    this.tabs.push(new MemoryViewerTab(memory.rdramRead32(currentTab.cursorAddress), true))
                }

                if (ctrl && n) {
                    this.tabs.push(new MemoryViewerTab(0x80000000, true))
                }

                if (ctrl && t) {
                    this.tabs.push(new MemoryViewerTab(currentTab.address, true))
                }

                if (home) {
                    currentTab.cursorStart = (currentTab.address + (Math.floor(offsetAddr / bytesPerRow) * bytesPerRow)) * 2
                }

                if (end) {
                    currentTab.cursorStart = ((currentTab.address + ((Math.floor(offsetAddr / bytesPerRow) + 1) * bytesPerRow)) * 2) - 1
                }

                let WriteByteCommon = (value: number) => {
                    if (alt && shift) {
                        byte = memory.rdramRead8(currentTab.cursorAddress);
                        byte = (byte & 0xF0) | (value & 0x0F)
                    }
                    else if (alt) {
                        byte = value;
                    }
                    else if (shift) {
                        byte = memory.rdramRead8(currentTab.cursorAddress);
                        byte = (byte & 0x0F) | (value & 0xF0)
                    }
                    else {
                        byte = memory.rdramRead8(currentTab.cursorAddress);
                        byte = CommonUtils.GetNibble(byte, 1 - currentTab.cursorNibble);
                        byte |= CommonUtils.GetNibble(value, currentTab.cursorNibble);
                    }

                    memory.rdramWrite8(currentTab.cursorAddress, byte);
                    currentTab.cursorStart += (alt || shift) ? 2 : 1;
                };

                if (ImGui.isKeyPressed(Scancode.Backspace)) {
                    tempNum = 1 - currentTab.cursorNibble;
                    currentTab.cursorStart -= tempNum;
                    byte = memory.rdramRead8(currentTab.cursorAddress);
                    byte = CommonUtils.GetNibble(byte, tempNum ? (1 - currentTab.cursorNibble) : currentTab.cursorNibble);

                    memory.rdramWrite8(currentTab.cursorAddress, byte);
                    if (!tempNum) currentTab.cursorStart--;
                }

                if (ImGui.isKeyPressed(Scancode.Num0)) WriteByteCommon(0x00);
                if (ImGui.isKeyPressed(Scancode.Num1)) WriteByteCommon(0x11);
                if (ImGui.isKeyPressed(Scancode.Num2)) WriteByteCommon(0x22);
                if (ImGui.isKeyPressed(Scancode.Num3)) WriteByteCommon(0x33);
                if (ImGui.isKeyPressed(Scancode.Num4)) WriteByteCommon(0x44);
                if (ImGui.isKeyPressed(Scancode.Num5)) WriteByteCommon(0x55);
                if (ImGui.isKeyPressed(Scancode.Num6)) WriteByteCommon(0x66);
                if (ImGui.isKeyPressed(Scancode.Num7)) WriteByteCommon(0x77);
                if (ImGui.isKeyPressed(Scancode.Num8)) WriteByteCommon(0x88);
                if (ImGui.isKeyPressed(Scancode.Num9)) WriteByteCommon(0x99);

                if (ImGui.isKeyPressed(Scancode.A)) WriteByteCommon(0xAA);
                if (ImGui.isKeyPressed(Scancode.B)) WriteByteCommon(0xBB);
                if (ImGui.isKeyPressed(Scancode.C)) WriteByteCommon(0xCC);
                if (ImGui.isKeyPressed(Scancode.D)) WriteByteCommon(0xDD);
                if (ImGui.isKeyPressed(Scancode.E)) WriteByteCommon(0xEE);
                if (ImGui.isKeyPressed(Scancode.F)) WriteByteCommon(0xFF);
                if (ImGui.isKeyPressed(Scancode.Delete)) memory.rdramWrite8(currentTab.cursorAddress, 0);

                // FIXME: I disabled these when I added scrolling, TODO: need to account for scrolling here
                //while (currentTab.cursorAddress < currentTab.address) currentTab.address -= bytesPerRow;
                //while (currentTab.cursorAddress > currentTab.address + (rows * bytesPerRow)) currentTab.address += bytesPerRow;
            }


            // Footer
            ImGui.separator();
            ImGui.pushFont(fontSmall);
            ImGui.pushStyleVar(StyleVar.FramePadding, xy(0, 0))
            ImGui.pushStyleVar(StyleVar.ItemSpacing, xy(0, 0))
            ImGui.pushStyleVar(StyleVar.ItemInnerSpacing, xy(0 ,0));

            tempString = currentTab.cursorAddress.toString(16);
            if (currentTab.cursorEnd !== currentTab.cursorStart) {
                tempString += ":" + Math.floor(currentTab.cursorEnd / 2).toString(16)
                + "(" + Math.floor((currentTab.cursorEnd - currentTab.cursorStart) / 2).toString(16) + ")";
            }

            tempString += "|";

            if ((address & 0x0FFFFFFF) < rdramSize) {
                tempString += "u8:" + memory.rdramRead8(currentTab.cursorAddress).toString();
                if ((address & 0x0FFFFFFF) < rdramSize - 2) {
                    tempString += " u16:" + memory.rdramRead16(currentTab.cursorAddress).toString();
                    if ((address & 0x0FFFFFFF) < rdramSize - 4) {
                        tempString += " u32:" + memory.rdramRead32(currentTab.cursorAddress).toString();
                        if ((address & 0x0FFFFFFF) < rdramSize - 8) {
                            tempString += " u64:" + memory.rdramReadBuffer(currentTab.cursorAddress, 8).readBigUInt64BE(0).toString()
                        }
                    }
                }

                tempString += " s8:" + memory.rdramReadS8(currentTab.cursorAddress).toString();
                if ((address & 0x0FFFFFFF) < rdramSize - 2) {
                    tempString += " s16:" + memory.rdramReadS16(currentTab.cursorAddress).toString();
                    if ((address & 0x0FFFFFFF) < rdramSize - 4) {
                        tempString += " s32:" + memory.rdramReadS32(currentTab.cursorAddress).toString();
                        if ((address & 0x0FFFFFFF) < rdramSize - 8) {
                            tempString += " s64:" + memory.rdramReadBuffer(currentTab.cursorAddress, 8).readBigInt64BE(0).toString()
                        }
                    }
                }

                if ((address & 0x0FFFFFFF) < rdramSize - 4) {
                    tempString += " f32:" + memory.rdramReadF32(currentTab.cursorAddress).toString();
                    if ((address & 0x0FFFFFFF) < rdramSize - 8) {
                        tempString += " f64:" + memory.rdramReadBuffer(currentTab.cursorAddress, 8).readDoubleBE(0).toString()
                    }
                }
            }

            // FIXME: Antialiasing makes this shit hard to read, and I can't disable it for fonts!
            // FIXED: I have a new verison of the node file that fixes this, it breaks the old memory viewer though.
            ImGui.textDisabled(tempString);

            ImGui.popStyleVar(3)
            ImGui.popFont();
    }

    Draw(memory: IMemory, ImGui:  IImGui, fontNorm: FontRef, fontSmall: FontRef, titleOverride?: string) {
        let index: number = 0;
        let charSizeX: number = 0;
        let windowSize: vec2 = xy(0, 0)
        let title = this.title

        this.settingsDrawnThisFrame = false

        if (this.initial) {
            this.initial = false;
            ImGui.setNextWindowSize(xy(730, 480));
        }

        if (this.tabs.length < 1) {
            this.tabs.push(new MemoryViewerTab(0x80000000, true));
        }

        if (titleOverride) title = titleOverride
        if (ImGui.begin(title + "###" + title + "Window", this._open, WindowFlags.NoScrollbar | WindowFlags.NoScrollWithMouse | WindowFlags.NoSavedSettings)) {
            windowSize = ImGui.calcTextSize("F");
            charSizeX = windowSize.x + this.settings.charSizePadding;

            ImGui.beginTabBar("MemViewTabs###" + title + "Tabs", TabBarFlags.Reorderable | TabBarFlags.AutoSelectNewTabs | TabBarFlags.FittingPolicyResizeDown)
            for (index = 0; index < this.tabs.length; index++) {
                let tabFlags = 0
                if (this.next_tab !== -1 && index === this.next_tab) {
                    tabFlags |= TabItemFlags.SetSelected
                    this.next_tab = -1
                }

                ImGui.setNextItemWidth(10 * charSizeX);
                if (ImGui.beginTabItem(this.tabs[index].address.toString(16).toUpperCase() + "###" + title + index.toString(), this.tabs[index]._open, tabFlags)) {
                    this.DrawTab(memory, ImGui, fontNorm, fontSmall, index)
                    ImGui.endTabItem();
                }

            }
            ImGui.endTabBar();
        }
        ImGui.end();

        if (this.open === false) {
            this.open = true
            this.selected = false
        }
    }
}

