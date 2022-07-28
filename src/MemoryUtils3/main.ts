import { bus } from 'modloader64_api/EventHandler';
import { Heap } from 'modloader64_api/heap';
import { IModLoaderAPI, IPlugin } from 'modloader64_api/IModLoaderAPI';
import { Init, Preinit, Postinit, onTick, onViUpdate } from 'modloader64_api/PluginLifecycle';
import { BpFlags, BpStruct, BpTriggerInfo, Register, RunState } from 'modloader64_api/Sylvain/Debugger';
import { Texture } from 'modloader64_api/Sylvain/Gfx';
import { bool_ref, DrawCornerFlags, IImGui } from 'modloader64_api/Sylvain/ImGui';
import { vec4, xy, xywh } from 'modloader64_api/Sylvain/vec';
import { MemoryUtilsManager } from './MemoryUtils/MemoryUtilsManager';

let ImGui: IImGui
let gMemUtils: MemoryUtilsManager

// Testy debugger stuff, TODO: Move somewhere relevant
export class CBpStruct implements BpStruct {
    address: number = 0
    endAddress: number = 0
    flags: BpFlags = 0

    constructor(address: number, size: number, flags: BpFlags) {
        this.address = address
        this.endAddress = address + size
        this.flags = flags
    }
}

export class CBpTriggerInfo implements BpTriggerInfo {
    flags: BpFlags = 0
    address: number = 0
}

export class MemoryUtils3 implements IPlugin {
    ModLoader = {} as IModLoaderAPI
    name = "MemoryUtils3"

    constructor() {}
    preinit(): void {}
    init(): void {}

    postinit(): void {
        ImGui = this.ModLoader.ImGui

        // TODO: Make configurable
        let big = ImGui.getIo().fonts.addFontFromFile("Inconsolata-Regular.ttf", 18)
        let norm = ImGui.getIo().fonts.addFontFromFile("Inconsolata-Regular.ttf", 14)
        let small = ImGui.getIo().fonts.addFontFromFile("Inconsolata-Light.ttf", 12)

        gMemUtils = new MemoryUtilsManager(this.ModLoader.emulator, ImGui)
        gMemUtils.SetFonts(big, norm, small);

        /* Testy debugger stuff
        if (this.ModLoader.debugger.isEnabled() && this.ModLoader.debugger.isInitialized()) {
            this.ModLoader.utils.setTimeoutFrames(() => {
                this.ModLoader.debugger.bpAddStruct(new CBpStruct(0x001EF6AA, 2, BpFlags.Write | BpFlags.Enabled))
            }, 1)
        }*/

        this.ModLoader.utils.setTimeoutFrames(() => {
            if (this.ModLoader.heap === undefined) {
                this.ModLoader.heap = new Heap(this.ModLoader.emulator, 0x80800000, 0x83E00000 - 0x80400000)
            }
        }, 40)
    }

    @onViUpdate()
    onViUpdate() {
        gMemUtils.Draw()

        /* Testy debugger stuff
        ImGui.begin("FIXME")
        {
            if (ImGui.button("RESUME")) {
                if (this.ModLoader.debugger.getRunState() !== RunState.Running) {
                    this.ModLoader.debugger.setRunState(RunState.Running)
                    this.ModLoader.debugger.step()
                }
            }
        }
        ImGui.end()*/
    }

    onTick(frame: number): void {
        gMemUtils.Update();

        /* Testy debugger stuff
        if (this.ModLoader.debugger.getRunState() !== RunState.Running) {
            this.ModLoader.debugger.setRunState(RunState.Running)
            this.ModLoader.debugger.step()
        }*/
    }
}

module.exports = MemoryUtils3

