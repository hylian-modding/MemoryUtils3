import { assert } from "console";
import { bool_ref, Col, IImGui, StyleVar, number_ref } from "modloader64_api/Sylvain/ImGui";
import { xy, xywh } from "modloader64_api/Sylvain/vec";
import fs from "fs"
import IMemory from "modloader64_api/IMemory";
const cloneDeep = require("lodash.clonedeep");

export function Memset(address: number, length: number, set: number, memory: IMemory) {
    let fillBuf: Buffer = Buffer.alloc(length, set);
    memory.rdramWriteBuffer(address, fillBuf);
}

export function PadAddress(address: number): string {
    return address.toString(16).padStart(2, "0").padEnd(2, "0").toUpperCase()
}

export function Clamp(lhs: number, min: number, max: number): number {
    return Math.max(min, Math.min(lhs, max));
}

export enum NIBBLE {
    LEFT = 0,
    RIGHT
};

export function GetNibble(input: number, side: NIBBLE): number {
    assert(input <= 255 && input >= -127, "[GetNibble] Nibble not in range of byte?? " + input.toString(16));

    switch (side) {
        case NIBBLE.LEFT:
            return input & 0xF0;
            break;
        case NIBBLE.RIGHT:
            return input & 0x0F;
            break;
    }

    return (input & 0xF0) >> 4;
};

export function AddressToNibble(address: number): number {
    return address * 2;
}


export enum SIGN {
    UNSIGNED = 0,
    SIGNED = 1,
    FLOAT = 2,
};

export enum LENGTH {
    L08 = 1,
    L16 = 2,
    L32 = 4,
    L64 = 8
};

export enum SYMBOLTYPE {
    COMPONENT = 0,
    STRUCT
};

type SYMBOLSIZE = LENGTH | number;
type SymbolComponent = SymbolMember | any;

export class SymbolMember {
    // is this a component or struct?
    symbolType: SYMBOLTYPE;

    // used if this is a struct
    typeName: string;

    // used if this is a member of another struct
    memberName: string;

    // sign or float, used if component
    sign: SIGN;

    // number if sizeof struct, LENGTH if component
    length: SYMBOLSIZE;

    // offset from struct if this is a member of another struct
    offset: number;

    // for display of components
    preferHex: bool_ref = [false];

    // if this is a struct, what components do we have?
    components!: SymbolComponent[];

    constructor(symbolType: SYMBOLTYPE, typeName: string, memberName: string = "", sign: SIGN = SIGN.UNSIGNED, length: SYMBOLSIZE, offset: number, components: SymbolComponent[] | undefined) {
        this.symbolType = symbolType;
        this.typeName = typeName;
        this.memberName = memberName;
        this.sign = sign;
        this.length = length;
        this.offset = offset;
        if(components) this.components = components;
    };

    // static methods

    static ComponentFromType(component: SymbolComponent, name: string, offset: number): SymbolComponent {
        let out: SymbolMember = cloneDeep(component);
        out.memberName = name;
        out.offset = offset;
        return out;
    };


    // member methods

    UpdateLengthFromComponents() {
        let length = 0;
        let index = 0;

        assert(this.symbolType === SYMBOLTYPE.STRUCT);

        for (index = 0; index < this.components.length; index++) {
            // if we are getting this from a struct, update it's length first
            if (this.components[index].symbolType === SYMBOLTYPE.STRUCT) this.components[index].UpdateLengthFromComponents();
            length += this.components[index].length;
        }

        this.length = length;
    }
};

export const SYMBOL_TYPE_U8: SymbolMember = new SymbolMember(SYMBOLTYPE.COMPONENT, "u8", undefined, SIGN.UNSIGNED, LENGTH.L08, 0, undefined);
export const SYMBOL_TYPE_U16: SymbolMember = new SymbolMember(SYMBOLTYPE.COMPONENT, "u16", undefined, SIGN.UNSIGNED, LENGTH.L16, 0, undefined);
export const SYMBOL_TYPE_U32: SymbolMember = new SymbolMember(SYMBOLTYPE.COMPONENT, "u32", undefined, SIGN.UNSIGNED, LENGTH.L32, 0, undefined);
export const SYMBOL_TYPE_U64: SymbolMember = new SymbolMember(SYMBOLTYPE.COMPONENT, "u64", undefined, SIGN.UNSIGNED, LENGTH.L64, 0, undefined);

export const SYMBOL_TYPE_S8: SymbolMember = new SymbolMember(SYMBOLTYPE.COMPONENT, "s8", undefined, SIGN.SIGNED, LENGTH.L08, 0, undefined);
export const SYMBOL_TYPE_S16: SymbolMember = new SymbolMember(SYMBOLTYPE.COMPONENT, "s16", undefined, SIGN.SIGNED, LENGTH.L16, 0, undefined);
export const SYMBOL_TYPE_S32: SymbolMember = new SymbolMember(SYMBOLTYPE.COMPONENT, "s32", undefined, SIGN.SIGNED, LENGTH.L32, 0, undefined);
export const SYMBOL_TYPE_S64: SymbolMember = new SymbolMember(SYMBOLTYPE.COMPONENT, "s64", undefined, SIGN.SIGNED, LENGTH.L64, 0, undefined);

export const SYMBOL_TYPE_F32: SymbolMember = new SymbolMember(SYMBOLTYPE.COMPONENT, "f32", undefined, SIGN.FLOAT, LENGTH.L32, 0, undefined);
export const SYMBOL_TYPE_F64: SymbolMember = new SymbolMember(SYMBOLTYPE.COMPONENT, "f64", undefined, SIGN.FLOAT, LENGTH.L64, 0, undefined);

