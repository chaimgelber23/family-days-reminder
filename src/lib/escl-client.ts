/**
 * ESCL Client for browser-based scanner communication
 * 
 * This client connects to the NAPS2 Local Service running on the user's machine
 * which exposes scanners via the ESCL (eSCL/AirScan) protocol.
 * 
 * @see https://mopria.org/mopria-escl-specification
 */

export interface EsclScanner {
    id: string;
    name: string;
    scannerUrl: string;
    capabilities?: ScannerCapabilities;
}

export interface ScannerCapabilities {
    colorModes: ('Grayscale8' | 'RGB24')[];
    resolutions: number[];
    sources: ('Platen' | 'Feeder')[];
    hasAdf: boolean;
    maxWidth?: number;
    maxHeight?: number;
}

export interface ScanSettings {
    colorMode: 'Grayscale8' | 'RGB24';
    resolution: number;
    source: 'Platen' | 'Feeder';
    format: 'image/jpeg' | 'image/png';
}

export const DEFAULT_SCAN_SETTINGS: ScanSettings = {
    colorMode: 'Grayscale8',
    resolution: 300,
    source: 'Platen',
    format: 'image/jpeg'
};

/**
 * ESCL Client for communicating with the local scanner service
 */
export class EsclClient {
    private baseUrl: string;
    private timeout: number;

    constructor(baseUrl = 'http://localhost:9876', timeout = 30000) {
        this.baseUrl = baseUrl;
        this.timeout = timeout;
    }

    /**
     * Check if the local scanner service is running
     */
    async isServiceRunning(): Promise<boolean> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            const response = await fetch(`${this.baseUrl}/health`, {
                method: 'GET',
                signal: controller.signal,
            });

            clearTimeout(timeoutId);
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Get list of available scanners (local + network)
     */
    async getScanners(): Promise<EsclScanner[]> {
        try {
            const response = await fetch(`${this.baseUrl}/scanners`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
            });

            if (!response.ok) {
                throw new Error(`Failed to get scanners: ${response.statusText}`);
            }

            const data = await response.json();
            return data.scanners || [];
        } catch (error) {
            console.error('Error fetching scanners:', error);
            throw error;
        }
    }

    /**
     * Get detailed capabilities for a specific scanner
     */
    async getCapabilities(scannerId: string): Promise<ScannerCapabilities | null> {
        try {
            const response = await fetch(`${this.baseUrl}/scanners/${encodeURIComponent(scannerId)}/capabilities`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
            });

            if (!response.ok) {
                return null;
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching scanner capabilities:', error);
            return null;
        }
    }

    /**
     * Scan pages from the selected scanner
     * 
     * For ADF (Feeder): Returns all pages until feeder is empty
     * For Platen (Flatbed): Returns a single page
     * 
     * @returns Array of image blobs, one per scanned page
     */
    async scanPages(scannerId: string, settings: ScanSettings): Promise<Blob[]> {
        const scannedPages: Blob[] = [];

        try {
            // Start a scan job
            const jobResponse = await fetch(`${this.baseUrl}/scanners/${encodeURIComponent(scannerId)}/scan`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    colorMode: settings.colorMode,
                    resolution: settings.resolution,
                    source: settings.source,
                    format: settings.format,
                }),
            });

            if (!jobResponse.ok) {
                const errorText = await jobResponse.text();
                throw new Error(`Failed to start scan: ${errorText}`);
            }

            const jobData = await jobResponse.json();
            const jobId = jobData.jobId;

            if (!jobId) {
                throw new Error('No job ID returned from scan request');
            }

            // Poll for pages
            let hasMorePages = true;
            let pageIndex = 0;
            const maxPages = 100; // Safety limit

            while (hasMorePages && pageIndex < maxPages) {
                try {
                    const pageResponse = await fetch(
                        `${this.baseUrl}/scanners/${encodeURIComponent(scannerId)}/jobs/${jobId}/pages/${pageIndex}`,
                        {
                            method: 'GET',
                            headers: { 'Accept': settings.format },
                        }
                    );

                    if (pageResponse.status === 404) {
                        // No more pages
                        hasMorePages = false;
                        break;
                    }

                    if (pageResponse.status === 202) {
                        // Page still scanning, wait and retry
                        await this.delay(500);
                        continue;
                    }

                    if (!pageResponse.ok) {
                        throw new Error(`Failed to get page ${pageIndex}: ${pageResponse.statusText}`);
                    }

                    const blob = await pageResponse.blob();
                    scannedPages.push(blob);
                    pageIndex++;

                    // For Platen, only one page
                    if (settings.source === 'Platen') {
                        hasMorePages = false;
                    }
                } catch (error) {
                    if (error instanceof Error && error.message.includes('404')) {
                        hasMorePages = false;
                    } else {
                        throw error;
                    }
                }
            }

            // Clean up job
            await this.deleteJob(scannerId, jobId);

            return scannedPages;
        } catch (error) {
            console.error('Error during scan:', error);
            throw error;
        }
    }

    /**
     * Cancel an in-progress scan job
     */
    async cancelScan(scannerId: string, jobId: string): Promise<void> {
        try {
            await fetch(`${this.baseUrl}/scanners/${encodeURIComponent(scannerId)}/jobs/${jobId}`, {
                method: 'DELETE',
            });
        } catch (error) {
            console.error('Error cancelling scan:', error);
        }
    }

    /**
     * Delete a completed scan job
     */
    private async deleteJob(scannerId: string, jobId: string): Promise<void> {
        try {
            await fetch(`${this.baseUrl}/scanners/${encodeURIComponent(scannerId)}/jobs/${jobId}`, {
                method: 'DELETE',
            });
        } catch {
            // Ignore cleanup errors
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export singleton instance with default configuration
export const esclClient = new EsclClient();
