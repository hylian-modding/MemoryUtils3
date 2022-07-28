import * as mips from "mips-assembler-ML64/mips-inst"
import IMemory from "modloader64_api/IMemory"
import { bool_ref, Col, FontRef, IImGui, InputTextFlags, number_ref, string_ref, TabBarFlags, TabItemFlags, WindowFlags } from "modloader64_api/Sylvain/ImGui"
import { vec2, vec4, xy, xywh } from "modloader64_api/Sylvain/vec"
import { GenerateImGuiReferences } from "modloader64_api/Macros/ImGuiMacros"
import * as filesystem from "fs"
import { bus } from "modloader64_api/EventHandler"
import { BpTriggerInfo, DebuggerEvents } from "modloader64_api/Sylvain/Debugger"
import { CBpTriggerInfo } from "@MemoryUtils3/main"

export enum MIPS_REGS {
    r0 = 0,
    at,
    v0,
    v1,
    a0,
    a1,
    a2,
    a3,
    t0,
    t1,
    t2,
    t3,
    t4,
    t5,
    t6,
    t7,
    s0,
    s1,
    s2,
    s3,
    s4,
    s5,
    s6,
    s7,
    t8,
    t9,
    k0,
    k1,
    gp,
    sp,
    fp,
    ra
};

function mulberry32(a) {
    return function() {
        var t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

class BranchListItem {
    from: number = 0
    to: number = 0
    depth: number = 0
    parent!: BranchListItem
    branches: BranchListItem[] = []
    color: vec4 = xywh(1, 0, 0, 1)

    constructor(from: number, to: number, parent?: BranchListItem) {
        this.from = from
        this.to = to

        if (parent !== undefined) {
            this.parent = parent
        }
    }
}

@GenerateImGuiReferences()
export class MemoryCommandViewerTab {
    __ref_open: bool_ref = [false]
    __ref_address: number_ref = [0x80000000]
    __ref_address_ref: string_ref = ["0x80000000"]
    __ref_note: string_ref = [""]

    open!: boolean
    address!: number
    address_ref!: string
    note!: string

    constructor(address?: number) {
        if (address !== undefined) {
            this.address = address
            this.address_ref = address.toString(16)
        }

        this.open = true
    }
}

@GenerateImGuiReferences()
export class MemoryCommandViewerSettings {
    __ref_charsUppercase: bool_ref = [true]

    charsUppercase!: boolean

    // colors
    color_text = xywh(0.6, 0.5, 0.6, 1)
    color_jump = xywh(0.5, 0.5, 0.75, 1)
    color_branch = xywh(0.5, 0.65, 0.65, 1)
    color_inst = xywh(0.5, 0.75, 0.5, 1)
    color_immediate = xywh(0.5, 0.5, 0.3, 1)
    color_rs_offset = xywh(0.65, 0.65, 0.2, 1)
    color_stack_in = xywh(0.5, 0.8, 1.0, 1)
    color_stack_out = xywh(0.75, 0.5, 0.65, 1)
    color_jr_ra = xywh(1.0, 0.5, 0.5, 1)

    // spacing
    spacing0 = 0
    spacing1 = 4

    // other settings
    casing: string = "toUpperCase"
    __ref_immediateHex: bool_ref = [true]
    __ref_intelSyntax: bool_ref = [true]
    __ref_debugView: bool_ref = [false]


    immediateHex!: boolean
    intelSyntax!: boolean
}

@GenerateImGuiReferences()
export class MemoryCommandViewer {
    __ref_open: bool_ref = [true]
    __ref_selected: bool_ref = [false]
    __ref_title: string_ref = ["Command Viewer"]

    open!: boolean;
    selected!: boolean;
    title!: string;

    tabs: MemoryCommandViewerTab[] = []
    next_tab: number = -1
    settings: MemoryCommandViewerSettings = new MemoryCommandViewerSettings()
    initial: boolean = true

    constructor() {
        this.tabs.push(new MemoryCommandViewerTab(0x80000000))

        bus.on(DebuggerEvents.UPDATE, this.onBpEvent.bind(this))
    }

    onBpEvent(info: CBpTriggerInfo) {
        console.log(`addr: ${info.address.toString(16)}, flags: ${info.flags}`);
    }

    DrawTab(memory: IMemory, ImGui: IImGui, tabIndex: number) {
        let charSize: vec2 = ImGui.calcTextSize("F")
        let windowSize = ImGui.getContentRegionMax()
        let headerSizeY = 0
        let bodySizeY = 0
        let footerSizeY = 0
        let bodyPosX = 0 // offset for address seperator
        let bodyPosY = 0
        let commands = 0
        let posY = 0
        let index = 0
        let qndex = 0
        let currentTab: MemoryCommandViewerTab = this.tabs[tabIndex]

        currentTab.address += (-ImGui.getIo().mouseWheel.y) * 4

        posY = ImGui.getCursorScreenPos().y
        ImGui.setNextItemWidth(12 * charSize.x)
        if (ImGui.inputText("Address", currentTab.__ref_address_ref,
                InputTextFlags.CharsHexadecimal
                | InputTextFlags.CharsNoBlank
                | (this.settings.charsUppercase ? InputTextFlags.CharsUppercase : InputTextFlags.None)
                | InputTextFlags.EnterReturnsTrue
                | InputTextFlags.NoHorizontalScroll)) {
                // initialize stuff here
                currentTab.address = parseInt(currentTab.address_ref, 16);
        }

        ImGui.sameLine()
        if (ImGui.button("Settings", xy(10 * charSize.x, ImGui.getTextLineHeightWithSpacing()))) {
            console.warn("Command viewer settings not implemented! Yell at Drahsid!")
        }

        ImGui.separator()
        bodyPosY = ImGui.getCursorPosY()
        headerSizeY = ImGui.getCursorScreenPos().y - posY
        bodySizeY = windowSize.y - headerSizeY


        // redundant redundant
        bodyPosX = (7 * charSize.x) + ((this.settings.intelSyntax === false ? 1 : 0) * charSize.x)
        ImGui.getWindowDrawList().addLine(
            xy(bodyPosX, bodyPosY - ImGui.getStyle().framePadding.y),
            xy(bodyPosX, windowSize.y + ImGui.getStyle().framePadding.y),
            ImGui.getColor(Col.Separator)
        )

        // right-hand address line
        ImGui.getWindowDrawList().addLine(
            xy(bodyPosX + (10 * charSize.x), bodyPosY - ImGui.getStyle().framePadding.y),
            xy(bodyPosX + (10 * charSize.x), windowSize.y + ImGui.getStyle().framePadding.y),
            ImGui.getColor(Col.Separator)
        )

        // right-hand bp line
        ImGui.getWindowDrawList().addLine(
            xy(bodyPosX + (14 * charSize.x), bodyPosY - ImGui.getStyle().framePadding.y),
            xy(bodyPosX + (14 * charSize.x), windowSize.y + ImGui.getStyle().framePadding.y),
            ImGui.getColor(Col.Separator)
        )

        let parentBranch!: BranchListItem;
        let initialBranches: BranchListItem[] = []

        commands = ((bodySizeY - 80) / ImGui.getTextLineHeightWithSpacing())
        for (index = 0; index < commands; index++) {
            let instruction_address = currentTab.address + (index * 4)
            let xOffset = 0
            let opts: any = { intermediate: true }
            let output: any

            let PrintColumn = (input: string, color?: vec4, align: number = 4) => {
                let initialxOffset = xOffset

                if (color !== undefined) {
                    ImGui.sameLine(initialxOffset, 0)
                    ImGui.textColored(input, color)
                }

                let len = input.length + this.settings.spacing0
                // debug
                let len_pad0 = 0
                let len_pad1 = 0
                let len_pad2 = 0
                if (len <= 0) {
                    len_pad0 = 1
                    len = 1
                }
                if (this.settings.intelSyntax === false) {
                    len_pad1 = 1
                    len += 1
                }

                xOffset += charSize.x * len
                if (align) {
                    len_pad2 = xOffset
                    xOffset = Math.round(xOffset / charSize.x)
                    xOffset = Math.round(xOffset / align) * align
                    xOffset *= charSize.x
                    len_pad2 = xOffset - len_pad2
                }

                if (this.settings.__ref_debugView[0]) {
                    let rand = mulberry32(instruction_address + xOffset)
                    let r = rand()
                    let g = rand()
                    let b = rand()
                    let tsize = input.length * charSize.x
                    let ssize = this.settings.spacing0 * charSize.x
                    let p0size = len_pad0 * charSize.x
                    let p1size = len_pad1 * charSize.x
                    let p2size = len_pad2 * charSize.x

                    // tsize (Text Space)
                    ImGui.getWindowDrawList().addLine(
                        xy(initialxOffset, ImGui.getCursorPosY()),
                        xy(initialxOffset + tsize, ImGui.getCursorPosY()), xywh(r, g, b, 1), 2)

                    // ssize (Spacing Space)
                    ImGui.getWindowDrawList().addLine(
                        xy(initialxOffset + tsize, ImGui.getCursorPosY()),
                        xy(initialxOffset + tsize + ssize, ImGui.getCursorPosY()), xywh(1, 1, 1, 1), 1)

                    // p0size (Pad0 Space)
                    ImGui.getWindowDrawList().addLine(
                        xy(initialxOffset + tsize + ssize, ImGui.getCursorPosY()),
                        xy(initialxOffset + tsize + ssize + p0size, ImGui.getCursorPosY()), xywh(1, 0, 0,1), 1)

                    // p1size (Pad1 Space)
                    ImGui.getWindowDrawList().addLine(
                        xy(initialxOffset + tsize + ssize + p0size, ImGui.getCursorPosY()),
                        xy(initialxOffset + tsize + ssize + p0size + p1size, ImGui.getCursorPosY()), xywh(0, 1, 0, 1), 1)

                    // p2size (Pad2 Space)
                    ImGui.getWindowDrawList().addLine(
                        xy(initialxOffset + tsize + ssize + p0size + p1size, ImGui.getCursorPosY()),
                        xy(initialxOffset + tsize + ssize + p0size + p1size + p2size, ImGui.getCursorPosY()), xywh(0.25, 0.1, 0.75, 1), 1)

                    // separator
                    ImGui.getWindowDrawList().addLine(
                        xy(initialxOffset + tsize + ssize + p0size + p1size + p2size, ImGui.getCursorPosY() + 4),
                        xy(initialxOffset + tsize + ssize + p0size + p1size + p2size, ImGui.getCursorPosY() - 4), xywh(r, g, b, 1), 1)
                }
            }

            try {
                output = mips.print(memory.rdramRead32(instruction_address), opts)
            }
            catch (err: any) {
                PrintColumn("FFFFFFFF")
                PrintColumn(instruction_address.toString(16)[this.settings.casing](), ImGui.getStyleColor(Col.TextDisabled))
                PrintColumn("ERROR: ", xywh(1, 0, 0, 1))
                if (err !== undefined) {
                    PrintColumn(err.toString(), xywh(1, 0, 0, 1))
                }
                ImGui.newLine()
                continue
            }

            let instruction = output.op
            let instruction_lower = instruction.toLowerCase()
            let rd = MIPS_REGS[output.rd]
            let rs = MIPS_REGS[output.rs]
            let rt = MIPS_REGS[output.rt]
            let fd = output.fd
            let fs = output.fs
            let ft = output.ft
            let fr = output.fr

            if (instruction !== undefined) instruction = instruction[this.settings.casing]()
            if (rd !== undefined) rd = rd[this.settings.casing]()
            if (rs !== undefined) rs = rs[this.settings.casing]()
            if (rt !== undefined) rt = rt[this.settings.casing]()
            if (fd !== undefined) fd = "F" + fd.toString()[this.settings.casing]()
            if (fs !== undefined) fs = "F" + fs.toString()[this.settings.casing]()
            if (ft !== undefined) ft = "F" + ft.toString()[this.settings.casing]()
            if (fr !== undefined) fr = "F" + fr.toString()[this.settings.casing]()

            if (this.settings.intelSyntax === false) {
                rd = "$" + rd
                rs = "$" + rs
                rt = "$" + rt
                fd = "$" + fd
                fs = "$" + fs
                ft = "$" + ft
                fr = "$" + fr
            }

            let radix = this.settings.immediateHex ? 16 : 10
            let imm
            if (output.hasOwnProperty("int16")) imm = output.int16
            else if (output.hasOwnProperty("uint16")) imm = output.uint16
            else if (output.hasOwnProperty("uint26")) imm = output.uint26
            else if (output.hasOwnProperty("uint26shift2")) imm = output.uint26shift2
            else if (output.hasOwnProperty("uint10")) imm = output.uint10
            else if (output.hasOwnProperty("uint20")) imm = output.uint20
            else if (output.hasOwnProperty("uint5")) imm = output.uint5
            else if (output.hasOwnProperty("uint20?")) imm = output["uint20?"] // used in break?

            if (parentBranch !== undefined) {
                if (instruction_address === parentBranch.to) {
                    parentBranch = parentBranch.parent
                    // fix branches in delay slots
                    while (parentBranch !== undefined && instruction_address >= parentBranch.to) {
                        parentBranch = parentBranch.parent
                    }
                }
            }

            let ImmToString = (pad: number = 0, immoverride?: number) => {
                let ret = ""
                let val = imm
                if (immoverride !== undefined) val = immoverride
                if (radix === 16) {
                    ret = Math.abs(val).toString(radix).padStart(pad, '0')
                    if (val < 0) ret = "-0x" + ret[this.settings.casing]()
                    else ret = "0x" + ret[this.settings.casing]()
                }
                else ret = val.toString(radix)
                return ret
            }

            // branch lines spacing
            PrintColumn("FFFFFFFF", undefined, 2)
            PrintColumn(instruction_address.toString(16)[this.settings.casing](), ImGui.getStyleColor(Col.TextDisabled), 2)

            // make immediate signed
            if (instruction_lower === "beq" || instruction_lower === "bne" || instruction_lower === "blez" || instruction_lower === "bgte" || "blezal" || "bgezal" || instruction_lower === "addiu" && rt.toLowerCase() === "sp" && rs.toLowerCase() === "sp") {
                if ((imm & 0x8000) > 0) {
                    imm -= 0x10000;
                }
            }

            // instruction name overrides
            switch (instruction_lower) {
                case "mul.fmt": {
                    instruction_lower = "mul.s"
                    instruction = "mul.s"[this.settings.casing]()
                    break
                }
                case "div.fmt": {
                    instruction_lower = "div.s"
                    instruction = "div.s"[this.settings.casing]()
                    break
                }
                case "cvt.s.fmt": {
                    instruction_lower = "cvt.s.w"
                    instruction = "cvt.s.w"[this.settings.casing]()
                    break
                }
                case "cvt.d.fmt": {
                    instruction_lower = "cvt.d.s"
                    instruction = "cvt.d.s"[this.settings.casing]()
                    break
                }
                case "add.fmt": {
                    instruction_lower = "add.s"
                    instruction = "add.s"[this.settings.casing]()
                    break
                }
                case "sub.fmt": {
                    instruction_lower = "sub.s"
                    instruction = "sub.s"[this.settings.casing]()
                    break
                }
                case "mov.fmt": {
                    instruction_lower = "mov.s"
                    instruction = "mov.s"[this.settings.casing]()
                    break
                }
                case "neg.fmt": {
                    instruction_lower = "neg.s"
                    instruction = "neg.s"[this.settings.casing]()
                    break
                }
                case "c.cond.fmt": {
                    instruction_lower = "c.eq.s"
                    instruction = "c.eq.s"[this.settings.casing]()
                    break
                }
                case "trunc.w.fmt": {
                    instruction_lower = "trunc.w.s"
                    instruction = "trunc.w.s"[this.settings.casing]()
                    break
                }
                case "sqrt.fmt": {
                    instruction_lower = "sqrt.s"
                    instruction = "sqrt.s"[this.settings.casing]()
                    break
                }
                case "abs.fmt": {
                    instruction_lower = "abs.s"
                    instruction = "abs.s"[this.settings.casing]()
                    break
                }
            }

            // instruction highlighting
            let color: vec4 = this.settings.color_inst
            if (instruction_lower === "jal" || instruction_lower === "jalr" || instruction_lower === "j") {
                color = this.settings.color_jump
            }
            else if (instruction_lower === "beq" || instruction_lower === "bne" || instruction_lower === "blez" || instruction_lower === "bgte") {
                color = this.settings.color_branch
            }
            else if (instruction_lower === "addiu" && rt.toLowerCase() === "sp" && rs.toLowerCase() === "sp") {
                if (imm < 0) color = this.settings.color_stack_in
                else color = this.settings.color_stack_out
            }
            else if (instruction_lower === "nop") {
                color = ImGui.getStyleColor(Col.TextDisabled)
            }

            // breakpoint spacing
            PrintColumn("FFFFFF")
            PrintColumn(instruction, color)
            PrintColumn("FFFFFFFF")
            switch (instruction_lower) {
                case "sll":
                case "srl":
                case "sra": {
                    PrintColumn(`${rd},`, this.settings.color_text)
                    PrintColumn(`${rt}`, this.settings.color_text)
                    PrintColumn(`${ImmToString(4)}`, this.settings.color_immediate)
                    break;
                }
                case "sllv":
                case "srlv":
                case "srav": {
                    PrintColumn(`${rd},`, this.settings.color_text)
                    PrintColumn(`${rt},`, this.settings.color_text)
                    PrintColumn(`${rs}`, this.settings.color_text)
                    break
                }
                case "jr":
                case "jalr": {
                    if (rs.toLowerCase() === "ra") {
                        PrintColumn(`${rs}`, this.settings.color_jr_ra)
                    }
                    else {
                        PrintColumn(`${rs}`, this.settings.color_jump)
                    }
                    break
                }
                case "mfhi":
                case "mflo": {
                    PrintColumn(`${rd}`, this.settings.color_text)
                    break
                }
                case "mthi":
                case "mtlo": {
                    PrintColumn(`${rs}`, this.settings.color_text)
                    break
                }
                case "mult":
                case "multu":
                case "div":
                case "divu": {
                    PrintColumn(`${rs},`, this.settings.color_text)
                    PrintColumn(`${rt}`, this.settings.color_text)
                    break
                }
                case "add":
                case "addu":
                case "sub":
                case "subu":
                case "and":
                case "or":
                case "xor":
                case "nor":
                case "slt":
                case "sltu": {
                    PrintColumn(`${rd},`, this.settings.color_text)
                    PrintColumn(`${rs},`, this.settings.color_text)
                    PrintColumn(`${rt}`, this.settings.color_text)
                    break
                }
                case "j":
                case "jal": {
                    imm = 0x80000000 + (((instruction_address & 0x00FFFFFF) & 0xF0000000) | (imm << 2))
                    PrintColumn(`${ImmToString(8)}`, this.settings.color_jump)
                    break
                }
                case "bc1t":
                case "bc1tl":
                case "bc1fl":
                case "bc1f": {
                    let absolute = (instruction_address + 4) + (imm * 4)
                    PrintColumn(`${ImmToString(0, absolute)}`, this.settings.color_branch)
                    PrintColumn(`(${ImmToString(4)})`, this.settings.color_rs_offset)

                    let branch = new BranchListItem(instruction_address, absolute)

                    // pseudo random rng, using instruction address as seed, should produce the same results every time TODO: modularize this
                    let rand = mulberry32(instruction_address)
                    let r = rand()
                    let g = rand()
                    let b = rand()

                    branch.color = xywh(0.1 + (r * 0.6), 0.1 + (g * 0.6), 0.1 + (b * 0.6), 1)
                    if (parentBranch !== undefined) {
                        parentBranch.branches.push(branch)
                    }
                    else {
                        initialBranches.push(branch)
                    }
                    parentBranch = branch

                    break
                }
                case "beq":
                case "beql":
                case "bne":
                case "bnel": {
                    let absolute = (instruction_address + 4) + (imm * 4)
                    PrintColumn(`${rs},`, this.settings.color_branch)
                    PrintColumn(`${rt},`, this.settings.color_branch)
                    PrintColumn(`${ImmToString(0, absolute)}`, this.settings.color_branch)
                    PrintColumn(`(${ImmToString(4)})`, this.settings.color_rs_offset)

                    let branch = new BranchListItem(instruction_address, absolute)

                    // pseudo random rng, using instruction address as seed, should produce the same results every time TODO: modularize this
                    let rand = mulberry32(instruction_address)
                    let r = rand()
                    let g = rand()
                    let b = rand()

                    branch.color = xywh(0.1 + (r * 0.6), 0.1 + (g * 0.6), 0.1 + (b * 0.6), 1)
                    if (parentBranch !== undefined) {
                        parentBranch.branches.push(branch)
                    }
                    else {
                        initialBranches.push(branch)
                    }
                    parentBranch = branch

                    break
                }
                case "blezal":
                case "bgezal":
                case "blez":
                case "blezl":
                case "bgez":
                case "bgezl":
                case "bgtz":
                case "bltz": {
                    let absolute = (instruction_address + 4) + (imm * 4)
                    PrintColumn(`${rs},`, this.settings.color_branch)
                    PrintColumn(`${ImmToString(8, absolute)}`, this.settings.color_branch)
                    PrintColumn(`(${ImmToString(4)})`, this.settings.color_rs_offset)

                    let branch = new BranchListItem(instruction_address, absolute)

                    // pseudo random rng, using instruction address as seed, should produce the same results every time TODO: modularize this
                    let rand = mulberry32(instruction_address)
                    let r = rand()
                    let g = rand()
                    let b = rand()

                    branch.color = xywh(0.1 + (r * 0.6), 0.1 + (g * 0.6), 0.1 + (b * 0.6), 1)
                    if (parentBranch !== undefined) {
                        parentBranch.branches.push(branch)
                    }
                    else {
                        initialBranches.push(branch)
                    }
                    parentBranch = branch

                    break
                }
                case "addiu": {
                    if (rt.toLowerCase() === "sp" && rs.toLowerCase() === "sp") {
                        if (imm < 0) {
                            PrintColumn(`${rt},`, this.settings.color_stack_in)
                            PrintColumn(`${rs},`, this.settings.color_stack_in)
                            PrintColumn(`${ImmToString()}`, this.settings.color_stack_in)
                        }
                        else {
                            PrintColumn(`${rt},`, this.settings.color_stack_out)
                            PrintColumn(`${rs},`, this.settings.color_stack_out)
                            PrintColumn(`${ImmToString()}`, this.settings.color_stack_out)
                        }
                        break
                    }
                }
                case "addi":
                case "slti":
                case "sltiu":
                case "andi":
                case "ori":
                case "xori": {
                    PrintColumn(`${rt},`, this.settings.color_text)
                    PrintColumn(`${rs},`, this.settings.color_text)
                    PrintColumn(`${ImmToString(4)}`, this.settings.color_immediate)
                    break
                }
                case "lui": {
                    PrintColumn(`${rt},`, this.settings.color_text)
                    PrintColumn(`${ImmToString(4)}`, this.settings.color_immediate)
                    break
                }
                case "lh":
                case "lw":
                case "lbu":
                case "lhu":
                case "sb":
                case "sh":
                case "sw": {
                    PrintColumn(`${rt},`, this.settings.color_text)
                    PrintColumn(`${ImmToString(4)}`, this.settings.color_immediate)
                    PrintColumn(`(${rs[this.settings.casing]()})`, this.settings.color_rs_offset)
                    break
                }
                case "lwc1":
                case "swc1": {
                    PrintColumn(`${ft},`, this.settings.color_text)
                    PrintColumn(`${ImmToString(4)}`, this.settings.color_rs_offset)
                    PrintColumn(`(${rs})`, this.settings.color_text)
                    break
                }
                case "mfc1":
                case "mtc1": {
                    PrintColumn(`${rt},`, this.settings.color_text)
                    PrintColumn(`${fs}`, this.settings.color_text)
                    break
                }
                case "abs.s":
                case "sqrt.s":
                case "mov.s":
                case "neg.s":
                case "cvt.d.s":
                case "cvt.s.w": {
                    PrintColumn(`${fd},`, this.settings.color_text)
                    PrintColumn(`${fs}`, this.settings.color_text)
                    break
                }
                case "add.s":
                case "sub.s":
                case "mul.s":
                case "div.s": {
                    PrintColumn(`${fd},`, this.settings.color_text)
                    PrintColumn(`${fs},`, this.settings.color_text)
                    PrintColumn(`${ft}`, this.settings.color_text)
                    break
                }
                case "ldc1":
                case "sdc1": {
                    PrintColumn(`${ft},`, this.settings.color_text)
                    PrintColumn(`${ImmToString(4)},`, this.settings.color_immediate)
                    PrintColumn(`(${rs})`, this.settings.color_rs_offset)
                    break
                }
                case "trunc.w.s":
                case "c.eq.s": {
                    PrintColumn(`${fs},`, this.settings.color_text)
                    PrintColumn(`${ft}`, this.settings.color_text)
                    break
                }
                case "nop": {
                    PrintColumn("nop"[this.settings.casing](), ImGui.getStyleColor(Col.TextDisabled))
                    break
                }
                default: {
                    PrintColumn(`BOGUS! inst: ${instruction} imm: ${imm} rd: ${rd} rs: ${rs} rt: ${rt} fd: ${fd} fs: ${fs} ft: ${ft} fr: ${fr}`, xywh(1, 0.5, 0.5, 1))
                    break
                }
            }
            ImGui.newLine()
        }

        let branchDepth = 0
        let DrawBranchLines = (branch: BranchListItem, depth: number, draw: boolean) => {
            let index = 0

            branch.depth = depth
            depth++

            if (draw) {
                let lineOffset = (1 + (branchDepth - branch.depth)) * 4
                let commandOffsetFrom = ImGui.getTextLineHeightWithSpacing() * ((branch.from - this.tabs[tabIndex].address) / 4)
                let commandOffsetTo = ImGui.getTextLineHeightWithSpacing() * ((branch.to - this.tabs[tabIndex].address) / 4)
                let textHalfHeight = ImGui.getTextLineHeightWithSpacing() / 4

                let y0 = bodyPosY + commandOffsetFrom + textHalfHeight
                let y1 = bodyPosY + commandOffsetTo + textHalfHeight
                if (y0 < bodyPosY) y0 = bodyPosY
                if (y1 < bodyPosY) y1 = bodyPosY
                let p0: vec2 = xy(bodyPosX, y0)
                let p1: vec2 = xy(bodyPosX - lineOffset, y0)
                let p2: vec2 = xy(bodyPosX, y1)
                let p3: vec2 = xy(bodyPosX - lineOffset, y1)
                let p4: vec2 = xy(bodyPosX - lineOffset, y0)
                let p5: vec2 = xy(bodyPosX - lineOffset, y1)
                let p6: vec2 = xy(bodyPosX - (ImGui.getTextLineHeightWithSpacing() / 4) - 1, y0)

                if (branch.to === branch.from) {
                    ImGui.getWindowDrawList().addCircle(p6, ImGui.getTextLineHeightWithSpacing() / 4, branch.color)
                }
                else {
                    // initial horizontal line
                    ImGui.getWindowDrawList().addLine(p0, p1, branch.color)

                    // ending horizontal line
                    ImGui.getWindowDrawList().addLine(p2, p3, branch.color)

                    // vertical line
                    ImGui.getWindowDrawList().addLine(p4, p5, branch.color)
                }
            }
            else if (depth > branchDepth) {
                branchDepth = depth
            }

            for (index = 0; index < branch.branches.length; index++) {
                DrawBranchLines(branch.branches[index], depth, draw)
            }
        }

        if (initialBranches.length > 0) {
            DrawBranchLines(initialBranches[0], 0, false)
            DrawBranchLines(initialBranches[0], 0, true)
        }
    }

    Draw(memory: IMemory, ImGui: IImGui, fontNorm: FontRef, fontSmall: FontRef) {
        let charSize: vec2 = ImGui.calcTextSize("F")
        let index = 0

        if (this.initial) {
            this.initial = false;
            ImGui.setNextWindowSize(xy(730, 480));
        }

        if (this.tabs.length < 1) {
            this.tabs.push(new MemoryCommandViewerTab())
        }

        if (ImGui.begin("Command Viewer###" + this.title + "Window", this.__ref_open, WindowFlags.NoScrollbar | WindowFlags.NoScrollWithMouse | WindowFlags.NoSavedSettings)) {
            ImGui.pushFont(fontNorm);
            ImGui.beginTabBar("CommandViewerTabs###" + this.title + "CommandTabs", TabBarFlags.Reorderable | TabBarFlags.AutoSelectNewTabs | TabBarFlags.FittingPolicyResizeDown)
            {
                for (index = 0; index < this.tabs.length; index++) {
                    let tabFlags = 0
                    if (this.next_tab !== -1 && index === this.next_tab) {
                        tabFlags |= TabItemFlags.SetSelected
                        this.next_tab = -1
                    }

                    ImGui.setNextItemWidth(10 * charSize.x);
                    if (ImGui.beginTabItem(this.tabs[index].address.toString(16).toUpperCase() + "###CommandViewTab" + this.title + index.toString(), this.tabs[index].__ref_open, tabFlags)) {
                        this.DrawTab(memory, ImGui, index)
                        ImGui.endTabItem();
                    }
                }
            }
            ImGui.endTabBar()
            ImGui.popFont()
        }
        ImGui.end()

        if (this.open === false) {
            this.open = true
            this.selected = false
        }
    }
}