export const SYMBOL_TYPE_VEC4F: SymbolMember = new SymbolMember(SYMBOLTYPE.STRUCT, "Vec4f", undefined, undefined, 0x10, 0, [
    SymbolMember.ComponentFromType(SYMBOL_TYPE_F32, "x", 0),
    SymbolMember.ComponentFromType(SYMBOL_TYPE_F32, "y", 4),
    SymbolMember.ComponentFromType(SYMBOL_TYPE_F32, "z", 8),
    SymbolMember.ComponentFromType(SYMBOL_TYPE_F32, "w", 0x0C)
]);

export const SYMBOL_TYPE_MTXF: SymbolMember = new SymbolMember(SYMBOLTYPE.STRUCT, "MtxF", undefined, undefined, 0x40, 0, [
    SymbolMember.ComponentFromType(SYMBOL_TYPE_VEC4F, "V00", 0x00),
    SymbolMember.ComponentFromType(SYMBOL_TYPE_VEC4F, "V10", 0x10),
    SymbolMember.ComponentFromType(SYMBOL_TYPE_VEC4F, "V20", 0x20),
    SymbolMember.ComponentFromType(SYMBOL_TYPE_VEC4F, "V30", 0x30)
]);

export const SYMBOL_TYPE_VEC3F: SymbolMember = new SymbolMember(SYMBOLTYPE.STRUCT, "Vec3f", undefined, undefined, 0x0C, 0, [
    SymbolMember.ComponentFromType(SYMBOL_TYPE_F32, "x", 0),
    SymbolMember.ComponentFromType(SYMBOL_TYPE_F32, "y", 4),
    SymbolMember.ComponentFromType(SYMBOL_TYPE_F32, "z", 8)
]);

export const SYMBOL_TYPE_VEC3I: SymbolMember = new SymbolMember(SYMBOLTYPE.STRUCT, "Vec3i", undefined, undefined, 0x0C, 0, [
    SymbolMember.ComponentFromType(SYMBOL_TYPE_S32, "x", 0),
    SymbolMember.ComponentFromType(SYMBOL_TYPE_S32, "y", 4),
    SymbolMember.ComponentFromType(SYMBOL_TYPE_S32, "z", 8)
]);

export const SYMBOL_TYPE_VEC3S: SymbolMember = new SymbolMember(SYMBOLTYPE.STRUCT, "Vec3s", undefined, undefined, 0x06, 0, [
    SymbolMember.ComponentFromType(SYMBOL_TYPE_S16, "x", 0),
    SymbolMember.ComponentFromType(SYMBOL_TYPE_S16, "y", 2),
    SymbolMember.ComponentFromType(SYMBOL_TYPE_S16, "z", 4)
]);

export const SYMBOL_TYPE_VEC2F: SymbolMember = new SymbolMember(SYMBOLTYPE.STRUCT, "Vec2f", undefined, undefined, 0x08, 0, [
    SymbolMember.ComponentFromType(SYMBOL_TYPE_F32, "x", 0),
    SymbolMember.ComponentFromType(SYMBOL_TYPE_F32, "y", 4)
]);

export const SYMBOL_TYPE_VEC2I: SymbolMember = new SymbolMember(SYMBOLTYPE.STRUCT, "Vec2i", undefined, undefined, 0x08, 0, [
    SymbolMember.ComponentFromType(SYMBOL_TYPE_S32, "x", 0),
    SymbolMember.ComponentFromType(SYMBOL_TYPE_S32, "y", 4)
]);

export const SYMBOL_TYPE_VEC2S: SymbolMember = new SymbolMember(SYMBOLTYPE.STRUCT, "Vec2s", undefined, undefined, 0x04, 0, [
    SymbolMember.ComponentFromType(SYMBOL_TYPE_S16, "x", 0),
    SymbolMember.ComponentFromType(SYMBOL_TYPE_S16, "y", 2)
]);

export const SYMBOL_TYPE_STANDARD_COUNT: number = 18;

export function SymbolTypeIsStandard(lhs: SymbolComponent) {
    return lhs.typename === SYMBOL_TYPE_U8.typeName
        || lhs.typename === SYMBOL_TYPE_U16.typeName
        || lhs.typename === SYMBOL_TYPE_U32.typeName
        || lhs.typename === SYMBOL_TYPE_U64.typeName
        || lhs.typename === SYMBOL_TYPE_S8.typeName
        || lhs.typename === SYMBOL_TYPE_S16.typeName
        || lhs.typename === SYMBOL_TYPE_S32.typeName
        || lhs.typename === SYMBOL_TYPE_S64.typeName
        || lhs.typename === SYMBOL_TYPE_F32.typeName
        || lhs.typename === SYMBOL_TYPE_F64.typeName
        || lhs.typename === SYMBOL_TYPE_VEC4F.typeName
        || lhs.typename === SYMBOL_TYPE_MTXF.typeName
        || lhs.typename === SYMBOL_TYPE_VEC3F.typeName
        || lhs.typename === SYMBOL_TYPE_VEC3I.typeName
        || lhs.typename === SYMBOL_TYPE_VEC3S.typeName
        || lhs.typename === SYMBOL_TYPE_VEC2F.typeName
        || lhs.typename === SYMBOL_TYPE_VEC2I.typeName
        || lhs.typename === SYMBOL_TYPE_VEC2S.typeName;

}

export class MemorySymbol {
    name: string;
    address: number;
    type: SymbolComponent;

    constructor(name: string, address: number, type: SymbolComponent) {
        this.name = name;
        this.address = address;
        this.type = type;
    }
}

