import IMemory from "modloader64_api/IMemory"
import { bool_ref, Col, IImGui, InputTextFlags, string_ref, StyleVar, TabBarFlags, TabItemFlags, WindowFlags } from "modloader64_api/Sylvain/ImGui"
import { vec2, xy, xywh } from "modloader64_api/Sylvain/vec"
import { MacroScriptTM } from "./CommonUtils"

export const enum MemorySearchDataType {
    L8,
    L16,
    L32,
    L64,
    F32,
    F64,
    AOB,
    STRING,
    STRUCT,
    COUNT
}

export const enum MemorySearchCondition {
    EQUALS,
    CHANGED,
    GREATER,
    UNKNOWN,
    COUNT
}

export enum MemorySearchDataType_ {
    L8,
    L16,
    L32,
    L64,
    F32,
    F64,
    AOB,
    STRING,
    STRUCT,
    COUNT
}

export enum MemorySearchCondition_ {
    EQUALS,
    CHANGED,
    GREATER,
    UNKNOWN,
    COUNT
}

export class MemorySearchData {
    type: MemorySearchDataType = MemorySearchDataType.L32
    hex: boolean = false
    address: number = 0

    constructor(address: number, type: MemorySearchDataType, hex: boolean) {
        this.address = address
        this.type = type
        this.hex = hex
    }
}

export class MemorySearchSettings {
    data_type: MemorySearchDataType = MemorySearchDataType.L32
    data_hex: boolean = false

    condition: MemorySearchCondition = MemorySearchCondition.EQUALS
    _condition_not: bool_ref = [false]
    condition_not!: boolean

    constructor() {
        MacroScriptTM(this)
    }
}

export class MemorySearchTab {
    data: MemorySearchData[] = []
    data_saved: MemorySearchData[] = []
    settings: MemorySearchSettings = new MemorySearchSettings
    title: string = "";

    current_snapshot?: Buffer

    _open: bool_ref = [true]
    open!: boolean;

    _input: string_ref = [""]
    input!: string

    shouldSearch = 0

    constructor(title: string = "") {
        this.title = title
        MacroScriptTM(this)
    }
}

export class MemorySearch {
    _open: bool_ref = [true]
    _selected: bool_ref = [false]
    _title: string_ref = [""]

    open!: boolean;
    selected!: boolean;
    title!: string;

    tabs: MemorySearchTab[] = []
    next_tab: number = -1
    initial: boolean = false

    size: vec2 = xy(320, 240)

    constructor() {
        MacroScriptTM(this)
    }

