/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Platform } from "./util/platform";
import { Archive } from "./util/archive";
import { which } from "shelljs";
import { DownloadUtil } from "./util/download";
import hasha = require("hasha");
import open = require("open");
import * as vscode from 'vscode';
import * as path from 'path';
import * as fsex from 'fs-extra';
import * as fs from 'fs';
import { Cli } from './cli';
import semver = require('semver');
import configData = require('./tools.json');

export class ToolsConfig {

    public static tools: object = ToolsConfig.loadMetadata(configData, Platform.OS);

    public static loadMetadata(requirements, platform): object {
        const reqs = JSON.parse(JSON.stringify(requirements));
            if (reqs.platform) {
                if (reqs.platform[platform]) {
                    Object.assign(reqs, reqs.platform[platform]);
                    delete reqs.platform;
            }
        }
        return reqs;
    }

    public static resetConfiguration(): void {
        ToolsConfig.tools = ToolsConfig.loadMetadata(configData, Platform.OS);
    }

    public static async detectOrDownload(): Promise<string> {

        let toolLocation: string = ToolsConfig.tools.location;

        if (toolLocation === undefined) {
            const toolCacheLocation = path.resolve(Platform.getUserHomePath(), '.vs-tekton', ToolsConfig.tools.cmdFileName);
            const whichLocation = which(cmd);
            const toolLocations: string[] = [whichLocation ? whichLocation.stdout : null, toolCacheLocation];
            toolLocation = await ToolsConfig.selectTool(toolLocations, ToolsConfig.tools.versionRange);

            if (toolLocation === undefined) {
                // otherwise request permission to download
                const toolDlLocation = path.resolve(Platform.getUserHomePath(), '.vs-tekton', ToolsConfig.tools.dlFileName);
                const installRequest = `Download and install v${ToolsConfig.tools.version}`;
                const response = await vscode.window.showInformationMessage(
                    `Cannot find ${ToolsConfig.tools.description} ${ToolsConfig.tools.versionRangeLabel}.`, installRequest, 'Help', 'Cancel');
                fsex.ensureDirSync(path.resolve(Platform.getUserHomePath(), '.vs-tekton'));
                if (response === installRequest) {
                    let action: string;
                    do {
                        action = undefined;
                        await vscode.window.withProgress({
                            cancellable: true,
                            location: vscode.ProgressLocation.Notification,
                            title: `Downloading ${ToolsConfig.tools.description}`
                            },
                            (progress: vscode.Progress<{increment: number, message: string}>, token: vscode.CancellationToken) => {
                                return DownloadUtil.downloadFile(
                                    ToolsConfig.tools.url,
                                    toolDlLocation,
                                    (dlProgress, increment) => progress.report({ increment, message: `${dlProgress}%`})
                                );
                        });
                        const sha256sum: string = await hasha.fromFile(toolDlLocation, {algorithm: 'sha256'});
                        if (sha256sum !== ToolsConfig.tools.sha256sum) {
                            fsex.removeSync(toolDlLocation);
                            action = await vscode.window.showInformationMessage(`Checksum for downloaded ${ToolsConfig.tools.description} v${ToolsConfig.tools.version} is not correct.`, 'Download again', 'Cancel');
                        }

                    } while (action === 'Download again');

                    if (action !== 'Cancel') {
                        await Archive.unzip(toolDlLocation, path.resolve(Platform.getUserHomePath(), '.vs-tekton'), ToolsConfig.tools.filePrefix);
                        fsex.removeSync(toolDlLocation);
                        if (Platform.OS !== 'win32') {
                            fs.chmodSync(toolCacheLocation, 0o765);
                        }
                        toolLocation = toolCacheLocation;
                    }
                } else if (response === `Help`) {
                    open('https://github.com/redhat-developer/vscode-tekton#dependencies');
                }
            }
            if (toolLocation) {
                ToolsConfig.tools.location = toolLocation;
            }
        }
        return toolLocation;
    }

    public static async getVersion(location: string, cmd: string = path.parse(location).name): Promise<string> {
        let detectedVersion: string;
        if (fs.existsSync(location)) {
            const version = new RegExp(`${cmd.toLocaleLowerCase()} v((([0-9]+)\\.([0-9]+)\\.([0-9]+)(?:-([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?)(?:\\+([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?).*`);
            const result = await Cli.getInstance().execute(`"${location}" version`);
            if (result.stdout) {
                const toolVersion: string[] = result.stdout.trim().split('\n').filter((value) => {
                    return value.match(version);
                }).map((value)=>version.exec(value)[1]);
                if (toolVersion.length) {
                    detectedVersion = toolVersion[0];
                }
            }
        }
        return detectedVersion;
    }

    public static async selectTool(locations: string[], versionRange: string): Promise<string> {
        let result;
        for (const location of locations) {
            if (location && semver.satisfies(await ToolsConfig.getVersion(location), versionRange)) {
                result = location;
                break;
            }
        }
        return result;
    }
}