export class MemorySymbols {
    symbols: MemorySymbol[] = [];
    types: SymbolComponent = [
        SYMBOL_TYPE_U8, SYMBOL_TYPE_U16, SYMBOL_TYPE_U32, SYMBOL_TYPE_U64,
        SYMBOL_TYPE_S8, SYMBOL_TYPE_S16, SYMBOL_TYPE_S32, SYMBOL_TYPE_S64,
        SYMBOL_TYPE_F32, SYMBOL_TYPE_F64,
        SYMBOL_TYPE_VEC4F, SYMBOL_TYPE_MTXF,
        SYMBOL_TYPE_VEC3F, SYMBOL_TYPE_VEC3I, SYMBOL_TYPE_VEC3S,
        SYMBOL_TYPE_VEC2F, SYMBOL_TYPE_VEC2I, SYMBOL_TYPE_VEC2S
    ];
}

export class ImGuiStyle {
    name: string = "UNNAMED_STYLE"
    Color: any[] | any= [];
    Var: any[] | any = [];

    constructor(name: string = "UNNAMED_STYLE", Color: any[] | any = [], Var: any[] | any = []) {
        this.name = name;
        this.Color = cloneDeep(Color);
        this.Var = cloneDeep(Var);
    }

    SaveToFile() {
        fs.writeFileSync(this.name + ".json", JSON.stringify(this));
    }

    static LoadFromFile(name: string): ImGuiStyle {
        return JSON.parse(fs.readFileSync(name, 'r')) as ImGuiStyle
    }
}

enum NoConstCol {
    Text, TextDisabled, WindowBg, ChildBg, PopupBg, Border, BorderShadow, FrameBg, FrameBgHovered, FrameBgActive, TitleBg, TitleBgActive,
    TitleBgCollapsed, MenuBarBg, ScrollbarBg, ScrollbarGrab, ScrollbarGrabHovered, ScrollbarGrabActive, CheckMark, SliderGrab, SliderGrabActive,
    Button, ButtonHovered, ButtonActive, Header, HeaderHovered, HeaderActive, Separator, SeparatorHovered, SeparatorActive, ResizeGrip,
    ResizeGripHovered, ResizeGripActive, Tab, TabHovered, TabActive, TabUnfocused, TabUnfocusedActive, DockingPreview, DockingEmptyBg, PlotLines,
    PlotLinesHovered, PlotHistogram, PlotHistogramHovered, TextSelectedBg, DragDropTarget, NavHighlight, NavWindowingHighlight, NavWindowingDimBg,
    ModalWindowDimBg
}

enum NoConstStyleVar {
    Alpha, WindowPadding, WindowRounding, WindowBorderSize, WindowMinSize, WindowTitleAlign, ChildRounding, ChildBorderSize, PopupRounding,
    PopupBorderSize, FramePadding, FrameRounding, FrameBorderSize, ItemSpacing, ItemInnerSpacing, IndentSpacing, ScrollbarSize, ScrollbarRounding,
    GrabMinSize, GrabRounding, TabRounding, ButtonTextAlign, SelectableTextAlign
}

export const IMGUISTYLE_PHOTOSHOPBLACK: ImGuiStyle = new ImGuiStyle(
    "Photoshop Black",
    // Color
    {
      Text: xywh(1.0, 1.0, 1.0, 1.0),
      TextDisabled: xywh(0.5, 0.5, 0.5, 1.0),
      WindowBg: xywh(0.18, 0.18, 0.18, 1.0),
      ChildBg: xywh(0.28, 0.28, 0.28, 0.0),
      PopupBg: xywh(0.313, 0.313, 0.313, 1.0),
      Border: xywh(0.266, 0.266, 0.266, 1.0),
      BorderShadow: xywh(0.0, 0.0, 0.0, 0.0),
      FrameBg: xywh(0.16, 0.16, 0.16, 1.0),
      FrameBgHovered: xywh(0.2, 0.2, 0.2, 1.0),
      FrameBgActive: xywh(0.28, 0.28, 0.28, 1.0),
      TitleBg: xywh(0.148, 0.148, 0.148, 1.0),
      TitleBgActive: xywh(0.148, 0.148, 0.148, 1.0),
      TitleBgCollapsed: xywh(0.148, 0.148, 0.148, 1.0),
      MenuBarBg: xywh(0.195, 0.195, 0.195, 1.0),
      ScrollbarBg: xywh(0.16, 0.16, 0.16, 1.0),
      ScrollbarGrab: xywh(0.277, 0.277, 0.277, 1.0),
      ScrollbarGrabHovered: xywh(0.3, 0.3, 0.3, 1.0),
      ScrollbarGrabActive: xywh(1.0, 0.391, 0.0, 1.0),
      CheckMark: xywh(1.0, 1.0, 1.0, 1.0),
      SliderGrab: xywh(0.391, 0.391, 0.391, 1.0),
      SliderGrabActive: xywh(1.0, 0.391, 0.0, 1.0),
      Button: xywh(1.0, 1.0, 1.0, 0.0),
      ButtonHovered: xywh(1.0, 1.0, 1.0, 0.156),
      ButtonActive: xywh(1.0, 1.0, 1.0, 0.391),
      Header: xywh(0.313, 0.313, 0.313, 1.0),
      HeaderHovered: xywh(0.469, 0.469, 0.469, 1.0),
      HeaderActive: xywh(0.469, 0.469, 0.469, 1.0),
      SeparatorHovered: xywh(0.391, 0.391, 0.391, 1.0),
      SeparatorActive: xywh(1.0, 0.391, 0.0, 1.0),
      ResizeGrip: xywh(1.0, 1.0, 1.0, 0.25),
      ResizeGripHovered: xywh(1.0, 1.0, 1.0, 0.67),
      ResizeGripActive: xywh(1.0, 0.391, 0.0, 1.0),
      Tab: xywh(0.098, 0.098, 0.098, 1.0),
      TabHovered: xywh(0.352, 0.352, 0.352, 1.0),
      TabActive: xywh(0.195, 0.195, 0.195, 1.0),
      TabUnfocused: xywh(0.098, 0.098, 0.098, 1.0),
      TabUnfocusedActive: xywh(0.195, 0.195, 0.195, 1.0),
      DockingPreview: xywh(1.0, 0.391, 0.0, 0.781),
      DockingEmptyBg: xywh(0.18, 0.18, 0.18, 1.0),
      PlotLines: xywh(0.469, 0.469, 0.469, 1.0),
      PlotLinesHovered: xywh(1.0, 0.391, 0.0, 1.0),
      PlotHistogram: xywh(0.586, 0.586, 0.586, 1.0),
      PlotHistogramHovered: xywh(1.0, 0.391, 0.0, 1.0),
      TextSelectedBg: xywh(1.0, 1.0, 1.0, 0.156),
      DragDropTarget: xywh(1.0, 0.391, 0.0, 1.0),
      NavHighlight: xywh(1.0, 0.391, 0.0, 1.0),
      NavWindowingHighlight: xywh(1.0, 0.391, 0.0, 1.0),
      NavWindowingDimBg: xywh(0.0, 0.0, 0.0, 0.586),
      ModalWindowDimBg: xywh(0.0, 0.0, 0.0, 0.586),
    },
    // Var
    {
      ChildRounding: 4.0,
      FrameBorderSize: 1.0,
      FrameRounding: 2.0,
      GrabMinSize: 7.0,
      PopupRounding: 2.0,
      ScrollbarRounding: 12.0,
      ScrollbarSize: 13.0,
      TabRounding: 0.0,
      WindowRounding: 4.0,
    }
);

