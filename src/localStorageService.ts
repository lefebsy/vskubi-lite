import { Memento } from "vscode";
/**
 * small class to handle extension persited state to store some small informations, not user settings
 */
export class LocalStorageService {
    
    public constructor(private storage: Memento) { }   
    
    public getValue<T>(key : string,defaultValue: T) : T{
        return this.storage.get<T>(key,defaultValue);
    }

    public setValue<T>(key : string, value : T){
        this.storage.update(key, value );
    }
}