    DrawTab(memory: IMemory, ImGui: IImGui, tabIndex: number) {
        let charSize: vec2 = ImGui.calcTextSize("F")
        let windowSize = ImGui.getContentRegionMax()
        let currentTab: MemorySearchTab = this.tabs[tabIndex]
        let index = 0

        ImGui.beginChild(this.title + "###SplitterWindow" + this.title)
        {
            let spacing = ImGui.getStyle().itemSpacing
            ImGui.pushStyleVar(StyleVar.ChildBorderSize, 1)
            ImGui.pushStyleVar(StyleVar.ItemSpacing, xy(0, 0))

            ImGui.beginChild("frame 0###f0" + this.title, this.size, true)
            {
                ImGui.pushStyleVar(StyleVar.ItemSpacing, spacing)
                ImGui.inputText("Value###MemorySearchValue" + this.title, currentTab._input, InputTextFlags.CharsUppercase)
                ImGui.sameLine()
                ImGui.checkbox("Hex###MemorySearchHex" + this.title, currentTab.settings._condition_not)

                if (ImGui.beginCombo("Condition###MemorySearchConditionCombo" + this.title, MemorySearchCondition_[currentTab.settings.condition])) {
                    for (index = 0; index < MemorySearchCondition.COUNT; index++) {
                        if (ImGui.selectable(MemorySearchCondition_[index], currentTab.settings.condition === index)) {
                            currentTab.settings.condition = index
                        }
                    }
                    ImGui.endCombo()
                }

                if (ImGui.beginCombo("Value Type###MemorySearchTypeCombo" + this.title, MemorySearchDataType_[currentTab.settings.data_type])) {
                    for (index = 0; index < MemorySearchDataType.COUNT; index++) {
                        if (ImGui.selectable(MemorySearchDataType_[index], currentTab.settings.data_type === index)) {
                            currentTab.settings.data_type = index
                        }
                    }
                    ImGui.endCombo()
                }

                if (ImGui.button("Search")) {
                    if (currentTab.shouldSearch === 0) {
                        currentTab.shouldSearch = 1
                    }
                }
                ImGui.sameLine()
                if (ImGui.button("Reset")) {
                    currentTab.data = []
                }

                ImGui.popStyleVar(1)
            }
            ImGui.endChild()
            ImGui.sameLine()

            ImGui.invisibleButton("vertical splitter###vsplitter" + this.title, xy(8, this.size.y))
            if (ImGui.isItemActive()) {
                ImGui.getWindowDrawList().addLine(
                    xy(this.size.x + 3, 0),
                    xy(this.size.x + 3, this.size.y),
                    ImGui.getStyleColor(Col.SeparatorActive), 2
                )
                this.size.x += ImGui.getIo().mouseDelta.x
            }
            else {
                ImGui.getWindowDrawList().addLine(
                    xy(this.size.x + 3, 0),
                    xy(this.size.x + 3, this.size.y),
                    ImGui.getStyleColor(Col.SeparatorHovered), 2
                )
            }
            ImGui.sameLine()

            ImGui.beginChild("frame 1###f1" + this.title, xy(0, this.size.y), true)
            {
                ImGui.pushStyleVar(StyleVar.ItemSpacing, spacing)
                ImGui.text("CHILD TWO")
                for (index = 0; index < currentTab.data.length; index++) {
                    let yOffset = ImGui.getTextLineHeightWithSpacing() * index
                    if (yOffset > (this.size.y - 80)) {
                        break
                    }
                    ImGui.textDisabled(`${currentTab.data[index].address.toString(16).toUpperCase()}: TODO: Read in data`)
                    ImGui.separator()
                }
                ImGui.popStyleVar(1)
            }
            ImGui.endChild()

            ImGui.invisibleButton("horizontal splitter###hsplitter" + this.title, xy(windowSize.x, 8))
            if (ImGui.isItemActive()) {
                ImGui.getWindowDrawList().addLine(
                    xy(0, this.size.y + 3),
                    xy(windowSize.x, this.size.y + 3),
                    ImGui.getStyleColor(Col.SeparatorActive), 2
                )
                this.size.y += ImGui.getIo().mouseDelta.y
            }
            else {
                ImGui.getWindowDrawList().addLine(
                    xy(0, this.size.y + 3),
                    xy(windowSize.x, this.size.y + 3),
                    ImGui.getStyleColor(Col.SeparatorHovered), 2
                )
            }

            ImGui.beginChild("frame 2###f2" + this.title, xy(0, 0), true)
            {
                ImGui.pushStyleVar(StyleVar.ItemSpacing, spacing)
                ImGui.text("CHILD THREE")
                ImGui.popStyleVar()
            }
            ImGui.endChild()
            ImGui.popStyleVar(2)
        }
        ImGui.endChild()

        if (this.size.x > (windowSize.x - 64)) this.size.x = (windowSize.x - 64)
        if (this.size.y > (windowSize.y - 64)) this.size.y = (windowSize.y - 64)
        if (this.size.x < 64) this.size.x = 64
        if (this.size.y < 64) this.size.y = 64
    }

    Draw(memory: IMemory, ImGui: IImGui) {
        let charSize: vec2 = ImGui.calcTextSize("F")
        let index: number = 0

        if (this.initial) {
            this.initial = false;
            ImGui.setNextWindowSize(xy(730, 480));
        }

        if (this.tabs.length < 1) {
            this.tabs.push(new MemorySearchTab())
        }

        if (ImGui.begin("Memory Search###" + this.title + "Window", this._open, WindowFlags.NoScrollbar | WindowFlags.NoScrollWithMouse | WindowFlags.NoSavedSettings)) {
            ImGui.beginTabBar("MemorySearchTabs###" + this.title + "SearchTabs", TabBarFlags.Reorderable | TabBarFlags.AutoSelectNewTabs | TabBarFlags.FittingPolicyResizeDown)
            {
                for (index = 0; index < this.tabs.length; index++) {
                    let tabFlags = 0
                    if (this.next_tab !== -1 && index === this.next_tab) {
                        tabFlags |= TabItemFlags.SetSelected
                        this.next_tab = -1
                    }

                    ImGui.setNextItemWidth(10 * charSize.x);
                    if (ImGui.beginTabItem(index.toString() + ": " + this.tabs[index].title + "###SearchTab" + this.title + index.toString(), this.tabs[index]._open, tabFlags)) {
                        this.DrawTab(memory, ImGui, index)
                        ImGui.endTabItem();
                    }
                }
            }
            ImGui.endTabBar()
        }
        ImGui.end()

        if (this.open === false) {
            this.open = true
            this.selected = false
        }
    }