export const IMGUISTYLE_CORPORATEGREY: ImGuiStyle = new ImGuiStyle(
    "Corporate  Grey",
    {
      Text: xywh(1.0, 1.0, 1.0, 1.0),
      TextDisabled: xywh(0.4, 0.4, 0.4, 1.0),
      ChildBg: xywh(0.25, 0.25, 0.25, 1.0),
      WindowBg: xywh(0.25, 0.25, 0.25, 1.0),
      PopupBg: xywh(0.25, 0.25, 0.25, 1.0),
      Border: xywh(0.12, 0.12, 0.12, 0.71),
      BorderShadow: xywh(1.0, 1.0, 1.0, 0.06),
      FrameBg: xywh(0.42, 0.42, 0.42, 0.54),
      FrameBgHovered: xywh(0.42, 0.42, 0.42, 0.4),
      FrameBgActive: xywh(0.56, 0.56, 0.56, 0.67),
      TitleBg: xywh(0.19, 0.19, 0.19, 1.0),
      TitleBgActive: xywh(0.22, 0.22, 0.22, 1.0),
      TitleBgCollapsed: xywh(0.17, 0.17, 0.17, 0.9),
      MenuBarBg: xywh(0.335, 0.335, 0.335, 1.0),
      ScrollbarBg: xywh(0.24, 0.24, 0.24, 0.53),
      ScrollbarGrab: xywh(0.41, 0.41, 0.41, 1.0),
      ScrollbarGrabHovered: xywh(0.52, 0.52, 0.52, 1.0),
      ScrollbarGrabActive: xywh(0.76, 0.76, 0.76, 1.0),
      CheckMark: xywh(0.65, 0.65, 0.65, 1.0),
      SliderGrab: xywh(0.52, 0.52, 0.52, 1.0),
      SliderGrabActive: xywh(0.64, 0.64, 0.64, 1.0),
      Button: xywh(0.54, 0.54, 0.54, 0.35),
      ButtonHovered: xywh(0.52, 0.52, 0.52, 0.59),
      ButtonActive: xywh(0.76, 0.76, 0.76, 1.0),
      Header: xywh(0.38, 0.38, 0.38, 1.0),
      HeaderHovered: xywh(0.47, 0.47, 0.47, 1.0),
      HeaderActive: xywh(0.76, 0.76, 0.76, 0.77),
      Separator: xywh(0.0, 0.0, 0.0, 0.137),
      SeparatorHovered: xywh(0.7, 0.671, 0.6, 0.29),
      SeparatorActive: xywh(0.702, 0.671, 0.6, 0.674),
      ResizeGrip: xywh(0.26, 0.59, 0.98, 0.25),
      ResizeGripHovered: xywh(0.26, 0.59, 0.98, 0.67),
      ResizeGripActive: xywh(0.26, 0.59, 0.98, 0.95),
      PlotLines: xywh(0.61, 0.61, 0.61, 1.0),
      PlotLinesHovered: xywh(1.0, 0.43, 0.35, 1.0),
      PlotHistogram: xywh(0.9, 0.7, 0.0, 1.0),
      PlotHistogramHovered: xywh(1.0, 0.6, 0.0, 1.0),
      TextSelectedBg: xywh(0.73, 0.73, 0.73, 0.35),
      ModalWindowDimBg: xywh(0.8, 0.8, 0.8, 0.35),
      DragDropTarget: xywh(1.0, 1.0, 0.0, 0.9),
      NavHighlight: xywh(0.26, 0.59, 0.98, 1.0),
      NavWindowingHighlight: xywh(1.0, 1.0, 1.0, 0.7),
      NavWindowingDimBg: xywh(0.8, 0.8, 0.8, 0.2),
      DockingEmptyBg: xywh(0.38, 0.38, 0.38, 1.0),
      Tab: xywh(0.25, 0.25, 0.25, 1.0),
      TabHovered: xywh(0.4, 0.4, 0.4, 1.0),
      TabActive: xywh(0.33, 0.33, 0.33, 1.0),
      TabUnfocused: xywh(0.25, 0.25, 0.25, 1.0),
      TabUnfocusedActive: xywh(0.33, 0.33, 0.33, 1.0),
      DockingPreview: xywh(0.85, 0.85, 0.85, 0.28),
    },
    {
      PopupRounding: 3,
      WindowPadding: xy(4, 4),
      FramePadding: xy(6, 4),
      ItemSpacing: xy(6, 2),
      ScrollbarSize: 18,
      WindowBorderSize: 1,
      ChildBorderSize: 1,
      PopupBorderSize: 1,
      FrameBorderSize: 0,
      WindowRounding: 3,
      ChildRounding: 3,
      FrameRounding: 3,
      ScrollbarRounding: 2,
      GrabRounding: 3,
      TabRounding: 3,
    }
);

