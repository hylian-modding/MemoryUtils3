export class MemoryUtils3Events {
    static AddTab = "MemoryUtils3_MemoryViewer_AddTab"
}

export class MemoryUtils3Events_AddTabEvent {
    address: number

    constructor(address: number) {
        this.address = address
    }
}