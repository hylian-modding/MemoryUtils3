import { bool_ref, IImGui } from "modloader64_api/Sylvain/ImGui"
import { ImGuiStyle, ImGuiStyleManager } from "./CommonUtils"

export class StyleEditor {
    style: ImGuiStyle = new ImGuiStyle("UNNAMED_STYLE")
    _open: bool_ref = [true]
    _selected: bool_ref = [false]

    Draw(ImGui: IImGui, styleManager: ImGuiStyleManager) {
        ImGui.showDemoWindow()
        ImGui.begin("StyleEditor##NoChildStyleEditor")
        ImGui.showStyleEditor()
        ImGui.end()
        ImGui.showMetricsWindow()
    }
}