export const IMGUISTYLE_GEARRED: ImGuiStyle = new ImGuiStyle("Gear Red",
    {
        Text: xywh(1.0, 1.0, 1.0, 1.0),
        TextDisabled: xywh(0.73, 0.75, 0.74, 1.0),
        WindowBg: xywh(0.09, 0.09, 0.09, 0.94),
        ChildBg: xywh(0.0, 0.0, 0.0, 0.0),
        PopupBg: xywh(0.08, 0.08, 0.08, 0.94),
        Border: xywh(0.2, 0.2, 0.2, 0.5),
        BorderShadow: xywh(0.0, 0.0, 0.0, 0.0),
        FrameBg: xywh(0.71, 0.39, 0.39, 0.54),
        FrameBgHovered: xywh(0.84, 0.66, 0.66, 0.4),
        FrameBgActive: xywh(0.84, 0.66, 0.66, 0.67),
        TitleBg: xywh(0.47, 0.22, 0.22, 0.67),
        TitleBgActive: xywh(0.47, 0.22, 0.22, 1.0),
        TitleBgCollapsed: xywh(0.47, 0.22, 0.22, 0.67),
        MenuBarBg: xywh(0.34, 0.16, 0.16, 1.0),
        ScrollbarBg: xywh(0.02, 0.02, 0.02, 0.53),
        ScrollbarGrab: xywh(0.31, 0.31, 0.31, 1.0),
        ScrollbarGrabHovered: xywh(0.41, 0.41, 0.41, 1.0),
        ScrollbarGrabActive: xywh(0.51, 0.51, 0.51, 1.0),
        CheckMark: xywh(1.0, 1.0, 1.0, 1.0),
        SliderGrab: xywh(0.71, 0.39, 0.39, 1.0),
        SliderGrabActive: xywh(0.84, 0.66, 0.66, 1.0),
        Button: xywh(0.47, 0.22, 0.22, 0.65),
        ButtonHovered: xywh(0.71, 0.39, 0.39, 0.65),
        ButtonActive: xywh(0.2, 0.2, 0.2, 0.5),
        Header: xywh(0.71, 0.39, 0.39, 0.54),
        HeaderHovered: xywh(0.84, 0.66, 0.66, 0.65),
        HeaderActive: xywh(0.84, 0.66, 0.66, 0.0),
        Separator: xywh(0.43, 0.43, 0.5, 0.5),
        SeparatorHovered: xywh(0.71, 0.39, 0.39, 0.54),
        SeparatorActive: xywh(0.71, 0.39, 0.39, 0.54),
        ResizeGrip: xywh(0.71, 0.39, 0.39, 0.54),
        ResizeGripHovered: xywh(0.84, 0.66, 0.66, 0.66),
        ResizeGripActive: xywh(0.84, 0.66, 0.66, 0.66),
        Tab: xywh(0.71, 0.39, 0.39, 0.54),
        TabHovered: xywh(0.84, 0.66, 0.66, 0.66),
        TabActive: xywh(0.84, 0.66, 0.66, 0.66),
        TabUnfocused: xywh(0.07, 0.1, 0.15, 0.97),
        TabUnfocusedActive: xywh(0.14, 0.26, 0.42, 1.0),
        PlotLines: xywh(0.61, 0.61, 0.61, 1.0),
        PlotLinesHovered: xywh(1.0, 0.43, 0.35, 1.0),
        PlotHistogram: xywh(0.9, 0.7, 0.0, 1.0),
        PlotHistogramHovered: xywh(1.0, 0.6, 0.0, 1.0),
        TextSelectedBg: xywh(0.26, 0.59, 0.98, 0.35),
        DragDropTarget: xywh(1.0, 1.0, 0.0, 0.9),
        NavHighlight: xywh(0.41, 0.41, 0.41, 1.0),
        NavWindowingHighlight: xywh(1.0, 1.0, 1.0, 0.7),
        NavWindowingDimBg: xywh(0.8, 0.8, 0.8, 0.2),
        ModalWindowDimBg: xywh(0.8, 0.8, 0.8, 0.35),
    },
    {
        FrameRounding: 4.0,
        WindowBorderSize: 0.0,
        PopupBorderSize: 0.0,
        GrabRounding: 4.0,
    }
)