    OnTickTab(memory: IMemory, tabIndex: number) {
        let currentTab = this.tabs[tabIndex]

        if (currentTab.shouldSearch === 1) {
            currentTab.shouldSearch = 2
            let readFunction = "readUInt32BE"
            let increment = 4
            if (currentTab.current_snapshot === undefined) {
                // TODO: Reading from vaddr causes ludicrous memory leak?? Is this related to doubles being used as numbers?
                currentTab.current_snapshot = memory.rdramReadBuffer(0x00000000, 0x03E00000 - 1)
            }

            switch(currentTab.settings.data_type) {
                case MemorySearchDataType.L8: {
                    readFunction = "readUInt8"
                    increment = 1
                    break
                }
                case MemorySearchDataType.L16: {
                    readFunction = "readUInt16BE"
                    increment = 2
                    break
                }
                case MemorySearchDataType.L32: {
                    readFunction = "readUInt32BE"
                    increment = 4
                    break
                }
                case MemorySearchDataType.L64: {
                    readFunction = "readBigUInt64BE"
                    increment = 4
                    break
                }
                case MemorySearchDataType.F32: {
                    readFunction = "readFloatBE"
                    increment = 4
                    break
                }
                case MemorySearchDataType.F64: {
                    readFunction = "readDoubleBE"
                    increment = 4
                    break
                }
                case MemorySearchDataType.STRING: {
                    readFunction = "slice"
                    increment = 4
                    break
                }
                case MemorySearchDataType.AOB: {
                    readFunction = "slice"
                    increment = 4
                    break
                }
                default: {
                    readFunction = "readUInt32BE"
                    increment = 4
                    break
                }
            }

            // first scan
            if (currentTab.data.length === 0) {
                let value: any
                let input: any
                let override = false

                switch (currentTab.settings.data_type) {
                    case MemorySearchDataType.L8:
                    case MemorySearchDataType.L16:
                    case MemorySearchDataType.L32:
                    case MemorySearchDataType.F32:
                    case MemorySearchDataType.L64:
                    case MemorySearchDataType.F64: {
                        if (currentTab.settings.data_type === MemorySearchDataType.F32 || currentTab.settings.data_type === MemorySearchDataType.F64) {
                            input = parseFloat(currentTab.input)
                        }
                        else if (currentTab.settings.data_type === MemorySearchDataType.L64) {
                            input = BigInt(currentTab.input)
                        }
                        else {
                            input = parseInt(currentTab.input, currentTab.settings.data_hex ? 16 : 10)
                        }
                        break
                    }
                    case MemorySearchDataType.STRING: {
                        override = true
                        // TODO
                        break
                    }
                    case MemorySearchDataType.AOB: {
                        input = Buffer.from(currentTab.input, 'hex')
                        override = true
                        break
                    }
                    case MemorySearchDataType.STRUCT: {
                        override = true
                        // TODO
                        break
                    }
                    default: {
                        override = true
                        break
                    }
                }

                let address = 0
                let condition = false
                for (address = 0; address <= 0x03E00000; address += increment) {
                    condition = false

                    switch (currentTab.settings.data_type) {
                        case MemorySearchDataType.L8:
                            value = currentTab.current_snapshot[address]
                            break;
                        case MemorySearchDataType.L16:
                        case MemorySearchDataType.L32:
                        case MemorySearchDataType.F32:
                        case MemorySearchDataType.L64:
                        case MemorySearchDataType.F64: {
                            if (address + increment < 0x03E00000) {
                                value = currentTab.current_snapshot[readFunction](address)
                            }
                            else {
                                // stop scanning when we can't scan any longer
                                delete currentTab.current_snapshot
                                currentTab.shouldSearch = 0
                                return
                            }
                            break
                        }
                        case MemorySearchDataType.STRING: {
                            break
                        }
                        case MemorySearchDataType.AOB: {
                            if (address + input.byteLength < 0x03E00000) {
                                value = currentTab.current_snapshot[readFunction](address, input.byteLength)
                            }
                            else {
                                // stop scanning when we can't scan any longer
                                delete currentTab.current_snapshot
                                currentTab.shouldSearch = 0
                                return
                            }
                            condition = input.compare(value) === 0
                            break
                        }
                        case MemorySearchDataType.STRUCT: {
                            break
                        }
                        default: {
                            break
                        }
                    }

                    if (!override) {
                        switch (currentTab.settings.condition) {
                            case MemorySearchCondition.EQUALS: {
                                condition = value === input
                                break
                            }
                            case MemorySearchCondition.GREATER: {
                                condition = value > input
                                break
                            }
                            case MemorySearchCondition.CHANGED: {
                                console.error("Tried to search for changed on initial search? Come on man...")
                                break
                            }
                            case MemorySearchCondition.UNKNOWN: {
                                condition = true
                            }
                        }
                    }

                    if (currentTab.settings.condition_not) condition = !condition

                    if (condition) {
                        currentTab.data.push(new MemorySearchData(address, currentTab.settings.data_type, currentTab.settings.data_hex))
                    }
                }

                delete currentTab.current_snapshot
                currentTab.shouldSearch = 0
            }
        }
    }

    OnTick(memory: IMemory) {
        let index = 0
        for (index = 0; index < this.tabs.length; index++) {
            this.OnTickTab(memory, index)
        }
    }
}