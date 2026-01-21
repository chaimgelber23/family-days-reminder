'use client';

// File System Access API utility for persistent folder selection
// This API allows storing a directory handle that can be reused across sessions

// Type declarations for File System Access API (not in standard TS lib)
declare global {
    interface Window {
        showDirectoryPicker(options?: {
            id?: string;
            mode?: 'read' | 'readwrite';
            startIn?: FileSystemHandle | 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
        }): Promise<FileSystemDirectoryHandle>;
    }

    interface FileSystemHandle {
        queryPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
        requestPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
    }

    interface FileSystemDirectoryHandle {
        values(): AsyncIterableIterator<FileSystemHandle>;
        getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
        getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
    }

    interface FileSystemFileHandle {
        getFile(): Promise<File>;
    }
}

import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface FolderHandleDB extends DBSchema {
    'folder-handles': {
        key: string;
        value: {
            handle: FileSystemDirectoryHandle;
            name: string;
            savedAt: number;
        };
    };
}

const DB_NAME = 'vms-folder-handles';
const STORE_NAME = 'folder-handles';
const DEFAULT_FOLDER_KEY = 'default-folder';

let dbInstance: IDBPDatabase<FolderHandleDB> | null = null;

async function getDB(): Promise<IDBPDatabase<FolderHandleDB>> {
    if (dbInstance) return dbInstance;

    dbInstance = await openDB<FolderHandleDB>(DB_NAME, 1, {
        upgrade(db) {
            db.createObjectStore(STORE_NAME);
        },
    });

    return dbInstance;
}

// Check if File System Access API is supported
export function isFileSystemAccessSupported(): boolean {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

// Save a directory handle to IndexedDB
export async function saveDirectoryHandle(
    handle: FileSystemDirectoryHandle,
    key: string = DEFAULT_FOLDER_KEY
): Promise<void> {
    const db = await getDB();
    await db.put(STORE_NAME, {
        handle,
        name: handle.name,
        savedAt: Date.now(),
    }, key);
}

// Get a saved directory handle from IndexedDB
export async function getSavedDirectoryHandle(
    key: string = DEFAULT_FOLDER_KEY
): Promise<{ handle: FileSystemDirectoryHandle; name: string } | null> {
    try {
        const db = await getDB();
        const record = await db.get(STORE_NAME, key);
        if (record) {
            return { handle: record.handle, name: record.name };
        }
        return null;
    } catch {
        return null;
    }
}

// Clear a saved directory handle
export async function clearDirectoryHandle(key: string = DEFAULT_FOLDER_KEY): Promise<void> {
    const db = await getDB();
    await db.delete(STORE_NAME, key);
}

// Request permission for a saved handle
export async function verifyPermission(
    handle: FileSystemDirectoryHandle,
    readWrite: boolean = false
): Promise<boolean> {
    const options = { mode: readWrite ? 'readwrite' : 'read' } as const;

    // Check if we already have permission
    if ((await handle.queryPermission(options)) === 'granted') {
        return true;
    }

    // Request permission if needed
    if ((await handle.requestPermission(options)) === 'granted') {
        return true;
    }

    return false;
}

// Pick a directory and optionally save it
export async function pickDirectory(saveAsDefault: boolean = false): Promise<{
    handle: FileSystemDirectoryHandle;
    files: File[];
} | null> {
    if (!isFileSystemAccessSupported()) {
        return null;
    }

    try {
        const handle = await window.showDirectoryPicker({
            mode: 'read',
        });

        if (saveAsDefault) {
            await saveDirectoryHandle(handle);
        }

        const files = await getFilesFromDirectory(handle);
        return { handle, files };
    } catch (err) {
        // User cancelled or error
        if ((err as Error).name !== 'AbortError') {
            console.error('Error picking directory:', err);
        }
        return null;
    }
}

// Open a previously saved directory
export async function openSavedDirectory(): Promise<{
    handle: FileSystemDirectoryHandle;
    files: File[];
    name: string;
} | null> {
    const saved = await getSavedDirectoryHandle();
    if (!saved) return null;

    const hasPermission = await verifyPermission(saved.handle);
    if (!hasPermission) return null;

    const files = await getFilesFromDirectory(saved.handle);
    return { handle: saved.handle, files, name: saved.name };
}

// Get all files from a directory handle (non-recursive for now)
export async function getFilesFromDirectory(
    handle: FileSystemDirectoryHandle,
    recursive: boolean = false
): Promise<File[]> {
    const files: File[] = [];

    for await (const entry of handle.values()) {
        if (entry.kind === 'file') {
            // Skip hidden files
            if (!entry.name.startsWith('.')) {
                const fileHandle = entry as unknown as FileSystemFileHandle;
                const file = await fileHandle.getFile();
                files.push(file);
            }
        } else if (entry.kind === 'directory' && recursive) {
            const dirHandle = entry as unknown as FileSystemDirectoryHandle;
            const subFiles = await getFilesFromDirectory(dirHandle, true);
            files.push(...subFiles);
        }
    }

    return files.sort((a, b) => a.name.localeCompare(b.name));
}

// Check if there's a saved folder
export async function hasSavedFolder(): Promise<{ exists: boolean; name?: string }> {
    const saved = await getSavedDirectoryHandle();
    if (saved) {
        return { exists: true, name: saved.name };
    }
    return { exists: false };
}