export const IMGUISTYLE_DARKPURPLE: ImGuiStyle = new ImGuiStyle("Dark Purple",
    {
        Text: xywh(0.9, 0.9, 0.9, 0.9),
        TextDisabled: xywh(0.6, 0.6, 0.6, 1.0),
        WindowBg: xywh(0.09, 0.09, 0.15, 1.0),
        PopupBg: xywh(0.05, 0.05, 0.1, 0.85),
        Border: xywh(0.7, 0.7, 0.7, 0.65),
        BorderShadow: xywh(0.0, 0.0, 0.0, 0.0),
        FrameBg: xywh(0.0, 0.0, 0.01, 1.0),
        FrameBgHovered: xywh(0.9, 0.8, 0.8, 0.4),
        FrameBgActive: xywh(0.9, 0.65, 0.65, 0.45),
        TitleBg: xywh(0.0, 0.0, 0.0, 0.83),
        TitleBgCollapsed: xywh(0.4, 0.4, 0.8, 0.2),
        TitleBgActive: xywh(0.0, 0.0, 0.0, 0.87),
        MenuBarBg: xywh(0.01, 0.01, 0.02, 0.8),
        ScrollbarBg: xywh(0.2, 0.25, 0.3, 0.6),
        ScrollbarGrab: xywh(0.55, 0.53, 0.55, 0.51),
        ScrollbarGrabHovered: xywh(0.56, 0.56, 0.56, 1.0),
        ScrollbarGrabActive: xywh(0.56, 0.56, 0.56, 0.91),
        CheckMark: xywh(0.9, 0.9, 0.9, 0.83),
        SliderGrab: xywh(0.7, 0.7, 0.7, 0.62),
        SliderGrabActive: xywh(0.3, 0.3, 0.3, 0.84),
        Button: xywh(0.48, 0.72, 0.89, 0.49),
        ButtonHovered: xywh(0.5, 0.69, 0.99, 0.68),
        ButtonActive: xywh(0.8, 0.5, 0.5, 1.0),
        Header: xywh(0.3, 0.69, 1.0, 0.53),
        HeaderHovered: xywh(0.44, 0.61, 0.86, 1.0),
        HeaderActive: xywh(0.38, 0.62, 0.83, 1.0),
        ResizeGrip: xywh(1.0, 1.0, 1.0, 0.85),
        ResizeGripHovered: xywh(1.0, 1.0, 1.0, 0.6),
        ResizeGripActive: xywh(1.0, 1.0, 1.0, 0.9),
        PlotLines: xywh(1.0, 1.0, 1.0, 1.0),
        PlotLinesHovered: xywh(0.9, 0.7, 0.0, 1.0),
        PlotHistogram: xywh(0.9, 0.7, 0.0, 1.0),
        PlotHistogramHovered: xywh(1.0, 0.6, 0.0, 1.0),
        ModalWindowDimBg: xywh(0.2, 0.2, 0.2, 0.35),
    },
    {
        WindowRounding: 5.3,
        FrameRounding: 2.3,
        ScrollbarRounding: 0,
    },
)

export const IMGUISTYLE_LIGHT: ImGuiStyle = new ImGuiStyle("Light",
    {
        Text: xywh(0.0, 0.0, 0.0, 1.0),
        TextDisabled: xywh(0.6, 0.6, 0.6, 1.0),
        WindowBg: xywh(0.94, 0.94, 0.94, 0.94),
        ChildWindowBg: xywh(0.0, 0.0, 0.0, 0.0),
        PopupBg: xywh(1.0, 1.0, 1.0, 0.94),
        Border: xywh(0.0, 0.0, 0.0, 0.39),
        BorderShadow: xywh(1.0, 1.0, 1.0, 0.1),
        FrameBg: xywh(1.0, 1.0, 1.0, 0.94),
        FrameBgHovered: xywh(0.26, 0.59, 0.98, 0.4),
        FrameBgActive: xywh(0.26, 0.59, 0.98, 0.67),
        TitleBg: xywh(0.96, 0.96, 0.96, 1.0),
        TitleBgCollapsed: xywh(1.0, 1.0, 1.0, 0.51),
        TitleBgActive: xywh(0.82, 0.82, 0.82, 1.0),
        MenuBarBg: xywh(0.86, 0.86, 0.86, 1.0),
        ScrollbarBg: xywh(0.98, 0.98, 0.98, 0.53),
        ScrollbarGrab: xywh(0.69, 0.69, 0.69, 1.0),
        ScrollbarGrabHovered: xywh(0.59, 0.59, 0.59, 1.0),
        ScrollbarGrabActive: xywh(0.49, 0.49, 0.49, 1.0),
        ComboBg: xywh(0.86, 0.86, 0.86, 0.99),
        CheckMark: xywh(0.26, 0.59, 0.98, 1.0),
        SliderGrab: xywh(0.24, 0.52, 0.88, 1.0),
        SliderGrabActive: xywh(0.26, 0.59, 0.98, 1.0),
        Button: xywh(0.26, 0.59, 0.98, 0.4),
        ButtonHovered: xywh(0.26, 0.59, 0.98, 1.0),
        ButtonActive: xywh(0.06, 0.53, 0.98, 1.0),
        Header: xywh(0.26, 0.59, 0.98, 0.31),
        HeaderHovered: xywh(0.26, 0.59, 0.98, 0.8),
        HeaderActive: xywh(0.26, 0.59, 0.98, 1.0),
        Column: xywh(0.39, 0.39, 0.39, 1.0),
        ColumnHovered: xywh(0.26, 0.59, 0.98, 0.78),
        ColumnActive: xywh(0.26, 0.59, 0.98, 1.0),
        ResizeGrip: xywh(1.0, 1.0, 1.0, 0.5),
        ResizeGripHovered: xywh(0.26, 0.59, 0.98, 0.67),
        ResizeGripActive: xywh(0.26, 0.59, 0.98, 0.95),
        CloseButton: xywh(0.59, 0.59, 0.59, 0.5),
        CloseButtonHovered: xywh(0.98, 0.39, 0.36, 1.0),
        CloseButtonActive: xywh(0.98, 0.39, 0.36, 1.0),
        PlotLines: xywh(0.39, 0.39, 0.39, 1.0),
        PlotLinesHovered: xywh(1.0, 0.43, 0.35, 1.0),
        PlotHistogram: xywh(0.9, 0.7, 0.0, 1.0),
        PlotHistogramHovered: xywh(1.0, 0.6, 0.0, 1.0),
        TextSelectedBg: xywh(0.26, 0.59, 0.98, 0.35),
        ModalWindowDarkening: xywh(0.2, 0.2, 0.2, 0.35),
    },
    {
        Alpha: 1.0,
        FrameRounding: 3.0,
    },
)

export const IMGUISTYLE_OVERENGINE: ImGuiStyle = new ImGuiStyle(
    "Over Engine",
    {
        Text: xywh(1.0, 1.0, 1.0, 1.0),
        TextDisabled: xywh(0.5, 0.5, 0.5, 1.0),
        WindowBg: xywh(0.13, 0.14, 0.15, 1.0),
        ChildBg: xywh(0.13, 0.14, 0.15, 1.0),
        PopupBg: xywh(0.13, 0.14, 0.15, 1.0),
        Border: xywh(0.43, 0.43, 0.5, 0.5),
        BorderShadow: xywh(0.0, 0.0, 0.0, 0.0),
        FrameBg: xywh(0.25, 0.25, 0.25, 1.0),
        FrameBgHovered: xywh(0.38, 0.38, 0.38, 1.0),
        FrameBgActive: xywh(0.67, 0.67, 0.67, 0.39),
        TitleBg: xywh(0.08, 0.08, 0.09, 1.0),
        TitleBgActive: xywh(0.08, 0.08, 0.09, 1.0),
        TitleBgCollapsed: xywh(0.0, 0.0, 0.0, 0.51),
        MenuBarBg: xywh(0.14, 0.14, 0.14, 1.0),
        ScrollbarBg: xywh(0.02, 0.02, 0.02, 0.53),
        ScrollbarGrab: xywh(0.31, 0.31, 0.31, 1.0),
        ScrollbarGrabHovered: xywh(0.41, 0.41, 0.41, 1.0),
        ScrollbarGrabActive: xywh(0.51, 0.51, 0.51, 1.0),
        CheckMark: xywh(0.11, 0.64, 0.92, 1.0),
        SliderGrab: xywh(0.11, 0.64, 0.92, 1.0),
        SliderGrabActive: xywh(0.08, 0.5, 0.72, 1.0),
        Button: xywh(0.25, 0.25, 0.25, 1.0),
        ButtonHovered: xywh(0.38, 0.38, 0.38, 1.0),
        ButtonActive: xywh(0.67, 0.67, 0.67, 0.39),
        Header: xywh(0.22, 0.22, 0.22, 1.0),
        HeaderHovered: xywh(0.25, 0.25, 0.25, 1.0),
        HeaderActive: xywh(0.67, 0.67, 0.67, 0.39),
        SeparatorHovered: xywh(0.41, 0.42, 0.44, 1.0),
        SeparatorActive: xywh(0.26, 0.59, 0.98, 0.95),
        ResizeGrip: xywh(0.0, 0.0, 0.0, 0.0),
        ResizeGripHovered: xywh(0.29, 0.3, 0.31, 0.67),
        ResizeGripActive: xywh(0.26, 0.59, 0.98, 0.95),
        Tab: xywh(0.08, 0.08, 0.09, 0.83),
        TabHovered: xywh(0.33, 0.34, 0.36, 0.83),
        TabActive: xywh(0.23, 0.23, 0.24, 1.0),
        TabUnfocused: xywh(0.08, 0.08, 0.09, 1.0),
        TabUnfocusedActive: xywh(0.13, 0.14, 0.15, 1.0),
        DockingPreview: xywh(0.26, 0.59, 0.98, 0.7),
        DockingEmptyBg: xywh(0.2, 0.2, 0.2, 1.0),
        PlotLines: xywh(0.61, 0.61, 0.61, 1.0),
        PlotLinesHovered: xywh(1.0, 0.43, 0.35, 1.0),
        PlotHistogram: xywh(0.9, 0.7, 0.0, 1.0),
        PlotHistogramHovered: xywh(1.0, 0.6, 0.0, 1.0),
        TextSelectedBg: xywh(0.26, 0.59, 0.98, 0.35),
        DragDropTarget: xywh(0.11, 0.64, 0.92, 1.0),
        NavHighlight: xywh(0.26, 0.59, 0.98, 1.0),
        NavWindowingHighlight: xywh(1.0, 1.0, 1.0, 0.7),
        NavWindowingDimBg: xywh(0.8, 0.8, 0.8, 0.2),
        ModalWindowDimBg: xywh(0.8, 0.8, 0.8, 0.35),
    },
    {
        WindowRounding: 0.0,
        FrameRounding: 0.0,
        ScrollbarRounding: 0,
        GrabRounding: 2.4,
    }
);

export const IMGUISTYLE_BASE16GRAYSCALEDARK_BAD: ImGuiStyle = new ImGuiStyle(
    "Base16 Grayscale Dark (Poorly Implemented)",
    {
        Text: xywh(0.73, 0.73, 0.73, 1.0),
        TextDisabled: xywh(0.5, 0.5, 0.5, 1.0),
        WindowBg: xywh(0.06, 0.06, 0.06, 1.0),
        ChildBg: xywh(0.06, 0.06, 0.06, 1.0),
        PopupBg: xywh(0.06, 0.06, 0.06, 1.0),
        Border: xywh(0.32, 0.32, 0.32, 0.73),
        BorderShadow: xywh(0.06, 0.06, 0.06, 0.06),
        FrameBg: xywh(0.06, 0.06, 0.06, 1.0),
        FrameBgHovered: xywh(0.32, 0.32, 0.32, 1.0),
        FrameBgActive: xywh(0.19, 0.19, 0.19, 1.0),
        TitleBg: xywh(0.19, 0.19, 0.19, 1.0),
        TitleBgActive: xywh(0.06, 0.06, 0.06, 1.0),
        TitleBgCollapsed: xywh(0.13, 0.13, 0.13, 1.0),
        MenuBarBg: xywh(0.06, 0.06, 0.06, 1.0),
        ScrollbarBg: xywh(0.02, 0.02, 0.02, 0.53),
        ScrollbarGrab: xywh(0.32, 0.32, 0.32, 1.0),
        ScrollbarGrabHovered: xywh(0.5, 0.5, 0.5, 1.0),
        ScrollbarGrabActive: xywh(0.32, 0.32, 0.32, 1.0),
        CheckMark: xywh(0.25, 0.67, 0.31, 1.0),
        SliderGrab: xywh(0.32, 0.32, 0.32, 1.0),
        SliderGrabActive: xywh(0.5, 0.5, 0.5, 1.0),
        Button: xywh(0.32, 0.32, 0.32, 1.0),
        ButtonHovered: xywh(0.5, 0.5, 0.5, 1.0),
        ButtonActive: xywh(0.32, 0.32, 0.32, 1.0),
        Header: xywh(0.06, 0.06, 0.06, 1.0),
        HeaderHovered: xywh(0.19, 0.19, 0.19, 1.0),
        HeaderActive: xywh(0.13, 0.13, 0.13, 1.0),
        Separator: xywh(0.32, 0.32, 0.32, 1.0),
        SeparatorHovered: xywh(0.5, 0.5, 0.5, 1.0),
        SeparatorActive: xywh(0.32, 0.32, 0.32, 1.0),
        ResizeGrip: xywh(0.32, 0.32, 0.32, 1.0),
        ResizeGripHovered: xywh(0.5, 0.5, 0.5, 1.0),
        ResizeGripActive: xywh(0.32, 0.32, 0.32, 1.0),
        Tab: xywh(0.06, 0.06, 0.06, 1.0),
        TabHovered: xywh(0.19, 0.19, 0.19, 1.0),
        TabActive: xywh(0.13, 0.13, 0.13, 1.0),
        TabUnfocused: xywh(0.06, 0.06, 0.06, 1.0),
        TabUnfocusedActive: xywh(0.13, 0.13, 0.13, 1.0),
        DockingPreview: xywh(0.34, 0.34, 0.34, 0.5),
        DockingEmptyBg: xywh(0.06, 0.06, 0.06, 1.0),
        PlotLines: xywh(0.34, 0.34, 0.34, 1.0),
        PlotLinesHovered: xywh(0.5, 0.5, 0.5, 1.0),
        PlotHistogram: xywh(0.06, 0.06, 0.06, 1.0),
        PlotHistogramHovered: xywh(0.19, 0.19, 0.19, 1.0),
        TableHeaderBg: xywh(0.06, 0.06, 0.06, 1.0),
        TableBorderStrong: xywh(0.32, 0.32, 0.32, 1.0),
        TableBorderLight: xywh(0.32, 0.32, 0.32, 0.5),
        TableRowBg: xywh(0.06, 0.06, 0.06, 1.0),
        TableRowBgAlt: xywh(0.13, 0.13, 0.13, 1.0),
        TextSelectedBg: xywh(0.34, 0.34, 0.34, 0.5),
        DragDropTarget: xywh(0.06, 0.06, 0.06, 1.0),
        NavHighlight: xywh(0.34, 0.34, 0.34, 1.0),
        NavWindowingHighlight: xywh(1.0, 1.0, 1.0, 0.7),
        NavWindowingDimBg: xywh(0.8, 0.8, 0.8, 0.2),
        ModalWindowDimBg: xywh(0.8, 0.8, 0.8, 0.35),
    },
    {
        WindowRounding: 0,
        FrameRounding: 0,
        ScrollbarRounding: 0,
        GrabRounding: 0,
    }
);

export class ImGuiStyleManager {
    styles: ImGuiStyle[] = [IMGUISTYLE_PHOTOSHOPBLACK, IMGUISTYLE_CORPORATEGREY, IMGUISTYLE_GEARRED, IMGUISTYLE_DARKPURPLE, IMGUISTYLE_LIGHT, IMGUISTYLE_OVERENGINE, IMGUISTYLE_BASE16GRAYSCALEDARK_BAD]
    names: string[] = [];
    current: number = -1;

    QueryNames() {
        this.names = [];

        let index = 0;

        for (index = 0; index < this.styles.length; index++) {
            this.names.push(this.styles[index].name);
        }
    }

    ChangeStyle(ImGui: IImGui, next: number) {
        if (this.styles.length === 0 || this.styles.length <= next) return

        if (this.current != -1) {
            ImGui.popStyleColor(this.styles[this.current].Color.length);
            ImGui.popStyleVar(this.styles[this.current].Var.length);
        }

        console.log("Finished popping");
        ImGui.styleColorsClassic();

        Object.keys(this.styles[next].Color).forEach((key)=>{
            if (NoConstCol[key as any] !== undefined) {
                //@ts-ignore
                ImGui.pushStyleColor((NoConstCol[key as any]), this.styles[next].Color[key as any]);
            }
            else {
                console.warn("Color Type " + key + " from " + this.styles[next].name + " is unavailable or was depricated!")
            }
        })

        Object.keys(this.styles[next].Var).forEach((key)=>{
            if (NoConstStyleVar[key as any] !== undefined) {
                //@ts-ignore
                ImGui.pushStyleVar(NoConstStyleVar[key as any], this.styles[next].Var[key as any]);
            }
            else {
                console.warn("Var Type " + key + " from " + this.styles[next].name + " is unavailable or was depricated!")
            }
        })

        console.log("Finished pushing");

        this.current = next;
    }
}


